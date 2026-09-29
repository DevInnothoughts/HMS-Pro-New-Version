/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/LeadsListScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// One screen for Web leads and Bot leads. Replaces src/admin/WebLeads.js and
// src/admin/BotLeads.js, which were the same 600 lines twice over with two
// differences: the endpoint, and how phones are matched.
//
// Config lives in LEAD_SOURCES below. A third source is a config block.
//
// ⚠️ PHONE MATCHING IS NOW LAST-10 FOR BOTH
// ─────────────────────────────────────────
// WebLeads matched appointment/visit/IPD phones EXACTLY; BotLeads normalised to
// the last ten digits because the chatbot stores "+91…" and "91…". Exact
// matching silently misses any web lead whose number carries a country code, so
// the looser rule is used for both.
//
// This can only ADD matches, never remove them — so a lead that showed as
// converted before still does. Web conversion counts may rise slightly on
// branches where the website stores a prefix. That is a correction, not a
// regression, but it will look like a change if anyone is tracking the number.
//
// ⚠️ THE COUNTS COME FROM THE SERVER, THE ROWS ARE FILTERED HERE
// ──────────────────────────────────────────────────────────────
// appointmentCount / actualVisitCount / ipdCount are the API's own totals, and
// the chips show those. The list is filtered client-side against the phone sets
// in the same payload. If a chip count and the row count disagree, the phone
// normalisation is the place to look — not this screen's filter.
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

/**
 * ⚠️ VERIFY BOTH PATHS against WebLeads.js and BotLeads.js before shipping.
 * `list` is confirmed for web; the bot one is my reading of the controller's
 * /bot route and needs checking.
 */
export const LEAD_SOURCES = {
  web: {
    code: 'LEADS',
    name: 'Web Leads',
    sub: 'Enquiries from the website form',
    list: '/leadManagement/datewise',
    updateStatus: '/leadManagement/updateStatus',
  },
  bot: {
    code: 'LEADS',
    name: 'Bot Leads',
    sub: 'Conversations captured by the chatbot',
    // Confirmed against src/admin/BotLeads.js.
    list: '/leadManagement/datewiseBot',
    updateStatus: '/leadManagement/updateStatus/bot',
  },
};

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

// The old screens tested four different empty shapes for status — null,
// undefined, '' and the STRING 'null', which is what a JSON round-trip of a SQL
// NULL can produce. All four mean un-attended.
const isUnattended = s =>
  s === null || s === undefined || s === '' || s === 'null';

const statusMeta = s =>
  isUnattended(s) ? UNATTENDED : STATUSES[s] || UNATTENDED;

const digits = p => String(p || '').replace(/\D/g, '');
// Last ten — see the header note.
const key10 = p => digits(p).slice(-10);

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

