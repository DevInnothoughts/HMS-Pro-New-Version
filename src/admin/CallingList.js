/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/* eslint-disable react/react-in-jsx-scope */
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
  Avatar,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { SafeAreaView } from 'react-native-safe-area-context';

const getTodayISTDate = date => {
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

const CallingList = ({ navigation }) => {
  const location = useSelector(state => state.location.value);

  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [fromDate, setFromDate] = useState(new Date());
  const [dateRange, setDateRange] = useState();
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [open, setOpen] = useState(false);

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'SurgeryOPD', title: 'Surgery Advised' },
    { key: 'MedicationOPD', title: 'Medication Advised' },
    { key: 'TestOPD', title: 'Test Advised' },
    { key: 'Enquiry', title: 'Enquiry' },
    { key: 'PostOp', title: 'Post-Op' },
  ]);

  const [callingListData, setCallingListData] = useState({
    SurgeryOPD: [],
    MedicationOPD: [],
    TestOPD: [],
    Enquiry: [],
    PostOp: [],
  });

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    fetchCallingList(location, getTodayISTDate(fromDate));
  }, [location]);

  const fetchCallingList = useCallback((location, from) => {
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
        `${BACKEND_URL}/callingList?location=${location}&date=${from}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Call details: ', res);
          setCallingListData(res);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  }, []);

  // Function to export data to Excel
  const fetchCallingData = async () => {
    try {
      setLoading1(true);
      console.log(getTodayISTDate(fromDate));
      fetchCallingList(location, getTodayISTDate(fromDate));
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    } finally {
      setLoading1(false);
      hideModal1();
    }
  };

  // Function to handle button click
  const handleClick = async () => {
    try {
      await fetchCallingData();
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  const renderItem = ({ item }) => {
    //console.log(item.calling_notes);
    return (
      <View
        style={{
          flexDirection: 'column',
          paddingVertical: 16,
          paddingHorizontal: 8,
          margin: 8,
          borderWidth: 0.3,
          borderRadius: 8,
          backgroundColor: '#fff',
          elevation: 2,
        }}
      >
        <View style={styles.listItem}>
          <Text style={{ ...styles.patientPhone, textAlign: 'center' }}>
            {new Date(item.date).toLocaleDateString('en-GB')}
          </Text>
          <Avatar.Text size={28} label={`${item.days_since}`} />
        </View>
        <View style={styles.listItem}>
          <View style={styles.detailsContainer}>
            <Text style={styles.patientName}>{item.name}</Text>
            <Text style={styles.patientPhone}>{item.phone}</Text>
          </View>
          <View style={styles.detailsContainer}>
            <Text style={styles.patientPhone}>{item.diagnosis}</Text>
          </View>
        </View>
        {item.calling_notes && JSON.parse(item.calling_notes) !== null && (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: '#ccc',
                margin: 10,
              }}
            />
            <Text
              style={{
                ...styles.patientName,
                textAlign: 'center',
                marginVertical: 5,
              }}
            >
              Action Taken
            </Text>
            {JSON.parse(item.calling_notes).map((note, index) => (
              <View
                key={index}
                style={{ flexDirection: 'row', justifyContent: 'space-around' }}
              >
                <Text style={{ ...styles.patientPhone, width: '70%' }}>
                  {index + 1}.{note.note}
                </Text>
                <Text style={{ ...styles.patientPhone, width: '25%' }}>
                  {new Date(note.date).toLocaleDateString('en-GB')}
                </Text>
              </View>
            ))}
          </>
        )}
        {/* Divider */}
      </View>
    );
  };

  const renderScene = ({ route }) => {
    //const key = route.key.replace('days', ' days');
    const data = callingListData[route.key] || [];
    //console.log(data);
    return data.length > 0 ? (
      <>
        {/* <View
          style={{
            ...styles.listItem,
            backgroundColor: '#FFF',
            marginHorizontal: 16,
            paddingVertical: 8,
          }}>
          <View style={styles.detailsContainer}>
            <Text style={styles.patientName}>Patient Details</Text>
          </View>
          <View style={styles.detailsContainer}>
            <Text style={styles.patientName}>Diagnosis</Text>
          </View>
        </View> */}
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          estimatedItemSize={70}
          contentContainerStyle={styles.listContainer}
        />
      </>
    ) : (
      <Text
        style={{
          margin: 20,
          fontSize: 22,
          fontWeight: '600',
          color: '#000',
          textAlign: 'center',
        }}
      >
        No record available!
      </Text>
    );
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

          <TouchableOpacity
            onPress={() => {
              setFromDate(new Date());
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

        {loading ? (
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
        ) : (
          <TabView
            navigationState={{ index, routes }}
            renderScene={renderScene}
            onIndexChange={setIndex}
            renderTabBar={props => (
              <TabBar
                {...props}
                style={styles.tabBar}
                indicatorStyle={styles.indicatorStyle}
                labelStyle={styles.labelStyle}
                scrollEnabled={true}
              />
            )}
            style={{ backgroundColor: 'transparent' }}
          />
        )}
      </View>

      {
        //Filter Modal
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
            <Text style={styles.profileInput}>Select Date</Text>
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
            {/* <Text style={{...styles.profileInput, marginTop: 10}}>To:</Text>
            <View style={styles.profileSection}>
              <Text
                style={{padding: 10, ...styles.profileInput}}
                onPress={() => setOpen2(true)}>
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
              />
            </View> */}

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
    </SafeAreaView>
  );
};

export default CallingList;

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
    minHeight: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    //backgroundColor: '#F2FFF2FF',
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
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  detailsContainer: {
    flex: 1,
  },
  patientName: {
    fontFamily: 'Lexend-Medium',
    fontSize: 15,
    color: '#000',
  },
  patientPhone: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: '#555',
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    marginHorizontal: 5,
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  tabBar: {
    backgroundColor: '#247360',
  },
  indicatorStyle: {
    backgroundColor: '#ffffff',
  },
  labelStyle: {
    color: '#ffffff',
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
  },
});
