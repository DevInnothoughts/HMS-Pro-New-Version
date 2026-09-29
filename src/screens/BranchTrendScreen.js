/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/BranchTrendScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// One branch over time, opened by tapping it on Branch Summary.
//
//   GET /overview/branchTrend?location=Baner
//     → { monthly: [...12], quarterly: [...8], yearly: [...5] }
//
// Two line charts — New patients, and Revenue per new patient — for the
// period picked in the tabs. All three periods arrive in one response, so the
// tabs switch without another round-trip.
//
// ⚠️ TWO CHARTS, NOT ONE WITH TWO AXES
// ────────────────────────────────────
// A count (≈ 150) and a rupee figure (≈ ₹25,000) on one axis flattens the
// count into the floor; a dual-axis chart invites reading the crossing point
// as meaningful when it is only a scale accident. Stacked charts sharing the
// same x labels keep both honest.
//
// ⚠️ QUARTERS AND YEARS ARE FINANCIAL (APR–MAR)
// ─────────────────────────────────────────────
// Same convention as Target Comparison. The last point of every view is the
// period in progress and is marked as such — its new-patient count is partial.
//
// ⚠️ FALLS BACK TO V1 WHEN THE SERVER HAS NO /branchTrend
// ────────────────────────────────────────────────────────
// /branchTrend reads every month in one pass. A server that has not been
// redeployed answers 404; the screen then builds the same periods here and
// asks the existing /branchSummary once per period for this one branch —
// slower (one getLocationSummary per point), so only the open tab is fetched,
// and each tab is kept once read.
//
// ⚠️ FIT OR SCROLL
// ────────────────
// Fit (default) draws every period inside the screen width, showing every
// k-th x label so they never collide — the newest label is always kept. Scroll
// gives each point MIN_POINT_W and every label, for reading one period closely.
//
// ⚠️ NOT THE SCOPE PICKER'S RANGE
// ───────────────────────────────
// Branch Summary's figures follow the app-wide date scope; this screen always
// shows the trailing history, because a trend over a one-week scope is one
// point.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { get } from '../api/client';
import { F, T, inr, inrCompact, num } from '../design/tokens';

const ENDPOINT = '/overview/branchTrend';
const V1_ENDPOINT = '/overview/branchSummary';

const PERIODS = [
  { key: 'monthly', label: 'Monthly', note: 'Last 12 months' },
  { key: 'quarterly', label: 'Quarterly', note: 'Last 8 quarters · FY' },
  { key: 'yearly', label: 'Yearly', note: 'Last 5 financial years' },
];

const REV = '#B26A00'; // amber — distinct from brand green in both charts

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 210;
const MIN_POINT_W = 58; // below this the x labels collide
const Y_AXIS_W = 58; // chart-kit's left gutter for y labels (approx.)
const CHAR_W = 5.6; // mono 9px, per character (approx.)

/**
 * Fit mode: blank out labels so the ones shown have room. Counts back from the
 * newest point, so the latest period is always labelled.
 */
const thinLabels = (labels, width) => {
  const n = labels.length;
  if (n <= 1) return labels;
  const perPoint = (width - Y_AXIS_W) / n;
  const longest = Math.max(...labels.map(l => l.length));
  const step = Math.max(1, Math.ceil((longest * CHAR_W + 8) / perPoint));
  return labels.map((l, i) => ((n - 1 - i) % step === 0 ? l : ''));
};

const n0 = v => Number(v) || 0;

// ─── Client-side periods (fallback only) — mirrors branchTrendModel ──────────
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WINDOW = { monthly: 12, quarterly: 8, yearly: 5 };
const pad = x => String(x).padStart(2, '0');
const fyOf = (y, m) => (m >= 4 ? y : y - 1);
const lastDay = (y, m) => new Date(y, m, 0).getDate();

