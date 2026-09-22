/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IPDFeedbackList.js
// ─────────────────────────────────────────────────────────────────────────────
// Post-surgery feedback: the cohort summary, then one row per operated patient.
//
// WHY NON-RESPONDERS ARE LISTED
// ─────────────────────────────
// Every operated patient in the window appears, responded or not. A screen
// showing only the twelve who replied looks like twelve happy patients; the
// same screen showing twelve of eighty tells you the score is built on 15% of
// the cohort. The response rate is the first thing on the page for that reason.
//
// The per-patient number is a RECOMMEND SCORE (0–10), not an NPS. NPS is the
// cohort figure in the header — %Promoters − %Detractors — and cannot be
// computed for one person. The rows are labelled accordingly.
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

import { fetchIpdFeedback } from '../api/feedback';
import { StackBar } from '../design/components/primitives';
import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, num } from '../design/tokens';
import { exportFeedbackWorkbook } from './feedbackExcel';
import NpsBlock, { computeNps, npsColor } from '../design/components/NpsBlock';

const BAND = {
  promoter: { label: 'Promoter', color: '#1E7A5A' },
  passive: { label: 'Passive', color: '#B3762B' },
  detractor: { label: 'Detractor', color: '#B3382B' },
};

const HUE_P = HUE.performance;

const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
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
  return m ? `${Number(day)} ${M[Number(m) - 1]} ${y}` : s;
};

