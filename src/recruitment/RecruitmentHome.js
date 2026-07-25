// ═══════════════════════════════════════════════════════════════════════════
//  Recruitment home — the shell: dashboard, requisition list, and the MRF form.
//
//  Requirement 7 asks for a dashboard per role, and they genuinely differ:
//
//    Cluster Head   what I asked for and where it has got to. Breakdown by
//                   department, because they raise across several.
//    Dept Head (HR) the work queue: what needs reviewing, what is running late,
//                   the pipeline by stage, and who is joining soon.
//    SuperAdmin     the group view: positions asked vs filled, by location.
//    Dept User      no dashboard at all — just the positions they are working.
//
//  Raising sits in the Requisitions header as "＋ New", not a tab, for the same
//  reason as on the ticket screen: it is an occasional errand next to a daily job.
// ═══════════════════════════════════════════════════════════════════════════

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

import {
  buildActor,
  fetchDashboard,
  fetchRequests,
  getAllBranches,
  getMeta,
} from './api';
import RaiseMRF from './RaiseMRF';
import {
  NEXT_STEP,
  RECRUITMENT_COPY,
  RECRUITMENT_METRIC_FILTER,
  STATUS_TONE,
  TICKET_ROLE,
  canRaiseMRF,
  metricsForRecruitment,
  resolveTicketRole,
  tabsForRecruitment,
} from './roles';
import AppDrawer from '../common/AppDrawer';
import {
  Badge,
  BottomNav,
  BreakdownList,
  Btn,
  Empty,
  FilterBar,
  ListTitle,
  Metric,
  ScreenHeader,
  Toast,
  useToast,
} from '../ticketing/components';
import { C, F, S } from '../ticketing/theme';

