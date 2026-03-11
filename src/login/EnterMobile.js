/* eslint-disable prettier/prettier */
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  TextInput,
  ScrollView,
  BackHandler,
  Alert,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  Text,
} from 'react-native-paper';
import VerifyOTP from './VerifyOTP';

import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import {
  setLocation,
  setLocationArray,
  setRole,
  setSubRole,
} from '../store/locationSlice';
import { SafeAreaView } from 'react-native-safe-area-context';

const EnterMobile = ({ navigation }) => {
  const dispatch = useDispatch();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ status: false, message: '' });
  const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

  const fetchFirebaseData = async () => {
    const querySnapshot = await firestore()
      .collection('users')
      .doc(mobile)
      .get();
    let item = querySnapshot.data();
    console.log(item);
  };

  // For exiting App
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        BackHandler.exitApp();
        return true;
      };
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );
      return () => backHandler.remove();
    }, []),
  );

  useEffect(() => {
    const fetchUser = async () => {
      let mobile = await AsyncStorage.getItem('mobile');
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (mobile && deviceId) {
        setLoading(true);
        firestore()
          .collection('users')
          .doc(mobile)
          .get()
          .then(async data => {
            let data1 = data.data();
            console.log(data1);
            if (data1.deviceId === deviceId && data1.isActive) {
              if (data1.isAllowed) {
                // Dispatch the location to Redux
                if (
                  data1.role &&
                  (data1.role === 'Admin' || data1.role === 'SuperAdmin')
                ) {
                  dispatch(setRole(data1.role));
                  dispatch(setLocationArray(data1.location));
                  dispatch(setLocation(data1.location[0]));
                  dispatch(setSubRole(data1.subRole ? data1.subRole : ''));
                  setLoading(false);
                  navigation.navigate('AdminHome', {
                    location: data1.location[0],
                  });
                } else {
                  if (data1.role && data1.role === 'Doctor') {
                    dispatch(setLocationArray(data1.location));
                    dispatch(setLocation(data1.location[0]));
                    dispatch(setRole('Doctor'));
                    dispatch(setSubRole(''));
                    setLoading(false);
                    navigation.navigate('DoctorHome', {
                      location: data1.location,
                    });
                  } else {
                    dispatch(setLocation(data1.location));
                    dispatch(setLocationArray([]));
                    dispatch(setRole(''));
                    dispatch(setSubRole(data1.subRole ? data1.subRole : ''));
                    setLoading(false);
                    navigation.navigate('AdminHome', {
                      location: data1.location,
                    });
                  }
                }
              } else {
                Alert.alert('Error', 'Please contact administrator');
                return;
              }
            }
          })
          .finally(() => setLoading(false));
      } else {
        return;
      }
    };
    fetchUser();
  }, [dispatch, navigation]);

  const validateMobile = mobile => {
    // Basic validation for mobile number
    const mobilePattern = /^[0-9]{10}$/;
    return mobilePattern.test(mobile);
  };

  const verifyMobile = () => {
    const trimmedMobile = mobile.trim();

    if (!validateMobile(trimmedMobile)) {
      setError({
        status: true,
        message:
          'Invalid mobile number. Please enter a 10-digit mobile number.',
      });
      return;
    }

    console.log('Mobile:', trimmedMobile);
    setLoading(true);

    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };

    fetch(`${BACKEND_URL}/Common?mobile=${trimmedMobile}`, requestOptions)
      .then(async response => {
        const res = await response.json();
        if (!response.ok) {
          console.error('Error:', res.message || 'Unexpected error');
          setError({
            status: true,
            message: res.message || 'Unexpected error',
          });
          setLoading(false);
          return;
        }
        if (response.status === 200) {
          setError({ status: false, message: '' });
          setLoading(false);
          navigation.navigate('VerifyOTP', { mobile: trimmedMobile });
        }
      })
      .catch(error => {
        console.error('Error:', error);
        Alert.alert(
          'Error',
          error.message || 'An error occurred, please try again.',
        );
        setError({
          status: true,
          message: 'An error occurred, please try again.',
        });
      })
      .finally(() => setLoading(false));
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1, width: '100%' }}>
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
              <Text variant="bodyMedium">Sending OTP...</Text>
            </Dialog.Content>
            <ActivityIndicator
              animating={loading}
              size={'large'}
              color={'#0d7592'}
            />
          </Dialog>
        </Portal>
        <View
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            marginTop: '5%',
            alignItems: 'center',
          }}
        >
          <Image
            style={{
              width: 150,
              height: 80,
              objectFit: 'cover',
            }}
            source={require('../../assets/hmslogo.png')}
          />
          <Text style={{ fontSize: 24, color: '#000', marginTop: 5 }}>
            Login
          </Text>
          <Image
            style={{
              width: 350,
              height: 250,
              objectFit: 'cover',
            }}
            source={require('../../assets/mobilePage.png')}
          />

          <TextInput
            value={mobile}
            placeholder="Mobile Number"
            style={{
              width: 300,
              padding: 15,
              fontSize: 18,
              color: '#000',
              backgroundColor: '#F5F1FEFF',
              borderRadius: 25,
              marginVertical: 25,
            }}
            onChange={event => {
              setMobile(event.nativeEvent.text);
              setError({ status: false, message: '' });
            }}
          ></TextInput>

          <Button
            mode="contained"
            onPress={() => {
              verifyMobile();
            }}
            style={{
              width: 300,
              padding: 10,
              borderRadius: 25,
              backgroundColor: '#007bff',
            }}
            labelStyle={{ fontSize: 18 }}
            buttonColor="#0d7592"
          >
            Generate OTP
          </Button>
          {error.status && (
            <Text style={{ fontSize: 16, color: '#a00', marginVertical: 5 }}>
              {error.message}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EnterMobile;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
});
