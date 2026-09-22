/* eslint-disable prettier/prettier */
// src/screens/postOpExcel.js
// ─────────────────────────────────────────────────────────────────────────────
// Styled workbook for the Post-Op calling feedback screen.
//
// Shares the palette and cell styles of feedbackExcel.js so the two Performance
// exports look like siblings, but the sheets differ because the data does: this
// is a 1–5 call score with free-text comments, not a 0–10 recommend question.
// There is no NPS here and the workbook does not imply one.
//
// THE QUESTION COLUMNS ARE NOT FIXED
// ──────────────────────────────────
// Post-op call questions are free text from the call script and vary between
// branches and over time. So the column set is the UNION of every question
// present in the exported rows, not a hardcoded list — a patient answering an
// older question still exports, under its own column, with blanks elsewhere.
// A hardcoded list would silently drop those answers.
// ─────────────────────────────────────────────────────────────────────────────

import { Alert } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import XLSX from 'xlsx-js-style';

/* ── palette — kept in step with feedbackExcel.js ────────────────────────── */
const INK = '0F1A16';
const BRAND = '4A6B2F'; // Performance olive, so the two feedback files differ at a glance
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

const mk = (v, s) => ({ v, s });

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
const ST_COMMENT = {
  font: { italic: true, sz: 10, color: { rgb: '334155' } },
  alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
  border: BORDER,
};