const fmt = d => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const m = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${dt.getDate()} ${m[dt.getMonth()]}`;
};

// ─── One requisition in a list ───────────────────────────────────────────────
// A colour stripe carries urgency so the status doesn't have to compete with
// four other badges, and the fill counter is the number people actually chase.
const RequestCard = ({ req, onPress }) => (
  <TouchableOpacity
    style={[
      S.card,
      {
        marginTop: 0,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: req.overdue
          ? C.red
          : req.status === 'Submitted'
          ? C.orange
          : req.status === 'Closed' || req.status === 'Rejected'
          ? C.line
          : C.green,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`${req.position} at ${req.location}, ${req.status}`}
  >
    <View style={S.split}>
      <Text style={S.ticketId}>{req.id}</Text>
      <Badge tone={STATUS_TONE[req.status]}>{req.status}</Badge>
    </View>

    <Text style={[S.ticketTitle, { marginTop: 2 }]}>
      {req.position}
      {req.numberOfPositions > 1 ? `  ×${req.numberOfPositions}` : ''}
    </Text>

    <Text style={[S.ticketMeta, { marginTop: 4 }]}>
      {req.unit} · {req.forDepartment} · {req.employmentType}
    </Text>

    <Text style={[S.ticketMeta, { marginTop: 2 }]}>
      {NEXT_STEP[req.status]}
      {req.assigneeName ? ` · ${req.assigneeName}` : ''}
    </Text>

    <View style={[S.split, { marginTop: 10 }]}>
      <Text style={S.tiny}>
        {req.positionsFilled} of {req.numberOfPositions} filled
      </Text>
      {req.overdue ? (
        <Text style={[S.tiny, { color: C.red, fontFamily: F.semibold }]}>
          Overdue
        </Text>
      ) : req.targetCloseDate ? (
        <Text style={S.tiny}>Target {fmt(req.targetCloseDate)}</Text>
      ) : null}
    </View>
  </TouchableOpacity>
);

// ─── The hiring pipeline, as a simple stacked bar ────────────────────────────
const Pipeline = ({ rows = [] }) => {
  const total = rows.reduce((n, r) => n + r.n, 0);
  if (!total) return null;
  const tone = [
    '#0b6b4b',
    '#0e8f65',
    '#3478f6',
    '#df8a28',
    '#8b5cf6',
    '#6d7b80',
  ];
  return (
    <View style={S.card}>
      <Text style={S.bold}>Hiring pipeline</Text>
      <Text style={[S.tiny, { marginTop: 2 }]}>
        Open requisitions by how far along they are.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          marginTop: 14,
        }}
      >
        {rows.map((r, i) => (
          <View
            key={r.stage}
            style={{ flex: r.n, backgroundColor: tone[i % tone.length] }}
          />
        ))}
      </View>
      <View style={{ marginTop: 12, gap: 6 }}>
        {rows.map((r, i) => (
          <View
            key={r.stage}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: tone[i % tone.length],
              }}
            />
            <Text style={[S.tiny, { flex: 1 }]}>{r.stage}</Text>
            <Text
              style={{ fontFamily: F.semibold, fontSize: 13, color: C.text }}
            >
              {r.n}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Who starts soon ─────────────────────────────────────────────────────────
// No names — the module stores none. A position and a date is what matters for
// planning a rota anyway.
const UpcomingJoiners = ({ rows = [] }) => {
  if (!rows.length) return null;
  return (
    <View style={S.card}>
      <Text style={S.bold}>Starting soon</Text>
      <Text style={[S.tiny, { marginTop: 2, marginBottom: 10 }]}>
        Positions with a joining date ahead.
      </Text>
      {rows.map((j, i) => (
        <View
          key={`${j.requestRef}-${i}`}
          style={[
            S.split,
            {
              paddingVertical: 8,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: C.line,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: F.medium, fontSize: 13.5, color: C.text }}
            >
              {j.position}
            </Text>
            <Text style={S.tiny}>
              {j.unit} · {j.department}
            </Text>
          </View>
          <Text
            style={{ fontFamily: F.semibold, fontSize: 13, color: C.green }}
          >
            {fmt(j.joiningDate)}
          </Text>
        </View>
      ))}
    </View>
  );
};

const RecruitmentHome = ({ navigation }) => {
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const ticketRole = resolveTicketRole(role, subRole);

  const tabs = useMemo(() => tabsForRecruitment(ticketRole), [ticketRole]);
  const copy =
    RECRUITMENT_COPY[ticketRole] || RECRUITMENT_COPY[TICKET_ROLE.DEPT_USER];

  const [tab, setTab] = useState(tabs[0]?.key || 'requests');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actor, setActor] = useState(null);
  const [meta, setMeta] = useState(null);
  const [dash, setDash] = useState({});
  const [requests, setRequests] = useState([]);
  const [review, setReview] = useState([]);
  const [filters, setFilters] = useState({});
  const [toastMsg, toast] = useToast();

  const hasReviewTab = useMemo(
    () => tabs.some(t => t.key === 'review'),
    [tabs],
  );

  // Units for the filter. A Cluster Head filters within their own; a SuperAdmin
  // or HR head watches every clinic, so they get the company-wide list.
  const seesAllUnits =
    ticketRole === TICKET_ROLE.SUPER_ADMIN ||
    ticketRole === TICKET_ROLE.DEPT_HEAD;
  const [allUnits, setAllUnits] = useState([]);
  useEffect(() => {
    if (seesAllUnits) getAllBranches().then(setAllUnits);
  }, [seesAllUnits]);
  const unitOptions = useMemo(() => {
    if (seesAllUnits && allUnits.length) return allUnits;
    const list = Array.isArray(locationArray) ? [...locationArray] : [];
    if (location) list.unshift(location);
    return [...new Set(list.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [seesAllUnits, allUnits, location, locationArray]);

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

        // Settled independently, so one failing call can't silently blank another.
        const [metaR, dashR, listR, reviewR] = await Promise.allSettled([
          getMeta(),
          fetchDashboard(a),
          fetchRequests(a, nextFilters),
          hasReviewTab
            ? fetchRequests(a, { statusExact: 'Submitted' })
            : Promise.resolve(null),
        ]);

        if (metaR.status === 'fulfilled' && metaR.value) setMeta(metaR.value);
        if (dashR.status === 'fulfilled') setDash(dashR.value || {});
        if (reviewR.status === 'fulfilled' && reviewR.value) {
          setReview(reviewR.value.requests || []);
        }
        if (listR.status === 'fulfilled') {
          setRequests(listR.value?.requests || []);
        } else {
          console.log(
            'recruitment: fetchRequests failed',
            listR.reason?.message,
          );
          setRequests([]);
          setError(
            listR.reason?.message ||
              "Couldn't load requisitions. Pull to refresh.",
          );
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role, subRole, location, locationArray, filters, hasReviewTab],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Back: step out of a sub-screen first, then leave the section.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'raise') {
        setTab('requests');
        return true;
      }
      if (tab !== tabs[0]?.key) {
        setTab(tabs[0]?.key);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, tabs]);

  const applyFilters = next => {
    setFilters(next);
    load(next, true);
    if (tab === 'dashboard') setTab('requests');
  };

  const openRequest = r =>
    navigation.navigate('RecruitmentDetail', { id: r.id });

  const metrics = metricsForRecruitment(ticketRole, dash);
  const isBusy = loading && !refreshing;

  const head =
    tab === 'raise'
      ? { title: 'New Requisition', sub: 'Form HRM-F-2.1-01' }
      : tab === 'review'
      ? { title: 'To Review', sub: 'Requisitions waiting for your decision.' }
      : copy;

  const onRefresh = () => {
    setRefreshing(true);
    load(filters, true);
  };

  const list = tab === 'review' ? review : requests;

  return (
    <SafeAreaView style={S.screen} edges={['top']}>
      <ScreenHeader
        onMenu={() => setMenuOpen(true)}
        rolePill="Recruitment"
        title={head.title}
        sub={head.sub}
        right={
          canRaiseMRF(ticketRole) && tab !== 'raise' ? (
            <TouchableOpacity
              onPress={() => setTab('raise')}
              accessibilityRole="button"
              accessibilityLabel="Raise a new requisition"
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
                New
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {tab === 'raise' ? (
        <RaiseMRF
          meta={meta}
          actor={actor}
          ticketRole={ticketRole}
          onCancel={() => setTab('requests')}
          onDone={res => {
            setTab('requests');
            setFilters({});
            load({}, true);
            toast(res?.message || 'Requisition submitted to HR.');
          }}
        />
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
          {isBusy ? (
            <View style={{ paddingVertical: 44, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={C.green} />
            </View>
          ) : (
            <>
              {!!error && (
                <View
                  style={[
                    S.card,
                    { borderLeftWidth: 3, borderLeftColor: C.red },
                  ]}
                >
                  <Text style={[S.tiny, { color: C.red }]}>{error}</Text>
                </View>
              )}

              {/* ── Dashboard ── */}
              {tab === 'dashboard' && (
                <>
                  {/* The one thing needing action, called out first. */}
                  {ticketRole === TICKET_ROLE.DEPT_HEAD &&
                    (dash.byStatus?.Submitted || 0) > 0 && (
                      <View
                        style={[
                          S.card,
                          {
                            marginTop: 0,
                            borderColor: C.green,
                            backgroundColor: C.navActiveBg,
                          },
                        ]}
                      >
                        <Text style={[S.bold, { marginBottom: 2 }]}>
                          Waiting on you
                        </Text>
                        <Text style={S.tiny}>
                          {dash.byStatus.Submitted} requisition
                          {dash.byStatus.Submitted === 1 ? '' : 's'} need your
                          review.
                        </Text>
                        <Btn
                          label={`Review ${dash.byStatus.Submitted}`}
                          small
                          onPress={() => setTab('review')}
                          style={{ marginTop: 12 }}
                        />
                      </View>
                    )}

                  <View style={S.grid2}>
                    {metrics.map(m => (
                      <Metric
                        key={m.key}
                        value={m.value}
                        label={m.label}
                        tone={m.tone}
                        onPress={() =>
                          applyFilters(RECRUITMENT_METRIC_FILTER[m.key] || {})
                        }
                      />
                    ))}
                  </View>

                  {/* Positions asked vs filled — the number leaders care about. */}
                  {(dash.positions || 0) > 0 && (
                    <View style={S.card}>
                      <View style={S.split}>
                        <Text style={S.bold}>Positions filled</Text>
                        <Text
                          style={{
                            fontFamily: F.semibold,
                            fontSize: 13,
                            color: C.text,
                          }}
                        >
                          {dash.positionsFilled || 0} of {dash.positions || 0}
                        </Text>
                      </View>
                      <View style={[S.progress, { marginTop: 12 }]}>
                        <View
                          style={[
                            S.bar,
                            {
                              width: `${Math.min(
                                Math.round(
                                  ((dash.positionsFilled || 0) /
                                    (dash.positions || 1)) *
                                    100,
                                ),
                                100,
                              )}%`,
                              backgroundColor: C.green,
                            },
                          ]}
                        />
                      </View>
                      {/* Withdrawn demand is excluded from the count above —
                          you did not fail to fill a position you cancelled —
                          but it is said out loud so it doesn't just vanish. */}
                      {(dash.positionsWithdrawn || 0) > 0 && (
                        <Text style={[S.tiny, { marginTop: 8 }]}>
                          {dash.positionsWithdrawn} position
                          {dash.positionsWithdrawn === 1 ? '' : 's'} withdrawn
                          (rejected or closed unfilled) — not counted above.
                        </Text>
                      )}
                    </View>
                  )}

                  {(ticketRole === TICKET_ROLE.DEPT_HEAD ||
                    ticketRole === TICKET_ROLE.SUPER_ADMIN) && (
                    <Pipeline rows={dash.pipeline || []} />
                  )}

                  <UpcomingJoiners rows={dash.upcomingJoiners || []} />

                  {/* A Cluster Head raises across departments; a SuperAdmin
                      watches locations. Show each what they compare. */}
                  {(dash.byDepartment || []).length > 0 && (
                    <>
                      <ListTitle hint="Tap to filter">
                        Open positions by department
                      </ListTitle>
                      <BreakdownList
                        rows={dash.byDepartment}
                        nameKey="department"
                        countKey="positions"
                        countLabel="Positions"
                        onPress={r =>
                          applyFilters({
                            department: r.department,
                            status: 'Open',
                          })
                        }
                        emptyText="No open positions."
                      />
                    </>
                  )}

                  {(dash.byUnit || []).length > 0 &&
                    ticketRole !== TICKET_ROLE.CLUSTER_HEAD && (
                      <>
                        <ListTitle hint="Tap to filter">
                          Open positions by unit
                        </ListTitle>
                        <BreakdownList
                          rows={dash.byUnit}
                          nameKey="unit"
                          countKey="positions"
                          countLabel="Positions"
                          onPress={r =>
                            applyFilters({ unit: r.unit, status: 'Open' })
                          }
                          emptyText="No open positions."
                        />
                      </>
                    )}
                </>
              )}

              {/* ── Lists ── */}
              {(tab === 'requests' || tab === 'review') && (
                <>
                  {/* The To Review tab is already one fixed filter, so a filter
                      bar there would only let someone contradict it. */}
                  {tab === 'requests' && (
                    <FilterBar
                      filters={filters}
                      onChange={applyFilters}
                      showMine={canRaiseMRF(ticketRole)}
                      mineLabel="Raised by me"
                      chips={[{ key: 'overdue', value: '1', label: 'Overdue' }]}
                      fields={[
                        {
                          key: 'statusExact',
                          label: 'Status',
                          any: 'Any status',
                          options: meta?.statuses || [],
                        },
                        {
                          key: 'department',
                          label: 'Department',
                          any: 'Any department',
                          options: meta?.departments || [],
                        },
                        {
                          key: 'unit',
                          label: 'Unit',
                          any: 'Any unit',
                          options: unitOptions,
                          minOptions: 2,
                        },
                        {
                          key: 'employmentType',
                          label: 'Type',
                          any: 'Any type',
                          options: meta?.employmentTypes || [],
                        },
                      ]}
                    />
                  )}

                  {tab === 'review' && list.length > 0 && (
                    <View
                      style={[S.card, { marginTop: 0, paddingVertical: 12 }]}
                    >
                      <Text style={S.bold}>
                        {list.length} requisition{list.length === 1 ? '' : 's'}{' '}
                        waiting on you
                      </Text>
                      <Text style={[S.tiny, { marginTop: 2 }]}>
                        Nothing moves on these until you approve or reject them.
                      </Text>
                    </View>
                  )}

                  {list.length ? (
                    list.map(r => (
                      <RequestCard
                        key={r.requestId}
                        req={r}
                        onPress={() => openRequest(r)}
                      />
                    ))
                  ) : (
                    <Empty>
                      {tab === 'review'
                        ? 'Nothing is waiting for your review.'
                        : Object.keys(filters).length
                        ? 'No requisitions match these filters. Tap All to clear them.'
                        : canRaiseMRF(ticketRole)
                        ? 'No requisitions yet. Tap ＋ New to raise one.'
                        : 'No requisitions assigned to you.'}
                    </Empty>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {tab !== 'raise' && (
        <BottomNav tabs={tabs} active={tab} onChange={setTab} />
      )}

      <AppDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        active="recruitment"
      />
      <Toast message={toastMsg} />
    </SafeAreaView>
  );
};

export default RecruitmentHome;
