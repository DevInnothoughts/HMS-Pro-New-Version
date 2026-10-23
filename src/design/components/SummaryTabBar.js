/* eslint-disable prettier/prettier */
// src/design/components/SummaryTabBar.js
// ─────────────────────────────────────────────────────────────────────────────
// The two-tab bottom bar shared by Branch Summary and Target Analysis:
//
//   Branch Summary   → BranchSummary (stack route)
//   Target Analysis  → PerformanceTracking (TargetComparisonScreen), opened
//                      with { fromTabs: true } so it shows this same bar
//
// WHY NOT A TAB NAVIGATOR
// ───────────────────────
// Same reason as TabBar.js: both routes already live in the single flat stack
// in App.tsx and other screens navigate to them by name; nesting them in a tab
// navigator would duplicate the route names. So this bar renders per screen.
//
// HOW SWITCHING WORKS
// ───────────────────
// Target Analysis is PUSHED on top of Branch Summary (no animation — see the
// PerformanceTracking options in App.tsx), and "Branch Summary" from there is
// goBack(). So Branch Summary is never re-mounted: its loaded table, open
// city, sort and scroll position are all still there when you come back, and
// the slow all-branch read does not run again.
//
// The bar sits in the normal layout flow at the bottom of the screen (not
// position: absolute like TabBar.js), so content above it never needs extra
// bottom padding to stay clear of it.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { F, T } from '../tokens';

export const SUMMARY_TABS = [
  { key: 'summary', label: 'Branch Summary', icon: 'dashboard' },
  { key: 'target', label: 'Target Analysis', icon: 'track-changes' },
];

const SummaryTabBar = ({ navigation, active }) => {
  const insets = useSafeAreaInsets();

  const go = key => {
    if (key === active) return;
    if (key === 'target') {
      navigation.navigate('PerformanceTracking', { fromTabs: true });
    } else {
      // Target Analysis was pushed from Branch Summary — return to it rather
      // than mounting a second copy. See header.
      navigation.goBack();
    }
  };

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {SUMMARY_TABS.map(t => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => go(t.key)}
            style={s.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            <View style={[s.pill, on && s.pillOn]}>
              <Icon name={t.icon} size={21} color={on ? T.brand : T.muted2} />
            </View>
            <Text
              numberOfLines={1}
              style={[s.label, on && s.labelOn]}
              maxFontSizeMultiplier={1.2}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default SummaryTabBar;

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingTop: 7,
    paddingHorizontal: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 44 },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 3,
    borderRadius: 14,
  },
  pillOn: { backgroundColor: `${T.brand}14` },
  label: { fontSize: 11, color: T.muted2, fontFamily: F.regular },
  labelOn: { color: T.brand, fontFamily: F.semibold },
});
