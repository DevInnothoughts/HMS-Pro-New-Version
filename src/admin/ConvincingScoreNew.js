/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {
  Text,
  Button,
  Portal,
  Modal,
  ActivityIndicator,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import ModalDropdown from 'react-native-modal-dropdown';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InsightsModal, SpecialityDetailTable } from './ConvincingInsights';
import {
  MAX_RANGE_DAYS,
  formatDateIST,
  prettyDate,
  rangeLabel,
  daysBetween,
  startOfToday,
  addDays,
  generateMonthsList,
} from './convincingPeriodUtils';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ── Palette ─────────────────────────────────────────────────────────────── */
const C = {
  bg: '#F4F6F9',
  card: '#FFFFFF',
  ink: '#1F2A37',
  inkSoft: '#6B7280',
  line: '#E7ECF2',
  brand: '#184D67',
  surgeon: '#2F6DB5', // surgeon accent
  assistant: '#7C5CBF', // assistant accent
  good: '#1F9D57',
  mid: '#D98A2B',
  low: '#D1495B',
  track: '#EDF1F6',
  chip: '#EEF2F7',
  neutralBar: '#C9D2DE',
};

const nf = n => (Number(n) || 0).toLocaleString('en-IN');

const pctNum = (num, den) => (den > 0 ? (num / den) * 100 : 0);

const fmtPct = (num, den) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—';

const scoreColor = p => (p >= 60 ? C.good : p >= 35 ? C.mid : C.low);

const getInitials = name =>
  (name || '')
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '–';

/* ── Small presentational pieces ─────────────────────────────────────────── */
const StatTile = ({ label, value, accent, onPress }) => {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container style={styles.tile} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tileVal, accent ? { color: accent } : null]}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Container>
  );
};

const FunnelRow = ({ label, value, note, accent, strong }) => (
  <View style={styles.funnelRow}>
    <View
      style={[
        styles.funnelDot,
        { backgroundColor: strong && accent ? accent : C.line },
      ]}
    />
    <Text style={styles.funnelLabel}>{label}</Text>
    {note ? <Text style={styles.funnelNote}>{note}</Text> : null}
    <Text
      style={[
        styles.funnelVal,
        strong ? { fontFamily: 'Lexend-Bold', color: accent || C.ink } : null,
      ]}
    >
      {value}
    </Text>
  </View>
);

const StatLine = ({ label, value, sub, valueColor, strong }) => (
  <View style={styles.statLine}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.statLabel, strong ? styles.statLabelStrong : null]}>
        {label}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
    <Text
      style={[
        styles.statValue,
        valueColor ? { color: valueColor } : null,
        strong ? { fontSize: 18 } : null,
      ]}
    >
      {value}
    </Text>
  </View>
);

