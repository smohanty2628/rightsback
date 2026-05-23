// ============================================
// CLEANED DATABASE-SEARCH.JS
// ✅ USCO only (registration dates, authors)
// ✅ Wikipedia API (release dates)
// ❌ ASCAP REMOVED (not needed)
// ============================================

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const zlib = require('zlib');

const USCO_PATH = path.join(__dirname, 'data', 'usco', 'reg_musical_work.csv');
const USCO_PATH_GZ = USCO_PATH + '.gz';

let uscoIndex = null;
let uscoIndexBuilt = false;
const isBuilding = { usco: false };

// ============================================
// UTILITY FUNCTIONS
// ============================================
function normalize(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
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

  // Check for gzipped file first, then uncompressed
let filePath = null;
let isGzipped = false;

if (fs.existsSync(USCO_PATH_GZ)) {
  filePath = USCO_PATH_GZ;
  isGzipped = true;
  console.log('[USCO INDEX] Found gzipped file:', USCO_PATH_GZ);
} else if (fs.existsSync(USCO_PATH)) {
  filePath = USCO_PATH;
  isGzipped = false;
  console.log('[USCO INDEX] Found uncompressed file:', USCO_PATH);
} else {
  throw new Error(`USCO file not found at ${USCO_PATH} or ${USCO_PATH_GZ}`);
}

  isBuilding.usco = true;
  console.log('[USCO INDEX] 🔨 Building from CSV...');
  const startTime = Date.now();

  uscoIndex = new Map();
  let lineCount = 0;

  // Create read stream (with or without gunzip)
let fileStream;
if (isGzipped) {
  fileStream = fs.createReadStream(filePath)
    .pipe(zlib.createGunzip())
    .setEncoding('utf8');
} else {
  fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
}
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

    if (lineCount > 4000000) {
      console.log('[USCO INDEX] Reached 4M line limit');
      break;
    }

    try {
      const values = [];
      let current = '';
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
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      const regNumber = row['reg_num']?.trim();
      if (!regNumber) continue;

      const title = row['title'] || '';
      const registrationDate = row['reg_date'] || '';

      const authors = [];
      for (let i = 1; i <= 10; i++) {
        const authorName = row[`author_${i}_name`]?.trim();
        if (authorName) {
          authors.push(authorName);
        }
      }

      for (let i = 1; i <= 10; i++) {
        const claimantName = row[`claimant_${i}_name`]?.trim();
        if (claimantName && !authors.includes(claimantName)) {
          authors.push(claimantName);
        }
      }

      uscoIndex.set(regNumber, {
        registrationNumber: regNumber,
        title: title,
        registrationDate: registrationDate,
        authors: authors
      });
    } catch (error) {
      // Skip malformed lines
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[USCO INDEX] ✅ Built: ${uscoIndex.size.toLocaleString()} records in ${elapsed}s`);
  console.log(`[USCO INDEX] 🚀 All future searches instant (<100ms)!`);

  uscoIndexBuilt = true;
  isBuilding.usco = false;
  return uscoIndex;
}

// ============================================
// USCO LOOKUP BY REGISTRATION NUMBER
// ============================================
async function lookupUSCOByNumber(registrationNumber) {
  try {
    const index = await buildUSCOIndex();
    const record = index.get(registrationNumber.trim());

    if (!record) {
      return { 
        ok: false, 
        found: false,
        error: 'Record not found in USCO database' 
      };
    }

    return {
      ok: true,
      found: true,
      data: {
        title: record.title,
        registrationNumber: record.registrationNumber,
        registrationDate: record.registrationDate,
        authors: record.authors,
        source: 'USCO Database',
        confidence: 'HIGH'
      }
    };

  } catch (error) {
    console.error('[USCO] ❌ Error:', error.message);
    return { ok: false, found: false, error: error.message };
  }
}

// ============================================
// USCO LOOKUP BY TITLE (PRIORITIZES OLDEST DATE)
// ============================================
async function lookupUSCOByTitle(songTitle, songwriterName = '') {
  console.log('[USCO] 🔍 Title:', songTitle);
  const startTime = Date.now();

  try {
    const index = await buildUSCOIndex();
    const searchTitle = normalize(songTitle);
    const searchLastName = getLastName(songwriterName);

    let allHighMatches = [];
    let bestMatch = null;
    let bestScore = 0;

    for (const [regNumber, record] of index) {
      const titleNorm = normalize(record.title);
      
      const titleExact = titleNorm === searchTitle;
      const titleContains = titleNorm.includes(searchTitle) || searchTitle.includes(titleNorm);
      
      if (!titleExact && !titleContains) continue;

      let songwriterMatch = !searchLastName;
      if (searchLastName && record.authors.length > 0) {
        songwriterMatch = record.authors.some(author => {
          const authorLast = getLastName(author);
          return authorLast === searchLastName;
        });
      }

      let confidence = 'LOW';
      if (titleExact && songwriterMatch) confidence = 'HIGH';
      else if (titleExact || songwriterMatch) confidence = 'MEDIUM';

      const score = (titleExact ? 100 : 50) + (songwriterMatch ? 50 : 0);

      if (confidence === 'HIGH') {
        allHighMatches.push({ ...record, confidence, score });
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { ...record, confidence };
      }
    }

    // Pick OLDEST if multiple HIGH confidence matches
    if (allHighMatches.length > 0) {
      console.log(`[USCO] Comparing ${allHighMatches.length} HIGH matches...`);
      
      bestMatch = allHighMatches.reduce((oldest, current) => {
        const oldestDate = new Date(oldest.registrationDate || '9999-12-31');
        const currentDate = new Date(current.registrationDate || '9999-12-31');
        return currentDate < oldestDate ? current : oldest;
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`[USCO] ✅ HIGH match (oldest) in ${elapsed}ms:`, bestMatch.title, bestMatch.registrationDate);
      return {
        found: true,
        source: 'USCO Database',
        ...bestMatch
      };
    }

    const elapsed = Date.now() - startTime;

    if (bestMatch) {
      console.log(`[USCO] ✅ Match (${bestMatch.confidence}) in ${elapsed}ms:`, bestMatch.title);
      return {
        found: true,
        source: 'USCO Database',
        ...bestMatch
      };
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
      
      const searchUrl = 'https://en.wikipedia.org/w/api.php';
      const searchParams = {
        action: 'query',
        list: 'search',
        srsearch: searchQuery,
        format: 'json',
        srlimit: 3
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
      
      const contentUrl = 'https://en.wikipedia.org/w/api.php';
      const contentParams = {
        action: 'query',
        titles: pageTitle,
        prop: 'revisions',
        rvprop: 'content',
        format: 'json',
        rvslots: 'main'
      };

      const contentResponse = await axios.get(contentUrl, { 
        params: contentParams,
        headers: { 'User-Agent': 'RightsBack/1.0 (Music Copyright Tool)' },
        timeout: 20000
      });

      const pages = contentResponse.data?.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      const content = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'] || '';

      let dateStr = null;
      
      // Format 1: {{Start date|1987|10|12}}
      let match = content.match(/\{\{Start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
      if (match) {
        const [_, year, month, day] = match;
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');
        dateStr = `${year}-${paddedMonth}-${paddedDay}`;
        console.log(`[WIKIPEDIA] ✅ Found (format 1) in ${Date.now() - startTime}ms:`, dateStr);
        return { found: true, releaseDate: dateStr, source: 'Wikipedia' };
      }
      
      // Format 2: Plain date "October 12, 1987"
      match = content.match(/\|\s*[Rr]eleased\s*=\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/);
      if (match) {
        dateStr = match[1].trim();
        try {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate)) {
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
          }
        } catch (e) {}
        console.log(`[WIKIPEDIA] ✅ Found (format 2) in ${Date.now() - startTime}ms:`, dateStr);
        return { found: true, releaseDate: dateStr, source: 'Wikipedia' };
      }
      
      // Format 3: Year only
      match = content.match(/\|\s*[Rr]eleased\s*=\s*(\d{4})/);
      if (match) {
        dateStr = `${match[1]}-01-01`;
        console.log(`[WIKIPEDIA] ✅ Found (format 3 - year) in ${Date.now() - startTime}ms:`, dateStr);
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
    // Search USCO and Wikipedia in parallel
    const [uscoResult, wikiResult] = await Promise.all([
      lookupUSCOByTitle(songTitle, songwriterName),
      getWikipediaReleaseDate(songTitle, songwriterName)
    ]);

    // Merge results
    let combined = {
      ok: true,
      data: {
        title: uscoResult.title || songTitle,
        writers: uscoResult.authors || [],
        registrationNumber: uscoResult.registrationNumber || '',
        registrationDate: uscoResult.registrationDate || '',
        publicationDate: wikiResult.releaseDate || '',
        confidence: uscoResult.confidence || 'LOW',
        sources: [],
        sourceLabel: ''
      }
    };

    // Build source list
    if (uscoResult.found) combined.data.sources.push('USCO');
    if (wikiResult.found) combined.data.sources.push('Wikipedia');

    combined.data.sourceLabel = combined.data.sources.join(' + ') || 'None';

    // If nothing found
    if (!uscoResult.found) {
      combined.ok = false;
      combined.error = 'Record not found in USCO database';
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SEARCH] ✅ Completed in ${elapsed}ms`);
    
    return combined;

  } catch (error) {
    console.error('[SEARCH] ❌ Error:', error.message);
    return {
      ok: false,
      error: error.message
    };
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

module.exports = {
  lookupUSCOByNumber,
  searchByTitle,
  initializeIndex
};