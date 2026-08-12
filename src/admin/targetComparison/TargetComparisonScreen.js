/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// TargetComparisonScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Overview: consolidated (all-branches) summary + searchable branch list.
// Reads the user's role from redux and forwards it so SuperAdmin also receives
// Optimistic targets. For SuperAdmin the branch rows show both Base and
// Optimistic achievement; for everyone else, Base only (unchanged layout).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Text, Card, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import {
  BRAND,
  BG,
  RED,
  GREEN,
  MODE_LABEL,
  buildPeriodLabel,
  fmtCompact,
  fmtCount,
  yoyColor,
  achColor,
  StatCard,
  RevenueChart,
  PeriodFilterModal,
} from './TargetComparisonShared';
import {
  fetchComparisonBranches,
  fetchComparisonDetail,
  currentMonthPeriodIndex,
} from './TargetComparisonAPI';

import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import XLSX from 'xlsx-js-style';

/* ═══════════════════════════════════════════════════════════════════════════
   EXCEL EXPORT — styled workbook (xlsx-js-style)
   Palette matches the Billing Summary export so both reports look identical.
   ═══════════════════════════════════════════════════════════════════════════ */

const MONEY_FMT = '"₹"#,##0';
const COUNT_FMT = '#,##0';
const PCT_FMT = '0.00"%"';

