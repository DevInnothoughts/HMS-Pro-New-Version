/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/HomeHeader.js
// ─────────────────────────────────────────────────────────────────────────────
// The dark header: menu · org + branch · live pill + scope chip ·
// FOUR TARGET CARDS · compact approval pills.
//
// ⚠️ WHOLE MONTH, WITH RUN RATES — THE 10-DAY BUCKETS ARE GONE
// ────────────────────────────────────────────────────────────
// Each card now reads like a run chase:
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
// A branch on the 1st has one day elapsed, not zero — otherwise CRR divides by
// zero. Today is a day being worked, and its figures are already in `thisYear`.
//
// ⚠️ ON THE LAST DAY THERE IS NO RRR
// ──────────────────────────────────
// daysLeft is 0, so the rate needed is undefined — what remains is simply the
// gap, and NEED already says it. The card shows a dash rather than Infinity.
//
// ⚠️ LAST YEAR IS THE WHOLE OF LAST YEAR'S MONTH
// ──────────────────────────────────────────────
// `lastYear` from the API covers the full month, so comparing it against a
// part-elapsed month would flatter last year. It is shown as its own daily
// rate (lastYear ÷ days in month) beside CRR — rate against rate, which is the
// only honest comparison mid-month.
//
// ⚠️ NO RED
// ─────────
// Behind pace reads amber. Red is reserved for money owed and failed reads —
// states someone must act on today. Being behind on the 12th is information,
// and colouring it red teaches people to ignore red.
//
// The cards ALWAYS cover the current month and ignore the scope chip, because
// targets are monthly.
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
import { scopeLabel } from '../../store/scopeSlice';
import ScopePicker from './ScopePicker';
import { F, T } from '../tokens';

/* ── the month ────────────────────────────────────────────────────────────── */

const monthProgress = (now = new Date()) => {
  const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  // Today counts as elapsed — it is being worked, and its figures are already
  // in `thisYear`. Without this the 1st divides by zero.
  const elapsed = now.getDate();
  return { total, elapsed, left: Math.max(0, total - elapsed) };
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

export const HomeHeader = ({ onMenu, approvals, onApprovals, navigation }) => {
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

  const canSwitchBranch =
    Array.isArray(locationArray) && locationArray.length > 1;
  const period = currentMonthPeriodIndex();
  const month = useMemo(() => monthProgress(), []);

  const load = useCallback(async () => {
    if (!location) return;
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
      );
      setRows(res?.params || []);
      setOptimistic(!!res?.meta?.showOptimistic);
    } catch (e) {
      setError(e.message);
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [location, period, role, subRole]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * One card's chase.
   *
   * Everything is WHOLE MONTH: the target is the month's target, `thisYear` is
   * month-to-date actual, `lastYear` is the whole of last year's month. Only
   * the rates make them comparable mid-month.
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
        // Rate achieved so far.
        crr:
          actual != null && month.elapsed > 0 ? actual / month.elapsed : null,
        // Rate needed from here. Null on the last day — no days left to spread
        // it over, and NEED already says what remains.
        rrr:
          need != null && month.left > 0
            ? Math.max(0, need) / month.left
            : null,
        need,
        // What the monthly target says should be on the board by tonight.
        // Days elapsed INCLUDES today — today is being worked and its figures
        // are already in `actual`, so measuring against yesterday's
        // expectation would flatter every branch by a day.
        expected:
          targetN != null && month.total > 0
            ? (targetN / month.total) * month.elapsed
            : null,
        // The gap against that expectation. Positive is ahead of pace.
        //
        // ⚠️ Assumes work arrives evenly. It does not — surgeries cluster and
        // month-end is heavier — so a branch can trail on the 10th and finish
        // ahead. A pace indicator, not a verdict.
        variance:
          targetN != null && actual != null && month.total > 0
            ? actual - (targetN / month.total) * month.elapsed
            : null,
        // Last year as ITS OWN daily rate, so it compares with CRR rather than
        // with a part-elapsed month.
        lyRate:
          lastYearN != null && month.total > 0 ? lastYearN / month.total : null,
        pct: targetN > 0 && actual != null ? (actual / targetN) * 100 : null,
      };
    },
    [rows, optimistic, month],
  );

  const total = card('total', true);
  const newPat = card('newPatients', false);
  const sx = card('sx', false);

  const openTargets = () =>
    navigation?.navigate?.('BranchTargetDetail', {
      branchId: location,
      branchName: location,
      mode: 'monthly',
      period,
      locations: [location],
    });

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

        <View
          style={[s.iconBtn, { opacity: 0.45 }]}
          accessibilityElementsHidden
        >
          <Icon name="notifications-none" size={19} color="#CFDDD6" />
        </View>
      </View>

      <View style={s.sub}>
        <View style={s.live}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
        <TouchableOpacity
          onPress={() => setPicker('scope')}
          style={s.scopeChip}
          accessibilityRole="button"
        >
          <Text style={s.scopeText}>{scopeLabel(scope)}</Text>
          <Icon name="expand-more" size={14} color="#D2E0D9" />
        </TouchableOpacity>
      </View>

      {/* ── Target cards ── */}
      <View style={s.targetHead}>
        <View>
          <Text style={s.targetLabel}>MONTH TARGET</Text>
          {/* The overs remaining, effectively — the number every rate below
              depends on. */}
          <Text style={s.targetSub}>
            day {month.elapsed} of {month.total} · {month.left} left
          </Text>
        </View>
        <TouchableOpacity
          onPress={openTargets}
          style={s.openBtn}
          accessibilityRole="button"
          accessibilityLabel="Open the branch target screen"
        >
          <Text style={s.openText}>Full</Text>
          <Icon name="arrow-forward" size={13} color="#CFDDD6" />
        </TouchableOpacity>
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
          <TCard label="REVENUE" c={total} onPress={openTargets} />
          <TCard label="NEW PATIENTS" c={newPat} onPress={openTargets} />
          <TCard label="SURGERIES" c={sx} onPress={openTargets} />
        </View>
      )}

      {/* ── Approvals — one compact line ── */}
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

