/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/CallingCalendarScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// The day's call list. Replaces src/admin/CallingList.js. Same endpoint, same
// six categories, same rows.
//
//   GET /callingList/v1?location=&date=
//
// ⚠️ ONE DATE, NOT A RANGE — SO NO SCOPE CHIP
// ───────────────────────────────────────────
// The endpoint takes a single `date` and the model computes DATEDIFF against
// it, returning everyone who is 3, 7, 15 or 30 days past their visit. The
// screen carries its own date button; the section's range chip would be
// meaningless here.
//
// ⚠️ IST, NOT DEVICE LOCAL
// ────────────────────────
// getTodayISTDate adds 5h30m to UTC and reads the UTC fields — the same trick
// AdminHome and scopeSlice use. On a phone set to another timezone, the device
// date would ask the server for the wrong day's calls.
//
// WHAT CHANGED
// ────────────
// Six react-native-tab-view tabs became six chips, which removes a dependency
// and lets the counts show without opening each tab. Within a category the
// rows are GROUPED BY FOLLOW-UP DAY — Day 3, Day 7, Day 15, Day 30, Callback —
// because that is how the list is worked: day-3 calls are a different script
// from day-30 ones, and the old flat list mixed them with only a small avatar
// badge to tell them apart.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, num } from '../design/tokens';

const HUE_L = HUE.leads;

// Keys are the API's own, and the order is the old tab order.
const CATEGORIES = [
  { key: 'SurgeryOPD', label: 'Surgery', color: '#B3523B' },
  { key: 'MedicationOPD', label: 'Medication', color: '#2F6FA8' },
  { key: 'TestOPD', label: 'Test', color: '#6E5AA8' },
  { key: 'Enquiry', label: 'Enquiry', color: '#B26A00' },
  { key: 'PostOp', label: 'Post-op', color: '#1E7A5A' },
  { key: 'MCDPA', label: 'MCDPA', color: '#3E8C8C' },
];

// The four follow-up days the model returns, plus CB. Ordered soonest first —
// a day-3 call is the most time-sensitive.
const DAY_ORDER = ['3', '7', '15', '30', 'CB'];

const dayLabel = d => (String(d) === 'CB' ? 'Call back' : `Day ${d} follow-up`);

// Urgency by age: the day-3 call still has momentum, the day-30 one is a cold
// re-approach. CB is its own thing — someone asked to be called.
const dayColor = d => {
  const s = String(d);
  if (s === 'CB') return '#A8567F';
  if (s === '3') return '#B3382B';
  if (s === '7') return '#B26A00';
  return '#6C7C75';
};

