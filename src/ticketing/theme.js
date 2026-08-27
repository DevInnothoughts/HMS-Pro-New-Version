/* eslint-disable prettier/prettier */
// theme.js
// ─────────────────────────────────────────────────────────────────────────────
// Design tokens lifted straight from the two approved mockups. Nothing here is
// invented — every value traces back to a line of their CSS, so the app matches
// what was signed off.
//
//   Ticket screens  ← hhc_branch_admin_website.html   (:root, .card, .metric, …)
//   Drawer / header ← hhc_hms_mobile_ecosystem.html   (.drawer, .navItem, .menuBtn)
//
// Two notes on the port:
//
//  1. The mockups carry slightly different greens (#0b6b4b on the ticket portal,
//     #0f6b3c on the ecosystem shell). Both are kept, each used where its own
//     mockup used it. They are a hair apart and nobody will see a seam.
//
//  2. The mockups run on the browser's system font. This app ships Lexend and
//     uses it everywhere else, so the ticket screens use Lexend too — one app
//     with two typefaces would look more wrong than a faithful CSS port. CSS
//     weights of 850/900 have no Lexend cut, so they map to SemiBold, the
//     heaviest weight this project registers.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet } from 'react-native';

// ─── Palette ─────────────────────────────────────────────────────────────────
export const C = {
  // hhc_branch_admin_website.html :root
  green: '#0b6b4b',
  green2: '#0e8f65',
  // The mockup's header is linear-gradient(135deg, green, #073e2d). It renders
  // as solid `green` — see the note on S.header. This is the gradient's end
  // stop, kept for whoever wires up react-native-linear-gradient.
  greenDeep: '#073e2d',
  bg: '#f6f8f7',
  card: '#ffffff',
  text: '#1f2a2e',
  muted: '#6d7b80',
  red: '#d94141',
  orange: '#df8a28',
  blue: '#3478f6',
  line: '#e4e9e6',

  // hhc_hms_mobile_ecosystem.html :root — drawer + app header
  drawerGreen: '#0f6b3c',
  drawerDark: '#113629',
  drawerLine: '#e6eee8',
  drawerMuted: '#6b7b73',
  drawerNavBg: '#fbfffc',
  drawerCardBg: '#f5fbf7', // .card inside the drawer
  drawerOverlay: 'rgba(5,20,12,0.32)',

  // badge fills (.critical/.high/.medium/.low/.overdue)
  critBg: '#ffe8e8',
  highBg: '#fff1df',
  medBg: '#eaf1ff',
  lowBg: '#edf7ef',
  overdueBg: '#ffeeee',
  badgeBg: '#f0f4f2',
  badgeText: '#3c4d45',

  chipText: '#3b4b50',
  progressTrack: '#edf1ef',
  navActiveBg: '#eaf5ef',
  toastBg: '#10251d',
  white: '#ffffff',
};

// ─── Type ────────────────────────────────────────────────────────────────────
// Falls back to the system font if Lexend isn't registered — which is exactly
// what the mockups used, so either way it looks right.
export const F = {
  regular: 'Lexend-Regular',
  medium: 'Lexend-Medium',
  semibold: 'Lexend-SemiBold',
};

// ─── Priority + status colour maps ───────────────────────────────────────────
export const PRIORITY_STYLE = {
  Critical: { bg: C.critBg, fg: C.red },
  Medium: { bg: C.medBg, fg: C.blue },
  Low: { bg: C.lowBg, fg: C.green2 },
};

// Every status the workflow can be in, coloured by who is being waited on.
// Red = stuck with someone, amber = in flight, green = done, grey = neutral.
export const STATUS_STYLE = {
  // display words — what the list, filter bar and cards show
  'In progress': { bg: C.medBg, fg: C.blue },
  Overdue: { bg: C.overdueBg, fg: C.red },
  'Sent back': { bg: C.highBg, fg: C.orange },

  // engine statuses — what the timeline and detail screen name
  Open: { bg: C.highBg, fg: C.orange },
  // Amber, not red. Being asked to rethink a request is not a failure, and
  // colouring it like one makes every Cluster Head reluctant to use it.
  'Sent Back': { bg: C.highBg, fg: C.orange },
  Approved: { bg: C.medBg, fg: C.blue },
  'In Progress': { bg: C.medBg, fg: C.blue },
  'On Hold': { bg: C.highBg, fg: C.orange },
  // Blue: work in flight, same as In Progress. Amber: waiting on someone —
  // here, the Cluster Head.
  'With Branch': { bg: C.medBg, fg: C.blue },
  'Branch Fixed': { bg: C.highBg, fg: C.orange },
  Resolved: { bg: C.lowBg, fg: C.green2 },
  Closed: { bg: C.badgeBg, fg: C.badgeText },
  Reopened: { bg: C.critBg, fg: C.red },
  // Blue like In Progress: somebody is holding it. Amber for Pending Approval:
  // waiting on a person, same as Branch Fixed.
  Assigned: { bg: C.medBg, fg: C.blue },
  'Pending Approval': { bg: C.highBg, fg: C.orange },
};

