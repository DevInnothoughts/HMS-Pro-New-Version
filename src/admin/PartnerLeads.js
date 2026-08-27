/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/* eslint-disable react/react-in-jsx-scope */
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

/**
 * PartnerLeads
 * ---------------------------------------------------------------------------
 * One page for both partner lead tables (sulekha_leads + hexa_leads). Same
 * structure as WebLeads: expandable header with filter cards, colour-coded
 * lead list, 10-per-page pagination.
 *
 * Differentiator: every row carries `source` from the API and renders a
 * coloured SULEKHA / HEXA badge, plus a source toggle that stacks with the
 * existing status filters.
 *
 * Note on Hexa: hexa_leads has no `status` column, so those rows arrive with
 * status = null and sit in "Un-Attended" until one is added. Their Appointment
 * / Visited / IPD state is derived from the clinic DB instead, so those three
 * filters do work for Hexa.
 * ---------------------------------------------------------------------------
 */

const SOURCE_STYLES = {
  Sulekha: { bg: '#6C4AB6', label: 'SULEKHA' },
  Hexa: { bg: '#0d7592', label: 'HEXA' },
};

const SOURCE_TABS = ['All', 'Sulekha', 'Hexa'];

const PartnerLeads = ({ navigation }) => {
  const route = useRoute();
  const { fromDate, toDate } = route.params || {};
  const location = useSelector(state => state.location.value);

  const [mockLeads, setMockLeads] = useState([]);
  const [leadStats, setLeadStats] = useState({
    totalLeads: 0,
    appointmentCount: 0,
    actualVisitCount: 0,
    ipdCount: 0,
    sourceCounts: { sulekha: 0, hexa: 0 },
    leads: [],
  });

  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [billType, setBillType] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const itemsPerPage = 10;

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  /* ── fetch ──────────────────────────────────────────────────────────── */

  const fetchLeadList = useCallback(
    loc => {
      setLoading(true);
      const requestOptions = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
      };

      fetch(
        `${BACKEND_URL}/leadManagement/partnerLeads?location=${loc}&from=${fromDate}&to=${toDate}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          const rows = res.leads || [];
          setMockLeads(rows);
          setLeadStats({
            totalLeads: res.totalLeads || 0,
            appointmentCount: res.appointmentCount || 0,
            actualVisitCount: res.actualVisitCount || 0,
            ipdCount: res.ipdCount || 0,
            sourceCounts: res.sourceCounts || { sulekha: 0, hexa: 0 },
            leads: rows,
          });
        })
        .catch(err => console.log('Partner leads error: ', err))
        .finally(() => setLoading(false));
    },
    [fromDate, toDate],
  );

  useFocusEffect(
    useCallback(() => {
      fetchLeadList(location);
    }, [location, fetchLeadList]),
  );

  /* ── derived data ───────────────────────────────────────────────────── */

  const statusCounts = useMemo(() => {
    const rows = mockLeads || [];
    return {
      enquiry: rows.filter(item => item.status === 'Enquiry').length,
      unattended: rows.filter(item => !item.status).length,
    };
  }, [mockLeads]);

  // Source, status and search stack rather than replace each other, so
  // "Hexa + Un-Attended" is one tap away instead of needing a new chip.
  const filteredRecords = useMemo(() => {
    let rows = mockLeads || [];

    if (sourceFilter !== 'All') {
      rows = rows.filter(item => item.source === sourceFilter);
    }

    switch (billType) {
      case 'Appointment':
        rows = rows.filter(
          item => item.status === 'Appointment' || item.visited,
        );
        break;
      case 'Visited':
        rows = rows.filter(item => item.visited);
        break;
      case 'IPD':
        rows = rows.filter(item => item.ipd);
        break;
      case 'Enquiry':
        rows = rows.filter(item => item.status === 'Enquiry');
        break;
      case 'Unattended':
        rows = rows.filter(item => !item.status);
        break;
      default:
        break;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        item =>
          String(item.name || '')
            .toLowerCase()
            .includes(q) || String(item.phoneno || '').includes(q),
      );
    }

    return rows;
  }, [mockLeads, sourceFilter, billType, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / itemsPerPage),
  );

  const paginatedLeads = useMemo(
    () =>
      filteredRecords.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    [filteredRecords, currentPage],
  );

  // Any filter change can shorten the list past the current page.
  useEffect(() => {
    setCurrentPage(1);
  }, [billType, sourceFilter, searchQuery]);

  /* ── handlers ───────────────────────────────────────────────────────── */

  const handleBillTypeSelect = type => {
    setBillType(type);
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const toggleExpandLead = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLeadId(expandedLeadId === id ? null : id);
  };

  const callNumber = phone => {
    if (!phone) return;
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  };

  const cardColor = item => {
    if (item.status === 'Appointment' || item.visited) return '#66BB6A';
    if (item.status === 'Enquiry') return '#FFB300';
    return '#fff';
  };

  const fmtDate = value => {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
  };

  /* ── render ─────────────────────────────────────────────────────────── */

  const SourceBadge = ({ source }) => {
    const cfg = SOURCE_STYLES[source] || { bg: '#777', label: 'OTHER' };
    return (
      <View style={{ ...styles.badge, backgroundColor: cfg.bg }}>
        <Text style={styles.badgeText}>{cfg.label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={{ flex: 1, width: '100%' }}>
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Image
              style={{ height: 35, width: 35, tintColor: '#184D67' }}
              source={require('../../assets/back.png')}
            />
          </TouchableOpacity>

          <Card style={styles.cardTotal}>
            <TouchableOpacity
              style={{
                minWidth: 160,
                flexDirection: 'row',
                paddingHorizontal: 5,
                alignItems: 'center',
              }}
              onPress={toggleExpand}
              activeOpacity={0.9}
            >
              <View style={{ minWidth: 130, flexDirection: 'column' }}>
                <Text style={styles.header}>
                  Partner Leads : {leadStats.totalLeads}
                </Text>
                <Text style={{ ...styles.cell, textAlign: 'center' }}>
                  {fmtDate(fromDate)} - {fmtDate(toDate)}
                </Text>
              </View>
              <View
                style={{
                  width: 30,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Image
                  style={{ width: 26, height: 26, objectFit: 'contain' }}
                  source={
                    isExpanded
                      ? require('../../assets/up-arrow.png')
                      : require('../../assets/down-arrow.png')
                  }
                />
              </View>
            </TouchableOpacity>
          </Card>

          <View style={{ display: 'flex', flexDirection: 'column' }}>
            <View style={styles.legendRow}>
              <View style={{ ...styles.legendDot, backgroundColor: '#fff' }} />
              <Text style={styles.cell}> : Un-Attended</Text>
            </View>
            <View style={styles.legendRow}>
              <View
                style={{ ...styles.legendDot, backgroundColor: '#66BB6A' }}
              />
              <Text style={styles.cell}> : Appointment</Text>
            </View>
            <View style={styles.legendRow}>
              <View
                style={{ ...styles.legendDot, backgroundColor: '#FFB300' }}
              />
              <Text style={styles.cell}> : Enquiry</Text>
            </View>
          </View>
        </View>

        {/* ── Source tabs (the differentiator) ── */}
        <View style={styles.sourceTabRow}>
          {SOURCE_TABS.map(tab => {
            const active = sourceFilter === tab;
            const count =
              tab === 'All'
                ? leadStats.totalLeads
                : tab === 'Sulekha'
                ? leadStats.sourceCounts.sulekha
                : leadStats.sourceCounts.hexa;

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setSourceFilter(tab)}
                activeOpacity={0.7}
                style={{
                  ...styles.sourceTab,
                  backgroundColor: active
                    ? SOURCE_STYLES[tab]?.bg || '#184D67'
                    : '#eef2f5',
                }}
              >
                <Text
                  style={{
                    ...styles.sourceTabText,
                    color: active ? '#fff' : '#333',
                  }}
                >
                  {tab} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Filter cards ── */}
        {isExpanded && (
          <View>
            <View style={styles.headerSubContainer}>
              <TouchableOpacity
                onPress={() => handleBillTypeSelect('Appointment')}
                activeOpacity={0.7}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor:
                      billType === 'Appointment' ? '#edc6a8ff' : '#FFF3F0FF',
                  }}
                >
                  <Text style={styles.subHeader}>Appointments</Text>
                  <Text style={styles.subHeader}>
                    {leadStats.appointmentCount}
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBillTypeSelect('Visited')}
                activeOpacity={0.7}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor:
                      billType === 'Visited' ? '#edc6a8ff' : '#FFF3F0FF',
                  }}
                >
                  <Text style={styles.subHeader}>Visited</Text>
                  <Text style={styles.subHeader}>
                    {leadStats.actualVisitCount}
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBillTypeSelect('IPD')}
                activeOpacity={0.7}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor:
                      billType === 'IPD' ? '#edc6a8ff' : '#FFF3F0FF',
                  }}
                >
                  <Text style={styles.subHeader}>IPD Conversion</Text>
                  <Text style={styles.subHeader}>{leadStats.ipdCount}</Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBillTypeSelect('Enquiry')}
                activeOpacity={0.7}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor:
                      billType === 'Enquiry' ? '#edc6a8ff' : '#FFF3F0FF',
                  }}
                >
                  <Text style={styles.subHeader}>Enquiry</Text>
                  <Text style={styles.subHeader}>{statusCounts.enquiry}</Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBillTypeSelect('Unattended')}
                activeOpacity={0.7}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor:
                      billType === 'Unattended' ? '#edc6a8ff' : '#FFF3F0FF',
                  }}
                >
                  <Text style={styles.subHeader}>Un-Attended</Text>
                  <Text style={styles.subHeader}>
                    {statusCounts.unattended}
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBillTypeSelect('')}
                activeOpacity={0.7}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor: '#fff',
                    borderLeftWidth: 0.5,
                    borderWidth: 0.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={styles.subHeader}>Clear Filter</Text>
                </Card>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Search ── */}
        <View style={{ marginHorizontal: 8, marginVertical: 6 }}>
          <TextInput
            mode="outlined"
            placeholder="Search by name or mobile"
            value={searchQuery}
            onFocus={() => setIsExpanded(false)}
            onChangeText={setSearchQuery}
            style={{
              height: 46,
              fontFamily: 'Lexend-Regular',
              color: '#000',
            }}
            left={<TextInput.Icon icon="magnify" />}
          />
        </View>

        {/* ── List ── */}
        <ScrollView style={{ flex: 1, height: '70%', width: '100%' }}>
          <Portal>
            <Dialog
              visible={loading}
              onDismiss={() => setLoading(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 20,
              }}
            >
              <Dialog.Content>
                <Text variant="bodyMedium">Loading...</Text>
              </Dialog.Content>
              <ActivityIndicator
                animating={loading}
                size={'large'}
                color={'#01458e'}
              />
            </Dialog>
          </Portal>

          {paginatedLeads.length > 0 ? (
            paginatedLeads.map(item => {
              const isOpen = expandedLeadId === item.lead_key;

              return (
                <Card
                  key={item.lead_key}
                  style={{
                    backgroundColor: cardColor(item),
                    marginVertical: 6,
                    marginHorizontal: 5,
                    borderRadius: 4,
                    borderWidth: 0.5,
                    borderColor: '#ccc',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => toggleExpandLead(item.lead_key)}
                    activeOpacity={0.9}
                    style={{
                      width: '100%',
                      minHeight: 46,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                    }}
                  >
                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <SourceBadge source={item.source} />
                        <Text style={styles.medium}>
                          {item.name || 'Unknown'}
                        </Text>
                      </View>
                      <Text style={styles.cell}>
                        {item.phoneno || '-'}
                        {item.city ? ` · ${item.city}` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => callNumber(item.phoneno)}
                      style={{ paddingHorizontal: 8 }}
                    >
                      <Image
                        style={{ width: 22, height: 22, tintColor: '#184D67' }}
                        source={require('../../assets/call.png')}
                      />
                    </TouchableOpacity>

                    <View style={{ width: 32, alignItems: 'center' }}>
                      <Image
                        style={{ width: 24, height: 24, objectFit: 'contain' }}
                        source={
                          isOpen
                            ? require('../../assets/up-arrow.png')
                            : require('../../assets/down-arrow.png')
                        }
                      />
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.detailBox}>
                      <Text style={styles.cell}>
                        Received : {fmtDate(item.date)}
                      </Text>
                      <Text style={styles.cell}>
                        Status : {item.status || 'Un-Attended'}
                      </Text>
                      {item.email ? (
                        <Text style={styles.cell}>Email : {item.email}</Text>
                      ) : null}

                      {/* Hexa-only fields — absent on Sulekha rows. */}
                      {item.department ? (
                        <Text style={styles.cell}>
                          Department : {item.department}
                        </Text>
                      ) : null}
                      {item.procedure_name ? (
                        <Text style={styles.cell}>
                          Procedure : {item.procedure_name}
                        </Text>
                      ) : null}
                      {item.medical_condition ? (
                        <Text style={styles.cell}>
                          Condition : {item.medical_condition}
                        </Text>
                      ) : null}
                      {item.gender ? (
                        <Text style={styles.cell}>Gender : {item.gender}</Text>
                      ) : null}

                      {item.note ? (
                        <Text style={styles.cell}>Note : {item.note}</Text>
                      ) : null}

                      <View style={{ flexDirection: 'row', marginTop: 4 }}>
                        {item.visited && (
                          <Text style={styles.tag}>Visited</Text>
                        )}
                        {item.ipd && <Text style={styles.tag}>IPD</Text>}
                      </View>
                    </View>
                  )}
                </Card>
              );
            })
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                height: 200,
                width: '100%',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Lexend-Bold',
                  fontSize: 18,
                  color: '#000',
                }}
              >
                Data not available!
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Pagination ── */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <Button
            mode="outlined"
            style={{ width: 100 }}
            textColor="#0d7592"
            disabled={currentPage === 1}
            onPress={() => setCurrentPage(prev => prev - 1)}
          >
            Prev
          </Button>
          <Text
            style={{ marginHorizontal: 10 }}
          >{`${currentPage} / ${totalPages}`}</Text>
          <Button
            mode="outlined"
            style={{ width: 100 }}
            textColor="#0d7592"
            disabled={currentPage >= totalPages}
            onPress={() => setCurrentPage(prev => prev + 1)}
          >
            Next
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default PartnerLeads;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 8,
  },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubContainer: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 5,
  },
  cardTotal: {
    minWidth: 160,
    height: 60,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginVertical: 5,
    borderRadius: 4,
  },
  card: {
    minWidth: '28%',
    height: 80,
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
    marginVertical: 5,
  },
  legendRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderRadius: 3,
    borderColor: '#000',
  },
  sourceTabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 6,
  },
  sourceTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    borderRadius: 16,
  },
  sourceTabText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Lexend-Medium',
    letterSpacing: 0.5,
  },
  detailBox: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tag: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#184D67',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
    overflow: 'hidden',
  },
  header: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  subHeader: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#000',
  },
  cell: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: '#000',
  },
  medium: {
    fontFamily: 'Lexend-Medium',
    fontSize: 13,
    color: '#000',
  },
});
