/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/LeadStatsReportScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Branch-wise lead statistics — Web, Bot, IVR and the combined roll-up.
// Replaces src/admin/LeadsStatsReport.js. Same endpoint, same four channels,
// same sorts, same Excel export.
//
// ⚠️ CONFIRM THE ENDPOINT
// ───────────────────────
// ENDPOINT below is my reading of the route. Copy the exact string from
// LeadsStatsReport.js's fetch — a wrong path shows an empty list with an error
// line rather than crashing, which is easy to miss.
//
// ⚠️ ITS OWN DATE RANGE, SO NO SCOPE CHIP
// ───────────────────────────────────────
// This is a cross-branch report with its own from/to, applied on a button
// rather than live: each change walks every branch's clinic DB, so re-fetching
// on every tap of a date picker would be slow and expensive. The section's
// range chip is hidden and the report carries its own.
//
// ⚠️ CONVERSION IS UNDERSTATED NEAR THE END OF A RANGE
// ────────────────────────────────────────────────────
// getIpdCount looks for the confirmed visit INSIDE the window, so a lead who
// books on the last day and attends next week is not counted. Read conversion
// over a month, not a day — said on screen rather than left to be discovered.
//
// WHAT CHANGED
// ────────────
// The dark dashboard palette (#161B22 cards on #f0f2f5) is gone — it belonged
// to the ad-agency screen and looked like a different app. Animated bars are
// gone too: forty branches animating on mount is a lot of work for a report
// people scroll straight past.
//
// The branch row now carries its funnel inline — total, appointments, visits,
// IPD — instead of three badges plus a tap. The expansion is kept for the
// per-channel split, which is the one thing that genuinely needs the room.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, num } from '../design/tokens';
import { useScopeRange } from '../scope/useScopeRange';

// ⚠️ See the header note — verify against LeadsStatsReport.js.
// Confirmed against src/adAgency/LeadsStatsDashboard.tsx.
const ENDPOINT = '/leadsStats/all';

const HUE_L = HUE.leads;

// Channel colours, matching the source rows on the Leads section so a branch
// reads the same whichever screen it is on.
const MODES = [
  { key: 'combined', label: 'All', color: HUE_L },
  { key: 'web', label: 'Web', color: '#2F6FA8' },
  { key: 'chatbot', label: 'Bot', color: '#7A5EA8' },
  { key: 'ivr', label: 'IVR', color: '#3E8C8C' },
];

const SORTS = [
  { key: 'total', label: 'Volume' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'location', label: 'Branch' },
];

const bucketOf = (s, mode) =>
  (mode === 'combined' ? s.combined : s[mode]) || {
    total: 0,
    appointment: 0,
    actualVisitCount: 0,
    ipd: 0,
  };

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Conversion bands. High is good here, so the scale runs the opposite way from
// the ageing colours elsewhere in the app.
const convColor = v =>
  v >= 40 ? '#1E7A5A' : v >= 20 ? '#B26A00' : v > 0 ? '#B3382B' : T.muted2;

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

