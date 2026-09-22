/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// ─────────────────────────────────────────────────────────────────────────────
// PerformanceStatsScreen.js   ("Graph and statistics")
//
// Replaces src/admin/Performance.js.
//
// The old screen drew grouped bars inside a horizontal ScrollView with a
// "Scroll right to see more" hint. To compare April against last April you had
// to scroll to April and then judge two bar heights by eye — and the one number
// anyone actually wants (how much up or down are we?) was never on screen.
//
// The payload is already a this-year / last-year PAIR per period, so the answer
// is arithmetic, not a picture. This screen states it: per period a table of
// THIS YR | LAST YR | YoY, with a headline totals block above it, and a thin
// paired bar under each row purely to carry the shape the chart used to carry.
//
// Data contract — unchanged, read exactly as the old screen read it:
//   GET {BACKEND_URL}/performance?location={location}
//   json.Leads[period]    → ivrChartData, webChartData, botChartData
//   json.Patients[period] → newPatientChartData, followUpPatientChartData,
//                           ipdPatientChartData
//   json.Opd[period]      → opdPatientChartData, labChartData
//   json.Ipd[period]      → ipdPatientChartData   ← named "patient", holds the
//                                                   IPD INVOICE series. Kept as
//                                                   is; renaming it server-side
//                                                   is a separate change.
//   each series = { labels: [], thisYear: [], lastYear: [] }
//   json.Yearly[<label>]  → the yearly rollups, keyed by display label
//   period ∈ 'Monthly' | 'Quarterly'   (Yearly comes from json.Yearly)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { F, T, HUE } from '../design/tokens';
import SectionHeader from '../design/components/SectionHeader';

const ACCENT = HUE.performance || '#1E7A5A';

const BACKEND_URL = 'http://10.0.0.30:5100/hms';

// No red anywhere on this screen — a month that is down is not an error.
// Up reads green, down reads bronze, flat reads muted.
const UP = '#1E7A5A';
const DOWN = '#8A6F4A';
const THIS_BAR = ACCENT;
const LAST_BAR = '#C9D3CE';

// ── numbers ──────────────────────────────────────────────────────────────────
// The old ComparisonChart sanitised with String(v).replace(/[^\d.-]/g,''),
// because some series arrive as "₹1,23,456". Same rule here so the two screens
// can never disagree about what a value is.
const toNum = v => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const num = n => Math.round(toNum(n)).toLocaleString('en-IN');

const inrCompact = n => {
  const v = Math.abs(toNum(n));
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v / 1e7 >= 10 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v / 1e5 >= 10 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${Math.round(v)}`;
};

// A count and a rupee figure should not be formatted the same way.
const fmt = (v, money) => (money ? inrCompact(v) : num(v));

const pctDelta = (now, prev) => {
  const a = toNum(now);
  const b = toNum(prev);
  if (b === 0) return a === 0 ? 0 : null; // null = "no base to compare against"
  return ((a - b) / b) * 100;
};

const deltaText = d => {
  if (d === null) return 'new';
  const s = Math.abs(d) >= 100 ? d.toFixed(0) : d.toFixed(1);
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(s)}%`;
};

const deltaColour = d => {
  if (d === null) return T.muted;
  if (d > 0.5) return UP;
  if (d < -0.5) return DOWN;
  return T.muted;
};

const arrow = d => (d === null ? '' : d > 0.5 ? '↑' : d < -0.5 ? '↓' : '·');

// ── what each tab shows ──────────────────────────────────────────────────────
// `money` marks the series that are rupee values, so the table formats them as
// currency instead of counts. `yearly` names the key inside json.Yearly.
const TABS = [
  {
    key: 'Leads',
    label: 'Leads',
    bucket: 'Leads',
    series: [
      { k: 'ivrChartData', title: 'IVR calls', yearly: 'IVR Calls' },
      { k: 'webChartData', title: 'Web leads', yearly: 'Web Leads' },
      { k: 'botChartData', title: 'Bot leads', yearly: 'Bot Leads' },
    ],
  },
  {
    key: 'Patients',
    label: 'Patients',
    bucket: 'Patients',
    series: [
      {
        k: 'newPatientChartData',
        title: 'New appointments',
        yearly: 'New Appointments',
      },
      {
        k: 'followUpPatientChartData',
        title: 'Follow-up appointments',
        yearly: 'Follow-up Appointments',
      },
      {
        k: 'ipdPatientChartData',
        title: 'IPD patients',
        yearly: 'IPD Patients',
      },
    ],
  },
  {
    key: 'Opd',
    label: 'OPD',
    bucket: 'Opd',
    series: [
      {
        k: 'opdPatientChartData',
        title: 'OPD invoice',
        yearly: 'OPD Invoice',
        money: true,
      },
      {
        k: 'labChartData',
        title: 'Lab invoice',
        yearly: 'LAB Invoice',
        money: true,
      },
    ],
  },
  {
    key: 'Ipd',
    label: 'IPD',
    bucket: 'Ipd',
    series: [
      // See the header note: the key says "patient", the payload is invoice.
      {
        k: 'ipdPatientChartData',
        title: 'IPD invoice',
        yearly: 'IPD Invoice',
        money: true,
      },
    ],
  },
];