/**
 * Plain-English "who is this sitting with" line. The status word alone tells a
 * Partner nothing about whether they need to do something; this does.
 */
export const STATUS_HINT = {
  Open: 'Waiting for your Cluster Head to approve it',
  'Sent Back': 'Your Cluster Head has sent this back to be reconsidered',
  Approved: 'With the department head',
  'In Progress': 'The department is working on it now',
  'On Hold': 'Blocked — the department has paused this one',
  'With Branch': 'Your branch is fixing this one locally',
  'Branch Fixed': 'Fixed at the branch — your Cluster Head is reviewing it',
  // Correct for BOTH paths now that the branch closes either one — which is why
  // this map, which cannot see local_fix, is no longer lying about half of them.
  Resolved: 'Fixed — check it and close it, or reopen it',
  Closed: 'Closed',
  Reopened: 'Reopened — back with the department',
  Assigned: 'The department has put someone on it',
  // NOT "resolved". The work is claimed done; the department has not agreed
  // yet, and saying resolved early is how a ticket gets reopened on day one.
  'Pending Approval': 'Fixed — the department head is reviewing it',
};

export const PRIORITIES = ['Critical', 'Medium', 'Low'];

export const ALL_STATUSES = [
  'Open',
  'Sent Back',
  'Approved',
  'In Progress',
  'Waiting for Vendor',
  'With Branch',
  'Branch Fixed',
  'Resolved',
  'Closed',
  'Reopened',
];

