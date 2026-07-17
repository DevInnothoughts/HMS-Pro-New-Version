/* eslint-disable prettier/prettier */
// ServiceTicketConstants.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared reference data + tiny helpers for the Service Ticketing screens.
// The category list here MUST match the backend (serviceTicketModel.CATEGORIES).
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

// Same backend base the rest of the app uses.
export const BACKEND_URL = 'https://wedoc.in/hms';

// ── Palette (aligned with AdminHome Colors) ──────────────────────────────────
export const C = {
  primary: '#3B6D11',
  secondary: '#BA7517',
  bg: '#F4F6F4',
  card: '#FFFFFF',
  border: 'rgba(0,0,0,0.08)',
  textDark: '#18181A',
  textMed: '#6B6A68',
  textLight: '#A09F9C',
  success: '#0D6644',
  info: '#185FA5',
  warning: '#EF9F27',
  error: '#E24B4A',
  purple: '#7A1B78',
};

// ── The 17 categories (code + label + an icon from MaterialIcons) ─────────────
export const CATEGORIES = [
  {
    code: 'MEDICAL_EQUIPMENT',
    label: 'Medical Equipment',
    icon: 'medical-services',
  },
  { code: 'IT_INFRASTRUCTURE', label: 'IT Infrastructure', icon: 'dns' },
  {
    code: 'SOFTWARE_DIGITAL',
    label: 'Software & Digital Assets',
    icon: 'apps',
  },
  { code: 'ELECTRICAL', label: 'Electrical Assets', icon: 'bolt' },
  { code: 'FURNITURE_FIXTURES', label: 'Furniture & Fixtures', icon: 'chair' },
  {
    code: 'OT_CLINICAL_FURNITURE',
    label: 'OT & Clinical Furniture',
    icon: 'airline-seat-flat',
  },
  {
    code: 'HOUSEKEEPING',
    label: 'Housekeeping Assets',
    icon: 'cleaning-services',
  },
  { code: 'PANTRY_CAFETERIA', label: 'Pantry & Cafeteria', icon: 'restaurant' },
  {
    code: 'LINEN_SOFT_FURNISHING',
    label: 'Linen & Soft Furnishings',
    icon: 'dry-cleaning',
  },
  { code: 'BRANDING_SIGNAGE', label: 'Branding & Signages', icon: 'campaign' },
  {
    code: 'SAFETY_FIRE',
    label: 'Safety & Fire',
    icon: 'local-fire-department',
  },
  { code: 'PHARMACY_ASSETS', label: 'Pharmacy Assets', icon: 'local-pharmacy' },
  { code: 'UTILITY_ASSETS', label: 'Utility Assets', icon: 'plumbing' },
  { code: 'OFFICE_EQUIPMENT', label: 'Office Equipment', icon: 'print' },
  { code: 'INTERIOR_ASSETS', label: 'Interior Assets', icon: 'weekend' },
  { code: 'BIOMEDICAL_ASSET', label: 'Biomedical Asset', icon: 'biotech' },
  {
    code: 'MISCELLANEOUS',
    label: 'Miscellaneous (Others)',
    icon: 'more-horiz',
  },
];
export const categoryLabel = code =>
  (CATEGORIES.find(c => c.code === code) || {}).label || code;

// ── Priority ─────────────────────────────────────────────────────────────────
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const PRIORITY_META = {
  Low: { color: C.info, sla: '120h' },
  Medium: { color: C.secondary, sla: '72h' },
  High: { color: C.warning, sla: '24h' },
  Critical: { color: C.error, sla: '4h' },
};

// ── Status ───────────────────────────────────────────────────────────────────
export const STATUS_META = {
  RAISED: { label: 'Awaiting Cluster Head', short: 'Raised', color: C.warning },
  CLUSTER_APPROVED: {
    label: 'Awaiting HO Action',
    short: 'Approved',
    color: C.info,
  },
  HO_ACTION_SUBMITTED: {
    label: 'Awaiting Partner Closure',
    short: 'Actioned',
    color: C.purple,
  },
  REOPENED: {
    label: 'Reopened — with HO',
    short: 'Reopened',
    color: C.secondary,
  },
  CLOSED: { label: 'Closed', short: 'Closed', color: C.success },
  REJECTED: { label: 'Rejected', short: 'Rejected', color: C.error },
};
export const statusMeta = s =>
  STATUS_META[s] || { label: s, short: s, color: C.textMed };

