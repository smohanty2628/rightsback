const fs = require('fs');
const path = require('path');

// ✅ FIXED: Ensure data directory exists in production
const DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/app/data'
  : __dirname;

const SONGWRITER_LEADS_DIR = path.join(DATA_DIR, 'songwriter_leads');

// Create directories if they don't exist
if (!fs.existsSync(SONGWRITER_LEADS_DIR)) {
  fs.mkdirSync(SONGWRITER_LEADS_DIR, { recursive: true });
  console.log(`[STORAGE] Created directory: ${SONGWRITER_LEADS_DIR}`);
}

const CSV_PATH = path.join(SONGWRITER_LEADS_DIR, 'submissions.csv');
console.log(`[STORAGE] CSV path: ${CSV_PATH}`);

const HEADERS = [
  'submitted_at',
  'analysis_id',

  'name',
  'stage_name',
  'email',
  'phone',
  'contact_pref',
  'country',
  'pro',
  'ipi',
  'pro_id',
  'consent',
  'marketing',

  'song_title',
  'usco_number',
  'iswc_number',
  'rights_type',
  'publisher_name',

  'grant_date',
  'publication_date',
  'copyright_secured_date',

  'grant_by_author',
  'pub_rights_included',
  'work_for_hire',

  'routing_result',
  'applicable_section',
  'applicable_subsection',

  'term_window_open',
  'term_window_close',
  'notice_window_open',
  'notice_window_close',
  'recordation_deadline',

  'status_flag',
  'window_missed',

  'cowriters',

  'mon_sale',
  'mon_license',
  'mon_catalog',
  'mon_royalties',
  'mon_email',
  'mon_notes',
  'royalty_message',
  'final_choice',
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '';

  const s = String(val).replace(/"/g, '""');

  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s}"`
    : s;
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }

  fields.push(cur);
  return fields;
}

function parseCSV(content) {
  const clean = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!clean) return { headers: [], rows: [] };

  const lines = clean.split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  const rows = lines.slice(1).filter(Boolean).map(line => {
    const fields = parseCSVLine(line);
    const obj = {};

    headers.forEach((h, i) => {
      obj[h] = fields[i] || '';
    });

    return obj;
  });

  return { headers, rows };
}

function ensureCSVHeaders() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log('[STORAGE] Creating new CSV file with headers');
    fs.writeFileSync(CSV_PATH, HEADERS.join(',') + '\n', 'utf8');
    return;
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const { headers, rows } = parseCSV(content);

  const missingHeaders = HEADERS.filter(h => !headers.includes(h));

  if (missingHeaders.length === 0) return;

  console.log('[STORAGE] Migrating CSV with missing headers:', missingHeaders);

  const migratedRows = rows.map(row => {
    const fixed = {};

    HEADERS.forEach(h => {
      fixed[h] = row[h] || '';
    });

    return HEADERS.map(h => escapeCSV(fixed[h])).join(',');
  });

  fs.writeFileSync(
    CSV_PATH,
    HEADERS.join(',') +
      '\n' +
      (migratedRows.length ? migratedRows.join('\n') + '\n' : ''),
    'utf8'
  );
}

function fmtDate(d) {
  if (!d) return '';

  try {
    const date = new Date(d);

    if (Number.isNaN(date.getTime())) return '';

    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function writeWithRetry(filePath, data, retries = 5, delay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.appendFileSync(filePath, data, 'utf8');
      console.log(`[STORAGE] ✅ Appended ${data.split('\n').length - 1} row(s) to CSV`);
      return;
    } catch (err) {
      if (err.code === 'EBUSY' && i < retries - 1) {
        const start = Date.now();

        while (Date.now() - start < delay) {}
      } else {
        console.error('[STORAGE] ❌ Write failed:', err.message);
        throw err;
      }
    }
  }
}

function normalizeFinalChoice(choice) {
  if (!choice) return '';

  const map = {
    send_email: 'send_email',
    email: 'send_email',
    professional: 'professional',
    connect_professional: 'professional',
    monetize: 'monetize',
    royalty_sale: 'monetize',
  };

  return map[choice] || choice;
}

function saveSubmission(payload) {
  const { user = {}, songs = [], analysis_id = '' } = payload || {};
  const now = new Date().toISOString();

  console.log(`[STORAGE] Saving submission: ${analysis_id}`);
  console.log(`[STORAGE] User: ${user.email}, Songs: ${songs.length}`);

  ensureCSVHeaders();

  const rows = songs.map(s => {
    const r = s && s.result ? s.result : {};
    const t = r.timing ? r.timing : {};

    const cowriters = Array.isArray(s.cowriters)
      ? s.cowriters.map(c => c.name).filter(Boolean).join(' | ')
      : '';

    const royaltyMessage =
      user.final_monetization_thoughts ||
      user.royalty_message ||
      user.monetization_message ||
      user.mon_notes ||
      '';

    const row = [
      now,
      analysis_id,

      user.name || '',
      user.stageName || '',
      user.email || '',
      user.phone || '',
      user.contact_pref || '',
      user.country || '',
      user.pro || '',
      user.ipi || '',
      user.pro_id || '',

      user.consent ? 'yes' : 'no',
      user.marketing ? 'yes' : 'no',

      s.title || '',
      s.uscoNumber || '',
      s.iswcNumber || '',
      s.rightsType || '',
      s.publisherName || '',

      fmtDate(s.grantDate),
      fmtDate(s.pubDate),
      fmtDate(s.copyrightDate),

      s.grantByAuthor || '',
      s.pubRights || '',
      s.workForHire || '',

      r.routing || 'unknown',
      t.regime || r.routing || '',
      t.subsection || '',

      fmtDate(t.termStart),
      fmtDate(t.termEnd),
      fmtDate(t.noticeOpen),
      fmtDate(t.noticeClose),
      fmtDate(t.recordationDeadline),

      t.statusFlag || '',
      t.missed ? 'yes' : 'no',

      cowriters,

      user.mon_sale ? 'yes' : 'no',
      user.mon_license ? 'yes' : 'no',
      user.mon_catalog ? 'yes' : 'no',

      user.mon_royalties || '',
      user.mon_email || '',
      user.mon_notes || '',

      royaltyMessage,

      normalizeFinalChoice(user.final_choice),
    ];

    return row.map(escapeCSV).join(',');
  });

  if (rows.length) {
    writeWithRetry(CSV_PATH, rows.join('\n') + '\n');
  } else {
    console.log('[STORAGE] ⚠️ No rows to save');
  }
}

module.exports = { saveSubmission };
