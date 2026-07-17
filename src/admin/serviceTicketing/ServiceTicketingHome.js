/* eslint-disable prettier/prettier */
// ServiceTicketingHome.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry screen for Service Ticketing.
//   • Lists tickets for the branches the signed-in user is authorised for.
//   • "My Queue" shows only tickets awaiting THIS user's action.
//   • Partners get a "Raise Request" button.
//   • Tapping a ticket opens ServiceTicketDetail.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import { listTickets } from './ServiceTicketAPI';
import {
  C,
  canRaise,
  statusMeta,
  categoryLabel,
  PRIORITY_META,
  SLA_STATE_META,
  normaliseRole,
  ROLES,
  fmtDateTime,
} from './ServiceTicketConstants';

const FILTERS = [
  { key: 'MINE', label: 'My Queue' },
  { key: 'ALL', label: 'All' },
  { key: 'RAISED', label: 'Raised' },
  { key: 'CLUSTER_APPROVED', label: 'Approved' },
  { key: 'HO_ACTION_SUBMITTED', label: 'Actioned' },
  { key: 'CLOSED', label: 'Closed' },
];

const Chip = ({ text, color }) => (
  <View style={[styles.chip, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
    <Text style={[styles.chipTxt, { color }]}>{text}</Text>
  </View>
);

const TicketCard = ({ t, onPress }) => {
  const sm = statusMeta(t.status);
  const pm = PRIORITY_META[t.priority] || { color: C.textMed };
  const sla = SLA_STATE_META[t.slaState] || SLA_STATE_META.NA;
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={onPress}>
      <View style={[styles.cardAccent, { backgroundColor: sm.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.ticketNo}>{t.ticketNo || '—'}</Text>
          <Chip text={sm.short} color={sm.color} />
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {t.title}
        </Text>

        <View style={styles.metaRow}>
          <Icon name="place" size={13} color={C.textMed} />
          <Text style={styles.metaTxt}>{t.branch}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaTxt} numberOfLines={1}>
            {categoryLabel(t.categoryCode)}
          </Text>
        </View>

        <View style={styles.cardBottomRow}>
          <Chip text={t.priority} color={pm.color} />
          {t.slaState && t.slaState !== 'NA' ? (
            <Chip text={sla.label} color={sla.color} />
          ) : null}
          {t.actionableByMe ? (
            <View style={styles.actionFlag}>
              <Icon name="notifications-active" size={12} color="#fff" />
              <Text style={styles.actionFlagTxt}>Action</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={styles.dateTxt}>{fmtDateTime(t.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ServiceTicketingHome = ({ navigation }) => {
  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);
  const location = useSelector(s => s.location.value);
  const locationArray = useSelector(s => s.location.locationArray);

  const locations = useMemo(() => {
    if (locationArray && locationArray.length) return locationArray;
    return location ? [location] : [];
  }, [location, locationArray]);

  const canonicalRole = normaliseRole(role, subRole);

  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState(
    canonicalRole === ROLES.PARTNER ? 'ALL' : 'MINE',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!locations.length) {
      setError('No branch is available for your account.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await listTickets({ locations }, role, subRole);
      setTickets(res.tickets || []);
      setCounts(res.counts || {});
    } catch (e) {
      setError(e.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locations, role, subRole]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = useMemo(() => {
    if (filter === 'ALL') return tickets;
    if (filter === 'MINE') return tickets.filter(t => t.actionableByMe);
    return tickets.filter(t => t.status === filter);
  }, [tickets, filter]);

  const mineCount = tickets.filter(t => t.actionableByMe).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image source={require('../../../assets/back.png')} style={styles.back} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Ticketing</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            const badge =
              f.key === 'MINE'
                ? mineCount
                : f.key === 'ALL'
                ? tickets.length
                : counts[f.key] || 0;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>
                  {f.label}
                  {badge ? ` (${badge})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="error-outline" size={40} color={C.error} />
          <Text style={styles.errTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TicketCard
              t={item}
              onPress={() =>
                navigation.navigate('ServiceTicketDetail', { ticketId: item.id })
              }
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="inbox" size={44} color={C.textLight} />
              <Text style={styles.emptyTxt}>No tickets here.</Text>
            </View>
          }
        />
      )}

      {/* Raise button (Partners / SuperAdmin) */}
      {canRaise(role, subRole) && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('RaiseServiceTicket')}
        >
          <Icon name="add" size={22} color="#fff" />
          <Text style={styles.fabTxt}>Raise Request</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  back: { height: 30, width: 30, tintColor: C.primary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.textDark },

  tabsWrap: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabTxt: { fontSize: 13, color: C.textMed, fontWeight: '600' },
  tabTxtActive: { color: '#fff' },

  card: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    elevation: 1,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 12 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketNo: { fontSize: 12, fontWeight: '700', color: C.textMed, letterSpacing: 0.3 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.textDark, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaTxt: { fontSize: 12, color: C.textMed, marginLeft: 3 },
  dot: { marginHorizontal: 6, color: C.textLight },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
    marginTop: 2,
  },
  chipTxt: { fontSize: 11, fontWeight: '700' },

  actionFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  actionFlagTxt: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 3 },
  dateTxt: { fontSize: 11, color: C.textLight },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTxt: { color: C.textLight, marginTop: 10, fontSize: 14 },
  errTxt: { color: C.error, marginTop: 10, textAlign: 'center' },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: C.primary,
    borderRadius: 8,
  },
  retryTxt: { color: '#fff', fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fabTxt: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 14 },
});

export default ServiceTicketingHome;
