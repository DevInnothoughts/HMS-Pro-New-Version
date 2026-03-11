import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Button} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function PatientDetailsScreen({route, navigation}) {
  const {patient} = route.params;

  return (
    <SafeAreaView style={{flex: 1}} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>{patient.name}</Text>
        <Text style={styles.info}>Age: {patient.age}</Text>
        <Text style={styles.info}>Problem: {patient.problem}</Text>
        <Text style={styles.info}>Registered: {patient.date}</Text>

        <Button
          mode="contained"
          style={styles.btn}
          onPress={() => navigation.goBack()}>
          Back to Patients
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {padding: 25},
  title: {fontSize: 28, marginBottom: 20},
  info: {fontSize: 18, marginBottom: 10},
  btn: {marginTop: 20},
});
