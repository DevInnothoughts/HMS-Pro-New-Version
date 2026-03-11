import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DatePicker from 'react-native-date-picker';

import {
  ActivityIndicator,
  Button,
  Checkbox,
  Dialog,
  MD2DarkTheme,
  Modal,
  Portal,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaFrame } from 'react-native-safe-area-context';
import {
  Table,
  Row,
  Rows,
  Col,
  Cols,
  TableWrapper,
} from 'react-native-table-component';
import { useSelector } from 'react-redux';

const DailyOPDReport = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [dailyOPDReport, setDailyOPDReport] = useState([]);
  const [detailedData, setDetailedData] = useState([]);
  const [overallCollection, setOverallCollection] = useState([]);
  const [labCollection, setLabCollection] = useState([]);
  const [pharmacyCollection, setPharmacyCollection] = useState([]);
  const [testReport, setTestReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [fromDate, setFromDate] = useState(new Date());
  const [count, setCount] = useState({
    diagnosisCount: 0,
    prescriptionCount: 0,
  });
  const [checked, setChecked] = useState([false, false, false, false]);
  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    fetchAppointmentData(location);
  }, []);

  const hideModal1 = () => {
    setVisible1(false);
  };

  // Function to handle button click
  const handleClick = async () => {
    try {
      await fetchAppointmentData(location);
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  const fetchAppointmentData = location => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };
    try {
      setLoading(true);
      setLoading1(true);
      fetch(
        `${BACKEND_URL}/DailyOPD?location=${location}&date=${fromDate}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Daily details: ', res);
          setCount({
            diagnosisCount: res.diagnosisCount,
            prescriptionCount: res.prescriptionCount,
          });
          setDailyOPDReport(res.dailyOPDReport);
          setDetailedData(res.detailedData);
          setOverallCollection(res.overallCollection);
          setLabCollection(res.labCollection);
          setPharmacyCollection(res.pharmacyCollection);
          setTestReport(res.testReport);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    } finally {
      setLoading1(false);
      hideModal1();
    }
  };

  const handleCheckboxChange = (index, value) => {
    const updatedChecked = [...checked];
    updatedChecked[index] = !value; // Toggle the checkbox value
    setChecked(updatedChecked);
  };

  const handleSubmit = () => {
    Alert.alert('Success', 'Report has been submitted successfully!');
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
        <Text style={styles.header}>
          OPD Report For {fromDate.toLocaleDateString()}
        </Text>
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

      <ScrollView style={styles.container}>
        {/* Daily OPD Report */}
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

        <View style={styles.tableContainer}>
          <Table borderStyle={styles.border}>
            <Row
              data={['New', 'Follow UP', 'PO', 'PROCTOSCOPY', 'TOTAL']}
              flexArr={[0.9, 1, 0.9, 1.2, 1]}
              style={styles.head}
              textStyle={styles.headerText}
            />
            <Row
              data={dailyOPDReport[0]}
              flexArr={[0.9, 1, 0.9, 1.2, 1]}
              style={styles.row}
              textStyle={styles.text}
            />
          </Table>
        </View>

        <View style={styles.tableContainer}>
          <Text style={styles.header}>
            Diagnosis Count: {count.diagnosisCount}
          </Text>
          <Text style={styles.header}>
            Prescription Count: {count.prescriptionCount}
          </Text>
        </View>

        <View style={styles.tableContainer}>
          <Table borderStyle={styles.border}>
            <Row
              data={['', 'New', 'Follow UP', 'PO', 'TOTAL']}
              flexArr={[1, 1, 1.1, 0.9, 1]}
              style={styles.head}
              textStyle={styles.headerText}
            />
            <TableWrapper style={{ flexDirection: 'row' }}>
              <Col
                data={['DNC', 'DNP', 'DNW', 'DNT', 'WALK-IN']}
                style={{ flex: 1, backgroundColor: '#F1FDE9FF' }}
                heightArr={[45, 45, 45, 45, 45]}
                textStyle={styles.headerText}
              />
              <Rows
                data={detailedData}
                style={styles.row}
                flexArr={[1, 1.1, 0.9, 1]}
                textStyle={styles.text}
              />
            </TableWrapper>
          </Table>
        </View>

        {/* Detailed Data */}
        {/* <View style={styles.tableContainer}>
          <Table borderStyle={styles.border}>
            <Row
              data={['', 'New', 'Follow UP', 'PO', 'TOTAL']}
              style={styles.head}
              textStyle={styles.headerText}
            />
            <Rows
              data={detailedData}
              style={styles.row}
              textStyle={styles.text}
            />
          </Table>
        </View> */}
        {/* Test Details */}
        {testReport.length > 0 && (
          <View style={styles.tableContainer}>
            <Table borderStyle={styles.border}>
              <Row
                data={['Test', 'Amount']}
                style={styles.head}
                textStyle={styles.headerText}
              />
              <Rows
                data={testReport}
                style={styles.row}
                textStyle={styles.text}
              />
            </Table>
          </View>
        )}
        {/* OPD Collection Details */}
        <View style={styles.tableContainer}>
          <Text style={styles.header}>Overall Collection Detail (Rs)</Text>
          <Table borderStyle={styles.border}>
            <Row
              data={['Type', 'Amount', 'Action']}
              flexArr={[0.8, 0.9, 1.3]}
              style={styles.head}
              textStyle={styles.headerText}
            />
            <TableWrapper style={{ flexDirection: 'row' }}>
              <Rows
                data={overallCollection}
                style={styles.row}
                flexArr={[0.8, 0.9]}
                textStyle={styles.text}
              />
              <Col
                data={overallCollection.map((_, index) => (
                  <Checkbox.Item
                    label="Confirm"
                    position="leading"
                    labelStyle={styles.text}
                    rippleColor={'#F1FDE9FF'}
                    status={checked[index] ? 'checked' : 'unchecked'}
                    onPress={() => handleCheckboxChange(index, checked[index])}
                    color="#14923EFF" // Customize color if needed
                  />
                ))}
                style={{ flex: 1.3, backgroundColor: 'transparent' }}
                heightArr={[45, 45, 45, 45]}
                textStyle={styles.headerText}
              />
            </TableWrapper>
          </Table>
        </View>

        {/* LAB Collection Details */}
        <View style={styles.tableContainer}>
          <Text style={styles.header}>Lab Collection Detail (Rs)</Text>
          <Table borderStyle={styles.border}>
            <Row
              data={['Type', 'Amount', 'Action']}
              flexArr={[0.8, 0.9, 1.3]}
              style={styles.head}
              textStyle={styles.headerText}
            />
            <TableWrapper style={{ flexDirection: 'row' }}>
              <Rows
                data={labCollection}
                style={styles.row}
                flexArr={[0.8, 0.9]}
                textStyle={styles.text}
              />
              <Col
                data={labCollection.map((_, index) => (
                  <Checkbox.Item
                    label="Confirm"
                    position="leading"
                    labelStyle={styles.text}
                    rippleColor={'#F1FDE9FF'}
                    status={checked[index] ? 'checked' : 'unchecked'}
                    onPress={() => handleCheckboxChange(index, checked[index])}
                    color="#14923EFF" // Customize color if needed
                  />
                ))}
                style={{ flex: 1.3, backgroundColor: 'transparent' }}
                heightArr={[45, 45, 45, 45]}
                textStyle={styles.headerText}
              />
            </TableWrapper>
          </Table>
        </View>

        {/* Pharmacy Collection Details */}
        <View style={styles.tableContainer}>
          <Text style={styles.header}>Pharmacy Collection Detail (Rs)</Text>
          <Table borderStyle={styles.border}>
            <Row
              data={['Type', 'Amount', 'Action']}
              flexArr={[0.8, 0.9, 1.3]}
              style={styles.head}
              textStyle={styles.headerText}
            />
            <TableWrapper style={{ flexDirection: 'row' }}>
              <Rows
                data={pharmacyCollection}
                style={styles.row}
                flexArr={[0.8, 0.9]}
                textStyle={styles.text}
              />
              <Col
                data={pharmacyCollection.map((_, index) => (
                  <Checkbox.Item
                    label="Confirm"
                    position="leading"
                    labelStyle={styles.text}
                    rippleColor={'#F1FDE9FF'}
                    status={checked[index] ? 'checked' : 'unchecked'}
                    onPress={() => handleCheckboxChange(index, checked[index])}
                    color="#14923EFF" // Customize color if needed
                  />
                ))}
                style={{ flex: 1.3, backgroundColor: 'transparent' }}
                heightArr={[45, 45, 45, 45]}
                textStyle={styles.headerText}
              />
            </TableWrapper>
          </Table>
        </View>
        <View style={styles.maincontainer}>
          <Button
            mode="outlined"
            onPress={handleSubmit}
            disabled={
              checked[0] && checked[1] && checked[2] && checked[3]
                ? false
                : true
            }
            style={{
              flexDirection: 'row',
              width: 120,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                checked[0] && checked[1] && checked[2] && checked[3]
                  ? '#14923EFF'
                  : '#F1FDE9FF',
              marginBottom: 20,
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF' }}>Submit</Text>
            </View>
          </Button>
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
              <Text style={styles.profileInput}>Select date :</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    width: '100%',
  },
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
    padding: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    //backgroundColor: '#F2FFF2FF',
  },
  tableContainer: {
    marginVertical: 10,
  },
  header: {
    fontSize: 16,
    fontFamily: 'Lexend-Medium',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  border: {
    borderWidth: 1,
    borderColor: '#ddd',
  },
  head: {
    height: 50,
    backgroundColor: '#F1FDE9FF',
  },
  row: {
    height: 45,
    width: 'auto',
    backgroundColor: '#FFF',
  },
  headerText: {
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    textAlign: 'center',
    verticalAlign: 'middle',
    color: '#000',
  },
  text: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    textAlign: 'center',
    verticalAlign: 'middle',
    color: '#000',
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
});

export default DailyOPDReport;
