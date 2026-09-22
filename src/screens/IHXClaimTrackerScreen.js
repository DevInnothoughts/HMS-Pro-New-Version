/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IHXClaimTrackerScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// IHX claim tracker, rebuilt in the Inpatient section's language. Same endpoint
// (/IPDCollection/ihxData), same ten filters, same search, same timeline.
//
// THE STATUS MASTER IS IMPORTED, NOT COPIED
// ─────────────────────────────────────────
// STATUS_MASTER maps ~50 official IHX status IDs to their insurer stage,
// hospital stage and type. It is the one piece of real domain knowledge in this
// feature and it came from IHX's own document. It stays in
// src/admin/IHXPatientTracker.jsx and is imported here — a second copy would
// drift the first time IHX adds a status, and the drift would be invisible
// until a claim silently showed as "unknown".
//
// parseIHXData / latestEvent / resolveStatus come from the same place for the
// same reason: IHXData is a JSON string of events whose shape this app does not
// control.
//
// COLOURS ARE NEW, SEMANTICS ARE NOT
// ──────────────────────────────────
// TYPE_CFG's palette belongs to the old screen. TYPE_STYLE below re-skins the
// same nine types to the section palette, but `progress` is still read from
// TYPE_CFG — how far through the claim journey a status sits is domain
// knowledge, not styling.
//
// WHAT CHANGED
// ────────────
// The list was a 22px bold title with six tiny stat columns crammed into a
// 140px block beside it, then cards with a mini progress bar. Now: section
// header, three stat cards, scrolling filter chips carrying their own counts,
// and rows whose spine is the claim's status colour.
//
// The detail screen keeps the hero, the amount strip and the full event
// timeline — the timeline is the reason this screen exists.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import {
  TYPE_CFG,
  latestEvent,
  parseIHXData,
  resolveStatus,
} from '../admin/IHXPatientTracker';
import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, inr, num } from '../design/tokens';
import { useScopeRange } from '../scope/useScopeRange';

const HUE_I = HUE.ipd;

// Same nine types, section palette. `progress` still comes from TYPE_CFG.
const TYPE_STYLE = {
  initiated: { color: '#6E5AA8', soft: '#F0EDF7', label: 'Initiated' },
  processing: { color: '#2F6FA8', soft: '#EAF1F8', label: 'Processing' },
  approved: { color: '#4A6B2F', soft: '#F0F4EB', label: 'Approved' },
  query: { color: '#B26A00', soft: '#FBF0DD', label: 'Query' },
  replied: { color: '#B3762B', soft: '#FBF3E6', label: 'Query replied' },
  denied: { color: '#B3382B', soft: '#F8E6E3', label: 'Denied' },
  reconsider: { color: '#3E8C8C', soft: '#E9F3F3', label: 'Reconsider' },
  settled: { color: '#1E7A5A', soft: '#E7F2EC', label: 'Settled' },
  cancelled: { color: '#8A968F', soft: '#F1F4F2', label: 'Cancelled' },
  unknown: { color: '#8A968F', soft: '#F1F4F2', label: 'Unknown' },
};

const styleFor = type => TYPE_STYLE[type] || TYPE_STYLE.unknown;
const progressFor = type => (TYPE_CFG[type] || TYPE_CFG.unknown)?.progress ?? 0;

// The ten filters from the old screen, unchanged and in the same order.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'processing', label: 'Processing' },
  { key: 'approved', label: 'Approved' },
  { key: 'query', label: 'Query' },
  { key: 'replied', label: 'Query Replied' },
  { key: 'denied', label: 'Denied' },
  { key: 'reconsider', label: 'Reconsider' },
  { key: 'settled', label: 'Settled' },
  { key: 'cancelled', label: 'Cancelled' },
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

