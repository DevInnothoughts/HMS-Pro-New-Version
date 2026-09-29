/* eslint-disable react/self-closing-comp */
/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import { useCallback, useState, useEffect } from 'react';
import {
  Text,
  View,
  ScrollView,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
} from 'react-native';
import { Button, MD3LightTheme, Modal, TextInput } from 'react-native-paper';

import { DataTable, Card, Dialog, Portal } from 'react-native-paper';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const HelplineCallList = ({ navigation }) => {
  const route = useRoute();
  const { fromDate, toDate, status } = route.params;
  const location = useSelector(state => state.location.value);
  const [loading, setLoading] = useState(false);
  const [callRecord, setCallRecord] = useState([]);
  const [page, setPage] = useState(0);
  const [numberOfItemsPerPageList] = useState([10, 20, 30]);
  const [itemsPerPage, onItemsPerPageChange] = useState(
    numberOfItemsPerPageList[0],
  );
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [expandedId, setExpandedId] = useState(null);
  const [notAttended, setNotAttended] = useState(false);
  const [filteredList, setFilteredList] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //'http://192.168.0.118:4000/ivr';

  useEffect(() => {
    getData();
  }, [getData]);

  const getData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/HelplineCall?location=${location}&from=${fromDate}&to=${toDate}&status=${status}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const res = await response.json();
      console.log('Helpline details: ', res);
      setCallRecord(res);
      setFilteredList(res);
    } catch (error) {
      console.log('Error ', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, location, status, toDate]);

  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  useEffect(() => {
    setFrom(page * itemsPerPage);
    setTo(Math.min((page + 1) * itemsPerPage, filteredList.length));
  }, [filteredList.length, itemsPerPage, page]);

  const handlePhoneCall = callNumber => {
    const phoneNumber = callNumber;
    const scheme = Platform.OS === 'android' ? 'tel:' : 'telprompt:';
    const phoneUrl = scheme + phoneNumber;
    // console.log('Medical Call: ', phoneUrl);
    if (callNumber) {
      Linking.openURL(phoneUrl).catch(() => {
        console.log('Error!');
      });
    }
    return;
  };

  const handleWhatsapp = callNumber => {
    // console.log('Medical Call: ', phoneUrl);
    if (callNumber) {
      if (callNumber.startsWith('0')) {
        // Remove the leading '0' and return the modified number
        callNumber = callNumber.substring(1);
      }
      if (callNumber.startsWith('+91'))
        Linking.openURL(`whatsapp://send?text=${''}&phone=${callNumber}`).catch(
          () => {
            console.log('Error!');
          },
        );
      else
        Linking.openURL(
          `whatsapp://send?text=${''}&phone=+91${callNumber}`,
        ).catch(() => {
          console.log('Error!');
        });
    }
    return;
  };

  // Toggle the expanded state
  const toggleExpandPatient = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  useEffect(() => {
    const filtered = notAttended
      ? callRecord.filter(item => item.note === null)
      : callRecord;
    setFilteredList(filtered);
  }, [notAttended, callRecord]); // Also include callRecord if it can change

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
          <View style={{ width: '25%' }}>
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
          </View>
          <Text style={styles.header}>Helpline Call List</Text>
          <View
            style={{
              width: '25%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TouchableOpacity
              onPress={() => setNotAttended(prev => !prev)}
              activeOpacity={0.7} // Optional: adds a nice feedback effect
            >
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#aaa',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: notAttended ? '#888' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Lexend-Regular',
                    fontSize: 12,
                    color: notAttended ? '#fff' : '#000',
                  }}
                >
                  Not Attended
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

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
        <ScrollView
          style={{
            flex: 1,
            height: '70%',
            width: '100%',
          }}
        >
          {filteredList.length > 0 && (
            <View
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                shadowColor: 'transparent',
              }}
            >
              <DataTable style={{ width: '100%' }}>
                {filteredList.slice(from, to).map((item, index) => {
                  // Format the timestamp to a date string
                  const formattedDate = new Date(JSON.parse(item.timestamp));

                  return (
                    <DataTable.Row
                      onPress={() => toggleExpandPatient(item.call_log_id)}
                      key={index}
                      style={{
                        borderBottomColor: '#000',
                        borderBottomWidth: 1,
                        borderWidth: 1,
                        borderRadius: 4,
                        marginVertical: 5,
                        marginHorizontal: 3,
                        minHeight: 60,
                        backgroundColor:
                          item.note !== null ? '#FFB300' : '#fff',
                      }}
                    >
                      {/* Row content */}
                      <View
                        style={{
                          width: '100%',
                          minHeight: 60,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            display: 'flex',
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <View
                            style={{
                              display: 'flex',
                              width: '48%',
                              flexDirection: 'row',
                              alignItems: 'center',
                            }}
                          >
                            <View
                              style={{
                                display: 'flex',
                                width: '20%',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {item.type === 'INCOMING' ? (
                                <Image
                                  source={require('../../assets/incomingCall.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="Answered Call"
                                />
                              ) : item.type === 'MISSED' ||
                                item.type === 'UNKNOWN' ? (
                                <Image
                                  source={require('../../assets/missed.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="Missed Call"
                                />
                              ) : (
                                <Image
                                  source={require('../../assets/outgoingCall.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="OUTGOING Call"
                                />
                              )}
                            </View>
                            <View
                              style={{
                                width: '80%',
                                justifyContent: 'center',
                                marginLeft: 10,
                              }}
                            >
                              {item.name && (
                                <Text
                                  style={{
                                    ...styles.cell,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: '#000',
                                    width: '100%',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {item.name}
                                </Text>
                              )}
                              <Text style={{ ...styles.cell, color: '#000' }}>
                                {item.phoneNumber}
                              </Text>
                              {item.type === 'MISSED' ||
                              item.type === 'UNKNOWN' ? (
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'Lexend-Regular',
                                    lineHeight: 17,
                                    color: '#000',
                                  }}
                                >
                                  {'MISSED'}
                                </Text>
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'Lexend-Regular',
                                    lineHeight: 17,
                                    color: '#000',
                                  }}
                                >
                                  Duration: {item.duration} Sec
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={{ justifyContent: 'center' }}>
                            <Text style={{ ...styles.cell, color: '#000' }}>
                              {formattedDate.toLocaleDateString('en-GB')}
                            </Text>
                            <Text style={{ ...styles.cell, color: '#000' }}>
                              {formattedDate.toLocaleTimeString('en-GB')}
                            </Text>
                          </View>
                          <View
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: 'space-around',
                              width: '22%',
                            }}
                          >
                            <View
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <TouchableOpacity
                                activeOpacity={0.5}
                                onPress={() =>
                                  handlePhoneCall(item.phoneNumber)
                                }
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                <Image
                                  source={require('../../assets/call.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="Call now"
                                />
                              </TouchableOpacity>
                            </View>

                            <View
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <TouchableOpacity
                                activeOpacity={0.5}
                                onPress={() => handleWhatsapp(item.phoneNumber)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                <Image
                                  source={require('../../assets/whatsapp.png')}
                                  style={{ width: 30, height: 30 }}
                                  alt="WhatsApp"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                        {/* Note section */}
                        {expandedId === item.call_log_id && (
                          <View
                            style={{
                              width: '90%',
                              marginTop: 5,
                            }}
                          >
                            <Text style={styles.note}>Note : {item.note}</Text>
                          </View>
                        )}
                      </View>
                    </DataTable.Row>
                  );
                })}
              </DataTable>
            </View>
          )}
        </ScrollView>
        <DataTable.Pagination
          page={page}
          numberOfPages={Math.ceil(filteredList.length / itemsPerPage)}
          onPageChange={page => setPage(page)}
          label={`${from + 1}-${to} of ${filteredList.length}`}
          numberOfItemsPerPageList={numberOfItemsPerPageList}
          numberOfItemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
          selectPageDropdownLabel={'Records'}
          theme={MD3LightTheme}
          //style={{color: 'black', borderWidth: 2, borderColor: 'green'}}
          //showFastPaginationControls
        />
      </View>
    </SafeAreaView>
  );
};

export default HelplineCallList;

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
    marginBottom: 10,
    padding: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    //backgroundColor: '#F2FFF2FF',
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
    fontSize: 14,
    fontFamily: 'Lexend-Regular',
    lineHeight: 19,
    color: '#000000',
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  cell: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'Lexend-Regular',
    color: '#000',
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Lexend-Regular',
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
});
