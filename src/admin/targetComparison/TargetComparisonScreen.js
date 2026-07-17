/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// TargetComparisonScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Overview: consolidated (all-branches) summary + searchable branch list.
// Reads the user's role from redux and forwards it so SuperAdmin also receives
// Optimistic targets. For SuperAdmin the branch rows show both Base and
// Optimistic achievement; for everyone else, Base only (unchanged layout).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Text, Card, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import {
  BRAND,
  BG,
  RED,
  GREEN,
  MODE_LABEL,
  buildPeriodLabel,
  fmtCompact,
  fmtCount,
  yoyColor,
  achColor,
  StatCard,
  RevenueChart,
  PeriodFilterModal,
} from './TargetComparisonShared';
import {
  fetchComparisonBranches,
  fetchComparisonDetail,
  currentMonthPeriodIndex,
} from './TargetComparisonAPI';

const TargetComparisonScreen = ({ navigation }) => {
  const [mode, setMode] = useState('monthly');
  const [period, setPeriod] = useState(currentMonthPeriodIndex());
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState('');

  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'ach'

  const locations = useMemo(() => {
    if (locationArray && locationArray.length > 0) return locationArray;
    return location ? [location] : [];
  }, [location, locationArray]);

  const [consolidated, setConsolidated] = useState(null);
  const [branchTotals, setBranchTotals] = useState([]);
  const [showOptimistic, setShowOptimistic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    if (!locations.length) {
      setLoading(false);
      setError('No branch is available for your account.');
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all([
      fetchComparisonDetail('all', mode, period, locations, role, subRole),
      fetchComparisonBranches(mode, period, locations, role, subRole),
    ])
      .then(([detail, list]) => {
        if (!alive) return;
        setConsolidated(detail.params);
        setBranchTotals(list.branches || []);
        setShowOptimistic(!!list.meta?.showOptimistic);
      })
      .catch(e => alive && setError(e.message || 'Failed to load comparison'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [locations, mode, period, role, subRole]);

  useEffect(() => load(), [load]);

  const periodLabel = buildPeriodLabel(mode, period);
  const byKey = k =>
    (consolidated || []).find(r => r.key === k) || {
      thisYear: 0,
      yoy: 0,
      ach: null,
      target: null,
    };
  const total = byKey('total');
  const newPat = byKey('newPatients');
  const sx = byKey('sx');

  const q = search.trim().toLowerCase();
  const searched = q
    ? branchTotals.filter(b => b.name.toLowerCase().includes(q))
    : branchTotals;

  const filtered = [...searched].sort((a, b) => {
    if (sortBy === 'ach') {
      // Highest achievement first; branches with no target (ach == null) sink to the bottom.
      const av = a.ach == null ? -Infinity : a.ach;
      const bv = b.ach == null ? -Infinity : b.ach;
      if (bv !== av) return bv - av;
      return a.name.localeCompare(b.name); // tie-break by name
    }
    return a.name.localeCompare(b.name); // alphabetical
  });

  const openBranch = b =>
    navigation?.navigate?.('BranchTargetDetail', {
      branchId: b.id,
      branchName: b.name,
      mode,
      period,
      locations,
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.headerIconBtn}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Target Comparison</Text>
          <Text style={styles.headerSub}>
            This Year vs Last Year{showOptimistic ? ' · Base + Optimistic' : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilter(true)}
          style={styles.headerIconBtn}
        >
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.banner}>
        <TouchableOpacity
          style={styles.bannerChip}
          onPress={() => setShowFilter(true)}
        >
          <Icon
            name="calendar-range"
            size={16}
            color={BRAND}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.bannerChipText}>
            {MODE_LABEL[mode]} · {periodLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} size="large" />
          <Text style={styles.muted}>Loading comparison…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={42} color={RED} />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Icon
              name="refresh"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <Text style={styles.viewLabel}>
            All Branches · {MODE_LABEL[mode]}
          </Text>

          <View style={styles.statRow}>
            <StatCard
              title="Total Revenue (This Yr)"
              value={fmtCompact(total.thisYear)}
              sub={`${total.yoy >= 0 ? '+' : ''}${total.yoy.toFixed(2)}% YoY`}
              subColor={yoyColor(total.yoy)}
            />
            <StatCard
              title="Base Target Achieved"
              value={total.ach == null ? '—' : `${total.ach.toFixed(1)}%`}
              sub={
                total.target == null
                  ? 'No target set'
                  : `Target ${fmtCompact(total.target)}`
              }
              subColor={total.ach == null ? '#999' : achColor(total.ach)}
            />
          </View>

          {/* Optimistic summary card only for SuperAdmin */}
          {showOptimistic && (
            <View style={styles.statRow}>
              <StatCard
                title="Optimistic Target Achieved"
                value={total.achO == null ? '—' : `${total.achO.toFixed(1)}%`}
                sub={
                  total.targetO == null
                    ? 'No target set'
                    : `Target ${fmtCompact(total.targetO)}`
                }
                subColor={total.achO == null ? '#999' : achColor(total.achO)}
              />
              <StatCard
                title="New Patients (This Yr)"
                value={fmtCount(newPat.thisYear)}
                sub={`${newPat.yoy >= 0 ? '+' : ''}${newPat.yoy.toFixed(
                  2,
                )}% YoY`}
                subColor={yoyColor(newPat.yoy)}
              />
            </View>
          )}

          {!showOptimistic && (
            <View style={styles.statRow}>
              <StatCard
                title="New Patients"
                value={fmtCount(newPat.thisYear)}
                sub={`${newPat.yoy >= 0 ? '+' : ''}${newPat.yoy.toFixed(
                  2,
                )}% YoY`}
                subColor={yoyColor(newPat.yoy)}
              />
              <StatCard
                title="No. of SX"
                value={fmtCount(sx.thisYear)}
                sub={`${sx.yoy >= 0 ? '+' : ''}${sx.yoy.toFixed(2)}% YoY`}
                subColor={yoyColor(sx.yoy)}
              />
            </View>
          )}

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>
                Revenue Streams (All Branches)
              </Text>
              <Text style={styles.cardCaption}>
                Last Year (from records) vs This Year vs Base Target
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <RevenueChart rows={consolidated} />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>
                Branches ({branchTotals.length})
              </Text>
              <Text style={styles.cardCaption}>
                Tap a branch for its full comparison
              </Text>

              <View style={styles.searchBox}>
                <Icon name="magnify" size={18} color="#888" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search branch"
                  placeholderTextColor="#9aa5b1"
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort</Text>
                {[
                  { key: 'name', label: 'A–Z' },
                  { key: 'ach', label: 'Achievement' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setSortBy(opt.key)}
                    style={[
                      styles.sortChip,
                      sortBy === opt.key && styles.sortChipActive,
                    ]}
                  >
                    <Icon
                      name={
                        opt.key === 'name'
                          ? 'sort-alphabetical-ascending'
                          : 'sort-descending'
                      }
                      size={14}
                      color={sortBy === opt.key ? '#fff' : BRAND}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.sortChipText,
                        sortBy === opt.key && styles.sortChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {filtered.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.branchRow}
                  onPress={() => openBranch(b)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.branchName}>{b.name}</Text>
                    <Text style={styles.branchSub}>
                      {fmtCompact(b.thisYear)} · {b.yoy >= 0 ? '+' : ''}
                      {b.yoy.toFixed(1)}% YoY
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                    <Text style={[styles.achVal, { color: achColor(b.ach) }]}>
                      {b.ach == null ? '—' : `${b.ach.toFixed(0)}%`}
                    </Text>
                    <Text style={styles.achCap}>
                      {showOptimistic ? 'Base' : 'Ach'}
                    </Text>
                  </View>
                  {showOptimistic && (
                    <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                      <Text
                        style={[styles.achVal, { color: achColor(b.achO) }]}
                      >
                        {b.achO == null ? '—' : `${b.achO.toFixed(0)}%`}
                      </Text>
                      <Text style={styles.achCap}>Opt</Text>
                    </View>
                  )}
                  <Icon name="chevron-right" size={22} color="#b0b8c1" />
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <Text style={styles.muted}>No branches match “{search}”.</Text>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      <PeriodFilterModal
        visible={showFilter}
        mode={mode}
        period={period}
        onClose={() => setShowFilter(false)}
        onApply={(m, p) => {
          setMode(m);
          setPeriod(p);
          setShowFilter(false);
        }}
      />
    </SafeAreaView>
  );
};

export default TargetComparisonScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSub: { color: '#cdddf2', fontSize: 12, textAlign: 'center' },
  banner: { paddingHorizontal: 14, paddingTop: 12 },
  bannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e8eef5',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  bannerChipText: { color: BRAND, fontSize: 13, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  muted: { color: '#6b7280', marginTop: 10 },
  errText: { color: RED, marginTop: 10, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 14,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  viewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statRow: { flexDirection: 'row', marginBottom: 10 },
  card: {
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1f2a37' },
  cardCaption: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f4f8',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    color: '#1f2a37',
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
  },
  branchName: { fontSize: 14, fontWeight: '700', color: '#1f2a37' },
  branchSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  achVal: { fontSize: 15, fontWeight: '800' },
  achCap: { fontSize: 10, color: '#9aa5b1' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sortLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#eef3f8',
    marginRight: 8,
  },
  sortChipActive: { backgroundColor: BRAND },
  sortChipText: { fontSize: 12, color: BRAND, fontWeight: '600' },
  sortChipTextActive: { color: '#fff' },
});
