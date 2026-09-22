/* eslint-disable prettier/prettier */
// src/api/sections.js
// ─────────────────────────────────────────────────────────────────────────────
// Calls and selectors for the per-section endpoints.
//
// A section with no model yet returns 501, which is not an error worth showing:
// the app falls back to the home-derived metrics it already had.
// ─────────────────────────────────────────────────────────────────────────────

import { get } from './client';
import { inr, inrCompact, num } from '../design/tokens';

export const fetchSection = (id, location, from, to, compare = 'prev') =>
  get(`/overview/section/${id}`, { location, from, to, compare });

/* ── OPD ──────────────────────────────────────────────────────────────────── */

// "vs yesterday" only when the range IS one day. On a 7-day range the
// comparison window is the previous 7 days, and calling that "yesterday" would
// be wrong in the spot people read fastest.
const deltaNote = (pct, singleDay) => {
  if (pct == null) return null;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return {
    note: `${sign}${Math.abs(pct)}% vs ${
      singleDay ? 'yesterday' : 'previous period'
    }`,
    dir: pct > 0 ? 'up' : pct < 0 ? 'down' : null,
  };
};

export function opdMetrics(data) {
  if (!data) return [];
  const single = !!data.meta?.singleDay;
  const d = data.deltas || {};
  const g = data.gender;
  const out = [];

  out.push({
    key: 'newPatients',
    label: 'New patients',
    value: num(data.counts.new),
    note: `of ${num(data.counts.seen)} seen`,
  });

  if (g && g.known > 0) {
    out.push({
      key: 'gender',
      label: 'New — M / F',
      value: `${g.male} / ${g.female}`,
      note: `${Math.round((g.male / g.known) * 100)}% / ${Math.round(
        (g.female / g.known) * 100,
      )}% of new`,
    });
  }

  if (data.revenue != null) {
    out.push({
      key: 'revenue',
      label: 'Revenue',
      value: inr(data.revenue),
      ...(deltaNote(d.revenue, single) || {}),
    });
  }

  if (data.avgPerPatient != null) {
    out.push({
      key: 'avgPerPatient',
      label: 'Avg per patient',
      value: inr(data.avgPerPatient),
      ...(deltaNote(d.avgPerPatient, single) || {}),
    });
  }

  return out;
}

// Per-type hues. New is the section blue; the rest step away from it so the
// four cards are distinguishable without a legend.
const VISIT_HUES = {
  new: '#2F6FA8',
  follow: '#3E8C8C',
  postop: '#7A5EA8',
  procto: '#B3762B',
};

const TYPE_HUES = {
  new: '#2F6FA8',
  follow: '#3E8C8C',
  postop: '#7A5EA8',
  procto: '#B3762B',
};

/**
 * The four visit-type cards — count and attributed revenue together.
 *
 * `patientType` values are the ones dashboardModel's switch accepts:
 * 'new' | 'follow' | 'postoperative' | 'proctoscopy'.
 *
 * C+P gets no revenue: it counts BILLED PROCTOSCOPY rows rather than visits,
 * and the revenue query attributes only the three appointment-backed types. A
 * rupee figure on that card would be a number with no definition behind it.
 */
export function opdVisitTypes(data) {
  if (!data) return null;
  const c = data.counts;
  const r = data.revenueByType;

  const money = (amount, count) =>
    amount == null
      ? {}
      : {
          revenue: inr(amount),
          avg: count > 0 ? inr(Math.round(amount / count)) : null,
        };

  const items = [
    {
      key: 'new',
      label: 'New',
      patientType: 'new',
      value: num(c.new),
      hue: TYPE_HUES.new,
      ...money(r?.new, c.new),
    },
    {
      key: 'follow',
      label: 'Follow-up',
      patientType: 'follow',
      value: num(c.follow),
      hue: TYPE_HUES.follow,
      ...money(r?.follow, c.follow),
    },
    {
      key: 'postop',
      label: 'Post-op',
      patientType: 'postoperative',
      value: num(c.postop),
      hue: TYPE_HUES.postop,
      ...money(r?.postop, c.postop),
    },
    {
      key: 'procto',
      label: 'C+P',
      patientType: 'proctoscopy',
      value: num(c.procto),
      unit: 'billed',
      hue: TYPE_HUES.procto,
      note: 'Procedures, not visits',
    },
  ];

  // States what the same-day join could not place, rather than letting the
  // three revenue figures quietly fail to add up to the Revenue card above.
  const gap = r && data.revenue != null ? data.revenue - r.attributed : 0;

  return {
    items,
    note:
      gap > 0
        ? `${inr(gap)} of OPD revenue not attributed to a visit type`
        : null,
  };
}

