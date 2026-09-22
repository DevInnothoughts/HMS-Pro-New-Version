/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/approval/OpdApprovalSection.js
// ─────────────────────────────────────────────────────────────────────────────
// The OPD half of the daily sign-off. Replaces src/admin/OPDApproval.js.
//
//   GET /DailyOPD/v1?location=&date=<yesterday IST>
//
// ⚠️ EXACTLY THE SAME DATA AS THE OLD SCREEN — NOTHING ADDED, NOTHING DROPPED
// ───────────────────────────────────────────────────────────────────────────
//   dailyOPDReport[0]  visit mix + total
//   diagnosisCount, prescriptionCount
//   detailedData       6 × 5 patient-flow grid
//   opdReport          consultation → amount
//   testReport         lab test → amount
//   opdCollection  ┐
//   labCollection  ├   type → amount, four separate tables upstream
//   pharmacyCollection │
//   overallCollection  ┘
//
// The four collection tables are shown as ONE matrix — same numbers, one set
// of row labels instead of four. Their rows are built from the union of
// whatever labels the API actually returns, NOT a hardcoded Cash/Card/Online
// list: a fixed list silently drops any type the branch reports beyond it.
//
// No totals are computed anywhere. The old screen showed none, and a total
// this screen invented would be a number nobody is signing off.
//
// ⚠️ EMBEDDED, NOT A SCREEN
// ─────────────────────────
// The old file nested a SafeAreaView, a ScrollView and a Portal dialog inside
// the wizard's own ScrollView, so its tables scrolled independently of the
// page and the loading dialog covered the whole app. This is a plain View.
//
// ⚠️ THE DATE IS YESTERDAY, ALWAYS
// ────────────────────────────────
// Approval signs off the PREVIOUS day. getYesterdayIST adds 5h30m to UTC then
// reads the UTC fields, so a phone in another timezone still asks for the same
// day the branch did.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { get } from '../../api/client';
import { F, T, inr, num } from '../../design/tokens';

// dailyOPDReport: [new, follow, po, proctoscopy, mcdpa, total] — the header
// labels are the old screen's, verbatim.
const VISIT_COLS = [
  { label: 'New', hue: '#2F6FA8' },
  { label: 'Follow UP', hue: '#3E8C8C' },
  { label: 'PO', hue: '#7A5EA8' },
  { label: 'PROCTOSCOPY', hue: '#B3762B' },
  { label: 'MCDPA', hue: '#A8567F' },
];

// detailedData row and column labels, verbatim from the old <Col data={[...]}>
// and its header <Row>. These abbreviations are the branch's own vocabulary.
const FLOW_ROWS = ['DNC', 'DNP', 'DNW', 'DNT', 'WALK-IN', 'ONLY REGISTRATION'];
const FLOW_COLS = ['New', 'Follow UP', 'PO', 'MCDPA', 'TOTAL'];

// The four collection tables, in the old screen's order.
const COLLECTIONS = [
  { key: 'opdCollection', label: 'OPD' },
  { key: 'labCollection', label: 'Lab' },
  { key: 'pharmacyCollection', label: 'Pharm' },
  { key: 'overallCollection', label: 'Overall' },
];

/** [['Cash', n], …] → { Cash: n, … } */
const pairsToMap = pairs => {
  const out = {};
  for (const p of pairs || []) if (Array.isArray(p)) out[String(p[0])] = p[1];
  return out;
};

