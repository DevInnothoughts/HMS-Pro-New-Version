/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/BranchSummaryScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Every city on one screen, each opening to its branches.
// The mobile answer to hhc-dashboard.html.
//
//   GET /overview/branchSummaryV2?from=&to=&locations=a,b,c
//
// Two figures per branch for the chosen range:
//   NEW PT        confirmed appointments with patient_type = 'New'
//   REV / NEW PT  (OPD + LAB + IPD + PHARMACY of EVERY patient type)
//                 ÷ new patients
// Tapping a branch opens BranchTrend — both figures as line charts, monthly,
// quarterly (FY) and yearly (FY).
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
// ⚠️ CITY TOTALS ARE SUMMED, RATIOS ARE RECOMPUTED
// ────────────────────────────────────────────────
// New patients and revenue add up. Revenue per new patient does NOT — averaging
// four branches' ratios weights a 12-patient branch the same as a 400-patient
// one. It is recomputed from the city's pooled revenue ÷ pooled new patients.
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

const ENDPOINT = '/overview/branchSummaryV2';

// The server reads every branch in turn (two at a time, to spare each branch
// DB's small pool), so a full list takes well over the client's default 20s.
// Without this the app gave up at 20s and showed "timed out" while the server
// was still working.
const TIMEOUT_MS = 180000;

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
  { key: 'newPatients', label: 'New pt' },
  {
    key: 'revenuePerNewPatient',
    label: 'Rev / new pt',
    money: true,
    derived: true,
  },
];

const n0 = v => Number(v) || 0;

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

/** Roll a set of branch rows into one line. See the header on ratios. */
const perNew = (rev, n) => (n > 0 ? rev / n : null);
const pctChange = (cur, prev) =>
  cur == null || prev == null || prev === 0
    ? null
    : ((cur - prev) / prev) * 100;

/**
 * Growth of both figures for a pooled set of branches. Built from the raw
 * comparison figures the API returns (`prev`), never by averaging branch
 * percentages — same rule as the ratios.
 */
const pooledGrowth = (branches, newPatients, totalRevenue) => {
  const g = k => {
    const pn = branches.reduce((a, b) => a + n0(b.prev?.[k]?.newPatients), 0);
    const pr = branches.reduce((a, b) => a + n0(b.prev?.[k]?.totalRevenue), 0);
    return {
      newPatients: pctChange(newPatients, pn),
      revenuePerNewPatient: pctChange(
        perNew(totalRevenue, newPatients),
        perNew(pr, pn),
      ),
    };
  };
  return { mom: g('mom'), yoy: g('yoy') };
};

const roll = (name, branches) => {
  const sum = f => branches.reduce((a, b) => a + n0(b[f]), 0);
  const newPatients = sum('newPatients');
  const totalRevenue = sum('totalRevenue');

  return {
    name,
    branches,
    newPatients,
    totalRevenue,
    // Recomputed from the pool, never averaged.
    revenuePerNewPatient:
      newPatients > 0 ? Math.round(totalRevenue / newPatients) : null,
    growth: pooledGrowth(branches, newPatients, totalRevenue),
  };
};

/** ▲12% / ▼3% / – (nothing to compare against). */
const fmtGrowth = v =>
  v == null ? '–' : `${v >= 0 ? '▲' : '▼'}${Math.abs(v).toFixed(0)}%`;
// Up green, down amber — this screen keeps red for failures only.
const growthColor = v => (v == null ? T.chevron : v >= 0 ? GOOD : MID);