// parseIHXData already sorts ascending on `timestamp`, so that is the field.
const fmtEventDate = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
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
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()} · ${h}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} ${ap}`;
};

// IHX sends single-word placeholders in `remarks` that are not messages —
// "IR", "ANS", "bill". The old screen filtered these and so does this one;
// showing them as remarks makes every event look like it has a comment.
const NOISE = new Set([
  'in progress',
  'in_progress',
  'ir',
  'ans',
  'bill',
  'final bill',
  'initial',
  'letter',
]);

const realRemark = e => {
  const raw = String(e?.remarks || '').trim();
  if (!raw || NOISE.has(raw.toLowerCase())) return null;
  return raw;
};

const typeOf = patient => {
  const last = latestEvent(parseIHXData(patient.IHXData));
  if (!last) return null;
  return resolveStatus(last.statusId, last.statusName).type;
};

/* ── Screen ───────────────────────────────────────────────────────────────── */

const IHXClaimTrackerScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);

  const location = route?.params?.location || reduxLocation;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/IPDCollection/ihxData', { location, from, to });
        setData(Array.isArray(res) ? res : []);
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

  // Back closes the detail view before leaving the screen — the old version
  // used local state for the detail, so hardware back skipped straight out.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (selected) {
          setSelected(null);
          return true;
        }
        navigation.goBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [selected, navigation]),
  );

  // Type resolved once per patient, then reused by the counts and the filter.
  // The old screen re-parsed IHXData inside both.
  const typed = useMemo(
    () => data.map(p => ({ ...p, _type: typeOf(p) })),
    [data],
  );

  const counts = useMemo(() => {
    const c = { all: typed.length, pending: 0 };
    FILTERS.forEach(f => f.key !== 'all' && (c[f.key] = 0));
    for (const p of typed) {
      if (!p._type) continue;
      if (c[p._type] !== undefined) c[p._type]++;
      // "Pending" in the old header stat = anything still moving.
      if (
        ['initiated', 'processing', 'replied', 'reconsider'].includes(p._type)
      ) {
        c.pending++;
      }
    }
    return c;
  }, [typed]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return typed.filter(p => {
      if (filter !== 'all' && p._type !== filter) return false;
      if (!q) return true;
      return (
        String(p.name || '')
          .toLowerCase()
          .includes(q) ||
        String(p.invoice_id || '').includes(q) ||
        String(p.phone || '').includes(q)
      );
    });
  }, [typed, filter, query]);

  if (selected) {
    return <ClaimDetail patient={selected} onBack={() => setSelected(null)} />;
  }

  const header = (
    <View>
      <SectionHeader
        code="IPD"
        name="IHX Claim Tracker"
        sub="Cashless claims and their current stage"
        hue={HUE_I}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, st.statRowFirst]}>
          <Stat
            label="Claims"
            value={num(counts.all)}
            note="in this period"
            color={T.text}
          />
          <Stat
            label="In progress"
            value={num(counts.pending)}
            note="awaiting insurer"
            color="#2F6FA8"
          />
          <Stat
            label="Settled"
            value={num(counts.settled)}
            note={`${num(counts.denied)} denied`}
            color="#1E7A5A"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {FILTERS.map(f => {
            const on = filter === f.key;
            const c = f.key === 'all' ? HUE_I : styleFor(f.key).color;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[st.chip, on && { backgroundColor: c, borderColor: c }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${f.label}, ${counts[f.key] ?? 0}`}
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {f.label}
                </Text>
                <Text style={[st.chipCount, on && st.chipOnText]}>
                  {counts[f.key] ?? 0}
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
            placeholder="Patient, invoice or phone"
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

        {list.length !== typed.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(typed.length)} claims
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        keyExtractor={(p, i) => `${p.invoice_id || 'x'}-${i}`}
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
            <Text style={st.empty}>
              {error || 'No claims match this view.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <ClaimRow p={item} onPress={() => setSelected(item)} />
        )}
      />
    </SafeAreaView>
  );
};

/* ── List row ─────────────────────────────────────────────────────────────── */

