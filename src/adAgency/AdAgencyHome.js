import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { clearLocation } from '../store/locationSlice';
import { Picker } from '@react-native-picker/picker';
import ModalDropdown from 'react-native-modal-dropdown';
import DatePicker from 'react-native-date-picker';
import { RadioButton, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeadsStatsDashboard from './LeadsStatsDashboard';
import { exportToExcel } from './ExportToExcel'; // <-- adjust path if needed

const getISTDate = date => {
  const now = new Date(date);

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

const Colors = {
  primary: '#3B6D11',
  secondary: '#BA7517',
  error: '#E24B4A',
  warning: '#EF9F27',
  background: '#F4F6F4',
  white: '#fff',
  border: 'rgba(0,0,0,0.07)',
  textDark: '#18181A',
  textMedium: '#6B6A68',
  textLight: '#A09F9C',
  success: '#0D6644',
  info: '#185FA5',
  purple: '#7A1B78',
  lightGreen: '#9FE1CB',
  lightBlue: '#E3EFFE',
  lightPurple: '#FDE8FB',
  lightGreenBg: '#D9F2EA',
  lightGray: '#F0EEE9',
  lightBeige: '#FAEEDA',
  lightGrayBg: '#F7F6F2',
};

const adAgencyHome = ({ navigation }) => {
  // eslint-disable-next-line prettier/prettier
  const dispatch = useDispatch();
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(getISTDate(new Date()));
  const [to, setTo] = useState(getISTDate(new Date()));
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [selectedValue, setSelectedValue] = useState('Today');
  const [borderColor, setBorderColor] = useState('#0a0');
  const [statsData, setStatsData] = useState(null); // <-- holds data for Excel export

  const colors = ['#0a0', '#a00', '#00a', '#fa0', '#0af'];
  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //

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
    const newFrom = getISTDate(fromDate);
    const newTo = getISTDate(toDate);

    setFrom(newFrom);
    setTo(newTo);

    setVisible1(false); // close modal
  };

  // Export the statistics shown in the dashboard to an Excel file
  const handleExportExcel = async () => {
    if (!statsData || statsData.length === 0) {
      Alert.alert('Please wait', 'Statistics are still loading.');
      return;
    }

    // Flatten one channel into clean rows
    const buildRows = mode =>
      statsData.map(s => {
        const b =
          mode === 'web'
            ? s.web
            : mode === 'chatbot'
            ? s.chatbot
            : mode === 'ivr'
            ? s.ivr
            : s.combined;
        const total = b?.total || 0;
        return {
          Location: s.location,
          Total: total,
          Appointments: b?.appointment || 0,
          'Clinic Visits': b?.actualVisitCount || 0,
          IPD: b?.ipd || 0,
          'Conversion %':
            total === 0 ? 0 : Math.round((b.appointment / total) * 100),
        };
      });

    try {
      setLoading(true);
      await exportToExcel({
        sheets: [
          { name: 'Combined', data: buildRows('combined') },
          { name: 'Web', data: buildRows('web') },
          { name: 'Bot', data: buildRows('chatbot') },
          { name: 'IVR', data: buildRows('ivr') },
        ],
        fileName: `HHC_LeadStats_${from}_to_${to}`,
      });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        console.error('Export Error:', e);
        Alert.alert('Export failed', e?.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

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
            {/* {locationArray && locationArray.length > 0 ? (
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
            )} */}
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
              color: '#000',
            }}
            onValueChange={(itemValue, itemIndex) => {
              updateValues(itemValue);
            }}
          >
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="Today"
              value="Today"
            />
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="Yesterday"
              value="Yesterday"
            />
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="Last 7 Days"
              value="7"
            />
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="Last 30 Days"
              value="30"
            />
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="This Month"
              value="month"
            />
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="This F.Y."
              value="FY"
            />
            <Picker.Item
              style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
                color: '#000',
              }}
              label="Custom Date"
              value="Custom"
            />
          </Picker>
        </View>
      </View>

      {/* ---- Export bar (active range + download button) ---- */}
      <View style={styles.exportBar}>
        <Text style={styles.exportRange}>
          {from} {'  →  '} {to}
        </Text>
        <TouchableOpacity
          style={[styles.exportBtn, !statsData && styles.exportBtnDisabled]}
          onPress={handleExportExcel}
          disabled={!statsData}
          activeOpacity={0.7}
        >
          <Text style={styles.exportBtnText}>⬇ Export Excel</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, margin: 0, padding: 0 }}>
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

        <LeadsStatsDashboard from={from} to={to} onStatsLoaded={setStatsData} />
      </View>

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
    </SafeAreaView>
  );
};

export default adAgencyHome;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    //alignItems: 'center',
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
  // ---- Export bar ----
  exportBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportRange: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: Colors.textMedium,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  exportBtnDisabled: {
    backgroundColor: '#9FB4C0',
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Lexend-Medium',
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
    //width: '45%',
    height: 90,
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
  // Hero band
  heroBand: {
    backgroundColor: Colors.primary,
    width: '43%',
    height: 90,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 11,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  heroCount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroSub: {
    fontSize: 11,
    color: Colors.lightGreen,
    marginTop: 2,
  },
  // npsCard: {
  //   backgroundColor: Colors.white,
  //   borderRadius: 14,
  //   borderWidth: 0.5,
  //   borderColor: Colors.border,
  //   paddingVertical: 12,
  //   paddingHorizontal: 14,
  //   flex: 1,
  // },
  // npsLabel: {
  //   fontSize: 10,
  //   color: Colors.textLight,
  //   textTransform: 'uppercase',
  //   letterSpacing: 0.4,
  //   marginBottom: 6,
  // },
  npsVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.secondary,
    marginLeft: 4,
  },
  npsSub: {
    fontSize: 10,
    color: Colors.textLight,
  },
  statCardBlue: {
    backgroundColor: Colors.lightBlue,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(55,138,221,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statCardSmall: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
});
