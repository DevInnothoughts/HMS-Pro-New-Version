/* eslint-disable prettier/prettier */
// src/store/scopeSlice.js
// ─────────────────────────────────────────────────────────────────────────────
// The date range every screen in the new shell shares.
//
// The presets and the date arithmetic are a deliberate port of AdminHome's
// `updateValues` — same seven options, same values, same IST handling. The new
// home has to agree with the old one number for number during the transition,
// and a range that differs by a day makes every figure differ by a day.
//
// WHY THE IST DANCE
// ─────────────────
// AdminHome does NOT use the device's local date. It adds 5h30m to UTC and then
// reads getUTCFullYear/Month/Date. On a phone set to IST both give the same
// answer; on a phone set to anything else they do not, and every branch is
// Indian. Reproduced exactly, quirk included.
//
// TWO QUIRKS KEPT ON PURPOSE
// ──────────────────────────
// • "Last 7 Days" is today−7 → today, which is 8 days inclusive. Same for
//   "Last 30 Days" (31 days). That is what AdminHome sends today and what every
//   report the team has been reading was built from. Fixing it here alone would
//   make the new home disagree with the old one and with every past export. If
//   it should be 7, change BOTH places, deliberately, as its own task.
// • Branch is NOT stored here. It lives in locationSlice as `value`; the branch
//   chip writes there. One home for one fact.
//
// Wire into src/store/store.js:
//     import scopeReducer from './scopeSlice';
//     reducer: { location: locationReducer, scope: scopeReducer }
// ─────────────────────────────────────────────────────────────────────────────

import { createSlice } from '@reduxjs/toolkit';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "Now" as an IST wall-clock instant, read via the UTC getters. AdminHome's trick. */
const istNow = () => new Date(Date.now() + IST_OFFSET_MS);

/** Format an IST-shifted Date as YYYY-MM-DD. Must use the UTC getters. */
export const fmt = d => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * The picker options, in AdminHome's order. `value` matches AdminHome's Picker
 * values exactly ('7', '30', 'month', 'FY') so the two screens can be diffed
 * without a translation table in between.
 */
export const SCOPE_OPTIONS = [
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'FY', label: 'This F.Y.' },
  { value: 'Custom', label: 'Custom Date' },
];

/** Resolve a preset to { from, to }. Returns null for Custom — the caller picks. */
export function rangeFor(preset) {
  const cur = istNow();

  const shifted = days => {
    const d = new Date(cur);
    d.setUTCDate(cur.getUTCDate() + days);
    return d;
  };

  switch (preset) {
    case 'Today':
      return { from: fmt(cur), to: fmt(cur) };

    case 'Yesterday': {
      const y = shifted(-1);
      return { from: fmt(y), to: fmt(y) };
    }

    // today−7, not today−6. See the quirk note above.
    case '7':
      return { from: fmt(shifted(-7)), to: fmt(cur) };

    case '30':
      return { from: fmt(shifted(-30)), to: fmt(cur) };

    case 'month':
      return {
        from: fmt(
          new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1)),
        ),
        to: fmt(cur),
      };

    // Indian FY: April → March. Before April, the FY started last year.
    case 'FY': {
      const fyYear =
        cur.getUTCMonth() < 3 ? cur.getUTCFullYear() - 1 : cur.getUTCFullYear();
      return { from: `${fyYear}-04-01`, to: fmt(cur) };
    }

    default:
      return null;
  }
}

/** Today in IST as YYYY-MM-DD — stops a custom range running into the future. */
export const todayIST = () => fmt(istNow());

const initial = () => ({ preset: 'Today', ...rangeFor('Today') });

const scopeSlice = createSlice({
  name: 'scope',
  initialState: initial(),
  reducers: {
    setPreset(state, action) {
      const preset = action.payload;
      state.preset = preset;
      const r = rangeFor(preset);
      // Custom returns null — the dates stay put until the picker commits a
      // range, so the screen doesn't blank while the modal is open.
      if (r) {
        state.from = r.from;
        state.to = r.to;
      }
    },
    setCustomRange(state, action) {
      const { from, to } = action.payload || {};
      if (!from || !to) return;
      // Swap an inverted range rather than sending it. An inverted BETWEEN
      // returns zero rows from every model, which reads as "no data" instead
      // of "bad input".
      state.from = from <= to ? from : to;
      state.to = from <= to ? to : from;
      state.preset = 'Custom';
    },
  },
});

export const { setPreset, setCustomRange } = scopeSlice.actions;

/** The label on the header chip. */
export const scopeLabel = scope => {
  if (!scope) return 'Today';
  if (scope.preset !== 'Custom') {
    return SCOPE_OPTIONS.find(o => o.value === scope.preset)?.label || 'Today';
  }
  return scope.from === scope.to ? scope.from : `${scope.from} → ${scope.to}`;
};

export default scopeSlice.reducer;
