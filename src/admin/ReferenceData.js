import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Card,
  Text,
  Divider,
  Portal,
  Modal,
  Button,
  RadioButton,
  Dialog,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ModalDropdown from 'react-native-modal-dropdown';
import { PieChart } from 'react-native-svg-charts';
import { G, Svg, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker'; // ✅ Add this import

const BACKEND_URL = 'https://wedoc.in/hms';

const generateMonthsList = () => {
  const currentDate = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - i,
      1,
    );
    months.push({
      label: date.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      }),
      value: date,
    });
  }
  return months;
};

const ReferenceData = ({ navigation }) => {
  const location = useSelector(state => state.location.value);
  // ✅ All hooks declared unconditionally at top level, same order every render
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [visible1, setVisible1] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalInvoiceCount, setTotalInvoiceCount] = useState(0);
  const [filterType, setFilterType] = useState('month');
  const [monthsList] = useState(generateMonthsList); // ✅ pass fn reference, not call
  const [month, setMonth] = useState(() => generateMonthsList()[0].label); // ✅ lazy init
  const [selectedMonth, setSelectedMonth] = useState(
    () => generateMonthsList()[0],
  );
  const [selectedYear, setSelectedYear] = useState(null);
  const [customFromDate, setCustomFromDate] = useState(new Date());
  const [customToDate, setCustomToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const handleMonthChange = index => {
    const selected = monthsList[index];
    setSelectedMonth(selected);
    const from = new Date(
      selected.value.getFullYear(),
      selected.value.getMonth(),
      1,
    );
    const to = new Date(
      selected.value.getFullYear(),
      selected.value.getMonth() + 1,
      0,
    );
    setFromDate(from);
    setToDate(to);
  };

  const hideModal1 = () => setVisible1(false);

  const yearsList = [
    { label: '2022-2023', value: '2022' },
    { label: '2023-2024', value: '2023' },
    { label: '2024-2025', value: '2024' },
    { label: '2025-2026', value: '2025' },
    { label: '2026-2027', value: '2026' },
  ];

  const handleYearChange = index => {
    const selected = yearsList[index];
    setSelectedYear(selected);
    const from = new Date(selected.value, 3, 1);
    const to = new Date(Number(selected.value) + 1, 2, 31);
    setFromDate(from);
    setToDate(to);
  };

  const handleClick = async () => {
    try {
      if (filterType === 'month' && !selectedMonth) {
        Alert.alert('Error!', 'Please select a month.');
        return;
      }
      if (filterType === 'year' && !selectedYear) {
        Alert.alert('Error!', 'Please select a year.');
        return;
      }
      if (filterType === 'custom') {
        if (customFromDate > customToDate) {
          Alert.alert('Error!', 'From date cannot be after To date.');
          return;
        }
        setFromDate(customFromDate);
        setToDate(customToDate);
        setMonth(
          `${customFromDate.toLocaleDateString(
            'en-GB',
          )} - ${customToDate.toLocaleDateString('en-GB')}`,
        );
        await fetchReferenceTypeCounts(
          location,
          customFromDate.toLocaleDateString('en-CA'),
          customToDate.toLocaleDateString('en-CA'),
        );
        hideModal1();
        return;
      }

      if (filterType === 'month') {
        setMonth(selectedMonth.label);
      } else {
        setMonth(selectedYear.label);
      }
      await fetchReference();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchReference = async () => {
    try {
      fetchReferenceTypeCounts(
        location,
        fromDate.toLocaleDateString('en-CA'),
        toDate.toLocaleDateString('en-CA'),
      );
      setSelectedMonth(null);
      setSelectedYear(null);
    } catch (error) {
      console.error('Error fetching convincing score:', error);
    } finally {
      hideModal1();
    }
  };

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toLocaleDateString('en-CA');
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).toLocaleDateString('en-CA');
    fetchReferenceTypeCounts(location, startOfMonth, endOfMonth);
  }, [location]);

  const fetchReferenceTypeCounts = async (location, from, to) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/Patient/referenceV2?location=${location}&from=${from}&to=${to}`,
      );
      const result = await response.json();
      const sortedData = result.referenceTypeCount.sort(
        (a, b) => b.count - a.count,
      );
      setTotalCount(result.totalCount);
      setTotalInvoiceCount(result.totalInvoiceCount);
      setData(sortedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = data.map((item, index) => ({
    key: index,
    value: item.count,
    svg: { fill: getColor(index) },
    label: item.percentage,
  }));

  function getColor(index) {
    const colors = [
      '#ff6384',
      '#36a2eb',
      '#ffce56',
      '#4bc0c0',
      '#9966ff',
      '#ff9f40',
    ];
    return colors[index % colors.length];
  }

  const Labels = ({ slices }) => {
    return slices.map((slice, index) => {
      const { labelCentroid, data } = slice;
      if (data.label < 5) return null;
      return (
        <G key={index}>
          <SvgText
            x={labelCentroid[0] * 2.2}
            y={labelCentroid[1] * 2.2}
            fill="black"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={12}
            fontWeight="bold"
          >
            {data.value}
          </SvgText>
          <SvgText
            x={labelCentroid[0] * 1.2}
            y={labelCentroid[1] * 1.2}
            fill="black"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={12}
            fontWeight="bold"
          >
            {`${data.label}%`}
          </SvgText>
        </G>
      );
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#FFF' }}
      edges={['top', 'bottom']}
    >
      {loading ? (
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
              <Text variant="bodyMedium">Loading..</Text>
            </Dialog.Content>
            <ActivityIndicator
              animating={loading}
              size={'large'}
              color={'#01458e'}
            />
          </Dialog>
        </Portal>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Image
                style={{ height: 35, width: 35, tintColor: '#184D67' }}
                source={require('../../assets/back.png')}
              />
            </TouchableOpacity>
            <Text style={styles.header}>{month}</Text>
            <TouchableOpacity
              onPress={() => {
                setFromDate(new Date());
                setToDate(new Date());
                setVisible1(true);
              }}
            >
              <Image
                style={{ height: 30, width: 30, tintColor: '#184D67' }}
                source={require('../../assets/filter.png')}
              />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Card
              style={{ padding: 16, borderRadius: 10, backgroundColor: '#FFF' }}
            >
              {data && (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Lexend-Regular',
                        fontSize: 14,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        width: '48%',
                        textAlign: 'left',
                      }}
                    >
                      📌 Reference Type
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Lexend-Regular',
                        fontSize: 14,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        width: '22%',
                        textAlign: 'left',
                      }}
                    >
                      Count 📊
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Lexend-Regular',
                        fontSize: 14,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        width: '30%',
                        textAlign: 'left',
                      }}
                    >
                      Conversion 📊
                    </Text>
                  </View>
                  <Divider style={{ marginBottom: 10 }} />
                  {data.map((item, index) => (
                    <View
                      key={index}
                      style={{
                        width: '100%',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 14,
                          color: '#000',
                          width: '48%',
                          textAlign: 'left',
                        }}
                      >
                        {index + 1}. {item.reference_type}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 14,
                          fontWeight: 'bold',
                          color: '#6200ee',
                          width: '26%',
                          textAlign: 'left',
                        }}
                      >
                        {item.count} ({`${item.percentage}%`})
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Lexend-Regular',
                          fontSize: 14,
                          fontWeight: 'bold',
                          color: '#6200ee',
                          width: '26%',
                          textAlign: 'left',
                        }}
                      >
                        {item.invoiceCount} ({`${item.invoicePercentage}%`})
                      </Text>
                    </View>
                  ))}
                  <Divider style={{ marginBottom: 10 }} />
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Lexend-Regular',
                        fontSize: 18,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        width: '48%',
                        textAlign: 'left',
                      }}
                    >
                      Total
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Lexend-Regular',
                        fontSize: 18,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        width: '26%',
                        textAlign: 'left',
                      }}
                    >
                      {totalCount}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Lexend-Regular',
                        fontSize: 18,
                        fontWeight: 'bold',
                        marginBottom: 10,
                        width: '26%',
                        textAlign: 'left',
                      }}
                    >
                      {totalInvoiceCount}
                    </Text>
                  </View>
                </>
              )}
            </Card>

            <Card
              style={{
                padding: 16,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: '#FFF',
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}
              >
                📊 Reference Type Distribution
              </Text>
              {data.length > 0 ? (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ height: 250, width: 250 }}>
                    <PieChart
                      style={{ height: 250, width: 250 }}
                      data={pieData}
                      innerRadius={0}
                      outerRadius={100}
                    >
                      <Labels />
                    </PieChart>
                  </View>
                </View>
              ) : (
                <Text style={{ textAlign: 'center', marginTop: 20 }}>
                  No data available
                </Text>
              )}
            </Card>
          </ScrollView>

          <Portal>
            <Modal
              visible={visible1}
              onDismiss={hideModal1}
              contentContainerStyle={styles.modal}
            >
              <ScrollView>
                <View style={styles.header}>
                  <Text style={styles.title}>Select Filter Type</Text>
                </View>

                <RadioButton.Group
                  onValueChange={value => setFilterType(value)}
                  value={filterType}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setFilterType('month');
                      setSelectedMonth(null);
                    }}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="month" />
                    <Text>Month-wise</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setFilterType('year');
                      setSelectedYear(null);
                    }}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="year" />
                    <Text>Year-wise</Text>
                  </TouchableOpacity>
                  {/* ✅ New Custom Date Range option */}
                  <TouchableOpacity
                    onPress={() => setFilterType('custom')}
                    style={styles.radioContainer}
                  >
                    <RadioButton value="custom" />
                    <Text>Custom Date Range</Text>
                  </TouchableOpacity>
                </RadioButton.Group>

                {filterType === 'month' && (
                  <ModalDropdown
                    style={styles.dropdown}
                    textStyle={styles.dropdownText}
                    dropdownStyle={styles.dropdownList}
                    dropdownTextStyle={styles.dropdownItemText}
                    options={monthsList.map(item => item.label)}
                    onSelect={handleMonthChange}
                    defaultValue="Select Month"
                  />
                )}

                {filterType === 'year' && (
                  <ModalDropdown
                    style={styles.dropdown}
                    textStyle={styles.dropdownText}
                    dropdownStyle={styles.dropdownList}
                    dropdownTextStyle={styles.dropdownItemText}
                    options={yearsList.map(item => item.label)}
                    onSelect={handleYearChange}
                    defaultValue="Select Year"
                  />
                )}

                {/* ✅ Custom Date Range Pickers */}
                {filterType === 'custom' && (
                  <View style={{ marginVertical: 10 }}>
                    <Text style={styles.dateLabel}>From Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFromPicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {customFromDate.toLocaleDateString('en-GB')}
                      </Text>
                      <Icon name="calendar" size={20} color="#007bff" />
                    </TouchableOpacity>

                    <Text style={[styles.dateLabel, { marginTop: 12 }]}>
                      To Date
                    </Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowToPicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {customToDate.toLocaleDateString('en-GB')}
                      </Text>
                      <Icon name="calendar" size={20} color="#007bff" />
                    </TouchableOpacity>

                    <DatePicker
                      modal
                      open={showFromPicker}
                      date={customFromDate}
                      mode="date"
                      maximumDate={new Date()}
                      onConfirm={date => {
                        setShowFromPicker(false);
                        setCustomFromDate(date);
                      }}
                      onCancel={() => setShowFromPicker(false)}
                    />
                    <DatePicker
                      modal
                      open={showToPicker}
                      date={customToDate}
                      mode="date"
                      minimumDate={customFromDate}
                      maximumDate={new Date()}
                      onConfirm={date => {
                        setShowToPicker(false);
                        setCustomToDate(date);
                      }}
                      onCancel={() => setShowToPicker(false)}
                    />
                  </View>
                )}

                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  <View style={styles.buttonContainer}>
                    <Button
                      mode="outlined"
                      onPress={hideModal1}
                      style={styles.button}
                      textColor="#007bff"
                    >
                      Back
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleClick}
                      style={[styles.button, styles.findButton]}
                    >
                      Find
                    </Button>
                  </View>
                </KeyboardAvoidingView>
              </ScrollView>
            </Modal>
          </Portal>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ReferenceData;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerContainer: {
    marginVertical: 3,
    paddingHorizontal: 10,
    width: '100%',
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubContainer: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    flexDirection: 'row',
    marginVertical: 5,
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
  card: {
    minWidth: '28%',
    height: 80,
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFF3F0FF',
    borderRadius: 4,
    borderLeftWidth: 5,
  },
  modal: {
    backgroundColor: 'white',
    paddingVertical: 50,
    paddingHorizontal: 20,
    marginHorizontal: 10,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 11.78,
    marginVertical: 10,
    padding: 8,
    borderWidth: 1,
  },
  profileInput: {
    fontFamily: 'Lexend-Medium',
    fontSize: 16,
    lineHeight: 19,
    color: '#000000',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  header: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Lexend-Medium',
    textAlign: 'center',
  },
  subHeader: { fontFamily: 'Lexend-Regular', fontSize: 14, color: '#000' },
  title: { fontFamily: 'Lexend-Bold', fontSize: 20 },
  label: { fontFamily: 'Lexend-Regular', fontSize: 16, marginBottom: 10 },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  dropdownText: { fontSize: 16, fontFamily: 'Lexend-Medium', color: '#000' },
  dropdownList: {
    width: '80%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  dropdownItemText: { fontSize: 16, padding: 10, fontFamily: 'Lexend-Regular' },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
  },
  button: { width: 150 },
  findButton: { backgroundColor: '#007bff' },
  // ✅ New styles for custom date picker
  dateLabel: {
    fontFamily: 'Lexend-Regular',
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
  },
  dateButtonText: { fontFamily: 'Lexend-Medium', fontSize: 16, color: '#000' },
});
