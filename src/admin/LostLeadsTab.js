/* eslint-disable react-native/no-inline-styles */
/**
 * LostLeadsTab.js
 * ---------------------------------------------------------------------------
 * "Lost Leads" tab body for ReportScreen.
 *
 * Branch multi-select + channel dropdown (IVR / Web lead / Bot leads) + date
 * range, then one button that pulls the data and drops a workbook on the
 * device:
 *
 *   Sheet 1  Enquiry - No Appointment
 *   Sheet 2  Appointment - Not Visited
 *   Sheet 3  Branch Summary   (counts per branch, so the detail sheets are
 *                              usable without a pivot table)
 *
 * Only the selected branches are sent to the API, so narrowing the selection
 * is the main lever on how long the report takes.
 *
 * Self-contained on purpose — ReportScreen only has to add a segment and
 * render <LostLeadsTab locations={dsrLocations} backendUrl={BACKEND_URL} />.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Chip, Divider, Text } from 'react-native-paper';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { exportToExcel } from '../adAgency/ExportToExcel';

const PRIMARY = '#01458e';
const GREEN = '#14923E';

const REQUEST_TIMEOUT = 180000; // 3 min — this walks every branch's clinic DB
const MAX_RANGE_DAYS = 92; // one quarter; keeps the report responsive

const CHANNELS = [
  { value: 'ivr', label: 'IVR', icon: 'phone-in-talk' },
  { value: 'helpline', label: 'Helpline', icon: 'phone-log-outline' },
  { value: 'web', label: 'Web lead', icon: 'web' },
  { value: 'bot', label: 'Bot leads', icon: 'robot-outline' },
];

/* ── date helpers (IST, matching the rest of the reports) ─────────────────── */

