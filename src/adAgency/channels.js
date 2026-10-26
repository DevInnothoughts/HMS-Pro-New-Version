/* eslint-disable prettier/prettier */
// src/adAgency/channels.js
// ─────────────────────────────────────────────────────────────────────────────
// The four lead sources the Ad Agency screen shows, in one place so the
// dashboard, the branch list and the Excel export can never disagree on a
// label, a colour or the order.
//
// Hues come from the redesign palette (design/tokens.js HUE) — no new colours.
// Keys match the backend: GET /leadsStats/v2/all and /v2/leads.
// ─────────────────────────────────────────────────────────────────────────────

import { get } from '../api/client';
import { HUE, T } from '../design/tokens';

export const CHANNELS = [
  {
    key: 'web',
    label: 'Website',
    short: 'Web',
    hue: HUE.opd,
    icon: 'language',
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    short: 'Bot',
    hue: HUE.lab,
    icon: 'smart-toy',
  },
  {
    key: 'webcall',
    label: 'Web call',
    short: 'Web call',
    hue: HUE.leads,
    icon: 'phone-callback',
  },
  { key: 'ivr', label: 'IVR', short: 'IVR', hue: HUE.ipd, icon: 'headset-mic' },
];

export const ALL = {
  key: 'combined',
  label: 'All sources',
  short: 'All',
  hue: T.brand,
  icon: 'campaign',
};

export const channelOf = key => CHANNELS.find(c => c.key === key) || ALL;

// Bucket fields from /v2/all. `total` is UNIQUE leads (one per phone);
// `entries` is raw rows; `duplicates` = entries − total.
const FIELDS = [
  'total',
  'entries',
  'duplicates',
  'appointment',
  'actualVisitCount',
  'ipd',
  'notBooked',
  'crossSource',
];
const empty = () => FIELDS.reduce((a, f) => ({ ...a, [f]: 0 }), {});

/** One branch's bucket for a mode ('combined' | 'web' | …). */
export const bucketOf = (stat, mode) => (stat && stat[mode]) || empty();

export const sumBuckets = (stats, mode) =>
  (stats || []).reduce((a, s) => {
    const b = bucketOf(s, mode);
    FIELDS.forEach(f => {
      a[f] += Number(b[f]) || 0;
    });
    return a;
  }, empty());

/**
 * A unique lead as seen from one source tab. In 'combined' it is the person
 * across every source; under a source it carries that source's own
 * de-duplicated entries and stage (booked / visited / IPD), so the tab's
 * counts match the stats for that source. Returns null if the person never
 * came through that source.
 */
export const viewOf = (lead, source) => {
  if (source === 'combined' || !source) return lead;
  const p = lead.perSource?.[source];
  if (!p) return null;
  // Inside a source tab the kept lead is the latest in THAT source.
  return {
    ...lead,
    ...p,
    treatment: p.treatment || null,
    source,
    sources: [source],
  };
};

// Forty branch databases on a long range can take a while — the v1 screen had
// no timeout at all, so allow a generous one rather than cutting it off.
const TIMEOUT = 90000;

/** Branch-wise funnel. `locations` = the agency's assigned branches, if any. */
export async function fetchAgencyStats({ from, to, locations }) {
  const json = await get(
    '/leadsStats/v2/all',
    {
      from,
      to,
      locations:
        locations && locations.length ? locations.join(',') : undefined,
    },
    { timeout: TIMEOUT },
  );
  if (!json?.success)
    throw new Error(json?.error || 'Could not load statistics');
  return json.data || [];
}

/** One branch's unique-lead list. Phone numbers arrive already masked. */
export async function fetchBranchLeads({ location, from, to }) {
  const json = await get(
    '/leadsStats/v2/leads',
    { location, from, to },
    { timeout: TIMEOUT },
  );
  if (!json?.success) throw new Error(json?.error || 'Could not load leads');
  return json.data;
}

/** The one status shown on a lead row, furthest funnel stage first. */
export const stageOf = lead => {
  if (lead.ipd) return { label: 'IPD', color: T.brand };
  if (lead.visited) return { label: 'Visited', color: T.pos };
  if (lead.booked) return { label: 'Booked', color: HUE.leads };
  const s = String(lead.status || '').toLowerCase();
  if (s.includes('miss')) return { label: 'Missed', color: T.crit };
  if (s.includes('not interested') || s.includes('lost')) {
    return { label: lead.status, color: T.crit };
  }
  return { label: lead.status || 'New', color: T.muted };
};
