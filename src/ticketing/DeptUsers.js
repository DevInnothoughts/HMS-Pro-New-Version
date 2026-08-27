/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// DeptUsers.js
// ─────────────────────────────────────────────────────────────────────────────
// "My Team" — the Department Head builds their own team.
//
// Rendered as a TAB BODY inside TicketingHome, not a screen of its own: the
// shell (SafeAreaView, header, bottom bar, drawer, toast) is owned there, and a
// tab that rendered its own would leave the person with no way back — the exact
// bug that made TicketingHome own the shell in the first place.
//
// THE DUAL WRITE
// ──────────────
// A usable account is TWO rows:
//   • the Firestore `users` doc  → lets them sign in
//   • the ticket_user roster row → gives them a department, so the server knows
//                                  what they are and what they may see
// One without the other is a broken account: a login with no department sees an
// empty queue forever; a roster row with no login cannot sign in at all. This
// screen writes both, in that order, and rolls the Firestore doc back if the
// roster call fails — see addPerson. Same dual write AddUserForm does from the
// admin side.
//
// A head may add DEPARTMENT USERS only. Making someone a Head is an org
// decision and stays in the admin panel; the server enforces it too.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

import { addTeamUser, deleteTeamUser, listTeamUsers } from './api';
import { Btn, Empty, Field, Input } from './components';
import { C, F, S } from './theme';

// What the Firestore login needs to work. Mirrors AddUserForm's shape — if that
// form gains a required field, this has to gain it too or heads will create
// accounts that cannot sign in.
const SUB_ROLE_DEPT_USER = 'Department User';