const getISTDate = (date = new Date()) => {
  const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${m}-${d}`;
};

const displayDate = date =>
  new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const inclusiveDaySpan = (a, b) =>
  Math.floor((new Date(getISTDate(b)) - new Date(getISTDate(a))) / 86400000) +
  1;

/* ── channel dropdown (single select) ─────────────────────────────────────── */

const ChannelPicker = ({ visible, selected, onSelect, onClose }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Lead source</Text>
        <Divider style={{ marginBottom: 6 }} />
        {CHANNELS.map(c => {
          const active = c.value === selected;
          return (
            <TouchableOpacity
              key={c.value}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => {
                onSelect(c.value);
                onClose();
              }}
            >
              <Icon name={c.icon} size={20} color={active ? PRIMARY : '#666'} />
              <Text style={[styles.rowText, active && styles.rowTextActive]}>
                {c.label}
              </Text>
              {active && (
                <Icon
                  name="check"
                  size={20}
                  color={PRIMARY}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </TouchableOpacity>
  </Modal>
);

/* ── branch dropdown (multi select, commit on Apply) ──────────────────────── */

const BranchPicker = ({ visible, options, selected, onApply, onClose }) => {
  const [pending, setPending] = useState(selected);

  // Reset the working copy every time the sheet opens, so Cancel really cancels.
  useEffect(() => {
    if (visible) setPending(selected);
  }, [visible, selected]);

  const toggle = branch =>
    setPending(prev =>
      prev.includes(branch)
        ? prev.filter(b => b !== branch)
        : [...prev, branch],
    );

  const allSelected = pending.length === options.length && options.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, styles.branchSheet]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select branches</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.row, styles.rowAll]}
            onPress={() => setPending(allSelected ? [] : [...options])}
          >
            <Icon
              name={allSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={20}
              color={allSelected ? PRIMARY : '#888'}
            />
            <Text style={[styles.rowText, { fontWeight: '600' }]}>
              {allSelected ? 'Clear all' : `Select all (${options.length})`}
            </Text>
          </TouchableOpacity>

          <Divider style={{ marginVertical: 4 }} />

          <ScrollView
            style={{ maxHeight: 340 }}
            showsVerticalScrollIndicator={false}
          >
            {options.map(branch => {
              const active = pending.includes(branch);
              return (
                <TouchableOpacity
                  key={branch}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => toggle(branch)}
                >
                  <Icon
                    name={active ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={active ? PRIMARY : '#888'}
                  />
                  <Text
                    style={[styles.rowText, active && styles.rowTextActive]}
                  >
                    {branch}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Divider style={{ marginVertical: 8 }} />

          <View style={styles.sheetFooter}>
            <Text style={styles.footerCount}>
              {pending.length} of {options.length} selected
            </Text>
            <TouchableOpacity
              style={[
                styles.applyBtn,
                pending.length === 0 && { opacity: 0.5 },
              ]}
              disabled={pending.length === 0}
              onPress={() => {
                onApply(pending);
                onClose();
              }}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ── main ─────────────────────────────────────────────────────────────────── */

const LostLeadsTab = ({ locations = [], backendUrl }) => {
  const monthAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d;
  };

  const branchOptions = useMemo(
    () => [...locations].sort((a, b) => a.localeCompare(b)),
    [locations],
  );

  const [channel, setChannel] = useState('web');
  const [branches, setBranches] = useState(branchOptions);
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(new Date());

  const [showChannel, setShowChannel] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Keep the selection valid if the account's branch list arrives late/changes.
  useEffect(() => {
    setBranches(prev => {
      const stillValid = prev.filter(b => branchOptions.includes(b));
      return stillValid.length ? stillValid : branchOptions;
    });
  }, [branchOptions]);

  const channelLabel = CHANNELS.find(c => c.value === channel)?.label ?? '';

  const branchLabel =
    branches.length === 0
      ? 'None selected'
      : branches.length === branchOptions.length
      ? `All ${branchOptions.length} branches`
      : branches.length === 1
      ? branches[0]
      : `${branches.length} branches`;

  const generateExcel = async () => {
    if (!branches.length) {
      Alert.alert('No branches', 'Select at least one branch.');
      return;
    }
    if (getISTDate(fromDate) > getISTDate(toDate)) {
      Alert.alert('Invalid range', '"From" date cannot be after "To" date.');
      return;
    }
    if (inclusiveDaySpan(fromDate, toDate) > MAX_RANGE_DAYS) {
      Alert.alert(
        'Range too large',
        `Please select ${MAX_RANGE_DAYS} days or less.`,
      );
      return;
    }

    setBusy(true);
    setResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const from = getISTDate(fromDate);
      const to = getISTDate(toDate);

      const response = await fetch(`${backendUrl}/report/lost-leads/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only the selected branches go to the server.
        body: JSON.stringify({ channel, from, to, locations: branches }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || 'Failed to generate report',
        );
      }

      const notConverted = data?.notConverted || [];
      const notVisited = data?.notVisited || [];

      if (!notConverted.length && !notVisited.length) {
        setResult({
          ok: true,
          empty: true,
          from: data.from,
          to: data.to,
          branchesProcessed: data.branchesProcessed,
        });
        return;
      }

      const scope =
        branches.length === 1
          ? branches[0].replace(/\s+/g, '')
          : `${branches.length}Branches`;

      await exportToExcel({
        sheets: [
          { name: 'Enquiry - No Appointment', data: notConverted },
          { name: 'Appointment - Not Visited', data: notVisited },
          { name: 'Branch Summary', data: data?.summary || [] },
        ],
        fileName: `LostLeads_${channelLabel.replace(
          /\s+/g,
          '',
        )}_${scope}_${from}_to_${to}`,
      });

      setResult({
        ok: true,
        from: data.from,
        to: data.to,
        notConverted: notConverted.length,
        notVisited: notVisited.length,
        branchesProcessed: data.branchesProcessed,
        branchesRequested: data.branchesRequested,
        failed: data.failed,
      });
    } catch (err) {
      // The share sheet throws on dismiss — the file is already saved by then.
      if (/cancel|did not share/i.test(err?.message || '')) {
        setResult(null);
      } else {
        setResult({
          ok: false,
          error:
            err.name === 'AbortError'
              ? 'Request timed out. Try fewer branches or a narrower date range.'
              : err.message,
        });
      }
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeaderRow}>
            <Icon name="account-arrow-left-outline" size={22} color={PRIMARY} />
            <Text style={styles.title}>Lost Leads</Text>
          </View>
          <Text style={styles.desc}>
            Two sheets for the selected source and range: leads that enquired
            but never booked an appointment, and leads that booked but never
            visited the clinic.
          </Text>

          {/* Branches */}
          <Text style={styles.label}>Branches</Text>
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowBranches(true)}
            disabled={!branchOptions.length}
          >
            <Icon name="map-marker-multiple" size={18} color={PRIMARY} />
            <Text style={styles.fieldText}>{branchLabel}</Text>
            <Icon
              name="chevron-down"
              size={18}
              color="#999"
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          {/* Lead source */}
          <Text style={styles.label}>Lead source</Text>
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowChannel(true)}
          >
            <Icon
              name={CHANNELS.find(c => c.value === channel)?.icon}
              size={18}
              color={PRIMARY}
            />
            <Text style={styles.fieldText}>{channelLabel}</Text>
            <Icon
              name="chevron-down"
              size={18}
              color="#999"
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          {/* Date range */}
          <Text style={styles.label}>From date</Text>
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowFrom(true)}
          >
            <Icon name="calendar-start" size={18} color={PRIMARY} />
            <Text style={styles.fieldText}>{displayDate(fromDate)}</Text>
            <Icon
              name="chevron-down"
              size={18}
              color="#999"
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          <Text style={styles.label}>To date</Text>
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowTo(true)}
          >
            <Icon name="calendar-end" size={18} color={PRIMARY} />
            <Text style={styles.fieldText}>{displayDate(toDate)}</Text>
            <Icon
              name="chevron-down"
              size={18}
              color="#999"
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          <View style={styles.chipRow}>
            <Chip
              icon="map-marker-multiple"
              style={styles.chip}
              textStyle={styles.chipText}
            >
              {branches.length} branch{branches.length === 1 ? '' : 'es'}
            </Chip>
            <Chip
              icon="filter-variant"
              style={[styles.chip, { marginLeft: 8 }]}
              textStyle={styles.chipText}
            >
              {channelLabel}
            </Chip>
          </View>

          <TouchableOpacity
            style={[
              styles.generateBtn,
              (busy || !branches.length) && { opacity: 0.6 },
            ]}
            onPress={generateExcel}
            disabled={busy || !branches.length}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="microsoft-excel" size={20} color="#fff" />
            )}
            <Text style={styles.generateText}>
              {busy ? 'Generating…' : 'Generate Excel'}
            </Text>
          </TouchableOpacity>

          {busy && (
            <Text style={styles.mutedNote}>
              This can take up to a minute for many branches — please wait.
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Result */}
      {result?.ok && !result.empty && (
        <Card style={[styles.card, styles.successCard]}>
          <Card.Content>
            <View style={styles.cardHeaderRow}>
              <Icon name="check-circle" size={20} color={GREEN} />
              <Text style={styles.successTitle}>Report downloaded</Text>
            </View>
            <Text style={styles.resultText}>
              {channelLabel} lost leads ({result.from} → {result.to}) saved to
              your device.
            </Text>
            <Text style={styles.resultText}>
              {result.notConverted} enquir
              {result.notConverted === 1 ? 'y' : 'ies'} with no appointment ·{' '}
              {result.notVisited} appointment
              {result.notVisited === 1 ? '' : 's'} not visited.
            </Text>
            <Text style={styles.resultText}>
              {result.branchesProcessed} of {result.branchesRequested} selected
              branches included.
            </Text>
            {result.failed?.length > 0 && (
              <Text style={[styles.resultText, { color: '#b26a00' }]}>
                Skipped: {result.failed.map(f => f.location).join(', ')}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {result?.ok && result.empty && (
        <Card style={styles.card}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Icon name="database-off-outline" size={44} color="#999" />
            <Text style={styles.emptyTitle}>No lost leads found</Text>
            <Text style={styles.emptySub}>
              Every {channelLabel} lead between {result.from} and {result.to}{' '}
              either booked and visited, or there were no leads in this range.
            </Text>
          </Card.Content>
        </Card>
      )}

      {result && !result.ok && (
        <Card style={[styles.card, styles.errorCard]}>
          <Card.Content>
            <Text style={styles.errorTitle}>Couldn’t generate report</Text>
            <Text style={styles.errorText}>{result.error}</Text>
          </Card.Content>
        </Card>
      )}

      <BranchPicker
        visible={showBranches}
        options={branchOptions}
        selected={branches}
        onApply={next => {
          setBranches(next);
          setResult(null);
        }}
        onClose={() => setShowBranches(false)}
      />

      <ChannelPicker
        visible={showChannel}
        selected={channel}
        onSelect={v => {
          setChannel(v);
          setResult(null);
        }}
        onClose={() => setShowChannel(false)}
      />

      <DatePicker
        modal
        mode="date"
        open={showFrom}
        date={fromDate}
        maximumDate={new Date()}
        onConfirm={d => {
          setShowFrom(false);
          setFromDate(d);
          setResult(null);
        }}
        onCancel={() => setShowFrom(false)}
      />
      <DatePicker
        modal
        mode="date"
        open={showTo}
        date={toDate}
        maximumDate={new Date()}
        onConfirm={d => {
          setShowTo(false);
          setToDate(d);
          setResult(null);
        }}
        onCancel={() => setShowTo(false)}
      />
    </ScrollView>
  );
};

export default LostLeadsTab;

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#222', marginLeft: 8 },
  desc: { fontSize: 12, color: '#666', lineHeight: 18 },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginTop: 16,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dde3ea',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  fieldText: { fontSize: 14, color: '#222', marginLeft: 4, flexShrink: 1 },

  chipRow: { flexDirection: 'row', marginTop: 16 },
  chip: { backgroundColor: '#e8f0fa' },
  chipText: { fontSize: 11, color: PRIMARY },

  generateBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 13,
    borderRadius: 8,
  },
  generateText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },

  mutedNote: {
    marginTop: 12,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },

  successCard: { borderLeftWidth: 4, borderLeftColor: GREEN },
  successTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: GREEN,
    marginLeft: 8,
  },
  resultText: { fontSize: 13, color: '#444', marginTop: 4 },

  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#444', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#777', textAlign: 'center', marginTop: 4 },

  errorCard: { borderLeftWidth: 4, borderLeftColor: '#DE3B40' },
  errorTitle: { fontSize: 15, fontWeight: 'bold', color: '#DE3B40' },
  errorText: { fontSize: 13, color: '#444', marginTop: 6 },

  // shared dropdown chrome
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: { shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  branchSheet: { maxHeight: '80%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  sheetFooter: { flexDirection: 'row', alignItems: 'center' },
  footerCount: { fontSize: 12, color: '#666' },
  applyBtn: {
    marginLeft: 'auto',
    backgroundColor: PRIMARY,
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  applyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  rowAll: { backgroundColor: '#f2f6fb' },
  rowActive: { backgroundColor: '#e8f0fa' },
  rowText: { fontSize: 14, color: '#333', marginLeft: 6, flexShrink: 1 },
  rowTextActive: { color: PRIMARY, fontWeight: '600' },
});
