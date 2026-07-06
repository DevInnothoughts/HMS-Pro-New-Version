/**
 * IHXPatientTracker.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * React Native — Patient list + IHX claim timeline detail
 *
 * Status ID mapping sourced from official "IHX Status ID Master" document.
 *
 * Usage:
 *   import IHXPatientTracker from './IHXPatientTracker';
 *   <IHXPatientTracker data={backendResponseArray} />
 *
 * For React Navigation users, named exports are also available:
 *   import { PatientListScreen, ClaimDetailScreen } from './IHXPatientTracker';
 */
import { useRoute } from '@react-navigation/native';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  UIManager,
  LayoutAnimation,
  StatusBar,
  Image,
} from 'react-native';
import { ActivityIndicator, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Official IHX Status ID Master ───────────────────────────────────────────
//
//  Insurer Stage     │ Hospital Stage        │ IHX Status                    │ ID
//  ──────────────────┼───────────────────────┼───────────────────────────────┼────
//  Pre-Authorization │ New Admission         │ Pre-Auth Initiated            │  1
//                    │                       │ Pre-Auth In Progress          │ 31
//                    │                       │ Pre-Auth Processing           │ 26
//                    │                       │ Pre-Auth Submitted to Payer   │ 27
//                    │                       │ Pre-Auth Approved             │  2
//                    │                       │ Pre-Auth Query                │  5
//                    │                       │ Pre-Auth Query Replied        │  6
//                    │                       │ Pre-Auth Denied               │  7
//                    ├───────────────────────┼───────────────────────────────┼────
//                    │ Enhancement           │ Enhancement Initiated         │  3
//                    │                       │ Enhancement Approved          │  4
//                    │                       │ Enhancement Query             │ 40
//                    │                       │ Enhancement Query Replied     │ 41
//                    │                       │ Enhancement Request Rejected  │ 38
//                    │                       │ Enhancement Denied            │  9
//                    ├───────────────────────┼───────────────────────────────┼────
//                    │ Discharge             │ Discharge Initiated           │  8
//                    │                       │ Discharge Approved            │ 37
//                    │                       │ Discharge Query               │ 42
//                    │                       │ Discharge Query Replied       │ 43
//                    │                       │ Discharge Request Rejected    │ 39
//                    │                       │ Discharge Denied              │ 61
//                    ├───────────────────────┼───────────────────────────────┼────
//                    │ Early Discharge       │ Early Discharge Initiated     │ 54
//                    │ (HDFC only)           │ Early Discharge Approved      │ 55
//                    │                       │ Early Discharge Denied        │ 56
//                    │                       │ Early Discharge Query         │ 57
//                    │                       │ Early Discharge Query Replied │ 58
//  ──────────────────┼───────────────────────┼───────────────────────────────┼────
//  Claim Settlement  │ Settlement            │ Settlement Initiated          │ 10
//                    │                       │ Claim in Progress             │ 14
//                    │                       │ Claim Approved                │ 15
//                    │                       │ Claim Denied                  │ 16
//                    │                       │ Claim Query                   │ 17
//                    │                       │ Claim Query Replied           │ 52
//                    │                       │ Settled                       │ 12
//  ──────────────────┼───────────────────────┼───────────────────────────────┼────
//  Common            │ Any                   │ Processing                    │ 11
//                    │                       │ Reconsider Request Submitted  │ 53
//                    │                       │ Cancelled                     │ 13

export const IHX_STATUS_MAP = {
  // Pre-Authorization — New Admission
  1: {
    name: 'Pre-Auth Initiated',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'initiated',
  },
  31: {
    name: 'Pre-Auth In Progress',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'processing',
  },
  26: {
    name: 'Pre-Auth Processing',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'processing',
  },
  27: {
    name: 'Pre-Auth Submitted to Payer',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'processing',
  },
  2: {
    name: 'Pre-Auth Approved',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'approved',
  },
  5: {
    name: 'Pre-Auth Query',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'query',
  },
  6: {
    name: 'Pre-Auth Query Replied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'replied',
  },
  7: {
    name: 'Pre-Auth Denied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'New Admission',
    type: 'denied',
  },

  // Pre-Authorization — Enhancement
  3: {
    name: 'Enhancement Initiated',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Enhancement',
    type: 'initiated',
  },
  4: {
    name: 'Enhancement Approved',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Enhancement',
    type: 'approved',
  },
  40: {
    name: 'Enhancement Query',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Enhancement',
    type: 'query',
  },
  41: {
    name: 'Enhancement Query Replied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Enhancement',
    type: 'replied',
  },
  38: {
    name: 'Enhancement Request Rejected',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Enhancement',
    type: 'denied',
  },
  9: {
    name: 'Enhancement Denied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Enhancement',
    type: 'denied',
  },

  // Pre-Authorization — Discharge
  8: {
    name: 'Discharge Initiated',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Discharge',
    type: 'initiated',
  },
  37: {
    name: 'Discharge Approved',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Discharge',
    type: 'approved',
  },
  42: {
    name: 'Discharge Query',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Discharge',
    type: 'query',
  },
  43: {
    name: 'Discharge Query Replied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Discharge',
    type: 'replied',
  },
  39: {
    name: 'Discharge Request Rejected',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Discharge',
    type: 'denied',
  },
  61: {
    name: 'Discharge Denied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Discharge',
    type: 'denied',
  },

  // Pre-Authorization — Early Discharge (HDFC only)
  54: {
    name: 'Early Discharge Initiated',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Early Discharge',
    type: 'initiated',
  },
  55: {
    name: 'Early Discharge Approved',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Early Discharge',
    type: 'approved',
  },
  56: {
    name: 'Early Discharge Denied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Early Discharge',
    type: 'denied',
  },
  57: {
    name: 'Early Discharge Query',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Early Discharge',
    type: 'query',
  },
  58: {
    name: 'Early Discharge Query Replied',
    insurerStage: 'Pre-Authorization',
    hospitalStage: 'Early Discharge',
    type: 'replied',
  },

  // Claim Settlement
  10: {
    name: 'Settlement Initiated',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'initiated',
  },
  14: {
    name: 'Claim in Progress',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'processing',
  },
  15: {
    name: 'Claim Approved',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'approved',
  },
  16: {
    name: 'Claim Denied',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'denied',
  },
  17: {
    name: 'Claim Query',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'query',
  },
  52: {
    name: 'Claim Query Replied',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'replied',
  },
  12: {
    name: 'Settled',
    insurerStage: 'Claim Settlement',
    hospitalStage: 'Settlement',
    type: 'settled',
  },

  // Common — Any stage
  11: {
    name: 'Processing',
    insurerStage: 'Common',
    hospitalStage: 'Any',
    type: 'processing',
  },
  53: {
    name: 'Reconsider Request Submitted',
    insurerStage: 'Common',
    hospitalStage: 'Any',
    type: 'reconsider',
  },
  13: {
    name: 'Cancelled',
    insurerStage: 'Common',
    hospitalStage: 'Any',
    type: 'cancelled',
  },
};

// ─── Type → Visual Config ─────────────────────────────────────────────────────

const TYPE_CFG = {
  initiated: {
    bg: '#EEE9FE',
    text: '#4A2DB3',
    dot: '#6B4FD6',
    bar: '#6B4FD6',
    progress: 15,
  },
  processing: {
    bg: '#E3EFFE',
    text: '#1455A4',
    dot: '#2E72D2',
    bar: '#2E72D2',
    progress: 35,
  },
  approved: {
    bg: '#E6F4D9',
    text: '#2E6B0E',
    dot: '#5BAB26',
    bar: '#5BAB26',
    progress: 75,
  },
  query: {
    bg: '#FEF0D9',
    text: '#7A4B09',
    dot: '#CF8018',
    bar: '#CF8018',
    progress: 50,
  },
  replied: {
    bg: '#FFF5E0',
    text: '#6B4400',
    dot: '#E8A020',
    bar: '#E8A020',
    progress: 55,
  },
  denied: {
    bg: '#FCE8E8',
    text: '#B52323',
    dot: '#D93535',
    bar: '#D93535',
    progress: 100,
  },
  settled: {
    bg: '#D9F2EA',
    text: '#0D6644',
    dot: '#12946A',
    bar: '#12946A',
    progress: 100,
  },
  reconsider: {
    bg: '#FDE8FB',
    text: '#7A1B78',
    dot: '#B430B0',
    bar: '#B430B0',
    progress: 60,
  },
  cancelled: {
    bg: '#F2E8E8',
    text: '#7A2020',
    dot: '#A83030',
    bar: '#A83030',
    progress: 100,
  },
  unknown: {
    bg: '#EBEBEB',
    text: '#555553',
    dot: '#888886',
    bar: '#888886',
    progress: 10,
  },
};

// ─── 4-Step Journey Stages ────────────────────────────────────────────────────

const JOURNEY_STAGES = [
  { key: 'preauth', label: 'Pre-Auth', ids: [1, 31, 26, 27, 2, 5, 6, 7] },
  { key: 'enhance', label: 'Enhancement', ids: [3, 4, 40, 41, 38, 9] },
  {
    key: 'discharge',
    label: 'Discharge',
    ids: [8, 37, 42, 43, 39, 61, 54, 55, 56, 57, 58],
  },
  {
    key: 'settlement',
    label: 'Settlement',
    ids: [10, 14, 15, 16, 17, 52, 12, 11, 53, 13],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveStatus(statusId, statusName = '') {
  if (statusId && IHX_STATUS_MAP[statusId]) return IHX_STATUS_MAP[statusId];
  // Fallback for any unknown future IDs — derive type from name
  const s = statusName.toLowerCase();
  let type = 'unknown';
  if (s.includes('settled')) type = 'settled';
  else if (s.includes('approved')) type = 'approved';
  else if (s.includes('denied') || s.includes('rejected')) type = 'denied';
  else if (s.includes('query replied')) type = 'replied';
  else if (s.includes('query')) type = 'query';
  else if (s.includes('cancelled')) type = 'cancelled';
  else if (s.includes('reconsider')) type = 'reconsider';
  else if (s.includes('initiated')) type = 'initiated';
  else if (
    s.includes('processing') ||
    s.includes('in progress') ||
    s.includes('submitted')
  )
    type = 'processing';
  return {
    name: statusName,
    insurerStage: 'Unknown',
    hospitalStage: 'Unknown',
    type,
  };
}

function cfgFor(statusId, statusName) {
  return TYPE_CFG[resolveStatus(statusId, statusName).type] || TYPE_CFG.unknown;
}

function parseIHXData(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return [...arr].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
  } catch {
    return [];
  }
}

function latestEvent(events) {
  return events.length ? events[events.length - 1] : null;
}

function fmtINR(n) {
  if (n == null || n === '') return '—';
  return '₹' + Math.round(Number(n)).toLocaleString('en-IN');
}
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() || '??'
  );
}
function avatarPalette(name = '') {
  const h =
    ((name.charCodeAt(0) || 65) * 37 + (name.charCodeAt(1) || 65) * 13) % 360;
  return { bg: `hsl(${h},42%,88%)`, fg: `hsl(${h},50%,26%)` };
}
function shortLabel(name = '') {
  return name
    .replace('Pre-Auth ', '')
    .replace('Enhancement ', '')
    .replace('Discharge ', '')
    .replace('Settlement ', '')
    .replace('Early Discharge ', '')
    .replace('Claim ', '')
    .trim();
}

