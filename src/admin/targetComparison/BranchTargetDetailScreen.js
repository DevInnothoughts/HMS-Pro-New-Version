/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// BranchTargetDetailScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-branch (or consolidated "all") full parameter comparison.
//
// Detailed Comparison is now a COLLAPSIBLE LIST instead of a horizontally
// scrolling table. Each parameter is one full-width row:
//
//   collapsed →  label · this-year value · achievement % per target set · rails
//   expanded  →  last year, this year, YoY, and one line per target set
//
// Achievement % is the headline figure throughout — absolute target values are
// demoted to supporting captions, since management reads the percentages.
//
// Nothing scrolls sideways, all nine parameters fit on one screen collapsed,
// and Base / Optimistic become two labelled lines rather than squeezed columns.
// Total Revenue is pinned open by default as the summary row.
//
// Role handling: the server decides which target set lands in target/ach —
// Base for SuperAdmin (with Optimistic alongside), Optimistic for everyone
// else. meta.primaryLabel names that primary set for the UI.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
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
  fmtValue,
  yoyColor,
  achColor,
  StatCard,
  RevenueChart,
  GrowthChart,
  PeriodFilterModal,
} from './TargetComparisonShared';
import {
  fetchComparisonDetail,
  currentMonthPeriodIndex,
} from './TargetComparisonAPI';

// Android needs this opt-in for LayoutAnimation to run at all.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════ Detailed Comparison — collapsible rows ═══════════════ */

const achText = v => (v == null ? '—' : `${v.toFixed(1)}%`);
const yoyText = v => `${v >= 0 ? '+' : ''}${(Number(v) || 0).toFixed(2)}%`;

// One rail per target set, stacked. Fill is the achievement %, capped at 100
// so an overshoot doesn't blow past the track.
const RailBar = ({ ach }) => {
  const pct = ach == null ? 0 : Math.max(0, Math.min(ach, 100));
  return (
    <View style={rowStyles.railTrack}>
      <View
        style={[
          rowStyles.railFill,
          { width: `${pct}%`, backgroundColor: achColor(ach) },
        ]}
      />
    </View>
  );
};

const DetailLine = ({ label, value, valueColor, caption, strong }) => (
  <View style={rowStyles.detailLine}>
    <Text style={rowStyles.detailLabel}>{label}</Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text
        style={[
          rowStyles.detailValue,
          strong && rowStyles.detailValueStrong,
          valueColor && { color: valueColor },
        ]}
      >
        {value}
      </Text>
      {!!caption && <Text style={rowStyles.detailCaption}>{caption}</Text>}
    </View>
  </View>
);

