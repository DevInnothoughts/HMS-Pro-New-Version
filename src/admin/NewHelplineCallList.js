import { useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSelector } from 'react-redux';

const formatDuration = durationStr => {
  const totalSeconds = parseInt(durationStr, 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const BACKEND_URL = 'https://wedoc.in/hms'; //'https://admin.wedoc.in/ivr'; //'http://192.168.0.118:4000/ivr';

const CallLogItem = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.row}>
        <Text style={styles.number}>{item.phoneNumber}</Text>
        <Text style={styles.count}>{item.call_count} calls</Text>
      </View>
      {/* <Text style={styles.duration}>
        Total Duration: {formatDuration(item.total_duration)}
      </Text> */}

      {expanded && (
        <View style={styles.records}>
          {item.records.map((r, index) => (
            <View key={index} style={styles.record}>
              <Text style={styles.timestamp}>
                🕒 {new Date(parseInt(r.timestamp)).toLocaleString()}
              </Text>
              <Text
                style={{
                  ...styles.detail,
                  color:
                    r.type === 'UNKNOWN'
                      ? '#DE3B40FF'
                      : r.type === 'MISSED'
                      ? '#DE3B40FF'
                      : r.type === 'INCOMING'
                      ? '#14923EFF'
                      : '#379AE6FF',
                }}
              >
                {r.type === 'UNKNOWN' ? 'MISSED' : r.type} | Duration:{' '}
                {formatDuration(r.duration)}
              </Text>
              {r.note && (
                <Text
                  style={{ ...styles.detail, color: '#d88f21ff', fontSize: 14 }}
                >
                  Note: {r.note}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const CallLogScreen = () => {
  const route = useRoute();
  const { fromDate, toDate } = route.params;
  const location = useSelector(state => state.location.value);
  const [loading, setLoading] = useState(false);
  const [callRecord, setCallRecord] = useState([]);

  useEffect(() => {
    getData();
  }, [getData]);

  const getData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_URL}/HelplineCall/v2?location=${location}&from=${fromDate}&to=${toDate}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const res = await response.json();
      console.log('Helpline details: ', res[0]);
      setCallRecord(res);
    } catch (error) {
      console.log('Error ', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, location, toDate]);
  return (
    <FlatList
      data={callRecord}
      keyExtractor={item => item.phoneNumber}
      renderItem={({ item }) => <CallLogItem item={item} />}
      contentContainerStyle={{ padding: 12 }}
    />
  );
};

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  number: {
    fontFamily: 'Lexend-Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#666',
  },
  duration: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  records: {
    marginTop: 10,
    backgroundColor: '#f6f6f6',
    borderRadius: 6,
    padding: 8,
  },
  record: {
    marginBottom: 6,
  },
  timestamp: {
    fontFamily: 'Lexend-Regular',
    fontSize: 13,
    color: '#444',
  },
  detail: {
    fontFamily: 'Lexend-Regular',
    fontSize: 12,
    color: '#555',
  },
});

export default CallLogScreen;