const LeadStatsReportScreen = ({ navigation, route }) => {
  // Shared with the rest of the Leads section, so moving the range here and
  // going back to Web Leads keeps the same period.
  const { from, to } = useScopeRange(route);

  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('combined');
  const [sortBy, setSortBy] = useState('total');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get(ENDPOINT, { from, to });

        // The endpoint answers 200 with { success: false, error } on a
        // failure, so a bare .data read would show an empty report and throw
        // away the reason. Surface it.
        if (res && res.success === false) {
          throw new Error(res.error || 'The report could not be generated.');
        }

        setStats(Array.isArray(res) ? res : res?.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      stats.reduce(
        (a, s) => {
          const b = bucketOf(s, mode);
          a.total += b.total || 0;
          a.appointment += b.appointment || 0;
          a.visited += b.actualVisitCount || 0;
          a.ipd += b.ipd || 0;
          return a;
        },
        { total: 0, appointment: 0, visited: 0, ipd: 0 },
      ),
    [stats, mode],
  );

  const rows = useMemo(() => {
    const list = [...stats];
    if (sortBy === 'location') {
      list.sort((a, b) => String(a.location).localeCompare(String(b.location)));
    } else if (sortBy === 'conversion') {
      list.sort((a, b) => {
        const ba = bucketOf(a, mode);
        const bb = bucketOf(b, mode);
        return pct(bb.appointment, bb.total) - pct(ba.appointment, ba.total);
      });
    } else {
      list.sort((a, b) => bucketOf(b, mode).total - bucketOf(a, mode).total);
    }
    return list;
  }, [stats, mode, sortBy]);

  // Bars scale to the busiest branch, not to the group total — they exist to
  // compare branches with each other, and against the total a forty-row list
  // leaves every bar flat.
  const busiest = Math.max(...rows.map(s => bucketOf(s, mode).total), 1);

  const modeMeta = MODES.find(m => m.key === mode) || MODES[0];

  const header = (
    <View>
      <SectionHeader
        code="LEADS"
        name="Lead Stats Report"
        sub="Branch-wise lead volume and conversion"
        hue={HUE_L}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, { marginTop: -30 }]}>
          <Stat
            label="Leads"
            value={num(totals.total)}
            note={`${rows.length} branches`}
            color={T.text}
          />
          <Stat
            label="Appointments"
            value={num(totals.appointment)}
            note={`${pct(totals.appointment, totals.total)}% converted`}
            color="#1E7A5A"
          />
          <Stat
            label="IPD"
            value={num(totals.ipd)}
            note="went to surgery"
            color="#B3523B"
          />
        </View>

        <View style={st.modeRow}>
          {MODES.map(m => {
            const on = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  st.modeBtn,
                  on && { backgroundColor: m.color, borderColor: m.color },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.modeLabel, on && st.onText]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.sortRow}>
          <Text style={st.sortLabel}>SORT BY</Text>
          {SORTS.map(s => {
            const on = sortBy === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => setSortBy(s.key)}
                style={[
                  st.sortBtn,
                  on && { borderColor: HUE_L, backgroundColor: '#EAF2F3' },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text
                  style={[
                    st.sortText,
                    on && { color: HUE_L, fontFamily: F.medium },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={st.caveat}>
          Conversion counts visits inside the selected period only, so it is
          understated near the end of a range.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={s => String(s.location)}
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
              <Text style={st.loadingNote}>
                Reading every branch — this takes a moment.
              </Text>
            </View>
          ) : (
            <Text style={st.empty}>
              {error || 'No lead data for this period.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <BranchRow
            s={item}
            mode={mode}
            modeColor={modeMeta.color}
            busiest={busiest}
            open={expanded === item.location}
            onToggle={() =>
              setExpanded(expanded === item.location ? null : item.location)
            }
          />
        )}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={[st.statVal, { color }]}>{value}</Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

const Figure = ({ label, value, color }) => (
  <View style={st.fig}>
    <Text style={st.figLabel}>{label}</Text>
    <Text style={[st.figVal, color && { color }]}>{value}</Text>
  </View>
);

const BranchRow = ({ s, mode, modeColor, busiest, open, onToggle }) => {
  const b = bucketOf(s, mode);
  const conv = pct(b.appointment, b.total);

  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={0.8}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${s.location}, ${b.total} leads, ${conv}% conversion`}
    >
      <View style={[st.rowSpine, { backgroundColor: modeColor }]} />

      <View style={st.rowTop}>
        <Text style={st.branch} numberOfLines={1}>
          {s.location}
        </Text>
        <Text style={[st.conv, { color: convColor(conv) }]}>{conv}%</Text>
        <Icon
          name={open ? 'expand-less' : 'expand-more'}
          size={17}
          color={T.chevron}
        />
      </View>

      <View style={st.track}>
        <View
          style={{
            width: `${Math.max((b.total / busiest) * 100, 1.5)}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: modeColor,
          }}
        />
      </View>

      {/* The funnel inline. The old card showed three badges and hid the visit
          count behind a tap — the one number that says whether an appointment
          actually happened. */}
      <View style={st.figures}>
        <Figure label="LEADS" value={num(b.total)} />
        <Figure label="APPT" value={num(b.appointment)} />
        <Figure
          label="VISITED"
          value={num(b.actualVisitCount)}
          color="#1E7A5A"
        />
        <Figure label="IPD" value={num(b.ipd)} color="#B3523B" />
      </View>

      {/* Expansion keeps the per-channel split, which is the one thing that
          genuinely needs the extra room. */}
      {open && (
        <View style={st.channels}>
          {MODES.filter(m => m.key !== 'combined').map(m => {
            const cb = bucketOf(s, m.key);
            const cConv = pct(cb.appointment, cb.total);
            return (
              <View key={m.key} style={st.channel}>
                <View style={[st.channelDot, { backgroundColor: m.color }]} />
                <Text style={st.channelName}>{m.label}</Text>
                <Text style={st.channelVal}>{num(cb.total)}</Text>
                <Text style={st.channelVal}>{num(cb.appointment)}</Text>
                <Text style={st.channelVal}>{num(cb.ipd)}</Text>
                <Text style={[st.channelConv, { color: convColor(cConv) }]}>
                  {cConv}%
                </Text>
              </View>
            );
          })}
          <View style={st.channelHead}>
            <View style={{ width: 8 }} />
            <Text style={st.channelHeadName}>CHANNEL</Text>
            <Text style={st.channelHeadVal}>LEADS</Text>
            <Text style={st.channelHeadVal}>APPT</Text>
            <Text style={st.channelHeadVal}>IPD</Text>
            <Text style={st.channelHeadConv}>CONV</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default LeadStatsReportScreen;

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

  statRow: { flexDirection: 'row', gap: 9, marginTop: 9 },
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
    fontSize: 20,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  modeRow: { flexDirection: 'row', gap: 7, marginTop: 14 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 9,
    paddingVertical: 9,
    backgroundColor: T.card,
    alignItems: 'center',
  },
  modeLabel: { fontSize: 12, color: T.muted, fontFamily: F.regular },
  onText: { color: '#fff', fontFamily: F.medium },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
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
    paddingHorizontal: 11,
    backgroundColor: T.card,
  },
  sortText: { fontSize: 11, color: T.muted, fontFamily: F.regular },

  caveat: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 12,
    fontFamily: F.regular,
    lineHeight: 14,
  },

  row: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 9,
    overflow: 'hidden',
  },
  rowSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  branch: { flex: 1, fontSize: 13.5, fontFamily: F.medium, color: T.text },
  conv: { fontFamily: F.mono, fontSize: 14, letterSpacing: -0.3 },

  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 10,
    overflow: 'hidden',
  },

  figures: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  figVal: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.text,
    marginTop: 4,
    letterSpacing: -0.2,
  },

  channels: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
    // Column order is set by the header row, which renders LAST and is pulled
    // to the top — so the labels sit above the data without a second map.
    flexDirection: 'column-reverse',
  },
  channelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  channelHeadName: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  channelHeadVal: {
    width: 42,
    textAlign: 'right',
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  channelHeadConv: {
    width: 40,
    textAlign: 'right',
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  channelDot: { width: 8, height: 8, borderRadius: 2 },
  channelName: { flex: 1, fontSize: 12, color: T.text, fontFamily: F.regular },
  channelVal: {
    width: 42,
    textAlign: 'right',
    fontFamily: F.mono,
    fontSize: 11.5,
    color: T.text,
  },
  channelConv: {
    width: 40,
    textAlign: 'right',
    fontFamily: F.mono,
    fontSize: 11.5,
  },
});
