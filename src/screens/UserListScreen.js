/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/UserListScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Every login, searchable, each tappable to edit. Replaces src/admin/UserList.js.
//
// ⚠️ THE SIX-COLUMN TABLE HAD TO GO
// ─────────────────────────────────
// The old screen packed Name, Mobile, Status, Allowed, Role and SubRole into
// six equal cells on a 358px screen — roughly 55px each, so every value
// truncated and the two toggle buttons were 40px targets. It also rendered
// every user inside one ScrollView with no virtualisation.
//
// A card per user now: name and mobile read fully, role and access are tags,
// and the whole row opens the edit form.
//
// ⚠️ THE TOGGLES ARE GONE FROM THIS SCREEN — DELIBERATELY
// ───────────────────────────────────────────────────────
// They were the only editable thing here, which is why every other field was
// unreachable. Both now live on the edit form alongside everything else, so
// there is ONE place a user is changed rather than two that disagree.
//
// isActive also has to clear deviceId when switched off, and doing that
// correctly from a list row is how the old screen left stale device claims
// behind — see UserFormScreen's header.
//
// ⚠️ onSnapshot, NOT get()
// ────────────────────────
// Kept from the old screen: the list updates itself after an edit, so
// navigating back shows the new values without a manual refresh.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';

import SectionHeader from '../design/components/SectionHeader';
import { F, T, num } from '../design/tokens';

// Display names. 'Owner' is stored but reads as "Partner" everywhere in the
// business — UserList did the same mapping.
const SUB_ROLE_LABELS = {
  Owner: 'Partner',
  Partner: 'Partner',
  Admin: 'Branch Admin',
  'Cluster Head': 'Cluster Head',
  'Department Head': 'Dept Head',
  'Department User': 'Dept User',
};

