/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Card,
  Text,
  Divider,
  Portal,
  Modal,
  Button,
  RadioButton,
  Dialog,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ModalDropdown from 'react-native-modal-dropdown';
import { PieChart } from 'react-native-svg-charts';
import { G, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';

const BACKEND_URL = 'http://10.0.0.30:5100/hms';

/* ─────────────────────────────────────────────────────────────
 * Static helpers
 * ────────────────────────────────────────────────────────── */

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

// Fiscal months, April first.
const MONTH_LABELS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
];

// Fallback labels, used only when the API doesn't send referenceTypeMap.
const REFERENCE_TYPE_LABELS = {
  dr_ref: 'Referred By Doctor',
  family_friends: 'Family Friends',
  hhc_board: 'HHC Board',
  HHF: 'HHF',
  internet: 'Internet',
  MediaRef: 'Media Referral',
  newspaper: 'Newspaper',
  old_ref: 'Old Patient Referral',
  other: 'Other',
  WOM: 'Word of Mouth',
  self_old_pt: 'Old Patient',
  hhc_branch: 'HHC Branch',
  null: 'Unknown',
};

// FY 2025-2026 → 2025. Before April we're still in the previous FY.
const currentFyStart = (d = new Date()) =>
  d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;

// How many months of this FY have actually started — keeps the table from
// showing a wall of zeros for months that haven't happened yet.
const elapsedMonths = fyStart => {
  const nowFy = currentFyStart();
  if (fyStart < nowFy) return 12; // a completed FY
  if (fyStart > nowFy) return 0; // a future FY
  const now = new Date();
  const idx = (now.getFullYear() - fyStart) * 12 + now.getMonth() - 3;
  return Math.min(12, Math.max(1, idx + 1));
};

const pct = (cur, base) =>
  base > 0 ? ((cur - base) / base) * 100 : cur > 0 ? null : 0;

/**
 * Pull one number out of a month bucket.
 * Tolerates a missing bucket and string-typed counts from the DB driver.
 */
const valueOf = (bucket, refType = 'ALL', metric = 'patients') => {
  if (!bucket) return 0;
  if (metric === 'invoices') {
    return refType === 'ALL'
      ? Number(bucket.invoices) || 0
      : Number(bucket.invoiceByType?.[refType]) || 0;
  }
  return refType === 'ALL'
    ? Number(bucket.total) || 0
    : Number(bucket.byType?.[refType]) || 0;
};

/**
 * Turns the API's 12 fiscal months into comparison rows.
 *   MoM → each month vs the previous month of the same FY
 *   QoQ → fiscal quarters, each vs the previous quarter
 *   YoY → each month vs the same month of the previous FY
 */
export const buildComparisonRows = (
  months,
  mode,
  refType = 'ALL',
  metric = 'patients',
  limit = 12,
) => {
  if (!Array.isArray(months) || months.length === 0 || limit <= 0) return [];

  if (mode === 'QoQ') {
    const QUARTERS = [
      { label: 'Q1 (Apr–Jun)', idx: [0, 1, 2] },
      { label: 'Q2 (Jul–Sep)', idx: [3, 4, 5] },
      { label: 'Q3 (Oct–Dec)', idx: [6, 7, 8] },
      { label: 'Q4 (Jan–Mar)', idx: [9, 10, 11] },
    ].filter(q => q.idx[0] < limit);

    const rows = QUARTERS.map(q => ({
      label: q.label,
      value: q.idx.reduce(
        (s, i) =>
          s + (i < limit ? valueOf(months[i]?.current, refType, metric) : 0),
        0,
      ),
      lastYear: q.idx.reduce(
        (s, i) =>
          s + (i < limit ? valueOf(months[i]?.previous, refType, metric) : 0),
        0,
      ),
    }));

    return rows.map((r, i) => {
      const base = i === 0 ? null : rows[i - 1].value;
      return {
        ...r,
        base,
        baseLabel: i === 0 ? '—' : rows[i - 1].label,
        delta: base == null ? null : r.value - base,
        pct: base == null ? null : pct(r.value, base),
      };
    });
  }

  const rows = months.slice(0, limit).map((m, i) => ({
    label: MONTH_LABELS[i],
    value: valueOf(m?.current, refType, metric),
    lastYear: valueOf(m?.previous, refType, metric),
  }));

  return rows.map((r, i) => {
    const base =
      mode === 'YoY' ? r.lastYear : i === 0 ? null : rows[i - 1].value;
    const baseLabel =
      mode === 'YoY' ? `${r.label} LY` : i === 0 ? '—' : rows[i - 1].label;
    return {
      ...r,
      base,
      baseLabel,
      delta: base == null ? null : r.value - base,
      pct: base == null ? null : pct(r.value, base),
    };
  });
};

