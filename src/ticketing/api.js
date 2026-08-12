/* eslint-disable prettier/prettier */
// api.js
// ─────────────────────────────────────────────────────────────────────────────
// Talks to /hms/ticketing.
//
// Identity: every call carries who is making it — actorMobile / actorName /
// actorRole / actorSubRole, plus branch context. That is the same shape the
// existing /hms/approval endpoint uses (it posts `user` and `subRole`), so
// nothing new is introduced here.
//
// The name isn't in AsyncStorage at login, so it is read once from the
// Firestore user doc and cached. That keeps the login screens untouched — no
// migration needed for people already signed in.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

// Same base the rest of the app uses.
const BACKEND_URL = 'https://wedoc.in/hms';
const BASE = `${BACKEND_URL}/ticketing`;

const NAME_KEY = 'ticketing:userName';

let cachedName = null;

/** The signed-in person's display name. Cached; falls back to their number. */
export async function getUserName(mobile) {
  if (cachedName) return cachedName;
  try {
    const stored = await AsyncStorage.getItem(NAME_KEY);
    if (stored) {
      cachedName = stored;
      return stored;
    }
  } catch (_) {
    /* AsyncStorage unavailable — fall through to Firestore */
  }
  try {
    const doc = await firestore().collection('users').doc(mobile).get();
    const name = doc?.data()?.name;
    if (name) {
      cachedName = name;
      AsyncStorage.setItem(NAME_KEY, name).catch(() => {});
      return name;
    }
  } catch (e) {
    console.log('ticketing: could not read user name', e?.message);
  }
  return mobile;
}

/** Clear the cached name — call from logout. */
export async function clearUserCache() {
  cachedName = null;
  try {
    await AsyncStorage.removeItem(NAME_KEY);
  } catch (_) {
    /* nothing to clear */
  }
}

/**
 * Build the actor payload from Redux state + the stored mobile.
 * `redux` is { role, subRole, location, locationArray } off state.location.
 */
export async function buildActor(redux = {}) {
  const mobile = (await AsyncStorage.getItem('mobile')) || '';
  const name = await getUserName(mobile);
  const branches = Array.isArray(redux.locationArray)
    ? redux.locationArray
    : [];
  return {
    actorMobile: mobile,
    actorName: name,
    actorRole: redux.role || '',
    actorSubRole: redux.subRole || '',
    branch: redux.location || '',
    branches: branches.join(','),
  };
}