const DeptUsers = ({ actor, department, toast }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const load = useCallback(
    async isRefresh => {
      if (!actor) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      try {
        const res = await listTeamUsers(actor);
        setUsers(res.users || []);
        setError('');
      } catch (e) {
        setError(e?.message || 'Could not load the team.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [actor],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const resetForm = () => {
    setName('');
    setMobile('');
    setEmail('');
    setAdding(false);
  };

  /**
   * Create the login, then the roster row.
   *
   * Firestore FIRST because it is the one that can fail on a duplicate — the
   * doc id IS the mobile, so an existing user is caught before anything is
   * written. If the roster call then fails we delete the doc we just made,
   * rather than leaving a login with no department: a half-created account is
   * worse than a failed one, because it looks fine until the person signs in.
   */
  const addPerson = async () => {
    const n = name.trim();
    const m = mobile.trim();
    const e = email.trim();

    if (!n) return toast('Enter their name.');
    if (!/^[0-9]{10}$/.test(m)) return toast('Enter a 10-digit mobile number.');
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return toast('That email does not look right.');
    }

    setSaving(true);
    let firestoreWritten = false;
    try {
      const ref = firestore().collection('users').doc(m);
      const snap = await ref.get();
      // exists() is a METHOD here — read as a property it is always truthy,
      // which is the bug that broke AddUserForm.
      const already =
        typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
      if (already) {
        setSaving(false);
        return toast(
          'That mobile already has a login. Ask your administrator.',
        );
      }

      await ref.set({
        name: n,
        mobile: m,
        email: e || '',
        role: 'Admin',
        subRole: SUB_ROLE_DEPT_USER,
        location: department || '',
        locationArray: department ? [department] : [],
        // The login gate. Absent, it is not false — it is undefined, and the
        // check reads that as "not allowed", so the account exists and simply
        // refuses to let anyone in.
        isAllowed: true,
        // isActive/deviceId are the DEVICE LOCK, not permission: false and ''
        // mean "not signed in anywhere", which is correct for a new account and
        // is what lets their first login claim the device.
        isActive: false,
        deviceId: '',
      });
      firestoreWritten = true;

      await addTeamUser(actor, { mobile: m, name: n, email: e });

      toast(`${n} added. They can sign in with ${m}.`);
      resetForm();
      load(true);
    } catch (err) {
      if (firestoreWritten) {
        // Roll back, so a failed add leaves nothing behind.
        try {
          await firestore().collection('users').doc(m).delete();
        } catch (rollbackErr) {
          console.log('DeptUsers: rollback failed', rollbackErr?.message);
        }
      }
      toast(err?.message || 'Could not add them. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const removePerson = person => {
    Alert.alert(
      `Remove ${person.name}?`,
      'They will lose access to the department queue. Tickets they already ' +
        'worked keep their name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTeamUser(actor, person.mobile);
              toast(`${person.name} removed.`);
              load(true);
            } catch (e) {
              // The server refuses while they hold live tickets, and that
              // message names the count — worth showing verbatim.
              toast(e?.message || 'Could not remove them.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 48 }}>
        <ActivityIndicator color={C.green} />
      </View>
    );
  }

  const team = users.filter(u => u.ticketRole !== 'Department Head');
  const head = users.find(u => u.ticketRole === 'Department Head');

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 28 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={C.green}
        />
      }
    >
      {!!error && (
        <View style={[S.card, { borderColor: C.red }]}>
          <Text style={[S.tiny, { color: C.red }]}>{error}</Text>
        </View>
      )}

      {!!head && (
        <View style={S.card}>
          <Text style={S.tiny}>Department head</Text>
          <Text style={[S.bold, { marginTop: 4 }]}>{head.name}</Text>
          <Text style={S.tiny}>{head.mobile}</Text>
        </View>
      )}

      {/* Add form. Collapsed by default — the list is what people come here
          for, and an always-open form pushes it below the fold. */}
      {adding ? (
        <View style={[S.card, { marginTop: 12 }]}>
          <Text style={[S.bold, { marginBottom: 10 }]}>Add someone</Text>

          <Field label="Name" req>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Their full name"
              autoCapitalize="words"
            />
          </Field>

          <Field label="Mobile" req>
            <Input
              value={mobile}
              onChangeText={setMobile}
              placeholder="10-digit number they will sign in with"
              keyboardType="number-pad"
              maxLength={10}
            />
          </Field>

          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="For ticket notifications"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          <Text style={[S.tiny, { marginBottom: 12 }]}>
            This creates their login and adds them to{' '}
            {department || 'your department'}. They can be assigned tickets
            straight away.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Btn label="Cancel" secondary onPress={resetForm} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn
                label={saving ? 'Adding…' : 'Add to team'}
                onPress={addPerson}
                disabled={saving}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Btn label="+ Add someone" onPress={() => setAdding(true)} />
        </View>
      )}

      <Text style={[S.bold, { marginTop: 20, marginBottom: 8 }]}>
        {team.length ? `Team (${team.length})` : 'Team'}
      </Text>

      {!team.length ? (
        <Empty>
          No one on the team yet. Add someone and you can start handing them
          tickets from the queue.
        </Empty>
      ) : (
        team.map(u => (
          <View key={u.mobile} style={[S.card, { marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={S.bold}>{u.name}</Text>
                <Text style={S.tiny}>
                  {u.mobile}
                  {u.email ? ` · ${u.email}` : ''}
                </Text>
                {/* The number a head actually needs before assigning: who is
                    already buried. */}
                <Text
                  style={[
                    S.tiny,
                    {
                      marginTop: 6,
                      color: u.openTickets > 0 ? C.green : C.muted,
                      fontFamily: u.openTickets > 0 ? F.semibold : F.regular,
                    },
                  ]}
                >
                  {u.openTickets === 0
                    ? 'Nothing in hand'
                    : `${u.openTickets} ticket${
                        u.openTickets > 1 ? 's' : ''
                      } in hand`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removePerson(u)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${u.name}`}
                style={{ paddingHorizontal: 10, paddingVertical: 8 }}
              >
                <Text
                  style={[S.tiny, { color: C.red, fontFamily: F.semibold }]}
                >
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default DeptUsers;
