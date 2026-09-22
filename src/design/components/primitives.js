/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/primitives.js
// ─────────────────────────────────────────────────────────────────────────────
// The building blocks of the redesigned shell, each a direct port of a rule in
// hhc-hms-ui-revision-2.html. The CSS class each one comes from is named above
// it, so the port can be checked against the source rather than re-approximated
// on every screen.
//
// Icons: the prototype inlines SVG paths. This file takes an `icon` NAME and
// leaves resolution to the caller's icon set (react-native-vector-icons is
// already a dependency — MaterialIcons is used in AdminHome's reportGrid).
// See ICONS below for the name map.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { F, R, T, tint } from '../tokens';

// Prototype icon name → MaterialIcons name. One place to retune the mapping.
export const ICONS = {
  stetho: 'medical-services',
  bed: 'local-hospital',
  scope: 'biotech',
  mortar: 'local-pharmacy',
  headset: 'headset-mic',
  target: 'track-changes',
  chart: 'analytics',
  calplus: 'event-available',
  cal: 'calendar-month',
  rupee: 'currency-rupee',
  invoice: 'receipt-long',
  wallet: 'account-balance-wallet',
  shield: 'verified-user',
  globe: 'language',
  bot: 'smart-toy',
  mega: 'campaign',
  gauge: 'speed',
  star: 'star-rate',
  check: 'check-circle',
  search: 'search',
  adduser: 'person-add',
  firstaid: 'medical-information',
  home: 'dashboard',
};

const mi = name => ICONS[name] || 'circle';

// ─── Eyebrow ─────────────────────────────────────────────────────────────────
// .eyebrow{font-size:9px;letter-spacing:.15em;text-transform:uppercase}
export const Eyebrow = ({ children, style }) => (
  <Text style={[s.eyebrow, style]}>{String(children).toUpperCase()}</Text>
);

