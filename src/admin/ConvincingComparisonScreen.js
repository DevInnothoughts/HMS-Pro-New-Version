/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// ConvincingComparisonScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Standalone period-over-period comparison, opened from the Convincing Score
// screen. Owns its own period + comparison filter — changing the period here
// does NOT affect the main screen, and vice versa. It only inherits the main
// screen's period as its starting point.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Text,
  Button,
  Modal,
  Portal,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ModalDropdown from 'react-native-modal-dropdown';
import DatePicker from 'react-native-date-picker';

import { ComparisonSection } from './ConvincingComparison';
import {
  MAX_RANGE_DAYS,
  formatDateIST,
  prettyDate,
  rangeLabel,
  daysBetween,
  startOfToday,
  addDays,
  generateMonthsList,
  generateQuartersList,
  generateFyList,
} from './convincingPeriodUtils';

// Keep in sync with ConvincingScoreNew.js.
const BACKEND_URL = 'http://10.0.0.30:5100/hms';

const C = {
  bg: '#F4F6F9',
  card: '#FFFFFF',
  ink: '#1F2A37',
  inkSoft: '#6B7280',
  line: '#E7ECF2',
  brand: '#184D67',
  surgeon: '#2F6F8F',
  assistant: '#7B5EA7',
  chip: '#EEF2F7',
};
// Comparison always opens on the current calendar month, regardless of what
// period the main screen was showing.
const currentMonthRange = () => {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
};

