/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/approval/ApprovalScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// The day's sign-off. Replaces src/admin/Approval.js (ApprovalWizard).
//
//   GET  /approval/approvalStatus?location=   → [{ user1, user2 }]
//   POST /approval                            { location, user, subRole }
//
// user1 is the Partner's mobile, user2 the Cluster Head's. Both null means
// nobody has signed off yet.
//
// ── WHY THE WIZARD IS GONE ─────────────────────────────────────────────────
// Three steps with Next/Back meant you could not see step 3 before approving
// step 1, could not go back to re-check a figure without losing your place,
// and the three tick-boxes were really ONE decision — the submit sends a single
// approval, not three.
//
// One scrollable page now, three collapsible review sections, each with its own
// tick. Approve enables when all three are ticked. Same payload, same endpoint.
//
// ⚠️ THE TICKS ARE A PROMPT, NOT A RECORD
// ───────────────────────────────────────
// The backend stores ONE approval per user. The three ticks exist so nobody
// signs without looking at all three, and they are not sent anywhere. If the
// business needs to know which parts were checked, that is a schema change.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get, post } from '../../api/client';
import SectionHeader from '../../design/components/SectionHeader';
import { F, T } from '../../design/tokens';
import CallsApprovalSection from './CallsApprovalSection';
import IpdApprovalSection from './IpdApprovalSection';
import OpdApprovalSection, { getYesterdayIST } from './OpdApprovalSection';

// Same three steps the wizard had, same order.
const SECTIONS = [
  {
    key: 'calls',
    label: 'Calls & Web Leads',
    desc: 'IVR, helpline, web and bot leads',
    icon: 'phone-in-talk',
    Component: CallsApprovalSection,
  },
  {
    key: 'opd',
    label: 'OPD Collection',
    desc: 'Visits, collection and consultation detail',
    icon: 'receipt-long',
    Component: OpdApprovalSection,
  },
  {
    key: 'ipd',
    label: 'IPD Bills & Collection',
    desc: 'Invoices raised and payments received',
    icon: 'local-hospital',
    Component: IpdApprovalSection,
  },
];

