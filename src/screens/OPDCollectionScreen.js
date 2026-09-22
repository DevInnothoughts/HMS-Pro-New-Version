/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/OPDCollectionScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// OPD Collection, rebuilt in the Outpatient section's language. Same endpoint
// (/OPDCollection/v4?section=OPD), same figures, same consultation chips driven
// by the master table.
//
// ⚠️ THE HEADLINE TOTAL EXCLUDES CHEQUE — DELIBERATELY UNCHANGED
// ──────────────────────────────────────────────────────────────
// The old screen computes its total as cash + card + online. Cheque is summed
// but never added in. That is almost certainly a bug — but changing it here
// would silently move a number the finance team reconciles against, and this
// task was a redesign, not a recalculation.
//
// So the total is identical to the old screen's, and cheque is shown as its own
// figure with a note whenever it is non-zero. That way the gap is visible
// rather than hidden, and whoever owns the number can decide. Fix it in both
// screens at once, as its own change, or not at all.
//
// WHAT CHANGED IN THE LIST
// ────────────────────────
// The old row showed a name and an amount, and hid the consultation and receipt
// date behind a tap. Both fit on one line beneath the name, so the expansion is
// gone — a tap that reveals two short strings is a tap that shouldn't exist.
//
// Pagination is also gone. FlatList recycles rows, so search now covers the
// whole result set instead of the current page of ten.
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
import { F, HUE, T, inr, num } from '../design/tokens';
import useScopeRange from '../scope/useScopeRange';

const HUE_O = HUE.opd;

// Payment-mode colours. Cash leads because it is almost always the largest,
// and the four are distinct enough to read without a legend lookup.
const MODE_COLORS = {
  Cash: '#2F6FA8',
  Card: '#3E8C8C',
  Online: '#7A5EA8',
  Cheque: '#B3762B',
};
const MODES = ['Cash', 'Card', 'Online', 'Cheque'];

const DEFAULT_CONSULTATIONS = ['CONSULTATION', 'PROCEDURE', 'OTHER'];

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

