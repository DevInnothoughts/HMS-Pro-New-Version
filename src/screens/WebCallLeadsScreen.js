/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/WebCallLeadsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Call-back requests from the "request a call" widget on the website, stored in
// call_leads (hhc_appointments).
//
//   GET  /leadManagement/call?location=
//   POST /leadManagement/updateStatus/call?id=   { status, note }
//
// REQUIRES call_leads_migration.sql for the `status` and `note` columns. This
// screen no longer writes them (the Enquiry / Booked buttons were removed to
// match the Web / Bot leads screen); status is set by the approval flow and
// by syncCallAppointments on the backend.
//
// DATE RANGE
// ──────────
// The header's scope chip sets the range, like every other leads screen, and
// it is sent as from/to. The server returns every lead created in that range
// (no 100-row cap when a range is given).
//
// ⚠️ THERE IS NO NAME
// ───────────────────
// The website form captures a phone number and nothing else — the model sets
// `name` to null deliberately. So the PHONE NUMBER is the identity on this
// screen: it is the largest text on the card, in mono, and it is what you
// search by. A card headed "Unnamed" would be worse than useless.
//
// WHAT THE CARD LEADS WITH
// ────────────────────────
// `disease` is inferred from the landing page URL, and it is the single most
// useful thing to know before dialling — someone reading the pilonidal page
// wants a different conversation from someone reading about hernia. It sits
// directly under the number.
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

// ⚠️ VERIFY against call_leads_migration.sql. These are the two the reference
// screen writes ("the Enquiry and Appointment actions"); a status the migration
// does not allow will be rejected by the column constraint, not by this file.
const STATUSES = {
  Enquiry: { label: 'Enquiry', color: '#B26A00', icon: 'record-voice-over' },
  Appointment: {
    label: 'Appointment',
    color: '#1E7A5A',
    icon: 'event-available',
  },
};

// Same as the Web / Bot leads screen: a lead with no status is un-attended.
const UNATTENDED = {
  label: 'Un-attended',
  color: '#B3382B',
  icon: 'fiber-new',
};

// null, undefined, '' and the string 'null' (a JSON round-trip of SQL NULL)
// all mean un-attended.
const isUnattended = s =>
  s === null || s === undefined || s === '' || s === 'null';

const statusMeta = s =>
  isUnattended(s) ? UNATTENDED : STATUSES[s] || UNATTENDED;

// Same whole-card colours as the Web / Bot leads screen (and the old
// WebLeads.js): green for Appointment, amber for Enquiry, white otherwise.
const CARD_BG = { Appointment: '#66BB6A', Enquiry: '#FFB300' };

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