/* ─────────────────────────────────────────────────────────────
 * Screen
 * ────────────────────────────────────────────────────────── */

const ReferenceData = ({ navigation }) => {
  const location = useSelector(state => state.location.value);

  // All hooks declared unconditionally at top level, same order every render.
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [visible1, setVisible1] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalInvoiceCount, setTotalInvoiceCount] = useState(0);
  const [filterType, setFilterType] = useState('month');
  const [monthsList] = useState(generateMonthsList);
  const [month, setMonth] = useState(() => generateMonthsList()[0].label);
  const [selectedMonth, setSelectedMonth] = useState(
    () => generateMonthsList()[0],
  );
  const [selectedYear, setSelectedYear] = useState(null);
  const [customFromDate, setCustomFromDate] = useState(new Date());
  const [customToDate, setCustomToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Month-wise comparison (financial-year modes only)
  const [monthwise, setMonthwise] = useState(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState(null);
  const [comparison, setComparison] = useState('MoM'); // 'MoM' | 'QoQ' | 'YoY'
  const [metric, setMetric] = useState('patients'); // 'patients' | 'invoices'
  const [refTypeFilter, setRefTypeFilter] = useState('ALL');

  const yearsList = [
    { label: '2022-2023', value: '2022' },
    { label: '2023-2024', value: '2023' },
    { label: '2024-2025', value: '2024' },
    { label: '2025-2026', value: '2025' },
    { label: '2026-2027', value: '2026' },
  ];

  const hideModal1 = () => setVisible1(false);

  /* ── Fetching ─────────────────────────────────────────── */

  const fetchReferenceTypeCounts = async (loc, from, to) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/Patient/referenceV2?location=${loc}&from=${from}&to=${to}`,
      );
      const result = await response.json();
      const sortedData = (result.referenceTypeCount || []).sort(
        (a, b) => b.count - a.count,
      );
      setTotalCount(result.totalCount || 0);
      setTotalInvoiceCount(result.totalInvoiceCount || 0);
      setData(sortedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Runs its own spinner so it doesn't fight fetchReferenceTypeCounts
  // when both are in flight from the same Promise.all.
  const fetchMonthwise = async (loc, start) => {
    setCompLoading(true);
    setCompError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/Patient/referenceMonthwise?location=${loc}&fyStart=${start}`,
      );
      const json = await res.json();

      if (!res.ok || !Array.isArray(json?.months)) {
        console.warn('referenceMonthwise unexpected payload:', json);
        setMonthwise(null);
        setCompError(
          json?.error || 'Month-wise data is unavailable for this period.',
        );
        return;
      }

      // Leave this in while validating the endpoint — it prints the first
      // month's bucket so you can see immediately whether the API or the
      // screen is responsible for empty numbers.
      console.log('referenceMonthwise sample:', JSON.stringify(json.months[0]));

      setMonthwise(json);
    } catch (e) {
      console.error('Error fetching monthwise reference data:', e);
      setMonthwise(null);
      setCompError('Could not load month-wise data.');
    } finally {
      setCompLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toLocaleDateString('en-CA');
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).toLocaleDateString('en-CA');
    fetchReferenceTypeCounts(location, startOfMonth, endOfMonth);
  }, [location]);

  /* ── Filter handlers ──────────────────────────────────── */

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

  const handleYearChange = index => {
    const selected = yearsList[index];
    setSelectedYear(selected);
    setFromDate(new Date(Number(selected.value), 3, 1));
    setToDate(new Date(Number(selected.value) + 1, 2, 31));
  };

  const handleClick = async () => {
    try {
      // ── Financial-year modes first: these are the only ones that load the
      // month-wise comparison, and 'currentFY' has no selectedYear to read.
      if (filterType === 'currentFY' || filterType === 'year') {
        if (filterType === 'year' && !selectedYear) {
          Alert.alert('Error!', 'Please select a year.');
          return;
        }

        const start =
          filterType === 'currentFY'
            ? currentFyStart()
            : Number(selectedYear.value);

        const from = new Date(start, 3, 1);
        const to = new Date(start + 1, 2, 31);

        setFromDate(from);
        setToDate(to);
        setMonth(`FY ${start}-${start + 1}`);
        setRefTypeFilter('ALL');

        await Promise.all([
          fetchReferenceTypeCounts(
            location,
            from.toLocaleDateString('en-CA'),
            to.toLocaleDateString('en-CA'),
          ),
          fetchMonthwise(location, start),
        ]);
        hideModal1();
        return;
      }

      // ── Non-FY modes: no month-wise comparison.
      setMonthwise(null);
      setCompError(null);

      if (filterType === 'custom') {
        if (customFromDate > customToDate) {
          Alert.alert('Error!', 'From date cannot be after To date.');
          return;
        }
        setFromDate(customFromDate);
        setToDate(customToDate);
        setMonth(
          `${customFromDate.toLocaleDateString(
            'en-GB',
          )} - ${customToDate.toLocaleDateString('en-GB')}`,
        );
        await fetchReferenceTypeCounts(
          location,
          customFromDate.toLocaleDateString('en-CA'),
          customToDate.toLocaleDateString('en-CA'),
        );
        hideModal1();
        return;
      }

      if (!selectedMonth) {
        Alert.alert('Error!', 'Please select a month.');
        return;
      }
      setMonth(selectedMonth.label);
      await fetchReference();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchReference = async () => {
    try {
      await fetchReferenceTypeCounts(
        location,
        fromDate.toLocaleDateString('en-CA'),
        toDate.toLocaleDateString('en-CA'),
      );
      setSelectedMonth(null);
      setSelectedYear(null);
    } catch (error) {
      console.error('Error fetching reference data:', error);
    } finally {
      hideModal1();
    }
  };

  /* ── Derived comparison data ──────────────────────────── */

  const monthLimit = monthwise ? elapsedMonths(monthwise.fy?.start) : 0;

  const refTypeOptions = useMemo(() => {
    const set = new Set();
    (monthwise?.months || []).forEach(m => {
      Object.keys(m?.current?.byType || {}).forEach(k => set.add(k));
      Object.keys(m?.previous?.byType || {}).forEach(k => set.add(k));
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [monthwise]);

  const labelForRefType = key => {
    if (key === 'ALL') return 'All reference types';
    return (
      monthwise?.referenceTypeMap?.[key] || REFERENCE_TYPE_LABELS[key] || key
    );
  };

  const comparisonRows = useMemo(
    () =>
      buildComparisonRows(
        monthwise?.months,
        comparison,
        refTypeFilter,
        metric,
        monthLimit,
      ),
    [monthwise, comparison, refTypeFilter, metric, monthLimit],
  );

  // FY-to-date totals, always current FY vs previous FY.
  const fyTotals = useMemo(() => {
    const slice = (monthwise?.months || []).slice(0, monthLimit);
    const cur = slice.reduce(
      (s, m) => s + valueOf(m?.current, refTypeFilter, metric),
      0,
    );
    const prev = slice.reduce(
      (s, m) => s + valueOf(m?.previous, refTypeFilter, metric),
      0,
    );
    return { cur, prev, delta: cur - prev, pct: pct(cur, prev) };
  }, [monthwise, monthLimit, refTypeFilter, metric]);

  const hasComparisonData = comparisonRows.some(
    r => r.value > 0 || (r.lastYear || 0) > 0,
  );

  /* ── Pie chart ────────────────────────────────────────── */

  const pieData = data.map((item, index) => ({
    key: index,
    value: item.count,
    svg: { fill: getColor(index) },
    label: item.percentage,
  }));

  function getColor(index) {
    const colors = [
      '#ff6384',
      '#36a2eb',
      '#ffce56',
      '#4bc0c0',
      '#9966ff',
      '#ff9f40',
    ];
    return colors[index % colors.length];
  }

  const Labels = ({ slices }) =>
    slices.map((slice, index) => {
      const { labelCentroid, data: sliceData } = slice;
      if (sliceData.label < 5) return null;
      return (
        <G key={index}>
          <SvgText
            x={labelCentroid[0] * 2.2}
            y={labelCentroid[1] * 2.2}
            fill="black"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={12}
            fontWeight="bold"
          >
            {sliceData.value}
          </SvgText>
          <SvgText
            x={labelCentroid[0] * 1.2}
            y={labelCentroid[1] * 1.2}
            fill="black"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={12}
            fontWeight="bold"
          >
            {`${sliceData.label}%`}
          </SvgText>
        </G>
      );
    });

  const fmtPct = value =>
    value == null ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  /* ── Render ───────────────────────────────────────────── */

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#FFF' }}
      edges={['top', 'bottom']}
    >
      {loading ? (
        <Portal>
          <Dialog
            visible={loading}
            onDismiss={() => setLoading(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 20,
            }}
          >
            <Dialog.Content>
              <Text variant="bodyMedium">Loading..</Text>
            </Dialog.Content>
            <ActivityIndicator
              animating={loading}
              size={'large'}
              color={'#01458e'}
            />
          </Dialog>
        </Portal>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Image
                style={{ height: 35, width: 35, tintColor: '#184D67' }}
                source={require('../../assets/back.png')}
              />
            </TouchableOpacity>
            <Text style={styles.header}>{month}</Text>
            <TouchableOpacity
              onPress={() => {
                setFromDate(new Date());
                setToDate(new Date());
                setVisible1(true);
              }}
            >
              <Image
                style={{ height: 30, width: 30, tintColor: '#184D67' }}
                source={require('../../assets/filter.png')}
              />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {/* ── Reference type breakdown ── */}
            <Card
              style={{ padding: 16, borderRadius: 10, backgroundColor: '#FFF' }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={[styles.tableHeadText, { width: '48%' }]}>
                  📌 Reference Type
                </Text>
                <Text style={[styles.tableHeadText, { width: '22%' }]}>
                  Count 📊
                </Text>
                <Text style={[styles.tableHeadText, { width: '30%' }]}>
                  Conversion 📊
                </Text>
              </View>
              <Divider style={{ marginBottom: 10 }} />

              {data.map((item, index) => (
                <View
                  key={index}
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                  }}
                >
                  <Text style={[styles.tableCellText, { width: '48%' }]}>
                    {index + 1}. {item.reference_type}
                  </Text>
                  <Text style={[styles.tableCellValue, { width: '26%' }]}>
                    {item.count} ({`${item.percentage}%`})
                  </Text>
                  <Text style={[styles.tableCellValue, { width: '26%' }]}>
                    {item.invoiceCount} ({`${item.invoicePercentage}%`})
                  </Text>
                </View>
              ))}

              <Divider style={{ marginBottom: 10 }} />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={[styles.tableTotalText, { width: '48%' }]}>
                  Total
                </Text>
                <Text style={[styles.tableTotalText, { width: '26%' }]}>
                  {totalCount}
                </Text>
                <Text style={[styles.tableTotalText, { width: '26%' }]}>
                  {totalInvoiceCount}
                </Text>
              </View>
            </Card>

            {/* ── Distribution pie ── */}
            <Card
              style={{
                padding: 16,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: '#FFF',
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}
              >
                📊 Reference Type Distribution
              </Text>
              {data.length > 0 ? (
                <View style={{ height: 250, width: 250 }}>
                  <PieChart
                    style={{ height: 250, width: 250 }}
                    data={pieData}
                    innerRadius={0}
                    outerRadius={100}
                  >
                    <Labels />
                  </PieChart>
                </View>
              ) : (
                <Text style={{ textAlign: 'center', marginTop: 20 }}>
                  No data available
                </Text>
              )}
            </Card>

            {/* ── Month-wise comparison (FY modes only) ── */}
            {(compLoading || compError || monthwise) && (
              <Card
                style={{ margin: 10, padding: 12, backgroundColor: '#FFF' }}
              >
                <Text style={styles.compTitle}>
                  Month-wise Comparison
                  {monthwise?.fy?.label ? ` · FY ${monthwise.fy.label}` : ''}
                </Text>

                {compLoading && (
                  <View style={{ paddingVertical: 24 }}>
                    <ActivityIndicator animating size="small" color="#01458e" />
                  </View>
                )}

                {!compLoading && compError && (
                  <Text style={styles.compEmpty}>{compError}</Text>
                )}

                {!compLoading && !compError && monthwise && (
                  <>
                    {/* Comparison basis */}
                    <View style={styles.chipRow}>
                      {['MoM', 'QoQ', 'YoY'].map(m => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setComparison(m)}
                          style={[
                            styles.chip,
                            comparison === m && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={
                              comparison === m
                                ? styles.chipTextActive
                                : styles.chipText
                            }
                          >
                            {m}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Metric */}
                    <View style={styles.chipRow}>
                      {[
                        { key: 'patients', label: 'Patients' },
                        { key: 'invoices', label: 'Conversions' },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => setMetric(opt.key)}
                          style={[
                            styles.chip,
                            metric === opt.key && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={
                              metric === opt.key
                                ? styles.chipTextActive
                                : styles.chipText
                            }
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Reference type drill-down */}
                    {refTypeOptions.length > 1 && (
                      <ModalDropdown
                        style={[styles.dropdown, { marginBottom: 12 }]}
                        textStyle={styles.dropdownText}
                        dropdownStyle={styles.dropdownList}
                        dropdownTextStyle={styles.dropdownItemText}
                        options={refTypeOptions.map(labelForRefType)}
                        onSelect={i => setRefTypeFilter(refTypeOptions[i])}
                        defaultValue={labelForRefType(refTypeFilter)}
                      />
                    )}

                    {!hasComparisonData ? (
                      <Text style={styles.compEmpty}>
                        No records found for this financial year.
                      </Text>
                    ) : (
                      <>
                        <View style={styles.compHeaderRow}>
                          <Text
                            style={[
                              styles.compHeaderCell,
                              { flex: 1.4, textAlign: 'left' },
                            ]}
                          >
                            {comparison === 'QoQ' ? 'Quarter' : 'Month'}
                          </Text>
                          <Text style={styles.compHeaderCell}>Count</Text>
                          <Text style={styles.compHeaderCell}>
                            {comparison === 'YoY' ? 'Last FY' : 'Prev'}
                          </Text>
                          <Text style={styles.compHeaderCell}>Δ</Text>
                          <Text style={styles.compHeaderCell}>Δ %</Text>
                        </View>

                        {comparisonRows.map(r => (
                          <View key={r.label} style={styles.compRow}>
                            <Text style={styles.compCellLabel}>{r.label}</Text>
                            <Text style={styles.compCell}>{r.value}</Text>
                            <Text style={styles.compCell}>
                              {r.base == null ? '—' : r.base}
                            </Text>
                            <Text style={styles.compCell}>
                              {r.delta == null ? '—' : r.delta}
                            </Text>
                            <Text
                              style={[
                                styles.compCell,
                                r.pct != null && {
                                  color: r.pct >= 0 ? '#14923E' : '#DE3B40',
                                },
                              ]}
                            >
                              {fmtPct(r.pct)}
                            </Text>
                          </View>
                        ))}

                        {/* FY-to-date total, always vs the previous FY */}
                        <View style={[styles.compRow, styles.compTotalRow]}>
                          <Text
                            style={[
                              styles.compCellLabel,
                              { fontWeight: '700' },
                            ]}
                          >
                            FY total
                          </Text>
                          <Text
                            style={[styles.compCell, { fontWeight: '700' }]}
                          >
                            {fyTotals.cur}
                          </Text>
                          <Text
                            style={[styles.compCell, { fontWeight: '700' }]}
                          >
                            {fyTotals.prev}
                          </Text>
                          <Text
                            style={[styles.compCell, { fontWeight: '700' }]}
                          >
                            {fyTotals.delta}
                          </Text>
                          <Text
                            style={[
                              styles.compCell,
                              { fontWeight: '700' },
                              fyTotals.pct != null && {
                                color:
                                  fyTotals.pct >= 0 ? '#14923E' : '#DE3B40',
                              },
                            ]}
                          >
                            {fmtPct(fyTotals.pct)}
                          </Text>
                        </View>

                        <Text style={styles.compFootnote}>
                          {comparison === 'YoY'
                            ? `Each month against the same month of FY ${
                                monthwise?.previousFy?.label || ''
                              }.`
                            : comparison === 'QoQ'
                            ? 'Each fiscal quarter against the previous quarter.'
                            : 'Each month against the previous month. April has no prior month within the FY.'}
                        </Text>
                      </>
                    )}
                  </>
                )}
              </Card>
            )}
          </ScrollView>

          {/* ── Filter modal ── */}
          <Portal>
            <Modal
              visible={visible1}
              onDismiss={hideModal1}
              contentContainerStyle={styles.modal}
            >
              <ScrollView>
                <View>
                  <Text style={styles.title}>Select Filter Type</Text>
                </View>

                <RadioButton.Group
                  onValueChange={value => setFilterType(value)}
                  value={filterType}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setFilterType('month');
                      setSelectedMonth(null);
                    }}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="month" />
                    <Text>Month-wise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setFilterType('year');
                      setSelectedYear(null);
                    }}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="year" />
                    <Text>Financial Year-wise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setFilterType('currentFY');
                      setSelectedYear(null);
                    }}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="currentFY" />
                    <Text>Current Financial Year</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setFilterType('custom')}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="custom" />
                    <Text>Custom Date Range</Text>
                  </TouchableOpacity>
                </RadioButton.Group>

                {filterType === 'month' && (
                  <ModalDropdown
                    style={styles.dropdown}
                    textStyle={styles.dropdownText}
                    dropdownStyle={styles.dropdownList}
                    dropdownTextStyle={styles.dropdownItemText}
                    options={monthsList.map(item => item.label)}
                    onSelect={handleMonthChange}
                    defaultValue="Select Month"
                  />
                )}

                {filterType === 'year' && (
                  <ModalDropdown
                    style={styles.dropdown}
                    textStyle={styles.dropdownText}
                    dropdownStyle={styles.dropdownList}
                    dropdownTextStyle={styles.dropdownItemText}
                    options={yearsList.map(item => item.label)}
                    onSelect={handleYearChange}
                    defaultValue="Select Year"
                  />
                )}

                {filterType === 'currentFY' && (
                  <Text style={styles.fyHint}>
                    {`1 Apr ${currentFyStart()} – 31 Mar ${
                      currentFyStart() + 1
                    }`}
                  </Text>
                )}

                {filterType === 'custom' && (
                  <View style={{ marginVertical: 10 }}>
                    <Text style={styles.dateLabel}>From Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFromPicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {customFromDate.toLocaleDateString('en-GB')}
                      </Text>
                      <Icon name="calendar" size={20} color="#007bff" />
                    </TouchableOpacity>

                    <Text style={[styles.dateLabel, { marginTop: 12 }]}>
                      To Date
                    </Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowToPicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {customToDate.toLocaleDateString('en-GB')}
                      </Text>
                      <Icon name="calendar" size={20} color="#007bff" />
                    </TouchableOpacity>

                    <DatePicker
                      modal
                      open={showFromPicker}
                      date={customFromDate}
                      mode="date"
                      maximumDate={new Date()}
                      onConfirm={date => {
                        setShowFromPicker(false);
                        setCustomFromDate(date);
                      }}
                      onCancel={() => setShowFromPicker(false)}
                    />
                    <DatePicker
                      modal
                      open={showToPicker}
                      date={customToDate}
                      mode="date"
                      minimumDate={customFromDate}
                      maximumDate={new Date()}
                      onConfirm={date => {
                        setShowToPicker(false);
                        setCustomToDate(date);
                      }}
                      onCancel={() => setShowToPicker(false)}
                    />
                  </View>
                )}

                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  <View style={styles.buttonContainer}>
                    <Button
                      mode="outlined"
                      onPress={hideModal1}
                      style={styles.button}
                      textColor="#007bff"
                    >
                      Back
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleClick}
                      style={[styles.button, styles.findButton]}
                    >
                      Find
                    </Button>
                  </View>
                </KeyboardAvoidingView>
              </ScrollView>
            </Modal>
          </Portal>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ReferenceData;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 10,
    width: '100%',
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubContainer: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    flexDirection: 'row',
    marginVertical: 5,
  },
  cardTotal: {
    minWidth: 160,
    height: 50,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginVertical: 5,
    borderRadius: 4,
  },
  card: {
    minWidth: '28%',
    height: 80,
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
  },
  modal: {
    backgroundColor: 'white',
    paddingVertical: 50,
    paddingHorizontal: 20,
    marginHorizontal: 10,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  subHeader: { fontFamily: 'Lexend-Regular', fontSize: 14, color: '#000' },
  title: {
    fontFamily: 'Lexend-Bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  label: { fontFamily: 'Lexend-Regular', fontSize: 16, marginBottom: 10 },

  // Reference-type table
  tableHeadText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'left',
  },
  tableCellText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#000',
    textAlign: 'left',
  },
  tableCellValue: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6200ee',
    textAlign: 'left',
  },
  tableTotalText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'left',
  },

  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  dropdownText: { fontSize: 16, fontFamily: 'Lexend-Medium', color: '#000' },
  dropdownList: {
    width: '80%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  dropdownItemText: { fontSize: 16, padding: 10, fontFamily: 'Lexend-Regular' },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
  },
  button: { width: 150 },
  findButton: { backgroundColor: '#007bff' },
  dateLabel: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
  },
  dateButtonText: { fontFamily: 'Lexend-Medium', fontSize: 16, color: '#000' },
  fyHint: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },

  // Month-wise comparison
  compTitle: {
    fontFamily: 'Lexend-Bold',
    fontSize: 16,
    color: '#000',
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', marginBottom: 10 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#eef2f5',
  },
  chipActive: { backgroundColor: '#0d7592' },
  chipText: { color: '#333', fontFamily: 'Lexend-Regular', fontSize: 13 },
  chipTextActive: { color: '#fff', fontFamily: 'Lexend-Medium', fontSize: 13 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e3e8ec',
  },
  compTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#0d7592',
    borderBottomWidth: 0,
    backgroundColor: '#f4f8fa',
  },
  compHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0d7592',
    backgroundColor: '#f4f8fa',
  },
  compCell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
    paddingHorizontal: 4,
    color: '#333',
  },
  compCellLabel: {
    flex: 1.4,
    fontSize: 12,
    textAlign: 'left',
    paddingHorizontal: 4,
    color: '#333',
    fontWeight: '600',
  },
  compHeaderCell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
    paddingHorizontal: 4,
    color: '#0d7592',
    fontWeight: '700',
  },
  compEmpty: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    paddingVertical: 20,
  },
  compFootnote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: '#888',
    marginTop: 10,
  },
});