const Tab = ({ label, active, color, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, active && { borderBottomColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text
      style={[styles.tabText, active && { color, fontFamily: 'Lexend-Bold' }]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const ConvincingComparisonScreen = ({ navigation, route }) => {
  const { location } = route.params || {};

  const [monthsList] = useState(generateMonthsList());
  const [quartersList] = useState(generateQuartersList());
  const [fyList] = useState(generateFyList());

  // 'month' | 'quarter' | 'fy' | 'custom'
  const [filterMode, setFilterMode] = useState('month');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [periodLabel, setPeriodLabel] = useState(monthsList[0].label);
  const [fromDate, setFromDate] = useState(() => currentMonthRange().from);
  const [toDate, setToDate] = useState(() => currentMonthRange().to);
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);
  const [visible, setVisible] = useState(false);

  const [compareMode, setCompareMode] = useState('mom');
  const [trendPeriods, setTrendPeriods] = useState(4);

  const [tab, setTab] = useState('surgeons');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [pickerOpen, setPickerOpen] = useState(false);

  const activeOptions = useMemo(
    () =>
      filterMode === 'quarter'
        ? quartersList
        : filterMode === 'fy'
        ? fyList
        : monthsList,
    [filterMode, quartersList, fyList, monthsList],
  );

  // Stable identity — ModalDropdown resets its own label if this changes ref.
  const activeLabels = useMemo(
    () => activeOptions.map(o => o.label),
    [activeOptions],
  );

  const activeOption = activeOptions[selectedIdx] || activeOptions[0];

  const fetchComparison = useCallback(
    (from, to, mode, periods) => {
      setLoading(true);
      setError(null);
      fetch(
        `${BACKEND_URL}/ConvincingScore/comparison?location=${encodeURIComponent(
          location,
        )}&from=${from}&to=${to}&mode=${mode}&periods=${periods}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      )
        .then(async r => {
          const body = await r.json();
          if (!r.ok)
            throw new Error(body?.error || `Request failed (${r.status})`);
          return body;
        })
        .then(setData)
        .catch(err => {
          console.log('comparison error:', err);
          setData(null);
          setError(err.message);
        })
        .finally(() => setLoading(false));
    },
    [location],
  );

  // Initial load using the period inherited from the main screen.
  useEffect(() => {
    fetchComparison(
      formatDateIST(fromDate),
      formatDateIST(toDate),
      compareMode,
      trendPeriods,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changePeriodMode = mode => {
    setFilterMode(mode);
    setSelectedIdx(0);
    setPickerOpen(false);

    if (mode === 'month') {
      const o = monthsList[0];
      setFromDate(new Date(o.value.getFullYear(), o.value.getMonth(), 1));
      setToDate(new Date(o.value.getFullYear(), o.value.getMonth() + 1, 0));
      setCompareMode('mom');
    } else if (mode === 'quarter') {
      setFromDate(quartersList[0].from);
      setToDate(quartersList[0].to);
      setCompareMode('qoq');
    } else if (mode === 'fy') {
      setFromDate(fyList[0].from);
      setToDate(fyList[0].to);
      setCompareMode('yoy');
    } else {
      // Custom: no natural comparison unit, so step back one month per period.
      setCompareMode('mom');
    }
  };

  const handleOptionChange = index => {
    setSelectedIdx(index);
    const o = activeOptions[index];
    if (filterMode === 'month') {
      setFromDate(new Date(o.value.getFullYear(), o.value.getMonth(), 1));
      setToDate(new Date(o.value.getFullYear(), o.value.getMonth() + 1, 0));
    } else {
      setFromDate(o.from);
      setToDate(o.to);
    }
  };

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
      const y =
        today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setFromDate(new Date(y, 3, 1));
      setToDate(today);
    }
  };

  const applyFilter = () => {
    const f = formatDateIST(fromDate);
    const t = formatDateIST(toDate);

    if (filterMode === 'custom') {
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
    } else {
      setPeriodLabel(activeOption.label);
    }

    setVisible(false);
    fetchComparison(f, t, compareMode, trendPeriods);
  };

  const PERIOD_WORD = {
    month: 'months',
    quarter: 'quarters',
    fy: 'financial years',
    custom: 'periods',
  };
  const unitWord = PERIOD_WORD[filterMode];

  const COMPARE_CAPTION = {
    month: 'Compared month on month (MoM)',
    quarter: 'Compared quarter on quarter (QoQ)',
    fy: 'Compared year on year (YoY)',
    custom: 'Compared against the same span, one month back',
  };

  console.log(
    'DROPDOWN',
    filterMode,
    selectedIdx,
    activeOptions.length,
    activeOption?.label,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header — filter here applies to THIS screen only */}
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
        <Text style={styles.headerTitle}>Score Comparison</Text>
        <TouchableOpacity
          onPress={() => setVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={require('../../assets/filter.png')}
            style={{ height: 28, width: 28, tintColor: C.brand }}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Period chip */}
        <TouchableOpacity
          style={styles.periodChip}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.periodText}>{periodLabel}</Text>
          <Text style={styles.periodCompare}>{compareMode.toUpperCase()}</Text>
          <Text style={styles.periodEdit}>Change</Text>
        </TouchableOpacity>

        {/* Role tabs — drives which doctor list the comparison shows */}
        <View style={styles.tabs}>
          <Tab
            label="Surgeons"
            active={tab === 'surgeons'}
            color={C.surgeon}
            onPress={() => setTab('surgeons')}
          />
          <Tab
            label="Assistant Doctors"
            active={tab === 'assistants'}
            color={C.assistant}
            onPress={() => setTab('assistants')}
          />
        </View>

        <ComparisonSection
          data={data}
          loading={loading}
          error={error}
          expanded
          onToggle={() => {}}
          tab={tab}
        />
      </ScrollView>

      {/* Filter modal */}
      <Portal>
        <Modal
          visible={visible}
          onDismiss={() => setVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Comparison Filter</Text>

            <View style={styles.toggleRow}>
              {[
                { key: 'month', label: 'Month' },
                { key: 'quarter', label: 'Quarter' },
                { key: 'fy', label: 'FY' },
                // { key: 'custom', label: 'Custom' },
              ].map(m => {
                const active = filterMode === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                    onPress={() => changePeriodMode(m.key)}
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

            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setPickerOpen(v => !v)}
              activeOpacity={0.8}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {activeOption?.label ?? 'Select period'}
              </Text>
              <Text style={styles.dropdownChev}>{pickerOpen ? '▴' : '▾'}</Text>
            </TouchableOpacity>

            {pickerOpen && (
              <View style={styles.pickerList}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {activeOptions.map((o, i) => {
                    const isSel = i === selectedIdx;
                    return (
                      <TouchableOpacity
                        key={o.label}
                        style={[
                          styles.pickerRow,
                          isSel && styles.pickerRowActive,
                        ]}
                        onPress={() => {
                          handleOptionChange(i);
                          setPickerOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pickerRowText,
                            isSel && styles.pickerRowTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {o.label}
                        </Text>
                        {isSel && <Text style={styles.pickerTick}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Custom date range — disabled per client request ──────────
                 ...existing commented block stays as-is...
            ──────────────────────────────────────────────────────────────── */}

            {/* What this will compare against — derived, not selectable */}
            <View style={styles.compareInfo}>
              <Text style={styles.compareInfoText}>
                {COMPARE_CAPTION[filterMode]}
              </Text>
            </View>

            {/* Trend Depth */}
            <View style={styles.compareBlock}>
              <Text style={styles.fieldLabel}>Trend Depth</Text>
              <View style={styles.compareRow}>
                {[2, 3, 4, 6].map(n => {
                  const active = trendPeriods === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.compareChip,
                        active && styles.compareChipActive,
                      ]}
                      onPress={() => setTrendPeriods(n)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.compareText,
                          active && styles.compareTextActive,
                        ]}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.depthNote}>
                Last {trendPeriods} {unitWord}, including the selected period.
              </Text>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setVisible(false)}
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
          </ScrollView>
        </Modal>
      </Portal>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { fontFamily: 'Lexend-Bold', fontSize: 16, color: C.ink },
  pageContent: { flexGrow: 1, paddingBottom: 36 },

  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.chip,
  },
  periodText: { fontFamily: 'Lexend-Medium', fontSize: 12, color: C.ink },
  periodCompare: {
    fontFamily: 'Lexend-Bold',
    fontSize: 10,
    color: '#fff',
    backgroundColor: C.surgeon,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 8,
    overflow: 'hidden',
  },
  periodEdit: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: C.brand,
    marginLeft: 8,
  },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontFamily: 'Lexend-Medium', fontSize: 12.5, color: C.inkSoft },

  modal: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontFamily: 'Lexend-Bold',
    fontSize: 16,
    color: C.ink,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  mBtn: { marginLeft: 10, borderRadius: 8 },

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
  toggleText: { fontFamily: 'Lexend-Medium', fontSize: 13, color: C.inkSoft },
  toggleTextActive: { color: '#fff' },

  dropdown: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#FAFBFD',
    flexDirection: 'row', // ← added
    alignItems: 'center', // ← added
    justifyContent: 'space-between', // ← added
  },
  dropdownChev: { fontSize: 12, color: C.inkSoft, marginLeft: 8 },

  pickerList: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  pickerRowActive: { backgroundColor: C.chip },
  pickerRowText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: C.ink,
    flex: 1,
  },
  pickerRowTextActive: { fontFamily: 'Lexend-Medium', color: C.brand },
  pickerTick: {
    fontFamily: 'Lexend-Bold',
    fontSize: 13,
    color: C.brand,
    marginLeft: 8,
  },

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
  presetText: { fontFamily: 'Lexend-Medium', fontSize: 12, color: C.brand },
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
  dateFieldText: { fontFamily: 'Lexend-Medium', fontSize: 15, color: C.ink },
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
  compareText: { fontFamily: 'Lexend-Medium', fontSize: 12, color: C.inkSoft },
  compareTextActive: { color: '#fff' },
  depthNote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: C.inkSoft,
    marginTop: 6,
  },
  compareInfo: {
    backgroundColor: C.chip,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 18,
  },
  compareInfoText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 11.5,
    color: C.brand,
  },
});

export default ConvincingComparisonScreen;
