import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ActivityIndicator,
  Dialog,
  Divider,
  Portal,
  Text,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';

import LeadsStatsDashboard from '../adAgency/LeadsStatsDashboard';
import { exportToExcel } from '../adAgency/ExportToExcel'; // <-- adjust path/case if needed

// Format any Date as YYYY-MM-DD in IST (matches the dashboard's fetch format)
const getISTDate = (date = new Date()) => {
  const now = new Date(date);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Colors = {
  primary: '#3B6D11',
  header: '#01458e',
  bg: '#fff',
  border: '#ccc',
  textMedium: '#6B6A68',
  disabled: '#9FB4C0',
};

const LeadStatsReport = ({ navigation }) => {
  const route = useRoute();

  // Initial dates from navigation params (fallback: today)
  const initialFrom = route.params?.from || getISTDate();
  const initialTo = route.params?.to || getISTDate();

  const [loading, setLoading] = useState(false);
  const [statsData, setStatsData] = useState(null);

  // Committed range — this is what actually drives the dashboard
  const [appliedFrom, setAppliedFrom] = useState(initialFrom);
  const [appliedTo, setAppliedTo] = useState(initialTo);

  // Filter modal + picker working state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [fromDateObj, setFromDateObj] = useState(new Date(initialFrom));
  const [toDateObj, setToDateObj] = useState(new Date(initialTo));

  const openFilter = () => {
    // Reset picker selections to the currently applied range
    setFromDateObj(new Date(appliedFrom));
    setToDateObj(new Date(appliedTo));
    setShowFilterModal(true);
  };

  const applyFilter = () => {
    if (toDateObj < fromDateObj) {
      Alert.alert(
        'Invalid range',
        'The "To" date cannot be before the "From" date.',
      );
      return;
    }
    setAppliedFrom(getISTDate(fromDateObj));
    setAppliedTo(getISTDate(toDateObj));
    setShowFilterModal(false);
  };

  const handleExportExcel = async () => {
    if (!statsData || statsData.length === 0) {
      Alert.alert('Please wait', 'Statistics are still loading.');
      return;
    }

    // Flatten one channel into clean rows
    const buildRows = mode =>
      statsData.map(s => {
        const b =
          mode === 'web'
            ? s.web
            : mode === 'chatbot'
            ? s.chatbot
            : mode === 'ivr'
            ? s.ivr
            : s.combined;
        const total = b?.total || 0;
        return {
          Location: s.location,
          Total: total,
          Appointments: b?.appointment || 0,
          'Clinic Visits': b?.actualVisitCount || 0,
          IPD: b?.ipd || 0,
          'Conversion %':
            total === 0 ? 0 : Math.round((b.appointment / total) * 100),
        };
      });

    try {
      setLoading(true);
      await exportToExcel({
        sheets: [
          { name: 'Combined', data: buildRows('combined') },
          { name: 'Web', data: buildRows('web') },
          { name: 'Bot', data: buildRows('chatbot') },
          { name: 'IVR', data: buildRows('ivr') },
        ],
        fileName: `HHC_LeadStats_${appliedFrom}_to_${appliedTo}`,
      });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export failed', e?.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      {/* ---- Header: back + range + filter ---- */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {appliedFrom} → {appliedTo}
        </Text>

        <TouchableOpacity onPress={openFilter} style={styles.filterIconBtn}>
          <Icon name="filter-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ---- Export row ---- */}
      {/* <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.exportBtn, !statsData && styles.exportBtnDisabled]}
          onPress={handleExportExcel}
          disabled={!statsData}
          activeOpacity={0.7}
        >
          <Icon
            name="microsoft-excel"
            size={18}
            color="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.exportBtnText}>Export Excel</Text>
        </TouchableOpacity>
      </View> */}

      {/* ---- Filter Modal ---- */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Icon name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <Divider style={{ marginBottom: 20 }} />

            {/* From Date */}
            <Text style={styles.modalLabel}>From Date</Text>
            <TouchableOpacity
              style={styles.modalDateBtn}
              onPress={() => setShowFromPicker(true)}
            >
              <Icon
                name="calendar-start"
                size={18}
                color="#01458e"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.modalDateText}>
                {fromDateObj.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Icon
                name="chevron-down"
                size={18}
                color="#999"
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {/* To Date */}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>To Date</Text>
            <TouchableOpacity
              style={styles.modalDateBtn}
              onPress={() => setShowToPicker(true)}
            >
              <Icon
                name="calendar-end"
                size={18}
                color="#01458e"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.modalDateText}>
                {toDateObj.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Icon
                name="chevron-down"
                size={18}
                color="#999"
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            <Divider style={{ marginTop: 24, marginBottom: 16 }} />

            {/* Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={applyFilter}
              >
                <Icon
                  name="check"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.modalApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---- Date Pickers ---- */}
      <DatePicker
        modal
        open={showFromPicker}
        date={fromDateObj}
        mode="date"
        maximumDate={toDateObj}
        onConfirm={date => {
          setShowFromPicker(false);
          setFromDateObj(date);
        }}
        onCancel={() => setShowFromPicker(false)}
      />
      <DatePicker
        modal
        open={showToPicker}
        date={toDateObj}
        mode="date"
        minimumDate={fromDateObj}
        maximumDate={new Date()}
        onConfirm={date => {
          setShowToPicker(false);
          setToDateObj(date);
        }}
        onCancel={() => setShowToPicker(false)}
      />

      {/* ---- Dashboard (driven by applied range) ---- */}
      <View style={{ flex: 1 }}>
        <LeadsStatsDashboard
          from={appliedFrom}
          to={appliedTo}
          onStatsLoaded={setStatsData}
        />
      </View>

      {/* ---- Loading dialog ---- */}
      <Portal>
        <Dialog visible={loading} dismissable={false} style={styles.dialog}>
          <Dialog.Content style={styles.dialogContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.dialogText}>Generating Excel…</Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default LeadStatsReport;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.bg,
  },

  /* Header */
  headerContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 6,
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 19,
  },

  /* Export row */
  exportRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  exportBtnDisabled: {
    backgroundColor: Colors.disabled,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Lexend-Medium',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  modalLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dde3f0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#f8f9ff',
  },
  modalDateText: { fontSize: 15, color: '#222', fontWeight: '500' },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  modalCancelText: { color: '#555', fontWeight: '600', fontSize: 14 },
  modalApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.header,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* Dialog */
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  dialogContent: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  dialogText: {
    marginTop: 14,
    fontSize: 15,
    color: '#18181A',
    fontFamily: 'Lexend-Regular',
  },
});
