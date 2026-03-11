import React, {useEffect, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {SafeAreaView} from 'react-native-safe-area-context';

const UserListScreen = ({navigation}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(snapshot => {
        let userData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort by name, but keep empty names at the end
        userData.sort((a, b) => {
          if (!a.name) return 1;
          if (!b.name) return -1;
          return a.name.localeCompare(b.name);
        });

        setUsers(userData);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  const toggleField = async (userId, field, currentValue) => {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          [field]: !currentValue,
        });
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update the value. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#184D67" />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={[styles.row, styles.headerRow]}>
      <View style={styles.cell}>
        <Text style={styles.headerText}>Name</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.headerText}>Mobile</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.headerText}>Status</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.headerText}>Allowed</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.headerText}>Role</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.headerText}>SubRole</Text>
      </View>
    </View>
  );

  const renderRow = user => (
    <View key={user.id} style={styles.row}>
      <View style={styles.cell}>
        <Text style={styles.name}>{user.name || '-'}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.name}>{user.mobile || '-'}</Text>
      </View>
      {/* Status Button */}
      <View style={styles.cell}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            {backgroundColor: user.isActive ? '#C8E6C9' : '#FFCDD2'},
          ]}
          onPress={() =>
            Alert.alert(
              'Confirm Action',
              `Are you sure you want to mark this user as ${
                user.isActive ? 'Inactive' : 'Active'
              }?`,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Yes',
                  onPress: () =>
                    toggleField(user.id, 'isActive', user.isActive),
                },
              ],
            )
          }>
          <Text style={styles.buttonText}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Text>
        </TouchableOpacity>
      </View>
      {/* Allowed Button */}
      <View style={styles.cell}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            {backgroundColor: user.isAllowed ? '#BBDEFB' : '#FFE0B2'},
          ]}
          onPress={() =>
            Alert.alert(
              'Confirm Action',
              `Are you sure you want to mark this user as ${
                user.isAllowed ? 'Blocked' : 'Allowed'
              }?`,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Yes',
                  onPress: () =>
                    toggleField(user.id, 'isAllowed', user.isAllowed),
                },
              ],
            )
          }>
          <Text style={styles.buttonText}>
            {user.isAllowed ? 'Allowed' : 'Blocked'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cell}>
        <Text style={styles.name}>{user.role || '-'}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.name}>
          {user.subRole === 'Owner'
            ? 'Partner'
            : user.subRole === 'Cluster Head'
            ? 'Cluster Head'
            : '-'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={{flex: 1, backgroundColor: '#FFF'}}
      edges={['top', 'bottom']}>
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

        <Text style={{...styles.name, fontSize: 18}}>User List</Text>

        <TouchableOpacity
          onPress={() => {
            navigation.navigate('AddUser');
          }}>
          <Image
            style={{
              height: 30,
              width: 30,
              tintColor: '#184D67',
            }}
            source={require('../../assets/addUser.png')}
          />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal>
        <View style={styles.table}>
          {renderHeader()}
          <ScrollView>{users.map(renderRow)}</ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  table: {
    borderWidth: 1,
    borderColor: '#ccc',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    minHeight: 50,
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: '#4f4e4eff',
  },
  cell: {
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#ccc',
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#fff',
  },
  statusButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
  },
  name: {
    fontWeight: '400',
    fontSize: 14,
    color: '#000',
  },
});

export default UserListScreen;
