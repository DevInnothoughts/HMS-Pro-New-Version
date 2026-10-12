/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/HomeHeader.js
// ─────────────────────────────────────────────────────────────────────────────
// The dark header: menu · org + branch · date-range chip ·
// THREE TARGET CARDS · compact approval pills (SuperAdmin only).
//
// ⚠️ THE SELECTED WINDOW, WITH RUN RATES
// ──────────────────────────────────────
// Each card reads like a run chase:
//
//   CRR   current rate   = actual ÷ days elapsed          (per day so far)
//   RRR   required rate  = (target − actual) ÷ days left  (per day from here)
//   NEED  the gap        = target − actual                (what is left)
//
// Whether a branch is ahead is RRR vs CRR — if the rate needed is at or below
// the rate already being managed, the target is reachable at the current pace.
// That is a real judgement, and it is the one a prorated 10-day target could
// never make: revenue does not arrive evenly, so "behind on day 10" said
// nothing. A run rate does not care how the month is shaped.
//
// ⚠️ DAYS ELAPSED INCLUDES TODAY
// ──────────────────────────────
// A branch on day one has one day elapsed, not zero — otherwise CRR divides by
// zero. Today is a day being worked, and its figures are already in `thisYear`.
//
// ⚠️ LAST YEAR IS THE WHOLE OF THE SAME WINDOW LAST YEAR
// ──────────────────────────────────────────────────────
// `lastYear` from the API covers the full window (the server shifts the same
// dates back a year), so comparing it against a part-elapsed window would
// flatter last year. It is shown as its own daily rate beside CRR — rate
// against rate, the only honest mid-period comparison.
//
// ⚠️ …BUT ROUNDED OUT TO WHOLE MONTHS
// ───────────────────────────────────
// Last year comes from branch_monthly_actual (one row per month), and
// getMonthlyActuals() sums every month the shifted window touches, IN FULL.
// "Today" therefore returns all of last October, "Last 7 days" all of
// September + October. Dividing that by the days SELECTED overstated the rate
// up to ~31×. The divisor is lyDays() — the days in the months actually
// summed — so the line reads as last year's average day over those months.
//
// ⚠️ NO RED
// ─────────
// Behind pace reads amber. Red is reserved for money owed and failed reads —
// states someone must act on today. Being behind on the 12th is information,
// and colouring it red teaches people to ignore red.
//
// ⚠️ THE CARDS FOLLOW THE SCOPE CHIP — VIA targetWindow(), NOT scope.to
// ────────────────────────────────────────────────────────────────────
// Targets are stored yearly and the server prorates them to whatever window is
// sent (targetComparisonNewModel: monthsInRange → targetsForPeriod, yearly ×
// months/12), so "Last 7 Days" gets a real derived target rather than the month
// target relabelled.
//
// But the scope filter is a REPORTING window — every preset ends at today,
// because actuals only exist up to today. A chase needs the full TARGET period.
// Sending scope.to straight through makes every preset look finished and kills
// RRR everywhere. targetWindow() is what keeps This Month and This F.Y. live.
//
// ⚠️ A CLOSED WINDOW HAS NO RRR
// ─────────────────────────────
// Yesterday, the rolling 7/30-day windows and any custom range already ended
// have zero days left. The card drops RRR and reports the RESULT — OVER or
// SHORT by however much.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';

import {
  currentMonthPeriodIndex,
  fetchComparisonDetail,
} from '../../admin/targetComparison/TargetComparisonAPI';
import { setLocation } from '../../store/locationSlice';
import { scopeLabel, todayIST } from '../../store/scopeSlice';
// Role resolution is imported, never re-implemented. recruitment/roles.js spells
// out why: a second copy of "what role is this person" is how the frontend and
// backend drift apart, and it has already cost this codebase once.
import { resolveTicketRole, TICKET_ROLE } from '../../ticketing/roles';
import ScopePicker from './ScopePicker';
import { F, T } from '../tokens';

/* ── the window ───────────────────────────────────────────────────────────── */

