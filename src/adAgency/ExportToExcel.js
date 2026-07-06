import XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { Platform, Alert } from 'react-native';

/* Turn one chunk of data into a worksheet. Handles:
   - array of objects  -> table with auto headers
   - array of arrays   -> raw rows
   - plain object       -> two-column Metric / Value sheet            */
const formatVal = v =>
  v !== null && typeof v === 'object' ? JSON.stringify(v) : v;

const makeSheet = data => {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return XLSX.utils.aoa_to_sheet([['No data']]);
  }
  if (
    Array.isArray(data) &&
    typeof data[0] === 'object' &&
    !Array.isArray(data[0])
  ) {
    return XLSX.utils.json_to_sheet(data);
  }
  if (Array.isArray(data)) {
    return XLSX.utils.aoa_to_sheet(data);
  }
  const rows = [
    ['Metric', 'Value'],
    ...Object.entries(data).map(([k, v]) => [k, formatVal(v)]),
  ];
  return XLSX.utils.aoa_to_sheet(rows);
};

/**
 * Build an .xlsx file and open the share sheet so the user can
 * save it / send it anywhere.
 *
 * Pass EITHER:
 *   exportToExcel({ data, fileName })                         // single sheet
 *   exportToExcel({ sheets: [{ name, data }, ...], fileName }) // multiple sheets
 */
export const exportToExcel = async ({
  sheets,
  data,
  fileName = 'report',
  sheetName = 'Sheet1',
}) => {
  const wb = XLSX.utils.book_new();
  const list = sheets && sheets.length ? sheets : [{ name: sheetName, data }];
  list.forEach((s, i) => {
    const ws = makeSheet(s.data);
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      (s.name || `Sheet${i + 1}`).slice(0, 31),
    );
  });

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const { dirs } = ReactNativeBlobUtil.fs;

  if (Platform.OS === 'android') {
    // Saves straight into the public Downloads folder + shows a notification
    const path = `${dirs.DownloadDir}/${fileName}.xlsx`;
    await ReactNativeBlobUtil.fs.writeFile(path, wbout, 'base64');

    ReactNativeBlobUtil.android.addCompleteDownload({
      title: `${fileName}.xlsx`,
      description: 'Download complete',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      path,
      showNotification: true,
    });

    try {
      await Share.open({
        url: `file://${path}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${fileName}.xlsx`,
        failOnCancel: false,
      });
    } catch (e) {
      // user dismissed the share sheet — file is still saved, so ignore
    }

    Alert.alert('Downloaded', `Saved to Downloads:\n${fileName}.xlsx`);
    return path;
  }

  // iOS has no public Downloads folder — write to app docs, then offer to open/share
  const iosPath = `${dirs.DocumentDir}/${fileName}.xlsx`;
  await ReactNativeBlobUtil.fs.writeFile(iosPath, wbout, 'base64');
  await ReactNativeBlobUtil.ios.presentOptionsMenu(iosPath); // "Save to Files" appears here
  return iosPath;
};
