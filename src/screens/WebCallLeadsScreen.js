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
// REQUIRES call_leads_migration.sql — without the `status` and `note` columns
// the actions have nowhere to write and every update returns a silent no-op.
//
// ⚠️ NO DATE RANGE, SO NO SCOPE CHIP
// ──────────────────────────────────
// getCallLeads takes location only and returns `ORDER BY id DESC LIMIT 100` —
// the hundred most recent, whenever they came in. Rendering the period selector
// would imply a filter that does nothing, so the header hides it and the
// subtitle says what the window actually is.
//
// If a branch ever exceeds a hundred open leads the oldest fall off the bottom
// invisibly. The count is shown against the cap so that is at least visible.
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
  Modal,
  Pressable,
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

import { get, post } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
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

// A lead with no status has not been worked yet — that is the queue.
const NEW = { label: 'New', color: '#B3382B', icon: 'fiber-new' };

const statusMeta = s => STATUSES[s] || NEW;

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

const WebCallLeadsScreen = ({ navigation }) => {
  const location = useSelector(s => s.location.value);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('new');
  const [source, setSource] = useState('');
  const [sheet, setSheet] = useState(null); // { lead, status }
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/leadManagement/call', { location });
        setRows(Array.isArray(res) ? res : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location],
  );

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: rows.length, new: 0, Enquiry: 0, Appointment: 0 };
    for (const r of rows) {
      if (!r.status) c.new++;
      else if (c[r.status] !== undefined) c[r.status]++;
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
    if (status === 'new') out = out.filter(r => !r.status);
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

  const openSheet = (lead, nextStatus) => {
    setSheet({ lead, status: nextStatus });
    setNote(lead.note || '');
  };

  const save = async () => {
    if (!sheet || saving) return;
    setSaving(true);
    try {
      await post(
        `/leadManagement/updateStatus/call?id=${encodeURIComponent(
          sheet.lead.appointment_id,
        )}`,
        { status: sheet.status, note: note.trim() || null },
      );
      // Updated locally rather than refetching: the list is capped at 100 and
      // ordered by id, so a reload would scroll the person back to the top and
      // lose their place in a queue they are working through.
      setRows(rs =>
        rs.map(r =>
          r.appointment_id === sheet.lead.appointment_id
            ? { ...r, status: sheet.status, note: note.trim() || null }
            : r,
        ),
      );
      setSheet(null);
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View>
      <SectionHeader
        code="LEADS"
        name="Web Call Leads"
        sub="Call-back requests from the website"
        hue={HUE_L}
        hideScope
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="To call"
            value={num(counts.new)}
            note="not yet worked"
            color={NEW.color}
          />
          <Stat
            label="Enquiry"
            value={num(counts.Enquiry)}
            note="spoken to"
            color={STATUSES.Enquiry.color}
          />
          <Stat
            label="Appointment"
            value={num(counts.Appointment)}
            note="booked"
            color={STATUSES.Appointment.color}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {[
            { key: 'new', label: 'To call', n: counts.new, c: NEW.color },
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

        {/* The endpoint caps at 100 rows, so a busy branch loses the oldest
            silently. Said out loud when the cap is reached. */}
        {rows.length >= 100 && (
          <Text style={st.cap}>
            Showing the 100 most recent leads. Older ones are not listed.
          </Text>
        )}
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
            onStatus={s => openSheet(item, s)}
          />
        )}
      />

      <StatusSheet
        sheet={sheet}
        note={note}
        setNote={setNote}
        saving={saving}
        onSave={save}
        onClose={() => setSheet(null)}
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

const LeadCard = ({ r, onCall, onWhatsapp, onStatus }) => {
  const meta = statusMeta(r.status);
  const age = ageInDays(r.date);
  const isNew = !r.status;

  return (
    <View style={st.row}>
      <View style={[st.rowSpine, { backgroundColor: meta.color }]} />

      <View style={st.rowHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* The form captures no name — the number IS the identity. */}
          <Text style={st.phone}>{r.phoneno || 'No number'}</Text>
          <Text style={st.disease} numberOfLines={1}>
            {r.disease || 'Treatment not identified'}
          </Text>
        </View>
        <View style={[st.badge, { backgroundColor: `${meta.color}18` }]}>
          <Icon name={meta.icon} size={12} color={meta.color} />
          <Text style={[st.badgeText, { color: meta.color }]}>
            {meta.label}
          </Text>
        </View>
      </View>

      <Text style={st.meta} numberOfLines={1}>
        {fmtWhen(r.date)}
        {/* Age matters most on an unworked lead — a week-old call-back request
            is a different conversation from an hour-old one. */}
        {isNew && age != null && age > 0 ? ` · ${age}d old` : ''}
      </Text>
      <Text style={st.meta2} numberOfLines={1}>
        {r.source || 'Direct / organic'}
        {r.branch ? ` · ${r.branch}` : ''}
      </Text>

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
          accessibilityLabel={`Call ${r.phoneno}`}
        >
          <Icon name="call" size={15} color="#fff" />
          <Text style={st.actionTextOn}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onWhatsapp}
          style={st.actionGhost}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${r.phoneno}`}
        >
          <Icon name="chat" size={15} color="#1E7A5A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={() => onStatus('Enquiry')}
          style={[st.actionGhost, { borderColor: STATUSES.Enquiry.color }]}
          accessibilityRole="button"
        >
          <Text style={[st.actionText, { color: STATUSES.Enquiry.color }]}>
            Enquiry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onStatus('Appointment')}
          style={[st.actionGhost, { borderColor: STATUSES.Appointment.color }]}
          accessibilityRole="button"
        >
          <Text style={[st.actionText, { color: STATUSES.Appointment.color }]}>
            Booked
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Status change with a note. A sheet rather than an immediate write: the note
 * is the only record of what was actually said on the call, and a one-tap
 * status with no note loses that.
 */
const StatusSheet = ({ sheet, note, setNote, saving, onSave, onClose }) => {
  const meta = sheet ? statusMeta(sheet.status) : NEW;
  return (
    <Modal
      visible={!!sheet}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={st.overlay}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={st.sheet}>
        <View style={st.sheetHead}>
          <Icon name={meta.icon} size={18} color={meta.color} />
          <Text style={st.sheetTitle}>Mark as {meta.label}</Text>
        </View>
        <Text style={st.sheetSub}>{sheet?.lead?.phoneno}</Text>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What was discussed? (optional)"
          placeholderTextColor={T.muted2}
          style={st.noteInput}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={[
            st.save,
            { backgroundColor: meta.color },
            saving && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
        >
          <Text style={st.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
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
  cap: { fontSize: 10, color: '#B26A00', marginTop: 10, fontFamily: F.regular },

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
  phone: {
    fontFamily: F.mono,
    fontSize: 15,
    color: T.text,
    letterSpacing: -0.2,
  },
  disease: {
    fontSize: 12.5,
    color: T.text,
    marginTop: 4,
    fontFamily: F.medium,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.6 },

  meta: { fontFamily: F.mono, fontSize: 10, color: T.muted2, marginTop: 8 },
  meta2: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },

  noteBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#E0A93B',
    backgroundColor: '#FBF6EC',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginTop: 9,
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
  actionText: { fontSize: 11.5, fontFamily: F.medium },

  overlay: { flex: 1, backgroundColor: 'rgba(5,20,12,0.32)' },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontFamily: F.semibold, fontSize: 15, color: T.text },
  sheetSub: { fontFamily: F.mono, fontSize: 12, color: T.muted2, marginTop: 4 },
  noteInput: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    padding: 12,
    marginTop: 14,
    minHeight: 90,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },
  save: {
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  saveText: { fontFamily: F.semibold, fontSize: 14, color: '#fff' },
});
