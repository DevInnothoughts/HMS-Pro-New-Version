/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/ReferenceReportScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Where new patients come from, and how many of them convert to IPD.
// Replaces the referenceV2 half of src/admin/ReferenceData.js.
//
//   GET /Patient/referenceV2?location=&from=&to=
//        → { referenceTypeCount: [{ reference_type, count, percentage,
//                                   invoiceCount, invoicePercentage }],
//            totalCount, totalInvoiceCount }
//
// ⚠️ "IPD" IS invoiceCount, RELABELLED — THE FIGURE IS UNCHANGED
// ──────────────────────────────────────────────────────────────
// An `invoice` row IS the IPD/surgery record in this codebase — the same test
// the surgery reports and the calling list use. So invoiceCount is the number
// of IPD cases from that source, and calling it "IPD" says what it is rather
// than what table it came from.
//
// ⚠️ TWO DIFFERENT PERCENTAGES, AND THEY ANSWER DIFFERENT QUESTIONS
// ─────────────────────────────────────────────────────────────────
//   SHARE  the backend's `percentage` / `invoicePercentage` — this source's
//          slice of all patients, and of all IPD cases
//   CONV   IPD ÷ patients for that source — how well the source converts
//
// Both are shown because they disagree in a way that matters: a source can be
// 40% of your patients and only 10% of your IPD, which SHARE reveals and CONV
// quantifies. CONV is derived here; the backend does not send it.
//
// ⚠️ CONV CAN EXCEED 100%
// ───────────────────────
// invoiceCount counts INVOICES, so a patient billed twice counts twice, and
// the denominator (`count`) filters on `Uid_no IS NOT NULL` while the invoice
// query does not. Both quirks are upstream and reproduced as-is; the note under
// the table says so rather than the screen quietly capping the number.
//
// ── WHY A TABLE AND NOT CARDS ──────────────────────────────────────────────
// This screen exists to compare sources. Cards force the reader to hold a
// number in their head and scroll; a column of right-aligned mono numerals
// lets the eye run straight down and rank them without effort.
//
// ⚠️ The month-wise MoM / QoQ / YoY block from ReferenceData.js is NOT here.
// That is a second endpoint whose bucket shape is only visible through its own
// valueOf(bucket, refType, metric) helper, so it was left out rather than
// half-built on a guess.
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { useScopeRange } from '../scope/useScopeRange';
import { F, T, num } from '../design/tokens';
import ReferenceComparison from './referenceComparison';

const ENDPOINT = '/Patient/referenceV2';

const n0 = v => Number(v) || 0;

// Conversion bands. High is good, so this runs the opposite way from the
// ageing colours elsewhere in the app.
const convColor = v =>
  v == null ? T.muted2 : v >= 30 ? '#1E7A5A' : v >= 15 ? '#B26A00' : T.crit;

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

const fmtShort = d => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return m ? `${Number(day)} ${MONTHS[Number(m) - 1]}` : String(d);
};

const SORTS = [
  { key: 'count', label: 'Patients' },
  { key: 'ipd', label: 'IPD' },
  { key: 'conv', label: 'Conversion' },
  { key: 'name', label: 'A–Z' },
];

const convOf = r =>
  n0(r.count) > 0 ? (n0(r.invoiceCount) / n0(r.count)) * 100 : null;

const ReferenceReportScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const location = route?.params?.location || reduxLocation;
  const { from, to } = useScopeRange(route);

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ patients: 0, ipd: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('count');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get(ENDPOINT, { location, from, to });
        setRows(res?.referenceTypeCount || []);
        setTotals({
          patients: n0(res?.totalCount),
          ipd: n0(res?.totalInvoiceCount),
        });
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

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = q
      ? rows.filter(r =>
          String(r.reference_type || '')
            .toLowerCase()
            .includes(q),
        )
      : [...rows];

    if (sortBy === 'ipd') {
      out.sort((a, b) => n0(b.invoiceCount) - n0(a.invoiceCount));
    } else if (sortBy === 'conv') {
      // Conversion RATE, not IPD volume — a small source that converts well is
      // exactly what this sort is for.
      out.sort((a, b) => (convOf(b) ?? -1) - (convOf(a) ?? -1));
    } else if (sortBy === 'name') {
      out.sort((a, b) =>
        String(a.reference_type).localeCompare(String(b.reference_type)),
      );
    } else {
      out.sort((a, b) => n0(b.count) - n0(a.count));
    }
    return out;
  }, [rows, query, sortBy]);

  // Bars scale to the biggest source so the rows compare with each other.
  const max = Math.max(...rows.map(r => n0(r.count)), 1);

  // Summed from the VISIBLE rows, so a search narrows the total honestly
  // rather than leaving a group figure that no longer describes the list.
  const shown = useMemo(
    () =>
      list.reduce(
        (a, r) => ({
          patients: a.patients + n0(r.count),
          ipd: a.ipd + n0(r.invoiceCount),
        }),
        { patients: 0, ipd: 0 },
      ),
    [list],
  );

  const shownConv =
    shown.patients > 0 ? (shown.ipd / shown.patients) * 100 : null;
  const overallConv =
    totals.patients > 0 ? (totals.ipd / totals.patients) * 100 : null;

  const filtered = list.length !== rows.length;

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 36 }}
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
      >
        <SectionHeader
          code="REPORTS"
          name="Reference Report"
          sub={`${fmtShort(from)} – ${fmtShort(to)}`}
          hue={T.brand}
          onBack={() => navigation.goBack()}
        />

        <View style={st.body}>
          <View style={[st.statRow, { marginTop: -30 }]}>
            <Stat
              label="Patients"
              value={num(totals.patients)}
              note={`${num(rows.length)} sources`}
              color={T.text}
            />
            <Stat
              label="IPD"
              value={num(totals.ipd)}
              note="cases"
              color="#B3523B"
            />
            <Stat
              label="Conversion"
              value={overallConv == null ? '—' : `${overallConv.toFixed(1)}%`}
              note="patients to IPD"
              color={convColor(overallConv)}
            />
          </View>

          <View style={st.searchRow}>
            <Icon name="search" size={18} color={T.muted2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Source"
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

          <View style={st.sortRow}>
            <Text style={st.sortLabel}>SORT BY</Text>
            {SORTS.map(s => {
              const on = sortBy === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSortBy(s.key)}
                  style={[st.sortBtn, on && st.sortBtnOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[st.sortText, on && st.sortTextOn]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
            </View>
          ) : !list.length ? (
            <Text style={st.empty}>
              {error || 'No referral data for this period.'}
            </Text>
          ) : (
            <View style={st.table}>
              <View style={st.tHead}>
                <Text style={[st.th, st.colSource]}>SOURCE</Text>
                <Text style={[st.th, st.colNum]}>PTS</Text>
                <Text style={[st.th, st.colPct]}>SHARE</Text>
                <Text style={[st.th, st.colNum]}>IPD</Text>
                <Text style={[st.th, st.colPct]}>CONV</Text>
              </View>

              {list.map((r, i) => {
                const count = n0(r.count);
                const conv = convOf(r);
                const last = i === list.length - 1;
                return (
                  <View
                    key={`${r.reference_type}-${i}`}
                    style={[
                      st.tRow,
                      i % 2 === 1 && st.tRowAlt,
                      last && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={st.line}>
                      <Text style={[st.name, st.colSource]} numberOfLines={1}>
                        {r.reference_type || 'Unknown'}
                      </Text>
                      <Text style={[st.val, st.colNum]}>{num(count)}</Text>
                      <Text style={[st.pct, st.colPct]}>
                        {n0(r.percentage)}%
                      </Text>
                      <Text style={[st.val, st.colNum]}>
                        {num(r.invoiceCount)}
                      </Text>
                      {/* The column that ranks sources on quality rather than
                          volume, so it is the one that carries colour. */}
                      <Text
                        style={[st.conv, st.colPct, { color: convColor(conv) }]}
                      >
                        {conv == null ? '—' : `${Math.round(conv)}%`}
                      </Text>
                    </View>

                    {/* A hairline under the row for shape — beneath the
                        numbers rather than competing with them, scaled to the
                        biggest source so rows rank visually too. */}
                    <View style={st.track}>
                      <View
                        style={{
                          width: `${Math.max((count / max) * 100, 1)}%`,
                          height: '100%',
                          backgroundColor: T.brand,
                          borderRadius: 1,
                        }}
                      />
                    </View>
                  </View>
                );
              })}

              <View style={st.tFoot}>
                <Text style={[st.footName, st.colSource]}>
                  {filtered ? `${num(list.length)} SHOWN` : 'ALL SOURCES'}
                </Text>
                <Text style={[st.footVal, st.colNum]}>
                  {num(shown.patients)}
                </Text>
                <Text style={[st.footPct, st.colPct]}>
                  {totals.patients > 0
                    ? `${Math.round((shown.patients / totals.patients) * 100)}%`
                    : '—'}
                </Text>
                <Text style={[st.footVal, st.colNum]}>{num(shown.ipd)}</Text>
                <Text
                  style={[
                    st.footPct,
                    st.colPct,
                    { color: convColor(shownConv) },
                  ]}
                >
                  {shownConv == null ? '—' : `${Math.round(shownConv)}%`}
                </Text>
              </View>
            </View>
          )}

          {/* Said once here rather than left for someone to work out by
              dividing one column by another. */}
          <Text style={st.note}>
            IPD counts invoices raised, so a patient billed twice counts twice
            and conversion can exceed 100%. PTS counts registered patients only,
            while IPD does not filter on registration — the two come from
            slightly different populations.
          </Text>
          <ReferenceComparison location={location} from={from} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

export default ReferenceReportScreen;

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
    fontSize: 19,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  sortLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  sortBtn: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: T.card,
  },
  sortBtnOn: { borderColor: T.brand, backgroundColor: '#EAF2ED' },
  sortText: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  sortTextOn: { color: T.brand, fontFamily: F.medium },

  table: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  th: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted,
  },

  // Fixed column widths, so every number sits under its header no matter how
  // long a source name is.
  colSource: { flex: 1, textAlign: 'left' },
  colNum: { width: 42, textAlign: 'right' },
  colPct: { width: 44, textAlign: 'right' },

  tRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  // Zebra striping. With a dozen sources and four number columns, the eye
  // needs help staying on one row across the width.
  tRowAlt: { backgroundColor: T.subtle },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 12.5, color: T.text, fontFamily: F.regular },
  val: { fontFamily: F.mono, fontSize: 12.5, color: T.text },
  pct: { fontFamily: F.mono, fontSize: 11, color: T.muted2 },
  conv: { fontFamily: F.mono, fontSize: 12 },

  track: {
    height: 2,
    borderRadius: 1,
    backgroundColor: T.lineSoft,
    marginTop: 8,
    overflow: 'hidden',
  },

  tFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  footName: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 0.9,
    color: T.muted,
  },
  footVal: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    fontWeight: '600',
  },
  footPct: { fontFamily: F.mono, fontSize: 11.5, fontWeight: '600' },

  note: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 12,
    fontFamily: F.regular,
    lineHeight: 15,
  },
});