const LeadsListScreen = ({ navigation, route }) => {
  const sourceKey = route?.params?.source || 'web';
  const cfg = LEAD_SOURCES[sourceKey] || LEAD_SOURCES.web;

  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(await get(cfg.list, { location, from, to }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cfg.list, location, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.leads || [];

  // Phone sets from the API's own conversion lists, normalised once rather
  // than on every filter pass.
  const sets = useMemo(
    () => ({
      appointment: new Set(
        (data?.appointmentLeads || []).map(l => key10(l.phoneno)),
      ),
      visited: new Set(
        (data?.visitedLeads || []).map(l => key10(l.patient_phone)),
      ),
      ipd: new Set((data?.ipdLeads || []).map(l => key10(l.patient_phone))),
    }),
    [data],
  );

  const counts = useMemo(
    () => ({
      all: data?.totalLeads ?? rows.length,
      appointment: data?.appointmentCount ?? 0,
      visited: data?.actualVisitCount ?? 0,
      ipd: data?.ipdCount ?? 0,
      enquiry: rows.filter(r => r.status === 'Enquiry').length,
      unattended: rows.filter(r => isUnattended(r.status)).length,
    }),
    [data, rows],
  );

  const list = useMemo(() => {
    let out = rows;
    if (filter === 'Appointment')
      out = out.filter(r => sets.appointment.has(key10(r.phoneno)));
    else if (filter === 'Visited')
      out = out.filter(r => sets.visited.has(key10(r.phoneno)));
    else if (filter === 'IPD')
      out = out.filter(r => sets.ipd.has(key10(r.phoneno)));
    else if (filter === 'Enquiry')
      out = out.filter(r => r.status === 'Enquiry');
    else if (filter === 'Unattended')
      out = out.filter(r => isUnattended(r.status));

    const q = query.trim().toLowerCase();
    if (!q) return out;
    const qd = digits(q);
    return out.filter(
      r =>
        String(r.name || '')
          .toLowerCase()
          .includes(q) ||
        (!!qd && digits(r.phoneno).includes(qd)) ||
        String(r.note || '')
          .toLowerCase()
          .includes(q),
    );
  }, [rows, sets, filter, query]);

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
        code={cfg.code}
        name={cfg.name}
        sub={cfg.sub}
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

        {/* Every filter the old screen had, in one scrolling row instead of a
            collapsible block of six cards. */}
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
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key || 'all'}
                onPress={() => setFilter(f.key)}
                style={[
                  st.chip,
                  on && { backgroundColor: f.c, borderColor: f.c },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${f.label}, ${f.n}`}
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {f.label}
                </Text>
                <Text style={[st.chipCount, on && st.chipOnText]}>{f.n}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, phone or note"
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
        keyExtractor={(r, i) => String(r.appointment_id ?? `${r.phoneno}-${i}`)}
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
            visited={sets.visited.has(key10(item.phoneno))}
            ipd={sets.ipd.has(key10(item.phoneno))}
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

const Tag = ({ label, color, solid }) => (
  <View
    style={[
      st.tag,
      { borderColor: color },
      solid && { backgroundColor: '#fff' },
    ]}
  >
    <Text style={[st.tagText, { color }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

// Same whole-card colours as the old WebLeads.js / BotLeads.js: green for
// Appointment, amber for Enquiry, plain white for everything else.
const CARD_BG = { Appointment: '#66BB6A', Enquiry: '#FFB300' };

/**
 * Compact lead card. Everything that used to take its own row is folded in:
 *   line 1  name + status badge              [call] [whatsapp]
 *   line 2  phone · date
 *   line 3  tags — disease, city, area, Visited, IPD (only if any)
 *   line 4  message / note, one line each; tap the card to read them in full
 * The Call / WhatsApp buttons sit beside the name instead of in a footer row.
 */
const LeadCard = ({ r, visited, ipd, onCall, onWhatsapp }) => {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(r.status);
  const hl = CARD_BG[r.status];
  // On a coloured card the pale tints and grey text wash out, so the small
  // chips go white and the secondary text goes dark.
  const chipBg = hl ? '#fff' : `${meta.color}18`;
  const subColor = hl ? T.text : T.muted2;

  // No name → the number is the title, and isn't repeated underneath.
  const title = r.name || r.phoneno || 'No number';
  const subParts = [r.name ? r.phoneno || 'No number' : null, fmtDate(r.date)];
  const sub = subParts.filter(Boolean).join('  ·  ');

  const hasTags = !!(r.disease || r.city || r.selected_area || visited || ipd);
  const hasText = !!(r.message || r.note);
  const lines = open ? undefined : 1;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={!hasText}
      onPress={() => setOpen(o => !o)}
      style={[st.row, hl && { backgroundColor: hl, borderColor: hl }]}
      accessibilityHint={hasText ? 'Shows the full message' : undefined}
    >
      <View style={[st.rowSpine, { backgroundColor: meta.color }]} />

      <View style={st.rowHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.titleLine}>
            <Text style={st.name} numberOfLines={1}>
              {title}
            </Text>
            <View style={[st.badge, { backgroundColor: chipBg }]}>
              <Icon name={meta.icon} size={10} color={meta.color} />
              <Text style={[st.badgeText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>
          <Text style={[st.sub, { color: subColor }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onCall}
          style={[st.iconBtn, { backgroundColor: HUE_L, borderColor: HUE_L }]}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Call ${title}`}
        >
          <Icon name="call" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onWhatsapp}
          style={[st.iconBtn, { backgroundColor: '#fff' }]}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${title}`}
        >
          <Icon name="chat" size={16} color="#1E7A5A" />
        </TouchableOpacity>
      </View>

      {hasTags && (
        <View style={st.tagRow}>
          {!!r.disease && (
            <Tag label={r.disease} color={T.muted2} solid={!!hl} />
          )}
          {!!r.city && <Tag label={r.city} color={T.muted2} solid={!!hl} />}
          {!!r.selected_area && r.selected_area !== r.city && (
            <Tag label={r.selected_area} color={T.muted2} solid={!!hl} />
          )}
          {visited && <Tag label="Visited" color="#2F6FA8" solid={!!hl} />}
          {ipd && <Tag label="IPD" color="#B3523B" solid={!!hl} />}
        </View>
      )}

      {hasText && (
        <View style={st.textBox}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {!!r.message && (
              <Text style={st.messageText} numberOfLines={lines}>
                <Text style={st.textLabel}>MSG </Text>
                {r.message}
              </Text>
            )}
            {!!r.note && (
              <Text style={st.noteText} numberOfLines={lines}>
                <Text style={st.textLabel}>NOTE </Text>
                {r.note}
              </Text>
            )}
          </View>
          <Icon
            name={open ? 'expand-less' : 'expand-more'}
            size={16}
            color={T.muted2}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default LeadsListScreen;

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
    borderRadius: 12,
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 10,
    marginHorizontal: 16,
    marginTop: 7,
    overflow: 'hidden',
  },
  rowSpine: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    flexShrink: 1,
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: F.mono, fontSize: 8, letterSpacing: 0.5 },
  sub: { fontFamily: F.mono, fontSize: 10.5, marginTop: 3 },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tagRow: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: '60%',
  },
  tagText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.5 },

  textBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  textLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.6,
    color: T.muted2,
  },
  messageText: {
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 16,
  },
  noteText: {
    fontSize: 11.5,
    color: '#8A5A00',
    fontFamily: F.regular,
    lineHeight: 16,
  },
});
