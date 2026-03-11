/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/react-in-jsx-scope */
/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable prettier/prettier */
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {Image, BackHandler, Dimensions} from 'react-native';
import AppointmentDetails from './AppointmentDetails';
import CashDeposit from './CashDeposit';
import SearchPatient from './SearchPatient';
import PerformanceScreen from './Performance';
const height = Dimensions.get('window').height;

const Routes = () => {
  const tab = createBottomTabNavigator();
  return (
    <tab.Navigator
      screenOptions={{
        headerShown: true,

        tabBarStyle: {
          backgroundColor: '#DEF1EB', // set background color here
          height: height * 0.085,
        },
        selectedBackgroundColor: 'red',
      }}
      headerShown={true}>
      {/* <tab.Screen
        name="AppointmentDetails"
        component={AppointmentDetails}
        options={{
          headerShown: true,
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: 400,
            color: 'black',
            paddingBottom: 5,
          },
          tabBarLabel: 'Appointments',
          tabBarIcon: ({focused}) => {
            return (
              <Image
                style={{
                  height: 25,
                  width: 28,
                  tintColor: focused ? 'skyblue' : '#376858',
                }}
                source={require('../../assets/appointment.png')}
              />
            );
          },
        }}
      /> */}
      <tab.Screen
        name="Performance"
        component={PerformanceScreen}
        options={{
          headerShown: true,
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: 400,
            color: 'black',
            paddingBottom: 5,
          },
          tabBarLabel: 'Performance',
          tabBarIcon: ({focused}) => {
            return (
              <Image
                style={{
                  height: 25,
                  width: 28,
                  tintColor: focused ? 'skyblue' : '#376858',
                }}
                source={require('../../assets/appointment.png')}
              />
            );
          },
        }}
      />

      <tab.Screen
        name="CashDeposit"
        component={CashDeposit}
        options={{
          headerShown: true,
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: 400,
            color: 'black',
            paddingBottom: 5,
          },
          tabBarLabel: 'Cash Deposit',
          tabBarIcon: ({focused}) => {
            return (
              <Image
                style={{
                  height: 25,
                  width: 28,

                  tintColor: focused ? 'skyblue' : '#376858',
                }}
                source={require('../../assets/appointment.png')}
              />
            );
          },
        }}
      />
      <tab.Screen
        name="SearchPatient"
        component={SearchPatient}
        options={{
          headerShown: true,
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: 400,
            color: 'black',
            paddingBottom: 5,
          },
          tabBarLabel: 'Search Patient',
          tabBarIcon: ({focused}) => {
            return (
              <Image
                style={{
                  height: 25,
                  width: 28,

                  tintColor: focused ? 'skyblue' : '#376858',
                }}
                source={require('../../assets/searchPatient.png')}
              />
            );
          },
        }}
      />
    </tab.Navigator>
  );
};

export default Routes;
