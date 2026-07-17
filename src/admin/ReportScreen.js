import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Divider,
  ActivityIndicator,
  SegmentedButtons,
  RadioButton,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import Share from 'react-native-share';

const BACKEND_URL = 'https://wedoc.in/hms';
const TIMEOUT_DURATION = 30000; // 30s — Excel queries over a date range can be slow
const DSR_TIMEOUT = 120000; // 2 min — DSR fans out across many branches + emails
const IPD_DUE_MAX_DAYS = 730; // cap the IPD Due date range span
const IPD_DUE_STATUSES = [
  'All',
  'Cashless',
  'Reimbursement',
  'Charity',
  'NonInsurance',
  'PDC',
];
const PREVIEW_ROW_LIMIT = 100; // cap rows rendered on screen; export still includes all

const PRIMARY = '#01458e';
const GREEN = '#2e7d32';

// ── Date helper (IST calendar day, tz-safe) ───────────────
const getISTDate = date => {
  const now = new Date(date);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};

const displayDate = d =>
  d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

// Inclusive day span between two dates based on their IST calendar dates
// (e.g. 1 Jun → 1 Jun = 1 day; 1 Jun → 31 Jun-window honors the same day).
const inclusiveDaySpan = (from, to) => {
  const a = new Date(`${getISTDate(from)}T00:00:00Z`);
  const b = new Date(`${getISTDate(to)}T00:00:00Z`);
  return Math.floor((b - a) / 86400000) + 1;
};

// ── Friendly column labels for preview + Excel headers ────
const LABELS = {
  invoice_id: 'Invoice ID',
  patient_id: 'Patient ID',
  name: 'Name',
  patient_name: 'Patient Name',
  creation_date: 'Created',
  receipt_date: 'Receipt Date',
  Invoice_Date: 'Invoice Date',
  invoice_date: 'Invoice Date',
  payment_date: 'Payment Date',
  item_date: 'Date',
  discount: 'Discount',
  status: 'Status',
  insurance_company: 'Insurance',
  payable_amt: 'Payable',
  totalamt: 'Total',
  totaldue: 'Due',
  cashamt: 'Cash',
  cardamt: 'Card',
  chequeamt: 'Cheque',
  onlineamt: 'Online',
  discountamt: 'Discount',
  internal_discount: 'Int. Disc.',
  TDS: 'TDS',
  settled_amt: 'Settled',
  utrno: 'UTR No',
  receipt_id: 'Receipt ID',
  consultation: 'Consultation',
  chargeCondition: 'Charge',
  comment: 'Comment',
  paymentmode: 'Mode',
  payment_mode: 'Mode',
  total: 'Total',
};

const labelFor = key =>
  LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Friendly titles for object-shaped responses (e.g. IPD Sheet2)
const SECTION_TITLES = {
  patientPayments: 'Patient Payments',
  insuranceSettlements: 'Insurance Settlements',
};

// Normalize any backend response into a uniform list of sections.
// - Array response  → a single section.
// - Object response → one section per array-valued key (IPD Sheet2 returns
//   { patientPayments, insuranceSettlements }).
const normalizeSections = (data, fallbackTitle) => {
  if (Array.isArray(data)) {
    return [{ key: 'main', title: fallbackTitle, rows: data }];
  }
  if (data && typeof data === 'object') {
    return Object.keys(data)
      .filter(k => Array.isArray(data[k]))
      .map(k => ({
        key: k,
        title: SECTION_TITLES[k] || labelFor(k),
        rows: data[k],
      }));
  }
  return [];
};

// Excel worksheet names: max 31 chars, no : \ / ? * [ ]
const safeSheetName = name =>
  String(name)
    .replace(/[:\\/?*[\]]/g, ' ')
    .slice(0, 31) || 'Sheet';

// Columns whose values should render as ₹ currency
const MONEY_KEYS = new Set([
  'discount',
  'payable_amt',
  'totalamt',
  'totaldue',
  'cashamt',
  'cardamt',
  'chequeamt',
  'onlineamt',
  'discountamt',
  'internal_discount',
  'TDS',
  'settled_amt',
  'total',
]);

const fmtMoney = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const cellText = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  // Only format as currency when the value is actually numeric — guards against
  // text columns (e.g. OPD "consultation") slipping into a money column.
  if (MONEY_KEYS.has(key) && !isNaN(Number(value))) {
    return fmtMoney(value);
  }
  return String(value);
};

const ROW_HEIGHT = 38; // fixed height enables getItemLayout (no measurement cost)

// Memoized single cell — only re-renders if its value/flags change.
const TableCell = React.memo(({ col, value }) => {
  const isMoney =
    MONEY_KEYS.has(col) &&
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !isNaN(Number(value));
  return (
    <View style={styles.tableCell}>
      <Text
        style={[styles.tableCellText, isMoney && styles.tableCellMoney]}
        numberOfLines={1}
      >
        {cellText(col, value)}
      </Text>
    </View>
  );
});

// Memoized row — recycled by FlatList; only mounts when on screen.
const TableRow = React.memo(({ row, columns, alt }) => (
  <View
    style={[styles.tableRow, { height: ROW_HEIGHT }, alt && styles.tableRowAlt]}
  >
    {columns.map(col => (
      <TableCell key={col} col={col} value={row[col]} />
    ))}
  </View>
));

