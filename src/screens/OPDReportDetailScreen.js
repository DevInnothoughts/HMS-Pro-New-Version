/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/OPDReportDetailScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// The visit-type drill-down: tapping New / Follow-up / Post-op / C+P on the
// Outpatient section lands here. Same endpoint (/Dashboard/OPDReport), same
// four filters, same gender counts, same call and WhatsApp actions.
//
// THE DNT RULE IS COPIED, NOT REWRITTEN
// ─────────────────────────────────────
// DNT ("did not turn up") is not simply is_deleted = 1. The old screen:
//   1. takes deleted rows,
//   2. de-duplicates them by phone — a patient who rebooked twice and dropped
//      out counts once,
//   3. removes anyone who ALSO has a confirmed appointment in the set, because
//      a cancelled slot followed by an attended one is not a no-show.
// That is a real business rule, reproduced exactly. Simplifying it to
// is_deleted = 1 would inflate every branch's DNT number.
//
// Note the two totals do not sum: `total` excludes deleted rows, DNT counts
// only deleted ones. That is the old screen's behaviour and the chips are
// labelled so it reads correctly rather than looking like an arithmetic error.
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

// patientType param → title and accent, matching the visit-type cards on the
// Outpatient section so the colour carries through the tap.
const TYPES = {
  new: { name: 'New Patients', hue: '#2F6FA8' },
  follow: { name: 'Follow-up Patients', hue: '#3E8C8C' },
  postoperative: { name: 'Post-op Patients', hue: '#7A5EA8' },
  proctoscopy: { name: 'C+P Patients', hue: '#B3762B' },
};

const isConfirmed = v => {
  const s = String(v ?? '').trim();
  return s !== '' && s !== '0';
};

const digits = p => String(p || '').replace(/\D/g, '');

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

