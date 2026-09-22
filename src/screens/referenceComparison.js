/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/referenceComparison.js
// ─────────────────────────────────────────────────────────────────────────────
// The month-wise comparison from src/admin/ReferenceData.js, rebuilt as a block
// for ReferenceReportScreen.
//
//   GET /Patient/referenceMonthwise?location=&fyStart=2026
//        → { fy: { start }, referenceTypeMap,
//            months: [{ current: { total, invoices, byType, invoiceByType },
//                       previous: { … } }] }   // 12 entries, fiscal Apr-first
//
// valueOf, buildComparisonRows, elapsedMonths and pct are the ORIGINAL
// functions, unchanged — the MoM / QoQ / YoY arithmetic is the part worth
// preserving exactly, and it already handles the awkward cases (a future FY,
// a part-elapsed FY, string-typed counts from the driver).
//
// ⚠️ IT ALWAYS SHOWS A FINANCIAL YEAR, NOT THE SCOPE CHIP'S RANGE
// ───────────────────────────────────────────────────────────────
// The endpoint takes fyStart and returns twelve fiscal months. There is no
// arbitrary-range version. The old screen handled this by only loading the
// comparison in its FY filter modes and clearing it otherwise.
//
// Here the FY is DERIVED from the chip's `from` date — pick March and you get
// that financial year — so the block always has something to show and the
// header states which FY it is. It does not silently follow a seven-day chip.
//
// ⚠️ MoM's FIRST MONTH HAS NO BASE
// ────────────────────────────────
// April compares against nothing, so its delta is null and renders as a dash.
// That is correct, not missing data — the original does the same.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { get } from '../api/client';
import { F, T, num } from '../design/tokens';

const ENDPOINT = '/Patient/referenceMonthwise';

