import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  Animated,
} from 'react-native';
//import VoiceToText from 'react-native-voice-to-text';
import { ActivityIndicator } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = 'https://wedoc.in/hms';

const DiagnosisVoiceAssistant = ({ navigation }) => {
  const [recognizedText, setRecognizedText] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);

  /* waveform animation */
  const barCount = 5;
  const animations = Array.from(
    { length: barCount },
    () => new Animated.Value(0.5),
  );

  const startWaveformAnimation = () => {
    Animated.stagger(
      100,
      animations.map(anim =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.5,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    ).start();
  };

  useEffect(() => {
    if (listening) startWaveformAnimation();
    else animations.forEach(a => a.setValue(0.5));
  }, [listening]);

  // useEffect(() => {
  //   VoiceToText.addEventListener('onSpeechResults', e => {
  //     if (e?.value?.length) {
  //       setRecognizedText(e.value[0]);
  //     }
  //   });

  //   VoiceToText.addEventListener('onSpeechError', e => {
  //     console.error('Speech Error', e);
  //     setListening(false);
  //   });

  //   return () => {
  //     VoiceToText.removeAllListeners();
  //   };
  // }, []);

  // const startListening = async () => {
  //   try {
  //     setRecognizedText('');
  //     setListening(true);
  //     await VoiceToText.startListening('en-IN');
  //   } catch (e) {
  //     console.error(e);
  //     setListening(false);
  //   }
  // };

  // const stopListening = async () => {
  //   try {
  //     await VoiceToText.stopListening();
  //     setListening(false);
  //   } catch (e) {
  //     console.error(e);
  //     setListening(false);
  //   }
  // };

  const handleSubmit = async () => {
    if (!recognizedText.trim()) {
      Alert.alert('No speech detected');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/aiAssistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: recognizedText }),
      });

      const json = await resp.json();

      if (!resp.ok) throw new Error(json.error);
      Alert.alert('Assistant Reply', json.reply?.summary || 'Done');
    } catch (err) {
      Alert.alert('Error', 'Network or server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            source={require('../../assets/back.png')}
            style={{ height: 35, width: 35, tintColor: '#184D67' }}
          />
        </TouchableOpacity>
        <Text style={styles.header}>Voice-To-Text</Text>
        <Text />
      </View>

      {/* Card */}
      <View style={styles.modalCard}>
        <TextInput
          style={styles.textInput}
          value={recognizedText}
          onChangeText={setRecognizedText}
          placeholder="Summarise the IVR call data"
          multiline
        />

        {/* Mic Button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: listening ? '#c62828' : '#1b8a44' },
          ]}
          // onPress={listening ? stopListening : startListening}
        >
          <View style={styles.iconButtonContent}>
            {listening ? (
              <View style={styles.inlineBars}>
                {animations.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[styles.bar, { transform: [{ scaleY: anim }] }]}
                  />
                ))}
              </View>
            ) : (
              <Icon name="microphone" size={20} color="#fff" />
            )}
            <Text style={styles.buttonText}>
              {listening ? 'Stop Talking' : 'Start Talking'}
            </Text>
          </View>
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
            <Text style={styles.buttonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  openBtnContainer: {
    alignSelf: 'flex-end',
    marginTop: 10,
    alignItems: 'flex-end', // button aligned to right
  },
  fab: {
    position: 'absolute',
    zIndex: 1,
    top: 5,
    right: 20,
  },
  // modalContainer: {
  //   flex: 1,
  //   backgroundColor: 'rgba(0,0,0,0.45)',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
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
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  modalContent: {
    width: '88%',
    padding: 18,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  input: {
    width: '100%',
    minHeight: 60,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    textAlignVertical: 'top',
    color: '#000',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    width: '100%',
    alignItems: 'center',
  },
  // buttonText: {color: '#fff', fontSize: 16},
  responseContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
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
    borderRadius: 12,
    width: '100%',
  },
  closeIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  closeText: {
    fontSize: 20,
    color: '#777',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'left',
  },
  textInput: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    minHeight: 60,
    marginBottom: 20,
  },
  primaryButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  barWaveform: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 15,
    height: 40,
  },
  inlineBars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  bar: {
    width: 3,
    height: 14,
    backgroundColor: '#fff',
    marginHorizontal: 1,
    borderRadius: 2,
  },

  iconButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DiagnosisVoiceAssistant;
