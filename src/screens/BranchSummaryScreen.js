/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/BranchSummaryScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Every city on one screen, each opening to its branches.
// The mobile answer to hhc-dashboard.html.
//
//   GET /overview/branchSummary?from=&to=&locations=a,b,c
//
// ⚠️ CITY FIRST, BRANCH SECOND
// ────────────────────────────
// Forty-two branch rows is a list nobody reads. Nine of them are Pune and nine
// are Bangalore, so the first question — "how is Pune doing" — could not be
// answered without adding nine numbers by hand. Cities are the top level;
// tapping one reveals its branches inline, so the comparison you were making
// stays on screen.
//
// Grouping happens HERE, not in the model: the API returns per-branch rows, and
// a city is a presentation decision. Putting CITY_OF in the backend would mean
// every consumer inherits one screen's idea of how to group.
//
// ⚠️ CITY TOTALS ARE SUMMED, AVERAGES ARE RECOMPUTED
// ──────────────────────────────────────────────────
// Counts and revenue add up. Averages and conversion do NOT — averaging four
// branches' avg-bill weights a 12-patient branch the same as a 400-patient one.
// They are recomputed from the city's pooled figures instead.
//
// ⚠️ A BRANCH WITH NO CITY BECOMES ITS OWN
// ────────────────────────────────────────
// Ten branches are the only one in their city, and a branch added tomorrow will
// not be in CITY_OF at all. Both fall through to a single-branch city named
// after themselves — they stay visible rather than disappearing from a report
// nobody would notice them missing from.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import AppDrawer from '../common/AppDrawer';
import { get } from '../api/client';
import ScopePicker from '../design/components/ScopePicker';
import { useScopeRange } from '../scope/useScopeRange';
import { scopeLabel } from '../store/scopeSlice';
import { F, T, inr, num } from '../design/tokens';

const ENDPOINT = '/overview/branchSummary';

/**
 * Branch → city. Only multi-branch cities are listed; anything absent becomes
 * its own city, which covers Belgavi, Kalaburagi, Latur, Ludhiana, Lucknow,
 * Mysore, Nashik, Mohali, Aurangabad, Raipur — and any branch opened after
 * this map was written.
 */
const CITY_OF = {};
const CITIES = {
  Pune: [
    'Baner',
    'Chakan',
    'Chinchwad',
    'Dighi',
    'Hinjewadi',
    'Salunke Vihar',
    'Undri',
    'Katraj',
    'Hadapsar',
    'DP Road',
  ],
  Mumbai: ['Andheri', 'Navi Mumbai', 'Thane', 'Vashi', 'Kalyan'],
  Bangalore: [
    'HSR',
    'Sahakar Nagar',
    'Indiranagar',
    'JP Nagar',
    'Rajaji Nagar',
    'Sarjapura',
    'Whitefield',
    'Electronic City',
    'RR Nagar',
  ],
  Hyderabad: ['Hyderabad', 'Secunderabad'],
  Ahmedabad: ['Ahmedabad', 'Bopal'],
  Surat: ['Surat', 'Adajan'],
  Gurgaon: ['Gurgaon Sector 14', 'Gurgaon Sector 49'],
};
Object.entries(CITIES).forEach(([city, branches]) => {
  branches.forEach(b => (CITY_OF[b] = city));
});

// No red — this is a comparison view, not an alert. Red is reserved for money
// owed and failed reads.
const GOOD = '#1E7A5A';
const MID = '#B26A00';
const LOW = '#8A6F4A';

const METRICS = [
  { key: 'grandTotal', label: 'Revenue', money: true },
  { key: 'newPatients', label: 'New pt' },
  { key: 'totalOPD', label: 'OPD' },
  { key: 'avgOPDBill', label: 'Avg OPD', money: true, derived: true },
  { key: 'conversion', label: 'Conv %', pct: true, derived: true },
  { key: 'ipdCount', label: 'IPD' },
  { key: 'avgIPDBill', label: 'Avg IPD', money: true, derived: true },
  { key: 'pharmacy', label: 'Pharmacy', money: true },
];