const fmtWhen = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  const h = dt.getHours() % 12 || 12;
  const ap = dt.getHours() >= 12 ? 'PM' : 'AM';
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} · ${h}:${String(
    dt.getMinutes(),
  ).padStart(2, '0')} ${ap}`;
};

const ageInDays = d => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
};

const WebCallLeadsScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  // Same date scope as every other leads screen — the header chip changes it.
  const { from, to } = useScopeRange(route);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/leadManagement/call', { location, from, to });
        setRows(Array.isArray(res) ? res : []);
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

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      unattended: 0,
      Enquiry: 0,
      Appointment: 0,
      visited: 0,
      ipd: 0,
    };
    for (const r of rows) {
      if (isUnattended(r.status)) c.unattended++;
      else if (r.status === 'Enquiry') c.Enquiry++;
      else if (r.status === 'Appointment') c.Appointment++;
      // `visited` / `ipd` come from the server (attachVisitFlags).
      if (r.visited) c.visited++;
      if (r.ipd) c.ipd++;
    }
    return c;
  }, [rows]);

  // Source chips are derived from the values actually present, so a new
  // utm_source (facebook, bing…) appears on its own with no code change —
  // the same rule the reference config used.
  const sources = useMemo(() => {
    const seen = new Map();
    for (const r of rows) {
      const key = r.source || 'Direct / organic';
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return [...seen.entries()]
      .map(([key, n]) => ({ key, n }))
      .sort((a, b) => b.n - a.n);
  }, [rows]);

  const list = useMemo(() => {
    let out = rows;
    if (status === 'Unattended') out = out.filter(r => isUnattended(r.status));
    else if (status === 'Visited') out = out.filter(r => r.visited);
    else if (status === 'IPD') out = out.filter(r => r.ipd);
    else if (status) out = out.filter(r => r.status === status);
    if (source)
      out = out.filter(r => (r.source || 'Direct / organic') === source);

    const q = query.trim().toLowerCase();
    if (!q) return out;
    const qd = digits(q);
    return out.filter(
      r =>
        // Phone first — it is the identity here, and it is what someone reads
        // off a call log to find the lead again.
        (!!qd && digits(r.phoneno).includes(qd)) ||
        String(r.disease || '')
          .toLowerCase()
          .includes(q) ||
        String(r.branch || '')
          .toLowerCase()
          .includes(q) ||
        String(r.note || '')
          .toLowerCase()
          .includes(q),
    );
  }, [rows, status, source, query]);

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
        name="Web Call Leads"
        sub="Call-back requests from the website"
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
            label="Appointment"
            value={num(counts.Appointment)}
            note={
              counts.all > 0
                ? `${Math.round(
                    (counts.Appointment / counts.all) * 100,
                  )}% converted`
                : 'none'
            }
            color={STATUSES.Appointment.color}
          />
          <Stat
            label="Un-attended"
            value={num(counts.unattended)}
            note="un-attended"
            color={UNATTENDED.color}
          />
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
              n: counts.Enquiry,
              c: STATUSES.Enquiry.color,
            },
            {
              key: 'Appointment',
              label: 'Appointment',
              n: counts.Appointment,
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
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {f.label}
                </Text>
                <Text style={[st.chipCount, on && st.chipOnText]}>{f.n}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {sources.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.chipsTight}
          >
            <TouchableOpacity
              onPress={() => setSource('')}
              style={[st.sourceChip, !source && st.sourceChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: !source }}
            >
              <Text style={[st.sourceLabel, !source && st.sourceLabelOn]}>
                All sources
              </Text>
            </TouchableOpacity>
            {sources.map(s => {
              const on = source === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSource(on ? '' : s.key)}
                  style={[st.sourceChip, on && st.sourceChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[st.sourceLabel, on && st.sourceLabelOn]}>
                    {s.key} · {s.n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Phone, treatment, page or note"
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
        keyExtractor={r => String(r.appointment_id)}
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

/**
 * Compact call-lead card, same layout as the Web / Bot leads card:
 *   line 1  phone + status badge                 [call] [whatsapp]
 *   line 2  treatment · date (· age, while un-attended)
 *   line 3  tags — source, website location, Visited, IPD
 *   line 4  note, one line; tap the card to read it in full
 * Call / WhatsApp sit beside the number instead of in a footer row.
 */
const LeadCard = ({ r, onCall, onWhatsapp }) => {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(r.status);
  const age = ageInDays(r.date);
  const isNew = isUnattended(r.status);
  const hl = CARD_BG[r.status];
  // On a coloured card the pale tints and grey text wash out, so the small
  // chips go white and the secondary text goes dark.
  const chipBg = hl ? '#fff' : `${meta.color}18`;
  const subColor = hl ? T.text : T.muted2;

  // Age matters most on an unworked lead — a week-old call-back request is a
  // different conversation from an hour-old one.
  const sub = [
    r.disease || 'Treatment not identified',
    fmtWhen(r.date),
    isNew && age != null && age > 0 ? `${age}d old` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={!r.note}
      onPress={() => setOpen(o => !o)}
      style={[st.row, hl && { backgroundColor: hl, borderColor: hl }]}
      accessibilityHint={r.note ? 'Shows the full note' : undefined}
    >
      <View style={[st.rowSpine, { backgroundColor: meta.color }]} />

      <View style={st.rowHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.titleLine}>
            {/* The form captures no name — the number IS the identity. */}
            <Text style={st.phone} numberOfLines={1}>
              {r.phoneno || 'No number'}
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
          accessibilityLabel={`Call ${r.phoneno}`}
        >
          <Icon name="call" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onWhatsapp}
          style={[st.iconBtn, { backgroundColor: '#fff' }]}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${r.phoneno}`}
        >
          <Icon name="chat" size={16} color="#1E7A5A" />
        </TouchableOpacity>
      </View>

      <View style={st.tagRow}>
        <Tag
          label={r.source || 'Direct / organic'}
          color={T.muted2}
          solid={!!hl}
        />
        {!!r.branch && <Tag label={r.branch} color={T.muted2} solid={!!hl} />}
        {r.visited && <Tag label="Visited" color="#2F6FA8" solid={!!hl} />}
        {r.ipd && <Tag label="IPD" color="#B3523B" solid={!!hl} />}
      </View>

      {!!r.note && (
        <View style={st.noteBox}>
          <Text
            style={[st.noteText, { flex: 1 }]}
            numberOfLines={open ? undefined : 1}
          >
            <Text style={st.noteLabel}>NOTE </Text>
            {r.note}
          </Text>
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

export default WebCallLeadsScreen;

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
  chipsTight: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 12,
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

  sourceChip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: T.card,
  },
  sourceChipOn: { backgroundColor: '#EAF2F3', borderColor: HUE_L },
  sourceLabel: { fontSize: 10.5, color: T.muted, fontFamily: F.regular },
  sourceLabelOn: { color: HUE_L, fontFamily: F.medium },

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
  phone: {
    flexShrink: 1,
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.2,
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
  sub: { fontSize: 10.5, marginTop: 3, fontFamily: F.regular },

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

  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  noteLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.6,
    color: T.muted2,
  },
  noteText: {
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 16,
  },
});
