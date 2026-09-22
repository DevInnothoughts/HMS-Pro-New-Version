/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/approval/CallsApprovalSection.js
// ─────────────────────────────────────────────────────────────────────────────
// The calls-and-leads half of the daily sign-off.
// Replaces src/admin/CallAndWebLeadApproval.js.
//
//   GET /approval/callAndWeb?location=&from=<yesterday>&to=<yesterday>
//     → answered_count, missed_count,
//       helpline_answered_count, helpline_missed_count, helpline_outgoing_count,
//       webLeads: { totalLeads, appointmentCount, enquiryCount, webLeads[] },
//       botLeads: { totalLeads, appointmentCount, enquiryCount, botLeads[] },
//       ivrData[], helplineData[]
//
// ⚠️ THE DONUT CHARTS ARE GONE, AND THE 0.01 HACK WITH THEM
// ─────────────────────────────────────────────────────────
// The old screen replaced every zero with 0.01 before charting, "to avoid the
// single dot issue". So a branch with no missed calls drew a hairline of red
// that was not real, and the number under the chart disagreed with the chart
// itself. A donut of two values is a ratio that two numbers state better.
//
// Counts are now read directly. Zero renders as zero.
//
// ⚠️ FOUR MODALS BECAME INLINE EXPANSION
// ──────────────────────────────────────
// Each channel opened a full-screen Portal modal containing its own
// SafeAreaView, ScrollView and back button — four of them, nested inside the
// approval wizard's own ScrollView. Reviewing all four meant eight taps and
// losing your place each time. They expand in place now.
//
// ⚠️ UNATTENDED IS DERIVED, NOT SENT
// ──────────────────────────────────
//     unattended = totalLeads − (appointmentCount + enquiryCount)
// Copied exactly. If a lead ever carries a third status the figure goes
// negative, which is why it is floored at zero and the total is shown beside
// it — a silent negative would be worse than a visible mismatch.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';

import { get } from '../../api/client';
import { F, T, num } from '../../design/tokens';

const ANSWERED = '#1E7A5A';
const MISSED = '#B3382B';
const OUTGOING = '#2F6FA8';
const ENQUIRY = '#B26A00';

const n0 = v => Number(v) || 0;
const digits = p => String(p || '').replace(/\D/g, '');

/** IST wall clock, yesterday — approval signs off the previous day. */
export const getYesterdayIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - 1);
  const p = n => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(
    ist.getUTCDate(),
  )}`;
};

const call = phone => {
  const d = digits(phone);
  if (!d) return Alert.alert('No number', 'This record has no phone number.');
  Linking.openURL(`tel:${d}`);
};

// helplineData.timestamp is epoch millis stored as a STRING — the old screen
// ran it through JSON.parse to coerce it, which throws on anything unexpected.
const fmtEpoch = ts => {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '—';
  const h = d.getHours() % 12 || 12;
  return `${d.getDate()}/${d.getMonth() + 1} · ${h}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
};

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? String(d).slice(0, 10)
    : `${dt.getDate()}/${dt.getMonth() + 1}`;
};

