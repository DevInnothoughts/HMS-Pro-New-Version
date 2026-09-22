/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// src/screens/BillingSummaryScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Branch-wise billing summary. Replaces src/admin/SummaryReportScreen.js.
// Same endpoint, same figures, same Excel export.
//
//   GET /report/summaryReport?from=&to=
//        → { summary, branches: [{ location, opd, ipdCollection,
//                                  ipdInvoice, pharmacy, grandTotal, error? }] }
//
// There is NO location parameter — the server decides which branches are
// included. Sending one is how this screen failed the first time.
//
// ⚠️ THE GRAND TOTAL EXCLUDES IPD COLLECTION
// ──────────────────────────────────────────
//     grandTotal = OPD + IPD INVOICE (billed) + Pharmacy
//
// IPD *collection* is reported per branch but is NOT part of it — the billed
// invoice amount is used instead. Every revenue figure in this app is built
// that way, so the three stream cards deliberately do not add up to the total
// and the screen says so rather than leaving someone to check the arithmetic.
//
// ── NO STACKED BAR, DELIBERATELY ───────────────────────────────────────────
// IPD is routinely over 90% of a branch's billing. In a stacked bar that
// leaves OPD and Pharmacy as one-pixel slivers — the chart shows a solid block
// and communicates nothing, which is worse than no chart.
//
// So the mix is three aligned FIGURES with their shares. At 90/5/5 that reads
// perfectly; at 40/40/20 it reads just as well. A visual encoding that fails
// on the actual distribution of the data is the wrong encoding, however good
// it looks on a mock.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import XLSX from 'xlsx-js-style';

import { get } from '../api/client';
import SectionHeader from '../design/components/SectionHeader';
import { useScopeRange } from '../scope/useScopeRange';
import { buildSummaryWorkbook } from './summaryExcel';
import { F, T, inr, inrCompact, num } from '../design/tokens';

const ENDPOINT = '/report/summaryReportV2';

// The three streams that make up the grand total, in the workbook's order so
// the screen and the export read the same way. IPD collection is deliberately
// absent — see the header.
const STREAMS = [
  { key: 'opd', label: 'OPD', color: '#2F6FA8' },
  { key: 'ipdInvoice', label: 'IPD', color: '#B3523B' },
  { key: 'pharmacy', label: 'Pharmacy', color: '#1E7A5A' },
];

const n0 = v => Number(v) || 0;

const MONTHS = [
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

const fmtDate = d => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return m ? `${Number(day)} ${MONTHS[Number(m) - 1]}` : String(d);
};

