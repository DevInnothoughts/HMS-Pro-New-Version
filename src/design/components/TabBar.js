/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/TabBar.js
// ─────────────────────────────────────────────────────────────────────────────
// The persistent bottom bar (.tabs in the prototype).
//
// WHY THIS IS A COMPONENT AND NOT A TAB NAVIGATOR
// ───────────────────────────────────────────────
// The plan called for a real createBottomTabNavigator. On reading the routing
// again, that is the wrong trade for a four-day build.
//
// Approval, SearchPatient, ConvincingScore and UserList are all registered in
// the single flat stack in App.tsx, and roughly a dozen existing screens
// navigate to them by name. Nesting those same names inside a tab navigator
// creates duplicate route names — React Navigation resolves the outer one, so
// half the app would keep landing on the stack copy while the tab bar drove the
// nested copy, and neither would obviously look broken in testing. Fixing it
// properly means renaming routes and touching every caller: a real change, with
// real regression risk, on a deadline that has no room for it.
//
// So the bar renders per screen and navigates into the existing stack — the
// same approach the current BottomTab.js takes, with the prototype's styling
// and the config's role gating. It is visually identical to a tab navigator.
// What it does not give is state preservation per tab (switching to Approval
// and back re-mounts the home) and a bar that survives screen transitions
// without a re-render. Neither is worth the regression risk this week.
//
// The proper navigator is a Phase 4 task, done with time to re-test the dozen
// callers. This component's API does not change when that happens.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { visibleTabs } from '../../config/sections.config';
import { ICONS } from './primitives';
import { F, T } from '../tokens';

const TabBar = ({ navigation, active }) => {
  const insets = useSafeAreaInsets();
  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);
  const location = useSelector(s => s.location.value);
  const scope = useSelector(s => s.scope);

  const tabs = visibleTabs({ role, subRole });

  const go = tab => {
    if (tab.key === active) return;
    if (tab.key === 'home') {
      // popToTop() would pop to the stack's FIRST screen, which is EnterMobile
      // — the login screen is still down there unless login used replace().
      // navigate() targets Home by name and unwinds to the existing instance
      // rather than pushing a second one.
      navigation.navigate('Home');
      return;
    }
    navigation.navigate(tab.route, {
      location,
      fromDate: scope.from,
      toDate: scope.to,
    });
  };

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => go(t)}
            style={s.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            <Icon
              name={ICONS[t.icon] || 'circle'}
              size={20}
              color={on ? T.brand : T.muted2}
            />
            <Text
              numberOfLines={1}
              style={[s.label, on && { color: T.brand, fontFamily: F.medium }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default TabBar;

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingTop: 9,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  label: {
    fontSize: 9.5,
    color: T.muted2,
    fontFamily: F.regular,
    letterSpacing: -0.1,
  },
});
