/* eslint-disable react/self-closing-comp */
/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';
import { useCallback, useState, useEffect } from 'react';
import {
  Text,
  View,
  ScrollView,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
} from 'react-native';
import { Button, MD3LightTheme, Modal, TextInput } from 'react-native-paper';

import { DataTable, Card, Dialog, Portal } from 'react-native-paper';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const DoctorOPDReportDetails = ({ navigation }) => {
  const route = useRoute();
  const { fromDate, toDate, patientType } = route.params;
  const location = useSelector(state => state.location.value);
  const [loading, setLoading] = useState(false);
  const [OPDData, setOPDData] = useState([]);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [expandedId, setExpandedId] = useState(null);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //'http://192.168.0.118:4000/ivr';

  useEffect(() => {
    getData();
  }, [getData]);

  const getData = useCallback(async () => {
    console.log(location, fromDate, toDate, patientType);
    try {
      setLoading(true);
      const number = await AsyncStorage.getItem('mobile');
      console.log(number);
      const response = await fetch(
        `${BACKEND_URL}/Dashboard/doctorOPDReport?location=${location}&from=${fromDate}&to=${toDate}&patientType=${patientType}&mobile=${number}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const res = await response.json();
      console.log('Patient details: ', res.data);
      setOPDData(res.data);
    } catch (error) {
      console.log('Error ', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, location, patientType, toDate]);

  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, OPDData.length));
  }, [OPDData.length, itemsPerPage, page]);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };
  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View
        style={{
          backgroundColor: 'transparent',
          shadowColor: 'transparent',
          flex: 1,
          width: '100%',
        }}
      >
        <View style={styles.headerContainer}>
          <View style={{ width: '15%' }}>
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
          </View>
          <Text style={styles.header}>
            {(patientType === 'new' && 'New') ||
              (patientType === 'follow' && 'Follow-Up') ||
              (patientType === 'postoperative' && 'Post-Operative') ||
              (patientType === 'proctoscopy' && 'Consultation + Proctoscopy')}
          </Text>
          <View style={{ width: '15%' }}></View>
        </View>

        <Portal>
          <Dialog
            visible={loading}
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
              color={'#0d7592'}
            />
          </Dialog>
        </Portal>
        <ScrollView
          style={{
            flex: 1,
            height: '70%',
            width: '100%',
          }}
        >
          <View
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-around',
              alignItems: 'center',
            }}
          >
            <Portal>
              <Dialog
                visible={loading}
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
                  color={'#0d7592'}
                />
              </Dialog>
            </Portal>
            {OPDData.length > 0 ? (
              OPDData.slice(from, to).map((item, index) => (
                <Card
                  key={index}
                  style={{
                    backgroundColor: '#F1FDE9FF',
                    width: '48%',
                    minHeight: 200,
                    flexDirection: 'column',
                    borderRadius: 4,
                    marginVertical: 8,
                    padding: 8,
                  }}
                >
                  <View style={styles.nameContainer}>
                    <Text style={styles.textName}>{item.patient_name}</Text>
                  </View>
                  <Text style={styles.textMob}>{item.patient_phone}</Text>

                  <Text
                    style={{
                      ...styles.textType,
                      width: '100%',
                      backgroundColor:
                        item.patient_type === 'New'
                          ? '#000000'
                          : item.patient_type === 'Follow'
                          ? '#ff8000'
                          : item.patient_type === 'Postoperative'
                          ? '#8000ff'
                          : '#ff0080',
                    }}
                  >
                    {item.patient_type}
                  </Text>
                  <View style={styles.doctorContainer}>
                    <Text style={styles.textDoctor}>{item.doctor_name}</Text>
                  </View>
                  <Text style={styles.textFDE}>FDE: {item.FDE_Name}</Text>

                  <Text style={styles.textTime}>
                    Appt. Date:{' '}
                    {new Date(item.appointment_timestamp).toLocaleDateString()}
                  </Text>
                  <Text style={styles.textTime}>
                    Appt. Time: {item.appointment_time}
                  </Text>

                  <Text style={styles.textTime}>
                    Confirm Time: {item.confirm_time}
                  </Text>

                  <View
                    style={{
                      display: 'flex',
                      width: '100%',
                      flexDirection: 'row',
                      justifyContent: 'space-around',
                      marginVertical: 10,
                    }}
                  ></View>
                </Card>
              ))
            ) : (
              <View
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',

                  height: '100%',
                  width: '100%',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Lexend-Bold',
                    fontSize: 20,
                    color: '#000',
                  }}
                >
                  Data not available!
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        {/* Pagination Controls */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginHorizontal: 10,
            marginVertical: 5,
            height: 42,
          }}
        >
          <Button
            mode="outlined"
            onPress={handlePrevPage}
            disabled={page === 0}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: page === 0 ? '#aaa' : 'transparent',
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Image
                style={{ width: 12, height: 12 }}
                source={require('../../assets/left.png')}
              />
            </View>
          </Button>

          <Button
            mode="outlined"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= OPDData.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= OPDData.length
                  ? '#aaa'
                  : 'transparent',
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Image
                style={{ width: 12, height: 12 }}
                source={require('../../assets/right.png')}
              />
            </View>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DoctorOPDReportDetails;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerContainer: {
    marginVertical: 3,
    padding: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    // backgroundColor: '#F2FFF2FF',
  },
  headerSubContainer: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    flexDirection: 'row',
    marginVertical: 5,
  },
  cardTotal: {
    minWidth: 160,
    height: 50,

    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginVertical: 5,
    borderRadius: 4,
  },
  card: {
    minWidth: '22%',
    height: 80,
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
  },
  header: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  subHeader: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#000',
  },
  modal: {
    backgroundColor: 'white',
    paddingVertical: 50,
    paddingHorizontal: 20,
    marginHorizontal: 10,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 11.78,
    marginVertical: 10,
    padding: 8,
    borderWidth: 1,
  },
  profileInput: {
    fontSize: 16,
    lineHeight: 19,
    color: '#000000',
  },
  cell: {
    fontSize: 16,
  },
  icon: { width: 35, height: 35 },
  iconConatiner: {
    width: '15%',
    backgroundColor: 'transparent',
    height: 40,
    paddingRight: 10,
    borderRadius: 18,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Lexend-Regular',
    color: '#000',
  },
  nameContainer: { width: '100%', height: 55, overflow: 'hidden' },
  textName: {
    fontSize: 12,
    lineHeight: 22,
    fontFamily: 'Lexend-Medium',
    color: '#379AE6FF',
  },
  textMob: {
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Lexend-Regular',
    color: '#323743FF',
  },
  textType: {
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Lexend-Regular',
    color: '#FFF',
    textAlign: 'center',
  },
  doctorContainer: {
    width: '100%',
    minHeight: 36,
    borderBottomWidth: 1,
    borderColor: '#aaa',

    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  textDoctor: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Lexend-Medium',
    color: '#000',
  },
  textFDE: {
    fontSize: 10,
    lineHeight: 18,
    fontFamily: 'Lexend-Regular',
    color: '#000',
  },
  textTime: {
    fontSize: 10,
    lineHeight: 18,
    fontFamily: 'Lexend-Regular',
    color: '#000',
  },
});
