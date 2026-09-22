/* eslint-disable prettier/prettier */
// src/design/tokens.js
// ─────────────────────────────────────────────────────────────────────────────
// One palette for the redesigned shell. Every value is a direct port of a line
// in hhc-hms-ui-revision-2.html — nothing invented, so the app matches what was
// signed off.
//
// Relationship to src/ticketing/theme.js:
//   theme.js came from the two EARLIER mockups and still owns the ticketing and
//   recruitment screens. It is not deleted and not edited in this release —
//   those screens keep their look. This file is the palette for the new home,
//   the seven section screens and the tab bar. Once the shell has shipped and
//   settled, theme.js should re-export from here so there is one palette; doing
//   that now would restyle two live modules in the middle of a 4-day build.
//
// Typeface: the prototype uses IBM Plex Sans + IBM Plex Mono. This release
// ships Lexend, which is what the app already registers. Registering a second
// family costs a rebuild cycle on both platforms and buys nothing structural —
// the mono numerals are a week-2 refinement. MONO below is therefore Lexend
// today and is the ONE constant to change when Plex Mono is added.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Palette (:root) ─────────────────────────────────────────────────────────
export const T = {
  ink: '#0F1A16', // --ink       still used by chart axes and the temp export
  // The home header ground. Was `ink` (near-black), which read as heavy behind
  // the target cards. Deep brand green keeps the cards legible in white while
  // tying the header to the section palette.
  //
  // Alternatives if this is still not right — change here only:
  //   '#173A2C'  softer forest, less saturated
  //   '#1C2B33'  slate blue-grey, neutral rather than branded
  //   '#243028'  warm charcoal, closest to the original without the weight
  headerBg: '#14603F',
  headerTile: '#1A6E49', // was '#17241F'
  headerTileLine: '#2E8462', // was '#2C3B34'
  headerMuted: '#9FCBB6', // was '#7E9A8D'
  heroFrom: '#176944',
  heroLine: '#2E8462',
  canvas: '#F3F5F3', // --canvas    screen background
  card: '#FFFFFF', // --card
  line: '#E3E8E4', // --line      card borders
  lineSoft: '#EEF2EF', // --line-soft row dividers, track fills
  text: '#16211D', // --text
  muted: '#6C7C75', // --muted
  muted2: '#8A968F', // --muted-2   eyebrows, secondary numerals
  brand: '#14603F', // --brand     links, FAB, active tab
  pos: '#1E7A5A', // --pos       up-deltas, answered calls
  crit: '#B3382B', // --crit      down-deltas, missed calls
  white: '#FFFFFF',

  // Header interior (.icon-btn, .scope, .hero-side)
  headerSub: '#8FA79B',

  // .hero-main gradient stops — rendered as a solid `heroFrom` unless
  // react-native-linear-gradient is wired up.
  heroTo: '#123024',
  heroGold: '#F2C879', // .hero-side .hero-val (NPS)

  // .live pill
  live: '#63C79A',

  // .appr — the approval pips
  apprBg: '#1E1614',
  apprLine: '#4A2C26',
  apprText: '#F0B5A8',
  apprLabel: '#B08A80',
  apprPip: '#D2624B',

  // .dt-head / .dt-foot / .row:hover
  subtle: '#FAFBFA',
  chevron: '#C3CCC7',
  callbackGrey: '#D8DEDA', // third segment of the calls stack
  soonIcon: '#F1F4F2',
  soonIconText: '#A9B4AE',
};

// ─── Per-section hue (const HUE) ─────────────────────────────────────────────
// Drives the tile spine, the tile icon tint, the section header background and
// every bar inside that section. Keys match sections.config.js ids.
export const HUE = {
  opd: '#2F6FA8',
  ipd: '#B3523B',
  lab: '#6E5AA8',
  pharmacy: '#1E7A5A',
  leads: '#2A7F8C',
  performance: '#4A6B2F',
  reports: '#59636F',
};

// const tint = h => h + '14'  — 8% alpha, used for icon backgrounds.
export const tint = hex => `${hex}14`;

// ─── Type ────────────────────────────────────────────────────────────────────
// Falls back to the system font if Lexend isn't registered.
export const F = {
  regular: 'Lexend-Regular',
  medium: 'Lexend-Medium',
  semibold: 'Lexend-SemiBold',
  // Numerals. Swap to 'IBMPlexMono-Medium' when the family is added — every
  // number in the new UI reads from here, so it is a one-line change.
  mono: 'Lexend-Medium',
};

// ─── Spacing / radius ────────────────────────────────────────────────────────
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 26 };
export const R = { sm: 9, md: 11, card: 14, pill: 999 };

// ─── Number formatting ───────────────────────────────────────────────────────
// The prototype prints ₹8,37,200 — Indian lakh grouping, not thousands. Every
// currency string in the new UI goes through here; no screen formats its own.
export const inr = n => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const neg = v < 0;
  const [whole] = Math.abs(Math.round(v)).toString().split('.');
  // last three digits, then pairs
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`
    : last3;
  return `${neg ? '−' : ''}₹${grouped}`;
};

// Plain counts: 1,17,576
export const num = n => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return inr(v).replace('₹', '');
};

// One decimal, for NPS and percentages.
export const dec1 = n => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(1) : '—';
};

export const pct = (part, total) => {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t === 0) return 0;
  return Math.round((p / t) * 100);
};

/**
 * Indian compact notation — ₹1.24Cr, ₹8.60L, ₹4.2K.
 *
 * For headline figures only. The full `inr()` stays everywhere a number gets
 * reconciled against a report: ₹1.24Cr and ₹1,24,38,500 are not the same claim,
 * and rounding a figure someone is checking against a ledger is worse than a
 * long string.
 *
 * Two decimals for Cr and L because one is too coarse — ₹1.2Cr covers a range
 * of twelve lakh.
 */
export const inrCompact = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

export default { T, HUE, tint, F, SP, R, inr, num, dec1, pct };
