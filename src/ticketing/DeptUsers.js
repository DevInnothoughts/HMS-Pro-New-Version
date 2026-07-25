/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// DeptUsers.js
// ─────────────────────────────────────────────────────────────────────────────
// Requirement 9 — "Department head has option to add, edit and delete the users
// belongs to his departments."
//
// TWO WRITES, ON PURPOSE
// ──────────────────────
// A department user needs to exist in two places to be useful:
//
//   ticket_user (MySQL)   so tickets can be assigned to them, and so the server
//                         knows their department without trusting the client
//   users (Firestore)     so they can actually log in — the whole app's auth
//                         reads this collection, exactly as AddUserForm.js writes it
//
// So "Add" does both, MySQL first. If MySQL fails, nothing is written anywhere.
// If Firestore then fails, the roster row is rolled back rather than left as a
// person who can be assigned work but can't sign in — a half-created user is
// worse than none, because the ticket goes quiet and nobody knows why.
//
// The alternative — one source of truth — would mean either moving auth into
// MySQL or teaching the server to write Firestore with firebase-admin (it is
// already a backend dependency, just not initialised). Both are cleaner and
// both are bigger than this change. See docs/DECISIONS.md → "Roster and login
// are two writes" for the trade-off.
//
// This is a BODY, not a screen. TicketingHome owns the SafeAreaView, the header
// and the bottom tab bar, and renders this inside them.
// ─────────────────────────────────────────────────────────────────────────────

import firestore from '@react-native-firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  addDeptUser,
  deleteDeptUser,
  fetchDeptUsers,
  updateDeptUser,
} from './api';
import { Btn, Field, Input, Toast, useToast } from './components';
import { C, F, S } from './theme';