const ParamRow = ({ row, open, onToggle, primaryLabel, showOptimistic }) => {
  const isTotal = row.key === 'total';
  const hasTarget = row.target != null;

  return (
    <View style={[rowStyles.wrap, isTotal && rowStyles.wrapTotal]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        style={rowStyles.head}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${row.label}, ${fmtValue(
          row.type,
          row.thisYear,
        )}, ${achText(row.ach)} of target`}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text
            style={[rowStyles.label, isTotal && rowStyles.labelTotal]}
            numberOfLines={1}
          >
            {row.label}
          </Text>
          <Text style={rowStyles.subLabel} numberOfLines={1}>
            last yr {fmtValue(row.type, row.lastYear)}
          </Text>
        </View>

        <View style={rowStyles.headRight}>
          <Text
            style={[rowStyles.thisYear, isTotal && rowStyles.thisYearTotal]}
            numberOfLines={1}
          >
            {fmtValue(row.type, row.thisYear)}
          </Text>
          <Text style={[rowStyles.yoy, { color: yoyColor(row.yoy) }]}>
            {yoyText(row.yoy)}
          </Text>
        </View>

        <View style={rowStyles.achBox}>
          <Text style={[rowStyles.ach, { color: achColor(row.ach) }]}>
            {achText(row.ach)}
          </Text>
          <Text style={rowStyles.achCap}>
            {showOptimistic ? 'base' : primaryLabel.toLowerCase()}
          </Text>
        </View>

        {showOptimistic && (
          <View style={rowStyles.achBox}>
            <Text style={[rowStyles.ach, { color: achColor(row.achO) }]}>
              {achText(row.achO)}
            </Text>
            <Text style={rowStyles.achCap}>opt</Text>
          </View>
        )}

        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#b0b8c1"
          style={{ marginLeft: 2 }}
        />
      </TouchableOpacity>

      {/* {hasTarget && <RailBar ach={row.ach} />}
      {showOptimistic && row.targetO != null && (
        <View style={{ marginTop: 2 }}>
          <RailBar ach={row.achO} />
        </View>
      )} */}

      {open && (
        <View style={rowStyles.body}>
          <DetailLine
            label="Last year"
            value={fmtValue(row.type, row.lastYear)}
          />
          <DetailLine
            label="This year"
            value={fmtValue(row.type, row.thisYear)}
          />
          <DetailLine
            label="YoY change"
            value={yoyText(row.yoy)}
            valueColor={yoyColor(row.yoy)}
          />

          <View style={rowStyles.bodyDivider} />

          <DetailLine
            label={
              showOptimistic ? 'Base achieved' : `${primaryLabel} achieved`
            }
            value={achText(row.ach)}
            valueColor={achColor(row.ach)}
            strong
            caption={
              row.target == null
                ? 'no target set'
                : `of ${fmtValue(row.type, row.target)}${
                    row.targetPct == null
                      ? ''
                      : ` · ${yoyText(row.targetPct)} vs last yr`
                  }`
            }
          />

          {showOptimistic && (
            <DetailLine
              label="Optimistic achieved"
              value={achText(row.achO)}
              valueColor={achColor(row.achO)}
              strong
              caption={
                row.targetO == null
                  ? 'no target set'
                  : `of ${fmtValue(row.type, row.targetO)}${
                      row.targetPctO == null
                        ? ''
                        : ` · ${yoyText(row.targetPctO)} vs last yr`
                    }`
              }
            />
          )}

          {row.isRate && (
            <Text style={rowStyles.note}>
              Rate metric — the target is not prorated by period length.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const ComparisonList = ({ rows, primaryLabel, showOptimistic }) => {
  // Total Revenue starts open as the summary row; everything else collapsed.
  const [openKeys, setOpenKeys] = useState(() => ({ total: true }));

  const toggle = key => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        180,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
    setOpenKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!rows || !rows.length) return null;

  // Total first so the headline number is the first thing read.
  const ordered = [
    ...rows.filter(r => r.key === 'total'),
    ...rows.filter(r => r.key !== 'total'),
  ];

  return (
    <View>
      {ordered.map(row => (
        <ParamRow
          key={row.key}
          row={row}
          open={!!openKeys[row.key]}
          onToggle={() => toggle(row.key)}
          primaryLabel={primaryLabel}
          showOptimistic={showOptimistic}
        />
      ))}
    </View>
  );
};

/* ══════════════════════════════ Screen ═══════════════════════════════════ */

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
  const [primaryLabel, setPrimaryLabel] = useState('Target');
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
        setPrimaryLabel(res.meta?.primaryLabel || 'Target');
      })
      .catch(e => alive && setError(e.message || 'Failed to load comparison'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [branchId, locations, mode, period, role, subRole]);

  useEffect(() => load(), [load]);

  const periodLabel = buildPeriodLabel(mode, period);
  const byKey = k =>
    (rows || []).find(r => r.key === k) || {
      thisYear: 0,
      yoy: 0,
      ach: null,
      target: null,
      achO: null,
      targetO: null,
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {branchName}
          </Text>
          <Text style={styles.headerSub}>
            {MODE_LABEL[mode]} · {periodLabel}
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
          <View style={styles.statRow}>
            <StatCard
              title="Total Revenue (This Yr)"
              value={fmtCompact(total.thisYear)}
              sub={`${total.yoy >= 0 ? '+' : ''}${total.yoy.toFixed(2)}% YoY`}
              subColor={yoyColor(total.yoy)}
            />
            <StatCard
              title={`${primaryLabel} Achieved`}
              value={total.ach == null ? '—' : `${total.ach.toFixed(1)}%`}
              sub={
                total.target == null
                  ? 'No target set'
                  : `Target ${fmtCompact(total.target)}`
              }
              subColor={total.ach == null ? '#999' : achColor(total.ach)}
            />
          </View>

          {showOptimistic ? (
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
          ) : (
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
            <Card.Content style={{ paddingHorizontal: 12 }}>
              <Text style={styles.cardTitle}>Detailed Comparison</Text>
              <Text style={styles.cardCaption}>
                {showOptimistic
                  ? 'Base and optimistic achievement %. Tap for detail.'
                  : 'Achievement % against target. Tap for detail.'}
              </Text>
              <Divider style={{ marginVertical: 10 }} />
              <ComparisonList
                rows={rows}
                primaryLabel={primaryLabel}
                showOptimistic={showOptimistic}
              />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Revenue Streams</Text>
              <Text style={styles.cardCaption}>
                Last Year vs This Year vs {primaryLabel}
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

/* ────────────────────────────── styles ─────────────────────────────────── */

const rowStyles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e4e9f0',
    paddingBottom: 10,
  },
  wrapTotal: {
    borderTopWidth: 0,
    backgroundColor: '#f7f9fc',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  label: { fontSize: 14, color: '#1f2a37', fontWeight: '500' },
  labelTotal: { fontWeight: '800' },
  subLabel: { fontSize: 11, color: '#9aa5b1', marginTop: 1 },
  headRight: { alignItems: 'flex-end', minWidth: 70, marginRight: 8 },
  thisYear: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  thisYearTotal: { fontSize: 14, fontWeight: '700', color: '#1f2a37' },
  yoy: { fontSize: 11, marginTop: 1 },
  achBox: { alignItems: 'flex-end', minWidth: 50, marginLeft: 4 },
  ach: { fontSize: 15, fontWeight: '800' },
  achCap: { fontSize: 10, color: '#9aa5b1', marginTop: 1 },

  railTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e8edf3',
    overflow: 'hidden',
  },
  railFill: { height: 4, borderRadius: 2 },

  body: {
    marginTop: 10,
    backgroundColor: '#f7f9fc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bodyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#dde4ed',
    marginVertical: 7,
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  detailLabel: { fontSize: 13, color: '#6b7280', flex: 1, paddingRight: 12 },
  detailValue: { fontSize: 13, color: '#1f2a37', fontWeight: '600' },
  detailValueStrong: { fontSize: 16, fontWeight: '800' },
  detailCaption: { fontSize: 11, color: '#9aa5b1', marginTop: 1 },
  note: { fontSize: 11, color: '#9aa5b1', marginTop: 8, fontStyle: 'italic' },
});

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
