/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/PharmacyBillingScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Pharmacy Billing — the counter invoice list. Replaces
// src/admin/EvitalPharmacyData.js. Same endpoint, same rows, same totals.
//
// ⚠️ CONFIRM THE ENDPOINT PATH
// ────────────────────────────
// ENDPOINT below is my reading of the route (the analysis screen calls
// /pharmacyCollection/prescription-analysis/quantity/v1, and the collection
// models are getPharmacyCollectionV1 / V2). Copy the exact string from
// EvitalPharmacyData.js's fetch before shipping — if it is wrong the screen
// shows an empty list with an error, not a crash, which is easy to miss.
//
// WHAT CHANGED
// ────────────
// The old screen paged ten at a time with two image buttons, and each card
// stacked labelled lines. Now: FlatList, so search covers every invoice rather
// than the current page; the bill total is the anchor on the right; and the
// itemised medicines open in place rather than being absent.
//
// THE PAYLOAD IS A JSON BLOB PER ROW
// ──────────────────────────────────
// Everything the card shows — patient, mobile, bill number, total, mode,
// medicines — lives inside invoice_details. It is parsed here, defensively: a
// malformed blob drops that one row rather than taking the list down.
//
// PAYMENT MODE PREFERS UpdatedInvoiceDetails
// ──────────────────────────────────────────
// A bill raised as "Credit" and later settled in cash and UPI carries the truth
// only in UpdatedInvoiceDetails.transaction_summary. The card shows the settled
// modes when they exist and the billed mode otherwise, with split payments
// listed rather than collapsed to one label — the same precedence the
// collection model applies.
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
import { useScopeRange } from '../scope/useScopeRange';
import { F, HUE, T, inr, num } from '../design/tokens';

// ⚠️ See the header note — verify against EvitalPharmacyData.js.
const ENDPOINT = '/pharmacyCollection/v2';

const HUE_P = HUE.pharmacy;

const MODE_COLORS = {
  Cash: '#1E7A5A',
  Card: '#3E8C8C',
  UPI: '#2F6FA8',
  Online: '#2F6FA8',
  Other: '#B3762B',
};

const n0 = v => Number(v) || 0;

const safeParse = raw => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch (_) {
    return null;
  }
};

// Verbatim from the collection model, so the chips agree with the totals.
const normalizeMode = (mode = '') => {
  switch (mode) {
    case 'CC/DC':
    case 'Credit':
      return 'Card';
    case 'UPI':
    case 'Online':
      return 'Online';
    case 'Cash':
      return 'Cash';
    default:
      return 'Other';
  }
};

