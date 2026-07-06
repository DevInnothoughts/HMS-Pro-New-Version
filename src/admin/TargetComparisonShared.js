/**
 * TargetComparisonShared.js
 * ------------------------------------------------------------------
 * Shared data, helpers and reusable UI for the Target Comparison
 * feature. Imported by:
 *   - TargetComparisonScreen.js      (all-branches overview + list)
 *   - BranchTargetDetailScreen.js    (per-branch detail, reusable)
 *
 * Phase 2: replace PARAMS/BRANCHES/buildRows with backend data; keep
 * the same shapes and the components below work unchanged.
 * ------------------------------------------------------------------
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/* ----------------------------- THEME ----------------------------- */
export const BRAND = '#01458e';
export const BRAND_LIGHT = '#9db8da';
export const GREEN = '#2e7d32';
export const RED = '#c62828';
export const AMBER = '#f29100';
export const BG = '#f4f6f9';

/* --------------------------- FORMATTERS -------------------------- */
export const fmtINR = n =>
  `\u20B9${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const fmtCount = n =>
  `${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const fmtPct = n => `${(Number(n) || 0).toFixed(2)}%`;
export const fmtCompact = n => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e7) return `\u20B9${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `\u20B9${(v / 1e5).toFixed(2)} L`;
  return `\u20B9${Math.round(v).toLocaleString('en-IN')}`;
};
export const fmtValue = (type, n) =>
  type === 'currency'
    ? fmtINR(n)
    : type === 'percent'
    ? fmtPct(n)
    : fmtCount(n);

export const yoyColor = v => (v >= 0 ? GREEN : RED);
export const achColor = v => (v >= 100 ? GREEN : v >= 90 ? AMBER : RED);

/* ----------------------------- DATA ------------------------------ *
 * Consistent dummy data derived from the target sheet. The four
 * revenue streams sum to Total Revenue. ly = last year, ty = this
 * year, targetPct = stored growth % (target = ly * (1 + pct/100)).
 * ---------------------------------------------------------------- */
export const PARAMS = [
  {
    key: 'newPatients',
    label: 'New Patients',
    short: 'New Pat.',
    type: 'count',
    targetPct: 11.83,
    ly: { monthly: 116, quarterly: 348, yearly: 1395 },
    ty: { monthly: 123, quarterly: 369, yearly: 1480 },
  },
  {
    key: 'conversion',
    label: 'Conversion',
    short: 'Conv.',
    type: 'percent',
    targetPct: 6.65,
    ly: { monthly: 23.44, quarterly: 23.44, yearly: 23.44 },
    ty: { monthly: 24.3, quarterly: 24.3, yearly: 24.3 },
  },
  {
    key: 'sx',
    label: 'No. of SX',
    short: 'SX',
    type: 'count',
    targetPct: 19.27,
    ly: { monthly: 27, quarterly: 81, yearly: 327 },
    ty: { monthly: 30, quarterly: 90, yearly: 365 },
  },
  {
    key: 'avgIpd',
    label: 'Avg IPD',
    short: 'Avg IPD',
    type: 'currency',
    targetPct: 3.21,
    ly: { monthly: 184082, quarterly: 184082, yearly: 184082 },
    ty: { monthly: 187500, quarterly: 187500, yearly: 187500 },
  },
  {
    key: 'ipdRevenue',
    label: 'IPD Revenue',
    short: 'IPD',
    type: 'currency',
    targetPct: 23.1,
    ly: { monthly: 5016248, quarterly: 15048744, yearly: 60194975 },
    ty: { monthly: 5700000, quarterly: 17100000, yearly: 68437500 },
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy Revenue',
    short: 'Pharmacy',
    type: 'currency',
    targetPct: 12.98,
    ly: { monthly: 186988, quarterly: 560964, yearly: 2243852 },
    ty: { monthly: 199000, quarterly: 597000, yearly: 2390000 },
  },
  {
    key: 'lab',
    label: 'Lab Revenue',
    short: 'Lab',
    type: 'currency',
    targetPct: 29.63,
    ly: { monthly: 112822, quarterly: 338466, yearly: 1353865 },
    ty: { monthly: 133000, quarterly: 399000, yearly: 1600000 },
  },
  {
    key: 'opd',
    label: 'OPD Revenue',
    short: 'OPD',
    type: 'currency',
    targetPct: 30.65,
    ly: { monthly: 261189, quarterly: 783567, yearly: 3134270 },
    ty: { monthly: 308000, quarterly: 924000, yearly: 3700000 },
  },
  {
    key: 'total',
    label: 'Total Revenue',
    short: 'Total',
    type: 'currency',
    targetPct: 23.25,
    ly: { monthly: 5577247, quarterly: 16731741, yearly: 66926962 },
    ty: { monthly: 6340000, quarterly: 19020000, yearly: 76127500 },
  },
];

/* Dummy branch list. In phase 2 build this from redux locationArray /
 * the backend. Weights (excluding "all") sum to 1.0 so branches add up
 * to the consolidated total. (Sample of 8; real list can be 40+.) */
export const BRANCHES = [
  { id: 'all', name: 'All Branches', weight: 1, ratioAdj: 1 },
  { id: 'baner', name: 'Pune - Baner', weight: 0.18, ratioAdj: 1.04 },
  { id: 'andheri', name: 'Mumbai - Andheri', weight: 0.16, ratioAdj: 0.98 },
  { id: 'nashik', name: 'Nashik', weight: 0.14, ratioAdj: 1.01 },
  { id: 'wakad', name: 'Pune - Wakad', weight: 0.13, ratioAdj: 0.95 },
  { id: 'thane', name: 'Thane', weight: 0.12, ratioAdj: 1.02 },
  { id: 'kothrud', name: 'Pune - Kothrud', weight: 0.1, ratioAdj: 0.97 },
  { id: 'nagpur', name: 'Nagpur', weight: 0.09, ratioAdj: 1.0 },
  { id: 'kolhapur', name: 'Kolhapur', weight: 0.08, ratioAdj: 0.96 },
];

export const ADDITIVE = new Set([
  'newPatients',
  'sx',
  'ipdRevenue',
  'pharmacy',
  'lab',
  'opd',
]);

const _fyStart = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1; // FY starts April
})();
const _fyLabel = y => `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`;

export const PERIODS = {
  monthly: [
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
  ],
  quarterly: ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'],
  yearly: [_fyLabel(_fyStart), _fyLabel(_fyStart - 1)],
};

export const MODE_LABEL = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const buildPeriodLabel = (mode, idx) => {
  if (mode === 'yearly') {
    const cur = PERIODS.yearly[idx] || PERIODS.yearly[0];
    const m = cur.match(/(\d{4})-(\d{2})/);
    const prev = m
      ? `FY ${Number(m[1]) - 1}-${String(Number(m[2]) - 1).padStart(2, '0')}`
      : 'Prev FY';
    return `${cur} vs ${prev}`;
  }
  const curYY = String((_fyStart + 1) % 100).padStart(2, '0');
  const prevYY = String(_fyStart % 100).padStart(2, '0');
  if (mode === 'quarterly') {
    const q = (PERIODS.quarterly[idx] || PERIODS.quarterly[0]).split(' ')[0];
    return `${q} FY${curYY} vs ${q} FY${prevYY}`;
  }
  const mo = PERIODS.monthly[idx] || PERIODS.monthly[0];
  return `${mo} FY${curYY} vs ${mo} FY${prevYY}`;
};

export const buildRows = (mode, branchId = 'all') => {
  const branch = BRANCHES.find(b => b.id === branchId) || BRANCHES[0];
  const { weight: w, ratioAdj } = branch;

  const vals = {};
  PARAMS.forEach(p => {
    let lastYear;
    let thisYear;
    if (branch.id === 'all') {
      lastYear = p.ly[mode];
      thisYear = p.ty[mode];
    } else if (ADDITIVE.has(p.key)) {
      lastYear = Math.round(p.ly[mode] * w);
      thisYear = Math.round(p.ty[mode] * w);
    } else if (p.key === 'conversion') {
      lastYear = +(p.ly[mode] * ratioAdj).toFixed(2);
      thisYear = +(p.ty[mode] * ratioAdj).toFixed(2);
    } else if (p.key === 'avgIpd') {
      lastYear = Math.round(p.ly[mode] * ratioAdj);
      thisYear = Math.round(p.ty[mode] * ratioAdj);
    }
    vals[p.key] = { lastYear, thisYear };
  });

  if (branch.id !== 'all') {
    vals.total = {
      lastYear:
        vals.ipdRevenue.lastYear +
        vals.pharmacy.lastYear +
        vals.lab.lastYear +
        vals.opd.lastYear,
      thisYear:
        vals.ipdRevenue.thisYear +
        vals.pharmacy.thisYear +
        vals.lab.thisYear +
        vals.opd.thisYear,
    };
  }

  return PARAMS.map(p => {
    const { lastYear, thisYear } = vals[p.key];
    const target = lastYear * (1 + p.targetPct / 100);
    const yoy = lastYear ? ((thisYear - lastYear) / lastYear) * 100 : 0;
    const ach = target ? (thisYear / target) * 100 : 0;
    return { ...p, lastYear, thisYear, target, yoy, ach };
  });
};

export const buildBranchTotals = mode =>
  BRANCHES.filter(b => b.id !== 'all').map(b => {
    const t = buildRows(mode, b.id).find(r => r.key === 'total');
    return {
      id: b.id,
      name: b.name,
      thisYear: t.thisYear,
      lastYear: t.lastYear,
      yoy: t.yoy,
      ach: t.ach,
    };
  });

/* =============================== UI =============================== */

export const StatCard = ({ title, value, sub, subColor }) => (
  <View style={s.statCard}>
    <Text style={s.statTitle}>{title}</Text>
    <Text style={s.statValue} numberOfLines={1}>
      {value}
    </Text>
    {!!sub && (
      <Text style={[s.statSub, { color: subColor || '#777' }]}>{sub}</Text>
    )}
  </View>
);

export const RevenueChart = ({ rows }) => {
  const streams = rows.filter(r =>
    ['ipdRevenue', 'pharmacy', 'lab', 'opd'].includes(r.key),
  );
  const max = Math.max(
    ...streams.flatMap(r => [r.lastYear, r.thisYear, r.target]),
    1,
  );
  const H = 150;
  return (
    <View>
      <View style={s.chartArea}>
        {streams.map(st => (
          <View key={st.key} style={s.chartGroup}>
            <View style={[s.chartBars, { height: H }]}>
              {[
                ['ly', st.lastYear, BRAND_LIGHT],
                ['ty', st.thisYear, BRAND],
                ['tg', st.target, GREEN],
              ].map(([k, v, c]) => (
                <View
                  key={k}
                  style={[
                    s.bar,
                    { height: Math.max(3, (v / max) * H), backgroundColor: c },
                  ]}
                />
              ))}
            </View>
            <Text style={s.chartXLabel}>{st.short}</Text>
          </View>
        ))}
      </View>
      <View style={s.legendRow}>
        {[
          ['Last Year', BRAND_LIGHT],
          ['This Year', BRAND],
          ['Target', GREEN],
        ].map(([t, c]) => (
          <View key={t} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: c }]} />
            <Text style={s.legendText}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const GrowthChart = ({ rows }) => {
  const max = Math.max(...rows.map(r => Math.abs(r.yoy)), 1);
  return (
    <View>
      {rows.map(r => (
        <View key={r.key} style={s.growthRow}>
          <View style={s.growthHead}>
            <Text style={s.growthLabel}>{r.label}</Text>
            <Text style={[s.growthVal, { color: yoyColor(r.yoy) }]}>
              {r.yoy >= 0 ? '+' : ''}
              {r.yoy.toFixed(2)}%
            </Text>
          </View>
          <View style={s.growthTrack}>
            <View
              style={{
                width: `${(Math.abs(r.yoy) / max) * 100}%`,
                height: 8,
                borderRadius: 4,
                backgroundColor: yoyColor(r.yoy),
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const COLS = [
  { key: 'label', title: 'Parameter', w: 150, align: 'left' },
  { key: 'lastYear', title: 'Last Yr', w: 120, align: 'right' },
  { key: 'thisYear', title: 'This Yr', w: 120, align: 'right' },
  { key: 'yoy', title: 'YoY %', w: 90, align: 'right' },
  { key: 'target', title: 'Target', w: 120, align: 'right' },
  { key: 'ach', title: 'Ach %', w: 85, align: 'right' },
];

const cellText = (col, row) => {
  if (col.key === 'label') return row.label;
  if (col.key === 'yoy')
    return `${row.yoy >= 0 ? '+' : ''}${row.yoy.toFixed(2)}%`;
  if (col.key === 'ach')
    return row.ach == null ? '—' : `${row.ach.toFixed(1)}%`;
  if (col.key === 'target')
    return row.target == null ? '—' : fmtValue(row.type, row.target);
  return fmtValue(row.type, row[col.key]);
};
const cellColor = (col, row) => {
  if (col.key === 'yoy') return yoyColor(row.yoy);
  if (col.key === 'ach') return row.ach == null ? '#999' : achColor(row.ach);
  return '#222';
};

export const ComparisonTable = ({ rows }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <View>
      <View style={[s.tRow, s.tHeadRow]}>
        {COLS.map(c => (
          <Text
            key={c.key}
            style={[s.tHeadCell, { width: c.w, textAlign: c.align }]}
          >
            {c.title}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => {
        const isTotal = row.key === 'total';
        return (
          <View
            key={row.key}
            style={[
              s.tRow,
              { backgroundColor: i % 2 ? '#f7f9fc' : '#fff' },
              isTotal && s.tTotalRow,
            ]}
          >
            {COLS.map(c => (
              <Text
                key={c.key}
                numberOfLines={1}
                style={[
                  s.tCell,
                  {
                    width: c.w,
                    textAlign: c.align,
                    color: cellColor(c, row),
                    fontWeight:
                      isTotal || c.key === 'label' || c.key === 'yoy'
                        ? '700'
                        : '500',
                  },
                ]}
              >
                {cellText(c, row)}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  </ScrollView>
);

/* Self-contained Monthly/Quarterly/Yearly + period filter modal */
export const PeriodFilterModal = ({
  visible,
  mode,
  period,
  onApply,
  onClose,
}) => {
  const [dMode, setDMode] = useState(mode);
  const [dPeriod, setDPeriod] = useState(period);

  useEffect(() => {
    if (visible) {
      setDMode(mode);
      setDPeriod(period);
    }
  }, [visible, mode, period]);

  const MODES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Comparison Filter</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>
          <Divider style={{ marginBottom: 18 }} />

          <Text style={s.modalLabel}>Comparison Type</Text>
          <View style={s.segmentRow}>
            {MODES.map(m => {
              const active = dMode === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[s.segmentBtn, active && s.segmentBtnActive]}
                  onPress={() => {
                    setDMode(m.value);
                    setDPeriod(0);
                  }}
                >
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[s.modalLabel, { marginTop: 18 }]}>Period</Text>
          <View style={s.periodWrap}>
            {PERIODS[dMode].map((p, i) => {
              const active = dPeriod === i;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setDPeriod(i)}
                  style={[s.periodChip, active && s.periodChipActive]}
                >
                  <Text
                    style={[s.periodChipText, active && s.periodChipTextActive]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Divider style={{ marginTop: 22, marginBottom: 16 }} />
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.applyBtn}
              onPress={() => onApply(dMode, dPeriod)}
            >
              <Icon
                name="check"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={s.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* Shared styles for the components above */
const s = StyleSheet.create({
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statTitle: { fontSize: 12, color: '#777', fontWeight: '600' },
  statValue: { fontSize: 20, color: BRAND, fontWeight: '800', marginTop: 6 },
  statSub: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  chartGroup: { flex: 1, alignItems: 'center' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { width: 13, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartXLabel: { fontSize: 11, color: '#555', marginTop: 6, fontWeight: '600' },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 11, height: 11, borderRadius: 3, marginRight: 6 },
  legendText: { fontSize: 12, color: '#555' },

  growthRow: { marginBottom: 10 },
  growthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  growthLabel: { fontSize: 13, color: '#444' },
  growthVal: { fontSize: 13, fontWeight: '700' },
  growthTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eef1f6',
    overflow: 'hidden',
  },

  tRow: { flexDirection: 'row', alignItems: 'center' },
  tHeadRow: {
    backgroundColor: BRAND,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tHeadCell: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tCell: { fontSize: 12.5, paddingVertical: 10, paddingHorizontal: 8 },
  tTotalRow: {
    backgroundColor: '#e9f3ea',
    borderTopWidth: 1,
    borderTopColor: '#cfe3d1',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  modalLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginBottom: 8,
  },
  periodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    backgroundColor: '#eef2fb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#eef2fb',
    borderRadius: 10,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: BRAND },
  segmentText: { color: BRAND, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: '#fff' },
  periodChipActive: { backgroundColor: BRAND },
  periodChipText: { color: BRAND, fontSize: 13, fontWeight: '600' },
  periodChipTextActive: { color: '#fff' },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#eef1f6',
  },
  cancelText: { color: '#555', fontWeight: '700', fontSize: 15 },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: BRAND,
  },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