const MONTH_LABELS = [
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

/* ── original helpers, unchanged ──────────────────────────────────────────── */

export const currentFyStart = () => {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
};

/** How many months of this FY have actually happened. */
const elapsedMonths = fyStart => {
  const nowFy = currentFyStart();
  if (fyStart < nowFy) return 12; // a completed FY
  if (fyStart > nowFy) return 0; // a future FY
  const now = new Date();
  const idx = (now.getFullYear() - fyStart) * 12 + now.getMonth() - 3;
  return Math.min(12, Math.max(1, idx + 1));
};

const pct = (cur, base) =>
  base > 0 ? ((cur - base) / base) * 100 : cur > 0 ? null : 0;

/**
 * Pull one number out of a month bucket.
 * Tolerates a missing bucket and string-typed counts from the DB driver.
 */
const valueOf = (bucket, refType = 'ALL', metric = 'patients') => {
  if (!bucket) return 0;
  if (metric === 'invoices') {
    return refType === 'ALL'
      ? Number(bucket.invoices) || 0
      : Number(bucket.invoiceByType?.[refType]) || 0;
  }
  return refType === 'ALL'
    ? Number(bucket.total) || 0
    : Number(bucket.byType?.[refType]) || 0;
};

/**
 * Turns the API's 12 fiscal months into comparison rows.
 *   MoM → each month vs the previous month of the same FY
 *   QoQ → fiscal quarters, each vs the previous quarter
 *   YoY → each month vs the same month of the previous FY
 */
export const buildComparisonRows = (
  months,
  mode,
  refType = 'ALL',
  metric = 'patients',
  limit = 12,
) => {
  if (!Array.isArray(months) || months.length === 0 || limit <= 0) return [];

  if (mode === 'QoQ') {
    const QUARTERS = [
      { label: 'Q1 (Apr–Jun)', idx: [0, 1, 2] },
      { label: 'Q2 (Jul–Sep)', idx: [3, 4, 5] },
      { label: 'Q3 (Oct–Dec)', idx: [6, 7, 8] },
      { label: 'Q4 (Jan–Mar)', idx: [9, 10, 11] },
    ].filter(q => q.idx[0] < limit);

    const rows = QUARTERS.map(q => ({
      label: q.label,
      value: q.idx.reduce(
        (s, i) =>
          s + (i < limit ? valueOf(months[i]?.current, refType, metric) : 0),
        0,
      ),
      lastYear: q.idx.reduce(
        (s, i) =>
          s + (i < limit ? valueOf(months[i]?.previous, refType, metric) : 0),
        0,
      ),
    }));

    return rows.map((r, i) => {
      const base = i === 0 ? null : rows[i - 1].value;
      return {
        ...r,
        base,
        baseLabel: i === 0 ? '—' : rows[i - 1].label,
        delta: base == null ? null : r.value - base,
        pct: base == null ? null : pct(r.value, base),
      };
    });
  }

  const rows = months.slice(0, limit).map((m, i) => ({
    label: MONTH_LABELS[i],
    value: valueOf(m?.current, refType, metric),
    lastYear: valueOf(m?.previous, refType, metric),
  }));

  return rows.map((r, i) => {
    const base =
      mode === 'YoY' ? r.lastYear : i === 0 ? null : rows[i - 1].value;
    const baseLabel =
      mode === 'YoY' ? `${r.label} LY` : i === 0 ? '—' : rows[i - 1].label;
    return {
      ...r,
      base,
      baseLabel,
      delta: base == null ? null : r.value - base,
      pct: base == null ? null : pct(r.value, base),
    };
  });
};

/* ── display ──────────────────────────────────────────────────────────────── */

const MODES = [
  { key: 'MoM', label: 'MoM' },
  { key: 'QoQ', label: 'QoQ' },
  { key: 'YoY', label: 'YoY' },
];

const METRICS = [
  { key: 'patients', label: 'Patients' },
  { key: 'invoices', label: 'IPD' },
];

const deltaColor = p =>
  p == null ? T.muted2 : p > 0 ? '#1E7A5A' : p < 0 ? T.crit : T.muted2;

const fmtPct = p => {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : p < 0 ? '−' : '';
  return `${sign}${Math.abs(p).toFixed(1)}%`;
};

/**
 * @param location  branch
 * @param from      the scope chip's from-date; its financial year is used
 */
export const ReferenceComparison = ({ location, from }) => {
  // The FY containing the chip's start date. Jan–Mar belong to the PREVIOUS
  // financial year, which is why this is not just getFullYear().
  const fyStart = useMemo(() => {
    const d = new Date(`${from}T00:00:00`);
    if (Number.isNaN(d.getTime())) return currentFyStart();
    return d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  }, [from]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('MoM');
  const [metric, setMetric] = useState('patients');
  const [refType, setRefType] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await get(ENDPOINT, { location, fyStart });
      if (!Array.isArray(res?.months)) {
        throw new Error('Month-wise data is unavailable for this period.');
      }
      setData(res);
    } catch (e) {
      setData(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [location, fyStart]);

  useEffect(() => {
    load();
  }, [load]);

  const monthLimit = data ? elapsedMonths(data.fy?.start ?? fyStart) : 0;

  // Built from whatever types actually appear in the data, so a new
  // reference_type needs no code change here.
  const refTypeOptions = useMemo(() => {
    const set = new Set();
    (data?.months || []).forEach(m => {
      Object.keys(m?.current?.byType || {}).forEach(k => set.add(k));
      Object.keys(m?.previous?.byType || {}).forEach(k => set.add(k));
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [data]);

  const labelForRefType = key =>
    key === 'ALL' ? 'All sources' : data?.referenceTypeMap?.[key] || key;

  const rows = useMemo(
    () => buildComparisonRows(data?.months, mode, refType, metric, monthLimit),
    [data, mode, refType, metric, monthLimit],
  );

  // FY-to-date, always current FY vs previous FY — independent of the MoM/QoQ
  // toggle, which only changes what each ROW is compared against.
  const fyTotals = useMemo(() => {
    const slice = (data?.months || []).slice(0, monthLimit);
    const cur = slice.reduce(
      (s, m) => s + valueOf(m?.current, refType, metric),
      0,
    );
    const prev = slice.reduce(
      (s, m) => s + valueOf(m?.previous, refType, metric),
      0,
    );
    return { cur, prev, delta: cur - prev, pct: pct(cur, prev) };
  }, [data, monthLimit, refType, metric]);

  const hasData = rows.some(r => r.value > 0 || (r.lastYear || 0) > 0);

  if (loading) {
    return (
      <View style={s.block}>
        <Text style={s.blockLabel}>YEAR-ON-YEAR COMPARISON</Text>
        <View style={s.centre}>
          <ActivityIndicator color={T.brand} />
        </View>
      </View>
    );
  }

  if (error || !hasData) {
    return (
      <View style={s.block}>
        <Text style={s.blockLabel}>YEAR-ON-YEAR COMPARISON</Text>
        <Text style={s.empty}>
          {error || `No month-wise data for FY ${fyStart}–${fyStart + 1}.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.block}>
      <View style={s.head}>
        <Text style={s.blockLabel}>COMPARISON</Text>
        {/* The FY is stated because this block ignores the scope chip's range
            and always covers a financial year. */}
        <Text style={s.fy}>
          FY {fyStart}–{String(fyStart + 1).slice(2)}
        </Text>
      </View>

      <View style={s.toggles}>
        {MODES.map(m => {
          const on = mode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[s.toggle, on && s.toggleOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.toggleText, on && s.toggleTextOn]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        {METRICS.map(m => {
          const on = metric === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMetric(m.key)}
              style={[s.toggle, on && s.toggleOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.toggleText, on && s.toggleTextOn]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {refTypeOptions.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          {refTypeOptions.map(k => {
            const on = refType === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setRefType(k)}
                style={[s.chip, on && s.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipText, on && s.chipTextOn]}>
                  {labelForRefType(k)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={s.table}>
        <View style={s.tHead}>
          <Text style={[s.th, s.colLabel]}>
            {mode === 'QoQ' ? 'QUARTER' : 'MONTH'}
          </Text>
          <Text style={[s.th, s.colNum]}>THIS</Text>
          <Text style={[s.th, s.colNum]}>
            {mode === 'YoY' ? 'LAST YR' : 'PREV'}
          </Text>
          <Text style={[s.th, s.colNum]}>Δ</Text>
          <Text style={[s.th, s.colPct]}>Δ%</Text>
        </View>

        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[
              s.tRow,
              i % 2 === 1 && s.tRowAlt,
              i === rows.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <Text style={[s.name, s.colLabel]} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={[s.val, s.colNum]}>{num(r.value)}</Text>
            <Text style={[s.base, s.colNum]}>
              {r.base == null ? '—' : num(r.base)}
            </Text>
            <Text style={[s.val, s.colNum, { color: deltaColor(r.pct) }]}>
              {r.delta == null
                ? '—'
                : `${r.delta > 0 ? '+' : ''}${num(r.delta)}`}
            </Text>
            <Text style={[s.pct, s.colPct, { color: deltaColor(r.pct) }]}>
              {fmtPct(r.pct)}
            </Text>
          </View>
        ))}

        <View style={s.tFoot}>
          <Text style={[s.footName, s.colLabel]}>FY TO DATE</Text>
          <Text style={[s.footVal, s.colNum]}>{num(fyTotals.cur)}</Text>
          <Text style={[s.footVal, s.colNum]}>{num(fyTotals.prev)}</Text>
          <Text
            style={[s.footVal, s.colNum, { color: deltaColor(fyTotals.pct) }]}
          >
            {`${fyTotals.delta > 0 ? '+' : ''}${num(fyTotals.delta)}`}
          </Text>
          <Text
            style={[s.footPct, s.colPct, { color: deltaColor(fyTotals.pct) }]}
          >
            {fmtPct(fyTotals.pct)}
          </Text>
        </View>
      </View>

      {/* FY to date is ALWAYS this FY vs last FY, whichever row comparison is
          selected — otherwise the footer would mean three different things. */}
      <Text style={s.note}>
        {monthLimit < 12
          ? `${monthLimit} month${monthLimit === 1 ? '' : 's'} elapsed. `
          : ''}
        FY to date compares this financial year against the same months of the
        previous one, whichever comparison is selected above.
      </Text>
    </View>
  );
};

export default ReferenceComparison;

const s = StyleSheet.create({
  block: { marginTop: 24 },
  centre: { paddingVertical: 30, alignItems: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
  },
  fy: { fontFamily: F.mono, fontSize: 10, color: T.muted },
  empty: {
    fontSize: 12,
    color: T.muted,
    fontFamily: F.regular,
    marginTop: 10,
    marginHorizontal: 2,
  },

  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  toggle: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: T.card,
  },
  toggleOn: { borderColor: T.brand, backgroundColor: '#EAF2ED' },
  toggleText: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  toggleTextOn: { color: T.brand, fontFamily: F.medium },

  chips: { flexDirection: 'row', gap: 6, paddingVertical: 10, paddingRight: 4 },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: T.card,
  },
  chipOn: { borderColor: T.brand, backgroundColor: '#EAF2ED' },
  chipText: { fontSize: 10.5, color: T.muted, fontFamily: F.regular },
  chipTextOn: { color: T.brand, fontFamily: F.medium },

  table: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  th: { fontFamily: F.mono, fontSize: 7.5, letterSpacing: 0.9, color: T.muted },

  colLabel: { flex: 1, textAlign: 'left' },
  colNum: { width: 46, textAlign: 'right' },
  colPct: { width: 54, textAlign: 'right' },

  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  tRowAlt: { backgroundColor: T.subtle },
  name: { fontSize: 12, color: T.text, fontFamily: F.regular },
  val: { fontFamily: F.mono, fontSize: 12, color: T.text },
  base: { fontFamily: F.mono, fontSize: 12, color: T.muted2 },
  pct: { fontFamily: F.mono, fontSize: 11 },

  tFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  footName: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 0.9,
    color: T.muted,
  },
  footVal: {
    fontFamily: F.mono,
    fontSize: 12,
    color: T.text,
    fontWeight: '600',
  },
  footPct: { fontFamily: F.mono, fontSize: 11, fontWeight: '600' },

  note: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 10,
    marginHorizontal: 2,
    fontFamily: F.regular,
    lineHeight: 15,
  },
});