function qs(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * One fetch wrapper for the module.
 * The server sends a readable sentence on 4xx; surface that rather than a
 * status code, because it goes straight in front of the user.
 */
async function call(method, path, { query, body } = {}) {
  const url =
    query && Object.keys(query).length
      ? `${BASE}${path}?${qs(query)}`
      : `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(
      "Can't reach the server. Check your connection and try again.",
    );
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { error: text };
  }

  if (!res.ok) {
    throw new Error(data?.error || `Something went wrong (${res.status}).`);
  }
  return data;
}

// ─── Reference data ──────────────────────────────────────────────────────────
let metaCache = null;

/** Departments, issue types per department, priorities, statuses. */
export async function getMeta({ refresh = false } = {}) {
  if (metaCache && !refresh) return metaCache;
  metaCache = await call('GET', '/meta');
  return metaCache;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────
export async function fetchDashboard(actor) {
  return call('GET', '/dashboard', { query: actor });
}

export async function fetchTickets(actor, filters = {}) {
  // The actor carries a `branch` (its own location/context). The list's branch
  // FILTER is a separate thing — only what the user picked in the FilterBar or a
  // breakdown row. They must not be conflated: for a Department Head the actor's
  // branch is their DEPARTMENT, and letting that reach the branch filter matched
  // zero rows (dashboard showed counts, list came back empty). So the user's
  // chosen branch goes out under a dedicated `filterBranch` key, and the filter
  // object's own `branch` is renamed rather than sent raw.
  const { branch: chosenBranch, ...restFilters } = filters;
  const query = { ...actor, ...restFilters };
  if (chosenBranch) query.filterBranch = chosenBranch;
  return call('GET', '/tickets', { query });
}

export async function fetchTicket(actor, id) {
  return call('GET', `/tickets/${encodeURIComponent(id)}`, { query: actor });
}

/**
 * The current user's own email, from their Firestore user doc. Used as the
 * raiser email on a ticket so they can be notified when it's rejected, resolved,
 * or reopened. Returns '' if unavailable — the backend simply won't email them.
 */
export async function getMyEmail() {
  try {
    const mobile = (await AsyncStorage.getItem('mobile')) || '';
    if (!mobile) return '';
    const doc = await firestore().collection('users').doc(mobile).get();
    return doc?.data()?.email || '';
  } catch (e) {
    console.log('ticketing: could not read my email', e?.message);
    return '';
  }
}

/**
 * The email of the Cluster Head who approves a given branch. Cluster Heads live
 * in Firestore (not the ticket roster), so this looks up the users collection
 * for a Cluster Head whose locations include this branch, and returns their
 * email. Passed to the backend at raise time so the approver can be notified —
 * the backend can't resolve this itself (it never touches Firestore).
 *
 * Returns '' if none is found; the backend then skips the approval email. If
 * your Firestore shape differs (e.g. the field isn't `locations` or the subRole
 * label differs), adjust the query here.
 */
export async function getClusterHeadEmailForBranch(branch) {
  if (!branch) return '';
  try {
    const snap = await firestore()
      .collection('users')
      .where('subRole', '==', 'Cluster Head')
      .get();
    let fallback = '';
    for (const doc of snap.docs) {
      const d = doc.data() || {};
      if (!d.email) continue;
      const locs = Array.isArray(d.locationArray)
        ? d.locationArray
        : Array.isArray(d.locations)
        ? d.locations
        : d.location
        ? [d.location]
        : [];
      if (locs.includes(branch)) return d.email; // the CH for this branch
      if (!fallback) fallback = d.email; // any CH, if none matches exactly
    }
    return fallback;
  } catch (e) {
    console.log('ticketing: could not find cluster head email', e?.message);
    return '';
  }
}

export async function raiseTicket(actor, payload) {
  return call('POST', '/tickets', { body: { ...actor, ...payload } });
}

/**
 * Fire a workflow action. `action` is one of the keys the server returns in
 * ticket.actions — the button list is built from that, so the two can't drift.
 */
const ACTION_PATH = {
  approve: 'approve',
  reconsider: 'reconsider',
  sendToBranch: 'send-to-branch',
  fixedLocally: 'fixed-locally',
  resolveLocal: 'resolve-local',
  closeLocal: 'close-local',
  progress: 'progress',
  reassign: 'reassign',
  forward: 'forward',
  resolve: 'resolve',
  close: 'close',
  reopen: 'reopen',
  comment: 'comment',
};

export async function actOnTicket(actor, id, action, payload = {}) {
  const path = ACTION_PATH[action];
  if (!path) throw new Error(`Unknown action "${action}".`);
  return call('POST', `/tickets/${encodeURIComponent(id)}/${path}`, {
    body: { ...actor, ...payload },
  });
}

// ─── Admin-panel onboarding ──────────────────────────────────────────────────
// Called from AddUserForm when the subRole is Department Head or Department User.
// AddUserForm writes the Firestore login; these write the matching ticket_user
// row, which is where the server reads the person's department from.
//
// No actor is required — this is the admin user-management screen (see the note
// in ticketUserModel.upsertRosterUser). `department` comes from the picker the
// form shows once a ticketing subRole is chosen.

/** Create or update the roster row for a Head / Department User. */
export async function upsertRosterUser({
  mobile,
  name,
  email,
  department,
  ticketRole,
}) {
  return call('POST', '/roster', {
    body: { mobile, name, email, department, ticketRole },
  });
}

/** Remove the roster row for a mobile (subRole changed away, or user deleted). */
export async function removeRosterUser(mobile) {
  return call('DELETE', '/roster', { query: { mobile } });
}

/** The department list for the picker, from /meta. */
export async function getDepartments() {
  const meta = await getMeta();
  return meta.departments || [];
}

/**
 * Every branch in the company, from the Firestore HHCLocations doc — the same
 * source AddUserForm reads for its location chips. Used to populate the Raise
 * Ticket center dropdown for a SuperAdmin, who has no home branch and so can't
 * rely on their own locationArray covering every center. Returns [] on failure,
 * so the form falls back to whatever branches the login already knows.
 */
export async function getAllBranches() {
  try {
    const snap = await firestore()
      .collection('HHCLocations')
      .doc('HHCLocations')
      .get();
    const data = snap.data();
    if (data && Array.isArray(data.locations)) {
      return [...data.locations]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    return [];
  } catch (e) {
    console.log('ticketing: could not load HHCLocations', e?.message);
    return [];
  }
}

export { BASE as TICKETING_BASE_URL };
