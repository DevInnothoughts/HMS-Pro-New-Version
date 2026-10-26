/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/agency/AgencyGroupTable.js
// ─────────────────────────────────────────────────────────────────────────────
// Group → branch lead table for the Ad Agency dashboard. A copy of the internal
// screen's LeadCityTable (src/adAgency/LeadCityTable.js — locked, not edited)
// with the first column made generic, so the same table shows:
//
//   CAMPAIGN → branches     (utm_campaign)
//   TERM     → branches     (utm_term rolled up into conditions)
//
// Everything else is the same "Option A" table as Branch Summary: frozen name
// column, figures scroll sideways, fixed row heights, zebra rows, an open
// group's branches inline with a dot against the group's best, tap a heading
// to sort (again to reverse), a single-branch group opens that branch.
//
// Props on top of LeadCityTable's: groupLabel ('CAMPAIGN' | 'TERM'),
// totalLabel, and a `sub` line per group (e.g. the campaign id under its name).
// ─────────────────────────────────────────────────────────────────────────────

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { F, T, num, tint } from '../design/tokens';

// Same three tones as Branch Summary — no red in a comparison view.
const GOOD = '#1E7A5A';
const MID = '#B26A00';
const LOW = '#8A6F4A';

export const LEAD_COLS = [
  { key: 'total', head: 'UNIQUE', w: 64, spoken: 'unique leads' },
  { key: 'duplicates', head: 'DUP', w: 52, spoken: 'duplicates' },
  { key: 'appointment', head: 'BOOKED', w: 64, spoken: 'booked' },
  { key: 'notBooked', head: 'NOT BKD', w: 66, spoken: 'not booked' },
  { key: 'actualVisitCount', head: 'VISITED', w: 64, spoken: 'visited' },
  { key: 'ipd', head: 'IPD', w: 50, spoken: 'IPD' },
  {
    key: 'bookedPct',
    head: 'BKD %',
    w: 58,
    spoken: 'booked percent',
    pct: true,
  },
];

// Wider than the city table's 112: campaign names / ids are longer.
const FROZEN_W = 128;
const ROW_H = { head: 34, city: 40, branch: 34, total: 38 };

const fmt = (v, c) => (v == null ? '—' : c.pct ? `${v}%` : num(v));

const spokenRow = (name, x) =>
  `${name}. ` +
  LEAD_COLS.map(c => `${c.spoken} ${fmt(x[c.key], c)}`).join(', ');

const rowBg = l =>
  l.kind === 'branch'
    ? '#F7F9F8'
    : l.kind === 'total'
    ? T.canvas
    : l.open
    ? tint(T.brand)
    : l.zebra
    ? T.subtle
    : T.card;

