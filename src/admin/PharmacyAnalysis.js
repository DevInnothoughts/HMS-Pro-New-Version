import { useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { ActivityIndicator, Card, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

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

const PharmacyAnalysis = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [fromDate, setFromDate] = useState(
    route.params?.fromDate ? new Date(route.params.fromDate) : new Date(),
  );
  const [toDate, setToDate] = useState(
    route.params?.toDate ? new Date(route.params.toDate) : new Date(),
  );
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    fully_taken: [],
    partially_taken: [],
    extra_taken: [],
    not_taken: [],
  });
  const [activeTab, setActiveTab] = useState('taken');
  const activeList = data[activeTab] || [];
  const paginatedData = useMemo(() => {
    return activeList.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
  }, [page, itemsPerPage, activeList]);

  const handleNextPage = () => {
    if ((page + 1) * itemsPerPage < activeList.length) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const fetchPharmacyData = async (location, fromDate, toDate) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/pharmacyCollection/prescription-analysis?location=${location}&from=${fromDate}&to=${toDate}`,
      );

      const result = await response.json();
      setPage(0);
      setData(result || {});
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pharmacy data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacyData(location, getISTDate(fromDate), getISTDate(toDate));
  }, [location, fromDate, toDate]);

  const renderItem = ({ item }) => (
    <Card style={styles.card}>
      {/* Name + Mobile + Date */}
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={2}>
          {item.patient_name}
        </Text>

        <View style={styles.topRight}>
          <Text style={styles.mobile}>📞 {item.mobile}</Text>
          <Text style={styles.date}>📅 {item.date}</Text>
        </View>
      </View>

      {/* Prescribed + Purchased */}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>
            Prescribed :
            <Text style={styles.prescribed}> {item.total_prescribed}</Text>
          </Text>
        </View>

        <View style={styles.col}>
          <Text style={styles.label}>
            Purchased :
            <Text style={styles.purchased}> {item.total_purchased}</Text>
          </Text>
        </View>
      </View>

      {/* Remaining + Compliance */}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>
            Remaining :<Text style={styles.diff}> {item.difference}</Text>
          </Text>
        </View>

        <View style={styles.col}>
          <Text style={styles.label}>
            Compliance :
            <Text style={styles.compliance}> {item.compliance_percent}%</Text>
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={styles.backIcon}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>

        <Text style={styles.header}>Pharmacy Report</Text>

        <View style={{ width: 35 }} />
      </View>

      <View style={styles.tabContainer}>
        {[
          { key: 'taken', label: 'Fully Taken' },
          { key: 'partially_taken', label: 'Partially Taken' },
          { key: 'not_taken', label: 'Not Taken' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.activeTab,
            ]}
            onPress={() => {
              setActiveTab(tab.key);
              setPage(0);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={paginatedData}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No pharmacy data available</Text>
            </View>
          )
        }
      />
      {activeList.length > 0 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.pageButton, page === 0 && styles.disabledButton]}
            disabled={page === 0}
            onPress={handlePrevPage}
          >
            <Text style={styles.pageText}>Prev</Text>
          </TouchableOpacity>

          <Text style={styles.pageNumber}>
            Page {page + 1} / {Math.ceil(activeList.length / itemsPerPage) || 1}
          </Text>

          <TouchableOpacity
            style={[
              styles.pageButton,
              (page + 1) * itemsPerPage >= activeList.length &&
                styles.disabledButton,
            ]}
            disabled={(page + 1) * itemsPerPage >= activeList.length}
            onPress={handleNextPage}
          >
            <Text style={styles.pageText}>Next</Text>
          </TouchableOpacity>
        </View>
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
    </SafeAreaView>
  );
};

export default PharmacyAnalysis;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    backgroundColor: '#fff',
  },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  backIcon: {
    height: 35,
    width: 35,
    tintColor: '#184D67',
  },

  header: {
    fontSize: 18,
    fontWeight: '600',
  },

  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  col: {
    flex: 1,
  },

  label: {
    fontWeight: '500',
  },

  prescribed: {
    color: '#2563EB',
    fontWeight: '700',
  },

  purchased: {
    color: '#16A34A',
    fontWeight: '700',
  },

  diff: {
    color: '#DC2626',
    fontWeight: '700',
  },

  compliance: {
    color: '#9333EA',
    fontWeight: '700',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  pageButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#184D67',
    borderRadius: 6,
  },

  disabledButton: {
    backgroundColor: '#aaa',
  },

  pageText: {
    color: '#fff',
    fontWeight: '600',
  },

  pageNumber: {
    fontWeight: '600',
    fontSize: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingRight: 10,
  },

  topRight: {
    width: 120,
    alignItems: 'flex-start',
  },

  mobile: {
    fontSize: 13,
  },

  date: {
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },

  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },

  activeTab: {
    backgroundColor: '#184D67',
  },

  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  activeTabText: {
    color: '#fff',
  },
});
