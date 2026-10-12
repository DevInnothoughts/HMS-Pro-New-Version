/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/ScopePicker.js
// ─────────────────────────────────────────────────────────────────────────────
// The date-range sheet behind the scope chip. One component, used by both the
// home header and every section header, so the seven options can never drift
// apart between screens.
//
// Picking a preset commits immediately and closes — that is the common case and
// an extra Apply tap on it is friction for nothing. "Custom Date" instead
// reveals two date buttons and an Apply, because a half-entered range should
// not be sent to forty branch databases on every tap.
//
// "Custom Month" reveals a year stepper and a 4×3 month grid rather than two
// dropdowns: one tap each instead of open-scroll-pick twice, and months that
// have not happened yet are visibly unavailable rather than silently rejected.
// A preview line states the exact dates before Apply. The range itself comes
// from scopeSlice.monthRange() — 1st → last day, capped at today.
//
// Uses react-native-date-picker, already a dependency (see ReferenceData.js).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';

import {
  SCOPE_OPTIONS,
  fmt,
  monthRange,
  setCustomMonth,
  setCustomRange,
  setPreset,
  todayIST,
} from '../../store/scopeSlice';
import { F, T } from '../tokens';

// A YYYY-MM-DD string → a Date the picker can show. Parsed as UTC so the string
// that goes back out matches the one that came in, whatever the device zone is.
const toDate = s => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

// A Date from the picker → YYYY-MM-DD. The picker returns local midnight, so
// read the LOCAL fields here — using fmt() would shift the day backwards for
// anyone west of UTC.
const fromDate = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// How far back the year stepper goes. Older than this and the branch data is
// thin enough that a month view is not meaningful.
const YEARS_BACK = 6;

// '2026-09-30' → '30 Sep 2026'
const pretty = ymd => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return `${d} ${MONTHS[m - 1] || ''} ${y}`;
};

