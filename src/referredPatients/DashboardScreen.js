import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  LayoutAnimation,
} from 'react-native';
import { Text, Card, Appbar, List, Divider } from 'react-native-paper';
import ReferredBottomTab from './BottomTab';
import { useSelector } from 'react-redux';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sampleData = [
  {
    doctorName: 'Dr. Paresh Gandhi',
    doctorPhone: '9876543210',
    patients: [
      { name: 'Sharad Pawar', disease: 'Constipation', date: '2025-11-20' },
      { name: 'Sharad Pawar', disease: 'Constipation', date: '2025-11-21' },
      { name: 'Sharad Pawar', disease: 'Gas Issue', date: '2025-11-22' },
    ],
  },
  {
    doctorName: 'Rajdeep Singh Oberoi',
    doctorPhone: '918007131306',
    patients: [{ name: 'Shubham', disease: 'Piles', date: '2025-11-20' }],
  },
  {
    doctorName: 'Dr. Veena Mergu',
    doctorPhone: '9022124335',
    patients: [
      { name: 'Anjali', disease: 'Migraine', date: '2025-11-18' },
      { name: 'Rohit', disease: 'Back Pain', date: '2025-11-19' },
    ],
  },
  {
    doctorName: 'Dr. Anil Patil',
    doctorPhone: '9898989898',
    patients: [{ name: 'Mahesh', disease: 'Acidity', date: '2025-11-21' }],
  },
  {
    doctorName: 'Dr. Paresh Gandhi',
    doctorPhone: '9876543210',
    patients: [
      { name: 'Sharad Pawar', disease: 'Constipation', date: '2025-11-20' },
      { name: 'Sharad Pawar', disease: 'Constipation', date: '2025-11-21' },
      { name: 'Sharad Pawar', disease: 'Gas Issue', date: '2025-11-22' },
    ],
  },
  {
    doctorName: 'Rajdeep Singh Oberoi',
    doctorPhone: '918007131306',
    patients: [{ name: 'Shubham', disease: 'Piles', date: '2025-11-20' }],
  },
  {
    doctorName: 'Dr. Veena Mergu',
    doctorPhone: '9022124335',
    patients: [
      { name: 'Anjali', disease: 'Migraine', date: '2025-11-18' },
      { name: 'Rohit', disease: 'Back Pain', date: '2025-11-19' },
    ],
  },
  {
    doctorName: 'Dr. Anil Patil',
    doctorPhone: '9898989898',
    patients: [{ name: 'Mahesh', disease: 'Acidity', date: '2025-11-21' }],
  },
];