/** id → { metrics, blocks } so SectionScreen stays generic. */
export const SECTION_SHAPERS = {
  opd: data => ({
    metrics: opdMetrics(data),
    blocks: [
      {
        key: 'visits',
        kind: 'visitTypes',
        label: 'Visit type',
        data: opdVisitTypes(data),
      },
    ],
  }),
  ipd: data => ({
    metrics: ipdMetrics(data),
    blocks: [
      {
        key: 'ptype',
        kind: 'table',
        label: 'Billing type',
        data: ipdPatientTypes(data),
      },
      {
        key: 'surgery',
        kind: 'table',
        label: 'Surgery type',
        data: ipdSurgeries(data),
      },
    ],
  }),
  lab: data => ({
    metrics: labMetrics(data),
    blocks: [
      {
        key: 'subtypes',
        kind: 'ranked',
        label: 'Test-wise revenue',
        data: labSubtypes(data),
      },
    ],
  }),
  pharmacy: data => ({
    metrics: pharmacyMetrics(data),
    blocks: [
      {
        key: 'rx',
        kind: 'breakdown',
        label: 'Prescription conversion',
        data: pharmacyPrescriptions(data),
      },
      {
        key: 'modes',
        kind: 'cards',
        label: 'Payment mode',
        data: pharmacyModes(data),
      },
      {
        key: 'medicines',
        kind: 'ranked',
        label: 'Top medicines',
        data: pharmacyMedicines(data),
        collapsible: true,
      },
    ],
  }),
  leads: data => ({
    metrics: leadsMetrics(data),
    blocks: [
      {
        key: 'sources',
        kind: 'breakdown',
        label: 'Leads by source',
        data: leadsSources(data),
      },
    ],
  }),
  reports: data => ({
    metrics: reportsMetrics(data),
    blocks: [],
  }),
  // Performance has no model of its own — it reuses /overview/feedback, which
  // is the same payload the Patient Feedback page reads. So `data` here is that
  // response, and scoreCounts comes straight off its summary.
  performance: data => ({
    metrics: performanceMetrics(data),
    blocks: [
      {
        key: 'nps',
        kind: 'nps',
        label: 'Patient feedback',
        data: data?.summary?.scoreCounts
          ? {
              counts: data.summary.scoreCounts,
              population: data.summary.operated,
            }
          : null,
      },
    ],
  }),
};

/* eslint-disable prettier/prettier */
// Add to src/api/sections.js
// ─────────────────────────────────────────────────────────────────────────────
// IPD selectors. Paste below the OPD block, then extend SECTION_SHAPERS.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four metric cards.
 *
 * "Admissions" counts INVOICES, matching dashboardModel's ipd_count and so the
 * IPD number on the home screen. The tables below count PATIENTS. When the two
 * differ — a patient billed twice in the window — the card's note says so,
 * rather than leaving someone to discover that 31 and 29 both mean "IPD".
 */
