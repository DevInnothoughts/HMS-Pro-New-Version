import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
  Image,
} from 'react-native';
import {
  Card,
  Text,
  SegmentedButtons,
  Menu,
  Divider,
  RadioButton,
  Portal,
  Dialog,
  ActivityIndicator,
} from 'react-native-paper';
import DatePicker from 'react-native-date-picker';
import { useSelector } from 'react-redux';
import { Picker } from '@react-native-picker/picker';
import { DocumentDirectoryPath, DownloadDirectoryPath } from 'react-native-fs';
var RNFS = require('react-native-fs');
import XLSX from 'xlsx';
import Share from 'react-native-share';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //
const TIMEOUT_DURATION = 10000; // 10,000 milliseconds or 10 seconds

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

const ReportScreen = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const [branch, setBranch] = useState(
    locationArray.length > 0 ? locationArray[0] : location,
  );
  const [visitType, setVisitType] = useState('OPD');
  const [sheetType, setSheetType] = useState('Sheet1');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);

  const DDP =
    Platform.OS === 'android'
      ? DownloadDirectoryPath + '/'
      : DocumentDirectoryPath + '/';

  // Function to check and request storage permission
  async function requestStoragePermission() {
    try {
      if (Platform.OS === 'android' && Platform.Version <= 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your storage to save Excel file.',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        return true; // On iOS, permission is always granted
      }
    } catch (error) {
      console.error('Error requesting storage permission:', error);
      return false;
    }
  }

  const downloadExcel = async () => {
    console.log(
      'Downloading Excel Report...',
      branch,
      visitType,
      sheetType,
      fromDate,
      toDate,
    );
    setLoading(true);

    try {
      const from = getISTDate(fromDate); // YYYY-MM-DD
      const to = getISTDate(toDate);

      console.log(from, to);
      const response = await fetch(
        `${BACKEND_URL}/report?location=${branch}&from=${from}&to=${to}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportType: visitType, // OPD / IPD
            sheetType: sheetType, // Sheet1 / Sheet2
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to fetch report');
      }

      setReportData(data);
      if (Array.isArray(data) && data.length > 0) {
        exportDataToExcel(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportDataToExcel = async report => {
    try {
      setLoading(true);
      const permissionGranted = await requestStoragePermission();
      //console.log('Permission granted:', permissionGranted);
      // if (!permissionGranted) {
      //   console.log('Permission denied');
      //   return;
      // }

      // Create workbook and worksheet
      let wb = XLSX.utils.book_new();
      let ws = XLSX.utils.json_to_sheet(report);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      // Generate a unique filename (e.g., appending a timestamp)
      const uniqueFileName = `Report_Data_${Date.now()}.xlsx`;

      // Write workbook to file
      const filePath = `${DDP}/${uniqueFileName}`;

      RNFS.writeFile(
        filePath,
        XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }),
        'base64',
      )
        .then(() => {
          setLoading(false);
          console.log('Excel file saved to:', filePath);
          if (Platform.OS === 'android') {
            // Open the file using Intent on Android
            const contentUri = `content://${filePath}`;
            Linking.openURL(contentUri);
          } else {
            // For iOS, get the file URI using RNFS and then open it
            // Share the file using react-native-share
            Share.open({
              url: `file://${filePath}`,
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
          }
        })
        .catch(error => {
          console.error('Error saving Excel file:', error);
          Alert.alert('Error', 'Failed to save Excel file: ' + error);
          setLoading(false);
        });
    } catch (error) {
      console.error('Error exporting data to Excel:', error);
    }
  };

  // const exportDataToExcel = async report => {
  //   try {
  //     setLoading(true);

  //     let wb = XLSX.utils.book_new();
  //     let ws = XLSX.utils.json_to_sheet(report);
  //     XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  //     const fileName = `${branch}_${visitType}_${sheetType}_${getISTDate(
  //       fromDate,
  //     )}_${getISTDate(toDate)}.xlsx`;

  //     const filePath = `${DDP}/${fileName}`;

  //     const base64Data = XLSX.write(wb, {
  //       type: 'base64',
  //       bookType: 'xlsx',
  //     });

  //     await RNFS.writeFile(filePath, base64Data, 'base64');

  //     setLoading(false);

  //     await Share.open({
  //       title: 'Share Excel Report',
  //       url: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`,
  //       filename: fileName,
  //       failOnCancel: false,
  //     });
  //   } catch (error) {
  //     setLoading(false);
  //     console.error('Excel export error:', error);
  //     Alert.alert('Error', error.message);
  //   }
  // };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            style={{
              height: 35,
              width: 35,
              tintColor: '#184D67',
            }}
            source={require('../../assets/back.png')}
          />
        </TouchableOpacity>
        <Card style={styles.cardTotal}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={styles.header}> Report</Text>
          </View>
        </Card>
        <TouchableOpacity></TouchableOpacity>
      </View>

      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            {/* Branch Dropdown */}
            <Text style={styles.sectionTitle}>Branch</Text>

            {locationArray && locationArray.length > 0 ? (
              <View
                style={{
                  width: 150,
                  height: 45, // 🔥 MUST be >= 44
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <Picker
                  selectedValue={branch}
                  onValueChange={itemValue => setBranch(itemValue)}
                  style={{
                    width: '100%',
                    fontSize: 14,
                    fontFamily: 'Lexend-Medium',
                    color: '#000',
                  }}
                  itemStyle={{
                    fontSize: 14,
                    fontFamily: 'Lexend-Medium',
                    color: '#000',
                  }}
                >
                  {locationArray.map((item, index) => (
                    <Picker.Item
                      style={{
                        fontSize: 13,
                        fontFamily: 'Lexend-Regular',
                        color: '#000',
                      }}
                      key={index}
                      label={item}
                      value={item}
                    />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text
                style={{
                  fontFamily: 'Lexend-Medium',
                  fontSize: 14,
                  color: '#000',
                }}
              >
                {branch}
              </Text>
            )}

            <Divider style={styles.divider} />

            {/* OPD / IPD */}
            <Text style={styles.sectionTitle}>Visit Type</Text>
            <SegmentedButtons
              value={visitType}
              onValueChange={setVisitType}
              buttons={[
                { value: 'OPD', label: 'OPD' },
                { value: 'IPD', label: 'IPD' },
              ]}
            />

            <Divider style={styles.divider} />

            {/* Sheet Type */}
            <Text style={styles.sectionTitle}>Sheet Type</Text>

            <RadioButton.Group
              onValueChange={value => setSheetType(value)}
              value={sheetType}
            >
              <View style={styles.radioRow}>
                <View style={styles.radioItem}>
                  <RadioButton value="Sheet1" />
                  <Text style={styles.radioLabel}>Sheet 1</Text>
                </View>

                <View style={styles.radioItem}>
                  <RadioButton value="Sheet2" />
                  <Text style={styles.radioLabel}>Sheet 2</Text>
                </View>
              </View>
            </RadioButton.Group>

            <Divider style={styles.divider} />

            {/* Date Range */}
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setOpenFrom(true)}
              >
                <Text style={styles.dateText}>{fromDate.toDateString()}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setOpenTo(true)}
              >
                <Text style={styles.dateText}>{toDate.toDateString()}</Text>
              </TouchableOpacity>
            </View>

            <DatePicker
              modal
              open={openFrom}
              date={fromDate}
              mode="date"
              onConfirm={date => {
                setOpenFrom(false);
                setFromDate(date);
              }}
              onCancel={() => setOpenFrom(false)}
            />

            <DatePicker
              modal
              open={openTo}
              date={toDate}
              mode="date"
              minimumDate={fromDate}
              onConfirm={date => {
                setOpenTo(false);
                setToDate(date);
              }}
              onCancel={() => setOpenTo(false)}
            />

            <Divider style={styles.divider} />

            {/* Download Excel */}
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={downloadExcel}
            >
              <Text style={styles.downloadText}>Download Excel</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
        <Portal>
          <Dialog
            visible={loading}
            onDismiss={() => setLoading(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 20,
            }}
          >
            <Dialog.Content>
              <Text variant="bodyMedium">Loading...</Text>
            </Dialog.Content>
            <ActivityIndicator
              animating={loading}
              size={'large'}
              color={'#01458e'}
            />
          </Dialog>
        </Portal>
      </View>
    </SafeAreaView>
  );
};

export default ReportScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgb(253, 253, 253)',
  },
  cardTotal: {
    minWidth: 160,
    height: 50,

    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginVertical: 5,
    borderRadius: 4,
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  card: {
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },

  /* Dropdown */
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 14,
    color: '#2c3e50',
  },

  /* Date */
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateBox: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 13,
    color: '#34495e',
  },

  /* Download */
  downloadBtn: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  downloadText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },

  radioLabel: {
    fontSize: 14,
    fontFamily: 'Lexend-Medium',
    color: '#000',
  },
});
