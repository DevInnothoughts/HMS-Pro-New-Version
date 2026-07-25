/* eslint-disable prettier/prettier */
// roles.js
// ─────────────────────────────────────────────────────────────────────────────
// Maps the app's existing role/subRole onto the five ticketing roles.
//
// This only decides which SCREEN a person lands on. It never decides what they
// may DO — the server answers that, and every ticket arrives with an `actions`
// list. If this file and the server ever disagreed, the server wins and the
// user sees a clear 403 rather than a button that lies.
//
// Reading the existing data
// ────────────────────────
//   Firestore `users` stores subRole 'Owner' for a branch partner — UserList.js
//   already renders 'Owner' as "Partner". The brief says subRole:'Partner', so
//   both strings are accepted and no migration is needed either way.
//
//   'Department Head' and 'Department User' are new subRole values. Their
//   `department` lives in the ticketing roster on the server, not here.
// ─────────────────────────────────────────────────────────────────────────────

export const TICKET_ROLE = {
  SUPER_ADMIN: 'SuperAdmin',
  PARTNER: 'Partner',
  CLUSTER_HEAD: 'ClusterHead',
  DEPT_HEAD: 'DepartmentHead',
  DEPT_USER: 'DepartmentUser',
  VIEWER: 'Viewer',
};

/** Firestore subRole values (what actually sits in the DB). */
export const SUB_ROLE = {
  PARTNER: 'Owner', // displayed as "Partner"
  PARTNER_ALT: 'Partner', // accepted too
  CLUSTER_HEAD: 'Cluster Head',
  DEPT_HEAD: 'Department Head',
  DEPT_USER: 'Department User',
};

/**
 * @param {string} role     state.location.role     — 'SuperAdmin' | 'Admin' | …
 * @param {string} subRole  state.location.subRole  — 'Owner' | 'Cluster Head' | …
 */
export function resolveTicketRole(role, subRole) {
  const s = (subRole || '').trim();
  const r = (role || '').trim();

  // SuperAdmin is checked FIRST, before subRole — this must match the server's
  // loadActor(), which resolves a SuperAdmin as SUPER_ADMIN regardless of any
  // subRole. An account can carry both (role 'SuperAdmin' + subRole 'Owner');
  // if the two sides disagreed on which wins, the app would show actions the
  // server then rejects — which is exactly the "button shows but raise fails"
  // bug. SuperAdmin oversees everything and may also raise (for any branch), so
  // nothing is lost by resolving them as SuperAdmin here.
  if (r === 'SuperAdmin') return TICKET_ROLE.SUPER_ADMIN;

  if (s === SUB_ROLE.DEPT_HEAD) return TICKET_ROLE.DEPT_HEAD;
  if (s === SUB_ROLE.DEPT_USER) return TICKET_ROLE.DEPT_USER;
  if (s === SUB_ROLE.PARTNER || s === SUB_ROLE.PARTNER_ALT)
    return TICKET_ROLE.PARTNER;
  if (s === SUB_ROLE.CLUSTER_HEAD) return TICKET_ROLE.CLUSTER_HEAD;
  return TICKET_ROLE.VIEWER;
}

/** The label shown in the header pill. */
export const ROLE_LABEL = {
  [TICKET_ROLE.SUPER_ADMIN]: 'Management',
  [TICKET_ROLE.PARTNER]: 'Branch Partner',
  [TICKET_ROLE.CLUSTER_HEAD]: 'Cluster Head',
  [TICKET_ROLE.DEPT_HEAD]: 'Department Head',
  [TICKET_ROLE.DEPT_USER]: 'Department User',
  [TICKET_ROLE.VIEWER]: 'Viewer',
};

/**
 * Header copy per role. The Partner strings are the mockup's own words.
 * Each one answers "what is this screen for, for me".
 */
