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

export const ScopePicker = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const scope = useSelector(s => s.scope);

  const [mode, setMode] = useState(scope.preset);
  const [draftFrom, setDraftFrom] = useState(scope.from);
  const [draftTo, setDraftTo] = useState(scope.to);
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  // Reset the draft each time the sheet opens, so an abandoned edit doesn't
  // reappear the next time someone taps the chip.
  useEffect(() => {
    if (visible) {
      setMode(scope.preset);
      setDraftFrom(scope.from);
      setDraftTo(scope.to);
    }
  }, [visible, scope.preset, scope.from, scope.to]);

  const choose = value => {
    setMode(value);
    if (value === 'Custom') return; // reveal the pickers, wait for Apply
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

        <ScrollView style={{ maxHeight: 320 }}>
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
});
