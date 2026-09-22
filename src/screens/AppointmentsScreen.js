/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/AppointmentsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Appointments, rebuilt in the Outpatient section's language: blue header, mono
// numerals, spine-marked rows. Same endpoint (/Appointment), same fields, same
// call and WhatsApp actions.
//
// WHAT CHANGED IN THE LIST, AND WHY
// ─────────────────────────────────
// The old card stacked six labelled lines — "Appt. Time:", "Confirm Time:",
// "Date:" — so every row was six left-aligned labels and the patient's name had
// no more weight than the FDE's. Reading it meant reading all of it.
//
// Now each row is scannable in one pass: the time is the anchor on the left
// (that is what an appointment list is ordered by), the name is the only large
// text, and everything else is one muted line beneath it. Confirmation state is
// the spine colour and a single badge rather than a raw timestamp — nobody
// needed the confirm time itself, they needed to know whether it was confirmed.
//
// Contact actions are icon buttons at the row's end instead of two 35px images
// stacked under the card, which is where most of the old vertical space went.
//
// PAGINATION REMOVED. The old screen paged ten at a time with prev/next
// buttons. FlatList recycles rows, so a day's appointments scroll in one list —
// no paging state, and search actually searches everything rather than the
// current page.
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
import { F, HUE, T, num } from '../design/tokens';
import useScopeRange from '../scope/useScopeRange';

const HUE_O = HUE.opd;

// Visit-type accents, matching the visit-type cards on the OPD section so the
// same category reads the same colour in both places.
const TYPE_HUES = {
  New: '#2F6FA8',
  Follow: '#3E8C8C',
  Postoperative: '#7A5EA8',
  MCDPA: '#B3762B',
};
const TYPE_LABEL = {
  New: 'New',
  Follow: 'Follow-up',
  Postoperative: 'Post-op',
  MCDPA: 'MCDPA',
};

// confirm_time is '0', '', or null when unconfirmed — three shapes for the same
// state across forty branch databases, so all three are treated alike.
const isConfirmed = v => {
  const s = String(v ?? '').trim();
  return s !== '' && s !== '0';
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const fmtDay = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10);
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
  return `${d.getDate()} ${M[d.getMonth()]}`;
};

