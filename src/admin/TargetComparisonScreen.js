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

/**
 * Overview screen: consolidated (all-branches) summary on top, then a
 * searchable list of every branch. Tapping a branch opens the reusable
 * BranchTargetDetailScreen with that branch + the current period.
 *
 * Locations are sourced from redux (same as ReportScreen) and passed to the
 * API — there is no hardcoded fallback branch list anywhere in the frontend.
 */
const TargetComparisonScreen = ({ navigation }) => {
  const [mode, setMode] = useState('monthly');
  const [period, setPeriod] = useState(currentMonthPeriodIndex());
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState('');

  // Branches this user is authorized for (redux). No fallback list.
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const locations = useMemo(() => {
    if (locationArray && locationArray.length > 0) return locationArray;
    return location ? [location] : [];
  }, [location, locationArray]);

  const [consolidated, setConsolidated] = useState(null); // params array (or null while loading)
  const [branchTotals, setBranchTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;

    // No locations from redux → don't substitute a default; surface it.
    if (!locations.length) {
      setLoading(false);
      setError('No branch is available for your account.');
      setConsolidated(null);
      setBranchTotals([]);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);
    Promise.all([
      fetchComparisonDetail('all', mode, period, locations),
      fetchComparisonBranches(mode, period, locations),
    ])
      .then(([detail, list]) => {
        if (!alive) return;
        setConsolidated(detail.params);
        setBranchTotals(list.branches || []);
      })
      .catch(e => {
        if (alive) setError(e.message || 'Failed to load');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [mode, period, locations]);

  useEffect(() => load(), [load]);

  const periodLabel = buildPeriodLabel(mode, period);

  const total = consolidated?.find(r => r.key === 'total');
  const newPat = consolidated?.find(r => r.key === 'newPatients');
  const sx = consolidated?.find(r => r.key === 'sx');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? branchTotals.filter(b => b.name.toLowerCase().includes(q))
    : branchTotals;

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.headerIconBtn}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Target Comparison</Text>
          <Text style={styles.headerSub}>This Year vs Last Year</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilter(true)}
          style={styles.headerIconBtn}
        >
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Period banner */}
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

          {/* Consolidated highlight cards */}
          <View style={styles.statRow}>
            <StatCard
              title="Total Revenue (This Yr)"
              value={fmtCompact(total.thisYear)}
              sub={`${total.yoy >= 0 ? '+' : ''}${total.yoy.toFixed(2)}% YoY`}
              subColor={yoyColor(total.yoy)}
            />
            <StatCard
              title="Target Achieved"
              value={total.ach == null ? '—' : `${total.ach.toFixed(1)}%`}
              sub={
                total.target == null
                  ? 'No target set'
                  : `Target ${fmtCompact(total.target)}`
              }
              subColor={total.ach == null ? '#999' : achColor(total.ach)}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              title="New Patients"
              value={fmtCount(newPat.thisYear)}
              sub={`${newPat.yoy >= 0 ? '+' : ''}${newPat.yoy.toFixed(2)}% YoY`}
              subColor={yoyColor(newPat.yoy)}
            />
            <StatCard
              title="No. of SX"
              value={fmtCount(sx.thisYear)}
              sub={`${sx.yoy >= 0 ? '+' : ''}${sx.yoy.toFixed(2)}% YoY`}
              subColor={yoyColor(sx.yoy)}
            />
          </View>

          {/* Consolidated revenue chart */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>
                Revenue Streams (All Branches)
              </Text>
              <Text style={styles.cardCaption}>
                Last Year vs This Year vs Target
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <RevenueChart rows={consolidated} />
            </Card.Content>
          </Card>

          {/* Branch list */}
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
                  style={styles.searchInput}
                  placeholder="Search branch"
                  placeholderTextColor="#999"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Icon name="close-circle" size={18} color="#bbb" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.listHeadRow}>
                <Text
                  style={[styles.listHead, { flex: 1.6, textAlign: 'left' }]}
                >
                  Branch
                </Text>
                <Text style={[styles.listHead, { flex: 1.2 }]}>This Yr</Text>
                <Text style={[styles.listHead, { flex: 0.9 }]}>YoY</Text>
                <Text style={[styles.listHead, { flex: 0.9 }]}>Ach</Text>
                <View style={{ width: 22 }} />
              </View>

              {filtered.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.listRow}
                  onPress={() => openBranch(b)}
                >
                  <Text
                    style={[
                      styles.listCell,
                      {
                        flex: 1.6,
                        textAlign: 'left',
                        fontWeight: '700',
                        color: BRAND,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                  <Text
                    style={[styles.listCell, { flex: 1.2 }]}
                    numberOfLines={1}
                  >
                    {fmtCompact(b.thisYear)}
                  </Text>
                  <Text
                    style={[
                      styles.listCell,
                      { flex: 0.9, color: yoyColor(b.yoy), fontWeight: '700' },
                    ]}
                  >
                    {b.yoy >= 0 ? '+' : ''}
                    {b.yoy.toFixed(1)}%
                  </Text>
                  <Text
                    style={[
                      styles.listCell,
                      {
                        flex: 0.9,
                        color: b.ach == null ? '#999' : achColor(b.ach),
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {b.ach == null ? '—' : `${b.ach.toFixed(0)}%`}
                  </Text>
                  <Icon
                    name="chevron-right"
                    size={20}
                    color="#bbb"
                    style={{ width: 22 }}
                  />
                </TouchableOpacity>
              ))}

              {filtered.length === 0 && (
                <Text style={styles.emptyText}>
                  No branches match “{search}”.
                </Text>
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
  headerSub: {
    color: '#cdddf2',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },

  banner: {
    backgroundColor: '#e9eff7',
    paddingVertical: 10,
    alignItems: 'center',
  },
  bannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  bannerChipText: { color: BRAND, fontWeight: '700', fontSize: 13 },

  viewLabel: {
    fontSize: 13,
    color: '#667',
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  cardCaption: { fontSize: 12, color: '#888', marginTop: 2 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f4f8',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#222',
  },

  listHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listHead: {
    fontSize: 11.5,
    color: '#888',
    fontWeight: '700',
    textAlign: 'right',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f8',
  },
  listCell: { fontSize: 13, color: '#333', textAlign: 'right' },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 18,
    fontSize: 13,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  muted: { color: '#888', marginTop: 12, fontSize: 13 },
  errText: {
    color: '#c0392b',
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
