/* eslint-disable prettier/prettier */
// src/screens/summaryExcel.js
// ─────────────────────────────────────────────────────────────────────────────
// The Billing Summary workbook.
//
// Lifted VERBATIM out of src/admin/SummaryReportScreen.js so
// BillingSummaryScreen can import it. The only changes are the XLSX import and
// the `export` keyword — the layout, styles and row builders are untouched,
// because the finance team already reads this file and its column layout is
// load-bearing.
//
// ── THE COLUMN LAYOUT ──────────────────────────────────────────────────────
//   Branch │ OPD (4) │ IPD Collection (5) │ IPD Invoice (n+1) │ Pharmacy (4) │ Grand
//
// IPD Invoice widens with however many invoice statuses appear in the data, so
// every column index after it shifts. That is why PH_START and GT come from a
// running counter rather than constants — adding a status must not mean
// editing five numbers.
//
// ── THE GRAND TOTAL EXCLUDES IPD COLLECTION ────────────────────────────────
//     grandTotal = OPD + IPD INVOICE (billed) + Pharmacy
// IPD collection has its own five columns and is NOT part of it. Summing the
// visible money columns will not reproduce Grand Total, and that is correct.
// ─────────────────────────────────────────────────────────────────────────────

import XLSX from 'xlsx-js-style';

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

export const buildSummaryWorkbook = (data, fromStr, toStr) => {
  const s = data.summary || {};
  const tableBranches = (data.branches || []).filter(b => !b.error);
  const errorBranches = (data.branches || []).filter(b => b.error);

  // IPD Invoice status columns = union across summary + all branches. A status
  // that appears at one branch only would otherwise have no column, and its
  // money would vanish from the sheet without a trace.
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

  // TOTAL row from summary — the API's own totals, NOT a sum of the rows
  // above. If the two ever disagree that is a real discrepancy and it should
  // be visible in the sheet rather than hidden by recomputing it here.
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

  // Apply styles cell-by-cell. The empty-cell backfill matters: a merged cell
  // that aoa_to_sheet never created has no object to hang a fill or border on,
  // so the group header bands would come out half-painted.
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

export default { buildSummaryWorkbook };
