/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IPDDueListScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Outstanding IPD dues, bucketed by invoice age. Replaces src/admin/IPDDueList.js.
// Same two endpoints, same six status values, same reconciliation check.
//
//   /IPDCollection/statuswiseDueList → { '>90 days': { patients, totalDue }, … }
//   /IPDCollection/ipdTotalSummary   → invoice / collection / due / discount
//
// NO DATE RANGE, SO NO SCOPE CHIP
// ───────────────────────────────
// Both models hard-code `creation_date >= '2025-04-01'` — this is a
// financial-year-to-date view and neither endpoint accepts from/to. Rendering
// the period selector would imply a filter that does nothing, so the header
// hides it and the subtitle says what the window actually is.
//
// THE RECONCILIATION CHECK IS THE POINT
// ─────────────────────────────────────
// The old screen's summary box compares invoice − collection against due and
// banners green or red. That is the most valuable thing on the screen: it says
// whether the branch's ledger adds up. It has been kept and moved to the TOP,
// where it is read before the list rather than after scrolling past it.
//
// WHAT CHANGED
// ────────────
// Buckets were four full-width coloured bars, each hiding its patients behind a
// tap, with a 100-row cap and no way past it. Now: four compact summary cards
// showing where the money is, then one scrolling list per bucket with no cap
// and a search box. Worst-aged first, because that is the collection queue.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
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

const HUE_I = HUE.ipd;

// Worst first — this is a collection queue, not a chronology.
const BUCKETS = ['>90 days', '>60 days', '>30 days', '<30 days'];

// The old screen's bucket colours, kept: red, orange, yellow, green.
const BUCKET_HUE = {
  '>90 days': '#B3382B',
  '>60 days': '#C2670E',
  '>30 days': '#B08900',
  '<30 days': '#1E7A5A',
};

const BUCKET_LABEL = {
  '>90 days': 'Over 90 days',
  '>60 days': '61 – 90 days',
  '>30 days': '31 – 60 days',
  '<30 days': 'Under 30 days',
};

// The dropdown's six values, unchanged.
const STATUSES = [
  { label: 'All', value: '' },
  { label: 'Cashless', value: 'Cashless' },
  { label: 'Non-insurance', value: 'NonInsurance' },
  { label: 'Reimbursement', value: 'Reimbursement' },
  { label: 'PDC', value: 'PDC' },
  { label: 'Charity', value: 'Charity' },
];

const n0 = v => Number(v) || 0;

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
  return `${dt.getDate()} ${M[dt.getMonth()]} ${String(dt.getFullYear()).slice(
    2,
  )}`;
};

const daysSince = d => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
};

