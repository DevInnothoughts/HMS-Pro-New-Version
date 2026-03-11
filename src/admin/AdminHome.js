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
  IconButton,
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
import BottomTab from './BottomTab';
import ModalDropdown from 'react-native-modal-dropdown';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Import the vector icon
import DatePicker from 'react-native-date-picker';
import { RadioButton, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const getISTDate = () => {
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

const AdminHome = ({ navigation }) => {
  // eslint-disable-next-line prettier/prettier
  const route = useRoute();
  const dispatch = useDispatch();
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const role = useSelector(state => state.location.role);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ status: false, message: '' });
  const [from, setFrom] = useState(getISTDate());
  const [to, setTo] = useState(getISTDate());
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [selectedValue, setSelectedValue] = useState('Today');
  const [dashboardValues, setDashboardValues] = useState({});
  const [series, setSeries] = useState([]);
  const [helplineSeries, setHelplineSeries] = useState([]);
  const [approvalStatus, setApprovalStatus] = useState({
    owner: false,
    clusterHead: false,
  });
  const [borderColor, setBorderColor] = useState('#0a0');

  const colors = ['#0a0', '#a00', '#00a', '#fa0', '#0af'];
  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //

  // const getTodayLocalDateString = () => {
  //   const today = new Date();
  //   const year = today.getFullYear();
  //   const month = String(today.getMonth() + 1).padStart(2, '0');
  //   const day = String(today.getDate()).padStart(2, '0');
  //   return `${year}-${month}-${day}`;
  // };

  // const [from, setFrom] = useState(getTodayLocalDateString());
  // const [to, setTo] = useState(getTodayLocalDateString());

  // console.log('From: ', from);
  // console.log('To: ', to);

  const renderStars = (rating = 0) => {
    const rounded = Math.round(rating * 2) / 2; // supports half stars
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) {
        stars.push('★'); // full star
      } else if (i - 0.5 === rounded) {
        stars.push('☆'); // half-ish visual fallback
      } else {
        stars.push('☆'); // empty star
      }
    }
    return stars.join(' ');
  };

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

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setBorderColor(colors[index]);
      index = (index + 1) % colors.length;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchDashboardValues(location);
  }, [fetchDashboardValues, from, location, to]);

  const fetchDashboardValues = useCallback(
    async location => {
      setApprovalStatus({
        owner: false,
        clusterHead: false,
      });
      try {
        setLoading(true);
        const response = await fetch(
          `${BACKEND_URL}/Dashboard?location=${location}&from=${from}&to=${to}`,
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
        if (res.approvalStatus[0]?.user1) {
          setApprovalStatus(prev => ({ ...prev, owner: true }));
        }

        if (res.approvalStatus[0]?.user2) {
          setApprovalStatus(prev => ({ ...prev, clusterHead: true }));
        }
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
        setSeries([
          { name: 'Missed', value: missedCount, color: '#DE3B40FF' },
          { name: 'Ans', value: answeredCount, color: '#14923EFF' },
        ]);
        setHelplineSeries([
          { name: 'Missed', value: helplineMissedCount, color: '#DE3B40FF' },
          { name: 'Out', value: helplineOutgoingCount, color: '#379AE6FF' },
          { name: 'Ans', value: helplineAnsweredCount, color: '#14923EFF' },
        ]);
      } catch (error) {
        console.log('Error ', error.message);
        setError({ status: true, message: error.message });
      } finally {
        setLoading(false);
        hideModal1();
      }
    },
    [from, to],
  );

  const updateValues = value => {
    setSelectedValue(value);
    if (value === 'Custom') {
      setVisible1(true);
      return;
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const currentDateIST = new Date(now.getTime() + istOffset);

    const formatDate = date => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (value === 'Today') {
      const today = formatDate(currentDateIST);
      setFrom(today);
      setTo(today);
    } else if (value === '7') {
      const lastWeekDate = new Date(currentDateIST);
      lastWeekDate.setUTCDate(currentDateIST.getUTCDate() - 7);

      setFrom(formatDate(lastWeekDate));
      setTo(formatDate(currentDateIST));
    } else if (value === '30') {
      const lastMonthDate = new Date(currentDateIST);
      lastMonthDate.setUTCDate(currentDateIST.getUTCDate() - 30);

      setFrom(formatDate(lastMonthDate));
      setTo(formatDate(currentDateIST));
    } else if (value === 'FY') {
      const currentYear =
        currentDateIST.getUTCMonth() < 3
          ? currentDateIST.getUTCFullYear() - 1
          : currentDateIST.getUTCFullYear();

      const fyStart = new Date(Date.UTC(currentYear, 3, 1)); // April 1st UTC
      setFrom(formatDate(fyStart));
      setTo(formatDate(currentDateIST));
    } else if (value === 'month') {
      const monthStart = new Date(
        Date.UTC(
          currentDateIST.getUTCFullYear(),
          currentDateIST.getUTCMonth(),
          1,
        ),
      );
      setFrom(formatDate(monthStart));
      setTo(formatDate(currentDateIST));
    } else if (value === 'Yesterday') {
      const yesterday = new Date(currentDateIST);
      yesterday.setUTCDate(currentDateIST.getUTCDate() - 1);
      setFrom(formatDate(yesterday));
      setTo(formatDate(yesterday));
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
    setFilterMode('custom');
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

  const buttons = [
    {
      image: require('../../assets/schedule.png'),
      label: 'Calling Calender',
      routeName: 'CallingList',
    },
    {
      image: require('../../assets/web-traffic.png'),
      label: 'Web Leads',
      routeName: 'WebLeads',
    },
    {
      image: require('../../assets/bot.png'),
      label: 'Bot Leads',
      routeName: 'BotLeads',
    },
    {
      image: require('../../assets/referral.png'),
      label: 'Reference Report',
      routeName: 'ReferenceData',
    },
    {
      image: require('../../assets/payment-due.png'),
      label: 'IPD Due List',
      routeName: 'IPDDueList',
    },
    {
      image: require('../../assets/pharmacy.png'),
      label: 'Evital Pharmacy',
      routeName: 'EvitalPharmacyData',
    },
  ];

  const [filterMode, setFilterMode] = useState('custom'); // 'month' | 'custom'

  const generateMonthsList = () => {
    const currentDate = new Date();
    const months = [];

    for (let i = 1; i <= 12; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i, // start from previous month
        1,
      );

      months.push({
        label: date.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        }),
        value: date,
      });
    }

    return months;
  };

  const [monthsList] = useState(generateMonthsList());
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]);

  const handleMonthChange = selected => {
    setSelectedMonth(selected);

    const from = new Date(
      selected.value.getFullYear(),
      selected.value.getMonth(),
      1,
    );

    const to = new Date(
      selected.value.getFullYear(),
      selected.value.getMonth() + 1,
      0,
    );

    setFromDate(from);
    setToDate(to);
  };

  function NpsIndicator({ value }) {
    return (
      <View style={styles.npsCard}>
        <Text style={styles.npsLabel}>Average NPS</Text>

        <View style={styles.starRow}>
          <Text style={styles.stars}>{renderStars(value)}</Text>
          <Text style={styles.scoreText}>{value?.toFixed(1) ?? '--'} / 5</Text>
        </View>
      </View>
    );
  }

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
                  height: 45, // 🔥 MUST be >= 44
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <Picker
                  selectedValue={location}
                  onValueChange={itemValue => dispatch(setLocation(itemValue))}
                  style={{
                    width: '100%',
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
                  {locationArray
                    ?.slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map((item, index) => (
                      <Picker.Item
                        style={{
                          fontSize: 13,
                          fontFamily: 'Lexend-Regular',
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
              label="Yesterday"
              value="Yesterday"
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
          {/* <Card style={styles.subContainer1}> */}
          <View
            style={{
              ...styles.btnMainContainer,
              justifyContent: 'center',
              marginTop: 12,
            }}
          >
            <Text style={{ ...styles.btnText, color: '#14923EFF' }}>
              We Served :{' '}
            </Text>
            <Text style={{ ...styles.btnText, color: '#14923EFF' }}>
              {dashboardValues?.totalPatients} Patients
            </Text>
          </View>

          {role === 'SuperAdmin' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('ApprovalStatus')}
              style={{
                flexDirection: 'column',
                marginBottom: 10,
                borderWidth: 2,
                borderColor: borderColor,
                borderRadius: 8,
                padding: 10,
              }}
            >
              <Text
                style={{
                  ...styles.status,
                  color: approvalStatus.owner ? '#0a0' : '#a00',
                }}
              >
                Partner Approval : {approvalStatus.owner ? 'Done' : 'Pending'}
              </Text>
              <Text
                style={{
                  ...styles.status,
                  color: approvalStatus.clusterHead ? '#0a0' : '#a00',
                }}
              >
                Cluster Head Approval :{' '}
                {approvalStatus.clusterHead ? 'Done' : 'Pending'}
              </Text>
            </TouchableOpacity>
          )}
          {/* </Card> */}
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('NpsPatientList');
            }}
            activeOpacity={0.6}
            // style={styles.buttonContainer}
          >
            <NpsIndicator value={dashboardValues?.nps_avg} />
          </TouchableOpacity>
          <Card style={styles.subContainer1}>
            <View style={styles.btnMainContainer}>
              <View style={{ width: '36%' }}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('AppointmentDetails', {
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
              <View style={{ width: '26%' }}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('IPDBillDetails', {
                      fromDate: from,
                      toDate: to,
                    });
                  }}
                  activeOpacity={0.6}
                  style={styles.buttonContainer}
                >
                  <Text style={{ ...styles.btnText, color: '#F9623EFF' }}>
                    IPD
                  </Text>
                  <Text style={{ ...styles.btnheading, color: '#F9623EFF' }}>
                    {dashboardValues?.ipd_count}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: '33%' }}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('DischargeCardDetails', {
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

          {/* <Pinar
            loop={false}
            showsControls
            showsDots={true}
            dotStyle={{
              backgroundColor: '#fff',
              width: 7,
              height: 7,
              margin: 4,
              borderRadius: 3.5,
            }}
            activeDotStyle={{
              backgroundColor: '#FFD700',
              width: 10,
              height: 10,
              margin: 4,
              borderRadius: 5,
            }}
            style={{height: 180}} // Adjust height as needed
          > */}
          {/* Slide 1: IVR Calls */}
          <Card style={styles.subContainer1}>
            <View style={styles.btnMainContainer}>
              <View style={{ width: '100%', justifyContent: 'flex-start' }}>
                <Text style={{ ...styles.btnText, paddingLeft: 15 }}>
                  IVR Calls
                </Text>
                {series.length > 0 ? (
                  <View style={styles.IVRContainer}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('IVRCall', {
                          fromDate: from,
                          toDate: to,
                          status: 'INCOMING',
                        })
                      }
                      activeOpacity={0.6}
                      style={styles.IVRSubContainer1}
                    >
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 16,
                          color: '#14923EFF',
                        }}
                      >
                        {dashboardValues.answered_count}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#14923EFF' }}>
                        Answered
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('IVRCall', {
                          fromDate: from,
                          toDate: to,
                          status: '',
                        })
                      }
                      activeOpacity={0.6}
                      style={{
                        width: '40%',
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
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('IVRCall', {
                          fromDate: from,
                          toDate: to,
                          status: 'MISSED',
                        })
                      }
                      activeOpacity={0.6}
                      style={styles.IVRSubContainer1}
                    >
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 16,
                          lineHeight: 22,
                          color: '#DE3B40FF',
                        }}
                      >
                        {dashboardValues.missed_count} /{' '}
                        <Text
                          style={{
                            fontFamily: 'Lexend-Regular',
                            fontSize: 16,
                            lineHeight: 22,
                            color: '#FFB300',
                          }}
                        >
                          {dashboardValues.attended_missed_count}
                        </Text>
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 12,
                          lineHeight: 22,
                          color: '#DE3B40FF',
                        }}
                      >
                        Missed /{' '}
                        <Text
                          style={{
                            fontFamily: 'Lexend-Regular',
                            fontSize: 12,
                            lineHeight: 22,
                            color: '#FFB300',
                          }}
                        >
                          Callback
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.btnheading}>0</Text>
                )}
              </View>
            </View>
          </Card>

          {/* Slide 2: Helpline Calls */}
          <Card style={styles.subContainer1}>
            <View style={styles.btnMainContainer}>
              <View style={{ width: '100%', justifyContent: 'flex-start' }}>
                <Text style={{ ...styles.btnText, paddingLeft: 15 }}>
                  Helpline Calls
                </Text>
                {helplineSeries.length > 0 ? (
                  <View style={styles.IVRContainer}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('HelplineCalls', {
                          fromDate: from,
                          toDate: to,
                          status: 'INCOMING',
                        })
                      }
                      activeOpacity={0.6}
                      style={styles.IVRSubContainer1}
                    >
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
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('HelplineCalls', {
                          fromDate: from,
                          toDate: to,
                          status: '',
                        })
                      }
                      activeOpacity={0.6}
                      style={{
                        width: '40%',
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
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('HelplineCalls', {
                          fromDate: from,
                          toDate: to,
                          status: 'MISSED',
                        })
                      }
                      activeOpacity={0.6}
                      style={styles.IVRSubContainer1}
                    >
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 16,
                          lineHeight: 22,
                          color: '#DE3B40FF',
                        }}
                      >
                        {dashboardValues.helpline_missed_count} /{' '}
                        <Text
                          style={{
                            fontFamily: 'Lexend-Regular',
                            fontSize: 16,
                            lineHeight: 22,
                            color: '#FFB300',
                          }}
                        >
                          {dashboardValues.helpline_attended_missed_count}
                        </Text>
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 12,
                          lineHeight: 22,
                          color: '#DE3B40FF',
                        }}
                      >
                        Missed /{' '}
                        <Text
                          style={{
                            fontFamily: 'Lexend-Regular',
                            fontSize: 12,
                            lineHeight: 22,
                            color: '#FFB300',
                          }}
                        >
                          Callback
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.btnheading}>0</Text>
                )}
              </View>
            </View>
          </Card>
          {/* </Pinar> */}

          <View style={styles.container}>
            {buttons.map((btn, index) => (
              <TouchableOpacity
                key={index}
                style={styles.circularButtonContainer}
                onPress={() =>
                  navigation.navigate(btn.routeName, {
                    fromDate: from,
                    toDate: to,
                  })
                }
                activeOpacity={0.5}
              >
                <View style={styles.circle}>
                  <Image source={btn.image} style={styles.image} />
                </View>
                <Text style={styles.label}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
                    navigation.navigate('OPDReportDetails', {
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
                    navigation.navigate('OPDReportDetails', {
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
                    navigation.navigate('OPDReportDetails', {
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
              <Card style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('OPDReportDetails', {
                      location: location,
                      fromDate: from,
                      toDate: to,
                      patientType: 'proctoscopy',
                    })
                  }
                >
                  <Text style={styles.text}>C+P</Text>
                  <Text style={styles.textHeading}>
                    {dashboardValues?.dailyOPDReport?.procto}
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
          </View>

          {/* <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{
                ...styles.btn,
                flexDirection: 'row',
                width: '100%',
                backgroundColor: '#FFF',
              }}
              onPress={() => navigation.navigate('ReferenceData')}>
              <Image
                style={{
                  height: 48,
                  width: 48,
                }}
                source={require('../../assets/referral.png')}
              />
              <Text style={styles.callingBtn}>Reference Report</Text>
            </TouchableOpacity>
          </View> */}

          <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ ...styles.btn, backgroundColor: '#DE3B40FF' }}
              onPress={() =>
                navigation.navigate('AdminIPDPayment', {
                  fromDate: from,
                  toDate: to,
                })
              }
            >
              <Text style={styles.btnText2}>IPD Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ ...styles.btn, backgroundColor: '#379AE6FF' }}
              onPress={() =>
                navigation.navigate('AdminOPDPayment', {
                  fromDate: from,
                  toDate: to,
                })
              }
            >
              <Text style={styles.btnText2}>OPD Collection</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ ...styles.btn, backgroundColor: '#171A1FFF' }}
              onPress={() =>
                navigation.navigate('AdminOPDIPDPayment', {
                  fromDate: from,
                  toDate: to,
                })
              }
            >
              <Text style={styles.btnText2}>OPD + IPD Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ ...styles.btn, backgroundColor: '#F9623EFF' }}
              onPress={() => navigation.navigate('DailyOPDPayment')}
            >
              <Text style={styles.btnText2}>Daily OPD Report</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnMainContainer}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ ...styles.btn, backgroundColor: 'rgb(72, 145, 7)' }}
              onPress={() =>
                navigation.navigate('ReportScreen', {
                  fromDate: from,
                  toDate: to,
                })
              }
            >
              <Text style={styles.btnText2}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              style={{ ...styles.btn, backgroundColor: 'rgb(72, 145, 7)' }}
              onPress={() =>
                navigation.navigate('pharmacyAnalysis', {
                  fromDate: from,
                  toDate: to,
                })
              }
            >
              <Text style={styles.btnText2}>Pharmacy Analysis</Text>
            </TouchableOpacity>
          </View>
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
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 20 }}>
                Filter
              </Text>
            </View>

            {/* Radio Buttons */}
            <View style={{ marginVertical: 10 }}>
              <RadioButton.Group
                onValueChange={value => setFilterMode(value)}
                value={filterMode}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <RadioButton value="month" />
                    <Text>Month-wise</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <RadioButton value="custom" />
                    <Text>Custom Date</Text>
                  </View>
                </View>
              </RadioButton.Group>
            </View>

            {/* Month-wise List */}
            {filterMode === 'month' && (
              <View style={{ marginVertical: 10 }}>
                <Text style={styles.profileInput}>Select Month</Text>

                <ModalDropdown
                  options={monthsList.map(month => month.label)}
                  defaultValue={selectedMonth?.label || 'Select Month'}
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 6,
                    padding: 12,
                    backgroundColor: '#fff',
                  }}
                  textStyle={{
                    fontSize: 14,
                    color: '#000',
                  }}
                  dropdownStyle={{
                    width: '80%',
                    height: 250,
                  }}
                  dropdownTextStyle={{
                    fontSize: 14,
                    padding: 10,
                  }}
                  onSelect={(index, value) => {
                    const selected = monthsList[index];
                    setSelectedMonth(selected);
                    handleMonthChange(selected);
                  }}
                />
              </View>
            )}

            {/* Custom Date Picker */}
            {filterMode === 'custom' && (
              <>
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
                      setOpen(false);
                      setFromDate(date);
                    }}
                    onCancel={() => setOpen(false)}
                    maximumDate={new Date()}
                  />
                </View>

                <Text style={{ ...styles.profileInput, marginTop: 10 }}>
                  To:
                </Text>
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
                    onCancel={() => setOpen2(false)}
                    minimumDate={fromDate}
                    maximumDate={new Date()}
                  />
                </View>
              </>
            )}

            {/* Buttons */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginTop: 20,
                }}
              >
                <Button
                  mode="outlined"
                  onPress={hideModal1}
                  style={{ width: 150 }}
                  textColor="#007bff"
                >
                  Back
                </Button>

                <Button
                  mode="contained"
                  onPress={handleClick}
                  style={{ width: 150, backgroundColor: '#007bff' }}
                >
                  Find
                </Button>
              </View>
            </KeyboardAvoidingView>

            {/* Loader */}
            <Dialog visible={loading1}>
              <Dialog.Content style={{ alignItems: 'center' }}>
                <Text>Processing...</Text>
                <ActivityIndicator size="large" color="#0d7592" />
              </Dialog.Content>
            </Dialog>
          </ScrollView>
        </Modal>
      </Portal>

      <BottomTab navigation={navigation} />
    </SafeAreaView>
  );
};

export default AdminHome;

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
    alignSelf: 'center',
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
    width: '30%',
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
    width: '33%',
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
  status: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'Lexend-Regular',
  },
  npsCard: {
    backgroundColor: '#EAF7EE',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 12,
  },

  npsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C6E47',
    marginBottom: 6,
  },

  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    fontSize: 22,
    color: '#F59E0B', // gold stars
    marginRight: 8,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14923E',
  },
});
