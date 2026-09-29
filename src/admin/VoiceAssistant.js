import React, { useState } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
//import { startSpeechToText } from 'react-native-voice-to-text';
import AIResponseCard from './AIResponseLayout';

const BACKEND_URL = 'https://wedoc.in/hms';

const VoiceAssistant = ({ data }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState(null);
  const [listening, setListening] = useState(false);

  /* 🎙️ Start Voice */
  // const startListening = async () => {
  //   try {
  //     setListening(true);
  //     setRecognizedText('');

  //     const result = await startSpeechToText({
  //       locale: 'en-IN',
  //       partialResults: false,
  //     });

  //     console.log('Voice result:', result);

  //     if (result) {
  //       setRecognizedText(result);
  //     } else {
  //       Alert.alert('No speech detected');
  //     }
  //   } catch (err) {
  //     console.error('Voice error:', err);
  //     Alert.alert('Error', 'Speech recognition failed');
  //   } finally {
  //     setListening(false);
  //   }
  // };

  /* 📤 Submit to backend */
  const handleSubmit = async () => {
    if (!recognizedText.trim()) {
      Alert.alert('No input', 'Please speak or type something');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/aiAssistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: recognizedText,
          data,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setReply(json.reply);
      setModalVisible(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Open Button */}
      <View style={styles.openBtnContainer}>
        <Button
          mode="contained"
          icon={() => <Icon name="microphone" size={20} color="#fff" />}
          onPress={() => {
            setModalVisible(true);
            setReply(null);
          }}
        >
          Ask LiSa
        </Button>
      </View>
      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setModalVisible(false)}
              disabled={loading}
            >
              <Text style={{ fontSize: 18 }}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Ask LiSa</Text>

            <TextInput
              style={styles.input}
              value={recognizedText}
              onChangeText={setRecognizedText}
              placeholder="Speak or type your query"
              multiline
            />

            {/* Mic Button */}
            <TouchableOpacity
              style={[
                styles.micButton,
                { backgroundColor: listening ? '#c62828' : '#1b8a44' },
              ]}
              // onPress={startListening}
              disabled={listening}
            >
              <Icon name="microphone" size={22} color="#fff" />
              <Text style={styles.micText}>
                {listening ? 'Listening…' : 'Start Talking'}
              </Text>
            </TouchableOpacity>

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Response */}
      {reply && <AIResponseCard response={reply} />}
    </View>
  );
};

export default VoiceAssistant;

const styles = StyleSheet.create({
  openBtnContainer: {
    alignSelf: 'flex-end',
    marginTop: 10,
    alignItems: 'flex-end', // button aligned to right
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 20,
    width: '90%',
    borderRadius: 12,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    marginBottom: 15,
  },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  micText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#1976d2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
  },
});
