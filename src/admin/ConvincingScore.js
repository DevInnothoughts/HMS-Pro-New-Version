/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
/* eslint-disable react/react-in-jsx-scope */
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
  Text,
  Button,
  Portal,
  Modal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import ModalDropdown from 'react-native-modal-dropdown'; // Import the library
import { SafeAreaView } from 'react-native-safe-area-context';

const formatDateIST = date => {
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

const ConvincingScore = ({ navigation }) => {
  const location = useSelector(state => state.location.value);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [mainDoctorPerformance, setMainDoctorPerformance] = useState([]);
  const [asstDoctorPerformance, setAsstDoctorPerformance] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const generateMonthsList = () => {
    const currentDate = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1,
      );
      months.push({
        label: date.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        }),
        value: date,
      });
    }
    return months;
  };

  const [monthsList, setMonthsList] = useState(generateMonthsList());
  const [month, setMonth] = useState(monthsList[0].label);
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]);

  const handleMonthChange = index => {
    const selected = monthsList[index];
    console.log(monthsList);
    console.log('Selected:', selected);
    setSelectedMonth(selected);

    const from = new Date(
      selected.value.getFullYear(),
      selected.value.getMonth(),
      1,
    );
    const to = new Date(
      selected.value.getFullYear(),
      selected.value.getMonth() + 1,
      0,
    );

    console.log('From:', formatDateIST(from));
    console.log('To:', formatDateIST(to));
    setFromDate(from);
    setToDate(to);
    // Set from and to dates here based on your state logic
    // Example: setFromDate(from); setToDate(to);
  };

  const hideModal1 = () => {
    setVisible1(false);
  };

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    fetchConvincingScore(
      location,
      formatDateIST(startOfMonth),
      formatDateIST(endOfMonth),
    );
  }, [location]);

  const fetchConvincingScore = (location, from, to) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };
    console.log('From', from);
    console.log('To', to);

    try {
      setLoading(true);
      fetch(
        `${BACKEND_URL}/ConvincingScore?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('convincingScore details: ', res);
          setMainDoctorPerformance(res.mainDoctorPerformance);
          setAsstDoctorPerformance(res.asstDoctorPerformance);
          //setOPDCollectionData(res);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  // Function to export data to Excel
  const fetchScore = async () => {
    try {
      setLoading1(true);
      console.log(formatDateIST(fromDate));
      console.log(formatDateIST(toDate));
      fetchConvincingScore(
        location,
        formatDateIST(fromDate),
        formatDateIST(toDate),
      );
    } catch (error) {
      console.error('Error fetching convincing score:', error);
    } finally {
      setLoading1(false);
      hideModal1();
    }
  };

  // Function to handle button click
  const handleClick = async selectedMonth => {
    try {
      setMonth(selectedMonth.label);
      await fetchScore();
    } catch (error) {
      console.error('Error fetching convincing score:', error);
    }
  };

  // Toggle the expanded state
  const toggleExpandPatient = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
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

          <Text style={styles.header}>{month}</Text>

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
        <ScrollView style={{ flex: 1 }}>
          <>
            <Text style={styles.header}>Surgeons</Text>
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
              <View style={{ width: '56%', paddingLeft: 15 }}>
                <Text style={styles.medium}>DOCTOR</Text>
              </View>
              <View style={{ width: '17%' }}>
                <Text style={styles.medium}>SCORE (Advised)</Text>
              </View>
              <View style={{ width: '17%' }}>
                <Text style={styles.medium}>SCORE (Total)</Text>
              </View>
              <View style={{ width: '10%' }}>
                <Text> </Text>
              </View>
            </View>
          </>

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
            {mainDoctorPerformance && mainDoctorPerformance.length > 0 ? (
              mainDoctorPerformance.map((item, index) => (
                <Card
                  key={index}
                  style={{
                    backgroundColor:
                      expandedId === item.DoctorName ? '#F5F1FEFF' : '#fff',
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
                      onPress={() => toggleExpandPatient(item.DoctorName)}
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
                          width: '60%',
                          paddingHorizontal: 10,
                          flexDirection: 'column',
                        }}
                      >
                        <Text style={styles.medium}>{item.DoctorName}</Text>
                        {expandedId === item.DoctorName && (
                          <>
                            <Text style={styles.cell}>
                              Surgery Performed : {item.SurgeryDone}
                            </Text>
                            <Text style={styles.cell}>
                              Revenue Generated : $$
                            </Text>
                          </>
                        )}
                      </View>
                      <View style={{ width: '15%' }}>
                        <Text style={styles.medium}>
                          {item.SurgeryPatients > 0
                            ? (
                                (item.SurgeryDone / item.SurgeryPatients) *
                                100
                              ).toFixed(2)
                            : 0}
                          %
                        </Text>
                      </View>
                      <View style={{ width: '15%' }}>
                        <Text style={styles.medium}>
                          {item.totalCount > 0
                            ? (
                                (item.SurgeryDone / item.totalCount) *
                                100
                              ).toFixed(2)
                            : 0}
                          %
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
                            expandedId === item.DoctorName
                              ? require('../../assets/up-arrow.png')
                              : require('../../assets/down-arrow.png')
                          }
                        />
                      </View>
                    </TouchableOpacity>

                    {expandedId === item.DoctorName && (
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
                        <Text
                          style={{
                            ...styles.amountLabel,
                            fontSize: 14,
                            fontFamily: 'Lexend-Medium',
                          }}
                        >
                          Patients Checked
                        </Text>
                        <View style={styles.amountContainer}>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>New</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.NewPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Follow-Up</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.FollowUpPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Post-Op</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.PostOpPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Other</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.otherPatients}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text
                          style={{
                            ...styles.amountLabel,
                            fontSize: 14,
                            fontFamily: 'Lexend-Medium',
                          }}
                        >
                          Treatment Advised
                        </Text>
                        <View style={styles.amountContainer}>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Medication</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.MedicationPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Surgery</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.SurgeryPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Test</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.TestPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Other Advice</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.otherDiagnosis}
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

          <>
            <Text style={styles.header}>Assistants</Text>
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
              <View style={{ width: '56%', paddingLeft: 15 }}>
                <Text style={styles.medium}>DOCTOR</Text>
              </View>
              <View style={{ width: '17%' }}>
                <Text style={styles.medium}>SCORE (Advised)</Text>
              </View>
              <View style={{ width: '17%' }}>
                <Text style={styles.medium}>SCORE (Total)</Text>
              </View>
              <View style={{ width: '10%' }}>
                <Text> </Text>
              </View>
            </View>
          </>

          <ScrollView
            style={{
              flex: 1,
              height: '70%',
              width: '100%',
            }}
          >
            {asstDoctorPerformance && asstDoctorPerformance.length > 0 ? (
              asstDoctorPerformance.map((item, index) => (
                <Card
                  key={index}
                  style={{
                    backgroundColor:
                      expandedId === item.DoctorName ? '#F5F1FEFF' : '#fff',
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
                      onPress={() => toggleExpandPatient(item.DoctorName)}
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
                          width: '60%',
                          paddingHorizontal: 10,
                          flexDirection: 'column',
                        }}
                      >
                        <Text style={styles.medium}>{item.DoctorName}</Text>
                        {expandedId === item.DoctorName && (
                          <>
                            <Text style={styles.cell}>
                              Surgery Performed : {item.SurgeryDone}
                            </Text>
                            <Text style={styles.cell}>
                              Revenue Generated : $$
                            </Text>
                          </>
                        )}
                      </View>
                      <View style={{ width: '15%' }}>
                        <Text style={styles.medium}>
                          {item.SurgeryPatients > 0
                            ? (
                                (item.SurgeryDone / item.SurgeryPatients) *
                                100
                              ).toFixed(2)
                            : 0}
                          %
                        </Text>
                      </View>
                      <View style={{ width: '15%' }}>
                        <Text style={styles.medium}>
                          {item.SurgeryPatients > 0
                            ? (
                                (item.SurgeryDone / item.totalCount) *
                                100
                              ).toFixed(2)
                            : 0}
                          %
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
                            expandedId === item.DoctorName
                              ? require('../../assets/up-arrow.png')
                              : require('../../assets/down-arrow.png')
                          }
                        />
                      </View>
                    </TouchableOpacity>

                    {expandedId === item.DoctorName && (
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
                        <Text
                          style={{
                            ...styles.amountLabel,
                            fontSize: 14,
                            fontFamily: 'Lexend-Medium',
                          }}
                        >
                          Patients Checked
                        </Text>
                        <View style={styles.amountContainer}>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>New</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.NewPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Follow-Up</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.FollowUpPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Post-Op</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.PostOpPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Other</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.otherPatients}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text
                          style={{
                            ...styles.amountLabel,
                            fontSize: 14,
                            fontFamily: 'Lexend-Medium',
                          }}
                        >
                          Treatment Advised
                        </Text>
                        <View style={styles.amountContainer}>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Medication</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.MedicationPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Surgery</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.SurgeryPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Test</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.TestPatients}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.amountSubContainer2}>
                            <Text style={styles.amountLabel}>Other Advice</Text>
                            <View style={styles.amountSubContainer}>
                              <Text style={styles.amount}>
                                {item.otherDiagnosis}
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
        </ScrollView>
      </View>

      <Portal>
        <Modal
          visible={visible1}
          onDismiss={hideModal1}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <View style={styles.header}>
              <Text style={styles.title}>Select Month</Text>
            </View>

            <ModalDropdown
              style={styles.dropdown}
              textStyle={styles.dropdownText}
              dropdownStyle={styles.dropdownList}
              dropdownTextStyle={styles.dropdownItemText}
              options={monthsList.map(item => item.label)}
              onSelect={handleMonthChange}
              defaultValue="Select Month"
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={hideModal1}
                  style={styles.button}
                  textColor="#007bff"
                >
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={() => handleClick(selectedMonth)}
                  style={[styles.button, styles.findButton]}
                >
                  Find
                </Button>
              </View>
            </KeyboardAvoidingView>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

export default ConvincingScore;

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
    height: 50,
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
    width: '100%',
    height: 42,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  amountContainer: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 5,
  },
  amountSubContainer2: {
    width: '24%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    //width: 100,
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
  title: {
    fontFamily: 'Lexend-Bold',
    fontSize: 20,
  },
  label: {
    fontFamily: 'Lexend-Regular',
    fontSize: 16,
    marginBottom: 10,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  dropdownText: {
    fontSize: 16,
    fontFamily: 'Lexend-Medium',
    color: '#000',
  },
  dropdownList: {
    width: '80%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  dropdownItemText: {
    fontSize: 16,
    padding: 10,
    fontFamily: 'Lexend-Regular',
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
  },
  button: {
    width: 150,
  },
  findButton: {
    backgroundColor: '#007bff',
  },
});
