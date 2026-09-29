import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  ActivityIndicator,
  Avatar,
  Button,
  Dialog,
  Divider,
  Portal,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

/* -------------------------------------------------------------------------- */
/*  Theme                                                                     */
/* -------------------------------------------------------------------------- */
const COLORS = {
  primary: '#184D67',
  primaryDark: '#0F3A4E',
  accent: '#379AE6',
  bg: '#F2F6F9',
  card: '#FFFFFF',
  border: '#E4EBF0',
  textPrimary: '#1B2B34',
  textSecondary: '#64798A',
  textMuted: '#9AAAB6',
  chipBg: 'rgba(255,255,255,0.16)',
  accentSoft: '#EAF4FB',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
const isNA = value => {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === 'na' || s === 'n/a' || s === 'null' || s === '0';
};

const show = (value, fallback = 'Not available') =>
  isNA(value) ? fallback : String(value).trim();

const toTitleCase = str =>
  !str
    ? ''
    : String(str)
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

const getInitials = name => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

const formatName = (prefix, name) => {
  const prefixMap = {
    MR: 'Mr.',
    MRS: 'Mrs.',
    MS: 'Ms.',
    MISS: 'Miss',
    DR: 'Dr.',
    MASTER: 'Master',
    BABY: 'Baby',
  };
  const p =
    prefixMap[
      String(prefix || '')
        .toUpperCase()
        .trim()
    ] || '';
  return `${p} ${toTitleCase(name)}`.trim();
};

const formatDate = value => {
  if (isNA(value)) return 'Not available';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

const parseExtra = raw => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */
const Pill = ({ label, value }) => (
  <View style={styles.pill}>
    <Text style={styles.pillValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.pillLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <Text style={styles.infoRowValue} numberOfLines={4}>
      {value}
    </Text>
  </View>
);

const Section = ({ title, rows }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {rows.map((r, i) => (
      <View key={r.label}>
        <InfoRow label={r.label} value={r.value} />
        {i < rows.length - 1 && <Divider style={styles.divider} />}
      </View>
    ))}
  </View>
);

const VisitField = ({ label, value }) => (
  <View style={styles.visitField}>
    <Text style={styles.visitLabel}>{label}</Text>
    <Text style={styles.visitValue}>{value}</Text>
  </View>
);

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */
const PatientDetails = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const route = useRoute();
  const { patient } = route.params;

  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, setItemsPerPage] = useState(numberOfItemsPerPageList[0]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(itemsPerPage);
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms';

  useEffect(() => {
    fetchPatientData(location, patient.patient_id);
  }, [location, patient.patient_id]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, patientData.length));
  }, [page, itemsPerPage, patientData.length]);

  const handleNextPage = () => {
    if ((page + 1) * itemsPerPage < patientData.length) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const fetchPatientData = async (loc, patientId) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/Patient/diagnosis?location=${loc}&patientId=${patientId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const res = await response.json();
      setPatientData(Array.isArray(res) ? res : []);
    } catch (error) {
      console.log('Error fetching patient data: ', error);
    } finally {
      setLoading(false);
    }
  };

  /* ---- derived data ---- */
  const extra = parseExtra(patient.additional_info);
  const fullName = formatName(patient.prefix, patient.name);
  const initials = getInitials(patient.name);
  const bloodGroup =
    isNA(patient.blood_group) || /know/i.test(String(patient.blood_group))
      ? '—'
      : patient.blood_group;

  const totalPages = Math.max(1, Math.ceil(patientData.length / itemsPerPage));
  const currentPage = page + 1;

  const contactRows = [
    { label: 'Mobile', value: show(patient.phone) },
    { label: 'Alternate', value: show(patient.mobile_2) },
    { label: 'Email', value: show(patient.email) },
    { label: 'Address', value: show(patient.address) },
    { label: 'Location', value: show(patient.patient_location) },
  ];

  const personalRows = [
    { label: 'Date of Birth', value: show(patient.birth_date) },
    { label: 'Age', value: isNA(patient.age) ? '—' : `${patient.age} years` },
    { label: 'Gender', value: show(patient.sex) },
    { label: 'Blood Group', value: bloodGroup },
    { label: 'Language', value: show(extra.language) },
    { label: 'Nationality', value: show(extra.nationality) },
    { label: 'Occupation', value: show(patient.occupation) },
    { label: 'Company', value: show(patient.companyname) },
  ];

  const registrationRows = [
    { label: 'Patient ID', value: show(patient.patient_id) },
    { label: 'UID No', value: show(patient.Uid_no) },
    { label: 'First Visit', value: formatDate(patient.date) },
    { label: 'Reference', value: show(patient.ref) },
    {
      label: 'Reference Type',
      value: isNA(patient.reference_type)
        ? 'Not available'
        : toTitleCase(String(patient.reference_type).replace(/_/g, ' ')),
    },
  ];

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      {/* ---- Header ---- */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Image
            style={styles.backIcon}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Information</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Hero card ---- */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Avatar.Text
              size={60}
              label={initials}
              style={styles.avatar}
              labelStyle={styles.avatarLabel}
              color={COLORS.primary}
            />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={2}>
                {fullName}
              </Text>
              <Text style={styles.heroUid}>
                {show(patient.Uid_no, 'UID: NA')}
              </Text>
              {!isNA(patient.patient_location) && (
                <Text style={styles.heroLocation}>
                  {patient.patient_location}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.pillRow}>
            <Pill
              label="Age"
              value={isNA(patient.age) ? '—' : `${patient.age} yrs`}
            />
            <View style={styles.pillSeparator} />
            <Pill label="Gender" value={show(patient.sex, '—')} />
            <View style={styles.pillSeparator} />
            <Pill label="Blood" value={bloodGroup} />
          </View>
        </View>

        {/* ---- Info sections ---- */}
        <Section title="Contact Information" rows={contactRows} />
        <Section title="Personal Details" rows={personalRows} />
        <Section title="Registration & Reference" rows={registrationRows} />

        {/* ---- Visit history ---- */}
        <View style={styles.historyHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Visit History</Text>
          {patientData.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{patientData.length}</Text>
            </View>
          )}
        </View>

        {patientData.length > 0
          ? patientData.slice(from, to).map((item, index) => {
              const visitNo = from + index + 1;
              const adviceText = isNA(item.diagnosisAdvice)
                ? item.advice
                  ? String(item.advice)
                  : 'Not available'
                : `${item.diagnosisAdvice}${
                    item.advice ? ` - ${item.advice}` : ''
                  }`;

              return (
                <View key={index} style={styles.visitCard}>
                  <View style={styles.visitAccent} />
                  <View style={styles.visitBody}>
                    <View style={styles.visitHeader}>
                      <View style={styles.visitBadge}>
                        <Text style={styles.visitBadgeText}>
                          Visit {visitNo}
                        </Text>
                      </View>
                      <Text style={styles.visitDate}>
                        {formatDate(item.date_diagnosis)}
                      </Text>
                    </View>

                    <VisitField
                      label="DIAGNOSIS"
                      value={show(item.diagnosis)}
                    />
                    <VisitField label="ADVICE" value={adviceText} />

                    <View style={styles.doctorRow}>
                      <View style={styles.doctorCol}>
                        <Text style={styles.visitLabel}>CONSULTANT</Text>
                        <Text style={styles.visitValue}>
                          {show(item.consultantDoctor)}
                        </Text>
                      </View>
                      <View style={styles.doctorCol}>
                        <Text style={styles.visitLabel}>ASSISTANT</Text>
                        <Text style={styles.visitValue}>
                          {show(item.assistantDoctor)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          : !loading && (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  No visit records available
                </Text>
              </View>
            )}
      </ScrollView>

      {/* ---- Pagination ---- */}
      {patientData.length > itemsPerPage && (
        <View style={styles.paginationControls}>
          <Button
            mode="contained"
            onPress={handlePrevPage}
            disabled={page === 0}
            buttonColor={COLORS.primary}
            style={styles.pageBtn}
            contentStyle={styles.pageBtnContent}
          >
            <Image
              style={styles.pageIcon}
              source={require('../../assets/left.png')}
            />
          </Button>

          <Text style={styles.pageIndicator}>
            Page {currentPage} of {totalPages}
          </Text>

          <Button
            mode="contained"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= patientData.length}
            buttonColor={COLORS.primary}
            style={styles.pageBtn}
            contentStyle={styles.pageBtnContent}
          >
            <Image
              style={styles.pageIcon}
              source={require('../../assets/right.png')}
            />
          </Button>
        </View>
      )}

      {/* ---- Loading dialog ---- */}
      <Portal>
        <Dialog visible={loading} dismissable={false} style={styles.dialog}>
          <Dialog.Content style={styles.dialogContent}>
            <ActivityIndicator
              animating={loading}
              size="large"
              color={COLORS.primary}
            />
            <Text style={styles.dialogText}>Loading patient data…</Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default PatientDetails;

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  /* Header */
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 54,
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    height: 26,
    width: 26,
    tintColor: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Lexend-Medium',
    fontSize: 18,
    color: COLORS.textPrimary,
  },

  /* Scroll */
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },

  /* Hero */
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginTop: 6,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#FFFFFF',
  },
  avatarLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 22,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontFamily: 'Lexend-Medium',
    lineHeight: 25,
  },
  heroUid: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    marginTop: 3,
    fontFamily: 'Lexend-Regular',
  },
  heroLocation: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: 'Lexend-Regular',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    paddingVertical: 10,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
  },
  pillSeparator: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pillValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Lexend-Medium',
  },
  pillLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'Lexend-Regular',
  },

  /* Section card */
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Medium',
  },
  divider: {
    backgroundColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 9,
  },
  infoRowLabel: {
    width: '38%',
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Regular',
  },
  infoRowValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Regular',
    textAlign: 'right',
  },

  /* History */
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  countBadge: {
    marginLeft: 8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    color: COLORS.accent,
    fontFamily: 'Lexend-Medium',
  },

  /* Visit card */
  visitCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visitAccent: {
    width: 5,
    backgroundColor: COLORS.accent,
  },
  visitBody: {
    flex: 1,
    padding: 14,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  visitBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visitBadgeText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'Lexend-Medium',
  },
  visitDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Regular',
  },
  visitField: {
    marginBottom: 10,
  },
  visitLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    fontFamily: 'Lexend-Medium',
    marginBottom: 2,
  },
  visitValue: {
    fontSize: 14.5,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Regular',
    lineHeight: 20,
  },
  doctorRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  doctorCol: {
    flex: 1,
    paddingRight: 8,
  },

  /* Empty state */
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontFamily: 'Lexend-Regular',
  },

  /* Pagination */
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pageBtn: {
    borderRadius: 10,
    minWidth: 56,
  },
  pageBtnContent: {
    height: 40,
  },
  pageIcon: {
    width: 14,
    height: 14,
    tintColor: '#FFFFFF',
  },
  pageIndicator: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Medium',
  },

  /* Dialog */
  dialog: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
  },
  dialogContent: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  dialogText: {
    marginTop: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Regular',
  },
});
