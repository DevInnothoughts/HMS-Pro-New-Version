/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/OPDIPDCollectionScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// OPD + IPD collection, day by day. Replaces src/admin/OPDIPDCollection.js.
// Same endpoint, same figures, same matrix.
//
//   GET /OPDCollection/getTotal?location=&from=&to=
//        → { transformedData, overallCollection }
//
// ⚠️ NOT /OPDCollection — that returns flat receipt rows and this screen would
// show an empty list with nothing to explain why. The guard in load() catches
// that case explicitly rather than letting it look like a quiet day.
//
// THE PAYLOAD IS POSITIONAL, NOT NAMED
// ────────────────────────────────────
//   overallCollection  [[ipd, opd] × 5]  rows: Cash, Card, Online, Discount, Total
//   transformedData    [dateKey, [ipdRow, opdRow, totalRow]]
//                      each row: [cash, card, online, discount]
//
// Nothing in the payload says which index is which — the meaning lived only in
// the old screen's <Col data={[...]}> labels. The destructuring below carries
// that knowledge explicitly so the next person does not have to infer it from
// a table layout.
//
// ⚠️ DISCOUNT IS IPD-ONLY, AND IPD's TOTAL IS NET OF IT
// ─────────────────────────────────────────────────────
// opdCollectionModel hardcodes OPD discount to 0 and computes
//     ipd total = cash + card + online − discount
//     opd total = cash + card + online
// So the two columns are not the same kind of number, and adding the mode rows
// will not reproduce the IPD total. Discount is shown as a DEDUCTION rather
// than a fourth payment mode, which is what it is.
//
// WHAT CHANGED
// ────────────
// Every day was a react-native-table-component grid with its own header row
// inside a bordered Card, ten per page behind two arrow buttons. Thirty days
// meant thirty repetitions of "Cash Card Online Dscnt".
//
// Now the day card leads with what was collected that day and the matrix sits
// beneath with ONE header. Pagination is gone — FlatList recycles — and the
// period summary that was hidden behind a modal button is on the page, because
// it is the first thing anyone opens this screen for.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { useScopeRange } from '../scope/useScopeRange';
import { F, T, inr, num } from '../design/tokens';

// V2 adds cheque. V1 stays for OPDIPDApproval, whose fixed-width tables cannot
// take a fifth column.
const ENDPOINT = '/OPDCollection/getTotalV2';

// IPD rust and OPD blue — the same hues those sections use, so a column reads
// the same here as on its own screen.
const IPD = '#B3523B';
const OPD = '#2F6FA8';

const n0 = v => Number(v) || 0;

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
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtDay = d => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
};

const OPDIPDCollectionScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [days, setDays] = useState([]);
  const [overall, setOverall] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get(ENDPOINT, { location, from, to });

        // This screen needs the MERGED day-wise shape. Other /OPDCollection
        // versions return a flat array of receipt rows, and reading
        // .transformedData off one of those gives undefined — an empty list
        // with nothing to say why. Fail loudly instead.
        if (!res || !Array.isArray(res.transformedData)) {
          throw new Error(
            'This endpoint returned receipt rows, not the day-wise summary.',
          );
        }

        // Newest first — the most recent day is the one people check.
        setDays(
          [...res.transformedData].sort((a, b) =>
            String(b[0]).localeCompare(String(a[0])),
          ),
        );
        setOverall(res.overallCollection || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  // overallCollection[i] = [ipd, opd], rows in this order:
  //   0 Cash · 1 Card · 2 Online · 3 Discount · 4 Total
  const summary = useMemo(() => {
    const at = i => ({
      ipd: n0(overall?.[i]?.[0]),
      opd: n0(overall?.[i]?.[1]),
    });
    // Cash, Card, Online, Cheque, Discount, Total — positional, see the model.
    const total = at(5);
    return {
      cash: at(0),
      card: at(1),
      online: at(2),
      cheque: at(3),
      discount: at(4),
      total,
      grand: total.ipd + total.opd,
    };
  }, [overall]);

  const header = (
    <View>
      <SectionHeader
        code="REPORTS"
        name="OPD + IPD Collection"
        sub="Day-wise collection across both departments"
        hue={T.brand}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, { marginTop: -30 }]}>
          <Stat
            label="Collected"
            value={inr(summary.grand)}
            note={`${num(days.length)} day${days.length === 1 ? '' : 's'}`}
            color={T.text}
            wide
          />
          <Stat
            label="IPD"
            value={inr(summary.total.ipd)}
            note="net of discount"
            color={IPD}
          />
          <Stat
            label="OPD"
            value={inr(summary.total.opd)}
            note="collected"
            color={OPD}
          />
        </View>

        <Text style={st.blockLabel}>PERIOD TOTAL</Text>

        <View style={st.table}>
          <View style={st.tHead}>
            <Text style={[st.th, { flex: 1 }]}>MODE</Text>
            <Text style={[st.th, st.tNum, { color: IPD }]}>IPD</Text>
            <Text style={[st.th, st.tNum, { color: OPD }]}>OPD</Text>
            <Text style={[st.th, st.tNum]}>TOTAL</Text>
          </View>

          <SummaryRow
            label="Cash"
            ipd={summary.cash.ipd}
            opd={summary.cash.opd}
          />
          <SummaryRow
            label="Card"
            ipd={summary.card.ipd}
            opd={summary.card.opd}
          />
          <SummaryRow
            label="Online"
            ipd={summary.online.ipd}
            opd={summary.online.opd}
          />

          <SummaryRow
            label="Cheque"
            ipd={summary.cheque.ipd}
            opd={summary.cheque.opd}
          />

          {/* A deduction, not a payment mode — shown negative so the column
              arithmetic reads correctly. OPD discount is always 0 in the model,
              so only the IPD figure is real. */}
          <SummaryRow
            label="Discount"
            ipd={-summary.discount.ipd}
            opd={0}
            muted
          />

          <View style={[st.tRow, st.tRowTotal]}>
            <Text style={[st.tLabel, st.tBold, { flex: 1 }]}>Total</Text>
            <Text style={[st.tVal, st.tNum, st.tBold]}>
              {inr(summary.total.ipd)}
            </Text>
            <Text style={[st.tVal, st.tNum, st.tBold]}>
              {inr(summary.total.opd)}
            </Text>
            <Text style={[st.tVal, st.tNum, st.tBold]}>
              {inr(summary.grand)}
            </Text>
          </View>
        </View>

        {summary.discount.ipd > 0 && (
          <Text style={st.note}>
            The IPD total is net of {inr(summary.discount.ipd)} discount. OPD
            carries no discount figure in this report.
          </Text>
        )}

        <Text style={st.blockLabel}>DAY BY DAY</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : days}
        keyExtractor={(d, i) => `${d[0]}-${i}`}
        ListHeaderComponent={header}
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
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
            </View>
          ) : (
            <Text style={st.empty}>
              {error || 'No collection for this period.'}
            </Text>
          )
        }
        renderItem={({ item }) => <DayCard date={item[0]} rows={item[1]} />}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide }) => (
  <View style={[st.stat, wide && { flex: 1.4 }]}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

const SummaryRow = ({ label, ipd, opd, muted }) => (
  <View style={st.tRow}>
    <Text style={[st.tLabel, { flex: 1 }]}>{label}</Text>
    <Text style={[st.tVal, st.tNum, muted && st.tMuted]}>{inr(ipd)}</Text>
    <Text style={[st.tVal, st.tNum, (muted || !opd) && st.tMuted]}>
      {inr(opd)}
    </Text>
    <Text style={[st.tVal, st.tNum, muted && st.tMuted]}>{inr(ipd + opd)}</Text>
  </View>
);

/**
 * One day.
 *
 * `rows` is [ipdRow, opdRow, totalRow], each [cash, card, online, discount].
 * The headline is the total row's cash + card + online LESS its discount,
 * matching how the period total is computed — so the days sum to it.
 */
const DayCard = ({ date, rows }) => {
  const [ipdRow = [], opdRow = [], totalRow = []] = rows || [];

  const dayTotal =
    n0(totalRow[0]) +
    n0(totalRow[1]) +
    n0(totalRow[2]) +
    n0(totalRow[3]) -
    n0(totalRow[4]);

  const line = (label, r, color) => (
    <View style={st.dRow}>
      <Text style={[st.dLabel, color && { color }]}>{label}</Text>
      <Text style={st.dVal}>{inr(r[0])}</Text>
      <Text style={st.dVal}>{inr(r[1])}</Text>
      <Text style={st.dVal}>{inr(r[2])}</Text>
      <Text style={[st.dVal, !n0(r[3]) && st.tMuted]}>{inr(r[3])}</Text>
      <Text style={[st.dVal, !n0(r[4]) && st.tMuted]}>{inr(r[4])}</Text>
    </View>
  );

  return (
    <View style={st.day}>
      <View style={st.dayHead}>
        <Text style={st.dayDate}>{fmtDay(date)}</Text>
        <Text style={st.dayTotal}>{inr(dayTotal)}</Text>
      </View>

      {/* One header per day, not one per table — the old layout repeated
          "Cash Card Online Dscnt" on every card. */}
      <View style={st.dHead}>
        <Text style={[st.dLabel, st.dHeadText]} />
        <Text style={[st.dVal, st.dHeadText]}>CASH</Text>
        <Text style={[st.dVal, st.dHeadText]}>CARD</Text>
        <Text style={[st.dVal, st.dHeadText]}>ONLINE</Text>
        <Text style={[st.dVal, st.dHeadText]}>CHEQUE</Text>
        <Text style={[st.dVal, st.dHeadText]}>DSCNT</Text>
      </View>

      {line('IPD', ipdRow, IPD)}
      {line('OPD', opdRow, OPD)}
      <View style={st.dDivider} />
      {line('Total', totalRow)}
    </View>
  );
};

export default OPDIPDCollectionScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  body: { paddingHorizontal: 16 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    marginHorizontal: 28,
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 19,
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
    marginTop: 7,
    letterSpacing: -0.4,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 24,
    marginBottom: 9,
    marginHorizontal: 2,
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
    paddingHorizontal: 13,
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
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  tRowTotal: { backgroundColor: T.subtle, borderBottomWidth: 0 },
  tLabel: { fontSize: 12, color: T.text, fontFamily: F.regular },
  tVal: { flex: 1, fontFamily: F.mono, fontSize: 11.5, color: T.text },
  tNum: { textAlign: 'right' },
  tBold: { fontWeight: '600' },
  tMuted: { color: T.chevron },

  note: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 10,
    fontFamily: F.regular,
    lineHeight: 14,
  },

  day: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 9,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayDate: { fontSize: 13, fontFamily: F.medium, color: T.text },
  dayTotal: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.3,
  },

  dHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  dHeadText: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: T.muted2,
  },
  dRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  dLabel: {
    width: 42,
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: T.muted,
  },
  dVal: {
    flex: 1,
    textAlign: 'right',
    fontFamily: F.mono,
    fontSize: 11,
    color: T.text,
  },
  dDivider: { height: 1, backgroundColor: T.lineSoft, marginVertical: 2 },
});
