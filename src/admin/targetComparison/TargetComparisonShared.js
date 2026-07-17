/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// TargetComparisonShared.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared UI + formatters for the Target Comparison screens.
//
// The one substantive change from the previous version is ComparisonTable:
// when the data carries Optimistic targets (SuperAdmin), it renders TWO compact
// target columns — "Base" and "Optimistic" — each folding the target value and
// its achievement % into a single cell (per the chosen compact layout). For
// everyone else the optimistic fields are absent and the table shows the single
// "Target / Ach %" columns exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Modal, Portal, Button } from 'react-native-paper';

export const BRAND = '#01458e';
export const BRAND_LIGHT = '#8FB7CC';
export const GREEN = '#1F9D57';
export const AMBER = '#D98A2B';
export const RED = '#D1495B';
export const BG = '#F4F6F9';

export const MODE_LABEL = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};
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
  yearly: ['Full Year'],
};

/* ------------------------------ formatters ---------------------------- */
export const fmtCount = n => (Number(n) || 0).toLocaleString('en-IN');

export const fmtCompact = n => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
};

export const fmtValue = (type, n) => {
  if (n == null) return '—';
  if (type === 'currency') return fmtCompact(n);
  if (type === 'percent') return `${(Number(n) || 0).toFixed(1)}%`;
  return fmtCount(n);
};

export const yoyColor = v => (v >= 0 ? GREEN : RED);
export const achColor = v =>
  v == null ? '#999' : v >= 100 ? GREEN : v >= 80 ? AMBER : RED;

export const buildPeriodLabel = (mode, idx) => {
  const list = PERIODS[mode] || PERIODS.monthly;
  return list[idx] || list[0];
};

/* ------------------------------- StatCard ----------------------------- */
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

