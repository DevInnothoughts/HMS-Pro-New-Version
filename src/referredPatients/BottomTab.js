import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from 'react-native-paper';
import {useSelector} from 'react-redux';

const ReferredBottomTab = ({navigation, fromDate, toDate}) => {
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  //console.log(subRole);
  return (
    <View
      style={{
        ...styles.btnMainContainer,
        backgroundColor: '#F2FFF2FF',
        marginVertical: 0,
        paddingVertical: 5,
      }}>
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('referredPatientsList', {fromDate, toDate});
        }}
        style={styles.bottomTab}>
        <Image
          style={{
            height: 24,
            width: 24,
          }}
          source={require('../../assets/searchPatient.png')}
        />
        <Text style={styles.bottomTabText}>Referred Patients</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate('GPDashboard', {fromDate, toDate});
        }}
        style={styles.bottomTab}>
        <Image
          style={{
            height: 24,
            width: 24,
          }}
          source={require('../../assets/conversionRate.png')}
        />
        <Text style={styles.bottomTabText}>Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ReferredBottomTab;

const styles = StyleSheet.create({
  btnMainContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    // marginVertical: ,
  },
  bottomTab: {
    width: '33%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomTabText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    lineHeight: 17,
  },
});
