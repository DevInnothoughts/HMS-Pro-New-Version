/**
 * LeadsStatsDashboard.tsx
 * Location-wise lead statistics — Web + Bot + IVR
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://wedoc.in/hms';
const { width: SCREEN_W } = Dimensions.get('window');

const formatDateIST = (date: Date): string => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#f0f2f5',
  card: '#161B22',
  cardBorder: '#21262D',
  surface: '#1C2128',
  accent: '#238636',
  accentLight: '#2EA043',
  gold: '#D4A017',
  goldLight: '#F0C030',
  sky: '#1F6FEB',
  skyLight: '#388BFD',
  bot: '#8B5CF6',
  botLight: '#A78BFA',
  ivr: '#0891B2',
  ivrLight: '#22D3EE',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  textDark: '#11181C',
  danger: '#DA3633',
  white: '#FFFFFF',
};

const FONTS = Platform.select({
  ios: { mono: 'Courier New', sans: 'Georgia' },
  android: { mono: 'monospace', sans: 'serif' },
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeadBucket {
  total: number;
  appointment: number;
  actualVisitCount: number;
  ipd: number;
}

interface IVRBucket {
  total: number;
  appointment: number;
  actualVisitCount: number;
  ipd: number;
}

interface CombinedBucket {
  total: number;
  appointment: number;
  actualVisitCount: number;
  ipd: number;
}

interface LocationStat {
  location: string;
  web: LeadBucket;
  chatbot: LeadBucket;
  ivr: IVRBucket;
  combined: CombinedBucket;
}

type ViewMode = 'combined' | 'web' | 'chatbot' | 'ivr';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pct = (num: number, den: number) =>
  den === 0 ? 0 : Math.round((num / den) * 100);
const fmt = (n: number) => n.toLocaleString('en-IN');

const getBucket = (s: LocationStat, mode: ViewMode) =>
  mode === 'ivr'
    ? s.ivr
    : mode === 'web'
    ? s.web
    : mode === 'chatbot'
    ? s.chatbot
    : s.combined;

// ─── Animated bar ─────────────────────────────────────────────────────────────
const Bar = ({
  value,
  total,
  color,
  delay = 0,
}: {
  value: number;
  total: number;
  color: string;
  delay?: number;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const ratio = total === 0 ? 0 : Math.min(value / total, 1);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: ratio,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [ratio]);

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
const Pill = ({
  label,
  value,
  color,
  total,
  delay,
}: {
  label: string;
  value: number;
  color: string;
  total: number;
  delay?: number;
}) => (
  <View style={styles.pillWrap}>
    <View style={[styles.pillDot, { backgroundColor: color }]} />
    <View style={{ flex: 1 }}>
      <View style={styles.pillRow}>
        <Text style={styles.pillLabel}>{label}</Text>
        <Text style={[styles.pillValue, { color }]}>{fmt(value)}</Text>
        <Text style={styles.pillPct}>{pct(value, total)}%</Text>
      </View>
      <Bar value={value} total={total} color={color} delay={delay} />
    </View>
  </View>
);

// ─── Summary card ─────────────────────────────────────────────────────────────
const SummaryCard = ({
  stats,
  mode,
}: {
  stats: LocationStat[];
  mode: ViewMode;
}) => {
  const totals = stats.reduce(
    (acc, s) => {
      const b = getBucket(s, mode);
      acc.total += b.total;
      acc.appointment += b.appointment;
      acc.ipd += b.ipd;
      return acc;
    },
    { total: 0, appointment: 0, ipd: 0 },
  );

  const modeColor =
    mode === 'chatbot' ? C.botLight : mode === 'ivr' ? C.ivrLight : C.skyLight;

  const items = [
    {
      label: mode === 'ivr' ? 'Total Calls' : 'Total Leads',
      value: totals.total,
      color: modeColor,
      bg: C.sky + '22',
    },
    {
      label: 'Appointments',
      value: totals.appointment,
      color: C.accentLight,
      bg: C.accent + '22',
    },
    {
      label: 'IPD',
      value: totals.ipd,
      color: C.goldLight,
      bg: C.gold + '22',
    },
  ];

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>
        All Locations · {mode.toUpperCase()}
      </Text>
      <View style={styles.summaryRow}>
        {items.map(item => (
          <View
            key={item.label}
            style={[styles.summaryItem, { backgroundColor: item.bg }]}
          >
            <Text style={[styles.summaryNum, { color: item.color }]}>
              {fmt(item.value)}
            </Text>
            <Text style={styles.summaryLbl}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Location card ────────────────────────────────────────────────────────────
const LocationCard = ({
  stat,
  mode,
  index,
}: {
  stat: LocationStat;
  mode: ViewMode;
  index: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const bucket = getBucket(stat, mode);
  const convRate = pct(bucket.appointment, bucket.total);
  const rateColor =
    convRate >= 50 ? C.accentLight : convRate >= 25 ? C.goldLight : C.danger;
  const isIVR = mode === 'ivr';

  return (
    <Animated.View
      style={[
        styles.locationCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable onPress={() => setExpanded(e => !e)} style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationName}>{stat.location}</Text>
          <Text style={styles.locationSub}>
            {fmt(bucket.total)} {isIVR ? 'calls' : 'leads'} · Conv {convRate}%
          </Text>
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: (isIVR ? C.ivr : C.sky) + '33' },
            ]}
          >
            <Text
              style={[
                styles.badgeNum,
                { color: isIVR ? C.ivrLight : C.skyLight },
              ]}
            >
              {fmt(bucket.total)}
            </Text>
            <Text style={styles.badgeLbl}>Total</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: C.accent + '33' }]}>
            <Text style={[styles.badgeNum, { color: C.accentLight }]}>
              {fmt(bucket.appointment)}
            </Text>
            <Text style={styles.badgeLbl}>Appt</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: C.gold + '33' }]}>
            <Text style={[styles.badgeNum, { color: C.goldLight }]}>
              {fmt(bucket.ipd)}
            </Text>
            <Text style={styles.badgeLbl}>IPD</Text>
          </View>
        </View>

        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
      </Pressable>

      {/* Conversion bar */}
      <View style={styles.rateStrip}>
        <View style={styles.rateBg}>
          <View
            style={[
              styles.rateFill,
              { width: `${convRate}%`, backgroundColor: rateColor },
            ]}
          />
        </View>
        <Text style={[styles.rateLabel, { color: rateColor }]}>
          {convRate}% conv
        </Text>
      </View>

      {/* Expanded breakdown */}
      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.breakdownTitle}>
            {isIVR
              ? 'IVR BREAKDOWN'
              : mode === 'web'
              ? 'WEB LEADS BREAKDOWN'
              : mode === 'chatbot'
              ? 'BOT LEADS BREAKDOWN'
              : 'COMBINED BREAKDOWN'}
          </Text>

          <Pill
            label="Appointments"
            value={bucket.appointment}
            color={C.accentLight}
            total={bucket.total}
          />
          <Pill
            label="Clinic Visits"
            value={bucket.actualVisitCount}
            color={isIVR ? C.ivrLight : C.skyLight}
            total={bucket.total}
            delay={70}
          />
          <Pill
            label="IPD Converted"
            value={bucket.ipd}
            color={C.goldLight}
            total={bucket.total}
            delay={140}
          />
        </View>
      )}
    </Animated.View>
  );
};

