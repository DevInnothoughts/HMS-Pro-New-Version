/* eslint-disable prettier/prettier */
// src/config/sections.config.js
// ─────────────────────────────────────────────────────────────────────────────
// The single source of truth for the redesigned shell. It drives, all at once:
//
//   • the department tile grid on the home screen
//   • the seven section screens (one parameterised SectionScreen, not seven)
//   • the metric cards on each section
//   • the page rows and where they navigate
//   • who can see what
//
// Adding a page later is a line in this file, not a new screen.
//
// SCOPE FOR THIS RELEASE
// ──────────────────────
// Pages that do not exist yet are OMITTED, not greyed out. The 12 `soon: 1`
// rows in the prototype and the IPD Aging screen are deliberately absent — they
// return when they are built.
//
// Metric cards list ONLY numbers with a real backend source today. A card with
// a dash in it on a revenue screen is worse than no card, so a section with two
// available metrics renders two cards, not four with two blanks. `metrics`
// therefore varies in length between 1 and 3 — SectionScreen handles that.
//
// Cut from the prototype for this release, all for want of a data source:
//   gender split · surgery-wise table · IPD patient-type table · claim funnel
//   lead-source funnel · pharmacy average-spend bars · lab per-patient averages
//   target-by-department funnel · every "+12% vs yesterday" delta
// ─────────────────────────────────────────────────────────────────────────────

// ─── Roles ───────────────────────────────────────────────────────────────────
// Mirrors the gating already present in AdminHome's reportGrid. `ALL` means
// every role that reaches the new home at all (Admin, SuperAdmin, and the
// bare-role users who fall through to AdminHome today).
export const ALL = '*';
export const FINANCE = ['SuperAdmin', 'CFO'];
export const LEADERSHIP = [
  'SuperAdmin',
  'CFO',
  'Cluster Head',
  'Owner',
  'Director',
];

/**
 * canSee(gate, { role, subRole })
 * A gate is `ALL`, or an array matched against EITHER role or subRole —
 * because AdminHome checks both (`role === 'SuperAdmin' || subRole === 'CFO'`).
 */
export const canSee = (gate, { role, subRole } = {}) => {
  if (!gate || gate === ALL) return true;
  return gate.includes(role) || gate.includes(subRole);
};

// ─── Metric descriptors ──────────────────────────────────────────────────────
// `key`    — the field SectionScreen reads off the section payload
// `format` — 'inr' | 'num' | 'dec1'
// `source` — a comment for the next developer: where the number comes from.
//            Keep it accurate; it is the map back to the backend.
const M = (key, label, format, source) => ({ key, label, format, source });

