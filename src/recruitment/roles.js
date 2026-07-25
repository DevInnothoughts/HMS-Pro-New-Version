// ═══════════════════════════════════════════════════════════════════════════
//  Recruitment roles — who sees what, and which tabs they get.
//
//  Role RESOLUTION is imported from ticketing/roles.js rather than repeated.
//  Two copies of "what role is this person" is how the frontend and backend
//  drift apart, and it already cost us once (a SuperAdmin whose button showed
//  but whose request the server refused). One source, both modules.
// ═══════════════════════════════════════════════════════════════════════════

import { TICKET_ROLE, resolveTicketRole } from '../ticketing/roles';

export { TICKET_ROLE, resolveTicketRole };

/** Only a Cluster Head (or SuperAdmin) raises a manpower requisition. */
export function canRaiseMRF(ticketRole) {
  return (
    ticketRole === TICKET_ROLE.CLUSTER_HEAD ||
    ticketRole === TICKET_ROLE.SUPER_ADMIN
  );
}

/**
 * Bottom tabs per role.
 *
 * Raising sits in the Requests header as a "＋ New" action rather than taking a
 * tab: submitting a requisition is occasional, while watching them is the daily
 * job. Same reasoning as the Cluster Head's ticketing screen.
 */
export function tabsForRecruitment(ticketRole) {
  switch (ticketRole) {
    case TICKET_ROLE.CLUSTER_HEAD:
    case TICKET_ROLE.SUPER_ADMIN:
      return [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'requests', label: 'Requisitions' },
      ];
    case TICKET_ROLE.DEPT_HEAD:
      return [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'requests', label: 'All' },
        { key: 'review', label: 'To Review' },
      ];
    case TICKET_ROLE.DEPT_USER:
    default:
      // One screen: the positions they are working. No dashboard — their job is
      // the queue in front of them, not the analytics above it.
      return [{ key: 'requests', label: 'My Positions' }];
  }
}

/** Dashboard tiles, tuned to what each role actually acts on. */
export function metricsForRecruitment(ticketRole, d = {}) {
  const s = d.byStatus || {};
  switch (ticketRole) {
    case TICKET_ROLE.DEPT_HEAD:
      return [
        { key: 'Submitted', value: s.Submitted || 0, label: 'To review' },
        { key: 'InPipeline', value: d.open || 0, label: 'In pipeline' },
        { key: 'Joined', value: s.Joined || 0, label: 'Ready to close' },
        {
          key: 'Overdue',
          value: d.overdue || 0,
          label: 'Overdue',
          tone: 'danger',
        },
      ];
    case TICKET_ROLE.CLUSTER_HEAD:
      return [
        { key: 'InPipeline', value: d.open || 0, label: 'Open requests' },
        { key: 'Submitted', value: s.Submitted || 0, label: 'Awaiting HR' },
        {
          key: 'Filled',
          value: d.positionsFilled || 0,
          label: 'Positions filled',
        },
        {
          key: 'Overdue',
          value: d.overdue || 0,
          label: 'Overdue',
          tone: 'danger',
        },
      ];
    case TICKET_ROLE.SUPER_ADMIN:
    default:
      return [
        { key: 'InPipeline', value: d.open || 0, label: 'Open requests' },
        { key: 'Positions', value: d.positions || 0, label: 'Positions asked' },
        {
          key: 'Filled',
          value: d.positionsFilled || 0,
          label: 'Positions filled',
        },
        {
          key: 'Overdue',
          value: d.overdue || 0,
          label: 'Overdue',
          tone: 'danger',
        },
      ];
  }
}

/** Tapping a tile filters the list to what the number counted. */
export const RECRUITMENT_METRIC_FILTER = {
  Submitted: { statusExact: 'Submitted' },
  InPipeline: { status: 'Open' },
  Joined: { statusExact: 'Joined' },
  Overdue: { status: 'Overdue' },
  Filled: {},
  Positions: {},
};

/** The one-line explanation under the screen title. */
export const RECRUITMENT_COPY = {
  [TICKET_ROLE.CLUSTER_HEAD]: {
    title: 'Recruitment',
    sub: 'Raise manpower requisitions and follow them through to joining.',
  },
  [TICKET_ROLE.SUPER_ADMIN]: {
    title: 'Recruitment',
    sub: 'Every open position across the group.',
  },
  [TICKET_ROLE.DEPT_HEAD]: {
    title: 'Recruitment',
    sub: 'Review requisitions, assign them, and close filled positions.',
  },
  [TICKET_ROLE.DEPT_USER]: {
    title: 'My Positions',
    sub: 'The positions assigned to you.',
  },
};

/** Colour tone for a requisition status pill (maps to the shared Badge). */
export const STATUS_TONE = {
  Submitted: 'Open',
  Rejected: 'Rejected',
  Assigned: 'Assigned',
  'In Progress': 'In Progress',
  'Offer Released': 'Resolved',
  Joined: 'Resolved',
  Closed: 'Closed',
};

/** What the person holding this status is expected to do next. */
export const NEXT_STEP = {
  Submitted: 'Waiting for HR to review',
  Assigned: 'HR is starting the search',
  'In Progress': 'Sourcing and interviewing',
  'Offer Released': 'Offer issued, awaiting joining',
  Joined: 'Filled — ready to close',
  Closed: 'Closed',
  Rejected: 'Not approved',
};
