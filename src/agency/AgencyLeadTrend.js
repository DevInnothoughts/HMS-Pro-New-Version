/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/agency/AgencyLeadTrend.js
// ─────────────────────────────────────────────────────────────────────────────
// Lead trend for one branch — the "Trend" view of the AD AGENCY branch page.
// A copy of src/adAgency/LeadTrend.js (locked) reading the agency endpoint:
//
//   GET /agencyLeads/trend?location
//     → { meta, months: [~31], fys: [3] }   (last three financial years)
//
// GOOGLE leads only (utm_source google / google_ads); Web, Bot and Web call
// only — no IVR. Follows the source tab above it: All, Website, Chatbot or
// Web call.
// Every figure is UNIQUE leads (one per phone) — per month de-duplicated
// within the month, per FY within the FY.
//
//   1. Headline cards   last full month · MoM · YoY · FY to date vs last FY
//   2. MoM chart        unique leads per month, LAST 12 MONTHS only (chart-kit,
//                       same look as Branch Trend); tap a point to read it
//   3. YoY chart        the LAST THREE FYs, one line each over Apr → Mar, so
//                       the same month of each year sits on the same x; the
//                       current FY stops at this month. Drawn with
//                       react-native-svg because chart-kit cannot end one
//                       line early.
//   4. Tables           By month = the same last 12 months (newest first);
//                       By FY = the same three FYs
//
// The server still sends all ~31 months: the months BEFORE the 12-month
// window are never shown, but they are what the first months' MoM % (needs
// the month before) and every month's YoY % (needs the same month last year)
// and the YoY chart's older FY lines are computed from.
//
// ⚠️ THE CURRENT MONTH IS PARTIAL — it is drawn hollow-dashed, and no MoM /
//    YoY % is given for it (half a month against a whole one says nothing).
//    The headline cards therefore use the last COMPLETE month. The FY card
//    compares like for like: 1 Apr → today in each year (server `ytd`).
// ⚠️ An FY's unique is NOT the sum of its months — someone who enquired in May
//    and in August is one lead that year, one in each month.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { F, R, T, num } from '../design/tokens';
import { channelOf, fetchAgencyTrend } from './agencyApi';

const SCREEN_W = Dimensions.get('window').width;
const CARD_INNER = SCREEN_W - 32 - 2 - 24; // page gutters, border, card padding
const CHART_H = 200;
const MOM_MONTHS = 12; // MoM chart + By month table: last 12 months only
const YOY_FYS = 3; // YoY chart + By FY table: last three financial years

// Oldest → newest FY. Older years are neutral greys so they never clash with
// a source hue; the current FY is drawn in the selected source's hue.
const FY_TONES = ['#C3CCC7', '#59636F'];

const MONTH_AXIS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
];

