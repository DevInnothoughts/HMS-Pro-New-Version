/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/approval/IpdApprovalSection.js
// ─────────────────────────────────────────────────────────────────────────────
// The IPD half of the daily sign-off. Replaces src/admin/IPDApproval.js.
//
//   GET /approval/ipdReport?location=&from=<yesterday>&to=<yesterday>
//     → { ipdBills:      [{ patient_id, name, phone, status,
//                           totalamt, discount, payable_amt }],
//         ipdCollection: [{ patient_id, name, receipt_date, status,
//                           cashamt, cardamt, onlineamt, chequeamt,
//                           discountamt, tdsamt }] }
//
// ⚠️ THE COLLECTION TOTAL INCLUDES BOTH DISCOUNTS — UNCHANGED
// ───────────────────────────────────────────────────────────
// The old header computed:
//     total = cash + card + online + cheque + discountamt + tdsamt
//
// Discounts are money NOT received, so adding them to a collection total is
// almost certainly wrong — it inflates the figure by whatever was waived. But
// this is the number the branch has been signing off against, and a redesign
// is not the place to silently change it.
//
// So the headline is identical, and the two discount figures are labelled and
// shown separately beneath it with a note. The gap is visible instead of
// invisible. Fix it deliberately, or not at all.
//
// ⚠️ COLUMN NAMES DO NOT MEAN WHAT THEY SAY
// ─────────────────────────────────────────
//     discountamt → INTERNAL discount
//     tdsamt      → HOSPITAL discount  (NOT TDS)
// The old screen labelled them correctly; the column names do not. Same trap
// as the IPD Collection screen.
//
// ⚠️ EMBEDDED, NOT A SCREEN
// ─────────────────────────
// The old file nested TWO ScrollViews (each `height: '70%'`) and a Portal
// dialog inside the wizard's own ScrollView, so the two lists scrolled
// independently of the page and clipped at 70% of it. This is a plain View
// that scrolls with its parent.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../../api/client';
import { F, T, inr, num } from '../../design/tokens';

const BILLS = '#B3523B';
const COLLECTED = '#1E7A5A';
const DISCOUNT = '#B26A00';

const n0 = v => Number(v) || 0;

