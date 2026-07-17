/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// BranchTargetDetailScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-branch (or consolidated "all") full parameter comparison.
// Passes the user's role so SuperAdmin's payload carries Optimistic targets;
// ComparisonTable then renders the compact Base + Optimistic columns on its own.
// ─────────────────────────────────────────────────────────────────────────────

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

  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);

  const locations = useMemo(() => {
    if (params.locations && params.locations.length) return params.locations;
    if (locationArray && locationArray.length > 0) return locationArray;
    return location ? [location] : [];
  }, [params.locations, location, locationArray]);

  const [rows, setRows] = useState(null);
  const [showOptimistic, setShowOptimistic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    if (branchId === 'all' && !locations.length) {
      setLoading(false);
      setError('No branch is available for your account.');
      return;
    }
    setLoading(true);
    setError(null);

    fetchComparisonDetail(branchId, mode, period, locations, role, subRole)
      .then(res => {
        if (!alive) return;
        setRows(res.params);
        setShowOptimistic(!!res.meta?.showOptimistic);
      })
      .catch(e => alive && setError(e.message || 'Failed to load comparison'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [branchId, mode, period, locations, role, subRole]);

  useEffect(() => load(), [load]);

  const periodLabel = buildPeriodLabel(mode, period);
  const byKey = k =>
    (rows || []).find(r => r.key === k) || {
      thisYear: 0,
      yoy: 0,
      ach: null,
      target: null,
    };
  const total = byKey('total');
  const newPat = byKey('newPatients');
  const sx = byKey('sx');

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
          <Text style={styles.headerTitle}>{branchName}</Text>
          <Text style={styles.headerSub}>
            {MODE_LABEL[mode]} · {periodLabel}
            {showOptimistic ? ' · B+O' : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilter(true)}
          style={styles.headerIconBtn}
        >
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} size="large" />
          <Text style={styles.muted}>Loading…</Text>
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

          {showOptimistic && (
            <View style={styles.statRow}>
              <StatCard
                title="Optimistic Achieved"
                value={total.achO == null ? '—' : `${total.achO.toFixed(1)}%`}
                sub={
                  total.targetO == null
                    ? 'No target set'
                    : `Target ${fmtCompact(total.targetO)}`
                }
                subColor={total.achO == null ? '#999' : achColor(total.achO)}
              />
              <StatCard
                title="No. of SX"
                value={fmtCount(sx.thisYear)}
                sub={`${sx.yoy >= 0 ? '+' : ''}${sx.yoy.toFixed(2)}% YoY`}
                subColor={yoyColor(sx.yoy)}
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
              <Text style={styles.cardTitle}>Detailed Comparison</Text>
              <Text style={styles.cardCaption}>
                {showOptimistic
                  ? 'Target = yearly ÷ 12 (month) · Base + Optimistic'
                  : 'Target = yearly ÷ 12 (month), prorated to the period'}
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <ComparisonTable rows={rows} />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Revenue Streams</Text>
              <Text style={styles.cardCaption}>
                Last Year vs This Year vs Base Target
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <RevenueChart rows={rows} />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>YoY Growth</Text>
              <Text style={styles.cardCaption}>
                Change vs same period last year (from records)
              </Text>
              <Divider style={{ marginVertical: 12 }} />
              <GrowthChart rows={rows} />
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
  headerSub: { color: '#cdddf2', fontSize: 12, textAlign: 'center' },
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
  statRow: { flexDirection: 'row', marginBottom: 10 },
  card: {
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1f2a37' },
  cardCaption: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
