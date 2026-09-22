/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/PartnerLeadsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Sulekha + Aggregator (Hexa) leads. Replaces src/admin/PartnerLeads.js.
// Same endpoint, same filters, same actions.
//
//   GET /leadManagement/partnerLeads?location=&from=&to=
//
// ⚠️ "AGGREGATOR" IS A DISPLAY NAME
// ─────────────────────────────────
// The API returns source: 'Hexa'. The row value, the table and the model all
// stay Hexa — only the label changes, and SOURCE_LABELS is the single place it
// does. The same rename is applied in leadsModel for the summary, so the two
// surfaces agree.
//
// ⚠️ TWO THINGS ABOUT THIS DATA, FROM partnerLeadsModel's OWN HEADER
// ──────────────────────────────────────────────────────────────────
// 1. SULEKHA IS NOT BRANCH-SCOPED. sulekha_leads has no branch column — only
//    free-text city — so every branch sees every Sulekha lead. Conversion is
//    still checked against THIS branch's clinic DB, so a lead who walked into
//    another branch reads as un-converted here. Hexa is now scoped by
//    area_name. The screen says so rather than letting the counts imply
//    otherwise.
//
// 2. HEXA HAS NO STATUS COLUMN. Those rows always arrive with status = null and
//    sit in Un-attended permanently. Their Appointment / Visited / IPD state
//    comes from the clinic DB instead, so those three filters DO work — but the
//    status chips will look lopsided until a status column is added.
//
// FILTERS STACK, THEY DO NOT REPLACE
// ──────────────────────────────────
// Source, status and search apply together, as in the old screen — so
// "Aggregator + Un-attended" is one tap, not a new chip.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { F, HUE, T, num } from '../design/tokens';

const HUE_L = HUE.leads;

// Every partner keeps its own name — Sulekha, Hexa, and Medibuddy when it
// lands. "Aggregator" is the CATEGORY, used in the screen title and in the
// home summary; it is not a name for any one of them.
//
// A new partner needs a line here and a colour below, nothing else.
const SOURCE_LABELS = { Sulekha: 'Sulekha', Hexa: 'Hexa' };
const SOURCE_COLORS = { Sulekha: '#6C4AB6', Hexa: '#2A7F8C' };

const STATUSES = {
  Enquiry: { label: 'Enquiry', color: '#B26A00', icon: 'record-voice-over' },
  Appointment: {
    label: 'Appointment',
    color: '#1E7A5A',
    icon: 'event-available',
  },
};
const UNATTENDED = {
  label: 'Un-attended',
  color: '#B3382B',
  icon: 'fiber-new',
};

const statusMeta = s => (s ? STATUSES[s] || UNATTENDED : UNATTENDED);