const Cells = ({ x, sortKey, kind }) =>
  LEAD_COLS.map(c => {
    const on = sortKey === c.key;
    const v = x[c.key];
    return (
      <View key={c.key} style={[st.tCell, { width: c.w }, on && st.tCellOn]}>
        <Text
          style={[
            st.tNum,
            kind === 'branch' && st.tNumSmall,
            (kind === 'total' || on) && st.tNumBold,
            on && st.tNumOn,
            c.key === 'duplicates' && v > 0 && st.tNumDup,
            v == null && st.tNumNone,
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.15}
        >
          {fmt(v, c)}
        </Text>
      </View>
    );
  });

export default function AgencyGroupTable({
  groups, // [{ name, sub?, branches: [{ location, partial, ...x }], ...x }]
  groupLabel = 'CAMPAIGN',
  totalLabel = 'All campaigns',
  totalX,
  sortKey,
  sortDir = 'desc', // 'desc' | 'asc'
  onSort,
  openCity,
  onToggleCity,
  onOpenBranch,
  minWidth,
}) {
  const lines = [];
  groups.forEach((c, i) => {
    const multi = c.branches.length > 1;
    const open = multi && openCity === c.name;
    lines.push({
      kind: 'city',
      key: `c:${c.name}`,
      rank: i + 1,
      name: c.name,
      meta: [
        c.sub,
        multi ? `${c.branches.length} branches` : c.branches[0]?.location,
      ]
        .filter(Boolean)
        .join(' · '),
      warn: !multi && c.branches[0]?.partial,
      x: c,
      multi,
      open,
      zebra: i % 2 === 1,
      onPress: multi
        ? () => onToggleCity(c.name)
        : () => onOpenBranch(c.branches[0].location),
      a11y: `${spokenRow(c.name, c)}${
        multi ? `. ${c.branches.length} branches` : '. Open lead list'
      }`,
    });
    if (open) {
      const best = Math.max(...c.branches.map(b => Number(b[sortKey]) || 0), 1);
      c.branches.forEach(b => {
        const v = b[sortKey];
        const share = v == null ? null : ((Number(v) || 0) / best) * 100;
        lines.push({
          kind: 'branch',
          key: `b:${b.location}`,
          name: b.location,
          warn: b.partial,
          x: b,
          hue:
            share == null
              ? T.muted2
              : share >= 70
              ? GOOD
              : share >= 40
              ? MID
              : LOW,
          onPress: () => onOpenBranch(b.location),
          a11y: `${spokenRow(b.location, b)}${
            b.partial ? '. Partial' : ''
          }. Open lead list`,
        });
      });
    }
  });
  if (totalX) {
    lines.push({ kind: 'total', key: 'total', name: totalLabel, x: totalX });
  }

  const figuresW = LEAD_COLS.reduce((a, c) => a + c.w, 0);

  return (
    <View style={st.table}>
      <View style={st.tBody}>
        {/* ── Frozen: # and city ── */}
        <View style={st.frozen}>
          <View style={[st.leftRow, st.tHead, { height: ROW_H.head }]}>
            <Text style={[st.tHeadText, st.tRank]}>#</Text>
            <Text style={st.tHeadText}>{groupLabel}</Text>
          </View>
          {lines.map(l => {
            const Row = l.onPress ? TouchableOpacity : View;
            return (
              <Row
                key={l.key}
                style={[
                  st.leftRow,
                  { height: ROW_H[l.kind], backgroundColor: rowBg(l) },
                ]}
                activeOpacity={0.7}
                onPress={l.onPress}
                accessibilityRole={l.onPress ? 'button' : undefined}
                accessibilityState={l.multi ? { expanded: l.open } : undefined}
                accessibilityLabel={l.a11y}
              >
                {l.kind === 'branch' ? (
                  <View style={st.tRank}>
                    <View style={[st.dot, { backgroundColor: l.hue }]} />
                  </View>
                ) : (
                  <Text style={st.tRank}>{l.rank || ''}</Text>
                )}
                <View style={st.tName}>
                  <Text
                    style={[
                      l.kind === 'branch'
                        ? st.branchName
                        : l.kind === 'total'
                        ? st.tTotalName
                        : st.cityName,
                      l.warn && { color: T.crit },
                    ]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1}
                  >
                    {l.name}
                  </Text>
                  {!!l.meta && (
                    <Text
                      style={[st.cityMeta, l.warn && { color: T.crit }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1}
                    >
                      {l.meta}
                    </Text>
                  )}
                </View>
                {l.kind !== 'total' && (
                  <Icon
                    name={
                      l.multi
                        ? l.open
                          ? 'expand-less'
                          : 'expand-more'
                        : 'chevron-right'
                    }
                    size={l.kind === 'branch' ? 12 : 14}
                    color={T.chevron}
                  />
                )}
              </Row>
            );
          })}
        </View>

        {/* ── Scrolling: the figures ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={st.figures}
        >
          <View
            style={{ minWidth: Math.max(figuresW, minWidth - FROZEN_W - 2) }}
          >
            <View style={[st.figRow, st.tHead, { height: ROW_H.head }]}>
              {LEAD_COLS.map(c => {
                const on = sortKey === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => onSort(c.key)}
                    style={[
                      st.tCell,
                      st.tHeadCell,
                      { width: c.w },
                      on && st.tCellOn,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={
                      on
                        ? `Sorted by ${c.spoken}, ${
                            sortDir === 'asc' ? 'lowest' : 'highest'
                          } first. Tap to reverse`
                        : `Sort by ${c.spoken}`
                    }
                  >
                    <Text style={[st.tHeadText, on && st.tHeadOn]}>
                      {c.head}
                      {on ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {lines.map(l => {
              const Row = l.onPress ? TouchableOpacity : View;
              return (
                <Row
                  key={l.key}
                  style={[
                    st.figRow,
                    { height: ROW_H[l.kind], backgroundColor: rowBg(l) },
                  ]}
                  activeOpacity={0.7}
                  onPress={l.onPress}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                >
                  <Cells x={l.x} sortKey={sortKey} kind={l.kind} />
                </Row>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// Styles: identical to LeadCityTable / Branch Summary.
const st = StyleSheet.create({
  table: {
    marginHorizontal: 16,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tBody: { flexDirection: 'row' },
  frozen: {
    width: FROZEN_W,
    backgroundColor: T.card,
    borderRightWidth: 1,
    borderRightColor: T.line,
    zIndex: 1,
    shadowColor: '#0F1A16',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  figures: { flex: 1 },
  tHead: {
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    alignItems: 'flex-end',
  },
  tHeadText: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: T.muted2,
    paddingBottom: 6,
    textAlign: 'right',
  },
  tHeadOn: { color: T.brand, fontWeight: '700' },
  tHeadCell: { justifyContent: 'flex-end' },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
    paddingRight: 3,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  figRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  cityName: { fontSize: 10.5, fontFamily: F.medium, color: T.text },
  cityMeta: {
    fontFamily: F.mono,
    fontSize: 8.5,
    color: T.muted2,
    marginTop: 1,
  },
  branchName: { fontSize: 10, fontFamily: F.regular, color: T.muted },
  tTotalName: { fontFamily: F.semibold, fontSize: 10.5, color: T.text },
  tRank: {
    width: 15,
    alignItems: 'center',
    textAlign: 'center',
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
  },
  tName: { flex: 1, minWidth: 0, paddingLeft: 1, paddingRight: 2 },
  tCell: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 10,
    paddingLeft: 4,
  },
  tCellOn: { backgroundColor: tint(T.brand) },
  tNum: {
    fontFamily: F.mono,
    fontSize: 14,
    fontWeight: '500',
    color: T.text,
    letterSpacing: -0.2,
    textAlign: 'right',
  },
  tNumSmall: { fontSize: 12.5, fontWeight: '400', color: T.muted },
  tNumBold: { fontWeight: '700' },
  tNumOn: { color: T.brand },
  tNumDup: { color: T.crit },
  tNumNone: { color: T.chevron },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