const fmtTime = t => {
  const s = String(t || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s || '—';
  let h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suffix}`;
};

const OPDReportDetailScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);

  const location = route?.params?.location || reduxLocation;
  const patientType = route?.params?.patientType || 'new';

  const type = TYPES[patientType] || { name: 'OPD Patients', hue: HUE_O };

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
        const res = await get('/Dashboard/OPDReport', {
          location,
          from,
          to,
          patientType,
        });
        setRows(res?.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, from, to, patientType],
  );

  useEffect(() => {
    load();
  }, [load]);

  // The old screen's DNTFilter, unchanged. See the header note.
  const dnt = useMemo(() => {
    const seen = new Set();
    const uniqueDeleted = [];
    for (const p of rows) {
      if (p.is_deleted !== 1) continue;
      const key = p.patient_phone;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueDeleted.push(p);
    }
    const confirmedPhones = new Set(
      rows
        .filter(p => p.confirm_time !== '0' && p.confirm_time !== 0)
        .map(p => p.patient_phone),
    );
    return uniqueDeleted.filter(p => !confirmedPhones.has(p.patient_phone));
  }, [rows]);

  const counts = useMemo(() => {
    const c = {
      total: 0,
      confirmed: 0,
      notConfirmed: 0,
      pending: 0,
      dnt: dnt.length,
    };
    const gender = { male: 0, female: 0, other: 0 };
    for (const p of rows) {
      if (p.is_deleted === 1) continue;
      c.total++;
      if (isConfirmed(p.confirm_time)) {
        c.confirmed++;
        // Confirmed but no receipt raised — executivechk is set to 2 when the
        // visit is billed, so anything else is still pending.
        if (p.executivechk !== 2) c.pending++;
      } else {
        c.notConfirmed++;
      }
      if (p.gender === 'Male') gender.male++;
      else if (p.gender === 'Female') gender.female++;
      else gender.other++;
    }
    return { ...c, gender };
  }, [rows, dnt]);

  const list = useMemo(() => {
    let out;
    if (filter === 'DNT') out = dnt;
    else if (filter === 'Confirm')
      out = rows.filter(p => isConfirmed(p.confirm_time) && p.is_deleted !== 1);
    else if (filter === 'notConfirmed')
      out = rows.filter(
        p => !isConfirmed(p.confirm_time) && p.is_deleted !== 1,
      );
    else if (filter === 'Pending')
      out = rows.filter(
        p =>
          isConfirmed(p.confirm_time) &&
          p.executivechk !== 2 &&
          p.is_deleted !== 1,
      );
    else out = rows.filter(p => p.is_deleted !== 1);

    const q = query.trim().toLowerCase();
    if (!q) return out;
    // Only match on phone when the query has digits — digits('john') is '',
    // and includes('') matches every row.
    const qd = digits(q);
    return out.filter(
      p =>
        String(p.patient_name || '')
          .toLowerCase()
          .includes(q) ||
        String(p.doctor_name || '')
          .toLowerCase()
          .includes(q) ||
        (!!qd && digits(p.patient_phone).includes(qd)),
    );
  }, [rows, dnt, filter, query]);

  const call = phone => {
    const d = digits(phone);
    if (!d)
      return Alert.alert('No number', 'This patient has no phone number.');
    Linking.openURL(`tel:${d}`);
  };

  const whatsapp = phone => {
    const d = digits(phone);
    if (!d)
      return Alert.alert('No number', 'This patient has no phone number.');
    const withCode = d.length === 10 ? `91${d}` : d;
    Linking.openURL(`whatsapp://send?phone=${withCode}`).catch(() =>
      Alert.alert(
        'WhatsApp unavailable',
        'WhatsApp does not appear to be installed.',
      ),
    );
  };

  const multiDay = from !== to;

  const header = (
    <View>
      <SectionHeader
        code="OPD"
        name={type.name}
        sub={multiDay ? `${fmtDay(from)} – ${fmtDay(to)}` : fmtDay(from)}
        hue={type.hue}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Patients"
            value={num(counts.total)}
            note="excluding DNT"
            color={T.text}
          />
          <Stat
            label="Confirmed"
            value={num(counts.confirmed)}
            note={`${counts.notConfirmed} not confirmed`}
            color="#1E7A5A"
          />
          <Stat
            label="M / F / O"
            value={`${counts.gender.male}/${counts.gender.female}`}
            note={`${counts.gender.other} other`}
            color={type.hue}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {[
            { key: 'all', label: 'All', n: counts.total },
            { key: 'Confirm', label: 'Confirmed', n: counts.confirmed },
            {
              key: 'notConfirmed',
              label: 'Not confirmed',
              n: counts.notConfirmed,
            },
            { key: 'Pending', label: 'Receipt pending', n: counts.pending },
            { key: 'DNT', label: 'DNT', n: counts.dnt },
          ].map(f => {
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  st.chip,
                  on && { backgroundColor: type.hue, borderColor: type.hue },
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

        {filter === 'DNT' && (
          // Explains why the chips do not add up — DNT sits outside `total`.
          <Text style={st.note}>
            Patients whose appointment was cancelled and who did not attend
            another one in this period.
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
            name={type.name}
            sub="Loading"
            hue={type.hue}
            onBack={() => navigation.goBack()}
          />
          <View style={st.centre}>
            <ActivityIndicator color={type.hue} />
          </View>
        </>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p, i) =>
            `${p.patient_phone || 'x'}-${p.appointment_timestamp || ''}-${i}`
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
              tintColor={type.hue}
            />
          }
          ListEmptyComponent={
            <Text style={st.empty}>{error || 'No patients in this view.'}</Text>
          }
          renderItem={({ item }) => (
            <Row
              p={item}
              hue={type.hue}
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
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote}>{note}</Text>
  </View>
);

const Row = ({ p, hue, multiDay, onCall, onWhatsapp }) => {
  const confirmed = isConfirmed(p.confirm_time);
  const billed = p.executivechk === 2;
  const dropped = p.is_deleted === 1;

  return (
    <View style={st.row}>
      <View
        style={[
          st.rowSpine,
          {
            backgroundColor: dropped ? T.crit : confirmed ? '#1E7A5A' : T.line,
          },
        ]}
      />

      <View style={st.timeCol}>
        <Text style={st.time}>{fmtTime(p.appointment_time)}</Text>
        {multiDay && (
          <Text style={st.day}>{fmtDay(p.appointment_timestamp)}</Text>
        )}
      </View>

      <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
        <Text style={[st.avatarText, { color: hue }]}>
          {initials(p.patient_name)}
        </Text>
      </View>

      <View style={st.main}>
        <Text style={st.name} numberOfLines={1}>
          {p.patient_name || 'Unnamed'}
        </Text>
        <Text style={st.phone}>{p.patient_phone || 'No number'}</Text>
        <View style={st.tagRow}>
          {dropped ? (
            <Tag label="Cancelled" color={T.crit} />
          ) : !confirmed ? (
            <Tag label="Not confirmed" color={T.crit} />
          ) : !billed ? (
            <Tag label="Receipt pending" color="#B26A00" />
          ) : null}
          {!!p.gender && <Tag label={p.gender} color={T.muted2} />}
        </View>
      </View>

      <View style={st.actions}>
        <TouchableOpacity
          onPress={onCall}
          style={[st.actionBtn, { backgroundColor: `${hue}14` }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${p.patient_name || 'patient'}`}
        >
          <Icon name="call" size={17} color={hue} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onWhatsapp}
          style={[st.actionBtn, { backgroundColor: '#E9F6EE' }]}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${p.patient_name || 'patient'}`}
        >
          <Icon name="chat" size={17} color="#1E7A5A" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Tag = ({ label, color }) => (
  <View style={[st.tag, { borderColor: color }]}>
    <Text style={[st.tagText, { color }]}>{label}</Text>
  </View>
);

export default OPDReportDetailScreen;

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
  note: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 10,
    fontFamily: F.regular,
    lineHeight: 14,
  },

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
  timeCol: { width: 50 },
  time: {
    fontFamily: F.mono,
    fontSize: 12,
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
  phone: { fontFamily: F.mono, fontSize: 11, color: T.text, marginTop: 3 },
  tagRow: { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.6 },

  actions: { gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
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
});
