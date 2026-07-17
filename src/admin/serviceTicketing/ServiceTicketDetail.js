/* eslint-disable prettier/prettier */
// ServiceTicketDetail.js
// ─────────────────────────────────────────────────────────────────────────────
// Full ticket view: details, TAT/SLA summary, processing timeline, and the
// action panel that changes with the viewer's role + the ticket's stage:
//   Cluster Head (RAISED)                 → Approve / Reject
//   HO User      (CLUSTER_APPROVED/REOPENED) → Submit Action
//   Partner      (HO_ACTION_SUBMITTED)     → Verify & Close / Reopen
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';

import { getTicketDetail, actOnTicket } from './ServiceTicketAPI';
import {
  C,
  statusMeta,
  categoryLabel,
  PRIORITY_META,
  SLA_STATE_META,
  availableAction,
  fmtDateTime,
  fmtDuration,
} from './ServiceTicketConstants';

const ACTION_LABELS = {
  CLUSTER_APPROVED: 'the ticket will move to Head Office for action',
  CLUSTER_REJECTED: 'the request will be rejected and returned to the Partner',
  HO_ACTION_SUBMITTED: 'the action will be sent to the Partner for verification',
  CLOSED: 'the ticket will be closed',
  REOPENED: 'the ticket will be sent back to Head Office',
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value ?? '—'}</Text>
  </View>
);

