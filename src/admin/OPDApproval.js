import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';

import { ActivityIndicator, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Table,
  Row,
  Rows,
  Col,
  Cols,
  TableWrapper,
} from 'react-native-table-component';
import { useSelector } from 'react-redux';

const getYesterday = () => {
  const now = new Date();

  // Add IST offset (5.5 hours = 330 minutes)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // Subtract one day in IST-adjusted context
  istNow.setUTCDate(istNow.getUTCDate() - 1);
  //console.log(istNow);
  // Extract and format date in UTC after IST shift
  const yyyy = istNow.getUTCFullYear();
  const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istNow.getUTCDate()).padStart(2, '0');

  const formatted = `${yyyy}-${mm}-${dd}`;
  //console.log('IST Yesterday:', formatted);
  return formatted;
};

const OPDApproval = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [dailyOPDReport, setDailyOPDReport] = useState([]);
  const [detailedData, setDetailedData] = useState([]);
  const [overallCollection, setOverallCollection] = useState([]);
  const [labCollection, setLabCollection] = useState([]);
  const [testReport, setTestReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(getYesterday());
  const [count, setCount] = useState({
    diagnosisCount: 0,
    prescriptionCount: 0,
  });
  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    fetchAppointmentData(location);
  }, []);

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
          setTestReport(res.testReport);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    } finally {
      //setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>
          OPD Report For {new Date(fromDate).toLocaleDateString()}
        </Text>
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
              data={['Type', 'Amount']}
              flexArr={[0.8, 0.9]}
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
            </TableWrapper>
          </Table>
        </View>

        {/* OPD Collection Details */}
        <View style={styles.tableContainer}>
          <Text style={styles.header}>Lab Collection Detail (Rs)</Text>
          <Table borderStyle={styles.border}>
            <Row
              data={['Type', 'Amount']}
              flexArr={[0.8, 0.9]}
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
            </TableWrapper>
          </Table>
        </View>
        {/* <View style={styles.maincontainer}>
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
            }}>
            <View style={{alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{color: '#FFF'}}>Submit</Text>
            </View>
          </Button>
        </View> */}
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
    marginVertical: 5,
    paddingTop: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
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

export default OPDApproval;
