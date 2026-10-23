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
// ⚠️ REVENUE MIX PER NEW PATIENT
// ───────────────────────────────
// OPD / IPD / LAB / PHARMACY per new patient, from the API's `mix` (four parts
// that add up to totalRevenue — OPD is net of lab there). So the four figures
// add up to REV / NEW PT. They follow the same pooling rule as above: a city's
// figure is its summed part ÷ its summed new patients. Shown as one compact
// line under every row (four more columns would not fit a phone), as four
// tiles under the totals, and as COMPARE BY options so the list can be ranked
// by any of them. Lab is '—' when the server could not split it out.
//
// ⚠️ THE LIST IS A TABLE — ONE ROW, ALL FIGURES
// ─────────────────────────────────────────────
// Every city and branch is ONE row: rank · name · NEW PT · REV/NEW · OPD · IPD
// · LAB · PHARM, in fixed columns (COLS) shared by the header, cities,
// branches and the total row, so every figure lines up vertically. Figures are
// compact Indian units (K thousand, L lakh, Cr crore — `cmp`); money columns
// are ₹ per new patient, said once in the header rather than in every cell.
// The compared column is tinted and bold; tapping a column header sorts by it.
// MoM / YoY growth lives in the totals cards above and on Branch Trend — in
// six columns on a phone it would not be readable.
//
// ⚠️ THE TABLE SCROLLS SIDEWAYS — IT NEVER SHRINKS ITS TYPE
// ─────────────────────────────────────────────────────────
// Squeezing eight columns into a phone's width meant 7.5–10.5pt type, and
// adjustsFontSizeToFit shrank it further on iPhone. Now (design Option A) the
// # / city column is FROZEN on the left and the six figures, at 14pt in fixed
// columns, scroll sideways beside it — so a row's name never leaves the screen
// while its numbers are read. Names are smaller than the figures on purpose:
// they identify the row, the figures are what is compared. Cities alternate
// shading; the compared column is a tinted stripe. The figures stretch to
// fill the screen when it is wider than them. The screen is a plain ScrollView
// rather than a FlatList, because the table is two side-by-side stacks a list
// cannot split across header / items / footer; with ~25 cities there is
// nothing to virtualise.
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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';

import AppDrawer from '../common/AppDrawer';
import { get } from '../api/client';
import {
  cached,
  fetchedAt,
  peekAsync,
  rangeKey,
  updatedLabel,
} from '../api/queryCache';
import ScopePicker from '../design/components/ScopePicker';
import SummaryTabBar from '../design/components/SummaryTabBar';
import { useScopeRange } from '../scope/useScopeRange';
import { scopeLabel, setPreset } from '../store/scopeSlice';
import { F, T, inr, inrCompact, num, tint } from '../design/tokens';

const ENDPOINT = '/overview/branchSummaryV2';

// The server reads every branch in turn (two at a time, to spare each branch
// DB's small pool), so a full list takes well over the client's default 20s.
// Without this the app gave up at 20s and showed "timed out" while the server
// was still working.
const TIMEOUT_MS = 180000;

// ⚠️ OPENS ON THE CURRENT MONTH — ONCE PER APP SESSION
// The date scope is app-wide (redux), and its own default is Today. This
// screen asks for 'This Month' the FIRST time it mounts in a session only, so
// a range the user then picks — here or anywhere — is never overwritten when
// they come back. Module-level on purpose: it resets when the app restarts.
let monthDefaulted = false;

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

// The four parts of revenue, in display order. `key` is the API's mix key,
// `field` the flat per-new-patient key added to every branch and city row.
const MIX = [
  { key: 'opd', field: 'opdPerNewPatient', label: 'OPD', short: 'OPD' },
  { key: 'ipd', field: 'ipdPerNewPatient', label: 'IPD', short: 'IPD' },
  { key: 'lab', field: 'labPerNewPatient', label: 'Lab', short: 'LAB' },
  {
    key: 'pharmacy',
    field: 'pharmacyPerNewPatient',
    label: 'Pharmacy',
    short: 'PHARM',
  },
];