// ─── Reusable UI Atoms ────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }) {
  const { bg, fg } = avatarPalette(name);
  return (
    <View
      style={[
        S.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[S.avatarText, { color: fg, fontSize: size * 0.33 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

function StatusBadge({ statusId, statusName, compact = false }) {
  const meta = resolveStatus(statusId, statusName);
  const cfg = TYPE_CFG[meta.type] || TYPE_CFG.unknown;
  return (
    <View style={[S.badge, { backgroundColor: cfg.bg }]}>
      <Text
        style={[S.badgeText, { color: cfg.text }, compact && { fontSize: 10 }]}
        numberOfLines={1}
      >
        {compact ? shortLabel(meta.name) : meta.name}
      </Text>
    </View>
  );
}

// ─── Journey Bar ─────────────────────────────────────────────────────────────

function JourneyBar({ events }) {
  const reached = new Set();
  let activeKey = null;
  events.forEach(ev => {
    JOURNEY_STAGES.forEach(st => {
      if (st.ids.includes(ev.statusId)) reached.add(st.key);
    });
  });
  const last = latestEvent(events);
  if (last) {
    JOURNEY_STAGES.forEach(st => {
      if (st.ids.includes(last.statusId)) activeKey = st.key;
    });
  }
  let maxIdx = -1;
  JOURNEY_STAGES.forEach((st, i) => {
    if (reached.has(st.key)) maxIdx = i;
  });

  return (
    <View style={S.journeyWrap}>
      {JOURNEY_STAGES.map((stage, idx) => {
        const isReached = reached.has(stage.key);
        const isActive = stage.key === activeKey;
        const isLast = idx === JOURNEY_STAGES.length - 1;
        return (
          <React.Fragment key={stage.key}>
            <View
              style={[
                S.stagePill,
                isReached && S.stagePillReached,
                isActive && S.stagePillActive,
              ]}
            >
              <Text
                style={[
                  S.stagePillText,
                  isReached && S.stagePillTxtReached,
                  isActive && S.stagePillTxtActive,
                ]}
              >
                {stage.label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  S.journeyLine,
                  isReached && idx < maxIdx && S.journeyLineFilled,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Timeline Row ─────────────────────────────────────────────────────────────

function TimelineRow({ event, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const meta = resolveStatus(event.statusId, event.statusName);
  const cfg = TYPE_CFG[meta.type] || TYPE_CFG.unknown;

  const rawRemark = (event.remarks || '').trim();
  const noiseWords = [
    'in progress',
    'in_progress',
    'ir',
    'ans',
    'bill',
    'final bill',
    'initial',
    'letter',
  ];
  const isNoise = noiseWords.includes(rawRemark.toLowerCase());
  const hasRemark = rawRemark.length > 0 && !isNoise;
  const flat = rawRemark.replace(/\n+/g, ' ');
  const long = flat.length > 130;
  const display = expanded
    ? rawRemark
    : flat.substring(0, 130) + (long ? '…' : '');

  return (
    <View style={S.tlRow}>
      {/* Spine: line → dot → line */}
      <View style={S.tlSpine}>
        <View
          style={[
            S.tlLineTop,
            { backgroundColor: isFirst ? 'transparent' : cfg.dot + '44' },
          ]}
        />
        <View
          style={[S.tlDot, { backgroundColor: cfg.dot, borderColor: cfg.bg }]}
        />
        <View
          style={[
            S.tlLineBot,
            { backgroundColor: isLast ? 'transparent' : cfg.dot + '44' },
          ]}
        />
      </View>

      {/* Content */}
      <View style={[S.tlBody, isLast && { paddingBottom: 0 }]}>
        {/* Hospital stage pill + Status ID chip */}
        <View style={S.tlTagRow}>
          <View style={[S.phaseTag, { backgroundColor: cfg.bg }]}>
            <Text style={[S.phaseTagText, { color: cfg.text }]}>
              {meta.hospitalStage}
            </Text>
          </View>
          <View style={S.idChip}>
            <Text style={S.idChipText}>ID {event.statusId}</Text>
          </View>
        </View>

        {/* Status name + timestamp */}
        <View style={S.tlTopRow}>
          <Text style={S.tlStatus}>{meta.name}</Text>
          <Text style={S.tlTime}>{fmtTime(event.timestamp)}</Text>
        </View>
        <Text style={S.tlDate}>{fmtDate(event.timestamp)}</Text>

        {/* Amount pills */}
        <View style={S.tlAmounts}>
          {event.claimedAmount != null && (
            <View style={S.amtPill}>
              <Text style={S.amtPillLabel}>Claimed</Text>
              <Text style={S.amtPillVal}>{fmtINR(event.claimedAmount)}</Text>
            </View>
          )}
          {event.approvedAmount != null && (
            <View style={S.amtPill}>
              <Text style={S.amtPillLabel}>Approved</Text>
              <Text style={[S.amtPillVal, { color: TYPE_CFG.approved.text }]}>
                {fmtINR(event.approvedAmount)}
              </Text>
            </View>
          )}
          {event.settledAmount != null && (
            <View style={S.amtPill}>
              <Text style={S.amtPillLabel}>Settled</Text>
              <Text style={[S.amtPillVal, { color: TYPE_CFG.settled.text }]}>
                {fmtINR(event.settledAmount)}
              </Text>
            </View>
          )}
          {event.utrNo && event.utrNo !== 'NA' && (
            <View style={[S.amtPill, { backgroundColor: '#E3EFFE' }]}>
              <Text style={[S.amtPillLabel, { color: '#1455A4' }]}>UTR</Text>
              <Text style={[S.amtPillVal, { color: '#1455A4' }]}>
                {event.utrNo}
              </Text>
            </View>
          )}
        </View>

        {/* Remark */}
        {hasRemark && (
          <TouchableOpacity
            activeOpacity={long ? 0.7 : 1}
            onPress={() => long && setExpanded(v => !v)}
            style={[S.remarkBox, { borderLeftColor: cfg.dot }]}
          >
            <Text style={S.remarkText}>{display}</Text>
            {long && (
              <Text style={[S.remarkToggle, { color: cfg.text }]}>
                {expanded ? 'Show less ↑' : 'Read more ↓'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Screen 2 — Claim Detail ──────────────────────────────────────────────────

export function ClaimDetailScreen({ patient, onBack }) {
  const events = useMemo(() => parseIHXData(patient.IHXData), [patient]);
  const last = latestEvent(events);
  const meta = last ? resolveStatus(last.statusId, last.statusName) : null;
  const cfg = meta ? TYPE_CFG[meta.type] || TYPE_CFG.unknown : TYPE_CFG.unknown;

  const payable = Number(patient.payable_amt) || 0;
  const total = Number(patient.totalamt) || 0;

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0EEE9" />

      {/* Nav bar */}
      <View style={S.navBar}>
        <TouchableOpacity
          onPress={onBack}
          style={S.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={S.backArrow}>←</Text>
          <Text style={S.backText}>Patients</Text>
        </TouchableOpacity>
        <Text style={S.navClaimNo} numberOfLines={1}>
          {last?.claimNumber || '—'}
        </Text>
      </View>

      <ScrollView
        style={S.root}
        contentContainerStyle={S.detailPad}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={S.heroCard}>
          {/* Top: avatar + name + badge */}
          <View style={S.heroTop}>
            <Avatar name={patient.name} size={50} />
            <View style={S.heroInfo}>
              <Text style={S.heroName}>{patient.name}</Text>
              <Text style={S.heroMeta}>
                {patient.sex} · {patient.phone}
              </Text>
              <Text style={S.heroMeta}>Invoice #{patient.invoice_id}</Text>
            </View>
            {last && (
              <StatusBadge
                statusId={last.statusId}
                statusName={last.statusName}
              />
            )}
          </View>

          {/* Amount strip */}
          <View style={S.amtStrip}>
            {[
              { label: 'Total Bill', value: total, color: null },
              {
                label: 'Approved',
                value: last?.approvedAmount,
                color: TYPE_CFG.approved.text,
              },
              // {
              //   label: 'Payable',
              //   value: payable,
              //   color:
              //     payable > 0 ? TYPE_CFG.denied.text : TYPE_CFG.approved.text,
              // },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && <View style={S.amtDivider} />}
                <View style={S.amtBlock}>
                  <Text style={S.amtLabel}>{item.label}</Text>
                  <Text style={[S.amtVal, item.color && { color: item.color }]}>
                    {fmtINR(item.value)}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Insurer / Hospital stage chips */}
          {meta && (
            <View style={S.stageRow}>
              <View style={S.stageChip}>
                <Text style={S.stageChipLabel}>Insurer Stage</Text>
                <Text style={S.stageChipVal}>{meta.insurerStage}</Text>
              </View>
              <View style={S.stageChip}>
                <Text style={S.stageChipLabel}>Hospital Stage</Text>
                <Text style={S.stageChipVal}>{meta.hospitalStage}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Journey bar */}
        <JourneyBar events={events} />

        {/* Timeline */}
        <View style={S.sectionHdr}>
          <Text style={S.sectionTitle}>Claim Timeline</Text>
          <Text style={S.sectionCount}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {events.length === 0 ? (
          <View style={S.emptyBox}>
            <Text style={S.emptyText}>No IHX events found</Text>
          </View>
        ) : (
          <View style={S.tlCard}>
            {events.map((ev, i) => (
              <TimelineRow
                key={`${ev.statusId}-${ev.timestamp}-${i}`}
                event={ev}
                isFirst={i === 0}
                isLast={i === events.length - 1}
              />
            ))}
          </View>
        )}

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Patient Card ─────────────────────────────────────────────────────────────

function PatientCard({ patient, onPress }) {
  const events = useMemo(() => parseIHXData(patient.IHXData), [patient]);
  const last = latestEvent(events);
  const cfg = last ? cfgFor(last.statusId, last.statusName) : TYPE_CFG.unknown;
  const payable = Number(patient.payable_amt) || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(patient)}
      style={S.pCard}
    >
      <View style={[S.pCardAccent, { backgroundColor: cfg.bar }]} />
      <View style={S.pCardBody}>
        <View style={S.pCardTop}>
          <Avatar name={patient.name} size={42} />
          <View style={S.pCardNameBlock}>
            <Text style={S.pCardName} numberOfLines={1}>
              {patient.name}
            </Text>
            <Text style={S.pCardSub}>
              {patient.sex} · {patient.phone}
            </Text>
          </View>
          {last && (
            <StatusBadge
              statusId={last.statusId}
              statusName={last.statusName}
              compact
            />
          )}
        </View>

        <View style={S.pCardAmts}>
          {[
            { label: 'Total', value: patient.totalamt, color: null },
            {
              label: 'Approved',
              value: last?.approvedAmount,
              color: TYPE_CFG.approved.text,
            },
            // {
            //   label: 'Payable',
            //   value: payable,
            //   color: payable > 0 ? TYPE_CFG.denied.text : null,
            // },
          ].map((item, i) => (
            <View
              key={item.label}
              style={[S.pCardAmtCell, i > 0 && S.pCardAmtCellBorder]}
            >
              <Text style={S.pCardAmtLabel}>{item.label}</Text>
              <Text
                style={[S.pCardAmtVal, item.color && { color: item.color }]}
              >
                {fmtINR(item.value)}
              </Text>
            </View>
          ))}
        </View>

        <View style={S.pCardFooter}>
          <Text style={S.pCardClaimNo} numberOfLines={1}>
            {last?.claimNumber || 'Pending claim no.'}
          </Text>
          <Text style={S.pCardUpdates}>
            {events.length} update{events.length !== 1 ? 's' : ''} ›
          </Text>
        </View>

        {/* Mini progress bar */}
        <View style={S.miniTrack}>
          <View
            style={[
              S.miniFill,
              { width: `${cfg.progress}%`, backgroundColor: cfg.bar },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen 1 — Patient List ──────────────────────────────────────────────────

export function PatientListScreen({ data = [], onSelectPatient, navigation }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const stats = useMemo(() => {
    const out = {
      total: data.length,
      approved: 0,
      pending: 0,
      denied: 0,
      settled: 0,
      query: 0,
    };
    data.forEach(p => {
      const evs = parseIHXData(p.IHXData);
      const last = latestEvent(evs);
      if (!last) return;
      const type = resolveStatus(last.statusId, last.statusName).type;
      if (type === 'approved') out.approved++;
      if (type === 'denied') out.denied++;
      if (type === 'settled') out.settled++;
      if (type === 'query') out.query++;
      if (['initiated', 'processing', 'replied', 'reconsider'].includes(type))
        out.pending++;
    });
    return out;
  }, [data]);

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'initiated', label: 'Initiated' },
    { key: 'processing', label: 'Processing' },
    { key: 'approved', label: 'Approved' },
    { key: 'query', label: 'Query' },
    { key: 'replied', label: 'Query Replied' },
    { key: 'denied', label: 'Denied' },
    { key: 'reconsider', label: 'Reconsider' },
    { key: 'settled', label: 'Settled' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const filtered = useMemo(
    () =>
      data.filter(p => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          String(p.invoice_id).includes(q) ||
          String(p.phone).includes(q);
        if (!matchSearch) return false;
        if (filter === 'all') return true;
        const evs = parseIHXData(p.IHXData);
        const last = latestEvent(evs);
        return (
          last && resolveStatus(last.statusId, last.statusName).type === filter
        );
      }),
    [data, search, filter],
  );

  const renderItem = useCallback(
    ({ item }) => <PatientCard patient={item} onPress={onSelectPatient} />,
    [onSelectPatient],
  );

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0EEE9" />

      {/* Header */}
      <View style={S.listHdr}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Image
              style={S.backIcon}
              source={require('../../assets/back.png')}
            />
          </TouchableOpacity>
          <View
            style={{ flexDirection: 'column', lineHeight: 18, width: '50%' }}
          >
            <Text style={S.listTitle}>Cashless Claims</Text>
            <Text style={S.listSub}>
              {stats.total} patient{stats.total !== 1 ? 's' : ''} · IHX
            </Text>
          </View>
        </View>
        <View style={S.hStats}>
          {[
            { n: stats.approved, l: 'Approved', c: TYPE_CFG.approved.text },
            { n: stats.pending, l: 'Pending', c: TYPE_CFG.processing.text },
            { n: stats.denied, l: 'Denied', c: TYPE_CFG.denied.text },
            { n: stats.settled, l: 'Settled', c: TYPE_CFG.settled.text },
          ].map(item => (
            <View key={item.l} style={S.hStat}>
              <Text style={[S.hStatNum, { color: item.c }]}>{item.n}</Text>
              <Text style={S.hStatLbl}>{item.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Search bar */}
      <View style={S.searchWrap}>
        <Text style={S.searchIcon}>⌕</Text>
        <TextInput
          style={S.searchInput}
          placeholder="Search name, invoice, phone…"
          placeholderTextColor="#A09F9C"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCapitalize="characters"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={S.filtersScroll}
        contentContainerStyle={S.filtersContent}
      >
        {FILTERS.map(f => {
          const active = filter === f.key;
          const cfg = TYPE_CFG[f.key] || {};
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                S.chip,
                active && {
                  backgroundColor: cfg.bg || '#E3EFFE',
                  borderColor: cfg.dot || '#2E72D2',
                },
              ]}
            >
              <Text
                style={[
                  S.chipText,
                  active && { color: cfg.text || '#1455A4', fontWeight: '700' },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={S.resultsLine}>
        {filtered.length} result{filtered.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.invoice_id)}
        renderItem={renderItem}
        contentContainerStyle={S.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={S.emptyBox}>
            <Text style={S.emptyText}>No patients match your search</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Root (no external navigation library required) ───────────────────────────

const BACKEND_URL = 'https://wedoc.in/hms';
const getISTDate = date => {
  const now = new Date(date);

  // Convert to milliseconds since UTC and add IST offset
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  //console.log(istTime);
  // Format IST date manually in YYYY-MM-DD format
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  //console.log(`${year}-${month}-${day}`);
  return `${year}-${month}-${day}`;
};

export default function IHXPatientTracker({ style, navigation }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );

  const fetchIHXData = async (location, fromDate, toDate) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/IPDCollection/ihxData?location=${location}&from=${fromDate}&to=${toDate}`,
      );

      const result = await response.json();
      setData(result || {});
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pharmacy data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIHXData(location, getISTDate(fromDate), getISTDate(toDate));
  }, [location, fromDate, toDate]);

  return (
    <View style={[{ flex: 1, backgroundColor: '#F0EEE9' }, style]}>
      {selected ? (
        <ClaimDetailScreen
          patient={selected}
          onBack={() => setSelected(null)}
        />
      ) : (
        <PatientListScreen
          data={data}
          onSelectPatient={setSelected}
          navigation={navigation}
        />
      )}
      {/* Loader */}
      <Portal>
        <Dialog visible={loading} onDismiss={() => setLoading(false)}>
          <Dialog.Content>
            <Text>Loading...</Text>
            <ActivityIndicator animating={loading} size="large" />
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BG = '#F0EEE9',
  SURF = '#FFFFFF',
  SURF2 = '#F7F6F2';
const BD = 'rgba(0,0,0,0.07)',
  BD2 = 'rgba(0,0,0,0.13)';
const TP = '#18181A',
  TS = '#6B6A68',
  TT = '#A09F9C';

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: { flex: 1, backgroundColor: BG },
  backIcon: {
    height: 35,
    width: 35,
    tintColor: '#184D67',
  },
  // ── List header ──
  listHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TP,
    letterSpacing: -0.4,
  },
  listSub: { fontSize: 12, color: TS, marginTop: 2 },
  hStats: { flexDirection: 'row', flexWrap: 'wrap', width: 140, gap: 6 },
  hStat: { alignItems: 'center', width: 62 },
  hStatNum: { fontSize: 15, fontWeight: '800' },
  hStatLbl: {
    fontSize: 9,
    color: TT,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Search ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURF,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: BD,
    paddingHorizontal: 12,
    height: 42,
    marginHorizontal: 18,
    marginBottom: 10,
    gap: 8,
  },
  searchIcon: { fontSize: 17, color: TT },
  searchInput: { flex: 1, fontSize: 14, color: TP },

  // ── Filters ──
  filtersScroll: { maxHeight: 38, marginBottom: 6 },
  filtersContent: { paddingHorizontal: 18, gap: 6, alignItems: 'center' },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 5,
    height: 28,
    marginVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: BD,
    backgroundColor: SURF,
  },
  chipText: { fontSize: 12, color: TS, fontWeight: '500' },

  resultsLine: {
    fontSize: 10,
    color: TT,
    paddingHorizontal: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: { paddingHorizontal: 18, paddingBottom: 32 },

  // ── Patient card ──
  pCard: {
    backgroundColor: SURF,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: BD,
    flexDirection: 'row',
  },
  pCardAccent: { width: 4 },
  pCardBody: { flex: 1, padding: 13 },
  pCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  pCardNameBlock: { flex: 1, minWidth: 0 },
  pCardName: { fontSize: 13, fontWeight: '700', color: TP },
  pCardSub: { fontSize: 11, color: TS, marginTop: 1 },
  pCardAmts: {
    flexDirection: 'row',
    backgroundColor: SURF2,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  pCardAmtCell: { flex: 1, paddingVertical: 7, alignItems: 'center' },
  pCardAmtCellBorder: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: BD,
  },
  pCardAmtLabel: {
    fontSize: 9,
    color: TT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  pCardAmtVal: { fontSize: 12, fontWeight: '700', color: TP },
  pCardFooter: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  pCardClaimNo: { flex: 1, fontSize: 11, color: TS },
  pCardUpdates: { fontSize: 11, color: TT },
  miniTrack: {
    height: 3,
    backgroundColor: BG,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniFill: { height: 3, borderRadius: 2 },

  // ── Avatar / Badge ──
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontWeight: '700' },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 160,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // ── Detail nav bar ──
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backArrow: { fontSize: 20, color: TS },
  backText: { fontSize: 14, color: TS, fontWeight: '500' },
  navClaimNo: { flex: 1, fontSize: 11, color: TT, textAlign: 'right' },
  detailPad: { paddingHorizontal: 18, paddingBottom: 32 },

  // ── Hero card ──
  heroCard: {
    backgroundColor: SURF,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: BD,
    padding: 15,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 16, fontWeight: '800', color: TP, letterSpacing: -0.2 },
  heroMeta: { fontSize: 12, color: TS, marginTop: 2 },

  amtStrip: {
    flexDirection: 'row',
    backgroundColor: SURF2,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  amtBlock: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  amtDivider: { width: 0.5, backgroundColor: BD },
  amtLabel: {
    fontSize: 9,
    color: TT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  amtVal: { fontSize: 14, fontWeight: '800', color: TP },

  stageRow: { flexDirection: 'row', gap: 8 },
  stageChip: {
    flex: 1,
    backgroundColor: SURF2,
    borderRadius: 8,
    padding: 8,
    borderWidth: 0.5,
    borderColor: BD,
  },
  stageChipLabel: {
    fontSize: 9,
    color: TT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  stageChipVal: { fontSize: 12, fontWeight: '700', color: TP },

  // ── Journey bar ──
  journeyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURF,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: BD,
    padding: 12,
    marginBottom: 14,
  },
  stagePill: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: SURF2,
    borderWidth: 0.5,
    borderColor: BD,
    alignItems: 'center',
  },
  stagePillReached: { backgroundColor: '#E6F4D9', borderColor: '#5BAB26' },
  stagePillActive: { backgroundColor: '#2E6B0E', borderColor: '#2E6B0E' },
  stagePillText: {
    fontSize: 9,
    fontWeight: '600',
    color: TT,
    textAlign: 'center',
  },
  stagePillTxtReached: { color: '#2E6B0E' },
  stagePillTxtActive: { color: '#FFFFFF' },
  journeyLine: { flex: 1, height: 1.5, backgroundColor: BD },
  journeyLineFilled: { backgroundColor: '#5BAB26' },

  // ── Section header ──
  sectionHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: TP },
  sectionCount: { fontSize: 12, color: TT },

  // ── Timeline card ──
  tlCard: {
    backgroundColor: SURF,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: BD,
    padding: 15,
    paddingBottom: 8,
  },
  tlRow: { flexDirection: 'row', gap: 11 },
  tlSpine: { width: 18, alignItems: 'center', flexShrink: 0 },
  tlLineTop: { width: 1.5, flex: 1, minHeight: 6 },
  tlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
    flexShrink: 0,
    zIndex: 1,
  },
  tlLineBot: { width: 1.5, flex: 1, minHeight: 6 },
  tlBody: { flex: 1, paddingBottom: 16 },

  tlTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  phaseTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  phaseTagText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  idChip: {
    backgroundColor: SURF2,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: BD,
  },
  idChipText: { fontSize: 9, color: TT, fontWeight: '600' },

  tlTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  tlStatus: { fontSize: 13, fontWeight: '700', color: TP, flex: 1 },
  tlTime: { fontSize: 10, color: TT, flexShrink: 0, marginTop: 1 },
  tlDate: { fontSize: 11, color: TS, marginTop: 1, marginBottom: 5 },

  tlAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 5,
  },
  amtPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURF2,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  amtPillLabel: { fontSize: 9, color: TT },
  amtPillVal: { fontSize: 10, fontWeight: '700', color: TS },

  remarkBox: { borderLeftWidth: 2.5, paddingLeft: 9, marginTop: 2 },
  remarkText: { fontSize: 11, color: TS, lineHeight: 17 },
  remarkToggle: { fontSize: 10, fontWeight: '700', marginTop: 4 },

  emptyBox: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: TS, textAlign: 'center' },
});