function todayIST() {
  const d = new Date(Date.now() + 330 * 60 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/** Period definitions (no figures) for one tab, oldest first. */
function periodsFor(kind) {
  const { y: ty, m: tm, d: td } = todayIST();
  const today = `${ty}-${pad(tm)}-${pad(td)}`;
  const curFY = fyOf(ty, tm);
  const out = [];

  if (kind === 'monthly') {
    for (let i = WINDOW.monthly - 1; i >= 0; i--) {
      const dt = new Date(ty, tm - 1 - i, 1);
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const cur = i === 0;
      out.push({
        key: `${y}-${pad(m)}`,
        label: `${MONTHS[m - 1]} '${String(y).slice(2)}`,
        from: `${y}-${pad(m)}-01`,
        to: cur ? today : `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        partial: cur,
      });
    }
  } else if (kind === 'quarterly') {
    // Quarter index counted from FY start: Q1 Apr–Jun … Q4 Jan–Mar.
    const curQ = tm >= 4 ? Math.floor((tm - 4) / 3) : 3;
    for (let i = WINDOW.quarterly - 1; i >= 0; i--) {
      let q = curQ - i;
      let fy = curFY;
      while (q < 0) {
        q += 4;
        fy -= 1;
      }
      const sm = 4 + q * 3; // may exceed 12 for Q4
      const sy = fy + (sm > 12 ? 1 : 0);
      const smm = sm > 12 ? sm - 12 : sm;
      const em = smm + 2;
      const cur = i === 0;
      out.push({
        key: `${fy}-Q${q + 1}`,
        label: `Q${q + 1} FY${String(fy + 1).slice(2)}`,
        from: `${sy}-${pad(smm)}-01`,
        to: cur ? today : `${sy}-${pad(em)}-${pad(lastDay(sy, em))}`,
        partial: cur,
      });
    }
  } else {
    for (let i = WINDOW.yearly - 1; i >= 0; i--) {
      const fy = curFY - i;
      const cur = i === 0;
      out.push({
        key: `FY${fy}`,
        label: `FY ${String(fy).slice(2)}-${String(fy + 1).slice(2)}`,
        from: `${fy}-04-01`,
        to: cur ? today : `${fy + 1}-03-31`,
        partial: cur,
      });
    }
  }
  return out;
}

/** One period through V1 for one branch → a bucket like /branchTrend's. */
async function readPeriodV1(location, p) {
  const res = await get(
    V1_ENDPOINT,
    { from: p.from, to: p.to, locations: location },
    { timeout: 60000 },
  );
  const b = (res?.branches || [])[0] || {};
  if (b.error) throw new Error(`${p.label}: ${b.error}`);
  const newPatients = n0(b.newPatients);
  const totalRevenue = n0(b.grandTotal);
  return {
    ...p,
    newPatients,
    totalRevenue,
    revenuePerNewPatient:
      newPatients > 0 ? Math.round(totalRevenue / newPatients) : null,
  };
}

/**
 * ONE AT A TIME, on purpose. Each V1 call is a full getLocationSummary, which
 * peaks at 3-4 connections on its own. This branch's pool is capped at 5 and is
 * shared with the staff working at that branch — two in parallel would take
 * the whole pool and make their screens wait. Slower, but it never holds more
 * than one call's worth of connections.
 */
async function readPeriodsV1(location, periods) {
  const out = [];
  for (const p of periods) out.push(await readPeriodV1(location, p));
  return out;
}
const hexA = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const BranchTrendScreen = ({ navigation, route }) => {
  const location = route?.params?.location;
  const city = route?.params?.city;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [fit, setFit] = useState(true); // see header — Fit or Scroll
  // true once the server has answered 404 for /branchTrend — see header.
  const [fallback, setFallback] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!location) {
        setError('No branch selected.');
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      setError('');
      let handedOff = false;
      try {
        if (!fallback) {
          try {
            setData(await get(ENDPOINT, { location }, { timeout: 60000 }));
            return;
          } catch (e) {
            if (e.status !== 404) throw e;
            // Flipping `fallback` re-creates load and the effect below runs it
            // again in fallback mode — continuing here would fetch twice.
            handedOff = true;
            setFallback(true);
            return;
          }
        }
        // Fallback: this tab only, through the existing endpoint.
        const buckets = await readPeriodsV1(location, periodsFor(period));
        setData(prev => ({ ...(quiet ? {} : prev || {}), [period]: buckets }));
      } catch (e) {
        setError(e.message);
      } finally {
        if (!handedOff) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [location, fallback, period],
  );

  // First load; in fallback mode, also whenever a tab not yet read is opened.
  useEffect(() => {
    if (!data || (fallback && !data[period])) load();
  }, [load, data, fallback, period]);

  const buckets = useMemo(() => data?.[period] || [], [data, period]);
  const meta = PERIODS.find(p => p.key === period) || PERIODS[0];

  // Whole-window figures for the stat cards: summed, and the ratio pooled —
  // never an average of the per-period ratios.
  const pooled = useMemo(() => {
    const newPatients = buckets.reduce((a, b) => a + n0(b.newPatients), 0);
    const revenue = buckets.reduce((a, b) => a + n0(b.totalRevenue), 0);
    return {
      newPatients,
      perNew: newPatients > 0 ? Math.round(revenue / newPatients) : null,
    };
  }, [buckets]);

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={T.brand}
          />
        }
      >
        <View style={st.hdr}>
          <View style={st.hdrTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={st.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Icon name="arrow-back" size={19} color="#CFDDD6" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={st.hdrEyebrow}>
                {(city ? `${city} · ` : '') + 'BRANCH TREND'}
              </Text>
              <Text style={st.hdrTitle} numberOfLines={1}>
                {location || '—'}
              </Text>
            </View>
          </View>
          <Text style={st.hdrSub}>{meta.note}</Text>
        </View>

        <View style={st.body}>
          <View style={[st.statRow, { marginTop: -26 }]}>
            <Stat
              label="New pt"
              value={loading ? '…' : num(pooled.newPatients)}
              note={meta.note.toLowerCase()}
            />
            <Stat
              label="Rev / new pt"
              value={
                loading ? '…' : pooled.perNew == null ? '—' : inr(pooled.perNew)
              }
              note="all revenue ÷ new pt"
              wide
            />
          </View>

          <View style={st.tabs}>
            {PERIODS.map(p => {
              const on = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPeriod(p.key)}
                  style={[st.tab, on && st.tabOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[st.tabText, on && st.tabTextOn]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={st.viewRow}>
            <Text style={st.viewLabel}>CHART</Text>
            {[
              { on: true, label: 'Fit to screen', icon: 'fit-screen' },
              { on: false, label: 'Scroll', icon: 'swap-horiz' },
            ].map(o => {
              const active = fit === o.on;
              return (
                <TouchableOpacity
                  key={o.label}
                  onPress={() => setFit(o.on)}
                  style={[st.viewChip, active && st.viewChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Icon
                    name={o.icon}
                    size={13}
                    color={active ? T.brand : T.muted2}
                  />
                  <Text style={[st.viewText, active && st.viewTextOn]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
              <Text style={st.loadingNote}>
                {fallback
                  ? `Reading ${meta.label.toLowerCase()} figures period by period…`
                  : 'Reading five years of history…'}
              </Text>
            </View>
          ) : error ? (
            <Text style={st.empty}>{error}</Text>
          ) : !buckets.length ? (
            <Text style={st.empty}>No data for this branch.</Text>
          ) : (
            <>
              <TrendCard
                key={`np-${period}`}
                title="New patients"
                buckets={buckets}
                pick={b => n0(b.newPatients)}
                show={b => num(b.newPatients)}
                axis={v => num(Math.round(Number(v)))}
                color={T.brand}
                fit={fit}
              />
              <TrendCard
                key={`rv-${period}`}
                title="Revenue per new patient"
                sub="OPD + Lab + IPD + Pharmacy of all patients ÷ new patients"
                buckets={buckets}
                // Chart-kit cannot draw a gap, so a period with no new patients
                // plots at 0; the callout and table still say "—".
                pick={b => n0(b.revenuePerNewPatient)}
                show={b =>
                  b.revenuePerNewPatient == null
                    ? '—'
                    : inr(b.revenuePerNewPatient)
                }
                axis={v => inrCompact(Number(v))}
                color={REV}
                fit={fit}
              />
              <PeriodTable buckets={buckets} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * One line chart plus a callout for the tapped point. Defaults to the last
 * COMPLETE period, so the first number read is not a half-month.
 */
const TrendCard = ({ title, sub, buckets, pick, show, axis, color, fit }) => {
  const lastComplete = useMemo(() => {
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (!buckets[i].partial) return i;
    }
    return buckets.length - 1;
  }, [buckets]);
  const [sel, setSel] = useState(lastComplete);
  const scroller = useRef(null);
  const idx = Math.min(sel, buckets.length - 1);
  const cur = buckets[idx];
  const prev = idx > 0 ? buckets[idx - 1] : null;

  const values = buckets.map(pick);
  const allZero = values.every(v => v === 0);

  const change =
    prev && pick(prev) > 0 && !cur.partial
      ? ((pick(cur) - pick(prev)) / pick(prev)) * 100
      : null;

  const inner = SCREEN_W - 32 - 2; // body padding + card border
  const width = fit ? inner : Math.max(inner, buckets.length * MIN_POINT_W);
  const labels = buckets.map(b => b.label);
  // Smaller dots when squeezed, so twelve of them do not merge into a bar.
  const crowded = fit && inner / buckets.length < 34;

  const chart = (
    <LineChart
      data={{
        labels: fit ? thinLabels(labels, width) : labels,
        datasets: [
          {
            data: values,
            color: (o = 1) => hexA(color, o),
            strokeWidth: 2,
          },
        ],
      }}
      width={width}
      height={CHART_H}
      fromZero
      withShadow={false}
      withVerticalLines={false}
      segments={4}
      formatYLabel={axis}
      onDataPointClick={({ index }) => setSel(index)}
      getDotColor={(_, i) => (i === idx ? color : '#FFFFFF')}
      getDotProps={(_, i) => ({
        r: i === idx ? (crowded ? '4.5' : '5') : crowded ? '2.5' : '3.5',
        strokeWidth: '2',
        stroke: color,
        // The period in progress is hollow-dashed — it is not comparable.
        strokeDasharray: buckets[i]?.partial ? '2,2' : undefined,
      })}
      chartConfig={{
        backgroundColor: T.card,
        backgroundGradientFrom: T.card,
        backgroundGradientTo: T.card,
        decimalPlaces: 0,
        color: (o = 1) => hexA(color, o),
        labelColor: () => T.muted2,
        propsForBackgroundLines: {
          stroke: T.lineSoft || '#EEF1EF',
          strokeDasharray: '',
        },
        propsForLabels: { fontFamily: F.mono, fontSize: 9 },
      }}
      style={{ marginLeft: -6, marginTop: 6 }}
    />
  );

  return (
    <View style={st.card}>
      <View style={st.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={st.cardTitle}>{title}</Text>
          {!!sub && <Text style={st.cardSub}>{sub}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[st.callVal, { color }]}>{show(cur)}</Text>
          <Text style={st.callNote}>
            {cur.label}
            {cur.partial ? ' · so far' : ''}
            {change != null
              ? ` · ${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}%`
              : ''}
          </Text>
        </View>
      </View>

      {allZero ? (
        <Text style={st.chartEmpty}>Nothing recorded in this window.</Text>
      ) : fit ? (
        chart
      ) : (
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Newest on the right, and in view — the recent end is what is read.
          onContentSizeChange={() =>
            scroller.current?.scrollToEnd({ animated: false })
          }
        >
          {chart}
        </ScrollView>
      )}
      <Text style={st.hint}>
        {fit
          ? 'Tap a point to read it.'
          : 'Swipe for earlier periods · tap a point to read it.'}
      </Text>
    </View>
  );
};

/** Exact figures behind both charts, newest first. */
const PeriodTable = ({ buckets }) => (
  <View style={st.card}>
    <Text style={[st.cardTitle, { paddingHorizontal: 14 }]}>By period</Text>
    <View style={[st.tr, st.th]}>
      <Text style={[st.tdLabel, st.thText]}>PERIOD</Text>
      <Text style={[st.td, st.thText]}>NEW PT</Text>
      <Text style={[st.td, st.thText]}>REVENUE</Text>
      <Text style={[st.td, st.thText]}>REV / NEW PT</Text>
    </View>
    {[...buckets].reverse().map(b => (
      <View key={b.key} style={st.tr}>
        <Text style={st.tdLabel} numberOfLines={1}>
          {b.label}
          {b.partial ? ' *' : ''}
        </Text>
        <Text style={st.td}>{num(b.newPatients)}</Text>
        <Text style={st.td}>{inrCompact(b.totalRevenue)}</Text>
        <Text style={st.td}>
          {b.revenuePerNewPatient == null ? '—' : inr(b.revenuePerNewPatient)}
        </Text>
      </View>
    ))}
    {buckets.some(b => b.partial) && (
      <Text style={st.hint}>* In progress — runs to today.</Text>
    )}
  </View>
);

const Stat = ({ label, value, note, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={st.statVal} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

export default BranchTrendScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  body: { paddingHorizontal: 16 },
  centre: { paddingVertical: 50, alignItems: 'center' },
  loadingNote: {
    fontSize: 11.5,
    color: T.muted2,
    marginTop: 12,
    fontFamily: F.regular,
  },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    fontFamily: F.regular,
    fontSize: 13,
  },

  hdr: {
    backgroundColor: T.headerBg,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 38,
  },
  hdrTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    backgroundColor: T.headerTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdrEyebrow: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: T.headerMuted,
  },
  hdrTitle: {
    fontFamily: F.semibold,
    fontSize: 17,
    color: '#fff',
    marginTop: 2,
  },
  hdrSub: {
    fontFamily: F.mono,
    fontSize: 10.5,
    color: T.headerMuted,
    marginTop: 12,
  },

  statRow: { flexDirection: 'row', gap: 9 },
  stat: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 17,
    color: T.text,
    marginTop: 7,
    letterSpacing: -0.4,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    padding: 3,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: T.brand },
  tabText: { fontSize: 12, color: T.muted, fontFamily: F.regular },
  tabTextOn: { color: '#fff', fontFamily: F.medium },

  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 10,
  },
  viewLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: T.muted2,
    marginRight: 2,
  },
  viewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  viewChipOn: { borderColor: T.brand, backgroundColor: '#EDF4EF' },
  viewText: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  viewTextOn: { color: T.brand, fontFamily: F.medium },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    paddingTop: 13,
    paddingBottom: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
  },
  cardTitle: { fontSize: 13.5, fontFamily: F.semibold, color: T.text },
  cardSub: {
    fontSize: 9.5,
    color: T.muted2,
    fontFamily: F.regular,
    marginTop: 3,
  },
  callVal: { fontFamily: F.mono, fontSize: 16, letterSpacing: -0.3 },
  callNote: { fontFamily: F.mono, fontSize: 9, color: T.muted2, marginTop: 3 },
  chartEmpty: {
    textAlign: 'center',
    color: T.muted2,
    fontFamily: F.regular,
    fontSize: 12,
    paddingVertical: 60,
  },
  hint: {
    fontSize: 9,
    color: T.muted2,
    fontFamily: F.regular,
    paddingHorizontal: 14,
    marginTop: 4,
  },

  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft || '#EEF1EF',
  },
  th: { marginTop: 8 },
  thText: { fontSize: 7.5, letterSpacing: 0.8, color: T.muted2 },
  tdLabel: { flex: 1.1, fontFamily: F.mono, fontSize: 10.5, color: T.text },
  td: {
    flex: 1,
    textAlign: 'right',
    fontFamily: F.mono,
    fontSize: 10.5,
    color: T.text,
  },
});
