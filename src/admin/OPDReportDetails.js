/* eslint-disable react/self-closing-comp */
/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */

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

const OPDReportDetails = ({ navigation }) => {
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [genderwiseCount, setGenderwiseCount] = useState({
    male: 0,
    female: 0,
    other: 0,
  });
  const [filterCategory, setFilterCategory] = useState('all');
  const [filteredData, setFilteredData] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //'http://192.168.0.118:4000/ivr';

  useEffect(() => {
    getData();
  }, [getData]);

  const getData = useCallback(async () => {
    console.log(location, fromDate, toDate, patientType);
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/Dashboard/OPDReport?location=${location}&from=${fromDate}&to=${toDate}&patientType=${patientType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const res = await response.json();
      //console.log('Patient details: ', res.data);
      const patientCount = res.data.reduce(
        (acc, patient) => {
          if (patient.is_deleted === 0 && patient.gender === 'Male') {
            acc.male += 1;
          } else if (patient.is_deleted === 0 && patient.gender === 'Female') {
            acc.female += 1;
          } else if (patient.is_deleted === 0) {
            acc.other += 1;
          }
          return acc;
        },
        { male: 0, female: 0, other: 0 },
      );
      console.log(patientCount);
      setGenderwiseCount(patientCount);
      setOPDData(res.data);
      setFilteredData(res.data);
    } catch (error) {
      console.log('Error ', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, location, patientType, toDate]);

  const DNTFilter = () => {
    // Step 1: Get all deleted records
    const deletedRecords = OPDData.filter(patient => patient.is_deleted === 1);

    // Step 2: Remove duplicates based on patient_phone
    const uniqueDeleted = [];
    const seenPhones = new Set();

    for (const patient of deletedRecords) {
      if (!seenPhones.has(patient.patient_phone)) {
        seenPhones.add(patient.patient_phone);
        uniqueDeleted.push(patient);
      }
    }

    // Step 3: Find all confirmed patient phones
    const confirmedPhones = new Set(
      OPDData.filter(
        patient => patient.confirm_time !== '0' && patient.confirm_time !== 0,
      ).map(patient => patient.patient_phone),
    );

    // Step 4: Remove deleted patients who are also confirmed
    const finalList = uniqueDeleted.filter(
      patient => !confirmedPhones.has(patient.patient_phone),
    );

    // Step 5: Return final list
    return finalList;
  };

  const handleFilter = useCallback(
    category => {
      setFilterCategory(category);
      const filteredPatientData =
        category === 'all'
          ? OPDData
          : category === 'notConfirmed'
          ? OPDData.filter(
              patient =>
                patient.confirm_time === '0' && patient.is_deleted !== 1,
            )
          : category === 'Confirm'
          ? OPDData.filter(
              patient =>
                patient.confirm_time !== '0' && patient.is_deleted !== 1,
            )
          : category === 'DNT'
          ? DNTFilter()
          : OPDData.filter(
              patient =>
                patient.confirm_time !== '0' && patient.executivechk !== 2,
            );
      console.log(filteredPatientData.length);
      setFilteredData(filteredPatientData);
    },
    [DNTFilter, OPDData],
  );

  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, filteredData.length));
  }, [filteredData.length, itemsPerPage, page]);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
    handleFilter('all');
  };

  let totalConfirm = 0;
  let total = 0;
  let totalNonConfirm = 0;
  let totalPending = 0;
  let totalDNT = DNTFilter().length;
  // Calculate totals
  OPDData.forEach(item => {
    //item.is_deleted === 1 && totalDNT++;
    item.is_deleted !== 1 && total++;
    item.is_deleted !== 1 && item.confirm_time !== '0' && totalConfirm++;
    item.is_deleted !== 1 && item.confirm_time === '0' && totalNonConfirm++;
    item.is_deleted !== 1 &&
      item.confirm_time !== '0' &&
      item.executivechk !== 2 &&
      totalPending++;
  });

  const handlePhoneCall = callNumber => {
    const phoneNumber = callNumber;
    const scheme = Platform.OS === 'android' ? 'tel:' : 'telprompt:';
    const phoneUrl = scheme + phoneNumber;
    // console.log('Medical Call: ', phoneUrl);
    if (callNumber) {
      Linking.openURL(phoneUrl).catch(() => {
        console.log('Error!');
      });
    }
    return;
  };

  const handleWhatsapp = callNumber => {
    // console.log('Medical Call: ', phoneUrl);
    if (callNumber) {
      if (callNumber.startsWith('0')) {
        // Remove the leading '0' and return the modified number
        callNumber = callNumber.substring(1);
      }
      Linking.openURL(
        `whatsapp://send?text=${''}&phone=+91${callNumber}`,
      ).catch(() => {
        console.log('Error!');
      });
    }
    return;
  };

  const hadlePatientClick = patient => {
    console.log('Selected:', patient);
    navigation.navigate('OPDReportPatientDetails', { patient });
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
          <Card style={styles.cardTotal}>
            <TouchableOpacity
              style={{ minWidth: 160, flexDirection: 'row' }}
              onPress={toggleExpand}
              activeOpacity={0.9}
            >
              <View style={{ minWidth: 130, flexDirection: 'row' }}>
                <Text style={styles.header}>
                  Total{' '}
                  {(patientType === 'new' && 'New') ||
                    (patientType === 'follow' && 'Follow-Up') ||
                    (patientType === 'postoperative' && 'Post-Op') ||
                    (patientType === 'proctoscopy' && 'C + P')}
                  :{' '}
                </Text>
                <Text style={styles.header}>{total}</Text>
              </View>
              <View
                style={{
                  width: 30,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Image
                  style={{
                    width: 26,
                    height: 26,
                    objectFit: 'contain',
                  }}
                  source={
                    isExpanded
                      ? require('../../assets/up-arrow.png')
                      : require('../../assets/down-arrow.png')
                  }
                />
              </View>
            </TouchableOpacity>
          </Card>

          <View style={{ width: '20%', alignItems: 'flex-end' }}>
            <Text style={styles.cell}>M : {genderwiseCount.male}</Text>
            <Text style={styles.cell}>F : {genderwiseCount.female}</Text>
            <Text style={styles.cell}>O : {genderwiseCount.other}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.headerSubContainer}>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'Confirm' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('Confirm')}
            >
              <Text style={styles.subHeader}>Confirmed</Text>
              <Text style={styles.subHeader}>{totalConfirm}</Text>
            </Card>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'notConfirmed' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('notConfirmed')}
            >
              <Text style={styles.subHeader}>Not Confirmed</Text>
              <Text style={styles.subHeader}>{totalNonConfirm}</Text>
            </Card>

            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'DNT' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('DNT')}
            >
              <Text style={styles.subHeader}>DNT</Text>
              <Text style={styles.subHeader}>{totalDNT}</Text>
            </Card>

            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'Pending' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('Pending')}
            >
              <Text style={styles.subHeader}>Recept Pending</Text>
              <Text style={styles.subHeader}>{totalPending}</Text>
            </Card>

            <TouchableOpacity
              onPress={() => handleFilter('all')}
              activeOpacity={0.5}
            >
              <Card
                style={{
                  ...styles.card,
                  backgroundColor: '#fff',
                  borderLeftWidth: 0.5,
                  borderWidth: 0.5,
                  alignItems: 'center',
                }}
              >
                <Text style={styles.subHeader}>Clear Filter</Text>
              </Card>
            </TouchableOpacity>
          </View>
        )}

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
                  color={'#0d7592'}
                />
              </Dialog>
            </Portal>
            {filteredData.length > 0 ? (
              filteredData.slice(from, to).map((item, index) => (
                <Card
                  key={index}
                  onPress={() => {
                    hadlePatientClick(item);
                  }}
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
                  >
                    <View
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.5}
                        onPress={() => handlePhoneCall(item.patient_phone)}
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Image
                          source={require('../../assets/call1.png')}
                          style={{ width: 35, height: 35 }}
                          alt="Call now"
                        />
                      </TouchableOpacity>
                    </View>

                    <View
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.5}
                        onPress={() => handleWhatsapp(item.patient_phone)}
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Image
                          source={require('../../assets/whatsapp.png')}
                          style={{ width: 35, height: 35 }}
                          alt="WhatsApp"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
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
            disabled={(page + 1) * itemsPerPage >= filteredData.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= filteredData.length
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

export default OPDReportDetails;

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

    flexWrap: 'wrap',
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
    minWidth: '30%',
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
  header: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  subHeader: {
    minWidth: '25%',
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
    fontFamily: 'Lexend-Regular',
    fontSize: 16,
    color: '#333',
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