const centred = (extra = {}) => ({
  font: { sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
  ...extra,
});

// Same thresholds the screen uses. One place, both surfaces.
const bandOf = avg =>
  avg == null ? null : avg >= 4 ? 'strong' : avg >= 3 ? 'mixed' : 'weak';
const BAND_LABEL = {
  strong: 'Strong',
  mixed: 'Mixed',
  weak: 'Needs attention',
};

const avgStyle = (v, alt) => {
  if (v == null)
    return alt ? { ...ST_DASH, fill: { fgColor: { rgb: ZEBRA } } } : ST_DASH;
  const b = bandOf(v);
  const [fg, bg] =
    b === 'strong'
      ? [GREEN, GREEN_SOFT]
      : b === 'mixed'
      ? [AMBER, AMBER_SOFT]
      : [RED, RED_SOFT];
  return {
    numFmt: '0.0',
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

const fmtDate = d => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
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
  return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`;
};

/* ── sheets ──────────────────────────────────────────────────────────────── */

function summarySheet(rows, branch, filterNote) {
  const rated = rows.filter(r => r.avg != null);
  const avg = rated.length
    ? rated.reduce((a, r) => a + r.avg, 0) / rated.length
    : null;
  const counts = { strong: 0, mixed: 0, weak: 0 };
  rated.forEach(r => {
    const b = bandOf(r.avg);
    if (b) counts[b]++;
  });
  const withComment = rated.filter(r => r.feedback).length;

  const body = [
    [mk(`Post-Op Calling Feedback — ${branch}`, ST_TITLE)],
    [mk('Follow-up call ratings after discharge', ST_SUBTITLE)],
    ...(filterNote ? [[mk(filterNote, ST_NOTE)]] : []),
    [],
    [mk('Coverage', ST_GROUP), mk('Value', ST_GROUP)],
    [mk('Patients in list', ST_LABEL), mk(rows.length, ST_METRIC)],
    [
      mk('Calls rated', ST_LABEL_ALT),
      mk(rated.length, { ...ST_METRIC, fill: { fgColor: { rgb: ZEBRA } } }),
    ],
    [
      mk('Rated share', ST_LABEL),
      rows.length
        ? mk(Math.round((rated.length / rows.length) * 100), {
            ...ST_METRIC,
            numFmt: '0"%"',
          })
        : mk('—', ST_DASH),
    ],
    [
      mk('Comments left', ST_LABEL_ALT),
      mk(withComment, { ...ST_METRIC, fill: { fgColor: { rgb: ZEBRA } } }),
    ],
    [],
    [mk('Call score', ST_GROUP), mk('', ST_GROUP)],
    [
      mk('Average rating (of 5)', ST_LABEL),
      avg == null
        ? mk('—', ST_DASH)
        : mk(Number(avg.toFixed(1)), avgStyle(avg)),
    ],
    [
      mk('Strong (4.0 and above)', ST_LABEL_ALT),
      mk(counts.strong, {
        ...ST_METRIC,
        font: { bold: true, color: { rgb: GREEN } },
        fill: { fgColor: { rgb: ZEBRA } },
      }),
    ],
    [
      mk('Mixed (3.0 – 3.9)', ST_LABEL),
      mk(counts.mixed, {
        ...ST_METRIC,
        font: { bold: true, color: { rgb: AMBER } },
      }),
    ],
    [
      mk('Needs attention (below 3.0)', ST_LABEL_ALT),
      mk(counts.weak, {
        ...ST_METRIC,
        font: { bold: true, color: { rgb: RED } },
        fill: { fgColor: { rgb: ZEBRA } },
      }),
    ],
    [
      mk(
        'These bands are a reading aid, not a clinical standard. This is a 1–5 call score — it is not the Net Promoter Score, which comes from a separate 0–10 question on the Patient Feedback report.',
        ST_NOTE,
      ),
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(body);
  ws['!cols'] = [{ wch: 34 }, { wch: 16 }];
  ws['!rows'] = [{ hpt: 26 }, { hpt: 18 }];
  // Merges are computed from the built rows rather than hardcoded, because the
  // optional filter note shifts every index below it.
  ws['!merges'] = body
    .map((r, i) =>
      r.length === 1 ? { s: { r: i, c: 0 }, e: { r: i, c: 1 } } : null,
    )
    .filter(Boolean);
  return ws;
}

function responsesSheet(rows) {
  const rated = rows.filter(r => r.rated);

  // Union of every question seen, first-appearance order.
  const questions = [];
  const seen = new Set();
  rated.forEach(r =>
    Object.keys(r.answers || {}).forEach(q => {
      if (!seen.has(q)) {
        seen.add(q);
        questions.push(q);
      }
    }),
  );

  const head = [
    'Patient',
    'Phone',
    'Admitted',
    'Discharged',
    'Avg rating',
    'Band',
    ...questions,
    'Comment',
  ];

  const bandRow = [
    ...Array(6).fill(mk('', ST_GROUP)),
    ...questions.map(() => mk('Call questions', ST_GROUP)),
    mk('', ST_GROUP),
  ];

  const out = [bandRow, head.map(h => mk(h, ST_HEAD))];

  rated.forEach((r, i) => {
    const alt = i % 2 === 1;
    const base = alt ? ST_LABEL_ALT : ST_LABEL;
    const ctr = centred(alt ? { fill: { fgColor: { rgb: ZEBRA } } } : {});
    out.push([
      mk(r.name || '', base),
      mk(r.phone || '', base),
      mk(fmtDate(r.admission), ctr),
      mk(fmtDate(r.discharge), ctr),
      r.avg == null
        ? mk('—', ST_DASH)
        : mk(Number(r.avg.toFixed(1)), avgStyle(r.avg, alt)),
      mk(r.band ? BAND_LABEL[r.band] : '—', ctr),
      ...questions.map(q => {
        const v = Number(r.answers?.[q]);
        return Number.isFinite(v)
          ? mk(v, ratingStyle(v, alt))
          : mk('', ST_DASH);
      }),
      mk(r.feedback || '', ST_COMMENT),
    ]);
  });

  if (!rated.length) out.push([mk('No rated calls in this view.', ST_LABEL)]);

  const ws = XLSX.utils.aoa_to_sheet(out);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 13 },
    { wch: 13 },
    { wch: 11 },
    { wch: 16 },
    // Question headers are full sentences, so the columns stay narrow and the
    // header wraps rather than stretching the sheet past a printable width.
    ...questions.map(() => ({ wch: 13 })),
    { wch: 50 },
  ];
  ws['!freeze'] = { xSplit: 1, ySplit: 2 };
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 1, c: 0 },
      e: { r: Math.max(out.length - 1, 2), c: head.length - 1 },
    }),
  };
  ws['!rows'] = [{ hpt: 18 }, { hpt: 46 }];
  return ws;
}

function commentsSheet(rows) {
  const withComment = rows.filter(r => r.feedback);
  const head = ['Patient', 'Phone', 'Discharged', 'Avg rating', 'Comment'];
  const out = [head.map(h => mk(h, ST_HEAD))];

  // Lowest scores first — the comments worth reading are attached to the calls
  // that went badly, and they should not be buried at the bottom.
  [...withComment]
    .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))
    .forEach((r, i) => {
      const alt = i % 2 === 1;
      const base = alt ? ST_LABEL_ALT : ST_LABEL;
      out.push([
        mk(r.name || '', base),
        mk(r.phone || '', base),
        mk(
          fmtDate(r.discharge),
          centred(alt ? { fill: { fgColor: { rgb: ZEBRA } } } : {}),
        ),
        r.avg == null
          ? mk('—', ST_DASH)
          : mk(Number(r.avg.toFixed(1)), avgStyle(r.avg, alt)),
        mk(r.feedback, ST_COMMENT),
      ]);
    });

  if (!withComment.length)
    out.push([mk('No comments were recorded.', ST_LABEL)]);

  const ws = XLSX.utils.aoa_to_sheet(out);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 13 },
    { wch: 11 },
    { wch: 70 },
  ];
  ws['!freeze'] = { ySplit: 1 };
  return ws;
}

function notCalledSheet(rows) {
  const pending = rows.filter(r => !r.rated);
  const head = ['Patient', 'Phone', 'Admitted', 'Discharged'];
  const out = [head.map(h => mk(h, ST_HEAD))];

  pending.forEach((r, i) => {
    const alt = i % 2 === 1;
    const base = alt ? ST_LABEL_ALT : ST_LABEL;
    const ctr = centred(alt ? { fill: { fgColor: { rgb: ZEBRA } } } : {});
    out.push([
      mk(r.name || '', base),
      mk(r.phone || '', base),
      mk(fmtDate(r.admission), ctr),
      mk(fmtDate(r.discharge), ctr),
    ]);
  });

  if (!pending.length)
    out.push([mk('Every patient in this view was called.', ST_LABEL)]);

  const ws = XLSX.utils.aoa_to_sheet(out);
  ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 13 }, { wch: 13 }];
  ws['!freeze'] = { ySplit: 1 };
  return ws;
}

/* ── export ──────────────────────────────────────────────────────────────── */

export async function exportPostOpWorkbook(rows, branch, filterNote) {
  if (!rows?.length) {
    Alert.alert('Nothing to export', 'There are no patients in this view.');
    return null;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    summarySheet(rows, branch, filterNote),
    'Summary',
  );
  XLSX.utils.book_append_sheet(wb, responsesSheet(rows), 'Call Responses');
  XLSX.utils.book_append_sheet(wb, commentsSheet(rows), 'Comments');
  XLSX.utils.book_append_sheet(wb, notCalledSheet(rows), 'Not Called');

  const safeBranch = String(branch || 'Branch').replace(/[^A-Za-z0-9]+/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `PostOp_Calling_Feedback_${safeBranch}_${stamp}.xlsx`;
  const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await RNFS.writeFile(filePath, base64, 'base64');

  try {
    await Share.open({
      title: 'Post-Op Calling Feedback',
      filename: fileName,
      url: `file://${filePath}`,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      failOnCancel: false,
    });
  } catch (e) {
    // Share sheet dismissed — the file is written regardless.
    if (!/cancel/i.test(e?.message || '')) throw e;
  }

  return filePath;
}

export default { exportPostOpWorkbook };
