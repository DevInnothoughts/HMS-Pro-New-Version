/* eslint-disable prettier/prettier */
// src/agency/AgencyHome.js
// ─────────────────────────────────────────────────────────────────────────────
// Landing screen for role === 'AdAgency' (route 'agencyLeads', from EnterMobile
// / VerifyOTP). GOOGLE leads only, Web · Bot · Web call — no IVR — across
// ALL branches (the agency is not limited to assigned branches).
//
//   dashboard   campaign-wise (or search-term-wise) — AgencyDashboard
//   branch      one branch's Google leads — AgencyBranchLeads, opened with the
//               tapped campaign / term as a filter
//
// The internal Lead Stats Report keeps src/adAgency/AdAgencyHome.js (route
// 'leadsStats', locked); this screen is the agency's own and shares only the
// band, the design tokens and the pure lead helpers with it.
//
// Same shell behaviour as before for the agency: hardware back closes the
// branch view, then exits the app; logout through common/logout.js; the
// dashboard stays mounted behind the branch view so coming back keeps the
// open campaign, sort and scroll without re-reading every branch.
// ─────────────────────────────────────────────────────────────────────────────

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import AgencyBand from '../adAgency/AgencyBand';
import { exportToExcel } from '../adAgency/ExportToExcel';
import { logout } from '../common/logout';
import ScopePicker from '../design/components/ScopePicker';
import { T } from '../design/tokens';
import { rangeKey } from '../api/queryCache';
import { scopeLabel, setPreset } from '../store/scopeSlice';
import AgencyBranchLeads from './AgencyBranchLeads';
import AgencyDashboard from './AgencyDashboard';
import {
  AGENCY_CHANNELS,
  campaignLabel,
  channelOf,
  stageOf,
  viewOf,
} from './agencyApi';

const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const bucketCols = b => ({
  'Unique Leads': b?.total || 0,
  Entries: b?.entries || 0,
  Duplicates: b?.duplicates || 0,
  Booked: b?.appointment || 0,
  'Not Booked': b?.notBooked || 0,
  Visited: b?.actualVisitCount || 0,
  IPD: b?.ipd || 0,
  'Booked %': pctOf(b?.appointment || 0, b?.total || 0),
});

/** Campaign (or condition) × branch rows for one source. */
const groupRows = (branches, group, mode, names) => {
  const out = [];
  for (const b of branches) {
    for (const [k, g] of Object.entries(b[group] || {})) {
      const x = g[mode];
      if (!x || (!x.total && !x.duplicates)) continue;
      out.push({
        [group === 'campaigns' ? 'Campaign' : 'Condition']:
          group === 'campaigns' ? campaignLabel(k, names) : k,
        ...(group === 'campaigns' ? { 'Campaign ID': k } : {}),
        Branch: b.location,
        ...bucketCols(x),
      });
    }
  }
  return out.sort((a, b) => b['Unique Leads'] - a['Unique Leads']);
};

const termRows = branches => {
  const by = {};
  for (const b of branches) {
    for (const [term, t] of Object.entries(b.terms || {})) {
      const x = (by[term] = by[term] || {
        'Search Term': term,
        Condition: t.condition,
        'Unique Leads': 0,
        Website: 0,
        Chatbot: 0,
        'Web call': 0,
      });
      x['Unique Leads'] += t.combined || 0;
      x.Website += t.web || 0;
      x.Chatbot += t.chatbot || 0;
      x['Web call'] += t.webcall || 0;
    }
  }
  return Object.values(by).sort(
    (a, b) => b['Unique Leads'] - a['Unique Leads'],
  );
};

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
      Campaign:
        l.campaign === '(not tagged)'
          ? 'Not tagged'
          : l.campaignName || l.campaign,
      'Campaign ID': l.campaign === '(not tagged)' ? '' : l.campaign,
      'Search Term': l.term || '',
      Condition: l.condition || '',
      Entries: l.entries || 1,
      'Duplicates Removed': Math.max((l.entries || 1) - 1, 0),
      Name: l.name || '',
      'Mobile (masked)': l.phone || '',
      Treatment: l.treatment || '',
      Stage: stageOf(l).label,
      Booked: l.booked ? 'Yes' : 'No',
      Visited: l.visited ? 'Yes' : 'No',
      IPD: l.ipd ? 'Yes' : 'No',
    }));