const BillingSummaryScreen = ({ navigation, route }) => {
  const { from, to } = useScopeRange(route);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('total');
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setData(await get(ENDPOINT, { from, to }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const allBranches = data?.branches || [];

  // Branches that failed are kept OUT of the table and listed at the bottom.
  // A branch showing ₹0 because its database was unreachable is a lie; a
  // branch named in an error list is a fact.
  const ok = useMemo(() => allBranches.filter(b => !b.error), [allBranches]);
  const failed = useMemo(() => allBranches.filter(b => b.error), [allBranches]);

  // Rank is by REVENUE always, even when the list is sorted A–Z — "3rd biggest"
  // should not change meaning because someone re-sorted the view.
  const rankOf = useMemo(() => {
    const byRevenue = [...ok].sort(
      (a, b) => n0(b.grandTotal) - n0(a.grandTotal),
    );
    const map = new Map();
    byRevenue.forEach((b, i) => map.set(b.location, i + 1));
    return map;
  }, [ok]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = q
      ? ok.filter(b =>
          String(b.location || '')
            .toLowerCase()
            .includes(q),
        )
      : [...ok];

    if (sortBy === 'name') {
      out.sort((a, b) => String(a.location).localeCompare(String(b.location)));
    } else {
      out.sort((a, b) => n0(b.grandTotal) - n0(a.grandTotal));
    }
    return out;
  }, [ok, query, sortBy]);

  const groupTotal = n0(summary.grandTotal);

  const exportExcel = async () => {
    if (!data?.summary || exporting) {
      return Alert.alert('Please wait', 'The summary is still loading.');
    }
    setExporting(true);
    try {
      const wb = buildSummaryWorkbook(data, from, to);
      const fileName = `All_Branch_Billing_Summary_${from}_to_${to}.xlsx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(
        filePath,
        XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }),
        'base64',
      );
      await Share.open({
        title: 'Billing Summary Report',
        filename: fileName,
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        failOnCancel: false,
      }).catch(e => {
        // Dismissing the share sheet is not a failure worth an alert.
        if (!/cancel/i.test(e?.message || '')) throw e;
      });
    } catch (e) {
      Alert.alert('Export failed', e?.message || String(e));
    } finally {
      setExporting(false);
    }
  };

  const header = (
    <View>
      <SectionHeader
        code="REPORTS"
        name="Billing Summary"
        sub={`${fmtDate(from)} – ${fmtDate(to)}`}
        hue={T.brand}
        onBack={() => navigation.goBack()}
      />

      <View style={st.body}>
        <View style={[st.statRow, { marginTop: -30 }]}>
          <Stat
            label="Total billed"
            value={inrCompact(summary.grandTotal)}
            note={`${num(ok.length)} branches`}
            color={T.text}
          />
          <Stat
            label="Patients"
            value={num(summary.visits)}
            note="confirmed visits"
            color={T.muted}
          />
        </View>

        <View style={[st.statRow, { marginTop: 9 }]}>
          <Stat
            label="Avg / patient"
            value={
              summary.avgPerPatient == null ? '—' : inr(summary.avgPerPatient)
            }
            note="per visit"
            color="#2F6FA8"
          />
          <Stat
            label="Avg / new patient"
            value={
              summary.avgPerNewPatient == null
                ? '—'
                : inr(summary.avgPerNewPatient)
            }
            // TOTAL revenue ÷ new patients — an acquisition figure, not what a
            // new patient spent. Saying so stops it reading as the latter.
            note={`${num(summary.newVisits)} new · all revenue`}
            color="#B3523B"
          />
        </View>

        <Text style={st.blockLabel}>REVENUE STREAM</Text>

        <View style={st.streamGrid}>
          {STREAMS.map(s => {
            const amount = n0(summary?.[s.key]?.total);
            const share =
              groupTotal > 0 ? Math.round((amount / groupTotal) * 100) : 0;
            return (
              <View key={s.key} style={st.streamCard}>
                <View style={[st.streamSpine, { backgroundColor: s.color }]} />
                <Text style={st.streamLabel}>{s.label.toUpperCase()}</Text>
                <Text
                  style={[st.streamVal, { color: s.color }]}
                  numberOfLines={1}
                >
                  {inrCompact(amount)}
                </Text>
                <Text style={st.streamNote}>{share}% of total</Text>
              </View>
            );
          })}
        </View>

        {/* IPD collection is reported but is NOT in the grand total — the
            BILLED invoice amount is. Said once here rather than discovered by
            someone adding the three cards up. */}
        <Text style={st.note}>
          Total = OPD + IPD billed + Pharmacy. IPD cash collection (
          {inrCompact(summary?.ipdCollection?.total)}) is shown per branch but
          is not part of it.
        </Text>
        {/* The old screen showed this as a chip in the IPD Invoice card. It is
            the discount allowed against billed IPD invoices — reported, but
            already deducted upstream, so it is a note rather than a card. */}
        {!!n0(summary?.ipdInvoice?.totalDiscount) && (
          <Text style={st.note}>
            IPD discount across all branches:{' '}
            {inrCompact(summary.ipdInvoice.totalDiscount)}.
          </Text>
        )}

        <View style={st.controls}>
          <View style={st.searchRow}>
            <Icon name="search" size={18} color={T.muted2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Branch"
              placeholderTextColor={T.muted2}
              style={st.search}
            />
            {!!query && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                accessibilityLabel="Clear search"
              >
                <Icon name="close" size={17} color={T.muted2} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={exportExcel}
            disabled={exporting || !data?.summary}
            style={[
              st.exportBtn,
              (exporting || !data?.summary) && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Export to Excel"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={T.brand} />
            ) : (
              <Icon name="file-download" size={18} color={T.brand} />
            )}
          </TouchableOpacity>
        </View>

        <View style={st.sortRow}>
          <Text style={st.sortLabel}>SORT BY</Text>
          {[
            { key: 'total', label: 'Highest first' },
            { key: 'name', label: 'A–Z' },
          ].map(s => {
            const on = sortBy === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => setSortBy(s.key)}
                style={[st.sortBtn, on && st.sortBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.sortText, on && st.sortTextOn]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  const footer = failed.length ? (
    <View style={st.failed}>
      <Text style={st.failedTitle}>
        {failed.length} branch{failed.length === 1 ? '' : 'es'} could not be
        read
      </Text>
      {failed.map(b => (
        <Text key={b.location} style={st.failedLine}>
          {b.location} — {b.error}
        </Text>
      ))}
      <Text style={st.failedNote}>
        These are excluded from the totals above, not counted as zero.
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(b, i) => `${b.location}-${i}`}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={T.brand}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={st.centre}>
              <ActivityIndicator color={T.brand} />
              <Text style={st.loadingNote}>
                Reading every branch — this takes a moment.
              </Text>
            </View>
          ) : (
            <Text style={st.empty}>
              {error || 'No billing for this period.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <BranchRow
            b={item}
            rank={rankOf.get(item.location)}
            groupTotal={groupTotal}
            open={expanded === item.location}
            onToggle={() =>
              setExpanded(expanded === item.location ? null : item.location)
            }
          />
        )}
      />
    </SafeAreaView>
  );
};

const Stat = ({ label, value, note, color, wide }) => (
  <View style={[st.stat, wide && { flex: 1.5 }]}>
    <Text style={st.statLabel} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={[st.statVal, { color }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={st.statNote} numberOfLines={1}>
      {note}
    </Text>
  </View>
);

/** A labelled amount inside the expanded detail. */
const Fig = ({ label, value, muted }) => (
  <View style={st.fig}>
    <Text style={st.figLabel}>{label}</Text>
    <Text style={[st.figVal, muted && { color: T.chevron }]}>{inr(value)}</Text>
  </View>
);

const Block = ({ label, color, d, cheque, note }) => (
  <View>
    <View style={st.blockTop}>
      <View style={[st.dot, { backgroundColor: color }]} />
      <Text style={st.blockHead}>{label.toUpperCase()}</Text>
      <Text style={st.blockTotal}>{inr(d?.total)}</Text>
    </View>
    <View style={st.figs}>
      <Fig label="CASH" value={d?.cash} muted={!n0(d?.cash)} />
      <Fig label="CARD" value={d?.card} muted={!n0(d?.card)} />
      <Fig label="ONLINE" value={d?.online} muted={!n0(d?.online)} />
      {/* Only IPD collection carries a cheque column. */}
      {cheque && (
        <Fig label="CHEQUE" value={d?.cheque} muted={!n0(d?.cheque)} />
      )}
    </View>
    {!!note && <Text style={st.blockNote}>{note}</Text>}
  </View>
);

const BranchRow = ({ b, rank, groupTotal, open, onToggle }) => {
  const total = n0(b.grandTotal);
  const share = groupTotal > 0 ? Math.round((total / groupTotal) * 100) : 0;

  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={0.8}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${b.location}, ${inr(total)}, ${share}% of group`}
    >
      <View style={st.rowTop}>
        {/* Position, not a bullet. With forty rows "4th biggest" is easier to
            hold than an amount, and it stays meaningful when the list is
            sorted A–Z. */}
        <Text style={st.rank}>{rank ?? '–'}</Text>
        <Text style={st.branch} numberOfLines={1}>
          {b.location}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.branchTotal}>{inrCompact(total)}</Text>
          <Text style={st.branchShare}>{share}% of group</Text>
        </View>
        <Icon
          name={open ? 'expand-less' : 'expand-more'}
          size={17}
          color={T.chevron}
        />
      </View>

      {/* Three aligned figures instead of a stacked bar. IPD is routinely over
          90% of a branch's billing, which turns a bar into a solid block with
          two invisible slivers — figures read correctly at any ratio.
          Each carries its own share, so the split is explicit. */}
      <View style={st.mix}>
        {STREAMS.map(s => {
          const amount = n0(b?.[s.key]?.total);
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
          return (
            <View key={s.key} style={st.mixCell}>
              <View style={st.mixHead}>
                <View style={[st.mixDot, { backgroundColor: s.color }]} />
                <Text style={st.mixLabel}>{s.label.toUpperCase()}</Text>
              </View>
              <Text
                style={[st.mixVal, !amount && { color: T.chevron }]}
                numberOfLines={1}
              >
                {inrCompact(amount)}
              </Text>
              <Text style={st.mixPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>

      {open && (
        <View style={st.detail}>
          <Block label="OPD" color="#2F6FA8" d={b.opd} />
          <Block label="Pharmacy" color="#1E7A5A" d={b.pharmacy} />
          <Block
            label="IPD collection"
            color="#B3523B"
            d={b.ipdCollection}
            cheque
            // Reported per branch but excluded from the grand total — said on
            // the block it belongs to, not only in the header note.
            note="not in the total"
          />

          {!!b.ipdInvoice?.byStatus && (
            <View>
              <Text style={st.blockHead}>IPD BILLED BY TYPE</Text>
              {Object.entries(b.ipdInvoice.byStatus).map(([k, v]) => (
                <View key={k} style={st.statusRow}>
                  <Text style={st.statusName}>{k}</Text>
                  <Text style={st.statusVal}>{inr(v)}</Text>
                </View>
              ))}
              {/* Carried over from the old screen, which showed discount as a
                  chip alongside the statuses. */}
              {!!n0(b.ipdInvoice.totalDiscount) && (
                <View style={st.statusRow}>
                  <Text style={[st.statusName, { color: '#B26A00' }]}>
                    Discount
                  </Text>
                  <Text style={[st.statusVal, { color: '#B26A00' }]}>
                    {inr(b.ipdInvoice.totalDiscount)}
                  </Text>
                </View>
              )}
              <View style={[st.statusRow, st.statusTotal]}>
                <Text style={[st.statusName, st.bold]}>Total</Text>
                <Text style={[st.statusVal, st.bold]}>
                  {inr(b.ipdInvoice.total)}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default BillingSummaryScreen;

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  centre: { paddingVertical: 50, alignItems: 'center' },
  loadingNote: {
    fontSize: 11.5,
    color: T.muted2,
    marginTop: 12,
    fontFamily: F.regular,
  },
  body: { paddingHorizontal: 16 },
  empty: {
    textAlign: 'center',
    color: T.muted,
    marginTop: 30,
    marginHorizontal: 28,
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  statRow: { flexDirection: 'row', gap: 9 },
  stat: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 11,
  },
  statLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  statVal: {
    fontFamily: F.mono,
    fontSize: 19,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  statNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },

  blockLabel: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: T.muted2,
    marginTop: 22,
    marginBottom: 9,
    marginHorizontal: 2,
  },

  streamGrid: { flexDirection: 'row', gap: 9 },
  streamCard: {
    flex: 1,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  streamSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  streamLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  streamVal: {
    fontFamily: F.mono,
    fontSize: 15,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  streamNote: {
    fontSize: 9,
    color: T.muted2,
    marginTop: 4,
    fontFamily: F.regular,
  },

  note: {
    fontSize: 10,
    color: T.muted2,
    marginTop: 11,
    fontFamily: F.regular,
    lineHeight: 14,
  },

  controls: { flexDirection: 'row', gap: 9, marginTop: 18 },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.text,
    fontFamily: F.regular,
  },
  exportBtn: {
    width: 44,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 11,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 11,
    marginBottom: 2,
  },
  sortLabel: {
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  sortBtn: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 11,
    backgroundColor: T.card,
  },
  sortBtnOn: { borderColor: T.brand, backgroundColor: '#EAF2ED' },
  sortText: { fontSize: 11, color: T.muted, fontFamily: F.regular },
  sortTextOn: { color: T.brand, fontFamily: F.medium },

  row: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 9,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rank: { width: 18, fontFamily: F.mono, fontSize: 10, color: T.muted2 },
  branch: { flex: 1, fontSize: 13.5, fontFamily: F.medium, color: T.text },
  branchTotal: {
    fontFamily: F.mono,
    fontSize: 14,
    color: T.text,
    letterSpacing: -0.3,
  },
  branchShare: {
    fontFamily: F.mono,
    fontSize: 9,
    color: T.muted2,
    marginTop: 3,
  },

  mix: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    marginLeft: 27,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  mixCell: { flex: 1 },
  mixHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mixDot: { width: 6, height: 6, borderRadius: 2 },
  mixLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  mixVal: {
    fontFamily: F.mono,
    fontSize: 12.5,
    color: T.text,
    marginTop: 5,
    letterSpacing: -0.2,
  },
  mixPct: { fontFamily: F.mono, fontSize: 9, color: T.muted2, marginTop: 3 },

  detail: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
    gap: 14,
  },
  blockTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  blockHead: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    color: T.muted,
  },
  blockTotal: { fontFamily: F.mono, fontSize: 12, color: T.text },
  blockNote: {
    fontSize: 9.5,
    color: T.muted2,
    marginTop: 5,
    fontFamily: F.regular,
  },
  figs: { flexDirection: 'row', gap: 8, marginTop: 7 },
  fig: { flex: 1 },
  figLabel: {
    fontFamily: F.mono,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: T.muted2,
  },
  figVal: { fontFamily: F.mono, fontSize: 11, color: T.text, marginTop: 3 },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
  },
  statusTotal: {
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
    marginTop: 3,
    paddingTop: 7,
  },
  statusName: { fontSize: 11.5, color: T.text, fontFamily: F.regular },
  statusVal: { fontFamily: F.mono, fontSize: 11.5, color: T.text },
  bold: { fontWeight: '600' },

  failed: {
    backgroundColor: '#FBEDEB',
    borderWidth: 1,
    borderColor: '#F0CFCA',
    borderRadius: 12,
    padding: 13,
    marginHorizontal: 16,
    marginTop: 16,
  },
  failedTitle: { fontSize: 12, fontFamily: F.medium, color: T.crit },
  failedLine: { fontFamily: F.mono, fontSize: 10, color: T.text, marginTop: 6 },
  failedNote: {
    fontSize: 10,
    color: T.muted,
    marginTop: 9,
    fontFamily: F.regular,
  },
});