// '14:30:00' → '2:30 PM'. Times arrive in a few shapes; anything unparseable is
// shown as stored rather than blanked — a raw string is more use than nothing.
const fmtTime = t => {
  const s = String(t || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s || '—';
  let h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suffix}`;
};

const digits = p => String(p || '').replace(/\D/g, '');

const AppointmentsScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);
  const location = route?.params?.location || reduxLocation;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/Appointment', { location, from, to });
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

  // Per-type totals and confirmed counts, matching the old screen's six cards.
  // 'notConfirmed' is confirm_time === '0' there; isConfirmed() also treats
  // empty and null as unconfirmed, which is the same intent on branches that
  // store it differently.
  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      confirmed: 0,
      notConfirmed: 0,
      New: 0,
      Follow: 0,
      Postoperative: 0,
      MCDPA: 0,
      NewC: 0,
      FollowC: 0,
      PostoperativeC: 0,
      MCDPAC: 0,
    };
    for (const r of rows) {
      const ok = isConfirmed(r.confirm_time);
      if (ok) c.confirmed++;
      else c.notConfirmed++;
      const t = r.patient_type;
      if (c[t] !== undefined) {
        c[t]++;
        if (ok) c[`${t}C`]++;
      }
    }
    return c;
  }, [rows]);

  const list = useMemo(() => {
    let out = rows;
    if (filter === 'notConfirmed')
      out = out.filter(r => !isConfirmed(r.confirm_time));
    else if (filter !== 'all') out = out.filter(r => r.patient_type === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      // Only match on phone when the query actually contains digits —
      // digits('john') is '', and includes('') is true for every row, which
      // makes the whole search a no-op.
      const qDigits = digits(q);
      out = out.filter(
        r =>
          String(r.patient_name || '')
            .toLowerCase()
            .includes(q) ||
          String(r.doctor_name || '')
            .toLowerCase()
            .includes(q) ||
          (!!qDigits && digits(r.patient_phone).includes(qDigits)),
      );
    }
    return out;
  }, [rows, filter, query]);

  // The date only earns a place in each row when the range spans more than one
  // day. On a single-day view it would be the same string forty times.
  const multiDay = from !== to;

  const call = phone => {
    const d = digits(phone);
    if (!d)
      return Alert.alert('No number', 'This appointment has no phone number.');
    Linking.openURL(`tel:${d}`);
  };

  const whatsapp = phone => {
    const d = digits(phone);
    if (!d)
      return Alert.alert('No number', 'This appointment has no phone number.');
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
        code="OPD"
        name="Appointments"
        sub={
          multiDay
            ? `${fmtDay(from)} – ${fmtDay(to)}`
            : 'Scheduled consultations'
        }
        hue={HUE_O}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Booked"
            value={num(counts.all)}
            note="appointments"
            color={T.text}
          />
          <Stat
            label="Confirmed"
            value={num(counts.confirmed)}
            note={`${counts.notConfirmed} pending`}
            color="#1E7A5A"
          />
          <Stat
            label="New"
            value={num(counts.New)}
            note={`${counts.NewC} confirmed`}
            color={HUE_O}
          />
        </View>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Patient, phone or doctor"
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.filters}
        >
          {[
            { key: 'all', label: 'All', n: counts.all },
            {
              key: 'notConfirmed',
              label: 'Not visited',
              n: counts.notConfirmed,
            },
            { key: 'New', label: 'New', n: counts.New, c: counts.NewC },
            { key: 'Follow', label: 'FU', n: counts.Follow, c: counts.FollowC },
            {
              key: 'Postoperative',
              label: 'PO',
              n: counts.Postoperative,
              c: counts.PostoperativeC,
            },
            { key: 'MCDPA', label: 'MCDPA', n: counts.MCDPA, c: counts.MCDPAC },
          ].map(f => {
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[st.chip, on && st.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={
                  f.c != null
                    ? `${f.label}, ${f.n}, ${f.c} confirmed`
                    : `${f.label}, ${f.n}`
                }
              >
                <Text style={[st.chipLabel, on && st.chipLabelOn]}>
                  {f.label}
                </Text>
                <Text style={[st.chipCount, on && st.chipLabelOn]}>
                  {f.n}
                  {f.c != null ? ` (${f.c})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {list.length !== rows.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(rows.length)}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      {loading && !refreshing ? (
        <>
          <SectionHeader
            code="OPD"
            name="Appointments"
            sub="Scheduled consultations"
            hue={HUE_O}
            onBack={() => navigation.goBack()}
          />
          <View style={st.centre}>
            <ActivityIndicator color={HUE_O} />
          </View>
        </>
      ) : (
        <FlatList
          data={list}
          // The endpoint returns no id, so the key is a composite. Index alone
          // would reshuffle rows on filter change and reuse the wrong ones.
          keyExtractor={(r, i) =>
            `${r.patient_phone || 'x'}-${r.appointment_timestamp || ''}-${
              r.appointment_time || ''
            }-${i}`
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
              tintColor={HUE_O}
            />
          }
          ListEmptyComponent={
            <Text style={st.empty}>
              {error || 'No appointments for this period.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Row
              a={item}
              multiDay={multiDay}
              onCall={() => call(item.patient_phone)}
              onWhatsapp={() => whatsapp(item.patient_phone)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
    <Text style={st.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[st.statVal, { color }]}>{value}</Text>
    <Text style={st.statNote}>{note}</Text>
  </View>
);

const Row = ({ a, multiDay, onCall, onWhatsapp }) => {
  const confirmed = isConfirmed(a.confirm_time);
  const hue = TYPE_HUES[a.patient_type] || T.muted2;
  const typeLabel = TYPE_LABEL[a.patient_type] || a.patient_type || '—';

  return (
    <View style={st.row}>
      <View
        style={[
          st.rowSpine,
          { backgroundColor: confirmed ? '#1E7A5A' : T.line },
        ]}
      />

      {/* Time is the anchor: an appointment list is read by when, not by who. */}
      <View style={st.timeCol}>
        <Text style={st.time}>{fmtTime(a.appointment_time)}</Text>
        {multiDay && (
          <Text style={st.day}>{fmtDay(a.appointment_timestamp)}</Text>
        )}
      </View>

      <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
        <Text style={[st.avatarText, { color: hue }]}>
          {initials(a.patient_name)}
        </Text>
      </View>

      <View style={st.main}>
        <Text style={st.name} numberOfLines={1}>
          {a.patient_name || 'Unnamed'}
        </Text>
        <View style={st.tagRow}>
          <View style={[st.tag, { borderColor: hue }]}>
            <Text style={[st.tagText, { color: hue }]}>{typeLabel}</Text>
          </View>
          {!confirmed && (
            <View style={[st.tag, { borderColor: T.crit }]}>
              <Text style={[st.tagText, { color: T.crit }]}>Not confirmed</Text>
            </View>
          )}
        </View>
        <Text style={st.phone}>{a.patient_phone || 'No number'}</Text>
        <Text style={st.meta} numberOfLines={1}>
          {a.doctor_name || 'No doctor assigned'}
          {a.FDE_Name ? ` · ${a.FDE_Name}` : ''}
        </Text>
      </View>

      <View style={st.actions}>
        <TouchableOpacity
          onPress={onCall}
          style={st.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={`Call ${a.patient_name || 'patient'}`}
        >
          <Icon name="call" size={17} color={HUE_O} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onWhatsapp}
          style={[st.actionBtn, { backgroundColor: '#E9F6EE' }]}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${a.patient_name || 'patient'}`}
        >
          <Icon name="chat" size={17} color="#1E7A5A" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AppointmentsScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16 },

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
    fontSize: 21,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
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
    marginTop: 14,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },

  chipOn: { backgroundColor: HUE_O, borderColor: HUE_O },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipLabelOn: { color: '#fff', fontFamily: F.medium },

  showing: { fontSize: 10, color: T.muted2, marginTop: 10, fontFamily: F.mono },

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
    paddingRight: 10,
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
  timeCol: { width: 52 },
  time: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    letterSpacing: -0.2,
  },
  day: { fontFamily: F.mono, fontSize: 9, color: T.muted2, marginTop: 2 },

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
  tagRow: { flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.6 },
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 4,
    fontFamily: F.regular,
  },
  phone: { fontFamily: F.mono, fontSize: 11, color: T.text, marginTop: 4 },

  actions: { gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#EAF1F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 40,
    fontFamily: F.regular,
    fontSize: 13,
  },
  filters: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 10,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: T.card,
  },
  chipCount: { fontFamily: F.mono, fontSize: 11, color: T.muted2 },
});
