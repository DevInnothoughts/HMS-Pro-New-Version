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

const ConvincingScoreV1 = ({ navigation }) => {
  const location = useSelector(state => state.location.value);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [loading1, setLoading1] = useState(false);
  const [visible1, setVisible1] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [branchTotal, setBranchTotal] = useState({
    newAppointmentCount: 0,
    totalDiagnosisCount: 0,
    totalMedication: 0,
    totalSurgery: 0,
  });

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
        `${BACKEND_URL}/ConvincingScore/v1?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('convincingScore details: ', res);
          setMainDoctorPerformance(res.consultantDoctors);
          setAsstDoctorPerformance(res.assistantDoctors);
          setBranchTotal(res.branchTotal);
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

  const MetricCardDoctor = ({ label, value }) => (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
  const MetricCardAssistant = ({ label, value }) => (
    <View style={styles.metricCardAssistant}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );

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
        <Card
          style={{
            width: '100%',
            marginVertical: 5,
            backgroundColor: '#aef4b0ff',
            paddingHorizontal: 0,
            borderLeftWidth: 0,
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
              <Text style={styles.subHeader}>New Appointment</Text>
              <Text style={styles.stats}>
                {branchTotal.newAppointmentCount}
              </Text>
            </View>
            <View style={styles.card3}>
              <Text style={styles.subHeader}>Total Diagnosis</Text>
              <Text style={styles.stats}>
                {branchTotal.totalDiagnosisCount}
              </Text>
            </View>
            <View style={styles.card3}>
              <Text style={styles.subHeader}>Medication Advised</Text>
              <Text style={styles.stats}>{branchTotal.totalMedication}</Text>
            </View>
            <View style={{ ...styles.card3, borderRightWidth: 0 }}>
              <Text style={styles.subHeader}>Surgery Advised</Text>
              <Text style={styles.stats}>{branchTotal.totalSurgery}</Text>
            </View>
          </View>
          {/* </Card.Content> */}
        </Card>
        <ScrollView style={styles.container}>
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, styles.surgeonTitle]}>
              Surgeons
            </Text>
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
              <View style={{ width: '73%', paddingLeft: 15 }}>
                <Text style={styles.medium}>DOCTOR</Text>
              </View>
              {/* <View style={{width: '17%'}}>
                <Text style={styles.medium}>SCORE (Advised)</Text>
              </View> */}
              <View style={{ width: '17%' }}>
                <Text style={styles.medium}>SCORE (Total)</Text>
              </View>
              <View style={{ width: '10%' }}>
                <Text> </Text>
              </View>
            </View>
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
                  color={'#01458e'}
                />
              </Dialog>
            </Portal>
            {mainDoctorPerformance && mainDoctorPerformance.length > 0 ? (
              mainDoctorPerformance.map((item, index) => (
                // <Card
                //   key={index}
                //   style={{
                //     backgroundColor:
                //       expandedId === item.doctorName ? '#F5F1FEFF' : '#fff',
                //     marginVertical: 8,
                //     marginHorizontal: 5,
                //     borderRadius: 4,
                //   }}>
                <View style={styles.performanceGrid}>
                  <Card
                    key={index}
                    style={
                      ([styles.doctorCard, styles.surgeonCard],
                      { backgroundColor: '#fff' })
                    }
                  >
                    <Card.Content style={styles.cardContent}>
                      <TouchableOpacity
                        onPress={() => toggleExpandPatient(item.doctorName)}
                        activeOpacity={0.9}
                        style={{
                          width: '100%',
                          minHeight: 40,
                          flexDirection: 'column',
                          marginBottom: 10,
                        }}
                      >
                        <View style={styles.doctorHeader}>
                          <Text style={styles.doctorName}>
                            {item.doctorName}
                          </Text>
                          <Text style={[styles.score, styles.surgeonScore]}>
                            {item.patientCount > 0
                              ? (
                                  (item.invoiceCount / item.patientCount) *
                                  100
                                ).toFixed(2)
                              : 0}
                            %
                          </Text>

                          <Image
                            style={{
                              width: 26,
                              height: 26,
                              objectFit: 'contain',
                              marginHorizontal: 5,
                            }}
                            source={
                              expandedId === item.doctorName
                                ? require('../../assets/up-arrow.png')
                                : require('../../assets/down-arrow.png')
                            }
                          />
                        </View>
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressFill,
                              styles.surgeonProgress,
                              {
                                width: `${
                                  item.patientCount > 0
                                    ? (
                                        (item.invoiceCount /
                                          item.patientCount) *
                                        100
                                      ).toFixed(2)
                                    : 0
                                }%`,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                      {expandedId === item.doctorName && (
                        <View style={styles.stats}>
                          <Text style={styles.stats}>
                            <Text style={styles.statLabel}>
                              Total Surgeries:{' '}
                            </Text>
                            {item.invoiceCount}
                          </Text>
                          <Text style={styles.stats}>
                            <Text style={styles.statLabel}>
                              Surgery Advised Rate:{' '}
                            </Text>
                            {item.diagnosisCounts.Surgery > 0
                              ? (
                                  (item.invoiceCount /
                                    item.diagnosisCounts.Surgery) *
                                  100
                                ).toFixed(2)
                              : 0}
                            %
                          </Text>
                          <Text style={styles.stats}>
                            <Text style={styles.statLabel}>
                              Same Month Surgery Rate:{' '}
                            </Text>
                            {item.thisMonthDiagnosedAndSurgeryPerformed} (
                            {item.diagnosisCounts.Surgery > 0
                              ? (
                                  (item.thisMonthDiagnosedAndSurgeryPerformed /
                                    item.diagnosisCounts.Surgery) *
                                  100
                                ).toFixed(2)
                              : 0}
                            %)
                          </Text>
                          {/* Overview Metrics */}
                          <View style={styles.metricsGrid}>
                            <MetricCardDoctor
                              label="Patients Diagnosed"
                              value={item.patientCount}
                            />
                            <MetricCardDoctor
                              label="Medication Advised"
                              value={item.diagnosisCounts.Medication}
                            />
                            <MetricCardDoctor
                              label="Surgery Advised"
                              value={item.diagnosisCounts.Surgery}
                            />
                          </View>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
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
                    fontSize: 20,
                    color: '#000',
                  }}
                >
                  Data not available!
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.content}>
            <Text style={[styles.sectionTitle, styles.assistantTitle]}>
              Assistant
            </Text>
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
              <View style={{ width: '73%', paddingLeft: 15 }}>
                <Text style={styles.medium}>DOCTOR</Text>
              </View>
              <View style={{ width: '17%' }}>
                <Text style={styles.medium}>SCORE (Total)</Text>
              </View>
              {/* <View style={{width: '17%'}}>
                <Text style={styles.medium}>SCORE (Total)</Text>
              </View> */}
              <View style={{ width: '10%' }}>
                <Text> </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={{
              flex: 1,
              height: '70%',
              width: '100%',
              marginBottom: 20,
            }}
          >
            {asstDoctorPerformance && asstDoctorPerformance.length > 0 ? (
              asstDoctorPerformance.map((item, index) => (
                <View style={styles.performanceGrid}>
                  <Card
                    key={index}
                    style={
                      ([styles.doctorCard, styles.assistantCard],
                      { backgroundColor: '#fff' })
                    }
                  >
                    <Card.Content style={styles.cardContent}>
                      <TouchableOpacity
                        onPress={() => toggleExpandPatient(item.doctorName)}
                        activeOpacity={0.9}
                        style={{
                          width: '100%',
                          minHeight: 40,
                          flexDirection: 'column',
                          marginBottom: 10,
                        }}
                      >
                        <View style={styles.doctorHeader}>
                          <Text style={styles.doctorName}>
                            {item.doctorName}
                          </Text>
                          <Text style={[styles.score, styles.assistantScore]}>
                            {item.patientCount > 0
                              ? (
                                  (item.invoiceCount / item.patientCount) *
                                  100
                                ).toFixed(2)
                              : 0}
                            %
                          </Text>

                          <Image
                            style={{
                              width: 26,
                              height: 26,
                              objectFit: 'contain',
                              marginHorizontal: 5,
                            }}
                            source={
                              expandedId === item.doctorName
                                ? require('../../assets/up-arrow.png')
                                : require('../../assets/down-arrow.png')
                            }
                          />
                        </View>
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressFill,
                              styles.assistantProgress,
                              {
                                width: `${
                                  item.patientCount > 0
                                    ? (
                                        (item.invoiceCount /
                                          item.patientCount) *
                                        100
                                      ).toFixed(2)
                                    : 0
                                }%`,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                      {expandedId === item.doctorName && (
                        <View style={styles.stats}>
                          <Text style={styles.stats}>
                            <Text style={styles.statLabel}>
                              Total Surgeries:{' '}
                            </Text>
                            {item.invoiceCount}
                          </Text>
                          <Text style={styles.stats}>
                            <Text style={styles.statLabel}>
                              Surgery Advised Rate:{' '}
                            </Text>
                            {item.diagnosisCounts.Surgery > 0
                              ? (
                                  (item.invoiceCount /
                                    item.diagnosisCounts.Surgery) *
                                  100
                                ).toFixed(2)
                              : 0}
                            %
                          </Text>
                          <Text style={styles.stats}>
                            <Text style={styles.statLabel}>
                              Same Month Surgery Rate:{' '}
                            </Text>
                            {item.thisMonthDiagnosedAndSurgeryPerformed} (
                            {item.diagnosisCounts.Surgery > 0
                              ? (
                                  (item.thisMonthDiagnosedAndSurgeryPerformed /
                                    item.diagnosisCounts.Surgery) *
                                  100
                                ).toFixed(2)
                              : 0}
                            %)
                          </Text>
                          {/* Overview Metrics */}
                          <View style={styles.metricsGrid}>
                            <MetricCardAssistant
                              label="Patients Diagnosed"
                              value={item.patientCount}
                            />
                            <MetricCardAssistant
                              label="Medication Advised"
                              value={item.diagnosisCounts.Medication}
                            />
                            <MetricCardAssistant
                              label="Surgery Advised"
                              value={item.diagnosisCounts.Surgery}
                            />
                          </View>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
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

export default ConvincingScoreV1;

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
    textAlign: 'center',
  },
  cell: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: '#000',
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
    justifyContent: 'space-between',
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
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 16,
  },
  content: {
    maxWidth: 512,
    alignSelf: 'center',
    width: '100%',
  },
  doctorCard: {
    margin: 0,
    padding: 0,
    elevation: 2,
  },
  surgeonCard: {
    borderTopWidth: 4,
    borderTopColor: '#3498db',
  },
  assistantCard: {
    borderTopWidth: 4,
    borderTopColor: '#9b59b6',
  },
  cardContent: {
    padding: 20,
  },
  doctorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  surgeonScore: {
    color: '#3498db',
  },
  assistantScore: {
    color: '#9b59b6',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  surgeonProgress: {
    backgroundColor: '#3498db',
  },
  assistantProgress: {
    backgroundColor: '#9b59b6',
  },
  stats: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  statLabel: {
    fontFamily: 'Lexend-Medium',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    margin: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  metricCardAssistant: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    margin: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#9b59b6',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginVertical: 5,
  },
  metricLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  performanceGrid: {
    //marginHorizontal: 8,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    borderLeftWidth: 4,
    paddingLeft: 10,
    marginVertical: 20,
  },
  surgeonTitle: {
    borderLeftColor: '#3498db',
  },
  assistantTitle: {
    borderLeftColor: '#9b59b6',
  },
  card3: {
    flex: 1,
    minWidth: '25%',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 10,
  },
});