export const ScopePicker = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const scope = useSelector(s => s.scope);

  const [mode, setMode] = useState(scope.preset);
  const [draftFrom, setDraftFrom] = useState(scope.from);
  const [draftTo, setDraftTo] = useState(scope.to);
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  // Custom Month draft. Starts on the month already chosen, else this month.
  const today = todayIST();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7)) - 1;
  const [draftYear, setDraftYear] = useState(thisYear);
  const [draftMonth, setDraftMonth] = useState(thisMonth);

  // Reset the draft each time the sheet opens, so an abandoned edit doesn't
  // reappear the next time someone taps the chip.
  useEffect(() => {
    if (visible) {
      setMode(scope.preset);
      setDraftFrom(scope.from);
      setDraftTo(scope.to);
      if (scope.preset === 'CustomMonth' && scope.from) {
        setDraftYear(Number(scope.from.slice(0, 4)));
        setDraftMonth(Number(scope.from.slice(5, 7)) - 1);
      } else {
        const t = todayIST();
        setDraftYear(Number(t.slice(0, 4)));
        setDraftMonth(Number(t.slice(5, 7)) - 1);
      }
    }
  }, [visible, scope.preset, scope.from, scope.to]);

  const choose = value => {
    setMode(value);
    // reveal the pickers, wait for Apply
    if (value === 'Custom' || value === 'CustomMonth') return;
    dispatch(setPreset(value));
    onClose();
  };

  const apply = () => {
    if (draftFrom > draftTo) {
      Alert.alert(
        'Invalid range',
        'The “from” date cannot be after the “to” date.',
      );
      return;
    }
    if (draftTo > todayIST()) {
      Alert.alert('Invalid range', 'The “to” date cannot be in the future.');
      return;
    }
    dispatch(setCustomRange({ from: draftFrom, to: draftTo }));
    onClose();
  };

  // Stepping the year keeps the month if it exists in that year, otherwise
  // falls back to the latest available month (stepping into the current year
  // from a past December, say).
  const stepYear = delta => {
    const y = draftYear + delta;
    if (y > thisYear || y < thisYear - YEARS_BACK) return;
    setDraftYear(y);
    if (y === thisYear && draftMonth > thisMonth) setDraftMonth(thisMonth);
  };

  const monthDraft = monthRange(draftYear, draftMonth);

  const applyMonth = () => {
    if (!monthDraft) return;
    dispatch(setCustomMonth({ year: draftYear, month: draftMonth }));
    onClose();
  };

  const customOpen = mode === 'Custom' || mode === 'CustomMonth';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={s.overlay}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={s.sheet}>
        <Text style={s.title}>Period</Text>

        {/* Shorter while a custom panel is open, so the panel and its Apply
            button stay on screen on small phones. */}
        <ScrollView style={{ maxHeight: customOpen ? 200 : 380 }}>
          {SCOPE_OPTIONS.map(o => {
            const on = o.value === mode;
            return (
              <TouchableOpacity
                key={o.value}
                onPress={() => choose(o.value)}
                style={s.row}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.label, on && s.labelOn]}>{o.label}</Text>
                {on && <Icon name="check" size={18} color={T.brand} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {mode === 'CustomMonth' && (
          <View style={s.custom}>
            <View style={s.yearRow}>
              <TouchableOpacity
                onPress={() => stepYear(-1)}
                disabled={draftYear <= thisYear - YEARS_BACK}
                style={[
                  s.yearBtn,
                  draftYear <= thisYear - YEARS_BACK && s.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Previous year"
              >
                <Icon name="chevron-left" size={22} color={T.brand} />
              </TouchableOpacity>
              <Text style={s.yearText} accessibilityRole="header">
                {draftYear}
              </Text>
              <TouchableOpacity
                onPress={() => stepYear(1)}
                disabled={draftYear >= thisYear}
                style={[s.yearBtn, draftYear >= thisYear && s.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Next year"
              >
                <Icon name="chevron-right" size={22} color={T.brand} />
              </TouchableOpacity>
            </View>

            <View style={s.grid}>
              {MONTHS.map((label, i) => {
                const future =
                  draftYear > thisYear ||
                  (draftYear === thisYear && i > thisMonth);
                const on = i === draftMonth;
                const current = draftYear === thisYear && i === thisMonth;
                return (
                  <TouchableOpacity
                    key={label}
                    disabled={future}
                    onPress={() => setDraftMonth(i)}
                    style={[s.month, on && s.monthOn, future && s.monthFuture]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: future }}
                    accessibilityLabel={`${label} ${draftYear}`}
                  >
                    <Text
                      style={[
                        s.monthText,
                        on && s.monthTextOn,
                        future && s.monthTextFuture,
                      ]}
                    >
                      {label}
                    </Text>
                    {current && !on && <View style={s.nowDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {!!monthDraft && (
              <View style={s.preview}>
                <Icon name="date-range" size={16} color={T.muted} />
                <Text style={s.previewText}>
                  {pretty(monthDraft.from)} → {pretty(monthDraft.to)}
                  {monthDraft.to === today ? '  (today)' : ''}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={applyMonth}
              disabled={!monthDraft}
              style={[s.apply, !monthDraft && s.disabled]}
              accessibilityRole="button"
            >
              <Text style={s.applyText}>
                Apply · {MONTHS[draftMonth]} {draftYear}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'Custom' && (
          <View style={s.custom}>
            <DateButton
              label="From"
              value={draftFrom}
              onPress={() => setOpenFrom(true)}
            />
            <DateButton
              label="To"
              value={draftTo}
              onPress={() => setOpenTo(true)}
            />

            <TouchableOpacity
              onPress={apply}
              style={s.apply}
              accessibilityRole="button"
            >
              <Text style={s.applyText}>Apply</Text>
            </TouchableOpacity>

            <DatePicker
              modal
              mode="date"
              open={openFrom}
              date={toDate(draftFrom)}
              maximumDate={new Date()}
              onConfirm={d => {
                setOpenFrom(false);
                setDraftFrom(fromDate(d));
              }}
              onCancel={() => setOpenFrom(false)}
            />
            <DatePicker
              modal
              mode="date"
              open={openTo}
              date={toDate(draftTo)}
              minimumDate={toDate(draftFrom)}
              maximumDate={new Date()}
              onConfirm={d => {
                setOpenTo(false);
                setDraftTo(fromDate(d));
              }}
              onCancel={() => setOpenTo(false)}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const DateButton = ({ label, value, onPress }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={s.dateLabel}>{label}</Text>
    <TouchableOpacity
      onPress={onPress}
      style={s.dateBtn}
      accessibilityRole="button"
    >
      <Text style={s.dateVal}>{value}</Text>
      <Icon name="calendar-today" size={17} color={T.brand} />
    </TouchableOpacity>
  </View>
);

export default ScopePicker;

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,20,12,0.32)' },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    fontFamily: F.semibold,
    fontSize: 15,
    color: T.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  label: { fontFamily: F.regular, fontSize: 14, color: T.text },
  labelOn: { color: T.brand, fontFamily: F.semibold },

  custom: { marginTop: 16 },
  dateLabel: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: T.muted,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginTop: 6,
  },
  dateVal: { fontFamily: F.mono, fontSize: 13.5, color: T.text },
  apply: {
    backgroundColor: T.brand,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  applyText: { fontFamily: F.semibold, fontSize: 14, color: '#fff' },
  disabled: { opacity: 0.35 },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  yearBtn: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontFamily: F.semibold,
    fontSize: 18,
    color: T.text,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  month: {
    width: '23.5%',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    alignItems: 'center',
  },
  monthOn: { backgroundColor: T.brand, borderColor: T.brand },
  monthFuture: { backgroundColor: T.subtle, borderColor: T.lineSoft },
  monthText: { fontFamily: F.medium, fontSize: 13.5, color: T.text },
  monthTextOn: { color: '#fff', fontFamily: F.semibold },
  monthTextFuture: { color: T.chevron },
  nowDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.brand,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.subtle,
    borderWidth: 1,
    borderColor: T.lineSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  previewText: { fontFamily: F.regular, fontSize: 12.5, color: T.text },
});
