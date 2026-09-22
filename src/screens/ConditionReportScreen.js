/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/ConditionReportScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Condition-wise report. Replaces src/admin/ConditionwiseReport.js and
// src/admin/SpecialityAnalytics.jsx — both read the same endpoint.
//
//   GET /report/conditionwiseReport?location=&from=&to=
//        → { conditionwiseReport: [{ speciality, patient_count }],
//            missingDiagReport:   [{ patient_id, Uid_no, name, sex, age,
//                                    phone, mobile_2, ref, occupation,
//                                    address, visit_date }] }
//
// ⚠️ THE TWO HALVES COUNT DIFFERENT THINGS
// ────────────────────────────────────────
// conditionwiseReport counts DISTINCT patients per speciality from `diagnosis`,
// filtered on `symptoms != ''`.
//
// missingDiagReport lists NEW, confirmed, billed patients (patient_type='New',
// confirm_time != '0', executivechk = 2, ConfirmPatient = 1) who have NO
// diagnosis row at all — and that NOT EXISTS is unbounded by date, so it means
// "never diagnosed", not "not diagnosed in this period".
//
// So the two do not add up to the branch's patients and are not meant to. They
// answer "what are we treating" and "whose record is incomplete".
//
// ⚠️ A PATIENT WITH TWO SPECIALITIES IS COUNTED IN BOTH
// ─────────────────────────────────────────────────────
// COUNT(DISTINCT patient_id) GROUP BY speciality is distinct WITHIN a
// speciality, not across them. Summing the rows therefore exceeds the real
// patient count, which is why the header reports the sum as "diagnoses
// recorded" rather than as patients.
//
// WHAT CHANGED
// ────────────
// The old screen measured its bars against `width - 120` from Dimensions, which
// breaks on rotation and on tablets. Bars are now percentage-based. The two
// views are tabs rather than two screens, and the missing-diagnosis list gains
// a call action — that list exists to be worked, not read.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
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
import { F, T, num } from '../design/tokens';

const ENDPOINT = '/report/conditionwiseReport';

// Cycled across however many specialities a branch records. Ordered so
// adjacent rows never sit at similar lightness.
const HUES = [
  '#2F6FA8',
  '#B3523B',
  '#1E7A5A',
  '#6E5AA8',
  '#B26A00',
  '#3E8C8C',
  '#A8567F',
  '#4A6B2F',
  '#59636F',
  '#8A6FC4',
];

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
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};

