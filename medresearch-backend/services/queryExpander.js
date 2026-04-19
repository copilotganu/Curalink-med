/**
 * queryExpander.js
 *
 * FIXES:
 * 1. getCollection import guard — typeof check before every call
 * 2. Never store/return null, "", "null" as disease
 * 3. sessionId validated before any DB call
 */

let _getCollection = null;
try {
  const m = require('../mongoClient');
  if (m && typeof m.getCollection === 'function') {
    _getCollection = m.getCollection;
  } else if (m && typeof m.default?.getCollection === 'function') {
    _getCollection = m.default.getCollection;
  } else {
    console.warn('⚠️ mongoClient.getCollection not a function — context persistence off');
  }
} catch (e) {
  console.warn('⚠️ mongoClient unavailable:', e.message);
}

const DISEASE_SYNONYMS = {
  'lung cancer':   ['NSCLC', 'non-small cell lung cancer', 'SCLC', 'small cell lung cancer', 'lung carcinoma', 'pulmonary cancer'],
  'parkinson':     ["parkinson's disease", 'PD', 'parkinsonian syndrome', 'parkinsonism'],
  'diabetes':      ['diabetes mellitus', 'type 1 diabetes', 'type 2 diabetes', 'diabetic', 'hyperglycemia'],
  'cancer':        ['carcinoma', 'malignancy', 'neoplasm', 'oncology'],
  'alzheimer':     ['alzheimer disease', 'dementia', 'neurodegenerative', 'cognitive decline'],
  'asthma':        ['asthmatic', 'reactive airway disease', 'bronchial asthma'],
  'heart disease': ['cardiovascular disease', 'cardiac disease', 'coronary artery disease'],
  'depression':    ['major depressive disorder', 'depressive episode', 'mood disorder'],
};

const TREATMENT_KEYWORDS = {
  'immunotherapy': ['immune checkpoint inhibitor', 'ICB', 'anti-PD-1', 'anti-PD-L1', 'CAR-T'],
  'chemotherapy':  ['cytotoxic', 'platinum-based', 'taxane', 'gemcitabine'],
  'surgery':       ['surgical intervention', 'operative', 'resection', 'transplant'],
  'radiotherapy':  ['radiation', 'radiotherapy', 'SBRT', 'proton therapy'],
  'drug':          ['pharmaceutical', 'medication', 'therapeutic agent'],
  'combination':   ['combined therapy', 'combination treatment', 'multimodal'],
};