export function ipdMetrics(data) {
  if (!data) return [];
  const single = !!data.meta?.singleDay;
  const d = data.deltas || {};
  const g = data.gender;
  const c = data.counts || {};
  const out = [];

  out.push({
    key: 'admissions',
    label: 'Admissions',
    value: num(c.invoices),
    note:
      c.cases && c.cases !== c.invoices
        ? `${num(c.cases)} patients`
        : 'invoices raised',
  });

  if (g && g.known > 0) {
    out.push({
      key: 'gender',
      label: 'Male / Female',
      value: `${g.male} / ${g.female}`,
      note: `${Math.round((g.male / g.known) * 100)}% / ${Math.round(
        (g.female / g.known) * 100,
      )}%`,
    });
  }

  if (data.revenue != null) {
    out.push({
      key: 'revenue',
      label: 'Revenue',
      value: inr(data.revenue),
      ...(deltaNote(d.revenue, single) || {}),
    });
  }

  if (data.avgPerPatient != null) {
    out.push({
      key: 'avgPerPatient',
      label: 'Avg per patient',
      value: inr(data.avgPerPatient),
      ...(deltaNote(d.avgPerPatient, single) || {}),
    });
  }

  return out;
}

/** Patient type — invoice.status, in the business's own order. */
export function ipdPatientTypes(data) {
  const rows = data?.byStatus || [];
  if (!rows.length) return null;

  const totalPatients = rows.reduce((a, r) => a + r.patients, 0);
  const cases = data.counts?.cases;

  return {
    columns: ['Billing type', 'Pts', 'Avg invoice'],
    rows: rows.map(r => ({
      key: r.key,
      label: r.label,
      count: num(r.patients),
      // Charity bills at zero, and ₹0 is the true answer there — it must read
      // as a figure, not as missing data.
      value: r.avg == null ? '—' : inr(r.avg),
      share: r.patients,
    })),
    foot: {
      label: 'ALL TYPES',
      count: num(totalPatients),
      value: data.avgPerPatient == null ? '—' : inr(data.avgPerPatient),
    },
    // A patient with two invoices of different statuses appears in two rows,
    // so the rows can exceed the case count. Said out loud when it happens.
    note:
      cases != null && totalPatients !== cases
        ? `${num(totalPatients)} type entries across ${num(
            cases,
          )} patients — a patient billed under two statuses appears in both rows.`
        : null,
  };
}

/** Surgery-wise — the patient's latest diagnosis speciality. */
export function ipdSurgeries(data) {
  const rows = data?.surgeries || [];
  if (!rows.length) return null;

  const total = rows.reduce((a, r) => a + r.patients, 0);
  const unspecified = rows.find(r => r.key === 'unspecified');

  return {
    columns: ['Surgery', 'Pts', 'Avg per patient'],
    rows: rows.map(r => ({
      key: r.key,
      label: r.label,
      count: num(r.patients),
      value: r.avg == null ? '—' : inr(r.avg),
      share: r.patients,
    })),
    foot: {
      label: 'ALL SURGERIES',
      count: num(total),
      value: data.avgPerPatient == null ? '—' : inr(data.avgPerPatient),
    },
    // Surgery type comes from the patient's latest diagnosis. Cases with none
    // on record are grouped rather than dropped, so the rows sum to the total —
    // but a large Unspecified row means the diagnosis data is thin, and that is
    // worth knowing before anyone reads the mix as a finding.
    note:
      unspecified && total > 0 && unspecified.patients / total > 0.15
        ? `${num(unspecified.patients)} of ${num(
            total,
          )} cases have no diagnosis on record.`
        : null,
  };
}

// Extend SECTION_SHAPERS with:
//
//   ipd: data => ({
//     metrics: ipdMetrics(data),
//     blocks: [
//       { key: 'ptype', kind: 'table', label: 'Patient type', data: ipdPatientTypes(data) },
//       { key: 'surgery', kind: 'table', label: 'Surgery-wise', data: ipdSurgeries(data) },
//     ],
//   }),

/* eslint-disable prettier/prettier */
// Add to src/api/sections.js
// ─────────────────────────────────────────────────────────────────────────────
// Lab selectors. Paste below the IPD block, then extend SECTION_SHAPERS.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four metric cards.
 *
 * The prototype's "Avg per IPD patient" is NOT here — lab billing lives only in
 * patient_itemreceipt, the OPD table, so there is no IPD lab figure to show.
 * "Avg per test" takes its place: same shape, real source.
 */
