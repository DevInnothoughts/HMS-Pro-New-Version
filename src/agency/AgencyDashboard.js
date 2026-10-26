/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/agency/AgencyDashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Ad Agency dashboard — Google leads only, Web · Bot · Web call (no IVR).
//
//   Campaigns     CAMPAIGN → branches → lead list (filtered to that campaign)
//   Search terms  TERM (condition: Piles, Fistula…) → branches → lead list
//                 + the top raw utm_term values underneath
//
// Same structure as the internal city-wise screen (src/adAgency/
// LeadsStatsDashboard.tsx — locked): unique leads with the latest kept,
// duplicates, booked / not booked / visited / IPD, source filter, SORT BY with
// High→Low / Low→High, search, the Branch-Summary-style table.
//
// ⚠️ ONE CAMPAIGN PER PERSON
// Every unique person is counted under the campaign (and search term) of
// their LATEST Google lead, so the campaign rows add up exactly to the total
// row — nobody is counted twice because they clicked two ads. In a source
// filter, it is their latest lead in that source.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import {
  MetricGrid,
  Segmented,
  SectionHead,
} from '../design/components/primitives';
import { updatedLabel } from '../api/queryCache';
import { F, R, T, num, pct, tint } from '../design/tokens';
import AgencyGroupTable, { LEAD_COLS } from './AgencyGroupTable';
import {
  AGENCY_CHANNELS,
  ALL,
  GROUPS,
  campaignLabel,
  channelOf,
  fetchAgencyStats,
  sumBuckets,
} from './agencyApi';

const n0 = v => Number(v) || 0;

const SORT_LABEL = {
  total: 'Unique',
  duplicates: 'Dup',
  appointment: 'Booked',
  notBooked: 'Not booked',
  actualVisitCount: 'Visited',
  ipd: 'IPD',
  bookedPct: 'Booked %',
};
const SORTS = LEAD_COLS.map(c => ({
  key: c.key,
  label: SORT_LABEL[c.key] || c.head,
}));

/** Unknown figures sort last in either direction; ties A–Z. */
const makeSort = (key, dir) => (a, b) => {
  const va = a[key];
  const vb = b[key];
  const name = x => String(x.name || x.location);
  if (va == null && vb == null) return name(a).localeCompare(name(b));
  if (va == null) return 1;
  if (vb == null) return -1;
  const d = dir === 'asc' ? n0(va) - n0(vb) : n0(vb) - n0(va);
  return d || name(a).localeCompare(name(b));
};

const rowOf = b => ({
  total: n0(b?.total),
  duplicates: n0(b?.duplicates),
  appointment: n0(b?.appointment),
  notBooked: n0(b?.notBooked),
  actualVisitCount: n0(b?.actualVisitCount),
  ipd: n0(b?.ipd),
  bookedPct: n0(b?.total) > 0 ? pct(b.appointment, b.total) : null,
});

const sumRows = rows => {
  const s = rows.reduce(
    (a, r) => {
      [
        'total',
        'duplicates',
        'appointment',
        'notBooked',
        'actualVisitCount',
        'ipd',
      ].forEach(k => (a[k] += r[k]));
      return a;
    },
    {
      total: 0,
      duplicates: 0,
      appointment: 0,
      notBooked: 0,
      actualVisitCount: 0,
      ipd: 0,
    },
  );
  return { ...s, bookedPct: s.total > 0 ? pct(s.appointment, s.total) : null };
};

