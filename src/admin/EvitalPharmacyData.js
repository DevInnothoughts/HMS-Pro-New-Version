import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  LayoutAnimation,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Card,
  Text,
  Modal,
  Portal,
  DataTable,
  Button,
  Dialog,
  ActivityIndicator,
  TextInput,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import DatePicker from 'react-native-date-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

const PharmacyInvoiceScreen = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [visible, setVisible] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentModeTotals, setPaymentModeTotals] = useState({
    Cash: 0,
    Card: 0,
    UPI: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRecords2, setFilteredRecords2] = useState([]);

  const hideModal1 = () => {
    setVisible1(false);
  };

  const openModal = invoice => {
    setSelectedInvoice(invoice);
    setVisible(true);
  };

  const closeModal = () => {
    setVisible(false);
    setSelectedInvoice(null);
  };

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, filteredRecords.length));
  }, [filteredRecords.length, itemsPerPage, page]);

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(page - 1);
  };

  // Function to toggle the visibility
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    fetchPharmacyCollection(location, getISTDate(fromDate), getISTDate(toDate));
  }, [location]);

  const fetchPharmacyCollection = (location, from, to) => {
    setLoading(true);

    fetch(
      `${BACKEND_URL}/pharmacyCollection/v2?location=${location}&from=${from}&to=${to}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    )
      .then(response => response.json())
      .then(res => {
        setInvoices(res.invoices);

        setPaymentModeTotals(res.paymentModeTotals);
        setTotalAmount(res.grandTotal);

        setFilteredRecords(res.invoices);
        setFilteredRecords2(res.invoices);

        console.log(res);

        setLoading(false);
      })
      .catch(error => {
        console.log('Error', error);
        setLoading(false);
      });
  };

  const fetchPharmacyData = async () => {
    try {
      setLoading1(true);
      console.log(fromDate);
      console.log(toDate);
      fetchPharmacyCollection(
        location,
        getISTDate(fromDate),
        getISTDate(toDate),
      );
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    } finally {
      setLoading1(false);
      hideModal1();
    }
  };

  const handleClick = async () => {
    try {
      await fetchPharmacyData();
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  const safeParseInvoice = invoiceDetails => {
    try {
      if (!invoiceDetails) return null;
      const parsed = JSON.parse(invoiceDetails);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const renderPatientCard = ({ item }) => {
    const invoice = safeParseInvoice(item.invoice_details);

    // ⛔ Skip rendering if invoice is invalid
    if (!invoice) {
      return null; // or show fallback card
    }

    return (
      <Card style={styles.card} onPress={() => openModal(invoice)}>
        <Card.Content>
          <View style={styles.row}>
            {/* Left Section */}
            <View style={styles.left}>
              <Text variant="titleMedium">{invoice.patient_name ?? 'N/A'}</Text>

              <Text variant="bodySmall">Mobile: {invoice.mobile ?? '-'}</Text>

              <Text variant="bodySmall">
                Bill Date:{' '}
                {invoice.bill_date
                  ? new Date(invoice.bill_date).toLocaleDateString('en-GB')
                  : '-'}
              </Text>
            </View>

            {/* Right Section */}
            <View style={styles.right}>
              <Text variant="labelSmall">Total</Text>
              <Text variant="titleLarge" style={styles.amount}>
                ₹{invoice.total ?? 0}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const searchCallerNumber = query => {
    setSearchQuery(query);

    if (query.trim() === '') {
      setFilteredRecords(filteredRecords2); // Reset to full list when empty
    } else {
      const filtered = filteredRecords2.filter(item =>
        JSON.parse(item.invoice_details)
          .patient_name.toLowerCase()
          .includes(query.toLowerCase()),
      );
      setFilteredRecords(filtered);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
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
                  {new Intl.NumberFormat(0).format(totalAmount)}
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
          <View style={styles.headerSubContainer}>
            <Card style={styles.card2}>
              <Text style={styles.subHeader}>Cash</Text>
              <Text style={styles.subHeader}>
                {new Intl.NumberFormat().format(paymentModeTotals.Cash)}
              </Text>
            </Card>
            <Card style={styles.card2}>
              <Text style={styles.subHeader}>Card</Text>
              <Text style={styles.subHeader}>
                {new Intl.NumberFormat().format(paymentModeTotals.Card)}
              </Text>
            </Card>
            <Card style={styles.card2}>
              <Text style={styles.subHeader}>Online</Text>
              <Text style={styles.subHeader}>
                {new Intl.NumberFormat().format(paymentModeTotals.UPI)}
              </Text>
            </Card>
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
      </View>
      <View style={styles.container}>
        {filteredRecords && filteredRecords.length > 0 ? (
          <>
            <FlatList
              data={filteredRecords.slice(from, to)}
              keyExtractor={item => item.id}
              renderItem={renderPatientCard}
            />

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
                <View
                  style={{ alignItems: 'center', justifyContent: 'center' }}
                >
                  <Image
                    style={{ width: 12, height: 12 }}
                    source={require('../../assets/left.png')}
                  />
                </View>
              </Button>

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
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    style={{ width: 12, height: 12 }}
                    source={require('../../assets/right.png')}
                  />
                </View>
              </Button>
            </View>
          </>
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>
            No invoices found.
          </Text>
        )}
        {/* Modal */}
        <Portal>
          <Modal
            visible={visible}
            onDismiss={closeModal}
            contentContainerStyle={styles.modal}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Medicine Details
            </Text>

            {selectedInvoice && (
              <>
                <Text variant="bodyMedium">
                  Patient: {selectedInvoice.patient_name}
                </Text>

                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>Medicine</DataTable.Title>
                    <DataTable.Title numeric>Qty</DataTable.Title>
                    <DataTable.Title numeric>Amount</DataTable.Title>
                  </DataTable.Header>

                  {selectedInvoice.items.map((med, index) => (
                    <DataTable.Row key={index}>
                      <DataTable.Cell>{med.medicine_name}</DataTable.Cell>
                      <DataTable.Cell numeric>{med.quantity}</DataTable.Cell>
                      <DataTable.Cell numeric>₹{med.amount}</DataTable.Cell>
                    </DataTable.Row>
                  ))}

                  <DataTable.Row>
                    <DataTable.Cell>
                      <Text variant="titleSmall">Total</Text>
                    </DataTable.Cell>
                    <DataTable.Cell />
                    <DataTable.Cell numeric>
                      <Text variant="titleSmall">₹{selectedInvoice.total}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                </DataTable>

                <Button
                  mode="contained"
                  onPress={closeModal}
                  style={{ marginTop: 16 }}
                >
                  Close
                </Button>
              </>
            )}
          </Modal>
        </Portal>
      </View>

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

export default PharmacyInvoiceScreen;

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
  modal: {
    backgroundColor: 'white',
    paddingVertical: 50,
    paddingHorizontal: 20,
    marginHorizontal: 10,
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
  card2: {
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
  cell: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
  },
  container: {
    flex: 1,
    width: '100%',
    padding: 12,
  },
  card: {
    marginVertical: 6,
    marginHorizontal: 10,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: 'bold',
    color: '#2e7d32', // optional: green for amount
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 10,
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
});