export function labMetrics(data) {
  if (!data) return [];
  const single = !!data.meta?.singleDay;
  const d = data.deltas || {};
  const out = [];

  out.push({
    key: 'tests',
    label: 'Tests billed',
    value: num(data.tests),
    note: `across ${num(data.patients)} patients`,
  });

  out.push({
    key: 'revenue',
    label: 'Revenue',
    value: inr(data.revenue),
    ...(deltaNote(d.revenue, single) || {}),
  });

  if (data.avgPerPatient != null) {
    out.push({
      key: 'avgPerPatient',
      label: 'Avg per patient',
      value: inr(data.avgPerPatient),
      ...(deltaNote(d.avgPerPatient, single) || {}),
    });
  }

  if (data.avgPerTest != null) {
    out.push({
      key: 'avgPerTest',
      label: 'Avg per test',
      value: inr(data.avgPerTest),
      note: data.distinctTests ? `${num(data.distinctTests)} test types` : null,
    });
  }

  return out;
}

/**
 * Every lab subtype, largest revenue first.
 *
 * Not truncated to a top five: a branch bills perhaps a dozen distinct tests,
 * and "which tests earn" is the question this screen exists to answer — hiding
 * the tail would leave the small-but-frequent ones invisible.
 */
export function labSubtypes(data) {
  const rows = data?.subtypes || [];
  if (!rows.length) return null;

  const total = rows.reduce((a, r) => a + r.amount, 0);

  return {
    rows: rows.map(r => ({
      key: r.key,
      label: r.label,
      amount: inr(r.amount),
      // Two counts, because they answer different questions: how much work the
      // lab did, and how many people it served.
      meta: `${num(r.tests)} test${r.tests === 1 ? '' : 's'} · ${num(
        r.patients,
      )} pt`,
      avg: r.avg == null ? null : `${inr(r.avg)} avg`,
      share: total > 0 ? Math.round((r.amount / total) * 100) : 0,
      value: r.amount,
    })),
    foot: {
      label: 'ALL TESTS',
      meta: `${num(data.tests)} tests · ${num(data.patients)} pt`,
      amount: inr(data.revenue),
    },
  };
}

// Extend SECTION_SHAPERS with:
//
//   lab: data => ({
//     metrics: labMetrics(data),
//     blocks: [
//       { key: 'subtypes', kind: 'ranked', label: 'Test-wise revenue', data: labSubtypes(data) },
//     ],
//   }),

/* eslint-disable prettier/prettier */
// Add to src/api/sections.js
// ─────────────────────────────────────────────────────────────────────────────
// Pharmacy selectors. Paste below the Lab block, then extend SECTION_SHAPERS.
// ─────────────────────────────────────────────────────────────────────────────

const PHARMACY_MODE_COLORS = {
  Cash: '#1E7A5A',
  Card: '#3E8C8C',
  Online: '#2F6FA8',
  Other: '#B3762B',
};

/**
 * The four metric cards.
 *
 * "Patients billed" counts eVital rows only — pharmacybill exposes no patient
 * link — so the note says so rather than letting it read as every bill's
 * patient. The prototype's "of 48 OPD, 6 IPD" breakdown has no source at all.
 */
export function pharmacyMetrics(data) {
  if (!data) return [];
  const single = !!data.meta?.singleDay;
  const d = data.deltas || {};
  const out = [];

  out.push({
    key: 'revenue',
    label: 'Revenue',
    value: inr(data.revenue),
    ...(deltaNote(d.revenue, single) || {}),
  });
  if (data.avgBill != null) {
    out.push({
      key: 'avgBill',
      label: 'Average bill',
      value: inr(data.avgBill),
      ...(deltaNote(d.avgBill, single) || {}),
    });
  }

  if (data.patients != null) {
    out.push({
      key: 'patients',
      label: 'Patients billed',
      value: num(data.patients),
      note: 'counter bills only',
    });
  }

  return out;
}

