/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/**
 * LeadsStatsDashboard.tsx
 * The internal LEAD STATS REPORT (Leads & Calls → 'leadsStats') — three tabs:
 *
 *   All leads     city → branch → lead list. Web · Bot · Web call · IVR.
 *                 GOOGLE AD column (instead of NOT BOOKED): how many of those
 *                 unique leads came from Google Ads, and GOOGLE % of the total.
 *   Google leads  city → branch → Google lead list. utm_source google /
 *                 google_ads, Web · Bot · Web call (IVR carries no UTM).
 *                 % OF ALL: the branch's Google leads as a share of its leads.
 *   Search terms  condition (Piles, Fistula…) → branch → lead list filtered to
 *                 that condition, + the top exact utm_term keywords. Google
 *                 leads only — the same view the Ad Agency gets (no campaigns).
 *
 * Data (src/leadStats/leadStatsApi.js), both scoped to this login's branches
 * and both STORED ON THE PHONE — the server is asked again only on
 * pull-to-refresh:
 *   All leads      /leadsStats/v2/all
 *   Google, terms  /agencyLeads/stats  (the agency endpoint, read unchanged)
 * The two load side by side; if one fails the other's tabs still work.
 *
 * Every count is UNIQUE leads (one per phone, latest kept) except DUP.
 * GOOGLE AD ≤ UNIQUE always: Google leads are de-duplicated among themselves
 * (Google filter first), so a person whose latest enquiry was organic but who
 * once came from an ad still counts as a Google lead — and once in UNIQUE.
 * Cities: src/common/cityMap.js (Branch Summary's map). City figures are summed
 * from branches; every % is recomputed from the sums, never averaged.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { updatedLabel } from '../api/queryCache';
import { cityOf } from '../common/cityMap';
import {
  MetricGrid,
  Segmented,
  SectionHead,
} from '../design/components/primitives';
import { F, R, T, num, pct, tint } from '../design/tokens';
import {
  GOOGLE_CHANNELS,
  fetchAllStats,
  fetchGoogleStats,
} from '../leadStats/leadStatsApi';
import TopTerms from '../leadStats/TopTerms';
import { ALL, CHANNELS, bucketOf, channelOf, sumBuckets } from './channels';
import LeadCityTable from './LeadCityTable';

type Tab = 'all' | 'google' | 'terms';
type Dir = 'desc' | 'asc';

const TABS = [
  { value: 'all', label: 'All leads' },
  { value: 'google', label: 'Google leads' },
  { value: 'terms', label: 'Search terms' },
];

// ─── Columns per tab ─────────────────────────────────────────────────────────
const C = {
  total: {
    key: 'total',
    head: 'UNIQUE',
    w: 64,
    spoken: 'unique leads',
    sort: 'Unique',
  },
  duplicates: {
    key: 'duplicates',
    head: 'DUP',
    w: 52,
    spoken: 'duplicates',
    sort: 'Dup',
  },
  appointment: {
    key: 'appointment',
    head: 'BOOKED',
    w: 64,
    spoken: 'booked',
    sort: 'Booked',
  },
  google: {
    key: 'google',
    head: 'GOOGLE AD',
    w: 76,
    spoken: 'Google ad leads',
    sort: 'Google Ad',
  },
  googlePct: {
    key: 'googlePct',
    head: 'GOOGLE %',
    w: 72,
    spoken: 'Google percent',
    pct: true,
    sort: 'Google %',
  },
  visited: {
    key: 'actualVisitCount',
    head: 'VISITED',
    w: 64,
    spoken: 'visited',
    sort: 'Visited',
  },
  ipd: { key: 'ipd', head: 'IPD', w: 50, spoken: 'IPD', sort: 'IPD' },
  bookedPct: {
    key: 'bookedPct',
    head: 'BKD %',
    w: 58,
    spoken: 'booked percent',
    pct: true,
    sort: 'Booked %',
  },
  shareOfAll: {
    key: 'shareOfAll',
    head: '% OF ALL',
    w: 70,
    spoken: 'percent of all leads',
    pct: true,
    sort: '% of all',
  },
};
const COLS: Record<Tab, any[]> = {
  all: [
    C.total,
    C.duplicates,
    C.appointment,
    C.google,
    C.googlePct,
    C.visited,
    C.ipd,
    C.bookedPct,
  ],
  google: [
    C.total,
    C.duplicates,
    C.appointment,
    C.visited,
    C.ipd,
    C.bookedPct,
    C.shareOfAll,
  ],
  terms: [C.total, C.duplicates, C.appointment, C.visited, C.ipd, C.bookedPct],
};

const n0 = (v: any) => Number(v) || 0;
const pctOrNull = (a: any, b: any) => (n0(b) > 0 ? pct(n0(a), n0(b)) : null);

/** Unknown figures sort last in either direction; ties A–Z. */
const makeSort = (key: string, dir: Dir) => (a: any, b: any) => {
  const name = (x: any) => String(x.name || x.location);
  const va = a[key];
  const vb = b[key];
  if (va == null && vb == null) return name(a).localeCompare(name(b));
  if (va == null) return 1;
  if (vb == null) return -1;
  const d = dir === 'asc' ? n0(va) - n0(vb) : n0(vb) - n0(va);
  return d || name(a).localeCompare(name(b));
};

