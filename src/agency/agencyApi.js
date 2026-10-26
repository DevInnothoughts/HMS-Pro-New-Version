/* eslint-disable prettier/prettier */
// src/agency/agencyApi.js
// ─────────────────────────────────────────────────────────────────────────────
// The Ad Agency login's data: GOOGLE leads only (utm_source google /
// google_ads), Web · Bot · Web call only — NO IVR. The server drops everything
// else before it answers (HMS_backend agencyGoogleLeadsModel.js), so nothing
// here has to filter.
//
//   GET /agencyLeads/stats?from&to&locations   campaign / search-term stats
//   GET /agencyLeads/leads?location&from&to    one branch's unique leads
//   GET /agencyLeads/trend?location            MoM / YoY, last three FYs
//
// The pure helpers (viewOf, stageOf, bucketOf, sumBuckets) are the internal
// screen's, imported unchanged, so a lead is unique / booked / visited the
// same way on both screens.
// ─────────────────────────────────────────────────────────────────────────────

import { get } from '../api/client';
import { cached, fetchedAt } from '../api/queryCache';
import {
  ALL,
  CHANNELS,
  bucketOf,
  stageOf,
  sumBuckets,
  viewOf,
} from '../adAgency/channels';

export { ALL, bucketOf, stageOf, sumBuckets, viewOf };

/** Web, Bot, Web call — IVR is never shown to the agency. */
export const AGENCY_CHANNELS = CHANNELS.filter(c => c.key !== 'ivr').map(c =>
  c.key === 'web' ? { ...c, label: 'Website', short: 'Web' } : c,
);

export const channelOf = key =>
  AGENCY_CHANNELS.find(c => c.key === key) || {
    ...ALL,
    label: 'All Google leads',
  };

// The two ways to group the dashboard table.
export const GROUPS = [
  { key: 'campaigns', label: 'Campaigns', head: 'CAMPAIGN', icon: 'campaign' },
  { key: 'conditions', label: 'Search terms', head: 'TERM', icon: 'search' },
];

const TIMEOUT = 90000;

/**
 * GET with a readable 404. The shared client turns a 4xx with no JSON body
 * into "That request could not be completed." — for these endpoints a 404
 * means the server is running a backend without /hms/agencyLeads (the new
 * agencyLeadsController / app.js not deployed or the server not restarted),
 * so say exactly that.
 */
async function agencyGet(path, params) {
  try {
    return await get(path, params, { timeout: TIMEOUT });
  } catch (e) {
    if (e?.status === 404) {
      const err = new Error(
        `The server does not have ${path} yet (404). Deploy the updated HMS backend and restart it.`,
      );
      err.status = 404;
      throw err;
    }
    throw e;
  }
}

// ─── STORED ON THE PHONE ──────────────────────────────────────────────────────
// Both reads go through api/queryCache (the same cache as Branch Summary): the
// answer is saved in AsyncStorage, so opening the screen — even after the app
// was closed — shows the last figures with NO server call. Only pull-to-refresh
// (force: true) asks the server again. A range never read before is fetched
// once. A failed read is never stored. Logout clears it (common/logout.js).
//
// `scopeKey` is queryCache.rangeKey(scope): 'This Month' keeps one key for the
// whole month (a new month gets a new key), a custom range keys by its dates.
// Each call returns { data, updatedAt } so the screen can say how old it is.

const keyRange = (scopeKey, from, to) => scopeKey || `${from}|${to}`;

/**
 * All branches. The agency is not limited to assigned branches, so no branch
 * list is sent (the server then reads every branch). `locations` narrows it
 * only if a caller passes one.
 */
export async function fetchAgencyStats({
  from,
  to,
  locations,
  scopeKey,
  force = false,
}) {
  const locs = locations && locations.length ? locations.join(',') : undefined;
  const key = `/agencyLeads/stats|${keyRange(scopeKey, from, to)}|${
    locs || 'ALL'
  }`;
  const data = await cached(
    key,
    async () => {
      const json = await agencyGet('/agencyLeads/stats', {
        from,
        to,
        locations: locs,
      });
      if (!json?.success)
        throw new Error(json?.error || 'Could not load statistics');
      return json.data; // { branches, campaignNames }
    },
    { force },
  );
  return { data, updatedAt: fetchedAt(key) };
}

export async function fetchAgencyBranchLeads({
  location,
  from,
  to,
  scopeKey,
  force = false,
}) {
  const key = `/agencyLeads/leads|${location}|${keyRange(scopeKey, from, to)}`;
  const data = await cached(
    key,
    async () => {
      const json = await agencyGet('/agencyLeads/leads', {
        location,
        from,
        to,
      });
      if (!json?.success)
        throw new Error(json?.error || 'Could not load leads');
      return json.data;
    },
    { force },
  );
  return { data, updatedAt: fetchedAt(key) };
}

const todayKey = () =>
  new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

/** One read per branch per day — the trend does not follow the date scope. */
export async function fetchAgencyTrend(location, { force = false } = {}) {
  return cached(
    `/agencyLeads/trend|${location}|${todayKey()}`,
    async () => {
      const json = await agencyGet('/agencyLeads/trend', { location });
      if (!json?.success)
        throw new Error(json?.error || 'Could not load the trend');
      return json.data;
    },
    { force },
  );
}

/** Campaign id → what to show. */
export const campaignLabel = (id, names = {}) =>
  id === '(not tagged)' ? 'Not tagged' : names[id] || id;