export const ROLE_COPY = {
  [TICKET_ROLE.PARTNER]: {
    title: 'My Branch Tickets',
    sub: 'Raise tickets and track everything your branch has raised, whoever raised it.',
    raiseTitle: 'Raise Ticket',
  },
  [TICKET_ROLE.CLUSTER_HEAD]: {
    title: 'Cluster Head Dashboard',
    sub: 'Track tickets from assigned branches. Change status, filter issues, and monitor SLA.',
    raiseTitle: 'Raise Ticket',
  },
  [TICKET_ROLE.DEPT_HEAD]: {
    title: 'Department Queue',
    sub: 'Assign approved tickets to your team, sign off their fixes, and send back anything that is not yours.',
    raiseTitle: 'My Team',
  },
  [TICKET_ROLE.DEPT_USER]: {
    title: 'My Work',
    sub: 'Everything assigned to you. Update progress as you go and mark it fixed when it is done.',
    raiseTitle: '',
  },
  [TICKET_ROLE.SUPER_ADMIN]: {
    title: 'Ticketing control room',
    sub: 'Every unresolved ticket across the group, by cluster, branch and department.',
    raiseTitle: '',
  },
  [TICKET_ROLE.VIEWER]: {
    title: 'Ticketing',
    sub: 'Your login does not have a ticketing role yet.',
    raiseTitle: '',
  },
};

/** Bottom tabs per role. Partner gets exactly the two the brief specifies. */
export function tabsForRole(ticketRole) {
  switch (ticketRole) {
    case TICKET_ROLE.PARTNER:
      return [
        { key: 'dashboard', label: 'My Dashboard' },
        { key: 'raise', label: 'Raise Ticket' },
      ];
    case TICKET_ROLE.CLUSTER_HEAD:
      // The mockup splits Dashboard (numbers) from Tickets (the working list) —
      // right for someone watching several branches, where one merged screen
      // would bury the analytics under a long list.
      //
      // The third tab is the cluster head's actual inbox: tickets sitting at
      // status Open, waiting for THEM to approve. Raising moved out of the tab
      // bar to a "+ Raise" action in the Tickets header — raising is an
      // occasional errand (requirement 7, partner-less branches), while
      // approving is the recurring job, so the job gets the tab.
      return [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'tickets', label: 'Tickets' },
        { key: 'approvals', label: 'Approvals' },
      ];
    case TICKET_ROLE.DEPT_HEAD:
      // Requirement 9 — heads manage their own people.
      return [
        { key: 'dashboard', label: 'Department Queue' },
        { key: 'team', label: 'My Team' },
      ];
    case TICKET_ROLE.SUPER_ADMIN:
      // Dashboard = the group-wide numbers and the branch/department
      // breakdowns; Tickets = the filtered working list those breakdowns drill
      // into; Raise = raising for any branch. Same split as the Cluster Head.
      return [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'tickets', label: 'Tickets' },
        { key: 'raise', label: 'Raise Ticket' },
      ];
    case TICKET_ROLE.DEPT_USER:
    default:
      return [{ key: 'dashboard', label: 'Dashboard' }];
  }
}

/** Can this role raise a ticket? Partners, cluster heads, and SuperAdmin. */
export function canRaise(ticketRole) {
  return (
    ticketRole === TICKET_ROLE.PARTNER ||
    ticketRole === TICKET_ROLE.CLUSTER_HEAD ||
    ticketRole === TICKET_ROLE.SUPER_ADMIN
  );
}

/**
 * Does this role belong to the ticketing module ONLY, with no business in the
 * Performance side of the app?
 *
 * Department Heads and Users are onboarded purely for ticketing — they have no
 * branch dashboard, no leads, nothing in Performance. So they must not be handed
 * a door into it. Everyone else (Partner, Cluster Head, SuperAdmin) runs a
 * branch or the whole group, and Performance is theirs.
 */
export function isTicketingOnly(ticketRole) {
  return (
    ticketRole === TICKET_ROLE.DEPT_HEAD || ticketRole === TICKET_ROLE.DEPT_USER
  );
}

/**
 * The sidebar's nav rows for a role. This is the ONE place that decides who sees
 * Performance — the drawer renders whatever this returns, so there is no way for
 * a ticketing-only user to be shown a Performance link.
 *
 * A ticketing-only role gets a single Ticketing row. With nothing to switch to,
 * the drawer can drop the nav list entirely and just be identity + log out —
 * but the row is returned so the active state still reads correctly.
 */
/**
 * Can this person see the Recruitment section?
 *
 * Recruitment is an HR process, so: Cluster Heads (who raise requisitions),
 * SuperAdmins (oversight), and HR's own head and executives. A Partner never
 * sees it, and neither does a department head or user OUTSIDE HR — a
 * Maintenance head has no business in the hiring pipeline.
 *
 * `department` is the person's department. For a department role Redux's
 * `location` holds exactly that, which is what the drawer passes in.
 *
 * This lives here rather than in recruitment/roles.js because the drawer is
 * shared: putting it there and importing it back would make the two modules
 * import each other.
 */
