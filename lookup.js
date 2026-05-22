// rights-back/lookup.js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'RightsBack/1.0 (smohanty2628@gmail.com)';

async function lookupSongMetadata(songTitle, songwriterName) {
  try {
    // Search MusicBrainz for the work
    const searchUrl = `${MUSICBRAINZ_BASE}/work/?query=work:"${encodeURIComponent(songTitle)}" AND artist:"${encodeURIComponent(songwriterName)}"&fmt=json`;
    
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (response.data.works && response.data.works.length > 0) {
      const work = response.data.works[0];
      return {
        iswc: work.iswc || null,
        workId: work.id || null,
        title: work.title || songTitle,
      };
    }

    return null;
  } catch (error) {
    console.error('MusicBrainz lookup error:', error.message);
    return null;
  }
}

async function analyzeSongWithClaude(songTitle, songwriterName, registrationYear) {
  try {
    const prompt = `Song: "${songTitle}" by ${songwriterName}${registrationYear ? `, registered ${registrationYear}` : ''}

Analyze copyright termination eligibility for this song. Provide:
1. Estimated original grant date (year when rights were first transferred to publisher)
2. Likely copyright ownership structure (sole author, co-writers, work-for-hire)
3. Key factors affecting termination eligibility
4. Recommended next steps for investigation

Keep response concise and actionable.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error.message);
    return 'Analysis unavailable. Please check your song details and try again.';
  }
}

async function performLookup(songTitle, songwriterName, registrationYear = null) {
  console.log(`🔍 Looking up: "${songTitle}" by ${songwriterName}`);

  // Step 1: MusicBrainz metadata lookup
  const metadata = await lookupSongMetadata(songTitle, songwriterName);
  
  // Step 2: Claude AI analysis
  const analysis = await analyzeSongWithClaude(songTitle, songwriterName, registrationYear);

  return {
    metadata: metadata || { message: 'No MusicBrainz data found' },
    analysis,
  };
}

// Additional lookup functions expected by server.js
async function lookupByISWC(iswc) {
  try {
    const searchUrl = `${MUSICBRAINZ_BASE}/work/?query=iswc:${encodeURIComponent(iswc)}&fmt=json`;
    
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (response.data.works && response.data.works.length > 0) {
      const work = response.data.works[0];
      return {
        title: work.title,
        iswc: work.iswc,
        composers: work.artists || [],
      };
    }

    return null;
  } catch (error) {
    console.error('ISWC lookup error:', error.message);
    return null;
  }
}

async function lookupByUSCO(registrationNumber) {
  try {
    // USCO doesn't have a public API, but we can use Claude to analyze the registration number
    // and provide intelligent guidance based on the registration format
    
    const prompt = `Analyze this U.S. Copyright Office registration number: ${registrationNumber}

Based on the registration format, provide:
1. Registration type (PA = Performing Arts, SR = Sound Recording, etc.)
2. Likely registration year (based on number format)
3. What records to request from USCO to get grant dates

Respond in JSON format:
{
  "registrationType": "PA (Performing Arts)",
  "likelyYear": "2001",
  "guidance": "One-sentence instruction on what to request from USCO",
  "estimatedGrantDate": "approximate year based on registration",
  "confidence": "high/medium/low"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    
    // Extract JSON from response
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonText);

    return {
      registrationNumber,
      type: analysis.registrationType,
      year: analysis.likelyYear,
      guidance: analysis.guidance,
      estimatedGrantDate: analysis.estimatedGrantDate,
      confidence: analysis.confidence,
      source: 'Claude AI Analysis + USCO Format Rules'
    };
  } catch (error) {
    console.error('USCO lookup error:', error.message);
    
    // Fallback: Basic format analysis without Claude
    const prefix = registrationNumber.substring(0, 2).toUpperCase();
    const types = {
      'PA': 'Performing Arts (Musical Composition)',
      'SR': 'Sound Recording',
      'TX': 'Literary Work',
      'VA': 'Visual Arts'
    };
    
    return {
      registrationNumber,
      type: types[prefix] || 'Unknown',
      year: 'Unable to determine from format',
      guidance: 'Request certificate of registration from USCO at copyright.gov/records',
      estimatedGrantDate: null,
      confidence: 'low',
      source: 'Basic format recognition'
    };
  }
}

async function lookupBySongTitle(title, artist) {
  // First try MusicBrainz
  const mbResult = await lookupSongMetadata(title, artist);
  
  if (mbResult) {
    return mbResult;
  }

  // If MusicBrainz fails, use Claude to provide intelligent estimates
  try {
    const prompt = `Analyze this song for copyright termination research:

Song: "${title}"
Artist: ${artist || 'Unknown'}

Based on your knowledge of music history, provide:
1. Likely composition/recording year range
2. Typical publisher for this artist/era
3. Whether this is likely §203 (post-1978) or §304 (pre-1978)
4. Estimated grant date range

Respond in JSON format:
{
  "title": "${title}",
  "artist": "${artist || 'Unknown'}",
  "estimatedYear": "1975-1978",
  "likelyPublisher": "Major label name or 'Unknown'",
  "applicableSection": "§203" or "§304",
  "grantDateEstimate": "year range",
  "confidence": "high/medium/low",
  "notes": "Brief note about this song/artist"
}

If you don't recognize this song, set confidence to 'low' and provide best estimates.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    
    // Extract JSON
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonText);

    return {
      title: analysis.title,
      artist: analysis.artist,
      iswc: null,
      workId: null,
      estimatedYear: analysis.estimatedYear,
      likelyPublisher: analysis.likelyPublisher,
      applicableSection: analysis.applicableSection,
      grantDateEstimate: analysis.grantDateEstimate,
      confidence: analysis.confidence,
      notes: analysis.notes,
      source: 'Claude AI Analysis (MusicBrainz data not available)'
    };
  } catch (error) {
    console.error('Title lookup with Claude failed:', error.message);
    return null;
  }
}

module.exports = { 
  performLookup, 
  lookupSongMetadata, 
  analyzeSongWithClaude,
  lookupByISWC,
  lookupByUSCO,
  lookupBySongTitle
};