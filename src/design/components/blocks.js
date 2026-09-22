/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/design/components/blocks.js
// ─────────────────────────────────────────────────────────────────────────────
// Section-level display blocks — what sits between the metric grid and the
// page list.
//
// VisitTypeGrid replaces the prototype's flat .mix chips. The chips were a
// passive readout, which was fine when "OPD Report" sat in the page list as the
// way in. With that row gone, the visit types ARE the way in, so they need to
// look like the primary control on the screen rather than four small labels.
//
// What makes them read as tappable rather than decorative:
//   • real card surfaces with a coloured spine, matching the department tiles
//     on the home screen — the established "this opens something" shape
//   • the count as the largest thing in the card, since that is what is being
//     drilled into
//   • a share bar per card, so the four are comparable at a glance without
//     doing arithmetic
//   • a chevron
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { F, T, tint } from '../tokens';
import { useState } from 'react';

/**
 * A proportional bar with inline labels — the prototype's .gsplit shape,
 * generalised to any number of segments.
 *
 * `segments`: [{ key, label, value, amount, color }]
 *   value  — sets the width
 *   amount — what is printed next to the label
 */
export const SplitBar = ({
  segments = [],
  note,
  empty = 'Nothing to show for this period.',
}) => {
  const total = segments.reduce((a, x) => a + (x.value || 0), 0);
  if (total === 0) return <Text style={s.empty}>{empty}</Text>;
  return (
    <View>
      <View style={s.gsplit}>
        {segments
          .filter(x => x.value > 0)
          .map(x => (
            <View
              key={x.key}
              style={[
                s.gcell,
                {
                  width: `${(x.value / total) * 100}%`,
                  backgroundColor: x.color,
                },
              ]}
            >
              <Text style={s.glabel} numberOfLines={1}>
                {x.label} <Text style={s.gval}>{x.amount}</Text>
              </Text>
            </View>
          ))}
      </View>
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

/**
 * The visit-type breakdown: one tappable card per type, carrying the patient
 * count and the revenue attributed to it.
 *
 * Layout, top to bottom: label + chevron · count · rule · revenue and average.
 * The rule keeps the two halves distinct — a count and a rupee figure stacked
 * without one read as a single column of numbers.
 *
 * `items`: [{ key, label, value, unit, hue, revenue, avg, note }]
 *   revenue / avg — omit for a type with no attributed revenue (C+P), and the
 *   card shows `note` on the same line instead, so heights still match.
 */
export const VisitTypeGrid = ({ items = [], onPress, note }) => (
  <View>
    <View style={s.grid}>
      {items.map(i => (
        <TouchableOpacity
          key={i.key}
          style={s.card}
          activeOpacity={0.75}
          onPress={() => onPress && onPress(i)}
          accessibilityRole="button"
          accessibilityLabel={`${i.label}, ${i.value} ${i.unit || 'patients'}${
            i.revenue ? `, ${i.revenue}` : ''
          }. Opens the list.`}
        >
          <View style={[s.spine, { backgroundColor: i.hue }]} />

          <View style={s.top}>
            <Text style={s.label} numberOfLines={1}>
              {i.label}
            </Text>
            <Icon name="chevron-right" size={16} color={T.chevron} />
          </View>

          <View style={s.countRow}>
            <Text style={[s.count, { color: i.hue }]}>{i.value}</Text>
            <Text style={s.unit}>{i.unit || 'patients'}</Text>
          </View>

          <View style={s.rule} />

          {i.revenue ? (
            <>
              <Text style={s.revenue}>{i.revenue}</Text>
              {!!i.avg && <Text style={s.sub}>{i.avg} avg</Text>}
            </>
          ) : (
            <Text style={s.sub}>{i.note}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
    {!!note && <Text style={s.note}>{note}</Text>}
  </View>
);

/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// Add to src/design/components/blocks.js
// ─────────────────────────────────────────────────────────────────────────────
// The prototype's .dt table, with the share bar drawn UNDER each row rather
// than as a column.
//
// A three-column table on a 358px screen leaves roughly 90px for a label, an
// amount and a bar. Something has to give, and it should not be the ₹ figure —
// that is the number people came for. So the bar becomes a hairline beneath
// the row: full width to compare against, nothing to clip, and the row above
// it keeps its columns readable.
//
// Shares scale to the LARGEST row, not the total, because the bars exist to
// compare rows with each other. Scaled to the total, a six-row table leaves
// every bar short and flat.
// ─────────────────────────────────────────────────────────────────────────────

export const DataTable = ({
  columns,
  rows = [],
  foot,
  hue,
  note,
  empty = 'Nothing to show for this period.',
}) => {
  if (!rows.length) return <Text style={s.empty}>{empty}</Text>;

  const max = Math.max(...rows.map(r => r.share || 0), 1);

  return (
    <View>
      <View style={s.dt}>
        <View style={s.dtHead}>
          <Text style={[s.dtH, { flex: 1 }]}>{columns[0]}</Text>
          <Text style={[s.dtH, s.dtNum, { width: 44 }]}>{columns[1]}</Text>
          <Text style={[s.dtH, s.dtNum, { width: 88 }]}>{columns[2]}</Text>
        </View>

        {rows.map((r, i) => (
          <View
            key={r.key}
            style={[s.dtRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={s.dtLine}>
              <Text style={[s.dtName, { flex: 1 }]} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={[s.dtVal, s.dtNum, { width: 44 }]}>{r.count}</Text>
              <Text style={[s.dtVal, s.dtNum, { width: 88 }]}>{r.value}</Text>
            </View>
            <View style={s.dtTrack}>
              <View
                style={{
                  width: `${Math.max(((r.share || 0) / max) * 100, 1.5)}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: hue,
                }}
              />
            </View>
          </View>
        ))}

        {!!foot && (
          <View style={s.dtFoot}>
            <Text style={[s.dtFootName, { flex: 1 }]}>{foot.label}</Text>
            <Text style={[s.dtFootVal, s.dtNum, { width: 44 }]}>
              {foot.count}
            </Text>
            <Text style={[s.dtFootVal, s.dtNum, { width: 88 }]}>
              {foot.value}
            </Text>
          </View>
        )}
      </View>
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

/**
 * A section that opens on tap, closed by default.
 *
 * `summary` is the point: a closed section still has to earn its place, so the
 * header carries the one figure that tells you whether opening it is worth it
 * ("31 patients"). A row that says only "Patient type" gives no reason to tap.
 *
 * No LayoutAnimation. Animating a table of ten rows open on a mid-range
 * Android device drops frames, and the jerk is more noticeable than the
 * instant change it replaces.
 */
export const Collapsible = ({
  label,
  summary,
  hue,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        style={s.collHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}${summary ? `, ${summary}` : ''}`}
      >
        <Text style={s.collLabel}>{label.toUpperCase()}</Text>
        {!!summary && <Text style={s.collSummary}>{summary}</Text>}
        <Icon
          name={open ? 'expand-less' : 'expand-more'}
          size={20}
          color={hue || T.muted}
        />
      </TouchableOpacity>
      {open && <View style={{ marginTop: 10 }}>{children}</View>}
    </View>
  );
};

/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// Add to src/design/components/blocks.js
// ─────────────────────────────────────────────────────────────────────────────
// A ranked list: label, amount, a share bar, and two lines of context.
//
// Why not the DataTable used by IPD: that has three fixed columns and a header
// row, which suits five known categories. Lab subtypes are a dozen or more
// hand-entered names of unpredictable length ("Complete Blood Count", "LFT"),
// and squeezing those into a 90px column truncates the very thing being ranked.
//
// So the name gets the full width with the amount right-aligned beside it, and
// the counts sit underneath in muted mono. The bar runs the width of the row.
//
// Shares scale to the LARGEST row, not the total — the bars exist to compare
// rows with each other, and against a total a twelve-row list leaves every bar
// short and flat.
// ─────────────────────────────────────────────────────────────────────────────

export const RankedList = ({
  rows = [],
  foot,
  hue,
  note,
  empty = 'Nothing to show for this period.',
}) => {
  if (!rows.length) return <Text style={s.empty}>{empty}</Text>;

  const max = Math.max(...rows.map(r => r.value || 0), 1);

  return (
    <View>
      <View style={s.rl}>
        {rows.map((r, i) => (
          <View
            key={r.key}
            style={[s.rlRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={s.rlTop}>
              {/* Rank number: with a dozen rows, position is information —
                  "third biggest earner" is easier to hold than an amount. */}
              <Text style={s.rlRank}>{i + 1}</Text>
              <Text style={s.rlName} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={s.rlAmt}>{r.amount}</Text>
            </View>

            <View style={s.rlTrack}>
              <View
                style={{
                  width: `${Math.max(((r.value || 0) / max) * 100, 1.5)}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: hue,
                }}
              />
            </View>

            <View style={s.rlMetaRow}>
              <Text style={s.rlMeta} numberOfLines={1}>
                {r.meta}
              </Text>
              {!!r.avg && <Text style={s.rlMeta}>{r.avg}</Text>}
            </View>
          </View>
        ))}

        {!!foot && (
          <View style={s.rlFoot}>
            <Text style={s.rlFootName}>{foot.label}</Text>
            <Text style={s.rlFootMeta} numberOfLines={1}>
              {foot.meta}
            </Text>
            <Text style={s.rlFootAmt}>{foot.amount}</Text>
          </View>
        )}
      </View>
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

/**
 * A grid of figure cards — same shape as the metric grid above the fold, but
 * for a labelled group inside the page. Two per row, wrapping.
 */
export const CardGrid = ({ cards = [], note }) => {
  if (!cards.length) return null;
  return (
    <View>
      <View style={s.cgGrid}>
        {cards.map(c => (
          <View key={c.key} style={s.cgCard}>
            <View
              style={[s.cgSpine, { backgroundColor: c.color || T.muted2 }]}
            />
            <Text style={s.cgLabel} numberOfLines={1}>
              {c.label.toUpperCase()}
            </Text>
            <Text
              style={[s.cgVal, c.color && { color: c.color }]}
              numberOfLines={1}
            >
              {c.value}
            </Text>
            {!!c.note && (
              <Text style={s.cgNote} numberOfLines={1}>
                {c.note}
              </Text>
            )}
          </View>
        ))}
      </View>
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

/**
 * One card per category: a headline amount with a comparison bar, then a row
 * of four small figures beneath.
 *
 * Why not DataTable: this is four numbers per row, and DataTable has three
 * columns. Why not RankedList: the figures are the point here, not the
 * ranking. Same visual family as both — spine, mono numerals, muted labels.
 */
export const BreakdownList = ({
  rows = [],
  foot,
  hue,
  note,
  onPressRow,
  empty = 'Nothing to show for this period.',
}) => {
  if (!rows.length) return <Text style={s.empty}>{empty}</Text>;

  const toneColor = tone =>
    tone === 'good'
      ? '#1E7A5A'
      : tone === 'warn'
      ? '#B26A00'
      : tone === 'bad'
      ? T.crit
      : T.text;

  return (
    <View>
      {rows.map(r => {
        // A row only becomes a button when it has somewhere to go. Pharmacy's
        // prescription rows carry no route and stay plain, without needing a
        // per-section flag.
        const tappable = !!(onPressRow && r.route);
        const Wrapper = tappable ? TouchableOpacity : View;

        return (
          <Wrapper
            key={r.key}
            style={s.bdCard}
            {...(tappable
              ? {
                  activeOpacity: 0.75,
                  onPress: () => onPressRow(r),
                  accessibilityRole: 'button',
                  accessibilityLabel: `${r.label}, ${r.amount}. Opens the list.`,
                }
              : {})}
          >
            <View style={[s.bdSpine, { backgroundColor: hue }]} />

            <View style={s.bdTop}>
              <Text style={s.bdName} numberOfLines={1}>
                {r.label}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.bdAmt}>{r.amount}</Text>
                <Text style={s.bdAmtLabel}>{r.amountLabel}</Text>
              </View>
              {/* A card with no destination keeps the width but no chevron —
                  a chevron that does nothing is worse than none at all. */}
              {tappable ? (
                <Icon name="chevron-right" size={16} color={T.chevron} />
              ) : (
                <View style={{ width: 16 }} />
              )}
            </View>

            <View style={s.bdTrack}>
              <View
                style={{
                  width: `${Math.max(r.share || 0, 1.5)}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: T.crit,
                }}
              />
            </View>

            <View style={s.bdFigs}>
              {r.figures.map(f => (
                <View key={f.label} style={s.bdFig}>
                  <Text style={s.bdFigLabel}>{f.label}</Text>
                  <Text style={[s.bdFigVal, { color: toneColor(f.tone) }]}>
                    {f.value}
                  </Text>
                </View>
              ))}
            </View>

            {!!r.note && <Text style={s.bdNote}>{r.note}</Text>}
          </Wrapper>
        );
      })}

      {!!foot && (
        <View style={s.bdFoot}>
          <Text style={s.bdFootName}>{foot.label}</Text>
          <Text style={s.bdFootMeta} numberOfLines={1}>
            {foot.meta}
          </Text>
          <Text style={s.bdFootAmt}>{foot.amount}</Text>
        </View>
      )}

      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

/**
 * A compact five-column funnel table: source, leads, booked, visited, IPD,
 * with conversion beneath each row.
 *
 * Five numeric columns will not fit on 358px, so conversion moves to its own
 * line under the row as a bar plus a percentage — it is a derived figure, not
 * a peer of the four counts, and giving it the full width makes the sources
 * comparable at a glance.
 */
export const LeadsFunnel = ({
  rows = [],
  foot,
  hue,
  note,
  onPressRow,
  empty = 'No leads in this period.',
}) => {
  if (!rows.length) return <Text style={s.empty}>{empty}</Text>;

  return (
    <View>
      <View style={s.lf}>
        <View style={s.lfHead}>
          <Text style={[s.lfH, { flex: 1 }]}>SOURCE</Text>
          <Text style={[s.lfH, s.lfNum]}>LEADS</Text>
          <Text style={[s.lfH, s.lfNum]}>APPT</Text>
          <Text style={[s.lfH, s.lfNum]}>VISIT</Text>
          <Text style={[s.lfH, s.lfNum]}>IPD</Text>
          {/* Holds the chevron column so the header stays aligned with rows. */}
          <View style={{ width: 14 }} />
        </View>

        {rows.map((r, i) => {
          const tappable = !!(onPressRow && r.route);
          const Wrapper = tappable ? TouchableOpacity : View;

          return (
            <Wrapper
              key={r.key}
              style={[
                s.lfRow,
                i === rows.length - 1 && { borderBottomWidth: 0 },
              ]}
              {...(tappable
                ? {
                    activeOpacity: 0.7,
                    onPress: () => onPressRow(r),
                    accessibilityRole: 'button',
                    accessibilityLabel: `${r.label}, ${r.leads} leads, ${r.appointment} appointments. Opens the list.`,
                  }
                : {})}
            >
              <View style={s.lfLine}>
                <Text style={[s.lfName, { flex: 1 }]} numberOfLines={1}>
                  {r.label}
                </Text>
                <Text style={[s.lfVal, s.lfNum]}>{r.leads}</Text>
                <Text style={[s.lfVal, s.lfNum]}>{r.appointment}</Text>
                <Text style={[s.lfVal, s.lfNum]}>{r.visited}</Text>
                <Text style={[s.lfVal, s.lfNum]}>{r.ipd}</Text>
                {/* A row with no destination keeps the space but no chevron —
                    a chevron that does nothing is worse than none. */}
                {tappable ? (
                  <Icon name="chevron-right" size={14} color={T.chevron} />
                ) : (
                  <View style={{ width: 14 }} />
                )}
              </View>

              <View style={s.lfConv}>
                <View style={s.lfTrack}>
                  <View
                    style={{
                      width: `${Math.min(
                        Math.max(r.conversionPct || 0, 0),
                        100,
                      )}%`,
                      height: '100%',
                      borderRadius: 2,
                      backgroundColor: hue,
                    }}
                  />
                </View>
                <Text style={s.lfPct}>
                  {r.conversionPct == null ? '—' : `${r.conversionPct}%`}
                </Text>
              </View>
            </Wrapper>
          );
        })}

        {!!foot && (
          <View style={s.lfFoot}>
            <Text style={[s.lfFootName, { flex: 1 }]}>{foot.label}</Text>
            <Text style={[s.lfFootVal, s.lfNum]}>{foot.leads}</Text>
            <Text style={[s.lfFootVal, s.lfNum]}>{foot.appointment}</Text>
            <Text style={[s.lfFootVal, s.lfNum]}>{foot.visited}</Text>
            <Text style={[s.lfFootVal, s.lfNum]}>{foot.ipd}</Text>
            <View style={{ width: 14 }} />
          </View>
        )}
      </View>
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
};

const s = StyleSheet.create({
  gsplit: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 9,
    overflow: 'hidden',
    gap: 2,
  },
  gcell: { justifyContent: 'center', paddingHorizontal: 11 },
  glabel: { fontFamily: F.mono, fontSize: 11, color: '#fff' },
  gval: { fontFamily: F.mono, fontSize: 11, color: '#fff', fontWeight: '600' },

  note: { fontSize: 10, color: T.muted2, marginTop: 9, fontFamily: F.regular },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 13,
    bottom: 13,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: T.muted,
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 8,
  },
  count: { fontFamily: F.mono, fontSize: 24, letterSpacing: -0.5 },
  unit: { fontSize: 10, color: T.muted2, fontFamily: F.regular },

  rule: {
    height: 1,
    backgroundColor: T.lineSoft,
    marginTop: 11,
    marginBottom: 10,
  },

  revenue: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.2,
  },
  sub: { fontSize: 10, color: T.muted2, marginTop: 4, fontFamily: F.regular },

  empty: { fontSize: 12.5, color: T.muted, fontFamily: F.regular },

  dt: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dtHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  dtH: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: T.muted,
  },
  dtNum: { textAlign: 'right' },

  dtRow: {
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  dtLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dtName: { fontSize: 12.5, color: T.text, fontFamily: F.regular },
  dtVal: { fontFamily: F.mono, fontSize: 12.5, color: T.text },
  dtTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 8,
    overflow: 'hidden',
  },

  dtFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  dtFootName: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: T.muted,
  },
  dtFootVal: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    fontWeight: '600',
  },
  collHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  collLabel: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: T.muted,
  },
  collSummary: { fontFamily: F.mono, fontSize: 11.5, color: T.text },
  rl: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rlRow: {
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  rlTop: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  rlRank: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    width: 14,
  },
  rlName: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: F.medium },
  rlAmt: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.text,
    letterSpacing: -0.2,
  },

  rlTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 9,
    marginLeft: 23,
    overflow: 'hidden',
  },
  rlMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 7,
    marginLeft: 23,
  },
  rlMeta: { fontFamily: F.mono, fontSize: 9.5, color: T.muted2 },

  rlFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  rlFootName: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: T.muted,
  },
  rlFootMeta: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    textAlign: 'right',
  },
  rlFootAmt: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.text,
    fontWeight: '600',
  },
  cgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  cgCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  cgSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  cgLabel: {
    fontFamily: F.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: T.muted,
  },
  cgVal: {
    fontFamily: F.mono,
    fontSize: 17,
    marginTop: 6,
    letterSpacing: -0.4,
  },
  cgNote: {
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },
  bdCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginBottom: 9,
    overflow: 'hidden',
  },
  bdSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  bdTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bdName: { flex: 1, fontSize: 13, fontFamily: F.medium, color: T.text },
  bdAmt: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.crit,
    letterSpacing: -0.3,
  },
  bdAmtLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
    marginTop: 3,
  },

  bdTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    marginTop: 10,
    overflow: 'hidden',
  },

  bdFigs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  bdFig: { flex: 1 },
  bdFigLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  bdFigVal: {
    fontFamily: F.mono,
    fontSize: 13,
    marginTop: 4,
    letterSpacing: -0.2,
  },

  bdNote: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 9,
    fontFamily: F.regular,
  },

  bdFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.subtle,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  bdFootName: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: T.muted,
  },
  bdFootMeta: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 9.5,
    color: T.muted2,
    textAlign: 'right',
  },
  bdFootAmt: {
    fontFamily: F.mono,
    fontSize: 13,
    color: T.crit,
    fontWeight: '600',
  },
  lf: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  lfHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: T.subtle,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  lfH: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: T.muted,
  },
  lfNum: { width: 34, textAlign: 'right' },
  lfRow: {
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.lineSoft,
  },
  lfLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lfName: { fontSize: 12.5, color: T.text, fontFamily: F.medium },
  lfVal: { fontFamily: F.mono, fontSize: 12.5, color: T.text },
  lfConv: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  lfTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.lineSoft,
    overflow: 'hidden',
  },
  lfPct: {
    fontFamily: F.mono,
    fontSize: 10,
    color: T.muted2,
    width: 38,
    textAlign: 'right',
  },
  lfFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: T.subtle,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  lfFootName: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: T.muted,
  },
  lfFootVal: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    fontWeight: '600',
  },
});

export default {
  CardGrid,
  Collapsible,
  DataTable,
  RankedList,
  VisitTypeGrid,
  BreakdownList,
  LeadsFunnel,
};
