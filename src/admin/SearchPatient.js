/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  LayoutAnimation,
} from 'react-native';

import {
  Card,
  Text,
  Button,
  Avatar,
  Divider,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

/* -------------------------------------------------------------------------- */
/*  Theme                                                                     */
/* -------------------------------------------------------------------------- */
const COLORS = {
  primary: '#184D67',
  primaryDark: '#0F3A4E',
  accent: '#379AE6',
  bg: '#F2F6F9',
  card: '#FFFFFF',
  border: '#E4EBF0',
  textPrimary: '#1B2B34',
  textSecondary: '#64798A',
  textMuted: '#9AAAB6',
  accentSoft: '#EAF4FB',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
const isNA = value => {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === 'na' || s === 'n/a' || s === 'null' || s === '0';
};

const show = (value, fallback = '—') =>
  isNA(value) ? fallback : String(value).trim();

const toTitleCase = str =>
  !str
    ? ''
    : String(str)
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

const getInitials = name => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

const formatDate = value => {
  if (isNA(value)) return '—';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */
const Stat = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */
const SearchPatient = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, setItemsPerPage] = useState(numberOfItemsPerPageList[0]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(itemsPerPage);
  const [searchBy, setSearchBy] = useState('name');
  const [searchParam, setSearchParam] = useState('');
  const [patientData, setPatientData] = useState([]);
  const [loading1, setLoading1] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [searched, setSearched] = useState(false);

  const BACKEND_URL = 'https://wedoc.in/hms';

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, patientData.length));
  }, [page, itemsPerPage, patientData.length]);

  const handleNextPage = () => {
    if ((page + 1) * itemsPerPage < patientData.length) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const fetchPatientData = async loc => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/Patient?location=${loc}&${searchBy}=${encodeURIComponent(
          searchParam,
        )}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const res = await response.json();
      setPatientData(Array.isArray(res) ? res : []);
      setPage(0);
      setExpandedPatientId(null);
    } catch (error) {
      console.log('Error fetching patient data: ', error);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const fetchPatient = async () => {
    setLoading1(true);
    try {
      await fetchPatientData(location);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading1(false);
    }
  };

  const handleClick = async () => {
    if (!searchParam.trim()) return;
    await fetchPatient();
  };

  const hadlePatientClick = patient => {
    navigation.navigate('PatientDetails', { patient });
  };

  const toggleExpandPatient = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };

  const totalPages = Math.max(1, Math.ceil(patientData.length / itemsPerPage));
  const currentPage = page + 1;

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      {/* ---- Header ---- */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Image
            style={styles.backIcon}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Patient</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ---- Search card ---- */}
      <View style={styles.searchCard}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              searchBy === 'name' && styles.segmentBtnActive,
            ]}
            onPress={() => setSearchBy('name')}
          >
            <Text
              style={[
                styles.segmentText,
                searchBy === 'name' && styles.segmentTextActive,
              ]}
            >
              By Name
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              searchBy === 'mobile' && styles.segmentBtnActive,
            ]}
            onPress={() => setSearchBy('mobile')}
          >
            <Text
              style={[
                styles.segmentText,
                searchBy === 'mobile' && styles.segmentTextActive,
              ]}
            >
              By Mobile
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder={
              searchBy === 'name' ? 'Enter patient name' : 'Enter mobile number'
            }
            placeholderTextColor={COLORS.textMuted}
            keyboardType={searchBy === 'mobile' ? 'phone-pad' : 'default'}
            onChangeText={setSearchParam}
            value={searchParam}
            returnKeyType="search"
            onSubmitEditing={handleClick}
          />
          <TouchableOpacity
            onPress={handleClick}
            disabled={loading1}
            style={[
              styles.searchBtn,
              (!searchParam.trim() || loading1) && styles.searchBtnDisabled,
            ]}
          >
            {loading1 ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Result count ---- */}
      {patientData.length > 0 && (
        <View style={styles.resultBar}>
          <Text style={styles.resultText}>
            {patientData.length} result{patientData.length > 1 ? 's' : ''} found
          </Text>
        </View>
      )}

      {/* ---- Results list ---- */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {patientData.length > 0
          ? patientData.slice(from, to).map((item, index) => {
              const expanded = expandedPatientId === item.patient_id;
              return (
                <Card
                  key={index}
                  style={[
                    styles.resultCard,
                    expanded && styles.resultCardActive,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpandPatient(item.patient_id)}
                    style={styles.resultRow}
                  >
                    <Avatar.Text
                      size={42}
                      label={getInitials(item.name)}
                      style={styles.avatar}
                      labelStyle={styles.avatarLabel}
                      color="#fff"
                    />
                    <View style={styles.resultInfo}>
                      <Text style={styles.patientName} numberOfLines={1}>
                        {toTitleCase(item.name)}
                      </Text>
                      <Text style={styles.patientUid} numberOfLines={1}>
                        {show(item.Uid_no, 'UID: NA')}
                      </Text>
                    </View>

                    <View
                      style={[styles.chevron, expanded && styles.chevronUp]}
                    />

                    <TouchableOpacity
                      onPress={() => hadlePatientClick(item)}
                      style={styles.enterBtn}
                    >
                      <Image
                        style={styles.enterIcon}
                        source={require('../../assets/enter.png')}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.detailsContainer}>
                      <Divider style={styles.divider} />
                      <View style={styles.statRow}>
                        <Stat
                          label="First Visit"
                          value={formatDate(item.date)}
                        />
                        <View style={styles.statSeparator} />
                        <Stat label="Gender" value={show(item.sex)} />
                        <View style={styles.statSeparator} />
                        <Stat
                          label="Age"
                          value={isNA(item.age) ? '—' : `${item.age}`}
                        />
                      </View>
                      <View style={styles.statRow}>
                        <Stat label="Mobile-1" value={show(item.phone)} />
                        <View style={styles.statSeparator} />
                        <Stat label="Mobile-2" value={show(item.mobile_2)} />
                      </View>
                      <Button
                        mode="contained"
                        onPress={() => hadlePatientClick(item)}
                        buttonColor={COLORS.primary}
                        style={styles.viewBtn}
                        labelStyle={styles.viewBtnLabel}
                      >
                        View Full Record
                      </Button>
                    </View>
                  )}
                </Card>
              );
            })
          : !loading && (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  {searched
                    ? 'No patients found'
                    : 'Search a patient by name or mobile number'}
                </Text>
              </View>
            )}
      </ScrollView>

      {/* ---- Pagination ---- */}
      {patientData.length > itemsPerPage && (
        <View style={styles.paginationControls}>
          <Button
            mode="contained"
            onPress={handlePrevPage}
            disabled={page === 0}
            buttonColor={COLORS.primary}
            style={styles.pageBtn}
            contentStyle={styles.pageBtnContent}
          >
            <Image
              style={styles.pageIcon}
              source={require('../../assets/left.png')}
            />
          </Button>

          <Text style={styles.pageIndicator}>
            Page {currentPage} of {totalPages}
          </Text>

          <Button
            mode="contained"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= patientData.length}
            buttonColor={COLORS.primary}
            style={styles.pageBtn}
            contentStyle={styles.pageBtnContent}
          >
            <Image
              style={styles.pageIcon}
              source={require('../../assets/right.png')}
            />
          </Button>
        </View>
      )}

      {/* ---- Loading dialog ---- */}
      <Portal>
        <Dialog visible={loading} dismissable={false} style={styles.dialog}>
          <Dialog.Content style={styles.dialogContent}>
            <ActivityIndicator
              animating={loading}
              size="large"
              color={COLORS.primary}
            />
            <Text style={styles.dialogText}>Searching…</Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default SearchPatient;

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.card,
  },

  /* Header */
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 54,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    height: 26,
    width: 26,
    tintColor: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Lexend-Medium',
    fontSize: 18,
    color: COLORS.textPrimary,
  },

  /* Search card */
  searchCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Medium',
  },
  segmentTextActive: {
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Regular',
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    marginRight: 10,
  },
  searchBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    backgroundColor: '#9FB4C0',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Lexend-Medium',
  },

  /* Result bar */
  resultBar: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  resultText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Regular',
  },

  /* Scroll */
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },

  /* Result card */
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#FBFDFF',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  avatar: {
    backgroundColor: COLORS.primary,
  },
  avatarLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 15,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patientName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Medium',
    lineHeight: 21,
  },
  patientUid: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Regular',
    marginTop: 2,
  },
  chevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.textMuted,
    marginHorizontal: 10,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
    borderTopColor: COLORS.accent,
  },
  enterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterIcon: {
    height: 20,
    width: 20,
    tintColor: COLORS.primary,
  },

  /* Expanded details */
  detailsContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statSeparator: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  statValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Medium',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'Lexend-Regular',
    marginTop: 2,
  },
  viewBtn: {
    marginTop: 4,
    borderRadius: 10,
  },
  viewBtnLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
  },

  /* Empty state */
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  noDataText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontFamily: 'Lexend-Regular',
    textAlign: 'center',
  },

  /* Pagination */
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pageBtn: {
    borderRadius: 10,
    minWidth: 56,
  },
  pageBtnContent: {
    height: 40,
  },
  pageIcon: {
    width: 14,
    height: 14,
    tintColor: '#fff',
  },
  pageIndicator: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: 'Lexend-Medium',
  },

  /* Dialog */
  dialog: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
  },
  dialogContent: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  dialogText: {
    marginTop: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'Lexend-Regular',
  },
});