const BASE = [
  'total',
  'duplicates',
  'appointment',
  'notBooked',
  'actualVisitCount',
  'ipd',
];
const rowOf = (b: any) => {
  const r: any = {};
  BASE.forEach(k => (r[k] = n0(b?.[k])));
  r.bookedPct = pctOrNull(r.appointment, r.total);
  return r;
};

/** Sum branch rows into a group row; % columns recomputed from the sums. */
const roll = (rows: any[]) => {
  const s: any = {};
  [...BASE, 'google', '_all'].forEach(
    k => (s[k] = rows.reduce((a, r) => a + n0(r[k]), 0)),
  );
  const anyGoogle = rows.some(r => r.google != null);
  if (!anyGoogle) s.google = null;
  s.bookedPct = pctOrNull(s.appointment, s.total);
  s.googlePct = s.google == null ? null : pctOrNull(s.google, s.total);
  s.shareOfAll = pctOrNull(s.total, s._all);
  return s;
};

// ─── Source filter: stacked bar + chips ──────────────────────────────────────
const SourceMix = ({ stats, channels, mode, onPick, allLabel }: any) => {
  const rows = channels.map((c: any) => ({
    ...c,
    total: sumBuckets(stats, c.key).total,
  }));
  const segTotal = rows.reduce((a: number, r: any) => a + r.total, 0);
  const combined = sumBuckets(stats, 'combined');
  const overlap = combined.crossSource || 0;
  const all = { ...ALL, short: 'All', label: allLabel, total: combined.total };

  return (
    <View style={s.card}>
      <View style={s.mixBar}>
        {segTotal === 0 ? (
          <View style={{ flex: 1, backgroundColor: T.lineSoft }} />
        ) : (
          rows
            .filter((r: any) => r.total > 0)
            .map((r: any) => (
              <View
                key={r.key}
                style={{ flex: r.total, backgroundColor: r.hue }}
              />
            ))
        )}
      </View>
      <View style={s.mixLegend}>
        {[all, ...rows].map((r: any) => {
          const on = mode === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => onPick(r.key)}
              style={[
                s.mixItem,
                on && { borderColor: r.hue, backgroundColor: tint(r.hue) },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${r.label}, ${r.total} unique leads. Show in table`}
            >
              <View style={[s.mixDot, { backgroundColor: r.hue }]} />
              <Text style={[s.mixLabel, on && { color: T.text }]}>
                {r.short}
              </Text>
              <Text style={[s.mixVal, on && { color: r.hue }]}>
                {num(r.total)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {overlap > 0 && (
        <Text style={s.mixNote}>
          {num(overlap)} lead{overlap === 1 ? '' : 's'} came through more than
          one source — counted once in All (as their latest lead).
        </Text>
      )}
    </View>
  );
};

// ─── Screen body ─────────────────────────────────────────────────────────────
export default function LeadsStatsDashboard({
  from,
  to,
  locations,
  scopeKey,
  band,
  onStatsLoaded,
  onSelectBranch,
}: {
  from: string;
  to: string;
  locations: string[];
  scopeKey?: string;
  band?: React.ReactNode;
  onStatsLoaded?: (d: { all: any[] | null; google: any | null } | null) => void;
  onSelectBranch?: (location: string, ctx: { tab: Tab; filter?: any }) => void;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [allRes, setAllRes] = useState<any>(null); // { data, updatedAt }
  const [gRes, setGRes] = useState<any>(null);
  const [allErr, setAllErr] = useState<string | null>(null);
  const [gErr, setGErr] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState('combined');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState<Dir>('desc');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { width: winW } = useWindowDimensions();
  const have = useRef({ all: false, google: false });

  const locKey = (locations || []).join(',');

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setRefreshError(null);
      if (!isRefresh) {
        setAllErr(null);
        setGErr(null);
      }
      // Stored answers first; the server only on pull-to-refresh (force).
      const args = { from, to, locations, scopeKey, force: isRefresh };
      const [a, g] = await Promise.allSettled([
        fetchAllStats(args),
        fetchGoogleStats(args),
      ]);
      const failed: string[] = [];

      if (a.status === 'fulfilled') {
        setAllRes(a.value);
        setAllErr(null);
        have.current.all = true;
      } else if (isRefresh && have.current.all)
        failed.push(`All leads: ${a.reason?.message}`);
      else setAllErr(a.reason?.message || 'Failed to load statistics');

      if (g.status === 'fulfilled') {
        setGRes(g.value);
        setGErr(null);
        have.current.google = true;
      } else if (isRefresh && have.current.google)
        failed.push(`Google: ${g.reason?.message}`);
      else setGErr(g.reason?.message || 'Failed to load Google statistics');

      if (failed.length) setRefreshError(failed.join(' · '));
      setLoading(false);
      setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, locKey, scopeKey],
  );
  useEffect(() => {
    load();
  }, [load]);

  const all: any[] = useMemo(() => allRes?.data || [], [allRes]);
  const gBranches: any[] = useMemo(() => gRes?.data?.branches || [], [gRes]);
  useEffect(() => {
    onStatsLoaded?.(
      allRes || gRes
        ? { all: allRes?.data || null, google: gRes?.data || null }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRes, gRes]);

  const gBy = useMemo(
    () => new Map(gBranches.map(b => [b.location, b])),
    [gBranches],
  );
  const aBy = useMemo(() => new Map(all.map(b => [b.location, b])), [all]);

  // IVR exists only in All leads.
  const changeTab = (t: Tab) => {
    setTab(t);
    setOpenGroup(null);
    setQuery('');
    if (t !== 'all' && mode === 'ivr') setMode('combined');
    if (!COLS[t].some(c => c.key === sortKey)) {
      setSortKey('total');
      setSortDir('desc');
    }
  };
  const sortBy = (key: string) => {
    if (key === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const cols = COLS[tab];
  const activeErr = tab === 'all' ? allErr : gErr;
  const updatedAt = tab === 'all' ? allRes?.updatedAt : gRes?.updatedAt;

  // ── Branch rows for the active tab and source ──
  const branchRows = useMemo(() => {
    if (tab === 'all') {
      return all.map(b => {
        const r: any = {
          location: b.location,
          partial: !!b.partial,
          ...rowOf(bucketOf(b, mode)),
        };
        const g = gBy.get(b.location);
        r.google = mode === 'ivr' || (!g && gErr) ? null : n0(g?.[mode]?.total);
        r.googlePct = r.google == null ? null : pctOrNull(r.google, r.total);
        return r;
      });
    }
    if (tab === 'google') {
      return gBranches.map(b => {
        const r: any = {
          location: b.location,
          partial: !!b.partial,
          ...rowOf(b[mode]),
        };
        const a = aBy.get(b.location);
        r._all = a ? n0(a[mode]?.total) : 0;
        r.shareOfAll = a ? pctOrNull(r.total, r._all) : null;
        return r;
      });
    }
    return [];
  }, [tab, all, gBranches, mode, gBy, aBy, gErr]);

  // ── Groups: cities (All / Google) or conditions (Search terms) ──
  const groups = useMemo(() => {
    const by = makeSort(sortKey, sortDir);
    const acc: Record<string, any[]> = {};
    if (tab === 'terms') {
      for (const b of gBranches) {
        for (const [k, buckets] of Object.entries<any>(b.conditions || {})) {
          const r = rowOf(buckets[mode]);
          if (r.total === 0 && r.duplicates === 0) continue;
          (acc[k] = acc[k] || []).push({
            location: b.location,
            partial: !!b.partial,
            ...r,
          });
        }
      }
    } else {
      for (const r of branchRows)
        (acc[cityOf(r.location)] = acc[cityOf(r.location)] || []).push(r);
    }
    return Object.entries(acc).map(([name, rows]) => ({
      name,
      branches: [...rows].sort(by),
      ...roll(rows),
    }));
  }, [tab, gBranches, branchRows, mode, sortKey, sortDir]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? groups.filter(
          g =>
            g.name.toLowerCase().includes(q) ||
            g.branches.some((b: any) =>
              String(b.location).toLowerCase().includes(q),
            ),
        )
      : [...groups];
    return list.sort(makeSort(sortKey, sortDir));
  }, [groups, query, sortKey, sortDir]);

  const effectiveOpen = query && rows.length === 1 ? rows[0].name : openGroup;

  // ── Totals (the table's last row and the metric cards) ──
  const totals = useMemo(() => {
    if (tab === 'all') {
      const t: any = { ...sumBuckets(all, mode) };
      t.google =
        mode === 'ivr' || gErr ? null : n0(sumBuckets(gBranches, mode).total);
      return t;
    }
    const t: any = { ...sumBuckets(gBranches, mode) };
    t._all = n0(sumBuckets(all, mode).total);
    return t;
  }, [tab, all, gBranches, mode, gErr]);

  const totalX = useMemo(() => {
    if (!rows.length || query) return null;
    const r: any = rowOf(totals);
    r.google = totals.google ?? null;
    r.googlePct = r.google == null ? null : pctOrNull(r.google, r.total);
    r.shareOfAll = pctOrNull(r.total, totals._all);
    return r;
  }, [rows, query, totals]);

  const metrics =
    tab === 'all'
      ? [
          {
            key: 'u',
            label: 'Unique leads',
            value: num(totals.total),
            note: `from ${num(totals.entries)} entries`,
          },
          {
            key: 'd',
            label: 'Duplicates',
            value: num(totals.duplicates),
            note: `${pct(
              totals.duplicates,
              totals.entries,
            )}% of entries removed`,
            dir: totals.duplicates > 0 ? 'down' : undefined,
          },
          {
            key: 'b',
            label: 'Booked',
            value: num(totals.appointment),
            note: `${pct(totals.appointment, totals.total)}% of unique leads`,
          },
          {
            key: 'g',
            label: 'Google Ad',
            value: totals.google == null ? '—' : num(totals.google),
            note:
              mode === 'ivr'
                ? 'IVR calls carry no ad data'
                : totals.google == null
                ? 'Google figures not loaded'
                : `${pct(totals.google, totals.total)}% of unique leads`,
          },
          {
            key: 'v',
            label: 'Visited',
            value: num(totals.actualVisitCount),
            note: `${pct(
              totals.actualVisitCount,
              totals.total,
            )}% of unique leads`,
          },
          {
            key: 'i',
            label: 'IPD',
            value: num(totals.ipd),
            note: `${pct(totals.ipd, totals.actualVisitCount)}% of visits`,
          },
        ]
      : [
          {
            key: 'u',
            label: 'Google leads',
            value: num(totals.total),
            note: `from ${num(totals.entries)} Google entries`,
          },
          {
            key: 'd',
            label: 'Duplicates',
            value: num(totals.duplicates),
            note: `${pct(
              totals.duplicates,
              totals.entries,
            )}% of entries removed`,
            dir: totals.duplicates > 0 ? 'down' : undefined,
          },
          {
            key: 'b',
            label: 'Booked',
            value: num(totals.appointment),
            note: `${pct(totals.appointment, totals.total)}% of Google leads`,
          },
          {
            key: 's',
            label: 'Share of all leads',
            value: totals._all > 0 ? `${pct(totals.total, totals._all)}%` : '—',
            note: `${num(totals.total)} of ${num(totals._all)} unique leads`,
          },
          {
            key: 'v',
            label: 'Visited',
            value: num(totals.actualVisitCount),
            note: `${pct(
              totals.actualVisitCount,
              totals.total,
            )}% of Google leads`,
          },
          {
            key: 'i',
            label: 'IPD',
            value: num(totals.ipd),
            note: `${pct(totals.ipd, totals.actualVisitCount)}% of visits`,
          },
        ];

  const openBranch = (loc: string) => {
    if (tab !== 'terms') return onSelectBranch?.(loc, { tab });
    // Which condition the tapped branch was under: the open one, or the only
    // branch of a single-branch condition.
    const g =
      rows.find(
        r =>
          r.name === effectiveOpen &&
          r.branches.some((b: any) => b.location === loc),
      ) ||
      rows.find(r => r.branches.length === 1 && r.branches[0].location === loc);
    onSelectBranch?.(loc, {
      tab,
      filter: g ? { type: 'condition', value: g.name, label: g.name } : null,
    });
  };

  const partial = (tab === 'all' ? all : gBranches).filter(
    (x: any) => x.partial,
  );
  const channels = tab === 'all' ? CHANNELS : GOOGLE_CHANNELS;
  const mixStats = tab === 'all' ? all : gBranches;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.canvas }}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={T.brand}
          colors={[T.brand]}
        />
      }
    >
      {band}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.brand} />
          <Text style={s.muted}>
            Reading your branches — this takes a moment.
          </Text>
        </View>
      ) : (
        <>
          {activeErr ? (
            <View style={[s.card, s.errorCard]}>
              <Icon name="error-outline" size={26} color={T.crit} />
              <Text style={s.errorText}>{activeErr}</Text>
              <TouchableOpacity style={s.retry} onPress={() => load(true)}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MetricGrid items={metrics} />
          )}

          <View style={s.page}>
            {!!updatedAt && (
              <Text style={s.updated}>
                {updatedLabel(updatedAt)} · pull down to refresh
              </Text>
            )}
            {!!refreshError && (
              <Text style={s.refreshErr}>
                Refresh failed — showing the stored figures. {refreshError}
              </Text>
            )}

            <View style={{ height: 14 }} />
            <Segmented
              options={TABS}
              value={tab}
              onChange={(t: any) => changeTab(t)}
            />

            {!activeErr && (
              <>
                <SectionHead
                  label={
                    tab === 'all' ? 'Lead source' : 'Lead source · Google only'
                  }
                />
                <SourceMix
                  stats={mixStats}
                  channels={channels}
                  mode={mode}
                  onPick={setMode}
                  allLabel={tab === 'all' ? 'All sources' : 'All Google leads'}
                />

                <View style={s.sortHead}>
                  <Text style={s.blockLabel}>SORT BY</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
                    }
                    style={s.dirBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Order: ${
                      sortDir === 'desc' ? 'highest first' : 'lowest first'
                    }. Tap to reverse`}
                  >
                    <Icon
                      name={
                        sortDir === 'desc' ? 'arrow-downward' : 'arrow-upward'
                      }
                      size={13}
                      color={T.brand}
                    />
                    <Text style={s.dirText}>
                      {sortDir === 'desc' ? 'High → Low' : 'Low → High'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {cols.map(o => {
                    const on = sortKey === o.key;
                    return (
                      <TouchableOpacity
                        key={o.key}
                        onPress={() => sortBy(o.key)}
                        style={[s.chip, on && s.chipOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]}>
                          {o.sort}
                          {on ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={s.searchRow}>
                  <Icon name="search" size={18} color={T.muted2} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={
                      tab === 'terms' ? 'Condition or branch' : 'City or branch'
                    }
                    placeholderTextColor={T.muted2}
                    style={s.search}
                    autoCorrect={false}
                  />
                  {!!query && (
                    <TouchableOpacity
                      onPress={() => setQuery('')}
                      accessibilityLabel="Clear search"
                    >
                      <Icon name="close" size={17} color={T.muted2} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={s.caption}>
                  {channelOf(mode).label} ·{' '}
                  {tab === 'all'
                    ? 'unique leads (latest kept) · GOOGLE AD = how many of them came from Google Ads'
                    : tab === 'google'
                    ? 'Google leads only (utm_source google / google_ads) · % OF ALL = share of the branch’s unique leads'
                    : 'Google leads by search term (utm_term → condition), each person under their latest lead’s term'}{' '}
                  · DUP = older entries removed · tap a{' '}
                  {tab === 'terms' ? 'condition' : 'city'} for its branches, a
                  branch for its leads · tap a heading to sort, again to reverse
                </Text>
              </>
            )}
          </View>

          {!activeErr &&
            (rows.length === 0 ? (
              <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>
                {query
                  ? 'Nothing matches.'
                  : tab === 'all'
                  ? 'No leads in this period.'
                  : 'No Google leads in this period.'}
              </Text>
            ) : (
              <LeadCityTable
                cities={rows}
                cols={cols}
                groupLabel={tab === 'terms' ? 'TERM' : 'CITY'}
                totalLabel={tab === 'all' ? 'All branches' : 'All Google leads'}
                totalX={totalX}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={sortBy}
                openCity={effectiveOpen}
                onToggleCity={(name: string) =>
                  setOpenGroup(openGroup === name ? null : name)
                }
                onOpenBranch={openBranch}
                minWidth={winW - 32}
              />
            ))}

          {tab === 'terms' && !activeErr && (
            <TopTerms
              branches={gBranches}
              mode={mode}
              onPickCondition={(c: string) => {
                setQuery('');
                setOpenGroup(c);
              }}
            />
          )}

          {tab === 'all' && !allErr && gErr && (
            <Text style={s.warnLine}>
              GOOGLE AD shows “—”: the Google figures could not be loaded (
              {gErr}).
            </Text>
          )}

          {partial.length > 0 && !activeErr && (
            <View style={s.failed}>
              <Text style={s.failedTitle}>
                {partial.length} branch{partial.length === 1 ? '' : 'es'} could
                not load every source
              </Text>
              {partial.map((p: any) => (
                <Text key={p.location} style={s.failedLine}>
                  {p.location} —{' '}
                  {(p.errors || [])
                    .map((k: string) => channelOf(k).label)
                    .join(', ') || 'some sources'}
                </Text>
              ))}
              <Text style={s.failedNote}>
                Those sources count as zero above — pull down to retry.
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  muted: { fontFamily: F.regular, fontSize: 12, color: T.muted, marginTop: 10 },
  updated: {
    fontFamily: F.mono,
    fontSize: 10,
    color: T.muted2,
    marginTop: 10,
    marginHorizontal: 2,
  },
  refreshErr: {
    fontFamily: F.regular,
    fontSize: 11,
    color: T.crit,
    marginTop: 4,
    marginHorizontal: 2,
  },
  warnLine: {
    fontFamily: F.regular,
    fontSize: 11,
    color: T.crit,
    marginHorizontal: 18,
    marginTop: 12,
  },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 14,
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: -30,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontFamily: F.regular,
    fontSize: 13,
    color: T.text,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: T.brand,
    borderRadius: R.sm,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: { fontFamily: F.medium, fontSize: 13, color: T.white },

  mixBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: T.lineSoft,
  },
  mixLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  mixItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  mixDot: { width: 7, height: 7, borderRadius: 4 },
  mixLabel: { fontFamily: F.medium, fontSize: 11.5, color: T.muted },
  mixVal: { fontFamily: F.mono, fontSize: 11.5, color: T.text },
  mixNote: {
    fontFamily: F.regular,
    fontSize: 10.5,
    color: T.muted,
    marginTop: 10,
  },

  sortHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginHorizontal: 2,
  },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T.brand,
    backgroundColor: tint(T.brand),
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dirText: { fontFamily: F.medium, fontSize: 11, color: T.brand },
  chips: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 10,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  chipOn: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipTextOn: { color: '#fff', fontFamily: F.medium },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
    color: T.muted2,
    fontFamily: F.regular,
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 2,
  },

  failed: {
    backgroundColor: '#FBEDEB',
    borderWidth: 1,
    borderColor: '#F0CFCA',
    borderRadius: 12,
    padding: 13,
    marginHorizontal: 16,
    marginTop: 16,
  },
  failedTitle: { fontSize: 12, fontFamily: F.medium, color: T.crit },
  failedLine: { fontFamily: F.mono, fontSize: 10, color: T.text, marginTop: 6 },
  failedNote: {
    fontSize: 10,
    color: T.muted,
    marginTop: 9,
    fontFamily: F.regular,
  },
});