// Inclusive day count between two YYYY-MM-DD strings. Both ends count: a range
// of 2026-09-01 → 2026-09-01 is one day, not zero.
const daysBetween = (a, b) =>
  Math.floor(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000,
  ) + 1;

/**
 * Days of data behind `lastYear` for a window — see "ROUNDED OUT TO WHOLE
 * MONTHS" in the header. Mirrors the backend: shift both ends back a year, then
 * take every month from the start's month to the end's month, whole. So the
 * span is the 1st of the first month → the last day of the last month, last
 * year (leap years handled by Date.UTC).
 *
 *   2026-10-05 → 2026-10-05   →  2025-10-01 → 2025-10-31   31 days
 *   2026-09-28 → 2026-10-05   →  2025-09-01 → 2025-10-31   61 days
 *   2026-04-01 → 2027-03-31   →  2025-04-01 → 2026-03-31  365 days
 */
const lyDays = (from, to) => {
  if (!from || !to) return 0;
  const fy = Number(from.slice(0, 4)) - 1;
  const fm = Number(from.slice(5, 7)) - 1;
  const ty = Number(to.slice(0, 4)) - 1;
  const tm = Number(to.slice(5, 7)) - 1;
  if (![fy, fm, ty, tm].every(Number.isFinite)) return 0;
  const start = Date.UTC(fy, fm, 1);
  const end = Date.UTC(ty, tm + 1, 0); // day 0 of next month = last of this
  const n = Math.round((end - start) / 86400000) + 1;
  return n > 0 ? n : 0;
};

/**
 * The window the TARGET covers, derived from the scope preset.
 *
 * scopeSlice.rangeFor() ends EVERY preset at today, including 'month' and 'FY',
 * because actuals only exist up to today. That is right for a report and wrong
 * for a chase: the month target is for the whole month, and "days left" means
 * what is left of the month, not zero. Passing scope.to through unchanged makes
 * every preset closed and removes RRR from the screen entirely.
 *
 *   month / FY        → extended to month-end / 31 March   (live chase)
 *   CustomMonth       → that month's 1st → last day        (live if current)
 *   Today / Yesterday → that day                           (closed, correctly)
 *   7 / 30            → the rolling window                 (closed, correctly)
 *   Custom            → exactly as given
 *
 * Extending `to` into the future does NOT change the actuals — there are no
 * rows past today — and it makes `lastYear` the whole of the same period last
 * year, which is what the rate-against-rate comparison assumes.
 */
const targetWindow = scope => {
  const { preset, from, to } = scope || {};
  if (!from || !to) return { from, to };

  // A picked month behaves like 'This Month': the current month is capped at
  // today by monthRange(), so extend it to month-end for a live chase. A past
  // month already ends on its last day and stays closed.
  if (preset === 'month' || preset === 'CustomMonth') {
    const d = new Date(`${from}T00:00:00Z`);
    if (isNaN(d.getTime())) return { from, to };
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { from, to: end.toISOString().slice(0, 10) };
  }

  if (preset === 'FY') {
    // rangeFor('FY') builds `from` as `${fyYear}-04-01`, so the FY ends on the
    // following 31 March.
    const fyYear = Number(from.slice(0, 4));
    return Number.isFinite(fyYear)
      ? { from, to: `${fyYear + 1}-03-31` }
      : { from, to };
  }

  return { from, to };
};

/**
 * How far through the target window we are.
 *
 * Replaces monthProgress(), which assumed the window was always the current
 * calendar month. Three cases, and the closed one is the reason this is not a
 * two-line function:
 *
 *   FUTURE   today < from   elapsed 0      — nothing managed yet, so no CRR
 *   OPEN     from ≤ today < to             — a live chase
 *   CLOSED   today ≥ to     elapsed = total, left = 0
 *
 * CLOSED has no days left to spread the gap over, so RRR is undefined and the
 * card shows the RESULT instead: what the period finished over or short by.
 * `expected` collapses to the full target and `variance` to actual − target,
 * which is exactly right for a finished period.
 *
 * Dates are compared as strings: YYYY-MM-DD sorts lexicographically, so this
 * needs no Date objects and no timezone handling beyond todayIST().
 */
