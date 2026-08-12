/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// TicketingHome.js
// ─────────────────────────────────────────────────────────────────────────────
// The Ticketing module's home. One screen, one layout, five audiences.
//
// The mockup is the Branch Partner's view, and requirement 5 says the same
// dashboard serves different users. So rather than five near-identical screens,
// this is the mockup's layout with the parts that must change driven by role:
//
//   header copy + role pill  → ROLE_COPY / ROLE_LABEL   (roles.js)
//   bottom tabs              → tabsForRole              (roles.js)
//   the four metric tiles    → metricsForRole           (roles.js)
//   which tickets load       → the server's own scoping (ticketingModel.js)
//   which buttons appear     → ticket.actions from the server
//
// Nothing here decides permissions. The server sends the tickets a person may
// see and the actions they may take; this screen draws them.
//
// Tabs per role
//   Partner       Dashboard · Raise Ticket
//   Cluster Head  Dashboard · Tickets · Approvals   (PDF §6 — no raising)
//   Dept Head     Department Queue                  (PDF §2 — no team)
//   Dept User     no ticketing role                 (PDF §2)
//   SuperAdmin    Dashboard · Tickets · Raise Ticket
// ─────────────────────────────────────────────────────────────────────────────

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import AppDrawer from '../common/AppDrawer';
import { buildActor, fetchDashboard, fetchTickets, getMeta } from './api';
import {
  BottomNav,
  BreakdownList,
  Btn,
  Empty,
  FilterBar,
  ListTitle,
  Metric,
  ProgressBar,
  SLACard,
  ScreenHeader,
  TicketCard,
  Toast,
  useToast,
} from './components';
import RaiseTicket from './RaiseTicket';
import {
  canRaise,
  isTicketingOnly,
  metricsForRole,
  resolveTicketRole,
  ROLE_COPY,
  rolePillFor,
  tabsForRole,
  TICKET_ROLE,
} from './roles';
import { C, F, S } from './theme';

// A metric tile's key maps onto a list filter, so tapping a number shows you
// the tickets behind it. Straight from the mockup: onclick="setFilter('Open')".
const METRIC_FILTER = {
  Open: { status: 'Open' },
  Critical: { priority: 'Critical', status: 'Open' },
  Overdue: { status: 'Overdue' },
  // An explicit status, which is what lets this tile reach past the new
  // default that hides finished tickets (PDF §3).
  Closed: { status: 'Closed' },
  SentBack: { status: 'Sent back' },
  // statusExact, not status: "Branch Fixed" is an engine status, not one of the
  // six display words, so the display-status filter would never match it.
  BranchFixed: { statusExact: 'Branch Fixed' },
  Approval: { status: 'Open' },
  Approved: { status: 'Approved' },
  'In Progress': { status: 'In Progress' },
  Resolved: { status: 'Resolved' },
  // A Dept Head's whole active queue — no status filter, so it's the same set
  // the list shows by default (everything in their department past approval).
  InQueue: {},
};