const PERIODS = ['Monthly', 'Quarterly', 'Yearly'];

// ── shaping ──────────────────────────────────────────────────────────────────
// Monthly / Quarterly: { labels, thisYear, lastYear } → rows.
const rowsFromSeries = s => {
  if (!s) return [];
  const labels = Array.isArray(s.labels) ? s.labels : [];
  const ty = Array.isArray(s.thisYear) ? s.thisYear : [];
  const ly = Array.isArray(s.lastYear) ? s.lastYear : [];
  return labels.map((label, i) => ({
    label: String(label ?? ''),
    now: toNum(ty[i]),
    prev: toNum(ly[i]),
  }));
};

// Yearly: the old screen read sampleData['Yearly'][<display label>] and fed it
// straight to the chart, so the shape was never pinned down. Accept the three
// forms it can plausibly be and give up quietly rather than crash.
const rowsFromYearly = block => {
  if (!block) return [];

  // [{ label|year|name, value|total|count }, …]
  if (Array.isArray(block)) {
    return block
      .map(r => {
        if (r === null || typeof r !== 'object') return null;
        const label = r.label ?? r.year ?? r.name ?? r.key ?? '';
        const value = r.value ?? r.total ?? r.count ?? r.amount ?? 0;
        return { label: String(label), now: toNum(value), prev: null };
      })
      .filter(Boolean);
  }

  if (typeof block !== 'object') return [];

  // { labels: [], data|values|thisYear: [] }
  if (Array.isArray(block.labels)) {
    const vals =
      block.data || block.values || block.thisYear || block.totals || [];
    const prev = Array.isArray(block.lastYear) ? block.lastYear : null;
    return block.labels.map((label, i) => ({
      label: String(label ?? ''),
      now: toNum(vals[i]),
      prev: prev ? toNum(prev[i]) : null,
    }));
  }

  // { '2023-24': 1234, '2024-25': 2345 }
  return Object.keys(block).map(label => ({
    label: String(label),
    now: toNum(block[label]),
    prev: null,
  }));
};

// ── pieces ───────────────────────────────────────────────────────────────────

