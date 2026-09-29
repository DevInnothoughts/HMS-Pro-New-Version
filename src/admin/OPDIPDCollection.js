import { useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native';
import DatePicker from 'react-native-date-picker';

import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Modal,
  Portal,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Table,
  Row,
  Rows,
  TableWrapper,
  Col,
} from 'react-native-table-component';
import { useSelector } from 'react-redux';

const OPDIPDCollection = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [TotalIPDCollectionData, setTotalIPDCollectionData] = useState([]);
  const [TotalOPDCollectionData, setTotalOPDCollectionData] = useState([]);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [DateWiseCollection, setDateWiseCollection] = useState([]);
  const [overallCollection, setOverallCollection] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchOPDIPDCollection(
        location,
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0],
      );
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, DateWiseCollection.length));
  }, [DateWiseCollection.length, itemsPerPage, page]);

  const hideModal1 = () => {
    setVisible1(false);
  };

  const hideModal = () => {
    setVisible(false);
  };

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const requestOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
  };

  // const fetchTotalIPDCollection = async (location, from, to) => {
  //   try {
  //     const response = await fetch(
  //       `${BACKEND_URL}/IPDCollection/getTotal?location=${location}&from=${from}&to=${to}`,
  //     );
  //     if (!response.ok) {
  //       throw new Error('Network response was not ok');
  //     }
  //     const res = await response.json();
  //     console.log('IPD:', res);
  //     setTotalIPDCollectionData(res);
  //   } catch (error) {
  //     console.error('Error fetching IPD collection data:', error);
  //   }
  // };

  const fetchOPDIPDCollection = async (location, from, to) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/OPDCollection/getTotal?location=${location}&from=${from}&to=${to}`,
      );
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const res = await response.json();
      console.log('OPD+IPD:', res);
      setDateWiseCollection(res.transformedData);
      setOverallCollection(res.overallCollection);
    } catch (error) {
      console.error('Error fetching OPD collection data:', error);
    }
  };

  // Function to export data to Excel
  const fetchIPDOPDData = async () => {
    try {
      setLoading1(true);
      setLoading(true);
      //console.log(fromDate);
      //console.log(toDate);

      await fetchOPDIPDCollection(
        location,
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0],
      );
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    } finally {
      setLoading1(false);
      setLoading(false);
      hideModal1();
    }
  };

  // Function to handle button click
  const handleClick = async () => {
    try {
      await fetchIPDOPDData();
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
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
          <Card style={styles.cardTotal}>
            <TouchableOpacity
              style={{ minWidth: 160, flexDirection: 'row' }}
              onPress={() => setVisible(true)}
              activeOpacity={0.9}
            >
              <View
                style={{
                  minWidth: 160,
                  flexDirection: 'row',
                  paddingHorizontal: 5,
                }}
              >
                <Text style={styles.header}> Total : ₹</Text>
                <Text style={styles.header}>
                  {new Intl.NumberFormat().format(
                    (overallCollection.length > 0 &&
                      overallCollection[4][0] + overallCollection[4][1]) ||
                      0,
                  )}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>
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
                color={'#0d7592'}
              />
            </Dialog>
          </Portal>
          {DateWiseCollection.length > 0 ? (
            DateWiseCollection.slice(from, to).map((item, index) => (
              <Card
                key={index}
                style={{
                  backgroundColor: '#FFF',

                  borderWidth: 1,
                  borderColor: '#777',
                  borderRadius: 4,
                  marginVertical: 6,
                  marginHorizontal: 2,
                }}
              >
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      color: '#000',
                      fontSize: 16,
                      fontFamily: 'Lexend-Medium',
                    }}
                  >
                    {new Date(item[0]).toLocaleDateString()}
                  </Text>
                  <Table borderStyle={styles.border}>
                    <Row
                      data={['', 'Cash', 'Card', 'Online', 'Dscnt']}
                      flexArr={[1, 1, 1, 1, 1]}
                      style={styles.head}
                      textStyle={styles.headerText}
                    />
                    <TableWrapper style={{ flexDirection: 'row' }}>
                      <Col
                        data={['IPD', 'OPD', 'TOTAL']}
                        style={{
                          flex: 1,
                          backgroundColor: '#F1FDE9FF',
                        }}
                        heightArr={[40, 40, 40]}
                        textStyle={styles.headerText}
                      />
                      <Rows
                        data={item[1]}
                        style={styles.row}
                        flexArr={[1, 1, 1, 1]}
                        textStyle={styles.text}
                      />
                    </TableWrapper>
                  </Table>
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
            disabled={(page + 1) * itemsPerPage >= DateWiseCollection.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= DateWiseCollection.length
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

      {
        //Total OPD and IPD Modal
      }
      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
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
                IPD and OPD Collection
              </Text>
            </View>
            <Table borderStyle={styles.border}>
              <Row
                data={['', 'IPD', 'OPD']}
                flexArr={[0.8, 1, 1]}
                style={styles.head}
                textStyle={styles.headerText}
              />
              <TableWrapper style={{ flexDirection: 'row' }}>
                <Col
                  data={['Cash', 'Card', 'Online', 'Discount', 'Total']}
                  style={{
                    flex: 2,
                    backgroundColor: '#F1FDE9FF',
                  }}
                  heightArr={[40, 40, 40, 40, 40]}
                  textStyle={styles.headerText}
                />
                <Rows
                  data={overallCollection}
                  style={styles.row}
                  flexArr={[1, 1, 1, 1, 1]}
                  textStyle={styles.text}
                />
              </TableWrapper>
            </Table>

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
                    hideModal();
                  }}
                  style={{ width: 150 }}
                  textColor="#0d7592"
                >
                  Done
                </Button>
              </View>
            </KeyboardAvoidingView>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

export default OPDIPDCollection;
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
  head: { height: 50, backgroundColor: '#F1FDE9FF' },
  row: { height: 40, backgroundColor: '#FFF' },
  headerText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    textAlign: 'center',
    verticalAlign: 'middle',
    color: '#000',
  },
  headText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  text: {
    fontFamily: 'Lexend-Regular',

    color: '#000',
    fontSize: 12,
    textAlign: 'center',
  },
  modalText: {
    fontFamily: 'Lexend-Regular',

    color: '#000',
    fontSize: 14,
    textAlign: 'center',
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
  totalText: {
    fontSize: 16,
    fontWeight: '600',
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
  border: {
    borderWidth: 1,
    borderColor: '#ddd',
  },
});
