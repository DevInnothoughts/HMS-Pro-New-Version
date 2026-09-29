import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Portal,
  Modal,
  RadioButton,
  Button,
} from 'react-native-paper';
import ModalDropdown from 'react-native-modal-dropdown'; // Import the library
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = 'https://wedoc.in/hms';
const now = new Date();
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

const ApprovalStatus = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [approvalData, setApprovalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible1, setVisible1] = useState(false);
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(lastDayOfMonth);

  const generateMonthsList = () => {
    const currentDate = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
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

  const [filterType, setFilterType] = useState('month');
  const [monthsList, setMonthsList] = useState(generateMonthsList());
  const [month, setMonth] = useState(monthsList[0].label);
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]);

  const hideModal1 = () => {
    setVisible1(false);
  };

  const handleMonthChange = async index => {
    const selected = monthsList[index];
    console.log(monthsList);
    console.log(selected);
    setSelectedMonth(selected);
    setMonth(selected.label);

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

    console.log('From:', from.toLocaleDateString('en-CA'));
    console.log('To:', to.toLocaleDateString('en-CA'));
    setFromDate(from);
    setToDate(to);
    fetchReferenceTypeCounts(
      location,
      from.toLocaleDateString('en-CA'),
      to.toLocaleDateString('en-CA'),
    );
    hideModal1();
    // Set from and to dates here based on your state logic
    // Example: setFromDate(from); setToDate(to);
  };

  const handleClick = async () => {
    try {
      if (filterType === 'month' && !selectedMonth) {
        Alert.alert('Error!', 'Please select a month.');
        return;
      }

      if (filterType === 'month') {
        setMonth(selectedMonth.label);
      }
      await fetchStatus();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      console.log(fromDate);
      console.log(toDate);
      fetchReferenceTypeCounts(
        location,
        fromDate.toLocaleDateString('en-CA'),
        toDate.toLocaleDateString('en-CA'),
      );
      setSelectedMonth(null);
    } catch (error) {
      console.error('Error fetching convincing score:', error);
    } finally {
      hideModal1();
    }
  };

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toLocaleDateString('en-CA');
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).toLocaleDateString('en-CA');

    fetchReferenceTypeCounts(location, startOfMonth, endOfMonth);
  }, [location]);

  const fetchReferenceTypeCounts = async (location, from, to) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/approval/approvalStatusSummary?location=${location}&from=${from}&to=${to}`,
      );
      const result = await response.json();
      console.log(result);
      setApprovalData(
        result.map(item => ({
          ...item,
          date: formatDate(new Date(item.date)),
        })),
      );
      //setApprovalData(result);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = date => {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(date.getTime() + istOffsetMs);
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateMonthDates = () => {
    const dates = [];

    const today = new Date(); // Current date
    today.setHours(0, 0, 0, 0); // Strip time part to compare dates only

    const start = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate(),
    );

    const end = new Date(
      toDate.getFullYear(),
      toDate.getMonth(),
      toDate.getDate(),
    );

    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
      if (d.getTime() < today.getTime()) {
        dates.push(formatDate(d));
      }
    }

    console.log(dates);
    return dates;
  };

  const getRowData = dateStr => {
    const record = approvalData.find(item => item.date === dateStr);
    return {
      date: dateStr,
      user1: record ? (record.user1 ? '✅' : '❌') : '❌',
      user2: record ? (record.user2 ? '✅' : '❌') : '❌',
    };
  };

  if (loading) {
    return (
      <ActivityIndicator
        animating={true}
        size="large"
        style={{ marginTop: 40 }}
      />
    );
  }

  const monthDates = generateMonthDates();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
        <View>
          <Text style={styles.headerText}>Approval Status</Text>
          <Text style={styles.header}>{month}</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            setVisible1(true);
          }}
        >
          <Image
            style={{
              height: 30,
              width: 30,
              tintColor: '#184D67',
            }}
            source={require('../../assets/filter.png')}
          />
        </TouchableOpacity>
      </View>
      {/* Table Header */}
      <View style={[styles.row, styles.header]}>
        <Text style={[styles.cell, styles.headerText]}>Date</Text>
        <Text style={[styles.cell, styles.headerText]}>Partner</Text>
        <Text style={[styles.cell, styles.headerText]}>Cluster Head</Text>
      </View>

      <FlatList
        data={monthDates}
        keyExtractor={item => item}
        renderItem={({ item }) => {
          const row = getRowData(item);
          return (
            <View style={styles.row}>
              <Text style={styles.cell}>{row.date}</Text>
              <Text style={styles.cell}>{row.user1}</Text>
              <Text style={styles.cell}>{row.user2}</Text>
            </View>
          );
        }}
        style={{ marginBottom: 100 }}
      />
      <Portal>
        <Modal
          visible={visible1}
          onDismiss={hideModal1}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            {/* Show Month Dropdown if Month-wise is selected */}
            {filterType === 'month' && (
              <ModalDropdown
                style={styles.dropdown}
                textStyle={styles.dropdownText}
                dropdownStyle={styles.dropdownList}
                dropdownTextStyle={styles.dropdownItemText}
                options={monthsList.map(item => item.label)}
                onSelect={handleMonthChange}
                defaultValue="Select Month"
              />
            )}
            {/* <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={hideModal1}
                  style={styles.button}
                  textColor="#007bff">
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={handleClick}
                  style={[styles.button, styles.findButton]}>
                  Find
                </Button>
              </View>
            </KeyboardAvoidingView> */}
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  header: {
    fontFamily: 'Lexend-Regular',
    textAlign: 'center',
    //borderBottomWidth: 2,
  },
  cell: {
    flex: 1,
    textAlign: 'center',
  },
  headerText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 10,
    width: '100%',
    height: 50,
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
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },

  subHeader: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
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
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 5,
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
  },
  bold: {
    fontFamily: 'Lexend-Bold',
    fontSize: 14,
    marginVertical: 5,
  },
  medium: {
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    marginVertical: 5,
  },
  title: {
    fontFamily: 'Lexend-Bold',
    fontSize: 20,
  },
  label: {
    fontFamily: 'Lexend-Regular',
    fontSize: 16,
    marginBottom: 10,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  dropdownText: {
    fontSize: 16,
    fontFamily: 'Lexend-Medium',
    color: '#000',
  },
  dropdownList: {
    width: '80%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  dropdownItemText: {
    fontSize: 16,
    padding: 10,
    fontFamily: 'Lexend-Regular',
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
  },
  button: {
    width: 150,
  },
  findButton: {
    backgroundColor: '#007bff',
  },
});

export default ApprovalStatus;
