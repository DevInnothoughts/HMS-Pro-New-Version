/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/admin/UserFormScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Add a user, or edit every field of an existing one.
// Replaces src/admin/AddUserForm.js and the toggle-only editing in UserList.js.
//
//   route.params.mobile absent  → ADD
//   route.params.mobile present → EDIT that user
//
// ⚠️ WHY EDIT EXISTED ONLY AS TWO TOGGLES
// ───────────────────────────────────────
// UserList could flip isActive and isAllowed and nothing else, so a wrong role,
// a missing location or a typo'd name meant deleting the login and recreating
// it — which loses their device lock and locks them out until they re-verify.
// Every field is editable here.
//
// ⚠️ EDIT USES updateDoc, NOT setDoc
// ──────────────────────────────────
// setDoc REPLACES the document. The user doc also holds `otp` and `deviceId`,
// which this form never shows — a setDoc would wipe both, signing the person
// out and destroying the OTP they may be mid-way through using. updateDoc
// merges, so untouched fields survive.
//
// ⚠️ isActive IS THE DEVICE LOCK, NOT PERMISSION
// ──────────────────────────────────────────────
// isAllowed is "may sign in". isActive + deviceId is "is signed in on THIS
// phone". Turning isActive off without clearing deviceId leaves a stale device
// claim, so the two move together — that is what "sign them out" means here,
// and it is why that switch is labelled the way it is.
//
// ⚠️ mobile IS THE DOCUMENT ID
// ────────────────────────────
// Changing it would mean creating a new doc and deleting the old one, losing
// the roster link and the device lock in between. It is read-only in edit; to
// move someone to a new number, add them and deactivate the old login.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';

import SectionHeader from '../../design/components/SectionHeader';
import { getDepartments, upsertRosterUser } from '../../ticketing/api';
import { F, T } from '../../design/tokens';

const ROLES = ['User', 'Admin', 'SuperAdmin'];

// The subRole values the app actually branches on. 'Owner' displays as
// "Partner" — see ticketing/roles.js, which accepts both spellings.
const SUB_ROLES = [
  { value: '', label: 'None' },
  { value: 'Owner', label: 'Partner' },
  { value: 'Admin', label: 'Branch Admin' },
  { value: 'Cluster Head', label: 'Cluster Head' },
  { value: 'Department Head', label: 'Department Head' },
  { value: 'Department User', label: 'Department User' },
];

const TICKETING_SUB_ROLES = ['Department Head', 'Department User'];