export const SECTIONS = [
  {
    id: 'opd',
    code: 'OPD',
    name: 'Outpatient',
    icon: 'stetho',
    sub: 'Consultations, billing and daily flow',
    gate: ALL,
    // Home tile subtitle, e.g. "48 patients today".
    statKey: 'opd',
    metrics: [
      M('newPatients', 'New patients', 'num', '/Dashboard dailyOPDReport.new'),
      M('revenue', 'Revenue', 'inr', '/overview/collection byDept.opd.amount'),
      M('avgPerPatient', 'Avg per patient', 'inr', 'derived: revenue / count'),
    ],
    pages: [
      {
        name: 'Appointments',
        desc: "Today's schedule",
        icon: 'calplus',
        route: 'AppointmentDetails',
      },
      // {
      //   name: 'OPD Report',
      //   desc: 'New, follow-up, post-op and C+P split',
      //   icon: 'chart',
      //   route: 'OPDReportDetails',
      // },
      {
        name: 'OPD Collection',
        desc: 'Consultation and procedure billing',
        icon: 'rupee',
        route: 'AdminOPDPayment',
      },
      {
        name: 'Daily OPD Report',
        desc: 'Day-close summary for the branch',
        icon: 'invoice',
        route: 'DailyOPDPayment',
      },
    ],
    endpoint: true,
  },

  {
    id: 'ipd',
    code: 'IPD',
    name: 'Inpatient',
    icon: 'bed',
    sub: 'Admissions, billing and insurance',
    gate: ALL,
    statKey: 'ipd',
    endpoint: true,
    metrics: [
      M('admissions', 'Admissions', 'num', '/Dashboard ipd_count'),
      M('revenue', 'Revenue', 'inr', '/overview/collection byDept.ipd.amount'),
      M('avgPerPatient', 'Avg per patient', 'inr', 'derived: revenue / count'),
    ],
    pages: [
      {
        name: 'IPD Invoice',
        desc: 'Raise and review admission invoices',
        icon: 'invoice',
        route: 'IPDBillDetails',
      },
      {
        name: 'IPD Collection',
        desc: 'Payments received against admissions',
        icon: 'rupee',
        route: 'AdminIPDPayment',
      },
      {
        name: 'IPD Due List',
        desc: 'Outstanding balance by patient',
        icon: 'wallet',
        route: 'IPDDueList',
      },
      {
        name: 'IHX Claim Tracker',
        desc: 'Status of every cashless claim',
        icon: 'shield',
        route: 'IHXDataAnalysis',
      },
    ],

    // NOTE: the prototype groups these under "Billing & dues" / "Insurance".
    // Groups are dropped for four rows — the headers cost more vertical space
    // than they earn. They return when IPD Aging and the TPA pages land.
  },

  {
    id: 'lab',
    code: 'LAB',
    name: 'Laboratory',
    icon: 'scope',
    sub: 'Diagnostics billing and revenue',
    gate: ALL,
    statKey: 'lab',
    endpoint: true,
    metrics: [
      M('revenue', 'Revenue', 'inr', 'getLabRevenue via /overview/collection'),
    ],
    pages: [
      {
        name: 'Lab Collection',
        desc: 'Payments received for diagnostics',
        icon: 'rupee',
        route: 'LabCollectionReport',
      },
    ],
    // ⚠️ THIN — one metric, one page. Flagged for the Day 3 review: either ship
    // it thin, or fold Lab into Reports until Test-wise Revenue exists.
  },

  {
    id: 'pharmacy',
    code: 'PHARMACY',
    name: 'Pharmacy',
    icon: 'mortar',
    sub: 'Dispensing and revenue',
    gate: ALL,
    statKey: 'pharmacy',
    endpoint: true,
    metrics: [
      M(
        'revenue',
        'Revenue',
        'inr',
        '/overview/collection byDept.pharmacy.amount',
      ),
    ],
    pages: [
      {
        name: 'Evital Pharmacy',
        desc: 'Live sales from the Evital counter',
        icon: 'mortar',
        route: 'EvitalPharmacyData',
      },
      {
        name: 'Pharmacy Analysis',
        desc: 'Movement, returns and fast movers',
        icon: 'chart',
        route: 'pharmacyAnalysis',
      },
    ],
  },

  {
    id: 'leads',
    code: 'LEADS',
    name: 'Leads & Calls',
    icon: 'headset',
    sub: 'Enquiries, calls and conversion',
    gate: ALL,
    statKey: 'leads',
    endpoint: true,
    metrics: [
      M(
        'callsHandled',
        'Calls handled',
        'num',
        '/Dashboard answered + helpline_answered',
      ),
      M('callsMissed', 'Missed', 'num', '/Dashboard missed + helpline_missed'),
    ],
    pages: [
      // The prototype merges IVR and Helpline into one row. Both screens exist
      // separately and neither has a combined view, so they stay two rows —
      // merging would mean building a screen, which is out of scope this week.
      {
        name: 'IVR Calls',
        desc: 'Answered, missed and callbacks',
        icon: 'headset',
        route: 'IVRCall',
      },
      {
        name: 'Helpline Calls',
        desc: 'Incoming and outgoing helpline log',
        icon: 'headset',
        route: 'HelplineCalls',
      },
      {
        name: 'Web Leads',
        desc: 'Enquiries from the website',
        icon: 'globe',
        route: 'WebLeads',
      },
      {
        name: 'Bot Leads',
        desc: 'Chatbot conversations captured',
        icon: 'bot',
        route: 'BotLeads',
      },
      {
        name: 'Web Call Leads',
        desc: 'Call-back requests from the website',
        icon: 'headset',
        route: 'WebCallLeads',
      },
      {
        name: 'Aggregator Leads',
        desc: 'Sulekha, Hexa and other partners',
        icon: 'globe',
        route: 'PartnerLeads',
      },
      {
        name: 'Calling Calendar',
        desc: 'Follow-ups scheduled for the desk',
        icon: 'cal',
        route: 'CallingList',
      },
      {
        name: 'Lead Stats Report',
        desc: 'Source, stage and owner breakdown',
        icon: 'chart',
        route: 'LeadStatsReport',
        gate: FINANCE,
      },
    ],
  },

  {
    id: 'performance',
    code: 'PERFORMANCE',
    name: 'Performance',
    icon: 'target',
    sub: 'Targets, scores and patient feedback',
    gate: ALL,
    statKey: 'performance',
    endpoint: true,
    metrics: [
      M('npsAvg', 'Average NPS', 'dec1', '/Dashboard nps_avg'),
      M('patientsServed', 'Patients served', 'num', '/Dashboard totalPatients'),
    ],
    pages: [
      {
        name: 'Performance Tracker',
        desc: 'Target vs achieved by department',
        icon: 'target',
        route: 'PerformanceTracking',
      },
      {
        name: 'Convincing Score',
        desc: 'Counsellor-wise conversion quality',
        icon: 'gauge',
        route: 'ConvincingScore',
      },
      {
        name: 'Patient Feedback',
        desc: 'Post-surgery NPS and satisfaction index',
        icon: 'star',
        route: 'IPDFeedback',
      },
      {
        name: 'Post-Op Calling Feedback',
        desc: 'Follow-up calls after discharge',
        icon: 'headset',
        route: 'NpsPatientList',
      },
      {
        name: 'Graph and statistics',
        desc: 'Trends and charts across the branch',
        icon: 'chart',
        route: 'Performance',
      },
      // Built, but commented out of AdminHome's grid today. The prototype marks
      // it "coming soon" — it is not; it ships here at zero cost.
      // {
      //   name: 'Doctor Productivity',
      //   desc: 'Consultations and revenue per doctor',
      //   icon: 'stetho',
      //   route: 'DoctorPerformanceBranchList',
      // },
    ],
  },

  {
    id: 'reports',
    code: 'REPORTS',
    name: 'Reports',
    icon: 'chart',
    sub: 'Consolidated statements and exports',
    gate: ALL,
    statKey: 'reports',
    endpoint: true,
    metrics: [
      M(
        'opdIpdCollection',
        'OPD + IPD',
        'inr',
        '/overview/collection opd + ipd',
      ),
      M(
        'totalCollection',
        'Total collection',
        'inr',
        '/overview/collection total',
      ),
    ],
    pages: [
      {
        name: 'OPD + IPD Collection',
        desc: 'Both revenue streams side by side',
        icon: 'rupee',
        route: 'AdminOPDIPDPayment',
      },
      {
        name: 'Billing Summary',
        desc: 'Every bill raised in the period',
        icon: 'invoice',
        route: 'summaryReport',
        gate: FINANCE,
      },
      {
        name: 'Conditionwise Report',
        desc: 'Case mix by diagnosis',
        icon: 'chart',
        route: 'conditionwiseReport',
      },
      {
        name: 'Reference Report',
        desc: 'Referring doctors and sources',
        icon: 'mega',
        route: 'ReferenceData',
      },
      // ⚠️ OPEN DECISION (Phase 0 item 7): "Daily Report" in the prototype is
      // either DailyOPDPayment (already listed under OPD) or ReportScreen's DSR
      // mode. Listed as ReportScreen here because duplicating the OPD row adds
      // nothing. Confirm before Day 3.
      {
        name: 'Report Centre',
        desc: 'DCR, IPD Due and Lost Leads exports',
        icon: 'firstaid',
        route: 'ReportScreen',
      },
    ],
  },
];

