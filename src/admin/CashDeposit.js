/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
} from 'react-native';

import {
  Text,
  Button,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const CashDeposit = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);

  const [depositData, setDepositData] = useState([]);
  const [receiptData, setReceiptData] = useState(
    depositData.map(() => ({ cashDeposited: 0, receiptId: '', amountDiff: 0 })),
  );

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    fetchCashData(
      location,
      new Date().toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
    );
  }, [location]);

  useEffect(() => {
    // Initialize or reset receiptData based on the length of depositData
    setReceiptData(
      depositData.map(item => ({
        cashDeposited: item.cashDeposited || 0, // Default value for cashDeposited
        receiptId: item.receiptNo || '', // Default value for receiptId
        amountDiff: +item.OPDCash + +item.IPDCash - (+item.cashDeposited || 0), // Calculate initial amountDiff
      })),
    );
  }, [depositData]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, depositData.length));
  }, [depositData.length, itemsPerPage, page]);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const fetchCashData = (location, from, to) => {
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
        `${BACKEND_URL}/Deposit?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Deposit details: ', res);
          setDepositData(res);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  const handleSubmitReceipt = index => {
    const { cashDeposited, receiptId, amountDiff } = receiptData[index];
    if (!cashDeposited || !receiptId) {
      Alert.alert('Error', 'Please fill in the details..!');
      return;
    }
    if (amountDiff < 0) {
      Alert.alert(
        'Error',
        'Cash to be deposited is greater than total cash..!',
      );
      return;
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: depositData[index].date,
        IPDCash: depositData[index].IPDCash,
        OPDCash: depositData[index].OPDCash,
        total: depositData[index].IPDCash + depositData[index].OPDCash,
        cashDeposited,
        receiptId,
        amountDiff,
      }),
    };
    try {
      setLoading(true);
      fetch(
        `${BACKEND_URL}/Deposit?location=${location}`, // Moved location to query params
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Deposit details: ', res);
          fetchCashData(
            location,
            new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0],
          );
          Alert.alert('Cash deposited successfully..');
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error', error);
    }
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
            style={{ width: '25%' }}
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
          <Text style={styles.headerSubContainer}>Cash Deposit</Text>
          <Text style={{ ...styles.headerSubContainer, width: '25%' }}> </Text>
        </View>
        <ScrollView
          style={{
            height: '90%',
            width: '100%',
            paddingHorizontal: 3,
          }}
        >
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
          {depositData.length > 0 ? (
            depositData.slice(from, to).map((item, index) => (
              <View
                key={index}
                style={{
                  width: '100%',
                  backgroundColor: '#F1FDE9FF',
                  borderBottomColor: '#000',
                  borderBottomWidth: 1,
                  borderWidth: 1,
                  borderRadius: 4,
                  marginVertical: 5,
                  //marginHorizontal: 3,
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    display: 'flex',
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      width: '25%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={styles.text}>
                      {new Date(item.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '75%',
                      backgroundColor: '#FFF',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      borderLeftWidth: 3,
                      paddingLeft: 5,
                    }}
                  >
                    <View style={styles.textContainer}>
                      <View style={{ width: '50%' }}>
                        <Text>OPD Cash:</Text>
                      </View>
                      <View style={{ width: '50%' }}>
                        <Text>{item.OPDCash}</Text>
                      </View>
                    </View>
                    <View style={styles.textContainer}>
                      <View style={{ width: '50%' }}>
                        <Text>IPD Cash:</Text>
                      </View>
                      <View style={{ width: '50%' }}>
                        <Text>{item.IPDCash}</Text>
                      </View>
                    </View>
                    <View style={styles.textContainer}>
                      <View style={{ width: '50%' }}>
                        <Text>Total Cash:</Text>
                      </View>
                      <View style={{ width: '50%' }}>
                        <Text>{+item.OPDCash + +item.IPDCash}</Text>
                      </View>
                    </View>
                    <View style={styles.textInputContainer}>
                      <View style={{ width: '50%' }}>
                        <Text>Cash Deposited:</Text>
                      </View>
                      <View style={{ width: '50%' }}>
                        <TextInput
                          editable={!item.isDeposited}
                          style={styles.textInput}
                          placeholder="Cash Deposited"
                          value={
                            item.isDeposited
                              ? item.cashDeposited
                              : receiptData[index]?.cashDeposited || ''
                          }
                          onChangeText={val => {
                            const deposited = parseFloat(val) || 0;
                            const OPDCash = +item.OPDCash || 0;
                            const IPDCash = +item.IPDCash || 0;
                            const newReceiptData = [...receiptData];
                            newReceiptData[index] = {
                              ...newReceiptData[index],
                              cashDeposited: val,
                              amountDiff: OPDCash + IPDCash - deposited,
                            };
                            setReceiptData(newReceiptData);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={styles.textInputContainer}>
                      <View style={{ width: '50%' }}>
                        <Text>Receipt ID:</Text>
                      </View>
                      <View style={{ width: '50%' }}>
                        <TextInput
                          editable={!item.isDeposited}
                          style={styles.textInput}
                          placeholder="Receipt ID"
                          value={
                            item.isDeposited
                              ? item.receiptNo
                              : receiptData[index]?.receiptId || ''
                          }
                          onChangeText={val => {
                            const newReceiptData = [...receiptData];
                            newReceiptData[index] = {
                              ...newReceiptData[index],
                              receiptId: val,
                            };
                            setReceiptData(newReceiptData);
                          }}
                        ></TextInput>
                      </View>
                    </View>
                    <View style={styles.textContainer}>
                      <View style={{ width: '50%' }}>
                        <Text>Cash Difference:</Text>
                      </View>
                      <View style={{ width: '50%' }}>
                        <Text>
                          {item.isDeposited
                            ? item.cashDifference
                            : receiptData[index]?.amountDiff}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View
                  style={{
                    width: '100%',
                    backgroundColor: '#FFF',
                    alignItems: 'center',
                  }}
                >
                  <TouchableOpacity
                    disabled={item.isDeposited}
                    onPress={() => {
                      handleSubmitReceipt(index);
                    }}
                    style={{
                      height: 50,
                      width: 170,
                      borderWidth: 1,
                      borderRadius: 20,
                      marginVertical: 10,
                      backgroundColor: '#007bff',
                      opacity: item.isDeposited ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 16 }}>
                        Add receipt
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
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
                  fontSize: 22,
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
                height: 50,
                width: 170,
                borderWidth: 1,
                borderRadius: 20,
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
                <Text style={{color: '#fff', fontSize: 16}}>Filter</Text>
                <Text style={{color: '#fff', fontSize: 11}}>
                  {fromDate.toISOString().split('T')[0]} to{' '}
                  {toDate.toISOString().split('T')[0]}
                </Text>
              </View>
            </TouchableOpacity> */}

          <Button
            mode="outlined"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= depositData.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= depositData.length
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

export default CashDeposit;

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
    marginVertical: 8,
    paddingHorizontal: 10,
    width: '100%',
    height: 50,
    flexDirection: 'row',
    justifyContent: 'flex-start',
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
    fontSize: 16,
    lineHeight: 19,
    color: '#000000',
  },
  header: {
    fontSize: 16,
    color: '#000',
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
  textContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  text: {
    fontSize: 15,
    fontWeight: 600,
    color: '#000',
  },
  textInputContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    marginRight: 10,
    height: 36,
    marginVertical: 5,
    paddingHorizontal: 5,
  },
  headerSubContainer: {
    fontFamily: 'Lexend-Medium',
    fontSize: 16,
    width: '50%',
    textAlign: 'center',
  },
});
