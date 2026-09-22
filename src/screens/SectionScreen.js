/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/SectionScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE screen for all seven sections, driven by sections.config.js.
//
// TWO DATA PATHS
// ──────────────
// A section with `endpoint: true` calls /hms/overview/section/:id and gets its
// own metrics and display blocks. Everything else falls back to deriving
// metrics from the home payload, exactly as before.
//
// This is deliberate: sections gain their real backend one at a time, and the
// six that haven't yet must keep working unchanged in the meantime. When the
// last one lands, the fallback path and its import can go.
//
// A 501 from the section endpoint is not an error — it means the model isn't
// registered yet — so it silently drops to the fallback rather than showing
// the person a failure they can do nothing about.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import { fetchHome, selectSectionMetrics } from '../api/overview';
import { SECTION_SHAPERS, fetchSection } from '../api/sections';
import { sectionById, visiblePages } from '../config/sections.config';
import {
  Collapsible,
  DataTable,
  SplitBar,
  VisitTypeGrid,
  RankedList,
  CardGrid,
  BreakdownList,
} from '../design/components/blocks';
import {
  Card,
  Legend,
  List,
  MetricGrid,
  PageRow,
  SectionHead,
  StackBar,
} from '../design/components/primitives';
import SectionHeader from '../design/components/SectionHeader';
import TabBar from '../design/components/TabBar';
import { F, HUE, T } from '../design/tokens';

const SectionScreen = ({ navigation, route }) => {
  const id = route?.params?.id;
  const section = sectionById(id);

  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);
  const location = useSelector(s => s.location.value);
  const scope = useSelector(s => s.scope);

  const user = { role, subRole };

  const [payload, setPayload] = useState(null); // section endpoint
  const [home, setHome] = useState(null); // fallback
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const hasEndpoint = !!section?.endpoint;

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        if (hasEndpoint) {
          try {
            setPayload(await fetchSection(id, location, scope.from, scope.to));
            setHome(null);
            return;
          } catch (e) {
            // 501 = model not registered yet. Anything else is a real failure
            // and should be shown, not swallowed into a silent fallback.
            if (e.status !== 501) throw e;
          }
        }
        setPayload(null);
        setHome(await fetchHome(location, scope.from, scope.to));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hasEndpoint, id, location, scope.from, scope.to],
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        navigation.goBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [navigation]),
  );

  if (!section) {
    return (
      <SafeAreaView style={st.screen} edges={['top']}>
        <View style={st.centre}>
          <Text style={st.missing}>That section isn’t available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hue = HUE[section.id] || T.brand;
  const pages = visiblePages(section, user);

  // Shape whichever payload we got.
  let metrics = [];
  let blocks = [];
  if (payload && SECTION_SHAPERS[section.id]) {
    const shaped = SECTION_SHAPERS[section.id](payload);
    metrics = shaped.metrics;
    blocks = shaped.blocks;
  } else if (home) {
    const values = selectSectionMetrics(section.id, home);
    metrics = (section.metrics || [])
      .filter(m => values[m.key] != null)
      .map(m => ({ key: m.key, label: m.label, value: values[m.key] }));
  }

  const openPage = page =>
    navigation.navigate(page.route, {
      location,
      fromDate: scope.from,
      toDate: scope.to,
      status: '',
    });

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={hue}
          />
        }
      >
        <SectionHeader
          code={section.code}
          name={section.name}
          sub={section.sub}
          hue={hue}
          onBack={() => navigation.goBack()}
        />

        {loading && !refreshing ? (
          <View style={st.metricSpinner}>
            <ActivityIndicator color={hue} />
          </View>
        ) : metrics.length > 0 ? (
          <MetricGrid items={metrics} />
        ) : (
          // The header's −30 overlap needs something to pull up into.
          <View style={{ height: 30 }} />
        )}

        <View style={st.body}>
          {!!error && (
            <View style={st.errorBox}>
              <Text style={st.errorText}>{error}</Text>
            </View>
          )}

          {/* Display blocks — gender split, visit mix, and later the IPD
              tables and claim funnel. A block with no data is skipped. */}
          {blocks.map(b => {
            if (!b.data) return null;

            if (b.kind === 'table') {
              return (
                <View key={b.key} style={st.block}>
                  <Collapsible
                    label={b.label}
                    summary={
                      b.data.foot?.count
                        ? `${b.data.foot.count} patients`
                        : null
                    }
                    hue={hue}
                  >
                    <DataTable
                      columns={b.data.columns}
                      rows={b.data.rows}
                      foot={b.data.foot}
                      note={b.data.note}
                      hue={hue}
                    />
                  </Collapsible>
                </View>
              );
            }

            if (b.kind === 'ranked') {
              const body = (
                <RankedList
                  rows={b.data.rows}
                  foot={b.data.foot}
                  note={b.data.note}
                  hue={hue}
                />
              );
              return (
                <View key={b.key} style={st.block}>
                  {b.collapsible ? (
                    <Collapsible
                      label={b.label}
                      summary={`${b.data.rows.length} items`}
                      hue={hue}
                    >
                      {body}
                    </Collapsible>
                  ) : (
                    <>
                      <SectionHead label={b.label} />
                      {body}
                    </>
                  )}
                </View>
              );
            }

            if (b.kind === 'cards') {
              return (
                <View key={b.key} style={st.block}>
                  <SectionHead label={b.label} />
                  <CardGrid cards={b.data.cards} note={b.data.note} />
                </View>
              );
            }

            if (b.kind === 'breakdown') {
              return (
                <View key={b.key} style={st.block}>
                  <SectionHead label={b.label} />
                  <BreakdownList
                    rows={b.data.rows}
                    foot={b.data.foot}
                    note={b.data.note}
                    hue={hue}
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
                </View>
              );
            }

            return (
              <View key={b.key} style={st.block}>
                <SectionHead label={b.label} />
                <VisitTypeGrid
                  items={b.data.items}
                  note={b.data.note}
                  onPress={i =>
                    navigation.navigate('OPDReportDetails', {
                      location,
                      fromDate: scope.from,
                      toDate: scope.to,
                      patientType: i.patientType,
                    })
                  }
                />
              </View>
            );
          })}

          <SectionHead label={`${section.name} pages`} />
          <List>
            {pages.map((p, i) => (
              <PageRow
                key={p.route}
                name={p.name}
                desc={p.desc}
                icon={p.icon}
                hue={hue}
                last={i === pages.length - 1}
                onPress={() => openPage(p)}
              />
            ))}
          </List>

          {pages.length === 0 && (
            <Text style={st.none}>
              You don’t have access to any pages in this section.
            </Text>
          )}
        </View>
      </ScrollView>

      <TabBar navigation={navigation} active={null} />
    </SafeAreaView>
  );
};

export default SectionScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  body: { paddingHorizontal: 16, paddingTop: 24 },
  block: { marginBottom: 22 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  metricSpinner: { marginTop: -30, paddingVertical: 28, alignItems: 'center' },
  missing: { fontFamily: F.regular, fontSize: 14, color: T.muted },
  none: {
    fontFamily: F.regular,
    fontSize: 12.5,
    color: T.muted,
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },
  errorText: { fontFamily: F.regular, fontSize: 13, color: T.text },
});