// ─── Mode toggle ──────────────────────────────────────────────────────────────
const ModeToggle = ({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) => {
  const options = [
    { key: 'combined', label: 'All', color: C.skyLight },
    { key: 'web', label: 'Web', color: C.skyLight },
    { key: 'chatbot', label: 'Bot', color: C.botLight },
    { key: 'ivr', label: 'IVR', color: C.ivrLight },
  ];

  return (
    <View style={styles.modeToggle}>
      {options.map(o => (
        <TouchableOpacity
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[
            styles.modeBtn,
            mode === o.key && {
              backgroundColor: o.color + '22',
              borderColor: o.color,
            },
          ]}
        >
          <Text
            style={[styles.modeBtnTxt, mode === o.key && { color: o.color }]}
          >
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ─── Main screen (unchanged structure) ─────────────────────────────────────────
export default function LeadsStatsDashboard({
  from,
  to,
  onStatsLoaded,
}: {
  from?: string;
  to?: string;
  onStatsLoaded?: (data: LocationStat[]) => void;
}) {
  const [stats, setStats] = useState<LocationStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('combined');
  const [sortBy, setSortBy] = useState<'location' | 'total' | 'conversion'>(
    'total',
  );

  const [fromDate, setFromDate] = useState(from ? new Date(from) : new Date());
  const [toDate, setToDate] = useState(to ? new Date(to) : new Date());

  useEffect(() => {
    if (from && to) {
      setFromDate(new Date(from));
      setToDate(new Date(to));
    }
  }, [from, to]);

  const fetchStats = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE}/leadsStats/all?from=${formatDateIST(
            fromDate,
          )}&to=${formatDateIST(toDate)}`,
        );
        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Unknown error');

        setStats(json.data);
        onStatsLoaded?.(json.data);
      } catch (e: any) {
        setError(e.message || 'Failed to load stats');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fromDate, toDate],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const sorted = [...stats].sort((a, b) => {
    const ba = getBucket(a, mode);
    const bb = getBucket(b, mode);
    if (sortBy === 'location') return a.location.localeCompare(b.location);
    if (sortBy === 'total') return bb.total - ba.total;
    if (sortBy === 'conversion')
      return pct(bb.appointment, bb.total) - pct(ba.appointment, ba.total);
    return 0;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.skyLight} />
        <Text style={styles.loadingTxt}>Loading stats…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠</Text>
        <Text style={{ color: C.danger, fontSize: 14, marginBottom: 20 }}>
          {error}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchStats()}>
          <Text style={styles.retryTxt}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lead Statistics</Text>
        <View style={[styles.liveDot, { backgroundColor: C.accentLight }]} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.location}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStats(true)}
            tintColor={C.skyLight}
          />
        }
        ListHeaderComponent={
          <>
            <SummaryCard stats={stats} mode={mode} />
            <ModeToggle mode={mode} onChange={setMode} />
          </>
        }
        renderItem={({ item, index }) => (
          <LocationCard stat={item} mode={mode} index={index} />
        )}
      />
    </View>
  );
}

// ─── Styles (same as before) ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.textDark },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  summaryCard: {
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    //marginTop: 16,
  },
  summaryTitle: { fontSize: 11, color: C.textDark, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  summaryNum: { fontSize: 20, fontWeight: '800' },
  summaryLbl: { fontSize: 9, color: C.textMuted, marginTop: 4 },
  modeToggle: { flexDirection: 'row', marginVertical: 10 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeBtnTxt: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  locationCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  locationName: { fontSize: 15, fontWeight: '700', color: C.text },
  locationSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 5 },
  badge: {
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeLbl: { fontSize: 9, color: C.textMuted },
  badgeNum: { fontSize: 13, fontWeight: '800' },
  chevron: { fontSize: 22, color: C.textDim, marginLeft: 2 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  rateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  rateBg: {
    flex: 1,
    height: 4,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  rateFill: { height: 4, borderRadius: 2 },
  rateLabel: { fontSize: 11, fontWeight: '600', minWidth: 70 },
  expandedContent: {
    padding: 14,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
  },
  breakdownTitle: {
    fontSize: 10,
    color: C.textDim,
    marginBottom: 10,
  },
  pillWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pillLabel: { flex: 1, fontSize: 13, color: C.textMuted },
  pillValue: { fontSize: 13, fontWeight: '700', marginRight: 6 },
  pillPct: { fontSize: 11, color: C.textDim, width: 36, textAlign: 'right' },
  barTrack: {
    height: 3,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  barFill: { height: 3, borderRadius: 2 },
  retryBtn: {
    backgroundColor: C.sky + '33',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: C.skyLight,
  },
  retryTxt: { color: C.skyLight, fontWeight: '600' },
  loadingTxt: { color: C.textMuted, marginTop: 12 },
});
