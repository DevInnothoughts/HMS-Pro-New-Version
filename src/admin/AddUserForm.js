/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// AddUserForm.js — PATCHED REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
// This is your existing src/admin/AddUserForm.js with the ticketing onboarding
// woven in. It is a REFERENCE to diff against your copy — not a drop-in
// replacement, because your live file may have drifted from what I was given.
//
// Every ticketing addition is marked with a  ← TICKETING  comment so you can
// find the five changes at a glance:
//
//   1. import the roster helpers                         (top)
//   2. department state + department list from /meta     (state block)
//   3. Department Head / User radios + department picker (Sub-Role section)
//   4. validation for the ticketing case                 (validateForm)
//   5. the second write: ticket_user row on submit       (handleAddUser)
//
// WHY THE SECOND WRITE
// ────────────────────
// A Department Head or User's department lives in the ticket_user roster table,
// and the server reads it from there on every request — never from Firestore,
// never from the request body. That's what stops anyone reassigning themselves
// to another department. So a ticketing user needs BOTH writes: the Firestore
// login (so they can sign in) and the roster row (so the server knows their
// department). Firestore alone leaves a Head with an empty queue forever and a
// User who can never be assigned a ticket.
//
// This does NOT complete onboarding by itself — VerifyOTP / EnterMobile also
// need the routing branch from INTEGRATION.md step 6e, or a Head lands on
// AdminHome instead of their queue. This file is step 6a–6d; that is 6e.
// ─────────────────────────────────────────────────────────────────────────────

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

// 1. ← TICKETING — roster helpers. Path assumes AddUserForm is at src/admin/ and
//    the ticketing module at src/ticketing/. Adjust the depth if yours differs.
import {
  upsertRosterUser,
  removeRosterUser,
  getDepartments,
} from '../ticketing/api';

