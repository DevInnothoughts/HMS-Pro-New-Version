import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DonutChart } from 'react-native-circular-chart';
import {
  ActivityIndicator,
  Card,
  DataTable,
  Dialog,
  MD3LightTheme,
  Modal,
  Portal,
  Title,
} from 'react-native-paper';
import { useSelector } from 'react-redux';

const getYesterday = () => {
  const now = new Date();

  // Add IST offset (5.5 hours = 330 minutes)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // Subtract one day in IST-adjusted context
  istNow.setUTCDate(istNow.getUTCDate() - 1);
  //console.log(istNow);
  // Extract and format date in UTC after IST shift
  const yyyy = istNow.getUTCFullYear();
  const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istNow.getUTCDate()).padStart(2, '0');

  const formatted = `${yyyy}-${mm}-${dd}`;
  //console.log('IST Yesterday:', formatted);
  return formatted;
};

const CallAndWebLeadApproval = () => {
  const navigation = useNavigation();
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const [from, setFrom] = useState(getYesterday());
  const [to, setTo] = useState(getYesterday());
  const [error, setError] = useState({ status: false, message: '' });
  const [loading, setLoading] = useState(false);
  const [dashboardValues, setDashboardValues] = useState({});
  const [series, setSeries] = useState([]);
  const [helplineSeries, setHelplineSeries] = useState([]);
  const [isIVRModalVisible, setIVRModalVisible] = useState(false);
  const [isHelplineModalVisible, setHelplineModalVisible] = useState(false);
  const [isWebLeadModalVisible, setWebLeadModalVisible] = useState(false);
  const [isBotLeadModalVisible, setBotLeadModalVisible] = useState(false);
  const [webLeadSeries, setWebLeadSeries] = useState([]);
  const [botLeadSeries, setBotLeadSeries] = useState([]);
  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    fetchDashboardValues(location);
  }, [fetchDashboardValues, from, location, to]);

  const fetchDashboardValues = useCallback(
    async location => {
      try {
        setLoading(true);
        const response = await fetch(
          `${BACKEND_URL}/approval/callAndWeb?location=${location}&from=${from}&to=${to}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        const res = await response.json();
        console.log('Dashboard details: ', res.ivrData);
        setDashboardValues(res);
        // Handle zero values by adding a small value to avoid the single dot issue
        const answeredCount =
          res.answered_count === 0 ? 0.01 : res.answered_count;
        const missedCount = res.missed_count === 0 ? 0.01 : res.missed_count;
        const helplineAnsweredCount =
          res.helpline_answered_count === 0
            ? 0.01
            : res.helpline_answered_count;
        const helplineMissedCount =
          res.helpline_missed_count === 0 ? 0.01 : res.helpline_missed_count;
        const helplineOutgoingCount =
          res.helpline_outgoing_count === 0
            ? 0.01
            : res.helpline_outgoing_count;
        const leadEnquiryCount =
          res.webLeads.enquiryCount === 0 ? 0.01 : res.webLeads.enquiryCount;

        const leadAppointmentCount =
          res.webLeads.appointmentCount === 0
            ? 0.01
            : res.webLeads.appointmentCount;
        let unattended =
          res.webLeads.totalLeads -
          (res.webLeads.appointmentCount + res.webLeads.enquiryCount);

        const leadUnAttendedCount = unattended === 0 ? 0.01 : unattended;

        const leadBotEnquiryCount =
          res.botLeads.enquiryCount === 0 ? 0.01 : res.botLeads.enquiryCount;

        const leadBotAppointmentCount =
          res.botLeads.appointmentCount === 0
            ? 0.01
            : res.botLeads.appointmentCount;
        let unattendedBot =
          res.botLeads.totalLeads -
          (res.botLeads.appointmentCount + res.botLeads.enquiryCount);

        const leadBotUnAttendedCount =
          unattendedBot === 0 ? 0.01 : unattendedBot;

        setSeries([
          { name: 'Missed', value: missedCount, color: '#DE3B40FF' },
          { name: 'Ans', value: answeredCount, color: '#14923EFF' },
        ]);
        setHelplineSeries([
          { name: 'Missed', value: helplineMissedCount, color: '#DE3B40FF' },
          { name: 'Out', value: helplineOutgoingCount, color: '#379AE6FF' },
          { name: 'Ans', value: helplineAnsweredCount, color: '#14923EFF' },
        ]);
        setWebLeadSeries([
          {
            name: 'Unattended',
            value: leadUnAttendedCount,
            color: '#DE3B40FF',
          },
          { name: 'Enquery', value: leadEnquiryCount, color: '#379AE6FF' },
          {
            name: 'Appointment',
            value: leadAppointmentCount,
            color: '#14923EFF',
          },
        ]);
        setBotLeadSeries([
          {
            name: 'Unattended',
            value: leadBotUnAttendedCount,
            color: '#DE3B40FF',
          },
          { name: 'Enquery', value: leadBotEnquiryCount, color: '#379AE6FF' },
          {
            name: 'Appointment',
            value: leadBotAppointmentCount,
            color: '#14923EFF',
          },
        ]);
        console.log('Web Leads:', res.botLeads);
      } catch (error) {
        console.log('Error ', error.message);
        setError({ status: true, message: error.message });
      } finally {
        setLoading(false);
      }
    },
    [from, to],
  );

  const handleCloseIVRModal = () => {
    setIVRModalVisible(false);
  };

  const handleCloseHelplineModal = () => {
    setHelplineModalVisible(false);
  };

  const handleCloseWebLeadModal = () => {
    setWebLeadModalVisible(false);
  };

  const handleCloseBotLeadModal = () => {
    setBotLeadModalVisible(false);
  };

  const IVRCallList = ({ callRecord, onClose }) => {
    const [expandedId, setExpandedId] = useState(null);

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

    // Toggle the expanded state
    const toggleExpandPatient = id => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedId(expandedId === id ? null : id);
    };

    return (
      <SafeAreaView style={styles.maincontainer}>
        <View
          style={{
            backgroundColor: 'transparent',
            shadowColor: 'transparent',
            flex: 1,
            width: '100%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              paddingBottom: 10,
            }}
          >
            <TouchableOpacity onPress={onClose}>
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
          <ScrollView
            style={{
              flex: 1,
              height: '70%',
              width: '100%',
            }}
          >
            {callRecord.length > 0 && (
              <View
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  shadowColor: 'transparent',
                }}
              >
                <DataTable style={{ width: '100%' }}>
                  {callRecord.map((item, index) => (
                    <DataTable.Row
                      onPress={() => toggleExpandPatient(item.ivr_id)}
                      key={index}
                      style={{
                        borderBottomColor: '#000',
                        borderBottomWidth: 1,
                        borderWidth: 1,
                        borderRadius: 4,
                        marginVertical: 5,
                        marginHorizontal: 3,
                        minHeight: 60,
                      }}
                    >
                      {/* Row content */}
                      <View
                        style={{
                          width: '100%',
                          minHeight: 60,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            display: 'flex',
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <View
                            style={{
                              display: 'flex',
                              width: '48%',
                              flexDirection: 'row',
                              alignItems: 'center',
                            }}
                          >
                            <View
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {item.call_status !== 'Missed' ? (
                                <Image
                                  source={require('../../assets/incomingCall.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="Answered Call"
                                />
                              ) : (
                                <Image
                                  source={require('../../assets/missed.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="Missed Call"
                                />
                              )}
                            </View>
                            <View
                              style={{
                                justifyContent: 'center',
                                marginLeft: 10,
                              }}
                            >
                              <Text
                                style={{
                                  ...styles.cell,
                                  color: '#000',
                                }}
                              >
                                {item.caller_no}
                              </Text>
                              {item.call_status === 'Missed' ? (
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'Lexend-Regular',
                                    lineHeight: 17,
                                    color: '#000',
                                  }}
                                >
                                  {item.call_status}
                                </Text>
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'Lexend-Regular',
                                    lineHeight: 17,
                                    color: '#000',
                                  }}
                                >
                                  Duration: {item.call_duration}
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text
                            style={{
                              ...styles.cell,
                              color: '#000',
                            }}
                          >
                            {item.call_date}
                          </Text>
                          <View
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: 'space-around',
                              width: '15%',
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
                                onPress={() => handlePhoneCall(item.caller_no)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                <Image
                                  source={require('../../assets/call.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="Call now"
                                />
                              </TouchableOpacity>
                            </View>

                            {/* <View
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                              <TouchableOpacity
                                activeOpacity={0.5}
                                onPress={() => handleWhatsapp(item.caller_no)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}>
                                <Image
                                  source={require('../../assets/whatsapp.png')}
                                  style={{width: 30, height: 30}}
                                  alt="WhatsApp"
                                />
                              </TouchableOpacity>
                            </View> */}
                          </View>
                        </View>

                        {/* Note section */}
                        {expandedId === item.ivr_id && (
                          <View
                            style={{
                              width: '90%',
                              marginTop: 5,
                            }}
                          >
                            <Text style={styles.note}>Note : {item.note}</Text>
                          </View>
                        )}
                      </View>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  };

  const HelplineCallList = ({ callRecord, onClose }) => {
    const [expandedId, setExpandedId] = useState(null);

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

    // Toggle the expanded state
    const toggleExpandPatient = id => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedId(expandedId === id ? null : id);
    };

    return (
      <SafeAreaView style={styles.maincontainer}>
        <View
          style={{
            backgroundColor: 'transparent',
            shadowColor: 'transparent',
            flex: 1,
            width: '100%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              paddingBottom: 10,
            }}
          >
            <TouchableOpacity onPress={onClose}>
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
          <ScrollView
            style={{
              flex: 1,
              height: '70%',
              width: '100%',
            }}
          >
            {callRecord.length > 0 && (
              <View
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  shadowColor: 'transparent',
                }}
              >
                <DataTable style={{ width: '100%' }}>
                  {callRecord.map((item, index) => {
                    // Format the timestamp to a date string
                    const formattedDate = new Date(JSON.parse(item.timestamp));

                    return (
                      <DataTable.Row
                        onPress={() => toggleExpandPatient(item.call_log_id)}
                        key={index}
                        style={{
                          borderBottomColor: '#000',
                          borderBottomWidth: 1,
                          borderWidth: 1,
                          borderRadius: 4,
                          marginVertical: 5,
                          marginHorizontal: 3,
                          minHeight: 60,
                          backgroundColor:
                            item.note !== null ? '#FFB300' : '#fff',
                        }}
                      >
                        {/* Row content */}
                        <View
                          style={{
                            width: '100%',
                            minHeight: 60,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <View
                            style={{
                              display: 'flex',
                              width: '100%',
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <View
                              style={{
                                display: 'flex',
                                width: '48%',
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <View
                                style={{
                                  display: 'flex',
                                  width: '20%',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {item.type === 'INCOMING' ? (
                                  <Image
                                    source={require('../../assets/incomingCall.png')}
                                    style={{ width: 30, height: 30 }}
                                    alt="Answered Call"
                                  />
                                ) : item.type === 'MISSED' ||
                                  item.type === 'UNKNOWN' ? (
                                  <Image
                                    source={require('../../assets/missed.png')}
                                    style={{ width: 30, height: 30 }}
                                    alt="Missed Call"
                                  />
                                ) : (
                                  <Image
                                    source={require('../../assets/outgoingCall.png')}
                                    style={{ width: 30, height: 30 }}
                                    alt="OUTGOING Call"
                                  />
                                )}
                              </View>
                              <View
                                style={{
                                  width: '80%',
                                  justifyContent: 'center',
                                  marginLeft: 10,
                                }}
                              >
                                {item.name && (
                                  <Text
                                    style={{
                                      ...styles.cell,
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: '#000',
                                      width: '100%',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {item.name}
                                  </Text>
                                )}
                                <Text style={{ ...styles.cell, color: '#000' }}>
                                  {item.phoneNumber}
                                </Text>
                                {item.type === 'MISSED' ||
                                item.type === 'UNKNOWN' ? (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontFamily: 'Lexend-Regular',
                                      lineHeight: 17,
                                      color: '#000',
                                    }}
                                  >
                                    {'MISSED'}
                                  </Text>
                                ) : (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontFamily: 'Lexend-Regular',
                                      lineHeight: 17,
                                      color: '#000',
                                    }}
                                  >
                                    Duration: {item.duration} Sec
                                  </Text>
                                )}
                              </View>
                            </View>
                            <View style={{ justifyContent: 'center' }}>
                              <Text style={{ ...styles.cell, color: '#000' }}>
                                {formattedDate.toLocaleDateString('en-GB')}
                              </Text>
                              <Text style={{ ...styles.cell, color: '#000' }}>
                                {formattedDate.toLocaleTimeString('en-GB')}
                              </Text>
                            </View>
                            <View
                              style={{
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'space-around',
                                width: '15%',
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
                                  onPress={() =>
                                    handlePhoneCall(item.phoneNumber)
                                  }
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Image
                                    source={require('../../assets/call.png')}
                                    style={{ width: 30, height: 30 }}
                                    alt="Call now"
                                  />
                                </TouchableOpacity>
                              </View>

                              {/* <View
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                <TouchableOpacity
                                  activeOpacity={0.5}
                                  onPress={() =>
                                    handleWhatsapp(item.phoneNumber)
                                  }
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}>
                                  <Image
                                    source={require('../../assets/whatsapp.png')}
                                    style={{width: 30, height: 30}}
                                    alt="WhatsApp"
                                  />
                                </TouchableOpacity>
                              </View> */}
                            </View>
                          </View>
                          {/* Note section */}
                          {expandedId === item.call_log_id && (
                            <View
                              style={{
                                width: '90%',
                                marginTop: 5,
                              }}
                            >
                              <Text style={styles.note}>
                                Note : {item.note}
                              </Text>
                            </View>
                          )}
                        </View>
                      </DataTable.Row>
                    );
                  })}
                </DataTable>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  };

  const WebLeads = ({ mockLeads, onClose }) => {
    //console.log('Mock Leads:', mockLeads);
    const [expandedPatientId, setExpandedPatientId] = useState(null);

    // Toggle the expanded state
    const toggleExpandPatient = id => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedPatientId(expandedPatientId === id ? null : id);
    };

    return (
      <SafeAreaView style={styles.maincontainer}>
        <View
          style={{
            backgroundColor: 'transparent',
            shadowColor: 'transparent',
            flex: 1,
            width: '100%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              paddingBottom: 10,
            }}
          >
            <TouchableOpacity onPress={onClose}>
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
          <ScrollView
            style={{
              flex: 1,
              height: '70%',
              width: '100%',
            }}
          >
            {mockLeads.length > 0 ? (
              mockLeads.map((item, index) => (
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
                          width: '60%',
                          paddingHorizontal: 10,
                          flexDirection: 'column',
                        }}
                      >
                        <Text style={styles.medium}>
                          {index + 1}. {item.name}
                        </Text>

                        <Text style={styles.medium}>
                          {new Date(item.date).toLocaleDateString('en-GB')}
                        </Text>
                      </View>
                      <View style={{ width: '30%' }}>
                        <Text style={styles.medium}>{item.phoneno}</Text>
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
                            <Text style={styles.cell}>
                              {item.message !== 'Null' ? item.message : ''}
                            </Text>
                          </Text>
                        </View>
                        <View style={styles.amountContainer}>
                          <Text style={styles.medium}>
                            FDE Note:{' '}
                            <Text style={styles.cell}>{item.note}</Text>
                          </Text>
                        </View>
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
        </View>
      </SafeAreaView>
    );
  };

  return (
    <>
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
      <Card style={styles.subContainer1}>
        <View style={styles.btnMainContainer}>
          <TouchableOpacity
            onPress={() => setIVRModalVisible(true)}
            activeOpacity={0.6}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
            }}
          >
            <Text style={{ ...styles.btnText, paddingLeft: 15 }}>
              IVR Calls
            </Text>
            {series.length > 0 ? (
              <View style={styles.IVRContainer}>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    {dashboardValues.answered_count}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    Answered
                  </Text>
                </View>
                <View
                  style={{
                    width: '50%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <DonutChart
                    key={series.map(s => s.value).join(',')}
                    data={series}
                    strokeWidth={12}
                    radius={48}
                    containerWidth={120}
                    containerHeight={120}
                    type="round"
                    startAngle={360}
                    endAngle={0}
                    animationType="slide"
                    labelTitleStyle={{ display: 'none' }}
                    labelValueStyle={{ display: 'none' }}
                  />

                  <Text
                    style={{
                      position: 'absolute',
                      fontSize: 18,
                      fontFamily: 'Lexend-Regular',
                      color: '#000',
                      textAlign: 'center',
                    }}
                  >
                    {parseInt(series[0]?.value + series[1]?.value)}
                  </Text>
                </View>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    {dashboardValues.missed_count}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    Missed
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.btnheading}>0</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.subContainer1}>
        <View style={styles.btnMainContainer}>
          <TouchableOpacity
            onPress={() => setHelplineModalVisible(true)}
            activeOpacity={0.6}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
            }}
          >
            <Text style={{ ...styles.btnText, paddingLeft: 15 }}>
              Helpline Calls
            </Text>
            {helplineSeries.length > 0 ? (
              <View style={styles.IVRContainer}>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    {dashboardValues.helpline_answered_count}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    Answered
                  </Text>
                </View>
                <View
                  style={{
                    width: '50%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <DonutChart
                    key={helplineSeries.map(s => s.value).join(',')}
                    data={helplineSeries}
                    strokeWidth={12}
                    radius={48}
                    containerWidth={120}
                    containerHeight={120}
                    type="round"
                    startAngle={360}
                    endAngle={0}
                    animationType="slide"
                    labelTitleStyle={{ display: 'none' }}
                    labelValueStyle={{ display: 'none' }}
                  />

                  <Text
                    style={{
                      position: 'absolute',
                      fontSize: 18,
                      fontFamily: 'Lexend-Regular',
                      color: '#000',
                      textAlign: 'center',
                    }}
                  >
                    {parseInt(
                      helplineSeries[0]?.value +
                        helplineSeries[1]?.value +
                        helplineSeries[2]?.value,
                    )}
                  </Text>
                </View>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    {dashboardValues.helpline_missed_count}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    Missed
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.btnheading}>0</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.subContainer1}>
        <View style={styles.btnMainContainer}>
          <TouchableOpacity
            onPress={() => setWebLeadModalVisible(true)}
            activeOpacity={0.6}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
            }}
          >
            <Text style={{ ...styles.btnText, paddingLeft: 15 }}>
              Web Leads
            </Text>
            {webLeadSeries.length > 0 ? (
              <View style={styles.IVRContainer}>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    {dashboardValues.webLeads.appointmentCount}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    Appnt.
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#379AE6FF',
                    }}
                  >
                    {dashboardValues.webLeads.enquiryCount}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#379AE6FF',
                    }}
                  >
                    Enquiry
                  </Text>
                </View>
                <View
                  style={{
                    width: '50%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <DonutChart
                    key={webLeadSeries.map(s => s.value).join(',')}
                    data={webLeadSeries}
                    strokeWidth={12}
                    radius={48}
                    containerWidth={120}
                    containerHeight={120}
                    type="round"
                    startAngle={360}
                    endAngle={0}
                    animationType="slide"
                    labelTitleStyle={{ display: 'none' }}
                    labelValueStyle={{ display: 'none' }}
                  />

                  <Text
                    style={{
                      position: 'absolute',
                      fontSize: 18,
                      fontFamily: 'Lexend-Regular',
                      color: '#000',
                      textAlign: 'center',
                    }}
                  >
                    {parseInt(
                      webLeadSeries[0]?.value +
                        webLeadSeries[1]?.value +
                        webLeadSeries[2]?.value,
                    )}
                  </Text>
                </View>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    {dashboardValues.webLeads.totalLeads -
                      (dashboardValues.webLeads.appointmentCount +
                        dashboardValues.webLeads.enquiryCount)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    Unattended
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.btnheading}>0</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.subContainer1}>
        <View style={styles.btnMainContainer}>
          <TouchableOpacity
            onPress={() => setBotLeadModalVisible(true)}
            activeOpacity={0.6}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
            }}
          >
            <Text style={{ ...styles.btnText, paddingLeft: 15 }}>
              Bot Leads
            </Text>
            {botLeadSeries.length > 0 ? (
              <View style={styles.IVRContainer}>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    {dashboardValues.botLeads.appointmentCount}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#14923EFF',
                    }}
                  >
                    Appnt.
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#379AE6FF',
                    }}
                  >
                    {dashboardValues.botLeads.enquiryCount}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#379AE6FF',
                    }}
                  >
                    Enquiry
                  </Text>
                </View>
                <View
                  style={{
                    width: '50%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <DonutChart
                    key={botLeadSeries.map(s => s.value).join(',')}
                    data={botLeadSeries}
                    strokeWidth={12}
                    radius={48}
                    containerWidth={120}
                    containerHeight={120}
                    type="round"
                    startAngle={360}
                    endAngle={0}
                    animationType="slide"
                    labelTitleStyle={{ display: 'none' }}
                    labelValueStyle={{ display: 'none' }}
                  />

                  <Text
                    style={{
                      position: 'absolute',
                      fontSize: 18,
                      fontFamily: 'Lexend-Regular',
                      color: '#000',
                      textAlign: 'center',
                    }}
                  >
                    {parseInt(
                      botLeadSeries[0]?.value +
                        botLeadSeries[1]?.value +
                        botLeadSeries[2]?.value,
                    )}
                  </Text>
                </View>
                <View style={styles.IVRSubContainer1}>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    {dashboardValues.botLeads.totalLeads -
                      (dashboardValues.botLeads.appointmentCount +
                        dashboardValues.botLeads.enquiryCount)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Lexend-Regular',
                      fontSize: 12,
                      lineHeight: 22,
                      color: '#DE3B40FF',
                    }}
                  >
                    Unattended
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.btnheading}>0</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      {/* <LeadsTablePaper data={dashboardValues.webLeads} /> */}
      <Portal>
        <Modal
          visible={isIVRModalVisible}
          onDismiss={() => setIVRModalVisible(false)}
          contentContainerStyle={{
            flex: 1,
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 10,
          }}
        >
          <IVRCallList
            callRecord={dashboardValues.ivrData || []}
            onClose={handleCloseIVRModal}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={isHelplineModalVisible}
          onDismiss={() => setHelplineModalVisible(false)}
          contentContainerStyle={{
            flex: 1,
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 10,
          }}
        >
          <HelplineCallList
            callRecord={dashboardValues.helplineData || []}
            onClose={handleCloseHelplineModal}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={isWebLeadModalVisible}
          onDismiss={() => setWebLeadModalVisible(false)}
          contentContainerStyle={{
            flex: 1,
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 10,
          }}
        >
          <WebLeads
            mockLeads={dashboardValues.webLeads?.webLeads || []}
            onClose={handleCloseWebLeadModal}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={isBotLeadModalVisible}
          onDismiss={() => setBotLeadModalVisible(false)}
          contentContainerStyle={{
            flex: 1,
            backgroundColor: 'white',
            padding: 20,
            margin: 20,
            borderRadius: 10,
          }}
        >
          <WebLeads
            mockLeads={dashboardValues.botLeads?.botLeads || []}
            onClose={handleCloseBotLeadModal}
          />
        </Modal>
      </Portal>
    </>
  );
};

export default CallAndWebLeadApproval;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#F2FFF2FF',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
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
  bodycontainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  subContainer1: {
    width: '97%',
    backgroundColor: '#fff',
    marginVertical: 10,
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
  btnMainContainer: {
    width: '97%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonContainer: {
    width: 160,
    height: 120,
    paddingLeft: 15,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  LongbuttonContainer: {
    width: 160,
    height: 40,
  },
  LogoutbuttonContainer: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnheading: {
    fontFamily: 'Lexend-Medium',
    color: '#000',
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '600',
  },
  btnText: {
    fontFamily: 'Lexend-Medium',
    color: '#000',
    fontSize: 14,
  },
  btnText2: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#FFFFFFFF',
    textAlign: 'center',
  },
  callingBtn: {
    fontFamily: 'Lexend-Medium',
    fontSize: 18,
    lineHeight: 22,
    marginHorizontal: 10,
    color: '#000',
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  card: {
    width: 160,
    height: 100,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 16,
  },
  cardContent: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    verticalAlign: 'middle',
    color: '#000',
  },
  textHeading: {
    fontSize: 20,
    color: '#000',
    backgroundColor: '#fff',
    minWidth: 46,
    paddingHorizontal: 3,
    height: 40,
    verticalAlign: 'middle',
    borderRadius: 10,
    fontFamily: 'Lexend-SemiBold',
  },
  OPDContainer: {
    width: '100%',
    backgroundColor: '#F1FDE9FF',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  OPDSubContainer: {
    display: 'flex',
    width: '100%',
    height: 120,
    justifyContent: 'space-around',
    alignItems: 'center',
    flexDirection: 'row',
  },
  btn: {
    width: 162,
    height: 60,
    paddingHorizontal: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#000',
  },
  IVRContainer: {
    width: '100%',
    height: 120,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  IVRSubContainer1: {
    width: '25%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    padding: 10,
  },
  circularButtonContainer: {
    width: '45%',
    alignItems: 'center',
    marginVertical: 10,
  },
  iconButton: {
    borderRadius: 50,
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    letterSpacing: 0.3,
    fontFamily: 'Lexend-Regular',
    color: '#000',
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    //backgroundColor: '#0d7592',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  image: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    //tintColor: '#fff', // Remove if you want original colors
  },
  containerWeb: {
    padding: 20,
    backgroundColor: '#F8FAFF',
    flex: 1,
  },
  cardWeb: {
    borderRadius: 10,
    elevation: 4,
    backgroundColor: 'transparent',
  },
  titleWeb: {
    marginBottom: 10,
    textAlign: 'center',
  },
  cell: {
    fontSize: 12,
    //lineHeight: 19,
    fontFamily: 'Lexend-Regular',
    color: '#000',
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Lexend-Regular',
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
  amountContainer: {
    display: 'flex',
    width: '100%',
    //justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    // marginVertical: 5,
    paddingHorizontal: 10,
  },
});