const fmtShort = d => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return m ? `${Number(day)} ${MONTHS[Number(m) - 1]}` : String(d);
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const ConditionReportScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [conditions, setConditions] = useState([]);
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('conditions');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get(ENDPOINT, { location, from, to });
        setConditions(res?.conditionwiseReport || []);
        setMissing(res?.missingDiagReport || []);
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

  const ranked = useMemo(() => {
    const rows = [...conditions].sort(
      (a, b) => Number(b.patient_count || 0) - Number(a.patient_count || 0),
    );
    const total = rows.reduce((a, r) => a + Number(r.patient_count || 0), 0);
    const max = Math.max(...rows.map(r => Number(r.patient_count || 0)), 1);
    return { rows, total, max };
  }, [conditions]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === 'conditions') {
      return q
        ? ranked.rows.filter(r =>
            String(r.speciality || '')
              .toLowerCase()
              .includes(q),
          )
        : ranked.rows;
    }
    const qd = digits(q);
    return q
      ? missing.filter(
          p =>
            String(p.name || '')
              .toLowerCase()
              .includes(q) ||
            String(p.Uid_no || '')
              .toLowerCase()
              .includes(q) ||
            (!!qd && digits(p.phone).includes(qd)),
        )
      : missing;
  }, [tab, ranked, missing, query]);

  const call = phone => {
    const d = digits(phone);
    if (!d)
      return Alert.alert('No number', 'This patient has no phone number.');
    Linking.openURL(`tel:${d}`);
  };

  const header = (
    <View>
      <SectionHeader
        code="REPORTS"
        name="Condition Report"
        sub={`${fmtShort(from)} – ${fmtShort(to)}`}
        hue={T.brand}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, { marginTop: -30 }]}>
          <Stat
            label="Diagnoses"
            value={num(ranked.total)}
            // NOT "patients" — a patient diagnosed under two specialities is
            // counted in both rows. See the header note.
            note="records in period"
            color={T.text}
          />
          <Stat
            label="Conditions"
            value={num(ranked.rows.length)}
            note="specialities seen"
            color={T.muted}
          />
          <Stat
            label="No diagnosis"
            value={num(missing.length)}
            note="new patients"
            color={missing.length > 0 ? T.crit : '#1E7A5A'}
          />
        </View>

        <View style={st.tabs}>
          {[
            { key: 'conditions', label: 'Conditions', n: ranked.rows.length },
            { key: 'missing', label: 'Missing diagnosis', n: missing.length },
          ].map(t => {
            const on = tab === t.key;
            const c = t.key === 'missing' && t.n > 0 ? T.crit : T.brand;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => {
                  setTab(t.key);
                  setQuery('');
                }}
                style={[st.tab, on && { backgroundColor: c, borderColor: c }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.tabLabel, on && st.tabOn]}>{t.label}</Text>
                <Text style={[st.tabCount, on && st.tabOn]}>{t.n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              tab === 'conditions' ? 'Condition' : 'Patient, UID or phone'
            }
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

        {tab === 'missing' && missing.length > 0 && (
          // The NOT EXISTS in the query is unbounded by date, so this is
          // "never diagnosed", not "not diagnosed this period". Worth saying,
          // because it changes who should be called.
          <Text style={st.warn}>
            New patients who were seen and billed but have no diagnosis on
            record at all.
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        keyExtractor={(item, i) =>
          tab === 'conditions'
            ? `${item.speciality}-${i}`
            : `${item.patient_id}-${i}`
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
            tintColor={T.brand}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
            </View>
          ) : error ? (
            <Text style={st.empty}>{error}</Text>
          ) : tab === 'missing' ? (
            <View style={st.allGood}>
              <Icon name="check-circle" size={26} color="#1E7A5A" />
              <Text style={st.allGoodText}>
                Every new patient has a diagnosis on record.
              </Text>
            </View>
          ) : (
            <Text style={st.empty}>No diagnoses recorded in this period.</Text>
          )
        }
        renderItem={({ item, index }) =>
          tab === 'conditions' ? (
            <ConditionRow
              r={item}
              rank={index + 1}
              max={ranked.max}
              total={ranked.total}
            />
          ) : (
            <PatientRow
              p={item}
              open={openId === item.patient_id}
              onToggle={() =>
                setOpenId(openId === item.patient_id ? null : item.patient_id)
              }
              onCall={() => call(item.phone)}
            />
          )
        }
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

const ConditionRow = ({ r, rank, max, total }) => {
  const count = Number(r.patient_count || 0);
  const hue = HUES[(rank - 1) % HUES.length];
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <View style={st.row}>
      <View style={st.rowTop}>
        <Text style={st.rank}>{rank}</Text>
        <Text style={st.condition} numberOfLines={1}>
          {r.speciality || 'Unspecified'}
        </Text>
        <Text style={[st.count, { color: hue }]}>{num(count)}</Text>
      </View>

      {/* Percentage width, not Dimensions arithmetic — the old screen computed
          `width - 120` at module scope, which is wrong after a rotation and on
          any tablet. Scaled to the LARGEST condition so the rows compare with
          each other. */}
      <View style={st.track}>
        <View
          style={{
            width: `${Math.max((count / max) * 100, 1.5)}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: hue,
          }}
        />
      </View>

      <Text style={st.share}>{share}% of all diagnoses</Text>
    </View>
  );
};

const PatientRow = ({ p, open, onToggle, onCall }) => (
  <View style={st.row}>
    <View style={[st.rowSpine, { backgroundColor: T.crit }]} />

    <TouchableOpacity
      style={st.patientHead}
      activeOpacity={0.8}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, seen ${fmtDate(p.visit_date)}`}
    >
      <View style={[st.avatar, { backgroundColor: '#F8E6E3' }]}>
        <Text style={[st.avatarText, { color: T.crit }]}>
          {initials(p.name)}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.name} numberOfLines={1}>
          {p.name || 'Unnamed'}
        </Text>
        <Text style={st.phone}>{p.phone || 'No number'}</Text>
        <Text style={st.meta} numberOfLines={1}>
          {p.Uid_no ? `${p.Uid_no} · ` : ''}
          {fmtDate(p.visit_date)}
          {p.sex ? ` · ${p.sex}` : ''}
          {p.age ? ` · ${p.age}y` : ''}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onCall}
        style={st.callBtn}
        accessibilityRole="button"
        accessibilityLabel={`Call ${p.name}`}
      >
        <Icon name="call" size={16} color={T.brand} />
      </TouchableOpacity>

      <Icon
        name={open ? 'expand-less' : 'expand-more'}
        size={17}
        color={T.chevron}
      />
    </TouchableOpacity>

    {open && (
      <View style={st.detail}>
        <Fact label="Alt. phone" value={p.mobile_2} />
        <Fact label="Referred by" value={p.ref} />
        <Fact label="Occupation" value={p.occupation} />
        <Fact label="Address" value={p.address} last />
      </View>
    )}
  </View>
);

const Fact = ({ label, value, last }) => (
  <View style={[st.factRow, last && { borderBottomWidth: 0 }]}>
    <Text style={st.factLabel}>{label}</Text>
    <Text style={st.factValue} numberOfLines={2}>
      {value || '—'}
    </Text>
  </View>
);

export default ConditionReportScreen;

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
  allGood: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  allGoodText: {
    fontSize: 13,
    color: T.muted,
    fontFamily: F.regular,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  statRow: { flexDirection: 'row', gap: 9 },
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

  tabs: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: T.card,
  },
  tabLabel: { fontSize: 12, color: T.muted, fontFamily: F.regular },
  tabCount: { fontFamily: F.mono, fontSize: 12, color: T.text },
  tabOn: { color: '#fff', fontFamily: F.medium },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },
  warn: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 10,
    fontFamily: F.regular,
    lineHeight: 14,
  },

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
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  rank: { width: 18, fontFamily: F.mono, fontSize: 10, color: T.muted2 },
  condition: { flex: 1, fontSize: 13, fontFamily: F.medium, color: T.text },
  count: { fontFamily: F.mono, fontSize: 15, letterSpacing: -0.3 },

  track: {
    height: 5,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 10,
    marginLeft: 27,
    overflow: 'hidden',
  },
  share: {
    fontFamily: F.mono,
    fontSize: 9,
    color: T.muted2,
    marginTop: 6,
    marginLeft: 27,
  },

  patientHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  phone: { fontFamily: F.mono, fontSize: 11.5, color: T.text, marginTop: 3 },
  meta: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 3,
  },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#EAF2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detail: {
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  factLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  factValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 17,
  },
});