/** IST wall clock, yesterday — approval signs off the previous day. */
export const getYesterdayIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - 1);
  const p = n => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(
    ist.getUTCDate(),
  )}`;
};

const initials = name =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

const IpdApprovalSection = () => {
  const location = useSelector(s => s.location.value);
  const date = getYesterdayIST();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // 'bills' | 'collection' | null
  const [row, setRow] = useState(null); // expanded patient_id

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await get('/approval/ipdReport', { location, from: date, to: date }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [location, date]);

  useEffect(() => {
    load();
  }, [load]);

  const bills = data?.ipdBills || [];
  const collection = data?.ipdCollection || [];

  const billTotals = useMemo(
    () =>
      bills.reduce(
        (a, b) => ({
          total: a.total + n0(b.totalamt),
          discount: a.discount + n0(b.discount),
          payable: a.payable + n0(b.payable_amt),
        }),
        { total: 0, discount: 0, payable: 0 },
      ),
    [bills],
  );

  const colTotals = useMemo(() => {
    const t = collection.reduce(
      (a, c) => ({
        cash: a.cash + n0(c.cashamt),
        card: a.card + n0(c.cardamt),
        online: a.online + n0(c.onlineamt),
        cheque: a.cheque + n0(c.chequeamt),
        internal: a.internal + n0(c.discountamt),
        hospital: a.hospital + n0(c.tdsamt),
      }),
      { cash: 0, card: 0, online: 0, cheque: 0, internal: 0, hospital: 0 },
    );
    return {
      ...t,
      received: t.cash + t.card + t.online + t.cheque,
      // The old screen's headline, discounts included. See the header note.
      headline: t.cash + t.card + t.online + t.cheque + t.internal + t.hospital,
    };
  }, [collection]);

  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color={BILLS} />
      </View>
    );
  }
  if (error || !data) {
    return <Text style={s.empty}>{error || 'No IPD data for this day.'}</Text>;
  }

  return (
    <View style={s.wrap}>
      {/* ── Bills raised ── */}
      <Group
        label="Bills raised"
        icon="receipt-long"
        total={billTotals.total}
        count={bills.length}
        hue={BILLS}
        isOpen={open === 'bills'}
        onToggle={() => setOpen(open === 'bills' ? null : 'bills')}
        figures={[
          { label: 'BILLED', value: billTotals.total },
          { label: 'DISCOUNT', value: billTotals.discount, color: DISCOUNT },
          { label: 'PAYABLE', value: billTotals.payable },
        ]}
      >
        {bills.map(b => (
          <PatientRow
            key={`b-${b.patient_id}`}
            hue={BILLS}
            name={b.name}
            amount={n0(b.totalamt)}
            meta={[b.phone, b.status].filter(Boolean).join(' · ')}
            open={row === `b-${b.patient_id}`}
            onToggle={() =>
              setRow(row === `b-${b.patient_id}` ? null : `b-${b.patient_id}`)
            }
            figures={[
              { label: 'BILLED', value: n0(b.totalamt) },
              { label: 'DISCOUNT', value: n0(b.discount) },
              { label: 'PAYABLE', value: n0(b.payable_amt) },
            ]}
          />
        ))}
      </Group>

      {/* ── Collection ── */}
      <Group
        label="Collection"
        icon="payments"
        total={colTotals.headline}
        count={collection.length}
        hue={COLLECTED}
        isOpen={open === 'collection'}
        onToggle={() => setOpen(open === 'collection' ? null : 'collection')}
        figures={[
          { label: 'CASH', value: colTotals.cash },
          { label: 'CARD', value: colTotals.card },
          { label: 'ONLINE', value: colTotals.online },
          { label: 'CHEQUE', value: colTotals.cheque },
        ]}
        figures2={[
          { label: 'RECEIVED', value: colTotals.received, color: COLLECTED },
          { label: 'INT DSCNT', value: colTotals.internal, color: DISCOUNT },
          { label: 'HOSP DSCNT', value: colTotals.hospital, color: DISCOUNT },
        ]}
        note={
          colTotals.internal + colTotals.hospital > 0
            ? `The total above includes ${inr(
                colTotals.internal + colTotals.hospital,
              )} of discount, matching the existing report. Money actually received is ${inr(
                colTotals.received,
              )}.`
            : null
        }
      >
        {collection.map(c => {
          const received =
            n0(c.cashamt) + n0(c.cardamt) + n0(c.onlineamt) + n0(c.chequeamt);
          return (
            <PatientRow
              key={`c-${c.patient_id}`}
              hue={COLLECTED}
              name={c.name}
              amount={received}
              meta={[
                c.receipt_date
                  ? new Date(c.receipt_date).toLocaleDateString('en-GB')
                  : null,
                c.status,
              ]
                .filter(Boolean)
                .join(' · ')}
              open={row === `c-${c.patient_id}`}
              onToggle={() =>
                setRow(row === `c-${c.patient_id}` ? null : `c-${c.patient_id}`)
              }
              figures={[
                { label: 'CASH', value: n0(c.cashamt) },
                { label: 'CARD', value: n0(c.cardamt) },
                { label: 'ONLINE', value: n0(c.onlineamt) },
                { label: 'CHEQUE', value: n0(c.chequeamt) },
              ]}
              figures2={[
                { label: 'INT DSCNT', value: n0(c.discountamt) },
                { label: 'HOSP DSCNT', value: n0(c.tdsamt) },
              ]}
            />
          );
        })}
      </Group>
    </View>
  );
};

const Fig = ({ label, value, color }) => (
  <View style={s.fig}>
    <Text style={s.figLabel}>{label}</Text>
    <Text
      style={[
        s.figVal,
        !value && { color: T.chevron },
        color && value ? { color } : null,
      ]}
    >
      {inr(value)}
    </Text>
  </View>
);

const Group = ({
  label,
  icon,
  total,
  count,
  hue,
  figures,
  figures2,
  note,
  isOpen,
  onToggle,
  children,
}) => (
  <View style={s.group}>
    <TouchableOpacity
      style={s.gHead}
      activeOpacity={0.8}
      onPress={onToggle}
      disabled={!count}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      accessibilityLabel={`${label}, ${inr(total)}, ${count} patients`}
    >
      <Icon name={icon} size={16} color={hue} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.gLabel}>{label}</Text>
        <Text style={s.gCount}>
          {num(count)} patient{count === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={[s.gTotal, { color: hue }]}>{inr(total)}</Text>
      {!!count && (
        <Icon
          name={isOpen ? 'expand-less' : 'expand-more'}
          size={17}
          color={T.chevron}
        />
      )}
    </TouchableOpacity>

    {/* Totals ALWAYS visible. The old screen hid them behind a chevron, so the
        headline was the only figure on screen until you tapped — and the
        headline is the one number that needs context. */}
    <View style={s.figs}>
      {figures.map(f => (
        <Fig key={f.label} {...f} />
      ))}
    </View>
    {!!figures2 && (
      <View style={[s.figs, s.figs2]}>
        {figures2.map(f => (
          <Fig key={f.label} {...f} />
        ))}
      </View>
    )}

    {!!note && <Text style={s.note}>{note}</Text>}

    {isOpen && <View style={s.list}>{children}</View>}
  </View>
);

const PatientRow = ({
  hue,
  name,
  amount,
  meta,
  figures,
  figures2,
  open,
  onToggle,
}) => (
  <View style={s.row}>
    <TouchableOpacity
      style={s.rowHead}
      activeOpacity={0.8}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${name}, ${inr(amount)}`}
    >
      <View style={[s.avatar, { backgroundColor: `${hue}18` }]}>
        <Text style={[s.avatarText, { color: hue }]}>{initials(name)}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1}>
          {name || 'Unnamed'}
        </Text>
        {!!meta && (
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <Text style={s.amount}>{inr(amount)}</Text>
      <Icon
        name={open ? 'expand-less' : 'expand-more'}
        size={16}
        color={T.chevron}
      />
    </TouchableOpacity>

    {open && (
      <View style={s.rowDetail}>
        <View style={s.figs}>
          {figures.map(f => (
            <Fig key={f.label} {...f} />
          ))}
        </View>
        {!!figures2 && (
          <View style={[s.figs, s.figs2]}>
            {figures2.map(f => (
              <Fig key={f.label} {...f} />
            ))}
          </View>
        )}
      </View>
    )}
  </View>
);

export default IpdApprovalSection;

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4 },
  centre: { paddingVertical: 34, alignItems: 'center' },
  empty: { padding: 16, color: T.muted, fontFamily: F.regular, fontSize: 12.5 },

  group: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  gHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: T.subtle,
  },
  gLabel: { fontSize: 12.5, fontFamily: F.medium, color: T.text },
  gCount: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 2,
    fontFamily: F.regular,
  },
  gTotal: { fontFamily: F.mono, fontSize: 15, letterSpacing: -0.3 },

  figs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 11,
  },
  figs2: { paddingTop: 9, paddingBottom: 11 },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  figVal: {
    fontFamily: F.mono,
    fontSize: 11.5,
    color: T.text,
    marginTop: 4,
    letterSpacing: -0.2,
  },

  note: {
    fontSize: 10,
    color: T.muted2,
    fontFamily: F.regular,
    lineHeight: 15,
    paddingHorizontal: 12,
    paddingBottom: 11,
  },

  list: { borderTopWidth: 1, borderTopColor: T.lineSoft },

  row: { borderBottomWidth: 1, borderBottomColor: T.lineSoft },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.semibold, fontSize: 10.5 },
  name: { fontSize: 12.5, fontFamily: F.medium, color: T.text },
  meta: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2, marginTop: 2 },
  amount: { fontFamily: F.mono, fontSize: 12.5, color: T.text },

  rowDetail: { paddingBottom: 4, backgroundColor: T.subtle },
});
