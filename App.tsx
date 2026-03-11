/* eslint-disable prettier/prettier */
import React, { useEffect } from 'react';
import {
  PermissionsAndroid,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import AdminHome from './src/admin/AdminHome';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import IPDCollectionReport from './src/admin/IPDCollectionReport';
import OPDCollectionReport from './src/admin/OPDCollectionReport';
import OPDIPDCollection from './src/admin/OPDIPDCollection';
import DailyOPDReport from './src/admin/DailyOPDReport';
import AppointmentDetails from './src/admin/AppointmentDetails';
import SearchPatient from './src/admin/SearchPatient';
import EnterMobile from './src/login/EnterMobile';
import VerifyOTP from './src/login/VerifyOTP';
import { store } from './src/store/store';
import PatientDetails from './src/admin/PatientDetails';
import CashDeposit from './src/admin/CashDeposit';
import IVRCallList from './src/admin/IVRCallList';
import OPDReportDetails from './src/admin/OPDReportDetails';
import IPDBillDetails from './src/admin/IPDBillDetails';
import DischargeCardDetails from './src/admin/DischargeCardDetails';
import HelplineCallList from './src/admin/HelplineCallList';
import AddUserForm from './src/admin/AddUserForm';
import ConvincingScore from './src/admin/ConvincingScore';
import CallingList from './src/admin/CallingList';
import DoctorHome from './src/doctor/DoctorHome';
import DoctorsAppointments from './src/doctor/DoctorsAppointments';
import DoctorsDischargeCardDetails from './src/doctor/DoctorsDischargeCardDetails';
import DoctorOPDReportDetails from './src/doctor/DoctorOPDReportDetails';
import ReferenceData from './src/admin/ReferenceData';
import WebLeads from './src/admin/WebLeads';
import IPDDueList from './src/admin/IPDDueList';
import ApprovalScreen from './src/admin/Approval';
import BotLeads from './src/admin/BotLeads';
import ApprovalStatus from './src/admin/ApprovalStatus';
import CallLogScreen from './src/admin/NewHelplineCallList';
import IPDBillSubCategoryDetails from './src/admin/IPDBillSubCategoryDetails';
import PerformanceScreen from './src/admin/Performance';
import ConvincingScoreV1 from './src/admin/ConvincingScoreNew';
import DiagnosisVoiceAssistant from './src/admin/VoceToTextDiagnosis';
import UserListScreen from './src/admin/UserList';
import PatientListScreen from './src/referredPatients/patientListScreen';
import PatientDetailsScreen from './src/referredPatients/patientDetailsScreen';
import ReferredBottomTab from './src/referredPatients/BottomTab';
import DashboardScreen from './src/referredPatients/DashboardScreen';
import DoctorPatientsScreen from './src/referredPatients/DoctorPatientsScreen';
import OPDReportPatientDetails from './src/admin/OPDReportPatientDetails';
import PharmacyInvoiceScreen from './src/admin/EvitalPharmacyData';
import ReportScreen from './src/admin/ReportScreen';
import NpsPatientList from './src/admin/NpsPatientList';
import PharmacyAnalysis from './src/admin/PharmacyAnalysis';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Notification permission granted');
        } else {
          console.log('Notification permission denied');
        }
      } catch (error) {
        console.error('Error while requesting notification permission:', error);
      }
    };

    requestNotificationPermission();
  }, []);
  return (
    <Provider store={store}>
      <PaperProvider theme={MD3LightTheme}>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="EnterMobile">
              <Stack.Screen
                name="EnterMobile"
                component={EnterMobile}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="VerifyOTP"
                component={VerifyOTP}
                options={{
                  title: 'Mobile Number Verification',
                  headerTintColor: '#000',
                  headerTitleStyle: {
                    fontFamily: 'Lexend-Regular',
                    fontSize: 16,
                  },
                }}
              />
              <Stack.Screen
                name="AdminHome"
                component={AdminHome}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="DoctorHome"
                component={DoctorHome}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="AdminIPDPayment"
                component={IPDCollectionReport}
                options={{
                  headerShown: false,
                  // title: 'IPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="AdminOPDPayment"
                component={OPDCollectionReport}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="AdminOPDIPDPayment"
                component={OPDIPDCollection}
                options={{
                  headerShown: false,
                  // title: 'OPD + IPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="DailyOPDPayment"
                component={DailyOPDReport}
                options={{
                  headerShown: false,
                  // title: 'Daily OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="AppointmentDetails"
                component={AppointmentDetails}
                options={{
                  headerShown: false,
                  // title: 'Appointment Details',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="DoctorsAppointments"
                component={DoctorsAppointments}
                options={{
                  headerShown: false,
                  // title: 'Appointment Details',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="SearchPatient"
                component={SearchPatient}
                options={{
                  headerShown: false,
                  // title: 'Search Patient',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="ConvincingScore"
                component={ConvincingScoreV1}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="AddUser"
                component={AddUserForm}
                options={{
                  headerShown: false,
                  // title: 'Search Patient',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="PatientDetails"
                component={PatientDetails}
                options={{
                  headerShown: false,
                  // title: 'Patient Details',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="CashDeposit"
                component={CashDeposit}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="Approval"
                component={ApprovalScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="IVRCall"
                component={IVRCallList}
                options={{
                  headerShown: false,
                  // title: 'Cash Deposit',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="HelplineCalls"
                component={HelplineCallList}
                options={{
                  headerShown: false,
                  // title: 'Cash Deposit',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              {/* <Stack.Screen
              name="NewHelplineCalls"
              component={CallLogScreen}
              options={{
                headerShown: false,
                // title: 'Cash Deposit',
                // headerTintColor: '#000',
                // headerTitleStyle: {fontSize: 20},
              }}
            /> */}
              <Stack.Screen
                name="OPDReportDetails"
                component={OPDReportDetails}
                options={{
                  headerShown: false,
                  // title: 'Cash Deposit',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="DoctorOPDReportDetails"
                component={DoctorOPDReportDetails}
                options={{
                  headerShown: false,
                  // title: 'Cash Deposit',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="IPDBillDetails"
                component={IPDBillDetails}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="IPDBillSubCategoryDetails"
                component={IPDBillSubCategoryDetails}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="IPDDueList"
                component={IPDDueList}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="DischargeCardDetails"
                component={DischargeCardDetails}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="DoctorsDischargeCardDetails"
                component={DoctorsDischargeCardDetails}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="CallingList"
                component={CallingList}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="ReferenceData"
                component={ReferenceData}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="WebLeads"
                component={WebLeads}
                options={{
                  headerShown: false,
                  // title: 'OPD Collection',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="BotLeads"
                component={BotLeads}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ApprovalStatus"
                component={ApprovalStatus}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="Performance"
                component={PerformanceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="DiagnosisAssistance"
                component={DiagnosisVoiceAssistant}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="UserList"
                component={UserListScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="GPDashboard"
                component={DashboardScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="referredPatientsList"
                component={PatientListScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="referredPatientsDetails"
                component={PatientDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="DoctorPatients"
                component={DoctorPatientsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="OPDReportPatientDetails"
                component={OPDReportPatientDetails}
                options={{
                  headerShown: false,
                  // title: 'Patient Details',
                  // headerTintColor: '#000',
                  // headerTitleStyle: {fontSize: 20},
                }}
              />
              <Stack.Screen
                name="EvitalPharmacyData"
                component={PharmacyInvoiceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ReportScreen"
                component={ReportScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="NpsPatientList"
                component={NpsPatientList}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="pharmacyAnalysis"
                component={PharmacyAnalysis}
                options={{
                  headerShown: false,
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </PaperProvider>
    </Provider>
  );
}

export default App;
