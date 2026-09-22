/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IPDInvoiceScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// IPD Invoice — status overview plus the full invoice list. Same endpoint
// (/IPDCollection/billsV3 with an empty status), same five categories, same
// totals, same patient list the old screen showed.
//
// WHAT CHANGED
// ────────────
// The old screen laid the five statuses out in two ragged rows of three and
// two — Charity/Cashless/PDC above, Reimbursement/NonInsurance below. Nothing
// distinguishes those groups; the split was a layout accident. They are now one
// list sorted largest-first with share bars, because "which patient type
// carries the money" is the question this screen answers.
//
// Patient counts per status are new. The rows were already on the client and
// the old screen used only the money.
//
// The invoice list below is unfiltered, so it can run to hundreds of rows on a
// month range. It gets its own search box — without one the sub-pages would be
// the only way to find a patient.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import IPDInvoiceRow from '../design/components/IPDInvoiceRow';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, inr, num } from '../design/tokens';
import useScopeRange from '../scope/useScopeRange';

const HUE_I = HUE.ipd;

// The five invoice.status values, in the business's own order. Anything else
// the column contains is appended rather than dropped — an unknown status is a
// data question, and hiding it stops the question being asked.
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
};

const STATUS_HUE = {
  Cashless: '#B3523B',
  NonInsurance: '#2F6FA8',
  Reimbursement: '#6E5AA8',
  PDC: '#3E8C8C',
  Charity: '#4A6B2F',
};

const n0 = v => Number(v) || 0;

const IPDInvoiceScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);

  const location = route?.params?.location || reduxLocation;

  const [bills, setBills] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/IPDCollection/billsV4', {
          location,
          from,
          to,
          status: '',
        });
        setBills(res?.ipdBills || []);
        setTotals(res?.statusWiseTotals || []);
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

  // Totals cover every invoice, not the search result — the cards describe the
  // period, and a summary that shrank as you typed would be unreadable.
  const summary = useMemo(() => {
    let amount = 0;
    let discount = 0;
    let due = 0;
    for (const b of bills) {
      amount += n0(b.totalamt);
      discount += n0(b.discount);
      due += n0(b.totaldue);
    }
    const patients = new Set(bills.map(b => b.patient_id)).size;
    return {
      amount,
      discount,
      due,
      patients,
      invoices: bills.length,
      avg: patients > 0 ? Math.round(amount / patients) : 0,
    };
  }, [bills]);

  const rows = useMemo(() => {
    const patientsBy = {};
    for (const b of bills) {
      const s = b.status || 'Unspecified';
      (patientsBy[s] = patientsBy[s] || new Set()).add(b.patient_id);
    }

    const seen = new Set();
    const out = [];

    const push = status => {
      if (seen.has(status)) return;
      seen.add(status);
      const match = totals.find(t => t.status === status);
      out.push({
        key: status,
        label: LABEL[status] || status,
        amount: n0(match?.total_amount),
        patients: patientsBy[status]?.size || 0,
        hue: STATUS_HUE[status] || T.muted2,
      });
    };

    STATUSES.forEach(push);
    totals.forEach(t => t.status && push(t.status));

    return out
      .filter(r => r.amount > 0 || r.patients > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [bills, totals]);

  const max = Math.max(...rows.map(r => r.amount), 1);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(
      b =>
        String(b.name || '')
          .toLowerCase()
          .includes(q) || String(b.phone || '').includes(q),
    );
  }, [bills, query]);

  const header = (
    <View>
      <SectionHeader
        code="IPD"
        name="IPD Invoice"
        sub="Billing by patient type"
        hue={HUE_I}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        {/* Only the FIRST row overlaps the header. Putting the -30 on the
            shared style pulled the second row up underneath it. */}
        <View style={[st.statRow, st.statRowFirst]}>
          <Stat
            label="Billed"
            value={inr(summary.amount)}
            note={`${num(summary.invoices)} invoices`}
            color={T.text}
            wide
          />
          <Stat
            label="Patients"
            value={num(summary.patients)}
            note="unique"
            color={HUE_I}
          />
        </View>

        <View style={[st.statRow, st.statRowNext]}>
          <Stat
            label="Avg bill"
            value={inr(summary.avg)}
            note="per patient"
            color={T.text}
            small
          />
          <Stat
            label="Discount"
            value={inr(summary.discount)}
            note="allowed"
            color="#B26A00"
            small
          />
          <Stat
            label="Due"
            value={inr(summary.due)}
            note="outstanding"
            color={summary.due > 0 ? T.crit : T.text}
            small
          />
        </View>

        <Text style={st.blockLabel}>PATIENT TYPE</Text>

        <View style={st.typeList}>
          {rows.map((r, i) => (
            <TouchableOpacity
              key={r.key}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('IPDBillSubCategoryDetails', {
                  location,
                  fromDate: from,
                  toDate: to,
                  billType: r.key,
                })
              }
              style={[
                st.typeRow,
                i === rows.length - 1 && { borderBottomWidth: 0 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}, ${inr(r.amount)}, ${
                r.patients
              } patients`}
            >
              <View style={st.typeTop}>
                <View style={[st.dot, { backgroundColor: r.hue }]} />
                <Text style={st.typeName}>{r.label}</Text>
                <Text style={st.typeAmt}>{inr(r.amount)}</Text>
                <Icon name="chevron-right" size={18} color={T.chevron} />
              </View>

              <View style={st.trackRow}>
                {/* Bars scale to the LARGEST type, not the total — they exist
                    to compare five rows with each other. */}
                <View style={st.track}>
                  <View
                    style={{
                      width: `${Math.max((r.amount / max) * 100, 1.5)}%`,
                      height: '100%',
                      borderRadius: 2,
                      backgroundColor: r.hue,
                    }}
                  />
                </View>
                <Text style={st.typeSub}>
                  {num(r.patients)} pt ·{' '}
                  {summary.amount > 0
                    ? Math.round((r.amount / summary.amount) * 100)
                    : 0}
                  %
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {!rows.length && !loading && (
            <Text style={st.emptyInline}>No invoices in this period.</Text>
          )}
        </View>

        <Text style={st.blockLabel}>ALL INVOICES</Text>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Patient name or phone"
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

        {list.length !== bills.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(bills.length)} invoices
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        keyExtractor={(b, i) => `${b.invoice_id || b.patient_id || 'x'}-${i}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 36 }}
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
            <Text style={st.empty}>
              {error || 'No invoices match this search.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <IPDInvoiceRow
            b={item}
            hue={STATUS_HUE[item.status] || HUE_I}
            cashless={item.status === 'Cashless'}
            // The list mixes statuses, so each row says which one it is —
            // spine colour alone is not enough to tell them apart.
            showType
          />
        )}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide, small }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel}>{label.toUpperCase()}</Text>
    {/* Three currency cards in one row leave ~105px each, so the second row
        drops a couple of points to keep ₹12,45,600 on one line. */}
    <Text
      style={[st.statVal, small && { fontSize: 16 }, { color }]}
      numberOfLines={1}
    >
      {value}
    </Text>
    <Text style={st.statNote}>{note}</Text>
  </View>
);

export default IPDInvoiceScreen;

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
  emptyInline: {
    padding: 16,
    color: T.muted,
    fontFamily: F.regular,
    fontSize: 12.5,
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
    paddingHorizontal: 11,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 19,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9.5,
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

  typeList: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  typeRow: {
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  typeTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  typeName: { flex: 1, fontSize: 13, fontFamily: F.medium, color: T.text },
  typeAmt: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.text,
    letterSpacing: -0.2,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 9,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    overflow: 'hidden',
  },
  typeSub: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    width: 78,
    textAlign: 'right',
  },

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
});