const fmtDateTime = v => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
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
  const h = d.getHours() % 12 || 12;
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${d.getDate()} ${M[d.getMonth()]} · ${h}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} ${ap}`;
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

/** Flatten one database row into everything the card needs. */
const shape = row => {
  const inv = safeParse(row.invoice_details);
  if (!inv) return null;

  const updated = safeParse(row.UpdatedInvoiceDetails);
  const txns = updated?.transaction_summary?.transactions ?? [];
  const summary = updated?.transaction_summary;

  // Settled modes win over the billed mode — see the header.
  const modes = txns.length
    ? txns.map(t => ({ mode: normalizeMode(t.method), amount: n0(t.amount) }))
    : [{ mode: normalizeMode(inv.payment_mode), amount: n0(inv.total) }];

  const ward = String(inv.hms_admission_details?.hms_ward_name || '').trim();

  return {
    id: String(row.id),
    // The database column, not the JSON — both exist, and the column is what
    // the collection model counts patients by. Null on walk-in sales.
    patientId: row.patient_id ?? null,
    billNo: inv.bill_no ?? inv.reference_number ?? null,
    orderNumber: inv.order_number || '',
    billDate: inv.bill_date,
    name: inv.patient_name || inv.billing_for || '',
    mobile: inv.mobile || inv.billing_for_mobile || '',
    doctor: inv.doctor_name || '',
    total: Math.round(n0(inv.total)),
    billedMode: inv.payment_mode || '',
    modes,
    primaryMode: modes[0]?.mode || 'Other',
    split: txns.length > 1,
    due: summary ? Math.round(n0(summary.current_due_amount)) : 0,
    settled: summary ? !!summary.is_fully_settled : null,
    ward,
    items: (inv.items || []).map(i => ({
      name: i.medicine_name || 'Unnamed',
      qty: n0(i.quantity),
      amount: n0(i.total ?? i.amount ?? i.net_amount ?? 0),
    })),
  };
};

const PharmacyBillingScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [rows, setRows] = useState([]);
  const [modeTotals, setModeTotals] = useState(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get(ENDPOINT, { location, from, to });
        setRows((res?.invoices || []).map(shape).filter(Boolean));
        setModeTotals(res?.paymentModeTotals || null);
        setGrandTotal(n0(res?.grandTotal));
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

  const list = useMemo(() => {
    let out = mode
      ? rows.filter(r => r.modes.some(m => m.mode === mode))
      : rows;
    const q = query.trim().toLowerCase();
    if (!q) return out;
    const qd = q.replace(/\D/g, '');
    return out.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.doctor.toLowerCase().includes(q) ||
        String(r.billNo || '').includes(q) ||
        // Only match on mobile when the query has digits — an empty digit
        // string matches every row and makes the search a no-op.
        (!!qd && r.mobile.replace(/\D/g, '').includes(qd)),
    );
  }, [rows, mode, query]);

  const shown = useMemo(() => list.reduce((a, r) => a + r.total, 0), [list]);

  const modeCards = useMemo(() => {
    if (!modeTotals) return [];
    return ['Cash', 'Card', 'UPI', 'Online', 'Other']
      .filter(k => n0(modeTotals[k]) > 0)
      .map(k => ({ key: k, label: k, amount: n0(modeTotals[k]) }));
  }, [modeTotals]);

  // Average per patient, over the rows that HAVE a patient. Walk-in buyers
  // often carry no patient record, so dividing the whole period's revenue by
  // the identified patients would attribute anonymous sales to them and
  // overstate the figure. Numerator and denominator use the same subset.
  const perPatient = useMemo(() => {
    const identified = rows.filter(r => r.patientId != null);
    const patients = new Set(identified.map(r => r.patientId)).size;
    const amount = identified.reduce((a, r) => a + r.total, 0);
    return {
      patients,
      avg: patients > 0 ? Math.round(amount / patients) : null,
      anonymous: rows.length - identified.length,
    };
  }, [rows]);

  const header = (
    <View>
      <SectionHeader
        code="PHARMACY"
        name="Pharmacy Billing"
        sub="Counter invoices and payment settlement"
        hue={HUE_P}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, st.statRowFirst]}>
          <Stat
            label="Billed"
            value={inr(mode || query ? shown : grandTotal)}
            note={`${num(list.length)} invoices`}
            color={T.text}
            wide
          />
          <Stat
            label="Avg / patient"
            value={perPatient.avg == null ? '—' : inr(perPatient.avg)}
            note={
              perPatient.anonymous > 0
                ? `${num(perPatient.patients)} pt · ${num(
                    perPatient.anonymous,
                  )} walk-in`
                : `${num(perPatient.patients)} patients`
            }
            color={HUE_P}
          />
        </View>

        {modeCards.length > 0 && (
          <>
            <Text style={st.blockLabel}>PAYMENT MODE</Text>
            {/* Tapping a card filters; tapping the active one clears. The
                amounts are the backend's totals for the whole period, so they
                do not move as the list narrows. */}
            <View style={st.modeGrid}>
              {modeCards.map(m => {
                const on = mode === m.key;
                const c = MODE_COLORS[m.key] || T.muted2;
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMode(on ? '' : m.key)}
                    style={[
                      st.modeCard,
                      on && { borderColor: c, borderWidth: 1.5 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${m.label}, ${inr(m.amount)}`}
                  >
                    <View style={[st.modeSpine, { backgroundColor: c }]} />
                    <Text style={st.modeLabel}>{m.label.toUpperCase()}</Text>
                    <Text style={[st.modeVal, { color: c }]} numberOfLines={1}>
                      {inr(m.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Patient, mobile, bill no. or doctor"
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

        {list.length !== rows.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(rows.length)} invoices ·{' '}
            {inr(shown)}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        keyExtractor={r => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={HUE_P}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={HUE_P} />
            </View>
          ) : (
            <Text style={st.empty}>{error || 'No invoices in this view.'}</Text>
          )
        }
        renderItem={({ item }) => (
          <Row
            r={item}
            open={openId === item.id}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
          />
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

const Tag = ({ label, color }) => (
  <View style={[st.tag, { borderColor: color }]}>
    <Text style={[st.tagText, { color }]}>{label}</Text>
  </View>
);

const Row = ({ r, open, onToggle }) => {
  const hue = MODE_COLORS[r.primaryMode] || T.muted2;
  const hasItems = r.items.length > 0;

  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={hasItems ? 0.8 : 1}
      onPress={hasItems ? onToggle : undefined}
      disabled={!hasItems}
      accessibilityRole={hasItems ? 'button' : 'text'}
      accessibilityLabel={`${r.name}, ${inr(r.total)}, ${r.items.length} items`}
    >
      <View
        style={[st.rowSpine, { backgroundColor: r.due > 0 ? T.crit : hue }]}
      />

      <View style={st.rowHead}>
        <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
          <Text style={[st.avatarText, { color: hue }]}>
            {initials(r.name)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>
            {r.name || 'Unnamed'}
          </Text>
          <Text style={st.mobile}>{r.mobile || 'No number'}</Text>
          <Text style={st.meta} numberOfLines={1}>
            {r.billNo ? `Bill ${r.billNo} · ` : ''}
            {fmtDateTime(r.billDate)}
          </Text>
        </View>

        <View style={st.amountCol}>
          <Text style={st.amount}>{inr(r.total)}</Text>
          {hasItems && (
            <View style={st.itemsHint}>
              <Text style={st.itemsCount}>{r.items.length}</Text>
              <Icon
                name={open ? 'expand-less' : 'expand-more'}
                size={15}
                color={T.chevron}
              />
            </View>
          )}
        </View>
      </View>

      <View style={st.tagRow}>
        {/* Split payments are listed rather than collapsed to one label — the
            whole point of the settlement record is that one bill can be paid
            two ways. */}
        {r.modes.map((m, i) => (
          <Tag
            key={`${m.mode}-${i}`}
            label={r.split ? `${m.mode} ${inr(m.amount)}` : m.mode}
            color={MODE_COLORS[m.mode] || T.muted2}
          />
        ))}
        {!!r.ward && <Tag label={r.ward} color="#6E5AA8" />}
        {r.due > 0 && <Tag label={`Due ${inr(r.due)}`} color={T.crit} />}
        {!!r.doctor && <Tag label={r.doctor} color={T.muted2} />}
      </View>

      {open && hasItems && (
        <View style={st.items}>
          {r.items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={st.item}>
              <Text style={st.itemQty}>{it.qty}×</Text>
              <Text style={st.itemName} numberOfLines={1}>
                {it.name}
              </Text>
              <Text style={st.itemAmt}>{inr(it.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default PharmacyBillingScreen;

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
  stat: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 20,
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
    marginTop: 20,
    marginBottom: 9,
    marginHorizontal: 2,
  },

  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },
  modeCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  modeSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  modeLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: T.muted,
  },
  modeVal: {
    fontFamily: F.mono,
    fontSize: 17,
    marginTop: 6,
    letterSpacing: -0.4,
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
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
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
  mobile: { fontFamily: F.mono, fontSize: 11, color: T.text, marginTop: 3 },
  meta: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2, marginTop: 3 },

  amountCol: { alignItems: 'flex-end' },
  amount: {
    fontFamily: F.mono,
    fontSize: 15,
    color: T.text,
    letterSpacing: -0.3,
  },
  itemsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  itemsCount: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2 },

  tagRow: { flexDirection: 'row', gap: 5, marginTop: 9, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.6 },

  items: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 5,
  },
  itemQty: { fontFamily: F.mono, fontSize: 10.5, color: T.muted2, width: 26 },
  itemName: { flex: 1, fontSize: 12, color: T.text, fontFamily: F.regular },
  itemAmt: { fontFamily: F.mono, fontSize: 11.5, color: T.text },
});
