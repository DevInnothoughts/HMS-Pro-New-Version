/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/IPDInvoiceRow.js
// ─────────────────────────────────────────────────────────────────────────────
// One invoice card. Used by both IPDInvoiceScreen (all invoices) and
// IPDInvoiceStatusScreen (one status), which render the identical card — two
// copies would drift the first time a figure is added.
//
// The four figures are ALWAYS visible. The old screen hid seven amounts behind
// an expand toggle, each with a decorative PNG beside it, which made every row
// a two-tap read for the numbers people came for. Settled, TDS and Payable join
// as a second row only for Cashless, where they carry meaning.
//
// A row with an outstanding due gets a red spine, so scanning for money owed
// needs no filter.
//
// REQUIRES /IPDCollection/billsV4
// ──────────────────────────────
// admission_date and discharge_date came from V3 already. The insurer and TPA
// NAMES are V4 only — it adds insurancecompany_name and tpa_name alongside the
// raw ids. On a V3 payload those keys are simply absent and the insurer block
// reads "Not recorded", so this file does not break if a caller is still on V3.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { F, T, inr } from '../tokens';

const n0 = v => Number(v) || 0;

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

// Full date here rather than fmtDay's "28 Aug": on a financial-year range the
// list spans two years, and a bare day-month is ambiguous across them.
const fmtDate = d => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};

// Length of stay. Null while the patient is still admitted — a "0d" there
// would read as a same-day discharge, which is a different thing.
const stayDays = (from, to) => {
  if (!from || !to) return null;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const Figure = ({ label, value, color, alert }) => (
  <View style={s.fig}>
    <Text style={s.figLabel}>{label}</Text>
    <Text style={[s.figVal, color && { color }, alert && { color: T.crit }]}>
      {value}
    </Text>
  </View>
);

/**
 * @param b        invoice row from /IPDCollection/billsV4
 * @param hue      accent — the status colour on the parent, the header hue on
 *                 the sub-page
 * @param cashless show the Settled / TDS / Payable row
 * @param showType print the status on the meta line (parent screen only, where
 *                 the list mixes statuses)
 */
export const IPDInvoiceRow = ({ b, hue, cashless, showType }) => {
  const due = n0(b.totaldue);
  const stay = stayDays(b.admission_date, b.discharge_date);
  const insurer = b.insurancecompany_name;
  const tpa = b.tpa_name;

  return (
    <View style={s.row}>
      <View style={[s.rowSpine, { backgroundColor: due > 0 ? T.crit : hue }]} />

      <View style={s.rowHead}>
        <View style={[s.avatar, { backgroundColor: `${hue}18` }]}>
          <Text style={[s.avatarText, { color: hue }]}>{initials(b.name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>
            {b.name || 'Unnamed'}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {b.phone || 'No number'}
            {b.sex ? ` · ${b.sex}` : ''}
            {showType && b.status ? ` · ${b.status}` : ''}
            {b.invoice_id ? ` · #${b.invoice_id}` : ''}
          </Text>
        </View>
      </View>
      {/* Admission and discharge get the same labelled treatment as the money
          below — a bare "28 Aug → 2 Sep" needs the reader to work out which is
          which, and the arrow reads as a state change rather than two facts. */}
      <View style={s.stayRow}>
        <View style={s.stayCell}>
          <Text style={s.stayLabel}>ADMITTED</Text>
          <Text style={s.stayVal}>{fmtDate(b.admission_date) || '—'}</Text>
        </View>
        <View style={s.stayCell}>
          <Text style={s.stayLabel}>DISCHARGED</Text>
          <Text style={[s.stayVal, !b.discharge_date && s.stayOpen]}>
            {fmtDate(b.discharge_date) || 'In hospital'}
          </Text>
        </View>
        <View style={s.stayCell}>
          <Text style={s.stayLabel}>STAY</Text>
          <Text style={s.stayVal}>
            {stay == null ? '—' : `${stay} ${stay === 1 ? 'day' : 'days'}`}
          </Text>
        </View>
      </View>

      {/* Cashless only — the insurer is the party being billed, and on any
          other status there is none. */}
      {b.status === 'Cashless' && (
        <View style={s.insurer}>
          <View style={s.insurerLine}>
            <Icon name="verified-user" size={13} color={hue} />
            <Text style={s.insurerLabel}>INSURER</Text>
            <Text style={s.insurerText} numberOfLines={1}>
              {insurer || 'Not recorded'}
            </Text>
          </View>
          {/* The TPA is often the same organisation as the insurer, and often
              absent. Shown only when it differs — a duplicated line reads as a
              rendering bug rather than as information. */}
          {!!tpa && tpa !== insurer && (
            <View style={[s.insurerLine, { marginTop: 6 }]}>
              <Icon name="business-center" size={13} color={T.muted2} />
              <Text style={s.insurerLabel}>TPA</Text>
              <Text style={s.insurerText} numberOfLines={1}>
                {tpa}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={s.figures}>
        <Figure label="BILLED" value={inr(b.totalamt)} />
        <Figure label="DISCOUNT" value={inr(b.discount)} />
        <Figure label="COLLECTED" value={inr(b.collection)} color="#1E7A5A" />
        <Figure label="DUE" value={inr(due)} alert={due > 0} />
      </View>

      {cashless && (
        <View style={[s.figures, s.figuresSecond]}>
          <Figure label="SETTLED" value={inr(b.receivedamt)} />
          <Figure label="TDS" value={inr(b.actualTDS)} />
          <Figure label="PAYABLE" value={inr(b.payable_amt)} />
          {/* Keeps the three figures on the same 4-column grid as the row
              above — without it they stretch and stop lining up. */}
          <View style={s.fig} />
        </View>
      )}
    </View>
  );
};

export default IPDInvoiceRow;

const s = StyleSheet.create({
  row: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 9,
    overflow: 'hidden',
  },
  rowSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 12 },
  name: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  meta: {
    fontSize: 10.5,
    color: T.muted2,
    marginTop: 3,
    fontFamily: F.regular,
  },
  stayRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  stayCell: { flex: 1 },
  stayLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  stayVal: {
    fontFamily: F.mono,
    fontSize: 11.5,
    color: T.text,
    marginTop: 4,
  },
  // A patient still in hospital is a live state, not a missing value — it gets
  // the section accent rather than the muted grey a dash would carry.
  stayOpen: { color: '#B26A00' },

  insurer: {
    backgroundColor: T.subtle,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 9,
    marginTop: 10,
  },
  insurerLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  insurerLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
    width: 46,
  },
  insurerText: {
    flex: 1,
    fontSize: 11.5,
    color: T.text,
    fontFamily: F.medium,
  },

  figures: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  figuresSecond: { marginTop: 10, paddingTop: 10 },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  figVal: {
    fontFamily: F.mono,
    fontSize: 12,
    color: T.text,
    marginTop: 4,
    letterSpacing: -0.2,
  },
});
