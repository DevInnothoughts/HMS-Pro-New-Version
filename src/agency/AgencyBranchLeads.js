/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/agency/AgencyBranchLeads.js
// ─────────────────────────────────────────────────────────────────────────────
// One branch's GOOGLE leads for the Ad Agency login — Web, Bot and Web call
// only (no IVR). A copy of src/adAgency/BranchLeadsList.js (locked) with:
//
//   • data from GET /agencyLeads/leads (Google only — the server filters)
//   • three source tabs, no IVR
//   • each lead shows its campaign (utm_campaign) and search term (utm_term)
//   • an optional CAMPAIGN or CONDITION filter, set when the page is opened
//     from a campaign / term row on the dashboard, shown as a removable chip
//   • tab, stage-chip and metric counts all honour that filter
//   • NO MoM / YoY trend — the agency sees the lead list only
//
// PRIVACY: mobile numbers arrive ALREADY MASKED ("98XXXXXX45"); there is no
// call / WhatsApp action on purpose.
//
// Data is fetched once per branch + range; the source tabs, stage filter and
// search all work on that list locally, so switching tabs is instant.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { MetricGrid, SectionHead } from '../design/components/primitives';
import { updatedLabel } from '../api/queryCache';
import { F, R, T, num, pct, tint } from '../design/tokens';
import {
  AGENCY_CHANNELS as CHANNELS,
  ALL,
  channelOf,
  fetchAgencyBranchLeads as fetchBranchLeads,
  stageOf,
  viewOf,
} from './agencyApi';

const matchesFilter = (l, f) =>
  !f ||
  (f.type === 'campaign' ? l.campaign === f.value : l.condition === f.value);

const STAGES = [
  { key: 'all', label: 'All' },
  { key: 'booked', label: 'Booked' },
  { key: 'visited', label: 'Visited' },
  { key: 'ipd', label: 'IPD' },
  { key: 'open', label: 'Not booked' },
];

const matchesStage = (l, stage) => {
  if (stage === 'booked') return l.booked;
  if (stage === 'visited') return l.visited;
  if (stage === 'ipd') return l.ipd;
  if (stage === 'open') return !l.booked;
  return true;
};

