import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Portal,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const OPDReportPatientDetails = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const route = useRoute();
  const { patient } = route.params;
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, setItemsPerPage] = useState(numberOfItemsPerPageList[0]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(itemsPerPage);
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms';

  useEffect(() => {
    //console.log('Patient details:', location, patient);
    fetchPatientData(location, patient.patient_id);
  }, [location, patient.patient_id]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, patientData.length));
  }, [page, itemsPerPage, patientData.length]);

  const handleNextPage = () => {
    if ((page + 1) * itemsPerPage < patientData.length) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const fetchPatientData = async (location, patientId) => {
    try {
      setLoading(true);
      console.log(location, patientId);
      const response = await fetch(
        `${BACKEND_URL}/Patient/diagnosis/patient?location=${location}&patientId=${patientId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const res = await response.json();
      console.log('Diagnosis details: ', res);
      setPatientData(res);
    } catch (error) {
      console.log('Error fetching patient data: ', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={styles.card}>
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
          <Text style={styles.headerSubContainer}>Patient Information</Text>
          <Text style={{ ...styles.headerSubContainer, width: '25%' }}> </Text>
        </View>
        {patientData && patientData.length > 0 && (
          <View style={styles.itemContainer2}>
            <View
              style={{
                width: '95%',
              }}
            >
              <Text style={styles.textName}>{patientData[0].name}</Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.infoLabel}>
                {patientData[0].Uid_no || 'NA'}
              </Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.infoLabel}>
                First Visit :{' '}
                {new Date(patientData[0].date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.infoLabel}>
                Gender : {patientData[0].sex}
              </Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.infoLabel}>Age : {patientData[0].age}</Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.infoLabel}>
                Mobile-1 : {patientData[0].phone}
              </Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.infoLabel}>
                Mobile-2 : {patientData[0].mobile_2}
              </Text>
            </View>
          </View>
        )}

        <ScrollView style={styles.scrollView}>
          <View style={styles.itemContainer2}>
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
            {patientData.length > 0 ? (
              patientData.slice(from, to).map((item, index) => (
                <Card key={index} style={styles.itemContainer}>
                  <View style={styles.headContainer}>
                    <View style={{ width: '55%' }}>
                      <Text style={styles.patientName}>#Visit {index + 1}</Text>
                    </View>
                    <View
                      style={{
                        width: '42%',
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={styles.patientName}>
                        {new Date(item.date_diagnosis).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailsContainer}>
                    <View style={styles.infoContainer}>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Diagnosis</Text>
                        <Text style={styles.infoText}>{item.diagnosis}</Text>
                      </View>
                    </View>
                    <View style={styles.infoContainer}>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Advice</Text>
                        <Text style={styles.infoText}>
                          {item.diagnosisAdvice}
                          {item.advice && ` - ${item.advice}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoContainer}>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Consultant Dr.</Text>
                        <Text style={styles.infoText}>
                          {item.consultantDoctor}
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Assistant Dr.</Text>
                        <Text style={styles.infoText}>
                          {item.assistantDoctor}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>Data not available!</Text>
              </View>
            )}
          </View>
        </ScrollView>
        {/* Pagination Controls */}
        <View style={styles.paginationControls}>
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
          <Button
            mode="outlined"
            onPress={handleNextPage}
            disabled={(page + 1) * itemsPerPage >= patientData.length}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                (page + 1) * itemsPerPage >= patientData.length
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

export default OPDReportPatientDetails;

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
  nameContainer: { width: '100%', height: 55, overflow: 'hidden' },
  textName: {
    fontSize: 24,
    lineHeight: 36,
    fontFamily: 'Lexend-Medium',
    color: '#379AE6FF',
  },
  card: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    flex: 1,
    width: '100%',
  },
  header: {
    marginVertical: 3,
    width: '100%',
    backgroundColor: 'transparent',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  radioGroup: {
    width: '100%',
    marginVertical: 5,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: '20%',
    marginVertical: 5,
  },
  radioText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    paddingVertical: 5,
    paddingHorizontal: 8,
    width: '65%',
    borderWidth: 1,
    borderRadius: 20,
    borderTopEndRadius: 20,
    borderTopLeftRadius: 20,
    backgroundColor: '#fff',
  },
  scrollView: {
    height: '60%',
    width: '100%',
    marginTop: 10,
  },
  itemContainer: {
    backgroundColor: '#FFF3F0FF',
    width: '95%',
    borderRadius: 4,
    marginVertical: 5,
  },
  itemContainer2: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailsContainer: {
    width: '100%',
  },
  headContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 5,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 5,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Lexend-Regular',
  },
  infoText: {
    fontSize: 16,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  noDataText: {
    fontSize: 22,
    color: '#000',
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 8,
    height: 42,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationIcon: {
    width: 10,
    height: 10,
  },
  headerSubContainer: {
    fontFamily: 'Lexend-Medium',
    fontSize: 16,
    width: '50%',
    textAlign: 'center',
  },
  detailContainer: {
    paddingLeft: 12,
    borderWidth: 1,
    borderRadius: 4,
    width: '95%',
    height: 36,
    marginVertical: 3,
  },
});