export const SLA_STATE_META = {
  OnTrack: { label: 'On track', color: C.success },
  DueSoon: { label: 'Due soon', color: C.warning },
  Breached: { label: 'SLA breached', color: C.error },
  NA: { label: '', color: C.textLight },
};

// ── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = {
  PARTNER: 'Partner',
  CLUSTER: 'Cluster Head',
  HO: 'HO User',
  SUPERADMIN: 'SuperAdmin',
};

// This app stores partners with subRole === 'Owner'. Normalise everything to a
// single canonical ticketing role.
export const normaliseRole = (role, subRole) => {
  if (role === ROLES.SUPERADMIN) return ROLES.SUPERADMIN;
  const sr = String(subRole || role || '')
    .trim()
    .toLowerCase();
  if (sr === 'owner' || sr === 'partner') return ROLES.PARTNER;
  if (sr === 'cluster head') return ROLES.CLUSTER;
  if (sr === 'ho user' || sr === 'head office' || sr === 'ho') return ROLES.HO;
  return String(subRole || role || '').trim();
};

// Who may open the Service Ticketing section at all.
export const canUseServiceTicketing = (role, subRole) => {
  const r = normaliseRole(role, subRole);
  return [ROLES.SUPERADMIN, ROLES.PARTNER, ROLES.CLUSTER, ROLES.HO].includes(r);
};

// Only Partners (or SuperAdmin) can raise.
export const canRaise = (role, subRole) => {
  const r = normaliseRole(role, subRole);
  return r === ROLES.PARTNER || r === ROLES.SUPERADMIN;
};

// Given a ticket + the viewer's role, which stage action (if any) can they take?
// Returns { action, label } or null.
export const availableAction = (ticket, role, subRole, mobile) => {
  const r = normaliseRole(role, subRole);
  const s = ticket.status;
  const raisedByMe = ticket.raisedBy && ticket.raisedBy.mobile === mobile;

  if (r === ROLES.CLUSTER || r === ROLES.SUPERADMIN) {
    if (s === 'RAISED')
      return { approve: 'CLUSTER_APPROVED', reject: 'CLUSTER_REJECTED' };
  }
  if (r === ROLES.HO || r === ROLES.SUPERADMIN) {
    if (s === 'CLUSTER_APPROVED' || s === 'REOPENED')
      return { action: 'HO_ACTION_SUBMITTED' };
  }
  if (r === ROLES.PARTNER || r === ROLES.SUPERADMIN) {
    if (s === 'HO_ACTION_SUBMITTED' && (raisedByMe || r === ROLES.SUPERADMIN))
      return { close: 'CLOSED', reopen: 'REOPENED' };
  }
  return null;
};

// ── Actor identity ───────────────────────────────────────────────────────────
// The signed-in user's mobile is in AsyncStorage (as elsewhere in the app); we
// pull name + email from their Firestore user doc so notifications can reach the
// right people without asking the user to type anything.
export const resolveActor = async (role, subRole) => {
  const mobile = await AsyncStorage.getItem('mobile');
  let name = null;
  let email = null;
  try {
    if (mobile) {
      const doc = await firestore().collection('users').doc(mobile).get();
      const d = doc.data() || {};
      name = d.name || d.fullName || null;
      email = d.email || null;
    }
  } catch (e) {
    // Non-fatal: we can still record the mobile + role.
    console.log('resolveActor firestore error:', e.message);
  }
  return {
    actorMobile: mobile,
    actorName: name,
    actorEmail: email,
    actorRole: normaliseRole(role, subRole),
    actorSubRole: subRole || '',
  };
};

// ── Formatting ───────────────────────────────────────────────────────────────
export const fmtDateTime = v => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const fmtDuration = seconds => {
  if (seconds == null) return '—';
  const s = Number(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  const days = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${days}d ${hr}h` : `${days}d`;
};
