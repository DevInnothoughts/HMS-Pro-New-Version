import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from 'react-native-paper';
import {useSelector} from 'react-redux';

const DoctorsBottomTab = ({navigation}) => {
  const role = useSelector(state => state.location.role);

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
          navigation.navigate('DoctorsAppointments');
        }}
        style={styles.bottomTab}>
        <Image
          style={{
            height: 24,
            width: 24,
          }}
          source={require('../../assets/medical.png')}
        />
        <Text style={styles.bottomTabText}>Appointment</Text>
      </TouchableOpacity>
      {role !== 'Doctor' && (
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('CashDeposit');
          }}
          style={styles.bottomTab}>
          <Image
            style={{
              height: 24,
              width: 24,
            }}
            source={require('../../assets/rupee.png')}
          />
          <Text style={styles.bottomTabText}>Cash Deposit</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('SearchPatient');
        }}
        style={styles.bottomTab}>
        <Image
          style={{
            height: 24,
            width: 24,
          }}
          source={require('../../assets/searchPatient.png')}
        />
        <Text style={styles.bottomTabText}>Search Patient</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate('ConvincingScore');
        }}
        style={styles.bottomTab}>
        <Image
          style={{
            height: 24,
            width: 24,
          }}
          source={require('../../assets/conversionRate.png')}
        />
        <Text style={styles.bottomTabText}>Convincing Score</Text>
      </TouchableOpacity>

      {role === 'SuperAdmin' && (
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('AddUser');
          }}
          style={styles.bottomTab}>
          <Image
            style={{
              height: 24,
              width: 24,
            }}
            source={require('../../assets/addUser.png')}
          />
          <Text style={styles.bottomTabText}>Add User</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default DoctorsBottomTab;

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
