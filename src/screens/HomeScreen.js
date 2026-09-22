/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/HomeScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// The redesigned home. Ported from hhc-hms-ui-revision-2.html's homeHTML().
//
// It renders from the payload and sections.config.js — there is no hardcoded
// list of departments here, which is what makes adding one a config line.
//
// AdminHome is NOT touched. Both homes exist during the transition; login
// chooses between them (see the flag note in App.tsx). Deleting AdminHome is
// the last task of the rollout, not the first.
//
// NOT RENDERED, deliberately — no data source exists:
//   the rail sub-notes ("31 beds in use", "8 awaiting check-in")
//   any "+12% vs yesterday" delta
// See the plan, §4.1. A card that looks computed but isn't is worse than no card.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import AppDrawer from '../common/AppDrawer';
import VoiceAssistant from '../admin/VoiceAssistant';
import {
  fetchHome,
  selectApprovals,
  selectCalls,
  selectCollection,
  selectToday,
  selectTileStat,
  selectLeadsFunnel,
} from '../api/overview';
import { visibleSections } from '../config/sections.config';
import {
  Block,
  Eyebrow,
  Legend,
  Rail,
  SectionHead,
  Segmented,
  StackBar,
  Tile,
} from '../design/components/primitives';
import { Card } from '../design/components/primitives';
import { F, HUE, T, dec1, num } from '../design/tokens';
import { HomeHeader } from '../design/components/HomeHeader';
import TabBar from '../design/components/TabBar';
import { LeadsFunnel } from '../design/components/blocks';

const HomeScreen = ({ navigation }) => {
  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);
  const location = useSelector(s => s.location.value);
  const scope = useSelector(s => s.scope);

  const user = { role, subRole };
  const sections = visibleSections(user);

  const [data, setData] = useState({ dashboard: null, collection: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [callTab, setCallTab] = useState('ivr');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await fetchHome(location, scope.from, scope.to);
        setData(res);
        // Only surface an error when BOTH halves failed. One failing half
        // renders its own inline state; blanking the screen for a missing
        // collection bar would be a worse outcome than showing the counts.
        if (res.dashboardError && res.collectionError) {
          setError(res.dashboardError);
        }
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

  // Back on the home screen exits, matching AdminHome / DoctorHome today.
  // useFocusEffect, not useEffect: this screen stays mounted under the section
  // screens, and a plain effect would keep the listener live there — where
  // exitApp() would quit instead of returning here.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (menuOpen) {
          setMenuOpen(false);
          return true;
        }
        BackHandler.exitApp();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [menuOpen]),
  );

  const approvals = selectApprovals(data);
  const today = selectToday(data);
  const collection = selectCollection(data);
  const calls = selectCalls(data);
  const k = calls[callTab];

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openSection = id =>
    navigation.navigate('Section', { id, from: scope.from, to: scope.to });

  const leads = selectLeadsFunnel(data.leads);

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }} // was 28
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={T.brand}
          />
        }
      >
        <HomeHeader
          onMenu={() => setMenuOpen(true)}
          approvals={approvals}
          navigation={navigation}
          onApprovals={
            role === 'SuperAdmin'
              ? () => navigation.navigate('ApprovalStatus')
              : null
          }
        />

        <View style={st.body}>
          {loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
            </View>
          ) : null}

          {!!error && !loading && (
            <View style={st.errorBox}>
              <Text style={st.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => load()}>
                <Text style={st.retry}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Today at a glance */}
          {today.length > 0 && (
            <Block>
              <SectionHead label="Today at a glance" />
              <Rail
                cells={today}
                onPressCell={c =>
                  navigation.navigate(c.route, {
                    location,
                    fromDate: scope.from,
                    toDate: scope.to,
                  })
                }
              />
            </Block>
          )}

          {/* Collection */}
          {collection ? (
            <Block>
              <SectionHead
                label="Billing"
                action="View report"
                onAction={() =>
                  navigation.navigate('AdminOPDIPDPayment', {
                    fromDate: scope.from,
                    toDate: scope.to,
                  })
                }
              />
              <Card>
                <StackBar
                  segments={collection.rows.map(r => ({
                    ...r,
                    color: HUE[r.key] || T.callbackGrey,
                  }))}
                />
                <Legend
                  rows={collection.rows.map(r => ({
                    ...r,
                    color: HUE[r.key] || T.callbackGrey,
                  }))}
                  total={collection.total}
                  totalLabel="Total billed"
                />
              </Card>
            </Block>
          ) : data.collectionError ? (
            <Block>
              <SectionHead label="Billing" />
              <Card>
                <Text style={st.inlineMiss}>
                  Billing figures are unavailable right now.
                </Text>
              </Card>
            </Block>
          ) : null}

          {/* Calls */}
          {leads && (
            <Block>
              <SectionHead
                label="Leads"
                action="All leads"
                onAction={() => navigation.navigate('Section', { id: 'leads' })}
              />
              <LeadsFunnel
                rows={leads.rows}
                foot={leads.foot}
                note={leads.note}
                hue={HUE.leads}
                onPressRow={r =>
                  navigation.navigate(r.route, {
                    location,
                    fromDate: scope.from,
                    toDate: scope.to,
                    status: '',
                    ...(r.params || {}),
                  })
                }
              />
            </Block>
          )}

          {/* Departments */}
          <Block style={{ marginBottom: 8 }}>
            <SectionHead label="Departments" />
            <View style={st.grid}>
              {sections.map(s => (
                <Tile
                  key={s.id}
                  code={s.code}
                  name={s.name}
                  icon={s.icon}
                  hue={HUE[s.id]}
                  stat={selectTileStat(s.id, data)}
                  onPress={() => openSection(s.id)}
                />
              ))}
              {/* An odd count leaves a hole in a 2-column grid; a spacer keeps
                  the last real tile at half width instead of stretching it. */}
              {sections.length % 2 === 1 && <View style={{ flex: 1 }} />}
            </View>
          </Block>
        </View>
      </ScrollView>

      <VoiceAssistant data={data.dashboard} />
      <TabBar navigation={navigation} active="home" />

      <AppDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        active="performance"
      />
    </SafeAreaView>
  );
};

const pctOf = (part, total) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const Chip = ({ color, label, value }) => (
  <View style={st.chip}>
    <View style={[st.chipDot, { backgroundColor: color }]} />
    <Text style={st.chipLabel}>{label}</Text>
    <Text style={st.chipVal}>{num(value)}</Text>
  </View>
);

export default HomeScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  body: { paddingHorizontal: 16, paddingTop: 18 },
  centre: { paddingVertical: 40, alignItems: 'center' },

  errorBox: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },
  errorText: { fontFamily: F.regular, fontSize: 13, color: T.text },
  retry: { fontFamily: F.semibold, fontSize: 13, color: T.brand, marginTop: 8 },
  inlineMiss: { fontFamily: F.regular, fontSize: 12.5, color: T.muted },

  callTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 13,
  },
  callBig: {
    fontFamily: F.mono,
    fontSize: 30,
    color: T.text,
    letterSpacing: -0.8,
  },
  callLbl: {
    fontSize: 11,
    color: T.muted,
    paddingBottom: 4,
    fontFamily: F.regular,
  },

  chips: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipDot: { width: 7, height: 7, borderRadius: 2 },
  chipLabel: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  chipVal: { fontFamily: F.mono, fontSize: 12, color: T.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
});