const IPDDueListScreen = ({ navigation }) => {
  const location = useSelector(s => s.location.value);

  const [grouped, setGrouped] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [openBucket, setOpenBucket] = useState('>90 days');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      // Settled independently: a failed summary must not blank the list, and a
      // failed list must not hide the reconciliation banner.
      const [g, s] = await Promise.allSettled([
        get('/IPDCollection/statuswiseDueList/v2', { location, status }),
        get('/IPDCollection/ipdTotalSummary', { location, status }),
      ]);
      if (g.status === 'fulfilled') setGrouped(g.value);
      else setError(g.reason?.message || 'Could not load the due list.');
      setSummary(s.status === 'fulfilled' ? s.value : null);
      setLoading(false);
      setRefreshing(false);
    },
    [location, status],
  );

  useEffect(() => {
    load();
  }, [load]);

  const buckets = useMemo(
    () =>
      BUCKETS.map(k => ({
        key: k,
        patients: grouped?.[k]?.patients || [],
        totalDue: n0(grouped?.[k]?.totalDue),
        hue: BUCKET_HUE[k],
      })),
    [grouped],
  );

  const grandDue = buckets.reduce((a, b) => a + b.totalDue, 0);
  const grandCount = buckets.reduce((a, b) => a + b.patients.length, 0);
  const maxDue = Math.max(...buckets.map(b => b.totalDue), 1);

  // One section, the open bucket. Only one is expanded at a time — four open
  // lists of a few hundred rows each is a scroll nobody finishes.
  const sections = useMemo(() => {
    const b = buckets.find(x => x.key === openBucket);
    if (!b) return [];
    const q = query.trim().toLowerCase();
    const data = q
      ? b.patients.filter(
          p =>
            String(p.name || '')
              .toLowerCase()
              .includes(q) || String(p.invoice_id || '').includes(q),
        )
      : b.patients;
    return [{ key: b.key, hue: b.hue, total: b.patients.length, data }];
  }, [buckets, openBucket, query]);

  // invoice − collection should equal due. When it doesn't, the ledger is out.
  const recon = useMemo(() => {
    if (!summary) return null;
    const invoice = n0(summary.total_invoice_amount);
    const collection = n0(summary.total_collection_amount);
    const due = n0(summary.total_due_amount);
    const discount = n0(summary.total_discount_amount);
    const diff = invoice - collection;
    return { invoice, collection, due, discount, diff, ok: diff === due };
  }, [summary]);

  const header = (
    <View>
      <SectionHeader
        code="IPD"
        name="IPD Due List"
        sub="Outstanding balances since 1 April 2025"
        hue={HUE_I}
        hideScope
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, st.statRowFirst]}>
          <Stat
            label="Total due"
            value={inr(grandDue)}
            note={`${num(grandCount)} invoices`}
            color={T.crit}
            wide
          />
          <Stat
            label="Over 90 days"
            value={inr(buckets[0].totalDue)}
            note={`${num(buckets[0].patients.length)} invoices`}
            color={BUCKET_HUE['>90 days']}
          />
        </View>

        {/* Reconciliation, moved to the top — it says whether the ledger adds
            up, and it was previously below the whole list. */}
        {recon && (
          <View style={[st.recon, recon.ok ? st.reconOk : st.reconBad]}>
            <View style={st.reconTop}>
              <Icon
                name={recon.ok ? 'check-circle' : 'error-outline'}
                size={17}
                color={recon.ok ? '#1E7A5A' : T.crit}
              />
              <Text
                style={[
                  st.reconTitle,
                  { color: recon.ok ? '#1E7A5A' : T.crit },
                ]}
              >
                {recon.ok
                  ? 'Billed less collected matches the due'
                  : `Ledger is out by ${inr(Math.abs(recon.diff - recon.due))}`}
              </Text>
            </View>
            <View style={st.reconGrid}>
              <ReconFig label="BILLED" value={inr(recon.invoice)} />
              <ReconFig label="COLLECTED" value={inr(recon.collection)} />
              <ReconFig label="DISCOUNT" value={inr(recon.discount)} />
              <ReconFig label="DUE" value={inr(recon.due)} />
            </View>
          </View>
        )}

        <Text style={st.blockLabel}>PATIENT TYPE</Text>
        <View style={st.chipWrap}>
          {STATUSES.map(s => {
            const on = status === s.value;
            return (
              <TouchableOpacity
                key={s.value || 'all'}
                onPress={() => setStatus(s.value)}
                style={[
                  st.chip,
                  on && { backgroundColor: HUE_I, borderColor: HUE_I },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={st.blockLabel}>AGEING</Text>
        <View style={st.buckets}>
          {buckets.map(b => {
            const on = openBucket === b.key;
            return (
              <TouchableOpacity
                key={b.key}
                onPress={() => setOpenBucket(b.key)}
                style={[
                  st.bucket,
                  on && { borderColor: b.hue, borderWidth: 1.5 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${BUCKET_LABEL[b.key]}, ${inr(
                  b.totalDue,
                )}, ${b.patients.length} invoices`}
              >
                <Text style={st.bucketLabel} numberOfLines={1}>
                  {b.key.toUpperCase()}
                </Text>
                <Text
                  style={[st.bucketVal, { color: b.hue }]}
                  numberOfLines={1}
                >
                  {inr(b.totalDue)}
                </Text>
                <Text style={st.bucketNote}>
                  {num(b.patients.length)} invoices
                </Text>
                <View style={st.track}>
                  {/* Scaled to the largest bucket — the bars compare the four
                      with each other, not with the total. */}
                  <View
                    style={{
                      width: `${Math.max((b.totalDue / maxDue) * 100, 2)}%`,
                      height: '100%',
                      borderRadius: 2,
                      backgroundColor: b.hue,
                    }}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Patient name or invoice number"
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
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <SectionList
        sections={loading ? [] : sections}
        keyExtractor={p => `${p.patient_id}-${p.invoice_id}`}
        stickySectionHeadersEnabled={false}
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
        renderSectionHeader={({ section }) => (
          <View style={st.sectionHead}>
            <View style={[st.dot, { backgroundColor: section.hue }]} />
            <Text style={st.sectionLabel}>
              {BUCKET_LABEL[section.key] || section.key}
            </Text>
            <Text style={st.sectionCount}>
              {section.data.length === section.total
                ? `${num(section.total)}`
                : `${num(section.data.length)} of ${num(section.total)}`}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={HUE_I} />
            </View>
          ) : (
            <Text style={st.empty}>{error || 'Nothing outstanding here.'}</Text>
          )
        }
        renderSectionFooter={({ section }) =>
          !section.data.length && !loading ? (
            <Text style={st.emptyInline}>
              {query ? 'No match in this bucket.' : 'Nothing outstanding here.'}
            </Text>
          ) : null
        }
        renderItem={({ item, section }) => <Row p={item} hue={section.hue} />}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
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

const ReconFig = ({ label, value }) => (
  <View style={st.reconFig}>
    <Text style={st.reconLabel}>{label}</Text>
    <Text style={st.reconVal}>{value}</Text>
  </View>
);

const Row = ({ p, hue }) => {
  const age = daysSince(p.creation_date);
  return (
    <View style={st.row}>
      <View style={[st.rowSpine, { backgroundColor: hue }]} />

      <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
        <Text style={[st.avatarText, { color: hue }]}>{initials(p.name)}</Text>
      </View>

      <View style={st.main}>
        <Text style={st.name} numberOfLines={1}>
          {p.name || 'Unnamed'}
        </Text>
        <Text style={st.meta} numberOfLines={1}>
          #{p.invoice_id} · {fmtDate(p.creation_date)}
          {age != null ? ` · ${age}d` : ''}
        </Text>
        <Text style={st.meta2} numberOfLines={1}>
          {p.status || '—'}
          {/* companyname only comes back on the statuswise endpoint, and only
              for insured invoices — shown when present rather than as a dash. */}
          {p.companyname ? ` · ${p.companyname}` : ''}
        </Text>
      </View>

      <View style={st.amountCol}>
        <Text style={[st.due, { color: hue }]}>{inr(p.totaldue)}</Text>
        <Text style={st.billed}>of {inr(p.totalamt)}</Text>
      </View>
    </View>
  );
};

export default IPDDueListScreen;

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
    marginHorizontal: 16,
    marginTop: 12,
    color: T.muted,
    fontFamily: F.regular,
    fontSize: 12.5,
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
    paddingHorizontal: 11,
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

  recon: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 12 },
  reconOk: { backgroundColor: '#EDF6F1', borderColor: '#CBE4D8' },
  reconBad: { backgroundColor: '#FBEDEB', borderColor: '#F0CFCA' },
  reconTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reconTitle: { fontSize: 12, fontFamily: F.medium, flex: 1 },
  reconGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  reconFig: { flex: 1 },
  reconLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  reconVal: { fontFamily: F.mono, fontSize: 11.5, color: T.text, marginTop: 4 },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 22,
    marginBottom: 9,
    marginHorizontal: 2,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipOnText: { color: '#fff', fontFamily: F.medium },

  buckets: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  bucket: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  bucketLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: T.muted,
  },
  bucketVal: {
    fontFamily: F.mono,
    fontSize: 17,
    marginTop: 7,
    letterSpacing: -0.4,
  },
  bucketNote: {
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 4,
    fontFamily: F.regular,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 9,
    overflow: 'hidden',
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
    marginTop: 16,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 2 },
  sectionLabel: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: T.muted,
  },
  sectionCount: { fontFamily: F.mono, fontSize: 11, color: T.text },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 11,
    paddingLeft: 13,
    paddingRight: 13,
    marginHorizontal: 16,
    marginTop: 9,
    overflow: 'hidden',
  },
  rowSpine: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 12 },
  main: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  meta: { fontFamily: F.mono, fontSize: 10, color: T.muted2, marginTop: 3 },
  meta2: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },
  amountCol: { alignItems: 'flex-end' },
  due: { fontFamily: F.mono, fontSize: 14, letterSpacing: -0.3 },
  billed: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2, marginTop: 4 },
});