const SpecialityTable = ({ specialities, accent }) => {
  if (!specialities || specialities.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.sectionLabel}>By Condition</Text>
      <View style={styles.tblHead}>
        <Text style={[styles.tblHeadCell, styles.tblNameCol]}>CONDITION</Text>
        <Text style={styles.tblHeadNum}>Seen</Text>
        <Text style={styles.tblHeadNum}>Advised</Text>
        <Text style={styles.tblHeadNum}>Surgery</Text>
      </View>
      {specialities.map(s => (
        <View key={s.speciality} style={styles.tblRowWrap}>
          <View style={styles.tblRow}>
            <Text style={[styles.tblName, styles.tblNameCol]} numberOfLines={1}>
              {s.speciality}
            </Text>
            <Text style={styles.tblNum}>{s.patientCount}</Text>
            <Text style={styles.tblNum}>{s.surgeryAdvised}</Text>
            <Text
              style={[styles.tblNum, styles.tblNumStrong, { color: accent }]}
            >
              {s.ipdCount}
            </Text>
          </View>
          {s.subTypes && s.subTypes.length > 0 && (
            <View style={styles.subList}>
              {s.subTypes.map(st => (
                <View key={st.name} style={styles.subLine}>
                  <Text
                    style={[styles.subLineName, styles.tblNameCol]}
                    numberOfLines={1}
                  >
                    ↳ {st.name}
                  </Text>
                  <Text style={styles.subLineNum}>{st.seen}</Text>
                  <Text style={styles.subLineNum}>{st.advised}</Text>
                  <Text style={[styles.subLineNum, { color: accent }]}>
                    {st.surgery}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const DoctorCard = ({
  item,
  accent,
  roleLabel,
  expanded,
  onToggle,
  detail,
}) => {
  const diagnosed = item.patientCount || 0;
  const advised = item.diagnosisCounts?.Surgery || 0;
  const medication = item.diagnosisCounts?.Medication || 0;
  const done = item.invoiceCount || 0;
  const totalDone = item.totalSurgeriesDone || 0;
  // API field name kept as-is; it is really "diagnosed AND operated within the
  // selected period", which is only "the same month" when a month is selected.
  const inPeriod = item.thisMonthDiagnosedAndSurgeryPerformed || 0;

  const convincing = pctNum(done, advised);
  const sColor = scoreColor(convincing);

  return (
    <View style={styles.docCard}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={styles.docTouch}
      >
        <View style={styles.docTop}>
          <View style={[styles.avatar, { backgroundColor: accent + '1A' }]}>
            <Text style={[styles.avatarText, { color: accent }]}>
              {getInitials(item.doctorName)}
            </Text>
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.docName} numberOfLines={1}>
              {item.doctorName}
            </Text>
            <Text style={styles.docSub}>
              {done}/{advised} advised-surgery converted
            </Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreVal, { color: sColor }]}>
              {fmtPct(done, advised)}
            </Text>
            <Text style={styles.scoreCap}>Convincing Score</Text>
          </View>
          <Image
            source={
              expanded
                ? require('../../assets/up-arrow.png')
                : require('../../assets/down-arrow.png')
            }
            style={styles.chev}
          />
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              {
                width: `${Math.min(convincing, 100)}%`,
                backgroundColor: sColor,
              },
            ]}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.docBody}>
          <Text style={styles.sectionLabel}>Conversion Funnel</Text>
          <FunnelRow label="Patients Diagnosed" value={diagnosed} />
          <FunnelRow
            label="Surgery Advised"
            value={advised}
            note={`${fmtPct(advised, diagnosed)} of diagnosed`}
          />
          <FunnelRow
            label="Surgeries Done"
            value={done}
            note={`${fmtPct(done, advised)} of advised`}
            accent={accent}
            strong
          />
          {/* <FunnelRow
            label="Total Surgeries Done"
            value={totalDone}
            note="every procedure in period"
            accent={accent}
            strong
          /> */}
          <View style={styles.divider} />

          <StatLine
            label="Convincing Score"
            value={fmtPct(done, advised)}
            sub={`${done} of ${advised} advised patients`}
            valueColor={sColor}
            strong
          />
          <StatLine
            label="Overall Conversion"
            value={fmtPct(done, diagnosed)}
            sub={`${done} of ${diagnosed} patients seen`}
          />
          <StatLine
            label="Surgeries in Period"
            value={nf(inPeriod)}
            sub={`${fmtPct(
              inPeriod,
              advised,
            )} of advised, done within the period`}
          />

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
            Advice Split
          </Text>
          <View style={styles.splitBar}>
            <View
              style={{
                flex: Math.max(advised, 0.0001),
                backgroundColor: accent,
              }}
            />
            <View
              style={{
                flex: Math.max(medication, 0.0001),
                backgroundColor: C.neutralBar,
              }}
            />
          </View>
          <View style={styles.splitLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text style={styles.legendText}>Surgery advised · {advised}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: C.neutralBar }]} />
              <Text style={styles.legendText}>Medication · {medication}</Text>
            </View>
          </View>

          <SpecialityTable
            specialities={item.specialities}
            detail={detail}
            accent={accent}
          />
        </View>
      )}
    </View>
  );
};

const Tab = ({ label, count, active, color, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active ? { borderBottomColor: color } : null]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[styles.tabText, active ? { color } : null]}>
      {label} ({count})
    </Text>
  </TouchableOpacity>
);