const THIN = { style: 'thin', color: { rgb: 'D9D9D9' } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const ST_TITLE = {
  font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '01458E' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_SUBTITLE = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2E6FB8' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_SECTION = {
  font: { bold: true, sz: 11, color: { rgb: '01458E' } },
  fill: { fgColor: { rgb: 'DCE6F1' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER,
};
const ST_HEAD = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '01458E' } },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: true,
  },
  border: BORDER,
};
const ST_LABEL = {
  font: { bold: true, sz: 10, color: { rgb: '222222' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER,
};
const ST_LABEL_ALT = { ...ST_LABEL, fill: { fgColor: { rgb: 'F5F8FC' } } };
const ST_TEXT = {
  font: { sz: 10, color: { rgb: '444444' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER,
};
const ST_DASH = {
  font: { sz: 10, color: { rgb: '9AA5B1' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_KPI_VAL = {
  font: { bold: true, sz: 11, color: { rgb: '01458E' } },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
};
const ST_TOTAL_LABEL = {
  font: { bold: true, sz: 10, color: { rgb: '1B5E20' } },
  fill: { fgColor: { rgb: 'EAF1FB' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER,
};

// number cell style for a given parameter type
const numStyle = (type, extra = {}) => ({
  numFmt:
    type === 'currency' ? MONEY_FMT : type === 'percent' ? PCT_FMT : COUNT_FMT,
  font: { sz: 10, color: { rgb: '222222' } },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
  ...extra,
});

// YoY: green when positive, red when negative
const yoyStyle = (v, extra = {}) => ({
  numFmt: '+0.00"%";-0.00"%"',
  font: {
    bold: true,
    sz: 10,
    color: { rgb: (Number(v) || 0) >= 0 ? '1F9D57' : 'C62828' },
  },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
  ...extra,
});

// Achievement: green >= 100, amber >= 80, red below
const achStyle = (v, extra = {}) => ({
  numFmt: '0.0"%"',
  font: {
    bold: true,
    sz: 10,
    color: {
      rgb:
        v == null
          ? '9AA5B1'
          : v >= 100
          ? '1F9D57'
          : v >= 80
          ? 'B26A00'
          : 'C62828',
    },
  },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
  ...extra,
});

const mk = (v, s) => ({ v, s });

// numeric cell that degrades to an em-dash when the value is null
const nCell = (v, style, dashFill) =>
  v == null || Number.isNaN(Number(v))
    ? mk('—', dashFill ? { ...ST_DASH, fill: dashFill } : ST_DASH)
    : mk(Number(v), style);

// Excel sheet names: <=31 chars, no []:*?/\, must be unique
const safeSheetName = (name, used) => {
  const base =
    String(name || 'Branch')
      .replace(/[\\/?*[\]:]/g, '-')
      .trim()
      .slice(0, 28) || 'Branch';
  let out = base;
  let i = 2;
  while (used.has(out.toLowerCase())) {
    out = `${base.slice(0, 26)}~${i++}`;
  }
  used.add(out.toLowerCase());
  return out;
};

/* ── one parameter table (used by the summary sheet and every branch sheet) ── */
const paramTableRows = (params, showOptimistic, addRow, NCOLS) => {
  const head = [
    mk('Parameter', ST_HEAD),
    mk('Last Year', ST_HEAD),
    mk('This Year', ST_HEAD),
    mk('YoY %', ST_HEAD),
    mk('Base Target', ST_HEAD),
    mk('Base Ach %', ST_HEAD),
  ];
  if (showOptimistic) {
    head.push(mk('Optimistic Target', ST_HEAD), mk('Opt. Ach %', ST_HEAD));
  }
  addRow(head, ST_HEAD);

  (params || []).forEach((p, i) => {
    const alt = i % 2 === 1;
    const fill = alt ? { fgColor: { rgb: 'F7F9FC' } } : undefined;
    const ext = fill ? { fill } : {};
    const cells = [
      mk(p.label || p.key, alt ? ST_LABEL_ALT : ST_LABEL),
      nCell(p.lastYear, numStyle(p.type, ext), fill),
      nCell(p.thisYear, numStyle(p.type, ext), fill),
      nCell(p.yoy, yoyStyle(p.yoy, ext), fill),
      nCell(p.target, numStyle(p.type, ext), fill),
      nCell(p.ach, achStyle(p.ach, ext), fill),
    ];
    if (showOptimistic) {
      cells.push(
        nCell(p.targetO, numStyle(p.type, ext), fill),
        nCell(p.achO, achStyle(p.achO, ext), fill),
      );
    }
    addRow(cells, alt ? ST_LABEL_ALT : ST_LABEL);
  });
};

/**
 * Build the full workbook.
 *  - Sheet 1 "Summary"  : header, KPI highlights, consolidated parameters,
 *                         branch-wise league table (+ TOTAL row)
 *  - Sheet 2..n         : one per branch, full parameter comparison
 *  - "Notes"            : branches that failed or have no target configured
 */
const buildTargetComparisonWorkbook = ({
  consolidated,
  branchTotals,
  branchDetails,
  showOptimistic,
  modeLabel,
  periodLabel,
  rangeText,
}) => {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const NCOLS = showOptimistic ? 9 : 7; // widest table on the summary sheet

  /* ───────────────────────── SUMMARY SHEET ───────────────────────── */
  const aoa = [];
  const sty = [];
  const merges = [];

  const addRow = (cells, fillerStyle = null) => {
    const v = new Array(NCOLS).fill('');
    const s = new Array(NCOLS).fill(fillerStyle);
    cells.forEach((c, i) => {
      if (i >= NCOLS) return;
      v[i] = c && typeof c === 'object' && 'v' in c ? c.v : c;
      s[i] = c && typeof c === 'object' && 's' in c ? c.s : fillerStyle;
    });
    aoa.push(v);
    sty.push(s);
    return aoa.length - 1;
  };
  const spacer = () => addRow([]);
  const full = (text, style) => {
    const r = addRow([mk(text, style)], style);
    merges.push({ s: { r, c: 0 }, e: { r, c: NCOLS - 1 } });
    return r;
  };

  full('TARGET COMPARISON REPORT', ST_TITLE);
  full(
    `All Branches  ·  ${modeLabel}  ·  ${periodLabel}${
      rangeText ? `  ·  ${rangeText}` : ''
    }`,
    ST_SUBTITLE,
  );
  full(
    `Generated on ${new Date().toLocaleString('en-IN')}${
      showOptimistic ? '  ·  Base + Optimistic targets' : '  ·  Base targets'
    }`,
    { ...ST_TEXT, alignment: { horizontal: 'center', vertical: 'center' } },
  );
  spacer();

  /* KPI highlights — mirrors the stat cards on the main screen */
  const byKey = k =>
    (consolidated || []).find(r => r.key === k) || {
      lastYear: 0,
      thisYear: 0,
      yoy: 0,
      ach: null,
      target: null,
    };
  const total = byKey('total');
  const newPat = byKey('newPatients');
  const sx = byKey('sx');
  const conv = byKey('conversion');

  full('KEY HIGHLIGHTS', ST_SECTION);

  const kpi = (label, value, style, note) => {
    const r = addRow(
      [
        mk(label, ST_LABEL),
        value == null ? mk('—', ST_DASH) : mk(Number(value), style),
        mk(note || '', ST_TEXT),
      ],
      ST_TEXT,
    );
    merges.push({ s: { r, c: 2 }, e: { r, c: NCOLS - 1 } });
  };

  kpi('Total Revenue (This Year)', total.thisYear, {
    ...ST_KPI_VAL,
    numFmt: MONEY_FMT,
  });
  kpi('Total Revenue (Last Year)', total.lastYear, {
    ...ST_KPI_VAL,
    numFmt: MONEY_FMT,
  });
  kpi(
    'YoY Growth',
    total.yoy,
    yoyStyle(total.yoy, {
      font: {
        bold: true,
        sz: 11,
        color: { rgb: (total.yoy || 0) >= 0 ? '1F9D57' : 'C62828' },
      },
    }),
  );
  kpi('Base Target', total.target, { ...ST_KPI_VAL, numFmt: MONEY_FMT });
  kpi(
    'Base Target Achieved',
    total.ach,
    achStyle(total.ach, {
      font: {
        bold: true,
        sz: 11,
        color: {
          rgb:
            total.ach == null
              ? '9AA5B1'
              : total.ach >= 100
              ? '1F9D57'
              : total.ach >= 80
              ? 'B26A00'
              : 'C62828',
        },
      },
    }),
    total.target == null ? 'No target configured' : '',
  );
  if (showOptimistic) {
    kpi('Optimistic Target', total.targetO, {
      ...ST_KPI_VAL,
      numFmt: MONEY_FMT,
    });
    kpi(
      'Optimistic Target Achieved',
      total.achO,
      achStyle(total.achO, {
        font: {
          bold: true,
          sz: 11,
          color: {
            rgb:
              total.achO == null
                ? '9AA5B1'
                : total.achO >= 100
                ? '1F9D57'
                : total.achO >= 80
                ? 'B26A00'
                : 'C62828',
          },
        },
      }),
    );
  }
  kpi(
    'New Patients',
    newPat.thisYear,
    { ...ST_KPI_VAL, numFmt: COUNT_FMT },
    `${(newPat.yoy || 0) >= 0 ? '+' : ''}${(newPat.yoy || 0).toFixed(2)}% YoY`,
  );
  kpi(
    'No. of SX',
    sx.thisYear,
    { ...ST_KPI_VAL, numFmt: COUNT_FMT },
    `${(sx.yoy || 0) >= 0 ? '+' : ''}${(sx.yoy || 0).toFixed(2)}% YoY`,
  );
  kpi(
    'Conversion',
    conv.thisYear,
    { ...ST_KPI_VAL, numFmt: PCT_FMT },
    `${(conv.yoy || 0) >= 0 ? '+' : ''}${(conv.yoy || 0).toFixed(2)}% YoY`,
  );
  kpi('Branches Included', (branchTotals || []).length, {
    ...ST_KPI_VAL,
    numFmt: COUNT_FMT,
  });
  spacer();

  /* Consolidated parameter table */
  full('CONSOLIDATED PARAMETERS — ALL BRANCHES', ST_SECTION);
  paramTableRows(consolidated, showOptimistic, addRow, NCOLS);
  spacer();

  /* Branch league table */
  full('BRANCH-WISE PERFORMANCE', ST_SECTION);
  const bHead = [
    mk('Branch', ST_HEAD),
    mk('Last Year', ST_HEAD),
    mk('This Year', ST_HEAD),
    mk('YoY %', ST_HEAD),
    mk('Base Target', ST_HEAD),
    mk('Base Ach %', ST_HEAD),
  ];
  if (showOptimistic) {
    bHead.push(mk('Optimistic Target', ST_HEAD), mk('Opt. Ach %', ST_HEAD));
  }
  bHead.push(mk('Remarks', ST_HEAD));
  addRow(bHead, ST_HEAD);

  (branchTotals || []).forEach((b, i) => {
    const alt = i % 2 === 1;
    const fill = alt ? { fgColor: { rgb: 'F7F9FC' } } : undefined;
    const ext = fill ? { fill } : {};
    const remark = b.error
      ? `Error: ${b.error}`
      : b.lastYearMissing
      ? 'Last-year actuals not available'
      : b.ach == null
      ? 'No target configured'
      : '';
    const cells = [
      mk(b.name, alt ? ST_LABEL_ALT : ST_LABEL),
      nCell(b.lastYear, numStyle('currency', ext), fill),
      nCell(b.thisYear, numStyle('currency', ext), fill),
      nCell(b.yoy, yoyStyle(b.yoy, ext), fill),
      nCell(b.target, numStyle('currency', ext), fill),
      nCell(b.ach, achStyle(b.ach, ext), fill),
    ];
    if (showOptimistic) {
      cells.push(
        nCell(b.targetO, numStyle('currency', ext), fill),
        nCell(b.achO, achStyle(b.achO, ext), fill),
      );
    }
    cells.push(mk(remark, alt ? { ...ST_TEXT, fill } : ST_TEXT));
    addRow(cells, alt ? ST_LABEL_ALT : ST_LABEL);
  });

  // TOTAL row, taken from the consolidated total (not a re-sum of the rows)
  const totFill = { fgColor: { rgb: 'EAF1FB' } };
  const totExt = {
    fill: totFill,
    font: { bold: true, sz: 10, color: { rgb: '1B5E20' } },
  };
  const totCells = [
    mk('TOTAL (All Branches)', ST_TOTAL_LABEL),
    nCell(total.lastYear, numStyle('currency', totExt), totFill),
    nCell(total.thisYear, numStyle('currency', totExt), totFill),
    nCell(total.yoy, yoyStyle(total.yoy, { fill: totFill }), totFill),
    nCell(total.target, numStyle('currency', totExt), totFill),
    nCell(total.ach, achStyle(total.ach, { fill: totFill }), totFill),
  ];
  if (showOptimistic) {
    totCells.push(
      nCell(total.targetO, numStyle('currency', totExt), totFill),
      nCell(total.achO, achStyle(total.achO, { fill: totFill }), totFill),
    );
  }
  totCells.push(mk('', { ...ST_TEXT, fill: totFill }));
  addRow(totCells, ST_TOTAL_LABEL);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = new Array(NCOLS).fill(0).map((_, i) => ({
    wch: i === 0 ? 28 : i === NCOLS - 1 ? 32 : 17,
  }));
  ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 18 }];
  ws['!freeze'] = { xSplit: 1, ySplit: 0 };

  // apply the parallel style map (creating empty cells so fills/borders show)
  for (let R = 0; R < aoa.length; R++) {
    for (let C = 0; C < NCOLS; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      if (sty[R] && sty[R][C]) ws[addr].s = sty[R][C];
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName('Summary', used));

  /* ───────────────────── ONE SHEET PER BRANCH ───────────────────── */
  const BCOLS = showOptimistic ? 8 : 6;

  (branchDetails || []).forEach(d => {
    const bAoa = [];
    const bSty = [];
    const bMerges = [];

    const bAdd = (cells, fillerStyle = null) => {
      const v = new Array(BCOLS).fill('');
      const s = new Array(BCOLS).fill(fillerStyle);
      cells.forEach((c, i) => {
        if (i >= BCOLS) return;
        v[i] = c && typeof c === 'object' && 'v' in c ? c.v : c;
        s[i] = c && typeof c === 'object' && 's' in c ? c.s : fillerStyle;
      });
      bAoa.push(v);
      bSty.push(s);
      return bAoa.length - 1;
    };
    const bFull = (text, style) => {
      const r = bAdd([mk(text, style)], style);
      bMerges.push({ s: { r, c: 0 }, e: { r, c: BCOLS - 1 } });
    };

    const b = d.branch || {};
    bFull((b.name || 'Branch').toUpperCase(), ST_TITLE);
    bFull(
      `${modeLabel}  ·  ${periodLabel}${rangeText ? `  ·  ${rangeText}` : ''}`,
      ST_SUBTITLE,
    );
    bAdd([]);

    if (d.error || !d.params) {
      bFull('Detailed data could not be loaded for this branch.', ST_SECTION);
      bFull(String(d.error || 'Unknown error'), ST_TEXT);
    } else {
      // branch snapshot
      bFull('SNAPSHOT', ST_SECTION);
      const snap = (label, value, style, note) => {
        const r = bAdd(
          [
            mk(label, ST_LABEL),
            value == null ? mk('—', ST_DASH) : mk(Number(value), style),
            mk(note || '', ST_TEXT),
          ],
          ST_TEXT,
        );
        bMerges.push({ s: { r, c: 2 }, e: { r, c: BCOLS - 1 } });
      };
      const bTotal = d.params.find(p => p.key === 'total') || {
        thisYear: 0,
        lastYear: 0,
        yoy: 0,
        ach: null,
        target: null,
      };
      snap('Total Revenue (This Year)', bTotal.thisYear, {
        ...ST_KPI_VAL,
        numFmt: MONEY_FMT,
      });
      snap('Total Revenue (Last Year)', bTotal.lastYear, {
        ...ST_KPI_VAL,
        numFmt: MONEY_FMT,
      });
      snap(
        'YoY Growth',
        bTotal.yoy,
        yoyStyle(bTotal.yoy, {
          font: {
            bold: true,
            sz: 11,
            color: { rgb: (bTotal.yoy || 0) >= 0 ? '1F9D57' : 'C62828' },
          },
        }),
      );
      snap('Base Target', bTotal.target, { ...ST_KPI_VAL, numFmt: MONEY_FMT });
      snap(
        'Base Target Achieved',
        bTotal.ach,
        achStyle(bTotal.ach, {
          font: {
            bold: true,
            sz: 11,
            color: {
              rgb:
                bTotal.ach == null
                  ? '9AA5B1'
                  : bTotal.ach >= 100
                  ? '1F9D57'
                  : bTotal.ach >= 80
                  ? 'B26A00'
                  : 'C62828',
            },
          },
        }),
      );
      if (showOptimistic) {
        snap('Optimistic Target', bTotal.targetO, {
          ...ST_KPI_VAL,
          numFmt: MONEY_FMT,
        });
        snap(
          'Optimistic Target Achieved',
          bTotal.achO,
          achStyle(bTotal.achO, {
            font: {
              bold: true,
              sz: 11,
              color: {
                rgb:
                  bTotal.achO == null
                    ? '9AA5B1'
                    : bTotal.achO >= 100
                    ? '1F9D57'
                    : bTotal.achO >= 80
                    ? 'B26A00'
                    : 'C62828',
              },
            },
          }),
        );
      }
      bAdd([]);
      bFull('PARAMETER COMPARISON', ST_SECTION);
      paramTableRows(d.params, showOptimistic, bAdd, BCOLS);
    }

    const bws = XLSX.utils.aoa_to_sheet(bAoa);
    bws['!merges'] = bMerges;
    bws['!cols'] = new Array(BCOLS)
      .fill(0)
      .map((_, i) => ({ wch: i === 0 ? 26 : 18 }));
    bws['!rows'] = [{ hpt: 26 }, { hpt: 20 }];
    for (let R = 0; R < bAoa.length; R++) {
      for (let C = 0; C < BCOLS; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!bws[addr]) bws[addr] = { t: 's', v: '' };
        if (bSty[R] && bSty[R][C]) bws[addr].s = bSty[R][C];
      }
    }
    XLSX.utils.book_append_sheet(wb, bws, safeSheetName(b.name, used));
  });

  /* ───────────────────────── NOTES SHEET ───────────────────────── */
  const problems = (branchDetails || []).filter(d => d.error);
  const noTarget = (branchTotals || []).filter(b => !b.error && b.ach == null);
  if (problems.length || noTarget.length) {
    const nAoa = [['Branch', 'Note']];
    problems.forEach(d =>
      nAoa.push([d.branch?.name || '', `Detail unavailable: ${d.error}`]),
    );
    noTarget.forEach(b =>
      nAoa.push([b.name, 'No target configured for this period']),
    );
    const nws = XLSX.utils.aoa_to_sheet(nAoa);
    nws['!cols'] = [{ wch: 26 }, { wch: 60 }];
    nAoa.forEach((_, R) => {
      [0, 1].forEach(C => {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!nws[addr]) nws[addr] = { t: 's', v: '' };
        nws[addr].s = R === 0 ? ST_HEAD : ST_TEXT;
      });
    });
    XLSX.utils.book_append_sheet(wb, nws, safeSheetName('Notes', used));
  }

  return wb;
};

/* Small worker pool so 40 branch calls don't fire at once. */
const mapPool = async (items, limit, fn, onTick) => {
  const out = new Array(items.length);
  let idx = 0;
  let done = 0;
  const worker = async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
      onTick && onTick(++done, items.length);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
};

const TargetComparisonScreen = ({ navigation }) => {
  const [mode, setMode] = useState('monthly');
  const [period, setPeriod] = useState(currentMonthPeriodIndex());
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState('');

  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'ach'

  const locations = useMemo(() => {
    if (locationArray && locationArray.length > 0) return locationArray;
    return location ? [location] : [];
  }, [location, locationArray]);

  const [consolidated, setConsolidated] = useState(null);
  const [branchTotals, setBranchTotals] = useState([]);
  const [showOptimistic, setShowOptimistic] = useState(false);
  const [primaryLabel, setPrimaryLabel] = useState('Target');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [downloading, setDownloading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [meta, setMeta] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    if (!locations.length) {
      setLoading(false);
      setError('No branch is available for your account.');
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all([
      fetchComparisonDetail('all', mode, period, locations, role, subRole),
      fetchComparisonBranches(mode, period, locations, role, subRole),
    ])
      .then(([detail, list]) => {
        if (!alive) return;
        setConsolidated(detail.params);
        setBranchTotals(list.branches || []);
        setShowOptimistic(!!list.meta?.showOptimistic);
        setPrimaryLabel(
          list.meta?.primaryLabel || detail.meta?.primaryLabel || 'Target',
        );
        setMeta(list.meta || detail.meta || null);
      })
      .catch(e => alive && setError(e.message || 'Failed to load comparison'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [locations, mode, period, role, subRole]);

  useEffect(() => load(), [load]);

  const periodLabel = buildPeriodLabel(mode, period);
  const byKey = k =>
    (consolidated || []).find(r => r.key === k) || {
      thisYear: 0,
      yoy: 0,
      ach: null,
      target: null,
    };
  const total = byKey('total');
  const newPat = byKey('newPatients');
  const sx = byKey('sx');

  const q = search.trim().toLowerCase();
  const searched = q
    ? branchTotals.filter(b => b.name.toLowerCase().includes(q))
    : branchTotals;

  const filtered = [...searched].sort((a, b) => {
    if (sortBy === 'ach') {
      // Highest achievement first; branches with no target (ach == null) sink to the bottom.
      const av = a.ach == null ? -Infinity : a.ach;
      const bv = b.ach == null ? -Infinity : b.ach;
      if (bv !== av) return bv - av;
      return a.name.localeCompare(b.name); // tie-break by name
    }
    return a.name.localeCompare(b.name); // alphabetical
  });

  const openBranch = b =>
    navigation?.navigate?.('BranchTargetDetail', {
      branchId: b.id,
      branchName: b.name,
      mode,
      period,
      locations,
    });

  const rangeText = (() => {
    const r = meta?.range || {};
    const from = r.from || r.fromTY || '';
    const to = r.to || r.toTY || '';
    return from && to ? `${from} to ${to}` : '';
  })();

  const downloadExcel = async () => {
    if (!consolidated || !branchTotals.length) {
      Alert.alert('No Data', 'Nothing to export yet.');
      return;
    }
    try {
      setDownloading(true);
      setExportMsg(`Fetching branch data 0/${branchTotals.length}`);

      // Per-branch parameter detail (same endpoint the drill-down uses)
      const branchDetails = await mapPool(
        branchTotals,
        4,
        async b => {
          try {
            const res = await fetchComparisonDetail(
              b.id,
              mode,
              period,
              locations,
              role,
              subRole,
            );
            return { branch: b, params: res.params || [] };
          } catch (e) {
            return { branch: b, params: null, error: e.message || String(e) };
          }
        },
        (done, totalCount) =>
          setExportMsg(`Fetching branch data ${done}/${totalCount}`),
      );

      setExportMsg('Building workbook…');
      const wb = buildTargetComparisonWorkbook({
        consolidated,
        branchTotals: filtered, // respects the current sort order
        branchDetails,
        showOptimistic,
        modeLabel: MODE_LABEL[mode],
        periodLabel,
        rangeText,
      });

      const stamp = `${MODE_LABEL[mode]}_${periodLabel}`.replace(
        /[^A-Za-z0-9]+/g,
        '_',
      );
      const fileName = `Target_Comparison_${stamp}.xlsx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      await RNFS.writeFile(filePath, base64, 'base64');

      await Share.open({
        title: 'Target Comparison Report',
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
      setExportMsg('');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.headerIconBtn}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Target Comparison</Text>
          <Text style={styles.headerSub}>
            {downloading
              ? exportMsg || 'Preparing Excel…'
              : 'This Year vs Last Year ' +
                (showOptimistic
                  ? ' · Base + Optimistic'
                  : ` · ${primaryLabel}`)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={downloadExcel}
          disabled={downloading || loading || !consolidated}
          style={[
            styles.headerIconBtn,
            { marginRight: 8 },
            (downloading || loading || !consolidated) && { opacity: 0.5 },
          ]}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="file-excel" size={22} color="#fff" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowFilter(true)}
          style={styles.headerIconBtn}
        >
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.banner}>
        <TouchableOpacity
          style={styles.bannerChip}
          onPress={() => setShowFilter(true)}
        >
          <Icon
            name="calendar-range"
            size={16}
            color={BRAND}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.bannerChipText}>
            {MODE_LABEL[mode]} · {periodLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} size="large" />
          <Text style={styles.muted}>Loading comparison…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={42} color={RED} />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Icon
              name="refresh"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <Text style={styles.viewLabel}>
            All Branches · {MODE_LABEL[mode]}
          </Text>

          <View style={styles.statRow}>
            <StatCard
              title="Total Revenue (This Yr)"
              value={fmtCompact(total.thisYear)}
              sub={`${total.yoy >= 0 ? '+' : ''}${total.yoy.toFixed(2)}% YoY`}
              subColor={yoyColor(total.yoy)}
            />
            <StatCard
              title={`${primaryLabel} Target Achieved`}
              value={total.ach == null ? '—' : `${total.ach.toFixed(1)}%`}
              sub={
                total.target == null
                  ? 'No target set'
                  : `Target ${fmtCompact(total.target)}`
              }
              subColor={total.ach == null ? '#999' : achColor(total.ach)}
            />
          </View>

          {/* Optimistic summary card only for SuperAdmin */}
          {showOptimistic && (
            <View style={styles.statRow}>
              <StatCard
                title="Optimistic Target Achieved"
                value={total.achO == null ? '—' : `${total.achO.toFixed(1)}%`}
                sub={
                  total.targetO == null
                    ? 'No target set'
                    : `Target ${fmtCompact(total.targetO)}`
                }
                subColor={total.achO == null ? '#999' : achColor(total.achO)}
              />
              <StatCard
                title="New Patients (This Yr)"
                value={fmtCount(newPat.thisYear)}
                sub={`${newPat.yoy >= 0 ? '+' : ''}${newPat.yoy.toFixed(
                  2,
                )}% YoY`}
                subColor={yoyColor(newPat.yoy)}
              />
            </View>
          )}

          {!showOptimistic && (
            <View style={styles.statRow}>
              <StatCard
                title="New Patients"
                value={fmtCount(newPat.thisYear)}
                sub={`${newPat.yoy >= 0 ? '+' : ''}${newPat.yoy.toFixed(
                  2,
                )}% YoY`}
                subColor={yoyColor(newPat.yoy)}
              />
              <StatCard
                title="No. of SX"
                value={fmtCount(sx.thisYear)}
                sub={`${sx.yoy >= 0 ? '+' : ''}${sx.yoy.toFixed(2)}% YoY`}
                subColor={yoyColor(sx.yoy)}
              />
            </View>
          )}

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>
                Revenue Streams (All Branches)
              </Text>
              <Text style={styles.cardCaption}>
                Last Year (from records) vs This Year vs {primaryLabel}
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <RevenueChart rows={consolidated} />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>
                Branches ({branchTotals.length})
              </Text>
              <Text style={styles.cardCaption}>
                Tap a branch for its full comparison
              </Text>

              <View style={styles.searchBox}>
                <Icon name="magnify" size={18} color="#888" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search branch"
                  placeholderTextColor="#9aa5b1"
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort</Text>
                {[
                  { key: 'name', label: 'A–Z' },
                  { key: 'ach', label: 'Achievement' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setSortBy(opt.key)}
                    style={[
                      styles.sortChip,
                      sortBy === opt.key && styles.sortChipActive,
                    ]}
                  >
                    <Icon
                      name={
                        opt.key === 'name'
                          ? 'sort-alphabetical-ascending'
                          : 'sort-descending'
                      }
                      size={14}
                      color={sortBy === opt.key ? '#fff' : BRAND}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.sortChipText,
                        sortBy === opt.key && styles.sortChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {filtered.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.branchRow}
                  onPress={() => openBranch(b)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.branchName}>{b.name}</Text>
                    <Text style={styles.branchSub}>
                      {fmtCompact(b.thisYear)} · {b.yoy >= 0 ? '+' : ''}
                      {b.yoy.toFixed(1)}% YoY
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                    <Text style={[styles.achVal, { color: achColor(b.ach) }]}>
                      {b.ach == null ? '—' : `${b.ach.toFixed(0)}%`}
                    </Text>
                    <Text style={styles.achCap}>
                      {showOptimistic ? 'Base' : 'Ach'}
                    </Text>
                  </View>
                  {showOptimistic && (
                    <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                      <Text
                        style={[styles.achVal, { color: achColor(b.achO) }]}
                      >
                        {b.achO == null ? '—' : `${b.achO.toFixed(0)}%`}
                      </Text>
                      <Text style={styles.achCap}>Opt</Text>
                    </View>
                  )}
                  <Icon name="chevron-right" size={22} color="#b0b8c1" />
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <Text style={styles.muted}>No branches match “{search}”.</Text>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      <PeriodFilterModal
        visible={showFilter}
        mode={mode}
        period={period}
        onClose={() => setShowFilter(false)}
        onApply={(m, p) => {
          setMode(m);
          setPeriod(p);
          setShowFilter(false);
        }}
      />
    </SafeAreaView>
  );
};

export default TargetComparisonScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSub: { color: '#cdddf2', fontSize: 12, textAlign: 'center' },
  banner: { paddingHorizontal: 14, paddingTop: 12 },
  bannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e8eef5',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  bannerChipText: { color: BRAND, fontSize: 13, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  muted: { color: '#6b7280', marginTop: 10 },
  errText: { color: RED, marginTop: 10, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 14,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  viewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statRow: { flexDirection: 'row', marginBottom: 10 },
  card: {
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1f2a37' },
  cardCaption: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f4f8',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    color: '#1f2a37',
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
  },
  branchName: { fontSize: 14, fontWeight: '700', color: '#1f2a37' },
  branchSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  achVal: { fontSize: 15, fontWeight: '800' },
  achCap: { fontSize: 10, color: '#9aa5b1' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sortLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#eef3f8',
    marginRight: 8,
  },
  sortChipActive: { backgroundColor: BRAND },
  sortChipText: { fontSize: 12, color: BRAND, fontWeight: '600' },
  sortChipTextActive: { color: '#fff' },
});
