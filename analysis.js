// analysis.js - Claude-powered copyright analysis for RightsBack
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function clean(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function hasValue(v) {
  return clean(v).length > 0;
}

function normalizeSubmission(raw = {}) {
  return {
    analysisId: clean(raw.analysisId || raw.analysis_id),

    songTitle: clean(raw.songTitle || raw.song_title),
    songwriterName: clean(raw.songwriterName || raw.songwriter_name || raw.userName || raw.name),

    grantDate: clean(raw.grantDate || raw.grant_date),
    compositionDate: clean(raw.compositionDate || raw.publicationDate || raw.pubDate || raw.publication_date),
    registrationDate: clean(raw.registrationDate || raw.copyrightDate || raw.copyright_secured_date),

    applicableSection: clean(raw.applicableSection || raw.applicable_section),
    statusFlag: clean(raw.statusFlag || raw.status_flag),
    windowMissed: clean(raw.windowMissed || raw.window_missed),

    terminationWindowStart: clean(raw.terminationWindowStart || raw.term_window_open),
    terminationWindowEnd: clean(raw.terminationWindowEnd || raw.term_window_close),
    noticeWindowStart: clean(raw.noticeWindowStart || raw.notice_window_open),
    noticeWindowEnd: clean(raw.noticeWindowEnd || raw.notice_window_close),

    publisherName: clean(raw.publisherName || raw.publisher_name),
    rightsType: clean(raw.rightsType || raw.rights_type || raw.grantType || raw.grant_type),

    iswc: clean(raw.iswc || raw.iswcNumber || raw.iswc_number),
    uscoRegistration: clean(raw.uscoRegistration || raw.uscoNumber || raw.usco_number),

    proAffiliation: clean(raw.proAffiliation || raw.pro || raw.userPro),
    ipi: clean(raw.ipi || raw.userIPI),
    proId: clean(raw.proId || raw.pro_id || raw.userProID),

    cowriters: clean(raw.cowriters || raw.coWriters),

    userEmail: clean(raw.userEmail || raw.email),
    userName: clean(raw.userName || raw.name || raw.songwriterName),
  };
}

async function generateResultsExplainer(submissionData) {
  const d = normalizeSubmission(submissionData);

  try {
    const prompt = `You are a copyright law expert. Explain this song's termination eligibility in EXACTLY 3 SHORT sentences that a songwriter can understand.

Song: "${d.songTitle}" by ${d.songwriterName}
Grant Date: ${d.grantDate || 'Unknown'}
Applicable Section: ${d.applicableSection || 'Under review'}
Status: ${d.statusFlag || 'Calculating'}
Window Missed: ${d.windowMissed || 'No'}
Notice Filing Period: ${d.noticeWindowStart || 'Unknown'} to ${d.noticeWindowEnd || 'Unknown'}
Termination Window (when copyright reverts): ${d.terminationWindowStart || 'Unknown'} to ${d.terminationWindowEnd || 'Unknown'}

CRITICAL DISTINCTION — YOU MUST FOLLOW THIS:
- The NOTICE FILING PERIOD is when the songwriter can SERVE their termination notice (a legal document).
- The TERMINATION WINDOW is when the copyright actually REVERTS back to the songwriter.
- These are DIFFERENT dates. NEVER say 'the window is open' without specifying which one.
- If status includes 'open', say: the songwriter can FILE THEIR NOTICE now, but the copyright does not revert until the termination window opens.

Write EXACTLY 3 sentences:
1. Whether they can file their notice now (yes/no) and why
2. When the copyright will actually revert (give the termination window start date), and the notice filing deadline
3. What the concrete next step is

Keep it simple, direct, and encouraging. No legal jargon.
NEVER say 'the window is open' — say 'notice filing period is open' or 'you can serve your notice now'.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].text.trim();
  } catch (error) {
    console.error('Results Explainer error:', error.message);
    return 'Analysis complete. Review the results below to understand your copyright termination timing and next steps.';
  }
}

async function detectRedFlags(submissionData) {
  const d = normalizeSubmission(submissionData);

  try {
    const prompt = `You are a copyright termination expert. Analyze this submission for RED FLAGS that could affect termination eligibility.

Song: "${d.songTitle}" by ${d.songwriterName}
Grant Date: ${d.grantDate || 'NOT PROVIDED'}
Composition / Release Date: ${d.compositionDate || 'NOT PROVIDED'}
Registration Date: ${d.registrationDate || 'NOT PROVIDED'}
Rights Type: ${d.rightsType || 'NOT PROVIDED'}
Publisher: ${d.publisherName || 'NOT PROVIDED'}
Co-writers: ${d.cowriters || 'None listed'}
USCO Registration: ${d.uscoRegistration || 'NOT PROVIDED'}
ISWC: ${d.iswc || 'NOT PROVIDED'}
PRO: ${d.proAffiliation || 'NOT PROVIDED'}

Return JSON only:
{
  "hasRedFlags": true/false,
  "severity": "high"/"medium"/"low",
  "flags": [
    { "issue": "Brief issue name", "detail": "One-sentence explanation", "impact": "Why this matters" }
  ],
  "recommendation": "One-sentence next step"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();

    // Strip markdown code fences if present
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    // Extract just the JSON object in case of any surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);

    // Validate required fields, fallback if malformed
    if (typeof parsed.hasRedFlags !== 'boolean') {
      throw new Error('Invalid JSON shape from red flag detector');
    }

    return parsed;
  } catch (error) {
    console.error('Red Flag Detector error:', error.message);
    return {
      hasRedFlags: false,
      severity: 'low',
      flags: [],
      recommendation: 'Review your submission details with a qualified copyright professional.'
    };
  }
}

function scoreSubmissionQuality(submissionData) {
  const d = normalizeSubmission(submissionData);

  let score = 0;
  const strengths = [];
  const missing = [];

  if (hasValue(d.songTitle)) {
    score += 1;
    strengths.push('Song title is present.');
  } else {
    missing.push('Song title is missing.');
  }

  if (hasValue(d.songwriterName)) {
    score += 1;
    strengths.push('Songwriter name is present.');
  } else {
    missing.push('Songwriter name is missing.');
  }

  if (hasValue(d.grantDate)) {
    score += 2;
    strengths.push('Grant date is present, which helps determine the termination timeline.');
  } else {
    missing.push('Grant date is missing, which can affect termination-window accuracy.');
  }

  if (hasValue(d.compositionDate)) {
    score += 1;
    strengths.push('Composition or release date is present.');
  } else {
    missing.push('Composition or release date is missing.');
  }

  if (hasValue(d.registrationDate)) {
    score += 1;
    strengths.push('Registration date is present.');
  } else {
    missing.push('Registration date is missing.');
  }

  if (hasValue(d.uscoRegistration)) {
    score += 1;
    strengths.push('USCO registration number is present.');
  } else {
    missing.push('USCO registration number is missing.');
  }

  if (hasValue(d.iswc)) {
    score += 1;
    strengths.push('ISWC number is present.');
  } else {
    missing.push('ISWC number is missing.');
  }

  if (hasValue(d.proAffiliation)) {
    score += 1;
    strengths.push('PRO affiliation is present.');
  } else {
    missing.push('PRO affiliation is missing.');
  }

  if (hasValue(d.publisherName)) {
    score += 1;
    strengths.push('Publisher or rights-holder name is present.');
  } else {
    missing.push('Publisher or rights-holder name is missing.');
  }

  if (score > 10) score = 10;

  let grade = 'C';
  if (score >= 9) grade = 'A';
  else if (score >= 7) grade = 'B';
  else if (score >= 5) grade = 'C';
  else grade = 'D';

  let summary = 'Submission received with partial information.';
  if (score >= 9) {
    summary = 'Strong submission with most critical registration and rights data present.';
  } else if (score >= 7) {
    summary = 'Good submission with enough information for a useful preliminary review.';
  } else if (score >= 5) {
    summary = 'Basic submission received, but several details should be confirmed.';
  } else {
    summary = 'Submission is incomplete and needs more information before reliable review.';
  }

  return {
    score,
    grade,
    summary,
    missing: missing.slice(0, 5),
    strengths: strengths.slice(0, 6)
  };
}

async function generateTerminationNotice(submissionData) {
  // Notice display removed from results page per Herb feedback:
  // results page should be informational only, not a filing tool.
  // Stub preserved here — no API call made, saves tokens on every submission.
  return null;
}

async function generateHeirGuidance(submissionData) {
  const d = normalizeSubmission(submissionData);

  try {
    if (!d.applicableSection.includes('304')) return null;

    const prompt = `You are a copyright estate attorney. Explain heir termination rights under 17 U.S.C. § 304(c) and § 304(d).

SONG: "${d.songTitle}" by ${d.songwriterName}
Composition / Release Date: ${d.compositionDate || 'Pre-1978'}
Section: ${d.applicableSection}

Provide guidance in 4 short paragraphs:
1. Who can terminate
2. Majority required
3. Estate representation
4. Next steps

Use simple language.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].text.trim();
  } catch (error) {
    console.error('Heir Guidance error:', error.message);
    return null;
  }
}

async function analyzeSubmission(submissionData) {
  try {
    console.log('🧠 Running comprehensive Claude analysis...');

    const normalized = normalizeSubmission(submissionData);

    const [explainer, redFlags, notice, heirGuidance] = await Promise.all([
      generateResultsExplainer(normalized),
      detectRedFlags(normalized),
      generateTerminationNotice(normalized),
      generateHeirGuidance(normalized)
    ]);

    const quality = scoreSubmissionQuality(normalized);

    return {
      explainer,
      redFlags,
      quality,
      notice,
      heirGuidance,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Comprehensive analysis error:', error.message);
    throw error;
  }
}

module.exports = {
  generateResultsExplainer,
  detectRedFlags,
  scoreSubmissionQuality,
  generateTerminationNotice,
  generateHeirGuidance,
  analyzeSubmission
};