// ── Preview Table (virtualized, horizontal + vertical scroll) ──
const PreviewTable = ({ rows }) => {
  const columns = useMemo(
    () => (rows.length ? Object.keys(rows[0]) : []),
    [rows],
  );
  const visibleRows = useMemo(() => rows.slice(0, PREVIEW_ROW_LIMIT), [rows]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <TableRow row={item} columns={columns} alt={index % 2 === 1} />
    ),
    [columns],
  );

  const getItemLayout = useCallback(
    (_data, index) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  if (!columns.length) return null;

  const tableWidth = columns.length * 120;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width: tableWidth }}>
        {/* Header (stays mounted; cheap) */}
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {columns.map(col => (
            <View key={col} style={styles.tableCell}>
              <Text style={styles.tableHeaderText} numberOfLines={2}>
                {labelFor(col)}
              </Text>
            </View>
          ))}
        </View>

        {/* Body — only on-screen rows are mounted */}
        <FlatList
          data={visibleRows}
          keyExtractor={(_item, index) => String(index)}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={{ maxHeight: ROW_HEIGHT * 12 }}
        />
      </View>
    </ScrollView>
  );
};

// ── Reusable Android dropdown modal ───────────────────────────────
// Shows a scrollable list of options in a centred modal.
// Used for branch picker and IPD status picker on Android.
const DropdownModal = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <TouchableOpacity
      style={dropStyles.overlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={dropStyles.box}>
        <Text style={dropStyles.title}>{title}</Text>
        <Divider />
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 340 }}
        >
          {options.map(opt => {
            const active = opt === selected;
            return (
              <TouchableOpacity
                key={opt}
                style={[dropStyles.item, active && dropStyles.itemActive]}
                onPress={() => {
                  onSelect(opt);
                  onClose();
                }}
              >
                <Text
                  style={[
                    dropStyles.itemText,
                    active && dropStyles.itemTextActive,
                  ]}
                >
                  {opt}
                </Text>
                {active && <Icon name="check" size={18} color={PRIMARY} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </TouchableOpacity>
  </Modal>
);

// ── Reusable multi-select modal ───────────────────────────────────
const MultiSelectModal = ({
  visible,
  title,
  options,
  selected,
  onChange,
  onClose,
}) => {
  const allSelected = options.length > 0 && selected.length === options.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={dropStyles.overlay}>
        <View style={dropStyles.box}>
          <Text style={dropStyles.title}>{title}</Text>

          <TouchableOpacity
            style={msStyles.bulkRow}
            onPress={() => onChange(allSelected ? [] : [...options])}
          >
            <Text style={msStyles.bulkText}>
              {allSelected ? 'Clear all' : 'Select all'}
            </Text>
            <Text style={msStyles.count}>
              {selected.length} of {options.length}
            </Text>
          </TouchableOpacity>

          <Divider />

          <ScrollView bounces={false} style={{ maxHeight: 340 }}>
            {options.map(opt => {
              const active = selected.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[dropStyles.item, active && dropStyles.itemActive]}
                  onPress={() =>
                    onChange(
                      active
                        ? selected.filter(s => s !== opt)
                        : [...selected, opt],
                    )
                  }
                >
                  <Text
                    style={[
                      dropStyles.itemText,
                      active && dropStyles.itemTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                  <Icon
                    name={active ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={active ? PRIMARY : '#bbb'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Divider />

          <TouchableOpacity style={msStyles.doneBtn} onPress={onClose}>
            <Text style={msStyles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const msStyles = StyleSheet.create({
  bulkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  bulkText: { color: PRIMARY, fontSize: 13, fontWeight: '700' },
  count: { color: '#777', fontSize: 12, fontWeight: '600' },
  doneBtn: { paddingVertical: 15, alignItems: 'center' },
  doneText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
});

const branchLabel = (sel, all) => {
  if (!sel.length) return 'Select branches';
  if (sel.length === 1) return sel[0];
  if (sel.length === all.length) return `All ${all.length} branches`;
  return `${sel.length} of ${all.length} branches`;
};

const dropStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  itemActive: { backgroundColor: '#f0f5ff' },
  itemText: { fontSize: 14, color: '#333' },
  itemTextActive: { color: PRIMARY, fontWeight: '700' },
});

const ReportScreen = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const hasBranchPicker = locationArray && locationArray.length > 0;

  // Branches this user is authorized to pull (used for DSR + filter picker)
  const dsrLocations = hasBranchPicker
    ? locationArray
    : location
    ? [location]
    : [];

  // 'report' = report builder | 'dsr' = daily Collection | 'ipddue' = IPD due
  const [mode, setMode] = useState('report');

  // DSR defaults to yesterday (the typical daily report)
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  };
  const [dsrDate, setDsrDate] = useState(() => addDays(new Date(), -1));
  const [showDsrPicker, setShowDsrPicker] = useState(false);
  const [dsrEmailing, setDsrEmailing] = useState(false);
  const [dsrDownloading, setDsrDownloading] = useState(false);
  const [dsrResult, setDsrResult] = useState(null);

  // IPD Due defaults to a 31-day window ending today (the max allowed span)
  const daysAgo = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };
  const [ipdFrom, setIpdFrom] = useState(() =>
    addDays(new Date(), -(IPD_DUE_MAX_DAYS - 1)),
  );
  const [ipdTo, setIpdTo] = useState(() => startOfDay(new Date()));
  const [ipdStatus, setIpdStatus] = useState('All');
  const [showIpdFrom, setShowIpdFrom] = useState(false);
  const [showIpdTo, setShowIpdTo] = useState(false);
  const [ipdEmailing, setIpdEmailing] = useState(false);
  const [ipdDownloading, setIpdDownloading] = useState(false);
  const [ipdResult, setIpdResult] = useState(null);

  const [ipdBranches, setIpdBranches] = useState(dsrLocations);
  const [showIpdBranchPicker, setShowIpdBranchPicker] = useState(false);
  // dsrLocations = branches you're authorized to pull; dsrBranches = the subset picked
  const [dsrBranches, setDsrBranches] = useState(dsrLocations);
  const [showDsrBranchPicker, setShowDsrBranchPicker] = useState(false);

  // Applied (committed) filters
  const [branch, setBranch] = useState(
    hasBranchPicker ? locationArray[0] : location,
  );
  const [visitType, setVisitType] = useState('OPD');
  const [sheetType, setSheetType] = useState('Sheet1');
  const [fromDate, setFromDate] = useState(() => startOfDay(new Date()));
  const [toDate, setToDate] = useState(() => startOfDay(new Date()));

  const today = useMemo(() => startOfDay(new Date()), []);
  const ipdFromMin = useMemo(
    () => addDays(ipdTo, -(IPD_DUE_MAX_DAYS - 1)),
    [ipdTo],
  );
  const ipdToMax = useMemo(() => {
    const cap = addDays(ipdFrom, IPD_DUE_MAX_DAYS - 1);
    return cap < today ? cap : today;
  }, [ipdFrom, today]);

  // Pending filters (inside modal, only commit on Apply)
  const [pBranch, setPBranch] = useState(branch);
  const [pVisitType, setPVisitType] = useState(visitType);
  const [pSheetType, setPSheetType] = useState(sheetType);
  const [pFromDate, setPFromDate] = useState(fromDate);
  const [pToDate, setPToDate] = useState(toDate);

  const [showFilter, setShowFilter] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  // Android-only dropdown modals
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    setDsrBranches(dsrLocations);
    setIpdBranches(dsrLocations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsrLocations.join('|')]);

  const openFilter = () => {
    setPBranch(branch);
    setPVisitType(visitType);
    setPSheetType(sheetType);
    setPFromDate(fromDate);
    setPToDate(toDate);
    setShowFilter(true);
  };

  // Cross-platform select: ActionSheetIOS on iOS, inline chips on Android.
  // Call with the options array and a callback that receives the chosen value.
  const showActionSheet = useCallback((title, options, onSelect) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
        },
        index => {
          if (index < options.length) onSelect(options[index]);
        },
      );
    }
    // Android: the inline chip grid handles selection directly — nothing needed here.
  }, []);

  const applyFilter = () => {
    setBranch(pBranch);
    setVisitType(pVisitType);
    setSheetType(pSheetType);
    setFromDate(pFromDate);
    setToDate(pToDate);
    setShowFilter(false);
    // Re-run with the freshly applied filters
    fetchReport({
      branch: pBranch,
      visitType: pVisitType,
      sheetType: pSheetType,
      fromDate: pFromDate,
      toDate: pToDate,
    });
  };

  const fetchReport = async (override = null, isRefresh = false) => {
    const cfg = override || { branch, visitType, sheetType, fromDate, toDate };

    if (getISTDate(cfg.fromDate) > getISTDate(cfg.toDate)) {
      Alert.alert('Invalid Range', '"From" date cannot be after "To" date.');
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

    try {
      const from = getISTDate(cfg.fromDate);
      // Include the entire "to" day — backend uses BETWEEN on datetime columns,
      // so a bare date would stop at 00:00:00 and drop that day's records.
      const to = `${getISTDate(cfg.toDate)} 23:59:59`;

      const url =
        `${BACKEND_URL}/report` +
        `?location=${encodeURIComponent(cfg.branch)}` +
        `&from=${encodeURIComponent(from)}` +
        `&to=${encodeURIComponent(to)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: cfg.visitType,
          sheetType: cfg.sheetType,
        }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || 'Failed to fetch report',
        );
      }

      setSections(normalizeSections(data, `${cfg.visitType} ${cfg.sheetType}`));
      setHasFetched(true);
    } catch (err) {
      const msg =
        err.name === 'AbortError'
          ? 'Request timed out. Try a narrower date range.'
          : err.message;
      setError(msg);
      setSections([]);
      setHasFetched(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const downloadExcel = async () => {
    const populated = sections.filter(s => s.rows.length > 0);
    if (!populated.length) return;
    try {
      setDownloading(true);

      const wb = XLSX.utils.book_new();
      populated.forEach(section => {
        // Map raw keys → friendly headers for the spreadsheet
        const friendly = section.rows.map(row => {
          const out = {};
          Object.keys(row).forEach(k => {
            out[labelFor(k)] = row[k];
          });
          return out;
        });
        const ws = XLSX.utils.json_to_sheet(friendly);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName(section.title));
      });

      const fileName = `${branch}_${visitType}_${sheetType}_${getISTDate(
        fromDate,
      )}_${getISTDate(toDate)}.xlsx`.replace(/\s+/g, '_');

      // Cache dir is always writable and needs no runtime permission.
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      await RNFS.writeFile(filePath, base64, 'base64');

      await Share.open({
        title: 'Export Report',
        filename: fileName,
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        failOnCancel: false,
      });
    } catch (err) {
      // react-native-share throws on user-cancel; ignore that, surface real errors
      if (!/cancel/i.test(err?.message || '')) {
        Alert.alert('Export Failed', err?.message || String(err));
      }
    } finally {
      setDownloading(false);
    }
  };

  // Server generates the workbook and emails it to the hardcoded recipient.
  const emailDSR = async () => {
    if (!dsrBranches.length) {
      Alert.alert('No Branches', 'Select at least one branch.');
      return;
    }
    setDsrEmailing(true);
    setDsrResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DSR_TIMEOUT);

    try {
      const date = getISTDate(dsrDate);
      const response = await fetch(`${BACKEND_URL}/report/dsr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, locations: dsrBranches }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || 'Failed to generate report',
        );
      }
      setDsrResult({ ok: true, kind: 'email', ...data });
    } catch (err) {
      const msg =
        err.name === 'AbortError'
          ? 'Request timed out. The report may still be processing on the server.'
          : err.message;
      setDsrResult({ ok: false, error: msg });
    } finally {
      clearTimeout(timer);
      setDsrEmailing(false);
    }
  };

  // Server returns the rows; the app builds the Excel and saves/shares it.
  const downloadDSR = async () => {
    if (!dsrBranches.length) {
      Alert.alert('No Branches', 'Select at least one branch.');
      return;
    }
    setDsrDownloading(true);
    setDsrResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DSR_TIMEOUT);

    try {
      const date = getISTDate(dsrDate);
      const response = await fetch(`${BACKEND_URL}/report/dsr/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, locations: dsrBranches }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || 'Failed to fetch report',
        );
      }

      const rows = data?.rows || [];
      if (!rows.length) {
        throw new Error('No collection data for the selected date.');
      }

      // Rows already carry friendly headers from the backend — write as-is.
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Collections');

      const fileName = `DSR_${date}.xlsx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      await RNFS.writeFile(filePath, base64, 'base64');

      await Share.open({
        title: 'Daily Collection Report',
        filename: fileName,
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        failOnCancel: false,
      });

      setDsrResult({
        ok: true,
        kind: 'download',
        date: data.date,
        branchesProcessed: data.branchesProcessed,
        branchesRequested: data.branchesRequested,
        failed: data.failed,
      });
    } catch (err) {
      if (/cancel/i.test(err?.message || '')) {
        // user dismissed the share sheet after the file was built — not an error
        setDsrResult(null);
      } else {
        const msg =
          err.name === 'AbortError'
            ? 'Request timed out. Try again or use a single branch.'
            : err.message;
        setDsrResult({ ok: false, error: msg });
      }
    } finally {
      clearTimeout(timer);
      setDsrDownloading(false);
    }
  };

  // ── IPD Due ──
  const runIPDDue = async kind => {
    if (!ipdBranches.length) {
      Alert.alert('No Branches', 'Select at least one branch.');
      return;
    }
    if (getISTDate(ipdFrom) > getISTDate(ipdTo)) {
      Alert.alert('Invalid Range', '"From" date cannot be after "To" date.');
      return;
    }
    if (inclusiveDaySpan(ipdFrom, ipdTo) > IPD_DUE_MAX_DAYS) {
      Alert.alert(
        'Range Too Large',
        `Please select a range of ${IPD_DUE_MAX_DAYS} days or less.`,
      );
      return;
    }

    const isEmail = kind === 'email';
    (isEmail ? setIpdEmailing : setIpdDownloading)(true);
    setIpdResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DSR_TIMEOUT);

    try {
      const from = getISTDate(ipdFrom);
      const to = `${getISTDate(ipdTo)} 23:59:59`; // include the full "to" day
      const endpoint = isEmail
        ? `${BACKEND_URL}/report/ipd-due`
        : `${BACKEND_URL}/report/ipd-due/data`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          locations: ipdBranches,
          status: ipdStatus,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || 'Failed to generate report',
        );
      }

      if (isEmail) {
        setIpdResult({ ok: true, kind: 'email', ...data });
      } else {
        const detail = data?.detail || [];
        const summary = data?.summary || [];
        if (!detail.length) {
          throw new Error('No outstanding due records for the selected range.');
        }

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(detail);
        XLSX.utils.book_append_sheet(wb, ws1, 'IPD Due Report');
        const ws2 = XLSX.utils.json_to_sheet(summary, {
          header: data?.summaryHeader,
        });
        XLSX.utils.book_append_sheet(wb, ws2, 'Location Summary');

        const fileName = `IPD_Due_${ipdStatus}_${getISTDate(
          ipdFrom,
        )}_to_${getISTDate(ipdTo)}.xlsx`;
        const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        await RNFS.writeFile(filePath, base64, 'base64');

        await Share.open({
          title: 'IPD Due Report',
          filename: fileName,
          url: `file://${filePath}`,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          failOnCancel: false,
        });

        setIpdResult({
          ok: true,
          kind: 'download',
          from: data.from,
          to: data.to,
          branchesProcessed: data.branchesProcessed,
          branchesRequested: data.branchesRequested,
          invoices: detail.length,
          failed: data.failed,
        });
      }
    } catch (err) {
      if (/cancel/i.test(err?.message || '')) {
        setIpdResult(null); // share sheet dismissed after file built — not an error
      } else {
        const msg =
          err.name === 'AbortError'
            ? 'Request timed out. Try a narrower range or fewer branches.'
            : err.message;
        setIpdResult({ ok: false, error: msg });
      }
    } finally {
      clearTimeout(timer);
      (isEmail ? setIpdEmailing : setIpdDownloading)(false);
    }
  };

  const rowCount = sections.reduce((sum, s) => sum + s.rows.length, 0);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#f4f6f9' }}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>
            {mode === 'report'
              ? 'Reports'
              : mode === 'dsr'
              ? 'Daily Collection Report'
              : 'IPD Due Report'}
          </Text>
          <Text style={styles.headerSubDate} numberOfLines={1}>
            {mode === 'report'
              ? `${branch} · ${visitType} · ${sheetType}`
              : branchLabel(
                  mode === 'dsr' ? dsrBranches : ipdBranches,
                  dsrLocations,
                )}
          </Text>
        </View>
        {mode === 'report' && (
          <TouchableOpacity onPress={openFilter} style={styles.filterIconBtn}>
            <Icon name="filter-variant" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggleWrap}>
        <SegmentedButtons
          value={mode}
          onValueChange={setMode}
          buttons={[
            { value: 'report', label: 'Reports' },
            { value: 'dsr', label: 'DCR' },
            { value: 'ipddue', label: 'IPD Due' },
          ]}
        />
      </View>

      {/* Active filter chips (report mode only) */}
      {mode === 'report' && (
        <View style={styles.chipRow}>
          <Chip
            icon="hospital-building"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            {branch}
          </Chip>
          <Chip
            icon="calendar-range"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            {displayDate(fromDate)} → {displayDate(toDate)}
          </Chip>
        </View>
      )}

      {/* ── Daily Collection Report mode ── */}
      {mode === 'dsr' && (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeaderRow}>
                <Icon name="cash-multiple" size={22} color={PRIMARY} />
                <Text style={styles.dsrTitle}>Daily Collection Report</Text>
              </View>
              <Text style={styles.dsrDesc}>
                Generates the branch-wise collection summary (OPD, IPD,
                Pharmacy) for the selected date and emails the Excel to the
                reports inbox. Covers {dsrBranches.length} of{' '}
                {dsrLocations.length} branch
                {dsrLocations.length === 1 ? '' : 'es'} you have access to.
              </Text>

              <Text style={[styles.modalLabel, { marginTop: 18 }]}>
                Report Date
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowDsrPicker(true)}
              >
                <Icon name="calendar" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText}>{displayDate(dsrDate)}</Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                Branches
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowDsrBranchPicker(true)}
              >
                <Icon name="hospital-building" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText} numberOfLines={1}>
                  {branchLabel(dsrBranches, dsrLocations)}
                </Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <View style={styles.dsrBranchChipRow}>
                <Chip
                  icon="map-marker-multiple"
                  style={styles.chip}
                  textStyle={styles.chipText}
                >
                  {dsrLocations.length} branch
                  {dsrLocations.length === 1 ? '' : 'es'}
                </Chip>
              </View>

              <TouchableOpacity
                style={[
                  styles.dsrGenerateBtn,
                  (dsrEmailing || dsrDownloading || !dsrBranches.length) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={emailDSR}
                disabled={dsrEmailing || dsrDownloading || !dsrBranches.length}
              >
                {dsrEmailing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="email-fast" size={20} color="#fff" />
                )}
                <Text style={styles.dsrGenerateText}>
                  {dsrEmailing
                    ? 'Generating & Emailing…'
                    : 'Generate Report & Send Email'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dsrDownloadBtn,
                  (dsrEmailing || dsrDownloading || !dsrBranches.length) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={downloadDSR}
                disabled={dsrEmailing || dsrDownloading || !dsrBranches.length}
              >
                {dsrDownloading ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Icon name="microsoft-excel" size={20} color={PRIMARY} />
                )}
                <Text style={styles.dsrDownloadText}>
                  {dsrDownloading ? 'Preparing…' : 'Download Excel'}
                </Text>
              </TouchableOpacity>

              {(dsrEmailing || dsrDownloading) && (
                <Text style={styles.mutedNote}>
                  This can take up to a minute for many branches — please wait.
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* DSR result */}
          {dsrResult?.ok && (
            <Card style={[styles.card, styles.dsrSuccessCard]}>
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <Icon name="check-circle" size={20} color={GREEN} />
                  <Text style={styles.dsrSuccessTitle}>
                    {dsrResult.kind === 'email'
                      ? 'Report emailed'
                      : 'Report downloaded'}
                  </Text>
                </View>
                <Text style={styles.dsrResultText}>
                  {dsrResult.kind === 'email'
                    ? `DSR for ${dsrResult.date} sent to ${dsrResult.sentTo}.`
                    : `DSR for ${dsrResult.date} saved to your device.`}
                </Text>
                <Text style={styles.dsrResultText}>
                  {dsrResult.branchesProcessed} of {dsrResult.branchesRequested}{' '}
                  branches included.
                </Text>
                {dsrResult.failed?.length > 0 && (
                  <Text style={[styles.dsrResultText, { color: '#b26a00' }]}>
                    Skipped: {dsrResult.failed.map(f => f.location).join(', ')}
                  </Text>
                )}
              </Card.Content>
            </Card>
          )}

          {dsrResult && !dsrResult.ok && (
            <Card style={[styles.card, styles.errorCard]}>
              <Card.Content>
                <Text style={styles.errorTitle}>Couldn’t generate report</Text>
                <Text style={styles.errorText}>{dsrResult.error}</Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}

      {/* ── IPD Due mode ── */}
      {mode === 'ipddue' && (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeaderRow}>
                <Icon name="cash-clock" size={22} color={PRIMARY} />
                <Text style={styles.dsrTitle}>IPD Due Report</Text>
              </View>
              <Text style={styles.dsrDesc}>
                Branch-wise list of IPD invoices with an outstanding balance
                (due {'>'} 0) created in the selected range, with an aging
                summary. Covers the {dsrLocations.length} branch
                {dsrLocations.length === 1 ? '' : 'es'} you have access to.
                Maximum range: {IPD_DUE_MAX_DAYS} days.
              </Text>

              <Text style={[styles.modalLabel, { marginTop: 18 }]}>
                From Date
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowIpdFrom(true)}
              >
                <Icon name="calendar-start" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText}>{displayDate(ipdFrom)}</Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                To Date
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowIpdTo(true)}
              >
                <Icon name="calendar-end" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText}>{displayDate(ipdTo)}</Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                Branches
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowIpdBranchPicker(true)}
              >
                <Icon name="hospital-building" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText} numberOfLines={1}>
                  {branchLabel(ipdBranches, dsrLocations)}
                </Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              {/* Status selector */}
              <Text style={[styles.modalLabel, { marginTop: 16 }]}>Status</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.modalDateBtn}
                  onPress={() =>
                    showActionSheet('Filter by Status', IPD_DUE_STATUSES, v => {
                      setIpdStatus(v);
                      setIpdResult(null);
                    })
                  }
                >
                  <Icon name="tag-outline" size={18} color={PRIMARY} />
                  <Text style={styles.modalDateText}>{ipdStatus}</Text>
                  <Icon
                    name="chevron-down"
                    size={18}
                    color="#999"
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.modalDateBtn}
                  onPress={() => setShowStatusDropdown(true)}
                >
                  <Icon name="tag-outline" size={18} color={PRIMARY} />
                  <Text style={styles.modalDateText}>{ipdStatus}</Text>
                  <Icon
                    name="chevron-down"
                    size={18}
                    color="#999"
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>
              )}

              {/* Summary chips */}
              <View style={styles.dsrBranchChipRow}>
                <Chip
                  icon="map-marker-multiple"
                  style={styles.chip}
                  textStyle={styles.chipText}
                >
                  {ipdBranches.length} branch
                  {ipdBranches.length === 1 ? '' : 'es'}
                </Chip>
                <Chip
                  icon="tag-outline"
                  style={[styles.chip, { marginLeft: 8 }]}
                  textStyle={styles.chipText}
                >
                  {ipdStatus}
                </Chip>
              </View>

              <TouchableOpacity
                style={[
                  styles.dsrGenerateBtn,
                  (ipdEmailing || ipdDownloading || !ipdBranches.length) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={() => runIPDDue('email')}
                disabled={ipdEmailing || ipdDownloading || !ipdBranches.length}
              >
                {ipdEmailing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="email-fast" size={20} color="#fff" />
                )}
                <Text style={styles.dsrGenerateText}>
                  {ipdEmailing
                    ? 'Generating & Emailing…'
                    : 'Generate Report & Send Email'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dsrDownloadBtn,
                  (ipdEmailing || ipdDownloading || !ipdBranches.length) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={() => runIPDDue('download')}
                disabled={ipdEmailing || ipdDownloading || !ipdBranches.length}
              >
                {ipdDownloading ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Icon name="microsoft-excel" size={20} color={PRIMARY} />
                )}
                <Text style={styles.dsrDownloadText}>
                  {ipdDownloading ? 'Preparing…' : 'Download Excel'}
                </Text>
              </TouchableOpacity>

              {(ipdEmailing || ipdDownloading) && (
                <Text style={styles.mutedNote}>
                  This can take up to a minute for many branches — please wait.
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* IPD Due result */}
          {ipdResult?.ok && (
            <Card style={[styles.card, styles.dsrSuccessCard]}>
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <Icon name="check-circle" size={20} color={GREEN} />
                  <Text style={styles.dsrSuccessTitle}>
                    {ipdResult.kind === 'email'
                      ? 'Report emailed'
                      : 'Report downloaded'}
                  </Text>
                </View>
                <Text style={styles.dsrResultText}>
                  {ipdResult.kind === 'email'
                    ? `IPD due report (${ipdResult.from} → ${ipdResult.to}) sent to ${ipdResult.sentTo}.`
                    : `IPD due report (${ipdResult.from} → ${ipdResult.to}) saved to your device.`}
                </Text>
                <Text style={styles.dsrResultText}>
                  {ipdResult.invoices} invoice
                  {ipdResult.invoices === 1 ? '' : 's'} across{' '}
                  {ipdResult.branchesProcessed} of {ipdResult.branchesRequested}{' '}
                  branches.
                </Text>
                {ipdResult.failed?.length > 0 && (
                  <Text style={[styles.dsrResultText, { color: '#b26a00' }]}>
                    Skipped: {ipdResult.failed.map(f => f.location).join(', ')}
                  </Text>
                )}
              </Card.Content>
            </Card>
          )}

          {ipdResult && !ipdResult.ok && (
            <Card style={[styles.card, styles.errorCard]}>
              <Card.Content>
                <Text style={styles.errorTitle}>Couldn’t generate report</Text>
                <Text style={styles.errorText}>{ipdResult.error}</Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}

      {/* Body (report mode) */}
      {mode === 'report' &&
        (loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.mutedNote}>Generating report…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
            refreshControl={
              hasFetched ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchReport(null, true)}
                />
              ) : undefined
            }
          >
            {!hasFetched && !error && (
              <Card style={styles.card}>
                <Card.Content style={styles.emptyState}>
                  <Icon name="file-chart-outline" size={48} color={PRIMARY} />
                  <Text style={styles.emptyTitle}>No report yet</Text>
                  <Text style={styles.emptySub}>
                    Set your branch, visit type, sheet and date range, then
                    generate a preview.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => fetchReport()}
                  >
                    <Icon name="play" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Generate Report</Text>
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            )}

            {error && (
              <Card style={[styles.card, styles.errorCard]}>
                <Card.Content>
                  <Text style={styles.errorTitle}>Couldn’t load report</Text>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 14 }]}
                    onPress={() => fetchReport()}
                  >
                    <Icon name="refresh" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            )}

            {hasFetched && !error && rowCount === 0 && (
              <Card style={styles.card}>
                <Card.Content style={styles.emptyState}>
                  <Icon name="database-off-outline" size={44} color="#999" />
                  <Text style={styles.emptyTitle}>No data found</Text>
                  <Text style={styles.emptySub}>
                    No {visitType} {sheetType} records for {branch} in this date
                    range.
                  </Text>
                </Card.Content>
              </Card>
            )}

            {hasFetched &&
              !error &&
              rowCount > 0 &&
              sections.map(section => (
                <Card key={section.key} style={styles.card}>
                  <Card.Content>
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewTitle}>{section.title}</Text>
                      <Chip
                        style={styles.countChip}
                        textStyle={styles.countChipText}
                      >
                        {section.rows.length} row
                        {section.rows.length === 1 ? '' : 's'}
                      </Chip>
                    </View>
                    <Divider style={{ marginVertical: 8 }} />
                    {section.rows.length > 0 ? (
                      <>
                        <PreviewTable rows={section.rows} />
                        {section.rows.length > PREVIEW_ROW_LIMIT && (
                          <Text style={styles.mutedNote}>
                            Showing first {PREVIEW_ROW_LIMIT} of{' '}
                            {section.rows.length} rows. Download to view all.
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.mutedNote}>
                        No records in this section for the selected range.
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              ))}
          </ScrollView>
        ))}

      {/* Sticky download bar (report mode, only when data is present) */}
      {mode === 'report' &&
        hasFetched &&
        !error &&
        rowCount > 0 &&
        !loading && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.downloadBtn, downloading && { opacity: 0.7 }]}
              onPress={downloadExcel}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="microsoft-excel" size={20} color="#fff" />
              )}
              <Text style={styles.downloadText}>
                {downloading ? 'Preparing…' : 'Download Excel'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Filter Modal (bottom sheet) */}
      <Modal
        visible={showFilter}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report Filters</Text>
                <TouchableOpacity onPress={() => setShowFilter(false)}>
                  <Icon name="close" size={22} color="#333" />
                </TouchableOpacity>
              </View>
              <Divider style={{ marginBottom: 16 }} />

              {/* Branch */}
              <Text style={styles.modalLabel}>Branch</Text>
              {hasBranchPicker ? (
                Platform.OS === 'ios' ? (
                  /* iOS — tapping opens a native action sheet */
                  <TouchableOpacity
                    style={styles.modalDateBtn}
                    onPress={() =>
                      showActionSheet(
                        'Select Branch',
                        locationArray,
                        setPBranch,
                      )
                    }
                  >
                    <Icon name="hospital-building" size={18} color={PRIMARY} />
                    <Text style={styles.modalDateText}>{pBranch}</Text>
                    <Icon
                      name="chevron-down"
                      size={18}
                      color="#999"
                      style={{ marginLeft: 'auto' }}
                    />
                  </TouchableOpacity>
                ) : (
                  /* Android — dropdown */
                  <TouchableOpacity
                    style={styles.modalDateBtn}
                    onPress={() => setShowBranchDropdown(true)}
                  >
                    <Icon name="hospital-building" size={18} color={PRIMARY} />
                    <Text style={styles.modalDateText}>{pBranch}</Text>
                    <Icon
                      name="chevron-down"
                      size={18}
                      color="#999"
                      style={{ marginLeft: 'auto' }}
                    />
                  </TouchableOpacity>
                )
              ) : (
                <Text style={styles.staticBranch}>{pBranch}</Text>
              )}

              {/* Visit Type */}
              <Text style={[styles.modalLabel, { marginTop: 18 }]}>
                Visit Type
              </Text>
              <SegmentedButtons
                value={pVisitType}
                onValueChange={setPVisitType}
                buttons={[
                  { value: 'OPD', label: 'OPD' },
                  { value: 'IPD', label: 'IPD' },
                ]}
              />

              {/* Sheet Type */}
              <Text style={[styles.modalLabel, { marginTop: 18 }]}>
                Sheet Type
              </Text>
              <RadioButton.Group
                onValueChange={setPSheetType}
                value={pSheetType}
              >
                <View style={styles.radioRow}>
                  <TouchableOpacity
                    style={styles.radioItem}
                    onPress={() => setPSheetType('Sheet1')}
                  >
                    <RadioButton value="Sheet1" color={PRIMARY} />
                    <Text style={styles.radioLabel}>Sheet 1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioItem}
                    onPress={() => setPSheetType('Sheet2')}
                  >
                    <RadioButton value="Sheet2" color={PRIMARY} />
                    <Text style={styles.radioLabel}>Sheet 2</Text>
                  </TouchableOpacity>
                </View>
              </RadioButton.Group>

              {/* Dates */}
              <Text style={[styles.modalLabel, { marginTop: 18 }]}>
                From Date
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowFromPicker(true)}
              >
                <Icon name="calendar-start" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText}>
                  {displayDate(pFromDate)}
                </Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                To Date
              </Text>
              <TouchableOpacity
                style={styles.modalDateBtn}
                onPress={() => setShowToPicker(true)}
              >
                <Icon name="calendar-end" size={18} color={PRIMARY} />
                <Text style={styles.modalDateText}>{displayDate(pToDate)}</Text>
                <Icon
                  name="chevron-down"
                  size={18}
                  color="#999"
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <Divider style={{ marginTop: 24, marginBottom: 16 }} />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowFilter(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalApplyBtn}
                  onPress={applyFilter}
                >
                  <Icon
                    name="check"
                    size={16}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.modalApplyText}>Apply & Generate</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Native date pickers */}
      <DatePicker
        modal
        open={showFromPicker}
        date={pFromDate}
        mode="date"
        maximumDate={today}
        onConfirm={d => {
          setShowFromPicker(false);
          const next = startOfDay(d);
          setPFromDate(next);
          if (pToDate < next) setPToDate(next);
        }}
        onCancel={() => setShowFromPicker(false)}
      />

      <DatePicker
        modal
        open={showToPicker}
        date={pToDate}
        mode="date"
        maximumDate={today}
        onConfirm={d => {
          setShowToPicker(false);
          const next = startOfDay(d);
          setPToDate(next);
          if (next < pFromDate) setPFromDate(next);
        }}
        onCancel={() => setShowToPicker(false)}
      />

      {/* DSR date picker */}
      <DatePicker
        modal
        open={showDsrPicker}
        date={dsrDate}
        mode="date"
        maximumDate={today}
        onConfirm={date => {
          setShowDsrPicker(false);
          setDsrDate(startOfDay(date));
          setDsrResult(null);
        }}
        onCancel={() => setShowDsrPicker(false)}
      />

      {/* IPD Due date pickers — bounded so the span can't exceed the cap */}
      <DatePicker
        modal
        open={showIpdFrom}
        date={ipdFrom}
        mode="date"
        minimumDate={ipdFromMin}
        maximumDate={ipdTo}
        onConfirm={date => {
          setShowIpdFrom(false);
          setIpdFrom(startOfDay(date));
          setIpdResult(null);
        }}
        onCancel={() => setShowIpdFrom(false)}
      />
      <DatePicker
        modal
        open={showIpdTo}
        date={ipdTo}
        mode="date"
        minimumDate={ipdFrom}
        maximumDate={ipdToMax}
        onConfirm={date => {
          setShowIpdTo(false);
          setIpdTo(startOfDay(date));
          setIpdResult(null);
        }}
        onCancel={() => setShowIpdTo(false)}
      />
      {/* Android dropdown modals */}
      {Platform.OS === 'android' && (
        <>
          <DropdownModal
            visible={showBranchDropdown}
            title="Select Branch"
            options={locationArray}
            selected={pBranch}
            onSelect={setPBranch}
            onClose={() => setShowBranchDropdown(false)}
          />
          <DropdownModal
            visible={showStatusDropdown}
            title="Filter by Status"
            options={IPD_DUE_STATUSES}
            selected={ipdStatus}
            onSelect={v => {
              setIpdStatus(v);
              setIpdResult(null);
            }}
            onClose={() => setShowStatusDropdown(false)}
          />
        </>
      )}

      <MultiSelectModal
        visible={showIpdBranchPicker}
        title="Select Branches"
        options={dsrLocations}
        selected={ipdBranches}
        onChange={sel => {
          setIpdBranches(sel);
          setIpdResult(null);
        }}
        onClose={() => setShowIpdBranchPicker(false)}
      />

      <MultiSelectModal
        visible={showDsrBranchPicker}
        title="Select Branches"
        options={dsrLocations}
        selected={dsrBranches}
        onChange={sel => {
          setDsrBranches(sel);
          setDsrResult(null);
        }}
        onClose={() => setShowDsrBranchPicker(false)}
      />
    </SafeAreaView>
  );
};

