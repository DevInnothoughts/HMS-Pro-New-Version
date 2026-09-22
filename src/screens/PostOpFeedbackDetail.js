/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/PostOpFeedbackDetail.js
// ─────────────────────────────────────────────────────────────────────────────
// One post-op call, in full. Replaces the modal the old NpsPatientList used.
//
// A screen rather than a modal, so it matches IPDFeedbackDetail — the two
// feedback flows in the Performance section should behave the same way, and a
// modal cannot be shared, deep-linked or backed out of consistently.
//
// The questions here come from the call script, not a fixed form, so the keys
// are free text and vary. They are rendered in whatever order the API returns
// rather than being mapped to a known list — a renamed question then shows its
// new wording instead of disappearing.
// ─────────────────────────────────────────────────────────────────────────────

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import SectionHeader from '../design/components/SectionHeader';
import { F, HUE, T, dec1 } from '../design/tokens';

const HUE_P = HUE.performance;

const BANDS = {
  strong: { label: 'Strong', color: '#1E7A5A' },
  mixed: { label: 'Mixed', color: '#B26A00' },
  weak: { label: 'Needs attention', color: '#B3382B' },
};

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
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
  return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`;
};

const PostOpFeedbackDetail = ({ navigation, route }) => {
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

  const b = p.band ? BANDS[p.band] : null;
  const answers = Object.entries(p.answers || {});

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionHeader
          code="POST-OP"
          name={p.name || 'Patient'}
          sub={`${p.phone || '—'} · discharged ${fmtDate(p.discharge)}`}
          hue={HUE_P}
          hideScope
          onBack={() => navigation.goBack()}
        />

        <View style={st.scoreRow}>
          <View style={st.scoreCard}>
            <Text style={st.eyebrow}>AVERAGE RATING</Text>
            <View style={st.scoreLine}>
              <Text style={[st.scoreBig, { color: b ? b.color : T.text }]}>
                {p.avg == null ? '—' : dec1(p.avg)}
              </Text>
              <Text style={st.scoreOf}>/ 5</Text>
            </View>
            {!!b && (
              <View style={[st.badge, { backgroundColor: b.color }]}>
                <Text style={st.badgeText}>{b.label.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={st.scoreCard}>
            <Text style={st.eyebrow}>QUESTIONS ANSWERED</Text>
            <View style={st.scoreLine}>
              <Text style={[st.scoreBig, { color: T.text }]}>
                {answers.length}
              </Text>
            </View>
            <Text style={st.scoreNote}>
              {p.feedback ? 'Comment left' : 'No comment left'}
            </Text>
          </View>
        </View>

        <View style={st.body}>
          <View style={st.card}>
            <Fact label="Admitted" value={fmtDate(p.admission)} />
            <Fact label="Discharged" value={fmtDate(p.discharge)} />
            <Fact label="Phone" value={p.phone} last />
          </View>

          {answers.length > 0 && (
            <View style={st.group}>
              <Text style={st.groupTitle}>Call responses</Text>
              <View style={st.card}>
                {answers.map(([question, score], i) => (
                  <RatingRow
                    key={question}
                    label={question}
                    value={Number(score)}
                    last={i === answers.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={st.group}>
            <Text style={st.groupTitle}>Patient’s comment</Text>
            <View style={[st.card, st.quoteCard]}>
              {p.feedback ? (
                <Text style={st.quote}>“{p.feedback}”</Text>
              ) : (
                <Text style={st.noQuote}>
                  No comment was recorded on this call.
                </Text>
              )}
            </View>
          </View>

          <Text style={st.footnote}>
            Each question is rated 1 to 5 on the follow-up call. This is a call
            score, not the Net Promoter Score — that is on the Patient Feedback
            screen and comes from a separate 0–10 question.
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

const RatingRow = ({ label, value, last }) => {
  const v = Number.isFinite(value) ? value : null;
  return (
    <View style={[st.ratingRow, last && { borderBottomWidth: 0 }]}>
      {/* Call questions are full sentences, so they wrap to three lines rather
          than being truncated — the wording is the context. */}
      <Text style={st.ratingLabel} numberOfLines={3}>
        {label}
      </Text>
      <View style={st.stars}>
        {[1, 2, 3, 4, 5].map(i => (
          <Icon
            key={i}
            name={v != null && i <= v ? 'star' : 'star-border'}
            size={15}
            color={v != null && i <= v ? '#E0A93B' : T.chevron}
          />
        ))}
      </View>
      <Text style={st.ratingVal}>{v == null ? '—' : v}</Text>
    </View>
  );
};

export default PostOpFeedbackDetail;

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
    marginBottom: 9,
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
    lineHeight: 17,
  },
  stars: { flexDirection: 'row', gap: 1 },
  ratingVal: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    width: 16,
    textAlign: 'right',
  },

  quoteCard: { paddingVertical: 14 },
  quote: {
    fontSize: 13,
    color: T.text,
    fontStyle: 'italic',
    lineHeight: 20,
    fontFamily: F.regular,
  },
  noQuote: { fontSize: 12.5, color: T.muted, fontFamily: F.regular },

  footnote: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 20,
    fontFamily: F.regular,
    lineHeight: 15,
  },
});
