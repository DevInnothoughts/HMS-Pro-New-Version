/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/PostOpFeedbackList.js
// ─────────────────────────────────────────────────────────────────────────────
// Post-Op calling feedback — the follow-up call made after discharge.
//
// Replaces NpsPatientList.js. Same endpoint (/report/ratingInfo), same data,
// rebuilt in the Performance section's language: olive header, mono numerals,
// spine-marked rows, search + sort, list → detail.
//
// THIS IS NOT NPS, AND THE SCREEN NO LONGER CLAIMS IT IS
// ──────────────────────────────────────────────────────
// The old screen labelled the 1–5 average as an "NPS Score". NPS is a cohort
// statistic derived from a 0–10 recommend question — a different question, a
// different scale, a different calculation. This data is an average of star
// ratings across a handful of call questions. Calling it NPS put two unrelated
// numbers under one name; the real NPS now lives on the Patient Feedback
// screen, computed from the 0–10 question.
//
// NO SCOPE CHIP
// ─────────────
// /report/ratingInfo takes location only — there is no date range. Rendering
// the period selector here would suggest a filter that does nothing, so the
// header hides it. When the endpoint gains from/to, drop `hideScope` and pass
// the range.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
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
import { F, HUE, T, dec1, num } from '../design/tokens';
import { exportPostOpWorkbook } from './postOpExcel';

const HUE_P = HUE.performance;

// Thresholds on the 1–5 average. These are a reading aid we chose, not a
// standard — if the business has its own cut-offs, change them here only.
const BANDS = {
  strong: { label: 'Strong', color: '#1E7A5A', min: 4 },
  mixed: { label: 'Mixed', color: '#B26A00', min: 3 },
  weak: { label: 'Needs attention', color: '#B3382B', min: 0 },
};