// "2026-10-21 14:05" → "21 Oct, 14:05"
const MONTHS = [
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
const prettyDate = v => {
  const [d, t] = String(v || '').split(' ');
  const [, m, day] = (d || '').split('-').map(Number);
  if (!m || !day) return v || '';
  return `${day} ${MONTHS[m - 1]}${t ? `, ${t}` : ''}`;
};

// One unique person = their LATEST lead (older ones are eliminated as
// duplicates). `lead` is already the view for the current tab (viewOf);
// sources[0] is the kept lead's source, the rest are where older leads came from.
const LeadRow = ({ lead }) => {
  const srcs = lead.sources || [];
  const ch = channelOf(lead.source || srcs[0]);
  const stage = stageOf(lead);
  const range =
    lead.entries > 1 && lead.firstDate && lead.firstDate !== lead.date
      ? `${prettyDate(lead.firstDate)} → ${prettyDate(lead.date)}`
      : prettyDate(lead.date);
  const meta = [range, lead.treatment].filter(Boolean).join('  ·  ');
  const camp =
    lead.campaign === '(not tagged)'
      ? 'No campaign'
      : lead.campaignName || lead.campaign;

  return (
    <View style={s.row}>
      <View style={[s.rowIco, { backgroundColor: tint(ch.hue) }]}>
        <Icon name={ch.icon} size={17} color={ch.hue} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>
            {lead.name || 'Unnamed lead'}
          </Text>
          {lead.entries > 1 && (
            <View
              style={s.dupBadge}
              accessibilityLabel={`${lead.entries} entries, ${
                lead.entries - 1
              } duplicate`}
            >
              <Icon name="content-copy" size={10} color={T.crit} />
              <Text style={s.dupText}>×{lead.entries}</Text>
            </View>
          )}
          <View style={[s.pill, { backgroundColor: tint(stage.color) }]}>
            <Text
              style={[s.pillText, { color: stage.color }]}
              numberOfLines={1}
            >
              {stage.label}
            </Text>
          </View>
        </View>

        <View style={s.phoneRow}>
          <Icon name="lock" size={11} color={T.muted2} />
          <Text style={s.phone}>{lead.phone || '—'}</Text>
          <Text style={[s.srcTag, { color: ch.hue }]}>{ch.short}</Text>
          {srcs.length > 1 && (
            <Text style={s.olderTag} numberOfLines={1}>
              older:{' '}
              {srcs
                .slice(1)
                .map(k => channelOf(k).short)
                .join(', ')}
            </Text>
          )}
        </View>

        {!!meta && (
          <Text style={s.meta} numberOfLines={2}>
            {meta}
          </Text>
        )}

        <View style={s.utmRow}>
          <Icon name="campaign" size={11} color={T.muted2} />
          <Text style={s.utmText} numberOfLines={1}>
            {camp}
          </Text>
          <Icon
            name="search"
            size={11}
            color={T.muted2}
            style={{ marginLeft: 6 }}
          />
          <Text style={[s.utmText, { flexShrink: 1 }]} numberOfLines={1}>
            {lead.term ? `“${lead.term}”` : 'no term'}
            {lead.condition && lead.term ? ` · ${lead.condition}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default function AgencyBranchLeads({
  location,
  from,
  to,
  scopeKey, // queryCache.rangeKey(scope)
  band,
  onLoaded,
  filter: initialFilter,
}) {
  // Campaign / condition filter from the dashboard row that was tapped.
  const [filter, setFilter] = useState(initialFilter || null);
  const [data, setData] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  // A failed pull-to-refresh keeps the stored figures on screen and says so.
  const [refreshError, setRefreshError] = useState(null);
  const hasData = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('combined');
  const [stage, setStage] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      setRefreshError(null);
      if (!isRefresh) onLoaded?.(null);
      try {
        // Stored answer first; the server only on pull-to-refresh (force).
        const { data: d, updatedAt: at } = await fetchBranchLeads({
          location,
          from,
          to,
          scopeKey,
          force: isRefresh,
        });
        setData(d);
        setUpdatedAt(at);
        hasData.current = true;
        onLoaded?.(d);
      } catch (e) {
        if (isRefresh && hasData.current)
          setRefreshError(e?.message || 'Refresh failed');
        else setError(e?.message || 'Failed to load leads');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location, from, to, scopeKey],
  );

  useEffect(() => {
    load();
  }, [load]);

  const all = data?.leads || [];

  // Source first — the metric cards describe the chosen source, before the
  // stage filter and search narrow the list. Every row is ONE unique person;
  // under a source tab it carries that source's own de-duplicated stage.
  // The campaign / condition is the one this person has IN THAT SOURCE
  // (viewOf spreads perSource), so a tab matches the dashboard's source view.
  const bySource = useMemo(
    () =>
      all
        .map(l => viewOf(l, source))
        .filter(Boolean)
        .filter(l => matchesFilter(l, filter)),
    [all, source, filter],
  );

  // Source + search, before the stage filter. The stage chip counts are taken
  // from this list, so each chip's number is exactly what tapping it shows.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bySource;
    return bySource.filter(
      l =>
        String(l.name || '')
          .toLowerCase()
          .includes(q) ||
        String(l.treatment || '')
          .toLowerCase()
          .includes(q) ||
        String(l.term || '')
          .toLowerCase()
          .includes(q) ||
        String(l.campaign || '')
          .toLowerCase()
          .includes(q) ||
        String(l.campaignName || '')
          .toLowerCase()
          .includes(q),
    );
  }, [bySource, query]);

  const stageCounts = useMemo(() => {
    const c = {};
    STAGES.forEach(o => {
      c[o.key] = searched.filter(l => matchesStage(l, o.key)).length;
    });
    return c;
  }, [searched]);

  const shown = useMemo(
    () => searched.filter(l => matchesStage(l, stage)),
    [searched, stage],
  );

  // Unique vs duplicate for the current tab. Booked / Visited / IPD / Not
  // booked are on the stage chips, already counted per unique lead.
  const t = useMemo(() => {
    const entries = bySource.reduce((a, l) => a + (l.entries || 1), 0);
    return {
      unique: bySource.length,
      entries,
      duplicates: entries - bySource.length,
      multiSource: bySource.filter(l => (l.sources || []).length > 1).length,
    };
  }, [bySource]);

  const metrics = [
    {
      key: 'u',
      label: 'Unique leads',
      value: num(t.unique),
      note: `from ${num(t.entries)} entries`,
    },
    {
      key: 'd',
      label: 'Duplicates',
      value: num(t.duplicates),
      note:
        source === 'combined' && t.multiSource > 0
          ? `${num(t.multiSource)} via 2+ sources`
          : `${pct(t.duplicates, t.entries)}% of entries removed`,
      dir: t.duplicates > 0 ? 'down' : undefined,
    },
  ];

  // Tab badges: unique leads per source and that source's duplicates,
  // counted here so they honour the campaign / condition filter.
  const tabCount = key => {
    const v = all
      .map(l => viewOf(l, key))
      .filter(Boolean)
      .filter(l => matchesFilter(l, filter));
    const entries = v.reduce((a, l) => a + (l.entries || 1), 0);
    return { count: v.length, dup: entries - v.length };
  };
  const tabs = [
    {
      ...ALL,
      short: 'All',
      label: 'All Google leads',
      ...tabCount('combined'),
    },
    ...CHANNELS.map(c => ({ ...c, ...tabCount(c.key) })),
  ];
  const failed = (data?.errors || []).map(k => channelOf(k).label);

  const Header = (
    <>
      {band}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.brand} />
          <Text style={s.muted}>Loading leads for {location}…</Text>
        </View>
      ) : error ? (
        <View style={s.errorCard}>
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
            {!!filter && (
              <View style={s.filterRow}>
                <View style={s.filterChip}>
                  <Icon
                    name={filter.type === 'campaign' ? 'campaign' : 'search'}
                    size={13}
                    color={T.brand}
                  />
                  <Text style={s.filterText} numberOfLines={1}>
                    {filter.type === 'campaign' ? 'Campaign' : 'Search term'}:{' '}
                    {filter.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilter(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove filter, show every Google lead of this branch"
                  >
                    <Icon name="close" size={15} color={T.brand} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabs}
            >
              {tabs.map(tb => {
                const on = source === tb.key;
                return (
                  <TouchableOpacity
                    key={tb.key}
                    onPress={() => setSource(tb.key)}
                    style={[
                      s.tab,
                      on && { backgroundColor: tb.hue, borderColor: tb.hue },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${tb.label}, ${tb.count} unique leads, ${tb.dup} duplicates`}
                  >
                    <Text style={[s.tabText, on && { color: T.white }]}>
                      {tb.short}
                    </Text>
                    <Text style={[s.tabCount, on && { color: T.white }]}>
                      {num(tb.count)}
                    </Text>
                    {tb.dup > 0 && (
                      <Text
                        style={[
                          s.tabDup,
                          on && { color: 'rgba(255,255,255,0.8)' },
                        ]}
                      >
                        +{num(tb.dup)} dup
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* No MoM / YoY trend for the agency — the lead list only. */}
            <View style={s.stageRow}>
              {STAGES.map(o => {
                const on = stage === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    onPress={() => setStage(o.key)}
                    style={[s.chip, on && s.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${o.label}, ${
                      stageCounts[o.key] || 0
                    } leads`}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>
                      {o.label}
                    </Text>
                    <View style={[s.chipBadge, on && s.chipBadgeOn]}>
                      <Text style={[s.chipCount, on && s.chipCountOn]}>
                        {num(stageCounts[o.key] || 0)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.search}>
              <Icon name="search" size={16} color={T.muted2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name, term or campaign"
                placeholderTextColor={T.muted2}
                style={s.searchInput}
                autoCorrect={false}
              />
              {!!query && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={16} color={T.muted2} />
                </TouchableOpacity>
              )}
            </View>

            {failed.length > 0 && (
              <Text style={s.warn}>
                {failed.join(', ')} could not be loaded — pull down to retry.
              </Text>
            )}

            <SectionHead
              label={`${num(shown.length)} unique Google lead${
                shown.length === 1 ? '' : 's'
              } · ×N = repeat entries · mobiles hidden`}
            />
          </View>
        </>
      )}
    </>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: T.canvas }}
      data={loading || error ? [] : shown}
      keyExtractor={item => item.id}
      ListHeaderComponent={Header}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={15}
      windowSize={9}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={T.brand}
          colors={[T.brand]}
        />
      }
      renderItem={({ item, index }) => (
        <View
          style={[
            s.listCard,
            index === 0 && s.listFirst,
            index === shown.length - 1 && s.listLast,
          ]}
        >
          <LeadRow lead={item} />
        </View>
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <View style={s.empty}>
            <Icon name="inbox" size={28} color={T.chevron} />
            <Text style={s.muted}>
              {all.length === 0
                ? 'No Google leads for this branch in this period.'
                : 'No leads match these filters.'}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', paddingTop: 18 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: T.brand,
    backgroundColor: tint(T.brand),
    borderRadius: R.pill,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 5,
  },
  filterText: {
    fontFamily: F.medium,
    fontSize: 11.5,
    color: T.brand,
    flexShrink: 1,
  },
  utmRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  utmText: { fontFamily: F.mono, fontSize: 10, color: T.muted, maxWidth: 150 },
  page: { paddingHorizontal: 16 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  muted: {
    fontFamily: F.regular,
    fontSize: 12,
    color: T.muted,
    marginTop: 10,
    textAlign: 'center',
  },
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
  empty: { alignItems: 'center', paddingVertical: 30 },

  errorCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 16,
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

  tabs: { gap: 6, paddingTop: 18, paddingBottom: 10 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    borderRadius: R.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  tabText: { fontFamily: F.medium, fontSize: 12, color: T.text },
  tabCount: { fontFamily: F.mono, fontSize: 11, color: T.muted },
  tabDup: { fontFamily: F.mono, fontSize: 9.5, color: T.crit },
  olderTag: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    marginLeft: 6,
    flexShrink: 1,
    textDecorationLine: 'line-through',
  },

  dupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tint(T.crit),
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  dupText: { fontFamily: F.mono, fontSize: 10, color: T.crit },

  stageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    paddingLeft: 11,
    paddingRight: 5,
    paddingVertical: 4,
  },
  chipOn: { backgroundColor: T.text, borderColor: T.text },
  chipText: { fontFamily: F.medium, fontSize: 11, color: T.muted },
  chipTextOn: { color: T.white },
  chipBadge: {
    minWidth: 22,
    borderRadius: R.pill,
    backgroundColor: T.lineSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  chipBadgeOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chipCount: { fontFamily: F.mono, fontSize: 10.5, color: T.text },
  chipCountOn: { color: T.white },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.md,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 13,
    color: T.text,
    paddingVertical: 9,
  },
  warn: {
    fontFamily: F.regular,
    fontSize: 11,
    color: T.crit,
    marginBottom: 10,
  },

  // The rows sit in one bordered card: first and last items carry the corners.
  listCard: {
    marginHorizontal: 16,
    backgroundColor: T.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: T.line,
  },
  listFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: R.card,
    borderTopRightRadius: R.card,
  },
  listLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: R.card,
    borderBottomRightRadius: R.card,
  },

  row: {
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: T.lineSoft,
  },
  rowIco: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flex: 1, fontFamily: F.semibold, fontSize: 13.5, color: T.text },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 110,
  },
  pillText: { fontFamily: F.medium, fontSize: 10.5 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phone: {
    fontFamily: F.mono,
    fontSize: 12,
    color: T.muted,
    letterSpacing: 0.6,
  },
  srcTag: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginLeft: 8,
  },
  meta: { fontFamily: F.regular, fontSize: 11, color: T.muted2, marginTop: 4 },
});