export default ReportScreen;

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mutedNote: {
    marginTop: 12,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },

  // Header
  headerContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  headerSubDate: { color: '#a8c4e0', fontSize: 11, marginTop: 1 },
  filterIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },

  // Filter chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  chip: { backgroundColor: '#e8f0fe' },
  chipText: { fontSize: 11, color: PRIMARY },

  // Mode toggle
  modeToggleWrap: { paddingHorizontal: 12, paddingTop: 12 },

  // DSR
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dsrTitle: { fontSize: 16, fontWeight: 'bold', color: PRIMARY },
  dsrDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginTop: 10,
  },
  dsrBranchChipRow: { flexDirection: 'row', marginTop: 14 },
  dsrGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
    gap: 8,
  },
  dsrGenerateText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dsrDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
    gap: 8,
  },
  dsrDownloadText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  dsrSuccessCard: { borderLeftColor: GREEN, borderLeftWidth: 4 },
  dsrSuccessTitle: { fontSize: 15, fontWeight: 'bold', color: GREEN },
  dsrResultText: { fontSize: 13, color: '#555', marginTop: 4 },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },

  // Empty / error states
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  errorCard: { borderLeftColor: '#e53935', borderLeftWidth: 4 },
  errorTitle: { fontWeight: 'bold', color: '#e53935', fontSize: 15 },
  errorText: { color: '#777', fontSize: 13, marginTop: 4 },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 18,
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Preview
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: { fontSize: 15, fontWeight: 'bold', color: PRIMARY },
  countChip: { backgroundColor: '#e8f0fe' },
  countChipText: { fontSize: 11, color: PRIMARY },

  // Table
  tableRow: { flexDirection: 'row' },
  tableHeaderRow: { height: 44, backgroundColor: PRIMARY, borderRadius: 6 },
  tableRowAlt: { backgroundColor: '#f0f4ff' },
  tableCell: {
    width: 120,
    height: '100%',
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e8f0',
  },
  tableHeaderText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tableCellText: { fontSize: 12, color: '#333' },
  tableCellMoney: {
    textAlign: 'right',
    fontWeight: '600',
    color: GREEN,
  },

  // Sticky download bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e8f0',
    elevation: 8,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  downloadText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  modalLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginBottom: 8,
  },
  staticBranch: { fontSize: 15, color: '#222', fontWeight: '500' },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: 24 },
  radioLabel: { fontSize: 14, color: '#222' },
  modalDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dde3f0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#f8f9ff',
    gap: 8,
  },
  modalDateText: { fontSize: 15, color: '#222', fontWeight: '500' },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  modalCancelText: { color: '#555', fontWeight: '600', fontSize: 14 },
  modalApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