const OPDCollectionScreen = ({ navigation, route }) => {
  const reduxLocation = useSelector(s => s.location.value);
  const { from, to } = useScopeRange(route);
  const location = route?.params?.location || reduxLocation;

  const [rows, setRows] = useState([]);
  const [consultations, setConsultations] = useState(DEFAULT_CONSULTATIONS);
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
          section: 'OPD',
        });
        setRows(res?.data || []);
        setConsultations(
          res?.consultationList?.length
            ? res.consultationList
            : DEFAULT_CONSULTATIONS,
        );
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

  // Consultation filter first, so the chip counts describe the same set the
  // search then narrows — chips that change as you type would be unreadable.
  const byType = useMemo(() => {
    if (!billType) return rows;
    const known = consultations.filter(c => c !== 'OTHER');
    // Anything outside a named bucket falls into OTHER, so the chips always
    // add up to the full row set whatever the master table contains.
    return billType === 'OTHER'
      ? rows.filter(r => !known.includes(consultationOf(r)))
      : rows.filter(r => consultationOf(r) === billType);
  }, [rows, billType, consultations]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(r =>
      String(r.name || '')
        .toLowerCase()
        .includes(q),
    );
  }, [byType, query]);

  // Totals follow the visible list, matching the old screen — filter to
  // PROCEDURE and the total is procedure revenue, not the day's.
  const totals = useMemo(() => {
    const t = { Cash: 0, Card: 0, Online: 0, Cheque: 0 };
    for (const r of list) {
      // Number() guards against the driver returning DECIMAL columns as
      // strings, which would concatenate rather than add.
      const amt = Number(r.total) || 0;
      if (t[r.payment_mode] !== undefined) t[r.payment_mode] += amt;
    }
    // The old screen's formula, cheque excluded. See the header note.
    const headline = t.Cash + t.Card + t.Online;
    return {
      ...t,
      headline,
      patients: new Set(list.map(r => r.patient_id)).size,
      receipts: list.length,
    };
  }, [list]);

  const modeRows = MODES.filter(m => totals[m] > 0).map(m => ({
    key: m,
    label: m,
    color: MODE_COLORS[m],
    amount: inr(totals[m]),
    pct:
      totals.headline + totals.Cheque > 0
        ? Math.round((totals[m] / (totals.headline + totals.Cheque)) * 100)
        : 0,
  }));

  // Per-consultation totals for the chips, always over the UNFILTERED rows so
  // the counts stay stable while a filter is active.
  const chipTotals = useMemo(() => {
    const known = consultations.filter(c => c !== 'OTHER');
    const out = {};
    for (const r of rows) {
      const c = consultationOf(r);
      const key = known.includes(c) ? c : 'OTHER';
      out[key] = (out[key] || 0) + (Number(r.total) || 0);
    }
    return out;
  }, [rows, consultations]);

  const header = (
    <View>
      <SectionHeader
        code="OPD"
        name="OPD Collection"
        sub={`${fmtDate(from)} – ${fmtDate(to)}`}
        hue={HUE_O}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Collected"
            value={inr(totals.headline)}
            note={`${num(totals.receipts)} receipts`}
            color={T.text}
            wide
          />
          <Stat
            label="Patients"
            value={num(totals.patients)}
            note="unique"
            color={HUE_O}
          />
        </View>

        {modeRows.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardLabel}>BY PAYMENT MODE</Text>
            <StackBar segments={modeRows} />
            <Legend rows={modeRows} />
            {totals.Cheque > 0 && (
              // Said out loud rather than quietly folded in — see the header.
              <Text style={st.warn}>
                Cheque {inr(totals.Cheque)} is not included in the collected
                total, matching the existing report.
              </Text>
            )}
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
        >
          <Chip
            label="All"
            amount={inr(Object.values(chipTotals).reduce((a, b) => a + b, 0))}
            on={billType === ''}
            onPress={() => setBillType('')}
          />
          {consultations.map(c => (
            <Chip
              key={c}
              label={c.charAt(0) + c.slice(1).toLowerCase()}
              amount={inr(chipTotals[c] || 0)}
              on={billType === c}
              onPress={() => setBillType(billType === c ? '' : c)}
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
            Showing {num(list.length)} of {num(rows.length)} receipts
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      {loading && !refreshing ? (
        <>
          <SectionHeader
            code="OPD"
            name="OPD Collection"
            sub="Consultation and procedure billing"
            hue={HUE_O}
            onBack={() => navigation.goBack()}
          />
          <View style={st.centre}>
            <ActivityIndicator color={HUE_O} />
          </View>
        </>
      ) : (
        <FlatList
          data={list}
          // No receipt id in the payload, so the key is composite. Index alone
          // reuses the wrong row when a filter changes.
          keyExtractor={(r, i) =>
            `${r.patient_id || 'x'}-${r.item_date || ''}-${i}`
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
              tintColor={HUE_O}
            />
          }
          ListEmptyComponent={
            <Text style={st.empty}>
              {error || 'No collection for this period.'}
            </Text>
          }
          renderItem={({ item }) => <Row r={item} />}
        />
      )}
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
    <Text style={[st.chipLabel, on && st.chipOnText]}>{label}</Text>
    <Text style={[st.chipAmt, on && st.chipOnText]}>{amount}</Text>
  </TouchableOpacity>
);

const Row = ({ r }) => {
  const mode = r.payment_mode;
  const hue = MODE_COLORS[mode] || T.muted2;
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
        {/* Consultation and date were behind a tap on the old screen. They fit
            on one line, so the expansion is gone. */}
        <Text style={st.meta} numberOfLines={1}>
          {r.consultation || 'Unspecified'} · {fmtDate(r.item_date)}
        </Text>
      </View>

      <View style={st.amountCol}>
        <Text style={st.amount}>{inr(r.total)}</Text>
        <Text style={[st.mode, { color: hue }]}>{mode || '—'}</Text>
      </View>
    </View>
  );
};

export default OPDCollectionScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16 },

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

  chips: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 12,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  chipOn: { backgroundColor: HUE_O, borderColor: HUE_O },
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
    paddingLeft: 13,
    paddingRight: 13,
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
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 4,
    fontFamily: F.regular,
  },

  amountCol: { alignItems: 'flex-end' },
  amount: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.3,
  },
  mode: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.7, marginTop: 4 },

  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 40,
    fontFamily: F.regular,
    fontSize: 13,
  },
});
