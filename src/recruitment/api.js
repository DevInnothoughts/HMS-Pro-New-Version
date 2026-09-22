// ═══════════════════════════════════════════════════════════════════════════
//  Recruitment API client
//
//  Same shape and conventions as ticketing/api.js — one `call` helper, an actor
//  built from Redux + AsyncStorage, and filters kept strictly out of the actor's
//  namespace. That last point matters: the actor carries a `location`, and if it
//  ever leaked into the list's location FILTER the list would silently come back
//  empty (exactly the bug that bit the ticket list).
// ═══════════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const BACKEND_URL = 'http://10.0.0.30:5100/hms';
const BASE = `${BACKEND_URL}/recruitment`;

function qs(obj = {}) {
  const parts = [];
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

async function call(method, path, { query, body } = {}) {
  const url = `${BASE}${path}${method === 'GET' ? qs(query) : ''}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
  } catch (e) {
    throw new Error('Could not reach the server. Check your connection.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* a non-JSON error page — fall through to the status check */
  }
  if (!res.ok || (data && data.success === false)) {
    throw new Error(
      (data && data.message) || `Request failed (${res.status}).`,
    );
  }
  return data;
}

/** The signed-in person's own email, for notifications on their requisitions. */
async function myEmail(mobile) {
  try {
    if (!mobile) return '';
    const doc = await firestore().collection('users').doc(mobile).get();
    return doc?.data()?.email || '';
  } catch (e) {
    return '';
  }
}

async function myName(mobile) {
  try {
    if (!mobile) return 'User';
    const doc = await firestore().collection('users').doc(mobile).get();
    return doc?.data()?.name || 'User';
  } catch (e) {
    return 'User';
  }
}

/**
 * The actor every call carries. `branches` is what scopes a Cluster Head to
 * their own locations — the server reads it, never trusts a client-side filter.
 */
export async function buildActor(redux = {}) {
  const mobile = (await AsyncStorage.getItem('mobile')) || '';
  const name = await myName(mobile);
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

export function getMeta() {
  return call('GET', '/meta', { query: {} });
}

export function fetchDashboard(actor) {
  return call('GET', '/dashboard', { query: actor });
}

/**
 * The requisition list. A chosen unit goes out as `filterUnit` — deliberately
 * NOT as `unit`, so the actor's own context can never act as a filter.
 */
export function fetchRequests(actor, filters = {}) {
  const { unit: chosenUnit, ...rest } = filters;
  const query = { ...actor, ...rest };
  if (chosenUnit) query.filterUnit = chosenUnit;
  return call('GET', '/requests', { query });
}

export function fetchRequest(actor, id) {
  return call('GET', `/requests/${encodeURIComponent(id)}`, { query: actor });
}

/** Submit the MRF (Cluster Head). */
export async function submitMRF(actor, payload) {
  const raisedByEmail = await myEmail(actor.actorMobile);
  return call('POST', '/requests', {
    body: { ...actor, ...payload, raisedByEmail },
  });
}

/** One door for every workflow action, mirroring the ticket detail screen. */
export function actOnRequest(actor, id, action, payload = {}) {
  return call('POST', `/requests/${encodeURIComponent(id)}/${action}`, {
    body: { ...actor, ...payload },
  });
}

/** The department's people, for the "assign to" picker. */
export function fetchDepartmentUsers(actor) {
  return call('GET', '/users', { query: actor });
}

// ─── Offer letters ───────────────────────────────────────────────────────────
/** Add an offer letter — one per position filled. */
export function addOffer(actor, id, payload) {
  return call('POST', `/requests/${encodeURIComponent(id)}/offers`, {
    body: { ...actor, ...payload },
  });
}

/** Update one letter — normally to record its joining date. */
export function updateOffer(actor, id, offerId, payload) {
  return call('POST', `/requests/${encodeURIComponent(id)}/offers/${offerId}`, {
    body: { ...actor, ...payload },
  });
}

/** Replace a letter that was declined, keeping the original in the history. */
export function replaceOffer(actor, id, offerId, payload) {
  return call(
    'POST',
    `/requests/${encodeURIComponent(id)}/offers/${offerId}/replace`,
    {
      body: { ...actor, ...payload },
    },
  );
}

/** Every branch in the company, for the location picker (SuperAdmin). */
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
    return [];
  }
}