const MONTHS = [
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

const fmtDate = d => {
  const [y, m, day] = String(d).split('-');
  return m ? `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}` : String(d);
};

const ApprovalScreen = ({ navigation }) => {
  const location = useSelector(s => s.location.value);
  const subRole = useSelector(s => s.location.subRole);
  const date = getYesterdayIST();

  const [status, setStatus] = useState(null); // { user1, user2 }
  const [mobile, setMobile] = useState(null);
  const [checked, setChecked] = useState({
    calls: false,
    opd: false,
    ipd: false,
  });
  const [open, setOpen] = useState('calls');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const [res, m] = await Promise.all([
          get('/approval/approvalStatus', { location }),
          AsyncStorage.getItem('mobile'),
        ]);
        setMobile(m);
        setStatus(Array.isArray(res) && res.length ? res[0] : {});
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

  const partnerDone = !!status?.user1;
  const clusterDone = !!status?.user2;

  // Which slot this person fills. Anyone else is here to look, not to sign.
  const mySlot =
    subRole === 'Owner'
      ? 'partner'
      : subRole === 'Cluster Head'
      ? 'cluster'
      : null;

  // Signed by THIS person — not just "someone in my role has signed". Two
  // Cluster Heads share a branch at some sites, and the second still has a
  // decision to make.
  const alreadySigned =
    (mySlot === 'partner' && status?.user1 === mobile) ||
    (mySlot === 'cluster' && status?.user2 === mobile);

  const allChecked = SECTIONS.every(s => checked[s.key]);
  const canSubmit = !!mySlot && !alreadySigned && allChecked && !submitting;
  const outstanding = SECTIONS.filter(s => !checked[s.key]).length;

  const submit = () => {
    Alert.alert(
      'Approve the day',
      `You are signing off ${location} for ${fmtDate(date)} as ${
        mySlot === 'partner' ? 'Partner' : 'Cluster Head'
      }. This cannot be undone from the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await post('/approval', {
                location,
                user: mobile,
                subRole,
              });
              if (res?.success === false) {
                throw new Error(res.error || 'Something went wrong.');
              }
              // Reloaded rather than assumed — the server is the record, and a
              // local flag would lie if the write half-failed.
              await load(true);
              Alert.alert('Approved', res?.message || 'Sign-off recorded.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert('Could not approve', e.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: mySlot && !alreadySigned ? 120 : 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={T.brand}
          />
        }
      >
        <SectionHeader
          code="APPROVAL"
          name="Daily Approval"
          sub={`${location} · ${fmtDate(date)}`}
          hue={T.brand}
          hideScope
          onBack={() => navigation.goBack()}
        />

        <View style={st.body}>
          {/* Who has signed, before anything else — it is the first thing
              anyone opens this screen to find out. */}
          <View style={st.statusRow}>
            <SignOff
              label="Partner"
              done={partnerDone}
              mine={mySlot === 'partner'}
            />
            <SignOff
              label="Cluster Head"
              done={clusterDone}
              mine={mySlot === 'cluster'}
            />
          </View>

          {loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
            </View>
          ) : (
            <>
              {!!error && <Text style={st.error}>{error}</Text>}

              {alreadySigned && (
                <View style={[st.banner, st.bannerOk]}>
                  <Icon name="check-circle" size={17} color="#1E7A5A" />
                  <Text style={st.bannerText}>
                    You have already signed off {location}. The figures below
                    are read-only.
                  </Text>
                </View>
              )}

              {!mySlot && (
                <View style={[st.banner, st.bannerInfo]}>
                  <Icon name="visibility" size={17} color="#2F6FA8" />
                  <Text style={st.bannerText}>
                    Only the Partner and the Cluster Head can sign off. You can
                    review the figures here.
                  </Text>
                </View>
              )}

              <Text style={st.blockLabel}>REVIEW</Text>

              {SECTIONS.map(sec => {
                const isOpen = open === sec.key;
                const tick = checked[sec.key];
                return (
                  <View key={sec.key} style={st.section}>
                    <TouchableOpacity
                      style={st.sectionHead}
                      activeOpacity={0.8}
                      onPress={() => setOpen(isOpen ? null : sec.key)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      <View
                        style={[
                          st.sectionIcon,
                          tick && { backgroundColor: '#E7F2EC' },
                        ]}
                      >
                        <Icon
                          name={sec.icon}
                          size={17}
                          color={tick ? '#1E7A5A' : T.muted}
                        />
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.sectionName}>{sec.label}</Text>
                        <Text style={st.sectionDesc} numberOfLines={1}>
                          {sec.desc}
                        </Text>
                      </View>

                      <Icon
                        name={isOpen ? 'expand-less' : 'expand-more'}
                        size={19}
                        color={T.chevron}
                      />
                    </TouchableOpacity>

                    {/* Mounted only when open, so the three endpoints are not
                        all fetched at once on a screen where two of them are
                        hidden. */}
                    {isOpen && (
                      <View style={st.sectionBody}>
                        <sec.Component />
                      </View>
                    )}

                    {/* The tick sits OUTSIDE the collapse, so a section already
                        reviewed stays visibly ticked once closed. */}
                    <TouchableOpacity
                      style={[st.tickRow, tick && st.tickRowOn]}
                      activeOpacity={0.8}
                      disabled={alreadySigned || !mySlot}
                      onPress={() =>
                        setChecked(c => ({ ...c, [sec.key]: !c[sec.key] }))
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: tick }}
                      accessibilityLabel={`${sec.label} reviewed`}
                    >
                      <View style={[st.box, tick && st.boxOn]}>
                        {tick && <Icon name="check" size={13} color="#fff" />}
                      </View>
                      <Text style={[st.tickText, tick && st.tickTextOn]}>
                        {tick ? 'Reviewed' : 'I have reviewed these figures'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Pinned, so the action is reachable without scrolling back from the
          bottom of three reports. */}
      {!loading && mySlot && !alreadySigned && (
        <View style={st.footer}>
          <Text style={st.footerNote}>
            {allChecked
              ? `Signing off as ${
                  mySlot === 'partner' ? 'Partner' : 'Cluster Head'
                }`
              : `${outstanding} section${
                  outstanding === 1 ? '' : 's'
                } still to review`}
          </Text>
          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit}
            style={[st.submit, !canSubmit && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={17} color="#fff" />
                <Text style={st.submitText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const SignOff = ({ label, done, mine }) => (
  <View
    style={[st.signOff, mine && { borderColor: T.brand, borderWidth: 1.5 }]}
  >
    <View style={st.signTop}>
      <Icon
        name={done ? 'check-circle' : 'schedule'}
        size={15}
        color={done ? '#1E7A5A' : '#B26A00'}
      />
      <Text style={st.signLabel}>{label.toUpperCase()}</Text>
    </View>
    <Text style={[st.signState, { color: done ? '#1E7A5A' : '#B26A00' }]}>
      {done ? 'Approved' : 'Pending'}
    </Text>
    {mine && <Text style={st.signMine}>This is you</Text>}
  </View>
);

export default ApprovalScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  body: { paddingHorizontal: 16 },
  error: { fontSize: 12, color: T.crit, marginTop: 12, fontFamily: F.regular },

  statusRow: { flexDirection: 'row', gap: 9, marginTop: -30 },
  signOff: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  signTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  signState: { fontFamily: F.semibold, fontSize: 15, marginTop: 7 },
  signMine: { fontFamily: F.mono, fontSize: 8.5, color: T.brand, marginTop: 4 },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  bannerOk: { backgroundColor: '#EDF6F1', borderColor: '#CBE4D8' },
  bannerInfo: { backgroundColor: '#EDF3F9', borderColor: '#CBDCEA' },
  bannerText: {
    flex: 1,
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.regular,
    lineHeight: 17,
  },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 24,
    marginBottom: 9,
    marginHorizontal: 2,
  },

  section: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: T.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionName: { fontSize: 13.5, fontFamily: F.medium, color: T.text },
  sectionDesc: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },
  sectionBody: { borderTopWidth: 1, borderTopColor: T.lineSoft },

  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
    backgroundColor: T.subtle,
  },
  tickRowOn: { backgroundColor: '#EDF6F1' },
  box: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.card,
  },
  boxOn: { backgroundColor: '#1E7A5A', borderColor: '#1E7A5A' },
  tickText: { fontSize: 12, color: T.muted, fontFamily: F.regular },
  tickTextOn: { color: '#1E7A5A', fontFamily: F.medium },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
  },
  footerNote: {
    flex: 1,
    fontSize: 11,
    color: T.muted,
    fontFamily: F.regular,
    lineHeight: 16,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.brand,
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  submitText: { fontFamily: F.semibold, fontSize: 14, color: '#fff' },
});
