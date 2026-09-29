import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

import {
  Card,
  Text,
  Button,
  Portal,
  Modal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const IPDCollection = ({ collection = [], fromDate, toDate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);

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

  let totalCash = 0;
  let totalCard = 0;
  let totalOnline = 0;
  let totalCheque = 0;
  let totalInternalDiscount = 0;
  let totalHospitalDiscount = 0;

  // Calculate totals
  collection.forEach(item => {
    totalCash += +item.cashamt;
    totalCard += +item.cardamt;
    totalCheque += +item.chequeamt;
    totalOnline += +item.onlineamt;
    totalInternalDiscount += +item.discountamt;
    totalHospitalDiscount += +item.tdsamt;
  });
  return (
    <View
      style={{
        backgroundColor: '#f0f0f0',
        shadowColor: 'transparent',
        flex: 1,
        width: '100%',
        borderWidth: 0.5,
        borderColor: '#262626',
        marginTop: 15,
      }}
    >
      <Text style={styles.header}>IPD Collection Details</Text>
      <View style={styles.headerContainer}>
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
                      totalInternalDiscount +
                      totalHospitalDiscount,
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
                totalCash + totalCard + totalOnline + totalDiscount,
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
      </View>
      {isExpanded && (
        <View style={styles.headerSubContainer}>
          <Card style={styles.card}>
            <Text style={styles.subHeader}>Cash</Text>
            <Text style={styles.subHeader}>
              {new Intl.NumberFormat().format(totalCash)}
            </Text>
          </Card>
          <Card style={styles.card}>
            <Text style={styles.subHeader}>Card</Text>
            <Text style={styles.subHeader}>
              {new Intl.NumberFormat().format(totalCard)}
            </Text>
          </Card>
          <Card style={styles.card}>
            <Text style={styles.subHeader}>Online</Text>
            <Text style={styles.subHeader}>
              {new Intl.NumberFormat().format(totalOnline)}
            </Text>
          </Card>
          <Card style={styles.card}>
            <Text style={styles.subHeader}>cheque</Text>
            <Text style={styles.subHeader}>
              {new Intl.NumberFormat().format(totalCheque)}
            </Text>
          </Card>
          <View style={styles.card}>
            <Text style={styles.subHeader}>Internal Dscnt</Text>
            <Text>{new Intl.NumberFormat().format(totalInternalDiscount)}</Text>
          </View>
          <View style={{ ...styles.card, borderRightWidth: 0 }}>
            <Text style={styles.subHeader}>Hosp. Dscnt</Text>
            <Text>{new Intl.NumberFormat().format(totalHospitalDiscount)}</Text>
          </View>
        </View>
      )}

      {collection.length > 0 && (
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
        {collection.length > 0 ? (
          collection.map((item, index) => (
            <Card
              key={index}
              style={{
                backgroundColor:
                  expandedPatientId === item.patient_id ? '#F5F1FEFF' : '#fff',
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
                    <Text style={styles.medium}>{item.name}</Text>
                    {expandedPatientId === item.patient_id && (
                      <>
                        <Text style={styles.cell}>
                          Invoice :{' '}
                          {new Date(item.receipt_date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.cell}>
                          Receipt :{' '}
                          {new Date(item.receipt_date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.cell}>Status : {item.status}</Text>
                      </>
                    )}
                  </View>
                  <View style={{ width: '20%' }}>
                    <Text style={styles.medium}>
                      {item.cashamt +
                        item.cardamt +
                        item.onlineamt +
                        item.chequeamt}
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
                          <Text style={styles.amount}>{item.discountamt}</Text>
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
    </View>
  );
};

const IPDBillReport = ({ IPDBillData = [], fromDate, toDate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);

  let totalAmt = 0;
  let totalDiscount = 0;
  let totalPayable = 0;

  // Calculate totals
  IPDBillData.forEach(item => {
    totalAmt += +item.totalamt;
    totalDiscount += +item.discount;
    totalPayable += +item.payable_amt;
  });

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
  return (
    <View
      style={{
        backgroundColor: '#f0f0f0',
        shadowColor: 'transparent',
        flex: 1,
        width: '100%',
        borderWidth: 0.5,
        borderColor: '#262626',
      }}
    >
      <Text style={styles.header}>IPD Bill Details</Text>
      <View style={styles.headerContainer}>
        <Card style={{ ...styles.cardTotal, flexDirection: 'column' }}>
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
                  {new Intl.NumberFormat().format(totalAmt)}
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
      </View>

      {IPDBillData.length > 0 && (
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
          //width: '100%',
        }}
      >
        {IPDBillData.length > 0 ? (
          IPDBillData.map((item, index) => (
            <Card
              key={index}
              style={{
                backgroundColor:
                  expandedPatientId === item.patient_id ? '#F5F1FEFF' : '#fff',
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
                      paddingHorizontal: 10,
                      flexDirection: 'column',
                    }}
                  >
                    <Text style={styles.medium}>
                      {index + 1}. {item.name}
                    </Text>
                    {expandedPatientId === item.patient_id && (
                      <>
                        <Text style={styles.cell}>Mobile : {item.phone}</Text>
                        <Text style={styles.cell}>Status : {item.status}</Text>
                      </>
                    )}
                  </View>
                  <View style={{ width: '20%' }}>
                    <Text style={styles.medium}>{item.totalamt}</Text>
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
                    <View style={styles.amountContainer}>
                      <View style={styles.amountSubContainer2}>
                        <Text style={styles.amountLabel}>Total</Text>
                        <View style={styles.amountSubContainer}>
                          <Image
                            style={styles.amountIcon}
                            source={require('../../assets/cash.png')}
                          />
                          <Text style={styles.amount}>{item.totalamt}</Text>
                        </View>
                      </View>
                      <View style={styles.amountSubContainer2}>
                        <Text style={styles.amountLabel}>Discount</Text>
                        <View style={styles.amountSubContainer}>
                          <Image
                            style={styles.amountIcon}
                            source={require('../../assets/card.png')}
                          />
                          <Text style={styles.amount}>
                            {item.discount || 0}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.amountSubContainer2}>
                        <Text style={styles.amountLabel}>Payable</Text>
                        <View style={styles.amountSubContainer}>
                          <Image
                            style={styles.amountIcon}
                            source={require('../../assets/online.png')}
                          />
                          <Text style={styles.amount}>{item.payable_amt}</Text>
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
    </View>
  );
};

const IPDApproval = ({ navigation }) => {
  const location = useSelector(state => state.location.value);

  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getYesterday());
  const [loading, setLoading] = useState(false);

  const [IPDCollectionData, setIPDCollectionData] = useState([]);

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    fetchIPDCollection(location, fromDate, toDate);
  }, []);

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
        `${BACKEND_URL}/approval/ipdReport?location=${location}&from=${from}&to=${to}`,
        requestOptions,
      )
        .then(response => response.json())
        .then(res => {
          console.log('Doctor details: ', res);
          setIPDCollectionData(res);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <IPDBillReport
        IPDBillData={IPDCollectionData.ipdBills}
        fromDate={fromDate}
        toDate={toDate}
      />
      <IPDCollection
        collection={IPDCollectionData.ipdCollection}
        fromDate={fromDate}
        toDate={toDate}
      />

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
    </SafeAreaView>
  );
};

export default IPDApproval;

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
    minWidth: '22%',
    height: 80,
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
    marginVertical: 5,
    flexWrap: 'wrap',
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
