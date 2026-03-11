/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  LayoutAnimation,
} from 'react-native';

import {
  Card,
  Text,
  Button,
  RadioButton,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const SearchPatient = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, setItemsPerPage] = useState(numberOfItemsPerPageList[0]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(itemsPerPage);
  const [searchBy, setSearchBy] = useState('name');
  const [searchParam, setSearchParam] = useState('');
  const [patientData, setPatientData] = useState([]);
  const [loading1, setLoading1] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);

  const BACKEND_URL = 'https://wedoc.in/hms';

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

  const fetchPatientData = async location => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/Patient?location=${location}&${searchBy}=${encodeURIComponent(
          searchParam,
        )}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const res = await response.json();
      //console.log('Patient details: ', res);
      setPatientData(res);
    } catch (error) {
      console.log('Error fetching patient data: ', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatient = async () => {
    setLoading1(true);
    try {
      await fetchPatientData(location);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading1(false);
    }
  };

  const handleClick = async () => {
    await fetchPatient();
  };

  const hadlePatientClick = patient => {
    //console.log('Selected:', patient);
    navigation.navigate('PatientDetails', { patient });
  };

  // Toggle the expanded state
  const toggleExpandPatient = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={styles.card}>
        <View>
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
            <Text style={styles.textContainer}>Search Patient</Text>
            <Text style={{ ...styles.textContainer, width: '25%' }}> </Text>
          </View>
        </View>
        <View style={styles.header}>
          <View style={styles.radioGroup}>
            <View
              style={{
                display: 'flex',
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-around',
              }}
            >
              <View style={styles.radioContainer}>
                <RadioButton
                  value="name"
                  status={searchBy === 'name' ? 'checked' : 'unchecked'}
                  onPress={() => setSearchBy('name')}
                />
                <Text style={styles.radioText}>By Name</Text>
              </View>
              <View style={styles.radioContainer}>
                <RadioButton
                  value="mobile"
                  status={searchBy === 'mobile' ? 'checked' : 'unchecked'}
                  onPress={() => setSearchBy('mobile')}
                />
                <Text style={styles.radioText}>By Mobile</Text>
              </View>
            </View>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-around',
                alignItems: 'center',
                marginVertical: 5,
                width: '100%',
              }}
            >
              <TextInput
                style={styles.input}
                placeholder={
                  searchBy === 'name'
                    ? 'Enter patient name'
                    : 'Enter Mobile number'
                }
                placeholderTextColor={'#777'}
                onChangeText={text => setSearchParam(text)}
                value={searchParam}
              />

              <TouchableOpacity
                onPress={() => {
                  handleClick();
                }}
                style={{
                  height: 50,
                  width: 90,
                  borderWidth: 1,
                  borderRadius: 20,
                  backgroundColor: '#007bff',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}
                >
                  Search
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {patientData.length > 0 && (
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
            <View style={{ width: '70%', paddingLeft: 15 }}>
              <Text style={styles.medium}>NAME</Text>
            </View>
            <View style={{ width: '20%' }}>
              <Text style={styles.medium}>UID</Text>
            </View>
            <View style={{ width: '10%' }}>
              <Text> </Text>
            </View>
          </View>
        )}
        <ScrollView style={styles.scrollView}>
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
            <>
              {patientData.slice(from, to).map((item, index) => (
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
                      key={index}
                      style={{
                        width: '100%',
                        minHeight: 40,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <View style={styles.headContainer}>
                        <View style={{ width: '50%' }}>
                          <Text style={styles.patientName}>{item.name}</Text>
                        </View>
                        <View
                          style={{
                            width: '40%',
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={styles.patientName}>
                            {item.Uid_no || 'NA'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            hadlePatientClick(item);
                          }}
                          style={{
                            width: '10%',
                            minHeight: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Image
                            style={{
                              height: 28,
                              width: 28,
                            }}
                            source={require('../../assets/enter.png')}
                          />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                    {expandedPatientId === item.patient_id && (
                      <View style={styles.detailsContainer}>
                        <View style={styles.infoContainer}>
                          <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>First Visit</Text>
                            <Text style={styles.infoText}>
                              {new Date(item.date).toLocaleDateString()}
                            </Text>
                          </View>

                          <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Gender</Text>
                            <Text style={styles.infoText}>{item.sex}</Text>
                          </View>

                          <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Age</Text>
                            <Text style={styles.infoText}>{item.age}</Text>
                          </View>
                        </View>
                        <View style={styles.infoContainer}>
                          <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Mobile-1</Text>
                            <Text style={styles.infoText}>{item.phone}</Text>
                          </View>
                          <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Mobile-2</Text>
                            <Text style={styles.infoText}>{item.mobile_2}</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </Card>
              ))}
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>Data not available!</Text>
            </View>
          )}
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

export default SearchPatient;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  card: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    flex: 1,
    width: '100%',
  },
  header: {
    width: '100%',
    backgroundColor: 'transparent',
    height: 100,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    marginVertical: 8,
    paddingHorizontal: 10,
    width: '100%',
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    //backgroundColor: '#F2FFF2FF',
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  radioGroup: {
    width: '100%',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    padding: 15,
    width: '65%',
    borderWidth: 1,
    borderRadius: 20,
    borderTopEndRadius: 20,
    borderTopLeftRadius: 20,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    height: '70%',
    width: '100%',
  },
  itemContainer: {
    backgroundColor: '#f5f5dc',
    borderBottomColor: '#000',
    borderBottomWidth: 1,
    borderWidth: 1,
    borderRadius: 15,
    margin: 3,
    padding: 10,
  },
  patientName: {
    fontSize: 14,
    fontFamily: 'Lexend-Medium',
    lineHeight: 22,
  },
  detailsContainer: {
    width: '100%',
  },
  headContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
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
  textContainer: {
    fontFamily: 'Lexend-Medium',
    fontSize: 16,
    width: '50%',
    textAlign: 'center',
  },
});
