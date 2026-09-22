/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/HelplineCallsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Helpline call log. Replaces src/admin/HelplineCallList.js. Same endpoint,
// same rows, same actions.
//
//   GET /HelplineCall?location=&from=&to=&status=
//
// THREE DIFFERENCES FROM THE IVR SCREEN, ALL FROM THE DATA
// ────────────────────────────────────────────────────────
// 1. `timestamp` is EPOCH MILLIS, stored as a string on some branches — hence
//    Number() before the Date. IVR stores a formatted date string instead.
//
// 2. There are THREE types, not two: INCOMING, OUTGOING and MISSED. This is a
//    two-way line, so calls the branch made are part of the record — an
//    outgoing call right after a missed one is the call-back, and that is the
//    single most useful pattern on this screen.
//
// 3. `UNKNOWN` means MISSED. Every query in this codebase treats them as one
//    (`p.type IN ('MISSED','UNKNOWN')` in dashboardModel), and so does this —
//    a separate "Unknown" chip would split one real category in two.
//
// ⚠️ CONFIRM THE ENDPOINT AND THE `status` PARAM
// ──────────────────────────────────────────────
// HelplineCallList.js interpolates `status` straight into the URL. Passing
// nothing makes it the literal string "undefined", which the model treats as a
// type filter and returns zero rows — the same bug the IVR screen had. `status:
// ''` is passed explicitly below for that reason. There is also a /v2 of this
// endpoint that returns calls GROUPED BY NUMBER; this screen uses the flat v1,
// matching the old list.
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

const ANSWERED = '#1E7A5A';
const MISSED = '#B3382B';
const OUTGOING = '#2F6FA8';

// UNKNOWN is MISSED — see the header.
const kindOf = r => {
  const t = String(r.type || '').toUpperCase();
  if (t === 'INCOMING') return 'incoming';
  if (t === 'OUTGOING') return 'outgoing';
  return 'missed';
};

const KINDS = {
  incoming: { label: 'Answered', color: ANSWERED, icon: 'call-received' },
  outgoing: { label: 'Outgoing', color: OUTGOING, icon: 'call-made' },
  missed: { label: 'Missed', color: MISSED, icon: 'call-missed' },
};

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

// Epoch millis, as a string on some branches.
const toDate = ts => {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDay = ts => {
  const d = toDate(ts);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '—';
};

const fmtTime = ts => {
  const d = toDate(ts);
  if (!d) return '';
  const h = d.getHours() % 12 || 12;
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
};

// duration is seconds. Zero on a missed call, where it means nothing.
const fmtDuration = v => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const m = Math.floor(n / 60);
  return m > 0 ? `${m}m ${n % 60}s` : `${n}s`;
};

const HelplineCallsScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('missed');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        // status: '' — never undefined. See the header note.
        const res = await get('/HelplineCall', {
          location,
          from,
          to,
          status: '',
        });
        const list = Array.isArray(res) ? res : res?.data || [];
        setRows(
          [...list].sort(
            (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0),
          ),
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

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      missed: 0,
      incoming: 0,
      outgoing: 0,
      noted: 0,
    };
    for (const r of rows) {
      c[kindOf(r)]++;
      if (String(r.note || '').trim()) c.noted++;
    }
    return c;
  }, [rows]);

  /**
   * Numbers the branch called back, so a missed call can say whether anyone
   * returned it. Built from the outgoing rows in the SAME window — a call-back
   * made the next morning on a one-day range will not be seen, which is worth
   * knowing before reading "not returned" as neglect.
   */
  const calledBack = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      if (kindOf(r) === 'outgoing') set.add(digits(r.phoneNumber));
    }
    return set;
  }, [rows]);

  const list = useMemo(() => {
    let out = rows;
    if (filter === 'noted') out = out.filter(r => String(r.note || '').trim());
    else if (filter !== 'all') out = out.filter(r => kindOf(r) === filter);

    const q = query.trim();
    if (!q) return out;
    const qd = digits(q);
    const ql = q.toLowerCase();
    return out.filter(
      r =>
        (!!qd && digits(r.phoneNumber).includes(qd)) ||
        String(r.name || '')
          .toLowerCase()
          .includes(ql) ||
        String(r.note || '')
          .toLowerCase()
          .includes(ql),
    );
  }, [rows, filter, query]);

  const call = number => {
    const d = digits(number);
    if (!d) return Alert.alert('No number', 'This call has no number.');
    Linking.openURL(`tel:${d}`);
  };

  const header = (
    <View>
      <SectionHeader
        code="LEADS"
        name="Helpline Calls"
        sub="Incoming, missed and outgoing calls on the helpline"
        hue={HUE_L}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Missed"
            value={num(counts.missed)}
            note={
              counts.all > 0
                ? `${Math.round((counts.missed / counts.all) * 100)}% of calls`
                : 'none'
            }
            color={MISSED}
          />
          <Stat
            label="Answered"
            value={num(counts.incoming)}
            note="picked up"
            color={ANSWERED}
          />
          <Stat
            label="Outgoing"
            value={num(counts.outgoing)}
            note="calls made"
            color={OUTGOING}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {[
            { key: 'missed', label: 'Missed', n: counts.missed, c: MISSED },
            { key: 'all', label: 'All', n: counts.all, c: HUE_L },
            {
              key: 'incoming',
              label: 'Answered',
              n: counts.incoming,
              c: ANSWERED,
            },
            {
              key: 'outgoing',
              label: 'Outgoing',
              n: counts.outgoing,
              c: OUTGOING,
            },
            { key: 'noted', label: 'With note', n: counts.noted, c: '#B26A00' },
          ].map(f => {
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
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
            placeholder="Number, name or note"
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
            Showing {num(list.length)} of {num(rows.length)} calls
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        // phonecalllogs has no id, and one number appears many times — the key
        // needs the timestamp AND the index to stay unique.
        keyExtractor={(r, i) => `${r.phoneNumber}-${r.timestamp}-${i}`}
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
            <Text style={st.empty}>{error || 'No calls in this view.'}</Text>
          )
        }
        renderItem={({ item }) => (
          <Row
            r={item}
            returned={calledBack.has(digits(item.phoneNumber))}
            onCall={() => call(item.phoneNumber)}
          />
        )}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
    <Text style={st.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

const Row = ({ r, returned, onCall }) => {
  const kind = kindOf(r);
  const meta = KINDS[kind];
  const duration = fmtDuration(r.duration);
  const note = String(r.note || '').trim();

  return (
    <View style={st.row}>
      <View style={[st.rowSpine, { backgroundColor: meta.color }]} />

      <View style={[st.icon, { backgroundColor: `${meta.color}18` }]}>
        <Icon name={meta.icon} size={17} color={meta.color} />
      </View>

      <View style={st.main}>
        {/* A name is present only when the number is in the phone's contacts,
            so the NUMBER stays the identity and the name sits above it when
            there is one. */}
        {!!r.name && (
          <Text style={st.name} numberOfLines={1}>
            {r.name}
          </Text>
        )}
        <Text style={[st.number, !!r.name && st.numberSmall]}>
          {r.phoneNumber || 'Unknown number'}
        </Text>

        <View style={st.tagRow}>
          <Text style={[st.kind, { color: meta.color }]}>{meta.label}</Text>
          {!!duration && <Text style={st.dot}>·</Text>}
          {!!duration && <Text style={st.duration}>{duration}</Text>}
          {/* The sharpest signal on this screen: a missed call nobody rang
              back. Only shown on missed rows — on an answered call it would
              be noise. */}
          {kind === 'missed' && (
            <>
              <Text style={st.dot}>·</Text>
              <Text
                style={[
                  st.returned,
                  returned ? { color: ANSWERED } : { color: MISSED },
                ]}
              >
                {returned ? 'Called back' : 'Not returned'}
              </Text>
            </>
          )}
        </View>

        {!!note && (
          <View style={st.noteBox}>
            <Text style={st.noteText}>{note}</Text>
          </View>
        )}
      </View>

      <View style={st.right}>
        <Text style={st.date}>{fmtDay(r.timestamp)}</Text>
        <Text style={st.time}>{fmtTime(r.timestamp)}</Text>
        <TouchableOpacity
          onPress={onCall}
          style={[st.callBtn, { backgroundColor: `${meta.color}14` }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${r.phoneNumber}`}
        >
          <Icon name="call" size={16} color={meta.color} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HelplineCallsScreen;

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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingLeft: 13,
    paddingRight: 12,
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
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  main: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  number: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.2,
  },
  numberSmall: { fontSize: 11.5, color: T.muted2, marginTop: 3 },

  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  kind: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6 },
  dot: { fontSize: 9.5, color: T.chevron },
  duration: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2 },
  returned: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.4 },

  noteBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#E0A93B',
    backgroundColor: '#FBF6EC',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 9,
    marginTop: 7,
  },
  noteText: {
    fontSize: 11,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 16,
  },

  right: { alignItems: 'flex-end' },
  date: { fontFamily: F.mono, fontSize: 10.5, color: T.text },
  time: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2, marginTop: 3 },
  callBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