/* ------------------------------ RevenueChart -------------------------- */
// Uses the BASE target bar (target). Optimistic isn't charted to keep the
// three-bar layout readable; it lives in the detailed table.
export const RevenueChart = ({ rows }) => {
  if (!rows) return null;
  const streams = rows.filter(r =>
    ['ipdRevenue', 'pharmacy', 'lab', 'opd'].includes(r.key),
  );
  const max = Math.max(
    ...streams.flatMap(r => [r.lastYear, r.thisYear, r.target || 0]),
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
                ['tg', st.target || 0, GREEN],
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
          ['Base Target', GREEN],
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

/* ------------------------------ GrowthChart --------------------------- */
export const GrowthChart = ({ rows }) => {
  if (!rows) return null;
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

/* ---------------------------- ComparisonTable ------------------------- */
// Columns depend on whether optimistic data is present (SuperAdmin).
//   base only : Parameter | Last Yr | This Yr | YoY % | Target | Ach %
//   dual      : Parameter | Last Yr | This Yr | YoY % | Base | Optimistic
//               where each of Base/Optimistic is a compact cell:
//                 <target value>
//                 <ach %>            (coloured by achievement)
const hasOptimistic = rows =>
  Array.isArray(rows) && rows.some(r => r.targetO != null || r.achO != null);

const BASE_COLS = [
  { key: 'label', title: 'Parameter', w: 140, align: 'left' },
  { key: 'lastYear', title: 'Last Yr', w: 100, align: 'right' },
  { key: 'thisYear', title: 'This Yr', w: 100, align: 'right' },
  { key: 'yoy', title: 'YoY %', w: 84, align: 'right' },
  { key: 'target', title: 'Target', w: 104, align: 'right' },
  { key: 'ach', title: 'Ach %', w: 78, align: 'right' },
];

const DUAL_COLS = [
  { key: 'label', title: 'Parameter', w: 132, align: 'left' },
  { key: 'lastYear', title: 'Last Yr', w: 96, align: 'right' },
  { key: 'thisYear', title: 'This Yr', w: 96, align: 'right' },
  { key: 'yoy', title: 'YoY %', w: 78, align: 'right' },
  { key: 'base', title: 'Base', w: 104, align: 'right' }, // compound cell
  { key: 'opt', title: 'Optimistic', w: 104, align: 'right' }, // compound cell
];

const yoyText = row => `${row.yoy >= 0 ? '+' : ''}${row.yoy.toFixed(2)}%`;
const achText = v => (v == null ? '—' : `${v.toFixed(1)}%`);

export const ComparisonTable = ({ rows }) => {
  if (!rows) return null;
  const dual = hasOptimistic(rows);
  const COLS = dual ? DUAL_COLS : BASE_COLS;

  const renderPlainCell = (col, row) => {
    let text;
    let color = '#222';
    if (col.key === 'label') {
      text = row.label;
    } else if (col.key === 'yoy') {
      text = yoyText(row);
      color = yoyColor(row.yoy);
    } else if (col.key === 'ach') {
      text = achText(row.ach);
      color = achColor(row.ach);
    } else if (col.key === 'target') {
      text = row.target == null ? '—' : fmtValue(row.type, row.target);
    } else {
      text = fmtValue(row.type, row[col.key]);
    }
    return (
      <Text
        key={col.key}
        numberOfLines={1}
        style={[
          s.tCell,
          {
            width: col.w,
            textAlign: col.align,
            color,
            fontWeight:
              row.key === 'total' || col.key === 'label' || col.key === 'yoy'
                ? '700'
                : '400',
          },
        ]}
      >
        {text}
      </Text>
    );
  };

  // Compound Base/Optimistic cell: target value on top, ach % beneath.
  const renderTargetCell = (col, row) => {
    const isOpt = col.key === 'opt';
    const target = isOpt ? row.targetO : row.target;
    const ach = isOpt ? row.achO : row.ach;
    const isTotal = row.key === 'total';
    return (
      <View
        key={col.key}
        style={{
          width: col.w,
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            s.tCell,
            {
              textAlign: 'right',
              color: '#222',
              fontWeight: isTotal ? '700' : '500',
              width: '100%',
            },
          ]}
        >
          {target == null ? '—' : fmtValue(row.type, target)}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            textAlign: 'right',
            width: '100%',
            color: achColor(ach),
            marginTop: 1,
          }}
        >
          {achText(ach)}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* header */}
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
        {/* sub-header hint for the compound columns */}
        {dual && (
          <View
            style={[s.tRow, { backgroundColor: '#eef3f8', paddingVertical: 2 }]}
          >
            {COLS.map(c => (
              <Text
                key={c.key}
                style={[s.tSubHead, { width: c.w, textAlign: c.align }]}
              >
                {c.key === 'base' || c.key === 'opt' ? 'target · ach%' : ''}
              </Text>
            ))}
          </View>
        )}
        {/* rows */}
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
              {COLS.map(c =>
                c.key === 'base' || c.key === 'opt'
                  ? renderTargetCell(c, row)
                  : renderPlainCell(c, row),
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

/* --------------------------- PeriodFilterModal ------------------------ */
export const PeriodFilterModal = ({
  visible,
  mode,
  period,
  onClose,
  onApply,
}) => {
  const [m, setM] = React.useState(mode);
  const [p, setP] = React.useState(period);
  React.useEffect(() => {
    setM(mode);
    setP(period);
  }, [mode, period, visible]);

  const modes = ['monthly', 'quarterly', 'yearly'];
  const periods = PERIODS[m] || [];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={s.modal}
      >
        <Text style={s.modalTitle}>Select Period</Text>

        <Text style={s.modalLabel}>View</Text>
        <View style={s.chipRow}>
          {modes.map(x => (
            <Text
              key={x}
              onPress={() => {
                setM(x);
                setP(0);
              }}
              style={[s.chip, m === x && s.chipActive]}
            >
              {MODE_LABEL[x]}
            </Text>
          ))}
        </View>

        {m !== 'yearly' && (
          <>
            <Text style={s.modalLabel}>Period</Text>
            <View style={s.chipWrap}>
              {periods.map((label, idx) => (
                <Text
                  key={label}
                  onPress={() => setP(idx)}
                  style={[s.chipSm, p === idx && s.chipActive]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </>
        )}

        <View style={s.modalActions}>
          <Button
            mode="outlined"
            onPress={onClose}
            textColor={BRAND}
            style={{ flex: 1, marginRight: 6 }}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={() => onApply(m, p)}
            buttonColor={BRAND}
            style={{ flex: 1, marginLeft: 6 }}
          >
            Apply
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

/* -------------------------------- styles ------------------------------ */
const s = StyleSheet.create({
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#eef1f5',
  },
  statTitle: { fontSize: 12, color: '#6b7280' },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2a37',
    marginTop: 4,
  },
  statSub: { fontSize: 12, marginTop: 4 },

  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  chartGroup: { alignItems: 'center', flex: 1 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    width: 12,
    marginHorizontal: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  chartXLabel: { fontSize: 11, color: '#6b7280', marginTop: 6 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 2, marginRight: 5 },
  legendText: { fontSize: 11, color: '#6b7280' },

  growthRow: { marginBottom: 12 },
  growthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  growthLabel: { fontSize: 13, color: '#374151' },
  growthVal: { fontSize: 13, fontWeight: '700' },
  growthTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eef1f5',
    overflow: 'hidden',
  },

  tRow: { flexDirection: 'row', alignItems: 'center' },
  tHeadRow: {
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
    marginBottom: 2,
  },
  tHeadCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  tSubHead: { fontSize: 9, color: '#94a3b8', paddingHorizontal: 4 },
  tCell: { fontSize: 13, paddingHorizontal: 4, paddingVertical: 8 },
  tTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#cbd5e1',
    backgroundColor: '#eef3f8',
  },

  modal: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2a37',
    marginBottom: 14,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 9,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#eef1f5',
    color: '#374151',
    fontWeight: '600',
    overflow: 'hidden',
  },
  chipSm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    margin: 4,
    borderRadius: 18,
    backgroundColor: '#eef1f5',
    color: '#374151',
    fontWeight: '600',
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: BRAND, color: '#fff' },
  modalActions: { flexDirection: 'row', marginTop: 22 },
});