// IST wall clock — see the header.
const getTodayISTDate = date => {
  const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(
    ist.getUTCDate(),
  )}`;
};

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
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
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

/**
 * calling_notes is a JSON STRING of [{ note, date }]. The model already strips
 * blank entries, but a malformed blob must not take the row down — it simply
 * shows no notes.
 */
const parseNotes = raw => {
  if (!raw) return [];
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter(n => n && n.note) : [];
  } catch (_) {
    return [];
  }
};

const CallingCalendarScreen = ({ navigation }) => {
  const location = useSelector(s => s.location.value);

  const [date, setDate] = useState(getTodayISTDate(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('SurgeryOPD');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(await get('/callingList/v2', { location, date }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, date],
  );

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { total: 0 };
    for (const cat of CATEGORIES) {
      const n = (data?.[cat.key] || []).length;
      c[cat.key] = n;
      c.total += n;
    }
    return c;
  }, [data]);

  const rows = useMemo(() => data?.[category] || [], [data, category]);

  /** Grouped by follow-up day, soonest first. */
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = digits(q);

    const filtered = q
      ? rows.filter(
          r =>
            String(r.name || '')
              .toLowerCase()
              .includes(q) ||
            (!!qd && digits(r.phone).includes(qd)) ||
            String(r.diagnosis || '')
              .toLowerCase()
              .includes(q),
        )
      : rows;

    const byDay = {};
    for (const r of filtered) {
      const key = String(r.days_since ?? '');
      (byDay[key] = byDay[key] || []).push(r);
    }

    // DAY_ORDER first, then anything unexpected the model returns — a value
    // outside 3/7/15/30/CB is a data question, and dropping it would hide it.
    const keys = [
      ...DAY_ORDER.filter(k => byDay[k]),
      ...Object.keys(byDay).filter(k => !DAY_ORDER.includes(k)),
    ];

    return keys.map(k => ({ key: k, title: dayLabel(k), data: byDay[k] }));
  }, [rows, query]);

  const shown = sections.reduce((a, s) => a + s.data.length, 0);

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

  const activeCat = CATEGORIES.find(c => c.key === category) || CATEGORIES[0];

  const header = (
    <View>
      <SectionHeader
        code="LEADS"
        name="Calling Calendar"
        sub="Follow-up calls due on the selected day"
        hue={HUE_L}
        hideScope
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.topRow}>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            style={st.dateBtn}
            accessibilityRole="button"
            accessibilityLabel={`Calls due on ${fmtDate(date)}. Change date`}
          >
            <Icon name="event" size={16} color={HUE_L} />
            <Text style={st.dateText}>{fmtDate(date)}</Text>
            <Icon name="expand-more" size={17} color={HUE_L} />
          </TouchableOpacity>

          <View style={st.totalBox}>
            <Text style={st.totalVal}>{num(counts.total)}</Text>
            <Text style={st.totalLabel}>CALLS DUE</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {CATEGORIES.map(c => {
            const on = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[
                  st.chip,
                  on && { backgroundColor: c.color, borderColor: c.color },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.label}, ${counts[c.key]} calls`}
              >
                <Text style={[st.chipLabel, on && st.chipOnText]}>
                  {c.label}
                </Text>
                <Text style={[st.chipCount, on && st.chipOnText]}>
                  {counts[c.key] ?? 0}
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
            placeholder="Patient, phone or diagnosis"
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

        {shown !== rows.length && (
          <Text style={st.showing}>
            Showing {num(shown)} of {num(rows.length)} {activeCat.label} calls
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <SectionList
        sections={loading ? [] : sections}
        keyExtractor={(item, i) => String(item.id ?? `${item.patient_id}-${i}`)}
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
            tintColor={HUE_L}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={st.sectionHead}>
            <View
              style={[st.dot, { backgroundColor: dayColor(section.key) }]}
            />
            <Text style={st.sectionTitle}>{section.title}</Text>
            <Text style={st.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={HUE_L} />
            </View>
          ) : (
            <Text style={st.empty}>
              {error ||
                `No ${activeCat.label.toLowerCase()} calls due on this day.`}
            </Text>
          )
        }
        renderItem={({ item, section }) => (
          <Row
            r={item}
            dayKey={section.key}
            catColor={activeCat.color}
            onCall={() => call(item.phone)}
            onWhatsapp={() => whatsapp(item.phone)}
          />
        )}
      />

      <DatePicker
        modal
        mode="date"
        open={pickerOpen}
        date={new Date(`${date}T00:00:00`)}
        maximumDate={new Date()}
        onConfirm={d => {
          setPickerOpen(false);
          setDate(getTodayISTDate(d));
        }}
        onCancel={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
};

const Row = ({ r, dayKey, catColor, onCall, onWhatsapp }) => {
  const notes = parseNotes(r.calling_notes);
  const dc = dayColor(dayKey);

  return (
    <View style={[st.row, r.operated && st.rowOperated]}>
      <View style={[st.rowSpine, { backgroundColor: dc }]} />

      <View style={st.rowHead}>
        <View style={[st.avatar, { backgroundColor: `${catColor}18` }]}>
          <Text style={[st.avatarText, { color: catColor }]}>
            {initials(r.name)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>
            {r.name || 'Unnamed'}
          </Text>
          <Text style={st.phone}>{r.phone || 'No number'}</Text>
          <Text style={st.meta} numberOfLines={1}>
            Seen {fmtDate(r.date)}
            {r.operatedOn ? ` · operated ${fmtDate(r.operatedOn)}` : ''}
            {r.doctor_name ? ` · ${r.doctor_name}` : ''}
          </Text>
        </View>
        {r.operated && (
          <View style={st.opBadge}>
            <Icon name="healing" size={11} color="#1E7A5A" />
            <Text style={st.opText}>Operated</Text>
          </View>
        )}

        {/* Already-called is the single most useful thing when working down
            this list, so it is a badge rather than buried in the notes. */}
        {notes.length > 0 && (
          <View style={st.doneBadge}>
            <Icon name="check" size={11} color="#1E7A5A" />
            <Text style={st.doneText}>{notes.length}</Text>
          </View>
        )}
      </View>

      {(r.diagnosis || r.surgical_procedure) && (
        <View style={st.tagRow}>
          {!!r.diagnosis && (
            <View style={st.tag}>
              <Text style={st.tagText} numberOfLines={1}>
                {r.diagnosis}
              </Text>
            </View>
          )}
          {!!r.surgical_procedure && (
            <View style={st.tag}>
              <Text style={st.tagText} numberOfLines={1}>
                {r.surgical_procedure}
              </Text>
            </View>
          )}
        </View>
      )}

      {notes.length > 0 && (
        <View style={st.notes}>
          <Text style={st.notesLabel}>ACTION TAKEN</Text>
          {notes.map((n, i) => (
            <View key={i} style={st.note}>
              <Text style={st.noteText}>{n.note}</Text>
              <Text style={st.noteDate}>{fmtDate(n.date)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={st.actions}>
        <TouchableOpacity
          onPress={onCall}
          style={[st.action, { backgroundColor: HUE_L }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${r.name}`}
        >
          <Icon name="call" size={15} color="#fff" />
          <Text style={st.actionTextOn}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onWhatsapp}
          style={st.actionGhost}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${r.name}`}
        >
          <Icon name="chat" size={15} color="#1E7A5A" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CallingCalendarScreen;

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
    paddingHorizontal: 24,
  },

  topRow: { flexDirection: 'row', gap: 9, marginTop: -30 },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 13,
  },
  dateText: { flex: 1, fontFamily: F.mono, fontSize: 13, color: T.text },
  totalBox: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalVal: {
    fontFamily: F.mono,
    fontSize: 18,
    color: T.text,
    letterSpacing: -0.4,
  },
  totalLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
    marginTop: 3,
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

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 2 },
  sectionTitle: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: T.muted,
  },
  sectionCount: { fontFamily: F.mono, fontSize: 11, color: T.text },

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
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },

  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E7F2EC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  doneText: { fontFamily: F.mono, fontSize: 10, color: '#1E7A5A' },

  tagRow: { flexDirection: 'row', gap: 5, marginTop: 9, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  tagText: { fontSize: 10.5, color: T.muted, fontFamily: F.regular },

  notes: {
    borderLeftWidth: 2,
    borderLeftColor: '#E0A93B',
    backgroundColor: '#FBF6EC',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 9,
  },
  notesLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
    marginBottom: 5,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 16,
  },
  noteDate: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2 },

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
  // A tint, not a border swap — the spine already carries follow-up urgency,
  // and two competing edge colours on one card is unreadable.
  rowOperated: { backgroundColor: '#F2F8F5', borderColor: '#CBE4D8' },
  opBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E7F2EC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  opText: {
    fontFamily: F.mono,
    fontSize: 8.5,
    color: '#1E7A5A',
    letterSpacing: 0.5,
  },
});