// ─── Source filter ───────────────────────────────────────────────────────────
const SourceMix = ({ branches, mode, onPick }) => {
  const rows = AGENCY_CHANNELS.map(c => ({
    ...c,
    total: sumBuckets(branches, c.key).total,
  }));
  const segTotal = rows.reduce((a, r) => a + r.total, 0);
  const combined = sumBuckets(branches, 'combined');
  const overlap = combined.crossSource || 0;
  const all = {
    ...ALL,
    short: 'All',
    label: 'All Google leads',
    total: combined.total,
  };

  return (
    <View style={s.card}>
      <View style={s.mixBar}>
        {segTotal === 0 ? (
          <View style={{ flex: 1, backgroundColor: T.lineSoft }} />
        ) : (
          rows
            .filter(r => r.total > 0)
            .map(r => (
              <View
                key={r.key}
                style={{ flex: r.total, backgroundColor: r.hue }}
              />
            ))
        )}
      </View>
      <View style={s.mixLegend}>
        {[all, ...rows].map(r => {
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
              accessibilityLabel={`${r.label}, ${r.total} unique leads`}
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

// ─── Top raw search terms (Search terms view) ────────────────────────────────
const TopTerms = ({ branches, mode, onPickCondition }) => {
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(() => {
    const by = {};
    for (const b of branches) {
      for (const [term, t] of Object.entries(b.terms || {})) {
        const x = (by[term] = by[term] || {
          term,
          condition: t.condition,
          n: 0,
        });
        x.n += n0(t[mode]);
      }
    }
    return Object.values(by)
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || a.term.localeCompare(b.term));
  }, [branches, mode]);

  if (!list.length) return null;
  const shown = showAll ? list : list.slice(0, 12);
  const max = list[0].n;

  return (
    <View style={s.termsCard}>
      <Text style={s.termsTitle}>Top search terms (utm_term)</Text>
      <Text style={s.termsSub}>
        Unique leads by the exact keyword of their latest Google lead
      </Text>
      {shown.map((x, i) => (
        <TouchableOpacity
          key={x.term}
          style={[
            s.termRow,
            i === shown.length - 1 && { borderBottomWidth: 0 },
          ]}
          onPress={() => onPickCondition(x.condition)}
          accessibilityRole="button"
          accessibilityLabel={`${x.term}, ${x.n} leads, ${x.condition}. Show this condition`}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.termText} numberOfLines={1}>
              {x.term}
            </Text>
            <View style={s.termBarTrack}>
              <View
                style={[
                  s.termBar,
                  { width: `${Math.max((x.n / max) * 100, 3)}%` },
                ]}
              />
            </View>
          </View>
          <Text style={s.termCond} numberOfLines={1}>
            {x.condition}
          </Text>
          <Text style={s.termN}>{num(x.n)}</Text>
        </TouchableOpacity>
      ))}
      {list.length > 12 && (
        <TouchableOpacity
          onPress={() => setShowAll(v => !v)}
          style={s.termMore}
        >
          <Text style={s.termMoreText}>
            {showAll ? 'Show top 12' : `Show all ${num(list.length)} terms`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Screen body ─────────────────────────────────────────────────────────────
export default function AgencyDashboard({
  from,
  to,
  locations,
  scopeKey, // queryCache.rangeKey(scope) — the cache key for this range
  band,
  onStatsLoaded,
  onSelectBranch, // (location, filter | null)
}) {
  const [data, setData] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  // A failed pull-to-refresh keeps the stored figures on screen and says so.
  const [refreshError, setRefreshError] = useState(null);
  const hasData = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('combined');
  const [group, setGroup] = useState('campaigns');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [openGroup, setOpenGroup] = useState(null);
  const [query, setQuery] = useState('');
  const { width: winW } = useWindowDimensions();

  const locKey = (locations || []).join(',');
  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      setRefreshError(null);
      if (!isRefresh) onStatsLoaded?.(null);
      try {
        // Stored answer first; the server only on pull-to-refresh (force).
        const { data: d, updatedAt: at } = await fetchAgencyStats({
          from,
          to,
          locations,
          scopeKey,
          force: isRefresh,
        });
        setData(d);
        setUpdatedAt(at);
        hasData.current = true;
        onStatsLoaded?.(d);
      } catch (e) {
        if (isRefresh && hasData.current)
          setRefreshError(e?.message || 'Refresh failed');
        else setError(e?.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, locKey, scopeKey],
  );
  useEffect(() => {
    load();
  }, [load]);

  const branches = useMemo(() => data?.branches || [], [data]);
  const names = data?.campaignNames || {};
  const totals = useMemo(() => sumBuckets(branches, mode), [branches, mode]);

  const sortBy = key => {
    if (key === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Group rows: campaign (or condition) → its branches, for the selected source.
  const groups = useMemo(() => {
    const by = makeSort(sortKey, sortDir);
    const acc = {};
    for (const b of branches) {
      for (const [k, buckets] of Object.entries(b[group] || {})) {
        const r = rowOf(buckets[mode]);
        if (r.total === 0 && r.duplicates === 0) continue; // nothing in this source
        (acc[k] = acc[k] || []).push({
          location: b.location,
          partial: !!b.partial,
          ...r,
        });
      }
    }
    return Object.entries(acc).map(([k, rows]) => ({
      key: k,
      name: group === 'campaigns' ? campaignLabel(k, names) : k,
      // The id under a named campaign, so it can be matched in Google Ads.
      sub: group === 'campaigns' && names[k] && names[k] !== k ? k : null,
      branches: [...rows].sort(by),
      ...sumRows(rows),
    }));
  }, [branches, group, mode, sortKey, sortDir, names]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? groups.filter(
          g =>
            g.name.toLowerCase().includes(q) ||
            g.key.toLowerCase().includes(q) ||
            g.branches.some(b => String(b.location).toLowerCase().includes(q)),
        )
      : [...groups];
    return list.sort(makeSort(sortKey, sortDir));
  }, [groups, query, sortKey, sortDir]);

  const effectiveOpen = query && rows.length === 1 ? rows[0].name : openGroup;
  const totalX = rows.length > 0 && !query ? rowOf(totals) : null;
  const partial = branches.filter(x => x.partial);
  const grp = GROUPS.find(g => g.key === group);

  // The table hands back a NAME; map it to the group key for the filter.
  const keyOfName = name => groups.find(g => g.name === name)?.key ?? name;
  const openBranch = (location, groupName) => {
    const k = keyOfName(groupName);
    onSelectBranch?.(
      location,
      group === 'campaigns'
        ? { type: 'campaign', value: k, label: campaignLabel(k, names) }
        : { type: 'condition', value: k, label: k },
    );
  };

  const metrics = [
    {
      key: 'leads',
      label: 'Unique leads',
      value: num(totals.total),
      note: `from ${num(totals.entries)} Google entries`,
    },
    {
      key: 'dup',
      label: 'Duplicates',
      value: num(totals.duplicates),
      note: `${pct(totals.duplicates, totals.entries)}% of entries removed`,
      dir: totals.duplicates > 0 ? 'down' : undefined,
    },
    {
      key: 'booked',
      label: 'Booked',
      value: num(totals.appointment),
      note: `${pct(totals.appointment, totals.total)}% of unique leads`,
    },
    {
      key: 'open',
      label: 'Not booked',
      value: num(totals.notBooked),
      note: `${pct(totals.notBooked, totals.total)}% of unique leads`,
    },
    {
      key: 'visited',
      label: 'Visited',
      value: num(totals.actualVisitCount),
      note: `${pct(totals.actualVisitCount, totals.total)}% of unique leads`,
    },
    {
      key: 'ipd',
      label: 'IPD',
      value: num(totals.ipd),
      note: `${pct(totals.ipd, totals.actualVisitCount)}% of visits`,
    },
  ];

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
      ) : error ? (
        <View style={[s.card, s.errorCard]}>
          <Icon name="error-outline" size={26} color={T.crit} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retry} onPress={() => load()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <MetricGrid items={metrics} />

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
            <View style={{ height: 18 }} />
            <SectionHead label="Lead source · Google only" />
            <SourceMix branches={branches} mode={mode} onPick={setMode} />

            <View style={{ height: 16 }} />
            <Segmented
              options={GROUPS.map(g => ({ value: g.key, label: g.label }))}
              value={group}
              onChange={g => {
                setGroup(g);
                setOpenGroup(null);
              }}
            />

            <View style={s.sortHead}>
              <Text style={s.blockLabel}>SORT BY</Text>
              <TouchableOpacity
                onPress={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
                style={s.dirBtn}
                accessibilityRole="button"
                accessibilityLabel={`Order: ${
                  sortDir === 'desc' ? 'highest first' : 'lowest first'
                }. Tap to reverse`}
              >
                <Icon
                  name={sortDir === 'desc' ? 'arrow-downward' : 'arrow-upward'}
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
              {SORTS.map(o => {
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
                      {o.label}
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
                  group === 'campaigns'
                    ? 'Campaign id / name or branch'
                    : 'Condition or branch'
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
              {channelOf(mode).label} · Google leads only (utm_source google /
              google_ads) · each person counted once, under their latest lead's{' '}
              {group === 'campaigns' ? 'campaign' : 'search term'} · DUP = older
              entries removed · tap a{' '}
              {group === 'campaigns' ? 'campaign' : 'term'} for its branches, a
              branch for its leads · tap a heading to sort, again to reverse
            </Text>
          </View>

          {rows.length === 0 ? (
            <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>
              {query ? 'Nothing matches.' : 'No Google leads in this period.'}
            </Text>
          ) : (
            <AgencyGroupTable
              groups={rows}
              groupLabel={grp.head}
              totalLabel="All Google leads"
              totalX={totalX}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={sortBy}
              openCity={effectiveOpen}
              onToggleCity={name =>
                setOpenGroup(openGroup === name ? null : name)
              }
              onOpenBranch={loc => {
                // The table does not say which group the tapped branch was
                // under; it is the open one (or the only branch of a group).
                const g =
                  rows.find(
                    r =>
                      r.name === effectiveOpen &&
                      r.branches.some(b => b.location === loc),
                  ) ||
                  rows.find(
                    r =>
                      r.branches.length === 1 && r.branches[0].location === loc,
                  );
                openBranch(loc, g?.name);
              }}
              minWidth={winW - 32}
            />
          )}

          {group === 'conditions' && (
            <TopTerms
              branches={branches}
              mode={mode}
              onPickCondition={c => {
                setQuery('');
                setOpenGroup(c);
              }}
            />
          )}

          {partial.length > 0 && (
            <View style={s.failed}>
              <Text style={s.failedTitle}>
                {partial.length} branch{partial.length === 1 ? '' : 'es'} could
                not load every source
              </Text>
              {partial.map(p => (
                <Text key={p.location} style={s.failedLine}>
                  {p.location} —{' '}
                  {(p.errors || []).map(k => channelOf(k).label).join(', ')}
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
    marginTop: 6,
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

  termsCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingTop: 12,
  },
  termsTitle: {
    fontFamily: F.semibold,
    fontSize: 13,
    color: T.text,
    paddingHorizontal: 12,
  },
  termsSub: {
    fontFamily: F.regular,
    fontSize: 10.5,
    color: T.muted2,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  termText: { fontFamily: F.regular, fontSize: 12, color: T.text },
  termBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 4,
  },
  termBar: { height: 3, borderRadius: 2, backgroundColor: T.brand },
  termCond: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    maxWidth: 90,
  },
  termN: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.text,
    minWidth: 34,
    textAlign: 'right',
  },
  termMore: { paddingVertical: 10, alignItems: 'center' },
  termMoreText: { fontFamily: F.medium, fontSize: 12, color: T.brand },

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
