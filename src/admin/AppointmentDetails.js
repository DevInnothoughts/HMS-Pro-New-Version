/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import { useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {
  Card,
  Text,
  Button,
  Portal,
  Modal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const getTodayISTDate = () => {
  const now = new Date();

  // Convert to milliseconds since UTC and add IST offset
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  //console.log(istTime);
  // Format IST date manually in YYYY-MM-DD format
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  //console.log(`${year}-${month}-${day}`);
  return `${year}-${month}-${day}`;
};

const AppointmentDetails = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ?? getTodayISTDate(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ?? getTodayISTDate(),
  );
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filteredData, setFilteredData] = useState([]);
  const [appointmentData, setAppointmentData] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    fetchAppointmentData(location, fromDate, toDate);
  }, []);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, filteredData.length));
  }, [filteredData.length, itemsPerPage, page]);

  useEffect(() => {
    handleFilter(filterCategory);
  }, [filterCategory, appointmentData, handleFilter]);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const fetchAppointmentData = (location, from, to) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };
    try {
      setLoading(true);
      fetch(
        `${BACKEND_URL}/Appointment?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Doctor details: ', res);
          setAppointmentData(res);
          setFilteredData(res);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  // Function to export data to Excel
  // const fetchAppointment = async () => {
  //   try {
  //     setLoading1(true);
  //     console.log(fromDate);
  //     console.log(toDate);
  //     fetchAppointmentData(
  //       location,
  //       fromDate.toISOString().split('T')[0],
  //       toDate.toISOString().split('T')[0],
  //     );
  //   } catch (error) {
  //     console.error('Error exporting data to Excel:', error);
  //   } finally {
  //     setLoading1(false);
  //     hideModal1();
  //   }
  // };
  const handleFilter = useCallback(
    category => {
      setFilterCategory(category);
      const filteredPatientData =
        category === 'all'
          ? appointmentData
          : category === 'notConfirmed'
          ? appointmentData.filter(patient => patient.confirm_time === '0')
          : appointmentData.filter(
              patient => patient.patient_type === category,
            );
      setFilteredData(filteredPatientData);
    },
    [appointmentData],
  );

  // Function to toggle the visibility
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
    handleFilter('all');
  };

  let totalConfirm = 0;
  let totalPostOp = 0;
  let totalMCDPA = 0;
  let totalNew = 0;
  let totalFollow = 0;
  let totalNonConfirm = 0;
  let totalNewConfirm = 0;
  let totalPOConfirm = 0;
  let totalFollowConfirm = 0;
  let totalMCDPAConfirm = 0;

  // Calculate totals
  appointmentData.forEach(item => {
    item.patient_type === 'Postoperative' && totalPostOp++;
    item.patient_type === 'MCDPA' && totalMCDPA++;
    item.patient_type === 'Follow' && totalFollow++;
    item.patient_type === 'New' && totalNew++;
    item.confirm_time !== '0' && totalConfirm++;
    item.confirm_time === '0' && totalNonConfirm++;
    item.patient_type === 'New' &&
      item.confirm_time !== '0' &&
      totalNewConfirm++;
    item.patient_type === 'Postoperative' &&
      item.confirm_time !== '0' &&
      totalPOConfirm++;
    item.patient_type === 'Follow' &&
      item.confirm_time !== '0' &&
      totalFollowConfirm++;
    item.patient_type === 'MCDPA' &&
      item.confirm_time !== '0' &&
      totalMCDPAConfirm++;
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
        `whatsapp://send?text=${message}&phone=+91${callNumber}`,
      ).catch(() => {
        console.log('Error!');
      });
    }
    return;
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
          <TouchableOpacity
            style={{ width: '20%' }}
            onPress={() => navigation.goBack()}
          >
            <Image
              style={{
                height: 35,
                width: 35,
                tintColor: '#184D67',
              }}
              source={require('../../assets/back.png')}
            />
          </TouchableOpacity>
          <Card style={styles.cardTotal}>
            <TouchableOpacity
              style={{ minWidth: 160, flexDirection: 'row' }}
              onPress={toggleExpand}
              activeOpacity={0.9}
            >
              <View style={{ minWidth: 130, flexDirection: 'row' }}>
                <Text style={styles.header}> Total : </Text>
                <Text style={styles.header}>{appointmentData.length}</Text>
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
          <View style={{ width: '20%' }}>
            <Text style={styles.text}>C: Confirm</Text>
          </View>
        </View>
        {isExpanded && (
          <View style={styles.headerSubContainer}>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'notConfirmed' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('notConfirmed')}
            >
              <Text style={styles.subHeader}>Not Visited</Text>
              <Text style={styles.subHeader}>{totalNonConfirm}</Text>
            </Card>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'New' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('New')}
            >
              <Text style={styles.subHeader}>New(C)</Text>
              <Text style={styles.subHeader}>
                {totalNew}({totalNewConfirm})
              </Text>
            </Card>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'Follow' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('Follow')}
            >
              <Text style={styles.subHeader}>FU(C)</Text>
              <Text style={styles.subHeader}>
                {totalFollow}({totalFollowConfirm})
              </Text>
            </Card>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'Postoperative'
                    ? '#edc6a8ff'
                    : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('Postoperative')}
            >
              <Text style={styles.subHeader}>PO(C)</Text>
              <Text style={styles.subHeader}>
                {totalPostOp}({totalPOConfirm})
              </Text>
            </Card>
            <Card
              style={{
                ...styles.card,
                backgroundColor:
                  filterCategory === 'MCDPA' ? '#edc6a8ff' : '#FFF3F0FF',
              }}
              onPress={() => handleFilter('MCDPA')}
            >
              <Text style={styles.subHeader}>MCDPA</Text>
              <Text style={styles.subHeader}>
                {totalMCDPA}({totalMCDPAConfirm})
              </Text>
            </Card>
          </View>
        )}
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
                  style={{
                    backgroundColor: '#F1FDE9FF',
                    width: '48%',
                    minHeight: 275,
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

export default AppointmentDetails;

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
    paddingHorizontal: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // backgroundColor: '#F2FFF2FF',
  },
  headerSubContainer: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
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
    minWidth: '30%',
    height: 80,
    paddingHorizontal: 5,
    marginVertical: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
  },
  header: {
    fontSize: 18,
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