const UserFormScreen = ({ navigation, route }) => {
  const editingMobile = route?.params?.mobile || null;
  const isEdit = !!editingMobile;

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('User');
  const [subRole, setSubRole] = useState('');
  const [location, setLocation] = useState([]);
  const [department, setDepartment] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isAllowed, setIsAllowed] = useState(true);

  const [locationArray, setLocationArray] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsDepartment = TICKETING_SUB_ROLES.includes(subRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Branch list and departments always; the user only when editing.
      const [locSnap, deps, userSnap] = await Promise.all([
        firestore().collection('HHCLocations').doc('HHCLocations').get(),
        getDepartments().catch(() => []),
        isEdit
          ? firestore().collection('users').doc(editingMobile).get()
          : Promise.resolve(null),
      ]);

      const locs = locSnap?.data()?.locations;
      setLocationArray(Array.isArray(locs) ? locs : []);
      setDepartments(Array.isArray(deps) ? deps : []);

      if (isEdit) {
        // exists() is a METHOD on the native SDK and a PROPERTY on the modular
        // one. Read the wrong way it is always truthy — the bug that made
        // AddUserForm reject every new mobile as a duplicate.
        const found =
          typeof userSnap?.exists === 'function'
            ? userSnap.exists()
            : !!userSnap?.exists;
        if (!found) throw new Error('That user no longer exists.');

        const u = userSnap.data() || {};
        setName(u.name || '');
        setMobile(u.mobile || editingMobile);
        setEmail(u.email || '');
        setRole(u.role || 'User');
        setSubRole(u.subRole || '');
        setDepartment(u.department || '');
        setIsActive(!!u.isActive);
        // Absent is NOT false — it is undefined, and the login gate reads that
        // as "not allowed". Defaulting to true here would hide that; defaulting
        // to the stored value shows the account as it really is.
        setIsAllowed(u.isAllowed === true);
        // `location` is an ARRAY for Admin and a STRING for everyone else.
        setLocation(
          Array.isArray(u.location)
            ? u.location
            : u.location
            ? [u.location]
            : [],
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isEdit, editingMobile]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLocation = loc => {
    if (role === 'Admin' || role === 'SuperAdmin') {
      setLocation(l =>
        l.includes(loc) ? l.filter(x => x !== loc) : [...l, loc],
      );
    } else {
      // A User gets exactly one — tapping a second replaces the first rather
      // than silently doing nothing.
      setLocation([loc]);
    }
  };

  const allSelected =
    locationArray.length > 0 && location.length === locationArray.length;

  const multi = role === 'Admin' || role === 'SuperAdmin';

  const validate = () => {
    if (!name.trim()) return 'Enter the person’s name.';
    if (!/^[0-9]{10}$/.test(mobile.trim()))
      return 'Enter a 10-digit mobile number.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'That email does not look right, or leave it blank.';

    // A ticketing role is cross-branch — its department IS its context, so the
    // location rules below do not apply to it.
    if (needsDepartment) {
      return department ? null : 'Pick a department for this role.';
    }

    if (multi && location.length === 0) return 'Select at least one location.';
    if (!multi && location.length !== 1)
      return 'Select exactly one location for this role.';
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) return Alert.alert('Check the form', problem);
    if (saving) return;

    setSaving(true);
    const m = mobile.trim();
    const ref = firestore().collection('users').doc(m);

    try {
      if (!isEdit) {
        const snap = await ref.get();
        const already =
          typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        if (already) {
          setSaving(false);
          return Alert.alert(
            'Already exists',
            'A user with this mobile number already has a login.',
          );
        }
      }

      const payload = needsDepartment
        ? {
            name: name.trim(),
            mobile: m,
            email: email.trim(),
            role: 'User',
            subRole,
            // Their context, not a clinic — VerifyOTP reads `department` to
            // route them and sets locationArray to [].
            location: department,
            department,
            isActive,
            isAllowed,
          }
        : {
            name: name.trim(),
            mobile: m,
            email: email.trim(),
            role,
            subRole,
            // Array for Admin/SuperAdmin, string for User — VerifyOTP reads
            // both shapes and this must match.
            location: multi ? location : location[0],
            isActive,
            isAllowed,
          };

      // isActive off means "not signed in anywhere", so the device claim goes
      // with it. Leaving a stale deviceId behind is how someone ends up locked
      // out of their own account.
      if (!isActive) payload.deviceId = '';

      if (isEdit) {
        // update, NOT set — otp and deviceId are not on this form and must
        // survive. See the header.
        await ref.update(payload);
      } else {
        await ref.set({
          ...payload,
          deviceId: '',
          otp: { code: '', validTill: '' },
        });
      }

      // The ticketing roster is the second half of a ticketing account. Without
      // it they can sign in and see an empty queue, which looks like a bug
      // rather than a missing step — so a failure here is reported plainly.
      if (needsDepartment) {
        try {
          await upsertRosterUser({
            mobile: m,
            name: name.trim(),
            email: email.trim(),
            department,
            ticketRole: subRole,
          });
        } catch (e) {
          setSaving(false);
          return Alert.alert(
            'Saved, but ticketing setup failed',
            `${name} can sign in, but was not added to the ${department} roster: ${e.message}\n\nSave again to retry.`,
          );
        }
      }

      Alert.alert(
        isEdit ? 'Saved' : 'User added',
        isEdit
          ? `${name}’s details are updated.`
          : `${name} can sign in with ${m}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={st.screen} edges={['top']}>
        <SectionHeader
          code="ADMIN"
          name={isEdit ? 'Edit User' : 'Add User'}
          sub="Loading"
          hue={T.brand}
          hideScope
          onBack={() => navigation.goBack()}
        />
        <View style={st.centre}>
          <ActivityIndicator color={T.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
          <SectionHeader
            code="ADMIN"
            name={isEdit ? 'Edit User' : 'Add User'}
            sub={isEdit ? mobile : 'Create a login'}
            hue={T.brand}
            hideScope
            onBack={() => navigation.goBack()}
          />

          <View style={st.body}>
            {!!error && <Text style={st.error}>{error}</Text>}

            <Text style={st.blockLabel}>PERSON</Text>
            <View style={st.card}>
              <Field label="Name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={T.muted2}
                  style={st.input}
                />
              </Field>

              <Field label="Mobile" note={isEdit ? 'Cannot be changed' : null}>
                <TextInput
                  value={mobile}
                  onChangeText={t =>
                    setMobile(t.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="10 digits"
                  placeholderTextColor={T.muted2}
                  keyboardType="number-pad"
                  editable={!isEdit}
                  style={[st.input, isEdit && st.inputLocked]}
                />
              </Field>

              <Field label="Email" note="Used for ticket notifications" last>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Optional"
                  placeholderTextColor={T.muted2}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={st.input}
                />
              </Field>
            </View>

            <Text style={st.blockLabel}>ROLE</Text>
            <View style={st.card}>
              <Field label="Role">
                <View style={st.chips}>
                  {ROLES.map(r => (
                    <Chip
                      key={r}
                      label={r}
                      on={role === r}
                      onPress={() => {
                        setRole(r);
                        // A User may hold only one location — trim rather than
                        // leaving an invalid multi-selection behind.
                        if (r === 'User' && location.length > 1) {
                          setLocation([location[0]]);
                        }
                      }}
                    />
                  ))}
                </View>
              </Field>

              <Field label="Sub-role" last>
                <View style={st.chips}>
                  {SUB_ROLES.map(s => (
                    <Chip
                      key={s.value || 'none'}
                      label={s.label}
                      on={subRole === s.value}
                      onPress={() => setSubRole(s.value)}
                    />
                  ))}
                </View>
              </Field>
            </View>

            {needsDepartment ? (
              <>
                <Text style={st.blockLabel}>DEPARTMENT</Text>
                <View style={st.card}>
                  <Field
                    label="Department"
                    note="A ticketing role is cross-branch — its department is its scope, so no location is needed."
                    last
                  >
                    <View style={st.chips}>
                      {departments.map(d => {
                        const value = typeof d === 'string' ? d : d.name;
                        return (
                          <Chip
                            key={value}
                            label={value}
                            on={department === value}
                            onPress={() => setDepartment(value)}
                          />
                        );
                      })}
                    </View>
                    {!departments.length && (
                      <Text style={st.hint}>
                        No departments loaded. Check the ticketing service.
                      </Text>
                    )}
                  </Field>
                </View>
              </>
            ) : (
              <>
                <View style={st.blockHead}>
                  <Text style={st.blockLabel}>
                    {multi ? 'LOCATIONS' : 'LOCATION'}
                  </Text>
                  {multi && locationArray.length > 0 && (
                    <TouchableOpacity
                      onPress={() =>
                        setLocation(allSelected ? [] : [...locationArray])
                      }
                      accessibilityRole="button"
                    >
                      <Text style={st.selectAll}>
                        {allSelected ? 'Clear all' : 'Select all'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={st.card}>
                  <View style={[st.chips, { padding: 13 }]}>
                    {locationArray.map(loc => (
                      <Chip
                        key={loc}
                        label={loc}
                        on={location.includes(loc)}
                        onPress={() => toggleLocation(loc)}
                      />
                    ))}
                  </View>
                  {!multi && (
                    <Text style={st.hint}>
                      This role holds exactly one location.
                    </Text>
                  )}
                </View>
              </>
            )}

            <Text style={st.blockLabel}>ACCESS</Text>
            <View style={st.card}>
              <Toggle
                label="Allowed to sign in"
                note="Turn off to block access without deleting the account."
                value={isAllowed}
                onChange={setIsAllowed}
              />
              <Toggle
                label="Signed in on a device"
                // Not a permission. Turning it off clears the device claim, so
                // they can sign in fresh on a new phone.
                note="Turn off to release their device and let them log in elsewhere."
                value={isActive}
                onChange={setIsActive}
                last
              />
            </View>
          </View>
        </ScrollView>

        <View style={st.footer}>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[st.save, saving && { opacity: 0.5 }]}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={17} color="#fff" />
                <Text style={st.saveText}>
                  {isEdit ? 'Save changes' : 'Add user'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Field = ({ label, note, last, children }) => (
  <View style={[st.field, last && { borderBottomWidth: 0 }]}>
    <Text style={st.fieldLabel}>{label.toUpperCase()}</Text>
    {children}
    {!!note && <Text style={st.fieldNote}>{note}</Text>}
  </View>
);

const Chip = ({ label, on, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[st.chip, on && st.chipOn]}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
  >
    <Text style={[st.chipText, on && st.chipTextOn]}>{label}</Text>
  </TouchableOpacity>
);

const Toggle = ({ label, note, value, onChange, last }) => (
  <View style={[st.toggleRow, last && { borderBottomWidth: 0 }]}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.toggleLabel}>{label}</Text>
      {!!note && <Text style={st.toggleNote}>{note}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: T.brand, false: T.line }}
      thumbColor="#fff"
    />
  </View>
);

export default UserFormScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, marginTop: -20 },
  error: { fontSize: 12, color: T.crit, marginTop: 24, fontFamily: F.regular },

  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 22,
    marginBottom: 9,
    marginHorizontal: 2,
  },
  selectAll: { fontSize: 11.5, color: T.brand, fontFamily: F.medium },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    overflow: 'hidden',
  },
  field: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  fieldLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  fieldNote: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 7,
    fontFamily: F.regular,
    lineHeight: 15,
  },
  input: {
    fontSize: 14,
    color: T.text,
    fontFamily: F.regular,
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginTop: 2,
  },
  inputLocked: { color: T.muted },
  hint: {
    fontSize: 10,
    color: T.muted2,
    fontFamily: F.regular,
    paddingHorizontal: 13,
    paddingBottom: 12,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: T.card,
  },
  chipOn: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipTextOn: { color: '#fff', fontFamily: F.medium },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  toggleLabel: { fontSize: 13, color: T.text, fontFamily: F.medium },
  toggleNote: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 4,
    fontFamily: F.regular,
    lineHeight: 15,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
  },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.brand,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveText: { fontFamily: F.semibold, fontSize: 14, color: '#fff' },
});
