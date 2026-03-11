import React from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';

const AIResponseCard = ({response}) => {
  if (!response) return null;

  const {insights = [], numbers = {}, summary = ''} = response;

  return (
    <View style={styles.card}>
      <Text style={styles.header}>LiSa's Analysis Report</Text>

      {/* Summary Section */}
      {summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Summary</Text>
          <Text style={styles.text}>{summary}</Text>
        </View>
      ) : null}

      {/* Insights Section */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Key Insights</Text>
          <FlatList
            data={insights}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({item}) => (
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.text}>{item}</Text>
              </View>
            )}
          />
        </View>
      )}

      {/* Numbers Section */}
      {Object.keys(numbers).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Highlights</Text>

          {Object.entries(numbers).map(([groupKey, groupValues]) => (
            <View key={groupKey} style={styles.subSection}>
              <Text style={styles.subSectionTitle}>{groupKey}</Text>
              {Object.entries(groupValues).map(([key, value]) => {
                const {icon, label} = formatLabel(key);
                return (
                  <View key={key} style={styles.row}>
                    <Text style={styles.label}>
                      {icon} {label}
                    </Text>
                    <View style={styles.value}>{renderValue(value)}</View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ✅ Dynamic renderer for any type of value
const renderValue = value => {
  if (value == null) return <Text style={styles.valueText}>—</Text>;

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return <Text style={styles.valueText}>{String(value)}</Text>;
  }

  if (Array.isArray(value)) {
    return (
      <View style={styles.objectContainer}>
        {value.map((v, i) => (
          <View key={i} style={styles.objectRow}>
            {renderValue(v)}
          </View>
        ))}
      </View>
    );
  }

  if (typeof value === 'object') {
    return (
      <View style={styles.objectContainer}>
        {Object.entries(value).map(([k, v]) => (
          <Text key={k} style={styles.objectText}>
            {prettifyKey(k)}: {typeof v === 'object' ? '' : String(v)}
            {typeof v === 'object' ? renderValue(v) : null}
          </Text>
        ))}
      </View>
    );
  }

  return <Text style={styles.valueText}>{String(value)}</Text>;
};

// ✅ Make keys more human-friendly
const prettifyKey = key =>
  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ✅ Label mapping with icons
const formatLabel = key => {
  const baseMap = {
    overall_change_percent: {icon: '📉', label: 'Overall Change (%)'},
    average_current: {icon: '📊', label: 'Average (Current)'},
    average_previous: {icon: '📊', label: 'Average (Previous)'},
    cumulative_total_current: {icon: '➕', label: 'Cumulative (Current)'},
    cumulative_total_previous: {icon: '➖', label: 'Cumulative (Previous)'},
    highest_growth_percent: {icon: '📈', label: 'Highest Growth (%)'},
    largest_drop_percent: {icon: '📉', label: 'Largest Drop (%)'},
    volatility: {icon: '🔀', label: 'Volatility'},
  };

  if (baseMap[key]) return baseMap[key];

  if (key.includes('month')) {
    if (key.includes('best')) return {icon: '🏆', label: 'Best Month'};
    if (key.includes('worst')) return {icon: '⚠️', label: 'Worst Month'};
  }

  if (key.includes('quarter')) {
    if (key.includes('best')) return {icon: '🏆', label: 'Best Quarter'};
    if (key.includes('worst')) return {icon: '⚠️', label: 'Worst Quarter'};
    if (key.includes('growth'))
      return {icon: '📈', label: 'Highest Growth (Quarter)'};
    if (key.includes('drop'))
      return {icon: '📉', label: 'Largest Drop (Quarter)'};
  }

  if (key.includes('year')) {
    if (key.includes('best')) return {icon: '🏆', label: 'Best Year'};
    if (key.includes('worst')) return {icon: '⚠️', label: 'Worst Year'};
    if (key.includes('growth')) return {icon: '📈', label: 'YoY Growth (%)'};
    if (key.includes('drop')) return {icon: '📉', label: 'YoY Decline (%)'};
  }

  const pretty = prettifyKey(key);
  return {icon: '📌', label: pretty};
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    //padding: 16,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    //shadowOpacity: 0.1,
    // shadowRadius: 8,
    //shadowOffset: {width: 0, height: 4},
    //elevation: 4,
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#184D67',
    textAlign: 'center',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  subSection: {
    marginBottom: 10,
    paddingLeft: 8,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    color: '#184D67',
  },
  text: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 16,
    marginRight: 6,
    color: '#184D67',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  value: {
    flex: 1,
    alignItems: 'flex-end',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  objectContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  objectRow: {
    flexDirection: 'row',
  },
  objectText: {
    fontSize: 13,
    color: '#666',
  },
  valueItem: {
    fontSize: 13,
    color: '#444',
  },
});

export default AIResponseCard;