const ROLE_HUES = {
  SuperAdmin: '#6E5AA8',
  Admin: '#2F6FA8',
  User: '#3E8C8C',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'signedIn', label: 'Signed in' },
];

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const UserListScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          // Unnamed accounts sort last — they are usually half-created and
          // belong at the bottom, not scattered through the A's.
          data.sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
          });
          setUsers(data);
          setLoading(false);
        },
        e => {
          setError(e.message);
          setLoading(false);
        },
      );
    return () => unsubscribe();
  }, []);

  const counts = useMemo(
    () => ({
      all: users.length,
      // isAllowed absent is NOT false — it is undefined, and the login gate
      // reads that as "not allowed". So anything other than an explicit true
      // is blocked, and this count says so.
      blocked: users.filter(u => u.isAllowed !== true).length,
      signedIn: users.filter(u => u.isActive).length,
    }),
    [users],
  );

  const list = useMemo(() => {
    let out = users;
    if (filter === 'blocked') out = out.filter(u => u.isAllowed !== true);
    else if (filter === 'signedIn') out = out.filter(u => u.isActive);

    const q = query.trim().toLowerCase();
    if (!q) return out;
    const qd = q.replace(/\D/g, '');
    return out.filter(
      u =>
        String(u.name || '')
          .toLowerCase()
          .includes(q) ||
        (!!qd && String(u.mobile || '').includes(qd)) ||
        String(u.role || '')
          .toLowerCase()
          .includes(q) ||
        String(u.subRole || '')
          .toLowerCase()
          .includes(q),
    );
  }, [users, filter, query]);

  const header = (
    <View>
      <SectionHeader
        code="ADMIN"
        name="Users"
        sub="Logins, roles and access"
        hue={T.brand}
        hideScope
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={st.chips}>
          {FILTERS.map(f => {
            const on = filter === f.key;
            const c = f.key === 'blocked' ? T.crit : T.brand;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[st.chip, on && { backgroundColor: c, borderColor: c }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.chipLabel, on && st.chipOn]}>{f.label}</Text>
                <Text style={[st.chipCount, on && st.chipOn]}>
                  {counts[f.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.searchRow}>
          <Icon name="search" size={18} color={T.muted2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, mobile or role"
            placeholderTextColor={T.muted2}
            style={st.search}
          />
          {!!query && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
            >
              <Icon name="close" size={17} color={T.muted2} />
            </TouchableOpacity>
          )}
        </View>

        {list.length !== users.length && (
          <Text style={st.showing}>
            Showing {num(list.length)} of {num(users.length)} users
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : list}
        keyExtractor={u => u.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          loading ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
            </View>
          ) : (
            <Text style={st.empty}>{error || 'No users match this view.'}</Text>
          )
        }
        renderItem={({ item }) => (
          <UserRow
            u={item}
            onPress={() =>
              navigation.navigate('AddUserForm', { mobile: item.id })
            }
          />
        )}
      />

      {/* Pinned, so adding someone does not mean scrolling past forty rows. */}
      <TouchableOpacity
        style={st.fab}
        onPress={() => navigation.navigate('AddUserForm')}
        accessibilityRole="button"
        accessibilityLabel="Add a user"
      >
        <Icon name="add" size={20} color="#fff" />
        <Text style={st.fabText}>Add user</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const Tag = ({ label, color }) => (
  <View style={[st.tag, { borderColor: color }]}>
    <Text style={[st.tagText, { color }]}>{label}</Text>
  </View>
);

const UserRow = ({ u, onPress }) => {
  const hue = ROLE_HUES[u.role] || T.muted2;
  // Explicit true or nothing — see the counts memo.
  const blocked = u.isAllowed !== true;
  const subRole = SUB_ROLE_LABELS[u.subRole] || u.subRole;

  // Array for Admin, string for User. Shown as a count when it is a long list,
  // because forty branch names will not fit on a card.
  const locations = Array.isArray(u.location)
    ? u.location
    : u.location
    ? [u.location]
    : [];
  const locationText =
    locations.length > 2
      ? `${locations.length} locations`
      : locations.join(' · ') || 'No location';

  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${u.name || 'Unnamed'}, ${
        u.role
      }. Opens the edit form.`}
    >
      {/* A blocked account gets the red spine — it is the state most worth
          spotting while scanning. */}
      <View style={[st.spine, { backgroundColor: blocked ? T.crit : hue }]} />

      <View style={[st.avatar, { backgroundColor: `${hue}18` }]}>
        <Text style={[st.avatarText, { color: hue }]}>{initials(u.name)}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.name} numberOfLines={1}>
          {u.name || 'Unnamed'}
        </Text>
        <Text style={st.mobile}>{u.mobile || u.id}</Text>
        <Text style={st.meta} numberOfLines={1}>
          {u.department || locationText}
        </Text>

        <View style={st.tagRow}>
          <Tag label={u.role || 'User'} color={hue} />
          {!!subRole && <Tag label={subRole} color={T.muted2} />}
          {blocked && <Tag label="Blocked" color={T.crit} />}
          {u.isActive && <Tag label="Signed in" color="#1E7A5A" />}
        </View>
      </View>

      <Icon name="chevron-right" size={18} color={T.chevron} />
    </TouchableOpacity>
  );
};

export default UserListScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  body: { paddingHorizontal: 16, marginTop: -20 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    fontFamily: F.regular,
    fontSize: 13,
  },

  chips: { flexDirection: 'row', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 13,
    backgroundColor: T.card,
    alignItems: 'center',
  },
  chipLabel: { fontSize: 11.5, color: T.muted, fontFamily: F.regular },
  chipCount: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    marginTop: 3,
  },
  chipOn: { color: '#fff' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 11,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },
  showing: { fontSize: 10, color: T.muted2, marginTop: 10, fontFamily: F.mono },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingLeft: 13,
    paddingRight: 11,
    marginHorizontal: 16,
    marginTop: 9,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 12.5 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  mobile: { fontFamily: F.mono, fontSize: 11.5, color: T.text, marginTop: 3 },
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },

  tagRow: { flexDirection: 'row', gap: 5, marginTop: 7, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.6 },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.brand,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { fontFamily: F.semibold, fontSize: 13.5, color: '#fff' },
});
