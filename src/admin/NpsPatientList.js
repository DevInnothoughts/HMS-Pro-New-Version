import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Card, Modal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const BACKEND_URL = 'https://wedoc.in/hms';

const NpsPatientList = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  // console.log('Selected location in NPSPatientList:', location);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    fetchNPSData(location);
  }, [location]);

  const fetchNPSData = (location, from, to) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };
    try {
      setLoading(true);
      fetch(`${BACKEND_URL}/report/ratingInfo?location=${location}`)
        .then(res => res.json())
        .then(data => {
          setPatients(data?.ipdBills || []);
          //console.log('Fetched NPS patient data:', data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch (error) {
      console.log('Error ', error);
    }
  };

  const renderItem = ({ item }) => {
    let rating = null;
    let avgRating = null;

    try {
      rating = item.ratingInfo ? JSON.parse(item.ratingInfo) : null;
      avgRating = Number(rating?.averageRating);
    } catch {}

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          setSelectedPatient({ ...item, rating });

          console.log('Selected patient for modal:', { ...item, rating });
          setModalVisible(true);
        }}
      >
        <View style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>📞 Phone</Text>
            <Text>{item.phone || '—'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Admission</Text>
            <Text>
              {item.admission_date
                ? new Date(item.admission_date).toLocaleDateString()
                : '—'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Discharge</Text>
            <Text>
              {item.discharge_date
                ? new Date(item.discharge_date).toLocaleDateString()
                : '—'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>NPS Score</Text>
            <Text style={styles.score}>
              {avgRating ? `⭐ ${avgRating.toFixed(1)} / 5` : 'Not available'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <Text style={{ padding: 20 }}>Loading...</Text>;
  }

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

        <View style={{ minWidth: 130, flexDirection: 'column' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={styles.header}> NPS List</Text>
          </View>
        </View>

        <TouchableOpacity></TouchableOpacity>
      </View>
      <FlatList
        data={patients}
        keyExtractor={item => item.invoice_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ width: '100%', padding: 16 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40 }}>
            No NPS-rated patients found
          </Text>
        }
      />
      {selectedPatient && (
        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Patient Rating Details</Text>

              <Text style={styles.modalText}>
                Name: <Text style={styles.bold}>{selectedPatient.name}</Text>
              </Text>

              <Text style={styles.modalText}>
                Average Rating: ⭐{' '}
                {selectedPatient.rating?.averageRating || '—'} / 5
              </Text>

              <Text style={styles.modalSubTitle}>Ratings</Text>

              {selectedPatient.rating?.ratings &&
                Object.entries(selectedPatient.rating.ratings).map(
                  ([question, score], index) => (
                    <View key={index} style={styles.ratingRow}>
                      <Text style={styles.question}>{question}</Text>
                      <Text style={styles.ratingValue}>⭐ {score} / 5</Text>
                    </View>
                  ),
                )}

              <Text style={styles.modalSubTitle}>Feedback</Text>
              <Text style={styles.feedback}>
                {selectedPatient.rating?.feedback?.trim()
                  ? selectedPatient.rating.feedback
                  : 'No feedback provided'}
              </Text>

              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export default NpsPatientList;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    alignItems: 'stretch', // ✅ allow full width
  },
  headerContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // backgroundColor: '#F2FFF2FF',
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },

  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },

  label: {
    fontSize: 13,
    color: '#64748B',
  },

  score: {
    fontWeight: '700',
    color: '#14923E',
  },
  modalOverlay: {
    //flex: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 6,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },

  modalText: {
    fontSize: 14,
    marginVertical: 4,
    color: '#334155',
  },

  bold: {
    fontWeight: '700',
  },

  feedback: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },

  closeButton: {
    marginTop: 20,
    backgroundColor: '#184D67',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },

  closeText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalSubTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
    color: '#1E293B',
  },

  ratingRow: {
    marginBottom: 8,
  },

  question: {
    fontSize: 13,
    color: '#334155',
  },

  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#14923E',
  },
});