const ClaimRow = ({ p, onPress }) => {
  const events = parseIHXData(p.IHXData);
  const last = latestEvent(events);
  const meta = last ? resolveStatus(last.statusId, last.statusName) : null;
  const s = styleFor(meta?.type);
  const progress = progressFor(meta?.type);

  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${meta?.name || 'no status'}, ${
        events.length
      } updates`}
    >
      <View style={[st.rowSpine, { backgroundColor: s.color }]} />

      <View style={st.rowHead}>
        <View style={[st.avatar, { backgroundColor: s.soft }]}>
          <Text style={[st.avatarText, { color: s.color }]}>
            {initials(p.name)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>
            {p.name || 'Unnamed'}
          </Text>
          <Text style={st.meta} numberOfLines={1}>
            #{p.invoice_id}
            {p.phone ? ` · ${p.phone}` : ''}
            {last?.claimNumber ? ` · ${last.claimNumber}` : ''}
          </Text>
        </View>

        <Icon name="chevron-right" size={18} color={T.chevron} />
      </View>

      <View style={st.statusRow}>
        <View style={[st.badge, { backgroundColor: s.soft }]}>
          <View style={[st.badgeDot, { backgroundColor: s.color }]} />
          <Text style={[st.badgeText, { color: s.color }]} numberOfLines={1}>
            {meta?.name || 'No status recorded'}
          </Text>
        </View>
        <Text style={st.updates}>
          {events.length} update{events.length === 1 ? '' : 's'}
        </Text>
      </View>

      {/* Journey progress — how far through the claim this status sits. The
          percentage is domain knowledge from TYPE_CFG, not a visual choice. */}
      <View style={st.track}>
        <View
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: s.color,
          }}
        />
      </View>

      <View style={st.figures}>
        <Figure label="BILLED" value={inr(p.totalamt)} />
        <Figure
          label="APPROVED"
          value={last?.approvedAmount != null ? inr(last.approvedAmount) : '—'}
          color={last?.approvedAmount ? '#1E7A5A' : undefined}
        />
        <Figure
          label="PAYABLE"
          value={inr(p.payable_amt)}
          muted={!n0(p.payable_amt)}
        />
      </View>
    </TouchableOpacity>
  );
};

/* ── Detail ───────────────────────────────────────────────────────────────── */

const ClaimDetail = ({ patient, onBack }) => {
  // Newest first — the current position is what people open this for; the
  // history reads downward from there.
  const events = useMemo(() => parseIHXData(patient.IHXData) || [], [patient]);

  const last = latestEvent(parseIHXData(patient.IHXData));
  const meta = last ? resolveStatus(last.statusId, last.statusName) : null;
  const s = styleFor(meta?.type);

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionHeader
          code="CLAIM"
          name={patient.name || 'Patient'}
          sub={
            last?.claimNumber
              ? `Claim ${last.claimNumber}`
              : `Invoice #${patient.invoice_id}`
          }
          hue={s.color}
          hideScope
          onBack={onBack}
        />

        <View style={st.detailStats}>
          <Stat
            label="Billed"
            value={inr(patient.totalamt)}
            note="total invoice"
            color={T.text}
          />
          <Stat
            label="Approved"
            value={
              last?.approvedAmount != null ? inr(last.approvedAmount) : '—'
            }
            note="by insurer"
            color="#1E7A5A"
          />
          <Stat
            label="Payable"
            value={inr(patient.payable_amt)}
            note="outstanding"
            color={T.text}
          />
        </View>

        <View style={st.body}>
          <View
            style={[
              st.statusCard,
              { backgroundColor: s.soft, borderColor: s.color },
            ]}
          >
            <View style={[st.badgeDot, { backgroundColor: s.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[st.statusName, { color: s.color }]}>
                {meta?.name || 'No status recorded'}
              </Text>
              {!!meta && (
                <Text style={st.statusStage}>
                  {meta.insurerStage} · {meta.hospitalStage}
                </Text>
              )}
            </View>
          </View>

          <View style={st.card}>
            <Fact label="Invoice" value={`#${patient.invoice_id}`} />
            <Fact label="Phone" value={patient.phone} />
            <Fact label="Sex" value={patient.sex} last />
          </View>

          <Text style={st.blockLabel}>TIMELINE</Text>

          {events.length === 0 ? (
            <Text style={st.emptyInline}>
              No events recorded for this claim.
            </Text>
          ) : (
            <View style={st.timeline}>
              {events.map((e, i) => {
                const m = resolveStatus(e.statusId, e.statusName);
                const es = styleFor(m.type);
                const isLast = i === events.length - 1;
                return (
                  <View key={`${e.statusId}-${i}`} style={st.event}>
                    <View style={st.eventRail}>
                      <View
                        style={[st.eventDot, { backgroundColor: es.color }]}
                      />
                      {/* The connector stops at the last event so the line
                          doesn't dangle past the end of the history. */}
                      {!isLast && <View style={st.eventLine} />}
                    </View>

                    <View
                      style={[st.eventBody, isLast && { paddingBottom: 0 }]}
                    >
                      <View style={st.eventTags}>
                        <View
                          style={[st.stageTag, { backgroundColor: es.soft }]}
                        >
                          <Text style={[st.stageTagText, { color: es.color }]}>
                            {m.hospitalStage}
                          </Text>
                        </View>
                        <View style={st.idChip}>
                          <Text style={st.idChipText}>ID {e.statusId}</Text>
                        </View>
                      </View>

                      <Text style={[st.eventName, { color: es.color }]}>
                        {m.name}
                      </Text>
                      <Text style={st.eventMeta}>
                        {fmtEventDate(e.timestamp)}
                      </Text>

                      {/* Amounts the insurer sent with this event. Each pill
                          renders only when present — a claim at pre-auth has no
                          settled amount, and a dash for it says nothing. */}
                      <View style={st.pills}>
                        {e.claimedAmount != null && (
                          <Pill label="CLAIMED" value={inr(e.claimedAmount)} />
                        )}
                        {e.approvedAmount != null && (
                          <Pill
                            label="APPROVED"
                            value={inr(e.approvedAmount)}
                            color="#1E7A5A"
                          />
                        )}
                        {e.settledAmount != null && (
                          <Pill
                            label="SETTLED"
                            value={inr(e.settledAmount)}
                            color="#1E7A5A"
                          />
                        )}
                        {!!e.utrNo && e.utrNo !== 'NA' && (
                          <Pill
                            label="UTR"
                            value={String(e.utrNo)}
                            color="#2F6FA8"
                          />
                        )}
                      </View>

                      {!!realRemark(e) && (
                        <View
                          style={[st.remark, { borderLeftColor: es.color }]}
                        >
                          <Text style={st.remarkText}>{realRemark(e)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── Bits ─────────────────────────────────────────────────────────────────── */

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
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

const Figure = ({ label, value, color, muted }) => (
  <View style={st.fig}>
    <Text style={st.figLabel}>{label}</Text>
    <Text
      style={[st.figVal, color && { color }, muted && { color: T.chevron }]}
    >
      {value}
    </Text>
  </View>
);

const Pill = ({ label, value, color }) => (
  <View style={st.pill}>
    <Text style={st.pillLabel}>{label}</Text>
    <Text style={[st.pillVal, color && { color }]}>{value}</Text>
  </View>
);

const Fact = ({ label, value, last }) => (
  <View style={[st.factRow, last && { borderBottomWidth: 0 }]}>
    <Text style={st.factLabel}>{label}</Text>
    <Text style={st.factValue} numberOfLines={1}>
      {value || '—'}
    </Text>
  </View>
);

export default IHXClaimTrackerScreen;

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
    color: T.muted,
    fontFamily: F.regular,
    fontSize: 12.5,
    marginTop: 4,
  },

  statRow: { flexDirection: 'row', gap: 9 },
  statRowFirst: { marginTop: -30 },
  detailStats: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    marginTop: -30,
  },
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
    alignItems: 'center',
  },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipCount: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    marginTop: 3,
  },
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
  meta: { fontFamily: F.mono, fontSize: 10, color: T.muted2, marginTop: 3 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { flex: 1, fontSize: 11, fontFamily: F.medium },
  updates: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2 },

  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 10,
    overflow: 'hidden',
  },

  figures: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
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

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginTop: 20,
  },
  statusName: { fontSize: 13.5, fontFamily: F.semibold },
  statusStage: {
    fontSize: 10.5,
    color: T.muted,
    marginTop: 3,
    fontFamily: F.regular,
  },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 12,
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  factLabel: { fontSize: 12, color: T.muted, fontFamily: F.regular },
  factValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12.5,
    color: T.text,
    fontFamily: F.medium,
  },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 24,
    marginBottom: 11,
    marginHorizontal: 2,
  },

  timeline: { paddingLeft: 2 },
  event: { flexDirection: 'row', gap: 12 },
  eventRail: { alignItems: 'center', width: 12 },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  eventLine: { flex: 1, width: 2, backgroundColor: T.lineSoft, marginTop: 3 },
  eventBody: { flex: 1, paddingBottom: 18 },
  eventName: { fontSize: 12.5, fontFamily: F.medium },
  eventMeta: {
    fontFamily: F.mono,
    fontSize: 10,
    color: T.muted2,
    marginTop: 3,
  },
  remark: {
    borderLeftWidth: 2,
    backgroundColor: T.card,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  remarkText: {
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 17,
  },
  eventTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  stageTag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  stageTagText: { fontFamily: F.mono, fontSize: 8, letterSpacing: 0.7 },
  idChip: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: T.lineSoft,
  },
  idChipText: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.7,
    color: T.muted2,
  },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: T.card,
  },
  pillLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: T.muted2,
  },
  pillVal: { fontFamily: F.mono, fontSize: 11, color: T.text, marginTop: 3 },
});