const CallsApprovalSection = () => {
  const location = useSelector(s => s.location.value);
  const date = getYesterdayIST();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await get('/approval/callAndWeb', { location, from: date, to: date }),
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

  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color={T.brand} />
      </View>
    );
  }
  if (error || !data) {
    return <Text style={s.empty}>{error || 'No call data for this day.'}</Text>;
  }

  const web = data.webLeads || {};
  const bot = data.botLeads || {};

  // Floored at zero — see the header.
  const unattended = b =>
    Math.max(
      0,
      n0(b.totalLeads) - (n0(b.appointmentCount) + n0(b.enquiryCount)),
    );

  const channels = [
    {
      key: 'ivr',
      label: 'IVR Calls',
      icon: 'call-received',
      total: n0(data.answered_count) + n0(data.missed_count),
      figures: [
        { label: 'ANSWERED', value: n0(data.answered_count), color: ANSWERED },
        { label: 'MISSED', value: n0(data.missed_count), color: MISSED },
      ],
      rows: data.ivrData || [],
      render: r => (
        <CallRow
          key={r.ivr_id}
          missed={r.call_status === 'Missed'}
          title={r.caller_no}
          sub={
            r.call_status === 'Missed'
              ? 'Missed'
              : `Answered · ${r.call_duration}`
          }
          right={r.call_date}
          note={r.note}
          onCall={() => call(r.caller_no)}
        />
      ),
    },
    {
      key: 'helpline',
      label: 'Helpline Calls',
      icon: 'headset-mic',
      total:
        n0(data.helpline_answered_count) +
        n0(data.helpline_missed_count) +
        n0(data.helpline_outgoing_count),
      figures: [
        {
          label: 'ANSWERED',
          value: n0(data.helpline_answered_count),
          color: ANSWERED,
        },
        {
          label: 'MISSED',
          value: n0(data.helpline_missed_count),
          color: MISSED,
        },
        {
          label: 'OUTGOING',
          value: n0(data.helpline_outgoing_count),
          color: OUTGOING,
        },
      ],
      rows: data.helplineData || [],
      render: r => {
        // UNKNOWN is MISSED, as everywhere else in this codebase.
        const missed = r.type === 'MISSED' || r.type === 'UNKNOWN';
        return (
          <CallRow
            key={r.call_log_id}
            missed={missed}
            outgoing={r.type === 'OUTGOING'}
            title={r.name || r.phoneNumber}
            sub={
              missed
                ? 'Missed'
                : `${r.type === 'OUTGOING' ? 'Outgoing' : 'Answered'} · ${
                    r.duration
                  }s`
            }
            second={r.name ? r.phoneNumber : null}
            right={fmtEpoch(r.timestamp)}
            note={r.note}
            onCall={() => call(r.phoneNumber)}
          />
        );
      },
    },
    {
      key: 'web',
      label: 'Web Leads',
      icon: 'language',
      total: n0(web.totalLeads),
      figures: [
        {
          label: 'APPOINTMENT',
          value: n0(web.appointmentCount),
          color: ANSWERED,
        },
        { label: 'ENQUIRY', value: n0(web.enquiryCount), color: ENQUIRY },
        { label: 'UNATTENDED', value: unattended(web), color: MISSED },
      ],
      rows: web.webLeads || [],
      render: r => <LeadRow key={r.appointment_id} r={r} />,
    },
    {
      key: 'bot',
      label: 'Bot Leads',
      icon: 'smart-toy',
      total: n0(bot.totalLeads),
      figures: [
        {
          label: 'APPOINTMENT',
          value: n0(bot.appointmentCount),
          color: ANSWERED,
        },
        { label: 'ENQUIRY', value: n0(bot.enquiryCount), color: ENQUIRY },
        { label: 'UNATTENDED', value: unattended(bot), color: MISSED },
      ],
      rows: bot.botLeads || [],
      render: r => <LeadRow key={r.appointment_id} r={r} />,
    },
  ];

  return (
    <View style={s.wrap}>
      {channels.map(c => {
        const isOpen = open === c.key;
        return (
          <View key={c.key} style={s.channel}>
            <TouchableOpacity
              style={s.chHead}
              activeOpacity={0.8}
              onPress={() => setOpen(isOpen ? null : c.key)}
              disabled={!c.rows.length}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${c.label}, ${c.total}`}
            >
              <Icon name={c.icon} size={16} color={T.muted} />
              <Text style={s.chLabel}>{c.label}</Text>
              <Text style={s.chTotal}>{num(c.total)}</Text>
              {c.rows.length > 0 && (
                <Icon
                  name={isOpen ? 'expand-less' : 'expand-more'}
                  size={17}
                  color={T.chevron}
                />
              )}
            </TouchableOpacity>

            {/* Two or three plain figures instead of a donut. At 0 answered
                and 0 missed the old chart drew two fake slivers; this reads
                "0 / 0" and means it. */}
            <View style={s.figs}>
              {c.figures.map(f => (
                <View key={f.label} style={s.fig}>
                  <Text style={s.figLabel}>{f.label}</Text>
                  <Text
                    style={[
                      s.figVal,
                      { color: f.value === 0 ? T.chevron : f.color },
                    ]}
                  >
                    {num(f.value)}
                  </Text>
                </View>
              ))}
            </View>

            {isOpen && <View style={s.list}>{c.rows.map(c.render)}</View>}
          </View>
        );
      })}
    </View>
  );
};

/** One call — IVR or helpline; both carry the same shape on screen. */
const CallRow = ({
  missed,
  outgoing,
  title,
  sub,
  second,
  right,
  note,
  onCall,
}) => {
  const hue = missed ? MISSED : outgoing ? OUTGOING : ANSWERED;
  const clean = String(note || '').trim();
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: `${hue}18` }]}>
        <Icon
          name={
            missed ? 'call-missed' : outgoing ? 'call-made' : 'call-received'
          }
          size={14}
          color={hue}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!second && <Text style={s.rowSecond}>{second}</Text>}
        <Text style={[s.rowSub, { color: hue }]}>{sub}</Text>
        {/* The old helpline row painted the WHOLE card amber when a note
            existed, which made the text hard to read. The note itself is the
            signal, so it prints. */}
        {!!clean && <Text style={s.rowNote}>{clean}</Text>}
      </View>

      <Text style={s.rowRight}>{right}</Text>

      <TouchableOpacity
        onPress={onCall}
        style={s.callBtn}
        accessibilityRole="button"
        accessibilityLabel={`Call ${title}`}
      >
        <Icon name="call" size={14} color={T.brand} />
      </TouchableOpacity>
    </View>
  );
};

/** One web or bot lead. Same row shape for both — the payloads match. */
const LeadRow = ({ r }) => {
  const hue =
    r.status === 'Appointment'
      ? ANSWERED
      : r.status === 'Enquiry'
      ? ENQUIRY
      : MISSED;
  const message = String(r.message || '').trim();
  const note = String(r.note || '').trim();

  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: hue }]} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {r.name || 'Name not given'}
        </Text>
        <Text style={s.rowSecond}>{r.phoneno || 'No number'}</Text>
        <Text style={[s.rowSub, { color: hue }]}>
          {r.status || 'Un-attended'}
        </Text>
        {/* 'Null' as a STRING is a real value in this payload — the old screen
            checked for it explicitly. */}
        {!!message && message !== 'Null' && (
          <Text style={s.rowNote}>{message}</Text>
        )}
        {!!note && <Text style={s.rowNote}>FDE: {note}</Text>}
      </View>

      <Text style={s.rowRight}>{fmtDate(r.date)}</Text>

      <TouchableOpacity
        onPress={() => call(r.phoneno)}
        style={s.callBtn}
        accessibilityRole="button"
        accessibilityLabel={`Call ${r.name || r.phoneno}`}
      >
        <Icon name="call" size={14} color={T.brand} />
      </TouchableOpacity>
    </View>
  );
};

export default CallsApprovalSection;

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4 },
  centre: { paddingVertical: 34, alignItems: 'center' },
  empty: { padding: 16, color: T.muted, fontFamily: F.regular, fontSize: 12.5 },

  channel: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  chHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: T.subtle,
  },
  chLabel: { flex: 1, fontSize: 12.5, fontFamily: F.medium, color: T.text },
  chTotal: {
    fontFamily: F.mono,
    fontSize: 15,
    color: T.text,
    letterSpacing: -0.3,
  },

  figs: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  figVal: {
    fontFamily: F.mono,
    fontSize: 16,
    marginTop: 4,
    letterSpacing: -0.3,
  },

  list: { borderTopWidth: 1, borderTopColor: T.lineSoft },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  rowIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 7, height: 7, borderRadius: 2, marginTop: 5 },
  rowTitle: { fontSize: 12.5, fontFamily: F.medium, color: T.text },
  rowSecond: {
    fontFamily: F.mono,
    fontSize: 10.5,
    color: T.text,
    marginTop: 2,
  },
  rowSub: {
    fontFamily: F.mono,
    fontSize: 9.5,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  rowNote: {
    fontSize: 11,
    color: T.muted,
    fontFamily: F.regular,
    marginTop: 5,
    lineHeight: 16,
  },
  rowRight: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 3,
  },
  callBtn: {
    width: 27,
    height: 27,
    borderRadius: 8,
    backgroundColor: '#EAF2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
