/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// ConvincingComparison.js
// ─────────────────────────────────────────────────────────────────────────────
// Period-over-period comparison block for the Convincing Score screen.
// Purely presentational — the parent owns fetching and passes `data` down.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';

const C = {
  card: '#FFFFFF',
  ink: '#1F2A37',
  inkSoft: '#6B7280',
  line: '#E7ECF2',
  brand: '#184D67',
  good: '#1F9D57',
  low: '#D1495B',
  flat: '#8A94A0',
  track: '#EDF1F6',
  chip: '#EEF2F7',
};

const nf = n => (Number(n) || 0).toLocaleString('en-IN');
const pctText = v => (v == null ? '—' : `${v.toFixed(1)}%`);
const signed = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);
const dirColor = d => (d === 'up' ? C.good : d === 'down' ? C.low : C.flat);
const arrow = d => (d === 'up' ? '▲' : d === 'down' ? '▼' : '—');

/* One count metric row: current | previous | change */
const MetricRow = ({ label, d }) => (
  <View style={s.row}>
    <Text style={s.rowLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={s.rowCur}>{nf(d.current)}</Text>
    <Text style={s.rowPrev}>{nf(d.previous)}</Text>
    <Text style={[s.rowChg, { color: dirColor(d.direction) }]}>
      {arrow(d.direction)}{' '}
      {d.pct == null
        ? `${d.diff >= 0 ? '+' : ''}${nf(d.diff)}`
        : `${signed(d.pct)}%`}
    </Text>
  </View>
);

/* Mini trend bars. Used for the branch summary and, compact, per doctor. */
const TrendBars = ({
  series,
  scale = 'auto',
  compact = false,
  showCounts = false,
}) => {
  const max =
    scale === 'full'
      ? 100
      : Math.max(...series.map(p => p.convincingScore || 0), 1);

  return (
    <View style={[s.trendWrap, compact && s.trendWrapCompact]}>
      {series.map((p, i) => {
        const v = p.convincingScore;
        const isLast = i === series.length - 1;
        const empty = v == null;
        return (
          <View key={p.from ?? p.label ?? i} style={s.trendCol}>
            <Text
              style={[
                compact ? s.trendValCompact : s.trendVal,
                isLast && !empty && { color: C.brand },
              ]}
            >
              {empty ? '—' : `${Math.round(v)}%`}
            </Text>
            <View style={[s.trendTrack, compact && s.trendTrackCompact]}>
              {!empty && (
                <View
                  style={[
                    s.trendFill,
                    {
                      height: `${Math.max((v / max) * 100, 2)}%`,
                      backgroundColor: isLast ? C.brand : '#B9C6D4',
                    },
                  ]}
                />
              )}
            </View>
            <Text
              style={compact ? s.trendLabelCompact : s.trendLabel}
              numberOfLines={1}
            >
              {(compact && p.shortLabel) || p.label}
            </Text>
            {showCounts && (
              <Text style={s.trendCount} numberOfLines={1}>
                {p.performed}/{p.advised}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const MoverLine = ({ m }) => (
  <View style={s.moverRow}>
    <Text style={s.moverName} numberOfLines={1}>
      {m.doctorName}
    </Text>
    <Text style={s.moverDetail}>
      {pctText(m.previous)} → {pctText(m.current)}
    </Text>
    <Text style={[s.moverPp, { color: m.pp >= 0 ? C.good : C.low }]}>
      {signed(m.pp)} pp
    </Text>
  </View>
);

const SORTS = [
  { key: 'volume', label: 'Volume' },
  { key: 'delta', label: 'Change' },
  { key: 'score', label: 'Score' },
  { key: 'name', label: 'A–Z' },
];

const STATUS_CHIP = {
  new: { text: 'New', bg: '#E7F3EC', fg: C.good },
  dropped: { text: 'No activity', bg: '#FBEAEC', fg: C.low },
};

const DoctorCompareRow = ({ row, curLabel, prevLabel }) => {
  const [open, setOpen] = React.useState(false);
  const pp = row.delta.convincingScore.pp;
  const dir = row.delta.convincingScore.direction;
  const chip = STATUS_CHIP[row.status];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <View style={s.dcWrap}>
      <TouchableOpacity style={s.dcHead} onPress={toggle} activeOpacity={0.75}>
        <View style={{ flex: 1, paddingRight: 6 }}>
          <Text style={s.dcName} numberOfLines={1}>
            {row.doctorName}
          </Text>
          <View style={s.dcMetaRow}>
            <Text style={s.dcMeta}>
              {row.previous.performed}/{row.previous.advised} →{' '}
              {row.current.performed}/{row.current.advised}
            </Text>
            {!!chip && (
              <View style={[s.dcChip, { backgroundColor: chip.bg }]}>
                <Text style={[s.dcChipText, { color: chip.fg }]}>
                  {chip.text}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.dcScores}>
          <Text style={s.dcPrevScore}>
            {pctText(row.previous.convincingScore)}
          </Text>
          <Text style={s.dcScoreArrow}>→</Text>
          <Text style={s.dcCurScore}>
            {pctText(row.current.convincingScore)}
          </Text>
        </View>

        <Text
          style={[s.dcPp, { color: row.comparable ? dirColor(dir) : C.flat }]}
        >
          {row.comparable && pp != null ? `${signed(pp)}` : '—'}
        </Text>
        <Text style={s.dcChev}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.dcBody}>
          {(() => {
            // Prefer the backend series; fall back to a two-point series built
            // from the current/previous figures we already have, so the chart
            // still renders if the payload predates attachDoctorSeries.
            const series =
              row.series && row.series.length >= 2
                ? row.series
                : [
                    {
                      label: prevLabel,
                      from: `${row.doctorId}-prev`,
                      convincingScore: row.previous.convincingScore,
                    },
                    {
                      label: curLabel,
                      from: `${row.doctorId}-cur`,
                      convincingScore: row.current.convincingScore,
                    },
                  ];

            const hasAnyValue = series.some(p => p.convincingScore != null);

            return (
              <>
                <Text style={s.dcTrendCap}>
                  Convincing Score trend
                  {!row.series && '  (current vs previous only)'}
                </Text>
                {hasAnyValue ? (
                  <TrendBars series={series} scale="full" compact showCounts />
                ) : (
                  <Text style={s.dcNote}>
                    No advised surgeries in these periods, so there is no score
                    to plot.
                  </Text>
                )}
                <View style={s.dcTrendDiv} />
              </>
            );
          })()}
          <View style={s.dcBodyHead}>
            <Text style={[s.dcCellLabel, { flex: 1 }]} />
            <Text style={s.dcCellHead} numberOfLines={1}>
              {prevLabel}
            </Text>
            <Text style={s.dcCellHead} numberOfLines={1}>
              {curLabel}
            </Text>
            <Text style={[s.dcCellHead, { width: 60 }]}>Change</Text>
          </View>

          {[
            ['Patients Diagnosed', 'diagnosed'],
            ['Surgery Advised', 'advised'],
            ['Surgeries Done', 'performed'],
          ].map(([label, key]) => {
            const d = row.delta[key];
            return (
              <View key={key} style={s.dcBodyRow}>
                <Text style={[s.dcCellLabel, { flex: 1 }]}>{label}</Text>
                <Text style={s.dcCell}>{nf(row.previous[key])}</Text>
                <Text style={[s.dcCell, { color: C.ink }]}>
                  {nf(row.current[key])}
                </Text>
                <Text
                  style={[
                    s.dcCell,
                    {
                      width: 60,
                      color: dirColor(d.direction),
                      fontFamily: 'Lexend-Bold',
                    },
                  ]}
                >
                  {d.diff >= 0 ? '+' : ''}
                  {nf(d.diff)}
                </Text>
              </View>
            );
          })}

          <View style={s.dcBodyRow}>
            <Text style={[s.dcCellLabel, { flex: 1 }]}>Convincing Score</Text>
            <Text style={s.dcCell}>
              {pctText(row.previous.convincingScore)}
            </Text>
            <Text style={[s.dcCell, { color: C.ink }]}>
              {pctText(row.current.convincingScore)}
            </Text>
            <Text
              style={[
                s.dcCell,
                {
                  width: 60,
                  color: row.comparable ? dirColor(dir) : C.flat,
                  fontFamily: 'Lexend-Bold',
                },
              ]}
            >
              {row.comparable && pp != null ? `${signed(pp)}pp` : '—'}
            </Text>
          </View>

          {!row.comparable && row.status === 'both' && (
            <Text style={s.dcNote}>
              Too few advised surgeries in one of the periods for the score
              change to be meaningful.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export const DoctorComparisonList = ({
  rows,
  curLabel,
  prevLabel,
  roleLabel,
}) => {
  const [sort, setSort] = React.useState('volume');

  const sorted = React.useMemo(() => {
    const list = [...(rows || [])];
    if (sort === 'delta') {
      // Comparable rows first, biggest absolute move at the top.
      list.sort((a, b) => {
        if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
        return (
          Math.abs(b.delta.convincingScore.pp || 0) -
          Math.abs(a.delta.convincingScore.pp || 0)
        );
      });
    } else if (sort === 'score') {
      list.sort(
        (a, b) =>
          (b.current.convincingScore ?? -1) - (a.current.convincingScore ?? -1),
      );
    } else if (sort === 'name') {
      list.sort((a, b) =>
        String(a.doctorName).localeCompare(String(b.doctorName)),
      );
    }
    // 'volume' keeps the backend's default order
    return list;
  }, [rows, sort]);

  if (!rows || rows.length === 0) {
    return (
      <Text style={s.dcEmpty}>
        No {roleLabel.toLowerCase()} activity in either period.
      </Text>
    );
  }

  return (
    <View>
      <View style={s.sortRow}>
        <Text style={s.sortCap}>Sort</Text>
        {SORTS.map(o => {
          const active = sort === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[s.sortChip, active && s.sortChipActive]}
              onPress={() => setSort(o.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.sortText, active && s.sortTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {sorted.map(r => (
        <DoctorCompareRow
          key={`${r.doctorId ?? r.doctorName}`}
          row={r}
          curLabel={curLabel}
          prevLabel={prevLabel}
        />
      ))}
    </View>
  );
};

export const ComparisonSection = ({
  data,
  loading,
  error,
  expanded,
  onToggle,
  tab, // 'surgeons' | 'assistants' — movers follow the active tab
}) => {
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  if (loading) {
    return (
      <View style={[s.card, s.centered]}>
        <ActivityIndicator size="small" color={C.brand} />
        <Text style={s.loadingText}>Comparing periods…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.card, s.centered]}>
        <Text style={s.errText}>Comparison unavailable</Text>
        <Text style={s.errSub}>{error}</Text>
      </View>
    );
  }

  if (!data) return null;

  const score = data.delta.convincingScore;
  const movers =
    tab === 'surgeons' ? data.movers?.surgeons : data.movers?.assistants;

  return (
    <View style={s.card}>
      {/* Header */}
      <TouchableOpacity style={s.head} onPress={toggle} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={s.headTitle}>{data.modeLabel}</Text>
          <Text style={s.headSub} numberOfLines={1}>
            {data.current.label} vs {data.previous.label}
          </Text>
        </View>
        <Text style={[s.headDelta, { color: dirColor(score.direction) }]}>
          {arrow(score.direction)} {signed(score.pp)} pp
        </Text>
        <Text style={s.chev}>{expanded ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {/* Hero: score then vs now */}
      <View style={s.hero}>
        <View style={s.heroSide}>
          <Text style={s.heroCap}>{data.previous.label}</Text>
          <Text style={s.heroPrev}>{pctText(score.previous)}</Text>
        </View>
        <Text style={[s.heroArrow, { color: dirColor(score.direction) }]}>
          {arrow(score.direction)}
        </Text>
        <View style={s.heroSide}>
          <Text style={s.heroCap}>{data.current.label}</Text>
          <Text style={[s.heroCur, { color: dirColor(score.direction) }]}>
            {pctText(score.current)}
          </Text>
        </View>
      </View>

      {!data.exactCalendarShift && (
        <Text style={s.note}>
          Custom range — compared against the same {data.previousDays}-day span,
          shifted back.
        </Text>
      )}

      {expanded && (
        <View style={s.body}>
          {data.series.length > 2 && <TrendBars series={data.series} />}

          <View style={s.headerRow}>
            <Text style={[s.rowLabel, s.headerCell]}>Metric</Text>
            <Text style={[s.rowCur, s.headerCell]}>Now</Text>
            <Text style={[s.rowPrev, s.headerCell]}>Prev</Text>
            <Text style={[s.rowChg, s.headerCell]}>Change</Text>
          </View>

          <MetricRow label="New Appts" d={data.delta.newAppts} />
          <MetricRow label="Diagnoses" d={data.delta.diagnosed} />
          <MetricRow label="Surgery Adv." d={data.delta.advised} />
          <MetricRow label="Surgeries Done" d={data.delta.performed} />

          <View style={s.divider} />

          <View style={s.row}>
            <Text style={s.rowLabel}>Overall Conversion</Text>
            <Text style={s.rowCur}>
              {pctText(data.delta.overallConversion.current)}
            </Text>
            <Text style={s.rowPrev}>
              {pctText(data.delta.overallConversion.previous)}
            </Text>
            <Text
              style={[
                s.rowChg,
                { color: dirColor(data.delta.overallConversion.direction) },
              ]}
            >
              {signed(data.delta.overallConversion.pp)} pp
            </Text>
          </View>

          <View style={s.divider} />
          <Text style={s.sectionLabel}>
            {tab === 'surgeons' ? 'Surgeon' : 'Assistant'} by{' '}
            {tab === 'surgeons' ? 'Surgeon' : 'Assistant'}
          </Text>
          <DoctorComparisonList
            rows={
              tab === 'surgeons'
                ? data.doctors?.surgeons
                : data.doctors?.assistants
            }
            curLabel={data.current.label}
            prevLabel={data.previous.label}
            roleLabel={tab === 'surgeons' ? 'Surgeons' : 'Assistants'}
          />
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  centered: { alignItems: 'center', paddingVertical: 22 },
  loadingText: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: C.inkSoft,
    marginTop: 8,
  },
  errText: { fontFamily: 'Lexend-Bold', fontSize: 14, color: C.ink },
  errSub: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: C.inkSoft,
    marginTop: 4,
    textAlign: 'center',
  },

  head: { flexDirection: 'row', alignItems: 'center' },
  headTitle: { fontFamily: 'Lexend-Bold', fontSize: 14, color: C.ink },
  headSub: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
    marginTop: 2,
  },
  headDelta: { fontFamily: 'Lexend-Bold', fontSize: 14, marginRight: 8 },
  chev: { fontSize: 13, color: C.inkSoft },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  heroSide: { alignItems: 'center', minWidth: 100 },
  heroCap: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: C.inkSoft,
    marginBottom: 3,
  },
  heroPrev: { fontFamily: 'Lexend-Medium', fontSize: 20, color: C.inkSoft },
  heroCur: { fontFamily: 'Lexend-Bold', fontSize: 26 },
  heroArrow: { fontSize: 16, marginHorizontal: 14 },

  note: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 6,
  },

  body: { marginTop: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerCell: {
    fontFamily: 'Lexend-Medium',
    fontSize: 10,
    color: C.inkSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  rowLabel: {
    flex: 1,
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: C.ink,
  },
  rowCur: {
    width: 58,
    textAlign: 'right',
    fontFamily: 'Lexend-Medium',
    fontSize: 12,
    color: C.ink,
  },
  rowPrev: {
    width: 58,
    textAlign: 'right',
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: C.inkSoft,
  },
  rowChg: {
    width: 70,
    textAlign: 'right',
    fontFamily: 'Lexend-Bold',
    fontSize: 12,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 },

  sectionLabel: {
    fontFamily: 'Lexend-Medium',
    fontSize: 11,
    color: C.inkSoft,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  moverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  moverName: {
    flex: 1,
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: C.ink,
  },
  moverDetail: {
    width: 110,
    textAlign: 'right',
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
  },
  moverPp: {
    width: 66,
    textAlign: 'right',
    fontFamily: 'Lexend-Bold',
    fontSize: 12,
  },
  moverNote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: C.inkSoft,
    marginTop: 8,
  },

  trendWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 108,
    marginBottom: 16,
  },
  trendCol: { flex: 1, alignItems: 'center' },
  trendVal: {
    fontFamily: 'Lexend-Medium',
    fontSize: 10,
    color: C.inkSoft,
    marginBottom: 3,
  },
  trendTrack: {
    width: 20,
    height: 62,
    backgroundColor: C.track,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendFill: { width: '100%', borderRadius: 4 },
  trendLabel: {
    fontFamily: 'Lexend-Regular',
    fontSize: 9,
    color: C.inkSoft,
    marginTop: 4,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sortCap: {
    fontFamily: 'Lexend-Regular',
    fontSize: 10,
    color: C.inkSoft,
    marginRight: 6,
  },
  sortChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: C.chip,
    marginRight: 5,
  },
  sortChipActive: { backgroundColor: C.brand },
  sortText: { fontFamily: 'Lexend-Medium', fontSize: 10, color: C.inkSoft },
  sortTextActive: { color: '#fff' },

  dcWrap: { borderTopWidth: 1, borderTopColor: C.line },
  dcHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  dcName: { fontFamily: 'Lexend-Medium', fontSize: 12.5, color: C.ink },
  dcMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dcMeta: { fontFamily: 'Lexend-Regular', fontSize: 10, color: C.inkSoft },
  dcChip: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dcChipText: { fontFamily: 'Lexend-Medium', fontSize: 9 },

  dcScores: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  dcPrevScore: { fontFamily: 'Lexend-Regular', fontSize: 11, color: C.inkSoft },
  dcScoreArrow: { fontSize: 9, color: C.flat, marginHorizontal: 3 },
  dcCurScore: { fontFamily: 'Lexend-Bold', fontSize: 12.5, color: C.ink },
  dcPp: {
    width: 48,
    textAlign: 'right',
    fontFamily: 'Lexend-Bold',
    fontSize: 12,
  },
  dcChev: { fontSize: 11, color: C.inkSoft, marginLeft: 6, width: 12 },

  dcBody: {
    backgroundColor: '#FAFBFD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 9,
  },
  dcBodyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  dcBodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  dcCellHead: {
    width: 74,
    textAlign: 'right',
    fontFamily: 'Lexend-Medium',
    fontSize: 9,
    color: C.inkSoft,
  },
  dcCellLabel: { fontFamily: 'Lexend-Regular', fontSize: 11, color: C.ink },
  dcCell: {
    width: 74,
    textAlign: 'right',
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
  },
  dcNote: {
    fontFamily: 'Lexend-Regular',
    fontSize: 9.5,
    color: C.inkSoft,
    marginTop: 6,
  },
  dcEmpty: {
    fontFamily: 'Lexend-Regular',
    fontSize: 11,
    color: C.inkSoft,
    paddingVertical: 12,
    textAlign: 'center',
  },
  trendValCompact: {
    fontFamily: 'Lexend-Medium',
    fontSize: 9,
    color: C.inkSoft,
    marginBottom: 2,
  },
  trendTrackCompact: { width: 14, height: 42 },
  trendLabelCompact: {
    fontFamily: 'Lexend-Regular',
    fontSize: 8,
    color: C.inkSoft,
    marginTop: 3,
  },

  dcTrendCap: {
    fontFamily: 'Lexend-Medium',
    fontSize: 10,
    color: C.inkSoft,
    marginBottom: 6,
  },
  dcTrendDiv: {
    height: 1,
    backgroundColor: C.line,
    marginBottom: 6,
  },
  trendCount: {
    fontFamily: 'Lexend-Regular',
    fontSize: 8,
    color: C.flat,
    marginTop: 1,
  },
  trendWrapCompact: { height: 92, marginBottom: 8 }, // ← was 78, room for counts
});

export default ComparisonSection;