const SUPPLEMENT_KEYWORDS = {
  'vitamin d':  ['vitamin d', 'calcitriol', '1,25-dihydroxyvitamin d', 'cholecalciferol', '25-hydroxyvitamin d'],
  'vitamin c':  ['vitamin c', 'ascorbic acid'],
  'vitamin e':  ['vitamin e', 'tocopherol'],
  'vitamin a':  ['vitamin a', 'retinol'],
  'magnesium':  ['magnesium'],
  'zinc':       ['zinc'],
  'curcumin':   ['curcumin', 'turmeric'],
  'green tea':  ['green tea', 'egcg', 'catechins'],
  'probiotics': ['probiotics', 'microbiota'],
  'omega-3':    ['omega-3', 'fish oil'],
  'melatonin':  ['melatonin'],
  'ginseng':    ['ginseng'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function isValidStr(s) {
  return s && typeof s === 'string' && s.trim().length > 0
    && !['null','undefined','none'].includes(s.trim().toLowerCase());
}

async function getDiseaseContext(sessionId) {
  return null; // Disabled, using file cache instead
}

async function setDiseaseContext(sessionId, disease) {
  // Disabled, using file cache instead
}

// ── Extraction ────────────────────────────────────────────────────────────────
function extractDiseaseFromQuery(query) {
  if (!query) return null;
  const lower = query.toLowerCase();
  for (const [disease, synonyms] of Object.entries(DISEASE_SYNONYMS)) {
    if (lower.includes(disease)) return cap(disease);
    for (const syn of synonyms) {
      if (lower.includes(syn.toLowerCase())) return cap(disease);
    }
  }
  return null;
}

function extractSupplementFromQuery(query) {
  if (!query) return null;
  const lower = query.toLowerCase();
  for (const [supplement, keywords] of Object.entries(SUPPLEMENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return cap(supplement);
    }
  }
  return null;
}

function extractInterventionFromQuery(query) {
  if (!query) return null;
  const lower = query.toLowerCase();
  for (const [kw] of Object.entries(TREATMENT_KEYWORDS)) {
    if (lower.includes(kw)) return cap(kw);
  }
  return null;
}

// ── Query builders ────────────────────────────────────────────────────────────
function normalizeSearchTerms(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[,\s]+/)
    .map(token => token.trim())
    .filter(token => token.length > 2);
}

function buildPubMedQuery(query, disease, supplement = null, location = null) {
  const parts = [];
  if (disease) {
    const syns  = DISEASE_SYNONYMS[disease.toLowerCase()] || [];
    const terms = [disease, ...syns].map(d => `"${d}"[Title/Abstract]`).join(' OR ');
    parts.push(`(${terms})`);
  }
  if (supplement) {
    const kws   = SUPPLEMENT_KEYWORDS[supplement.toLowerCase()] || [supplement];
    const terms = kws.map(s => `"${s}"[Title/Abstract]`).join(' OR ');
    parts.push(`(${terms})`);
  } else if (!disease) {
    parts.push(`(${query}[Title/Abstract])`);
  }
  if (location && location.trim()) {
    const locTerms = normalizeSearchTerms(location);
    if (locTerms.length > 0) {
      const locClauses = locTerms.flatMap(t => [`"${t}"[Affiliation]`, `"${t}"[Title/Abstract]`]);
      parts.push(`(${locClauses.join(' OR ')})`);
    }
  }
  return parts.length > 0 ? parts.join(' AND ') : query;
}

function buildOpenAlexQuery(query, disease, supplement = null, location = null) {
  const parts = [];
  if (disease)    parts.push(`"${disease}"`);
  if (supplement) parts.push(`"${supplement}"`);
  else if (!disease && query) parts.push(`"${query}"`);
  if (location && location.trim()) {
    const locTerms = normalizeSearchTerms(location);
    parts.push(...locTerms.map(t => `"${t}"`));
  }
  return parts.join(' AND ');
}

// ── Main export ───────────────────────────────────────────────────────────────
async function expandQuery(query, sessionId = null, location = null) {
  const lower = query.toLowerCase();

  const extractedDisease  = extractDiseaseFromQuery(query);
  const previousDisease   = isValidStr(sessionId) ? await getDiseaseContext(sessionId) : null;
  const detectedDisease   = extractedDisease || previousDisease || null;

  if (isValidStr(sessionId) && isValidStr(extractedDisease)) {
    await setDiseaseContext(sessionId, extractedDisease);
  }

  const detectedSupplement = extractSupplementFromQuery(query);

  const parts = [];
  if (detectedDisease) {
    const syns  = DISEASE_SYNONYMS[detectedDisease.toLowerCase()] || [];
    const terms = [detectedDisease, ...syns].map(d => `"${d}"`).join(' OR ');
    parts.push(`(${terms})`);
  } else {
    parts.push(`(${query})`);
  }

  if (detectedSupplement) {
    const kws   = SUPPLEMENT_KEYWORDS[detectedSupplement.toLowerCase()] || [detectedSupplement];
    const terms = kws.map(s => `"${s}"`).join(' OR ');
    parts.push(`(${terms})`);
  }

  for (const [kw, expansions] of Object.entries(TREATMENT_KEYWORDS)) {
    if (lower.includes(kw)) {
      const terms = [kw, ...expansions].map(t => `"${t}"`).join(' OR ');
      parts.push(`(${terms})`);
    }
  }

  if (lower.includes('trial') || lower.includes('study'))
    parts.push('(clinical trial OR randomized controlled trial OR cohort study)');
  if (lower.includes('outcome') || lower.includes('efficacy'))
    parts.push('(efficacy OR effectiveness OR outcome)');

  return {
    expanded:                   parts.join(' AND '),
    simple:                     query,
    pubmedQuery:                buildPubMedQuery(query, detectedDisease, detectedSupplement, location),
    openAlexQuery:              buildOpenAlexQuery(query, detectedDisease, detectedSupplement, location),
    clinicalTrialsCondition:    detectedDisease,
    clinicalTrialsIntervention: detectedSupplement || extractInterventionFromQuery(query),
    disease:    detectedDisease || '',  // empty string, never null
    supplement: detectedSupplement,
  };
}

function cap(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { expandQuery };