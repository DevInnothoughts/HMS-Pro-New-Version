/* eslint-disable prettier/prettier */
// src/screens/feedbackExcel.js
// ─────────────────────────────────────────────────────────────────────────────
// Styled workbook for the patient feedback screen.
//
// Uses xlsx-js-style, RNFS and react-native-share — the same trio
// SummaryReportScreen and TargetComparisonScreen already use. Plain `xlsx`
// silently drops every style, so a workbook built with it looks nothing like
// this one.
//
// THREE SHEETS
//   Summary    the cohort figures, with both formulas written out
//   Responses  one row per responder, all ten answers, colour-coded
//   Awaiting   operated patients who have not replied
//
// The Awaiting sheet is not padding. A workbook containing only responders
// invites someone to read twelve good scores as the branch's performance; the
// third sheet is what makes the response rate concrete when the file is opened
// by someone who never saw the app screen.
//
// COLOUR RULES
//   Recommend score  9–10 green · 7–8 amber · 0–6 red   (standard NPS bands)
//   PSI              ≥85 green · ≥70 amber · below red
//   Ratings          5 green · 4 light green · 3 amber · ≤2 red
// The rating thresholds are a reading aid, not a clinical standard — if the
// business has its own cut-offs, change them here in one place.
// ─────────────────────────────────────────────────────────────────────────────

import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import XLSX from 'xlsx-js-style';
import { computeNps } from '../design/components/NpsBlock';

/* ── palette ─────────────────────────────────────────────────────────────── */
const INK = '0F1A16';
const BRAND = '14603F';
const BAND_HEAD = '2A4438';
const GREEN = '1E7A5A';
const GREEN_SOFT = 'E7F2EC';
const AMBER = 'B26A00';
const AMBER_SOFT = 'FBF0DD';
const RED = 'B3382B';
const RED_SOFT = 'F8E6E3';
const GREY = '9AA5B1';
const ZEBRA = 'F7F9F8';