const METRICS = [
  { key: 'newPatients', label: 'New pt' },
  {
    key: 'revenuePerNewPatient',
    label: 'Rev / new pt',
    money: true,
    derived: true,
  },
  ...MIX.map(m => ({
    key: m.field,
    label: `${m.label} / new pt`,
    money: true,
    derived: true,
  })),
];

const n0 = v => Number(v) || 0;

/**
 * Compact Indian units for the table: 940 · 12.4K · 3.25L · 1.2Cr. No ₹ — the
 * header says which columns are money. '—' for null (no new patients, lab not
 * split). Thresholds are on the ROUNDED value, so 99,960 reads 1L, not 100K.
 */
const cmp = v => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const trim = x => x.replace(/\.?0+$/, '');
  if (a < 999.5) return sign + Math.round(a);
  if (a < 99950) return sign + trim((a / 1e3).toFixed(1)) + 'K';
  if (a < 9995000)
    return sign + trim((a / 1e5).toFixed(a < 995000 ? 2 : 1)) + 'L';
  return sign + trim((a / 1e7).toFixed(a < 99500000 ? 2 : 1)) + 'Cr';
};

// The table's number columns, left to right. `w` is shared by the header and
// every row so the figures stack straight down. Sized for 13pt figures — the
// table scrolls sideways rather than shrinking them (see header).
const COLS = [
  { key: 'newPatients', head: 'NEW', w: 56, spoken: 'new patients' },
  {
    key: 'revenuePerNewPatient',
    head: 'REV/NEW',
    w: 70,
    spoken: 'revenue per new patient',
    money: true,
  },
  { key: 'opdPerNewPatient', head: 'OPD', w: 62, spoken: 'OPD', money: true },
  { key: 'ipdPerNewPatient', head: 'IPD', w: 62, spoken: 'IPD', money: true },
  { key: 'labPerNewPatient', head: 'LAB', w: 58, spoken: 'lab', money: true },
  {
    key: 'pharmacyPerNewPatient',
    head: 'PHARM',
    w: 68,
    spoken: 'pharmacy',
    money: true,
  },
];
// The frozen # + city column. Everything right of it scrolls sideways.
const FROZEN_W = 104;

/** "Pune: new patients 1.2K, revenue per new patient ₹18.4K, …" */
const spokenRow = (name, x) =>
  `${name}. ` +
  COLS.map(
    c =>
      `${c.spoken} ${
        x[c.key] == null
          ? 'not available'
          : `${c.money ? '₹' : ''}${cmp(x[c.key])}`
      }`,
  ).join(', ');

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

/**
 * The flat per-new-patient fields for one row, from its `mix` amounts and new
 * patients. A part that is null (lab not split) stays null, never 0.
 */
const mixFields = (mix, newPatients) => {
  const out = {};
  for (const m of MIX) {
    const v = mix?.[m.key];
    out[m.field] =
      v == null || !(newPatients > 0) ? null : Math.round(v / newPatients);
  }
  return out;
};

/** A branch row from the API, with the four flat fields added. */
const withMix = b => ({ ...b, ...mixFields(b.mix, b.newPatients) });

/** Sum one mix part over branches; null if any branch has it unknown. */
const sumMix = (branches, key) =>
  branches.some(b => b.mix?.[key] == null)
    ? null
    : branches.reduce((a, b) => a + n0(b.mix[key]), 0);