const digits = p => String(p || '').replace(/\D/g, '');

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

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} · ${
    dt.getHours() % 12 || 12
  }:${String(dt.getMinutes()).padStart(2, '0')} ${
    dt.getHours() >= 12 ? 'PM' : 'AM'
  }`;
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const PartnerLeadsScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  // Preselected when the home funnel or the section card navigates here, so
  // the list matches the row that was tapped.
  const [source, setSource] = useState(route?.params?.sourceFilter || 'All');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(
          await get('/leadManagement/partnerLeads', { location, from, to }),
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

  const rows = data?.leads || [];

  const counts = useMemo(
    () => ({
      all: data?.totalLeads ?? rows.length,
      appointment: data?.appointmentCount ?? 0,
      visited: data?.actualVisitCount ?? 0,
      ipd: data?.ipdCount ?? 0,
      enquiry: rows.filter(r => r.status === 'Enquiry').length,
      unattended: rows.filter(r => !r.status).length,
      Sulekha: data?.sourceCounts?.sulekha ?? 0,
      Hexa: data?.sourceCounts?.hexa ?? 0,
    }),
    [data, rows],
  );

  const list = useMemo(() => {
    let out = rows;

    if (source !== 'All') out = out.filter(r => r.source === source);

    // The old screen's exact predicates, unchanged. Note Appointment accepts
    // EITHER the status column or a confirmed clinic visit — Hexa has no status
    // column, so the visit is its only route into this bucket.
    if (status === 'Appointment') {
      out = out.filter(r => r.status === 'Appointment' || r.visited);
    } else if (status === 'Visited') out = out.filter(r => r.visited);
    else if (status === 'IPD') out = out.filter(r => r.ipd);
    else if (status === 'Enquiry')
      out = out.filter(r => r.status === 'Enquiry');
    else if (status === 'Unattended') out = out.filter(r => !r.status);

    const q = query.trim().toLowerCase();
    if (!q) return out;
    const qd = digits(q);
    return out.filter(
      r =>
        String(r.name || '')
          .toLowerCase()
          .includes(q) ||
        (!!qd && digits(r.phoneno).includes(qd)) ||
        String(r.city || '')
          .toLowerCase()
          .includes(q) ||
        String(r.procedure_name || '')
          .toLowerCase()
          .includes(q) ||
        String(r.medical_condition || '')
          .toLowerCase()
          .includes(q),
    );
  }, [rows, source, status, query]);

  const call = phone => {
    const d = digits(phone);
    if (!d) return Alert.alert('No number', 'This lead has no phone number.');
    Linking.openURL(`tel:${d}`);
  };

  const whatsapp = phone => {
    const d = digits(phone);
    if (!d) return Alert.alert('No number', 'This lead has no phone number.');
    const withCode = d.length === 10 ? `91${d}` : d;
    Linking.openURL(`whatsapp://send?phone=${withCode}`).catch(() =>
      Alert.alert(
        'WhatsApp unavailable',
        'WhatsApp does not appear to be installed.',
      ),
    );
  };

  const header = (
    <View>
      <SectionHeader
        code="LEADS"
        name="Aggregator Leads"
        sub="Enquiries from Sulekha, Hexa and other partners"
        hue={HUE_L}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Leads"
            value={num(counts.all)}
            note="in this period"
            color={T.text}
          />
          <Stat
            label="Appointments"
            value={num(counts.appointment)}
            note={
              counts.all > 0
                ? `${Math.round(
                    (counts.appointment / counts.all) * 100,
                  )}% converted`
                : '—'
            }
            color="#1E7A5A"
          />
          <Stat
            label="To call"
            value={num(counts.unattended)}
            note="un-attended"
            color={UNATTENDED.color}
          />
        </View>

        {/* Source row — the differentiator on this screen, so it sits above the
            status filters rather than beside them. */}
        <View style={st.sourceRow}>
          {['All', 'Sulekha', 'Hexa'].map(tab => {
            const on = source === tab;
            const c = tab === 'All' ? HUE_L : SOURCE_COLORS[tab];
            const n = tab === 'All' ? counts.all : counts[tab];
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setSource(tab)}
                style={[
                  st.sourceTab,
                  on && { backgroundColor: c, borderColor: c },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.sourceLabel, on && st.onText]}>
                  {tab === 'All' ? 'All sources' : SOURCE_LABELS[tab]}
                </Text>
                <Text style={[st.sourceCount, on && st.onText]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {[
            {
              key: 'Unattended',
              label: 'Un-attended',
              n: counts.unattended,
              c: UNATTENDED.color,
            },
            { key: '', label: 'All', n: counts.all, c: HUE_L },
            {
              key: 'Enquiry',
              label: 'Enquiry',
              n: counts.enquiry,
              c: STATUSES.Enquiry.color,
            },
            {
              key: 'Appointment',
              label: 'Appointment',
              n: counts.appointment,
              c: STATUSES.Appointment.color,
            },
            {
              key: 'Visited',
              label: 'Visited',
              n: counts.visited,
              c: '#2F6FA8',
            },
            { key: 'IPD', label: 'IPD', n: counts.ipd, c: '#B3523B' },
          ].map(f => {
            const on = status === f.key;
            return (
              <TouchableOpacity
                key={f.key || 'all'}
                onPress={() => setStatus(f.key)}
                style={[
                  st.chip,
                  on && { backgroundColor: f.c, borderColor: f.c },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${f.label}, ${f.n}`}
              >
                <Text style={[st.chipLabel, on && st.onText]}>{f.label}</Text>
                <Text style={[st.chipCount, on && st.onText]}>{f.n}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, phone, city or condition"
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

        {/* The scoping caveat, said once at the top rather than discovered when
            two branches report the same lead. */}
        <Text style={st.caveat}>
          Sulekha leads are not branch-specific — every branch sees all of them.
          Conversion is checked against this branch only.
        </Text>

        {list.length !== rows.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(rows.length)} leads
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        // lead_key is source-prefixed upstream (SLK-101 / HEX-101), so Sulekha
        // and Hexa ids cannot collide.
        keyExtractor={(r, i) =>
          String(r.lead_key ?? `${r.source}-${r.appointment_id}-${i}`)
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
            tintColor={HUE_L}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={HUE_L} />
            </View>
          ) : (
            <Text style={st.empty}>{error || 'No leads in this view.'}</Text>
          )
        }
        renderItem={({ item }) => (
          <LeadCard
            r={item}
            onCall={() => call(item.phoneno)}
            onWhatsapp={() => whatsapp(item.phoneno)}
          />
        )}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={[st.statVal, { color }]}>{value}</Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

const Tag = ({ label, color }) => (
  <View style={[st.tag, { borderColor: color }]}>
    <Text style={[st.tagText, { color }]}>{label}</Text>
  </View>
);

const LeadCard = ({ r, onCall, onWhatsapp }) => {
  const meta = statusMeta(r.status);
  const sourceColor = SOURCE_COLORS[r.source] || T.muted2;

  return (
    <View style={st.row}>
      {/* Spine is the SOURCE, badge is the status. On a mixed list the source is
          what you scan for; status is what you read. */}
      <View style={[st.rowSpine, { backgroundColor: sourceColor }]} />

      <View style={st.rowHead}>
        <View style={[st.avatar, { backgroundColor: `${sourceColor}18` }]}>
          <Text style={[st.avatarText, { color: sourceColor }]}>
            {initials(r.name || r.phoneno)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>
            {r.name || 'Name not given'}
          </Text>
          <Text style={st.phone}>{r.phoneno || 'No number'}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <View style={[st.badge, { backgroundColor: sourceColor }]}>
            <Text style={st.badgeText}>
              {(SOURCE_LABELS[r.source] || r.source || '').toUpperCase()}
            </Text>
          </View>
          <View
            style={[st.statusBadge, { backgroundColor: `${meta.color}18` }]}
          >
            <Icon name={meta.icon} size={11} color={meta.color} />
            <Text style={[st.statusText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>
      </View>

      <Text style={st.meta} numberOfLines={1}>
        {fmtDate(r.date)}
        {r.city ? ` · ${r.city}` : ''}
        {r.area ? ` · ${r.area}` : ''}
      </Text>

      {/* Hexa-only clinical fields plus the conversion state. Absent on Sulekha
          rows, which is why they are tags rather than fixed lines. */}
      {(r.procedure_name ||
        r.medical_condition ||
        r.department ||
        r.gender ||
        r.visited ||
        r.ipd) && (
        <View style={st.tagRow}>
          {!!r.medical_condition && (
            <Tag label={r.medical_condition} color={T.muted2} />
          )}
          {!!r.procedure_name && (
            <Tag label={r.procedure_name} color={T.muted2} />
          )}
          {!!r.department && <Tag label={r.department} color={T.muted2} />}
          {!!r.gender && <Tag label={r.gender} color={T.muted2} />}
          {r.visited && <Tag label="Visited" color="#2F6FA8" />}
          {r.ipd && <Tag label="IPD" color="#B3523B" />}
        </View>
      )}

      {!!r.message && (
        <View style={st.messageBox}>
          <Text style={st.messageLabel}>THEIR MESSAGE</Text>
          <Text style={st.messageText}>{r.message}</Text>
        </View>
      )}

      {!!r.note && (
        <View style={st.noteBox}>
          <Text style={st.noteText}>{r.note}</Text>
        </View>
      )}

      <View style={st.actions}>
        <TouchableOpacity
          onPress={onCall}
          style={[st.action, { backgroundColor: HUE_L }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${r.name || r.phoneno}`}
        >
          <Icon name="call" size={15} color="#fff" />
          <Text style={st.actionTextOn}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onWhatsapp}
          style={st.actionGhost}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${r.name || r.phoneno}`}
        >
          <Icon name="chat" size={15} color="#1E7A5A" />
        </TouchableOpacity>

        {!!r.email && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${r.email}`)}
            style={st.actionGhost}
            accessibilityRole="button"
            accessibilityLabel={`Email ${r.email}`}
          >
            <Icon name="mail-outline" size={15} color={T.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default PartnerLeadsScreen;

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
    fontSize: 20,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  sourceRow: { flexDirection: 'row', gap: 7, marginTop: 14 },
  sourceTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: T.card,
    alignItems: 'center',
  },
  sourceLabel: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  sourceCount: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    marginTop: 3,
  },
  onText: { color: '#fff' },

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
  caveat: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 10,
    fontFamily: F.regular,
    lineHeight: 14,
  },
  showing: { fontSize: 10, color: T.muted2, marginTop: 8, fontFamily: F.mono },

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
  phone: { fontFamily: F.mono, fontSize: 12, color: T.text, marginTop: 3 },

  badge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusText: { fontFamily: F.mono, fontSize: 8, letterSpacing: 0.6 },

  meta: { fontFamily: F.mono, fontSize: 10, color: T.muted2, marginTop: 8 },

  tagRow: { flexDirection: 'row', gap: 5, marginTop: 8, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.6 },

  messageBox: {
    borderLeftWidth: 2,
    borderLeftColor: HUE_L,
    backgroundColor: '#F1F7F7',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 9,
  },
  messageLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 12,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 17,
  },

  noteBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#E0A93B',
    backgroundColor: '#FBF6EC',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginTop: 8,
  },
  noteText: {
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 16,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  actionTextOn: { fontSize: 11.5, color: '#fff', fontFamily: F.medium },
  actionGhost: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
