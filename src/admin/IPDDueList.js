// PatientsDueScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  LayoutAnimation,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { Dropdown } from 'react-native-element-dropdown';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

const IPDDueList = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const [groupedPatients, setGroupedPatients] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [visibleCounts, setVisibleCounts] = useState({});
  const [status, setStatus] = useState('');
  const [ipdSummary, setIPDSummary] = useState({});
  const statusList = [
    { label: 'All', value: '' },
    { label: 'Charity', value: 'Charity' },
    { label: 'Reimbursement', value: 'Reimbursement' },
    { label: 'Cashless', value: 'Cashless' },
    { label: 'NonInsurance', value: 'NonInsurance' },
    { label: 'PDC', value: 'PDC' },
  ];

  useEffect(() => {
    const fetchDuePatients = async () => {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
      };
      try {
        const response = await fetch(
          `${BACKEND_URL}/IPDCollection/statuswiseDueList?location=${location}&status=${
            status || ''
          }`,
          requestOptions,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(data['<30 days']);
        setGroupedPatients(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchDuePatients();
  }, [location, status]);

  useEffect(() => {
    const fetchIPDSummary = async () => {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
      };

      try {
        const response = await fetch(
          `${BACKEND_URL}/IPDCollection/ipdTotalSummary?location=${location}&status=${status}`,
          requestOptions,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('IPD Summary:', data);
        setIPDSummary(data);
      } catch (err) {
        console.error('Fetch Error:', err);
        setError(err.message);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchIPDSummary();
  }, [location, status]);

  const renderDueCategory = (category, patients, totalDue) => {
    let categoryColor = '#666';
    if (category === '>90 days') categoryColor = '#d32f2f'; // Red
    else if (category === '>60 days') categoryColor = '#ff9800'; // Orange
    else if (category === '>30 days') categoryColor = '#ffcb0b'; // Yellow
    else categoryColor = '#4caf50'; // Green

    return (
      <View key={category} style={styles.categoryContainer}>
        <TouchableOpacity
          style={[styles.categoryHeader, { backgroundColor: categoryColor }]}
          onPress={() => {
            toggleExpandCategory(category);
            setVisibleCounts(prev => ({
              ...prev,
              [category]: prev[category] || 100,
            }));
          }}
        >
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.categoryCount}>{patients.length} patients</Text>
            <Text style={styles.categoryCount}>
              ₹{new Intl.NumberFormat().format(totalDue)} total due
            </Text>
          </View>
        </TouchableOpacity>

        {expandedCategory === category && (
          <>
            {patients
              .slice(0, visibleCounts[category] || 100)
              .map((patient, index) => (
                <Card
                  key={`${patient.patient_id}-${patient.invoice_id}`}
                  style={styles.patientCard}
                  onPress={() => toggleExpandPatient(patient.invoice_id)}
                >
                  <Card.Content>
                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <Title
                        style={{
                          fontSize: 14,
                          fontFamily: 'Lexend-Regular',
                          color: '#000',
                          width: '65%',
                        }}
                      >
                        {index + 1}. {patient.name}
                      </Title>
                      <Paragraph>
                        ₹{new Intl.NumberFormat().format(patient.totaldue)}
                      </Paragraph>
                      <Image
                        style={{
                          width: 26,
                          height: 26,
                          objectFit: 'contain',
                        }}
                        source={
                          expandedPatientId === patient.invoice_id
                            ? require('../../assets/up-arrow.png')
                            : require('../../assets/down-arrow.png')
                        }
                      />
                    </View>

                    {expandedPatientId === patient.invoice_id && (
                      <>
                        <Paragraph>Patient ID: {patient.patient_id}</Paragraph>
                        <Paragraph>Invoice ID: {patient.invoice_id}</Paragraph>
                        <Paragraph>
                          Invoice Date:{' '}
                          {new Date(patient.creation_date).toLocaleDateString()}
                        </Paragraph>
                        <Paragraph>
                          Bill Amount: ₹
                          {new Intl.NumberFormat().format(
                            Number(patient.totalamt),
                          )}
                        </Paragraph>
                        <Paragraph>
                          Total Due: ₹
                          {new Intl.NumberFormat().format(patient.totaldue)}
                        </Paragraph>
                        {patient.companyname && (
                          <Paragraph>Company: {patient.companyname}</Paragraph>
                        )}
                      </>
                    )}
                  </Card.Content>
                </Card>
              ))}

            {visibleCounts[category] < patients.length && (
              <TouchableOpacity
                style={{
                  alignSelf: 'center',
                  backgroundColor: '#e0e0e0',
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                  borderRadius: 6,
                  marginVertical: 10,
                }}
                onPress={() =>
                  setVisibleCounts(prev => ({
                    ...prev,
                    [category]: prev[category] + 100,
                  }))
                }
              >
                <Text style={{ color: '#000' }}>Show More</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  // Toggle the expanded state
  const toggleExpandPatient = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };
  const toggleExpandCategory = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategory(expandedCategory === id ? null : id);
    setVisibleCounts({});
  };

  const IPDSummaryBox = React.memo(({ IPDSummary, loadingSummary }) => {
    if (loadingSummary) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.loadingText}>Loading summary...</Text>
        </View>
      );
    }

    if (!IPDSummary || Object.keys(IPDSummary).length === 0) {
      return null;
    }

    const {
      total_invoice_amount,
      total_collection_amount,
      total_due_amount,
      total_discount_amount,
    } = IPDSummary;

    const invoice = Number(total_invoice_amount || 0);
    const collection = Number(total_collection_amount || 0);
    const due = Number(total_due_amount || 0);
    const discount = Number(total_discount_amount || 0);

    const difference = invoice - collection;
    const isReconciled = difference === due;

    return (
      <Card style={styles.card}>
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: isReconciled ? '#d0f0c0' : '#ffcdd2' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: isReconciled ? '#2e7d32' : '#c62828' },
            ]}
          >
            {isReconciled
              ? 'Reconciliation Successful'
              : 'Reconciliation Failed'}
          </Text>

          {!isReconciled && (
            <>
              <Text style={styles.discrepancyText}>
                Expected Due = ₹{new Intl.NumberFormat().format(difference)}
              </Text>
              <Text style={styles.discrepancyText}>
                Actual Due = ₹{new Intl.NumberFormat().format(due)}
              </Text>
              <Text style={styles.discrepancyText}>
                Due Difference = ₹
                {new Intl.NumberFormat().format(Math.abs(due - difference))}
              </Text>
            </>
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Total Invoice:</Text>
          <Text style={styles.value}>
            ₹{new Intl.NumberFormat().format(invoice)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Collection:</Text>
          <Text style={styles.value}>
            ₹{new Intl.NumberFormat().format(collection)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Discount:</Text>
          <Text style={styles.value}>
            ₹{new Intl.NumberFormat().format(discount)}
          </Text>
        </View>
        {/* <View style={styles.row}>
          <Text style={styles.label}>Total Due:</Text>
          <Text style={styles.value}>
            ₹{new Intl.NumberFormat().format(due)}
          </Text>
        </View> */}
      </Card>
    );
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // if (error) {
  //   return (
  //     <View style={styles.center}>
  //       <Text style={styles.error}>Error: {error}</Text>
  //     </View>
  //   );
  // }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.container}>
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
          <View style={{ display: 'flex', flexDirection: 'column' }}>
            <Text style={styles.header}>IPD Due List</Text>
            <Text style={styles.header}>
              Total Due: ₹
              {new Intl.NumberFormat().format(
                ['<30 days', '>30 days', '>60 days', '>90 days'].reduce(
                  (sum, category) => {
                    return sum + (groupedPatients?.[category]?.totalDue || 0);
                  },
                  0,
                ),
              )}
            </Text>
          </View>
          <Text style={styles.header}> </Text>
        </View>

        {error && (
          <View style={styles.center}>
            <Text style={styles.error}>Error: {error}</Text>
          </View>
        )}
        <ScrollView style={{ flex: 1 }}>
          <View
            style={{
              padding: 16,
              marginBottom: 10,
              borderWidth: 0.5,
              borderColor: '#000',
            }}
          >
            <Text style={styles.title}>Select Due Type</Text>
            <Dropdown
              style={{
                height: 45,
                borderColor: '#ccc',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 10,
              }}
              data={statusList}
              labelField="label"
              valueField="value"
              placeholder="Select Type"
              value={status}
              onChange={item => {
                setStatus(item.value);
              }}
              placeholderStyle={{
                color: '#232323',
                fontFamily: 'Lexend-Regular',
                fontSize: 14,
              }}
              selectedTextStyle={{
                color: '#000',
                fontFamily: 'Lexend-Regular',
                fontSize: 16,
              }}
              itemTextStyle={{
                color: '#000',
                fontFamily: 'Lexend-Regular',
                fontSize: 16,
              }}
            />
          </View>
          {groupedPatients &&
            Object.entries(groupedPatients).map(([category, data]) =>
              renderDueCategory(category, data.patients, data.totalDue),
            )}
        </ScrollView>
        <IPDSummaryBox
          IPDSummary={ipdSummary}
          loadingSummary={loadingSummary}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    marginVertical: 3,
    paddingVertical: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    //backgroundColor: '#F2FFF2FF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: 'red',
    fontSize: 16,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  categoryTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryCount: {
    color: 'white',
    fontSize: 16,
  },
  patientCard: {
    marginBottom: 10,
    elevation: 2,
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Lexend-Regular',
    //textAlign: 'center',
    marginBottom: 4,
  },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#ffffff',
  },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  label: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
});

export default IPDDueList;
