/* eslint-disable prettier/prettier */
// src/api/overview.js
// ─────────────────────────────────────────────────────────────────────────────
// The two calls the redesigned home makes, and the selectors that turn their
// payloads into the exact strings the UI renders.
//
// Why the selectors live here and not in the screens: HomeScreen and
// SectionScreen need the SAME derived numbers (a tile says "₹78,400 today", the
// Lab section says "Revenue ₹78,400"). Deriving them twice is how two screens
// end up disagreeing.
//
// EVERY derivation is documented with its source. If a number cannot be derived
// from what the backend returns, the selector returns null and the component
// drops that card — it never renders a dash on a revenue screen.
// ─────────────────────────────────────────────────────────────────────────────

import { get } from './client';
import { dec1, inr, num } from '../design/tokens';
import { fetchSection } from './sections';

/** GET /hms/Dashboard — unchanged, the same call AdminHome has always made. */
export const fetchDashboard = (location, from, to) =>
  get('/Dashboard', { location, from, to });

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
    fetchSection('leads', location, from, to, null),
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
    { label: 'IPD', value: n(dashboard?.ipd_count), route: 'IPDBillDetails' },
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

/** The one-line stat under each department tile on the home grid. */
export function selectTileStat(sectionId, data) {
  const m = selectSectionMetrics(sectionId, data);
  switch (sectionId) {
    case 'opd':
      return m.newPatients ? `${m.newPatients} new today` : null;
    case 'ipd':
      return m.admissions ? `${m.admissions} admissions` : null;
    case 'lab':
    case 'pharmacy':
      return m.revenue ? `${m.revenue} today` : null;
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
  sulekha: 'PartnerLeads',
  hexa: 'PartnerLeads',
};
export const selectLeadsFunnel = leads => {
  const channels = leads?.channels || [];
  if (!channels.length) return null;
  const t = leads.totals || {};
  return {
    rows: channels.map(c => ({
      key: c.key,
      label: c.label,
      route: LEAD_ROUTES[c.key] || null,
      // Both partner sources land on the same screen, so the source tab is
      // preselected — otherwise tapping Aggregator opens a list showing
      // Sulekha too, and the count would not match the row you tapped.
      params:
        c.key === 'hexa'
          ? { sourceFilter: 'Hexa' }
          : c.key === 'sulekha'
          ? { sourceFilter: 'Sulekha' }
          : null,
      leads: num(c.total),
      appointment: num(c.appointment),
      visited: num(c.visited),
      ipd: num(c.ipd),
      conversionPct:
        c.total > 0 ? Math.round((c.appointment / c.total) * 100) : null,
    })),
    foot: {
      label: 'ALL',
      leads: num(t.total),
      appointment: num(t.appointment),
      visited: num(t.visited),
      ipd: num(t.ipd),
    },
    // Visits are counted inside the window only, so conversion understates
    // near the end of a range — the same caveat the Leads section carries.
    note: 'Conversion is appointments as a share of leads. Visits are counted within the selected period.',
  };
};

export default { fetchHome, fetchDashboard, fetchCollection };
