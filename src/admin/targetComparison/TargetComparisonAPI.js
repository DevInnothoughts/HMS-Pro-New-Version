/* eslint-disable prettier/prettier */
// TargetComparisonAPI.js
// ─────────────────────────────────────────────────────────────────────────────
// Same two calls as before, now forwarding the logged-in user's role so the
// server can include Optimistic targets for SuperAdmin only.
//
// Response (branches): { id, name, thisYear, lastYear, yoy, target, ach,
//                        showOptimistic, [targetO, achO] }
// Response (detail params): { ...base fields..., target, ach, targetPct,
//                             [targetO, achO, targetPctO] }
// ─────────────────────────────────────────────────────────────────────────────

// Keep this in sync with the rest of the app's backend base.
const BACKEND_URL = 'https://wedoc.in/hms';

/* ------------------------- period → date range ------------------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();

// Fiscal order: Apr(0) … Mar(11).
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

const fyStartYear = () => {
  const now = new Date();
  // FY starts in April; before April we're still in the previous FY.
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

export const currentMonthPeriodIndex = () => {
  const idx = FISCAL_MONTHS.indexOf(new Date().getMonth() + 1);
  return idx < 0 ? 0 : idx;
};

// Returns { from, to } for a mode + period index, relative to the current FY.
export const getRangeForSelection = (mode, period) => {
  const baseY = fyStartYear();
  if (mode === 'yearly') {
    return { from: ymd(baseY, 4, 1), to: ymd(baseY + 1, 3, 31) };
  }
  if (mode === 'quarterly') {
    // Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar
    const q = Math.max(0, Math.min(3, period));
    const startMonth = 4 + q * 3; // 4,7,10,13
    if (startMonth <= 12) {
      const endMonth = startMonth + 2;
      return {
        from: ymd(baseY, startMonth, 1),
        to: ymd(baseY, endMonth, lastDay(baseY, endMonth)),
      };
    }
    // Q4 wraps into next calendar year
    return { from: ymd(baseY + 1, 1, 1), to: ymd(baseY + 1, 3, 31) };
  }
  // monthly
  const mo = FISCAL_MONTHS[period] ?? 4;
  const y = mo >= 4 ? baseY : baseY + 1;
  return { from: ymd(y, mo, 1), to: ymd(y, mo, lastDay(y, mo)) };
};

/* ------------------------------- fetch -------------------------------- */
const postJSON = async (path, body) => {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
};

// `role`/`subRole` come from redux (state.location) — the server uses them to
// decide whether to include Optimistic targets.
export const fetchComparisonBranches = (
  mode,
  period,
  locations,
  role,
  subRole,
) => {
  const { from, to } = getRangeForSelection(mode, period);
  return postJSON('/targetComparisonNew/branches', {
    locations,
    from,
    to,
    role,
    subRole,
  });
};

export const fetchComparisonDetail = (
  branch,
  mode,
  period,
  locations,
  role,
  subRole,
) => {
  const { from, to } = getRangeForSelection(mode, period);
  return postJSON('/targetComparisonNew/detail', {
    branch,
    locations,
    from,
    to,
    role,
    subRole,
  });
};
