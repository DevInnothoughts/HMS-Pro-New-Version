import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import {Text, Card, Divider} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';

const DoctorPatientsScreen = ({route, navigation}) => {
  const {doctorName, doctorPhone, patients = []} = route.params;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={styles.backIcon}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.doctorName}>{doctorName}</Text>
          <Text style={styles.subText}>Total Patients: {patients.length}</Text>
        </View>
      </View>

      <Divider />

      {/* EMPTY STATE */}
      {patients.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No patients found</Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(_, index) => index.toString()}
          ItemSeparatorComponent={() => <Divider />}
          renderItem={({item}) => (
            <Card style={styles.patientCard}>
              <Text style={styles.patientName}>
                {item.patientName || item.name || 'Unknown'}
              </Text>

              {item.disease && (
                <Text style={styles.patientDisease}>{item.disease}</Text>
              )}

              {item.date && <Text style={styles.patientDate}>{item.date}</Text>}

              {item.status && (
                <Text style={styles.patientStatus}>Status: {item.status}</Text>
              )}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default DoctorPatientsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },

  backIcon: {
    height: 32,
    width: 32,
    tintColor: '#184D67',
    marginRight: 12,
  },

  headerTextWrap: {
    flexDirection: 'column',
  },

  doctorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10375C',
  },

  subText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  patientCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
  },

  patientName: {
    fontSize: 16,
    fontWeight: '700',
  },

  patientDisease: {
    fontSize: 14,
    color: '#444',
    marginTop: 4,
  },

  patientDate: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },

  patientStatus: {
    fontSize: 12,
    color: '#E91E63',
    marginTop: 4,
    fontWeight: '600',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 15,
    color: '#999',
  },
});
