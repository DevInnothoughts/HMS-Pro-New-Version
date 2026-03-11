import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import {
  Text,
  Checkbox,
  TextInput,
  Button,
  Card,
  ProgressBar,
} from 'react-native-paper';
import { Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CallAndWebLeadApproval from './CallAndWebLeadApproval';
import OPDApproval from './OPDApproval';
import IPDApproval from './IPDApproval';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

const getYesterday = () => {
  const now = new Date();

  // Add IST offset (5.5 hours = 330 minutes)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // Subtract one day in IST-adjusted context
  istNow.setUTCDate(istNow.getUTCDate() - 1);
  console.log(istNow);
  // Extract and format date in UTC after IST shift
  const yyyy = istNow.getUTCFullYear();
  const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istNow.getUTCDate()).padStart(2, '0');

  const formatted = `${yyyy}-${mm}-${dd}`;
  console.log('IST Yesterday:', formatted);
  return formatted;
};

const ApprovalWizard = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const subRole = useSelector(state => state.location.subRole);

  const [stepIndex, setStepIndex] = useState(0);
  const [formState, setFormState] = useState({
    callApproved: false,
    //callComment: '',
    opdApproved: false,
    ipdApproved: false,
  });
  const [approvalDetails, setApprovalDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDisable, setIsDisable] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState({
    owner: false,
    clusterHead: false,
  });
  const [fadeAnim] = useState(new Animated.Value(0));

  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  useEffect(() => {
    fetchApprovalDetails(location);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [stepIndex]);

  const steps = [
    {
      title: '1. Call & Web Leads Approval',
      component: () => (
        <>
          <CallAndWebLeadApproval />
          <View style={styles.checkboxRow}>
            <Checkbox
              status={formState.callApproved ? 'checked' : 'unchecked'}
              onPress={() =>
                setFormState({
                  ...formState,
                  callApproved: !formState.callApproved,
                })
              }
              disabled={isDisable}
            />
            <Text>Approve</Text>
          </View>
          {/* <TextInput
            label="Comment (required)"
            value={formState.callComment}
            onChangeText={text =>
              setFormState({...formState, callComment: text})
            }
            mode="outlined"
            multiline
            style={styles.input}
          /> */}
        </>
      ),
      isValid: state => state.callApproved, //&& state.callComment.trim().length > 0,
    },
    {
      title: '2. OPD Collection Report Approval',
      component: () => (
        <>
          <OPDApproval />
          <View style={styles.checkboxRow}>
            <Checkbox
              status={formState.opdApproved ? 'checked' : 'unchecked'}
              onPress={() =>
                setFormState({
                  ...formState,
                  opdApproved: !formState.opdApproved,
                })
              }
              disabled={isDisable}
            />
            <Text>Approve</Text>
          </View>
        </>
      ),
      isValid: state => state.opdApproved,
    },
    {
      title: '3. IPD Bills and Collection Approval',
      component: () => (
        <>
          <IPDApproval />
          <View style={styles.checkboxRow}>
            <Checkbox
              status={formState.ipdApproved ? 'checked' : 'unchecked'}
              onPress={() =>
                setFormState({
                  ...formState,
                  ipdApproved: !formState.ipdApproved,
                })
              }
              disabled={isDisable}
            />
            <Text>Approve</Text>
          </View>
        </>
      ),
      isValid: state => state.ipdApproved,
    },
  ];

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;
  const isCurrentStepValid = currentStep.isValid(formState);

  const fetchApprovalDetails = async location => {
    if (!location) return;

    setLoading(true);
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
      };

      const response = await fetch(
        `${BACKEND_URL}/approval/approvalStatus?location=${location}`,
        requestOptions,
      );

      const res = await response.json();
      const mobile = await AsyncStorage.getItem('mobile');

      console.log('Approval details: ', res);
      setApprovalDetails(res);

      if (res.length > 0) {
        if (res[0].user1) {
          setApprovalStatus(prev => ({ ...prev, owner: true }));
        }

        if (res[0].user2) {
          setApprovalStatus(prev => ({ ...prev, clusterHead: true }));
        }

        const approved =
          (subRole === 'Owner' && res[0].user1 === mobile) ||
          (subRole === 'Cluster Head' && res[0].user2 === mobile);

        if (approved) {
          setFormState({
            callApproved: true,
            opdApproved: true,
            ipdApproved: true,
          });
          setIsDisable(true);
        }
      }
    } catch (error) {
      console.error('Approval fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log('Final Submission:', formState);
    let mobile = await AsyncStorage.getItem('mobile');

    const payload = {
      location: location,
      user: mobile, // assuming you collect this in formState
      subRole,
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    try {
      setLoading(true);
      fetch(`${BACKEND_URL}/approval`, requestOptions)
        .then(response => response.json())
        .then(res => {
          console.log('Approval submission response:', res);
          if (res.success) {
            Alert.alert('Success', res.message);
            navigation.goBack();
          } else {
            Alert.alert('Error', res.error || 'Something went wrong.');
          }
        })
        .catch(error => {
          console.error('Submission Error:', error);
          Alert.alert('Error', 'Network or server error.');
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
      setLoading(false);
      Alert.alert('Error', 'Unexpected error occurred.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Image
              style={{ height: 35, width: 35, tintColor: '#184D67' }}
              source={require('../../assets/back.png')}
            />
          </TouchableOpacity>
          <View style={{ flexDirection: 'column' }}>
            <Text style={styles.header}>Approval Wizard</Text>
            <Text style={styles.header}>{getYesterday()}</Text>
          </View>
          <View style={{ width: 35 }} />
        </View>

        {/* Progress Bar */}
        <ProgressBar
          progress={(stepIndex + 1) / totalSteps}
          color="#184D67"
          style={styles.progress}
        />

        {/* <View style={{flexDirection: 'column', marginBottom: 10}}>
        <Text
          style={{
            ...styles.status,
            color: approvalStatus.owner ? '#0a0' : '#a00',
          }}>
          Owner Approval : {approvalStatus.owner ? 'Approved' : 'Pending'}
        </Text>
        <Text
          style={{
            ...styles.status,
            color: approvalStatus.clusterHead ? '#0a0' : '#a00',
          }}>
          Cluster Head Approval :{' '}
          {approvalStatus.clusterHead ? 'Approved' : 'Pending'}
        </Text>
      </View> */}

        {/* Animated Step Content */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateX: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0], // slide in from right
                  }),
                },
              ],
            },
          ]}
        >
          <Card.Title titleStyle={styles.header2} title={currentStep.title} />
          <Card.Content>{currentStep.component()}</Card.Content>
        </Animated.View>

        {/* Navigation Buttons */}
        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={() => setStepIndex(stepIndex - 1)}
            disabled={stepIndex === 0}
          >
            Back
          </Button>

          {stepIndex < totalSteps - 1 && (
            <Button
              mode="contained"
              onPress={() => setStepIndex(stepIndex + 1)}
              disabled={!isCurrentStepValid}
            >
              Next
            </Button>
          )}
          {stepIndex === totalSteps - 1 && (
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!isCurrentStepValid || isDisable}
            >
              Submit
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ApprovalWizard;

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#FFF',
    flexGrow: 1,
  },
  headerContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Lexend-Regular',
  },
  header2: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Lexend-Regular',
  },
  status: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'Lexend-Regular',
  },
  progress: {
    height: 6,
    borderRadius: 10,
    marginBottom: 20,
  },
  card: {
    paddingVertical: 5,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#000',
    borderRadius: 10,
    elevation: 0,
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  input: {
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
});
