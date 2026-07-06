import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button, Dialog } from 'react-native-paper';
import { Portal, Modal as PaperModal } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const BACKEND_URL = 'https://wedoc.in/hms';

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#f6f9fb',
  surface: '#fbfcfe',
  card: '#1E2F42',
  accent: '#38BDF8',
  accentSoft: 'rgba(56,189,248,0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.12)',
  success: '#34D399',
  danger: '#F87171',
  text: '#000000',
  muted: '#6B8299',
  border: 'rgba(56,189,248,0.15)',
  white: '#FFFFFF',
};

// specialty → gradient pair
const SPECIALTY_COLORS = [
  ['#38BDF8', '#0EA5E9'],
  ['#34D399', '#059669'],
  ['#F59E0B', '#D97706'],
  ['#A78BFA', '#7C3AED'],
  ['#F87171', '#DC2626'],
  ['#FB923C', '#EA580C'],
];

const formatDateIST = date => {
  const now = new Date(date);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = dateStr => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ─── Animated bar ─────────────────────────────────────────────────────────────
const AnimatedBar = ({ ratio, color, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: ratio,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [ratio]);

  const barWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 120],
  });

  return (
    <View style={styles.barBg}>
      <Animated.View
        style={[styles.barFill, { width: barWidth, backgroundColor: color }]}
      />
    </View>
  );
};

// ─── Specialty Card ───────────────────────────────────────────────────────────
const SpecialtyCard = ({ item, index, maxValue }) => {
  const [start, end] = SPECIALTY_COLORS[index % SPECIALTY_COLORS.length];
  const ratio = maxValue > 0 ? item.patient_count / maxValue : 0;
  const pct = Math.round(ratio * 100);

  return (
    <View style={[styles.specialtyCard, { borderLeftColor: start }]}>
      <View style={styles.specialtyRow}>
        <View
          style={[styles.specialtyBadge, { backgroundColor: start + '22' }]}
        >
          <Text style={[styles.specialtyBadgeText, { color: start }]}>
            {item.speciality?.toUpperCase()}
          </Text>
        </View>
        <View style={styles.specialtyRight}>
          <Text style={[styles.specialtyCount, { color: start }]}>
            {item.patient_count}
          </Text>
          <Text style={styles.specialtyPct}>{pct}%</Text>
        </View>
      </View>
      <AnimatedBar ratio={ratio} color={start} delay={index * 100} />
    </View>
  );
};

