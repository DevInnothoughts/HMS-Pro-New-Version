import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
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
  GrowthChart,
  ComparisonTable,
  PeriodFilterModal,
} from './TargetComparisonShared';
import {
  fetchComparisonDetail,
  currentMonthPeriodIndex,
} from './TargetComparisonAPI';

/**
 * Reusable per-branch detail page. Open via:
 *   navigation.navigate('BranchTargetDetail', {
 *     branchId, branchName, mode, period, locations
 *   })
 * For a single branch the backend uses branchId directly; `locations` only
 * matters for the consolidated ("all") case. Locations come from the nav
 * params (passed by the overview) or redux — never a hardcoded fallback.
 */
const BranchTargetDetailScreen = ({ route, navigation }) => {
  const params = route?.params || {};
  const branchId = params.branchId || 'all';
  const branchName =
    params.branchName || (branchId === 'all' ? 'All Branches' : branchId);

  const [mode, setMode] = useState(params.mode || 'monthly');
  const [period, setPeriod] = useState(
    typeof params.period === 'number'
      ? params.period
      : currentMonthPeriodIndex(),
  );
  const [showFilter, setShowFilter] = useState(false);

  // Locations: prefer what the overview passed; otherwise redux. No fallback.
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const locations = useMemo(() => {
    if (params.locations && params.locations.length) return params.locations;
    if (locationArray && locationArray.length > 0) return locationArray;
    return location ? [location] : [];
  }, [params.locations, location, locationArray]);

  const [rows, setRows] = useState(null); // params array (or null while loading)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;

    // Consolidated view needs a branch list; don't substitute a default.
    if (branchId === 'all' && !locations.length) {
      setLoading(false);
      setError('No branch is available for your account.');
      setRows(null);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);
    fetchComparisonDetail(branchId, mode, period, locations)
      .then(d => {
        if (alive) setRows(d.params);
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
  }, [branchId, mode, period, locations]);

  useEffect(() => load(), [load]);

  const periodLabel = buildPeriodLabel(mode, period);

  const total = rows?.find(r => r.key === 'total');
  const newPat = rows?.find(r => r.key === 'newPatients');
  const sx = rows?.find(r => r.key === 'sx');

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {branchName}
          </Text>
          <Text style={styles.headerSub}>Target Comparison</Text>
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
          {/* Highlight cards */}
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

          {/* Revenue chart */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Revenue Streams</Text>
              <Text style={styles.cardCaption}>
                Last Year vs This Year vs Target
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <RevenueChart rows={rows} />
            </Card.Content>
          </Card>

          {/* Growth chart */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>YoY Growth</Text>
              <Text style={styles.cardCaption}>
                Change vs same period last year
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <GrowthChart rows={rows} />
            </Card.Content>
          </Card>

          {/* Detailed table */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Detailed Comparison</Text>
              <Text style={styles.cardCaption}>
                Target = Last Year + stored growth %
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <ComparisonTable rows={rows} />
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

export default BranchTargetDetailScreen;

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

  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  cardCaption: { fontSize: 12, color: '#888', marginTop: 2 },

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
