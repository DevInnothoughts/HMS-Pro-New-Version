/* eslint-disable prettier/prettier */
// src/api/queryCache.js
// ─────────────────────────────────────────────────────────────────────────────
// A cache for the heavy all-branch reads: Branch Summary, Target Analysis and
// Branch Trend. Each makes the server read every branch database in turn, so
// a screen shows what it last fetched and the server is asked again ONLY when
// the user pulls to refresh.
//
//   await hydrate();                       // once, before the first peek
//   const hit = await peekAsync(key);      // stored answer, or undefined
//   const data = await cached(key, fetcher, { force });
//
// RULES
// ─────
// • SAVED ON THE PHONE (AsyncStorage). Closing the app and opening it again
//   shows the last figures — no server call. Each entry is its own storage
//   item (`qc:<key>`), so one large answer never hits Android's per-item
//   size limit, plus a small index (`qc:index`).
// • NO AUTOMATIC EXPIRY. An answer stays until pull-to-refresh (`force`)
//   replaces it. Screens show "Updated <when>" so its age is always visible.
// • A range nobody has read yet (a new custom date, a branch never opened)
//   has nothing stored, so that first read does go to the server.
// • Two requests for the same key at once share ONE request.
// • A failed request is never stored.
// • At most MAX_ENTRIES answers are kept; the least recently fetched goes.
// • clearAll() on logout, so the next user starts clean.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'qc:';
const INDEX_KEY = 'qc:index';
const MAX_ENTRIES = 60;

const store = new Map(); // key → { at, value }   (Map order = oldest first)
const inflight = new Map(); // key → Promise

/* ── persistence ──────────────────────────────────────────────────────────── */

let hydrating = null;

/**
 * Load the stored answers into memory — once per app launch; every later call
 * returns the same promise. A storage failure leaves an empty cache (the
 * screen then simply fetches), never an error.
 */
export function hydrate() {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      const index = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(index) || !index.length) return;
      const pairs = await AsyncStorage.multiGet(index.map(k => PREFIX + k));
      for (const [k, v] of pairs) {
        if (!v) continue;
        try {
          const entry = JSON.parse(v);
          if (entry && entry.at) store.set(k.slice(PREFIX.length), entry);
        } catch (_) {
          // A corrupt entry is dropped, not fatal.
        }
      }
    } catch (e) {
      console.log('queryCache: could not read stored data', e?.message);
    }
  })();
  return hydrating;
}

const saveIndex = () =>
  AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...store.keys()])).catch(
    () => {},
  );

function persist(key, entry, dropped) {
  // Fire and forget: the screen never waits on storage.
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry))
    .then(() =>
      dropped.length
        ? AsyncStorage.multiRemove(dropped.map(k => PREFIX + k))
        : null,
    )
    .then(saveIndex)
    .catch(e => console.log('queryCache: could not save', e?.message));
}

/* ── reads ───────────────────────────────────────────────────────────────── */

/** The stored value for `key`, or undefined. Synchronous: call hydrate() first. */
export function peek(key) {
  const hit = store.get(key);
  return hit ? hit.value : undefined;
}

/** Like peek, but waits for the stored answers to load first. */
export async function peekAsync(key) {
  await hydrate();
  return peek(key);
}

/** When `key` was last fetched (ms since epoch), or null. */
export function fetchedAt(key) {
  const hit = store.get(key);
  return hit ? hit.at : null;
}

/* ── fetch ───────────────────────────────────────────────────────────────── */

/**
 * The stored value for `key`, or run `fetcher` and store its result.
 * opts: { force } — true (pull-to-refresh) always goes to the server.
 */
export async function cached(key, fetcher, opts = {}) {
  const { force = false } = opts;
  await hydrate();

  if (!force) {
    const hit = peek(key);
    if (hit !== undefined) return hit;
  }
  // A refresh while the same read is already running joins it.
  if (inflight.has(key)) return inflight.get(key);

  const p = Promise.resolve()
    .then(fetcher)
    .then(value => {
      const entry = { at: Date.now(), value };
      store.delete(key); // re-insert so Map order = least recently fetched first
      store.set(key, entry);
      const dropped = [];
      while (store.size > MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        store.delete(oldest);
        dropped.push(oldest);
      }
      persist(key, entry, dropped);
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/* ── range keys ───────────────────────────────────────────────────────────── */

/**
 * The part of a cache key that names a date scope (redux `scope`).
 *
 * A rolling preset ends on TODAY, so keying it by its exact dates would give
 * a new key every day — and a server call on the first open of each day.
 * Instead a rolling range is keyed by what it MEANS:
 *   'month' / 'FY' / 'Today' / 'Yesterday'  preset + its start date — the same
 *       key all month (all year, all day); a new month gets a new key, so
 *       September's figures are never shown as "This Month" in October
 *   '7' / '30'      the preset alone — a rolling window, shown with its age
 *   Custom ranges   their exact dates — they never move
 */
export function rangeKey(scope) {
  const { preset, from, to } = scope || {};
  if (preset === '7' || preset === '30') return `p:${preset}`;
  if (preset === 'Custom' || preset === 'CustomMonth' || !preset) {
    return `${from}|${to}`;
  }
  return `p:${preset}|${from}`;
}

/* ── clearing ─────────────────────────────────────────────────────────────── */

/** Drop every entry whose key starts with `prefix`, in memory and on the phone. */
export async function invalidate(prefix = '') {
  await hydrate();
  const gone = [...store.keys()].filter(k => k.startsWith(prefix));
  gone.forEach(k => store.delete(k));
  if (!gone.length) return;
  try {
    await AsyncStorage.multiRemove(gone.map(k => PREFIX + k));
    await saveIndex();
  } catch (_) {}
}

/** Everything — on logout, so the next user never sees these figures. */
export const clearAll = () => invalidate('');

/* ── label ───────────────────────────────────────────────────────────────── */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * "Updated 10:42" today, "Updated yesterday 18:05", else "Updated 11 Oct
 * 18:05" — stored figures can be days old, and the label must say so.
 */
export function updatedLabel(at) {
  if (!at) return '';
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  const day = x =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  if (diff === 0) return `Updated ${time}`;
  if (diff === 1) return `Updated yesterday ${time}`;
  return `Updated ${d.getDate()} ${MONTHS[d.getMonth()]} ${time}`;
}

export default {
  hydrate,
  cached,
  peek,
  peekAsync,
  fetchedAt,
  invalidate,
  clearAll,
  updatedLabel,
};
