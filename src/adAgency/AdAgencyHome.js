/* eslint-disable prettier/prettier */
// src/adAgency/AdAgencyHome.js
// ─────────────────────────────────────────────────────────────────────────────
// Landing screen for role === 'AdAgency' (route 'leadsStats', see EnterMobile /
// VerifyOTP). Two views on one route:
//
//   dashboard   all assigned branches — LeadsStatsDashboard
//   branch      one branch's lead list — BranchLeadsList (mobiles masked)
//
// Kept on one route so App.tsx and the login hand-off do not change; the
// hardware back button closes the branch view first, then exits the app as
// before.
//
// WHAT CHANGED FROM THE OLD SCREEN
//   • Shell palette and primitives (design/tokens.js) instead of ad-hoc colours
//   • Date range from the shared scope chip + ScopePicker (same presets as the
//     admin home) instead of a local Picker and a second modal
//   • Web call leads are a fourth source, included in "All"
//   • Branch-wise lead list, phone numbers masked by the server
//   • Branches scoped to the agency's assigned locations when it has any
//   • Logout through common/logout.js (resets the stack, clears caches)
// ─────────────────────────────────────────────────────────────────────────────

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import AgencyBranchLeads from '../agency/AgencyBranchLeads';
import { rangeKey } from '../api/queryCache';
import { cityOf } from '../common/cityMap';
import { logout } from '../common/logout';
import ScopePicker from '../design/components/ScopePicker';
import { T } from '../design/tokens';
import { scopeLabel, setPreset } from '../store/scopeSlice';
import AgencyBand from './AgencyBand';
import BranchLeadsList from './BranchLeadsList';
import { CHANNELS, channelOf, stageOf, viewOf } from './channels';
import { exportToExcel } from './ExportToExcel';
import LeadsStatsDashboard from './LeadsStatsDashboard';

// Counts are UNIQUE leads (one per phone); Entries / Duplicates show what
// was removed to get there.
const statRows = (stats, mode, google) =>
  [...stats]
    .sort(
      (a, b) =>
        cityOf(a.location).localeCompare(cityOf(b.location)) ||
        a.location.localeCompare(b.location),
    )
    .map(s => {
      const b = s[mode] || {};
      const total = b.total || 0;
      return {
        City: cityOf(s.location),
        Branch: s.location,
        'Unique Leads': total,
        Entries: b.entries || 0,
        Duplicates: b.duplicates || 0,
        Booked: b.appointment || 0,
        ...googleCols(google, s.location, mode, total),
        Visited: b.actualVisitCount || 0,
        IPD: b.ipd || 0,
        'Booked %':
          total === 0 ? 0 : Math.round(((b.appointment || 0) / total) * 100),
      };
    });

/** Google Ad count + share for a branch (Lead Stats: instead of Not Booked). */
const googleCols = (google, location, mode, total) => {
  if (mode === 'ivr' || !google) return { 'Google Ad': '', 'Google %': '' };
  const g =
    (google.branches || []).find(b => b.location === location)?.[mode]?.total ||
    0;
  return {
    'Google Ad': g,
    'Google %': total ? Math.round((g / total) * 100) : 0,
  };
};

/** Google leads (agency endpoint data) per branch, for one source. */
const googleBranchRows = (google, all, mode) =>
  (google?.branches || [])
    .slice()
    .sort(
      (a, b) =>
        cityOf(a.location).localeCompare(cityOf(b.location)) ||
        a.location.localeCompare(b.location),
    )
    .map(b => {
      const x = b[mode] || {};
      const allTotal =
        (all || []).find(a => a.location === b.location)?.[mode]?.total || 0;
      return {
        City: cityOf(b.location),
        Branch: b.location,
        'Google Leads': x.total || 0,
        Entries: x.entries || 0,
        Duplicates: x.duplicates || 0,
        Booked: x.appointment || 0,
        Visited: x.actualVisitCount || 0,
        IPD: x.ipd || 0,
        'Booked %': x.total
          ? Math.round(((x.appointment || 0) / x.total) * 100)
          : 0,
        'All Leads': allTotal,
        '% of All': allTotal
          ? Math.round(((x.total || 0) / allTotal) * 100)
          : 0,
      };
    });

