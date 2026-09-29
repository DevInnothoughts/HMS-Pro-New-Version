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

const getYesterday = () => {
  const nowUTC = new Date();
  const istOffsetMinutes = 330; // IST is UTC+5:30
  const istTime = new Date(nowUTC.getTime() + istOffsetMinutes * 60000);

  // Subtract one day
  istTime.setDate(istTime.getDate() - 1);

  // Format as YYYY-MM-DD
  return istTime;
};

const OPDIPDApproval = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getYesterday());
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

  const hideModal = () => {
    setVisible(false);
  };

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
      </View>

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

export default OPDIPDApproval;

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
    justifyContent: 'center',
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
