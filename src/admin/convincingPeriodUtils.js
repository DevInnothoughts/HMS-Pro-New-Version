/* eslint-disable prettier/prettier */
// convincingPeriodUtils.js
// Shared period helpers for the Convincing Score screen and its Comparison
// screen. Lifted out of ConvincingScoreNew.js so both use one definition.

export const MAX_RANGE_DAYS = 366;

export const formatDateIST = d => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const prettyDate = d =>
  new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const rangeLabel = (f, t) =>
  formatDateIST(f) === formatDateIST(t)
    ? prettyDate(f)
    : `${prettyDate(f)} – ${prettyDate(t)}`;

export const daysBetween = (f, t) =>
  Math.round(
    (new Date(formatDateIST(t)) - new Date(formatDateIST(f))) / 86400000,
  ) + 1;

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const parseYmdLocal = s => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Keep this identical to the version currently in ConvincingScoreNew.js.
export const generateMonthsList = (count = 18) => {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      value: d,
    });
  }
  return out;
};

/* ── Quarter / FY period builders (Indian FY: Apr–Mar) ──────────────────── */

export const fyStartYear = (d = new Date()) =>
  d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;

export const fyLabel = y => `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`;

const QUARTER_DEFS = [
  { key: 'Q1', label: 'Q1 (Apr–Jun)', startMonth: 4, yearOffset: 0 },
  { key: 'Q2', label: 'Q2 (Jul–Sep)', startMonth: 7, yearOffset: 0 },
  { key: 'Q3', label: 'Q3 (Oct–Dec)', startMonth: 10, yearOffset: 0 },
  { key: 'Q4', label: 'Q4 (Jan–Mar)', startMonth: 1, yearOffset: 1 },
];

/**
 * Quarters for the last `fyCount` financial years, newest first.
 * Quarters that haven't started yet are omitted, so the list never offers a
 * period with no possible data.
 */
export const generateQuartersList = (fyCount = 3) => {
  const today = startOfToday();
  const baseFy = fyStartYear(today);
  const out = [];

  for (let i = 0; i < fyCount; i++) {
    const fy = baseFy - i;
    // Newest quarter first within each FY
    for (let q = QUARTER_DEFS.length - 1; q >= 0; q--) {
      const def = QUARTER_DEFS[q];
      const y = fy + def.yearOffset;
      const from = new Date(y, def.startMonth - 1, 1);
      if (from > today) continue; // hasn't begun yet
      const to = new Date(y, def.startMonth + 2, 0);
      out.push({
        label: `${def.label} · ${fyLabel(fy)}`,
        shortLabel: `${def.key} ${fyLabel(fy)}`,
        from,
        to,
      });
    }
  }
  return out;
};

/** Financial years, newest first. The in-progress FY is included and flagged. */
export const generateFyList = (count = 4) => {
  const today = startOfToday();
  const baseFy = fyStartYear(today);
  const out = [];

  for (let i = 0; i < count; i++) {
    const fy = baseFy - i;
    const from = new Date(fy, 3, 1); // 1 Apr
    const to = new Date(fy + 1, 2, 31); // 31 Mar
    out.push({
      label: i === 0 ? `${fyLabel(fy)} (in progress)` : fyLabel(fy),
      shortLabel: fyLabel(fy),
      from,
      to,
    });
  }
  return out;
};