// ─── SectionHead ─────────────────────────────────────────────────────────────
// .sec-head — an eyebrow with an optional action link on the right.
export const SectionHead = ({ label, action, onAction }) => (
  <View style={s.secHead}>
    <Eyebrow style={{ color: T.muted2 }}>{label}</Eyebrow>
    {!!action && (
      <TouchableOpacity onPress={onAction} hitSlop={hit}>
        <Text style={s.secHeadLink}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Rail ────────────────────────────────────────────────────────────────────
// .rail / .rail-cell — the "Today at a glance" 3-up strip. Renders however many
// cells it is given; dividers sit between, not after.
export const Rail = ({ cells = [], onPressCell }) => (
  <View style={s.rail}>
    {cells.map((c, i) => {
      const inner = (
        <>
          <Eyebrow>{c.label}</Eyebrow>
          <Text style={s.railVal}>{c.value}</Text>
          {!!c.note && <Text style={s.railNote}>{c.note}</Text>}
        </>
      );
      const style = [s.railCell, i < cells.length - 1 && s.railDivider];
      // A cell without a destination stays a plain View — no touch feedback on
      // something that doesn't respond.
      return onPressCell && c.route ? (
        <TouchableOpacity
          key={c.label}
          style={style}
          activeOpacity={0.6}
          onPress={() => onPressCell(c)}
          accessibilityRole="button"
          accessibilityLabel={`${c.label}, ${c.value}`}
        >
          {inner}
        </TouchableOpacity>
      ) : (
        <View key={c.label} style={style}>
          {inner}
        </View>
      );
    })}
  </View>
);

// ─── StackBar + Legend ───────────────────────────────────────────────────────
// .stack / .leg-row / .total-row — the collection breakdown.
export const StackBar = ({ segments = [] }) => (
  <View style={s.stack}>
    {segments
      .filter(x => x.pct > 0)
      .map(x => (
        <View
          key={x.key || x.label}
          style={{
            width: `${x.pct}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: x.color,
          }}
        />
      ))}
  </View>
);

export const Legend = ({
  rows = [],
  total,
  totalLabel = 'Total collected',
}) => (
  <View>
    <View style={s.legend}>
      {rows.map((r, i) => (
        <View
          key={r.key || r.label}
          style={[s.legRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
        >
          <View style={[s.sw, { backgroundColor: r.color }]} />
          <Text style={s.legName}>{r.label}</Text>
          {/* Falls back to the percentage when no note is supplied, so the
              screens still using pct (OPD Collection) are unaffected. */}
          <Text style={s.legNote}>{r.note ?? `${r.pct}%`}</Text>
          <Text style={s.legAmt}>{r.amount}</Text>
        </View>
      ))}
    </View>
    {total !== undefined && (
      <View style={s.totalRow}>
        <Eyebrow>{totalLabel}</Eyebrow>
        <Text style={s.totalVal}>{total}</Text>
      </View>
    )}
  </View>
);

// ─── Segmented ───────────────────────────────────────────────────────────────
// .seg — the IVR / Helpline switch.
export const Segmented = ({ options = [], value, onChange }) => (
  <View style={s.seg}>
    {options.map(o => {
      const on = o.value === value;
      return (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          style={[s.segBtn, on && s.segBtnOn]}
        >
          <Text style={[s.segText, on && s.segTextOn]}>
            {o.label.toUpperCase()}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Tile ────────────────────────────────────────────────────────────────────
// .tile — a department card in the home grid. `wide` is the full-width variant
// the prototype uses for a trailing odd card.
export const Tile = ({ code, name, stat, icon, hue, wide, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={`${name}. ${stat || ''}`}
    style={[s.tile, wide && s.tileWide]}
  >
    <View style={[s.spine, { backgroundColor: hue }]} />
    <View
      style={[
        s.tileIco,
        { backgroundColor: tint(hue) },
        wide && { marginBottom: 0 },
      ]}
    >
      <Icon name={mi(icon)} size={18} color={hue} />
    </View>
    <View style={wide ? { flex: 1 } : null}>
      <Eyebrow>{code}</Eyebrow>
      <Text style={s.tileName}>{name}</Text>
      {!wide && !!stat && <Text style={s.tileStat}>{stat}</Text>}
    </View>
    {wide && !!stat && <Text style={s.tileStat}>{stat}</Text>}
  </TouchableOpacity>
);

// ─── MetricGrid ──────────────────────────────────────────────────────────────
// .metrics / .metric — the 2-column grid that overlaps the section header.
// Renders only the cards it is given: two metrics make one row, not four boxes
// with two blanks in them.
export const MetricGrid = ({ items = [] }) => (
  <View style={s.metrics}>
    {items.map(m => (
      <View key={m.key || m.label} style={s.metric}>
        <Eyebrow>{m.label}</Eyebrow>
        <Text style={s.metricVal}>{m.value}</Text>
        {!!m.note && (
          <Text
            style={[
              s.metricNote,
              m.dir === 'up' && { color: T.pos },
              m.dir === 'down' && { color: T.crit },
            ]}
          >
            {m.note}
          </Text>
        )}
      </View>
    ))}
  </View>
);

// ─── PageRow ─────────────────────────────────────────────────────────────────
// .row — one navigable page inside a section.
export const PageRow = ({ name, desc, icon, hue, onPress, last }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    style={[s.row, last && { borderBottomWidth: 0 }]}
  >
    <View style={[s.rowIco, { backgroundColor: tint(hue) }]}>
      <Icon name={mi(icon)} size={18} color={hue} />
    </View>
    <View style={s.rowTxt}>
      <Text style={s.rowName}>{name}</Text>
      {!!desc && <Text style={s.rowDesc}>{desc}</Text>}
    </View>
    <Icon name="chevron-right" size={20} color={T.chevron} />
  </TouchableOpacity>
);

// .list — the card the rows sit inside.
export const List = ({ children }) => <View style={s.list}>{children}</View>;

// ─── Card ────────────────────────────────────────────────────────────────────
export const Card = ({ children, style }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const Block = ({ children, style }) => (
  <View style={[{ marginBottom: 22 }, style]}>{children}</View>
);

const hit = { top: 8, bottom: 8, left: 8, right: 8 };

const s = StyleSheet.create({
  eyebrow: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted,
  },

  secHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
    marginBottom: 9,
  },
  secHeadLink: {
    fontFamily: F.mono,
    fontSize: 10,
    color: T.brand,
    letterSpacing: 0.6,
  },

  // .rail
  rail: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  railCell: { flex: 1, paddingVertical: 13, paddingHorizontal: 12 },
  railDivider: { borderRightWidth: 1, borderRightColor: T.lineSoft },
  railVal: {
    fontFamily: F.mono,
    fontSize: 21,
    color: T.text,
    marginTop: 6,
    letterSpacing: -0.4,
  },
  railNote: { fontSize: 10, color: T.muted2, marginTop: 5 },

  // .stack
  stack: {
    flexDirection: 'row',
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: T.lineSoft,
    gap: 2,
  },

  // .legend / .leg-row
  legend: { marginTop: 13 },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  sw: { width: 8, height: 8, borderRadius: 2 },
  legName: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: F.regular },
  legPct: {
    fontFamily: F.mono,
    fontSize: 10.5,
    color: T.muted2,
    width: 34,
    textAlign: 'right',
  },
  legAmt: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    width: 84,
    textAlign: 'right',
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  totalVal: {
    fontFamily: F.mono,
    fontSize: 17,
    color: T.text,
    letterSpacing: -0.4,
  },

  // .seg
  seg: {
    flexDirection: 'row',
    backgroundColor: T.lineSoft,
    borderRadius: R.sm,
    padding: 3,
    gap: 3,
    marginBottom: 14,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
  },
  segBtnOn: { backgroundColor: T.card },
  segText: {
    fontFamily: F.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: T.muted,
  },
  segTextOn: { color: T.text },

  // .tile
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 13,
    overflow: 'hidden',
  },
  tileWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  tileIco: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  tileName: {
    fontSize: 13.5,
    fontFamily: F.semibold,
    color: T.text,
    marginTop: 3,
    letterSpacing: -0.1,
  },
  tileStat: { fontFamily: F.mono, fontSize: 10, color: T.muted, marginTop: 6 },

  // .metrics
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingHorizontal: 16,
    marginTop: -30,
  },
  metric: {
    // two per row, accounting for the 9px gap and 16px page padding
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  metricVal: {
    fontFamily: F.mono,
    fontSize: 20,
    color: T.text,
    marginTop: 7,
    letterSpacing: -0.4,
  },
  metricNote: { fontSize: 10, color: T.muted2, marginTop: 6 },

  // .list / .row
  list: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  rowIco: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTxt: { flex: 1, minWidth: 0 },
  rowName: {
    fontSize: 13.5,
    fontFamily: F.medium,
    color: T.text,
    letterSpacing: -0.1,
  },
  rowDesc: {
    fontSize: 11,
    color: T.muted2,
    marginTop: 2,
    fontFamily: F.regular,
  },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    padding: 14,
  },
  legNote: {
    fontFamily: F.mono,
    fontSize: 10.5,
    color: T.muted2,
    width: 64,
    textAlign: 'right',
  },
});

export default {
  Eyebrow,
  SectionHead,
  Rail,
  StackBar,
  Legend,
  Segmented,
  Tile,
  MetricGrid,
  PageRow,
  List,
  Card,
  Block,
  ICONS,
};
