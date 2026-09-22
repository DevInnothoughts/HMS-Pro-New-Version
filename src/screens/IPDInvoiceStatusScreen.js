/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IPDInvoiceStatusScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// One invoice status, patient by patient. Same endpoint
// (/IPDCollection/billsV3 with a status), same sub-filters, same totals.
//
// FILTERS, ALL CARRIED OVER
// ─────────────────────────
//   All · Collection (collection ≠ 0) · Discount (discount set and ≠ 0)
//   Due (totaldue ≠ 0)
// and for Cashless only, the two the old screen added:
//   Settled (receivedamt ≠ 0) · TDS (actualTDS ≠ 0)
//
// The discount and due comparisons are loose on purpose — `!= '0'` rather than
// `!== 0` — because those columns come back as strings on some rows and numbers
// on others. A strict check would silently drop half the rows. The old screen
// used loose equality here and was right to.
//
// The invoice card itself lives in design/components/IPDInvoiceRow, shared with
// IPDInvoiceScreen. Both render the identical card; two copies would drift the
// first time a figure is added.
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
import IPDInvoiceRow from '../design/components/IPDInvoiceRow';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, inr, num } from '../design/tokens';
import useScopeRange from '../scope/useScopeRange';

const HUE_I = HUE.ipd;

const STATUS_HUE = {
  Cashless: '#B3523B',
  NonInsurance: '#2F6FA8',
  Reimbursement: '#6E5AA8',
  PDC: '#3E8C8C',
  Charity: '#4A6B2F',
};

const LABEL = {
  Cashless: 'Cashless',
  NonInsurance: 'Non-insurance',
  Reimbursement: 'Reimbursement',
  PDC: 'PDC',
  Charity: 'Charity',
};

const n0 = v => Number(v) || 0;

const IPDInvoiceStatusScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);

  const location = route?.params?.location || reduxLocation;
  const billType = route?.params?.billType || '';

  const hue = STATUS_HUE[billType] || HUE_I;
  const isCashless = billType === 'Cashless';

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sub, setSub] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/IPDCollection/billsV4', {
          location,
          from,
          to,
          status: billType,
        });
        setBills(res?.ipdBills || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, from, to, billType],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Totals cover every invoice of this status, not the filtered view — the
  // chips show what each sub-filter is worth, so they must not move when one
  // is selected.
  const totals = useMemo(() => {
    const t = {
      amount: 0,
      discount: 0,
      payable: 0,
      due: 0,
      collection: 0,
      received: 0,
      tds: 0,
    };
    const gender = { male: 0, female: 0 };
    for (const b of bills) {
      t.amount += n0(b.totalamt);
      t.discount += n0(b.discount);
      t.payable += n0(b.payable_amt);
      t.due += n0(b.totaldue);
      t.collection += n0(b.collection);
      t.received += n0(b.receivedamt);
      t.tds += n0(b.actualTDS);
      if (b.sex === 'Male') gender.male++;
      else if (b.sex === 'Female') gender.female++;
    }
    return {
      ...t,
      gender,
      patients: new Set(bills.map(b => b.patient_id)).size,
    };
  }, [bills]);

  const list = useMemo(() => {
    let out = bills;
    if (sub === 'Collection') out = out.filter(i => n0(i.collection) !== 0);
    else if (sub === 'Discount')
      out = out.filter(i => i.discount != '0' && i.discount != null);
    else if (sub === 'Due') out = out.filter(i => i.totaldue != '0');
    else if (sub === 'Settled') out = out.filter(i => n0(i.receivedamt) !== 0);
    else if (sub === 'TDS') out = out.filter(i => n0(i.actualTDS) !== 0);

    const q = query.trim().toLowerCase();
    if (!q) return out;
    return out.filter(
      i =>
        String(i.name || '')
          .toLowerCase()
          .includes(q) || String(i.phone || '').includes(q),
    );
  }, [bills, sub, query]);

  const chips = [
    { key: '', label: 'All', v: totals.amount },
    { key: 'Collection', label: 'Collection', v: totals.collection },
    { key: 'Discount', label: 'Discount', v: totals.discount },
    { key: 'Due', label: 'Due', v: totals.due },
    ...(isCashless
      ? [
          { key: 'Settled', label: 'Settled', v: totals.received },
          { key: 'TDS', label: 'TDS', v: totals.tds },
        ]
      : []),
  ];

  const header = (
    <View>
      <SectionHeader
        code="IPD"
        name={LABEL[billType] || billType || 'IPD Invoices'}
        sub="Invoice-wise billing and collection"
        hue={hue}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Billed"
            value={inr(totals.amount)}
            note={`${num(bills.length)} invoices`}
            color={T.text}
            wide
          />
          <Stat
            label="Patients"
            value={num(totals.patients)}
            note={`${totals.gender.male}M · ${totals.gender.female}F`}
            color={hue}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {chips.map(c => {
            const on = sub === c.key;
            return (
              <TouchableOpacity
                key={c.key || 'all'}
                // Tapping the active chip clears it, except All — which is the
                // cleared state already.
                onPress={() => setSub(on && c.key ? '' : c.key)}
                style={[
                  st.chip,
                  on && { backgroundColor: hue, borderColor: hue },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.label}, ${inr(c.v)}`}
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {c.label}
                </Text>
                <Text style={[st.chipVal, on && st.chipOnText]}>
                  {inr(c.v)}
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
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={hue}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={hue} />
            </View>
          ) : (
            <Text style={st.empty}>{error || 'No invoices in this view.'}</Text>
          )
        }
        renderItem={({ item }) => (
          <IPDInvoiceRow b={item} hue={hue} cashless={isCashless} />
        )}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote}>{note}</Text>
  </View>
);

export default IPDInvoiceStatusScreen;

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

  statRow: { flexDirection: 'row', gap: 9, marginTop: -30 },
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

  chips: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 12,
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
});