const bandFor = avg => {
  if (avg == null) return null;
  if (avg >= BANDS.strong.min) return 'strong';
  if (avg >= BANDS.mixed.min) return 'mixed';
  return 'weak';
};

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
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
  return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`;
};

// ratingInfo is a JSON string on the row. A malformed one must not take the
// whole list down — that patient simply shows as un-rated.
const parseRating = raw => {
  if (!raw) return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && typeof v === 'object' ? v : null;
  } catch (_) {
    return null;
  }
};

const PostOpFeedbackList = ({ navigation }) => {
  const location = useSelector(s => s.location.value);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | rated | pending
  const [sort, setSort] = useState({ key: 'recent', desc: true });
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await get('/report/ratingInfo', { location });
        const list = (res?.ipdBills || []).map(item => {
          const rating = parseRating(item.ratingInfo);
          const avg = rating ? Number(rating.averageRating) : null;
          return {
            id: String(item.invoice_id),
            name: item.name,
            phone: item.phone,
            admission: item.admission_date,
            discharge: item.discharge_date,
            rated: !!rating,
            avg: Number.isFinite(avg) ? avg : null,
            band: bandFor(Number.isFinite(avg) ? avg : null),
            answers: rating?.ratings || null,
            feedback: (rating?.feedback || '').trim() || null,
          };
        });
        setRows(list);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const parts = [];
      if (filter !== 'all')
        parts.push(filter === 'rated' ? 'Rated only' : 'Not called only');
      if (query.trim()) parts.push(`Search: "${query.trim()}"`);
      const note = parts.length
        ? `Filtered view — ${parts.join(' · ')}.`
        : null;
      await exportPostOpWorkbook(list, location, note);
    } catch (e) {
      Alert.alert('Export failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const summary = useMemo(() => {
    const rated = rows.filter(r => r.avg != null);
    const avg = rated.length
      ? rated.reduce((a, r) => a + r.avg, 0) / rated.length
      : null;
    const counts = { strong: 0, mixed: 0, weak: 0 };
    rated.forEach(r => r.band && counts[r.band]++);
    return {
      total: rows.length,
      rated: rated.length,
      ratePct: rows.length
        ? Math.round((rated.length / rows.length) * 100)
        : null,
      avg,
      withComment: rated.filter(r => r.feedback).length,
      counts,
    };
  }, [rows]);

  const list = useMemo(() => {
    let out = rows;
    if (filter === 'rated') out = out.filter(r => r.rated);
    if (filter === 'pending') out = out.filter(r => !r.rated);

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter(
        r =>
          String(r.name || '')
            .toLowerCase()
            .includes(q) || String(r.phone || '').includes(q),
      );
    }

    // Un-rated patients always sink: sorting them by a rating they don't have
    // would scatter them through the list at whatever null compares as.
    return [...out].sort((a, b) => {
      if (sort.key === 'recent') {
        const d = new Date(b.discharge || 0) - new Date(a.discharge || 0);
        return sort.desc ? d : -d;
      }
      if (a.avg == null && b.avg == null) return 0;
      if (a.avg == null) return 1;
      if (b.avg == null) return -1;
      return sort.desc ? b.avg - a.avg : a.avg - b.avg;
    });
  }, [rows, filter, query, sort]);

  const header = (
    <View>
      <SectionHeader
        code="POST-OP"
        name="Post-Op Calling Feedback"
        sub="Follow-up call ratings after discharge"
        hue={HUE_P}
        hideScope
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.statRow}>
          <Stat
            label="Avg rating"
            value={summary.avg == null ? '—' : dec1(summary.avg)}
            note="out of 5"
            color={
              summary.avg == null ? T.muted : BANDS[bandFor(summary.avg)].color
            }
          />
          <Stat
            label="Calls rated"
            value={num(summary.rated)}
            note={`of ${num(summary.total)} patients`}
            color={T.text}
          />
          <Stat
            label="With comments"
            value={num(summary.withComment)}
            note="left a remark"
            color={T.text}
          />
        </View>

        {summary.rated > 0 && (
          <View style={st.bands}>
            {Object.keys(BANDS).map(k => (
              <View key={k} style={st.bandChip}>
                <View style={[st.dot, { backgroundColor: BANDS[k].color }]} />
                <Text style={st.bandText}>
                  {BANDS[k].label}{' '}
                  <Text style={st.bandVal}>{summary.counts[k]}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name or phone"
            placeholderTextColor={T.muted2}
            style={st.search}
          />
        </View>

        <View style={st.controls}>
          {[
            { key: 'all', label: 'All' },
            { key: 'rated', label: 'Rated' },
            { key: 'pending', label: 'Not called' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[st.chip, filter === f.key && st.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.key }}
            >
              <Text style={[st.chipLabel, filter === f.key && st.chipLabelOn]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={st.controls}>
          {[
            { key: 'recent', label: 'Recent' },
            { key: 'rating', label: 'Rating' },
          ].map(o => {
            const on = sort.key === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                onPress={() =>
                  setSort(s =>
                    s.key === o.key
                      ? { key: o.key, desc: !s.desc }
                      : { key: o.key, desc: true },
                  )
                }
                style={[st.sortBtn, on && st.sortBtnOn]}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${o.label}, ${
                  on && !sort.desc ? 'lowest first' : 'highest first'
                }`}
              >
                <Text style={[st.chipLabel, on && st.sortTextOn]}>
                  {o.label}
                </Text>
                {on && (
                  <Icon
                    name={sort.desc ? 'arrow-downward' : 'arrow-upward'}
                    size={12}
                    color={HUE_P}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={onExport}
            disabled={exporting || !list.length}
            style={[
              st.exportBtn,
              (exporting || !list.length) && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Download as Excel"
          >
            <Icon
              name={exporting ? 'hourglass-empty' : 'file-download'}
              size={15}
              color={HUE_P}
            />
            <Text style={st.exportText}>
              {exporting ? 'Preparing…' : 'Excel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      {loading && !refreshing ? (
        <>
          <SectionHeader
            code="POST-OP"
            name="Post-Op Calling Feedback"
            sub="Follow-up call ratings after discharge"
            hue={HUE_P}
            hideScope
            onBack={() => navigation.goBack()}
          />
          <View style={st.centre}>
            <ActivityIndicator color={HUE_P} />
          </View>
        </>
      ) : (
        <FlatList
          data={list}
          keyExtractor={r => r.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={HUE_P}
            />
          }
          ListEmptyComponent={
            <Text style={st.empty}>{error || 'No patients found.'}</Text>
          }
          renderItem={({ item }) => (
            <Row
              r={item}
              onPress={() =>
                item.rated &&
                navigation.navigate('PostOpFeedbackDetail', { patient: item })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color }) => (
  <View style={st.stat}>
    <Text style={st.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[st.statVal, { color }]}>{value}</Text>
    <Text style={st.statNote}>{note}</Text>
  </View>
);

const Row = ({ r, onPress }) => {
  const b = r.band ? BANDS[r.band] : null;
  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={r.rated ? 0.7 : 1}
      onPress={onPress}
      disabled={!r.rated}
      accessibilityRole={r.rated ? 'button' : 'text'}
    >
      <View
        style={[st.rowSpine, { backgroundColor: b ? b.color : T.lineSoft }]}
      />
      <View style={st.rowMain}>
        <Text style={st.name} numberOfLines={1}>
          {r.name || '—'}
        </Text>
        <Text style={st.meta} numberOfLines={1}>
          {r.phone || '—'} · discharged {fmtDate(r.discharge)}
        </Text>
        {!!r.feedback && (
          <Text style={st.quote} numberOfLines={1}>
            “{r.feedback}”
          </Text>
        )}
      </View>

      {r.rated ? (
        <>
          <View style={st.scoreBox}>
            <Text style={[st.score, { color: b.color }]}>{dec1(r.avg)}</Text>
            <Text style={st.scoreLabel}>of 5</Text>
          </View>
          <Icon name="chevron-right" size={20} color={T.chevron} />
        </>
      ) : (
        <Text style={st.pending}>Not called</Text>
      )}
    </TouchableOpacity>
  );
};

export default PostOpFeedbackList;

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
    paddingHorizontal: 11,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 21,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  bands: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 13 },
  bandChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  bandText: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  bandVal: { fontFamily: F.mono, fontSize: 12, color: T.text },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },

  controls: { flexDirection: 'row', gap: 7, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  chipOn: { backgroundColor: HUE_P, borderColor: HUE_P },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipLabelOn: { color: '#fff', fontFamily: F.medium },

  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: T.card,
  },
  sortBtnOn: { borderColor: HUE_P, backgroundColor: '#F1F5EE' },
  sortTextOn: { color: HUE_P, fontFamily: F.medium },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  rowMain: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },
  quote: {
    fontSize: 10.5,
    color: T.muted,
    marginTop: 4,
    fontStyle: 'italic',
    fontFamily: F.regular,
  },

  scoreBox: { alignItems: 'center', minWidth: 40 },
  score: { fontFamily: F.mono, fontSize: 18, letterSpacing: -0.3 },
  scoreLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: T.muted2,
    marginTop: 3,
  },

  pending: {
    fontSize: 10.5,
    color: T.muted2,
    fontFamily: F.mono,
    letterSpacing: 0.5,
  },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 40,
    fontFamily: F.regular,
    fontSize: 13,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: HUE_P,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: T.card,
  },
  exportText: { fontSize: 11.5, color: HUE_P, fontFamily: F.medium },
});