const IPDFeedbackList = ({ navigation }) => {
  const location = useSelector(s => s.location.value);
  const scope = useSelector(s => s.scope);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | responded | pending
  const [sort, setSort] = useState({ key: 'recent', desc: true });
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(await fetchIpdFeedback(location, scope.from, scope.to));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, scope.from, scope.to],
  );

  useEffect(() => {
    load();
  }, [load]);

  const patients = useMemo(() => {
    let list = data?.patients || [];
    if (filter === 'responded') list = list.filter(p => p.responded);
    if (filter === 'pending') list = list.filter(p => !p.responded);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p =>
          String(p.name || '')
            .toLowerCase()
            .includes(q) ||
          String(p.uidNo || '')
            .toLowerCase()
            .includes(q) ||
          String(p.phone || '').includes(q),
      );
    }
    // Non-responders always sink to the bottom: sorting by a score they don't
    // have would scatter them through the list at whatever null compares as.
    const val = p =>
      sort.key === 'score'
        ? p.recommendScore
        : sort.key === 'psi'
        ? p.psiPct
        : null;

    const sorted = [...list].sort((a, b) => {
      if (sort.key === 'recent') {
        const d = String(b.surgeryDate || '').localeCompare(
          String(a.surgeryDate || ''),
        );
        return sort.desc ? d : -d;
      }
      const av = val(a);
      const bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort.desc ? bv - av : av - bv;
    });
    return sorted;
  }, [data, filter, query, sort]);

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // `patients` is the filtered, searched and sorted list — export what is
      // on screen, not the full payload.
      await exportFeedbackWorkbook({ ...data, patients }, location);
    } catch (e) {
      Alert.alert('Export failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const s = data?.summary;

  // Computed once and shared by the block and the card, so the two can never
  // show different numbers for the same thing.
  const nps = useMemo(() => computeNps(s?.scoreCounts, s?.operated), [s]);

  const header = (
    <View>
      <SectionHeader
        code="FEEDBACK"
        name="Patient Feedback"
        sub="Post-surgery responses from operated patients"
        hue={HUE_P}
        onBack={() => navigation.goBack()}
      />

      <View style={st.headerBody}>
        {!!s && (
          <>
            <View style={{ marginTop: -30 }}>
              <NpsBlock
                data={computeNps(
                  data?.summary?.scoreCounts,
                  data?.summary?.operated,
                )}
                note="Promoters (9–10) minus detractors (0–6), as a share of all responses."
              />
            </View>
            <View style={st.statRow}>
              <Stat
                label="NPS"
                value={
                  nps == null
                    ? '—'
                    : `${nps.nps > 0 ? '+' : ''}${Math.round(nps.nps)}`
                }
                note={
                  nps == null
                    ? 'no responses'
                    : `± ${Math.round(nps.margin)} · ${nps.n} replies`
                }
                color={npsColor(nps?.nps)}
              />
              <Stat
                label="Avg PSI"
                value={s.psiAvg == null ? '—' : `${s.psiAvg}%`}
                note="satisfaction index"
                color={T.text}
              />
              <Stat
                label="Response rate"
                value={
                  s.responseRatePct == null ? '—' : `${s.responseRatePct}%`
                }
                note={`of ${num(s.operated)} operated`}
                color={T.text}
              />
            </View>

            {s.responses > 0 && (
              <View style={st.bandBlock}>
                <StackBar
                  segments={[
                    {
                      key: 'p',
                      pct: s.promoterPct,
                      color: BAND.promoter.color,
                    },
                    { key: 'a', pct: s.passivePct, color: BAND.passive.color },
                    {
                      key: 'd',
                      pct: s.detractorPct,
                      color: BAND.detractor.color,
                    },
                  ]}
                />
                <View style={st.bandLegend}>
                  <BandChip
                    band="promoter"
                    count={s.promoters}
                    pct={s.promoterPct}
                  />
                  <BandChip
                    band="passive"
                    count={s.passives}
                    pct={s.passivePct}
                  />
                  <BandChip
                    band="detractor"
                    count={s.detractors}
                    pct={s.detractorPct}
                  />
                </View>
                <Text style={st.formula}>
                  NPS = % promoters − % detractors. Passives are excluded by
                  design.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, UID or phone"
            placeholderTextColor={T.muted2}
            style={st.search}
          />
        </View>

        <View style={st.filters}>
          {[
            { key: 'all', label: 'All' },
            { key: 'responded', label: 'Responded' },
            { key: 'pending', label: 'Awaiting' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[st.filter, filter === f.key && st.filterOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.key }}
            >
              <Text
                style={[st.filterText, filter === f.key && st.filterTextOn]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={st.filters}>
          {[
            { key: 'recent', label: 'Recent' },
            { key: 'score', label: 'Score' },
            { key: 'psi', label: 'PSI' },
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
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Sort by ${o.label}, ${
                  on && !sort.desc ? 'lowest first' : 'highest first'
                }`}
              >
                <Text style={[st.filterText, on && st.sortTextOn]}>
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
            disabled={exporting || !patients.length}
            style={[
              st.exportBtn,
              (exporting || !patients.length) && { opacity: 0.5 },
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
            code="FEEDBACK"
            name="Patient Feedback"
            sub="Post-surgery responses from operated patients"
            hue={HUE_P}
            onBack={() => navigation.goBack()}
          />
          <View style={st.centre}>
            <ActivityIndicator color={HUE_P} />
          </View>
        </>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={p => String(p.patientId)}
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
            <Text style={st.empty}>
              {error || 'No operated patients in this period.'}
            </Text>
          }
          renderItem={({ item }) => (
            <PatientRow
              p={item}
              onPress={() =>
                item.responded &&
                navigation.navigate('IPDFeedbackDetail', { patient: item })
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

const BandChip = ({ band, count, pct }) => (
  <View style={st.chip}>
    <View style={[st.dot, { backgroundColor: BAND[band].color }]} />
    <Text style={st.chipText}>
      {BAND[band].label} <Text style={st.chipVal}>{count}</Text>
      <Text style={st.chipPct}> · {pct}%</Text>
    </Text>
  </View>
);

const PatientRow = ({ p, onPress }) => {
  const b = p.band ? BAND[p.band] : null;
  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={p.responded ? 0.7 : 1}
      onPress={onPress}
      disabled={!p.responded}
      accessibilityRole={p.responded ? 'button' : 'text'}
    >
      <View
        style={[st.rowSpine, { backgroundColor: b ? b.color : T.lineSoft }]}
      />

      <View style={st.rowMain}>
        <Text style={st.name} numberOfLines={1}>
          {p.name || '—'}
        </Text>
        <Text style={st.meta} numberOfLines={1}>
          {p.uidNo || '—'} · {fmtDate(p.surgeryDate)}
          {p.surgeon ? ` · ${p.surgeon}` : ''}
        </Text>
      </View>

      {p.responded ? (
        <>
          <View style={st.scores}>
            <Text style={[st.score, { color: b.color }]}>
              {p.recommendScore}
            </Text>
            <Text style={st.scoreLabel}>score</Text>
          </View>
          <View style={st.scores}>
            <Text style={st.psi}>
              {p.psiPct == null ? '—' : `${p.psiPct}%`}
            </Text>
            <Text style={st.scoreLabel}>PSI</Text>
          </View>
          <Icon name="chevron-right" size={20} color={T.chevron} />
        </>
      ) : (
        <Text style={st.pending}>Awaiting</Text>
      )}
    </TouchableOpacity>
  );
};

export default IPDFeedbackList;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBody: { paddingHorizontal: 16 },

  statRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
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

  bandBlock: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  bandLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  chipText: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  chipVal: { fontFamily: F.mono, fontSize: 12, color: T.text },
  chipPct: { fontFamily: F.mono, fontSize: 10.5, color: T.muted2 },
  formula: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 11,
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
    marginTop: 14,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },

  filters: { flexDirection: 'row', gap: 7, marginTop: 10, marginBottom: 4 },
  filter: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  filterOn: { backgroundColor: HUE_P, borderColor: HUE_P },
  filterText: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  filterTextOn: { color: '#fff', fontFamily: F.medium },

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

  scores: { alignItems: 'center', minWidth: 40 },
  score: { fontFamily: F.mono, fontSize: 18, letterSpacing: -0.3 },
  psi: { fontFamily: F.mono, fontSize: 15, color: T.text, letterSpacing: -0.3 },
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
  // Outlined rather than filled, so the sort row reads as secondary to the
  // filled filter chips above it — two filled rows compete for the eye.
  sortBtnOn: { borderColor: HUE_P, backgroundColor: '#F1F5EE' },
  sortTextOn: { color: HUE_P, fontFamily: F.medium },
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