// ⚠️ OPENS ON 'THIS MONTH' — ONCE PER APP LAUNCH (Branch Summary's rule).
// The date scope is app-wide redux and starts on Today. This screen switches
// it to This Month the first time it mounts after the app opens; a range the
// agency then picks is kept until the app is closed. Module-level on purpose:
// it resets when the app restarts.
let monthDefaulted = false;

export default function AgencyHome({ navigation }) {
  const dispatch = useDispatch();
  const scope = useSelector(st => st.scope);
  const { from, to } = scope;
  // The stored-answer key for this range (see agencyApi — phone cache).
  const scopeKey = rangeKey(scope);

  // Hold the first read until This Month is in place — otherwise the
  // all-branch read would run once for Today and again for the month.
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

  const [branch, setBranch] = useState(null);
  const [branchFilter, setBranchFilter] = useState(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  const [branchData, setBranchData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (branch) {
          setBranch(null);
          return true;
        }
        BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }, [branch]),
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
    const branches = stats?.branches || [];
    if (!branches.length) {
      Alert.alert('Please wait', 'Statistics are still loading.');
      return;
    }
    const names = stats?.campaignNames || {};
    runExport(
      [
        {
          name: 'Campaign x Branch',
          data: groupRows(branches, 'campaigns', 'combined', names),
        },
        {
          name: 'Condition x Branch',
          data: groupRows(branches, 'conditions', 'combined', names),
        },
        { name: 'Search terms', data: termRows(branches) },
        {
          name: 'Branchwise',
          data: branches.map(b => ({
            Branch: b.location,
            ...bucketCols(b.combined),
          })),
        },
        ...AGENCY_CHANNELS.map(c => ({
          name: `${c.label} campaigns`,
          data: groupRows(branches, 'campaigns', c.key, names),
        })),
      ],
      `HHC_GoogleLeads_${from}_to_${to}`,
    );
  };

  const exportBranch = () => {
    if (!branchData) {
      Alert.alert('Please wait', 'Leads are still loading.');
      return;
    }
    const leads = branchData.leads || [];
    runExport(
      [
        { name: 'All Google leads', data: leadRows(leads, 'combined') },
        ...AGENCY_CHANNELS.map(c => ({
          name: c.label,
          data: leadRows(leads, c.key),
        })),
      ],
      `HHC_GoogleLeads_${branch.replace(/\W+/g, '_')}_${from}_to_${to}`,
    );
  };

  const range = from === to ? from : `${from} → ${to}`;
  const scopeText = scopeLabel(scope);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={[s.fill, branch && s.hidden]}>
        {!ready ? (
          <View style={[s.fill, s.wait]}>
            <ActivityIndicator color={T.brand} />
          </View>
        ) : (
          <AgencyDashboard
            from={from}
            to={to}
            scopeKey={scopeKey}
            onStatsLoaded={setStats}
            onSelectBranch={(loc, filter) => {
              setBranchData(null);
              setBranchFilter(filter || null);
              setBranch(loc);
            }}
            band={
              <AgencyBand
                eyebrow="HEALING HANDS · GOOGLE LEADS"
                title="Campaign Leads"
                sub={`${range} · Web, Bot & Web call · utm_source google · unique leads`}
                scopeText={scopeText}
                onScope={() => setScopeOpen(true)}
                actions={[
                  {
                    icon: 'file-download',
                    label: 'Export Excel',
                    onPress: exportDashboard,
                    disabled: !stats,
                  },
                  { icon: 'logout', label: 'Log out', onPress: onLogout },
                ]}
              />
            }
          />
        )}
      </View>

      {!!branch && (
        <View style={s.fill}>
          <AgencyBranchLeads
            key={`${branch}|${branchFilter?.type || ''}|${
              branchFilter?.value || ''
            }`}
            location={branch}
            from={from}
            to={to}
            scopeKey={scopeKey}
            filter={branchFilter}
            onLoaded={setBranchData}
            band={
              <AgencyBand
                eyebrow="BRANCH · GOOGLE LEADS"
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
  root: { flex: 1, backgroundColor: T.headerBg },
  fill: { flex: 1 },
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
