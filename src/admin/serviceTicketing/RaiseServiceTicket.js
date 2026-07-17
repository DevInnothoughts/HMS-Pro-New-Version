/* eslint-disable prettier/prettier */
// RaiseServiceTicket.js
// ─────────────────────────────────────────────────────────────────────────────
// Partner raises a new maintenance request: pick a branch (if they manage more
// than one), a category (of 17), a priority, and describe the issue.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { createTicket } from './ServiceTicketAPI';
import {
  C,
  CATEGORIES,
  PRIORITIES,
  PRIORITY_META,
} from './ServiceTicketConstants';

const RaiseServiceTicket = ({ navigation }) => {
  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);
  const location = useSelector(s => s.location.value);
  const locationArray = useSelector(s => s.location.locationArray);

  const branches = useMemo(() => {
    if (locationArray && locationArray.length) return locationArray;
    return location ? [location] : [];
  }, [location, locationArray]);

  const [branch, setBranch] = useState(branches[0] || '');
  const [categoryCode, setCategoryCode] = useState(null);
  const [priority, setPriority] = useState('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!branch) return Alert.alert('Branch required', 'Please select a branch.');
    if (!categoryCode) return Alert.alert('Category required', 'Please pick a category.');
    if (!title.trim()) return Alert.alert('Subject required', 'Please add a short subject.');

    setSubmitting(true);
    try {
      const res = await createTicket(
        { branch, categoryCode, title: title.trim(), description: description.trim(), priority },
        role,
        subRole,
      );
      Alert.alert(
        'Request raised',
        `Ticket ${res.ticketNo} has been sent to the Cluster Head for approval.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Could not raise request', e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image source={require('../../../assets/back.png')} style={styles.back} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Raise Service Request</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Branch */}
          {branches.length > 1 && (
            <>
              <Text style={styles.label}>Branch</Text>
              <View style={styles.chipsWrap}>
                {branches.map(b => {
                  const active = branch === b;
                  return (
                    <TouchableOpacity
                      key={b}
                      onPress={() => setBranch(b)}
                      style={[styles.selChip, active && styles.selChipActive]}
                    >
                      <Text style={[styles.selChipTxt, active && styles.selChipTxtActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          {branches.length === 1 && (
            <View style={styles.singleBranch}>
              <Icon name="place" size={16} color={C.primary} />
              <Text style={styles.singleBranchTxt}>{branches[0]}</Text>
            </View>
          )}

          {/* Category grid */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.grid}>
            {CATEGORIES.map(cat => {
              const active = categoryCode === cat.code;
              return (
                <TouchableOpacity
                  key={cat.code}
                  style={[styles.catTile, active && styles.catTileActive]}
                  onPress={() => setCategoryCode(cat.code)}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={cat.icon}
                    size={22}
                    color={active ? '#fff' : C.primary}
                  />
                  <Text
                    style={[styles.catTileTxt, active && styles.catTileTxtActive]}
                    numberOfLines={2}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Priority */}
          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipsWrap}>
            {PRIORITIES.map(p => {
              const active = priority === p;
              const meta = PRIORITY_META[p];
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.selChip,
                    active && { backgroundColor: meta.color, borderColor: meta.color },
                  ]}
                >
                  <Text style={[styles.selChipTxt, active && styles.selChipTxtActive]}>
                    {p} · {meta.sla}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Subject */}
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. OT light not working"
            placeholderTextColor={C.textLight}
            maxLength={200}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue, asset details, location within the branch, etc."
            placeholderTextColor={C.textLight}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="send" size={18} color="#fff" />
                <Text style={styles.submitTxt}>Submit Request</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  back: { height: 30, width: 30, tintColor: C.primary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.textDark },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textMed,
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  singleBranch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary + '12',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 4,
  },
  singleBranchTxt: { color: C.primary, fontWeight: '700', marginLeft: 5 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  selChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    marginRight: 8,
    marginBottom: 8,
  },
  selChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  selChipTxt: { color: C.textMed, fontWeight: '600', fontSize: 13 },
  selChipTxtActive: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catTile: {
    width: '31.5%',
    aspectRatio: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 10,
  },
  catTileActive: { backgroundColor: C.primary, borderColor: C.primary },
  catTileTxt: {
    fontSize: 11,
    color: C.textDark,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  catTileTxtActive: { color: '#fff' },

  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textDark,
  },
  textArea: { minHeight: 110 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 28,
  },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});

export default RaiseServiceTicket;