// ─── Bottom tabs ─────────────────────────────────────────────────────────────
// All five already exist. Add User keeps its current SuperAdmin gate; it points
// at UserList, which is what AdminHome's BottomTab navigates to today (the
// AddUser form is reached from there).
export const TABS = [
  { key: 'home', label: 'Home', icon: 'home', route: 'Home' },
  { key: 'approval', label: 'Approval', icon: 'check', route: 'Approval' },
  {
    key: 'search',
    label: 'Search Patient',
    icon: 'search',
    route: 'SearchPatient',
  },
  {
    key: 'convincing',
    label: 'Convincing Score',
    icon: 'gauge',
    route: 'ConvincingScore',
  },
  {
    key: 'users',
    label: 'Add User',
    icon: 'adduser',
    route: 'UserList',
    gate: ['SuperAdmin'],
  },
];
// NOTE: the prototype's first tab is "Performance". Performance is a section
// tile AND the whole home screen is performance — a tab pointing at the old
// PerformanceScreen alongside a Performance section would be two doors to
// similar things. Home takes that slot. Raise at the Day 3 review.

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const sectionById = id => SECTIONS.find(s => s.id === id);

export const visibleSections = user =>
  SECTIONS.filter(s => canSee(s.gate, user));

export const visiblePages = (section, user) =>
  (section.pages || []).filter(p => canSee(p.gate, user));

export const visibleTabs = user => TABS.filter(t => canSee(t.gate, user));

export default SECTIONS;