// ─── Shared styles ───────────────────────────────────────────────────────────
export const S = StyleSheet.create({
  // main{padding:14px} + body background
  screen: { flex: 1, backgroundColor: C.bg },
  main: { padding: 14, paddingBottom: 28 },

  // header{padding:20px 18px 18px;border-bottom-*-radius:28px}
  //
  // The mockup's linear-gradient(135deg,#0b6b4b,#073e2d) is rendered as a solid
  // instead. A gradient here has to be a child element (SVG or a gradient lib),
  // and on Android a native child is NOT clipped by the parent's borderRadius —
  // the fill spills past the rounded corners. backgroundColor on the View is
  // clipped correctly on both platforms, every time. See docs/INTEGRATION.md if
  // you want the gradient back via react-native-linear-gradient.
  header: {
    backgroundColor: C.green,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    // box-shadow:0 10px 30px rgba(5,50,35,.18)
    shadowColor: '#053223',
    shadowOpacity: 0.18,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // .top{display:flex;justify-content:space-between;align-items:center;gap:12px}
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // .logo{font-weight:850;font-size:18px;letter-spacing:.3px}
  headerLogo: {
    fontFamily: F.semibold,
    fontSize: 18,
    letterSpacing: 0.3,
    color: C.white,
    flexShrink: 1,
  },
  // .pill{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25)}
  headerPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  headerPillText: { fontFamily: F.medium, fontSize: 12, color: C.white },
  // h1{font-size:23px;margin:18px 0 6px;line-height:1.15}
  h1: {
    fontFamily: F.semibold,
    fontSize: 23,
    lineHeight: 27,
    color: C.white,
    marginTop: 18,
    marginBottom: 6,
  },
  // .sub{opacity:.85;font-size:13px;line-height:1.4}
  sub: {
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 18,
    color: C.white,
    opacity: 0.85,
  },

  // .card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:15px;margin:12px 0}
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    padding: 15,
    marginVertical: 12,
    shadowColor: '#1e372d',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  // .grid2{grid-template-columns:1fr 1fr;gap:10px}
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  grid2Item: { width: '48.4%' },

  // .metric{border-radius:18px;padding:14px;text-align:left}
  metric: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 14,
  },
  metricNum: {
    fontFamily: F.semibold,
    fontSize: 25,
    marginBottom: 4,
    color: C.text,
  },
  metricLabel: { fontFamily: F.medium, fontSize: 12, color: C.muted },

  // .split{display:flex;justify-content:space-between;align-items:center}
  split: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  // .tiny{font-size:11px;color:var(--muted);line-height:1.45}
  tiny: { fontFamily: F.regular, fontSize: 11, lineHeight: 16, color: C.muted },
  bold: { fontFamily: F.semibold, fontSize: 15, color: C.text },

  // .progress + .bar
  progress: {
    height: 8,
    backgroundColor: C.progressTrack,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bar: { height: '100%', backgroundColor: C.green, borderRadius: 999 },

  // label{font-size:12px;color:var(--muted);font-weight:850;margin:12px 0 6px}
  label: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: C.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  // select,input,textarea{border:1px solid var(--line);border-radius:14px;padding:13px 12px}
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: C.white,
    fontFamily: F.regular,
    fontSize: 14,
    color: C.text,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  inputText: { fontFamily: F.regular, fontSize: 14, color: C.text },
  placeholder: { color: C.muted },

  // .row{display:flex;gap:10px}.row>*{flex:1}
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1 },

  // .btn
  btn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: C.green,
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  btnText: { fontFamily: F.semibold, fontSize: 14, color: C.white },
  // .btn.secondary
  btnSecondary: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnSecondaryText: { color: C.green },
  // .btn.small{width:auto;padding:9px 11px;border-radius:12px;margin:0;font-size:12px}
  btnSmall: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 12,
    marginTop: 0,
  },
  btnSmallText: { fontSize: 12 },
  btnDisabled: { opacity: 0.45 },
  btnDanger: { backgroundColor: C.red, shadowColor: C.red },

  // .filterbar{display:flex;gap:8px;overflow:auto;padding:3px 0 8px}
  filterbar: { paddingTop: 3, paddingBottom: 8 },
  filterbarContent: { gap: 8, alignItems: 'center', paddingRight: 14 },
  // .chip
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipText: { fontFamily: F.semibold, fontSize: 12, color: C.chipText },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipTextActive: { color: C.white },

  // .list-title{display:flex;justify-content:space-between;margin:16px 2px 8px}
  listTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 2,
    marginBottom: 8,
  },
  listTitleText: { fontFamily: F.semibold, fontSize: 15, color: C.text },

  // Breakdown table (Location-wise / Department Pressure). The header row is
  // fixed; the body scrolls beneath it — see BreakdownList.
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  breakdownHead: {
    borderBottomWidth: 1.5,
    borderBottomColor: C.text,
    backgroundColor: C.card,
  },
  breakdownHeadText: { fontFamily: F.semibold, fontSize: 12, color: C.muted },
  // The WIDTH lives here, not on the value style, so the header cell and the
  // body cell are laid out by the same rule. Putting it on one and not the
  // other is what made the heading sit over the wrong column.
  // Wide enough for the longest heading it carries ("Positions" ≈ 65px at the
  // header size). At 52 that heading wrapped onto a second line and pushed the
  // header row out of shape — which reads as broken styling, not a tight column.
  breakdownNumCol: { width: 78, textAlign: 'right' },
  breakdownName: { fontFamily: F.regular, fontSize: 14, color: C.text },
  breakdownOpen: { fontFamily: F.semibold, fontSize: 14, color: C.text },
  breakdownOverdueCol: { width: 64, textAlign: 'right' },
  breakdownOverdueOn: { fontFamily: F.semibold, fontSize: 14, color: C.red },
  breakdownOverdueOff: { fontFamily: F.regular, fontSize: 14, color: C.muted },

  // .ticket-head / .id / .title / .meta
  ticketHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ticketId: { fontFamily: F.medium, fontSize: 12, color: C.muted },
  ticketTitle: {
    fontFamily: F.semibold,
    fontSize: 15,
    color: C.text,
    marginVertical: 4,
  },
  ticketMeta: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },

  // .badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: C.badgeBg,
  },
  badgeText: { fontFamily: F.semibold, fontSize: 11, color: C.badgeText },

  // .empty{text-align:center;color:var(--muted);padding:24px 10px;font-size:13px}
  empty: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 10 },
  emptyText: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 19,
  },

  // nav{...} — bottom tab bar
  nav: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 9,
    paddingTop: 9,
    paddingBottom: 9,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 14,
    alignItems: 'center',
  },
  navBtnActive: { backgroundColor: C.navActiveBg },
  navText: { fontFamily: F.semibold, fontSize: 12, color: C.muted },
  navTextActive: { color: C.green },

  // .toast
  toast: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 116,
    backgroundColor: C.toastBg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 15,
  },
  toastText: {
    fontFamily: F.medium,
    fontSize: 13,
    color: C.white,
    textAlign: 'center',
  },
});
