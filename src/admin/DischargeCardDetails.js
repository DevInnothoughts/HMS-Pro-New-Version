/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/* eslint-disable react/react-in-jsx-scope */
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
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
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

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

const DischargeCardDetails = ({ navigation }) => {
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
    route.params?.fromDate ?? getISTDate(new Date()),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ?? getISTDate(new Date()),
  );
  const [tempFromDate, setTempFromDate] = useState(new Date());
  const [tempToDate, setTempToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);

  const [DCData, setDCData] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    fetchDCBills(location, fromDate, toDate);
  }, [fromDate, location, toDate]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, DCData.length));
  }, [DCData.length, itemsPerPage, page]);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const fetchDCBills = (location, from, to) => {
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
        `${BACKEND_URL}/Dashboard/dischargeCard?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Bill details: ', res);
          setDCData(res);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  // Function to export data to Excel
  const fetchDCData = async () => {
    try {
      setLoading1(true);
      console.log(fromDate);
      console.log(toDate);
      fetchDCBills(location, fromDate, toDate);
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
      setFromDate(getISTDate(tempFromDate));
      setToDate(getISTDate(tempToDate));
      await fetchDCData();
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  // let totalAmt = 0;
  // let totalDiscount = 0;
  // let totalPayable = 0;

  // // Calculate totals
  // DCData.forEach(item => {
  //   totalAmt += +item.totalamt;
  //   totalDiscount += +item.discount;
  //   totalPayable += +item.payable_amt;
  // });

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
          {/* <Card style={styles.cardTotal}>
            <TouchableOpacity
              style={{minWidth: 160, flexDirection: 'row'}}
              onPress={toggleExpand}
              activeOpacity={0.9}>
              <View style={{minWidth: 130, flexDirection: 'row'}}>
                <Text style={styles.header}> Total : ₹</Text>
                <Text style={styles.header}>
                  {new Intl.NumberFormat().format(totalPayable)}
                </Text>
              </View>
              <View
                style={{
                  width: 30,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
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
          </Card> */}
          <TouchableOpacity
            onPress={() => {
              setTempFromDate(new Date());
              setTempToDate(new Date());
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
        {/* {isExpanded && (
          <View style={styles.headerSubContainer}>
            <Card style={styles.card}>
              <Text style={styles.subHeader}>Total</Text>
              <Text style={styles.subHeader}>
                {new Intl.NumberFormat().format(totalAmt)}
              </Text>
            </Card>
            <Card style={styles.card}>
              <Text style={styles.subHeader}>Discount</Text>
              <Text style={styles.subHeader}>
                {new Intl.NumberFormat().format(totalDiscount)}
              </Text>
            </Card>
            <Card style={styles.card}>
              <Text style={styles.subHeader}>Payable</Text>
              <Text style={styles.subHeader}>
                {new Intl.NumberFormat().format(totalPayable)}
              </Text>
            </Card>
          </View>
        )} */}

        {DCData.length > 0 && (
          <View
            style={{
              width: '100%',
              height: 40,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              backgroundColor: '#CCC',
            }}
          >
            <View style={{ width: '62%', paddingLeft: 15 }}>
              <Text style={styles.medium}>PATIENT NAME</Text>
            </View>
            <View style={{ width: '28%' }}>
              <Text style={styles.medium}>MOBILE</Text>
            </View>
            <View style={{ width: '10%' }}>
              <Text> </Text>
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
          {DCData.length > 0 ? (
            DCData.slice(from, to).map((item, index) => (
              <Card
                key={index}
                style={{
                  backgroundColor:
                    expandedPatientId === item.patient_id
                      ? '#F5F1FEFF'
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
                    onPress={() => toggleExpandPatient(item.patient_id)}
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
                        width: '62%',
                        paddingHorizontal: 10,
                        flexDirection: 'column',
                      }}
                    >
                      <Text style={styles.medium}>{item.name}</Text>
                      {expandedPatientId === item.patient_id && (
                        <>
                          <Text style={styles.cell}>
                            Made By : {item.made_by}
                          </Text>
                          <Text style={styles.cell}>
                            Checked By : {item.checked_by}
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={{ width: '28%' }}>
                      <Text style={styles.medium}>{item.phone}</Text>
                    </View>
                    <View style={{ width: '10%' }}>
                      <Image
                        style={{
                          width: 26,
                          height: 26,
                          objectFit: 'contain',
                        }}
                        source={
                          expandedPatientId === item.patient_id
                            ? require('../../assets/up-arrow.png')
                            : require('../../assets/down-arrow.png')
                        }
                      />
                    </View>
                  </TouchableOpacity>

                  {expandedPatientId === item.patient_id && (
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
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Doctor Name</Text>
                          <View style={styles.amountSubContainer}>
                            {/* <Image
                              style={styles.amountIcon}
                              source={require('../../assets/cash.png')}
                            /> */}
                            <Text
                              style={styles.amount}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.doctor_name}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Surgery</Text>
                          <View style={styles.amountSubContainer}>
                            {/* <Image
                              style={styles.amountIcon}
                              source={require('../../assets/card.png')}
                            /> */}
                            <Text style={styles.amount}>
                              {item.surgeryadvice}
                            </Text>
                          </View>
                        </View>
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

        {/* Pagination Controls */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginHorizontal: 10,
            marginVertical: 8,
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

          {/* <TouchableOpacity
            onPress={() => {
              setFromDate(new Date());
              setToDate(new Date());
              setVisible1(true);
            }}
            style={{
              height: 42,
              width: 150,
              borderWidth: 1,
              borderRadius: 4,
              backgroundColor: '#007bff',
            }}>
            <View
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}>
              <Text
                style={{
                  fontFamily: 'Lexend-Regular',
                  color: '#fff',
                  fontSize: 16,
                }}>
                Filter
              </Text>
              <Text
                style={{
                  fontFamily: 'Lexend-Light',
                  color: '#fff',
                  fontSize: 9,
                }}>
                {fromDate.toLocaleDateString()} to {toDate.toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity> */}

          <Button
            mode="outlined"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= DCData.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= DCData.length
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
            <Text style={styles.profileInput}>From:</Text>
            <View style={styles.profileSection}>
              <Text
                style={{ padding: 10, ...styles.profileInput }}
                onPress={() => setOpen(true)}
              >
                {tempFromDate.toLocaleDateString('en-GB')}
              </Text>

              <DatePicker
                modal
                mode="date"
                open={open}
                date={tempFromDate}
                onConfirm={date => {
                  const date1 = date.toISOString().split('T')[0];
                  console.log('From:', new Date(date1));
                  setOpen(false);
                  setTempFromDate(date);
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
                {tempToDate.toLocaleDateString('en-GB')}
              </Text>

              <DatePicker
                modal
                mode="date"
                open={open2}
                date={tempToDate}
                onConfirm={date => {
                  const date1 = date.toISOString().split('T')[0];
                  console.log('To:', new Date(date1));
                  setOpen2(false);
                  setTempToDate(date);
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

export default DischargeCardDetails;

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
    height: 55,
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
  cell: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
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
    width: '95%',
    minHeight: 42,
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
    width: '49%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
    width: '95%',
    textAlign: 'left',
  },
  amountIcon: {
    width: 20,
    height: 20,
    objectFit: 'contain',
    marginRight: 6,
  },
  amount: {
    width: '95%',
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    overflow: 'hidden',
    textAlign: 'left', // Align text to the left
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
});