/**
 * Payment mode as plain cards. Four fixed buckets whose proportions are rarely
 * the question — the amounts are.
 *
 * "Other" is included but flagged: upstream excludes it from pharmacy revenue,
 * so the money exists and the total does not contain it.
 */
export function pharmacyModes(data) {
  const m = data?.modes;
  if (!m) return null;

  const cards = ['Cash', 'Card', 'Online', 'Other']
    .filter(k => m[k] > 0)
    .map(k => ({
      key: k,
      label: k,
      value: inr(m[k]),
      color: PHARMACY_MODE_COLORS[k],
      // Other sits outside the revenue total, so it is marked rather than
      // sitting beside the three that make it up as though it were a peer.
      note: k === 'Other' ? 'not in revenue' : null,
    }));

  if (!cards.length) return null;

  return {
    cards,
    note:
      data.otherAmount > 0
        ? `${inr(
            data.otherAmount,
          )} paid by other modes is not included in the revenue total, matching the existing report.`
        : null,
  };
}

/**
 * Top medicines by revenue. Only eVital carries an itemised invoice, so
 * in-house bills contribute nothing here — said plainly rather than implied.
 */
export function pharmacyMedicines(data) {
  const rows = data?.medicines || [];
  if (!rows.length) return null;
  return {
    rows: rows.map(r => ({
      key: r.key,
      label: r.label,
      amount: inr(r.amount),
      meta: `${num(r.qty)} unit${r.qty === 1 ? '' : 's'} · ${num(
        r.bills,
      )} bill${r.bills === 1 ? '' : 's'}`,
      avg: null,
      share: 0,
      value: r.amount,
    })),
    note:
      `Top ${rows.length} of ${num(data.distinctMedicines)} medicines. ` +
      'Counter bills only — in-house bills are not itemised.',
  };
}

// Extend SECTION_SHAPERS with:
//
//   pharmacy: data => ({
//     metrics: pharmacyMetrics(data),
//     blocks: [
//       { key: 'sources',   kind: 'ranked', label: 'Revenue by source', data: pharmacySources(data) },
//       { key: 'modes',     kind: 'split',  label: 'Payment mode',      data: pharmacyModes(data) },
//       { key: 'medicines', kind: 'ranked', label: 'Top medicines',     data: pharmacyMedicines(data) },
//     ],
//   }),

/* ═══════════════════════════════════════════════════════════════════════════
   PART 1 — add to src/api/sections.js, below pharmacyMedicines
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Prescription conversion by patient type.
 *
 * Four figures per type: how many prescriptions, how many were dispensed
 * against, how many walked out with nothing, and what that nothing was worth.
 *
 * Partial shortfall is reported SEPARATELY from the not-taken loss. A patient
 * who bought one of six medicines counts as taken — a conversion on paper and a
 * loss in practice — so folding the two together would overstate conversion and
 * understate the loss at the same time.
 */
export function pharmacyPrescriptions(data) {
  const rx = data?.prescriptions;
  if (!rx || !rx.byType?.length) return null;

  const worst = Math.max(...rx.byType.map(t => t.lostNotTaken), 1);

  return {
    rows: rx.byType.map(t => ({
      key: t.key,
      label: t.label,
      // The headline per row is the money left on the counter, not the count —
      // that is the number that prompts anyone to act.
      amount: inr(t.lostNotTaken),
      amountLabel: 'NOT TAKEN',
      share: Math.round((t.lostNotTaken / worst) * 100),
      figures: [
        { label: 'PRESCRIBED', value: num(t.total) },
        { label: 'TAKEN', value: num(t.taken), tone: 'good' },
        {
          label: 'NOT TAKEN',
          value: num(t.notTaken),
          tone: t.notTaken > 0 ? 'bad' : null,
        },
        {
          label: 'CONVERSION',
          value: t.conversionPct == null ? '—' : `${t.conversionPct}%`,
          tone:
            t.conversionPct == null
              ? null
              : t.conversionPct >= 70
              ? 'good'
              : t.conversionPct >= 50
              ? 'warn'
              : 'bad',
        },
      ],
      // Only shown when there is partial loss to show — most rows have some,
      // but a type where everyone bought everything should say nothing.
      note:
        t.lostPartial > 0
          ? `${inr(t.lostPartial)} more lost to partial purchases`
          : null,
    })),
    foot: {
      label: 'ALL TYPES',
      meta: `${num(rx.totals.taken)} of ${num(rx.totals.total)} taken`,
      amount: inr(rx.totals.lostNotTaken),
    },
    note:
      rx.totals.lostTotal > rx.totals.lostNotTaken
        ? `${inr(rx.totals.lostTotal)} total unrealised, including ${inr(
            rx.totals.lostPartial,
          )} from partial purchases. Counter prescriptions only.`
        : 'Counter prescriptions only — in-house bills carry no prescription.',
  };
}

