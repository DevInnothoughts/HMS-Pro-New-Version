/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/OPDReportPatientDetailScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// One patient's profile and diagnosis history. Reached by tapping a patient on
// the OPD visit-type list (OPDReportDetailScreen).
//
// Replaces src/admin/OPDReportPatientDetails.js, which is left untouched. The
// route name 'OPDReportPatientDetails' is unchanged — only its component in
// App.tsx points here. Same endpoint (/Patient/diagnosis/patient) and the same
// fields as the old screen — only the presentation moved to the new design
// system.
//
// THE PROFILE COMES FROM THE FIRST DIAGNOSIS ROW
// ──────────────────────────────────────────────
// The endpoint joins diagnosis → patient, so a patient with no diagnosis yet
// returns no rows at all, and the old screen showed a blank page. The tapped
// appointment row is passed in, so its name / phone / gender fill the header
// until (or unless) the API has something. No new data is fetched for that.
//
// Visits are numbered across the whole list. The old screen numbered per page,
// so page two restarted at "#Visit 1".
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, tint } from '../design/tokens';

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

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10) || '—';
  return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`;
};

const show = v => {
  const s = String(v ?? '').trim();
  return s && s !== '0' && s.toLowerCase() !== 'null' ? s : '—';
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const pad2 = n => String(n).padStart(2, '0');

const OPDReportPatientDetailScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(state => state.location.value);
  const patient = route?.params?.patient || {};
  const location = route?.params?.location || reduxLocation;
  const hue = route?.params?.hue || HUE.opd;
  const patientId = patient.patient_id;

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!patientId) {
        setLoading(false);
        setError('This appointment is not linked to a patient record.');
        return;
      }
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/Patient/diagnosis/patient', {
          location,
          patientId,
        });
        setVisits(Array.isArray(res) ? res : res?.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, patientId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const p0 = visits[0] || {};
  const name = p0.name || patient.patient_name || 'Patient';

  const header = (
    <View>
      <SectionHeader
        code="PATIENT"
        name={name}
        sub={
          visits.length
            ? `${visits.length} visit${visits.length > 1 ? 's' : ''} on record`
            : undefined
        }
        hue={hue}
        hideScope
        onBack={() => navigation.goBack()}
      />

      {/* Profile card — sits half over the header band (SectionHeader note). */}
      <View style={st.profile}>
        <View style={st.profileTop}>
          <View style={[st.avatar, { backgroundColor: tint(hue) }]}>
            <Text style={[st.avatarText, { color: hue }]}>
              {initials(name)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.profileName} numberOfLines={2}>
              {name}
            </Text>
            <View style={[st.uid, { borderColor: hue }]}>
              <Text style={[st.uidText, { color: hue }]}>
                UID {show(p0.Uid_no) === '—' ? 'NA' : p0.Uid_no}
              </Text>
            </View>
          </View>
        </View>

        <View style={st.grid}>
          <Field label="First visit" value={p0.date ? fmtDate(p0.date) : '—'} />
          <Field label="Gender" value={show(p0.sex || patient.gender)} />
          <Field label="Age" value={show(p0.age)} />
          <Field
            label="Mobile 1"
            value={show(p0.phone || patient.patient_phone)}
            mono
          />
          <Field label="Mobile 2" value={show(p0.mobile_2)} mono wide />
        </View>
      </View>

      <Text style={st.sectionLabel}>DIAGNOSIS HISTORY</Text>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      {loading && !refreshing ? (
        <>
          <SectionHeader
            code="PATIENT"
            name={patient.patient_name || 'Patient'}
            sub="Loading"
            hue={hue}
            hideScope
            onBack={() => navigation.goBack()}
          />
          <View style={st.centre}>
            <ActivityIndicator color={hue} />
          </View>
        </>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v, i) => `${v.date_diagnosis || ''}-${i}`}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={hue}
            />
          }
          ListEmptyComponent={
            <View style={st.emptyBox}>
              <Icon name="assignment" size={26} color={T.muted2} />
              <Text style={st.empty}>
                {error || 'No diagnosis recorded for this patient yet.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Visit
              v={item}
              n={index + 1}
              last={index === visits.length - 1}
              hue={hue}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
};

const Field = ({ label, value, mono, wide }) => (
  <View style={[st.field, wide && { width: '100%' }]}>
    <Text style={st.fieldLabel}>{label.toUpperCase()}</Text>
    <Text
      style={[st.fieldVal, mono && { fontFamily: F.mono }]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const Visit = ({ v, n, last, hue }) => {
  const advice = [v.diagnosisAdvice, v.advice].filter(Boolean).join(' - ');
  return (
    <View style={st.visitWrap}>
      {/* Timeline rail: dot per visit, line joining them. */}
      <View style={st.rail}>
        <View style={[st.dot, { backgroundColor: hue }]} />
        {!last && <View style={st.railLine} />}
      </View>

      <View style={st.visit}>
        <View style={st.visitHead}>
          <Text style={[st.visitNo, { color: hue }]}>VISIT {pad2(n)}</Text>
          <View style={st.dateChip}>
            <Icon name="event" size={12} color={T.muted} />
            <Text style={st.dateText}>{fmtDate(v.date_diagnosis)}</Text>
          </View>
        </View>

        <Block label="Diagnosis" value={v.diagnosis} />
        <Block label="Advice" value={advice} />

        <View style={st.doctors}>
          <Doctor role="Consultant Dr." name={v.consultantDoctor} hue={hue} />
          <Doctor role="Assistant Dr." name={v.assistantDoctor} hue={hue} />
        </View>
      </View>
    </View>
  );
};

const Block = ({ label, value }) => (
  <View style={st.block}>
    <Text style={st.blockLabel}>{label.toUpperCase()}</Text>
    <Text style={st.blockText}>{show(value)}</Text>
  </View>
);

const Doctor = ({ role, name, hue }) => (
  <View style={st.doctor}>
    <Icon name="person-outline" size={15} color={hue} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.docRole}>{role}</Text>
      <Text style={st.docName} numberOfLines={2}>
        {show(name)}
      </Text>
    </View>
  </View>
);

export default OPDReportPatientDetailScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profile: {
    marginHorizontal: 16,
    marginTop: -30,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 14,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 16 },
  profileName: {
    fontFamily: F.semibold,
    fontSize: 16,
    color: T.text,
    letterSpacing: -0.2,
  },
  uid: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 6,
  },
  uidText: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.8 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
    paddingTop: 4,
  },
  field: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  fieldLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  fieldVal: {
    fontFamily: F.medium,
    fontSize: 13.5,
    color: T.text,
    marginTop: 4,
  },

  sectionLabel: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: T.muted,
    marginTop: 22,
    marginBottom: 4,
    marginHorizontal: 16,
  },

  visitWrap: { flexDirection: 'row', paddingHorizontal: 16 },
  rail: { width: 18, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 24 },
  railLine: { flex: 1, width: 2, backgroundColor: T.line, marginTop: 4 },

  visit: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    padding: 13,
    marginTop: 10,
    marginLeft: 6,
  },
  visitHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitNo: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.subtle,
    borderWidth: 1,
    borderColor: T.lineSoft,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dateText: { fontFamily: F.mono, fontSize: 10.5, color: T.text },

  block: { marginTop: 12 },
  blockLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  blockText: {
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 19,
    color: T.text,
    marginTop: 4,
  },

  doctors: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  doctor: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  docRole: { fontFamily: F.regular, fontSize: 10, color: T.muted2 },
  docName: {
    fontFamily: F.medium,
    fontSize: 12,
    color: T.text,
    marginTop: 2,
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 30,
    gap: 8,
  },
  empty: {
    textAlign: 'center',
    color: T.muted,
    fontFamily: F.regular,
    fontSize: 13,
  },
});
