/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/DailyOPDReportScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// The day-close report. Same endpoint (/DailyOPD/v1), same numbers, nothing
// added or removed.
//
// WHAT CHANGED
// ────────────
// The old screen was six react-native-table-component tables stacked down the
// page, each with its own header row and border grid. Four of them —
// OPD, Lab, Pharmacy, Overall — had the IDENTICAL four rows: Cash, Card,
// Online, Total. Reading "what did we collect by card today" meant finding the
// same row in four places and adding it up mentally.
//
// Those four are now ONE matrix: modes down the side, sections across the top.
// The comparison the report exists for is a glance instead of an assembly job.
//
// The patient-flow row becomes cards, because five numbers and a total is not
// a table — it is five numbers and a total.
//
// The attendance breakdown stays a grid: it is genuinely 6 × 5 and there is no
// honest way to make it smaller. It gets a sticky label column and right-
// aligned mono figures instead of centred proportional ones.
//
// ⚠️ ROW LABELS TO VERIFY
// ───────────────────────
// detailedData arrives as six unlabelled arrays; the labels live only in the
// old screen's <Col data={[...]}>. FLOW_ROWS below is my reading of the model's
// variable names (newDNCount, newDNPCount, newDNWCount, cancel*, walkIN*,
// *RegiCount). Check them against the old screen before shipping — the order is
// certainly right, the wording may not be.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, inr, num } from '../design/tokens';

const HUE_O = HUE.opd;

// dailyOPDReport: [new, follow, po, proctoscopy, mcdpa, total]
const VISIT_COLS = [
  { label: 'New', hue: '#2F6FA8' },
  { label: 'Follow-up', hue: '#3E8C8C' },
  { label: 'Post-op', hue: '#7A5EA8' },
  { label: 'C+P', hue: '#B3762B' },
  { label: 'MCDPA', hue: '#A8567F' },
];

// Row labels, verbatim from the old screen's <Col data={[...]}>. These are the
// words the branch has read for years — the abbreviations are the vocabulary,
// so they stay as they are rather than being expanded into guesses.
const FLOW_ROWS = ['DNC', 'DNP', 'DNW', 'DNT', 'WALK-IN', 'ONLY REGISTRATION'];

// Column headers, also verbatim.
const FLOW_COLS = ['New', 'Follow UP', 'PO', 'MCDPA', 'TOTAL'];

const MODES = ['Cash', 'Card', 'Online', 'Total'];

