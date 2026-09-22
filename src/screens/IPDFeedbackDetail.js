/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/IPDFeedbackDetail.js
// ─────────────────────────────────────────────────────────────────────────────
// One patient's full response, laid out in the same three groups as the form
// they filled in — Facility, Healing Team, Ease and Transparency — so a
// question on the screen can be matched to a question on the form without
// translation.
//
// The two headline numbers are shown with their arithmetic spelled out
// ("43 of 50") rather than as bare percentages, because both have been
// mislabelled in the stored data and anyone checking the screen against the
// raw JSON needs to see which numbers produced the result.
//
// Ratings render as filled stars, matching the 5★–1★ scale of the form. A bar
// would be more compact but would silently reinterpret a discrete 1–5 choice
// as a continuous measure.
// ─────────────────────────────────────────────────────────────────────────────

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T } from '../design/tokens';

const BAND = {
  promoter: { label: 'Promoter', color: '#1E7A5A' },
  passive: { label: 'Passive', color: '#B3762B' },
  detractor: { label: 'Detractor', color: '#B3382B' },
};

const HUE_P = HUE.performance;

const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  const M = [
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
  return m ? `${Number(day)} ${M[Number(m) - 1]} ${y}` : s;
};

const IPDFeedbackDetail = ({ navigation, route }) => {
  const p = route?.params?.patient;

  if (!p) {
    return (
      <SafeAreaView style={st.screen} edges={['top']}>
        <View style={st.centre}>
          <Text style={st.missing}>That response isn’t available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const b = p.band ? BAND[p.band] : null;

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionHeader
          code="FEEDBACK"
          name={p.name || 'Patient'}
          sub={`${p.uidNo || '—'} · surgery ${fmtDate(p.surgeryDate)}`}
          hue={HUE_P}
          onBack={() => navigation.goBack()}
        />
        {/* Headline scores */}
        <View style={st.scoreRow}>
          <View style={st.scoreCard}>
            <Text style={st.eyebrow}>WOULD RECOMMEND</Text>
            <View style={st.scoreLine}>
              <Text style={[st.scoreBig, { color: b ? b.color : T.text }]}>
                {p.recommendScore ?? '—'}
              </Text>
              <Text style={st.scoreOf}>/ 10</Text>
            </View>
            {!!b && (
              <View style={[st.badge, { backgroundColor: b.color }]}>
                <Text style={st.badgeText}>{b.label.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={st.scoreCard}>
            <Text style={st.eyebrow}>SATISFACTION INDEX</Text>
            <View style={st.scoreLine}>
              <Text style={[st.scoreBig, { color: T.text }]}>
                {p.psiPct == null ? '—' : p.psiPct}
              </Text>
              <Text style={st.scoreOf}>%</Text>
            </View>
            <Text style={st.scoreNote}>
              {p.totalScoreAchieved ?? '—'} of {p.maxPossibleScore ?? '—'}{' '}
              points
            </Text>
          </View>
        </View>

        {/* Patient particulars */}
        <View style={st.body}>
          <View style={st.card}>
            <Fact label="Surgeon" value={p.surgeon} />
            <Fact label="Room type" value={p.roomType} />
            <Fact label="Admitted" value={fmtDate(p.admDate)} />
            <Fact
              label="Age / Sex"
              value={[p.age, p.sex].filter(Boolean).join(' · ') || null}
            />
            <Fact label="Phone" value={p.phone} last />
          </View>

          {/* The response, group by group */}
          {(p.answers || []).map(group => (
            <View key={group.key} style={st.group}>
              <Text style={st.groupTitle}>{group.title}</Text>
              {!!group.subtitle && (
                <Text style={st.groupSub}>{group.subtitle}</Text>
              )}
              <View style={st.card}>
                {group.items.map((item, i) => (
                  <RatingRow
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    last={i === group.items.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text style={st.footnote}>
            Each question is rated 1 to 5. The satisfaction index is the total
            awarded divided by the maximum possible, as a percentage.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Fact = ({ label, value, last }) => (
  <View style={[st.factRow, last && { borderBottomWidth: 0 }]}>
    <Text style={st.factLabel}>{label}</Text>
    <Text style={st.factValue} numberOfLines={1}>
      {value || '—'}
    </Text>
  </View>
);

const RatingRow = ({ label, value, last }) => (
  <View style={[st.ratingRow, last && { borderBottomWidth: 0 }]}>
    <Text style={st.ratingLabel} numberOfLines={2}>
      {label}
    </Text>
    <View style={st.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <Icon
          key={i}
          name={value != null && i <= value ? 'star' : 'star-border'}
          size={15}
          color={value != null && i <= value ? '#E0A93B' : T.chevron}
        />
      ))}
    </View>
    <Text style={st.ratingVal}>{value == null ? '—' : value}</Text>
  </View>
);

export default IPDFeedbackDetail;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missing: { fontFamily: F.regular, fontSize: 14, color: T.muted },
  body: { paddingHorizontal: 16, paddingTop: 20 },

  scoreRow: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    marginTop: -30,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  eyebrow: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
  },
  scoreBig: { fontFamily: F.mono, fontSize: 28, letterSpacing: -0.8 },
  scoreOf: { fontFamily: F.mono, fontSize: 12, color: T.muted2 },
  scoreNote: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 8,
    fontFamily: F.regular,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 9,
  },
  badgeText: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: '#fff',
  },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },

  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  factLabel: { fontSize: 12, color: T.muted, fontFamily: F.regular },
  factValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12.5,
    color: T.text,
    fontFamily: F.medium,
  },

  group: { marginTop: 22 },
  groupTitle: {
    fontSize: 13.5,
    fontFamily: F.semibold,
    color: T.text,
    marginBottom: 2,
  },
  groupSub: {
    fontSize: 10.5,
    color: T.muted2,
    marginBottom: 9,
    fontFamily: F.regular,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  ratingLabel: {
    flex: 1,
    fontSize: 12.5,
    color: T.text,
    fontFamily: F.regular,
  },
  stars: { flexDirection: 'row', gap: 1 },
  ratingVal: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    width: 16,
    textAlign: 'right',
  },

  footnote: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 20,
    fontFamily: F.regular,
    lineHeight: 15,
  },
});