export function canUseRecruitment(ticketRole, department) {
  if (
    ticketRole === TICKET_ROLE.CLUSTER_HEAD ||
    ticketRole === TICKET_ROLE.SUPER_ADMIN
  ) {
    return true;
  }
  if (
    ticketRole === TICKET_ROLE.DEPT_HEAD ||
    ticketRole === TICKET_ROLE.DEPT_USER
  ) {
    return (department || '').trim().toLowerCase() === 'hr';
  }
  return false;
}

export function sidebarNavForRole(ticketRole, department) {
  const performance = {
    key: 'performance',
    icon: '📈',
    label: 'Performance',
    screen: 'AdminHome',
  };
  const ticketing = {
    key: 'ticketing',
    icon: '🎫',
    label: 'Ticketing',
    screen: 'TicketingHome',
  };
  const recruitment = {
    key: 'recruitment',
    icon: '🧑‍💼',
    label: 'Recruitment',
    screen: 'RecruitmentHome',
  };

  const items = isTicketingOnly(ticketRole)
    ? [ticketing]
    : [performance, ticketing];
  if (canUseRecruitment(ticketRole, department)) items.push(recruitment);
  return items;
}

/**
 * The four dashboard tiles, per role. Same visual grid as the mockup; the
 * labels change so each tile names something that role can act on.
 */
export function metricsForRole(ticketRole, d = {}) {
  const common = [
    { key: 'Open', value: d.open, label: 'Open tickets' },
    { key: 'Critical', value: d.critical, label: 'Critical' },
    { key: 'Overdue', value: d.overdue, label: 'Overdue' },
    { key: 'Closed', value: d.closedResolved, label: 'Closed / resolved' },
  ];
  switch (ticketRole) {
    case TICKET_ROLE.PARTNER:
      return [
        { key: 'Open', value: d.open, label: 'Open at my branch' },
        { key: 'Critical', value: d.critical, label: 'Critical' },
        { key: 'Overdue', value: d.overdue, label: 'Overdue' },
        { key: 'Closed', value: d.closedResolved, label: 'Closed / resolved' },
      ];
    case TICKET_ROLE.CLUSTER_HEAD:
      // The mockup's four tiles, exactly. "Waiting on me" and "Sent back to me"
      // are not lost — they moved to the action strip above these, where an
      // unapproved ticket reads as a job rather than a statistic.
      return [
        { key: 'Open', value: d.open, label: 'Open tickets' },
        { key: 'Critical', value: d.critical, label: 'Critical' },
        { key: 'Overdue', value: d.overdue, label: 'Overdue' },
        { key: 'Closed', value: d.closedResolved, label: 'Closed / resolved' },
      ];
    case TICKET_ROLE.DEPT_HEAD:
      // Every tile maps to tickets this head can actually see and open. The
      // list scopes to their department in states past Cluster Head approval —
      // it never shows the 'Open' status (those await CH approval, upstream of
      // the department). So there is no "Open" tile here: it would count
      // tickets the list can't display and tapping it would show nothing.
      // "In my queue" is the whole active department load (d.open already counts
      // only non-terminal tickets, all of which are visible to the head).
      return [
        {
          key: 'Approved',
          value: d.byStatus?.Approved || 0,
          label: 'To assign',
        },
        {
          key: 'Pending Approval',
          value: d.byStatus?.['Pending Approval'] || 0,
          label: 'Fixes to sign off',
        },
        { key: 'InQueue', value: d.open, label: 'In my queue' },
        { key: 'Overdue', value: d.overdue, label: 'Overdue' },
      ];
    case TICKET_ROLE.DEPT_USER:
      return [
        {
          key: 'Assigned',
          value: d.byStatus?.Assigned || 0,
          label: 'Not started',
        },
        {
          key: 'In Progress',
          value: d.byStatus?.['In Progress'] || 0,
          label: 'In progress',
        },
        { key: 'Overdue', value: d.overdue, label: 'Overdue' },
        { key: 'Closed', value: d.closedResolved, label: 'Done' },
      ];
    default:
      return common;
  }
}