/** Condition × branch, Google leads. */
const conditionRows = google => {
  const out = [];
  for (const b of google?.branches || []) {
    for (const [k, g] of Object.entries(b.conditions || {})) {
      const x = g.combined || {};
      if (!x.total && !x.duplicates) continue;
      out.push({
        Condition: k,
        City: cityOf(b.location),
        Branch: b.location,
        'Google Leads': x.total || 0,
        Duplicates: x.duplicates || 0,
        Booked: x.appointment || 0,
        Visited: x.actualVisitCount || 0,
        IPD: x.ipd || 0,
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.Condition.localeCompare(b.Condition) ||
      b['Google Leads'] - a['Google Leads'],
  );
};

/** Exact utm_term keywords, summed over branches. */
const termRows = google => {
  const by = {};
  for (const b of google?.branches || []) {
    for (const [term, t] of Object.entries(b.terms || {})) {
      const x = (by[term] = by[term] || {
        'Search Term': term,
        Condition: t.condition,
        'Google Leads': 0,
        Website: 0,
        Chatbot: 0,
        'Web call': 0,
      });
      x['Google Leads'] += t.combined || 0;
      x.Website += t.web || 0;
      x.Chatbot += t.chatbot || 0;
      x['Web call'] += t.webcall || 0;
    }
  }
  return Object.values(by).sort(
    (a, b) => b['Google Leads'] - a['Google Leads'],
  );
};

// Branches rolled into cities (cityMap — same as Branch Summary). Counts are
// summed; Booked % is recomputed from the sums, never averaged.
const cityRows = (stats, mode, google) => {
  const by = {};
  const gOf = loc =>
    mode === 'ivr' || !google
      ? 0
      : (google.branches || []).find(b => b.location === loc)?.[mode]?.total ||
        0;
  for (const s of stats) {
    const b = s[mode] || {};
    const c = (by[cityOf(s.location)] = by[cityOf(s.location)] || {
      City: cityOf(s.location),
      Branches: 0,
      'Unique Leads': 0,
      Entries: 0,
      Duplicates: 0,
      Booked: 0,
      'Google Ad': 0,
      Visited: 0,
      IPD: 0,
    });
    c.Branches += 1;
    c['Unique Leads'] += b.total || 0;
    c.Entries += b.entries || 0;
    c.Duplicates += b.duplicates || 0;
    c.Booked += b.appointment || 0;
    c['Google Ad'] += gOf(s.location);
    c.Visited += b.actualVisitCount || 0;
    c.IPD += b.ipd || 0;
  }
  return Object.values(by)
    .map(c => ({
      ...c,
      'Google %': c['Unique Leads']
        ? Math.round((c['Google Ad'] / c['Unique Leads']) * 100)
        : 0,
      'Booked %': c['Unique Leads']
        ? Math.round((c.Booked / c['Unique Leads']) * 100)
        : 0,
    }))
    .sort((a, b) => b['Unique Leads'] - a['Unique Leads']);
};

// One row per unique person = their LATEST lead, as seen from `source`
// ('combined' = all). Older leads appear only as the Duplicates count.
const leadRows = (leads, source) =>
  leads
    .map(l => viewOf(l, source))
    .filter(Boolean)
    .map(l => ({
      'Lead Date (latest)': l.date,
      'First Seen': l.firstDate || l.date,
      Source: channelOf(l.source || (l.sources || [])[0]).label,
      'Older Lead Sources': (l.sources || [])
        .slice(1)
        .map(k => channelOf(k).label)
        .join(', '),
      Entries: l.entries || 1,
      'Duplicates Removed': Math.max((l.entries || 1) - 1, 0),
      Name: l.name || '',
      'Mobile (masked)': l.phone || '',
      Treatment: l.treatment || '',
      Stage: stageOf(l).label,
      Booked: l.booked ? 'Yes' : 'No',
      Visited: l.visited ? 'Yes' : 'No',
      IPD: l.ipd ? 'Yes' : 'No',
      Detail: l.detail || '',
    }));

/** Google branch page rows (agency lead shape: campaign / term / condition). */
const googleLeadRows = (leads, source) =>
  leads
    .map(l => viewOf(l, source))
    .filter(Boolean)
    .map(l => ({
      'Lead Date (latest)': l.date,
      'First Seen': l.firstDate || l.date,
      Source: channelOf(l.source || (l.sources || [])[0]).label,
      'Search Term': l.term || '',
      Condition: l.condition || '',
      'Campaign ID': l.campaign === '(not tagged)' ? '' : l.campaign || '',
      Entries: l.entries || 1,
      'Duplicates Removed': Math.max((l.entries || 1) - 1, 0),
      Name: l.name || '',
      'Mobile (masked)': l.phone || '',
      Stage: stageOf(l).label,
      Booked: l.booked ? 'Yes' : 'No',
      Visited: l.visited ? 'Yes' : 'No',
      IPD: l.ipd ? 'Yes' : 'No',
    }));

// ⚠️ OPENS ON 'THIS MONTH' — ONCE PER APP LAUNCH (Branch Summary's rule): the
// first time this screen mounts after the app opens it switches the shared
// date scope to This Month; a range picked afterwards is kept until the app
// closes. Module-level on purpose — it resets when the app restarts.
let monthDefaulted = false;

export default function AdAgencyHome({ navigation }) {
  const dispatch = useDispatch();
  const scope = useSelector(st => st.scope);
  const locationArray = useSelector(st => st.location.locationArray);
  const role = useSelector(st => st.location.role);
  const branchValue = useSelector(st => st.location.value);
  const { from, to } = scope;
  // The stored-answer key for this range (src/leadStats/leadStatsApi.js).
  const scopeKey = rangeKey(scope);

  // Hold the first read until This Month is in place — otherwise every branch
  // would be read once for Today and again for the month.
  const [ready, setReady] = useState(
    () => monthDefaulted || scope.preset === 'month',
  );
  useEffect(() => {
    if (!monthDefaulted) {
      monthDefaulted = true;
      if (scope.preset !== 'month') dispatch(setPreset('month'));
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // INTERNAL MODE — this screen is also the Lead Stats Report in Leads & Calls
  // (route 'leadsStats'). The Ad Agency login now has its own screen
  // (src/agency/AgencyHome.js, route 'agencyLeads'). Internally it is a page
  // you came to, so back returns to the section instead of logging out /
  // closing the app.
  const internal = role !== 'AdAgency';

  const [branch, setBranch] = useState(null);
  // Which tab the branch was opened from: 'all' → the all-source lead list;
  // 'google' / 'terms' → the Google lead list (agency component, reused
  // unchanged), with the condition as a filter for 'terms'.
  const [branchCtx, setBranchCtx] = useState({ tab: 'all', filter: null });
  const [scopeOpen, setScopeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null); // { all, google } — for export
  const [branchData, setBranchData] = useState(null); // branch list, for export

  // ONLY the branches this login may see. Admin / SuperAdmin / CFO logins
  // carry them in locationArray; a single-branch login carries one branch in
  // location.value. Nothing → nothing is loaded (the server returns every
  // branch for a call with no branch list, so that call is never made).
  const locations =
    Array.isArray(locationArray) && locationArray.filter(Boolean).length
      ? locationArray.filter(Boolean)
      : typeof branchValue === 'string' && branchValue
      ? [branchValue]
      : [];

  // Back: branch → dashboard → (internal) previous screen / (agency) exit.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (branch) {
          setBranch(null);
          return true;
        }
        if (internal && navigation.canGoBack()) navigation.goBack();
        else BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }, [branch, internal, navigation]),
  );

  const onLogout = () =>
    Alert.alert('Log out?', 'You will need an OTP to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () =>
          logout({
            dispatch,
            navigation,
            onStart: () => setBusy(true),
            onFinally: () => setBusy(false),
          }),
      },
    ]);

  const runExport = async (sheets, fileName) => {
    try {
      setBusy(true);
      await exportToExcel({ sheets, fileName });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        console.error('Export Error:', e);
        Alert.alert('Export failed', e?.message || 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  };

  const exportDashboard = () => {
    const all = stats?.all || [];
    const google = stats?.google || null;
    if (!all.length && !google) {
      Alert.alert('Please wait', 'Statistics are still loading.');
      return;
    }
    runExport(
      [
        ...(all.length
          ? [
              { name: 'Citywise', data: cityRows(all, 'combined', google) },
              { name: 'Branchwise', data: statRows(all, 'combined', google) },
              ...CHANNELS.map(c => ({
                name: c.label,
                data: statRows(all, c.key, google),
              })),
            ]
          : []),
        ...(google
          ? [
              {
                name: 'Google branchwise',
                data: googleBranchRows(google, all, 'combined'),
              },
              { name: 'Search terms x Branch', data: conditionRows(google) },
              { name: 'Top search terms', data: termRows(google) },
            ]
          : []),
      ],
      `HHC_LeadStats_${from}_to_${to}`,
    );
  };

  const exportBranch = () => {
    if (!branchData) {
      Alert.alert('Please wait', 'Leads are still loading.');
      return;
    }
    const leads = branchData.leads || [];
    if (branchCtx.tab !== 'all') {
      const f = branchCtx.filter;
      const keep = l => !f || l.condition === f.value;
      runExport(
        [
          {
            name: 'Google leads',
            data: googleLeadRows(leads, 'combined').filter((_, i) =>
              keep(leads[i]),
            ),
          },
          ...CHANNELS.filter(c => c.key !== 'ivr').map(c => ({
            name: c.label,
            data: googleLeadRows(
              leads.filter(l => !f || viewOf(l, c.key)?.condition === f.value),
              c.key,
            ),
          })),
        ],
        `HHC_GoogleLeads_${branch.replace(/\W+/g, '_')}${
          f ? `_${f.value.replace(/\W+/g, '_')}` : ''
        }_${from}_to_${to}`,
      );
      return;
    }
    runExport(
      [
        { name: 'All unique leads', data: leadRows(leads, 'combined') },
        ...CHANNELS.map(c => ({ name: c.label, data: leadRows(leads, c.key) })),
      ],
      `HHC_Leads_${branch.replace(/\W+/g, '_')}_${from}_to_${to}`,
    );
  };

  const range = from === to ? from : `${from} → ${to}`;
  const scopeText = scopeLabel(scope);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* The dashboard stays MOUNTED behind the branch view (hidden, not
          unmounted), so coming back keeps the open city, sort and scroll
          position and does not re-read every branch — the same reason
          Branch Summary is never re-mounted (see SummaryTabBar.js). */}
      <View style={[s.fill, branch && s.hidden]}>
        {locations.length === 0 ? (
          <>
            <AgencyBand
              eyebrow="LEADS & CALLS"
              title="Lead Stats Report"
              onBack={
                internal && navigation.canGoBack()
                  ? () => navigation.goBack()
                  : undefined
              }
              actions={
                internal
                  ? []
                  : [{ icon: 'logout', label: 'Log out', onPress: onLogout }]
              }
            />
            <View style={s.noAccess}>
              <Text style={s.noAccessText}>
                No branches are assigned to this login, so there are no leads to
                show.
              </Text>
            </View>
          </>
        ) : !ready ? (
          <View style={[s.fill, s.wait]}>
            <ActivityIndicator color={T.brand} />
          </View>
        ) : (
          <LeadsStatsDashboard
            from={from}
            to={to}
            locations={locations}
            scopeKey={scopeKey}
            onStatsLoaded={setStats}
            onSelectBranch={(loc, ctx) => {
              setBranchData(null);
              setBranchCtx(ctx || { tab: 'all', filter: null });
              setBranch(loc);
            }}
            band={
              <AgencyBand
                eyebrow={
                  internal
                    ? 'LEADS & CALLS · LEAD STATS'
                    : 'HEALING HANDS · LEADS'
                }
                title="Lead Stats Report"
                sub={`${range} · all leads, Google leads & search terms · unique leads${
                  internal
                    ? ` · ${locations.length} branch${
                        locations.length === 1 ? '' : 'es'
                      }`
                    : ''
                }`}
                // Internal: a page in Leads & Calls — back, no logout.
                onBack={
                  internal && navigation.canGoBack()
                    ? () => navigation.goBack()
                    : undefined
                }
                scopeText={scopeText}
                onScope={() => setScopeOpen(true)}
                actions={[
                  {
                    icon: 'file-download',
                    label: 'Export Excel',
                    onPress: exportDashboard,
                    disabled: !stats,
                  },
                  ...(internal
                    ? []
                    : [
                        { icon: 'logout', label: 'Log out', onPress: onLogout },
                      ]),
                ]}
              />
            }
          />
        )}
      </View>

      {!!branch && (
        <View style={s.fill}>
          {branchCtx.tab === 'all' ? (
            <BranchLeadsList
              key={branch}
              location={branch}
              from={from}
              to={to}
              scopeKey={scopeKey}
              onLoaded={setBranchData}
              band={
                <AgencyBand
                  eyebrow={`${cityOf(branch).toUpperCase()} · BRANCH LEADS`}
                  title={branch}
                  sub={`${range} · mobile numbers are hidden`}
                  onBack={() => setBranch(null)}
                  scopeText={scopeText}
                  onScope={() => setScopeOpen(true)}
                  actions={[
                    {
                      icon: 'file-download',
                      label: 'Export Excel',
                      onPress: exportBranch,
                      disabled: !branchData,
                    },
                  ]}
                />
              }
            />
          ) : (
            // Google leads of the branch — the Ad Agency's branch page,
            // reused unchanged (src/agency/AgencyBranchLeads.js, locked).
            <AgencyBranchLeads
              key={`${branch}|${branchCtx.filter?.value || ''}`}
              location={branch}
              from={from}
              to={to}
              scopeKey={scopeKey}
              filter={branchCtx.filter}
              onLoaded={setBranchData}
              band={
                <AgencyBand
                  eyebrow={`${cityOf(branch).toUpperCase()} · GOOGLE LEADS`}
                  title={branch}
                  sub={`${range} · utm_source google · mobile numbers are hidden`}
                  onBack={() => setBranch(null)}
                  scopeText={scopeText}
                  onScope={() => setScopeOpen(true)}
                  actions={[
                    {
                      icon: 'file-download',
                      label: 'Export Excel',
                      onPress: exportBranch,
                      disabled: !branchData,
                    },
                  ]}
                />
              }
            />
          )}
        </View>
      )}

      <ScopePicker visible={scopeOpen} onClose={() => setScopeOpen(false)} />

      {busy && (
        <View style={s.busy} pointerEvents="auto">
          <ActivityIndicator size="large" color={T.white} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // Top inset takes the band colour so the status-bar area matches the header.
  root: { flex: 1, backgroundColor: T.headerBg },
  fill: { flex: 1 },
  noAccess: {
    flex: 1,
    backgroundColor: T.canvas,
    padding: 24,
    alignItems: 'center',
  },
  noAccessText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: T.muted,
    textAlign: 'center',
    marginTop: 20,
  },
  hidden: { display: 'none' },
  wait: {
    backgroundColor: T.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,26,22,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
