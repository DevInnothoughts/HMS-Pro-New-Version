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
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const statusList = [
  'CONSULTATION',
  'PROCTOSCOPY',
  'FOLLOW-UP',
  'BUGSPEAKS',
  'LAB',
  'OTHER',
];

const OPDCollectionReport = ({ navigation }) => {
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
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [OPDCollectionData, setOPDCollectionData] = useState([]);
  const [billType, setBillType] = useState('');
  const [summaryData, setSummaryData] = useState({});
  const [uniquePatientCount, setUniquePatientCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRecords2, setFilteredRecords2] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    fetchOPDCollection(
      location,
      fromDate.toISOString().split('T')[0],
      toDate.toISOString().split('T')[0],
    );
  }, []);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, filteredRecords.length));
  }, [filteredRecords.length, itemsPerPage, page]);

  let totalCash = 0;
  let totalCard = 0;
  let totalOnline = 0;
  let totalCheque = 0;

  // Calculate totals
  filteredRecords.forEach(item => {
    item.payment_mode === 'Cash' && (totalCash += item.total);
    item.payment_mode === 'Card' && (totalCard += item.total);
    item.payment_mode === 'Online' && (totalOnline += item.total);
    item.payment_mode === 'Cheque' && (totalCheque += item.total);
  });

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const fetchOPDCollection = (location, from, to) => {
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
        `${BACKEND_URL}/OPDCollection/v3?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Doctor details: ', res.data);
          setOPDCollectionData(res.data);
          const uniquePatientCount = new Set(
            res.data.map(row => row.patient_id),
          ).size;
          //
          setUniquePatientCount(uniquePatientCount);
          setFilteredRecords(res.data);
          setFilteredRecords2(res.data);
          setSummaryData(res.consultationPaymentModeTotals);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  const handleBillTypeSelect = type => {
    setBillType(type);
    setSearchQuery('');

    if (type) {
      const filtered =
        type !== 'OTHER'
          ? OPDCollectionData.filter(item => item.consultation === type)
          : OPDCollectionData.filter(
              item =>
                item.consultation !== 'CONSULTATION' &&
                item.consultation !== 'PROCTOSCOPY' &&
                item.consultation !== 'FOLLOW-UP' &&
                item.consultation !== 'BUGSPEAKS' &&
                item.consultation !== 'LAB',
            );
      setFilteredRecords(filtered);
      setFilteredRecords2(filtered);
      const uniquePatientCount = new Set(filtered.map(row => row.patient_id))
        .size;
      //
      setUniquePatientCount(uniquePatientCount);
    } else {
      setFilteredRecords(OPDCollectionData); // Show all if cleared
      setFilteredRecords2(OPDCollectionData);
      const uniquePatientCount = new Set(
        OPDCollectionData.map(row => row.patient_id),
      ).size;
      //
      setUniquePatientCount(uniquePatientCount);
    }
  };

  // Function to export data to Excel
  const fetchOPDData = async () => {
    try {
      setLoading1(true);
      console.log(fromDate);
      console.log(toDate);
      fetchOPDCollection(
        location,
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0],
      );
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
      await fetchOPDData();
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

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

  const searchCallerNumber = query => {
    setSearchQuery(query);

    if (query.trim() === '') {
      const count = new Set(filteredRecords2.map(row => row.patient_id)).size;
      setUniquePatientCount(count);
      setFilteredRecords(filteredRecords2); // Reset to full list when empty
    } else {
      const filtered = filteredRecords2.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()),
      );
      const count = new Set(filtered.map(row => row.patient_id)).size;
      setUniquePatientCount(count);
      setFilteredRecords(filtered);
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
              style={{
                minWidth: 160,
                flexDirection: 'row',
                paddingHorizontal: 5,
              }}
              onPress={toggleExpand}
              activeOpacity={0.9}
            >
              <View style={{ minWidth: 130, flexDirection: 'column' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={styles.header}> Total : ₹</Text>
                  <Text style={styles.header}>
                    {new Intl.NumberFormat().format(
                      totalCash + totalCard + totalOnline,
                    )}
                  </Text>
                </View>
                <Text style={{ ...styles.cell, textAlign: 'center' }}>
                  {new Date(fromDate).toLocaleDateString('en-GB')}-
                  {new Date(toDate).toLocaleDateString('en-GB')}
                </Text>
              </View>
              <View
                style={{
                  width: 30,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
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
        {isExpanded && (
          <View>
            {/* <View style={styles.headerSubContainer}>
              <Card style={styles.card}>
                <Text style={styles.subHeader}>Cash</Text>
                <Text style={styles.subHeader}>
                  {new Intl.NumberFormat().format(totalCash)}
                </Text>
              </Card>
              <Card style={styles.card}>
                <Text style={styles.subHeader}>Card</Text>
                <Text style={styles.subHeader}>
                  {new Intl.NumberFormat().format(totalCard)}
                </Text>
              </Card>
              <Card style={styles.card}>
                <Text style={styles.subHeader}>Online</Text>
                <Text style={styles.subHeader}>
                  {new Intl.NumberFormat().format(totalOnline)}
                </Text>
              </Card>
            </View> */}
            <Card
              style={{
                ...styles.card,
                backgroundColor: '#aef4b0ff',
                paddingHorizontal: 0,
                borderLeftWidth: 0,
                width: '97%',
                alignSelf: 'center',
              }}
            >
              {/* <Card.Content> */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <View style={styles.card3}>
                  <Text style={styles.subHeader}>Cash</Text>
                  <Text>{new Intl.NumberFormat().format(totalCash)}</Text>
                </View>
                <View style={styles.card3}>
                  <Text style={styles.subHeader}>Card</Text>
                  <Text>{new Intl.NumberFormat().format(totalCard)}</Text>
                </View>
                <View style={{ ...styles.card3, borderRightWidth: 0 }}>
                  <Text style={styles.subHeader}>Online</Text>
                  <Text>{new Intl.NumberFormat().format(totalOnline)}</Text>
                </View>
              </View>
              {/* </Card.Content> */}
            </Card>
            <View style={styles.headerSubContainer1}>
              {statusList.map(status => {
                const data = summaryData?.[status];

                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => handleBillTypeSelect(status)}
                    activeOpacity={0.7}
                  >
                    <Card
                      style={{
                        ...styles.card,
                        backgroundColor:
                          billType === status ? '#edc6a8ff' : '#FFF3F0FF',
                        marginVertical: 5,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <View>
                          <Text style={styles.subHeader}>{status}</Text>

                          <Text style={styles.subHeader}>
                            Total: ₹{' '}
                            {(
                              (data.Online || 0) +
                              (data.Cash || 0) +
                              (data.Card || 0)
                            ).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => handleBillTypeSelect('')}
                activeOpacity={0.5}
              >
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor: '#fff',
                    borderLeftWidth: 0.5,
                    borderWidth: 0.5,
                    alignItems: 'center',
                    marginVertical: 5,
                  }}
                >
                  <Text style={styles.subHeader}>Clear Filter</Text>
                </Card>
              </TouchableOpacity>
              {/* <TouchableOpacity
               // onPress={() => handleBillTypeSelect('')}
                activeOpacity={0.5}>
                <Card
                  style={{
                    ...styles.card,
                    backgroundColor: '#fff',
                    borderLeftWidth: 0.5,
                    borderWidth: 0.5,
                    alignItems: 'center',
                  }}>
                  <Text style={styles.subHeader}>Clear Filter</Text>
                </Card>
              </TouchableOpacity> */}
            </View>
          </View>
        )}

        {/* Search and Records Dropdown */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            margin: 10,
          }}
        >
          <TextInput
            mode="outlined"
            placeholder="Search by Name"
            value={searchQuery}
            onFocus={() => setIsExpanded(false)}
            onChangeText={searchCallerNumber}
            style={{
              flex: 1,
              //marginRight: 10,
              height: 50,
              fontFamily: 'Lexend-Regular',
              color: '#000',
            }}
            left={<TextInput.Icon icon="magnify" />}
          />
          {/* <Menu
            visible={recordsVisible}
            onDismiss={() => setRecordsVisible(false)}
            anchor={
              <Button mode="outlined" onPress={() => setRecordsVisible(true)}>
                Records {selectedRecords}
              </Button>
            }>
            {[10, 20, 50].map(num => (
              <Menu.Item
                key={num}
                title={`${num}`}
                onPress={() => {
                  setSelectedRecords(num);
                  setRecordsVisible(false);
                }}
              />
            ))}
          </Menu> */}
        </View>

        {filteredRecords.length > 0 && (
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
            <View style={{ width: '68%', paddingLeft: 15 }}>
              <Text style={styles.medium}>NAME</Text>
            </View>
            <View style={{ width: '22%' }}>
              <Text style={styles.medium}>AMOUNT</Text>
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
          {filteredRecords.length > 0 ? (
            filteredRecords.slice(from, to).map((item, index) => (
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
                        width: '70%',
                        paddingHorizontal: 10,
                        flexDirection: 'column',
                      }}
                    >
                      <Text style={styles.medium}>{item.name}</Text>
                      {expandedPatientId === item.patient_id && (
                        <>
                          <Text style={styles.cell}>
                            Consultation : {item.consultation}
                          </Text>
                          <Text style={styles.cell}>
                            Receipt :{' '}
                            {new Date(item.item_date).toLocaleDateString()}
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={{ width: '20%' }}>
                      <Text style={styles.medium}>{item.total}</Text>
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
                          <Text style={styles.amountLabel}>Cash</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/cash.png')}
                            />
                            <Text style={styles.amount}>
                              {item.payment_mode === 'Cash' ? item.total : 0}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Card</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/card.png')}
                            />
                            <Text style={styles.amount}>
                              {item.payment_mode === 'Card' ? item.total : 0}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Online</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/online.png')}
                            />
                            <Text style={styles.amount}>
                              {item.payment_mode === 'Online' ? item.total : 0}
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

          <TouchableOpacity
            // onPress={() => {
            //   setFromDate(new Date());
            //   setToDate(new Date());
            //   setVisible1(true);
            // }}
            style={{
              height: 42,
              width: 150,
              borderWidth: 0.3,
              borderRadius: 4,
              //backgroundColor: '#007bff',
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
              <Text
                style={{
                  fontFamily: 'Lexend-Light',
                  color: '#000',
                  fontSize: 12,
                }}
              >
                Total Patients: {uniquePatientCount}
              </Text>
              <Text
                style={{
                  fontFamily: 'Lexend-Light',
                  color: '#000',
                  fontSize: 12,
                }}
              >
                Total Invoices: {filteredRecords.length}
              </Text>
            </View>
          </TouchableOpacity>

          <Button
            mode="outlined"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= filteredRecords.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= filteredRecords.length
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

export default OPDCollectionReport;

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
  headerSubContainer1: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    minWidth: '30%',
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
  card3: {
    minWidth: '33%',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#ccc',
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
    fontSize: 12,
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
});