const DashboardScreen = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const role = useSelector(state => state.location.role);
  const route = useRoute();
  const { fromDate, toDate } = route.params;
  console.log('Dashboard fromDate:', fromDate, 'toDate:', toDate);
  const [loading, setLoading] = useState(false);
  const [topDoctors, setTopDoctors] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTopExpanded, setIsTopExpanded] = useState(true);
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, fromDate, toDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${BACKEND_URL}/gpReferral/topDoctors?fromDate=${fromDate}&toDate=${toDate}&location=${location}&role=${role}`,
      );

      const data = await response.json();

      /**
       * EXPECTED BACKEND RESPONSE SHAPE:
       * {
       *   topDoctors: [],
       *   allDoctors: []
       * }
       */
      //console.log('Dashboard Data:', data);
      setTopDoctors(data.topDoctors || []);
      setAllDoctors(data.allDoctors || []);
    } catch (error) {
      console.error('Dashboard fetch error', error);
    } finally {
      setLoading(false);
    }
  };

  // const fetchTopDoctors = useCallback(location => {
  //   setLoading(true);

  //   const requestOptions = {
  //     method: 'GET',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     redirect: 'follow',
  //   };

  //   try {
  //     fetch(
  //       `${BACKEND_URL}/gpReferral/topDoctors?location=${location}&from=${fromDate}&to=${toDate}`,
  //       requestOptions,
  //     )
  //       .then(response => response.json())
  //       .then(res => {
  //         console.log('Top Doctors: ', res);
  //         setLoading(false);
  //         setTopDoctors(res);
  //       });
  //   } catch (error) {
  //     setLoading(false);
  //     console.log('Error ', error);
  //   }
  // }, []);

  const toggleTop = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // If expanding Top, collapse All
    if (!isTopExpanded) {
      setIsAllExpanded(false);
    }

    setIsTopExpanded(!isTopExpanded);
  };

  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // If expanding All, collapse Top
    if (!isAllExpanded) {
      setIsTopExpanded(false);
    }

    setIsAllExpanded(!isAllExpanded);
  };

  const top5 = topDoctors;

  // Function to toggle the visibility
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={{
              height: 35,
              width: 35,
              tintColor: '#184D67',
            }}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <Card style={{ backgroundColor: '#fff', flexDirection: 'column' }}>
          <Text style={styles.sectionTitle}>GP Dashboard</Text>
        </Card>

        <View style={{ display: 'flex', flexDirection: 'column' }}></View>
      </View>
      <View style={styles.container}>
        {/* <Appbar.Header>
        <Appbar.Content title="Referred Patients Dashboard" />
      </Appbar.Header> */}

        {/* TOP 5 DOCTORS */}

        <TouchableOpacity onPress={toggleTop} style={styles.expandHeader}>
          <Text style={styles.sectionTitle}>🏆 Top 5 Doctors</Text>
          <Text style={styles.expandIcon}>{isTopExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {isTopExpanded && (
          <ScrollView>
            <View style={styles.gridWrapper}>
              {top5.length > 0 &&
                top5.map((item, index) => (
                  <View key={index} style={styles.gridCard}>
                    <View style={styles.rankBadgeSmall}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>

                    <Text style={styles.avatarText}>
                      {item.doctorsName?.charAt(0) || '-'}
                    </Text>

                    <Text style={styles.doctorName}>{item.doctorsName}</Text>

                    <Text style={styles.patientCount}>
                      {item.patientCount} Patients
                    </Text>
                  </View>
                ))}
            </View>
          </ScrollView>
        )}

        {/* ALL DOCTORS WITH COUNTS */}

        <TouchableOpacity onPress={toggleAll} style={styles.expandHeader}>
          <Text style={styles.sectionTitle}>📌 All Doctors Statistics</Text>
          <Text style={styles.expandIcon}>{isAllExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {isAllExpanded && (
          <ScrollView>
            {allDoctors.length > 0 &&
              allDoctors.map(item => (
                <TouchableOpacity
                  key={item.doctorPhone}
                  onPress={() =>
                    navigation.navigate('DoctorPatients', {
                      doctorName: item.doctorName,
                      doctorPhone: item.doctorPhone,
                      patients: item.patients,
                    })
                  }
                  style={styles.card}
                >
                  <List.Item
                    title={item.doctorName}
                    description={`Total Referred: ${item.count}`}
                    left={() => <List.Icon icon="account-heart" />}
                  />
                  <Divider />
                </TouchableOpacity>
              ))}
          </ScrollView>
        )}

        {/* DOCTOR PATIENTS LIST (Selected) */}

        {selectedDoctor && (
          <Card style={styles.popup}>
            <Card.Title title={`${selectedDoctor.doctorName} - Patients`} />
            <Divider />
            {selectedDoctor.patients.map((p, idx) => (
              <View key={idx} style={styles.patientRow}>
                <Text style={styles.patientName}>{p.name}</Text>
                <Text style={styles.patientDisease}>{p.disease}</Text>
                <Text style={styles.patientDate}>{p.date}</Text>
              </View>
            ))}
            <Divider />
            <TouchableOpacity onPress={() => setSelectedDoctor(null)}>
              <Text style={styles.closeBtn}>Close</Text>
            </TouchableOpacity>
          </Card>
        )}
      </View>
      <ReferredBottomTab
        navigation={navigation}
        fromDate={fromDate}
        toDate={toDate}
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;

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
  container: { flex: 1, width: '100%', backgroundColor: '#ffffffff' },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    //backgroundColor: '#F2FFF2FF',
  },
  card: {
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    //elevation: 4,
  },
  popup: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    paddingBottom: 15,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#fff',
    elevation: 10,
  },
  patientRow: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  patientName: { fontSize: 16, fontWeight: '600' },
  patientDisease: { fontSize: 14, color: '#444' },
  patientDate: { fontSize: 13, color: '#777' },
  closeBtn: {
    textAlign: 'center',
    fontSize: 16,
    color: '#E91E63',
    fontWeight: '700',
    marginTop: 10,
  },
  topContainer: {
    flex: 1,
    paddingTop: 10,
    height: '50%',
    borderWidth: 1,
    borderColor: '#ccc',
    marginVertical: 5,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    margin: 15,
    marginBottom: 10,
    color: '#10375C',
    backgroundColor: '#ffffffff',
  },
  rankCard: {
    marginHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(5px)',
    borderRadius: 14,
    padding: 12,
    marginVertical: 6,
    //elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1.4,
    //borderColor: 'rgba(255,255,255,0.35)',
  },
  rankBadge: {
    backgroundColor: '#E91E63',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 12,
  },
  doctorInfo: {
    flex: 1,
  },
  gridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 10,
  },

  gridCard: {
    width: '48%',
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 12,
    //elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(36, 31, 31, 0.4)',
  },

  avatarCircle: {
    width: 50,
    height: 50,
    backgroundColor: '#0C7B93',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },

  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#002B5B',
    textAlign: 'center',
    marginTop: 4,
  },

  patientCount: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },

  rankBadgeSmall: {
    backgroundColor: '#E91E63',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },

  rankText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  expandIcon: {
    fontSize: 22,
    color: '#10375C',
    fontWeight: '900',
  },
});
