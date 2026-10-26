/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/leadStats/TopTerms.js
// ─────────────────────────────────────────────────────────────────────────────
// "Top search terms (utm_term)" — the exact keywords behind Google leads, for
// the Lead Stats Report's Search terms tab. A copy of the component inside
// src/agency/AgencyDashboard.js (locked, not edited), so both screens list
// terms the same way. Input: the /agencyLeads/stats branches (b.terms).
// Tapping a term opens its condition (Piles, Fistula…) in the table above.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { F, T, num } from '../design/tokens';

const n0 = v => Number(v) || 0;

export default function TopTerms({ branches, mode, onPickCondition }) {
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(() => {
    const by = {};
    for (const b of branches) {
      for (const [term, t] of Object.entries(b.terms || {})) {
        const x = (by[term] = by[term] || {
          term,
          condition: t.condition,
          n: 0,
        });
        x.n += n0(t[mode]);
      }
    }
    return Object.values(by)
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || a.term.localeCompare(b.term));
  }, [branches, mode]);

  if (!list.length) return null;
  const shown = showAll ? list : list.slice(0, 12);
  const max = list[0].n;

  return (
    <View style={s.termsCard}>
      <Text style={s.termsTitle}>Top search terms (utm_term)</Text>
      <Text style={s.termsSub}>
        Unique leads by the exact keyword of their latest Google lead
      </Text>
      {shown.map((x, i) => (
        <TouchableOpacity
          key={x.term}
          style={[
            s.termRow,
            i === shown.length - 1 && { borderBottomWidth: 0 },
          ]}
          onPress={() => onPickCondition(x.condition)}
          accessibilityRole="button"
          accessibilityLabel={`${x.term}, ${x.n} leads, ${x.condition}. Show this condition`}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.termText} numberOfLines={1}>
              {x.term}
            </Text>
            <View style={s.termBarTrack}>
              <View
                style={[
                  s.termBar,
                  { width: `${Math.max((x.n / max) * 100, 3)}%` },
                ]}
              />
            </View>
          </View>
          <Text style={s.termCond} numberOfLines={1}>
            {x.condition}
          </Text>
          <Text style={s.termN}>{num(x.n)}</Text>
        </TouchableOpacity>
      ))}
      {list.length > 12 && (
        <TouchableOpacity
          onPress={() => setShowAll(v => !v)}
          style={s.termMore}
        >
          <Text style={s.termMoreText}>
            {showAll ? 'Show top 12' : `Show all ${num(list.length)} terms`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  termsCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingTop: 12,
  },
  termsTitle: {
    fontFamily: F.semibold,
    fontSize: 13,
    color: T.text,
    paddingHorizontal: 12,
  },
  termsSub: {
    fontFamily: F.regular,
    fontSize: 10.5,
    color: T.muted2,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  termText: { fontFamily: F.regular, fontSize: 12, color: T.text },
  termBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 4,
  },
  termBar: { height: 3, borderRadius: 2, backgroundColor: T.brand },
  termCond: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    maxWidth: 90,
  },
  termN: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.text,
    minWidth: 34,
    textAlign: 'right',
  },
  termMore: { paddingVertical: 10, alignItems: 'center' },
  termMoreText: { fontFamily: F.medium, fontSize: 12, color: T.brand },
});