const rangeProgress = (from, to, today = todayIST()) => {
  if (!from || !to) return { total: 0, elapsed: 0, left: 0, closed: true };

  const total = daysBetween(from, to);
  if (!Number.isFinite(total) || total <= 0) {
    return { total: 0, elapsed: 0, left: 0, closed: true };
  }

  if (today < from) return { total, elapsed: 0, left: total, closed: false };
  if (today >= to) return { total, elapsed: total, left: 0, closed: true };

  // Today counts as elapsed — it is being worked and its figures are already
  // in `thisYear`. Same rule as before, now anchored to the window start.
  const elapsed = Math.min(total, Math.max(1, daysBetween(from, today)));
  return { total, elapsed, left: total - elapsed, closed: false };
};

/* ── formatting ───────────────────────────────────────────────────────────── */

const fmtCompact = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

const fmtCount = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '—';
};

const fmt = (v, money) =>
  v == null ? '—' : money ? fmtCompact(v) : fmtCount(Math.round(v));

/**
 * A daily rate. Counts get one decimal — "3 surgeries a day" and "3.4" are
 * different chases, and rounding to 3 hides the gap the card exists to show.
 */
const fmtRate = (v, money) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return money ? fmtCompact(v) : v.toFixed(1);
};

/* ── colours ──────────────────────────────────────────────────────────────── */

const AHEAD = '#63C79A';
const ON = '#E8D07A';
const BEHIND = '#E8A45C'; // amber, never red — see the header
const NEUTRAL = '#9FCBB6';

/**
 * Pace, judged the way a chase is: the rate needed against the rate managed.
 * Not the percentage achieved — 40% on the 12th is fine, and 40% on the 28th
 * is not, and only the rates tell those apart.
 */
const paceColor = (crr, rrr) => {
  if (rrr == null) return NEUTRAL; // nothing left to chase
  if (rrr <= 0) return AHEAD; // already there
  if (crr == null || crr <= 0) return BEHIND;
  const ratio = rrr / crr;
  if (ratio <= 1) return AHEAD; // current pace is enough
  if (ratio <= 1.25) return ON; // within reach
  return BEHIND;
};

/**
 * The arrow's colour, judged on the gap against today's expectation.
 *
 * Separate from paceColor because they answer different questions: paceColor
 * asks "can we still get there", this asks "are we where we should be now".
 * A branch can be behind today and comfortably on pace — that is exactly the
 * case where one colour for both would mislead.
 *
 * The 5% tolerance stops a branch flickering colour over a rounding-sized gap.
 */
const varianceColor = (variance, expected) => {
  if (variance == null || !expected) return NEUTRAL;
  if (variance >= 0) return AHEAD;
  if (Math.abs(variance) <= expected * 0.05) return ON;
  return BEHIND;
};

/* ── header ───────────────────────────────────────────────────────────────── */

