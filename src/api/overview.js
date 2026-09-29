/* eslint-disable prettier/prettier */
// src/api/overview.js
// ─────────────────────────────────────────────────────────────────────────────
// The two calls the redesigned home makes, and the selectors that turn their
// payloads into the exact strings the UI renders.
//
// Why the selectors live here and not in the screens: HomeScreen and
// SectionScreen need the SAME derived numbers (a tile says "₹78,400", the
// Lab section says "Revenue ₹78,400"). Deriving them twice is how two screens
// end up disagreeing.
//
// EVERY derivation is documented with its source. If a number cannot be derived
// from what the backend returns, the selector returns null and the component
// drops that card — it never renders a dash on a revenue screen.
// ─────────────────────────────────────────────────────────────────────────────

import { get } from './client';
import { dec1, inr, num } from '../design/tokens';

/** GET /hms/Dashboard — unchanged, the same call AdminHome has always made. */
export const fetchDashboard = (location, from, to) =>
  get('/Dashboard', { location, from, to });

/** GET /hms/overview/leadCounts — Home's Leads card: source + count only. */
export const fetchLeadCounts = (location, from, to) =>
  get('/overview/leadCounts', { location, from, to });

/** GET /hms/overview/collection — the one new endpoint. */
export const fetchCollection = (location, from, to) =>
  get('/overview/collection', { location, from, to });

/**
 * Both, settled independently. A collection failure must not blank the counts,
 * and a Dashboard failure must not blank the collection bar — the two halves of
 * this screen fail separately because they come from separate queries.
 */
