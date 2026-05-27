require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { saveSubmission } = require('./storage');
const { sendNotification } = require('./email');
const { lookupByUSCO, lookupByISWC, lookupBySongTitle } = require('./lookup');
const { analyzeSubmission } = require('./analysis');

const dbSearch = require('./database-search');

try {
  console.log('[INIT] 🚀 Pre-building USCO index...');
  dbSearch.initializeIndex();
  console.log('[INIT] ✅ USCO index built successfully');
} catch (err) {
  console.log('[INIT] ⚠️ USCO index not available (optional) - continuing without it');
  console.log('[INIT] Error:', err.message);
}

const app = express();
const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

app.post('/admin/upload-usco', upload.single('file'), async (req, res) => {
  try {
    const dest = '/app/data/usco/reg_musical_work.csv.gz';
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(req.file.path, dest);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: 'USCO file uploaded to ' + dest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const ADMIN_TOKEN = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

const DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/app/data'
  : path.join(__dirname, 'data');

const SONGWRITER_LEADS_DIR = path.join(DATA_DIR, 'songwriter_leads');
const DELETED_RECORDS_DIR = path.join(DATA_DIR, 'deleted_records');

const CSV_PATH = path.join(SONGWRITER_LEADS_DIR, 'submissions.csv');
const CONTACTED_PATH = path.join(SONGWRITER_LEADS_DIR, 'contacted.json');
const ANALYSIS_DIR = path.join(SONGWRITER_LEADS_DIR, 'analysis_records');

const archiveRoot = DELETED_RECORDS_DIR;
const submissionsArchive = path.join(archiveRoot, 'submissions');

console.log(`[INIT] 📁 Data directory: ${DATA_DIR}`);
console.log(`[INIT] 📄 CSV path: ${CSV_PATH}`);
console.log(`[INIT] 📋 Contacted path: ${CONTACTED_PATH}`);
console.log(`[INIT] 🗑️  Archive path: ${submissionsArchive}`);

[SONGWRITER_LEADS_DIR, ANALYSIS_DIR, archiveRoot, submissionsArchive].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[INIT] ✅ Created directory: ${dir}`);
  }
});

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_TOKEN) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur); cur = '';
    } else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function readCSVRaw(filePath) {
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] };
  const content = fs.readFileSync(filePath, 'utf8')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!content) return { headers: [], rows: [] };
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).filter(Boolean).map((line, idx) => {
    const fields = parseCSVLine(line);
    const obj = { _row: idx };
    headers.forEach((h, i) => { obj[h] = (fields[i] || '').trim(); });
    obj.royalty_message =
      obj.royalty_message || obj.final_monetization_thoughts ||
      obj.monetization_message || obj.mon_message || obj.mon_notes || '';
    return obj;
  });
  return { headers, rows };
}

function parseCSV(filePath) { return readCSVRaw(filePath).rows; }

function writeCSV(filePath, headers, rows) {
  const headerLine = headers.join(',');
  const bodyLines = rows.map(row => headers.map(h => escapeCSV(row[h] || '')).join(','));
  fs.writeFileSync(
    filePath,
    headerLine + '\n' + (bodyLines.length ? bodyLines.join('\n') + '\n' : ''),
    'utf8'
  );
}

function getContacted() {
  if (!fs.existsSync(CONTACTED_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONTACTED_PATH, 'utf8')); }
  catch { return {}; }
}

function saveContacted(data) {
  fs.writeFileSync(CONTACTED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function saveAnalysisRecord(analysis_id, payload) {
  if (!analysis_id) return;
  const filePath = path.join(ANALYSIS_DIR, `${analysis_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function getAnalysisRecord(analysis_id) {
  const filePath = path.join(ANALYSIS_DIR, `${analysis_id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function archiveSubmission(rowId, rowData, headers) {
  try {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
    const filename = `${timestamp}_deleted.csv`;
    const filepath = path.join(submissionsArchive, filename);
    const archiveContent =
      headers.join(',') + '\n' +
      headers.map(h => escapeCSV(rowData[h] || '')).join(',') + '\n';
    fs.writeFileSync(filepath, archiveContent, 'utf8');
    console.log(`[ARCHIVE] ✅ Saved deleted record to: ${filepath}`);
    return filepath;
  } catch (err) {
    console.error('[ARCHIVE ERROR]', err);
    return null;
  }
}

function deleteSubmissionRow(rowId) {
  const id = Number(rowId);
  if (!Number.isInteger(id) || id < 0) return { ok: false, error: 'Invalid row id' };
  const { headers, rows } = readCSVRaw(CSV_PATH);
  if (!headers.length) return { ok: false, error: 'No submissions file found' };
  if (id >= rows.length) return { ok: false, error: 'Row not found' };
  const deletedRow = rows[id];
  const archivePath = archiveSubmission(id, deletedRow, headers);
  const newRows = rows.filter((_, idx) => idx !== id);
  writeCSV(CSV_PATH, headers, newRows);
  const oldContacted = getContacted();
  const newContacted = {};
  Object.keys(oldContacted).forEach(key => {
    const oldIndex = Number(key);
    if (!Number.isInteger(oldIndex)) return;
    if (oldIndex === id) return;
    const newIndex = oldIndex > id ? oldIndex - 1 : oldIndex;
    newContacted[String(newIndex)] = oldContacted[key];
  });
  saveContacted(newContacted);
  return { ok: true, archived: archivePath ? path.basename(archivePath) : null };
}

function buildStats(rows) {
  const contacted = getContacted();
  return {
    total: rows.length,
    s203: rows.filter(r => r.routing_result === '203').length,
    s304: rows.filter(r => r.routing_result === '304').length,
    windowOpen: rows.filter(r => String(r.status_flag || '').toLowerCase().includes('open')).length,
    missed: rows.filter(r => r.window_missed === 'yes').length,
    needsReview: rows.filter(r => r.routing_result === 'needs-review').length,
    contacted: Object.values(contacted).filter(Boolean).length
  };
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Submit ────────────────────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  const startTime = Date.now();
  try {
    const { user, songs } = req.body || {};

    if (!user || !user.email) {
      return res.status(400).json({ ok: false, error: 'Email required' });
    }
    if (!Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one song is required' });
    }

    const analysis_id = crypto.randomUUID();

    // STEP 1: Save to CSV
    saveSubmission({ analysis_id, user, songs });
    console.log(`[SUBMIT] ✅ Saved in ${Date.now() - startTime}ms`);

    // STEP 2: Respond immediately
    res.json({ ok: true, analysis_id, redirectTo: '/results' });

    // STEP 3: Send email in background
    setImmediate(async () => {
      try {
        console.log('[EMAIL] 📧 Sending notification...');
        await sendNotification({ analysis_id, user, songs });
        console.log('[EMAIL] ✅ Notification sent');
      } catch (emailErr) {
        console.error('[EMAIL] ❌ Failed:', emailErr.message);
      }
    });

    // ✅ STEP 4: Sync to Argus Music in background
    setImmediate(async () => {
      try {
        const argusUrl = process.env.ARGUS_MUSIC_API_URL || 'http://localhost:5000/api/sync/from-rightsback';
        const firstSong = songs && songs[0] ? songs[0] : {};

        const forwardData = {
          full_name:       user.name           || user.email.split('@')[0],
          email:           user.email,
          phone:           user.phone          || null,
          pro_affiliation: user.pro            || null,
          ipi_number:      user.ipi            || null,
          pro_id:          user.pro_id         || null,
          song_title:      firstSong.title     || null,
          artist_name:     firstSong.artist    || null,
          release_year:    firstSong.year      || null,
        };

        console.log('[Argus Sync] 🔄 Sending to Argus Music...');

        const syncResponse = await fetch(argusUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(forwardData),
        });

        const syncResult = await syncResponse.json();

        if (syncResult.ok) {
          console.log('[Argus Sync] ✓', syncResult.message, '| matched:', syncResult.matched, '| csv:', syncResult.csv);
        } else {
          console.warn('[Argus Sync] ⚠️ Warning:', syncResult.error);
        }
      } catch (syncErr) {
        console.error('[Argus Sync] ❌ Failed:', syncErr.message);
      }
    });

  } catch (err) {
    console.error('[submit]', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ── Lookup endpoints ──────────────────────────────────────────────────────────
app.post('/api/lookup/usco-by-number', async (req, res) => {
  try {
    const { registrationNumber } = req.body;
    if (!registrationNumber) return res.status(400).json({ error: 'Registration number is required' });
    console.log('[API] USCO lookup by number:', registrationNumber);
    const result = await dbSearch.lookupUSCOByNumber(registrationNumber);
    res.json(result);
  } catch (error) {
    console.error('[API] USCO lookup error:', error);
    res.status(500).json({ error: 'Lookup failed', message: error.message });
  }
});

app.post('/api/lookup/iswc-by-number', async (req, res) => {
  res.json({ found: false, error: 'ISWC lookup not yet implemented. Please use title search instead.' });
});

app.post('/api/lookup/search-by-title', async (req, res) => {
  try {
    const { songTitle, songwriterName } = req.body;
    if (!songTitle) return res.status(400).json({ error: 'Song title is required' });
    console.log('[API] Search by title:', songTitle, 'by', songwriterName || 'Unknown');
    const results = await dbSearch.searchByTitle(songTitle, songwriterName);
    res.json(results);
  } catch (error) {
    console.error('[API] Title search error:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// ── Analyze ───────────────────────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const submissionData = req.body || {};
    if (!submissionData.songTitle || !submissionData.songwriterName) {
      return res.status(400).json({ ok: false, error: 'Song title and songwriter name required' });
    }
    const analysis = await analyzeSubmission(submissionData);
    if (submissionData.analysisId) {
      saveAnalysisRecord(submissionData.analysisId, {
        analysis_id: submissionData.analysisId,
        created_at: new Date().toISOString(),
        submissionData,
        analysis,
      });
    }
    res.json({ ok: true, analysis });
  } catch (err) {
    console.error('[analyze]', err);
    res.status(500).json({ ok: false, error: 'Analysis failed. Please try again.' });
  }
});

// ── Admin endpoints ───────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ ok: true, token: ADMIN_TOKEN });
  }
  res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

app.get('/api/admin/submissions', adminAuth, (req, res) => {
  const rows = parseCSV(CSV_PATH);
  const contacted = getContacted();
  const data = rows.map((r, i) => ({ ...r, contacted: contacted[String(i)] || false }));
  res.json({ ok: true, data });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const rows = parseCSV(CSV_PATH);
  res.json({ ok: true, stats: buildStats(rows) });
});

app.post('/api/admin/mark-contacted', adminAuth, (req, res) => {
  try {
    const { id, value } = req.body || {};
    const contacted = getContacted();
    contacted[String(id)] = Boolean(value);
    saveContacted(contacted);
    res.json({ ok: true });
  } catch (err) {
    console.error('[mark-contacted]', err);
    res.status(500).json({ ok: false, error: 'Failed to update contacted status' });
  }
});

app.get('/api/admin/analysis/:id', adminAuth, (req, res) => {
  try {
    const data = getAnalysisRecord(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'Analysis not found' });
    res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to load analysis' });
  }
});

app.post('/api/admin/delete-submission', adminAuth, (req, res) => {
  try {
    const { id } = req.body || {};
    const result = deleteSubmissionRow(id);
    if (!result.ok) return res.status(400).json(result);
    res.json({ ok: true, archived: result.archived });
  } catch (err) {
    console.error('[delete-submission]', err);
    res.status(500).json({ ok: false, error: 'Delete failed' });
  }
});

// ── Page routes ───────────────────────────────────────────────────────────────
app.get('/admin',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, 'public', 'success.html')));
app.get('/results', (req, res) => res.sendFile(path.join(__dirname, 'public', 'results.html')));
app.get('*',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Rights Back Server Running`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Data Directory: ${DATA_DIR}`);
  console.log(`   Admin Panel: /admin\n`);
});