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
// The scope chip is the same control as on the home screen and writes to the
// same redux slice. Changing the period inside IPD and going back to the home
// shows the home on that period too, which is the point of a shared scope.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { scopeLabel } from '../../store/scopeSlice';
import ScopePicker from './ScopePicker';
import { F, T } from '../tokens';

export const SectionHeader = ({ code, name, sub, hue, onBack, hideScope }) => {
  const scope = useSelector(s => s.scope);
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
          <Text style={s.code}>{code}</Text>
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
