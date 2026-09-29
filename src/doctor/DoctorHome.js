import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { setLocation, setLocationArray } from '../store/locationSlice';
import firestore from '@react-native-firebase/firestore';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import { Card } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { clearLocation } from '../store/locationSlice';
import { DonutChart } from 'react-native-circular-chart';
import { Picker } from '@react-native-picker/picker';
import BottomTab from '../admin/BottomTab';
import ModalDropdown from 'react-native-modal-dropdown';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Import the vector icon
import DatePicker from 'react-native-date-picker';
import DoctorsBottomTab from './DoctorsBottomTab';
import { SafeAreaView } from 'react-native-safe-area-context';

const DoctorHome = ({ navigation }) => {
  // eslint-disable-next-line prettier/prettier
  const route = useRoute();
  const dispatch = useDispatch();
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ status: false, message: '' });
  const [from, setFrom] = useState(new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [mobile, setMobile] = useState('');
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [selectedValue, setSelectedValue] = useState('Today');
  const [dashboardValues, setDashboardValues] = useState({});
  const [series, setSeries] = useState([]);
  const [helplineSeries, setHelplineSeries] = useState([]);
  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //

  // For exiting App
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        BackHandler.exitApp();
        return true;
      };
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );
      return () => backHandler.remove();
    }, []),
  );

  // useEffect(() => {
  //   const getMobile = async () => {
  //     try {
  //       const number = await AsyncStorage.getItem('mobile');
  //       setMobile(number);
  //       // Check if the value exists
  //       if (number !== null) {
  //         console.log('Stored Mobile:', number);
  //       } else {
  //         console.log('No mobile number found in AsyncStorage');
  //       }
  //     } catch (error) {
  //       console.error('Error retrieving mobile:', error);
  //     }
  //   };

  //   getMobile();
  // }, []);

  useEffect(() => {
    fetchDashboardValues(location);
  }, [fetchDashboardValues, from, location, to]);

  const fetchDashboardValues = useCallback(
    async location => {
      try {
        setLoading(true);
        const number = await AsyncStorage.getItem('mobile');
        console.log(number);
        // console.log(
        //   `${BACKEND_URL}/Dashboard/doctor?location=${location}&from=${from}&to=${to}&mobile=${number}`,
        // );
        const response = await fetch(
          `${BACKEND_URL}/Dashboard/doctor?location=${location}&from=${from}&to=${to}&mobile=${number}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        const res = await response.json();
        console.log('Dashboard details: ', res);
        setDashboardValues(res);
      } catch (error) {
        console.log('Error ', error.message);
        setError({ status: true, message: error.message });
      } finally {
        setLoading(false);
        hideModal1();
      }
    },
    [from, mobile, to],
  );

  const updateValues = value => {
    setSelectedValue(value);
    if (value === 'Custom') {
      setVisible1(true);
      return;
    }
    const currentDate = new Date();

    if (value === 'Today') {
      const today = currentDate.toISOString().split('T')[0];
      setFrom(today);
      setTo(today);
    } else if (value === '7') {
      const lastWeek = new Date(currentDate.setDate(currentDate.getDate() - 7))
        .toISOString()
        .split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      setFrom(lastWeek);
      setTo(today);
    } else if (value === '30') {
      const lastMonth = new Date(
        currentDate.setDate(currentDate.getDate() - 30),
      )
        .toISOString()
        .split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      setFrom(lastMonth);
      setTo(today);
    } else if (value === 'FY') {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();

      // Determine the start of the financial year
      const financialYearStart =
        currentDate.getMonth() < 3 // Months are 0-indexed: 0 = January, 1 = February, 2 = March
          ? new Date(currentYear - 1, 3, 1) // Before April: use April 1st of the previous year
          : new Date(currentYear, 3, 1); // April or later: use April 1st of the current year

      const today = currentDate.toISOString().split('T')[0];
      const formattedFYStart = financialYearStart.toISOString().split('T')[0];

      console.log('Financial Year Start:', formattedFYStart);
      console.log('Today:', today);

      setFrom(formattedFYStart);
      setTo(today);
    } else if (value === 'month') {
      // Get the current date
      const currentDate = new Date();

      // Calculate the start of the current month
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      )
        .toISOString()
        .split('T')[0];

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Update the state with fromDate and toDate
      setFrom(monthStart);
      setTo(today);

      console.log('Month Start:', monthStart);
      console.log('Today:', today);
    }
  };

  // Function to handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    // Call your data fetching function or logic here
    fetchDashboardValues(location).then(() => {
      setRefreshing(false);
    });
  };

  const logoutHandler = async () => {
    try {
      setLoading(true);
      const mobile = await AsyncStorage.getItem('mobile');
      if (!mobile) {
        throw new Error('No mobile number found in AsyncStorage');
      }

      const userDoc = await firestore().collection('users').doc(mobile).get();
      const userData = userDoc.data();

      if (userData) {
        userData.isActive = false;
        userData.deviceId = '';
        await firestore().collection('users').doc(mobile).update(userData);
        dispatch(clearLocation());
      } else {
        throw new Error('User data not found in Firestore');
      }
      await AsyncStorage.setItem('deviceId', '');
      await AsyncStorage.setItem('mobile', '');
      navigation.navigate('EnterMobile');
    } catch (error) {
      console.error('Logout Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const hideModal1 = () => {
    setVisible1(false);
  };

  // Function to handle button click
  const handleClick = async () => {
    try {
      setFrom(fromDate.toISOString().split('T')[0]);
      setTo(toDate.toISOString().split('T')[0]);
      //await fetchDashboardValues(location);
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View
          style={{ width: '50%', flexDirection: 'row', alignItems: 'center' }}
        >
          <TouchableOpacity
            activeOpacity={0.6}
            style={styles.LogoutbuttonContainer}
            onPress={() => logoutHandler()}
          >
            <Image
              style={{
                width: 50,
                height: 50,
                objectFit: 'contain',
              }}
              source={require('../../assets/logo_hhc.png')}
            />
          </TouchableOpacity>
          <View
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Text
              style={{
                fontFamily: 'Lexend-Medium',
                fontSize: 12,
                color: '#000',
              }}
            >
              Welcome to HHC
            </Text>
            {locationArray && locationArray.length > 0 ? (
              <View
                style={{
                  width: 150,
                  height: 30,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderRadius: 5,
                }}
              >
                <Picker
                  selectedValue={location}
                  onValueChange={itemValue => dispatch(setLocation(itemValue))}
                  style={{
                    width: '100%',
                    height: '100%',
                    fontSize: 14,
                    fontFamily: 'Lexend-Medium',
                    color: '#000',
                  }}
                  itemStyle={{
                    fontSize: 14,
                    fontFamily: 'Lexend-Medium',
                    color: '#000',
                  }}
                >
                  {locationArray.map((item, index) => (
                    <Picker.Item
                      style={{
                        fontSize: 14,
                        fontFamily: 'Lexend-Medium',
                        color: '#000',
                      }}
                      key={index}
                      label={item}
                      value={item}
                    />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text
                style={{
                  fontFamily: 'Lexend-Medium',
                  fontSize: 14,
                  color: '#000',
                }}
              >
                {location}
              </Text>
            )}
          </View>
        </View>

        <View
          style={{
            width: 145,
            height: 50,
            justifyContent: 'center',
            borderWidth: 1,
            borderRadius: 4,
            marginRight: 5,
            padding: 0,
          }}
        >
          <Picker
            selectedValue={selectedValue}
            style={{
              fontSize: 12,
              fontFamily: 'Lexend-Regular',
              padding: 0,
              margin: 0,
            }}
            onValueChange={(itemValue, itemIndex) => {
              updateValues(itemValue);
            }}
          >
            <Picker.Item
              style={{ fontSize: 14, fontFamily: 'Lexend-Regular' }}
              label="Today"
              value="Today"
            />
            <Picker.Item
              style={{ fontSize: 14, fontFamily: 'Lexend-Regular' }}
              label="Last 7 Days"
              value="7"
            />
            <Picker.Item
              style={{ fontSize: 14, fontFamily: 'Lexend-Regular' }}
              label="Last 30 Days"
              value="30"
            />
            <Picker.Item
              style={{ fontSize: 14, fontFamily: 'Lexend-Regular' }}
              label="This Month"
              value="month"
            />
            <Picker.Item
              style={{ fontSize: 14, fontFamily: 'Lexend-Regular' }}
              label="This F.Y."
              value="FY"
            />
            <Picker.Item
              style={{ fontSize: 14, fontFamily: 'Lexend-Regular' }}
              label="Custom Date"
              value="Custom"
            />
          </Picker>
        </View>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        style={{ flex: 1, margin: 0, padding: 0 }}
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
              <Text variant="bodyMedium">Loading..</Text>
            </Dialog.Content>
            <ActivityIndicator
              animating={loading}
              size={'large'}
              color={'#01458e'}
            />
          </Dialog>
        </Portal>

        <View style={styles.bodycontainer}>
          <Card style={styles.subContainer1}>
            <View style={styles.btnMainContainer}>
              <View style={{ width: '48%' }}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('DoctorsAppointments', {
                      fromDate: from,
                      toDate: to,
                    });
                  }}
                  activeOpacity={0.6}
                  style={styles.buttonContainer}
                >
                  <Text style={{ ...styles.btnText, color: '#379AE6FF' }}>
                    Appointments
                  </Text>
                  <Text style={{ ...styles.btnheading, color: '#379AE6FF' }}>
                    {dashboardValues?.appointment_count}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* <View style={{width: '26%'}}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('IPDBillDetails', {
                      fromDate: from,
                      toDate: to,
                    });
                  }}
                  activeOpacity={0.6}
                  style={styles.buttonContainer}>
                  <Text style={{...styles.btnText, color: '#F9623EFF'}}>
                    IPD
                  </Text>
                  <Text style={{...styles.btnheading, color: '#F9623EFF'}}>
                    {dashboardValues?.ipd_count}
                  </Text>
                </TouchableOpacity>
              </View> */}
              <View style={{ width: '48%' }}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('DoctorsDischargeCardDetails', {
                      fromDate: from,
                      toDate: to,
                    });
                  }}
                  activeOpacity={0.6}
                  style={styles.buttonContainer}
                >
                  <Text style={{ ...styles.btnText, color: '#14923EFF' }}>
                    Discharge
                  </Text>
                  <Text style={{ ...styles.btnheading, color: '#14923EFF' }}>
                    {dashboardValues?.dc_count}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* <Card style={styles.subContainer1}>
            <View style={styles.btnMainContainer}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('IVRCall', {fromDate: from, toDate: to})
                }
                activeOpacity={0.6}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                }}>
                <Text style={{...styles.btnText, paddingLeft: 15}}>
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
                        }}>
                        {dashboardValues.answered_count}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 12,
                          lineHeight: 22,
                          color: '#14923EFF',
                        }}>
                        Answered
                      </Text>
                    </View>
                    <View
                      style={{
                        width: '50%',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
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
                        labelTitleStyle={{display: 'none'}}
                        labelValueStyle={{display: 'none'}}
                      />

                      <Text
                        style={{
                          position: 'absolute',
                          fontSize: 18,
                          fontFamily: 'Lexend-Regular',
                          color: '#000',
                          textAlign: 'center',
                        }}>
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
                        }}>
                        {dashboardValues.missed_count}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 12,
                          lineHeight: 22,
                          color: '#DE3B40FF',
                        }}>
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
                onPress={() =>
                  navigation.navigate('HelplineCalls', {
                    fromDate: from,
                    toDate: to,
                  })
                }
                activeOpacity={0.6}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                }}>
                <Text style={{...styles.btnText, paddingLeft: 15}}>
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
                        }}>
                        {dashboardValues.helpline_answered_count}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 12,
                          lineHeight: 22,
                          color: '#14923EFF',
                        }}>
                        Answered
                      </Text>
                    </View>
                    <View
                      style={{
                        width: '50%',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
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
                        labelTitleStyle={{display: 'none'}}
                        labelValueStyle={{display: 'none'}}
                      />

                      <Text
                        style={{
                          position: 'absolute',
                          fontSize: 18,
                          fontFamily: 'Lexend-Regular',
                          color: '#000',
                          textAlign: 'center',
                        }}>
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
                        }}>
                        {dashboardValues.helpline_missed_count}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 12,
                          lineHeight: 22,
                          color: '#DE3B40FF',
                        }}>
                        Missed
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.btnheading}>0</Text>
                )}
              </TouchableOpacity>
            </View>
          </Card> */}

          {/* <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{
                ...styles.btn,
                flexDirection: 'row',
                width: '100%',
                backgroundColor: '#FFF',
              }}
              onPress={() => navigation.navigate('CallingList')}>
              <Image
                style={{
                  height: 48,
                  width: 48,
                }}
                source={require('../../assets/schedule.png')}
              />
              <Text style={styles.callingBtn}>Calling Calendar</Text>
            </TouchableOpacity>
          </View> */}

          <View style={styles.OPDContainer}>
            <Text
              style={{
                fontFamily: 'Lexend-Medium',
                fontSize: 20,
                color: '#000',
                marginVertical: 5,
              }}
            >
              OPD Report
            </Text>
            <View style={styles.OPDSubContainer}>
              <Card style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('DoctorOPDReportDetails', {
                      location: location,
                      fromDate: from,
                      toDate: to,
                      patientType: 'new',
                    })
                  }
                >
                  <Text style={styles.text}>New</Text>
                  <Text style={styles.textHeading}>
                    {dashboardValues?.dailyOPDReport?.new}
                  </Text>
                </TouchableOpacity>
              </Card>
              <Card style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('DoctorOPDReportDetails', {
                      location: location,
                      fromDate: from,
                      toDate: to,
                      patientType: 'follow',
                    })
                  }
                >
                  <Text style={styles.text}>Follow-Up</Text>
                  <Text style={styles.textHeading}>
                    {dashboardValues?.dailyOPDReport?.FU}
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
            <View style={styles.OPDSubContainer}>
              <Card style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('DoctorOPDReportDetails', {
                      location: location,
                      fromDate: from,
                      toDate: to,
                      patientType: 'postoperative',
                    })
                  }
                >
                  <Text style={styles.text}>Post-Op.</Text>
                  <Text style={styles.textHeading}>
                    {dashboardValues?.dailyOPDReport?.PO}
                  </Text>
                </TouchableOpacity>
              </Card>
              {/* <Card style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('OPDReportDetails', {
                      location: location,
                      fromDate: from,
                      toDate: to,
                      patientType: 'proctoscopy',
                    })
                  }>
                  <Text style={styles.text}>C+P</Text>
                  <Text style={styles.textHeading}>
                    {dashboardValues?.dailyOPDReport?.procto}
                  </Text>
                </TouchableOpacity>
              </Card> */}
            </View>
          </View>

          {/* <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{...styles.btn, backgroundColor: '#DE3B40FF'}}
              onPress={() => navigation.navigate('AdminIPDPayment')}>
              <Text style={styles.btnText2}>IPD Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{...styles.btn, backgroundColor: '#379AE6FF'}}
              onPress={() => navigation.navigate('AdminOPDPayment')}>
              <Text style={styles.btnText2}>OPD Collection</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{...styles.btn, backgroundColor: '#171A1FFF'}}
              onPress={() => navigation.navigate('AdminOPDIPDPayment')}>
              <Text style={styles.btnText2}>OPD + IPD Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{...styles.btn, backgroundColor: '#F9623EFF'}}
              onPress={() => navigation.navigate('DailyOPDPayment')}>
              <Text style={styles.btnText2}>Daily OPD Report</Text>
            </TouchableOpacity>
          </View> */}
        </View>
      </ScrollView>

      {
        //Custom Date Modal
      }
      <Portal>
        <Modal
          visible={visible1}
          onDismiss={hideModal1}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <View style={{ display: 'flex', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 20 }}>
                Filter
              </Text>
            </View>
            <Text style={styles.profileInput}>From:</Text>
            <View style={styles.profileSection}>
              <Text
                style={{ padding: 10, ...styles.profileInput }}
                onPress={() => setOpen(true)}
              >
                {fromDate.toLocaleDateString()}
              </Text>

              <DatePicker
                modal
                mode="date"
                open={open}
                date={fromDate}
                onConfirm={date => {
                  const date1 = date.toISOString().split('T')[0];
                  console.log('From:', new Date(date1));
                  setOpen(false);
                  setFromDate(date);
                }}
                onCancel={() => {
                  setOpen(false);
                }}
                maximumDate={new Date()}
              />
            </View>
            <Text style={{ ...styles.profileInput, marginTop: 10 }}>To:</Text>
            <View style={styles.profileSection}>
              <Text
                style={{ padding: 10, ...styles.profileInput }}
                onPress={() => setOpen2(true)}
              >
                {toDate.toLocaleDateString()}
              </Text>

              <DatePicker
                modal
                mode="date"
                open={open2}
                date={toDate}
                onConfirm={date => {
                  setOpen2(false);
                  setToDate(date);
                }}
                onCancel={() => {
                  setOpen2(false);
                }}
                minimumDate={fromDate}
                maximumDate={new Date()}
              />
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  marginTop: 20,
                }}
              >
                <Button
                  mode="outlined"
                  onPress={() => {
                    hideModal1();
                  }}
                  style={{ width: 150 }}
                  textColor="#007bff"
                >
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    handleClick();
                  }}
                  style={{ width: 150, backgroundColor: '#007bff' }}
                >
                  Find
                </Button>
              </View>
            </KeyboardAvoidingView>
            <Dialog
              visible={loading1}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 20,
              }}
            >
              <Dialog.Content>
                <Text variant="bodyMedium">Processing...</Text>
              </Dialog.Content>
              <ActivityIndicator
                animating={loading1}
                size={'large'}
                color={'#0d7592'}
              />
            </Dialog>
          </ScrollView>
        </Modal>
      </Portal>

      <DoctorsBottomTab navigation={navigation} />
    </SafeAreaView>
  );
};

export default DoctorHome;

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
});