const THIN = { style: 'thin', color: { rgb: 'D9E0DC' } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

// Type EXPLICITLY. Without `t`, xlsx guesses — and it guessed string for every
// number in the sheet, so percentage formats rendered as raw decimals (0.79
// instead of 79%) and nothing could be summed or charted.
const mk = (v, s) =>
  typeof v === 'number' && Number.isFinite(v)
    ? { v, t: 'n', s }
    : { v, t: 's', s };

const ST_TITLE = {
  font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: INK } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const ST_SUBTITLE = {
  font: { sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BAND_HEAD } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const ST_HEAD = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BRAND } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER,
};
const ST_GROUP = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: BAND_HEAD } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};
const ST_LABEL = {
  font: { sz: 10, color: { rgb: '16211D' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER,
};
const ST_LABEL_ALT = { ...ST_LABEL, fill: { fgColor: { rgb: ZEBRA } } };
const ST_METRIC = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: BORDER,
};
const ST_NOTE = {
  font: { italic: true, sz: 9, color: { rgb: '6C7C75' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
};
const ST_DASH = {
  font: { sz: 10, color: { rgb: GREY } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
};

const centred = (extra = {}) => ({
  font: { sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
  ...extra,
});

const scoreStyle = (v, alt) => {
  if (v == null)
    return alt ? { ...ST_DASH, fill: { fgColor: { rgb: ZEBRA } } } : ST_DASH;
  const [fg, bg] =
    v >= 9
      ? [GREEN, GREEN_SOFT]
      : v >= 7
      ? [AMBER, AMBER_SOFT]
      : [RED, RED_SOFT];
  return {
    font: { bold: true, sz: 10, color: { rgb: fg } },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER,
  };
};

const psiStyle = (v, alt) => {
  if (v == null)
    return alt ? { ...ST_DASH, fill: { fgColor: { rgb: ZEBRA } } } : ST_DASH;
  const [fg, bg] =
    v >= 85
      ? [GREEN, GREEN_SOFT]
      : v >= 70
      ? [AMBER, AMBER_SOFT]
      : [RED, RED_SOFT];
  return {
    numFmt: '0"%"',
    font: { bold: true, sz: 10, color: { rgb: fg } },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER,
  };
};

const ratingStyle = (v, alt) => {
  if (v == null)
    return alt ? { ...ST_DASH, fill: { fgColor: { rgb: ZEBRA } } } : ST_DASH;
  const bg =
    v >= 5 ? GREEN_SOFT : v >= 4 ? 'F0F6F2' : v >= 3 ? AMBER_SOFT : RED_SOFT;
  const fg = v >= 4 ? GREEN : v >= 3 ? AMBER : RED;
  return {
    font: { bold: v <= 2, sz: 10, color: { rgb: fg } },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER,
  };
};

const BAND_LABEL = {
  promoter: 'Promoter',
  passive: 'Passive',
  detractor: 'Detractor',
};

const fmtDate = d => {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  const M = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return m ? `${Number(day)} ${M[Number(m) - 1]} ${y}` : String(d);
};

/* ── sheets ──────────────────────────────────────────────────────────────── */

function summarySheet(data, branch) {
  const s = data.summary || {};
  // The same computation the screen uses, so the workbook and the app can
  // never disagree about the score or its confidence.
  const nps = computeNps(s.scoreCounts, s.operated);
  const rows = [
    [mk(`Patient Feedback — ${branch}`, ST_TITLE)],
    [
      mk(
        `${fmtDate(data.meta?.from)} to ${fmtDate(data.meta?.to)}`,
        ST_SUBTITLE,
      ),
    ],
    [],
    [mk('Cohort', ST_GROUP), mk('Value', ST_GROUP)],
    [mk('Patients operated', ST_LABEL), mk(s.operated ?? 0, ST_METRIC)],
    [
      mk('Responses received', ST_LABEL_ALT),
      mk(s.responses ?? 0, { ...ST_METRIC, fill: { fgColor: { rgb: ZEBRA } } }),
    ],
    [
      mk('Response rate', ST_LABEL),
      s.responseRatePct == null
        ? mk('—', ST_DASH)
        : mk(s.responseRatePct, { ...ST_METRIC, numFmt: '0"%"' }),
    ],
    [],
    [mk('Net Promoter Score', ST_GROUP), mk('', ST_GROUP), mk('', ST_GROUP)],
    [
      mk('NPS', ST_LABEL),
      nps == null
        ? mk('—', ST_DASH)
        : mk(Math.round(nps.nps), {
            ...ST_METRIC,
            font: {
              bold: true,
              sz: 12,
              color: { rgb: nps.nps >= 0 ? GREEN : RED },
            },
          }),
      // The confidence interval, beside the score rather than in a footnote —
      // a branch with six replies can show NPS 100, and the ± is the only
      // thing on the sheet that says not to act on it.
      nps == null
        ? mk('', ST_LABEL)
        : mk(`± ${Math.round(nps.margin)}`, {
            ...ST_METRIC,
            font: { sz: 10, color: { rgb: '6C7C75' } },
          }),
    ],
    [
      mk('Promoters (9–10)', ST_LABEL_ALT),
      mk(s.promoters ?? 0, {
        ...ST_METRIC,
        font: { bold: true, color: { rgb: GREEN } },
        fill: { fgColor: { rgb: ZEBRA } },
      }),
      nps == null
        ? mk('', ST_LABEL_ALT)
        : mk(Math.round(nps.promoterPct) / 100, {
            ...ST_METRIC,
            numFmt: '0%',
            fill: { fgColor: { rgb: ZEBRA } },
          }),
    ],
    [
      mk('Passives (7–8)', ST_LABEL),
      mk(s.passives ?? 0, {
        ...ST_METRIC,
        font: { bold: true, color: { rgb: AMBER } },
      }),
      nps == null
        ? mk('', ST_LABEL)
        : mk(Math.round(nps.passivePct) / 100, { ...ST_METRIC, numFmt: '0%' }),
    ],
    [
      mk('Detractors (0–6)', ST_LABEL_ALT),
      mk(s.detractors ?? 0, {
        ...ST_METRIC,
        font: { bold: true, color: { rgb: RED } },
        fill: { fgColor: { rgb: ZEBRA } },
      }),
      nps == null
        ? mk('', ST_LABEL_ALT)
        : mk(Math.round(nps.detractorPct) / 100, {
            ...ST_METRIC,
            numFmt: '0%',
            fill: { fgColor: { rgb: ZEBRA } },
          }),
    ],
    [
      mk(
        'NPS = % promoters − % detractors. Passives count in the total but not ' +
          'in the score. ± is the 95% confidence interval on the responses received.',
        ST_NOTE,
      ),
    ],

    // ── The distribution the score is built from ──────────────────────────
    // A branch can reach the same NPS from very different shapes — everyone at
    // 8, or half at 10 and half at 4. The counts show which, and the summary
    // row alone never could.
    [],
    [mk('Responses by score', ST_GROUP), mk('', ST_GROUP), mk('', ST_GROUP)],
    ...(nps
      ? nps.counts.map((count, score) => [
          mk(String(score), score % 2 === 1 ? ST_LABEL_ALT : ST_LABEL),
          mk(count, {
            ...ST_METRIC,
            font: {
              bold: count > 0,
              color: {
                rgb: score >= 9 ? GREEN : score >= 7 ? AMBER : RED,
              },
            },
            ...(score % 2 === 1 ? { fill: { fgColor: { rgb: ZEBRA } } } : {}),
          }),
          mk(count > 0 ? count / nps.n : 0, {
            ...ST_METRIC,
            numFmt: '0%',
            ...(score % 2 === 1 ? { fill: { fgColor: { rgb: ZEBRA } } } : {}),
          }),
        ])
      : [[mk('No responses', ST_LABEL)]]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 10 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 13, c: 0 }, e: { r: 13, c: 1 } },
    { s: { r: 18, c: 0 }, e: { r: 18, c: 1 } },
  ];
  ws['!rows'] = [{ hpt: 26 }, { hpt: 18 }];
  return ws;
}

function responsesSheet(data) {
  const responders = (data.patients || []).filter(p => p.responded);

  // Question columns are read off the first response rather than hardcoded, so
  // an added question appears in the export without a code change here.
  const groups = responders[0]?.answers || [];
  const qCols = groups.flatMap(g =>
    g.items.map(i => ({ ...i, group: g.title })),
  );

  const head = [
    'Patient',
    'UID',
    'Phone',
    'Age',
    'Sex',
    'Surgery date',
    'Surgeon',
    'Room type',
    'Score',
    'Band',
    'PSI',
    'Achieved',
    'Max',
    ...qCols.map(c => c.label),
  ];

  // A band row above the headers, so ten rating columns aren't an
  // undifferentiated wall — it says which section of the form each came from.
  const bandRow = [
    ...Array(13).fill(mk('', ST_GROUP)),
    ...qCols.map(c => mk(c.group, ST_GROUP)),
  ];

  const rows = [bandRow, head.map(h => mk(h, ST_HEAD))];

  responders.forEach((p, idx) => {
    const alt = idx % 2 === 1;
    const base = alt ? ST_LABEL_ALT : ST_LABEL;
    const ctr = centred(alt ? { fill: { fgColor: { rgb: ZEBRA } } } : {});
    const answers = {};
    (p.answers || []).forEach(g =>
      g.items.forEach(i => (answers[i.key] = i.value)),
    );

    rows.push([
      mk(p.name || '', base),
      mk(p.uidNo || '', base),
      mk(p.phone || '', base),
      mk(p.age ?? '', ctr),
      mk(p.sex || '', ctr),
      mk(fmtDate(p.surgeryDate), ctr),
      mk(p.surgeon || '', base),
      mk(p.roomType || '', base),
      p.recommendScore == null
        ? mk('—', ST_DASH)
        : mk(p.recommendScore, scoreStyle(p.recommendScore, alt)),
      mk(p.band ? BAND_LABEL[p.band] : '—', ctr),
      p.psiPct == null
        ? mk('—', ST_DASH)
        : mk(p.psiPct, psiStyle(p.psiPct, alt)),
      mk(p.totalScoreAchieved ?? '', ctr),
      mk(p.maxPossibleScore ?? '', ctr),
      ...qCols.map(c =>
        answers[c.key] == null
          ? mk('—', ST_DASH)
          : mk(answers[c.key], ratingStyle(answers[c.key], alt)),
      ),
    ]);
  });

  if (!responders.length) {
    rows.push([mk('No responses in this period.', ST_LABEL)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 13 },
    { wch: 6 },
    { wch: 6 },
    { wch: 13 },
    { wch: 20 },
    { wch: 13 },
    { wch: 7 },
    { wch: 11 },
    { wch: 7 },
    { wch: 9 },
    { wch: 6 },
    ...qCols.map(() => ({ wch: 11 })),
  ];
  // Freeze the identity columns and both header rows — with ten rating columns
  // the patient name scrolls out of sight otherwise.
  ws['!freeze'] = { xSplit: 2, ySplit: 2 };
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 1, c: 0 },
      e: { r: Math.max(rows.length - 1, 2), c: head.length - 1 },
    }),
  };
  ws['!rows'] = [{ hpt: 18 }, { hpt: 30 }];
  return ws;
}

function awaitingSheet(data) {
  const pending = (data.patients || []).filter(p => !p.responded);
  const head = [
    'Patient',
    'UID',
    'Phone',
    'Surgery date',
    'Surgeon',
    'Room type',
  ];
  const rows = [head.map(h => mk(h, ST_HEAD))];

  pending.forEach((p, i) => {
    const alt = i % 2 === 1;
    const base = alt ? ST_LABEL_ALT : ST_LABEL;
    rows.push([
      mk(p.name || '', base),
      mk(p.uidNo || '', base),
      mk(p.phone || '', base),
      mk(
        fmtDate(p.surgeryDate),
        centred(alt ? { fill: { fgColor: { rgb: ZEBRA } } } : {}),
      ),
      mk(p.surgeon || '', base),
      mk(p.roomType || '', base),
    ]);
  });

  if (!pending.length)
    rows.push([mk('Every operated patient responded.', ST_LABEL)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
  ];
  ws['!freeze'] = { ySplit: 1 };
  return ws;
}

/* ── export ──────────────────────────────────────────────────────────────── */

export async function exportFeedbackWorkbook(data, branch) {
  if (!data?.patients?.length) {
    Alert.alert(
      'Nothing to export',
      'There are no operated patients in this period.',
    );
    return null;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(data, branch), 'Summary');
  XLSX.utils.book_append_sheet(wb, responsesSheet(data), 'Responses');
  XLSX.utils.book_append_sheet(wb, awaitingSheet(data), 'Awaiting');

  const safeBranch = String(branch || 'Branch').replace(/[^A-Za-z0-9]+/g, '_');
  const fileName = `Patient_Feedback_${safeBranch}_${data.meta?.from}_to_${data.meta?.to}.xlsx`;
  const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await RNFS.writeFile(filePath, base64, 'base64');

  try {
    await Share.open({
      title: 'Patient Feedback',
      filename: fileName,
      url: `file://${filePath}`,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      failOnCancel: false,
    });
  } catch (e) {
    // Share sheet dismissed. The file is written either way, so this is not
    // an error worth putting in front of anyone.
    if (!/cancel/i.test(e?.message || '')) throw e;
  }

  return filePath;
}

export default { exportFeedbackWorkbook };