/** IST wall clock, yesterday. See the header. */
export const getYesterdayIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - 1);
  const p = n => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(
    ist.getUTCDate(),
  )}`;
};

const OpdApprovalSection = () => {
  const location = useSelector(s => s.location.value);
  const date = getYesterdayIST();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await get('/DailyOPD/v1', { location, date }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [location, date]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The four collection tables, transposed.
   *
   * Row labels are the UNION of every type the four tables actually contain,
   * in the order first seen. A hardcoded list would silently drop a type the
   * branch reports — which is the whole reason this is computed.
   */
  const collection = useMemo(() => {
    if (!data) return { rows: [], cols: [] };
    const cols = COLLECTIONS.map(c => ({ ...c, map: pairsToMap(data[c.key]) }));
    const rows = [];
    for (const c of cols) {
      for (const k of Object.keys(c.map)) {
        if (!rows.includes(k)) rows.push(k);
      }
    }
    return { rows, cols };
  }, [data]);

  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color="#2F6FA8" />
      </View>
    );
  }

  if (error || !data) {
    return <Text style={s.empty}>{error || 'No OPD data for this day.'}</Text>;
  }

  const visits = data.dailyOPDReport?.[0] || [];
  const visitTotal = visits[5];

  return (
    <View style={s.wrap}>
      {/* ── Visit mix ── */}
      <Block
        label="Patients seen"
        trail={visitTotal != null ? `${num(visitTotal)} total` : null}
      >
        <View style={s.grid}>
          {VISIT_COLS.map((c, i) => (
            <View key={c.label} style={s.cell}>
              <View style={[s.cellSpine, { backgroundColor: c.hue }]} />
              <Text style={s.cellLabel} numberOfLines={1}>
                {c.label}
              </Text>
              <Text style={[s.cellVal, { color: c.hue }]}>
                {num(visits[i] ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      </Block>

      {/* ── Records ── */}
      <Block label="Records">
        <View style={s.pairRow}>
          <Mini label="Diagnosis" value={num(data.diagnosisCount ?? 0)} />
          <Mini
            label="Prescriptions"
            value={num(data.prescriptionCount ?? 0)}
          />
        </View>
      </Block>

      {/* ── Patient flow — genuinely 6 × 5 ── */}
      {!!data.detailedData?.length && (
        <Block label="Patient flow">
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 1.2 }]} />
              {FLOW_COLS.map(c => (
                <Text key={c} style={[s.th, s.tNum]}>
                  {c.toUpperCase()}
                </Text>
              ))}
            </View>
            {data.detailedData.map((row, ri) => (
              <View
                key={FLOW_ROWS[ri] || ri}
                style={[
                  s.tRow,
                  ri === data.detailedData.length - 1 && {
                    borderBottomWidth: 0,
                  },
                ]}
              >
                <Text style={[s.tLabel, { flex: 1.2 }]} numberOfLines={2}>
                  {FLOW_ROWS[ri] || `Row ${ri + 1}`}
                </Text>
                {row.map((v, ci) => (
                  <Text
                    key={ci}
                    style={[
                      s.tVal,
                      s.tNum,
                      ci === row.length - 1 && s.tBold,
                      // A zero is noise in a 30-cell grid; muting it lets the
                      // real numbers carry the eye.
                      Number(v) === 0 && s.tZero,
                    ]}
                  >
                    {num(v ?? 0)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </Block>
      )}

      {/* ── Collection: four tables, one matrix ── */}
      {collection.rows.length > 0 && (
        <Block label="Collection">
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 1 }]}>TYPE</Text>
              {collection.cols.map(c => (
                <Text key={c.key} style={[s.th, s.tNum]}>
                  {c.label.toUpperCase()}
                </Text>
              ))}
            </View>
            {collection.rows.map((label, i) => (
              <View
                key={label}
                style={[
                  s.tRow,
                  i === collection.rows.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={[s.tLabel, { flex: 1 }]} numberOfLines={1}>
                  {label}
                </Text>
                {collection.cols.map(c => {
                  const v = c.map[label];
                  return (
                    <Text
                      key={c.key}
                      style={[s.tVal, s.tNum, v == null && s.tZero]}
                      numberOfLines={1}
                    >
                      {/* A type absent from one table is a dash, not a zero —
                          "not reported" and "reported as nil" differ. */}
                      {v == null ? '—' : inr(v)}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </Block>
      )}

      {/* ── Consultation-wise ── */}
      {!!data.opdReport?.length && (
        <Block label="OPD">
          <AmountList rows={data.opdReport} hue="#2F6FA8" />
        </Block>
      )}

      {!!data.testReport?.length && (
        <Block label="Lab">
          <AmountList rows={data.testReport} hue="#6E5AA8" />
        </Block>
      )}
    </View>
  );
};

const Block = ({ label, trail, children }) => (
  <View style={s.block}>
    <View style={s.blockHead}>
      <Text style={s.blockLabel}>{label.toUpperCase()}</Text>
      {!!trail && <Text style={s.blockTrail}>{trail}</Text>}
    </View>
    {children}
  </View>
);

/** Name → amount. No total row: the old screen showed none. */
const AmountList = ({ rows, hue }) => (
  <View style={s.table}>
    {rows.map((r, i) => (
      <View
        key={`${r[0]}-${i}`}
        style={[s.tRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
      >
        <Text style={[s.tLabel, { flex: 1 }]} numberOfLines={1}>
          {r[0]}
        </Text>
        <Text style={[s.tVal, s.tNum, { width: 92, color: hue }]}>
          {inr(r[1])}
        </Text>
      </View>
    ))}
  </View>
);

const Mini = ({ label, value }) => (
  <View style={s.mini}>
    <Text style={s.cellLabel}>{label.toUpperCase()}</Text>
    <Text style={s.miniVal}>{value}</Text>
  </View>
);

export default OpdApprovalSection;

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4 },
  centre: { paddingVertical: 34, alignItems: 'center' },
  empty: { padding: 16, color: T.muted, fontFamily: F.regular, fontSize: 12.5 },

  block: { marginBottom: 18 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 2,
  },
  blockLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: T.muted2,
  },
  blockTrail: { fontFamily: F.mono, fontSize: 11, color: T.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cell: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: T.subtle,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  cellSpine: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  cellLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: T.muted,
  },
  cellVal: {
    fontFamily: F.mono,
    fontSize: 18,
    marginTop: 5,
    letterSpacing: -0.4,
  },

  table: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  th: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: T.muted,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  tLabel: { fontSize: 11, color: T.text, fontFamily: F.regular },
  tVal: { flex: 1, fontFamily: F.mono, fontSize: 10.5, color: T.text },
  tNum: { textAlign: 'right' },
  tBold: { fontWeight: '600' },
  tZero: { color: T.chevron },

  pairRow: { flexDirection: 'row', gap: 7 },
  mini: {
    flex: 1,
    backgroundColor: T.subtle,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  miniVal: {
    fontFamily: F.mono,
    fontSize: 18,
    color: T.text,
    marginTop: 5,
    letterSpacing: -0.4,
  },
});
