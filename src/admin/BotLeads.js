/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/* eslint-disable react/react-in-jsx-scope */
import { useFocusEffect, useRoute } from '@react-navigation/native';
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
  DataTable,
  MD3LightTheme,
  Text,
  Button,
  Portal,
  Modal,
  Dialog,
  ActivityIndicator,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const BotLeads = ({ navigation }) => {
  const route = useRoute();
  const { fromDate, toDate } = route.params;
  const location = useSelector(state => state.location.value);
  const [mockLeads, setMockLeads] = useState([]);
  const [leadStats, setLeadStats] = useState({
    actualVisitCount: 0,
    appointmentCount: 0,
    totalLeads: 0,
    appointmentList: [],
    visitedList: [],
    ipdList: [],
    leads: [],
  });
  const [from, setFrom] = useState();
  const [to, setTo] = useState();

  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [billType, setBillType] = useState('');
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [paginatedLeads, setPaginatedLeads] = useState([]);
  const itemsPerPage = 10;

  useEffect(() => {
    setTotalPages(Math.ceil(filteredRecords.length / itemsPerPage));
    setPaginatedLeads(
      filteredRecords.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    );
  }, [filteredRecords, currentPage]);
  //console.log('Paginated leads: ', paginatedLeads);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const fetchLeadList = useCallback(location => {
    setLoading(true);

    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };

    try {
      fetch(
        `${BACKEND_URL}/leadManagement/datewiseBot?location=${location}&from=${fromDate}&to=${toDate}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Lead details: ', res);
          setLoading(false);
          setLeadStats({
            actualVisitCount: res.actualVisitCount,
            appointmentCount: res.appointmentCount,
            ipdCount: res.ipdCount,
            totalLeads: res.totalLeads,
            appointmentList: res.appointmentLeads,
            visitedList: res.visitedLeads,
            ipdList: res.ipdLeads,
            leads: res.leads,
          });
          setMockLeads(res.leads);
          setFilteredRecords(res.leads);
        });
    } catch (error) {
      setLoading(false);
      console.log('Error ', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeadList(location);
    }, [fetchLeadList, location]),
  );

  // Function to toggle the visibility
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  // Toggle the expanded state
  const toggleExpandPatient = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };

  const getLast10Digits = phone => {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10); // remove non-digits, get last 10
  };

  const handleBillTypeSelect = type => {
    setBillType(type);

    let filtered = [];

    if (type === 'Appointment') {
      const phoneSet = new Set(
        leadStats.appointmentList.map(item => getLast10Digits(item.phoneno)),
      );
      filtered = leadStats.leads.filter(item =>
        phoneSet.has(getLast10Digits(item.phoneno)),
      );
    } else if (type === 'Visited') {
      const phoneSet = new Set(
        leadStats.visitedList.map(item => getLast10Digits(item.patient_phone)),
      );
      filtered = leadStats.leads.filter(item =>
        phoneSet.has(getLast10Digits(item.phoneno)),
      );
    } else if (type === 'IPD') {
      const phoneSet = new Set(
        leadStats.ipdList.map(item => getLast10Digits(item.patient_phone)),
      );
      filtered = leadStats.leads.filter(item =>
        phoneSet.has(getLast10Digits(item.phoneno)),
      );
    } else {
      filtered = mockLeads;
    }
    //console.log('Filtered records: ', filtered);
    setCurrentPage(1);
    setFilteredRecords(filtered);
  };

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
        callNumber = `+91${callNumber.substring(1)}`;
      }
      if (callNumber.startsWith('91')) {
        // Remove the leading '0' and return the modified number
        callNumber = `+91${callNumber.substring(2)}`;
      }

      Linking.openURL(`whatsapp://send?text=${''}&phone=${callNumber}`).catch(
        () => {
          console.log('Error!');
        },
      );
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
          <Card style={{ ...styles.cardTotal, flexDirection: 'column' }}>
            <TouchableOpacity
              style={{
                minWidth: 160,
                flexDirection: 'row',
                paddingHorizontal: 5,
              }}
              onPress={toggleExpand}
              activeOpacity={0.9}
            >
              <View style={{ minWidth: 130, flexDirection: 'column' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={styles.header}> Bot Leads : </Text>
                  <Text style={styles.header}>{mockLeads.length}</Text>
                </View>
                <Text style={{ ...styles.cell, textAlign: 'center' }}>
                  {new Date(fromDate).toLocaleDateString('en-GB')}-
                  {new Date(toDate).toLocaleDateString('en-GB')}
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
          <View style={{ display: 'flex', flexDirection: 'column' }}>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderWidth: 1,
                  borderRadius: 3,
                  backgroundColor: '#fff',
                  borderColor: '#000',
                }}
              />
              <Text style={styles.cell}> : Un-Attended</Text>
            </View>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderWidth: 1,
                  borderRadius: 3,
                  backgroundColor: '#66BB6A',
                  borderColor: '#000',
                }}
              />
              <Text style={styles.cell}> : Appointment</Text>
            </View>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderWidth: 1,
                  borderRadius: 3,
                  backgroundColor: '#FFB300',
                  borderColor: '#000',
                }}
              />
              <Text style={styles.cell}> : Enquiry</Text>
            </View>
          </View>
        </View>

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
        <ScrollView
          style={{
            flex: 1,
            height: '70%',
            width: '100%',
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
                color={'#01458e'}
              />
            </Dialog>
          </Portal>

          {paginatedLeads.length > 0 ? (
            paginatedLeads.slice(from, to).map((item, index) => (
              <Card
                key={index}
                style={{
                  backgroundColor:
                    item.status === 'Appointment'
                      ? '#66BB6A'
                      : item.status === 'Enquiry'
                      ? '#FFB300'
                      : '#fff',
                  marginVertical: 8,
                  marginHorizontal: 5,
                  borderRadius: 4,
                }}
              >
                <View
                  style={{
                    display: 'flex',
                    width: '100%',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => toggleExpandPatient(item.appointment_id)}
                    activeOpacity={0.9}
                    style={{
                      width: '100%',
                      minHeight: 40,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        width: '50%',
                        paddingHorizontal: 10,
                        flexDirection: 'column',
                      }}
                    >
                      <Text style={styles.medium}>
                        {index + 1 + (currentPage - 1) * 10}. {item.name}
                      </Text>

                      <Text style={styles.cell}>
                        {new Date(item.date).toLocaleDateString('en-GB')}
                      </Text>
                    </View>
                    <View style={{ width: '40%' }}>
                      <Text style={styles.medium}>{item.phoneno}</Text>
                      {item.email && (
                        <Text style={styles.medium}>{item.email}</Text>
                      )}
                    </View>
                    <View style={{ width: '10%' }}>
                      <Image
                        style={{
                          width: 26,
                          height: 26,
                          objectFit: 'contain',
                        }}
                        source={
                          expandedPatientId === item.appointment_id
                            ? require('../../assets/up-arrow.png')
                            : require('../../assets/down-arrow.png')
                        }
                      />
                    </View>
                  </TouchableOpacity>

                  {expandedPatientId === item.appointment_id && (
                    <View
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginVertical: 5,
                      }}
                    >
                      <View style={styles.amountContainer}>
                        <Text style={styles.medium}>
                          Patient Message:{' '}
                          <Text style={styles.cell}>{item.message}</Text>
                        </Text>
                      </View>
                      <View style={styles.amountContainer}>
                        <Text style={styles.medium}>
                          FDE Note: <Text style={styles.cell}>{item.note}</Text>
                        </Text>
                      </View>
                      {item.phoneno && (
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
                              onPress={() => handlePhoneCall(item.phoneno)}
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
                              onPress={() => handleWhatsapp(item.phoneno)}
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
                      )}
                    </View>
                  )}
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
        </ScrollView>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginTop: 16,
          }}
        >
          <Button
            mode="outlined"
            // title="Prev"
            style={{ width: 100 }}
            textColor="#0d7592"
            disabled={currentPage === 1}
            onPress={() => {
              setCurrentPage(prev => prev - 1);
            }}
          >
            Prev
          </Button>
          <Text
            style={{
              marginHorizontal: 10,
            }}
          >{`${currentPage} / ${totalPages}`}</Text>
          <Button
            mode="outlined"
            // title="Next"
            style={{ width: 100 }}
            textColor="#0d7592"
            disabled={currentPage === totalPages}
            onPress={() => {
              setCurrentPage(prev => prev + 1);
            }}
          >
            Next
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default BotLeads;

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
    //backgroundColor: '#F2FFF2FF',
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
    fontFamily: 'Lexend-Medium',
    fontSize: 16,
    lineHeight: 19,
    color: '#000000',
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
  amountSubContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderWidth: 1,
    width: 100,
    height: 42,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  amountContainer: {
    display: 'flex',
    width: '100%',
    //justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    // marginVertical: 5,
    paddingHorizontal: 10,
  },
  amountSubContainer2: {
    width: '33%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    width: 100,
    textAlign: 'left',
    color: '#000',
  },
  amountIcon: {
    width: 20,
    height: 20,
    objectFit: 'contain',
    marginRight: 6,
  },
  amount: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#000',
  },
  bold: {
    fontFamily: 'Lexend-Bold',
    fontSize: 14,
    marginVertical: 5,
    color: '#000',
  },
  medium: {
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    marginVertical: 5,
    color: '#000',
  },
});
