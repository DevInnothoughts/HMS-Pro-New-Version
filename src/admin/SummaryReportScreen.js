import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  Text,
  Card,
  Divider,
  ActivityIndicator,
  Chip,
  Surface,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import XLSX from 'xlsx-js-style';

const BACKEND_URL = 'https://wedoc.in/hms';

const fmt = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Quick-range presets (same values/logic as AdminHome)
const PRESETS = [
  { label: 'Today', value: 'Today' },
  { label: 'Yesterday', value: 'Yesterday' },
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'This Month', value: 'month' },
  { label: 'This F.Y.', value: 'FY' },
  { label: 'Custom', value: 'Custom' },
];

// ── Styled Excel builder (uses xlsx-js-style) ──────────────
const MONEY_FMT = '"₹"#,##0';
const THIN = { style: 'thin', color: { rgb: 'D9D9D9' } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const ST_TITLE = {
  font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '01458E' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_GROUP = {
  font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '01458E' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_SUB = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2E6FB8' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_BRANCH = {
  font: { bold: true, sz: 10, color: { rgb: '222222' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER,
};
const ST_MONEY = {
  numFmt: MONEY_FMT,
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
};
const ST_TOTAL_ROW = {
  font: { bold: true, color: { rgb: '1B5E20' } },
  fill: { fgColor: { rgb: 'EAF1FB' } },
  numFmt: MONEY_FMT,
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
};
const ST_TOTAL_ROW_LABEL = {
  font: { bold: true, color: { rgb: '1B5E20' } },
  fill: { fgColor: { rgb: 'EAF1FB' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER,
};

const num = v => Math.round(Number(v) || 0);

const buildSummaryWorkbook = (data, fromStr, toStr) => {
  const s = data.summary || {};
  const tableBranches = (data.branches || []).filter(b => !b.error);
  const errorBranches = (data.branches || []).filter(b => b.error);

  // IPD Invoice status columns = union across summary + all branches
  const statusSet = new Set();
  if (s.ipdInvoice?.byStatus) {
    Object.keys(s.ipdInvoice.byStatus).forEach(k => statusSet.add(k));
  }
  tableBranches.forEach(b => {
    if (b.ipdInvoice?.byStatus) {
      Object.keys(b.ipdInvoice.byStatus).forEach(k => statusSet.add(k));
    }
  });
  const statuses = [...statusSet];

  // Column layout
  let c = 0;
  const BRANCH = c++;
  const OPD_START = c;
  c += 4; // Cash, Card, Online, Total
  const IPC_START = c;
  c += 5; // Cash, Card, Cheque, Online, Total
  const INV_START = c;
  c += statuses.length + 1; // statuses..., Total
  const PH_START = c;
  c += 4; // Cash, Card, Online, Total
  const GT = c++;
  const NCOLS = c;

  const blankRow = () => new Array(NCOLS).fill('');

  // Row 0: title | Row 1: group headers | Row 2: sub-headers
  const title = blankRow();
  title[0] = `Billing Summary  ·  ${fromStr} to ${toStr}`;

  const grp = blankRow();
  grp[BRANCH] = 'Branch';
  grp[OPD_START] = 'OPD';
  grp[IPC_START] = 'IPD Collection';
  grp[INV_START] = 'IPD Invoice';
  grp[PH_START] = 'Pharmacy';
  grp[GT] = 'Grand Total';

  const sub = blankRow();
  ['Cash', 'Card', 'Online', 'Total'].forEach(
    (h, i) => (sub[OPD_START + i] = h),
  );
  ['Cash', 'Card', 'Cheque', 'Online', 'Total'].forEach(
    (h, i) => (sub[IPC_START + i] = h),
  );
  statuses.forEach((st, i) => (sub[INV_START + i] = st));
  sub[INV_START + statuses.length] = 'Total';
  ['Cash', 'Card', 'Online', 'Total'].forEach(
    (h, i) => (sub[PH_START + i] = h),
  );

  const aoa = [title, grp, sub];

  const branchRow = b => {
    const row = blankRow();
    row[BRANCH] = b.location || '';
    row[OPD_START] = num(b.opd?.cash);
    row[OPD_START + 1] = num(b.opd?.card);
    row[OPD_START + 2] = num(b.opd?.online);
    row[OPD_START + 3] = num(b.opd?.total);
    row[IPC_START] = num(b.ipdCollection?.cash);
    row[IPC_START + 1] = num(b.ipdCollection?.card);
    row[IPC_START + 2] = num(b.ipdCollection?.cheque);
    row[IPC_START + 3] = num(b.ipdCollection?.online);
    row[IPC_START + 4] = num(b.ipdCollection?.total);
    statuses.forEach(
      (st, i) => (row[INV_START + i] = num(b.ipdInvoice?.byStatus?.[st])),
    );
    row[INV_START + statuses.length] = num(b.ipdInvoice?.total);
    row[PH_START] = num(b.pharmacy?.cash);
    row[PH_START + 1] = num(b.pharmacy?.card);
    row[PH_START + 2] = num(b.pharmacy?.online);
    row[PH_START + 3] = num(b.pharmacy?.total);
    row[GT] = num(b.grandTotal);
    return row;
  };

  tableBranches.forEach(b => aoa.push(branchRow(b)));

  // TOTAL row from summary
  const totalRowIdx = aoa.length;
  const totalRow = branchRow({
    location: 'TOTAL',
    opd: s.opd,
    ipdCollection: s.ipdCollection,
    ipdInvoice: s.ipdInvoice,
    pharmacy: s.pharmacy,
    grandTotal: s.grandTotal,
  });
  aoa.push(totalRow);

  // Optional: list branches that failed to load
  let errorStartIdx = -1;
  if (errorBranches.length) {
    aoa.push(blankRow());
    const head = blankRow();
    head[0] = 'Branches not included (error)';
    aoa.push(head);
    errorStartIdx = aoa.length;
    errorBranches.forEach(b => {
      const r = blankRow();
      r[0] = b.location || '';
      r[1] = b.error || 'Error';
      aoa.push(r);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merges: title (full width), group headers, vertical Branch + Grand Total
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
    { s: { r: 1, c: BRANCH }, e: { r: 2, c: BRANCH } },
    { s: { r: 1, c: GT }, e: { r: 2, c: GT } },
    { s: { r: 1, c: OPD_START }, e: { r: 1, c: OPD_START + 3 } },
    { s: { r: 1, c: IPC_START }, e: { r: 1, c: IPC_START + 4 } },
    { s: { r: 1, c: INV_START }, e: { r: 1, c: INV_START + statuses.length } },
    { s: { r: 1, c: PH_START }, e: { r: 1, c: PH_START + 3 } },
  ];

  // Column widths
  const cols = new Array(NCOLS).fill(0).map((_, i) => ({
    wch: i === BRANCH ? 22 : 12,
  }));
  ws['!cols'] = cols;
  ws['!rows'] = [{ hpt: 22 }, { hpt: 20 }, { hpt: 18 }];

  // Apply styles cell-by-cell (ensure empty merged cells exist for fills/borders)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      let cell = ws[addr];
      if (!cell) {
        cell = { t: 's', v: '' };
        ws[addr] = cell;
      }
      if (R === 0) cell.s = ST_TITLE;
      else if (R === 1) cell.s = ST_GROUP;
      else if (R === 2) cell.s = ST_SUB;
      else if (R === totalRowIdx)
        cell.s = C === BRANCH ? ST_TOTAL_ROW_LABEL : ST_TOTAL_ROW;
      else if (errorStartIdx !== -1 && R >= errorStartIdx - 1)
        cell.s = ST_BRANCH;
      else cell.s = C === BRANCH ? ST_BRANCH : ST_MONEY;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Collection Summary');
  return wb;
};

// ── Stat Box: single metric ────────────────────────────
const StatBox = ({ label, value, color = '#01458e' }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{fmt(value)}</Text>
  </View>
);

// ── Category Summary Card ──────────────────────────────
const CategoryCard = ({ title, icon, items, total }) => (
  <Card style={styles.card}>
    <Card.Content>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardTotal}>{fmt(total)}</Text>
      </View>
      <Divider style={{ marginVertical: 8 }} />
      <View style={styles.statGrid}>
        {items.map((item, i) => (
          <StatBox
            key={i}
            label={item.label}
            value={item.value}
            color={item.color}
          />
        ))}
      </View>
    </Card.Content>
  </Card>
);

// ── Branch Row ─────────────────────────────────────────
const BranchCard = ({ branch }) => {
  const [expanded, setExpanded] = useState(false);

  if (branch.error) {
    return (
      <Card style={[styles.card, styles.errorCard]}>
        <Card.Content>
          <Text style={styles.errorBranchName}>{branch.location}</Text>
          <Text style={styles.errorText}>{branch.error}</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Card.Content>
          <View style={styles.branchHeader}>
            <View style={styles.branchLeft}>
              <View style={styles.branchDot} />
              <Text style={styles.branchName}>{branch.location}</Text>
            </View>
            <View style={styles.branchRight}>
              <Text style={styles.branchTotal}>{fmt(branch.grandTotal)}</Text>
              <Icon
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666"
              />
            </View>
          </View>
        </Card.Content>
      </TouchableOpacity>

      {expanded && (
        <Card.Content style={{ paddingTop: 0 }}>
          <Divider style={{ marginBottom: 10 }} />

          {/* OPD */}
          <Text style={styles.branchSectionTitle}>🏥 OPD</Text>
          <View style={styles.statGrid}>
            <StatBox label="Cash" value={branch.opd.cash} />
            <StatBox label="Card" value={branch.opd.card} />
            <StatBox label="Online" value={branch.opd.online} />
            <StatBox label="Total" value={branch.opd.total} color="#2e7d32" />
          </View>

          <Divider style={{ marginVertical: 8 }} />

          {/* IPD Invoice */}
          <Text style={styles.branchSectionTitle}>📋 IPD Invoice</Text>
          <View style={styles.statGrid}>
            {Object.entries(branch.ipdInvoice.byStatus).map(([status, amt]) => (
              <StatBox key={status} label={status} value={amt} />
            ))}
            <StatBox
              label="Total"
              value={branch.ipdInvoice.total}
              color="#2e7d32"
            />
          </View>

          <Divider style={{ marginVertical: 8 }} />

          {/* Pharmacy */}
          <Text style={styles.branchSectionTitle}>💊 Pharmacy</Text>
          <View style={styles.statGrid}>
            <StatBox label="Cash" value={branch.pharmacy.cash} />
            <StatBox label="Card" value={branch.pharmacy.card} />
            <StatBox label="Online" value={branch.pharmacy.online} />
            <StatBox
              label="Total"
              value={branch.pharmacy.total}
              color="#2e7d32"
            />
          </View>

          <Divider style={{ marginVertical: 8 }} />

          {/* IPD Collection */}
          <Text style={styles.branchSectionTitle}>🛏️ IPD Collection</Text>
          <View style={styles.statGrid}>
            <StatBox label="Cash" value={branch.ipdCollection.cash} />
            <StatBox label="Card" value={branch.ipdCollection.card} />
            <StatBox label="Cheque" value={branch.ipdCollection.cheque} />
            <StatBox label="Online" value={branch.ipdCollection.online} />
            <StatBox
              label="Total"
              value={branch.ipdCollection.total}
              color="#2e7d32"
            />
          </View>
        </Card.Content>
      )}
    </Card>
  );
};

const getISTDate = date => {
  const now = new Date(date);

  // Convert to milliseconds since UTC and add IST offset
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  //console.log(istTime);
  // Format IST date manually in YYYY-MM-DD format
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  //console.log(`${year}-${month}-${day}`);
  return `${year}-${month}-${day}`;
};

// ── Main Screen ────────────────────────────────────────
const SummaryReportScreen = ({ navigation }) => {
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  };

  const route = useRoute();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [fromDateObj, setFromDateObj] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDateObj, setToDateObj] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );

  // Committed dates — only update on Apply
  const [appliedFrom, setAppliedFrom] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [appliedTo, setAppliedTo] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [sortBy, setSortBy] = useState('alpha');

  // Quick-range preset (mirrors AdminHome). 'Custom' reveals the date pickers.
  const [selectedValue, setSelectedValue] = useState('Custom');

  // Apply a preset range using the same IST date logic as AdminHome.
  const applyPreset = value => {
    setSelectedValue(value);
    if (value === 'Custom') return; // keep modal open; user picks From/To

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const cur = new Date(now.getTime() + istOffset); // IST wall-clock via UTC fields

    // Midnight (UTC) of the given IST day, so getISTDate() returns that same day
    const mk = dt =>
      new Date(
        Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
      );

    let f, t;
    if (value === 'Today') {
      f = mk(cur);
      t = mk(cur);
    } else if (value === 'Yesterday') {
      const y = new Date(cur);
      y.setUTCDate(cur.getUTCDate() - 1);
      f = mk(y);
      t = mk(y);
    } else if (value === '7') {
      const w = new Date(cur);
      w.setUTCDate(cur.getUTCDate() - 7);
      f = mk(w);
      t = mk(cur);
    } else if (value === '30') {
      const m = new Date(cur);
      m.setUTCDate(cur.getUTCDate() - 30);
      f = mk(m);
      t = mk(cur);
    } else if (value === 'month') {
      f = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
      t = mk(cur);
    } else if (value === 'FY') {
      const fyYear =
        cur.getUTCMonth() < 3 ? cur.getUTCFullYear() - 1 : cur.getUTCFullYear();
      f = new Date(Date.UTC(fyYear, 3, 1)); // April 1
      t = mk(cur);
    } else {
      return;
    }

    // Sync both the picker objects and the committed (applied) dates
    setFromDateObj(f);
    setToDateObj(t);
    setAppliedFrom(f);
    setAppliedTo(t);
    setShowFilterModal(false);
  };

  // Remove dateStr and displayDate, add these:
  const appliedFromStr = getISTDate(appliedFrom);
  const appliedToStr = getISTDate(appliedTo);

  const displayFrom = appliedFrom.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const displayTo = appliedTo.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/report/summaryReport?from=${appliedFromStr}&to=${appliedToStr}`,
      );
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [appliedFromStr, appliedToStr]);

  const [downloading, setDownloading] = useState(false);

  const downloadExcel = async () => {
    if (!data?.summary) {
      Alert.alert('No Data', 'Nothing to export yet.');
      return;
    }
    try {
      setDownloading(true);
      const wb = buildSummaryWorkbook(data, appliedFromStr, appliedToStr);
      const fileName = `All_Branch_Billing_Summary_${appliedFromStr}_to_${appliedToStr}.xlsx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      await RNFS.writeFile(filePath, base64, 'base64');
      await Share.open({
        title: 'Billing Summary Report',
        filename: fileName,
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        failOnCancel: false,
      });
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) {
        Alert.alert('Export Failed', err?.message || String(err));
      }
    } finally {
      setDownloading(false);
    }
  };

  const s = data?.summary;

  const sortedBranches = data?.branches
    ? [...data.branches].sort((a, b) => {
        if (sortBy === 'alpha') {
          return (a.location || '').localeCompare(b.location || '');
        }
        return (b.grandTotal || 0) - (a.grandTotal || 0);
      })
    : [];

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
          <Text style={styles.headerTitle}>Billing Summary</Text>
          <Text style={styles.headerSubDate}>
            {displayFrom} → {displayTo}
          </Text>
        </View>
        <TouchableOpacity
          onPress={downloadExcel}
          disabled={downloading || !data?.summary}
          style={[
            styles.filterIconBtn,
            { marginRight: 8 },
            (downloading || !data?.summary) && { opacity: 0.5 },
          ]}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="file-excel" size={22} color="#fff" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // Reset picker selections to currently applied values on open
            setFromDateObj(appliedFrom);
            setToDateObj(appliedTo);
            setShowFilterModal(true);
          }}
          style={styles.filterIconBtn}
        >
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Icon name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <Divider style={{ marginBottom: 20 }} />

            {/* Quick range preset (same as AdminHome) */}
            <Text style={styles.modalLabel}>Quick Range</Text>
            <View style={styles.presetRow}>
              {PRESETS.map(p => {
                const active = selectedValue === p.value;
                return (
                  <Chip
                    key={p.value}
                    onPress={() => applyPreset(p.value)}
                    showSelectedCheck={false}
                    style={[
                      styles.presetChip,
                      active && styles.presetChipActive,
                    ]}
                    textStyle={[
                      styles.presetChipText,
                      active && styles.presetChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Chip>
                );
              })}
            </View>

            {selectedValue === 'Custom' && (
              <>
                {/* From Date */}
                <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                  From Date
                </Text>
                <TouchableOpacity
                  style={styles.modalDateBtn}
                  onPress={() => setShowFromPicker(true)}
                >
                  <Icon
                    name="calendar-start"
                    size={18}
                    color="#01458e"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.modalDateText}>
                    {fromDateObj.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={18}
                    color="#999"
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>

                {/* To Date */}
                <Text style={[styles.modalLabel, { marginTop: 16 }]}>
                  To Date
                </Text>
                <TouchableOpacity
                  style={styles.modalDateBtn}
                  onPress={() => setShowToPicker(true)}
                >
                  <Icon
                    name="calendar-end"
                    size={18}
                    color="#01458e"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.modalDateText}>
                    {toDateObj.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={18}
                    color="#999"
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>

                <Divider style={{ marginTop: 24, marginBottom: 16 }} />

                {/* Buttons */}
                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowFilterModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalApplyBtn}
                    onPress={() => {
                      setAppliedFrom(fromDateObj);
                      setAppliedTo(toDateObj);
                      setShowFilterModal(false);
                    }}
                  >
                    <Icon
                      name="check"
                      size={16}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.modalApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePicker
        modal
        open={showFromPicker}
        date={fromDateObj}
        mode="date"
        maximumDate={toDateObj}
        onConfirm={date => {
          setShowFromPicker(false);
          setFromDateObj(date);
        }}
        onCancel={() => setShowFromPicker(false)}
      />
      <DatePicker
        modal
        open={showToPicker}
        date={toDateObj}
        mode="date"
        minimumDate={fromDateObj}
        maximumDate={new Date()}
        onConfirm={date => {
          setShowToPicker(false);
          setToDateObj(date);
        }}
        onCancel={() => setShowToPicker(false)}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#01458e" />
          <Text style={{ marginTop: 12, color: '#666' }}>
            Loading summary...
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
            />
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        >
          {/* Grand Total Banner */}
          <Surface style={styles.grandTotalBanner}>
            <Text style={styles.grandTotalLabel}>
              Grand Total · All Branches
            </Text>
            <Text style={styles.grandTotalValue}>{fmt(s?.grandTotal)}</Text>
            <Text style={styles.grandTotalSub}>
              OPD + IPD Invoice + Pharmacy
            </Text>
          </Surface>

          {/* OPD */}
          <CategoryCard
            title="OPD"
            icon="🏥"
            total={s?.opd.total}
            items={[
              { label: 'Cash', value: s?.opd.cash },
              { label: 'Card', value: s?.opd.card },
              { label: 'Online', value: s?.opd.online },
            ]}
          />

          {/* IPD Invoice */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>📋</Text>
                <Text style={styles.cardTitle}>IPD Invoice</Text>
                <Text style={styles.cardTotal}>{fmt(s?.ipdInvoice.total)}</Text>
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={styles.statusGrid}>
                {s &&
                  Object.entries(s.ipdInvoice.byStatus).map(([status, amt]) => (
                    <View key={status} style={styles.statusItem}>
                      <Chip
                        style={styles.statusChip}
                        textStyle={styles.statusChipText}
                      >
                        {status}
                      </Chip>
                      <Text style={styles.statusAmt}>{fmt(amt)}</Text>
                    </View>
                  ))}
                <View style={styles.statusItem}>
                  <Chip
                    style={styles.statusChip}
                    textStyle={styles.statusChipText}
                  >
                    Discount
                  </Chip>
                  <Text style={styles.statusAmt}>
                    {fmt(s?.ipdInvoice.totalDiscount)}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Pharmacy */}
          <CategoryCard
            title="Pharmacy"
            icon="💊"
            total={s?.pharmacy.total}
            items={[
              { label: 'Cash', value: s?.pharmacy.cash },
              { label: 'Card', value: s?.pharmacy.card },
              { label: 'Online', value: s?.pharmacy.online },
            ]}
          />

          {/* IPD Collection */}
          <CategoryCard
            title="IPD Collection"
            icon="🛏️"
            total={s?.ipdCollection.total}
            items={[
              { label: 'Cash', value: s?.ipdCollection.cash },
              { label: 'Card', value: s?.ipdCollection.card },
              { label: 'Cheque', value: s?.ipdCollection.cheque },
              { label: 'Online', value: s?.ipdCollection.online },
            ]}
          />

          {/* Branch-wise breakdown */}
          <View style={styles.sectionHeadingRow}>
            <Icon name="map-marker-multiple" size={18} color="#01458e" />
            <Text style={styles.sectionHeading}>Branch-wise Breakdown</Text>
          </View>

          {/* ✅ Sort Toggle */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <TouchableOpacity
              style={[
                styles.sortBtn,
                sortBy === 'alpha' && styles.sortBtnActive,
              ]}
              onPress={() => setSortBy('alpha')}
            >
              <Icon
                name="sort-alphabetical-ascending"
                size={14}
                color={sortBy === 'alpha' ? '#fff' : '#01458e'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.sortBtnText,
                  sortBy === 'alpha' && styles.sortBtnTextActive,
                ]}
              >
                A → Z
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortBtn,
                sortBy === 'total' && styles.sortBtnActive,
              ]}
              onPress={() => setSortBy('total')}
            >
              <Icon
                name="sort-descending"
                size={14}
                color={sortBy === 'total' ? '#fff' : '#01458e'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.sortBtnText,
                  sortBy === 'total' && styles.sortBtnTextActive,
                ]}
              >
                Highest First
              </Text>
            </TouchableOpacity>
          </View>

          {sortedBranches.map(branch => (
            <BranchCard key={branch.location} branch={branch} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default SummaryReportScreen;

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#01458e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 6,
  },
  // Header date range
  headerSubDate: {
    color: '#a8c4e0',
    fontSize: 11,
    // marginTop: 1,
    marginLeft: 6,
  },
  filterIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },

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
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#eef2fb',
    marginBottom: 4,
  },
  presetChipActive: {
    backgroundColor: '#01458e',
  },
  presetChipText: {
    color: '#01458e',
    fontSize: 13,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#fff',
  },
  modalDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dde3f0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#f8f9ff',
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
    backgroundColor: '#01458e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
  },
  dateBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  dateSeparator: { color: '#a8c4e0', fontSize: 13, fontWeight: 'bold' },

  // Grand Total
  grandTotalBanner: {
    backgroundColor: '#01458e',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 5,
  },
  grandTotalLabel: {
    color: '#a8c4e0',
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  grandTotalValue: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  grandTotalSub: { color: '#a8c4e0', fontSize: 11, marginTop: 4 },

  // Category Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { fontSize: 18, marginRight: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#01458e' },
  cardTotal: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },

  // Stat Grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '47%', // ✅ 2 per row instead of 5 in one line
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row', // ✅ label and value side by side
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#555',
  },
  statValue: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
  },

  // Status (IPD Invoice)
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  statusItem: { alignItems: 'center', minWidth: '30%' },
  statusChip: { backgroundColor: '#e8f0fe', marginBottom: 4 },
  statusChipText: { fontSize: 11 },
  statusAmt: { fontSize: 12, fontWeight: 'bold', color: '#01458e' },

  // Invoice total row (branch expanded)
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  invoiceTotalLabel: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  invoiceTotalValue: { fontSize: 12, fontWeight: 'bold', color: '#2e7d32' },

  // Section heading
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  sectionHeading: { fontSize: 15, fontWeight: 'bold', color: '#01458e' },

  // Branch Card
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  branchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#01458e',
    marginRight: 8,
  },
  branchName: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  branchRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  branchTotal: { fontSize: 14, fontWeight: 'bold', color: '#01458e' },
  branchSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 6,
  },

  // Error branch
  errorCard: { borderLeftColor: '#e53935', borderLeftWidth: 4 },
  errorBranchName: { fontWeight: 'bold', color: '#e53935' },
  errorText: { color: '#999', fontSize: 12 },

  // Sort
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sortLabel: {
    fontSize: 13,
    color: '#555',
    marginRight: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#01458e',
    backgroundColor: '#fff',
  },
  sortBtnActive: {
    backgroundColor: '#01458e',
  },
  sortBtnText: {
    fontSize: 12,
    color: '#01458e',
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#fff',
  },
});
