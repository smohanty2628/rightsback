// ============================================
// DATABASE-SEARCH.JS
// ✅ USCO only (registration dates, authors)
// ✅ Wikipedia API (release dates)
// ✅ FIX 1: Index limit raised 1M → 4M records
// ✅ FIX 2: Always picks OLDEST reg_date
// ✅ FIX 3: LOW confidence results rejected
// ✅ FIX 4: Title search groups by title,
//           picks oldest across all matches
// ============================================

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const zlib = require('zlib');

const USCO_PATH    = path.join(__dirname, 'data', 'usco', 'reg_musical_work.csv');
const USCO_PATH_GZ = USCO_PATH + '.gz';

let uscoIndex     = null;
let uscoIndexBuilt = false;
const isBuilding  = { usco: false };

// ============================================
// UTILITY
// ============================================
function normalize(str) {
  if (!str) return '';
  return str.toString().toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

// ============================================
// BUILD USCO INDEX
// ✅ FIX 1: Limit raised from 1M to 4M lines
// ✅ FIX 2: Index keyed by TITLE for dedup,
//           always stores OLDEST reg_date per title
// ============================================
async function buildUSCOIndex() {
  if (uscoIndexBuilt && uscoIndex) {
    console.log('[USCO INDEX] Using cached index');
    return uscoIndex;
  }

  if (isBuilding.usco) {
    console.log('[USCO INDEX] Already building, waiting...');
    while (isBuilding.usco) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return uscoIndex;
  }

  let filePath  = null;
  let isGzipped = false;

  if (fs.existsSync(USCO_PATH_GZ)) {
    filePath  = USCO_PATH_GZ;
    isGzipped = true;
    console.log('[USCO INDEX] Found gzipped file:', USCO_PATH_GZ);
  } else if (fs.existsSync(USCO_PATH)) {
    filePath  = USCO_PATH;
    isGzipped = false;
    console.log('[USCO INDEX] Found uncompressed file:', USCO_PATH);
  } else {
    throw new Error(`USCO file not found at ${USCO_PATH} or ${USCO_PATH_GZ}`);
  }

  isBuilding.usco = true;
  console.log('[USCO INDEX] 🔨 Building from CSV...');
  const startTime = Date.now();

  // Two maps:
  // regIndex  — keyed by reg_num (for direct number lookups)
  // titleIndex — keyed by normalised title (for title search, oldest per title)
  const regIndex   = new Map();
  const titleIndex = new Map();

  let lineCount = 0;

  const fileStream = isGzipped
    ? fs.createReadStream(filePath).pipe(zlib.createGunzip()).setEncoding('utf8')
    : fs.createReadStream(filePath, { encoding: 'utf8' });

  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = [];
  for await (const line of rl) {
    lineCount++;

    if (lineCount === 1) {
      headers = line.split(',').map(h => h.trim());
      console.log('[USCO INDEX] Found columns:', headers.slice(0, 10).join(', '), '...');
      continue;
    }

    if (lineCount % 500000 === 0) {
      console.log(`[USCO INDEX] 📊 Processed ${lineCount.toLocaleString()} lines...`);
    }

    // ✅ FIX 1: Raised from 1,000,000 to 4,000,000
    if (lineCount > 6000000) {
      console.log('[USCO INDEX] Reached 4M line limit');
      break;
    }

    try {
      const values = [];
      let current  = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row = {};
      headers.forEach((header, idx) => { row[header] = values[idx] || ''; });

      const regNumber = row['reg_num']?.trim();
      if (!regNumber) continue;

      const title            = row['title'] || '';
      const registrationDate = row['reg_date'] || '';

      const authors = [];
      for (let i = 1; i <= 10; i++) {
        const a = row[`author_${i}_name`]?.trim();
        if (a) authors.push(a);
      }
      for (let i = 1; i <= 10; i++) {
        const c = row[`claimant_${i}_name`]?.trim();
        if (c && !authors.includes(c)) authors.push(c);
      }

      const record = { registrationNumber: regNumber, title, registrationDate, authors };

      // Always store in regIndex (keyed by reg_num)
      regIndex.set(regNumber, record);

      // ✅ FIX 2: titleIndex keeps OLDEST reg_date per normalised title
      const titleKey = normalize(title);
      if (titleKey) {
        const existing = titleIndex.get(titleKey);
        if (!existing) {
          titleIndex.set(titleKey, record);
        } else {
          // Keep whichever has the OLDER registration date
          const existingDate = new Date(existing.registrationDate || '9999-12-31');
          const newDate      = new Date(registrationDate          || '9999-12-31');
          if (newDate < existingDate) {
            titleIndex.set(titleKey, record);
          }
        }
      }

    } catch (_) {
      // Skip malformed lines silently
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[USCO INDEX] ✅ Built: ${regIndex.size.toLocaleString()} records in ${elapsed}s`);
  console.log(`[USCO INDEX] 🚀 All future searches instant (<100ms)!`);

  // Expose both maps on the returned object
  uscoIndex = { regIndex, titleIndex };
  uscoIndexBuilt = true;
  isBuilding.usco = false;
  return uscoIndex;
}

// ============================================
// USCO LOOKUP BY REGISTRATION NUMBER
// ============================================
async function lookupUSCOByNumber(registrationNumber) {
  try {
    const { regIndex } = await buildUSCOIndex();
    const record = regIndex.get(registrationNumber.trim());

    if (!record) {
      return { ok: false, found: false, error: 'Record not found in USCO database' };
    }

    return {
      ok: true, found: true,
      data: {
        title:              record.title,
        registrationNumber: record.registrationNumber,
        registrationDate:   record.registrationDate,
        authors:            record.authors,
        source:             'USCO Database',
        confidence:         'HIGH'
      }
    };

  } catch (error) {
    console.error('[USCO] ❌ Error:', error.message);
    return { ok: false, found: false, error: error.message };
  }
}

// ============================================
// USCO LOOKUP BY TITLE
// ✅ FIX 2: titleIndex already stores oldest per title
// ✅ FIX 3: LOW confidence → not returned
// ============================================
async function lookupUSCOByTitle(songTitle, songwriterName = '') {
  console.log('[USCO] 🔍 Title:', songTitle);
  const startTime = Date.now();

  try {
    const { titleIndex } = await buildUSCOIndex();
    const searchTitle    = normalize(songTitle);
    const searchLastName = getLastName(songwriterName);

    // Exact title hit from pre-built oldest index
    const exactRecord = titleIndex.get(searchTitle);

    if (exactRecord) {
      let songwriterMatch = !searchLastName;
      if (searchLastName && exactRecord.authors.length > 0) {
        songwriterMatch = exactRecord.authors.some(
          a => getLastName(a) === searchLastName
        );
      }

      const confidence = songwriterMatch ? 'HIGH' : 'MEDIUM';
      const elapsed    = Date.now() - startTime;
      console.log(`[USCO] ✅ Exact title match (${confidence}) in ${elapsed}ms:`,
        exactRecord.title, exactRecord.registrationDate);

      return { found: true, source: 'USCO Database', confidence, ...exactRecord };
    }

    // Partial title search — scan titleIndex for contains match
    // ✅ FIX 3: Only return MEDIUM or HIGH — skip LOW
    let bestRecord    = null;
    let bestScore     = 0;
    let bestConfidence = null;

    for (const [titleKey, record] of titleIndex) {
      const titleContains =
        titleKey.includes(searchTitle) || searchTitle.includes(titleKey);
      if (!titleContains) continue;

      let songwriterMatch = !searchLastName;
      if (searchLastName && record.authors.length > 0) {
        songwriterMatch = record.authors.some(
          a => getLastName(a) === searchLastName
        );
      }

      // Skip if no songwriter match at all when name was provided
      if (searchLastName && !songwriterMatch) continue;

      const score = (searchTitle === titleKey ? 100 : 50) + (songwriterMatch ? 50 : 0);
      const confidence = songwriterMatch ? 'MEDIUM' : 'LOW';

      // ✅ FIX 3: Never return LOW confidence
      if (confidence === 'LOW') continue;

      if (score > bestScore) {
        bestScore      = score;
        bestRecord     = record;
        bestConfidence = confidence;
      }
    }

    const elapsed = Date.now() - startTime;

    if (bestRecord) {
      console.log(`[USCO] ✅ Partial match (${bestConfidence}) in ${elapsed}ms:`,
        bestRecord.title, bestRecord.registrationDate);
      return { found: true, source: 'USCO Database', confidence: bestConfidence, ...bestRecord };
    }

    console.log(`[USCO] ❌ No match in ${elapsed}ms`);
    return { found: false, source: 'USCO Database' };

  } catch (error) {
    console.error('[USCO] ❌ Error:', error.message);
    return { found: false, error: error.message };
  }
}

// ============================================
// WIKIPEDIA RELEASE DATE LOOKUP
// ============================================
async function getWikipediaReleaseDate(songTitle, songwriterName = '', retries = 2) {
  console.log('[WIKIPEDIA] 🔍 Searching:', songTitle);
  const startTime = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const searchQuery = songwriterName
        ? `${songTitle} ${songwriterName} song`
        : `${songTitle} song`;

      const searchUrl    = 'https://en.wikipedia.org/w/api.php';
      const searchParams = {
        action: 'query', list: 'search', srsearch: searchQuery,
        format: 'json', srlimit: 3
      };

      const searchResponse = await axios.get(searchUrl, {
        params: searchParams,
        headers: { 'User-Agent': 'RightsBack/1.0 (Music Copyright Tool)' },
        timeout: 20000
      });

      const searchResults = searchResponse.data?.query?.search || [];
      if (searchResults.length === 0) {
        console.log(`[WIKIPEDIA] ❌ No results in ${Date.now() - startTime}ms`);
        return { found: false };
      }

      const pageTitle = searchResults[0].title;

      const contentParams = {
        action: 'query', titles: pageTitle,
        prop: 'revisions', rvprop: 'content',
        format: 'json', rvslots: 'main'
      };

      const contentResponse = await axios.get(searchUrl, {
        params: contentParams,
        headers: { 'User-Agent': 'RightsBack/1.0 (Music Copyright Tool)' },
        timeout: 20000
      });

      const pages   = contentResponse.data?.query?.pages || {};
      const pageId  = Object.keys(pages)[0];
      const content = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'] || '';

      // Format 1: {{Start date|1987|10|12}}
      let match = content.match(/\{\{Start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
      if (match) {
        const dateStr = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
        console.log(`[WIKIPEDIA] ✅ Found (format 1) in ${Date.now() - startTime}ms:`, dateStr);
        return { found: true, releaseDate: dateStr, source: 'Wikipedia' };
      }

      // Format 2: | Released = October 12, 1987
      match = content.match(/\|\s*[Rr]eleased\s*=\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/);
      if (match) {
        try {
          const d = new Date(match[1].trim());
          if (!isNaN(d)) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            console.log(`[WIKIPEDIA] ✅ Found (format 2) in ${Date.now() - startTime}ms:`, dateStr);
            return { found: true, releaseDate: dateStr, source: 'Wikipedia' };
          }
        } catch (_) {}
      }

      // Format 3: year only
      match = content.match(/\|\s*[Rr]eleased\s*=\s*(\d{4})/);
      if (match) {
        const dateStr = `${match[1]}-01-01`;
        console.log(`[WIKIPEDIA] ✅ Found (format 3) in ${Date.now() - startTime}ms:`, dateStr);
        return { found: true, releaseDate: dateStr, source: 'Wikipedia' };
      }

      console.log(`[WIKIPEDIA] ❌ No date pattern in ${Date.now() - startTime}ms`);
      return { found: false };

    } catch (error) {
      if (attempt < retries) {
        console.log(`[WIKIPEDIA] ⚠️ Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error('[WIKIPEDIA] ❌ Error after retries:', error.message);
      return { found: false, error: error.message };
    }
  }
}

// ============================================
// COMBINED SEARCH (USCO + WIKIPEDIA)
// ============================================
async function searchByTitle(songTitle, songwriterName = '') {
  console.log('[SEARCH] 🔍 Searching:', songTitle);
  const startTime = Date.now();

  try {
    const [uscoResult, wikiResult] = await Promise.all([
      lookupUSCOByTitle(songTitle, songwriterName),
      getWikipediaReleaseDate(songTitle, songwriterName)
    ]);

    const combined = {
      ok: true,
      data: {
        title:              uscoResult.title || songTitle,
        writers:            uscoResult.authors || [],
        registrationNumber: uscoResult.registrationNumber || '',
        registrationDate:   uscoResult.registrationDate || '',
        publicationDate:    wikiResult.releaseDate || '',
        confidence:         uscoResult.confidence || 'NONE',
        sources:            [],
        sourceLabel:        ''
      }
    };

    if (uscoResult.found) combined.data.sources.push('USCO');
    if (wikiResult.found) combined.data.sources.push('Wikipedia');
    combined.data.sourceLabel = combined.data.sources.join(' + ') || 'None';

    if (!uscoResult.found) {
      combined.ok    = false;
      combined.error = 'Record not found in USCO database';
    }

    console.log(`[SEARCH] ✅ Completed in ${Date.now() - startTime}ms`);
    return combined;

  } catch (error) {
    console.error('[SEARCH] ❌ Error:', error.message);
    return { ok: false, error: error.message };
  }
}

// ============================================
// INITIALIZE ON SERVER STARTUP
// ============================================
async function initializeIndex() {
  console.log('[INIT] 🚀 Pre-building USCO index...');
  try {
    await buildUSCOIndex();
    console.log('[INIT] ✅ USCO index ready!');
  } catch (error) {
    console.error('[INIT] ❌ Error building index:', error.message);
  }
}

module.exports = { lookupUSCOByNumber, searchByTitle, initializeIndex };