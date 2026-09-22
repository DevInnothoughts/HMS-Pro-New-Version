/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/LabCollectionScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Lab Collection. Same endpoint (/OPDCollection/v4?section=LAB), same rows,
// same dynamic test chips driven by consultationList.
//
// ⚠️ THE HEADLINE TOTAL EXCLUDES CHEQUE — UNCHANGED FROM THE OLD SCREEN
// ─────────────────────────────────────────────────────────────────────
// LabCollectionReport sums cash, card, online and cheque separately and builds
// its headline from cash + card + online, exactly as OPDCollectionReport does —
// the two screens were cut from the same template. Cheque is computed and never
// added in.
//
// That is almost certainly a bug, but this was a redesign brief, not a
// recalculation one, and changing it would silently move a figure the finance
// team reconciles against. So the total is identical to the old screen's, and
// cheque is shown as its own figure with a note whenever it is non-zero — the
// gap is visible instead of invisible. Fix it in BOTH screens at once, as its
// own change, or not at all.
//
// ⚠️ VERIFY ONCE against the old screen on a day with cheque payments. If the
// old headline turns out to include cheque, add `+ t.Cheque` to `headline` in
// the totals memo and delete the warning line.
//
// WHY THE CHIPS SCROLL AND OPD's DO NOT
// ─────────────────────────────────────
// OPD has four fixed buckets. LAB's consultationList is every lab test actually
// billed in the range — a dozen or more on a busy branch, with names like
// "COMPLETE BLOOD COUNT". They scroll horizontally, sorted by revenue so the
// tests that matter are reachable without scrolling to the end.
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

import { get } from '../api/client';
import { Legend, StackBar } from '../design/components/primitives';
import SectionHeader from '../design/components/SectionHeader';
import { useScopeRange } from '../scope/useScopeRange';
import { F, HUE, T, inr, num } from '../design/tokens';

const HUE_L = HUE.lab;

// Payment-mode colours, in the section's own family so Lab does not borrow
// OPD's blue for "Cash".
const MODE_COLORS = {
  Cash: '#6E5AA8',
  Card: '#3E8C8C',
  Online: '#2F6FA8',
  Cheque: '#B3762B',
};

// Cycled across however many tests a branch bills. Ordered so adjacent
// segments never sit at similar lightness — a stacked bar of twelve segments
// is unreadable otherwise.
const TEST_COLORS = [
  '#6E5AA8',
  '#2F6FA8',
  '#3E8C8C',
  '#B3762B',
  '#B3523B',
  '#4A6B2F',
  '#A8567F',
  '#59636F',
  '#8A6FC4',
  '#2A7F8C',
  '#C2670E',
  '#7A8B5F',
];
const MODES = ['Cash', 'Card', 'Online', 'Cheque'];