const roll = (name, branches) => {
  const sum = f => branches.reduce((a, b) => a + n0(b[f]), 0);
  const newPatients = sum('newPatients');
  const totalRevenue = sum('totalRevenue');
  const mix = Object.fromEntries(
    MIX.map(m => [m.key, sumMix(branches, m.key)]),
  );

  return {
    name,
    branches,
    newPatients,
    totalRevenue,
    mix,
    // Recomputed from the pool, never averaged.
    revenuePerNewPatient:
      newPatients > 0 ? Math.round(totalRevenue / newPatients) : null,
    ...mixFields(mix, newPatients),
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
  const dispatch = useDispatch();
  // Hold the first read until the month default is in place — otherwise the
  // slow all-branch read runs once for Today and again for the month.
  const [ready, setReady] = useState(
    () =>
      monthDefaulted ||
      scope.preset === 'month' ||
      // A caller that passed its own dates (useScopeRange) wins.
      !!(route?.params?.fromDate && route?.params?.toDate),
  );
  useEffect(() => {
    if (ready) {
      monthDefaulted = true;
      return;
    }
    monthDefaulted = true;
    dispatch(setPreset('month'));
    setReady(true);
  }, [ready, dispatch]);

  const [data, setData] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [metricKey, setMetricKey] = useState('newPatients');
  const [openCity, setOpenCity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  // The table fills the screen width at least (minus the 16pt gutters).
  const { width: winW } = useWindowDimensions();
  const tableMinW = winW - 32;

  const branchList = useMemo(
    () => (Array.isArray(locationArray) ? locationArray.filter(Boolean) : []),
    [locationArray],
  );

  // ⚠️ CACHED ON THE PHONE — see src/api/queryCache.js. Opening this screen,
  // even after the app was closed, shows the last stored figures with no
  // server call. ONLY pull-to-refresh (force) reads all the branches again.
  // A range never read before has nothing stored, so it is fetched once.
  const rKey = rangeKey(scope);
  const load = useCallback(
    async ({ quiet = false, force = false } = {}) => {
      // No branches → the server would reject the call with a 400.
      if (!branchList.length) {
        setError('No branches are assigned to this login.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const locations = branchList.join(',');
      const key = `${ENDPOINT}|${rKey}|${locations}`;

      // Already have it: paint at once — no request.
      const hit = force ? undefined : await peekAsync(key);
      if (hit !== undefined) {
        setData(hit);
        setUpdatedAt(fetchedAt(key));
        setError('');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await cached(
          key,
          () => get(ENDPOINT, { from, to, locations }, { timeout: TIMEOUT_MS }),
          { force },
        );
        setData(res);
        setUpdatedAt(fetchedAt(key));
        // Branches that could not be read are kept too and listed in the
        // footer — pull to refresh to try them again.
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, rKey, branchList],
  );

  useEffect(() => {
    if (ready) load();
  }, [load, ready]);

  const totals = data?.totals || {};
  const totalsMix = mixFields(totals.mix, totals.newPatients);
  const all = data?.branches || [];
  const ok = useMemo(() => all.filter(b => !b.error).map(withMix), [all]);
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
            {/* How old the figures are — they may come from the cache. */}
            {updatedAt
              ? `\n${updatedLabel(updatedAt)} · pull down to refresh`
              : ''}
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

        {/* The four parts of REV / NEW PT — they add up to it. */}
        <View style={st.mixCard}>
          <Text style={st.mixCardTitle}>PER NEW PATIENT</Text>
          <View style={st.mixTiles}>
            {MIX.map(m => {
              const v = totalsMix[m.field];
              const share =
                v != null && totals.revenuePerNewPatient > 0
                  ? Math.round((v / totals.revenuePerNewPatient) * 100)
                  : null;
              const on = metricKey === m.field;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[st.mixTile, on && st.mixTileOn]}
                  onPress={() => setMetricKey(m.field)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${m.label} per new patient ${
                    v == null ? 'not available' : inr(v)
                  }${
                    share == null ? '' : `, ${share}% of revenue`
                  }. Compare by this`}
                >
                  <Text style={st.mixTileLabel}>{m.short}</Text>
                  <Text
                    style={[st.mixTileVal, on && st.numOn]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {v == null ? '—' : inr(v)}
                  </Text>
                  <Text style={st.mixTileShare}>
                    {share == null ? ' ' : `${share}% of rev`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Pick the column you care about; cities AND their branches re-sort
            and lead with it, and its column is highlighted in the table. */}
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

        <Text style={st.tCaption}>
          ₹ figures are per new patient · K thousand · L lakh · Cr crore · tap a
          heading to sort · swipe the figures for every column
        </Text>
      </View>
    </View>
  );

  // Bottom row of the table: the whole estate, pooled server-side.
  const totalX =
    rows.length > 0 && !query
      ? {
          newPatients: totals.newPatients,
          revenuePerNewPatient: totals.revenuePerNewPatient,
          ...totalsMix,
        }
      : null;

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
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load({ quiet: true, force: true });
            }}
            tintColor={T.brand}
          />
        }
      >
        {header}

        {loading && !refreshing ? (
          <View style={st.centre}>
            <ActivityIndicator color={T.brand} />
            <Text style={st.loadingNote}>
              Reading every branch — this takes a moment.
            </Text>
          </View>
        ) : !rows.length ? (
          <Text style={st.empty}>{error || 'No data for this period.'}</Text>
        ) : (
          <CityTable
            cities={rows}
            totalX={totalX}
            metricKey={metricKey}
            onSort={setMetricKey}
            openCity={openCity}
            onToggleCity={name => setOpenCity(openCity === name ? null : name)}
            onOpenBranch={openBranch}
            minWidth={tableMinW}
          />
        )}

        {footer}
      </ScrollView>

      <SummaryTabBar navigation={navigation} active="summary" />

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
 * The six figures of one row as fixed-width cells (COLS). The compared column
 * is tinted and bold in the brand colour, matching its header. Cells grow
 * together when the table is wider than its columns, so they stay aligned.
 */
const TableCells = ({ x, metricKey, kind }) =>
  COLS.map(c => {
    const on = metricKey === c.key;
    const v = x[c.key];
    return (
      <View key={c.key} style={[st.tCell, { width: c.w }, on && st.tCellOn]}>
        <Text
          style={[
            st.tNum,
            kind === 'branch' && st.tNumSmall,
            (kind === 'total' || on) && st.tNumBold,
            on && st.tNumOn,
            v == null && st.tNumNone,
          ]}
          // No adjustsFontSizeToFit: the columns are wide enough, and on
          // iPhone it was shrinking figures well below the set size.
          numberOfLines={1}
          // Rows have fixed heights (ROW_H); unbounded Dynamic Type would
          // clip the figures.
          maxFontSizeMultiplier={1.15}
        >
          {cmp(v)}
        </Text>
      </View>
    );
  });

// Row heights are FIXED: the frozen column and the scrolling figures are two
// separate stacks, and fixed heights are what keep each row level across both.
const ROW_H = { head: 34, city: 40, branch: 34, total: 38 };

const rowBg = l =>
  l.kind === 'branch'
    ? '#F7F9F8'
    : l.kind === 'total'
    ? T.canvas
    : l.open
    ? tint(T.brand)
    : l.zebra
    ? T.subtle
    : T.card;

/**
 * The city table, Option A: the # / city column is FROZEN on the left; the six
 * figures scroll sideways beside it. Cities alternate shading; an open city is
 * tinted and its branches follow on a lighter ground. Both halves render from
 * the same `lines`, so they can never disagree about order.
 */
const CityTable = ({
  cities,
  totalX,
  metricKey,
  onSort,
  openCity,
  onToggleCity,
  onOpenBranch,
  minWidth,
}) => {
  const lines = [];
  cities.forEach((c, i) => {
    const multi = c.branches.length > 1;
    const open = multi && openCity === c.name;
    lines.push({
      kind: 'city',
      key: `c:${c.name}`,
      rank: i + 1,
      name: c.name,
      meta: multi ? `${c.branches.length} branches` : null,
      x: c,
      multi,
      open,
      zebra: i % 2 === 1,
      onPress: multi
        ? () => onToggleCity(c.name)
        : () => onOpenBranch(c.branches[0].location),
      a11y: `${spokenRow(c.name, c)}${
        multi ? `. ${c.branches.length} branches` : '. Open trend'
      }`,
    });
    if (open) {
      // The dot: how each branch sits against the city's best on the compared
      // figure (green ≥70%, amber ≥40%, brown below).
      const best = Math.max(...c.branches.map(b => n0(b[metricKey])), 1);
      c.branches.forEach(b => {
        const v = b[metricKey];
        const share = v == null ? null : (n0(v) / best) * 100;
        lines.push({
          kind: 'branch',
          key: `b:${b.location}`,
          name: b.location,
          x: b,
          hue:
            share == null
              ? T.muted2
              : share >= 70
              ? GOOD
              : share >= 40
              ? MID
              : LOW,
          onPress: () => onOpenBranch(b.location),
          a11y: `${spokenRow(b.location, b)}. Open trend`,
        });
      });
    }
  });
  if (totalX) {
    lines.push({
      kind: 'total',
      key: 'total',
      name: 'All branches',
      x: totalX,
    });
  }

  const figuresW = COLS.reduce((a, c) => a + c.w, 0);

  return (
    <View style={st.table}>
      <View style={st.tBody}>
        {/* ── Frozen: # and city ── */}
        <View style={st.frozen}>
          <View style={[st.leftRow, st.tHead, { height: ROW_H.head }]}>
            <Text style={[st.tHeadText, st.tRank]}>#</Text>
            <Text style={st.tHeadText}>CITY</Text>
          </View>
          {lines.map(l => {
            const Row = l.onPress ? TouchableOpacity : View;
            return (
              <Row
                key={l.key}
                style={[
                  st.leftRow,
                  { height: ROW_H[l.kind], backgroundColor: rowBg(l) },
                ]}
                activeOpacity={0.7}
                onPress={l.onPress}
                accessibilityRole={l.onPress ? 'button' : undefined}
                accessibilityState={l.multi ? { expanded: l.open } : undefined}
                accessibilityLabel={l.a11y}
              >
                {l.kind === 'branch' ? (
                  <View style={st.tRank}>
                    <View style={[st.dot, { backgroundColor: l.hue }]} />
                  </View>
                ) : (
                  <Text style={st.tRank}>{l.rank || ''}</Text>
                )}
                <View style={st.tName}>
                  <Text
                    style={
                      l.kind === 'branch'
                        ? st.branchName
                        : l.kind === 'total'
                        ? st.tTotalName
                        : st.cityName
                    }
                    numberOfLines={1}
                    maxFontSizeMultiplier={1}
                  >
                    {l.name}
                  </Text>
                  {!!l.meta && (
                    <Text style={st.cityMeta} maxFontSizeMultiplier={1}>
                      {l.meta}
                    </Text>
                  )}
                </View>
                {l.kind !== 'total' && (
                  <Icon
                    name={
                      l.multi
                        ? l.open
                          ? 'expand-less'
                          : 'expand-more'
                        : 'show-chart'
                    }
                    size={l.kind === 'branch' ? 12 : 14}
                    color={T.chevron}
                  />
                )}
              </Row>
            );
          })}
        </View>

        {/* ── Scrolling: the six figures ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={st.figures}
        >
          <View
            style={{ minWidth: Math.max(figuresW, minWidth - FROZEN_W - 2) }}
          >
            <View style={[st.figRow, st.tHead, { height: ROW_H.head }]}>
              {COLS.map(c => {
                const on = metricKey === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => onSort(c.key)}
                    style={[
                      st.tCell,
                      st.tHeadCell,
                      { width: c.w },
                      on && st.tCellOn,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Sort by ${c.spoken}`}
                  >
                    <Text style={[st.tHeadText, on && st.tHeadOn]}>
                      {c.head}
                      {on ? ' ↓' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {lines.map(l => {
              const Row = l.onPress ? TouchableOpacity : View;
              return (
                <Row
                  key={l.key}
                  style={[
                    st.figRow,
                    { height: ROW_H[l.kind], backgroundColor: rowBg(l) },
                  ]}
                  activeOpacity={0.7}
                  onPress={l.onPress}
                  // The frozen half carries the spoken label for this row.
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                >
                  <TableCells x={l.x} metricKey={metricKey} kind={l.kind} />
                </Row>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
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

  // Fixed number columns, shared by the header, cities and branches, so every
  // figure on the screen lines up vertically.
  growth: { fontFamily: F.mono, fontSize: 8.5, marginTop: 1 },
  statGrowth: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  statGrowthText: { fontSize: 9.5, marginTop: 0 },
  numOn: { color: T.brand },

  // Revenue mix per new patient — totals card.
  mixCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    marginTop: 9,
  },
  mixCardTitle: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
    marginLeft: 2,
    marginBottom: 7,
  },
  mixTiles: { flexDirection: 'row', gap: 6 },
  mixTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.lineSoft,
    backgroundColor: T.subtle,
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  mixTileOn: { borderColor: T.brand, backgroundColor: tint(T.brand) },
  mixTileLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: T.muted2,
  },
  mixTileVal: {
    fontFamily: F.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: T.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  mixTileShare: {
    fontSize: 8.5,
    color: T.muted2,
    marginTop: 2,
    fontFamily: F.regular,
  },

  // Revenue mix per new patient — the line under each city / branch row.

  // City and branch names are deliberately smaller than the figures: the
  // names only identify the row, the figures are what is being compared.
  cityName: { fontSize: 10.5, fontFamily: F.medium, color: T.text },
  cityMeta: {
    fontFamily: F.mono,
    fontSize: 8.5,
    color: T.muted2,
    marginTop: 1,
  },
  branchName: { fontSize: 10, fontFamily: F.regular, color: T.muted },

  // ── The comparison table (Option A) ──────────────────────────────────────
  // One card. Left: the frozen # / city column (FROZEN_W) with a shadow edge.
  // Right: a horizontal ScrollView of the six figures. Every row is drawn
  // twice, once per half, at the same fixed height (ROW_H).
  tCaption: {
    fontSize: 11,
    lineHeight: 15,
    color: T.muted2,
    fontFamily: F.regular,
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  table: {
    marginHorizontal: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tBody: { flexDirection: 'row' },
  frozen: {
    width: FROZEN_W,
    backgroundColor: T.card,
    borderRightWidth: 1,
    borderRightColor: T.line,
    // Shadow edge over the figures as they scroll under it (iOS; Android
    // keeps the border line).
    zIndex: 1,
    shadowColor: '#0F1A16',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  figures: { flex: 1 },
  tHead: {
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    alignItems: 'flex-end',
  },
  tHeadText: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: T.muted2,
    paddingBottom: 6,
    textAlign: 'right',
  },
  tHeadOn: { color: T.brand, fontWeight: '700' },
  tHeadCell: { justifyContent: 'flex-end' },

  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
    paddingRight: 3,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  figRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  tTotalName: { fontFamily: F.semibold, fontSize: 10.5, color: T.text },

  tRank: {
    width: 15,
    alignItems: 'center',
    textAlign: 'center',
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
  },
  tName: { flex: 1, minWidth: 0, paddingLeft: 1, paddingRight: 2 },
  tCell: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 10,
    paddingLeft: 4,
  },
  // The compared column: a tinted stripe straight down the table.
  tCellOn: { backgroundColor: tint(T.brand) },
  tNum: {
    fontFamily: F.mono,
    fontSize: 14,
    fontWeight: '500',
    color: T.text,
    letterSpacing: -0.2,
    textAlign: 'right',
  },
  tNumSmall: { fontSize: 12.5, fontWeight: '400', color: T.muted },
  tNumBold: { fontWeight: '700' },
  tNumOn: { color: T.brand },
  tNumNone: { color: T.chevron },

  dot: { width: 7, height: 7, borderRadius: 3.5 },

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
