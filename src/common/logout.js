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

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { clearLocation } from '../store/locationSlice';
import { clearUserCache } from '../ticketing/api';
import { clearAll as clearQueryCache } from '../api/queryCache';

// ─── Clearing the Firestore status ───────────────────────────────────────────
// iOS (Oct 2026): logout reached EnterMobile but the user doc kept
// isActive:true. The write was failing and the old catch only console.log'd
// it, so the failure never surfaced. Now:
//   • one direct update() — no get() first. A missing doc answers not-found,
//     which means there is nothing to clear.
//   • one retry after a short pause, for a transient 'unavailable'.
//   • a time limit, so a phone with no connection is never stuck on the
//     spinner. Firestore keeps the queued write and sends it when it can.
//   • if it still fails, an alert carrying the error code, so the cause can be
//     read off the device instead of guessed.
const STATUS_TIMEOUT_MS = 8000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const e = new Error(`no reply from Firestore in ${ms / 1000}s`);
        e.code = 'timeout';
        reject(e);
      }, ms),
    ),
  ]);

async function clearFirestoreStatus(mobile) {
  const ref = firestore().collection('users').doc(mobile);
  const write = () =>
    withTimeout(
      ref.update({ isActive: false, deviceId: '' }),
      STATUS_TIMEOUT_MS,
    );
  try {
    await write();
    return null;
  } catch (first) {
    const code = String(first?.code || '');
    if (code.includes('not-found')) return null; // no doc → nothing to clear
    if (code === 'timeout') return first; // already waited; don't double it
    await new Promise(r => setTimeout(r, 800));
    try {
      await write();
      return null;
    } catch (second) {
      return second;
    }
  }
}

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
    let statusError = null;
    if (mobile) {
      statusError = await clearFirestoreStatus(mobile);
      if (statusError) {
        console.warn(
          'logout: could not clear the Firestore status',
          statusError?.code,
          statusError?.message,
        );
      }
    }

    // Clear the local session. These are what actually sign the user out.
    await AsyncStorage.multiSet([
      ['deviceId', ''],
      ['mobile', ''],
    ]);
    if (dispatch) dispatch(clearLocation());
    await clearUserCache();
    // Stored Branch Summary / Target Analysis / Branch Trend figures — the
    // next person to log in on this phone must not see them.
    await clearQueryCache();

    // Reset rather than navigate: wipe the back stack so the hardware back
    // button can't walk back into an authenticated screen after logout.
    if (navigation?.reset) {
      navigation.reset({ index: 0, routes: [{ name: 'EnterMobile' }] });
    } else if (navigation?.navigate) {
      navigation.navigate('EnterMobile');
    }

    // Told AFTER the reset so the alert shows over the login screen and isn't
    // dismissed by the navigation change.
    if (statusError) {
      Alert.alert(
        'Logged out on this phone',
        'The server could not be updated, so you may still show as signed in.' +
          `\n\n(${statusError?.code || 'error'}: ${
            statusError?.message || ''
          })`,
      );
    }
  } catch (error) {
    console.error('Logout Error:', error);
    onError?.(error);
  } finally {
    onFinally?.();
  }
}