const Rate = ({ label, value, color }) => (
  <View style={s.rate}>
    <Text style={s.rateLabel}>{label}</Text>
    <Text style={[s.rateVal, color && { color }]}>{value}</Text>
  </View>
);

const TCard = ({ label, c, onPress }) => {
  const hue = paceColor(c.crr, c.rrr);
  const done = c.need != null && c.need <= 0;
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
          : `Needs ${fmt(c.need, c.money)} at ${fmtRate(
              c.rrr,
              c.money,
            )} a day.`)
      }
    >
      <View style={s.cardTop}>
        <Text style={s.cardLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.cardVal} numberOfLines={1}>
          {fmt(c.actual, c.money)}
          <Text style={s.cardOf}> / {fmt(c.target, c.money)}</Text>
        </Text>
      </View>

      {/* Directly under the achieved/target pair it qualifies — the gap
          against where today's pro-rata target says the branch should be. */}
      {c.variance != null && (
        <View style={s.varRow}>
          <Icon
            name={ahead ? 'arrow-upward' : 'arrow-downward'}
            size={11}
            color={vHue}
          />
          <Text style={[s.varVal, { color: vHue }]}>
            {fmt(Math.abs(c.variance), c.money)}
          </Text>
          <Text style={s.varNote}>of target</Text>
        </View>
      )}

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

      {/* The chase on one line. NEED is a TOTAL, not a rate — the gap ÷ days
          left is RRR, so a per-day NEED would just repeat it. */}
      <View style={s.rates}>
        <Text style={s.rateItem} numberOfLines={1}>
          <Text style={s.rateLabel}>CRR </Text>
          {fmtRate(c.crr, c.money)}
          <Text style={s.rateUnit}>/day</Text>
        </Text>

        <Text style={[s.rateItem, { color: hue }]} numberOfLines={1}>
          <Text style={s.rateLabel}>RRR </Text>
          {done ? '—' : fmtRate(c.rrr, c.money)}
          {!done && <Text style={s.rateUnit}>/day</Text>}
        </Text>

        <Text
          style={[s.rateItem, s.rateLast, { color: done ? AHEAD : hue }]}
          numberOfLines={1}
        >
          <Text style={s.rateLabel}>{done ? 'OVER ' : 'LEFT '}</Text>
          {c.need == null ? '—' : fmt(Math.abs(c.need), c.money)}
        </Text>
      </View>

      {/* Last year's own daily rate, tucked onto the same line as LEFT rather
          than taking a row of its own. */}
      {c.lyRate != null && (
        <Text style={s.cardLy} numberOfLines={1}>
          last year {fmtRate(c.lyRate, c.money)}/day
        </Text>
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

  sub: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.live },
  liveText: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: T.live,
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
    marginTop: 18,
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
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T.headerTile,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  openText: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#CFDDD6',
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
  grid: { gap: 7 },
  card: {
    backgroundColor: T.headerTile,
    borderWidth: 1,
    borderColor: T.headerTileLine,
    borderRadius: 11,
    paddingVertical: 10,
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
    fontSize: 8.5,
    letterSpacing: 1,
    color: T.headerMuted,
  },
  cardVal: {
    fontFamily: F.mono,
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.3,
  },
  cardOf: { fontSize: 11, color: T.headerMuted },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
    overflow: 'hidden',
  },
  rates: { flexDirection: 'row', gap: 10, marginTop: 8 },
  rateItem: { flex: 1, fontFamily: F.mono, fontSize: 11, color: '#fff' },
  rateLast: { flex: 0.9, textAlign: 'right' },
  rateLabel: { fontSize: 8, letterSpacing: 0.8, color: T.headerMuted },
  rateUnit: { fontSize: 8.5, color: T.headerMuted },
  cardLy: {
    fontFamily: F.mono,
    fontSize: 8.5,
    color: T.headerMuted,
    marginTop: 6,
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
  varRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Right-aligned so it sits under the achieved/target figure rather than
    // under the label on the far side of the card.
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  varVal: { fontFamily: F.mono, fontSize: 11.5, letterSpacing: -0.2 },
  varNote: { fontFamily: F.mono, fontSize: 8.5, color: T.headerMuted },
});