const Segmented = ({ options, value, onChange }) => (
  <View style={styles.segWrap}>
    {options.map(o => {
      const on = o.key === value;
      return (
        <TouchableOpacity
          key={o.key}
          activeOpacity={0.85}
          onPress={() => onChange(o.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          style={[styles.seg, on && styles.segOn]}
        >
          <Text style={[styles.segTxt, on && styles.segTxtOn]}>{o.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// Two hairline bars, this year over last year, scaled against the largest value
// in the whole series. This is the only thing the old chart did that a table
// cannot: show at a glance which months are the big ones.
const PairBars = ({ now, prev, max }) => {
  const w = v => (max > 0 ? Math.max(2, (toNum(v) / max) * 100) : 2);
  return (
    <View style={styles.bars}>
      <View
        style={[styles.bar, { width: `${w(now)}%`, backgroundColor: THIS_BAR }]}
      />
      {prev !== null && (
        <View
          style={[
            styles.bar,
            { width: `${w(prev)}%`, backgroundColor: LAST_BAR },
          ]}
        />
      )}
    </View>
  );
};

const SeriesCard = ({ title, rows, money, periodLabel }) => {
  if (!rows.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.empty}>
          No {periodLabel.toLowerCase()} figures.
        </Text>
      </View>
    );
  }

  const hasPrev = rows.some(r => r.prev !== null);
  const totNow = rows.reduce((a, r) => a + toNum(r.now), 0);
  const totPrev = hasPrev ? rows.reduce((a, r) => a + toNum(r.prev), 0) : null;
  const totDelta = hasPrev ? pctDelta(totNow, totPrev) : null;
  const diff = hasPrev ? totNow - totPrev : null;

  const max = Math.max(
    ...rows.map(r =>
      Math.max(toNum(r.now), r.prev === null ? 0 : toNum(r.prev)),
    ),
    0,
  );

  // The best and worst month by YoY movement — the two rows worth looking at
  // first, which a chart makes you hunt for.
  const moved = rows
    .filter(r => r.prev !== null && toNum(r.prev) > 0)
    .map(r => ({ ...r, d: pctDelta(r.now, r.prev) }))
    .filter(r => r.d !== null)
    .sort((a, b) => b.d - a.d);
  const best = moved[0];
  const worst = moved.length > 1 ? moved[moved.length - 1] : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      {/* Headline — the whole-period answer, before any row detail. */}
      <View style={styles.headline}>
        <View style={styles.hCell}>
          <Text style={styles.hLabel}>THIS YEAR</Text>
          <Text style={styles.hNow}>{fmt(totNow, money)}</Text>
        </View>
        {hasPrev && (
          <>
            <View style={styles.hDiv} />
            <View style={styles.hCell}>
              <Text style={styles.hLabel}>LAST YEAR</Text>
              <Text style={styles.hPrev}>{fmt(totPrev, money)}</Text>
            </View>
            <View style={styles.hDiv} />
            <View style={styles.hCell}>
              <Text style={styles.hLabel}>CHANGE</Text>
              <Text style={[styles.hNow, { color: deltaColour(totDelta) }]}>
                {arrow(totDelta)} {deltaText(totDelta)}
              </Text>
              <Text style={styles.hSub}>
                {diff >= 0 ? '+' : '−'}
                {fmt(Math.abs(diff), money)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Table */}
      <View style={styles.thead}>
        <Text style={[styles.th, styles.colLabel]}>{periodLabel}</Text>
        <Text style={[styles.th, styles.colNum]}>THIS YR</Text>
        {hasPrev && <Text style={[styles.th, styles.colNum]}>LAST YR</Text>}
        {hasPrev && <Text style={[styles.th, styles.colYoy]}>YOY</Text>}
      </View>

      {rows.map((r, i) => {
        const d = r.prev === null ? null : pctDelta(r.now, r.prev);
        return (
          <View
            key={`${r.label}-${i}`}
            style={[styles.tr, i % 2 === 1 && styles.trAlt]}
          >
            <View style={styles.trTop}>
              <Text style={[styles.tdLabel, styles.colLabel]} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={[styles.tdNow, styles.colNum]}>
                {fmt(r.now, money)}
              </Text>
              {hasPrev && (
                <Text style={[styles.tdPrev, styles.colNum]}>
                  {fmt(r.prev, money)}
                </Text>
              )}
              {hasPrev && (
                <Text
                  style={[
                    styles.tdYoy,
                    styles.colYoy,
                    { color: deltaColour(d) },
                  ]}
                >
                  {arrow(d)}
                  {d === null ? ' —' : ` ${deltaText(d).replace('+', '')}`}
                </Text>
              )}
            </View>
            <PairBars now={r.now} prev={r.prev} max={max} />
          </View>
        );
      })}

      {/* Read-out — stated in words so nobody has to scan the table for it. */}
      {!!best && (
        <View style={styles.note}>
          <Text style={styles.noteTxt}>
            Strongest: <Text style={styles.noteStrong}>{best.label}</Text>{' '}
            <Text style={{ color: deltaColour(best.d) }}>
              {deltaText(best.d)}
            </Text>
            {!!worst && worst.label !== best.label && (
              <>
                {'   ·   '}Weakest:{' '}
                <Text style={styles.noteStrong}>{worst.label}</Text>{' '}
                <Text style={{ color: deltaColour(worst.d) }}>
                  {deltaText(worst.d)}
                </Text>
              </>
            )}
          </Text>
        </View>
      )}

      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: THIS_BAR }]} />
        <Text style={styles.legendTxt}>This year</Text>
        {hasPrev && (
          <>
            <View
              style={[
                styles.dot,
                { backgroundColor: LAST_BAR, marginLeft: 14 },
              ]}
            />
            <Text style={styles.legendTxt}>Last year</Text>
          </>
        )}
      </View>
    </View>
  );
};

// ── screen ───────────────────────────────────────────────────────────────────

const PerformanceStatsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const location = useSelector(state => state.location.value);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const [tab, setTab] = useState('Leads');
  const [period, setPeriod] = useState('Monthly');

  const load = useCallback(async () => {
    if (!location) {
      setErr('No branch selected.');
      setLoading(false);
      return;
    }
    setErr('');
    try {
      const res = await fetch(
        `${BACKEND_URL}/performance?location=${encodeURIComponent(location)}`,
      );
      const json = await res.json();
      setData(json && typeof json === 'object' ? json : null);
      if (!json || typeof json !== 'object')
        setErr('No performance data returned.');
    } catch (e) {
      setErr('Could not load performance data.');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const activeTab = TABS.find(t => t.key === tab) || TABS[0];

  const cards = useMemo(() => {
    if (!data) return [];
    if (period === 'Yearly') {
      const yearly = data.Yearly || data.yearly || {};
      return activeTab.series.map(s => ({
        title: s.title,
        money: !!s.money,
        rows: rowsFromYearly(yearly[s.yearly]),
      }));
    }
    const bucket = data[activeTab.bucket] || {};
    const block = bucket[period] || {};
    return activeTab.series.map(s => ({
      title: s.title,
      money: !!s.money,
      rows: rowsFromSeries(block[s.k]),
    }));
  }, [data, activeTab, period]);

  const periodLabel =
    period === 'Monthly'
      ? 'MONTH'
      : period === 'Quarterly'
      ? 'QUARTER'
      : 'YEAR';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <SectionHeader
        title="Graph and statistics"
        subtitle={location ? `${location} · year on year` : 'Year on year'}
        hue={ACCENT}
        onBack={() => navigation.goBack()}
        hideScope
      />

      <View style={styles.controls}>
        <Segmented
          options={TABS.map(t => ({ key: t.key, label: t.label }))}
          value={tab}
          onChange={setTab}
        />
        <View style={{ height: 8 }} />
        <Segmented
          options={PERIODS.map(p => ({ key: p, label: p }))}
          value={period}
          onChange={setPeriod}
        />
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={ACCENT} />
          <Text style={styles.centreTxt}>Loading performance…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 28,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          }
        >
          {!!err && (
            <View style={styles.card}>
              <Text style={styles.empty}>{err}</Text>
            </View>
          )}

          {!err &&
            cards.map(c => (
              <SeriesCard
                key={`${tab}-${period}-${c.title}`}
                title={c.title}
                rows={c.rows}
                money={c.money}
                periodLabel={periodLabel}
              />
            ))}

          {!err && !cards.some(c => c.rows.length) && (
            <View style={styles.card}>
              <Text style={styles.empty}>
                No {period.toLowerCase()} figures for{' '}
                {activeTab.label.toLowerCase()}.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default PerformanceStatsScreen;

// ── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },

  controls: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: T.canvas,
  },

  segWrap: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    padding: 3,
  },
  seg: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segOn: { backgroundColor: ACCENT },
  segTxt: { fontFamily: F.medium, fontSize: 12.5, color: T.muted },
  segTxtOn: { fontFamily: F.semibold, color: '#FFFFFF' },

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  centreTxt: { fontFamily: F.regular, fontSize: 13, color: T.muted },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: F.semibold,
    fontSize: 14.5,
    color: T.text,
    marginBottom: 12,
  },

  headline: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: T.lineSoft,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  hCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  hDiv: { width: 1, backgroundColor: T.lineSoft },
  hLabel: {
    fontFamily: F.medium,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: T.muted2,
    marginBottom: 4,
  },
  hNow: { fontFamily: F.semibold, fontSize: 16, color: T.text },
  hPrev: { fontFamily: F.medium, fontSize: 16, color: T.muted },
  hSub: { fontFamily: F.mono, fontSize: 10.5, color: T.muted2, marginTop: 2 },

  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  th: {
    fontFamily: F.medium,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: T.muted2,
  },

  colLabel: { flex: 1, textAlign: 'left' },
  colNum: { width: 74, textAlign: 'right' },
  colYoy: { width: 60, textAlign: 'right' },

  tr: { paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8 },
  trAlt: { backgroundColor: T.headerTile || 'rgba(0,0,0,0.02)' },
  trTop: { flexDirection: 'row', alignItems: 'center' },

  tdLabel: { fontFamily: F.medium, fontSize: 12.5, color: T.text },
  tdNow: { fontFamily: F.mono, fontSize: 12.5, color: T.text },
  tdPrev: { fontFamily: F.mono, fontSize: 12.5, color: T.muted },
  tdYoy: { fontFamily: F.mono, fontSize: 11.5 },

  bars: { marginTop: 5, gap: 2 },
  bar: { height: 3, borderRadius: 2 },

  note: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  noteTxt: { fontFamily: F.regular, fontSize: 11.5, color: T.muted },
  noteStrong: { fontFamily: F.semibold, color: T.text },

  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendTxt: { fontFamily: F.regular, fontSize: 11, color: T.muted2 },

  empty: {
    fontFamily: F.regular,
    fontSize: 12.5,
    color: T.muted,
    paddingVertical: 8,
  },
});
