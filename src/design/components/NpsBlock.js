/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/NpsBlock.js
// ─────────────────────────────────────────────────────────────────────────────
// Net Promoter Score, computed the standard way — the same maths as
// npscalculator.com.
//
//     0–6   detractors
//     7–8   passives  (counted in the denominator, never in the numerator)
//     9–10  promoters
//
//     NPS = %promoters − %detractors        range −100 … +100
//
// ⚠️ THIS IS NOT THE "NPS" ALREADY ON THE HOME SCREEN
// ───────────────────────────────────────────────────
// dashboardModel.nps_avg and NpsPatientList show an AVERAGE STAR RATING out of
// 5. That is a satisfaction score, not a Net Promoter Score, and the two are
// not comparable — 4.2/5 and NPS 62 measure different things on different
// scales. Whichever screen keeps the name, the other should be relabelled, or
// people will read one as the other.
//
// ⚠️ THE MARGIN OF ERROR IS THE POINT
// ───────────────────────────────────
// A branch with 6 responses can show NPS 100 or NPS −33 on one person changing
// their mind. Presented bare, that reads as a trend. The ± makes the difference
// between "this branch is excellent" and "we have six replies" visible.
//
//     SE = √( (p + d) − (p − d)² ) ÷ √n        p, d as proportions
//     ±  = 1.96 × SE × 100                     95% confidence
//
// With a known population (operated patients, say) the finite-population
// correction narrows it — surveying 40 of 45 leaves little room for error,
// and without the correction the interval would overstate the doubt.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet, Text, View } from 'react-native';
import { F, T } from '../tokens';

const PROMOTER = '#1E7A5A';
const PASSIVE = '#B26A00';
const DETRACTOR = '#8A6F4A'; // bronze, not red — a detractor is feedback, not a fault

/**
 * Bands, NPS and confidence from a 0–10 distribution.
 *
 * @param counts   array of 11 counts, index = score. Missing entries are 0.
 * @param population how many COULD have responded, for the correction. Omit
 *                   when unknown — the interval is then the uncorrected one.
 */
export const computeNps = (counts = [], population = null) => {
  const c = Array.from({ length: 11 }, (_, i) => Number(counts[i]) || 0);
  const n = c.reduce((a, b) => a + b, 0);
  if (n === 0) return null;

  const detractors = c.slice(0, 7).reduce((a, b) => a + b, 0);
  const passives = c[7] + c[8];
  const promoters = c[9] + c[10];

  const p = promoters / n;
  const d = detractors / n;
  const nps = (p - d) * 100;

  // Variance of (promoter − detractor) as a single random variable.
  const variance = p + d - Math.pow(p - d, 2);
  let se = Math.sqrt(Math.max(variance, 0) / n);

  // Finite population correction — surveying most of a small population
  // genuinely leaves less room for error.
  if (population && population > n && population > 1) {
    se *= Math.sqrt((population - n) / (population - 1));
  }

  return {
    n,
    population,
    detractors,
    passives,
    promoters,
    detractorPct: d * 100,
    passivePct: (passives / n) * 100,
    promoterPct: p * 100,
    nps,
    margin: 1.96 * se * 100, // 95%
    counts: c,
  };
};

/** NPS bands, as the industry reads them. −100…+100, so 0 is not the floor. */
export const npsColor = v =>
  v == null ? T.muted2 : v >= 50 ? PROMOTER : v >= 0 ? PASSIVE : DETRACTOR;

const pct = v => `${Math.round(v)}%`;

/**
 * The full block: headline NPS with its confidence interval, a proportional
 * bar, and the three bands with counts.
 *
 * @param compact drops the band rows — for a summary card where the headline
 *                and the bar are enough.
 */
