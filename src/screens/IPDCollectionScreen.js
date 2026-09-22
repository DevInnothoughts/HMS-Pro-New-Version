/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IPDCollectionScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// IPD Collection. Same endpoint (/IPDCollection/v3), same merge, same totals,
// same five status filters. Replaces src/admin/IPDCollectionReport.js.
//
// ⚠️ COLLECTED INCLUDES THE INSURANCE SETTLEMENT — DO NOT SIMPLIFY THIS
// ─────────────────────────────────────────────────────────────────────
//   collected = cashamt + cardamt + chequeamt + onlineamt
//             + receivedamt + actualTDS
//
// receivedamt and actualTDS come from insurance_invoice, which
// getIPDCollectionV3 merges into ipdPayments. They are the money an insurer
// paid, and on a cashless-heavy branch they ARE most of the collection.
// Summing only the four patient-payment modes under-reports a branch by an
// order of magnitude — ₹4,05,000 becomes ₹36,000.
//
// ⚠️ THE FOUR AMOUNT COLUMNS ARE NOT NAMED WHAT THEY HOLD
// ───────────────────────────────────────────────────────
//   discountamt → INTERNAL discount     (old screen: "Internal Dscnt")
//   tdsamt      → HOSPITAL discount     (old screen: "Hospital Dscnt")
//   receivedamt → SETTLED amount        (insurance payout)
//   actualTDS   → TDS                   (deducted by the insurer)
// So the reported discount is discountamt + tdsamt, and TDS is actualTDS —
// NOT tdsamt. Labelling tdsamt as "TDS" double-counts it and loses the
// hospital discount entirely.
//
// ⚠️ BILL AND DUE COUNT ONCE PER INVOICE
// ──────────────────────────────────────
// ipdPayments has one row per receipt, so an invoice paid in three instalments
// appears three times carrying the SAME totalamt and totaldue. Those two are
// accumulated only on the first sighting of an invoice_id — the old screen's
// seenInvoices logic. Everything else sums per receipt.
//
// WHAT CHANGED (presentation only)
// ────────────────────────────────
// Stat cards instead of a dense totals block; status chips carrying their own
// collected figure; rows showing the payment split without a tap. Pagination
// removed, so search covers everything rather than the current page of ten.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, inr, num } from '../design/tokens';
import useScopeRange from '../scope/useScopeRange';

const HUE_I = HUE.ipd;

const STATUSES = [
  'Cashless',
  'NonInsurance',
  'Reimbursement',
  'PDC',
  'Charity',
];

const LABEL = {
  Cashless: 'Cashless',
  NonInsurance: 'Non-insurance',
  Reimbursement: 'Reimbursement',
  PDC: 'PDC',
  Charity: 'Charity',
  Unknown: 'Unknown',
};

const STATUS_HUE = {
  Cashless: '#B3523B',
  NonInsurance: '#2F6FA8',
  Reimbursement: '#6E5AA8',
  PDC: '#3E8C8C',
  Charity: '#4A6B2F',
  Unknown: '#8A968F',
};

const n0 = v => Number(v) || 0;

// The old screen's collected formula, verbatim. See the header note.
const collectedOf = p =>
  n0(p.cashamt) +
  n0(p.cardamt) +
  n0(p.chequeamt) +
  n0(p.onlineamt) +
  n0(p.receivedamt) +
  n0(p.actualTDS);

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
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
  return `${dt.getDate()} ${M[dt.getMonth()]}`;
};

const IPDCollectionScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);

  const location = route?.params?.location || reduxLocation;

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [billType, setBillType] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/IPDCollection/v3', { location, from, to });
        const rows = res?.ipdPayments || [];

        // The old screen's merge: status is taken from the FIRST row seen for
        // each invoice_id, and rows with no match become 'Unknown'.
        const statusOf = {};
        for (const r of rows) {
          if (r.invoice_id != null && !(r.invoice_id in statusOf)) {
            statusOf[r.invoice_id] = r.status || 'Unknown';
          }
        }
        setPayments(
          rows.map(r => ({
            ...r,
            status: statusOf[r.invoice_id] || 'Unknown',
          })),
        );
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

  /** Totals for a set of rows, following the old screen exactly. */
  const totalsFor = useCallback(rows => {
    const seen = new Set();
    const t = {
      bill: 0,
      due: 0,
      cash: 0,
      card: 0,
      cheque: 0,
      online: 0,
      internalDiscount: 0,
      hospitalDiscount: 0,
      settled: 0,
      tds: 0,
    };
    for (const r of rows) {
      // Bill and due: once per invoice.
      if (!seen.has(r.invoice_id)) {
        seen.add(r.invoice_id);
        t.bill += n0(r.totalamt);
        t.due += n0(r.totaldue);
      }
      t.cash += n0(r.cashamt);
      t.card += n0(r.cardamt);
      t.cheque += n0(r.chequeamt);
      t.online += n0(r.onlineamt);
      t.internalDiscount += n0(r.discountamt);
      t.hospitalDiscount += n0(r.tdsamt);
      t.settled += n0(r.receivedamt);
      t.tds += n0(r.actualTDS);
    }
    return {
      ...t,
      collected: t.cash + t.card + t.cheque + t.online + t.settled + t.tds,
      discount: t.internalDiscount + t.hospitalDiscount,
      invoices: seen.size,
      patients: new Set(rows.map(r => r.patient_id)).size,
      receipts: rows.length,
    };
  }, []);

  const overall = useMemo(() => totalsFor(payments), [payments, totalsFor]);

  // Per-status figures for the chips, over ALL payments so the amounts stay
  // put while a filter is active.
  const byStatus = useMemo(() => {
    const groups = {};
    for (const p of payments)
      (groups[p.status] = groups[p.status] || []).push(p);
    const keys = [
      ...STATUSES.filter(s => groups[s]),
      ...Object.keys(groups).filter(k => !STATUSES.includes(k)),
    ];
    return keys.map(k => ({ key: k, ...totalsFor(groups[k]) }));
  }, [payments, totalsFor]);

  const list = useMemo(() => {
    let out = billType ? payments.filter(p => p.status === billType) : payments;
    const q = query.trim().toLowerCase();
    if (!q) return out;
    return out.filter(p =>
      String(p.name || '')
        .toLowerCase()
        .includes(q),
    );
  }, [payments, billType, query]);

  // Stat cards follow the filtered view, as the old screen's did.
  const shown = useMemo(() => totalsFor(list), [list, totalsFor]);

  // Settled and TDS are insurance figures — the old screen showed them for
  // Cashless and for the unfiltered view only.
  const showSettlement = billType === 'Cashless' || billType === '';
  const hue = STATUS_HUE[billType] || HUE_I;

  const header = (
    <View>
      <SectionHeader
        code="IPD"
        name="IPD Collection"
        sub="Payments received against admissions"
        hue={HUE_I}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        {/* Only the first row overlaps the header. */}
        <View style={[st.statRow, st.statRowFirst]}>
          <Stat
            label="Collected"
            value={inr(shown.collected)}
            note={`${num(shown.receipts)} receipts`}
            color="#1E7A5A"
            wide
          />
          <Stat
            label="Patients"
            value={num(shown.patients)}
            note="unique"
            color={hue}
          />
        </View>

        <View style={[st.statRow, st.statRowNext]}>
          <Stat
            label="Cash"
            value={inr(shown.cash)}
            note="received"
            color={T.text}
            small
          />
          <Stat
            label="Card"
            value={inr(shown.card)}
            note="received"
            color={T.text}
            small
          />
          <Stat
            label="Online"
            value={inr(shown.online)}
            note="received"
            color={T.text}
            small
          />
        </View>

        <View style={[st.statRow, st.statRowNext]}>
          <Stat
            label="Cheque"
            value={inr(shown.cheque)}
            note="received"
            color={T.text}
            small
          />
          <Stat
            label="Internal dscnt"
            value={inr(shown.internalDiscount)}
            note="allowed"
            color="#B26A00"
            small
          />
          <Stat
            label="Hospital dscnt"
            value={inr(shown.hospitalDiscount)}
            note="allowed"
            color="#B26A00"
            small
          />
        </View>

        {showSettlement && (
          <View style={[st.statRow, st.statRowNext]}>
            <Stat
              label="Settled"
              value={inr(shown.settled)}
              note="by insurer"
              color="#1E7A5A"
              small
            />
            <Stat
              label="TDS"
              value={inr(shown.tds)}
              note="deducted"
              color={T.text}
              small
            />
            <Stat
              label="Due"
              value={inr(shown.due)}
              note={`${num(shown.invoices)} invoices`}
              color={shown.due > 0 ? T.crit : T.text}
              small
            />
          </View>
        )}

        {!showSettlement && (
          <View style={[st.statRow, st.statRowNext]}>
            <Stat
              label="Billed"
              value={inr(shown.bill)}
              note={`${num(shown.invoices)} invoices`}
              color={T.text}
              small
            />
            <Stat
              label="Due"
              value={inr(shown.due)}
              note="outstanding"
              color={shown.due > 0 ? T.crit : T.text}
              small
            />
            <View style={st.stat} />
          </View>
        )}

        <Text style={st.blockLabel}>PATIENT TYPE</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          <TouchableOpacity
            onPress={() => setBillType('')}
            style={[
              st.chip,
              !billType && { backgroundColor: HUE_I, borderColor: HUE_I },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: !billType }}
          >
            <Text style={[st.chipLabel, !billType && st.chipOnText]}>All</Text>
            <Text style={[st.chipVal, !billType && st.chipOnText]}>
              {inr(overall.collected)}
            </Text>
          </TouchableOpacity>

          {byStatus.map(s => {
            const on = billType === s.key;
            const c = STATUS_HUE[s.key] || T.muted2;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => setBillType(on ? '' : s.key)}
                style={[st.chip, on && { backgroundColor: c, borderColor: c }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${LABEL[s.key] || s.key}, ${inr(
                  s.collected,
                )} collected`}
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {LABEL[s.key] || s.key}
                </Text>
                <Text style={[st.chipVal, on && st.chipOnText]}>
                  {inr(s.collected)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Patient name"
            placeholderTextColor={T.muted2}
            style={st.search}
          />
          {!!query && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
            >
              <Icon name="close" size={17} color={T.muted2} />
            </TouchableOpacity>
          )}
        </View>

        {list.length !== payments.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(payments.length)} receipts
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        keyExtractor={(p, i) =>
          `${p.invoice_id || 'x'}-${p.receipt_date || ''}-${i}`
        }
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={HUE_I}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={HUE_I} />
            </View>
          ) : (
            <Text style={st.empty}>{error || 'No receipts in this view.'}</Text>
          )
        }
        renderItem={({ item }) => <Row p={item} showType={!billType} />}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide, small }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text
      style={[st.statVal, small && { fontSize: 15 }, { color }]}
      numberOfLines={1}
    >
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

const Figure = ({ label, value, muted, alert, good }) => (
  <View style={st.fig}>
    <Text style={st.figLabel}>{label}</Text>
    <Text
      style={[
        st.figVal,
        muted && { color: T.chevron },
        alert && { color: T.crit },
        good && { color: '#1E7A5A' },
      ]}
    >
      {value}
    </Text>
  </View>
);

const Row = ({ p, showType }) => {
  const hue = STATUS_HUE[p.status] || T.muted2;
  const collected = collectedOf(p);
  const due = n0(p.totaldue);
  const settled = n0(p.receivedamt);
  const tds = n0(p.actualTDS);
  const internal = n0(p.discountamt);
  const hospital = n0(p.tdsamt);

  return (
    <View style={st.row}>
      <View style={[st.rowSpine, { backgroundColor: hue }]} />

      <View style={st.rowHead}>
        <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
          <Text style={[st.avatarText, { color: hue }]}>
            {initials(p.name)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>
            {p.name || 'Unnamed'}
          </Text>
          <Text style={st.meta} numberOfLines={1}>
            {fmtDate(p.receipt_date)}
            {p.invoice_id ? ` · #${p.invoice_id}` : ''}
            {showType && p.status ? ` · ${LABEL[p.status] || p.status}` : ''}
          </Text>
        </View>
        <View style={st.collectedCol}>
          <Text style={st.collected}>{inr(collected)}</Text>
          <Text style={st.collectedLabel}>COLLECTED</Text>
        </View>
      </View>

      {/* Payment split, always visible. Zero modes are greyed rather than
          hidden so the columns stay aligned down the list. */}
      <View style={st.figures}>
        <Figure label="CASH" value={inr(p.cashamt)} muted={!n0(p.cashamt)} />
        <Figure label="CARD" value={inr(p.cardamt)} muted={!n0(p.cardamt)} />
        <Figure
          label="ONLINE"
          value={inr(p.onlineamt)}
          muted={!n0(p.onlineamt)}
        />
        <Figure
          label="CHEQUE"
          value={inr(p.chequeamt)}
          muted={!n0(p.chequeamt)}
        />
      </View>

      {/* The insurance line only appears when there is a settlement — most
          non-cashless rows would otherwise carry two zeros. */}
      {(settled > 0 || tds > 0) && (
        <View style={[st.figures, st.figuresSecond]}>
          <Figure label="SETTLED" value={inr(settled)} good />
          <Figure label="TDS" value={inr(tds)} muted={!tds} />
          <Figure label="BILLED" value={inr(p.totalamt)} />
          <Figure label="DUE" value={inr(due)} alert={due > 0} muted={!due} />
        </View>
      )}

      {settled === 0 &&
        tds === 0 &&
        (internal > 0 || hospital > 0 || due > 0) && (
          <View style={[st.figures, st.figuresSecond]}>
            <Figure label="BILLED" value={inr(p.totalamt)} />
            <Figure label="INT DSCNT" value={inr(internal)} muted={!internal} />
            <Figure
              label="HOSP DSCNT"
              value={inr(hospital)}
              muted={!hospital}
            />
            <Figure label="DUE" value={inr(due)} alert={due > 0} muted={!due} />
          </View>
        )}
    </View>
  );
};

export default IPDCollectionScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  body: { paddingHorizontal: 16 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    fontFamily: F.regular,
    fontSize: 13,
  },

  statRow: { flexDirection: 'row', gap: 9 },
  statRowFirst: { marginTop: -30 },
  statRowNext: { marginTop: 9 },
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
    fontSize: 19,
    marginTop: 7,
    letterSpacing: -0.5,
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
    marginTop: 22,
    marginHorizontal: 2,
  },

  chips: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 11,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipVal: { fontFamily: F.mono, fontSize: 11.5, color: T.text, marginTop: 3 },
  chipOnText: { color: '#fff' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },
  showing: { fontSize: 10, color: T.muted2, marginTop: 10, fontFamily: F.mono },

  row: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 9,
    overflow: 'hidden',
  },
  rowSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 12 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },
  collectedCol: { alignItems: 'flex-end' },
  collected: {
    fontFamily: F.mono,
    fontSize: 14,
    color: '#1E7A5A',
    letterSpacing: -0.3,
  },
  collectedLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
    marginTop: 3,
  },

  figures: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  figuresSecond: { marginTop: 10, paddingTop: 10 },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  figVal: {
    fontFamily: F.mono,
    fontSize: 12,
    color: T.text,
    marginTop: 4,
    letterSpacing: -0.2,
  },
});
