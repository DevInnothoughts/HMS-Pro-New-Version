/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/SectionHeader.js
// ─────────────────────────────────────────────────────────────────────────────
// The coloured band at the top of a section screen (.s-hdr in the prototype):
// back · code · name · scope chip · subtitle.
//
// The header is deliberately 30px taller than its content: the metric grid
// below it carries marginTop:-30 and sits half over the colour. That overlap is
// what makes the section read as one object rather than a header with cards
// under it, so the two numbers have to stay in step — change one, change both.
//
// BRANCH PILL
// ───────────
// Users with access to several branches could not tell whose data a screen was
// showing once they left the home. Every header now names the branch, resolved
// the same way the screens resolve it for their API calls:
//   route.params.location  →  redux location.value
// so the pill always matches the data, including drill-downs that were handed
// a branch explicitly. Read through NavigationRouteContext (not useRoute) so
// the header still renders if ever mounted outside a navigator.
// Pass `branch` to override, or `hideBranch` on screens that are not about one
// branch (user management, or where the subtitle already names it).
//
// The scope chip is the same control as on the home screen and writes to the
// same redux slice. Changing the period inside IPD and going back to the home
// shows the home on that period too, which is the point of a shared scope.
// ─────────────────────────────────────────────────────────────────────────────

import { useContext, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationRouteContext } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { scopeLabel } from '../../store/scopeSlice';
import ScopePicker from './ScopePicker';
import { F, T } from '../tokens';

export const SectionHeader = ({
  code,
  name,
  sub,
  hue,
  onBack,
  hideScope,
  branch,
  hideBranch,
}) => {
  const scope = useSelector(s => s.scope);
  const reduxBranch = useSelector(s => s.location.value);
  const route = useContext(NavigationRouteContext);
  const shownBranch = branch || route?.params?.location || reduxBranch;
  const [open, setOpen] = useState(false);

  return (
    <View style={[s.hdr, { backgroundColor: hue }]}>
      <View style={s.top}>
        <TouchableOpacity
          onPress={onBack}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.eyebrow}>
            <Text style={s.code}>{code}</Text>
            {!hideBranch && !!shownBranch && (
              <View
                style={s.branch}
                accessibilityLabel={`Branch ${shownBranch}`}
              >
                <Icon name="place" size={11} color="#fff" />
                <Text style={s.branchText} numberOfLines={1}>
                  {shownBranch}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
        </View>

        {!hideScope && (
          <TouchableOpacity
            onPress={() => setOpen(true)}
            style={s.scope}
            accessibilityRole="button"
          >
            <Text style={s.scopeText}>{scopeLabel(scope)}</Text>
            <Icon name="expand-more" size={14} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        )}
      </View>

      {!!sub && <Text style={s.sub}>{sub}</Text>}

      <ScopePicker visible={open} onClose={() => setOpen(false)} />
    </View>
  );
};

const s = StyleSheet.create({
  // paddingBottom 44 = 14 of real padding + the 30 the metric grid pulls up into.
  hdr: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 44 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  branchText: {
    fontFamily: F.semibold,
    fontSize: 10.5,
    color: '#fff',
    flexShrink: 1,
  },
  code: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.72)',
  },
  name: {
    fontFamily: F.semibold,
    fontSize: 16,
    color: '#fff',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scopeText: { fontFamily: F.mono, fontSize: 11, color: '#fff' },
  sub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 12,
    fontFamily: F.regular,
  },
});

export default SectionHeader;