// [['Cash', n], ...] → { Cash: n, ... }
const pairsToMap = pairs => {
  const out = {};
  for (const p of pairs || [])
    if (Array.isArray(p)) out[p[0]] = Number(p[1]) || 0;
  return out;
};

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const M = [
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
  return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`;
};

const toYmd = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const DailyOPDReportScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const scope = useSelector(s => s.scope);

  const location = route?.params?.location || reduxLocation;
  const [date, setDate] = useState(route?.params?.fromDate || scope.from);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(await get('/DailyOPD/v1', { location, date }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, date],
  );

  useEffect(() => {
    load();
  }, [load]);

  const visits = data?.dailyOPDReport?.[0] || [];
  const visitTotal = visits[5];

  // The four collection tables, transposed into one matrix.
  const collection = useMemo(() => {
    if (!data) return null;
    const cols = [
      { key: 'opd', label: 'OPD', map: pairsToMap(data.opdCollection) },
      { key: 'lab', label: 'Lab', map: pairsToMap(data.labCollection) },
      {
        key: 'pharmacy',
        label: 'Pharmacy',
        map: pairsToMap(data.pharmacyCollection),
      },
      { key: 'all', label: 'All', map: pairsToMap(data.overallCollection) },
    ];
    return cols;
  }, [data]);

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={HUE_O}
          />
        }
      >
        <SectionHeader
          code="OPD"
          name="Daily OPD Report"
          sub="Day-close summary for the branch"
          hue={HUE_O}
          hideScope
          onBack={() => navigation.goBack()}
        />

        {/* The report is for ONE day, so it carries its own date control
            rather than the range chip the rest of the section uses. */}
        <View style={st.dateWrap}>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            style={st.dateBtn}
            accessibilityRole="button"
            accessibilityLabel={`Report date ${fmtDate(date)}. Change date`}
          >
            <Icon name="event" size={17} color={HUE_O} />
            <Text style={st.dateText}>{fmtDate(date)}</Text>
            <Icon name="expand-more" size={18} color={HUE_O} />
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={st.centre}>
            <ActivityIndicator color={HUE_O} />
          </View>
        ) : error ? (
          <Text style={st.empty}>{error}</Text>
        ) : (
          <View style={st.body}>
            {/* ── Patients seen ── */}
            <Block
              label="Patients seen"
              trail={visitTotal != null ? `${num(visitTotal)} total` : null}
            >
              <View style={st.grid}>
                {VISIT_COLS.map((c, i) => (
                  <View key={c.label} style={st.cell}>
                    <View style={[st.cellSpine, { backgroundColor: c.hue }]} />
                    <Text style={st.cellLabel}>{c.label.toUpperCase()}</Text>
                    <Text style={[st.cellVal, { color: c.hue }]}>
                      {num(visits[i] ?? 0)}
                    </Text>
                  </View>
                ))}
              </View>
            </Block>

            {/* ── Collection matrix — four old tables in one ── */}
            <Block label="Collection">
              <View style={st.table}>
                <View style={st.tHead}>
                  <Text style={[st.th, { flex: 1 }]}>MODE</Text>
                  {collection.map(c => (
                    <Text key={c.key} style={[st.th, st.tNum]}>
                      {c.label.toUpperCase()}
                    </Text>
                  ))}
                </View>
                {MODES.map((m, i) => {
                  const isTotal = m === 'Total';
                  return (
                    <View
                      key={m}
                      style={[
                        st.tRow,
                        isTotal && st.tRowTotal,
                        i === MODES.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <Text
                        style={[st.tLabel, isTotal && st.tBold, { flex: 1 }]}
                      >
                        {m}
                      </Text>
                      {collection.map(c => (
                        <Text
                          key={c.key}
                          style={[st.tVal, st.tNum, isTotal && st.tBold]}
                          numberOfLines={1}
                        >
                          {inr(c.map[m] || 0)}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            </Block>

            {/* ── Attendance breakdown — genuinely 6×5, kept as a grid ── */}
            <Block label="Patient flow">
              <View style={st.table}>
                <View style={st.tHead}>
                  <Text style={[st.th, { flex: 1.2 }]} />
                  {FLOW_COLS.map(c => (
                    <Text key={c} style={[st.th, st.tNum]}>
                      {c.toUpperCase()}
                    </Text>
                  ))}
                </View>
                {(data.detailedData || []).map((row, ri) => (
                  <View
                    key={FLOW_ROWS[ri] || ri}
                    style={[
                      st.tRow,
                      ri === data.detailedData.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <Text style={[st.tLabel, { flex: 1.2 }]} numberOfLines={2}>
                      {FLOW_ROWS[ri] || `Row ${ri + 1}`}
                    </Text>
                    {row.map((v, ci) => (
                      <Text
                        key={ci}
                        style={[
                          st.tVal,
                          st.tNum,
                          ci === row.length - 1 && st.tBold,
                          // A zero is noise in a 30-cell grid; muting it lets
                          // the real numbers carry the eye.
                          Number(v) === 0 && st.tZero,
                        ]}
                      >
                        {num(v ?? 0)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </Block>

            {/* ── Consultation-wise ── */}
            {!!data.opdReport?.length && (
              <Block label="OPD consultations">
                <AmountList rows={data.opdReport} hue={HUE_O} />
              </Block>
            )}

            {!!data.testReport?.length && (
              <Block label="Lab tests">
                <AmountList rows={data.testReport} hue="#6E5AA8" />
              </Block>
            )}

            {/* ── Records completed ── */}
            <Block label="Records completed">
              <View style={st.pairRow}>
                <Mini label="Diagnosis" value={num(data.diagnosisCount ?? 0)} />
                <Mini
                  label="Prescriptions"
                  value={num(data.prescriptionCount ?? 0)}
                />
              </View>
            </Block>
          </View>
        )}
      </ScrollView>

      <DatePicker
        modal
        mode="date"
        open={pickerOpen}
        date={new Date(`${date}T00:00:00`)}
        maximumDate={new Date()}
        onConfirm={d => {
          setPickerOpen(false);
          setDate(toYmd(d));
        }}
        onCancel={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
};

const Block = ({ label, trail, children }) => (
  <View style={st.block}>
    <View style={st.blockHead}>
      <Text style={st.blockLabel}>{label.toUpperCase()}</Text>
      {!!trail && <Text style={st.blockTrail}>{trail}</Text>}
    </View>
    {children}
  </View>
);

const AmountList = ({ rows, hue }) => {
  const total = rows.reduce((a, r) => a + (Number(r[1]) || 0), 0);
  return (
    <View style={st.table}>
      {rows.map((r, i) => (
        <View
          key={r[0]}
          style={[st.tRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
        >
          <Text style={[st.tLabel, { flex: 1 }]} numberOfLines={1}>
            {r[0]}
          </Text>
          <Text style={[st.tVal, st.tNum, { width: 92, color: hue }]}>
            {inr(r[1])}
          </Text>
        </View>
      ))}
      <View style={[st.tRow, st.tRowTotal, { borderBottomWidth: 0 }]}>
        <Text style={[st.tLabel, st.tBold, { flex: 1 }]}>Total</Text>
        <Text style={[st.tVal, st.tNum, st.tBold, { width: 92 }]}>
          {inr(total)}
        </Text>
      </View>
    </View>
  );
};

const Mini = ({ label, value }) => (
  <View style={st.mini}>
    <Text style={st.cellLabel}>{label.toUpperCase()}</Text>
    <Text style={st.miniVal}>{value}</Text>
  </View>
);

export default DailyOPDReportScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  body: { paddingHorizontal: 16 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 40,
    fontFamily: F.regular,
    fontSize: 13,
  },

  dateWrap: { paddingHorizontal: 16, marginTop: -30, marginBottom: 20 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  dateText: { fontFamily: F.mono, fontSize: 12.5, color: T.text },

  block: { marginBottom: 22 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 9,
    marginHorizontal: 2,
  },
  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
  },
  blockTrail: { fontFamily: F.mono, fontSize: 11, color: T.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },
  cellSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  cellLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: T.muted,
  },
  cellVal: {
    fontFamily: F.mono,
    fontSize: 20,
    marginTop: 6,
    letterSpacing: -0.4,
  },

  table: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
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
  th: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  tRowTotal: { backgroundColor: T.subtle },
  tLabel: { fontSize: 11.5, color: T.text, fontFamily: F.regular },
  tVal: { flex: 1, fontFamily: F.mono, fontSize: 11, color: T.text },
  tNum: { textAlign: 'right' },
  tBold: { fontWeight: '600' },
  tZero: { color: T.chevron },

  pairRow: { flexDirection: 'row', gap: 9 },
  mini: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  miniVal: {
    fontFamily: F.mono,
    fontSize: 20,
    color: T.text,
    marginTop: 6,
    letterSpacing: -0.4,
  },
});
