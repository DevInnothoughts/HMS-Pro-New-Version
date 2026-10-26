/* eslint-disable prettier/prettier */
// src/leadStats/leadStatsApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Data for the internal LEAD STATS REPORT (Leads & Calls → route 'leadsStats',
// src/adAgency/AdAgencyHome.js in internal mode). Three tabs:
//
//   All leads      GET /leadsStats/v2/all      Web · Bot · Web call · IVR
//   Google leads   GET /agencyLeads/stats      utm_source google / google_ads,
//   Search terms     (same response)           no IVR — the AD AGENCY endpoint
//                                              (locked), read here unchanged
//
// Both reads are scoped to THIS LOGIN'S branches — the branch list is always
// sent, and the screen never calls with an empty one (the agency endpoint
// would then read every branch).
//
// ─── STORED ON THE PHONE ──────────────────────────────────────────────────────
// Every read goes through api/queryCache, exactly like the agency screen:
// saved in AsyncStorage, shown again with NO server call — even after the app
// is closed — until the user pulls to refresh (force: true). A range never
// read before is fetched once; a failed read is never stored; logout clears
// it. `scopeKey` = queryCache.rangeKey(scope) (This Month → one key per month).
// Each call returns { data, updatedAt }.
// ─────────────────────────────────────────────────────────────────────────────

import { get } from '../api/client';
import { cached, fetchedAt } from '../api/queryCache';
import { CHANNELS } from '../adAgency/channels';

const TIMEOUT = 90000;

/** Sources that can carry Google UTM data — IVR never does. */
export const GOOGLE_CHANNELS = CHANNELS.filter(c => c.key !== 'ivr');

const keyRange = (scopeKey, from, to) => scopeKey || `${from}|${to}`;

/** Never call the all-branch endpoints without this login's branch list. */
function branchList(locations) {
  const locs = (locations || []).filter(Boolean).join(',');
  if (!locs) throw new Error('No branches are assigned to this login.');
  return locs;
}

async function read(key, path, params, force, what) {
  const data = await cached(
    key,
    async () => {
      let json;
      try {
        json = await get(path, params, { timeout: TIMEOUT });
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
      if (!json?.success)
        throw new Error(json?.error || `Could not load ${what}`);
      return json.data;
    },
    { force },
  );
  return { data, updatedAt: fetchedAt(key) };
}

/** All leads, branch-wise → [{ location, web, chatbot, webcall, ivr, combined, … }] */
export async function fetchAllStats({
  from,
  to,
  locations,
  scopeKey,
  force = false,
}) {
  const locs = branchList(locations);
  return read(
    `/leadsStats/v2/all|${keyRange(scopeKey, from, to)}|${locs}`,
    '/leadsStats/v2/all',
    { from, to, locations: locs },
    force,
    'statistics',
  );
}

/** Google leads, branch-wise, with conditions / terms → { branches, campaignNames } */
export async function fetchGoogleStats({
  from,
  to,
  locations,
  scopeKey,
  force = false,
}) {
  const locs = branchList(locations);
  return read(
    // Its own prefix: the agency screen keys the same endpoint by ALL
    // branches, this one by the login's branches — never the same answer.
    `/leadStats/google|${keyRange(scopeKey, from, to)}|${locs}`,
    '/agencyLeads/stats',
    { from, to, locations: locs },
    force,
    'Google statistics',
  );
}

/** One branch's leads (all sources) — the All leads tab's branch page. */
export function fetchAllBranchLeads({
  location,
  from,
  to,
  scopeKey,
  force = false,
}) {
  return read(
    `/leadsStats/v2/leads|${location}|${keyRange(scopeKey, from, to)}`,
    '/leadsStats/v2/leads',
    { location, from, to },
    force,
    'leads',
  );
}