/* eslint-disable prettier/prettier */
// Add to src/api/sections.js — paste below the Pharmacy block,
// then add the `leads` entry to SECTION_SHAPERS.

/**
 * The four metric cards.
 *
 * The conversion delta is in POINTS, not percent — a rate moving 24% → 27% has
 * risen 3 points, and calling that "+12.5%" would be technically true and
 * useless. deltaNote is bypassed for that one card.
 */
export function leadsMetrics(data) {
  if (!data) return [];
  const single = !!data.meta?.singleDay;
  const d = data.deltas || {};
  const t = data.totals || {};
  const out = [];

  out.push({
    key: 'leads',
    label: 'Leads',
    value: num(t.total),
    // Deduplicated by phone upstream — one person enquiring three times is one
    // lead, and saying so stops the number being read as raw enquiries.
    note: 'unique enquirers',
    ...(deltaNote(d.total, single) || {}),
  });

  out.push({
    key: 'appointment',
    label: 'Appointments',
    value: num(t.appointment),
    note: t.conversionPct == null ? 'booked' : `${t.conversionPct}% of leads`,
    ...(deltaNote(d.appointment, single) || {}),
  });

  out.push({
    key: 'visited',
    label: 'Visited',
    value: num(t.visited),
    note: t.visitPct == null ? 'attended' : `${t.visitPct}% of leads`,
    ...(deltaNote(d.visited, single) || {}),
  });

  out.push({
    key: 'ipd',
    label: 'IPD',
    value: num(t.ipd),
    note: 'went on to surgery',
  });

  return out;
}

/**
 * Leads by source — the full funnel per channel.
 *
 * The headline per row is the lead COUNT, not money: this section has no
 * revenue figure, and volume is what tells you which channel to feed.
 *
 * ⚠️ Visits are only counted inside the window (see the model header), so
 * conversion is understated at the end of a period and badly understated on a
 * single day. The note says so rather than letting a 4% conversion read as a
 * collapse.
 */