const TicketingHome = ({ navigation }) => {
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);

  const ticketRole = resolveTicketRole(role, subRole);
  const tabs = useMemo(() => tabsForRole(ticketRole), [ticketRole]);
  const copy = ROLE_COPY[ticketRole] || ROLE_COPY[TICKET_ROLE.VIEWER];

  const [tab, setTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actor, setActor] = useState(null);
  const [meta, setMeta] = useState(null);
  const [dash, setDash] = useState({});
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({});
  // The cluster head's approval inbox — tickets sitting at the literal `Open`
  // status, waiting on them. Kept separate from `tickets` so the Tickets tab's
  // own filters and this list never interfere with each other.
  const [pending, setPending] = useState([]);
  const hasApprovals = useMemo(
    () => tabs.some(t => t.key === 'approvals'),
    [tabs],
  );
  const [toastMsg, toast] = useToast();

  // Back button: leave the module rather than exiting the app.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (menuOpen) {
          setMenuOpen(false);
          return true;
        }
        if (tab !== 'dashboard') {
          setTab('dashboard');
          return true;
        }
        // For a Partner or Cluster Head, Ticketing is a section of their app, so
        // back returns to Performance. For a ticketing-only user (Department
        // Head / User) there is no Performance to return to — AdminHome is the
        // one place they must never land — so back does nothing on the
        // dashboard, exactly like a home screen. They leave via Log out.
        if (isTicketingOnly(ticketRole)) {
          return true;
        }
        navigation.replace('AdminHome');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [menuOpen, tab, navigation, ticketRole]),
  );

  const load = useCallback(
    async (nextFilters = filters, quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const a = await buildActor({ role, subRole, location, locationArray });
        setActor(a);
        if (!a.actorMobile) {
          setError('You are signed out. Please log in again.');
          return;
        }

        // Fetch independently so one failing call can't silently blank another.
        // Before, dashboard and tickets shared a Promise.all: if the tickets
        // call failed, the list went empty AND the counts vanished — or worse,
        // if the dashboard was already populated from a prior load, you'd see
        // counts with an empty list and no error. Now each settles on its own
        // and a tickets-only failure shows a real message instead of "nothing".
        const [metaR, dashR, listR, pendingR] = await Promise.allSettled([
          getMeta(),
          fetchDashboard(a),
          fetchTickets(a, nextFilters),
          // The approval inbox, for roles that have that tab. `statusExact` is
          // deliberate: a plain `status: 'Open'` filter means "everything not
          // closed" server-side, which would list the whole active queue. The
          // exact enum is the set genuinely waiting on this person to approve.
          hasApprovals
            ? fetchTickets(a, { statusExact: 'Open' })
            : Promise.resolve(null),
        ]);

        if (metaR.status === 'fulfilled' && metaR.value) setMeta(metaR.value);
        if (dashR.status === 'fulfilled') setDash(dashR.value || {});
        if (pendingR.status === 'fulfilled' && pendingR.value) {
          setPending(pendingR.value.tickets || []);
        }

        if (listR.status === 'fulfilled') {
          setTickets(listR.value?.tickets || []);
        } else {
          // The list specifically failed. Say so, and log the cause — this is
          // what to read if the dashboard shows counts but the list is empty.
          console.log('ticketing: fetchTickets failed', listR.reason?.message, {
            actorMobile: a.actorMobile,
            role: a.actorRole,
            subRole: a.actorSubRole,
            filters: nextFilters,
          });
          setTickets([]);
          setError(
            listR.reason?.message ||
              "Couldn't load the ticket list. Pull to refresh to try again.",
          );
        }

        // If everything failed, surface the dashboard error too.
        if (dashR.status === 'rejected' && listR.status === 'rejected') {
          setError(
            dashR.reason?.message ||
              listR.reason?.message ||
              'Something went wrong.',
          );
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role, subRole, location, locationArray, filters, hasApprovals],
  );

  useEffect(() => {
    load({}, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, subRole, location]);

  // Tapping a tile or a breakdown row filters the list. When Dashboard and
  // Tickets are separate screens, it also takes you there — otherwise the tap
  // would look like it did nothing. This is the mockup's applyDashboardFilter.
  const applyFilters = (next, { goToList = true } = {}) => {
    setFilters(next);
    load(next, true);
    if (
      goToList &&
      splitScreens &&
      tab === 'dashboard' &&
      Object.keys(next).length
    ) {
      setTab('tickets');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(filters, true);
  };

  const openTicket = t =>
    navigation.navigate('TicketDetail', {
      id: t.id,
      onChanged: () => load(filters, true),
    });

  // Which tile or chip is currently driving the list — so it reads back in the
  // header instead of leaving people wondering why the list looks short.
  const activeFilterLabel = useMemo(() => {
    const parts = [];
    if (filters.mine) parts.push('Raised by me');
    if (filters.status) parts.push(filters.status);
    if (filters.priority) parts.push(filters.priority);
    if (filters.department) parts.push(filters.department);
    if (filters.branch) parts.push(filters.branch);
    return parts.length
      ? `Showing: ${parts.join(' · ')}`
      : defaultListTitle(ticketRole);
  }, [filters, ticketRole]);

  const metrics = metricsForRole(ticketRole, dash);
  const isBusy = loading && !refreshing;
  const head = headerFor(tab, ticketRole, copy, dash.department);

  // The cluster head mockup splits the screens: Dashboard is the numbers,
  // Tickets is the working list. Every other role keeps them on one screen,
  // which is what their own mockup showed and what a shorter list can carry.
  // Cluster Head and SuperAdmin both watch many branches, so their screen is
  // split: Dashboard is the numbers + breakdowns, Tickets is the working list.
  // This is also what makes the breakdown rows work — tapping one filters the
  // list AND jumps to the Tickets tab (see applyFilters). Without the split the
  // list sits far below the breakdowns on the same screen and a tap looks dead.
  // Every other role keeps the single merged screen their own mockup showed.
  const splitScreens =
    ticketRole === TICKET_ROLE.CLUSTER_HEAD ||
    ticketRole === TICKET_ROLE.SUPER_ADMIN;
  const showNumbers = tab === 'dashboard';
  const showList = tab === 'tickets' || (tab === 'dashboard' && !splitScreens);

  // One shell for every tab: one header, one bottom bar, one drawer, one toast.
  //
  // The tab screens used to render their own SafeAreaView + header + drawer and
  // only the dashboard rendered a BottomNav — so Raise Ticket had no way back
  // once the header tabs were gone. Owning the shell here makes that impossible:
  // a tab is now just a body, and the bar is always on screen.
  return (
    <SafeAreaView style={S.screen} edges={['top']}>
      <ScreenHeader
        onMenu={() => setMenuOpen(true)}
        rolePill={rolePillFor(ticketRole, subRole)}
        title={head.title}
        sub={head.sub}
        right={
          // Raising moved out of the tab bar for roles that have an approvals
          // tab: it lives here as an action on the Tickets page. Shown only
          // where it applies, so it never appears for someone who can't raise.
          hasApprovals &&
          canRaise(ticketRole) &&
          (tab === 'tickets' || tab === 'approvals') ? (
            <TouchableOpacity
              onPress={() => setTab('raise')}
              accessibilityRole="button"
              accessibilityLabel="Raise a new ticket"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.18)',
                marginRight: 8,
              }}
            >
              <Text style={{ color: C.white, fontSize: 15, lineHeight: 17 }}>
                ＋
              </Text>
              <Text
                style={{ color: C.white, fontSize: 13, fontFamily: F.semibold }}
              >
                Raise
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {tab === 'raise' ? (
        <RaiseTicket
          meta={meta}
          actor={actor}
          ticketRole={ticketRole}
          onDone={() => {
            // Raising is launched from the Tickets header, so return there —
            // landing back on the dashboard would lose the person's place.
            setTab('tickets');
            setFilters({});
            load({}, true);
            toast('Ticket submitted. You can track it in your dashboard.');
          }}
        />
      ) : tab === 'approvals' ? (
        // The approval inbox: tickets at the literal `Open` status, which is
        // exactly the set this cluster head must approve or reject before
        // anything else can happen to them.
        <ScrollView
          contentContainerStyle={S.main}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.green}
            />
          }
        >
          {isBusy ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={C.green} />
            </View>
          ) : pending.length ? (
            <>
              <View
                style={[
                  S.card,
                  { paddingVertical: 12, paddingHorizontal: 14, marginTop: 0 },
                ]}
              >
                <Text style={S.bold}>
                  {pending.length} ticket{pending.length === 1 ? '' : 's'}{' '}
                  waiting on you
                </Text>
                <Text style={[S.tiny, { marginTop: 2 }]}>
                  Nothing moves on these until you approve or reject them.
                </Text>
              </View>
              {pending.map(t => (
                <TicketCard
                  key={t.ticketId}
                  ticket={t}
                  onPress={() => openTicket(t)}
                  footer={<TicketFooter ticket={t} />}
                />
              ))}
            </>
          ) : (
            <Empty>
              Nothing is waiting for your approval. New tickets from your
              branches will appear here.
            </Empty>
          )}
        </ScrollView>
      ) : isBusy ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color={C.green} />
          <Text style={[S.tiny, { marginTop: 10 }]}>Loading your tickets…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={S.main}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.green}
            />
          }
        >
          {!!error && (
            <View style={[S.card, { borderColor: C.red, marginTop: 0 }]}>
              <Text style={[S.bold, { color: C.red }]}>{error}</Text>
              <Btn
                label="Try again"
                secondary
                small
                onPress={() => load(filters)}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              />
            </View>
          )}

          {ticketRole === TICKET_ROLE.VIEWER ? (
            <View style={[S.card, S.empty]}>
              <Text style={[S.bold, { marginBottom: 6 }]}>
                No ticketing role yet
              </Text>
              <Text style={S.emptyText}>
                Your login isn't set up for ticketing. Ask your Cluster Head or
                Department Head to add you, then sign in again.
              </Text>
            </View>
          ) : (
            <>
              {/* ── Numbers ─────────────────────────────────────────────── */}
              {showNumbers && (
                <>
                  {/* The cluster head's real job is approving and routing. Four
                      counters don't say "do this now", so anything sitting on
                      them leads, above the statistics. */}
                  {ticketRole === TICKET_ROLE.CLUSTER_HEAD && (
                    <ActionStrip
                      dash={dash}
                      onGo={applyFilters}
                      onApprovals={() =>
                        // Fall back to a filtered list for any role that shows
                        // this strip without an Approvals tab.
                        hasApprovals
                          ? setTab('approvals')
                          : applyFilters({ statusExact: 'Open' })
                      }
                    />
                  )}

                  <View style={S.grid2}>
                    {metrics.map(m => (
                      <Metric
                        key={m.key}
                        value={m.value}
                        label={m.label}
                        tone={
                          m.key === 'Overdue' ||
                          m.key === 'Critical' ||
                          m.key === 'Reverted'
                            ? 'red'
                            : m.key === 'Closed'
                            ? 'green'
                            : undefined
                        }
                        onPress={() => applyFilters(METRIC_FILTER[m.key] || {})}
                      />
                    ))}
                  </View>

                  {/* Cluster head sees SLA Performance; everyone else, closure. */}
                  {ticketRole === TICKET_ROLE.CLUSTER_HEAD ? (
                    <SLACard
                      pct={dash.slaCompliance ?? 0}
                      target={dash.slaTarget ?? 90}
                      breached={dash.slaBreached ?? 0}
                    />
                  ) : (
                    <View style={S.card}>
                      <View style={S.split}>
                        <Text style={S.bold}>{closureTitle(ticketRole)}</Text>
                        <Text style={S.tiny}>{dash.closurePct ?? 0}%</Text>
                      </View>
                      <View style={{ height: 10 }} />
                      <ProgressBar pct={dash.closurePct ?? 0} />
                      <Text style={[S.tiny, { marginTop: 10 }]}>
                        {closureBlurb(ticketRole)}
                      </Text>
                    </View>
                  )}

                  {/* Where the pressure is. The cluster head's two breakdowns
                      from the mockup; management gets the same across the group. */}
                  {(ticketRole === TICKET_ROLE.CLUSTER_HEAD ||
                    ticketRole === TICKET_ROLE.SUPER_ADMIN) && (
                    <>
                      <ListTitle hint="Tap row to filter">
                        {ticketRole === TICKET_ROLE.CLUSTER_HEAD
                          ? 'Location-wise Open Tickets'
                          : 'Open tickets by branch'}
                        {!filters.status && !filters.statusExact && (
                          <Text
                            style={[S.tiny, { marginTop: -4, marginBottom: 8 }]}
                          >
                            Closed and sent-back tickets are hidden. Filter
                            Status to see them.
                          </Text>
                        )}
                      </ListTitle>
                      <BreakdownList
                        rows={(dash.byBranch || []).filter(r => r.open > 0)}
                        nameKey="branch"
                        onPress={r =>
                          applyFilters({ branch: r.branch, status: 'Open' })
                        }
                        emptyText="No open tickets at any of your branches."
                      />

                      <ListTitle hint="Tap row to filter">
                        Department Pressure
                      </ListTitle>
                      <BreakdownList
                        rows={(dash.byDepartment || []).filter(r => r.open > 0)}
                        nameKey="department"
                        onPress={r =>
                          applyFilters({
                            department: r.department,
                            status: 'Open',
                          })
                        }
                        emptyText="No department is carrying open work."
                      />
                    </>
                  )}

                  {ticketRole === TICKET_ROLE.SUPER_ADMIN && (
                    <View style={S.card}>
                      <View style={S.split}>
                        <Text style={S.bold}>Ageing</Text>
                        <Text style={S.tiny}>Still unresolved</Text>
                      </View>
                      <View
                        style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}
                      >
                        <AgeCell n={dash.aging?.month1} label="Over 1 month" />
                        <AgeCell n={dash.aging?.month3} label="Over 3 months" />
                        <AgeCell n={dash.aging?.month6} label="Over 6 months" />
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* ── The list ────────────────────────────────────────────── */}
              {showList && (
                <>
                  <View
                    style={[
                      S.card,
                      { paddingVertical: 12, paddingHorizontal: 14 },
                      tab === 'tickets' && { marginTop: 0 },
                    ]}
                  >
                    <View style={S.split}>
                      <Text style={[S.bold, { flex: 1 }]} numberOfLines={1}>
                        {activeFilterLabel}
                      </Text>
                      <Btn
                        label="Clear"
                        secondary
                        small
                        onPress={() => applyFilters({}, { goToList: false })}
                      />
                    </View>
                  </View>

                  <FilterBar
                    filters={filters}
                    onChange={applyFilters}
                    meta={meta}
                    branches={locationArray || []}
                    showMine={
                      ticketRole === TICKET_ROLE.PARTNER ||
                      ticketRole === TICKET_ROLE.CLUSTER_HEAD
                    }
                  />

                  {tickets.length ? (
                    tickets.map(t => (
                      <TicketCard
                        key={t.ticketId}
                        ticket={t}
                        onPress={() => openTicket(t)}
                        footer={<TicketFooter ticket={t} />}
                      />
                    ))
                  ) : (
                    <Empty>{emptyCopy(ticketRole, filters)}</Empty>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      <BottomNav tabs={tabs} active={tab} onChange={setTab} />
      <Toast message={toastMsg} />

      <AppDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        active="ticketing"
      />
    </SafeAreaView>
  );
};

export default TicketingHome;

// ─── bits ────────────────────────────────────────────────────────────────────

/**
 * What the cluster head personally owes the queue, above the statistics.
 *
 * The mockup's four tiles are all counts of what exists — none of them says
 * "nothing moves until you act". A ticket at `Open` is waiting on this person's
 * approval, and one at `Reverted` came back because a department head said it
 * was theirs by mistake. Both stall the whole chain, so they lead. Nothing
 * shows when there is nothing to do.
 */
const ActionStrip = ({ dash, onGo, onApprovals }) => {
  const waiting = dash.byStatus?.Open || 0;
  const reverted = dash.byStatus?.Reverted || 0;
  if (!waiting && !reverted) return null;

  return (
    <View
      style={[
        S.card,
        { marginTop: 0, borderColor: C.green, backgroundColor: C.navActiveBg },
      ]}
    >
      <Text style={[S.bold, { marginBottom: 2 }]}>Waiting on you</Text>
      <Text style={S.tiny}>Nothing moves on these until you act.</Text>
      <View style={[S.row, { marginTop: 12 }]}>
        {waiting > 0 && (
          <View style={S.rowItem}>
            <Btn
              label={`Approve ${waiting}`}
              small
              // Opens the Approvals tab, which lists exactly this set. It used to
              // apply a `status: 'Open'` list filter — but that filter means
              // "everything not closed" server-side, so a button reading
              // "Approve 3" could open a list of far more than 3. The tab uses
              // the exact status, so the number and the list always agree.
              onPress={onApprovals}
            />
          </View>
        )}
        {reverted > 0 && (
          <View style={S.rowItem}>
            <Btn
              label={`Re-route ${reverted}`}
              small
              danger
              // 'Reverted' isn't special-cased server-side, so this filter is
              // already exact — it stays a filtered list on the Tickets tab.
              onPress={() => onGo({ status: 'Reverted' })}
            />
          </View>
        )}
      </View>
    </View>
  );
};

/** Header title + sub for the current tab. */
function headerFor(tab, ticketRole, copy, department) {
  if (tab === 'tickets') {
    return {
      title: 'Ticket Tracker',
      sub: 'Every ticket from your branches. Filter it down, then open one to act on it.',
    };
  }
  if (tab === 'raise') {
    return {
      title: 'Raise Ticket',
      sub:
        ticketRole === TICKET_ROLE.CLUSTER_HEAD
          ? 'Raise on behalf of a branch in your cluster. It goes straight to the department head.'
          : 'Once submitted, your Cluster Head reviews it and sends it to the right department.',
    };
  }
  if (tab === 'approvals') {
    return {
      title: 'Pending Approval',
      sub: 'Tickets raised by your branches, waiting for you to approve or reject.',
    };
  }
  if (tab === 'team') {
    return {
      title: 'My Team',
      sub: `The people in ${
        department || 'your department'
      } who can be assigned tickets. Adding someone here also creates their login.`,
    };
  }
  return { title: copy.title, sub: copy.sub };
}

/**
 * The line under a ticket card: what is happening, and whose move it is.
 *
 * The cluster head mockup puts a free status dropdown here — see
 * docs/DECISIONS.md, "The status dropdown". This names the actions the server
 * says this person can actually take, and the card opens the ticket to take
 * them. Same job (know what to do without opening every card), without a
 * control that can forge a department's sign-off.
 */
const TicketFooter = ({ ticket }) => {
  const actions = (ticket.actions || []).filter(a => ACTION_WORD[a]);
  if (!actions.length) {
    return <Text style={[S.tiny, { marginTop: 10 }]}>{hintFor(ticket)}</Text>;
  }
  return (
    <Text style={[S.tiny, { marginTop: 10 }]}>
      <Text style={{ fontFamily: F.semibold, color: C.green }}>
        Your move: {actions.map(a => ACTION_WORD[a]).join(' or ')}
      </Text>
      <Text> · tap to act</Text>
    </Text>
  );
};

/** Short verbs for the card footer. The full labels live in TicketDetail. */
const ACTION_WORD = {
  approve: 'approve',
  reconsider: 'send back',
  sendToBranch: 'send to branch',
  fixedLocally: 'mark fixed',
  resolveLocal: 'resolve',
  closeLocal: 'close',
  progress: 'update progress',
  reassign: 're-assign',
  forward: 'forward',
  resolve: 'resolve',
  close: 'close',
  reopen: 'reopen',
};

function hintFor(ticket) {
  const map = {
    Open: 'Waiting for Cluster Head approval',
    'Sent Back': 'Sent back by the Cluster Head',
    Approved: `With the ${ticket.department} head`,
    'In Progress': `${ticket.department} is working on it`,
    'Waiting for Vendor': 'Blocked on a vendor',
    'With Branch': 'Being fixed at the branch',
    'Branch Fixed': 'Fixed — Cluster Head reviewing',
    Resolved: 'Resolved — waiting to be closed',
    Closed: 'Closed',
    Reopened: 'Reopened — back with the department',
  };
  return map[ticket.status] || ticket.status;
}

const AgeCell = ({ n, label }) => (
  <View
    style={{
      flex: 1,
      backgroundColor: C.bg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.line,
      padding: 12,
    }}
  >
    <Text
      style={{
        fontFamily: F.semibold,
        fontSize: 20,
        color: (n || 0) > 0 ? C.red : C.text,
      }}
    >
      {n || 0}
    </Text>
    <Text style={[S.tiny, { marginTop: 2 }]}>{label}</Text>
  </View>
);

function defaultListTitle(ticketRole) {
  switch (ticketRole) {
    case TICKET_ROLE.PARTNER:
      return 'My Branch Tickets';
    case TICKET_ROLE.CLUSTER_HEAD:
      return 'All Tickets';
    case TICKET_ROLE.DEPT_HEAD:
      return 'Department Queue';
    case TICKET_ROLE.DEPT_USER:
      return 'Assigned To Me';
    default:
      return 'All Tickets';
  }
}

function closureTitle(ticketRole) {
  return ticketRole === TICKET_ROLE.PARTNER
    ? 'My Ticket Closure'
    : 'Ticket Closure';
}

function closureBlurb(ticketRole) {
  switch (ticketRole) {
    case TICKET_ROLE.PARTNER:
      return 'This shows how many of your branch’s queries have been resolved or closed.';
    case TICKET_ROLE.CLUSTER_HEAD:
      return 'Share of your cluster’s tickets that have been resolved or closed.';
    case TICKET_ROLE.DEPT_HEAD:
      return 'Share of your department’s tickets that have been fixed and signed off.';
    case TICKET_ROLE.DEPT_USER:
      return 'Share of your assigned work that has been fixed and signed off.';
    default:
      return 'Share of all tickets resolved or closed. Rejected tickets are left out.';
  }
}

/** An empty list is an invitation, not a dead end — say what to do next. */
function emptyCopy(ticketRole, filters) {
  const filtered = Object.values(filters || {}).some(Boolean);
  if (filtered)
    return 'No tickets match this filter. Tap Clear to see everything.';
  switch (ticketRole) {
    case TICKET_ROLE.PARTNER:
      return 'Nothing raised at your branch yet. Tap Raise Ticket when something needs fixing.';
    case TICKET_ROLE.CLUSTER_HEAD:
      return 'Nothing from your branches yet. You’ll see tickets here as soon as they’re raised.';
    case TICKET_ROLE.DEPT_HEAD:
      return 'Your queue is clear. Approved tickets land here for you to assign.';
    case TICKET_ROLE.DEPT_USER:
      return 'Nothing assigned to you right now.';
    default:
      return 'No tickets found.';
  }
}