/** "▲12% · ▼3%" — MoM then YoY, each in its own colour. */
const GrowthLine = ({ growth, field, style }) => {
  const m = growth?.mom?.[field];
  const y = growth?.yoy?.[field];
  return (
    <Text style={[st.growth, style]} numberOfLines={1} adjustsFontSizeToFit>
      <Text style={{ color: growthColor(m) }}>{fmtGrowth(m)}</Text>
      <Text style={{ color: T.chevron }}> · </Text>
      <Text style={{ color: growthColor(y) }}>{fmtGrowth(y)}</Text>
    </Text>
  );
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
  const [metricKey, setMetricKey] = useState('newPatients');
  const [openCity, setOpenCity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  const metric = METRICS.find(m => m.key === metricKey) || METRICS[0];

  const branchList = useMemo(
    () => (Array.isArray(locationArray) ? locationArray.filter(Boolean) : []),
    [locationArray],
  );

  const load = useCallback(
    async (quiet = false) => {
      // No branches → the server would reject the call with a 400.
      if (!branchList.length) {
        setError('No branches are assigned to this login.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(
          await get(
            ENDPOINT,
            { from, to, locations: branchList.join(',') },
            { timeout: TIMEOUT_MS },
          ),
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, branchList],
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

  // The trend screen reads its own history; only the name needs to travel.
  const openBranch = useCallback(
    location =>
      navigation.navigate('BranchTrend', {
        location,
        city: CITY_OF[location] || null,
      }),
    [navigation],
  );

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
            label="New pt"
            value={num(totals.newPatients)}
            growth={totals.growth}
            field="newPatients"
          />
          <Stat
            label="Rev / new pt"
            value={
              totals.revenuePerNewPatient == null
                ? '—'
                : inr(totals.revenuePerNewPatient)
            }
            growth={totals.growth}
            field="revenuePerNewPatient"
            wide
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

        {/* Column heads line up with the two number columns in every row. */}
        <View style={st.listHead}>
          <Text style={[st.listHeadText, { flex: 1 }]}>CITY</Text>
          <Text
            style={[
              st.listHeadVal,
              st.colNew,
              metricKey === 'newPatients' && st.listHeadOn,
            ]}
          >
            NEW PT{'\n'}
            <Text style={st.listHeadSub}>MoM · YoY</Text>
          </Text>
          <Text
            style={[
              st.listHeadVal,
              st.colRev,
              metricKey === 'revenuePerNewPatient' && st.listHeadOn,
            ]}
          >
            REV / NEW PT{'\n'}
            <Text style={st.listHeadSub}>MoM · YoY</Text>
          </Text>
          <View style={{ width: 18 }} />
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
            open={openCity === item.name}
            onToggle={() =>
              setOpenCity(openCity === item.name ? null : item.name)
            }
            onOpenBranch={openBranch}
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

const Stat = ({ label, value, growth, field, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={st.statVal} numberOfLines={1}>
      {value}
    </Text>
    <View style={st.statGrowth}>
      <GrowthLine growth={growth} field={field} style={st.statGrowthText} />
      <Text style={st.statNote}> MoM · YoY</Text>
    </View>
  </View>
);

/**
 * The two figures as fixed-width columns. The one being compared by is in the
 * brand colour; the other stays dark. Numbers are the largest text in the row —
 * the name only says what the numbers belong to.
 */
const Nums = ({ x, metricKey, size }) => {
  const rev =
    x.revenuePerNewPatient == null ? '—' : inr(x.revenuePerNewPatient);
  return (
    <>
      <View style={st.colNew}>
        <Text
          style={[
            st.num,
            { fontSize: size },
            metricKey === 'newPatients' && st.numOn,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {num(x.newPatients)}
        </Text>
        <GrowthLine growth={x.growth} field="newPatients" />
      </View>
      <View style={st.colRev}>
        <Text
          style={[
            st.num,
            { fontSize: size },
            metricKey === 'revenuePerNewPatient' && st.numOn,
            rev === '—' && { color: T.chevron },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {rev}
        </Text>
        <GrowthLine growth={x.growth} field="revenuePerNewPatient" />
      </View>
    </>
  );
};

/** Thin share bar along the bottom edge of a row. */
const Bar = ({ value, best, color }) => (
  <View style={st.bar}>
    <View
      style={{
        width: `${Math.max((n0(value) / (best || 1)) * 100, 1.5)}%`,
        height: '100%',
        backgroundColor: color,
      }}
    />
  </View>
);

/**
 * One city: a single compact line — rank, name (small), then both figures in
 * big type — with its share bar underneath. Tapping opens its branches inline.
 */
const CityRow = ({ c, rank, metric, best, open, onToggle, onOpenBranch }) => {
  const value = c[metric.key];
  const multi = c.branches.length > 1;
  // A city of one IS the branch — tapping it goes straight to the trend.
  const onPress = multi ? onToggle : () => onOpenBranch(c.branches[0].location);

  return (
    <View style={[st.cityWrap, open && st.cityWrapOpen]}>
      <TouchableOpacity
        style={st.city}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={multi ? { expanded: open } : undefined}
        accessibilityLabel={`${c.name}. ${num(c.newPatients)} new patients, ${
          c.revenuePerNewPatient == null ? 'no' : inr(c.revenuePerNewPatient)
        } revenue per new patient${
          multi ? `, ${c.branches.length} branches` : '. Open trend'
        }`}
      >
        <Text style={st.rank}>{rank}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.cityName} numberOfLines={1}>
            {c.name}
          </Text>
          {multi && (
            <Text style={st.cityMeta}>{c.branches.length} branches</Text>
          )}
        </View>
        <Nums x={c} metricKey={metric.key} size={18} />
        <Icon
          name={multi ? (open ? 'expand-less' : 'expand-more') : 'show-chart'}
          size={18}
          color={T.chevron}
        />
      </TouchableOpacity>
      <Bar value={value} best={best} color={T.brand} />

      {open && (
        <View style={st.branchList}>
          {c.branches.map((b, i) => (
            <BranchRow
              key={b.location}
              b={b}
              metric={metric}
              cityBest={Math.max(...c.branches.map(x => n0(x[metric.key])), 1)}
              first={i === 0}
              onPress={() => onOpenBranch(b.location)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * One branch inside an open city: a single line, same two columns as the city
 * so the numbers stack straight down, plus a share bar against the city's best
 * branch. No card chrome — hairlines separate the rows.
 */
const BranchRow = ({ b, metric, cityBest, first, onPress }) => {
  const value = b[metric.key];
  const share = value != null ? (n0(value) / cityBest) * 100 : null;
  const hue =
    share == null ? T.muted2 : share >= 70 ? GOOD : share >= 40 ? MID : LOW;

  return (
    <TouchableOpacity
      style={[st.branch, !first && st.branchDivider]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${b.location}. ${num(b.newPatients)} new patients, ${
        b.revenuePerNewPatient == null ? 'no' : inr(b.revenuePerNewPatient)
      } revenue per new patient. Open trend`}
    >
      <View style={st.branchLine}>
        <View style={[st.dot, { backgroundColor: hue }]} />
        <Text style={st.branchName} numberOfLines={1}>
          {b.location}
        </Text>
        <Nums x={b} metricKey={metric.key} size={15} />
        <Icon name="show-chart" size={16} color={T.chevron} />
      </View>
      <View style={st.branchBarWrap}>
        <Bar value={value} best={cityBest} color={hue} />
      </View>
    </TouchableOpacity>
  );
};

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
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingLeft: 36, // past the rank column
  },
  listHeadText: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 1.1,
    color: T.muted2,
  },
  listHeadVal: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: T.muted2,
    textAlign: 'right',
  },
  listHeadOn: { color: T.brand },

  // Fixed number columns, shared by the header, cities and branches, so every
  // figure on the screen lines up vertically.
  colNew: { width: 62, alignItems: 'flex-end', textAlign: 'right' },
  colRev: { width: 96, alignItems: 'flex-end', textAlign: 'right' },
  growth: { fontFamily: F.mono, fontSize: 8.5, marginTop: 1 },
  listHeadSub: { fontSize: 7, letterSpacing: 0.4, color: T.chevron },
  statGrowth: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  statGrowthText: { fontSize: 9.5, marginTop: 0 },
  num: {
    fontFamily: F.mono,
    fontWeight: '700',
    color: T.text,
    letterSpacing: -0.4,
  },
  numOn: { color: T.brand },

  cityWrap: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 7,
    overflow: 'hidden',
  },
  cityWrapOpen: { borderColor: T.brand },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
  },
  rank: {
    width: 18,
    fontFamily: F.mono,
    fontSize: 10,
    color: T.muted2,
    textAlign: 'center',
  },
  cityName: { fontSize: 12.5, fontFamily: F.medium, color: T.muted },
  cityMeta: {
    fontFamily: F.mono,
    fontSize: 8.5,
    color: T.muted2,
    marginTop: 2,
  },
  bar: { height: 3, backgroundColor: T.lineSoft, overflow: 'hidden' },

  branchList: {
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  branch: { paddingTop: 8, paddingBottom: 7, paddingHorizontal: 10 },
  branchDivider: { borderTopWidth: 1, borderTopColor: T.lineSoft },
  branchLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 6 },
  branchName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    fontFamily: F.regular,
    color: T.muted,
  },
  branchBarWrap: {
    marginTop: 6,
    marginLeft: 26,
    borderRadius: 2,
    overflow: 'hidden',
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