const hexA = (hex, a) => {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const change = (cur, prev) =>
  cur == null || prev == null || prev === 0
    ? null
    : ((cur - prev) / prev) * 100;

const fmtChange = v =>
  v == null ? '–' : `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)}%`;
const changeColor = v => (v == null ? T.muted2 : v >= 0 ? T.pos : T.crit);

// ─── Small pieces ─────────────────────────────────────────────────────────────

const Headline = ({ label, value, note, delta }) => (
  <View style={st.head}>
    <Text style={st.headLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={st.headVal} numberOfLines={1}>
      {value}
    </Text>
    {delta !== undefined ? (
      <Text
        style={[st.headNote, { color: changeColor(delta) }]}
        numberOfLines={1}
      >
        {fmtChange(delta)}
        <Text style={{ color: T.muted2 }}>{note ? `  ${note}` : ''}</Text>
      </Text>
    ) : (
      <Text style={st.headNote} numberOfLines={1}>
        {note}
      </Text>
    )}
  </View>
);

/**
 * MoM — the last 12 months, fitted to the card. `months` is the full series
 * from the server; only its last MOM_MONTHS are drawn, the earlier ones are
 * used for the first point's MoM % and every point's YoY %.
 */
const MonthChart = ({ months, pick, color }) => {
  const start = Math.max(months.length - MOM_MONTHS, 0);
  const shown = months.slice(start);

  const lastComplete = useMemo(() => {
    for (let i = shown.length - 1; i >= 0; i--) if (!shown[i].partial) return i;
    return shown.length - 1;
  }, [shown]);
  const [sel, setSel] = useState(lastComplete);
  useEffect(() => setSel(lastComplete), [lastComplete]);

  const idx = Math.min(sel, shown.length - 1);
  const cur = shown[idx];
  const at = start + idx; // position in the full series
  const values = shown.map(pick);
  const mom =
    cur && !cur.partial && at > 0
      ? change(pick(cur), pick(months[at - 1]))
      : null;
  const ly = cur && at >= 12 ? months[at - 12] : null;
  const yoy = cur && !cur.partial && ly ? change(pick(cur), pick(ly)) : null;

  const width = CARD_INNER;
  // Twelve labels do not fit a phone: every second month, newest always kept.
  const labels = shown.map((m, i) =>
    (shown.length - 1 - i) % 2 === 0 ? m.label : '',
  );

  if (!cur || values.every(v => v === 0)) {
    return <Text style={st.empty}>No leads in the last 12 months.</Text>;
  }

  return (
    <>
      <View style={st.callout}>
        <Text style={[st.callVal, { color }]}>{num(pick(cur))}</Text>
        <Text style={st.callNote}>
          {cur.label}
          {cur.partial ? ' · so far' : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[st.callDelta, { color: changeColor(mom) }]}>
            MoM {fmtChange(mom)}
          </Text>
          <Text style={[st.callDelta, { color: changeColor(yoy) }]}>
            YoY {fmtChange(yoy)}
          </Text>
        </View>
      </View>

      <LineChart
        data={{
          labels,
          datasets: [
            { data: values, color: (o = 1) => hexA(color, o), strokeWidth: 2 },
          ],
        }}
        width={width}
        height={CHART_H}
        fromZero
        withShadow={false}
        withVerticalLines={false}
        segments={4}
        formatYLabel={v => num(Math.round(Number(v)))}
        onDataPointClick={({ index }) => setSel(index)}
        getDotColor={(_, i) => (i === idx ? color : '#FFFFFF')}
        getDotProps={(_, i) => ({
          r: i === idx ? '5' : '3',
          strokeWidth: '2',
          stroke: color,
          strokeDasharray: shown[i]?.partial ? '2,2' : undefined,
        })}
        chartConfig={{
          backgroundColor: T.card,
          backgroundGradientFrom: T.card,
          backgroundGradientTo: T.card,
          decimalPlaces: 0,
          color: (o = 1) => hexA(color, o),
          labelColor: () => T.muted2,
          propsForBackgroundLines: { stroke: T.lineSoft, strokeDasharray: '' },
          propsForLabels: { fontFamily: F.mono, fontSize: 9 },
        }}
        style={{ marginLeft: -6, marginTop: 4 }}
      />
      <Text style={st.hint}>
        {shown[0]?.label} → {shown[shown.length - 1]?.label} · tap a point to
        read it · dashed = month in progress.
      </Text>
    </>
  );
};

/** YoY — one line per FY on a shared Apr → Mar axis. */
const YearChart = ({ months, fys, pick, color }) => {
  const tones = [
    ...FY_TONES.slice(0, Math.max(fys.length - 1, 0)),
    color,
  ].slice(-fys.length);
  const series = fys.map((f, i) => ({
    ...f,
    tone: tones[i] || color,
    // 12 slots, Apr first; null where the month has not happened yet.
    values: MONTH_AXIS.map((_, slot) => {
      const calYear = slot < 9 ? f.fy : f.fy + 1;
      const calMonth = slot < 9 ? slot + 4 : slot - 8;
      const key = `${calYear}-${String(calMonth).padStart(2, '0')}`;
      const m = months.find(x => x.key === key);
      return m ? { v: pick(m), partial: m.partial } : null;
    }),
  }));

  const max = Math.max(
    1,
    ...series.flatMap(s => s.values.filter(Boolean).map(x => x.v)),
  );
  // A round top for the y axis: 1, 2, 5 × 10^n.
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const top = [1, 2, 5, 10].map(k => k * mag).find(k => k >= max) || max;

  const W = CARD_INNER;
  const H = CHART_H;
  const padL = 36;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = slot => padL + (plotW * slot) / 11;
  const y = v => padT + plotH - (plotH * v) / top;

  const [sel, setSel] = useState(null); // slot index

  return (
    <>
      <View style={st.legend}>
        {series.map(s => (
          <View key={s.fy} style={st.legendItem}>
            <View style={[st.legendLine, { backgroundColor: s.tone }]} />
            <Text style={st.legendText}>
              {s.label}
              {s.partial ? ' (to date)' : ''}
            </Text>
          </View>
        ))}
      </View>

      <View>
        <Svg width={W} height={H}>
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <Line
              key={p}
              x1={padL}
              x2={W - padR}
              y1={y(top * p)}
              y2={y(top * p)}
              stroke={T.lineSoft}
              strokeWidth={1}
            />
          ))}
          {[0, 0.5, 1].map(p => (
            <SvgText
              key={`y${p}`}
              x={padL - 6}
              y={y(top * p) + 3}
              fontSize={9}
              fontFamily={F.mono}
              fill={T.muted2}
              textAnchor="end"
            >
              {num(Math.round(top * p))}
            </SvgText>
          ))}
          {MONTH_AXIS.map((m, i) =>
            i % 2 === 0 || i === 11 ? (
              <SvgText
                key={m}
                x={x(i)}
                y={H - 6}
                fontSize={9}
                fontFamily={F.mono}
                fill={sel === i ? T.text : T.muted2}
                textAnchor="middle"
              >
                {m}
              </SvgText>
            ) : null,
          )}
          {sel != null && (
            <Line
              x1={x(sel)}
              x2={x(sel)}
              y1={padT}
              y2={padT + plotH}
              stroke={T.line}
              strokeWidth={1}
            />
          )}

          {series.map(s => {
            let d = '';
            s.values.forEach((pt, i) => {
              if (!pt) return;
              d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.v).toFixed(1)} `;
            });
            return (
              <Path
                key={s.fy}
                d={d}
                stroke={s.tone}
                strokeWidth={s.partial ? 2.4 : 1.8}
                fill="none"
              />
            );
          })}
          {series.map(s =>
            s.values.map((pt, i) =>
              pt ? (
                <Circle
                  key={`${s.fy}-${i}`}
                  cx={x(i)}
                  cy={y(pt.v)}
                  r={sel === i ? 4 : 2.6}
                  fill={pt.partial ? '#FFFFFF' : s.tone}
                  stroke={s.tone}
                  strokeWidth={1.5}
                  strokeDasharray={pt.partial ? '2,2' : undefined}
                />
              ) : null,
            ),
          )}
        </Svg>

        {/* Tap targets — one column per month. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              flexDirection: 'row',
              left: padL - plotW / 22,
              right: padR - plotW / 22,
            },
          ]}
        >
          {MONTH_AXIS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={{ flex: 1 }}
              onPress={() => setSel(sel === i ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${m}: ${series
                .map(
                  s => `${s.label} ${s.values[i] ? s.values[i].v : 'not yet'}`,
                )
                .join(', ')}`}
            />
          ))}
        </View>
      </View>

      {sel != null ? (
        <View style={st.yoyRead}>
          <Text style={st.yoyMonth}>{MONTH_AXIS[sel]}</Text>
          {series.map((s, i) => {
            const pt = s.values[sel];
            const prev = i > 0 ? series[i - 1].values[sel] : null;
            const g = pt && prev && !pt.partial ? change(pt.v, prev.v) : null;
            return (
              <View key={s.fy} style={st.yoyCell}>
                <Text style={[st.yoyFy, { color: s.tone }]}>{s.label}</Text>
                <Text style={st.yoyVal}>
                  {pt ? num(pt.v) : '—'}
                  {pt?.partial ? '*' : ''}
                </Text>
                {i > 0 && (
                  <Text style={[st.yoyDelta, { color: changeColor(g) }]}>
                    {fmtChange(g)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={st.hint}>
          Tap a month to compare the years. * = month in progress.
        </Text>
      )}
    </>
  );
};

/** Month table — the same last 12 months as the MoM chart, newest first. */
const MonthTable = ({ months, pick, pickDup }) => {
  const start = Math.max(months.length - MOM_MONTHS, 0);
  const rows = months
    .map((m, i) => ({
      ...m,
      v: pick(m),
      dup: pickDup(m),
      // Computed on the full series, so the oldest shown row still has both.
      mom: !m.partial && i > 0 ? change(pick(m), pick(months[i - 1])) : null,
      yoy: !m.partial && i >= 12 ? change(pick(m), pick(months[i - 12])) : null,
    }))
    .slice(start)
    .reverse();
  return (
    <View>
      <View style={[st.tr, st.th]}>
        <Text style={[st.tdName, st.thText]}>MONTH</Text>
        <Text style={[st.td, st.thText]}>UNIQUE</Text>
        <Text style={[st.td, st.thText]}>DUP</Text>
        <Text style={[st.td, st.thText]}>MoM</Text>
        <Text style={[st.td, st.thText]}>YoY</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.key}
          style={[st.tr, i % 2 === 1 && { backgroundColor: T.subtle }]}
        >
          <Text style={st.tdName}>
            {r.label}
            {r.partial ? ' *' : ''}
          </Text>
          <Text style={[st.td, st.tdNum]}>{num(r.v)}</Text>
          <Text style={[st.td, st.tdNum, r.dup > 0 && { color: T.crit }]}>
            {num(r.dup)}
          </Text>
          <Text style={[st.td, st.tdNum, { color: changeColor(r.mom) }]}>
            {fmtChange(r.mom)}
          </Text>
          <Text style={[st.td, st.tdNum, { color: changeColor(r.yoy) }]}>
            {fmtChange(r.yoy)}
          </Text>
        </View>
      ))}
    </View>
  );
};

/** FY table: full year, and the like-for-like FY-to-date. */
const FyTable = ({ fys, pickB, ytdLabel }) => (
  <View>
    <View style={[st.tr, st.th]}>
      <Text style={[st.tdName, st.thText]}>FY</Text>
      <Text style={[st.td, st.thText]}>FULL YR</Text>
      <Text style={[st.td, st.thText]}>DUP</Text>
      <Text style={[st.td, st.thText]}>TO DATE</Text>
      <Text style={[st.td, st.thText]}>YoY</Text>
    </View>
    {fys.map((f, i) => {
      const prev = i > 0 ? fys[i - 1] : null;
      const ytd = pickB(f.ytd).unique;
      const g = prev ? change(ytd, pickB(prev.ytd).unique) : null;
      return (
        <View
          key={f.fy}
          style={[st.tr, i % 2 === 1 && { backgroundColor: T.subtle }]}
        >
          <Text style={st.tdName}>
            {f.label}
            {f.partial ? ' *' : ''}
          </Text>
          <Text style={[st.td, st.tdNum]}>
            {f.partial ? '—' : num(pickB(f).unique)}
          </Text>
          <Text style={[st.td, st.tdNum]}>{num(pickB(f).duplicates)}</Text>
          <Text style={[st.td, st.tdNum]}>{num(ytd)}</Text>
          <Text style={[st.td, st.tdNum, { color: changeColor(g) }]}>
            {fmtChange(g)}
          </Text>
        </View>
      );
    })}
    <Text style={st.tableNote}>
      TO DATE = {ytdLabel} of each FY, so the current year is compared like for
      like. YoY is on TO DATE. * = in progress.
    </Text>
  </View>
);

// ─── The view ─────────────────────────────────────────────────────────────────

export default function AgencyLeadTrend({
  location,
  source = 'combined',
  refreshToken = 0,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [table, setTable] = useState('month');

  const load = useCallback(
    async force => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchAgencyTrend(location, { force }));
      } catch (e) {
        setError(e?.message || 'Could not load the trend');
      } finally {
        setLoading(false);
      }
    },
    [location],
  );

  // First open reads the cache; a pull-to-refresh on the page bumps the token.
  const first = useRef(true);
  useEffect(() => {
    load(!first.current);
    first.current = false;
  }, [load, refreshToken]);

  const ch = channelOf(source);
  const color = ch.hue;
  const pickB = b =>
    (b && b[source]) || { unique: 0, entries: 0, duplicates: 0 };
  const pick = m => pickB(m).unique;
  const pickDup = m => pickB(m).duplicates;

  if (loading && !data) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={T.brand} />
        <Text style={st.muted}>Reading three financial years…</Text>
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={st.errorCard}>
        <Icon name="error-outline" size={24} color={T.crit} />
        <Text style={st.errorText}>{error}</Text>
        <TouchableOpacity style={st.retry} onPress={() => load(true)}>
          <Text style={st.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const months = data?.months || [];
  const fys = (data?.fys || []).slice(-YOY_FYS);

  // Headline: last COMPLETE month, its MoM and YoY; FY to date vs last FY.
  let li = months.length - 1;
  while (li > 0 && months[li].partial) li -= 1;
  const lastM = months[li];
  const curM = months[months.length - 1];
  const curFy = fys[fys.length - 1];
  const prevFy = fys[fys.length - 2];
  const failed = (data?.errors || []).map(k => channelOf(k).label);

  return (
    <View>
      <View style={st.heads}>
        <Headline
          label={`${curM?.label || ''} so far`}
          value={num(curM ? pick(curM) : 0)}
          note="unique leads"
        />
        <Headline
          label={`${lastM?.label || ''} · MoM`}
          value={num(lastM ? pick(lastM) : 0)}
          delta={li > 0 ? change(pick(lastM), pick(months[li - 1])) : null}
          note={`vs ${months[li - 1]?.label || '—'}`}
        />
        <Headline
          label={`${lastM?.label || ''} · YoY`}
          value={num(lastM ? pick(lastM) : 0)}
          delta={li >= 12 ? change(pick(lastM), pick(months[li - 12])) : null}
          note={`vs ${months[li - 12]?.label || '—'}`}
        />
        <Headline
          label={`${curFy?.label || 'FY'} to date`}
          value={num(curFy ? pickB(curFy.ytd).unique : 0)}
          delta={
            prevFy
              ? change(pickB(curFy.ytd).unique, pickB(prevFy.ytd).unique)
              : null
          }
          note={`vs ${prevFy?.label || '—'}`}
        />
      </View>

      {failed.length > 0 && (
        <Text style={st.warn}>
          {failed.join(', ')} could not be read — counted as zero.
        </Text>
      )}

      <View style={st.card}>
        <Text style={st.cardTitle}>Month on month · {ch.label}</Text>
        <Text style={st.cardSub}>Unique leads per month · last 12 months</Text>
        <MonthChart months={months} pick={pick} color={color} />
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>Year on year · {ch.label}</Text>
        <Text style={st.cardSub}>
          Last three FYs, Apr → Mar on one axis — same month, different years
        </Text>
        <YearChart months={months} fys={fys} pick={pick} color={color} />
      </View>

      <View style={[st.card, { paddingHorizontal: 0 }]}>
        <View style={st.tableTabs}>
          {[
            { k: 'month', l: 'By month · last 12' },
            { k: 'fy', l: 'By FY · last 3' },
          ].map(o => (
            <TouchableOpacity
              key={o.k}
              onPress={() => setTable(o.k)}
              style={[st.tableTab, table === o.k && st.tableTabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: table === o.k }}
            >
              <Text
                style={[st.tableTabText, table === o.k && st.tableTabTextOn]}
              >
                {o.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {table === 'month' ? (
          <MonthTable months={months} pick={pick} pickDup={pickDup} />
        ) : (
          <FyTable
            fys={fys}
            pickB={pickB}
            ytdLabel={data?.meta?.ytdLabel || '1 Apr – today'}
          />
        )}
      </View>

      <Text style={st.foot}>
        Google leads only · MoM: last 12 months · YoY: last three FYs (
        {fys[0]?.label} – {fys[fys.length - 1]?.label}) · unique = one per
        phone, de-duplicated within each month (or FY) · not affected by the
        date range above
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 40 },
  muted: { fontFamily: F.regular, fontSize: 12, color: T.muted, marginTop: 10 },
  errorCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
  },
  errorText: {
    fontFamily: F.regular,
    fontSize: 13,
    color: T.text,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: T.brand,
    borderRadius: R.sm,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: { fontFamily: F.medium, fontSize: 13, color: T.white },
  warn: {
    fontFamily: F.regular,
    fontSize: 11,
    color: T.crit,
    marginHorizontal: 16,
    marginBottom: 10,
  },

  heads: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  head: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  headLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 0.9,
    color: T.muted,
  },
  headVal: {
    fontFamily: F.mono,
    fontSize: 19,
    color: T.text,
    marginTop: 6,
    letterSpacing: -0.4,
  },
  headNote: { fontFamily: F.mono, fontSize: 10, color: T.muted2, marginTop: 5 },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTitle: { fontFamily: F.semibold, fontSize: 13.5, color: T.text },
  cardSub: {
    fontFamily: F.regular,
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 2,
  },
  empty: {
    fontFamily: F.regular,
    fontSize: 12,
    color: T.muted,
    textAlign: 'center',
    paddingVertical: 30,
  },
  hint: { fontFamily: F.regular, fontSize: 10, color: T.muted2, marginTop: 4 },

  callout: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  callVal: { fontFamily: F.mono, fontSize: 22, letterSpacing: -0.5 },
  callNote: {
    fontFamily: F.mono,
    fontSize: 10.5,
    color: T.muted,
    marginBottom: 4,
  },
  callDelta: { fontFamily: F.mono, fontSize: 10.5 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontFamily: F.mono, fontSize: 10, color: T.muted },

  yoyRead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: T.lineSoft,
  },
  yoyMonth: { fontFamily: F.semibold, fontSize: 12, color: T.text, width: 32 },
  yoyCell: { flex: 1 },
  yoyFy: { fontFamily: F.mono, fontSize: 9 },
  yoyVal: { fontFamily: F.mono, fontSize: 14, color: T.text, marginTop: 2 },
  yoyDelta: { fontFamily: F.mono, fontSize: 9.5, marginTop: 1 },

  tableTabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tableTab: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tableTabOn: { backgroundColor: T.brand, borderColor: T.brand },
  tableTabText: { fontFamily: F.regular, fontSize: 11.5, color: T.muted },
  tableTabTextOn: { fontFamily: F.medium, color: '#fff' },

  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  th: { backgroundColor: T.subtle, paddingVertical: 7 },
  thText: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: T.muted2,
  },
  tdName: { flex: 1.3, fontFamily: F.medium, fontSize: 11.5, color: T.text },
  td: { flex: 1, textAlign: 'right' },
  tdNum: { fontFamily: F.mono, fontSize: 12, color: T.text },
  tableNote: {
    fontFamily: F.regular,
    fontSize: 10,
    color: T.muted2,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  foot: {
    fontFamily: F.regular,
    fontSize: 10,
    color: T.muted2,
    marginHorizontal: 18,
    marginBottom: 8,
  },
});