// ─── Patient Detail Modal ─────────────────────────────────────────────────────
const PatientModal = ({ visible, patient, onClose }) => {
  if (!patient) return null;

  const isFemale = patient.sex?.toLowerCase() === 'female';
  const avatarColor = isFemale ? COLORS.warning : COLORS.accent;

  // Cleans junk placeholder values like '.', '0', empty
  const clean = val => {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s === '' || s === '.' || s === '0') return null;
    return s;
  };

  const Field = ({ label, value, highlight }) => {
    const v = clean(value);
    if (!v) return null;
    return (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text
          style={[styles.fieldValue, highlight && { color: COLORS.accent }]}
        >
          {v}
        </Text>
      </View>
    );
  };

  const initials = patient.name
    ? patient.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('')
    : '?';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Tap outside to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />

        <View style={styles.modalSheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: avatarColor + '22',
                  borderColor: avatarColor,
                },
              ]}
            >
              <Text style={[styles.avatarText, { color: avatarColor }]}>
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modalName} numberOfLines={2}>
                {patient.name}
              </Text>
              <Text style={styles.modalUid}>{patient.Uid_no}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Chips */}
          <View style={styles.chipRow}>
            {clean(patient.sex) && patient.sex !== '0' && (
              <View
                style={[styles.chip, { backgroundColor: avatarColor + '22' }]}
              >
                <Text style={[styles.chipText, { color: avatarColor }]}>
                  {patient.sex}
                </Text>
              </View>
            )}
            {patient.age > 0 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: COLORS.success + '22' },
                ]}
              >
                <Text style={[styles.chipText, { color: COLORS.success }]}>
                  {patient.age} yrs
                </Text>
              </View>
            )}
            <View
              style={[styles.chip, { backgroundColor: COLORS.danger + '22' }]}
            >
              <Text style={[styles.chipText, { color: COLORS.danger }]}>
                ⚠ No Diagnosis
              </Text>
            </View>
          </View>

          <View style={styles.modalDivider} />

          {/* Scrollable content — key fix: no flex:1 on ScrollView inside a non-flex sheet */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Contact section */}
            <Text style={styles.sectionTitle}>Contact</Text>
            <Field label="Primary Phone" value={patient.phone} highlight />
            <Field label="Alt. Phone" value={patient.mobile_2} highlight />

            <View style={styles.modalDivider} />

            {/* Visit section */}
            <Text style={styles.sectionTitle}>Visit Info</Text>
            <Field label="Visit Date" value={formatDate(patient.visit_date)} />
            <Field label="Patient ID" value={patient.Uid_no} />

            <View style={styles.modalDivider} />

            {/* Personal section */}
            <Text style={styles.sectionTitle}>Personal</Text>
            <Field label="Occupation" value={patient.occupation} />
            <Field label="Address" value={patient.address} />
            <Field label="Referred By" value={patient.ref} />
          </ScrollView>

          <View style={styles.modalDivider} />

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Missing Patient Row ───────────────────────────────────────────────────────
const MissingPatientRow = ({ item, onPress }) => {
  const isFemale = item.sex?.toLowerCase() === 'female';
  const avatarColor = isFemale ? COLORS.warning : COLORS.accent;

  return (
    <TouchableOpacity
      style={styles.missingRow}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.miniAvatar,
          { backgroundColor: avatarColor + '22', borderColor: avatarColor },
        ]}
      >
        <Text style={[styles.miniAvatarText, { color: avatarColor }]}>
          {item.name?.charAt(0) ?? '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.missingName}>{item.name}</Text>
        <Text style={styles.missingMeta}>
          {item.Uid_no} • {formatDate(item.visit_date)}
        </Text>
      </View>
      <View style={styles.missingArrow}>
        <Text style={{ color: COLORS.muted, fontSize: 18 }}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const SpecialityAnalytics = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);

  const [filterVisible, setFilterVisible] = useState(false);
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [missingData, setMissingData] = useState([]);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('conditions'); // 'conditions' | 'missing'

  const fetchReport = async (loc, from, to) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${BACKEND_URL}/report/conditionwiseReport?location=${loc}&from=${formatDateIST(
          from,
        )}&to=${formatDateIST(to)}`,
      );
      const json = await res.json();
      setData(json.conditionwiseReport ?? []);
      setMissingData(json.missingDiagReport ?? []);
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(location, fromDate, toDate);
  }, []);

  const maxValue = Math.max(...data.map(d => d.patient_count), 0);

  const totalPatients = data.reduce((s, d) => s + d.patient_count, 0);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Speciality Analytics
          </Text>

          <Text style={styles.headerSubDate} numberOfLines={1}>
            {formatDate(fromDate)} → {formatDate(toDate)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          style={styles.filterIconBtn}
          activeOpacity={0.8}
        >
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Summary strip ── */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalPatients}</Text>
          <Text style={styles.summaryLabel}>Total Patients</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{data.length}</Text>
          <Text style={styles.summaryLabel}>Specialties</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
            {missingData.length}
          </Text>
          <Text style={styles.summaryLabel}>No Diagnosis</Text>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'conditions' && styles.tabActive]}
          onPress={() => setActiveTab('conditions')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'conditions' && styles.tabTextActive,
            ]}
          >
            Conditions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'missing' && styles.tabActive]}
          onPress={() => setActiveTab('missing')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'missing' && styles.tabTextActive,
            ]}
          >
            Missing Diag{' '}
            {missingData.length > 0 && (
              <Text style={styles.badge}>{missingData.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={{ color: COLORS.muted, marginTop: 12 }}>
            Fetching report…
          </Text>
        </View>
      ) : activeTab === 'conditions' ? (
        <FlatList
          data={data}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <SpecialtyCard item={item} index={index} maxValue={maxValue} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No condition data found.</Text>
          }
        />
      ) : (
        <FlatList
          data={missingData}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <MissingPatientRow item={item} onPress={setSelectedPatient} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <View style={styles.missingWarningBanner}>
              <Text style={styles.missingWarningText}>
                ⚠ These new patients have no diagnosis recorded.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptySuccess}>
              <Text style={styles.emptySuccessIcon}>✓</Text>
              <Text style={styles.emptySuccessText}>
                All patients have diagnosis records.
              </Text>
            </View>
          }
        />
      )}

      {/* ── Patient detail modal ── */}
      <PatientModal
        visible={!!selectedPatient}
        patient={selectedPatient}
        onClose={() => setSelectedPatient(null)}
      />

      {/* ── Filter Modal ── */}
      <Portal>
        <PaperModal
          visible={filterVisible}
          onDismiss={() => setFilterVisible(false)}
          contentContainerStyle={styles.filterModal}
        >
          <Text style={styles.filterTitle}>Filter by Date</Text>

          <Text style={styles.filterLabel}>From</Text>
          <TouchableOpacity
            style={styles.dateField}
            onPress={() => setOpen(true)}
          >
            <Text style={styles.dateFieldText}>
              {fromDate.toLocaleDateString('en-IN')}
            </Text>
            <Text style={{ color: COLORS.accent }}>📅</Text>
          </TouchableOpacity>

          <Text style={[styles.filterLabel, { marginTop: 14 }]}>To</Text>
          <TouchableOpacity
            style={styles.dateField}
            onPress={() => setOpen2(true)}
          >
            <Text style={styles.dateFieldText}>
              {toDate.toLocaleDateString('en-IN')}
            </Text>
            <Text style={{ color: COLORS.accent }}>📅</Text>
          </TouchableOpacity>

          <DatePicker
            modal
            mode="date"
            open={open}
            date={fromDate}
            onConfirm={date => {
              setOpen(false);
              setFromDate(date);
            }}
            onCancel={() => setOpen(false)}
            maximumDate={new Date()}
          />
          <DatePicker
            modal
            mode="date"
            open={open2}
            date={toDate}
            onConfirm={date => {
              setOpen2(false);
              setToDate(date);
            }}
            onCancel={() => setOpen2(false)}
            maximumDate={new Date()}
          />

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                setFilterVisible(false);
                fetchReport(location, fromDate, toDate);
              }}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </PaperModal>
      </Portal>
    </View>
  );
};

export default SpecialityAnalytics;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 12,
    backgroundColor: '#01458e',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 6,
  },
  headerSubDate: {
    color: '#a8c4e0',
    fontSize: 11,
    marginTop: 1,
    marginLeft: 6,
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 19,
  },

  // Summary
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: COLORS.accent, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: COLORS.border },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.accent },
  tabText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: COLORS.accent },
  badge: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },

  // Specialty card
  specialtyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
  },
  specialtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  specialtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  specialtyBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  specialtyRight: { alignItems: 'flex-end' },
  specialtyCount: { fontSize: 26, fontWeight: '800' },
  specialtyPct: { color: COLORS.muted, fontSize: 12 },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 6 },

  // Missing section
  missingWarningBanner: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
  },
  missingWarningText: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  miniAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  miniAvatarText: { fontSize: 18, fontWeight: '700' },
  missingName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  missingMeta: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  missingArrow: { paddingLeft: 8 },

  // Patient Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800' },
  modalName: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  modalUid: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: COLORS.muted, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 14 },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldLabel: { color: COLORS.muted, fontSize: 13 },
  fieldValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  doneBtn: {
    marginTop: 16,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },

  // Filter Modal
  filterModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  filterLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateField: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateFieldText: { color: COLORS.text, fontSize: 15 },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
  applyBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  applyBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: '700' },

  // Misc
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  emptySuccess: { alignItems: 'center', marginTop: 60 },
  emptySuccessIcon: { fontSize: 48, color: COLORS.success },
  emptySuccessText: {
    color: COLORS.success,
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
});
