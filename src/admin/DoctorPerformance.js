/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  LayoutAnimation,
  Platform,
  KeyboardAvoidingView,
  UIManager,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import ModalDropdown from 'react-native-modal-dropdown';
import {
  Portal,
  Modal,
  Button,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = 'https://wedoc.in/hms';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Color palette (matches ConditionwiseReport UI) ───────────────────────────
const COLORS = {
  bg: '#F5F7FB',
  card: '#FFFFFF',
  headerIcon: '#184D67',
  text: '#000000',
  muted: '#6B7280',
  surgeon: '#4A90E2', // primary blue
  assistant: '#0d7592', // secondary teal
  barBg: '#E6EAF0',
  border: '#E6EAF0',
  btnPrimary: '#007bff',
  metricBg: '#F8FAFC',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatDateIST = date => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(new Date(date).getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const prettyDate = date =>
  new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const fmtINR = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const fmtCompactINR = n => {
  const v = Number(n) || 0;
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(2) + 'L';
  if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'K';
  return '₹' + Math.round(v);
};

const generateMonthsList = () => {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
      value: d,
    });
  }
  return months;
};

const monthBounds = monthDate => {
  const from = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const to = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { from, to };
};

// ── Small UI pieces ───────────────────────────────────────────────────────────
const MetricCard = ({ label, value, color }) => (
  <View style={[styles.metricCard, { borderLeftColor: color }]}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

// One condition (speciality): patients → surgery advised → IPD conversions.
const ConditionRow = ({ item, color }) => {
  const fill =
    item.patientCount > 0 ? (item.ipdCount / item.patientCount) * 100 : 0;
  return (
    <View style={styles.conditionRow}>
      <Text style={styles.conditionName} numberOfLines={1}>
        {item.speciality}
      </Text>
      <View style={styles.conditionFunnel}>
        <Text style={styles.conditionStat}>{item.patientCount} patients</Text>
        <Text style={styles.conditionArrow}>›</Text>
        <Text style={styles.conditionStat}>{item.surgeryAdvised} surgery</Text>
        <Text style={styles.conditionArrow}>›</Text>
        <Text style={[styles.conditionStat, styles.conditionIpd, { color }]}>
          {item.ipdCount} IPD
        </Text>
      </View>
      <View style={styles.conditionTrack}>
        <View
          style={[
            styles.conditionFill,
            { width: `${Math.min(fill, 100)}%`, backgroundColor: color },
          ]}
        />
      </View>
      {item.subTypes && item.subTypes.length > 0 && (
        <View style={styles.subTypeWrap}>
          {item.subTypes.map(st => (
            <View key={st.name} style={styles.subTypeChip}>
              <Text style={styles.subTypeText}>
                {st.name}{' '}
                <Text style={styles.subTypeCount}>{st.patientCount}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// One doctor card — collapsed shows name + conversion KPI + progress bar;
// expanded shows every parameter. `color` differentiates surgeon vs assistant.
const DoctorCard = ({ item, color, expanded, onToggle }) => {
  const pct = Number(item.conversionRate) || 0;
  return (
    <View style={styles.doctorCard}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onToggle(item.doctorId)}
      >
        <View style={styles.doctorHeader}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {item.doctorName}
          </Text>
          <Text style={[styles.kpi, { color }]}>{pct.toFixed(1)}%</Text>
          <Text style={styles.kpiRevenue}>
            {fmtCompactINR(item.ipdRevenue)}
          </Text>
          <Image
            style={styles.arrow}
            source={
              expanded
                ? require('../../assets/up-arrow.png')
                : require('../../assets/down-arrow.png')
            }
          />
        </View>

        {/* progress bar = new-patient → IPD conversion */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(pct, 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expanded}>
          <DetailRow
            label="New Patients → IPD"
            value={`${item.newPatientConversions} / ${
              item.newPatients
            }  (${pct.toFixed(1)}%)`}
          />
          <DetailRow
            label="All Diagnosed → IPD"
            value={`${item.ipdConversions} / ${item.patientsDiagnosed}  (${(
              Number(item.ipdConversionRate) || 0
            ).toFixed(1)}%)`}
          />
          <DetailRow label="Surgery Advised" value={item.surgeryAdvised} />
          <DetailRow
            label="Medication Advised"
            value={item.medicationAdvised}
          />

          <View style={styles.metricsGrid}>
            <MetricCard
              label="OPD Revenue"
              value={fmtCompactINR(item.opdRevenue)}
              color={color}
            />
            <MetricCard
              label="IPD Revenue"
              value={fmtCompactINR(item.ipdRevenue)}
              color={color}
            />
            <MetricCard
              label="Avg IPD"
              value={fmtCompactINR(item.avgIpdRevenue)}
              color={color}
            />
          </View>
          <Text style={styles.fullRevenueNote}>
            OPD {fmtINR(item.opdRevenue)} · IPD {fmtINR(item.ipdRevenue)}
          </Text>

          {item.specialities && item.specialities.length > 0 && (
            <View style={styles.conditionsBlock}>
              <Text style={styles.conditionsHeader}>
                Conditions ({item.specialities.length}) — Patients › Surgery ›
                IPD
              </Text>
              {item.specialities.map(spec => (
                <ConditionRow key={spec.speciality} item={spec} color={color} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ── Main screen ────────────────────────────────────────────────────────────────
const DoctorPerformance = ({ navigation }) => {
  const route = useRoute();
  // Branch comes from the branch-list screen; fall back to redux single location.
  const reduxLocation = useSelector(state => state.location?.value);
  const branch = route.params?.branch || reduxLocation;

  const [loading, setLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('surgeons'); // 'surgeons' | 'assistants'
  const [expandedId, setExpandedId] = useState(null);

  const [surgeons, setSurgeons] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [branchTotal, setBranchTotal] = useState({
    newPatients: 0,
    patientsDiagnosed: 0,
    ipdConversions: 0,
    opdRevenue: 0,
    ipdRevenue: 0,
  });

  // Filter state
  const monthsList = generateMonthsList();
  const [filterMode, setFilterMode] = useState('month'); // 'month' | 'custom'
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);
  const [rangeLabel, setRangeLabel] = useState(monthsList[0].label);

  const activeColor =
    activeTab === 'surgeons' ? COLORS.surgeon : COLORS.assistant;

  useEffect(() => {
    // default = current month
    const { from, to } = monthBounds(new Date());
    fetchPerformance(formatDateIST(from), formatDateIST(to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  const fetchPerformance = (from, to) => {
    setLoading(true);
    fetch(
      `${BACKEND_URL}/doctorPerformance?location=${encodeURIComponent(
        branch,
      )}&from=${from}&to=${to}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
      },
    )
      .then(res => res.json())
      .then(res => {
        setSurgeons(res.surgeons || []);
        setAssistants(res.assistants || []);
        if (res.branchTotal) setBranchTotal(res.branchTotal);
        setExpandedId(null);
      })
      .catch(err => console.log('Doctor performance fetch error:', err))
      .finally(() => setLoading(false));
  };

  const handleMonthChange = index => {
    setSelectedMonth(monthsList[index]);
  };

  const applyFilter = () => {
    let from;
    let to;
    let label;
    if (filterMode === 'month') {
      const b = monthBounds(selectedMonth.value);
      from = b.from;
      to = b.to;
      label = selectedMonth.label;
    } else {
      from = fromDate;
      to = toDate;
      label = `${prettyDate(fromDate)} → ${prettyDate(toDate)}`;
    }
    setRangeLabel(label);
    setFilterVisible(false);
    fetchPerformance(formatDateIST(from), formatDateIST(to));
  };

  const toggleExpand = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => (prev === id ? null : id));
  };

  const switchTab = tab => {
    setActiveTab(tab);
    setExpandedId(null);
  };

  const listData = activeTab === 'surgeons' ? surgeons : assistants;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={{ height: 35, width: 35, tintColor: COLORS.headerIcon }}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.header} numberOfLines={1}>
            {branch || 'Doctor Performance'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {rangeLabel}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setFromDate(new Date());
            setToDate(new Date());
            setFilterVisible(true);
          }}
        >
          <Image
            style={{ height: 30, width: 30, tintColor: COLORS.headerIcon }}
            source={require('../../assets/filter.png')}
          />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{branchTotal.newPatients}</Text>
          <Text style={styles.summaryLabel}>New Pat.</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {branchTotal.patientsDiagnosed}
          </Text>
          <Text style={styles.summaryLabel}>Diagnosed</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {fmtCompactINR(branchTotal.opdRevenue)}
          </Text>
          <Text style={styles.summaryLabel}>OPD Rev.</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {fmtCompactINR(branchTotal.ipdRevenue)}
          </Text>
          <Text style={styles.summaryLabel}>IPD Rev.</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'surgeons' && {
              borderBottomColor: COLORS.surgeon,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => switchTab('surgeons')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'surgeons' && { color: COLORS.surgeon },
            ]}
          >
            Surgeons ({surgeons.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'assistants' && {
              borderBottomColor: COLORS.assistant,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => switchTab('assistants')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'assistants' && { color: COLORS.assistant },
            ]}
          >
            Assistant Doctors ({assistants.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Column header */}
      <View style={styles.columnHeader}>
        <Text style={[styles.columnLabel, { flex: 1 }]}>DOCTOR</Text>
        <Text style={[styles.columnLabel, { width: 70, textAlign: 'center' }]}>
          Conv.
        </Text>
        <Text style={[styles.columnLabel, { width: 70, textAlign: 'right' }]}>
          IPD Rev.
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={item => String(item.doctorId)}
        renderItem={({ item }) => (
          <DoctorCard
            item={item}
            color={activeColor}
            expanded={expandedId === item.doctorId}
            onToggle={toggleExpand}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          !loading && (
            <Text style={styles.empty}>
              No {activeTab === 'surgeons' ? 'surgeon' : 'assistant doctor'}{' '}
              data for this period.
            </Text>
          )
        }
      />

      {/* Loading dialog */}
      <Portal>
        <Dialog
          visible={loading}
          dismissable={false}
          style={styles.loadingDialog}
        >
          <Dialog.Content>
            <Text variant="bodyMedium">Loading…</Text>
          </Dialog.Content>
          <ActivityIndicator
            animating={loading}
            size="large"
            color={COLORS.surgeon}
          />
        </Dialog>
      </Portal>

      {/* Filter modal: Monthly | Custom */}
      <Portal>
        <Modal
          visible={filterVisible}
          onDismiss={() => setFilterVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Filter by Date</Text>

            {/* mode toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  filterMode === 'month' && styles.toggleBtnActive,
                ]}
                onPress={() => setFilterMode('month')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    filterMode === 'month' && styles.toggleTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  filterMode === 'custom' && styles.toggleBtnActive,
                ]}
                onPress={() => setFilterMode('custom')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    filterMode === 'custom' && styles.toggleTextActive,
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {filterMode === 'month' ? (
              <View>
                <Text style={styles.fieldLabel}>Select Month</Text>
                <ModalDropdown
                  style={styles.dropdown}
                  textStyle={styles.dropdownText}
                  dropdownStyle={styles.dropdownList}
                  dropdownTextStyle={styles.dropdownItemText}
                  defaultValue={selectedMonth.label}
                  options={monthsList.map(m => m.label)}
                  onSelect={handleMonthChange}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>From</Text>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setOpenFrom(true)}
                >
                  <Text style={styles.dateFieldText}>
                    {fromDate.toLocaleDateString('en-IN')}
                  </Text>
                  <Text style={{ color: COLORS.surgeon }}>📅</Text>
                </TouchableOpacity>

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>To</Text>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setOpenTo(true)}
                >
                  <Text style={styles.dateFieldText}>
                    {toDate.toLocaleDateString('en-IN')}
                  </Text>
                  <Text style={{ color: COLORS.surgeon }}>📅</Text>
                </TouchableOpacity>

                <DatePicker
                  modal
                  mode="date"
                  open={openFrom}
                  date={fromDate}
                  maximumDate={new Date()}
                  onConfirm={d => {
                    setOpenFrom(false);
                    setFromDate(d);
                  }}
                  onCancel={() => setOpenFrom(false)}
                />
                <DatePicker
                  modal
                  mode="date"
                  open={openTo}
                  date={toDate}
                  maximumDate={new Date()}
                  onConfirm={d => {
                    setOpenTo(false);
                    setToDate(d);
                  }}
                  onCancel={() => setOpenTo(false)}
                />
              </View>
            )}

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setFilterVisible(false)}
                  style={{ width: 150 }}
                  textColor={COLORS.btnPrimary}
                >
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={applyFilter}
                  style={{ width: 150, backgroundColor: COLORS.btnPrimary }}
                  buttonColor="#0d7592"
                >
                  Find
                </Button>
              </View>
            </KeyboardAvoidingView>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

export default DoctorPerformance;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 12,
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: 'Lexend-Medium',
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: 'Lexend-Regular',
    marginTop: 1,
  },

  // Summary
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 6,
    elevation: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    color: COLORS.surgeon,
    fontSize: 18,
    fontFamily: 'Lexend-Bold',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Lexend-Regular',
    marginTop: 2,
  },
  summaryDivider: { width: 1, height: 30, backgroundColor: COLORS.border },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginTop: 14,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: {
    color: COLORS.muted,
    fontSize: 14,
    fontFamily: 'Lexend-Medium',
  },

  // Column header
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9EEF5',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  columnLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 11,
    color: '#3A4A5A',
  },

  // Doctor card
  doctorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Lexend-Medium',
    color: COLORS.text,
    paddingRight: 6,
  },
  kpi: {
    width: 64,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Lexend-Bold',
  },
  kpiRevenue: {
    width: 72,
    textAlign: 'right',
    fontSize: 13,
    fontFamily: 'Lexend-Medium',
    color: COLORS.muted,
  },
  arrow: { width: 22, height: 22, marginLeft: 4, resizeMode: 'contain' },

  progressTrack: {
    height: 8,
    backgroundColor: COLORS.barBg,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: 8, borderRadius: 6 },

  expanded: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailLabel: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: COLORS.muted,
  },
  detailValue: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: COLORS.text,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.metricBg,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginHorizontal: 4,
    borderLeftWidth: 4,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: 'Lexend-Bold',
    color: COLORS.text,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'Lexend-Regular',
    color: COLORS.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  fullRevenueNote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 10,
    textAlign: 'center',
  },

  conditionsBlock: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  conditionsHeader: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 10,
  },
  conditionRow: { marginBottom: 12 },
  conditionFunnel: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
    marginBottom: 6,
  },
  conditionName: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: COLORS.text,
  },
  conditionArrow: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: '#B7C0CC',
    marginHorizontal: 6,
  },
  conditionStat: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: COLORS.muted,
  },
  conditionIpd: {
    fontFamily: 'Lexend-Medium',
  },
  conditionTrack: {
    height: 6,
    backgroundColor: COLORS.barBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  conditionFill: { height: 6, borderRadius: 4 },
  subTypeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  subTypeChip: {
    backgroundColor: COLORS.metricBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  subTypeText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: COLORS.muted,
  },
  subTypeCount: {
    fontFamily: 'Lexend-Bold',
    color: COLORS.text,
  },

  empty: {
    textAlign: 'center',
    color: COLORS.muted,
    fontFamily: 'Lexend-Regular',
    marginTop: 40,
    fontSize: 15,
  },

  loadingDialog: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  // Filter modal
  modal: {
    backgroundColor: 'white',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 14,
  },
  modalTitle: {
    fontFamily: 'Lexend-Bold',
    fontSize: 20,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: COLORS.btnPrimary },
  toggleText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    color: COLORS.muted,
  },
  toggleTextActive: { color: '#fff' },
  fieldLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 6,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
  },
  dropdownText: {
    fontSize: 16,
    fontFamily: 'Lexend-Medium',
    color: COLORS.text,
  },
  dropdownList: {
    width: '80%',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 16,
    padding: 10,
    fontFamily: 'Lexend-Regular',
    color: COLORS.text,
  },
  dateField: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateFieldText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: 'Lexend-Regular',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 24,
  },
});