export const HomeHeader = ({
  onMenu,
  approvals = {},
  onApprovals,
  navigation,
}) => {
  const dispatch = useDispatch();
  const location = useSelector(s => s.location.value);
  const locationArray = useSelector(s => s.location.locationArray);
  const role = useSelector(s => s.location.role);
  const subRole = useSelector(s => s.location.subRole);
  const scope = useSelector(s => s.scope);

  const [picker, setPicker] = useState(null); // 'branch' | 'scope' | null
  const [rows, setRows] = useState(null);
  const [optimistic, setOptimistic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The date filter drives both the request and the chase. targetWindow() turns
  // the reporting window into the target's own period — see its note. The cards
  // used to pin themselves to the calendar month and ignore the chip entirely,
  // while the body of HomeScreen followed it, so the two halves of one screen
  // could describe different periods.
  const tw = useMemo(() => targetWindow(scope), [scope]);
  const { from, to } = tw;

  const win = useMemo(() => rangeProgress(from, to), [from, to]);
  // Divisor for last year's daily rate — whole months, not the days selected.
  const lyDayCount = useMemo(() => lyDays(from, to), [from, to]);

  const canSwitchBranch =
    Array.isArray(locationArray) && locationArray.length > 1;

  // Daily sign-off is management oversight: who has and hasn't signed off each
  // branch. A Partner or Cluster Head signs their own branch on ApprovalScreen
  // and has no business reading the group's compliance board from the home
  // screen. HomeScreen already gated the TAP (onApprovals is null for everyone
  // else) but still rendered the row disabled, so the counts were on display to
  // every role — which is the bug this fixes.
  const isSuperAdmin =
    resolveTicketRole(role, subRole) === TICKET_ROLE.SUPER_ADMIN;

  // Fallback only — the explicit range below is what actually drives the
  // request. Kept because getRangeForSelection(undefined, undefined) resolves
  // to April, which is a far worse default than this month.
  const period = currentMonthPeriodIndex();

  const load = useCallback(async () => {
    if (!location || !from || !to) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchComparisonDetail(
        location,
        'monthly',
        period,
        [location],
        role,
        subRole,
        { from, to },
      );
      setRows(res?.params || []);
      setOptimistic(!!res?.meta?.showOptimistic);
    } catch (e) {
      setError(e.message);
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [location, from, to, period, role, subRole]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * One card's chase.
   *
   * Everything is THE SELECTED WINDOW: `target` is that window's prorated
   * target, `thisYear` is the actual so far inside it, `lastYear` is the whole
   * of the same window one year back. Only the rates make them comparable
   * before the window closes.
   */
  const card = useCallback(
    (key, money) => {
      const r = (rows || []).find(x => x.key === key) || {};
      const actual = r.thisYear == null ? null : Number(r.thisYear);
      const target = optimistic ? r.targetO ?? r.target : r.target;
      const targetN = target == null ? null : Number(target);
      const lastYearN = r.lastYear == null ? null : Number(r.lastYear);

      const need = targetN != null && actual != null ? targetN - actual : null;

      return {
        money,
        actual,
        target: targetN,
        // Whether the window has already ended. Drives OVER / SHORT vs LEFT on
        // the card, and the bar colour.
        closed: win.closed,
        // Rate achieved so far.
        crr: actual != null && win.elapsed > 0 ? actual / win.elapsed : null,
        // Rate needed from here. Null once the window closes — no days left to
        // spread it over, and NEED already says what remains.
        rrr: need != null && win.left > 0 ? Math.max(0, need) / win.left : null,
        need,
        // What the target says should be on the board by tonight. Days elapsed
        // INCLUDES today — today is being worked and its figures are already in
        // `actual`, so measuring against yesterday's expectation would flatter
        // every branch by a day.
        expected:
          targetN != null && win.total > 0
            ? (targetN / win.total) * win.elapsed
            : null,
        // The gap against that expectation. Positive is ahead of pace.
        //
        // ⚠️ Assumes work arrives evenly. It does not — surgeries cluster and
        // month-end is heavier — so a branch can trail on the 10th and finish
        // ahead. A pace indicator, not a verdict.
        variance:
          targetN != null && actual != null && win.total > 0
            ? actual - (targetN / win.total) * win.elapsed
            : null,
        // Last year as ITS OWN daily rate, so it compares with CRR rather than
        // with a part-elapsed window. Divided by the days in the whole months
        // the backend summed (lyDays), NOT win.total — see the file header.
        lyRate:
          lastYearN != null && lyDayCount > 0 ? lastYearN / lyDayCount : null,
        pct: targetN > 0 && actual != null ? (actual / targetN) * 100 : null,
        // Interbranch cases operated here for another branch. The backend
        // leaves them OUT of `thisYear` (they count at the source branch) and
        // attaches the count to the sx/ipdRevenue/total rows only when > 0.
        // Shown on the Surgeries card so the gap between this count and the
        // IPD Invoice page is explained.
        ibExcluded:
          key === 'sx' && Number(r.interbranch?.invoices) > 0
            ? Number(r.interbranch.invoices)
            : null,
      };
    },
    [rows, optimistic, win, lyDayCount],
  );

  const total = card('total', true);
  const newPat = card('newPatients', false);
  const sx = card('sx', false);

  // Revenue per new patient, from the SAME two figures the cards show — the
  // REVENUE card's actual ÷ the NEW PATIENTS card's actual — so the three can
  // never disagree. Same window as the cards (targetWindow). '-' when there
  // are no new patients (never a divide by zero); '—' while loading or when
  // either figure is missing.
  const revPerNew =
    loading || error || total.actual == null || newPat.actual == null
      ? '—'
      : newPat.actual > 0
      ? fmtCompact(total.actual / newPat.actual)
      : '-';

  // Card taps. Revenue opens THIS branch's target screen; New Patients and
  // Surgeries open the lists behind those counts. The lists get the SCOPE
  // range (scope.from/to, ends today), not the target window — `to` here runs
  // to month-end / 31 March and would ask for days with no data yet.
  //
  // BranchTargetDetail takes a mode + period index within the CURRENT FY, not
  // a date range, so the chip is mapped onto it: This F.Y. → Yearly; anything
  // else → the month the range ends in (Monthly), or the current month if that
  // falls outside this FY (e.g. a custom range from last year).
  const openBranchTarget = () => {
    const isFY = scope?.preset === 'FY';
    const toMonthIndex = () => {
      const [y, m] = String(scope?.to || '')
        .split('-')
        .map(Number);
      if (!y || !m) return period;
      const now = new Date();
      const curFY =
        now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
      const fy = m >= 4 ? y : y - 1;
      return fy === curFY ? (m + 8) % 12 : period; // Apr → 0 … Mar → 11
    };
    navigation?.navigate?.('BranchTargetDetail', {
      branchId: location,
      branchName: location,
      mode: isFY ? 'yearly' : 'monthly',
      period: isFY ? 0 : toMonthIndex(),
      locations: [location],
    });
  };

  const listParams = () => ({
    location,
    fromDate: scope.from,
    toDate: scope.to,
  });

  const openAppointments = () =>
    navigation?.navigate?.('AppointmentDetails', listParams());

  const openIPDInvoices = () =>
    navigation?.navigate?.('IPDBillDetails', listParams());

  return (
    <View style={s.hdr}>
      <View style={s.top}>
        <TouchableOpacity
          onPress={onMenu}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Icon name="menu" size={19} color="#CFDDD6" />
        </TouchableOpacity>

        <View style={s.id}>
          <Text style={s.org}>HHC</Text>
          <TouchableOpacity
            disabled={!canSwitchBranch}
            onPress={() => setPicker('branch')}
            style={s.branchRow}
            accessibilityRole="button"
            accessibilityLabel={`Branch ${location}. Change branch`}
          >
            <Text style={s.branch} numberOfLines={1}>
              {location || '—'}
            </Text>
            {canSwitchBranch && (
              <Icon name="expand-more" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Date range filter — sits where the notification icon was. */}
        <TouchableOpacity
          onPress={() => setPicker('scope')}
          style={s.scopeChip}
          accessibilityRole="button"
          accessibilityLabel={`Date range ${scopeLabel(scope)}. Change range`}
        >
          <Text style={s.scopeText}>{scopeLabel(scope)}</Text>
          <Icon name="expand-more" size={14} color="#D2E0D9" />
        </TouchableOpacity>
      </View>

      {/* ── Target cards ── */}
      <View style={s.targetHead}>
        <View>
          <Text style={s.targetLabel}>TARGET</Text>
          <Text style={s.targetSub}>
            {win.total === 0
              ? '—'
              : win.elapsed === 0
              ? `starts ${from}`
              : win.closed
              ? `${win.total} day${win.total === 1 ? '' : 's'} · complete`
              : `day ${win.elapsed} of ${win.total} · ${win.left} left`}
          </Text>
        </View>
        {/* Revenue per new patient — see revPerNew above. Takes the slot the
            "Full" button used to occupy. */}
        <View
          style={s.rpn}
          accessible
          accessibilityLabel={`Revenue per new patient ${revPerNew}`}
        >
          <Text style={s.rpnLabel}>REV / NEW PT</Text>
          <Text style={s.rpnVal} numberOfLines={1} adjustsFontSizeToFit>
            {revPerNew}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={AHEAD} />
        </View>
      ) : error ? (
        <TouchableOpacity
          onPress={load}
          style={s.errorBox}
          accessibilityRole="button"
        >
          <Text style={s.errorText}>{error}</Text>
          <Text style={s.retry}>Tap to retry</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.grid}>
          <TCard label="REVENUE" c={total} onPress={openBranchTarget} />
          <TCard label="NEW PATIENTS" c={newPat} onPress={openAppointments} />
          <TCard label="SURGERIES" c={sx} onPress={openIPDInvoices} />
        </View>
      )}

      {/* ── Approvals — one compact line, SuperAdmin only ── */}
      {isSuperAdmin && (
        <TouchableOpacity
          disabled={!onApprovals}
          onPress={onApprovals || undefined}
          activeOpacity={0.85}
          style={s.apprRow}
          accessibilityRole={onApprovals ? 'button' : 'text'}
          accessibilityLabel={`Partner ${approvals.partner}, Cluster head ${approvals.clusterHead}`}
        >
          <Icon name="assignment-turned-in" size={13} color={T.apprLabel} />
          <Pip label="Partner" value={approvals.partner} />
          <View style={s.apprDiv} />
          <Pip label="Cluster head" value={approvals.clusterHead} />
          {!!onApprovals && (
            <Icon name="chevron-right" size={16} color={T.apprLabel} />
          )}
        </TouchableOpacity>
      )}

      <PickerSheet
        visible={picker === 'branch'}
        title="Branch"
        // Sorted here, not in redux: locationArray comes from the Firestore user
        // doc and `value` is locationArray[0] at login, so sorting the array
        // itself would change which branch a user lands on.
        options={[...(locationArray || [])]
          .sort((a, b) => String(a).localeCompare(String(b)))
          .map(b => ({ key: b, label: b }))}
        selected={location}
        onSelect={b => {
          dispatch(setLocation(b));
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      <ScopePicker
        visible={picker === 'scope'}
        onClose={() => setPicker(null)}
      />
    </View>
  );
};

/* ── bits ─────────────────────────────────────────────────────────────────── */

const TCard = ({ label, c, onPress }) => {
  const done = c.need != null && c.need <= 0;
  // No target configured → nothing to be short of. Without the null check this
  // paints an un-targeted metric amber and labels it SHORT on any closed window.
  const missed = !done && c.closed && c.need != null;

  // paceColor returns NEUTRAL when rrr is null, which is right for a live
  // window with nothing to chase but wrong for a finished one — a window that
  // closed on target should read AHEAD, one that closed short should read
  // amber. Never red: see the file header.
  const hue = done ? AHEAD : missed ? BEHIND : paceColor(c.crr, c.rrr);
  const vHue = varianceColor(c.variance, c.expected);
  const ahead = c.variance != null && c.variance >= 0;

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${label}. ${fmt(c.actual, c.money)} of ${fmt(c.target, c.money)}. ` +
        (c.variance == null
          ? ''
          : `${ahead ? 'Ahead of' : 'Behind'} today's pace by ${fmt(
              Math.abs(c.variance),
              c.money,
            )}. `) +
        (done
          ? 'Target met.'
          : missed
          ? `Finished ${fmt(Math.abs(c.need), c.money)} short.`
          : c.need == null
          ? 'No target set.'
          : `Needs ${fmt(c.need, c.money)} at ${fmtRate(
              c.rrr,
              c.money,
            )} a day.`) +
        (c.ibExcluded != null ? ` ${c.ibExcluded} interbranch excluded.` : '')
      }
    >
      {/* 1 — label + achieved/target */}
      <View style={s.cardTop}>
        <Text style={s.cardLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.cardVal} numberOfLines={1}>
          {fmt(c.actual, c.money)}
          <Text style={s.cardOf}> / {fmt(c.target, c.money)}</Text>
        </Text>
      </View>

      {/* 2 — progress */}
      <View style={s.track}>
        <View
          style={{
            width: `${Math.min(Math.max(c.pct ?? 0, 0), 100)}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: hue,
          }}
        />
      </View>

      {/* 3 — the chase. NEED is a TOTAL, not a rate — the gap ÷ days left is
          RRR, so a per-day NEED would just repeat it. */}
      <View style={s.rates}>
        <Text style={s.rateItem} numberOfLines={1}>
          <Text style={s.rateLabel}>CRR </Text>
          {fmtRate(c.crr, c.money)}
          <Text style={s.rateUnit}>/day</Text>
        </Text>

        {/* The /day suffix is tied to rrr being a real number, not to `done`.
            A closed window that missed its target has done === false and rrr
            === null, which used to render "RRR —/day". */}
        <Text style={[s.rateItem, { color: hue }]} numberOfLines={1}>
          <Text style={s.rateLabel}>RRR </Text>
          {done || c.rrr == null ? '—' : fmtRate(c.rrr, c.money)}
          {!done && c.rrr != null && <Text style={s.rateUnit}>/day</Text>}
        </Text>

        <Text
          style={[s.rateItem, s.rateLast, { color: done ? AHEAD : hue }]}
          numberOfLines={1}
        >
          <Text style={s.rateLabel}>
            {done ? 'OVER ' : missed ? 'SHORT ' : 'LEFT '}
          </Text>
          {c.need == null ? '—' : fmt(Math.abs(c.need), c.money)}
        </Text>
      </View>

      {/* 4 — the two qualifiers on ONE line. Both are context for the figures
          above rather than figures in their own right, and giving each a row
          was what forced them down to 8.5pt to keep the card short. Together
          on one line they fit at 11–12pt, which is the whole point of the
          change. Left-aligned now: the variance no longer sits under the
          achieved/target pair, so right-aligning it would strand it. */}
      {(c.variance != null || c.lyRate != null) && (
        <View style={s.foot}>
          {c.variance != null && (
            <>
              <Icon
                name={ahead ? 'arrow-upward' : 'arrow-downward'}
                size={12}
                color={vHue}
              />
              <Text style={[s.varVal, { color: vHue }]} numberOfLines={1}>
                {fmt(Math.abs(c.variance), c.money)}
              </Text>
              <Text style={s.varNote} numberOfLines={1}>
                of target
              </Text>
            </>
          )}

          {c.variance != null && c.lyRate != null && (
            <Text style={s.footDot}>·</Text>
          )}

          {c.lyRate != null && (
            <Text style={s.cardLy} numberOfLines={1}>
              last year {fmtRate(c.lyRate, c.money)}/day
            </Text>
          )}
        </View>
      )}

      {/* 5 — Surgeries only: interbranch cases not counted above. */}
      {c.ibExcluded != null && (
        <View style={s.ibRow}>
          <Icon name="swap-horiz" size={12} color={T.headerMuted} />
          <Text style={s.ibText} numberOfLines={1}>
            +{fmtCount(c.ibExcluded)} interbranch excl.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const Pip = ({ label, value }) => {
  const done = String(value).toLowerCase() === 'done';
  return (
    <View style={s.pip}>
      <View style={[s.pipDot, { backgroundColor: done ? AHEAD : T.apprPip }]} />
      <Text style={s.pipLabel}>{label}</Text>
      <Text style={[s.pipVal, { color: done ? AHEAD : T.apprText }]}>
        {value}
      </Text>
    </View>
  );
};

/** A bottom sheet of options. Used by the branch switcher. */
export const PickerSheet = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <Pressable style={s.overlay} onPress={onClose} accessibilityLabel="Close" />
    <View style={s.sheet}>
      <Text style={s.sheetTitle}>{title}</Text>
      <ScrollView style={{ maxHeight: 380 }}>
        {options.map(o => {
          const on = o.key === selected;
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => onSelect(o.key)}
              style={s.sheetRow}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  s.sheetLabel,
                  on && { color: T.brand, fontFamily: F.semibold },
                ]}
              >
                {o.label}
              </Text>
              {on && <Icon name="check" size={18} color={T.brand} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  </Modal>
);

export default HomeHeader;

const s = StyleSheet.create({
  hdr: {
    backgroundColor: T.headerBg,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    backgroundColor: T.headerTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  id: { flex: 1, minWidth: 0 },
  org: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: T.headerMuted,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  branch: {
    fontFamily: F.semibold,
    fontSize: 15.5,
    color: '#fff',
    letterSpacing: -0.2,
  },

  scopeChip: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.headerTile,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scopeText: { fontFamily: F.mono, fontSize: 11, color: '#D2E0D9' },

  targetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4, // was 18, below the removed LIVE row
    marginBottom: 9,
  },
  targetLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.headerMuted,
  },
  targetSub: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: 'rgba(159,203,182,0.75)',
    marginTop: 3,
  },
  // Revenue per new patient — the one figure in this row meant to be read
  // first, so it gets a gold highlight pill and the largest type in the row.
  rpn: {
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.55)',
    backgroundColor: 'rgba(255,200,87,0.14)',
    maxWidth: '46%',
  },
  rpnLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 1.1,
    color: '#FFE3A3',
  },
  rpnVal: {
    fontFamily: F.mono,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFC857',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  loading: { paddingVertical: 34, alignItems: 'center' },
  errorBox: {
    backgroundColor: T.headerTile,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    borderRadius: 12,
    padding: 13,
  },
  errorText: { fontFamily: F.regular, fontSize: 12, color: '#E8CFCB' },
  retry: { fontFamily: F.mono, fontSize: 10, color: AHEAD, marginTop: 6 },

  // One card per row: three rates need the full width to stay legible, and a
  // 2-up grid put CRR/RRR/NEED into 45px columns.
  grid: { gap: 6 },

  card: {
    backgroundColor: T.headerTile,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardLabel: {
    fontFamily: F.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: T.headerMuted,
    flexShrink: 1,
  },
  cardVal: {
    fontFamily: F.mono,
    fontSize: 17,
    color: '#fff',
    letterSpacing: -0.3,
  },
  cardOf: { fontSize: 12, color: T.headerMuted },

  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 7,
    overflow: 'hidden',
  },

  rates: { flexDirection: 'row', gap: 8, marginTop: 7 },
  rateItem: { flex: 1, fontFamily: F.mono, fontSize: 13, color: '#fff' },
  rateLast: { flex: 0.9, textAlign: 'right' },
  rateLabel: { fontSize: 10.5, letterSpacing: 0.5, color: T.headerMuted },
  rateUnit: { fontSize: 10.5, color: T.headerMuted },

  // Variance + last year on one line. Replaced the old `varRow`/`cardLy` pair
  // of rows, which is what freed the height to raise every size in the card.
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  varVal: {
    fontFamily: F.mono,
    fontSize: 12,
    letterSpacing: -0.2,
    flexShrink: 0,
  },
  varNote: {
    fontFamily: F.mono,
    fontSize: 11,
    color: T.headerMuted,
    flexShrink: 1,
  },
  footDot: {
    fontFamily: F.mono,
    fontSize: 11,
    color: T.headerMuted,
    opacity: 0.6,
  },
  cardLy: {
    fontFamily: F.mono,
    fontSize: 11,
    color: T.headerMuted,
    flexShrink: 1,
  },
  ibRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ibText: {
    fontFamily: F.mono,
    fontSize: 11,
    color: T.headerMuted,
    flexShrink: 1,
  },

  apprRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.apprBg,
    borderWidth: 1,
    borderColor: T.apprLine,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginTop: 10,
  },
  apprDiv: { width: 1, height: 12, backgroundColor: T.apprLine },
  pip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pipDot: { width: 6, height: 6, borderRadius: 3 },
  pipLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: T.apprLabel,
  },
  pipVal: { fontFamily: F.mono, fontSize: 10 },

  overlay: { flex: 1, backgroundColor: 'rgba(5,20,12,0.32)' },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontFamily: F.semibold,
    fontSize: 15,
    color: T.text,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  sheetLabel: { fontFamily: F.regular, fontSize: 14, color: T.text },
});