// Which page each source opens. Mirrors LEAD_ROUTES in overview.js — if a
// source is added, both need it, or one surface navigates and the other does
// not for no visible reason.
//
// IVR has no lead LIST: leadsStatsModel counts IVR calls as leads, and the call
// log is the only screen behind them — which is the right destination anyway,
// since an IVR lead IS a call.
const LEAD_ROUTES = {
  web: 'WebLeads',
  chatbot: 'BotLeads',
  ivr: 'IVRCall',
  sulekha: 'PartnerLeads',
  hexa: 'PartnerLeads',
};
export function leadsSources(data) {
  const rows = data?.channels || [];
  if (!rows.length) return null;

  const t = data.totals || {};
  const most = Math.max(...rows.map(r => r.total), 1);

  return {
    rows: rows.map(r => {
      const conv =
        r.total > 0 ? Math.round((r.appointment / r.total) * 100) : null;
      return {
        key: r.key,
        label: r.label,
        route: LEAD_ROUTES[r.key] || null,
        // Both partner sources open the same screen, so the source tab is
        // preselected — otherwise tapping Aggregator opens a list that also
        // shows Sulekha, and the count will not match the card you tapped.
        params:
          r.key === 'hexa'
            ? { sourceFilter: 'Hexa' }
            : r.key === 'sulekha'
            ? { sourceFilter: 'Sulekha' }
            : null,
        amount: num(r.total),
        amountLabel: 'LEADS',
        share: Math.round((r.total / most) * 100),
        figures: [
          { label: 'LEADS', value: num(r.total) },
          { label: 'BOOKED', value: num(r.appointment) },
          { label: 'VISITED', value: num(r.visited), tone: 'good' },
          {
            label: 'CONVERSION',
            value: conv == null ? '—' : `${conv}%`,
            tone:
              conv == null
                ? null
                : conv >= 40
                ? 'good'
                : conv >= 20
                ? 'warn'
                : 'bad',
          },
        ],
        note: r.ipd > 0 ? `${num(r.ipd)} went on to surgery` : null,
      };
    }),
    foot: {
      label: 'ALL SOURCES',
      meta: `${num(t.appointment)} of ${num(t.total)} booked`,
      amount: num(t.total),
    },
    note: data.meta?.singleDay
      ? 'A lead that books today and visits next week is not yet counted as visited. Read conversion over a month, not a day.'
      : 'Visits are counted inside the selected period only, so conversion is understated near the end of a range.',
  };
}

// Add to SECTION_SHAPERS:
//
//   leads: data => ({
//     metrics: leadsMetrics(data),
//     blocks: [
//       { key: 'sources', kind: 'breakdown', label: 'Leads by source', data: leadsSources(data) },
//     ],
//   }),

/**
 * The four Reports cards.
 *
 * Revenue is compact (₹1.24Cr); the averages are NOT — ₹2.4K hides the
 * difference between ₹2,380 and ₹2,449, and an average is a figure people
 * compare month to month.
 */
export function reportsMetrics(data) {
  if (!data) return [];
  const single = !!data.meta?.singleDay;
  const d = data.deltas || {};
  const out = [];

  out.push({
    key: 'revenue',
    label: 'Revenue',
    value: inrCompact(data.revenue),
    ...(deltaNote(d.revenue, single) || {}),
  });

  out.push({
    key: 'patients',
    label: 'Patients',
    value: num(data.visits),
    // Appointments, not people — said plainly, since a patient who came twice
    // counts twice and the average depends on it.
    note:
      data.uniquePatients && data.uniquePatients !== data.visits
        ? `${num(data.uniquePatients)} unique`
        : 'confirmed visits',
  });

  if (data.avgPerPatient != null) {
    out.push({
      key: 'avgPerPatient',
      label: 'Avg per patient',
      value: inr(data.avgPerPatient),
      ...(deltaNote(d.avgPerPatient, single) || {}),
    });
  }

  if (data.avgPerNewPatient != null) {
    out.push({
      key: 'avgPerNewPatient',
      label: 'Avg per new patient',
      value: inr(data.avgPerNewPatient),
      // TOTAL revenue ÷ new patients — an acquisition figure, not what a new
      // patient spent. Saying so stops it being read as the latter.
      note: `${num(data.newVisits)} new · all revenue`,
    });
  }

  return out;
}

export function performanceMetrics(data) {
  const s = data?.summary;
  if (!s) return [];
  return [
    {
      key: 'operated',
      label: 'Operated',
      value: num(s.operated),
      note: 'patients',
    },
    {
      key: 'responses',
      label: 'Responses',
      value: num(s.responses),
      note:
        s.responseRatePct == null
          ? 'received'
          : `${s.responseRatePct}% replied`,
    },
    {
      key: 'psi',
      label: 'Avg PSI',
      value: s.psiAvg == null ? '—' : `${s.psiAvg}%`,
      note: 'satisfaction',
    },
  ];
}

export default { fetchSection, SECTION_SHAPERS };
