/* eslint-disable prettier/prettier */
// logout.js
// ─────────────────────────────────────────────────────────────────────────────
// One logout, used everywhere.
//
// AdminHome, DoctorHome, AdAgencyHome (and now the sidebar) all logged out with
// byte-for-byte the same handler: flip the Firestore user to isActive:false with
// an empty deviceId, clear the two AsyncStorage keys, clear the Redux location,
// and navigate to EnterMobile. Five copies of the same code is five chances for
// them to drift — and the reason the sidebar's logout was easy to forget.
//
// This is that handler, once. `dispatch` and `navigation` come from the caller
// (hooks can't run here); everything else it does itself.
//
// Existing screens don't have to change — their inline handlers still work. But
// they *can* now be reduced to `logout({ dispatch, navigation })`, and the
// sidebar calls this directly so its logout can never be "not wired up".
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { clearLocation } from '../store/locationSlice';
import { clearUserCache } from '../ticketing/api';

/**
 * Log the current user out.
 *
 * @param {object}   opts
 * @param {Function} opts.dispatch     Redux dispatch (from useDispatch()).
 * @param {object}   opts.navigation   React Navigation navigation prop.
 * @param {Function} [opts.onStart]    Called before work begins (e.g. show a spinner).
 * @param {Function} [opts.onError]    Called with the error if logout fails.
 * @param {Function} [opts.onFinally]  Called at the end, success or failure.
 */
export async function logout({
  dispatch,
  navigation,
  onStart,
  onError,
  onFinally,
} = {}) {
  try {
    onStart?.();
    const mobile = await AsyncStorage.getItem('mobile');

    // Best-effort: free the device lock on the server so the next login works.
    // A missing mobile or an offline Firestore must not trap someone in the app,
    // so a failure here still falls through to clearing the session below.
    if (mobile) {
      try {
        const ref = firestore().collection('users').doc(mobile);
        const snap = await ref.get();
        // exists() is a method, not a property (matches AddUserForm.js). Read
        // as a property it's always truthy, so update() would run even on a
        // missing doc and throw [firestore/not-found] — the same bug that
        // broke adding a team member. Harmless here (caught), corrected too.
        if (snap.exists()) {
          await ref.update({ isActive: false, deviceId: '' });
        }
      } catch (e) {
        console.log('logout: could not clear the device lock', e?.message);
      }
    }

    // Clear the local session. These are what actually sign the user out.
    await AsyncStorage.multiSet([
      ['deviceId', ''],
      ['mobile', ''],
    ]);
    if (dispatch) dispatch(clearLocation());
    await clearUserCache();

    // Reset rather than navigate: wipe the back stack so the hardware back
    // button can't walk back into an authenticated screen after logout.
    if (navigation?.reset) {
      navigation.reset({ index: 0, routes: [{ name: 'EnterMobile' }] });
    } else if (navigation?.navigate) {
      navigation.navigate('EnterMobile');
    }
  } catch (error) {
    console.error('Logout Error:', error);
    onError?.(error);
  } finally {
    onFinally?.();
  }
}
