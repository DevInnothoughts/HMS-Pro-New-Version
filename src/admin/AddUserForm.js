import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { TextInput, Button, RadioButton, Text, Chip } from 'react-native-paper';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from '@react-native-firebase/firestore';
import BottomTab from './BottomTab';
import { SafeAreaView } from 'react-native-safe-area-context';

const AddUserForm = ({ navigation }) => {
  const [isActive, setIsActive] = useState(false);
  const [isAllowed, setIsAllowed] = useState(true);
  const [location, setLocation] = useState([]);
  const [locationArray, setLocationArray] = useState([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('User');
  const [subRole, setSubRole] = useState('');
  const [otp, setOtp] = useState({ code: '', validTill: '' });

  const db = getFirestore();

  const checkIfDocumentExists = async docId => {
    try {
      const docRef = doc(db, 'users', docId);
      const docSnap = await getDoc(docRef);

      return docSnap.exists();
    } catch (error) {
      console.error('Error checking document existence:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchFirebaseData();
  }, []);

  const fetchFirebaseData = async () => {
    try {
      const docRef = doc(db, 'HHCLocations', 'HHCLocations');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.error('HHCLocations document does not exist');
        return;
      }

      const item = docSnap.data();

      if (item && Array.isArray(item.locations)) {
        setLocationArray(item.locations);
      } else {
        console.error('Locations data is not in the expected format.');
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const validateForm = () => {
    if (name.trim() === '') {
      Alert.alert('Invalid Input', 'Please enter a valid name.');
      return false;
    }
    // Mobile number validation: must be 10 digits
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid 10-digit mobile number.',
      );
      return false;
    }

    // Role validation: must be either "Admin" or "User"
    // if (!role) {
    //   Alert.alert('Invalid Input', 'Please select a role (Admin or User).');
    //   return false;
    // }

    // Location validation: must select at least one location
    if (role === 'Admin' && location.length === 0) {
      Alert.alert('Invalid Input', 'Please select at least one location.');
      return false;
    }
    if (role !== 'Admin' && location.length !== 1) {
      Alert.alert(
        'Invalid Input',
        'Please select a single location for the User role.',
      );
      return false;
    }

    return true;
  };

  const handleAddUser = async () => {
    if (!validateForm()) {
      return;
    }

    const newUser = {
      isActive,
      isAllowed,
      location: role === 'Admin' ? location : location[0],
      mobile,
      name,
      role,
      subRole,
    };

    try {
      // Check if the document already exists
      const documentExists = await checkIfDocumentExists(mobile);

      if (documentExists) {
        Alert.alert('Error', 'A user with this mobile number already exists.');
        return;
      }

      await setDoc(doc(db, 'users', mobile), newUser);
      Alert.alert('Success', 'User added successfully!');
      setMobile('');
      setLocation([]);
      setRole('User');
      setName('');
      setSubRole('');
    } catch (error) {
      console.error('Error adding user:', error);
      Alert.alert('Error', 'Failed to add user. Please try again.');
    }
  };

  const handleLocationSelect = loc => {
    if (role === 'Admin') {
      if (location.includes(loc)) {
        setLocation(location.filter(l => l !== loc));
      } else {
        setLocation([...location, loc]);
      }
    } else {
      setLocation([loc]);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
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

        <Text
          style={{
            fontSize: 22,
            fontWeight: 600,
            //marginTop: 10,
            textAlign: 'center',
          }}
        >
          Create New User Login
        </Text>
        <Text
          style={{
            fontSize: 22,
            fontWeight: 600,
            //marginTop: 10,
            textAlign: 'center',
          }}
        ></Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, backgroundColor: '#fff' }}
      >
        {/* <Text style={{fontSize: 18, fontWeight: 500, marginTop: 10}}>Name:</Text> */}
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={{ marginVertical: 10 }}
        />
        {/* <Text style={{fontSize: 18, fontWeight: 500, marginTop: 10}}>
        Mobile:
      </Text> */}
        <TextInput
          label="Mobile"
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          mode="outlined"
          maxLength={10}
        />

        <Text style={{ fontSize: 18, fontWeight: 500, marginTop: 10 }}>
          Role:
        </Text>
        <RadioButton.Group
          onValueChange={text => {
            setRole(text);
            setLocation([]);
          }}
          value={role}
        >
          <View
            style={{
              flexDirection: 'row',

              alignItems: 'center',
            }}
          >
            <RadioButton value="Admin" />
            <Text>Admin</Text>
            <RadioButton value="User" />
            <Text>User</Text>
          </View>
        </RadioButton.Group>

        <Text style={{ fontSize: 18, fontWeight: 500, marginTop: 10 }}>
          Sub-Role:
        </Text>
        <RadioButton.Group
          onValueChange={text => {
            setSubRole(text);
          }}
          value={subRole}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <RadioButton value="Owner" />
            <Text>Partner</Text>
            <RadioButton value="Cluster Head" />
            <Text>Cluster Head</Text>
            <RadioButton value="" />
            <Text>None</Text>
          </View>
        </RadioButton.Group>

        <Text style={{ fontSize: 18, fontWeight: 500, marginTop: 10 }}>
          Locations:
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {locationArray.map(loc => (
            <Chip
              key={loc}
              selected={location.includes(loc)}
              onPress={() => handleLocationSelect(loc)}
              style={{ margin: 4 }}
            >
              {loc}
            </Chip>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleAddUser}
          style={{ marginTop: 16 }}
        >
          Add User
        </Button>
      </ScrollView>
      {/* <BottomTab navigation={navigation} /> */}
    </SafeAreaView>
  );
};

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
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    //backgroundColor: '#F2FFF2FF',
  },
});

export default AddUserForm;
