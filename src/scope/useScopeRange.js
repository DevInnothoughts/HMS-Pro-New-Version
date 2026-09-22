/* eslint-disable prettier/prettier */
// src/scope/useScopeRange.js
// ─────────────────────────────────────────────────────────────────────────────
// The date range a screen should use, and the one bug this exists to prevent.
//
// THE BUG
// ───────
// Screens were written as:
//     const from = route?.params?.fromDate || scope.from;
//
// Navigation params are set once, when you navigate in, and never change. The
// scope chip in the header writes to redux. So the chip updated redux, the
// screen kept reading the stale param, and the control looked broken.
//
// THE FIX
// ───────
// Redux is the single source of truth. Route params are treated as an INITIAL
// VALUE only: on first mount, if a caller passed dates that differ from the
// current scope, they are pushed into redux once — then the chip and the screen
// read the same place forever after.
//
// That keeps legacy callers working. AdminHome navigates with its own picker's
// dates and no knowledge of scopeSlice; this carries those dates across, and
// the header chip then takes over.
//
//   const { from, to } = useScopeRange(route);
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { setCustomRange } from '../store/scopeSlice';

export function useScopeRange(route) {
  const dispatch = useDispatch();
  const scope = useSelector(s => s.scope);
  const synced = useRef(false);

  const paramFrom = route?.params?.fromDate;
  const paramTo = route?.params?.toDate;

  useEffect(() => {
    // Once only. Without the ref this would fight the chip: every render after
    // a chip change would see the params again and push them back.
    if (synced.current) return;
    synced.current = true;

    if (!paramFrom || !paramTo) return;
    if (paramFrom === scope.from && paramTo === scope.to) return;

    dispatch(setCustomRange({ from: paramFrom, to: paramTo }));
  }, [dispatch, paramFrom, paramTo, scope.from, scope.to]);

  // Returned from redux, never from params — this is what makes the chip work.
  return { from: scope.from, to: scope.to, preset: scope.preset };
}

export default useScopeRange;