export const NpsBlock = ({ data, compact, note }) => {
  if (!data) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>No responses yet.</Text>
      </View>
    );
  }

  const hue = npsColor(data.nps);
  // A ± wider than the score itself means the number is not yet saying
  // anything — worth stating rather than leaving to be inferred.
  const unreliable = data.margin >= Math.abs(data.nps) && data.n < 30;

  return (
    <View style={s.wrap}>
      <View style={s.headline}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>NET PROMOTER SCORE</Text>
          <View style={s.scoreRow}>
            <Text style={[s.score, { color: hue }]}>
              {data.nps > 0 ? '+' : ''}
              {Math.round(data.nps)}
            </Text>
            <Text style={s.margin}>± {Math.round(data.margin)}</Text>
          </View>
        </View>
        <View style={s.nBox}>
          <Text style={s.nVal}>{data.n}</Text>
          <Text style={s.nLabel}>
            {data.population ? `of ${data.population}` : 'responses'}
          </Text>
        </View>
      </View>

      {/* Proportional, and always full width — the three bands are shares of
          one whole, which is exactly what a stacked bar is for. */}
      <View style={s.bar}>
        <View
          style={{ width: `${data.detractorPct}%`, backgroundColor: DETRACTOR }}
        />
        <View
          style={{ width: `${data.passivePct}%`, backgroundColor: PASSIVE }}
        />
        <View
          style={{ width: `${data.promoterPct}%`, backgroundColor: PROMOTER }}
        />
      </View>

      {!compact && (
        <View style={s.bands}>
          <Band
            label="Detractors"
            sub="0–6"
            count={data.detractors}
            pct={data.detractorPct}
            color={DETRACTOR}
          />
          <Band
            label="Passives"
            sub="7–8"
            count={data.passives}
            pct={data.passivePct}
            color={PASSIVE}
          />
          <Band
            label="Promoters"
            sub="9–10"
            count={data.promoters}
            pct={data.promoterPct}
            color={PROMOTER}
          />
        </View>
      )}

      {unreliable && (
        <Text style={s.warn}>
          Too few responses to read as a trend — the margin is wider than the
          score.
        </Text>
      )}
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

const Band = ({ label, sub, count, pct: p, color }) => (
  <View style={s.band}>
    <View style={s.bandTop}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.bandLabel}>{label}</Text>
      <Text style={s.bandSub}>{sub}</Text>
    </View>
    <Text style={[s.bandPct, { color }]}>{pct(p)}</Text>
    <Text style={s.bandCount}>{count}</Text>
  </View>
);

export default NpsBlock;

const s = StyleSheet.create({
  wrap: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 14,
  },
  empty: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  emptyText: { fontSize: 12.5, color: T.muted, fontFamily: F.regular },

  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: { fontFamily: F.mono, fontSize: 8, letterSpacing: 1, color: T.muted },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 5,
  },
  score: { fontFamily: F.mono, fontSize: 30, letterSpacing: -1 },
  margin: { fontFamily: F.mono, fontSize: 12, color: T.muted2 },
  nBox: { alignItems: 'flex-end' },
  nVal: { fontFamily: F.mono, fontSize: 17, color: T.text },
  nLabel: { fontFamily: F.mono, fontSize: 8.5, color: T.muted2, marginTop: 3 },

  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: T.lineSoft,
    overflow: 'hidden',
    marginTop: 13,
  },

  bands: { flexDirection: 'row', gap: 10, marginTop: 13 },
  band: { flex: 1 },
  bandTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  bandLabel: { fontSize: 10.5, color: T.text, fontFamily: F.regular },
  bandSub: { fontFamily: F.mono, fontSize: 8, color: T.muted2 },
  bandPct: {
    fontFamily: F.mono,
    fontSize: 15,
    marginTop: 5,
    letterSpacing: -0.3,
  },
  bandCount: { fontFamily: F.mono, fontSize: 9, color: T.muted2, marginTop: 2 },

  warn: {
    fontSize: 10,
    color: PASSIVE,
    marginTop: 11,
    fontFamily: F.regular,
    lineHeight: 15,
  },
  note: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 9,
    fontFamily: F.regular,
    lineHeight: 15,
  },
});
