/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IVRCallsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// IVR call log. Replaces src/admin/IVRCallList.js. Same endpoint, same rows.
//
// ⚠️ TWO THINGS TO CONFIRM AGAINST THE OLD FILE BEFORE SHIPPING
// ─────────────────────────────────────────────────────────────
// 1. ENDPOINT below is my reading of the route. Copy the exact string from
//    IVRCallList.js's fetch — a wrong path shows an empty list with an error
//    line rather than crashing, which is easy to miss.
//
// 2. The old screen tints a row amber (#FFB300) when it carries a note, and the
//    approval flow writes those notes. If IVRCallList.js also lets a user ADD
//    or edit a note, that is a feature this rewrite does not carry — say so and
//    it goes back in. Notes are displayed here, not editable.
//
// WHAT CHANGED
// ────────────
// The old row was two 48%-wide columns of nested Views with a 30px PNG for the
// call icon, and the caller's number sat at the same weight as the date. Now
// the number is the only large text, status is the spine colour plus one badge,
// and the date/time sits right-aligned in mono.
//
// Missed calls lead: this log is worked to find people who could not get
// through, so "Missed" is the first filter chip and missed rows carry a red
// spine and a tappable call button.
//
// ⚠️ THE DATE FORMAT IS '%Y-%d-%m' — YEAR, DAY, MONTH
// ───────────────────────────────────────────────────
// Every query against IVRdata in this codebase parses call_date with
// STR_TO_DATE(call_date, '%Y-%d-%m') — day and month are the other way round
// from the usual. `parseIvrDate` below follows that, so a call on 3 August
// stored as "2026-03-08" reads as 3 Aug and not 8 March. Do not "fix" it here
// alone; the backend would then disagree.
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

// ⚠️ See the header note — verify against IVRCallList.js.
const ENDPOINT = '/IVRCall';

const HUE_L = HUE.leads;

const ANSWERED = '#1E7A5A';
const MISSED = '#B3382B';

const isMissed = r => String(r.call_status || '').toLowerCase() === 'missed';

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

/**
 * call_date is stored year-day-month. See the header — this matches
 * STR_TO_DATE(call_date, '%Y-%d-%m') used by every query in the codebase.
 */
const parseIvrDate = raw => {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, d, mo] = m;
  return { y: Number(y), m: Number(mo), d: Number(d) };
};

const fmtIvrDate = raw => {
  const p = parseIvrDate(raw);
  if (!p) return String(raw || '—');
  return `${p.d} ${MONTHS[p.m - 1] || '?'}`;
};

// Sort key, so the list can be ordered even though the stored string is not
// sortable in its own right.
const sortKey = r => {
  const p = parseIvrDate(r.call_date);
  const t = String(r.call_time || '').replace(/\D/g, '');
  return p
    ? `${p.y}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}${t}`
    : '0';
};

// call_duration arrives as seconds on some branches and 'mm:ss' on others.
const fmtDuration = v => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.includes(':')) return s;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  const m = Math.floor(n / 60);
  return m > 0 ? `${m}m ${n % 60}s` : `${n}s`;
};

const IVRCallsScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

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
        const res = await get(ENDPOINT, { location, from, to, status: '' });
        const list = Array.isArray(res) ? res : res?.data || [];
        setRows([...list].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
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
    const c = { all: rows.length, missed: 0, answered: 0, noted: 0 };
    for (const r of rows) {
      if (isMissed(r)) c.missed++;
      else c.answered++;
      if (String(r.note || '').trim()) c.noted++;
    }
    return c;
  }, [rows]);

  const list = useMemo(() => {
    let out = rows;
    if (filter === 'missed') out = out.filter(isMissed);
    else if (filter === 'answered') out = out.filter(r => !isMissed(r));
    else if (filter === 'noted')
      out = out.filter(r => String(r.note || '').trim());

    const q = query.trim();
    if (!q) return out;
    const qd = digits(q);
    const ql = q.toLowerCase();
    return out.filter(
      r =>
        (!!qd && digits(r.caller_no).includes(qd)) ||
        String(r.destination_name || '')
          .toLowerCase()
          .includes(ql) ||
        String(r.circle_name || '')
          .toLowerCase()
          .includes(ql),
    );
  }, [rows, filter, query]);

  const call = number => {
    const d = digits(number);
    if (!d) return Alert.alert('No number', 'This call has no caller number.');
    Linking.openURL(`tel:${d}`);
  };

  const header = (
    <View>
      <SectionHeader
        code="LEADS"
        name="IVR Calls"
        sub="Answered and missed calls to the branch line"
        hue={HUE_L}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Calls"
            value={num(counts.all)}
            note="in this period"
            color={T.text}
          />
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
            value={num(counts.answered)}
            note="picked up"
            color={ANSWERED}
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
              key: 'answered',
              label: 'Answered',
              n: counts.answered,
              c: ANSWERED,
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
            placeholder="Number, destination or circle"
            placeholderTextColor={T.muted2}
            style={st.search}
            keyboardType="default"
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
        keyExtractor={(r, i) => String(r.ivr_id ?? `${r.caller_no}-${i}`)}
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
          <Row r={item} onCall={() => call(item.caller_no)} />
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

const Row = ({ r, onCall }) => {
  const missed = isMissed(r);
  const hue = missed ? MISSED : ANSWERED;
  const duration = fmtDuration(r.call_duration);
  const note = String(r.note || '').trim();
  const destination = r.destination_name || r.destination_no || '';

  return (
    <View style={st.row}>
      <View style={[st.rowSpine, { backgroundColor: hue }]} />

      <View style={[st.icon, { backgroundColor: `${hue}18` }]}>
        <Icon
          name={missed ? 'call-missed' : 'call-received'}
          size={17}
          color={hue}
        />
      </View>

      <View style={st.main}>
        <Text style={st.number}>{r.caller_no || 'Unknown number'}</Text>
        <Text style={st.meta} numberOfLines={1}>
          {missed ? 'Missed' : duration ? `Answered · ${duration}` : 'Answered'}
          {destination ? ` · ${destination}` : ''}
          {r.circle_name ? ` · ${r.circle_name}` : ''}
        </Text>
        {/* The old screen tinted the whole row amber when a note existed. A
            tinted card is hard to scan past; the note itself is the signal, so
            it is printed. */}
        {!!note && (
          <View style={st.noteBox}>
            <Text style={st.noteText}>{note}</Text>
          </View>
        )}
      </View>

      <View style={st.right}>
        <Text style={st.date}>{fmtIvrDate(r.call_date)}</Text>
        <Text style={st.time}>{r.call_time || ''}</Text>
        <TouchableOpacity
          onPress={onCall}
          style={[st.callBtn, { backgroundColor: `${hue}14` }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${r.caller_no}`}
        >
          <Icon name="call" size={16} color={hue} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default IVRCallsScreen;

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
  number: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 4,
    fontFamily: F.regular,
  },
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