const n0 = v => Number(v) || 0;

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  const M = [
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
  return `${dt.getDate()} ${M[dt.getMonth()]}`;
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const consultationOf = item =>
  String(item.consultation ?? '')
    .trim()
    .toUpperCase();

// "COMPLETE BLOOD COUNT" → "Complete Blood Count". The stored names are
// upper-case and read as shouting in a chip.
const titleCase = s =>
  String(s || '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

const LabCollectionScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [rows, setRows] = useState([]);
  const [testList, setTestList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [billType, setBillType] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/OPDCollection/v4', {
          location,
          from,
          to,
          section: 'LAB',
        });
        setRows(res?.data || []);
        setTestList(res?.consultationList || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Test filter first, so the chip amounts describe the same set the search
  // then narrows — chips that shifted as you typed would be unreadable.
  const byType = useMemo(() => {
    if (!billType) return rows;
    const known = testList.filter(t => t !== 'OTHER');
    // Anything outside a named bucket lands in OTHER, so the chips always add
    // up to the full row set whatever the master table contains.
    return billType === 'OTHER'
      ? rows.filter(r => !known.includes(consultationOf(r)))
      : rows.filter(r => consultationOf(r) === billType);
  }, [rows, billType, testList]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(r =>
      String(r.name || '')
        .toLowerCase()
        .includes(q),
    );
  }, [byType, query]);

  // Totals follow the visible list, matching the old screen.
  const totals = useMemo(() => {
    const t = { Cash: 0, Card: 0, Online: 0, Cheque: 0 };
    for (const r of list) {
      const amt = n0(r.total);
      if (t[r.payment_mode] !== undefined) t[r.payment_mode] += amt;
    }
    return {
      ...t,
      // The old screen's formula, cheque excluded. See the header note.
      headline: t.Cash + t.Card + t.Online,
      patients: new Set(list.map(r => r.patient_id)).size,
      tests: list.length,
    };
  }, [list]);

  // Payment modes as plain cards — four fixed buckets whose split is rarely the
  // question. Zero modes are dropped rather than shown as ₹0 cards.
  const modeCards = MODES.filter(m => totals[m] > 0).map(m => ({
    key: m,
    label: m,
    color: MODE_COLORS[m],
    amount: inr(totals[m]),
  }));

  // Per-test totals, over the UNFILTERED rows so the figures stay stable while
  // a filter is active. Sorted by revenue — with a dozen tests, alphabetical
  // buries the ones that matter.
  const testRows = useMemo(() => {
    const known = testList.filter(t => t !== 'OTHER');
    const byTest = {};
    for (const r of rows) {
      const c = consultationOf(r);
      const key = known.includes(c) ? c : 'OTHER';
      byTest[key] = (byTest[key] || 0) + n0(r.total);
    }
    const out = testList
      .map(t => ({ key: t, label: titleCase(t), amount: byTest[t] || 0 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const total = out.reduce((a, c) => a + c.amount, 0);
    return out.map((c, i) => ({
      ...c,
      // Colours cycle: with a dozen tests there is no meaningful palette, so
      // the bar's job is proportion, and the legend carries the names.
      color: TEST_COLORS[i % TEST_COLORS.length],
      pct: total > 0 ? Math.round((c.amount / total) * 100) : 0,
      amountText: inr(c.amount),
    }));
  }, [rows, testList]);

  // The bar keeps every test — it is proportional either way. The LEGEND caps
  // at seven, because a dozen named rows above the patient list is a long
  // block to scroll past on every visit.
  //
  // The tail is rolled up rather than dropped, so the legend still sums to the
  // total. Its colour is the neutral grey, not a cycled hue, so it does not
  // read as one more test.
  const LEGEND_CAP = 7;

  const legendRows = useMemo(() => {
    if (testRows.length <= LEGEND_CAP) {
      return testRows.map(t => ({ ...t, amount: t.amountText }));
    }
    const head = testRows.slice(0, LEGEND_CAP);
    const tail = testRows.slice(LEGEND_CAP);
    const tailAmount = tail.reduce((a, t) => a + t.amount, 0);
    return [
      ...head.map(t => ({ ...t, amount: t.amountText })),
      {
        key: '__other',
        label: `Other tests (${tail.length})`,
        color: T.callbackGrey,
        pct: tail.reduce((a, t) => a + t.pct, 0),
        amount: inr(tailAmount),
      },
    ];
  }, [testRows]);

  const allTotal = testRows.reduce((a, c) => a + c.amount, 0);

  const header = (
    <View>
      <SectionHeader
        code="LAB"
        name="Lab Collection"
        sub={`${fmtDate(from)} – ${fmtDate(to)}`}
        hue={HUE_L}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Collected"
            value={inr(totals.headline)}
            note={`${num(totals.tests)} tests`}
            color={T.text}
            wide
          />
          <Stat
            label="Patients"
            value={num(totals.patients)}
            note="unique"
            color={HUE_L}
          />
        </View>

        {modeCards.length > 0 && (
          <>
            <Text style={st.blockLabel}>PAYMENT MODE</Text>
            <View style={st.modeGrid}>
              {modeCards.map(m => (
                <View key={m.key} style={st.modeCard}>
                  <View style={[st.modeSpine, { backgroundColor: m.color }]} />
                  <Text style={st.modeLabel}>{m.label.toUpperCase()}</Text>
                  <Text
                    style={[st.modeVal, { color: m.color }]}
                    numberOfLines={1}
                  >
                    {m.amount}
                  </Text>
                </View>
              ))}
            </View>
            {totals.Cheque > 0 && (
              <Text style={st.warn}>
                Cheque is not included in the collected total, matching the
                existing report.
              </Text>
            )}
          </>
        )}

        <Text style={st.blockLabel}>TEST-WISE REVENUE</Text>

        {testRows.length > 0 && (
          <View style={st.card}>
            <StackBar segments={testRows} />
            <Legend
              rows={legendRows}
              total={inr(allTotal)}
              totalLabel="All tests"
            />
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          <Chip
            label="All tests"
            amount={inr(allTotal)}
            on={billType === ''}
            onPress={() => setBillType('')}
          />
          {testRows.map(c => (
            <Chip
              key={c.key}
              label={c.label}
              amount={c.amountText}
              on={billType === c.key}
              onPress={() => setBillType(billType === c.key ? '' : c.key)}
            />
          ))}
        </ScrollView>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Patient name"
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

        {list.length !== rows.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(rows.length)} tests
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        // No unique key in the payload beyond receipt_id, which repeats when one
        // receipt carries several tests — so the key is composite.
        keyExtractor={(r, i) =>
          `${r.receipt_id || 'x'}-${r.patient_id || ''}-${i}`
        }
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={HUE_L}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={HUE_L} />
            </View>
          ) : (
            <Text style={st.empty}>
              {error || 'No lab collection for this period.'}
            </Text>
          )
        }
        renderItem={({ item }) => <Row r={item} />}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote}>{note}</Text>
  </View>
);

const Chip = ({ label, amount, on, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[st.chip, on && st.chipOn]}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    accessibilityLabel={`${label}, ${amount}`}
  >
    <Text style={[st.chipLabel, on && st.chipOnText]} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[st.chipAmt, on && st.chipOnText]}>{amount}</Text>
  </TouchableOpacity>
);

const Row = ({ r }) => {
  const hue = MODE_COLORS[r.payment_mode] || T.muted2;
  return (
    <View style={st.row}>
      <View style={[st.rowSpine, { backgroundColor: hue }]} />

      <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
        <Text style={[st.avatarText, { color: hue }]}>{initials(r.name)}</Text>
      </View>

      <View style={st.main}>
        <Text style={st.name} numberOfLines={1}>
          {r.name || 'Unnamed'}
        </Text>
        {/* The test is the point of this row, so it gets its own line rather
            than being appended to a meta string. */}
        <Text style={st.test} numberOfLines={1}>
          {titleCase(r.consultation) || 'Unspecified'}
        </Text>
        <Text style={st.meta} numberOfLines={1}>
          {fmtDate(r.item_date)}
          {r.receipt_id ? ` · #${r.receipt_id}` : ''}
        </Text>
      </View>

      <View style={st.amountCol}>
        <Text style={st.amount}>{inr(r.total)}</Text>
        <Text style={[st.mode, { color: hue }]}>{r.payment_mode || '—'}</Text>
      </View>
    </View>
  );
};

export default LabCollectionScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  body: { paddingHorizontal: 16 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    fontFamily: F.regular,
    fontSize: 13,
  },

  statRow: { flexDirection: 'row', gap: 9, marginTop: -30 },
  stat: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 20,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  cardLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
    marginBottom: 11,
  },
  warn: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 11,
    fontFamily: F.regular,
    lineHeight: 14,
  },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 22,
    marginHorizontal: 2,
  },

  chips: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 11,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: T.card,
    maxWidth: 170,
  },
  chipOn: { backgroundColor: HUE_L, borderColor: HUE_L },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipAmt: { fontFamily: F.mono, fontSize: 11.5, color: T.text, marginTop: 3 },
  chipOnText: { color: '#fff' },

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
  showing: { fontSize: 10, color: T.muted2, marginTop: 10, fontFamily: F.mono },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 9,
    overflow: 'hidden',
  },
  rowSpine: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 12 },

  main: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  test: { fontSize: 11.5, color: T.text, marginTop: 3, fontFamily: F.regular },
  meta: { fontFamily: F.mono, fontSize: 10, color: T.muted2, marginTop: 3 },

  amountCol: { alignItems: 'flex-end' },
  amount: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.3,
  },
  mode: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.7, marginTop: 4 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 9 },
  modeCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  modeSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  modeLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: T.muted,
  },
  modeVal: {
    fontFamily: F.mono,
    fontSize: 17,
    marginTop: 6,
    letterSpacing: -0.4,
  },
});
