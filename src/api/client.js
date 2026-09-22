/* eslint-disable prettier/prettier */
// src/api/client.js
// ─────────────────────────────────────────────────────────────────────────────
// One place that knows the backend base URL, one place that turns a failed
// response into a sentence a person can read.
//
// Today `const BACKEND_URL = 'http://10.0.0.30:5100/hms'` is re-declared in roughly
// twenty files. Nothing here rewrites those — the legacy screens keep working
// untouched. New code imports from this file, and screens can migrate later
// one at a time.
//
// The `headers()` hook exists for a reason: the backend has no auth today
// (identity travels as actorMobile / actorRole in the query or body). When a
// signed token arrives, it gets injected in ONE place rather than in twenty.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'http://10.0.0.30:5100/hms';

const DEFAULT_TIMEOUT = 20000;

/**
 * Identity headers. A no-op today beyond the caller's mobile, which the server
 * ignores — it is here so the wiring exists before it is needed.
 */
async function authHeaders() {
  try {
    const mobile = await AsyncStorage.getItem('mobile');
    return mobile ? { 'X-HHC-Mobile': mobile } : {};
  } catch (_) {
    return {};
  }
}

function qs(params = {}) {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return s ? `?${s}` : '';
}

/**
 * The server sends a readable message on 4xx (see the controllers' `send`
 * helper). Surface that, because it goes straight in front of the user. Only
 * fall back to a generic line when there is genuinely nothing to show.
 */
async function toError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    /* not JSON — fall through */
  }
  const msg =
    body?.error ||
    body?.message ||
    (res.status >= 500
      ? 'The server had a problem. Pull to refresh to try again.'
      : 'That request could not be completed.');
  const err = new Error(msg);
  err.status = res.status;
  return err;
}

async function request(path, { method = 'GET', params, body, timeout } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeout || DEFAULT_TIMEOUT,
  );

  try {
    const res = await fetch(`${BASE_URL}${path}${qs(params)}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) throw await toError(res);
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('The request timed out. Pull to refresh.');
      err.status = 408;
      throw err;
    }
    if (e.status) throw e;
    // Network-level failure — no response at all.
    const err = new Error('No connection. Check your network and try again.');
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const get = (path, params, opts) =>
  request(path, { ...opts, method: 'GET', params });

export const post = (path, body, opts) =>
  request(path, { ...opts, method: 'POST', body });

export default { BASE_URL, get, post };
