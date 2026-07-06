import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import ModalDropdown from 'react-native-modal-dropdown';
import DatePicker from 'react-native-date-picker';
import { Button, Dialog } from 'react-native-paper';
import { Modal, Portal } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

const formatDateIST = date => {
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

const SpecialityAnalytics = ({ navigation, from, to }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [visible1, setVisible1] = useState(false);
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [loading1, setLoading1] = useState(false);

  const fetchConditionwiseReport = (location, fromDate, toDate) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };
    console.log('From', fromDate);
    console.log('To', toDate);

    try {
      setLoading(true);
      fetch(
        `${BACKEND_URL}/report/conditionwiseReport?location=${location}&from=${formatDateIST(
          fromDate,
        )}&to=${formatDateIST(toDate)}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('conditionwiseReport details: ', res);
          setData(res.conditionwiseReport);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  useEffect(() => {
    fetchConditionwiseReport(location, fromDate, toDate);
  }, []);

  const maxValue = Math.max(...data.map(item => item.patient_count), 0);

  const renderItem = ({ item }) => {
    const barWidth =
      maxValue > 0 ? (item.patient_count / maxValue) * (width - 120) : 0;

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.speciality}>{item.speciality}</Text>
          <Text style={styles.count}>{item.patient_count}</Text>
        </View>

        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: barWidth }]} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const hideModal1 = () => {
    setVisible1(false);
  };

  const handleClick = async () => {
    try {
      await fetchConditionwiseReport(location, fromDate, toDate);
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  return (
    <View style={styles.container}>
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

        <Text style={styles.header}>Condition-wise Report</Text>

        <TouchableOpacity
          onPress={() => {
            setFromDate(new Date());
            setToDate(new Date());
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

      <Text style={styles.title}>Speciality Analytics</Text>

      <FlatList
        data={data}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <Portal>
        <Modal
          visible={visible1}
          onDismiss={hideModal1}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <View style={{ display: 'flex', alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: 'Lexend-Bold',
                  fontSize: 20,
                  color: '#000',
                }}
              >
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
                  buttonColor="#0d7592"
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
    </View>
  );
};

export default SpecialityAnalytics;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  speciality: {
    fontSize: 16,
    fontWeight: '500',
  },
  count: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#E6EAF0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 6,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  modal: {
    backgroundColor: 'white',
    paddingVertical: 50,
    paddingHorizontal: 20,
    marginHorizontal: 10,
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
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
});
