/* eslint-disable prettier/prettier */
// src/adAgency/AgencyBand.js
// ─────────────────────────────────────────────────────────────────────────────
// The coloured band at the top of both Ad Agency views — the agency's version
// of design/components/SectionHeader (same 44px bottom padding, so the
// MetricGrid's marginTop:-30 sits half over the colour; change both together).
//
// Left:  the HHC logo (dashboard) or a back button (branch list)
// Right: the shared scope chip, then icon actions (export, logout)
// ─────────────────────────────────────────────────────────────────────────────

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { F, T } from '../design/tokens';

const hit = { top: 8, bottom: 8, left: 8, right: 8 };

export default function AgencyBand({
  eyebrow,
  title,
  sub,
  onBack,
  scopeText,
  onScope,
  actions = [], // [{ icon, label, onPress, disabled }]
}) {
  return (
    <View style={s.band}>
      <View style={s.top}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={s.iconBtn}
            hitSlop={hit}
            accessibilityRole="button"
            accessibilityLabel="Back to all branches"
          >
            <Icon name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={s.logoWrap}>
            <Image
              source={require('../../assets/logo_hhc.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={s.titleCol}>
          {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {!!onScope && (
          <TouchableOpacity
            onPress={onScope}
            style={s.scope}
            accessibilityRole="button"
            accessibilityLabel={`Date range ${scopeText}. Change`}
          >
            <Text style={s.scopeText} numberOfLines={1}>
              {scopeText}
            </Text>
            <Icon name="expand-more" size={14} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        )}

        {actions.map(a => (
          <TouchableOpacity
            key={a.icon}
            onPress={a.onPress}
            disabled={a.disabled}
            style={[s.iconBtn, a.disabled && { opacity: 0.45 }]}
            hitSlop={hit}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Icon name={a.icon} size={18} color="#fff" />
          </TouchableOpacity>
        ))}
      </View>

      {!!sub && <Text style={s.sub}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  band: {
    backgroundColor: T.headerBg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 44,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 30, height: 30 },
  titleCol: { flex: 1, minWidth: 0, marginLeft: 4 },
  eyebrow: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: T.headerMuted,
  },
  title: {
    fontFamily: F.semibold,
    fontSize: 16,
    color: T.white,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 140,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scopeText: {
    fontFamily: F.mono,
    fontSize: 11,
    color: T.white,
    flexShrink: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sub: {
    fontFamily: F.regular,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 12,
  },
});
