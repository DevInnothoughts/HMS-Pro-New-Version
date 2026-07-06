/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/react-in-jsx-scope */
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Color palette (matches ConditionwiseReport UI) ───────────────────────────
const COLORS = {
  bg: '#F5F7FB',
  card: '#FFFFFF',
  headerIcon: '#184D67',
  text: '#000000',
  muted: '#6B7280',
  accent: '#4A90E2',
  border: '#E6EAF0',
};

const DoctorPerformanceBranchList = ({ navigation, route }) => {
  const params = route?.params || {};

  // Locations: prefer what the caller passed; otherwise redux. No hardcoded
  // fallback (same convention as BranchTargetDetailScreen).
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const branches = useMemo(() => {
    if (params.branches && params.branches.length) return params.branches;
    if (locationArray && locationArray.length > 0) return locationArray;
    return location ? [location] : [];
  }, [params.branches, location, locationArray]);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(b => b.toLowerCase().includes(q));
  }, [branches, query]);

  const openBranch = branch => {
    navigation.navigate('DoctorPerformance', { branch });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.branchCard}
      activeOpacity={0.85}
      onPress={() => openBranch(item)}
    >
      <View style={styles.branchIcon}>
        <Text style={styles.branchIconText}>
          {item.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.branchName}>{item}</Text>
        <Text style={styles.branchSub}>Tap to view doctor performance</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={{ height: 35, width: 35, tintColor: COLORS.headerIcon }}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <Text style={styles.header}>Doctor Performance</Text>
        {/* spacer to keep the title centred */}
        <View style={{ width: 35 }} />
      </View>

      <Text style={styles.title}>Select a Branch</Text>

      {/* Search — only when there are branches to search */}
      {branches.length > 0 && (
        <View style={styles.searchBox}>
          <Text style={{ color: COLORS.muted, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search branch"
            placeholderTextColor={COLORS.muted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={{ color: COLORS.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          branches.length === 0 ? (
            <Text style={styles.empty}>
              No branch is available for your account.
            </Text>
          ) : (
            <Text style={styles.empty}>No branches match “{query}”.</Text>
          )
        }
      />
    </SafeAreaView>
  );
};

export default DoctorPerformanceBranchList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 4,
    width: '100%',
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Lexend-Bold',
    color: COLORS.text,
    marginTop: 6,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Lexend-Regular',
    fontSize: 15,
    color: COLORS.text,
    padding: 0,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  branchIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4A90E222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  branchIconText: {
    fontFamily: 'Lexend-Bold',
    fontSize: 18,
    color: COLORS.accent,
  },
  branchName: {
    fontFamily: 'Lexend-Medium',
    fontSize: 16,
    color: COLORS.text,
  },
  branchSub: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 26,
    color: COLORS.accent,
    paddingLeft: 8,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.muted,
    fontFamily: 'Lexend-Regular',
    marginTop: 40,
    fontSize: 15,
  },
});