const TimelineItem = ({ item, isLast }) => {
  const sm = statusMeta(item.toStatus);
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlLeft}>
        <View style={[styles.tlDot, { backgroundColor: sm.color }]} />
        {!isLast && <View style={styles.tlLine} />}
      </View>
      <View style={styles.tlBody}>
        <Text style={styles.tlAction}>{item.action.replace(/_/g, ' ')}</Text>
        <Text style={styles.tlMeta}>
          {item.by?.role || '—'}
          {item.by?.name ? ` · ${item.by.name}` : ''} · {fmtDateTime(item.at)}
        </Text>
        {item.remark ? <Text style={styles.tlRemark}>“{item.remark}”</Text> : null}
        <View style={styles.tlTags}>
          {item.durationSeconds != null && (
            <Text style={styles.tlTag}>took {fmtDuration(item.durationSeconds)}</Text>
          )}
          {item.slaBreached ? (
            <Text style={[styles.tlTag, { color: C.error }]}>SLA breached</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const ServiceTicketDetail = ({ route, navigation }) => {
  const { ticketId } = route.params || {};
  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobile, setMobile] = useState(null);

  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await AsyncStorage.getItem('mobile');
      setMobile(m);
      const res = await getTicketDetail(ticketId);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const perform = async (action, requireRemark) => {
    if (requireRemark && !remark.trim()) {
      return Alert.alert('Remark required', 'Please add a note before continuing.');
    }
    Alert.alert('Confirm', `On confirming, ${ACTION_LABELS[action]}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setBusy(true);
          try {
            await actOnTicket(ticketId, action, remark.trim(), role, subRole);
            setRemark('');
            await load();
          } catch (e) {
            Alert.alert('Action failed', e.message || 'Something went wrong.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Icon name="error-outline" size={40} color={C.error} />
          <Text style={styles.errTxt}>{error || 'Ticket not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const t = data.ticket;
  const sm = statusMeta(t.status);
  const pm = PRIORITY_META[t.priority] || { color: C.textMed };
  const sla = SLA_STATE_META[t.slaState] || SLA_STATE_META.NA;
  const act = availableAction(t, role, subRole, mobile);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image source={require('../../../assets/back.png')} style={styles.back} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.ticketNo}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {/* Status banner */}
        <View style={[styles.banner, { backgroundColor: sm.color + '15', borderColor: sm.color + '55' }]}>
          <Icon name="flag" size={18} color={sm.color} />
          <Text style={[styles.bannerTxt, { color: sm.color }]}>{sm.label}</Text>
          {t.slaState && t.slaState !== 'NA' ? (
            <View style={[styles.slaPill, { backgroundColor: sla.color }]}>
              <Text style={styles.slaPillTxt}>{sla.label}</Text>
            </View>
          ) : null}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.title}</Text>
          {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
          <View style={styles.divider} />
          <Row label="Branch" value={t.branch} />
          <Row label="Category" value={categoryLabel(t.categoryCode)} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Priority</Text>
            <Text style={[styles.rowValue, { color: pm.color, fontWeight: '700' }]}>
              {t.priority} · SLA {t.slaHours}h
            </Text>
          </View>
          <Row label="Raised by" value={t.raisedBy?.name || t.raisedBy?.mobile} />
          <Row label="Raised on" value={fmtDateTime(t.createdAt)} />
          {t.status !== 'CLOSED' && t.status !== 'REJECTED' && (
            <Row label="Stage due" value={fmtDateTime(t.stageDueAt)} />
          )}
        </View>

        {/* TAT summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Turn-around time</Text>
          <View style={styles.tatRow}>
            <View style={styles.tatCell}>
              <Text style={styles.tatVal}>{data.tat.overallHours}h</Text>
              <Text style={styles.tatLabel}>{data.tat.isClosed ? 'Total (closed)' : 'Elapsed'}</Text>
            </View>
            <View style={styles.tatCell}>
              <Text style={styles.tatVal}>{data.timeline.length}</Text>
              <Text style={styles.tatLabel}>Stages</Text>
            </View>
            <View style={styles.tatCell}>
              <Text style={[styles.tatVal, { color: data.tat.slaBreaches ? C.error : C.success }]}>
                {data.tat.slaBreaches}
              </Text>
              <Text style={styles.tatLabel}>SLA breaches</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Processing log</Text>
          <View style={{ marginTop: 6 }}>
            {data.timeline.map((item, i) => (
              <TimelineItem
                key={i}
                item={item}
                isLast={i === data.timeline.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Action panel */}
        {act && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your action</Text>

            <TextInput
              style={styles.remark}
              value={remark}
              onChangeText={setRemark}
              placeholder={
                act.action === 'HO_ACTION_SUBMITTED'
                  ? 'Describe the action taken…'
                  : 'Add a remark (optional for approval)…'
              }
              placeholderTextColor={C.textLight}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.actionRow}>
              {/* Cluster Head */}
              {act.approve && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.success }]}
                  disabled={busy}
                  onPress={() => perform(act.approve, false)}
                >
                  <Icon name="check-circle" size={18} color="#fff" />
                  <Text style={styles.actionBtnTxt}>Approve</Text>
                </TouchableOpacity>
              )}
              {act.reject && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.error }]}
                  disabled={busy}
                  onPress={() => perform(act.reject, true)}
                >
                  <Icon name="cancel" size={18} color="#fff" />
                  <Text style={styles.actionBtnTxt}>Reject</Text>
                </TouchableOpacity>
              )}

              {/* HO User */}
              {act.action === 'HO_ACTION_SUBMITTED' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.purple }]}
                  disabled={busy}
                  onPress={() => perform('HO_ACTION_SUBMITTED', true)}
                >
                  <Icon name="build" size={18} color="#fff" />
                  <Text style={styles.actionBtnTxt}>Submit Action</Text>
                </TouchableOpacity>
              )}

              {/* Partner */}
              {act.close && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.success }]}
                  disabled={busy}
                  onPress={() => perform(act.close, false)}
                >
                  <Icon name="task-alt" size={18} color="#fff" />
                  <Text style={styles.actionBtnTxt}>Verify & Close</Text>
                </TouchableOpacity>
              )}
              {act.reopen && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.warning }]}
                  disabled={busy}
                  onPress={() => perform(act.reopen, true)}
                >
                  <Icon name="replay" size={18} color="#fff" />
                  <Text style={styles.actionBtnTxt}>Reopen</Text>
                </TouchableOpacity>
              )}
            </View>

            {busy && <ActivityIndicator style={{ marginTop: 12 }} color={C.primary} />}
          </View>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.textDark, letterSpacing: 0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errTxt: { color: C.error, marginTop: 10, textAlign: 'center' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bannerTxt: { fontWeight: '700', marginLeft: 8, flex: 1 },
  slaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  slaPillTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.textDark },
  desc: { fontSize: 14, color: C.textMed, marginTop: 6, lineHeight: 20 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: C.textMed },
  rowValue: { fontSize: 13, color: C.textDark, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textMed, textTransform: 'uppercase', letterSpacing: 0.4 },

  tatRow: { flexDirection: 'row', marginTop: 12 },
  tatCell: { flex: 1, alignItems: 'center' },
  tatVal: { fontSize: 20, fontWeight: '800', color: C.textDark },
  tatLabel: { fontSize: 11, color: C.textMed, marginTop: 2 },

  tlRow: { flexDirection: 'row' },
  tlLeft: { width: 24, alignItems: 'center' },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  tlLine: { width: 2, flex: 1, backgroundColor: C.border, marginTop: 2 },
  tlBody: { flex: 1, paddingBottom: 16, paddingLeft: 4 },
  tlAction: { fontSize: 14, fontWeight: '700', color: C.textDark, textTransform: 'capitalize' },
  tlMeta: { fontSize: 12, color: C.textMed, marginTop: 2 },
  tlRemark: { fontSize: 13, color: C.textDark, marginTop: 4, fontStyle: 'italic' },
  tlTags: { flexDirection: 'row', marginTop: 4 },
  tlTag: { fontSize: 11, color: C.textMed, marginRight: 12, fontWeight: '600' },

  remark: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 76,
    fontSize: 14,
    color: C.textDark,
    marginTop: 10,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 10,
    marginBottom: 8,
    flexGrow: 1,
  },
  actionBtnTxt: { color: '#fff', fontWeight: '700', marginLeft: 6 },
});

export default ServiceTicketDetail;
