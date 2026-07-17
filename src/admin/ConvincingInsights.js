/* eslint-disable prettier/prettier */
// ConvincingInsights.js
// ─────────────────────────────────────────────────────────────────────────────
// Two presentational pieces for the Convincing Score screen:
//   • InsightsModal          – tap a top tile → gender / doctor-wise / disease-wise
//   • SpecialityDetailTable  – per-doctor speciality sub-types with Seen/Advised/Surgery
// Both are fed by GET /hms/convincingInsights. Fully self-contained.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';

const P = {
  ink: '#18181A',
  mid: '#6B6A68',
  light: '#A09F9C',
  line: 'rgba(0,0,0,0.08)',
  bg: '#F4F6F4',
  card: '#FFFFFF',
  male: '#185FA5',
  female: '#B0338B',
  other: '#8A8A8A',
};

const nf = n => new Intl.NumberFormat('en-IN').format(Number(n) || 0);
const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

/* ── A simple 2-column (name → count) table ─────────────────────────────────*/
const CountTable = ({ title, rows, accent, total }) => (
  <View style={styles.block}>
    <Text style={styles.blockTitle}>{title}</Text>
    <View style={styles.tHeadRow}>
      <Text style={[styles.tHead, { flex: 1 }]}>{title.includes('Doctor') ? 'Doctor' : 'Disease'}</Text>
      <Text style={[styles.tHead, styles.tNumCol]}>Count</Text>
      <Text style={[styles.tHead, styles.tPctCol]}>%</Text>
    </View>
    {rows && rows.length ? (
      rows.map((r, i) => (
        <View key={`${r.name}-${i}`} style={styles.tRow}>
          <Text style={[styles.tCell, { flex: 1 }]} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[styles.tCell, styles.tNumCol, { color: accent, fontWeight: '700' }]}>
            {nf(r.count)}
          </Text>
          <Text style={[styles.tCell, styles.tPctCol, { color: P.mid }]}>
            {pct(r.count, total)}%
          </Text>
        </View>
      ))
    ) : (
      <Text style={styles.emptyRow}>No data</Text>
    )}
  </View>
);

/* ── Drill-down modal for a tapped tile ─────────────────────────────────────*/
export const InsightsModal = ({ visible, metricLabel, data, accent = '#3B6D11', onClose }) => {
  const g = (data && data.gender) || { Male: 0, Female: 0, Other: 0 };
  const total = (data && data.total) || 0;

  const GenderPill = ({ label, value, color }) => (
    <View style={[styles.gPill, { borderColor: color + '55', backgroundColor: color + '12' }]}>
      <Text style={[styles.gVal, { color }]}>{nf(value)}</Text>
      <Text style={styles.gLabel}>
        {label} · {pct(value, total)}%
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{metricLabel}</Text>
              <Text style={styles.sheetSub}>{nf(total)} patients</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Gender */}
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Gender</Text>
              <View style={styles.gRow}>
                <GenderPill label="Male" value={g.Male} color={P.male} />
                <GenderPill label="Female" value={g.Female} color={P.female} />
                {g.Other ? <GenderPill label="Other" value={g.Other} color={P.other} /> : null}
              </View>
            </View>

            <CountTable title="Doctor-wise" rows={data?.byDoctor} accent={accent} total={total} />
            <CountTable title="Disease-wise" rows={data?.byDisease} accent={accent} total={total} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ── Per-doctor speciality sub-types with Seen / Advised / Surgery ──────────*/
export const SpecialityDetailTable = ({ specialities, accent = '#3B6D11' }) => {
  if (!specialities || specialities.length === 0) return null;
  return (
    <View style={styles.detailWrap}>
      <Text style={styles.detailHeading}>Speciality Details</Text>
      <View style={styles.dHeadRow}>
        <Text style={[styles.dHead, { flex: 1 }]}>Speciality / Sub-type</Text>
        <Text style={[styles.dHead, styles.dNum]}>Seen</Text>
        <Text style={[styles.dHead, styles.dNum]}>Adv.</Text>
        <Text style={[styles.dHead, styles.dNum]}>Sx</Text>
      </View>

      {specialities.map((s, i) => (
        <View key={`${s.speciality}-${i}`} style={styles.specGroup}>
          <View style={styles.specRow}>
            <Text style={[styles.specName, { flex: 1 }]} numberOfLines={1}>
              {s.speciality}
            </Text>
            <Text style={[styles.specNum, styles.dNum]}>{nf(s.seen)}</Text>
            <Text style={[styles.specNum, styles.dNum]}>{nf(s.advised)}</Text>
            <Text style={[styles.specNum, styles.dNum, { color: accent }]}>{nf(s.surgery)}</Text>
          </View>

          {s.subTypes && s.subTypes.length
            ? s.subTypes.map((t, j) => (
                <View key={`${t.name}-${j}`} style={styles.subRow}>
                  <Text style={[styles.subName, { flex: 1 }]} numberOfLines={1}>
                    ↳ {t.name}
                  </Text>
                  <Text style={[styles.subNum, styles.dNum]}>{nf(t.seen)}</Text>
                  <Text style={[styles.subNum, styles.dNum]}>{nf(t.advised)}</Text>
                  <Text style={[styles.subNum, styles.dNum, { color: accent }]}>{nf(t.surgery)}</Text>
                </View>
              ))
            : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  /* modal */
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: P.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: '82%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: P.ink },
  sheetSub: { fontSize: 13, color: P.mid, marginTop: 2 },
  close: { fontSize: 20, color: P.mid, paddingHorizontal: 6 },

  block: {
    backgroundColor: P.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.line,
    padding: 12,
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: P.mid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  gRow: { flexDirection: 'row', flexWrap: 'wrap' },
  gPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 8,
    minWidth: 92,
  },
  gVal: { fontSize: 20, fontWeight: '800' },
  gLabel: { fontSize: 12, color: P.mid, marginTop: 2 },

  tHeadRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
  },
  tHead: { fontSize: 12, fontWeight: '700', color: P.light, textTransform: 'uppercase' },
  tNumCol: { width: 56, textAlign: 'right' },
  tPctCol: { width: 48, textAlign: 'right' },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE9',
  },
  tCell: { fontSize: 14, color: P.ink },
  emptyRow: { fontSize: 13, color: P.light, paddingVertical: 10, textAlign: 'center' },

  /* speciality detail */
  detailWrap: { marginTop: 16 },
  detailHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: P.mid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dHeadRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
  },
  dHead: { fontSize: 11, fontWeight: '700', color: P.light, textTransform: 'uppercase' },
  dNum: { width: 46, textAlign: 'right' },
  specGroup: { paddingTop: 6 },
  specRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  specName: { fontSize: 14, fontWeight: '700', color: P.ink },
  specNum: { fontSize: 14, fontWeight: '700', color: P.ink },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 6,
  },
  subName: { fontSize: 13, color: P.mid },
  subNum: { fontSize: 13, color: P.mid },
});

export default InsightsModal;