const DeptUsers = ({ actor, department }) => {
  const [users, setUsers] = useState([]);
  const [dept, setDept] = useState(department || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | user (edit)
  const [saving, setSaving] = useState(false);
  const [toastMsg, toast] = useToast();

  const load = useCallback(
    async (quiet = false) => {
      if (!actor?.actorMobile) return;
      if (!quiet) setLoading(true);
      setError('');
      try {
        const res = await fetchDeptUsers(actor, department);
        setUsers(res?.users || []);
        setDept(res?.department || department || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [actor, department],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  /** Roster first, then login. Roll the roster back if login can't be created. */
  const save = async form => {
    const isNew = !form.ticketUserId;
    setSaving(true);
    try {
      if (isNew) {
        const res = await addDeptUser(actor, {
          mobile: form.mobile.trim(),
          name: form.name.trim(),
          email: form.email?.trim() || undefined,
          ticketRole: 'Department User',
        });

        try {
          await writeFirestoreUser({
            mobile: form.mobile.trim(),
            name: form.name.trim(),
            department: dept,
          });
        } catch (fe) {
          // Undo the roster row so we never leave someone assignable but locked out.
          try {
            await deleteDeptUser(actor, res.ticketUserId);
          } catch (_) {
            /* best effort — surfaced in the message below */
          }
          throw new Error(
            `Could not create the login for ${form.name.trim()}, so nothing was saved. ${
              fe.message
            }`,
          );
        }

        toast(res.message || 'User added.');
      } else {
        const res = await updateDeptUser(actor, form.ticketUserId, {
          name: form.name.trim(),
          email: form.email?.trim() || '',
          isActive: form.isActive,
        });
        // Keep the login's display name and status in step.
        try {
          await firestore()
            .collection('users')
            .doc(form.mobile)
            .update({ name: form.name.trim(), isAllowed: !!form.isActive });
        } catch (fe) {
          console.log('ticketing: firestore user sync failed', fe?.message);
          toast('Saved here, but the login record didn’t update. Try again.');
        }
        toast(res.message || 'Changes saved.');
      }
      setEditing(null);
      load(true);
    } catch (e) {
      Alert.alert('Not saved', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = user => {
    Alert.alert(
      `Remove ${user.name}?`,
      user.openTickets > 0
        ? `${user.name} has ${user.openTickets} ticket(s) in progress. Reassign those first.`
        : `${user.name} will no longer be assigned tickets. Their history stays on the tickets they worked on.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteDeptUser(actor, user.ticketUserId);
              // Block the login too, but keep the doc: it carries their history.
              try {
                await firestore()
                  .collection('users')
                  .doc(user.mobile)
                  .update({ isAllowed: false, subRole: '' });
              } catch (fe) {
                console.log('ticketing: firestore block failed', fe?.message);
              }
              toast(res.message || 'Removed.');
              load(true);
            } catch (e) {
              Alert.alert('Not removed', e.message);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      {loading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color={C.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={S.main}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={C.green}
            />
          }
        >
          {!!error && (
            <View style={[S.card, { borderColor: C.red, marginTop: 0 }]}>
              <Text style={[S.bold, { color: C.red }]}>{error}</Text>
            </View>
          )}

          <Btn
            label="Add a team member"
            onPress={() =>
              setEditing({ mobile: '', name: '', email: '', isActive: true })
            }
            style={{ marginTop: 0 }}
          />

          <View style={S.listTitle}>
            <Text style={S.listTitleText}>{dept} team</Text>
            <Text style={S.tiny}>
              {users.length} {users.length === 1 ? 'person' : 'people'}
            </Text>
          </View>

          {users.length ? (
            users.map(u => (
              <View key={u.ticketUserId} style={S.card}>
                <View style={S.split}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: F.semibold,
                        fontSize: 15,
                        color: C.text,
                      }}
                    >
                      {u.name}
                    </Text>
                    <Text style={[S.tiny, { marginTop: 2 }]}>
                      {u.mobile}
                      {u.email ? ` · ${u.email}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      S.badge,
                      {
                        backgroundColor:
                          u.ticketRole === 'Department Head'
                            ? C.medBg
                            : C.badgeBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.badgeText,
                        {
                          color:
                            u.ticketRole === 'Department Head'
                              ? C.blue
                              : C.badgeText,
                        },
                      ]}
                    >
                      {u.ticketRole === 'Department Head' ? 'Head' : 'Member'}
                    </Text>
                  </View>
                </View>

                <View style={[S.badges, { marginTop: 10 }]}>
                  <View
                    style={[
                      S.badge,
                      {
                        backgroundColor:
                          u.openTickets > 0 ? C.medBg : C.badgeBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.badgeText,
                        { color: u.openTickets > 0 ? C.blue : C.badgeText },
                      ]}
                    >
                      {u.openTickets} open
                    </Text>
                  </View>
                  <View
                    style={[
                      S.badge,
                      { backgroundColor: u.isActive ? C.lowBg : C.critBg },
                    ]}
                  >
                    <Text
                      style={[
                        S.badgeText,
                        { color: u.isActive ? C.green2 : C.red },
                      ]}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {u.ticketRole !== 'Department Head' && (
                  <View style={[S.row, { marginTop: 12 }]}>
                    <View style={S.rowItem}>
                      <Btn
                        label="Edit"
                        secondary
                        small
                        onPress={() =>
                          setEditing({
                            ticketUserId: u.ticketUserId,
                            mobile: u.mobile,
                            name: u.name,
                            email: u.email || '',
                            isActive: u.isActive,
                          })
                        }
                      />
                    </View>
                    <View style={S.rowItem}>
                      <Btn
                        label="Remove"
                        secondary
                        small
                        onPress={() => remove(u)}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={[S.card, S.empty]}>
              <Text style={S.emptyText}>
                No one in {dept || 'your department'} yet. Add someone so
                approved tickets can be assigned.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add / edit sheet */}
      <Modal
        visible={!!editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: C.drawerOverlay,
              justifyContent: 'flex-end',
            }}
            onPress={() => !saving && setEditing(null)}
          >
            <Pressable
              style={{
                backgroundColor: C.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 18,
                paddingBottom: 28,
              }}
            >
              {!!editing && (
                <>
                  <Text style={[S.bold, { fontSize: 17 }]}>
                    {editing.ticketUserId
                      ? 'Edit team member'
                      : 'Add a team member'}
                  </Text>
                  <Text style={[S.tiny, { marginTop: 4 }]}>
                    {editing.ticketUserId
                      ? 'Their mobile number is their login and can’t be changed.'
                      : `They’ll be added to ${dept} and can sign in with this mobile number.`}
                  </Text>

                  <Field label="Name">
                    <Input
                      value={editing.name}
                      onChangeText={t => setEditing({ ...editing, name: t })}
                      placeholder="Full name"
                    />
                  </Field>

                  <Field label="Mobile">
                    <Input
                      value={editing.mobile}
                      onChangeText={t =>
                        setEditing({
                          ...editing,
                          mobile: t.replace(/[^0-9]/g, '').slice(0, 10),
                        })
                      }
                      placeholder="10-digit number"
                      keyboardType="phone-pad"
                      maxLength={10}
                      editable={!editing.ticketUserId}
                      style={
                        editing.ticketUserId
                          ? { backgroundColor: C.bg, color: C.muted }
                          : null
                      }
                    />
                  </Field>

                  <Field label="Email (optional)">
                    <Input
                      value={editing.email}
                      onChangeText={t => setEditing({ ...editing, email: t })}
                      placeholder="name@healinghands.co.in"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </Field>

                  {!!editing.ticketUserId && (
                    <View style={[S.split, { marginTop: 14 }]}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: F.medium,
                            fontSize: 14,
                            color: C.text,
                          }}
                        >
                          Active
                        </Text>
                        <Text style={S.tiny}>
                          Inactive members keep their history but stop getting
                          new tickets.
                        </Text>
                      </View>
                      <Switch
                        value={!!editing.isActive}
                        onValueChange={v =>
                          setEditing({ ...editing, isActive: v })
                        }
                        trackColor={{ true: C.green2, false: C.line }}
                      />
                    </View>
                  )}

                  <View style={S.row}>
                    <View style={S.rowItem}>
                      <Btn
                        label="Cancel"
                        secondary
                        onPress={() => setEditing(null)}
                        disabled={saving}
                      />
                    </View>
                    <View style={S.rowItem}>
                      <Btn
                        label={
                          editing.ticketUserId ? 'Save changes' : 'Add member'
                        }
                        onPress={() => save(editing)}
                        loading={saving}
                      />
                    </View>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Toast message={toastMsg} />
    </>
  );
};

export default DeptUsers;

/**
 * Create the Firestore login. Same document shape AddUserForm.js writes, so the
 * existing EnterMobile → VerifyOTP flow picks it up with no changes.
 *
 * role 'User' + subRole 'Department User' is what roles.js reads back to route
 * them to the ticketing screens.
 */
async function writeFirestoreUser({ mobile, name, department }) {
  const ref = firestore().collection('users').doc(mobile);
  const existing = await ref.get();

  // exists() is a METHOD on the snapshot (as AddUserForm.js uses it), not a
  // property. Read as a property it's a truthy function reference, so this
  // always took the update() branch — and update() on a document that doesn't
  // exist throws [firestore/not-found]. That was the "Could not create the
  // login … Some requested document was not found" error when adding a member.
  if (existing.exists()) {
    // Don't clobber somebody who already has a login — promote them instead.
    await ref.update({
      name,
      subRole: 'Department User',
      department,
      isAllowed: true,
    });
    return;
  }

  await ref.set({
    mobile,
    name,
    role: 'User',
    subRole: 'Department User',
    department,
    location: department, // no branch: department users are cross-branch
    isActive: false, // set true on their first successful OTP, as elsewhere
    isAllowed: true,
  });
}
