import {useEffect, useState} from 'react';
import {
  Image,
  StyleSheet,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  Text,
} from 'react-native-paper';

import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import firestore from '@react-native-firebase/firestore';
import {useRoute} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import {useDispatch} from 'react-redux';
import {
  setLocation,
  setLocationArray,
  setRole,
  setSubRole,
} from '../store/locationSlice';
import {SafeAreaView} from 'react-native-safe-area-context';

const CELL_COUNT = 4;
const RESEND_OTP_TIME_LIMIT = 60;

const VerifyOTP = ({navigation}) => {
  const route = useRoute();
  const dispatch = useDispatch();
  const {mobile} = route.params;
  const [OTP, setOTP] = useState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({status: false, message: ''});
  let resendOtpTimerInterval;

  const [resendButtonDisabledTime, setResendButtonDisabledTime] = useState(
    RESEND_OTP_TIME_LIMIT,
  );

  //to start resent otp option
  const startResendOtpTimer = () => {
    if (resendOtpTimerInterval) {
      clearInterval(resendOtpTimerInterval);
    }
    resendOtpTimerInterval = setInterval(() => {
      if (resendButtonDisabledTime <= 0) {
        clearInterval(resendOtpTimerInterval);
      } else {
        setResendButtonDisabledTime(resendButtonDisabledTime - 1);
      }
    }, 1000);
  };

  //on click of resend button
  const onResendOtpButtonPress = () => {
    //clear input field
    setValue('');
    setResendButtonDisabledTime(RESEND_OTP_TIME_LIMIT);
    startResendOtpTimer();

    // resend OTP Api call
    // todo
    console.log('todo: Resend OTP');
  };

  //declarations for input field
  const [value, setValue] = useState('');
  //const ref = useBlurOnFulfill({value, cellCount: CELL_COUNT});
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });

  //start timer on screen on launch
  useEffect(() => {
    startResendOtpTimer();
    return () => {
      if (resendOtpTimerInterval) {
        clearInterval(resendOtpTimerInterval);
      }
    };
  }, [resendButtonDisabledTime]);

  const verifyOtp = async () => {
    setLoading(true);
    firestore()
      .collection('users')
      .doc(mobile)
      .get()
      .then(async data => {
        let data1 = data.data();
        console.log('Data1:', data1);
        console.log('OTP:', value);
        console.log('Req OTP:', data1.otp.code);
        if (data1.otp.code === value) {
          // Generate or retrieve device unique ID
          const uniqueId = await DeviceInfo.getUniqueId();
          data1.deviceId = uniqueId;
          data1.isActive = true;
          data1.otp = {code: '', validTill: ''};
          await firestore().collection('users').doc(mobile).update(data1);
          await AsyncStorage.setItem('deviceId', uniqueId);
          await AsyncStorage.setItem('mobile', mobile);
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
            navigation.navigate('AdminHome', {location: data1.location[0]});
          } else {
            if (data1.role && data1.role === 'Doctor') {
              dispatch(setLocationArray(data1.location));
              dispatch(setLocation(data1.location[0]));
              dispatch(setRole('Doctor'));
              dispatch(setSubRole(''));
              setLoading(false);
              navigation.navigate('DoctorHome', {location: data1.location});
            } else {
              dispatch(setLocation(data1.location));
              dispatch(setLocationArray([]));
              dispatch(setRole(''));
              dispatch(setSubRole(data1.subRole ? data1.subRole : ''));
              setLoading(false);
              navigation.navigate('AdminHome', {location: data1.location});
            }
          }
        } else {
          setError({status: true, message: 'Please enter valid OTP.'});
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <ScrollView style={{flex: 1, width: '100%'}}>
        <Portal>
          <Dialog
            visible={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 20,
            }}>
            <Dialog.Content>
              <Text variant="bodyMedium">Verifying OTP...</Text>
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

            alignItems: 'center',
          }}>
          <Image
            style={{
              width: 300,
              height: 250,
              objectFit: 'cover',
              marginBottom: 25,
            }}
            source={require('../../assets/otpPage.png')}
          />
          <Text style={styles.title}>Verify the Authorisation Code</Text>
          <Text style={styles.subTitle}>Sent to {mobile}</Text>
          {error.status && (
            <Text style={{fontSize: 16, color: '#a00', marginVertical: 5}}>
              {error.message}
            </Text>
          )}
          <CodeField
            //ref={ref}
            {...props}
            value={value}
            onChangeText={setValue}
            cellCount={CELL_COUNT}
            rootStyle={styles.codeFieldRoot}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            renderCell={({index, symbol, isFocused}) => (
              <View
                onLayout={getCellOnLayoutHandler(index)}
                key={index}
                style={[styles.cellRoot, isFocused && styles.focusCell]}>
                <Text style={styles.cellText}>
                  {symbol || (isFocused ? <Cursor /> : null)}
                </Text>
              </View>
            )}
          />
          {/* View for resend otp  */}
          {resendButtonDisabledTime > 0 ? (
            <Text style={styles.resendCodeText}>
              Resend Authorisation Code in {resendButtonDisabledTime} sec
            </Text>
          ) : (
            <TouchableOpacity onPress={onResendOtpButtonPress}>
              <View style={styles.resendCodeContainer}>
                <Text style={styles.resendCode}>
                  {' '}
                  Resend Authorisation Code
                </Text>
                <Text style={{marginTop: 40}}>
                  {' '}
                  in {resendButtonDisabledTime} sec
                </Text>
              </View>
            </TouchableOpacity>
          )}
          <Button
            mode="contained"
            onPress={() => {
              verifyOtp();
            }}
            style={{
              width: 300,
              padding: 10,
              marginTop: 25,
              borderRadius: 25,
              backgroundColor: '#007bff',
            }}
            labelStyle={{fontSize: 18}}
            buttonColor="#0d7592">
            Verify
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VerifyOTP;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'left',
    fontSize: 20,
    marginStart: 20,
    fontWeight: 'bold',
  },
  subTitle: {
    textAlign: 'left',
    fontSize: 16,
    marginStart: 20,
    marginTop: 10,
  },
  codeFieldRoot: {
    marginTop: 40,
    width: '70%',
    marginLeft: 20,
    marginRight: 20,
  },
  cellRoot: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomColor: '#999',
    borderBottomWidth: 1,
  },
  cellText: {
    color: '#000',
    fontSize: 28,
    textAlign: 'center',
  },
  focusCell: {
    borderBottomColor: '#007AFF',
    borderBottomWidth: 2,
  },

  button: {
    marginTop: 20,
  },
  resendCode: {
    color: '#2EBCB8',
    marginStart: 20,
    marginTop: 40,
  },
  resendCodeText: {
    marginStart: 20,
    marginTop: 40,
  },
  resendCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