export async function fetchHome(location, from, to) {
  const [d, c, l] = await Promise.allSettled([
    fetchDashboard(location, from, to),
    fetchCollection(location, from, to),
    fetchLeadCounts(location, from, to),
  ]);
  return {
    dashboard: d.status === 'fulfilled' ? d.value : null,
    collection: c.status === 'fulfilled' ? c.value : null,
    leads: l.status === 'fulfilled' ? l.value : null,
    dashboardError: d.status === 'rejected' ? d.reason?.message : null,
    collectionError: c.status === 'rejected' ? c.reason?.message : null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const n = v => (Number.isFinite(Number(v)) ? Number(v) : null);

const deptAmount = (collection, key) =>
  collection?.byDept?.find(d => d.key === key)?.amount ?? null;

/** Avg = amount / count, but only when both exist and count > 0. */
const avg = (amount, count) =>
  amount != null && count != null && count > 0 ? amount / count : null;

// ─── Home selectors ──────────────────────────────────────────────────────────

/**
 * The hero band: total patients served since opening, and the branch NPS.
 * Source: /Dashboard totalPatients, nps_avg.
 */
export const selectHero = ({ dashboard }) => ({
  patientsServed: n(dashboard?.totalPatients),
  npsAvg: n(dashboard?.nps_avg) ?? 0,
});

/**
 * The two approval pips. /Dashboard returns approvalStatus[0].{user1,user2} —
 * user1 is the Partner/Owner, user2 the Cluster Head. That mapping is
 * AdminHome's, kept identical so the two homes agree during the transition.
 */
export const selectApprovals = ({ dashboard }) => {
  const row = dashboard?.approvalStatus?.[0];
  return {
    partner: row?.user1 ? 'Done' : 'Pending',
    clusterHead: row?.user2 ? 'Done' : 'Pending',
  };
};

/**
 * "Today at a glance" — three cells.
 *
 * The prototype's sub-notes ("8 awaiting check-in", "31 beds in use",
 * "2 pending clearance") are NOT rendered: bed occupancy is not modelled
 * anywhere in the schema and there is no check-in state to read. They return
 * when there is something real behind them.
 */
export const selectToday = ({ dashboard }) =>
  [
    {
      label: 'Appointments',
      value: n(dashboard?.appointment_count),
      route: 'AppointmentDetails',
    },
    {
      label: 'IPD',
      value: n(dashboard?.ipd_count),
      route: 'IPDBillDetails',
      // Interbranch cases operated here are not in ipd_count — see ibCount.
      note:
        ibCount(dashboard) > 0
          ? `+${num(ibCount(dashboard))} interbranch excl.`
          : undefined,
    },
    // {
    //   label: 'Discharges',
    //   value: n(dashboard?.dc_count),
    //   route: 'DischargeCardDetails',
    // },
  ]
    .filter(c => c.value != null)
    .map(c => ({ ...c, value: num(c.value) }));

/** The stacked collection bar + legend. Colours come from HUE via the screen. */
export const selectCollection = ({ collection }) => {
  if (!collection) return null;
  return {
    total: inr(collection.total),
    rows: (collection.byDept || []).map(d => ({
      key: d.key,
      label: d.label,
      pct: d.pct,
      amount: inr(d.amount),
      // Average per patient, except pharmacy, which is per invoice — a walk-in
      // buyer often has no patient record, so per-patient is not a number that
      // exists there. `countBasis` says which the backend used.
      note:
        d.avg == null
          ? '—'
          : `${inr(d.avg)}/${d.countBasis === 'invoices' ? 'inv' : 'pt'}`,
      // IPD revenue excludes interbranch invoices (they count at the source
      // branch); a line under the row says how much, so the figure explains
      // itself. Rendered by Legend when present.
      sub:
        d.key === 'ipd' && d.interbranch?.count > 0
          ? `Excl. ${inr(d.interbranch.amount)} · ${num(
              d.interbranch.count,
            )} interbranch (counted at source branch)`
          : undefined,
    })),
  };
};

/**
 * IVR / Helpline calls.
 * "Callback" maps to attended_missed_count — a missed call someone has since
 * noted or actioned, which is the nearest thing the schema has to a callback.
 * Flag it at review if the business reads that word differently.
 */
export const selectCalls = ({ dashboard }) => {
  const d = dashboard || {};
  // `actioned` is a SUBSET of missed — missed calls that have a note — so it
  // must never be added into the total or drawn as its own stack segment.
  // AdminHome's pie has Missed+Ans for IVR and Missed+Out+Ans for helpline,
  // and that is the arithmetic the dashboard counts agree with.
  const build = (answered, missed, actioned, outgoing) => {
    const a = n(answered) ?? 0;
    const m = n(missed) ?? 0;
    const o = outgoing === undefined ? null : n(outgoing) ?? 0;
    return {
      answered: a,
      missed: m,
      actioned: n(actioned) ?? 0,
      outgoing: o,
      total: a + m + (o ?? 0),
    };
  };
  return {
    ivr: build(d.answered_count, d.missed_count, d.attended_missed_count),
    helpline: build(
      d.helpline_answered_count,
      d.helpline_missed_count,
      d.helpline_attended_missed_count,
      d.helpline_outgoing_count,
    ),
  };
};

// ─── Section selectors ───────────────────────────────────────────────────────
// Keys returned here MUST match the metric keys in sections.config.js.
// A key absent from the returned object means that card is not rendered.

export function selectSectionMetrics(sectionId, { dashboard, collection }) {
  const opd = deptAmount(collection, 'opd');
  const ipd = deptAmount(collection, 'ipd');
  const lab = deptAmount(collection, 'lab');
  const pharmacy = deptAmount(collection, 'pharmacy');

  // Divisors. Both are the counts /Dashboard already returns, so the averages
  // shown here agree with the counts shown beside them.
  //   appointment_count → every appointment in the range
  //   ipd_count         → invoice rows in the range (= "No. of SX" elsewhere)
  const opdCount = n(dashboard?.appointment_count);
  const ipdCount = n(dashboard?.ipd_count);

  const fmt = {
    inr: v => (v == null ? null : inr(v)),
    num: v => (v == null ? null : num(v)),
    dec1: v => (v == null ? null : dec1(v)),
  };

  switch (sectionId) {
    case 'opd':
      return clean({
        newPatients: fmt.num(n(dashboard?.dailyOPDReport?.new)),
        revenue: fmt.inr(opd),
        avgPerPatient: fmt.inr(avg(opd, opdCount)),
      });

    case 'ipd':
      return clean({
        admissions: fmt.num(ipdCount),
        revenue: fmt.inr(ipd),
        avgPerPatient: fmt.inr(avg(ipd, ipdCount)),
      });

    case 'lab':
      return clean({ revenue: fmt.inr(lab) });

    case 'pharmacy':
      return clean({ revenue: fmt.inr(pharmacy) });

    case 'leads': {
      const handled =
        (n(dashboard?.answered_count) ?? 0) +
        (n(dashboard?.helpline_answered_count) ?? 0);
      const missed =
        (n(dashboard?.missed_count) ?? 0) +
        (n(dashboard?.helpline_missed_count) ?? 0);
      return clean({
        callsHandled: fmt.num(handled),
        callsMissed: fmt.num(missed),
      });
    }

    case 'performance':
      return clean({
        npsAvg: fmt.dec1(n(dashboard?.nps_avg) ?? 0),
        patientsServed: fmt.num(n(dashboard?.totalPatients)),
      });

    case 'reports':
      return clean({
        opdIpdCollection:
          opd != null && ipd != null ? fmt.inr(opd + ipd) : null,
        totalCollection: fmt.inr(n(collection?.total)),
      });

    default:
      return {};
  }
}

/** Drop null entries so a missing source removes the card rather than blanking it. */
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}

/**
 * Interbranch invoices operated at this branch for another branch are NOT in
 * the IPD count or IPD revenue (they count at the source branch). These lines
 * say so beside the figure, so a lower number doesn't read as lost business.
 * Source: /Dashboard ipd_interbranch_count.
 */
const ibCount = dashboard => n(dashboard?.ipd_interbranch_count) ?? 0;

/**
 * The one-line stat under each department tile on the home grid.
 * No "today" suffix — the figures follow the selected date range, not just today.
 */
export function selectTileStat(sectionId, data) {
  const m = selectSectionMetrics(sectionId, data);
  switch (sectionId) {
    case 'opd':
      return m.newPatients ? `${m.newPatients} new` : null;
    case 'ipd':
      if (!m.admissions) return null;
      return ibCount(data?.dashboard) > 0
        ? `${m.admissions} admissions · ${num(
            ibCount(data.dashboard),
          )} IB excl.`
        : `${m.admissions} admissions`;
    case 'lab':
    case 'pharmacy':
      return m.revenue ? `${m.revenue}` : null;
    case 'leads':
      return m.callsHandled ? `${m.callsHandled} calls handled` : null;
    case 'performance':
      return m.npsAvg != null ? `NPS ${m.npsAvg}` : null;
    case 'reports':
      return m.totalCollection ? `${m.totalCollection} collected` : null;
    default:
      return null;
  }
}

/** Home's leads block. Reuses the section endpoint — one definition of the funnel. */

// Which page each source opens. Keys are the channel keys leadsModel returns.
//
// IVR has no lead LIST — leadsStatsModel counts IVR calls as leads, but the
// only screen behind them is the call log, which is the right destination
// anyway: an IVR lead IS a call.
const LEAD_ROUTES = {
  web: 'WebLeads',
  chatbot: 'BotLeads',
  ivr: 'IVRCall',
  webcall: 'WebCallLeads',
  aggregator: 'PartnerLeads',
  sulekha: 'PartnerLeads',
  hexa: 'PartnerLeads',
};
// The five sources, always shown in this order — matches CHANNELS in the
// backend's overview/leadsModel.js. Used as the fallback when a source is
// missing from the response (or the call failed), so the card keeps its shape.
const LEAD_SOURCES = [
  { key: 'ivr', label: 'IVR' },
  { key: 'web', label: 'Website' },
  { key: 'chatbot', label: 'Chatbot' },
  { key: 'webcall', label: 'Web call' },
  { key: 'aggregator', label: 'Aggregator' },
];

/**
 * Home's Leads card: source name + lead count, nothing else.
 * `counts` is GET /overview/leadCounts. A missing response shows '—' rather
 * than 0, so a failed call never reads as "no leads".
 */
export const selectLeadSources = counts => {
  const byKey = {};
  for (const c of counts?.channels || []) byKey[c.key] = c;
  return {
    rows: LEAD_SOURCES.map(src => {
      const c = byKey[src.key];
      return {
        key: src.key,
        label: c?.label || src.label,
        count: c ? num(c.total) : '—',
        route: LEAD_ROUTES[src.key] || null,
        params: null,
      };
    }),
    total: counts ? num(counts.total) : '—',
  };
};

export default { fetchHome, fetchDashboard, fetchCollection };