/* ── Screen ──────────────────────────────────────────────────────────────── */
const ConvincingScoreV1 = ({ navigation }) => {
  const location = useSelector(state => state.location.value);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [tab, setTab] = useState('surgeons');
  const [branchTotal, setBranchTotal] = useState({
    newAppointmentCount: 0,
    totalDiagnosisCount: 0,
    totalMedication: 0,
    totalSurgery: 0,
  });

  const [mainDoctorPerformance, setMainDoctorPerformance] = useState([]);
  const [asstDoctorPerformance, setAsstDoctorPerformance] = useState([]);
  const [insights, setInsights] = useState(null);
  const [metricModal, setMetricModal] = useState(null); // { key, label }

  const BACKEND_URL = 'http://10.0.0.30:5100/hms';

  const generateMonthsList = () => {
    const currentDate = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1,
      );
      months.push({
        label: date.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        }),
        value: date,
      });
    }
    return months;
  };

  const [monthsList] = useState(generateMonthsList());
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]);

  // label shown on the period chip — now a month name OR a custom range
  const [periodLabel, setPeriodLabel] = useState(monthsList[0].label);

  // 'month' | 'custom'
  const [filterMode, setFilterMode] = useState('month');

  // native date-picker visibility
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  const hideModal1 = () => setVisible1(false);

  // Reset the draft to whatever is currently applied whenever the modal opens
  const openFilter = () => {
    setVisible1(true);
  };

  const handleMonthChange = index => {
    const selected = monthsList[index];
    setSelectedMonth(selected);
    setFromDate(
      new Date(selected.value.getFullYear(), selected.value.getMonth(), 1),
    );
    setToDate(
      new Date(selected.value.getFullYear(), selected.value.getMonth() + 1, 0),
    );
  };

  // Quick presets inside Custom mode
  const applyPreset = key => {
    const today = startOfToday();
    if (key === '7d') {
      setFromDate(addDays(today, -6));
      setToDate(today);
    } else if (key === '30d') {
      setFromDate(addDays(today, -29));
      setToDate(today);
    } else if (key === '90d') {
      setFromDate(addDays(today, -89));
      setToDate(today);
    } else if (key === 'fy') {
      // Indian FY: Apr 1 → today
      const y =
        today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setFromDate(new Date(y, 3, 1));
      setToDate(today);
    }
  };

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fetchConvincingScore(
      location,
      formatDateIST(startOfMonth),
      formatDateIST(endOfMonth),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const fetchConvincingScore = (loc, from, to) => {
    const requestOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
    };
    setLoading(true);
    setInsights(null);

    fetch(
      `${BACKEND_URL}/ConvincingScore/v3?location=${encodeURIComponent(
        loc,
      )}&from=${from}&to=${to}`,
      requestOptions,
    )
      .then(async r => {
        const body = await r.json();
        if (!r.ok)
          throw new Error(body?.error || `Request failed (${r.status})`);
        return body;
      })
      .then(res => {
        setMainDoctorPerformance(res.consultantDoctors || []);
        setAsstDoctorPerformance(res.assistantDoctors || []);
        if (res.branchTotal) setBranchTotal(res.branchTotal);
        setExpandedId(null);
      })
      .catch(err => {
        console.log('convincing score error:', err);
        setMainDoctorPerformance([]);
        setAsstDoctorPerformance([]);
        Alert.alert('Could not load data', err.message);
      })
      .finally(() => setLoading(false));

    fetch(
      `${BACKEND_URL}/convincingInsights?location=${encodeURIComponent(
        loc,
      )}&from=${from}&to=${to}`,
      requestOptions,
    )
      .then(r => (r.ok ? r.json() : null))
      .then(setInsights)
      .catch(err => console.log('insights error:', err));
  };

  const applyFilter = () => {
    if (filterMode === 'month') {
      setPeriodLabel(selectedMonth.label);
      hideModal1();
      fetchConvincingScore(
        location,
        formatDateIST(fromDate),
        formatDateIST(toDate),
      );
      return;
    }

    // ── Custom range validation ──────────────────────────────────────────
    const f = formatDateIST(fromDate);
    const t = formatDateIST(toDate);

    if (f > t) {
      Alert.alert(
        'Invalid range',
        '“From” date cannot be after the “To” date.',
      );
      return;
    }
    if (t > formatDateIST(new Date())) {
      Alert.alert('Invalid range', '“To” date cannot be in the future.');
      return;
    }
    const span = daysBetween(fromDate, toDate);
    if (span > MAX_RANGE_DAYS) {
      Alert.alert(
        'Range too large',
        `Please select ${MAX_RANGE_DAYS} days or fewer. You selected ${span} days.`,
      );
      return;
    }

    setPeriodLabel(rangeLabel(fromDate, toDate));
    hideModal1();
    fetchConvincingScore(location, f, t);
  };

  const toggleExpand = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const switchTab = t => {
    setTab(t);
    setExpandedId(null);
  };

  const accent = tab === 'surgeons' ? C.surgeon : C.assistant;
  const list =
    tab === 'surgeons' ? mainDoctorPerformance : asstDoctorPerformance;

  const surgeriesPerformed = insights?.metrics?.surgeriesPerformed?.total || 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Fixed header — stays put */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={require('../../assets/back.png')}
            style={{ height: 34, width: 34, tintColor: C.brand }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Convincing Score</Text>
        <TouchableOpacity
          onPress={openFilter}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={require('../../assets/filter.png')}
            style={{ height: 28, width: 28, tintColor: C.brand }}
          />
        </TouchableOpacity>
      </View>

      {/* ── Single page scroll ─────────────────────────────────────────── */}
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[2]}
      >
        {/* 0 — Period chip + Comparison entry */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.periodChip}
            onPress={openFilter}
            activeOpacity={0.8}
          >
            <Text style={styles.periodText}>{periodLabel}</Text>
            <Text style={styles.periodEdit}>Change</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.compareBtn}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ConvincingComparisonScreen', {
                location,
              })
            }
          >
            <Text style={styles.compareBtnText}>Comparison</Text>
            <Text style={styles.compareBtnChev}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 1 — Branch summary tiles */}
        <View style={styles.summaryCard}>
          <StatTile
            label="New Appts"
            value={nf(branchTotal.newAppointmentCount)}
            onPress={() =>
              insights &&
              setMetricModal({ key: 'newAppts', label: 'New Appts' })
            }
          />
          <View style={styles.tileDiv} />
          <StatTile
            label="Diagnoses"
            value={nf(branchTotal.totalDiagnosisCount)}
            onPress={() =>
              insights &&
              setMetricModal({ key: 'diagnoses', label: 'Diagnoses' })
            }
          />
          <View style={styles.tileDiv} />
          <StatTile
            label="Surgery Adv."
            value={nf(branchTotal.totalSurgery)}
            onPress={() =>
              insights &&
              setMetricModal({ key: 'surgeryAdvised', label: 'Surgery Adv.' })
            }
          />
          <View style={styles.tileDiv} />
          <StatTile
            label="Surgeries Performed"
            value={nf(surgeriesPerformed)}
            onPress={() =>
              insights &&
              setMetricModal({
                key: 'surgeriesPerformed',
                label: 'Surgeries Performed',
              })
            }
          />
        </View>

        {/* 3 — Tabs (sticky) */}
        <View style={styles.tabsSticky}>
          <View style={styles.tabs}>
            <Tab
              label="Surgeons"
              count={mainDoctorPerformance.length}
              active={tab === 'surgeons'}
              color={C.surgeon}
              onPress={() => switchTab('surgeons')}
            />
            <Tab
              label="Assistant Doctors"
              count={asstDoctorPerformance.length}
              active={tab === 'assistants'}
              color={C.assistant}
              onPress={() => switchTab('assistants')}
            />
          </View>
        </View>

        {/* 4 — Legend */}
        <Text style={styles.legendLine}>
          Convincing Score = surgeries done ÷ surgeries advised
        </Text>

        {/* 5 — Doctor list (plain Views now, no inner ScrollView) */}
        <View style={styles.listContent}>
          {list && list.length > 0 ? (
            list.map(item => {
              const key =
                item.doctorId != null ? String(item.doctorId) : item.doctorName;
              return (
                <DoctorCard
                  key={key}
                  item={item}
                  accent={accent}
                  roleLabel={tab === 'surgeons' ? 'Surgeon' : 'Assistant'}
                  expanded={expandedId === key}
                  onToggle={() => toggleExpand(key)}
                  detail={
                    (
                      (tab === 'surgeons'
                        ? insights?.consultantDoctors
                        : insights?.assistantDoctors) || []
                    ).find(d => String(d.doctorId) === String(item.doctorId))
                      ?.specialities || []
                  }
                />
              );
            })
          ) : !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No data available</Text>
              <Text style={styles.emptySub}>
                Try a different period from the filter above.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Loading overlay — absolute, stays above the scroll */}
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      )}

      {/* Period filter */}
      <Portal>
        <Modal
          visible={visible1}
          onDismiss={hideModal1}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Select Period</Text>

          {/* Mode toggle */}
          <View style={styles.toggleRow}>
            {[
              { key: 'month', label: 'Monthly' },
              { key: 'custom', label: 'Custom Range' },
            ].map(m => {
              const active = filterMode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                  onPress={() => setFilterMode(m.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      active && styles.toggleTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filterMode === 'month' ? (
            <ModalDropdown
              style={styles.dropdown}
              textStyle={styles.dropdownText}
              dropdownStyle={styles.dropdownList}
              dropdownTextStyle={styles.dropdownItemText}
              options={monthsList.map(m => m.label)}
              onSelect={handleMonthChange}
              defaultValue={selectedMonth.label}
            />
          ) : (
            <View>
              {/* Presets */}
              <View style={styles.presetRow}>
                {[
                  { key: '7d', label: '7D' },
                  { key: '30d', label: '30D' },
                  { key: '90d', label: '90D' },
                  { key: 'fy', label: 'This FY' },
                ].map(p => (
                  <TouchableOpacity
                    key={p.key}
                    style={styles.presetChip}
                    onPress={() => applyPreset(p.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.presetText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>From</Text>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => setOpenFrom(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.dateFieldText}>{prettyDate(fromDate)}</Text>
                <Text style={styles.dateFieldHint}>Change</Text>
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>To</Text>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => setOpenTo(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.dateFieldText}>{prettyDate(toDate)}</Text>
                <Text style={styles.dateFieldHint}>Change</Text>
              </TouchableOpacity>

              <Text style={styles.rangeNote}>
                {daysBetween(fromDate, toDate)} day
                {daysBetween(fromDate, toDate) === 1 ? '' : 's'} selected
              </Text>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={hideModal1}
                style={styles.mBtn}
                textColor={C.brand}
              >
                Back
              </Button>
              <Button
                mode="contained"
                onPress={applyFilter}
                style={styles.mBtn}
                buttonColor={C.brand}
              >
                Apply
              </Button>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>

      {/* Native date pickers — kept OUTSIDE the Portal Modal so they layer above it */}
      <DatePicker
        modal
        mode="date"
        title="From date"
        open={openFrom}
        date={fromDate}
        maximumDate={new Date()}
        onConfirm={d => {
          setOpenFrom(false);
          setFromDate(d);
          if (formatDateIST(d) > formatDateIST(toDate)) setToDate(d);
        }}
        onCancel={() => setOpenFrom(false)}
      />
      <DatePicker
        modal
        mode="date"
        title="To date"
        open={openTo}
        date={toDate}
        minimumDate={fromDate}
        maximumDate={new Date()}
        onConfirm={d => {
          setOpenTo(false);
          setToDate(d);
        }}
        onCancel={() => setOpenTo(false)}
      />

      <InsightsModal
        visible={!!metricModal}
        metricLabel={metricModal?.label}
        data={
          metricModal && insights ? insights.metrics[metricModal.key] : null
        }
        accent={accent}
        onClose={() => setMetricModal(null)}
      />
    </SafeAreaView>
  );
};

export default ConvincingScoreV1;

/* ── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    height: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: {
    fontFamily: 'Lexend-Bold',
    fontSize: 18,
    color: C.ink,
  },

  periodChip: {
    alignSelf: 'flex-start',
    marginLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EEF5',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  periodText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: C.brand,
  },
  periodEdit: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.surgeon,
    marginLeft: 8,
  },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.line,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  tile: { flex: 1, alignItems: 'center' },
  tileVal: {
    fontFamily: 'Lexend-Bold',
    fontSize: 19,
    color: C.ink,
  },
  tileLabel: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
    marginTop: 3,
    textAlign: 'center',
  },
  tileDiv: { width: 1, backgroundColor: C.line, marginVertical: 4 },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    color: C.inkSoft,
  },

  legendLine: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11.5,
    color: C.inkSoft,
    marginHorizontal: 16,
    marginTop: 10,
    fontStyle: 'italic',
  },

  listContent: { padding: 14, paddingBottom: 32 },

  /* Doctor card */
  docCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  docTouch: { padding: 14 },
  docTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontFamily: 'Lexend-Bold', fontSize: 14 },
  docName: { fontFamily: 'Lexend-Medium', fontSize: 15, color: C.ink },
  docSub: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11.5,
    color: C.inkSoft,
    marginTop: 2,
  },
  scoreBox: { alignItems: 'flex-end', marginRight: 4 },
  scoreVal: { fontFamily: 'Lexend-Bold', fontSize: 20 },
  scoreCap: {
    fontFamily: 'Lexend-Regular',
    fontSize: 9.5,
    color: C.inkSoft,
    marginTop: 1,
  },
  chev: { width: 22, height: 22, resizeMode: 'contain', marginLeft: 2 },

  track: {
    height: 7,
    backgroundColor: C.track,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 12,
  },
  trackFill: { height: 7, borderRadius: 5 },

  docBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'Lexend-Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    color: C.inkSoft,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },

  /* Funnel */
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  funnelDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  funnelLabel: {
    flex: 1,
    fontFamily: 'Lexend-Regular',
    fontSize: 13.5,
    color: C.ink,
  },
  funnelNote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
    marginRight: 10,
  },
  funnelVal: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    color: C.ink,
    minWidth: 34,
    textAlign: 'right',
  },

  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 },

  /* Stat lines */
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: { fontFamily: 'Lexend-Regular', fontSize: 13.5, color: C.ink },
  statLabelStrong: { fontFamily: 'Lexend-Medium' },
  statSub: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
    marginTop: 1,
  },
  statValue: { fontFamily: 'Lexend-Bold', fontSize: 15, color: C.ink },

  /* Advice split */
  splitBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: C.track,
  },
  splitLegend: { flexDirection: 'row', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
  dot: { width: 9, height: 9, borderRadius: 2, marginRight: 6 },
  legendText: { fontFamily: 'Lexend-Regular', fontSize: 12, color: C.inkSoft },

  /* Condition table */
  tblHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  tblNameCol: { flex: 1, textAlign: 'left' },
  tblHeadCell: {
    fontFamily: 'Lexend-Medium',
    fontSize: 10,
    letterSpacing: 0.4,
    color: C.inkSoft,
  },
  tblHeadNum: {
    width: 56,
    textAlign: 'right',
    fontFamily: 'Lexend-Medium',
    fontSize: 10,
    color: C.inkSoft,
  },
  tblRowWrap: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F4F8',
  },
  tblRow: { flexDirection: 'row', alignItems: 'center' },
  tblName: { fontFamily: 'Lexend-Medium', fontSize: 13, color: C.ink },
  tblNum: {
    width: 56,
    textAlign: 'right',
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: C.ink,
  },
  tblNumStrong: { fontFamily: 'Lexend-Bold' },

  subTypeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingLeft: 2,
  },
  subTypeChip: {
    backgroundColor: C.chip,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  subTypeText: { fontFamily: 'Lexend-Regular', fontSize: 11, color: '#5A6B7B' },
  subTypeCount: { fontFamily: 'Lexend-Bold', color: C.ink },

  /* Empty + loading */
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Lexend-Bold', fontSize: 16, color: C.ink },
  emptySub: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: C.inkSoft,
    marginTop: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,246,249,0.6)',
  },

  subList: { marginTop: 6, paddingLeft: 2 },
  subLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  subLineName: { fontFamily: 'Lexend-Regular', fontSize: 12, color: '#5A6B7B' },
  subLineNum: {
    width: 56,
    textAlign: 'right',
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: '#5A6B7B',
  },

  /* Modal */
  modal: {
    backgroundColor: C.card,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  modalTitle: {
    fontFamily: 'Lexend-Bold',
    fontSize: 18,
    color: C.ink,
    textAlign: 'center',
    marginBottom: 18,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#FAFBFD',
  },
  dropdownText: { fontFamily: 'Lexend-Medium', fontSize: 15, color: C.ink },
  dropdownList: {
    width: '78%',
    borderRadius: 10,
    borderColor: C.line,
    marginTop: 6,
  },
  dropdownItemText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 15,
    color: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  mBtn: { flex: 1, marginHorizontal: 6, borderColor: C.brand },
  /* Filter mode toggle */
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: C.chip,
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
  toggleBtnActive: { backgroundColor: C.brand },
  toggleText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: C.inkSoft,
  },
  toggleTextActive: { color: '#fff' },

  /* Custom range */
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FAFBFD',
    alignItems: 'center',
  },
  presetText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    color: C.brand,
  },
  fieldLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: C.inkSoft,
    marginBottom: 6,
  },
  dateField: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#FAFBFD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 15,
    color: C.ink,
  },
  dateFieldHint: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.surgeon,
  },
  rangeNote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 14,
  },
  compareBlock: { marginTop: 18 },
  compareRow: { flexDirection: 'row' },
  compareChip: {
    flex: 1,
    marginRight: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FAFBFD',
    alignItems: 'center',
  },
  compareChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  compareText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    color: C.inkSoft,
  },
  compareTextActive: { color: '#fff' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    marginTop: 12,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.brand,
  },
  compareBtnText: { fontFamily: 'Lexend-Medium', fontSize: 12, color: '#fff' },
  compareBtnChev: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 5,
    marginTop: -2,
  },
});
