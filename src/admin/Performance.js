import React, { useState, useEffect } from 'react';
import {
  View,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import {
  Button,
  Card,
  Title,
  Paragraph,
  Menu,
  SegmentedButtons,
  Portal,
  Dialog,
  Text,
  ActivityIndicator,
  Switch,
} from 'react-native-paper';
import {
  LineChart,
  StackedBarChart,
  BarChart as KitBarChart,
} from 'react-native-chart-kit';
import { BarChart, XAxis, YAxis, Grid } from 'react-native-svg-charts';
import { scaleBand } from 'd3-scale';
import { G, Text as SVGText } from 'react-native-svg';
import { useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import VoiceAssistant from './VoiceAssistant';
import AIResponseCard from './AIResponseLayout';
import { SafeAreaView } from 'react-native-safe-area-context';

const screenWidth = Dimensions.get('window').width;

const BACKEND_URL = 'https://wedoc.in/hms'; //'http://192.168.1.4:5100/ivr'; //'https://admin.wedoc.in/ivr'; //

const PerformanceScreen = ({ navigation }) => {
  const route = useRoute();
  const location = useSelector(state => state.location.value);
  const [timePeriod, setTimePeriod] = useState('Monthly');
  const [parameter, setParameter] = useState('Leads');
  const [leadsData, setLeadsData] = useState({
    Monthly: {
      ivrChartData: { labels: [], thisYear: [], lastYear: [] },
      webChartData: { labels: [], thisYear: [], lastYear: [] },
      botChartData: { labels: [], thisYear: [], lastYear: [] },
    },
    Quarterly: {
      ivrChartData: { labels: [], thisYear: [], lastYear: [] },
      webChartData: { labels: [], thisYear: [], lastYear: [] },
      botChartData: { labels: [], thisYear: [], lastYear: [] },
    },
    Yearly: {
      'IVR Calls': [],
      'Web Leads': [],
      'Bot Leads': [],
    },
  });
  const [patientsData, setPatientsData] = useState({
    Monthly: {
      newPatientChartData: { labels: [], thisYear: [], lastYear: [] },
      followUpPatientChartData: { labels: [], thisYear: [], lastYear: [] },
      ipdPatientChartData: { labels: [], thisYear: [], lastYear: [] },
    },
    Quarterly: {
      newPatientChartData: { labels: [], thisYear: [], lastYear: [] },
      followUpPatientChartData: { labels: [], thisYear: [], lastYear: [] },
      ipdPatientChartData: { labels: [], thisYear: [], lastYear: [] },
    },
  });
  const [OPDData, setOPDData] = useState({
    Monthly: {
      opdPatientChartData: { labels: [], thisYear: [], lastYear: [] },
    },
    Quarterly: {
      opdPatientChartData: { labels: [], thisYear: [], lastYear: [] },
    },
  });
  const [IPDData, setIPDData] = useState({
    Monthly: {
      ipdPatientChartData: { labels: [], thisYear: [], lastYear: [] },
    },
    Quarterly: {
      ipdPatientChartData: { labels: [], thisYear: [], lastYear: [] },
    },
  });
  const [AIFormattedData, setAIFormattedData] = useState({});
  const [sampleData, setSampleData] = useState({
    Monthly: {
      'OPD Invoice': {},
      'LAB Invoice': {},
      'IPD Invoice': {},
      'New Appointments': {},
      'Follow-up Appointments': {},
      'IPD Patients': {},
      'IVR Calls': {},
      'Web Leads': {},
      'Bot Leads': {},
    },
    Quarterly: {
      'OPD Invoice': {},
      'LAB Invoice': {},
      'IPD Invoice': {},
      'New Appointments': {},
      'Follow-up Appointments': {},
      'IPD Patients': {},
      'IVR Calls': {},
      'Web Leads': {},
      'Bot Leads': {},
    },
    Yearly: {
      'OPD Invoice': [],
      'LAB Invoice': [],
      'IPD Invoice': [],
      'New Appointments': [],
      'Follow-up Appointments': [],
      'IPD Patients': [],
      'IVR Calls': [],
      'Web Leads': [],
      'Bot Leads': [],
    },
    Summary: {
      reply: {
        summary: '',
        performance: { best: [], worst: [] },
      },
    },
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('bar'); // default chart
  const [aiModalVisible, setAiModalVisible] = useState(false);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
      };
      try {
        setLoading(true);
        const response = await fetch(
          `${BACKEND_URL}/performance?location=${location}`,
          requestOptions,
        );
        const json = await response.json();
        console.log('Fetched performance data:', json.AIFilteredData);
        setSampleData(json);
        setAIFormattedData(json.AIFilteredData);
        setLeadsData(json.Leads);
        //console.log('Leads Data:', json.Patients);
        setPatientsData(json.Patients);
        setOPDData(json.Opd);
        setIPDData(json.Ipd);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching performance data:', error);
        setLoading(false);
      }
    };
    // Simulate fetching data from API
    fetchPerformanceData();
    //setData(sampleData[timePeriod][parameter] || []);
  }, [location]);

  useEffect(() => {
    let newData = [];

    newData = sampleData?.[timePeriod]?.[parameter] ?? [];

    setData(newData);
  }, [timePeriod, parameter, sampleData]);

  const Labels = ({ x, y, bandwidth, data }) => {
    const barWidth = bandwidth / data.length;
    return (
      <G>
        {data.map((dataset, datasetIndex) =>
          dataset.data.map((value, index) => (
            <SVGText
              key={`${datasetIndex}-${index}`}
              x={x(index) + datasetIndex * barWidth + barWidth / 2}
              y={y(value) - 2}
              fontSize={10}
              fill="black"
              textAnchor="middle"
            >
              {value}
            </SVGText>
          )),
        )}
      </G>
    );
  };

  const SafeLabels = ({ x, y, bandwidth, data }) => {
    // data is array of series objects when grouped: [{data: [...]}, {data: [...]}]
    // show total of group above bars (example) or show first series - adjust as needed
    const series = data[0]?.data || [];
    return series.map((value, index) => (
      <G key={`label-${index}`}>
        <SVGText
          x={x(index) + bandwidth / 2}
          y={y(value) - 6}
          fontSize={10}
          fill="black"
          alignmentBaseline="middle"
          textAnchor="middle"
        >
          {String(value)}
        </SVGText>
      </G>
    ));
  };

  function sanitizeData(rawData) {
    const now = new Date();
    const currentMonthIndex = now.getMonth(); // 0–11 (Jan=0)
    const currentMonthLabel = now.toLocaleString('en-US', { month: 'short' }); // e.g. "Sep"

    // Fiscal year starts in April → shift months by -3
    const fiscalMonthIndex = (currentMonthIndex + 9) % 12; // Apr=0, May=1, ..., Mar=11
    const currentQuarter = Math.floor(fiscalMonthIndex / 3) + 1; // Q1=Apr–Jun, Q2=Jul–Sep, etc.

    const safeMonthly = Object.entries(rawData.Monthly || {}).reduce(
      (acc, [label, obj]) => {
        acc[label] = {
          currentYear: (obj.currentYear || []).filter(
            m => m.label !== currentMonthLabel, // hide current month
          ),
          previousYear: (obj.previousYear || []).filter(
            m => m.label !== currentMonthLabel,
          ),
        };
        return acc;
      },
      {},
    );

    const safeQuarterly = Object.entries(rawData.Quarterly || {}).reduce(
      (acc, [label, obj]) => {
        acc[label] = {
          currentYear: (obj.currentYear || []).filter(q => {
            const qNum = parseInt(q.label.replace('Q', ''), 10);
            // hide current + future quarters
            return qNum < currentQuarter;
          }),
          previousYear: (obj.previousYear || []).filter(q => {
            const qNum = parseInt(q.label.replace('Q', ''), 10);
            return qNum < currentQuarter;
          }),
        };
        return acc;
      },
      {},
    );

    return {
      ...rawData,
      Monthly: safeMonthly,
      Quarterly: safeQuarterly,
    };
  }

  const ComparisonChart = ({ title, chartData = {}, timePeriod }) => {
    const screenWidth = Dimensions.get('window').width - 32;

    const labelsRaw = chartData.labels || [];
    const lastYearRaw = chartData.lastYear || [];
    const thisYearRaw = chartData.thisYear || [];

    const parseNumber = v => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      // remove commas, currency symbols, spaces etc
      const cleaned = String(v).replace(/[^\d.-]/g, '');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // sanitize to numbers
    const lastYear = lastYearRaw.map(parseNumber);
    const thisYear = thisYearRaw.map(parseNumber);

    // ensure arrays and labels have the same length (pad with zeros if needed)
    const maxLen = Math.max(
      labelsRaw.length,
      lastYear.length,
      thisYear.length,
      1,
    );
    const pad = arr => {
      const out = arr.slice(0, maxLen);
      while (out.length < maxLen) out.push(0);
      return out;
    };
    const labels = labelsRaw
      .slice(0, maxLen)
      .concat(
        Array.from(
          { length: Math.max(0, maxLen - labelsRaw.length) },
          (_, i) => `L${i + labelsRaw.length + 1}`,
        ),
      );
    const last = pad(lastYear);
    const current = pad(thisYear);

    // compute yMax and provide a little headroom
    const allValues = [...last, ...current];
    const rawMax = allValues.length ? Math.max(...allValues) : 0;
    const yMax = Math.ceil(rawMax * 1.12) || 1; // 12% headroom
    const contentInset = { top: 20, bottom: 20 };
    const chartHeight = 250;

    // prepare bar data (grouped)
    const barData = [
      { data: last, svg: { fill: '#9e9e9e' } },
      { data: current, svg: { fill: '#2196f3' } },
    ];

    const lineData = {
      labels,
      datasets: [
        { data: lastYear, color: () => '#9e9e9e' },
        { data: thisYear, color: () => '#2196f3' },
      ],
      legend: ['Last Year', 'This Year'],
    };

    // debug (uncomment while testing)
    // console.log({ labels, last, current, rawMax, yMax, allValues });

    return (
      <View style={{ marginVertical: 10 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 5,
            textAlign: 'center',
          }}
        >
          {title} ({timePeriod})
        </Text>

        {chartType === 'bar' ? (
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 10,
              height: chartHeight,
            }}
          >
            {/* YAxis uses the same numeric range */}
            <YAxis
              data={[0, yMax]}
              contentInset={contentInset}
              svg={{ fontSize: 10, fill: 'black' }}
              numberOfTicks={6}
              formatLabel={value => `${value}`}
              style={{ marginBottom: 20 }}
            />

            <View style={{ flex: 1, marginLeft: 10 }}>
              <BarChart
                style={{ flex: 1, width: screenWidth }}
                data={barData}
                yAccessor={({ item }) => Number(item)} // ensure numeric
                spacingInner={0.3}
                spacingOuter={0.2}
                contentInset={contentInset}
                groupMode="grouped"
                yMin={0}
                yMax={yMax}
              >
                {/* render labels using chart's scale */}
                <Labels />
              </BarChart>

              <XAxis
                style={{ marginTop: 10 }}
                data={labels}
                scale={scaleBand}
                formatLabel={(value, index) => labels[index]}
                svg={{ fontSize: 10, fill: 'black' }}
              />
            </View>
          </View>
        ) : (
          <LineChart
            data={lineData}
            width={Math.max(screenWidth, labels.length * 60)}
            height={250}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            fromZero
            bezier
            style={{ borderRadius: 10 }}
          />
        )}

        {/* Legend */}
        {chartType === 'bar' && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 15,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: '#9e9e9e',
                  marginRight: 5,
                }}
              />
              <Text style={{ fontSize: 12 }}>Last Year</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: '#2196f3',
                  marginRight: 5,
                }}
              />
              <Text style={{ fontSize: 12 }}>This Year</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const SingleBarChart = ({ title, chartData }) => {
    const screenWidth = Dimensions.get('window').width - 32;

    const safeData = Array.isArray(chartData) ? chartData : [];
    const labels = safeData.map(item => String(item.label ?? ''));
    const values = safeData.map(item => Number(item.value) || 0);

    const chartProps = {
      data: {
        labels,
        datasets: [{ data: values }],
      },
      width: Math.max(screenWidth, labels.length * 60),
      height: 250,
      chartConfig: {
        backgroundColor: '#fff',
        backgroundGradientFrom: '#fff',
        backgroundGradientTo: '#fff',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
      },
      fromZero: true,
      showValuesOnTopOfBars: chartType === 'bar',
      style: { borderRadius: 10 },
    };

    const ChartComponent = chartType === 'bar' ? KitBarChart : LineChart;

    return (
      <View style={{ marginVertical: 20 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <ChartComponent {...chartProps} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.maincontainer} edges={['top', 'bottom']}>
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

        <Text style={styles.header}> Performance Dashboard</Text>

        {/* Switch for Chart Type */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ marginRight: 5, fontSize: 12, color: '#184D67' }}>
            {chartType === 'bar' ? 'Bar' : 'Line'}
          </Text>
          <Switch
            value={chartType === 'line'}
            onValueChange={val => setChartType(val ? 'line' : 'bar')}
            thumbColor={'#184D67'}
            trackColor={{ false: '#ccc', true: '#6FA8DC' }}
          />
        </View>
      </View>
      <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 10 }}>
        {/* Filters */}
        <View style={{ marginBottom: 10 }}>
          {/* Parameter SegmentedButtons */}
          {/* <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{marginBottom: 10}}> */}
          <SegmentedButtons
            value={parameter}
            onValueChange={setParameter}
            buttons={[
              { value: 'Leads', label: 'Leads' },
              { value: 'Patients', label: 'Patients' },
              { value: 'OPD Invoice', label: 'OPD' },
              { value: 'IPD Invoice', label: 'IPD' },
            ]}
            style={{ flex: 1, marginBottom: 10 }}
          />
          {/* </ScrollView> */}
          {/* Time Period SegmentedButtons */}
          <SegmentedButtons
            value={timePeriod}
            onValueChange={setTimePeriod}
            buttons={[
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Quarterly', label: 'Quarterly' },
              { value: 'Yearly', label: 'Yearly' },
            ]}
          />
          {/* <VoiceAssistant
            key={`${timePeriod}-${parameter}`} // 🔑 re-mounts on change
            data={AIFormattedData} // pass the same sampleData object you maintain in screen
          /> */}
          {/* <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
           
            <Button
              mode="contained"
              style={{marginTop: 10, backgroundColor: '#184D67', width: '65%'}}
              onPress={() => setAiModalVisible(true)}>
              View Summary Report
            </Button>
          </View> */}
        </View>
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

        {/* Chart */}

        <View style={{ paddingBottom: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {parameter === 'Leads' ? (
              <View style={{ flex: 1, flexDirection: 'column' }}>
                <View style={{ marginVertical: 10 }}>
                  {timePeriod === 'Yearly' ? (
                    <>
                      <SingleBarChart
                        title="IVR Calls"
                        chartData={sampleData['Yearly']['IVR Calls']}
                      />
                      <SingleBarChart
                        title="Web Leads"
                        chartData={sampleData['Yearly']['Web Leads']}
                      />
                      <SingleBarChart
                        title="Bot Leads"
                        chartData={sampleData['Yearly']['Bot Leads']}
                      />
                    </>
                  ) : (
                    <>
                      <ComparisonChart
                        title="IVR Calls"
                        timePeriod={timePeriod}
                        chartData={{
                          labels: [
                            ...leadsData[timePeriod]?.ivrChartData?.labels,
                          ],
                          thisYear: [
                            ...leadsData[timePeriod]?.ivrChartData?.thisYear,
                          ],
                          lastYear: [
                            ...leadsData[timePeriod]?.ivrChartData?.lastYear,
                          ],
                        }}
                      />
                      <View style={{ marginVertical: 10 }}>
                        <ComparisonChart
                          title="Web Leads"
                          timePeriod={timePeriod}
                          chartData={{
                            labels: [
                              ...leadsData[timePeriod]?.webChartData?.labels,
                            ],
                            thisYear: [
                              ...leadsData[timePeriod]?.webChartData?.thisYear,
                            ],
                            lastYear: [
                              ...leadsData[timePeriod]?.webChartData?.lastYear,
                            ],
                          }}
                        />
                      </View>

                      <View style={{ marginVertical: 10 }}>
                        <ComparisonChart
                          title="Chatbot Leads"
                          timePeriod={timePeriod}
                          chartData={{
                            labels: [
                              ...leadsData[timePeriod]?.botChartData?.labels,
                            ],
                            thisYear: [
                              ...leadsData[timePeriod]?.botChartData?.thisYear,
                            ],
                            lastYear: [
                              ...leadsData[timePeriod]?.botChartData?.lastYear,
                            ],
                          }}
                        />
                      </View>
                    </>
                  )}
                </View>
              </View>
            ) : parameter === 'Patients' ? (
              <View style={{ flex: 1, flexDirection: 'column' }}>
                <View style={{ marginVertical: 10 }}>
                  {timePeriod === 'Yearly' ? (
                    <>
                      <SingleBarChart
                        title="New Appointments"
                        chartData={sampleData['Yearly']['New Appointments']}
                      />
                      <SingleBarChart
                        title="Follow-up Appointments"
                        chartData={
                          sampleData['Yearly']['Follow-up Appointments']
                        }
                      />
                      <SingleBarChart
                        title="IPD Patients"
                        chartData={sampleData['Yearly']['IPD Patients']}
                      />
                    </>
                  ) : (
                    <>
                      <ComparisonChart
                        title="New Appointments"
                        timePeriod={timePeriod}
                        chartData={{
                          labels: [
                            ...patientsData[timePeriod]?.newPatientChartData
                              ?.labels,
                          ],
                          thisYear: [
                            ...patientsData[timePeriod]?.newPatientChartData
                              ?.thisYear,
                          ],
                          lastYear: [
                            ...patientsData[timePeriod]?.newPatientChartData
                              ?.lastYear,
                          ],
                        }}
                      />
                      <View style={{ marginVertical: 10 }}>
                        <ComparisonChart
                          title="Follow-Up Appointments"
                          timePeriod={timePeriod}
                          chartData={{
                            labels: [
                              ...patientsData[timePeriod]
                                ?.followUpPatientChartData?.labels,
                            ],
                            thisYear: [
                              ...patientsData[timePeriod]
                                ?.followUpPatientChartData?.thisYear,
                            ],
                            lastYear: [
                              ...patientsData[timePeriod]
                                ?.followUpPatientChartData?.lastYear,
                            ],
                          }}
                        />
                      </View>
                      <View style={{ marginVertical: 10 }}>
                        <ComparisonChart
                          title="IPD Patients"
                          timePeriod={timePeriod}
                          chartData={{
                            labels: [
                              ...patientsData[timePeriod]?.ipdPatientChartData
                                ?.labels,
                            ],
                            thisYear: [
                              ...patientsData[timePeriod]?.ipdPatientChartData
                                ?.thisYear,
                            ],
                            lastYear: [
                              ...patientsData[timePeriod]?.ipdPatientChartData
                                ?.lastYear,
                            ],
                          }}
                        />
                      </View>
                    </>
                  )}
                </View>
              </View>
            ) : parameter === 'OPD Invoice' ? (
              <View style={{ flex: 1, flexDirection: 'column' }}>
                <View style={{ marginVertical: 10 }}>
                  {timePeriod === 'Yearly' ? (
                    <>
                      <SingleBarChart
                        title="OPD Invoice"
                        chartData={sampleData['Yearly']['OPD Invoice']}
                      />
                      <SingleBarChart
                        title="LAB Invoice"
                        chartData={sampleData['Yearly']['LAB Invoice']}
                      />
                    </>
                  ) : (
                    <>
                      <ComparisonChart
                        title="Overall OPD Invoice"
                        timePeriod={timePeriod}
                        chartData={{
                          labels: [
                            ...OPDData[timePeriod]?.opdPatientChartData?.labels,
                          ],
                          thisYear: [
                            ...OPDData[timePeriod]?.opdPatientChartData
                              ?.thisYear,
                          ],
                          lastYear: [
                            ...OPDData[timePeriod]?.opdPatientChartData
                              ?.lastYear,
                          ],
                        }}
                      />
                      <ComparisonChart
                        title="LAB Invoice"
                        timePeriod={timePeriod}
                        chartData={{
                          labels: [
                            ...OPDData[timePeriod]?.labChartData?.labels,
                          ],
                          thisYear: [
                            ...OPDData[timePeriod]?.labChartData?.thisYear,
                          ],
                          lastYear: [
                            ...OPDData[timePeriod]?.labChartData?.lastYear,
                          ],
                        }}
                      />
                    </>
                  )}
                </View>
              </View>
            ) : (
              parameter === 'IPD Invoice' && (
                <View style={{ flex: 1, flexDirection: 'column' }}>
                  <View style={{ marginVertical: 10 }}>
                    {timePeriod === 'Yearly' ? (
                      <>
                        <SingleBarChart
                          title="IPD Invoice"
                          chartData={sampleData['Yearly']['IPD Invoice']}
                        />
                        <SingleBarChart
                          title="IPD Patients"
                          chartData={sampleData['Yearly']['IPD Patients']}
                        />
                      </>
                    ) : (
                      <>
                        <ComparisonChart
                          title="IPD Invoice"
                          timePeriod={timePeriod}
                          chartData={{
                            labels: [
                              ...IPDData[timePeriod]?.ipdPatientChartData
                                ?.labels,
                            ],
                            thisYear: [
                              ...IPDData[timePeriod]?.ipdPatientChartData
                                ?.thisYear,
                            ],
                            lastYear: [
                              ...IPDData[timePeriod]?.ipdPatientChartData
                                ?.lastYear,
                            ],
                          }}
                        />
                        <View style={{ marginVertical: 10 }}>
                          <ComparisonChart
                            title="IPD Patients"
                            timePeriod={timePeriod}
                            chartData={{
                              labels: [
                                ...patientsData[timePeriod]?.ipdPatientChartData
                                  ?.labels,
                              ],
                              thisYear: [
                                ...patientsData[timePeriod]?.ipdPatientChartData
                                  ?.thisYear,
                              ],
                              lastYear: [
                                ...patientsData[timePeriod]?.ipdPatientChartData
                                  ?.lastYear,
                              ],
                            }}
                          />
                        </View>
                      </>
                    )}
                  </View>
                </View>
              )
            )}
          </ScrollView>

          <Paragraph
            style={{ textAlign: 'right', marginTop: 5, color: 'gray' }}
          >
            👉 Scroll right to see more
          </Paragraph>
        </View>

        {/* AI Modal */}
        {/* <Portal>
          <Dialog
            visible={aiModalVisible}
            onDismiss={() => setAiModalVisible(false)}
            style={{maxHeight: '80%', backgroundColor: '#fff'}}>
            <Dialog.ScrollArea>
              <ScrollView>
                <View style={{padding: 16}}>
                
                  <Text
                    style={{fontSize: 16, fontWeight: 'bold', marginBottom: 8}}>
                    Summary
                  </Text>
                  <Text style={{marginBottom: 16}}>
                    {sampleData.Summary.reply.summary}
                  </Text>

                  
                  {sampleData.Summary.reply.performance && (
                    <>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: 'bold',
                          marginBottom: 8,
                        }}>
                        Performance
                      </Text>

                    
                      {sampleData.Summary.reply.performance.best && (
                        <Text style={{marginBottom: 4}}>
                          🟢 Best:{' '}
                          {sampleData.Summary.reply.performance.best.type} –{' '}
                          {sampleData.Summary.reply.performance.best.period} (
                          {sampleData.Summary.reply.performance.best.value})
                        </Text>
                      )}

                      
                      {sampleData.Summary.reply.performance.worst && (
                        <Text>
                          🔴 Worst:{' '}
                          {sampleData.Summary.reply.performance.worst.type} –{' '}
                          {sampleData.Summary.reply.performance.worst.period} (
                          {sampleData.Summary.reply.performance.worst.value})
                        </Text>
                      )}
                    </>
                  )}
                </View>
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={() => setAiModalVisible(false)}>Close</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal> */}

        {/* <Paragraph style={{textAlign: 'center', marginTop: 20}}>
            No data available for selected filters.
          </Paragraph> */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default PerformanceScreen;

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
    padding: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  cardTotal: {
    minWidth: 160,
    height: 60,

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
});
