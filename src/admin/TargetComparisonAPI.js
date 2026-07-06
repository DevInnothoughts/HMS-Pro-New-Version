/**
 * targetComparisonApi.js
 * ------------------------------------------------------------------
 * Networking + period→date-range conversion for the Target Comparison
 * feature. `locations` is always supplied by the caller (sourced from
 * redux in the screens) — there is NO hardcoded fallback list here.
 *
 * Endpoints (see targetComparisonController.js):
 *   POST /hms/targetComparison/branches  → { meta, branches: [...] }
 *   POST /hms/targetComparison/detail    → { meta, params:   [...] }
 * ------------------------------------------------------------------
 */
import { PERIODS } from './TargetComparisonShared';

// Same backend base the rest of the app uses (see ReportScreen.js).
// TODO: lift into a shared config instead of duplicating per file.
const BACKEND_URL = 'https://wedoc.in/hms';

/* --------------------- period → date range --------------------- *
 * Backend wants explicit { from, to } (this-year). Fiscal year =
 * April–March; quarterly / monthly anchor to the FY shown in
 * PERIODS.yearly[0]. Whole calendar period (no cap to today).
 * --------------------------------------------------------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate(); // m is 1-based
const fyStartYear = label => {
  const m = String(label || '').match(/(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
};

export const getRangeForSelection = (mode, periodIndex = 0) => {
  if (mode === 'yearly') {
    const y = fyStartYear(PERIODS.yearly[periodIndex] || PERIODS.yearly[0]);
    return { from: ymd(y, 4, 1), to: ymd(y + 1, 3, 31) };
  }

  const baseY = fyStartYear(PERIODS.yearly[0]); // current-FY anchor

  if (mode === 'quarterly') {
    const ranges = [
      { from: ymd(baseY, 4, 1), to: ymd(baseY, 6, 30) }, // Q1 Apr–Jun
      { from: ymd(baseY, 7, 1), to: ymd(baseY, 9, 30) }, // Q2 Jul–Sep
      { from: ymd(baseY, 10, 1), to: ymd(baseY, 12, 31) }, // Q3 Oct–Dec
      { from: ymd(baseY + 1, 1, 1), to: ymd(baseY + 1, 3, 31) }, // Q4 Jan–Mar
    ];
    return ranges[periodIndex] || ranges[0];
  }

  // monthly: index 0 = Apr ... 8 = Dec, 9 = Jan, 10 = Feb, 11 = Mar
  const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const i = Math.min(Math.max(periodIndex, 0), 11);
  const mo = order[i];
  const y = mo >= 4 ? baseY : baseY + 1;
  return { from: ymd(y, mo, 1), to: ymd(y, mo, lastDay(y, mo)) };
};

// Default selection: current calendar month, in fiscal (Apr-first) index order.
export const currentMonthPeriodIndex = () => {
  const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const idx = order.indexOf(new Date().getMonth() + 1);
  return idx < 0 ? 0 : idx;
};

/* ----------------------------- fetch ---------------------------- */
const postJSON = async (path, body) => {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${token}`,  // add if your API needs it
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
};

// `locations` is REQUIRED — the caller passes the user's branches (from redux).
// → { meta, branches: [{ id, name, thisYear, lastYear, yoy, ach, target }] }
export const fetchComparisonBranches = (mode, period, locations) => {
  const { from, to } = getRangeForSelection(mode, period);
  return postJSON('/targetComparison/branches', { locations, from, to });
};

// → { meta, params: [{ key, label, short, type, targetPct, lastYear, thisYear, target, yoy, ach }] }
export const fetchComparisonDetail = (branch, mode, period, locations) => {
  const { from, to } = getRangeForSelection(mode, period);
  return postJSON('/targetComparison/detail', { branch, locations, from, to });
};
