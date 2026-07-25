/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// AppDrawer.js
// ─────────────────────────────────────────────────────────────────────────────
// Requirements 1–3: the header hamburger opens this sidebar; Performance goes
// to the existing AdminHome, Ticketing to the new module.
//
// Ported from hhc_hms_mobile_ecosystem.html:
//   .drawer      286px wide, white, slides in from the left, 18px padding
//   .drawerHead  square green logo tile + "Healing Hands" + a line of context
//   .navItem     bordered rows, active row filled green
//   .drawerOverlay  rgba(5,20,12,.32), tap to dismiss
//
// One addition the mockup has no place for: Log out.
// Today the HHC logo in the AdminHome header IS the logout button. Requirement 1
// removes that logo, so the action needs a home — and a labelled row in the
// sidebar is a better one than an unlabelled image that logs you out when you
// tap it expecting to go home.
//
// The Log out row ALWAYS shows, and the drawer logs out ITSELF via the shared
// common/logout helper. It used to depend on the caller passing an `onLogout`
// prop, and the Ticketing screen didn't — so the row silently vanished there.
// A drawer that is the home for logout shouldn't rely on every screen wiring it.
// `onLogout` is still honoured if a caller wants custom behaviour (e.g. its own
// confirm dialog), but omitting it no longer hides the row.
//
// Usage — the whole call site:
//   const [menuOpen, setMenuOpen] = useState(false);
//   <AppDrawer
//     visible={menuOpen}
//     onClose={() => setMenuOpen(false)}
//     navigation={navigation}
//     active="performance"          // or "ticketing"
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
  resolveTicketRole,
  ROLE_LABEL,
  sidebarNavForRole,
} from '../ticketing/roles';
import { C, F } from '../ticketing/theme';
import { logout } from './logout';

const DRAWER_WIDTH = 286; // .drawer{width:286px}

// The ecosystem mockup's drawer palette, read from the one place tokens live.
// This was a private copy of the same hex codes, which meant editing theme.js
// changed nothing here — the worst kind of bug to go looking for.
const T = {
  green: C.drawerGreen,
  dark: C.drawerDark,
  line: C.drawerLine,
  muted: C.drawerMuted,
  navBg: C.drawerNavBg,
  overlay: C.drawerOverlay,
  white: C.white,
  cardBg: C.drawerCardBg,
  red: C.red,
};

const AppDrawer = ({
  visible,
  onClose,
  navigation,
  active = 'performance',
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const location = useSelector(state => state.location.value);

  const ticketRole = resolveTicketRole(role, subRole);
  // The ONE place that decides which modules this person sees. A ticketing-only
  // role (Department Head / User) gets no Performance link — see roles.js.
  // For a department role Redux's `location` holds their DEPARTMENT, which is
  // what decides whether Recruitment (an HR process) appears for them.
  const nav = sidebarNavForRole(ticketRole, location);

  // One sentence per section this person actually has. Built from `nav` rather
  // than hardcoded, so adding a module can't leave this describing the old set.
  const purposeText = (() => {
    const has = k => nav.some(n => n.key === k);
    const lines = [];
    if (has('performance')) lines.push('Performance shows branch output.');
    if (has('ticketing'))
      lines.push('Ticketing tracks the issues blocking it.');
    if (has('recruitment'))
      lines.push('Recruitment covers hiring for open positions.');
    return lines.join(' ');
  })();

  // Use the caller's handler if given; otherwise log out ourselves. Either way
  // the row is always present — see the header note.
  const handleLogout = () => {
    onClose();
    if (onLogout) onLogout();
    else logout({ dispatch, navigation });
  };

  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // .drawer{transition:.25s}
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: visible ? 0 : -DRAWER_WIDTH,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade]);

  const go = item => {
    onClose();
    if (item.key === active) return; // already here
    // Replace rather than push: Performance and Ticketing are siblings, not a
    // trail. Pushing would grow a back stack of alternating modules.
    navigation.replace(item.screen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: T.overlay }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slide }],
              paddingTop: insets.top + 18,
              paddingBottom: insets.bottom + 18,
            },
          ]}
        >
          {/* .drawerHead */}
          <View style={styles.head}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>Healing Hands</Text>
              <Text style={styles.headSub}>Internal control system</Text>
            </View>
          </View>

          {/* Who you are — the sidebar is where role and branch belong now that
              the header no longer carries a brand mark. */}
          <View style={styles.identity}>
            <Text style={styles.identityRole}>
              {ROLE_LABEL[ticketRole] || 'User'}
            </Text>
            {!!location && <Text style={styles.identityLoc}>{location}</Text>}
          </View>

          {/* .navItem — only shown when there's more than one module to switch
              between. A ticketing-only user has a single destination, so the
              rows would be a menu of one; the header already says where they are. */}
          {nav.length > 1 &&
            nav.map(item => {
              const on = item.key === active;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => go(item)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.navItem, on && styles.navItemActive]}
                >
                  <Text style={styles.navIcon}>{item.icon}</Text>
                  <Text style={[styles.navLabel, on && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

          {/* The mockup's "Purpose" card explains why the modules sit together.
              Shown whenever there is more than one to explain — and the text is
              built from the nav the person actually has, so it can't describe a
              section they cannot see. */}
          {nav.length > 1 && (
            <View style={styles.purpose}>
              <Text style={styles.purposeTitle}>Purpose</Text>
              <Text style={styles.purposeText}>{purposeText}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={[styles.navItem, { marginBottom: 0 }]}
          >
            <Text style={styles.navIcon}>⏻</Text>
            <Text style={[styles.navLabel, { color: T.red }]}>Log out</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default AppDrawer;

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: T.white,
    paddingHorizontal: 18,
    // box-shadow:18px 0 36px rgba(0,0,0,.18)
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 18, height: 0 },
    elevation: 16,
  },
  // .drawerHead{display:flex;align-items:center;gap:10px;margin-bottom:18px}
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  // .drawerHead .logo{width:48px;height:48px;border-radius:13px;background:var(--green)}
  logo: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: T.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#162d20',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  logoText: { color: T.white, fontFamily: F.semibold, fontSize: 22 },
  headTitle: { fontFamily: F.semibold, fontSize: 18, color: '#15231c' },
  headSub: {
    fontFamily: F.regular,
    fontSize: 13,
    color: T.muted,
    marginTop: 3,
  },

  identity: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: T.navBg,
    borderWidth: 1,
    borderColor: T.line,
    marginBottom: 6,
  },
  identityRole: { fontFamily: F.semibold, fontSize: 13, color: T.dark },
  identityLoc: {
    fontFamily: F.regular,
    fontSize: 12,
    color: T.muted,
    marginTop: 2,
  },

  // .navItem{padding:15px;margin:9px 0;border:1px solid var(--line);border-radius:16px}
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: 15,
    marginVertical: 9,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 16,
    backgroundColor: T.navBg,
  },
  navItemActive: { backgroundColor: T.green, borderColor: T.green },
  navIcon: { fontSize: 20 },
  navLabel: { fontFamily: F.semibold, fontSize: 15, color: T.dark },
  navLabelActive: { color: T.white },

  // .card{margin-top:18px;background:#f5fbf7}
  purpose: {
    marginTop: 18,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 16,
    padding: 15,
  },
  purposeTitle: { fontFamily: F.semibold, fontSize: 14, color: T.dark },
  purposeText: {
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 17,
    color: T.muted,
    marginTop: 4,
  },
});