const n0 = v => Number(v) || 0;

const fmtValue = (v, m) => {
  if (v == null) return '—';
  if (m.pct) return `${Number(v).toFixed(0)}%`;
  return m.money ? inr(Math.round(v)) : num(v);
};

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

const fmtDate = d => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return m ? `${Number(day)} ${MONTHS[Number(m) - 1]}` : String(d);
};

/** Roll a set of branch rows into one line. See the header on averages. */
const roll = (name, branches) => {
  const sum = f => branches.reduce((a, b) => a + n0(b[f]), 0);
  const opdRevenue = sum('opdRevenue');
  const ipdRevenue = sum('ipdRevenue');
  const totalOPD = sum('totalOPD');
  const ipdCount = sum('ipdCount');
  const newPatients = sum('newPatients');

  return {
    name,
    branches,
    newPatients,
    male: sum('male'),
    female: sum('female'),
    totalOPD,
    opdRevenue,
    ipdCount,
    ipdRevenue,
    pharmacy: sum('pharmacy'),
    grandTotal: sum('grandTotal'),
    // Recomputed, never averaged.
    avgOPDBill: totalOPD > 0 ? Math.round(opdRevenue / totalOPD) : null,
    avgIPDBill: ipdCount > 0 ? Math.round(ipdRevenue / ipdCount) : null,
    conversion: newPatients > 0 ? (ipdCount / newPatients) * 100 : null,
  };
};