const AddUserForm = ({ navigation }) => {
  const [isActive, setIsActive] = useState(false);
  const [isAllowed, setIsAllowed] = useState(true);
  const [location, setLocation] = useState([]);
  const [locationArray, setLocationArray] = useState([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState(''); // ← TICKETING: for ticket notifications
  const [role, setRole] = useState('User');
  const [subRole, setSubRole] = useState('');
  const [otp, setOtp] = useState({ code: '', validTill: '' });

  // 2. ← TICKETING — the department for a ticketing role, and the list to pick
  //    from (pulled from the server so it always matches ticket_department).
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);

  // A ticketing subRole needs a department; other subRoles don't.
  const needsDepartment =
    subRole === 'Department Head' || subRole === 'Department User';

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
    // 2. ← TICKETING — load the department list once. Falls back to empty on
    //    failure, so the rest of the form still works if the API is unreachable.
    getDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
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
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid 10-digit mobile number.',
      );
      return false;
    }
    // ← TICKETING: email is optional, but if given it must look valid (the
    // backend rejects a malformed one too).
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid email address, or leave it blank.',
      );
      return false;
    }

    // 4. ← TICKETING — a ticketing role needs a department, and it is NOT bound
    //    to the "exactly one location" rule below: it's cross-branch, so its
    //    department is its context. Handle it here and return early.
    if (needsDepartment) {
      if (!department) {
        Alert.alert('Invalid Input', 'Please pick a department for this role.');
        return false;
      }
      return true;
    }

    // Location validation for the ordinary Admin / User cases (unchanged).
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

    // 5. ← TICKETING — a ticketing user carries their department, and is role
    //    'User' with location = department (they're not tied to a clinic). The
    //    ordinary branch/admin doc is unchanged.
    const newUser = needsDepartment
      ? {
          isActive,
          isAllowed,
          location: department, // their context — not a clinic
          department, // read by the app to route them (roles.js)
          mobile,
          name,
          email, // ← TICKETING: for ticket notifications
          role: 'User',
          subRole, // 'Department Head' | 'Department User'
        }
      : {
          isActive,
          isAllowed,
          location: role === 'Admin' ? location : location[0],
          mobile,
          name,
          role,
          subRole,
        };

    try {
      const documentExists = await checkIfDocumentExists(mobile);
      if (documentExists) {
        Alert.alert('Error', 'A user with this mobile number already exists.');
        return;
      }

      // Write the Firestore login first — this is what lets them sign in.
      await setDoc(doc(db, 'users', mobile), newUser);

      // 5. ← TICKETING — then the roster row, so the server knows their
      //    department. If this fails the login already exists, so say so
      //    plainly rather than silently: without it their queue stays empty.
      if (needsDepartment) {
        try {
          await upsertRosterUser({
            mobile,
            name,
            email, // ← TICKETING: stored on the roster row for notifications
            department,
            ticketRole: subRole, // 'Department Head' | 'Department User'
          });
        } catch (e) {
          Alert.alert(
            'Login created, ticketing setup failed',
            `${name} can sign in, but couldn't be added to the ${department} ` +
              `roster: ${e.message}\n\nRe-save this user to try again.`,
          );
          // Login exists; let the operator retry via re-save. Don't wipe fields.
          return;
        }
      }

      Alert.alert('Success', 'User added successfully!');
      setMobile('');
      setLocation([]);
      setRole('User');
      setName('');
      setSubRole('');
      setDepartment(''); // ← TICKETING — reset the picker too
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

  // ← "Select all" — only meaningful for the Admin role, which is the only one
  //   that allows multiple locations (a User gets exactly one). It's a toggle:
  //   if every location is already picked, tapping it clears them; otherwise it
  //   selects them all. `allSelected` also drives the chip's label and state.
  const allSelected =
    locationArray.length > 0 && location.length === locationArray.length;

  const toggleSelectAll = () => {
    setLocation(allSelected ? [] : [...locationArray]);
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={{ height: 35, width: 35, tintColor: '#184D67' }}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: 600, textAlign: 'center' }}>
          Create New User Login
        </Text>
        <Text style={{ fontSize: 22, fontWeight: 600, textAlign: 'center' }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, backgroundColor: '#fff' }}
      >
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={{ marginVertical: 10 }}
        />
        <TextInput
          label="Mobile"
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          mode="outlined"
          maxLength={10}
        />
        {/* ← TICKETING: email, used to notify this user about tickets at their
            level. Optional — a user with no email simply isn't emailed. */}
        <TextInput
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          mode="outlined"
          style={{ marginTop: 10 }}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
            // 3. ← TICKETING — clear the department when leaving a ticketing role
            //    so a stale pick can't ride along on the next save.
            if (text !== 'Department Head' && text !== 'Department User') {
              setDepartment('');
            }
          }}
          value={subRole}
        >
          {/* Existing options, plus the two ticketing roles. Wrap so the four
              fit on a phone. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <RadioButton value="Owner" />
            <Text>Partner</Text>
            <RadioButton value="Cluster Head" />
            <Text>Cluster Head</Text>
            {/* 3. ← TICKETING */}
            <RadioButton value="Department Head" />
            <Text>Department Head</Text>
            <RadioButton value="Department User" />
            <Text>Department User</Text>
            <RadioButton value="" />
            <Text>None</Text>
          </View>
        </RadioButton.Group>

        {/* 3. ← TICKETING — department picker, shown only for a ticketing role. */}
        {needsDepartment && (
          <>
            <Text style={{ fontSize: 18, fontWeight: 500, marginTop: 10 }}>
              Department:
            </Text>
            {departments.length === 0 ? (
              <Text style={{ color: '#b3261e', marginTop: 6 }}>
                Couldn't load departments. Check the ticketing API is reachable,
                then reopen this screen.
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {departments.map(d => (
                  <Chip
                    key={d}
                    selected={department === d}
                    onPress={() => setDepartment(d)}
                    style={{ margin: 4 }}
                  >
                    {d}
                  </Chip>
                ))}
              </View>
            )}
          </>
        )}

        {/* Locations — hidden for ticketing roles, since they're cross-branch
            and the department above is their context. */}
        {!needsDepartment && (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: 500 }}>Locations:</Text>
              {/* Select all / Clear all — only for Admin, the only role that
                  allows more than one location. */}
              {role === 'Admin' && locationArray.length > 1 && (
                <TouchableOpacity
                  onPress={toggleSelectAll}
                  accessibilityRole="button"
                >
                  <Text style={{ color: '#184D67', fontWeight: '600' }}>
                    {allSelected
                      ? 'Clear all'
                      : `Select all (${locationArray.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
            {/* A quiet count, so "all" is legible at a glance on a long list. */}
            {role === 'Admin' && location.length > 0 && (
              <Text
                style={{
                  color: '#6b7b73',
                  fontSize: 12,
                  marginLeft: 4,
                  marginTop: 2,
                }}
              >
                {location.length} of {locationArray.length} selected
              </Text>
            )}
          </>
        )}

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
  },
});

export default AddUserForm;
