/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
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
  UIManager,
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
  Title,
  TextInput,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const statusList = [
  'Cashless',
  'Reimbursement',
  'NonInsurance',
  'Charity',
  'PDC',
];

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

const IPDCollectionReport = ({ navigation }) => {
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
  const [summaryData, setSummaryData] = useState({});
  const [IPDCollectionData, setIPDCollectionData] = useState([]);
  const [billType, setBillType] = useState('');
  const [filteredIPDCollection, setFilteredIPDCollection] = useState([]);
  const [uniquePatientCount, setUniquePatientCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRecords2, setFilteredRecords2] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    fetchIPDCollection(location, getISTDate(fromDate), getISTDate(toDate));
  }, []);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, filteredIPDCollection.length));
  }, [filteredIPDCollection.length, itemsPerPage, page]);

  let totalCash = 0;
  let totalCard = 0;
  let totalOnline = 0;
  let totalCheque = 0;
  let totalInternalDiscount = 0;
  let totalHospitalDiscount = 0;
  let totalReceived = 0;
  let totalTDS = 0;

  // Calculate totals
  filteredIPDCollection.forEach(item => {
    totalCash += +item.cashamt;
    totalCard += +item.cardamt;
    totalCheque += +item.chequeamt;
    totalOnline += +item.onlineamt;
    totalInternalDiscount += +item.discountamt;
    totalHospitalDiscount += +item.tdsamt;
    totalReceived += item.receivedamt ? +item.receivedamt : 0;
    totalTDS += item.actualTDS ? +item.actualTDS : 0;
  });
  console.log('Doctor details: ', filteredIPDCollection.length);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const fetchIPDCollection = (location, from, to) => {
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
        `${BACKEND_URL}/IPDCollection/v3?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Collection details: ', res.ipdPayments.length);

          const totalsByStatus = {};
          // Step 1: Initialize totals from unique invoices only
          const invoiceMap = {};
          const seenInvoices = new Set();
          res.ipdPayments.forEach(invoice => {
            const { invoice_id, status, totalamt = 0, totaldue = 0 } = invoice;

            if (seenInvoices.has(invoice_id)) return; // Skip duplicates
            seenInvoices.add(invoice_id);

            if (!totalsByStatus[status]) {
              totalsByStatus[status] = {
                collected_amount: 0,
                total_bill_amount: 0,
                total_due_amount: 0,
                total_discount_amount: 0,
              };
            }

            invoiceMap[invoice_id] = status;

            totalsByStatus[status].total_bill_amount +=
              parseFloat(totalamt) || 0;
            totalsByStatus[status].total_due_amount +=
              parseFloat(totaldue) || 0;
          });

          // ✅ Step 2: Merge status into ipdPayment (after invoiceMap is filled)
          const mergedPayments = res.ipdPayments.map(payment => {
            const status = invoiceMap[payment.invoice_id] || 'Unknown';
            return {
              ...payment,
              status,
            };
          });

          setIPDCollectionData(mergedPayments);
          setFilteredIPDCollection(mergedPayments);
          setFilteredRecords2(mergedPayments);
          const uniquePatientCount = new Set(
            mergedPayments.map(row => row.patient_id),
          ).size;
          //
          setUniquePatientCount(uniquePatientCount);

          // Step 3: Add collected amounts from payments
          mergedPayments.forEach(payment => {
            const {
              status,
              cashamt = 0,
              cardamt = 0,
              chequeamt = 0,
              onlineamt = 0,
              discountamt = 0,
              tdsamt = 0,
              receivedamt = 0,
              actualTDS = 0,
            } = payment;

            if (!totalsByStatus[status]) {
              totalsByStatus[status] = {
                collected_amount: 0,
                total_bill_amount: 0,
                total_due_amount: 0,
              };
            }

            const collected =
              (cashamt || 0) +
              (cardamt || 0) +
              (chequeamt || 0) +
              (onlineamt || 0) +
              (receivedamt || 0) +
              (actualTDS || 0);
            const discount = (+discountamt || 0) + (+tdsamt || 0);

            totalsByStatus[status].collected_amount += collected;
            totalsByStatus[status].total_discount_amount +=
              parseFloat(discount);
          });

          // Round values
          Object.keys(totalsByStatus).forEach(status => {
            totalsByStatus[status].collected_amount =
              +totalsByStatus[status].collected_amount.toFixed(2);
            totalsByStatus[status].total_bill_amount =
              +totalsByStatus[status].total_bill_amount.toFixed(2);
            totalsByStatus[status].total_due_amount =
              +totalsByStatus[status].total_due_amount.toFixed(2);
            totalsByStatus[status].total_discount_amount =
              +totalsByStatus[status].total_discount_amount.toFixed(2);
          });

          console.log('Final Totals by Status:', totalsByStatus);
          setSummaryData(totalsByStatus);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
      setLoading(false);
    }
  };

  const handleBillTypeSelect = type => {
    setBillType(type);
    setSearchQuery('');

    if (type) {
      const filtered = IPDCollectionData.filter(item => item.status === type);
      const uniquePatientCount = new Set(filtered.map(row => row.patient_id))
        .size;
      //
      setUniquePatientCount(uniquePatientCount);
      setFilteredIPDCollection(filtered);
      setFilteredRecords2(filtered);
    } else {
      setFilteredIPDCollection(IPDCollectionData); // Show all if cleared
      setFilteredRecords2(IPDCollectionData);
      const uniquePatientCount = new Set(
        IPDCollectionData.map(row => row.patient_id),
      ).size;
      //
      setUniquePatientCount(uniquePatientCount);
    }
  };

  // Function to export data to Excel
  const fetchIPDData = async () => {
    try {
      setLoading1(true);
      console.log(fromDate);
      console.log(toDate);
      fetchIPDCollection(location, getISTDate(fromDate), getISTDate(toDate));
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
      await fetchIPDData();
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
      setFilteredIPDCollection(filteredRecords2); // Reset to full list when empty
    } else {
      const filtered = filteredRecords2.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()),
      );
      const count = new Set(filtered.map(row => row.patient_id)).size;
      setUniquePatientCount(count);
      setFilteredIPDCollection(filtered);
    }
  };

  const HandleProfileNavigation = () => {
    navigation.navigate().goBack();
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
                      totalCash +
                        totalCard +
                        totalOnline +
                        totalCheque +
                        totalReceived +
                        totalTDS,
                    )}
                  </Text>
                </View>
                <Text style={{ ...styles.cell, textAlign: 'center' }}>
                  {new Date(fromDate).toLocaleDateString('en-GB')}-
                  {new Date(toDate).toLocaleDateString('en-GB')}
                </Text>
              </View>
              {/* <View style={{minWidth: 130, flexDirection: 'row'}}>
                <Text style={styles.header}> Total : ₹</Text>
                <Text style={styles.header}>
                  {new Intl.NumberFormat().format(
                    totalCash + totalCard + totalOnline + totalInternalDiscount,
                  )}
                </Text>
              </View> */}
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
          <>
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
                  flexWrap: 'wrap',
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
                <View style={styles.card3}>
                  <Text style={styles.subHeader}>Online</Text>
                  <Text>{new Intl.NumberFormat().format(totalOnline)}</Text>
                </View>
                <View style={styles.card3}>
                  <Text style={styles.subHeader}>Cheque</Text>
                  <Text>{new Intl.NumberFormat().format(totalCheque)}</Text>
                </View>
                <View style={styles.card3}>
                  <Text style={styles.subHeader}>Internal Dscnt</Text>
                  <Text>
                    {new Intl.NumberFormat().format(totalInternalDiscount)}
                  </Text>
                </View>
                <View style={{ ...styles.card3, borderRightWidth: 0 }}>
                  <Text style={styles.subHeader}>Hosp. Dscnt</Text>
                  <Text>
                    {new Intl.NumberFormat().format(totalHospitalDiscount)}
                  </Text>
                </View>
                {(billType === 'Cashless' || billType === '') && (
                  <View
                    style={{
                      flexDirection: 'row',
                      width: '100%',
                      justifyContent: 'space-around',
                    }}
                  >
                    <View style={{ ...styles.card3, width: '50%' }}>
                      <Text style={styles.subHeader}>Settled Amount</Text>
                      <Text>
                        {new Intl.NumberFormat().format(totalReceived)}
                      </Text>
                    </View>
                    <View
                      style={{
                        ...styles.card3,
                        width: '50%',
                        borderRightWidth: 0,
                      }}
                    >
                      <Text style={styles.subHeader}>TDS</Text>
                      <Text>{new Intl.NumberFormat().format(totalTDS)}</Text>
                    </View>
                  </View>
                )}
              </View>
              {/* </Card.Content> */}
            </Card>
            <View style={styles.headerSubContainer}>
              {statusList.map(status => {
                const data = summaryData?.[status] || {
                  collected_amount: 0,
                  total_bill_amount: 0,
                  total_due_amount: 0,
                  total_discount_amount: 0,
                };

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
                            Collected: ₹{' '}
                            {new Intl.NumberFormat().format(
                              data.collected_amount,
                            )}
                          </Text>
                          <Text style={styles.subHeader}>
                            Discount: ₹{' '}
                            {new Intl.NumberFormat().format(
                              data.total_discount_amount,
                            )}
                          </Text>
                          {/* <Text style={styles.subHeader}>
                            Billed: ₹{' '}
                            {new Intl.NumberFormat().format(
                              data.total_bill_amount,
                            )}
                          </Text>

                          <Text style={styles.subHeader}>
                            Due: ₹{' '}
                            {new Intl.NumberFormat().format(
                              data.total_due_amount,
                            )}
                          </Text> */}
                        </View>
                        <Icon name="arrow-forward-ios" size={18} color="#888" />
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
                  }}
                >
                  <Text style={styles.subHeader}>Clear Filter</Text>
                </Card>
              </TouchableOpacity>
            </View>
          </>
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

        {filteredIPDCollection.length > 0 && (
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

          {filteredIPDCollection.length > 0 ? (
            filteredIPDCollection.slice(from, to).map((item, index) => (
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
                        paddingLeft: 10,
                        flexDirection: 'column',
                      }}
                    >
                      <Text style={styles.medium}>
                        {index + 1 + page * 10}. {item.name}
                      </Text>
                      {expandedPatientId === item.patient_id && (
                        <>
                          <Text style={styles.cell}>
                            Invoice :{' '}
                            {new Date(item.invoice_date).toLocaleDateString()}
                          </Text>
                          <Text style={styles.cell}>
                            Receipt :{' '}
                            {new Date(item.receipt_date).toLocaleDateString()}
                          </Text>
                          <Text style={styles.cell}>
                            Status : {item.status}
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={{ width: '20%' }}>
                      <Text style={styles.medium}>
                        {item.cashamt +
                          item.cardamt +
                          item.onlineamt +
                          item.chequeamt +
                          (item.receivedamt ? +item.receivedamt : 0) +
                          (item.actualTDS ? +item.actualTDS : 0)}
                      </Text>
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
                      {billType === 'Cashless' && (
                        <>
                          <View style={styles.amountContainer}>
                            <View style={styles.amountSubContainer2}>
                              <Text style={styles.amountLabel}>Settled</Text>
                              <View style={styles.amountSubContainer}>
                                <Image
                                  style={styles.amountIcon}
                                  source={require('../../assets/cash.png')}
                                />
                                <Text style={styles.amount}>
                                  {item.receivedamt}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.amountSubContainer2}>
                              <Text style={styles.amountLabel}>TDS</Text>
                              <View style={styles.amountSubContainer}>
                                <Image
                                  style={styles.amountIcon}
                                  source={require('../../assets/card.png')}
                                />
                                <Text style={styles.amount}>
                                  {item.actualTDS}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </>
                      )}
                      <View style={styles.amountContainer}>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Cash</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/cash.png')}
                            />
                            <Text style={styles.amount}>{item.cashamt}</Text>
                          </View>
                        </View>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Card</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/card.png')}
                            />
                            <Text style={styles.amount}>{item.cardamt}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.amountContainer}>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Online</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/online.png')}
                            />
                            <Text style={styles.amount}>{item.onlineamt}</Text>
                          </View>
                        </View>
                        <View style={styles.amountSubContainer2}>
                          <Text style={styles.amountLabel}>Cheque</Text>
                          <View style={styles.amountSubContainer}>
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/online.png')}
                            />
                            <Text style={styles.amount}>{item.chequeamt}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.amountContainer}>
                        <View style={styles.amountSubContainer2}>
                          <Text
                            style={{
                              ...styles.amountLabel,
                              color: '#F9623EFF',
                            }}
                          >
                            Internal Discount
                          </Text>
                          <View
                            style={{
                              ...styles.amountSubContainer,
                              borderColor: '#F9623EFF',
                            }}
                          >
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/discount.png')}
                            />
                            <Text style={styles.amount}>
                              {item.discountamt}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.amountSubContainer2}>
                          <Text
                            style={{
                              ...styles.amountLabel,
                              color: '#F9623EFF',
                            }}
                          >
                            Hospital Discount
                          </Text>
                          <View
                            style={{
                              ...styles.amountSubContainer,
                              borderColor: '#F9623EFF',
                            }}
                          >
                            <Image
                              style={styles.amountIcon}
                              source={require('../../assets/discount.png')}
                            />
                            <Text style={styles.amount}>{item.tdsamt}</Text>
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
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
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
                Total Invoices: {filteredIPDCollection.length}
              </Text>
            </View>
          </TouchableOpacity>

          <Button
            mode="outlined"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= filteredIPDCollection.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= filteredIPDCollection.length
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

export default IPDCollectionReport;

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
    minWidth: '40%',
    minHeight: 80,
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
    marginVertical: 5,
  },
  card2: {
    minWidth: '45%',
    minHeight: 100,
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
    marginVertical: 5,
  },
  card3: {
    minWidth: '30%',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#ccc',
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
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  subHeader: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: '#000',
  },
  subHeader2: {
    fontFamily: 'Lexend-Regular',
    fontSize: 16,
    color: '#000',
  },
  subHeader3: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#323232',
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
    width: 120,
    height: 42,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  amountContainer: {
    display: 'flex',
    width: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 5,
  },
  amountSubContainer2: {
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 14,
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