const BranchSummaryScreen = ({ navigation, route }) => {
  const locationArray = useSelector(s => s.location.locationArray);
  const scope = useSelector(s => s.scope);
  const { from, to } = useScopeRange(route);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [metricKey, setMetricKey] = useState('grandTotal');
  const [openCity, setOpenCity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  const metric = METRICS.find(m => m.key === metricKey) || METRICS[0];

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(
          await get(ENDPOINT, {
            from,
            to,
            locations: (locationArray || []).join(','),
          }),
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, locationArray],
  );

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const all = data?.branches || [];
  const ok = useMemo(() => all.filter(b => !b.error), [all]);
  const failed = useMemo(() => all.filter(b => b.error), [all]);

  const cities = useMemo(() => {
    const groups = {};
    for (const b of ok) {
      // Absent from the map means a city of one — see the header.
      const city = CITY_OF[b.location] || b.location;
      (groups[city] = groups[city] || []).push(b);
    }
    return Object.entries(groups).map(([name, branches]) =>
      roll(
        name,
        // Branches within a city are ranked by the same metric as the cities,
        // so opening one continues the comparison rather than resetting it.
        [...branches].sort((a, b) => n0(b[metricKey]) - n0(a[metricKey])),
      ),
    );
  }, [ok, metricKey]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? cities.filter(
          c =>
            c.name.toLowerCase().includes(q) ||
            // Searching a branch name finds its city — otherwise "Hinjewadi"
            // would return nothing on a screen that clearly contains it.
            c.branches.some(b =>
              String(b.location || '')
                .toLowerCase()
                .includes(q),
            ),
        )
      : [...cities];
    return list.sort((a, b) => n0(b[metricKey]) - n0(a[metricKey]));
  }, [cities, query, metricKey]);

  const best = Math.max(...rows.map(c => n0(c[metricKey])), 1);
  const groupValue = totals[metricKey];

  const header = (
    <View>
      <View style={st.hdr}>
        <View style={st.hdrTop}>
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={st.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Icon name="menu" size={19} color="#CFDDD6" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.hdrEyebrow}>ALL BRANCHES</Text>
            <Text style={st.hdrTitle}>Branch Summary</Text>
          </View>
        </View>

        <View style={st.hdrBottom}>
          <Text style={st.hdrSub}>
            {num(rows.length)} cities · {num(totals.branches)} branches
          </Text>
          {/* The SAME redux scope the rest of the app uses, so a range chosen
              here carries into OPD, IPD and the reports — and vice versa. */}
          <TouchableOpacity
            onPress={() => setScopeOpen(true)}
            style={st.scopeChip}
            accessibilityRole="button"
            accessibilityLabel={`Period ${scopeLabel(scope)}. Change`}
          >
            <Text style={st.scopeText}>{scopeLabel(scope)}</Text>
            <Icon name="expand-more" size={14} color="#D2E0D9" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={st.body}>
        <View style={[st.statRow, { marginTop: -26 }]}>
          <Stat
            label="Revenue"
            value={inr(totals.grandTotal)}
            note="all branches"
            wide
          />
          <Stat
            label="New pt"
            value={num(totals.newPatients)}
            note={`${num(totals.male)}M · ${num(totals.female)}F`}
          />
        </View>
        <View style={[st.statRow, { marginTop: 9 }]}>
          <Stat label="OPD" value={num(totals.totalOPD)} note="visits" />
          <Stat label="IPD" value={num(totals.ipdCount)} note="cases" />
          <Stat
            label="Conv"
            value={
              totals.conversion == null
                ? '—'
                : `${totals.conversion.toFixed(0)}%`
            }
            note="of new pt"
          />
        </View>

        {/* The metric picker replaces horizontal scrolling. Pick the column you
            care about; cities AND their branches re-sort and lead with it. */}
        <Text style={st.blockLabel}>COMPARE BY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          {METRICS.map(m => {
            const on = metricKey === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMetricKey(m.key)}
                style={[st.chip, on && st.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.chipText, on && st.chipTextOn]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="City or branch"
            placeholderTextColor={T.muted2}
            style={st.search}
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

        <View style={st.listHead}>
          <Text style={st.listHeadText}>CITY</Text>
          <Text style={st.listHeadVal}>{metric.label.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );

  const footer = failed.length ? (
    <View style={st.failed}>
      <Text style={st.failedTitle}>
        {failed.length} branch{failed.length === 1 ? '' : 'es'} could not be
        read
      </Text>
      {failed.map(b => (
        <Text key={b.location} style={st.failedLine}>
          {b.location} — {b.error}
        </Text>
      ))}
      <Text style={st.failedNote}>
        Excluded from the totals above, not counted as zero.
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={c => c.name}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={T.brand}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
              <Text style={st.loadingNote}>
                Reading every branch — this takes a moment.
              </Text>
            </View>
          ) : (
            <Text style={st.empty}>{error || 'No data for this period.'}</Text>
          )
        }
        renderItem={({ item, index }) => (
          <CityRow
            c={item}
            rank={index + 1}
            metric={metric}
            best={best}
            groupValue={groupValue}
            open={openCity === item.name}
            onToggle={() =>
              setOpenCity(openCity === item.name ? null : item.name)
            }
          />
        )}
      />

      <AppDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        active="branchSummary"
      />
      <ScopePicker visible={scopeOpen} onClose={() => setScopeOpen(false)} />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={st.statVal} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

const paceColor = vsGroup =>
  vsGroup == null
    ? T.muted2
    : vsGroup >= 100
    ? GOOD
    : vsGroup >= 75
    ? MID
    : LOW;

/**
 * One city. A LIST row, not a card — flat, full-bleed, hairline-separated, so
 * twenty of them read as one table rather than twenty floating objects.
 */
const CityRow = ({ c, rank, metric, best, groupValue, open, onToggle }) => {
  const value = c[metric.key];
  const hue = T.brand;
  const multi = c.branches.length > 1;

  return (
    <View style={[st.cityWrap, open && st.cityWrapOpen]}>
      <TouchableOpacity
        style={st.city}
        activeOpacity={multi ? 0.7 : 1}
        onPress={multi ? onToggle : undefined}
        disabled={!multi}
        accessibilityRole={multi ? 'button' : 'text'}
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${c.name}, ${fmtValue(value, metric)}, ${
          c.branches.length
        } branches`}
      >
        <Text style={st.rank}>{rank}</Text>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.cityName} numberOfLines={1}>
            {c.name}
          </Text>
          {multi && (
            <Text style={st.cityMeta}>{c.branches.length} branches</Text>
          )}
          {/* The bar lives under the name, at the row's own indent, so the
              value column stays a clean vertical line of numbers. */}
          <View style={st.track}>
            <View
              style={{
                width: `${Math.max((n0(value) / best) * 100, 1.5)}%`,
                height: '100%',
                borderRadius: 2,
                backgroundColor: hue,
              }}
            />
          </View>
        </View>

        <View style={st.valueCol}>
          <Text style={[st.value, { color: hue }]}>
            {fmtValue(value, metric)}
          </Text>
        </View>

        {multi ? (
          <Icon
            name={open ? 'expand-less' : 'expand-more'}
            size={18}
            color={T.chevron}
          />
        ) : (
          <View style={{ width: 18 }} />
        )}
      </TouchableOpacity>

      {/* The same labelled grid the branch cards carry. A city is a branch-
          shaped thing — same nine figures, summed — so it should read the same
          way rather than making you open it to find out what it contains. */}
      <View style={st.cityFigs}>
        <View style={st.figs}>
          <Fig label="NEW PT" value={num(c.newPatients)} />
          <Fig label="M:F" value={`${c.male}:${c.female}`} />
          <Fig label="OPD" value={num(c.totalOPD)} />
          <Fig
            label="AVG OPD"
            value={c.avgOPDBill == null ? '—' : inr(c.avgOPDBill)}
          />
        </View>
        <View style={[st.figs, st.figs2]}>
          <Fig
            label="CONV"
            value={c.conversion == null ? '—' : `${c.conversion.toFixed(0)}%`}
          />
          <Fig label="IPD" value={num(c.ipdCount)} />
          <Fig
            label="AVG IPD"
            value={c.avgIPDBill == null ? '—' : inr(c.avgIPDBill)}
          />
          <Fig label="PHARMACY" value={inr(c.pharmacy)} />
        </View>
      </View>

      {open && (
        <View style={st.branchList}>
          {c.branches.map(b => (
            <BranchCard
              key={b.location}
              b={b}
              metric={metric}
              cityBest={c[metric.key]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * One branch, expanded under its city — the original card, unchanged.
 *
 * The run-on mono lines that replaced it were unreadable: nine numbers with no
 * column alignment, so nothing lined up between one branch and the next. The
 * card's labelled 4-across figure rows are what made it scannable, and they
 * are worth the vertical space.
 */
const BranchCard = ({ b, metric, cityBest }) => {
  const value = b[metric.key];
  // Against the CITY, not the whole estate — once a city is open, its own
  // branches are the comparison being made.
  const share = cityBest > 0 && value != null ? (value / cityBest) * 100 : null;
  const hue =
    share == null ? T.muted2 : share >= 40 ? GOOD : share >= 20 ? MID : LOW;

  return (
    <View style={st.card}>
      <View style={[st.spine, { backgroundColor: hue }]} />

      <View style={st.cardTop}>
        <Text style={st.branchName} numberOfLines={1}>
          {b.location}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[st.lead, { color: hue }]}>
            {fmtValue(value, metric)}
          </Text>
          {share != null && (
            <Text style={st.vsGroup}>{Math.round(share)}% of city</Text>
          )}
        </View>
      </View>

      <View style={st.cardTrack}>
        <View
          style={{
            width: `${Math.max((n0(value) / (cityBest || 1)) * 100, 1.5)}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: hue,
          }}
        />
      </View>

      {/* Every column, labelled and aligned four across — nothing hidden, and
          the labels are what make it readable at a glance. */}
      <View style={st.figs}>
        <Fig label="NEW PT" value={num(b.newPatients)} />
        <Fig label="M:F" value={`${b.male}:${b.female}`} />
        <Fig label="OPD" value={num(b.totalOPD)} />
        <Fig
          label="AVG OPD"
          value={b.avgOPDBill == null ? '—' : inr(b.avgOPDBill)}
        />
      </View>
      <View style={[st.figs, st.figs2]}>
        <Fig
          label="CONV"
          value={b.conversion == null ? '—' : `${b.conversion.toFixed(0)}%`}
        />
        <Fig label="IPD" value={num(b.ipdCount)} />
        <Fig
          label="AVG IPD"
          value={b.avgIPDBill == null ? '—' : inr(b.avgIPDBill)}
        />
        <Fig label="PHARMACY" value={inr(b.pharmacy)} />
      </View>
    </View>
  );
};

const Fig = ({ label, value }) => (
  <View style={st.fig}>
    <Text style={st.figLabel}>{label}</Text>
    <Text style={[st.figVal, value === '—' && { color: T.chevron }]}>
      {value}
    </Text>
  </View>
);

export default BranchSummaryScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  loadingNote: {
    fontSize: 11.5,
    color: T.muted2,
    marginTop: 12,
    fontFamily: F.regular,
  },
  body: { paddingHorizontal: 16 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    fontFamily: F.regular,
    fontSize: 13,
  },

  hdr: {
    backgroundColor: T.headerBg,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 38,
  },
  hdrTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    backgroundColor: T.headerTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdrEyebrow: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: T.headerMuted,
  },
  hdrTitle: {
    fontFamily: F.semibold,
    fontSize: 17,
    color: '#fff',
    marginTop: 2,
  },
  hdrBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  hdrSub: { fontFamily: F.mono, fontSize: 10.5, color: T.headerMuted },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.headerTile,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scopeText: { fontFamily: F.mono, fontSize: 11, color: '#D2E0D9' },

  statRow: { flexDirection: 'row', gap: 9 },
  stat: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 17,
    color: T.text,
    marginTop: 7,
    letterSpacing: -0.4,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 20,
    marginHorizontal: 2,
  },
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
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },

  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
    marginHorizontal: 6,
    marginBottom: 0,
  },
  listHeadText: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: T.muted2,
  },
  listHeadVal: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: T.muted2,
  },

  // A card per city, with real space between them. A hairline on a continuous
  // tinted ground was not enough separation — fifteen rows read as one block,
  // and the eye had nothing to tell it where Pune ended and Mumbai began.
  cityWrap: {
    backgroundColor: '#F4F8F5',
    borderWidth: 1,
    borderColor: '#DCE7E0',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 10,
    overflow: 'hidden',
  },
  cityWrapOpen: { backgroundColor: '#EDF4EF', borderColor: T.brand },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  cityName: {
    fontSize: 14.5,
    fontFamily: F.semibold,
    color: T.brand,
    letterSpacing: -0.1,
  },
  cityMeta: { fontFamily: F.mono, fontSize: 9.5, color: T.muted, marginTop: 3 },
  value: {
    fontFamily: F.mono,
    fontSize: 15,
    letterSpacing: -0.3,
    color: T.brand,
  },
  rank: { width: 18, fontFamily: F.mono, fontSize: 10, color: T.muted2 },

  cityFigs: {
    paddingHorizontal: 16,
    paddingBottom: 13,
    marginTop: -4,
  },
  figs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    // Slightly stronger than lineSoft, which disappears against the wash.
    borderTopColor: '#DCE7E0',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 8,
    overflow: 'hidden',
  },
  valueCol: { alignItems: 'flex-end', minWidth: 76 },
  vsGroup: { fontFamily: F.mono, fontSize: 9, color: T.muted2, marginTop: 3 },

  // Inside the city card now, so the top border separates it from the figures
  // above rather than floating on the page.
  branchList: {
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: '#DCE7E0',
    paddingVertical: 4,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginHorizontal: 10, // was 16
    marginTop: 8,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  branchName: { flex: 1, fontSize: 13.5, fontFamily: F.medium, color: T.text },
  lead: { fontFamily: F.mono, fontSize: 15, letterSpacing: -0.3 },
  cardTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 10,
    overflow: 'hidden',
  },
  figs2: { marginTop: 9, paddingTop: 9 },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7,
    letterSpacing: 0.8,
    color: T.muted2,
  },
  figVal: { fontFamily: F.mono, fontSize: 11, color: T.text, marginTop: 4 },
  branchValue: { fontFamily: F.mono, fontSize: 12.5, color: T.text },

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
