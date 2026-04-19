/**
 * routes/query.js
 *
 * FIXES:
 * 1. In-memory cache so context works even when MongoDB fails/is slow
 * 2. Disease NEVER stored as string "null" — isValidDisease() guard everywhere
 * 3. actualDisease inherits previousDisease for supplement-only follow-ups
 * 4. MongoDB save is non-blocking (don't await it — don't slow response)
 * 5. Detailed logging so failures surface immediately
 */

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { expandQuery }          = require('../services/queryExpander');
const { fetchPubMed }          = require('../services/pubmed');
const { fetchOpenAlex }        = require('../services/openalex');
const { fetchClinicalTrials }  = require('../services/clinicalTrials');
const { rankPublications, rankTrials } = require('../services/ranker');
const { generateFastResponse } = require('../services/fastResponse_v2');
const {
  detectFollowUpQuestion,
  isSameDisease,
  generateContextualAnswer,
  generateContextSummary,
} = require('../services/contextAwareResponse');
const Conversation = require('../models/Conversation');

const router = express.Router();

// ── File-based cache for context persistence ────────────────────────
const CACHE_DIR = path.join(__dirname, '..', 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
const CACHE_FILE = path.join(CACHE_DIR, 'context.json');
const LAST_CONTEXT_FILE = path.join(CACHE_DIR, 'last_context.json');

function loadCache() {
  try {
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    // ignore
  }
}

function loadLastContext() {
  try {
    const data = fs.readFileSync(LAST_CONTEXT_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function saveLastContext(disease, context) {
  try {
    fs.writeFileSync(LAST_CONTEXT_FILE, JSON.stringify({ disease, context }));
  } catch (e) {
    // ignore
  }
}

let _cache = loadCache();
let _lastContext = loadLastContext();

function cacheGet(convId) {
  const e = _cache[convId];
  if (!e) {
    console.log(`📦 Cache MISS for ${convId}`);
    return null;
  }
  if (Date.now() - e.updatedAt > 2 * 60 * 60 * 1000) {
    delete _cache[convId];
    saveCache(_cache);
    console.log(`📦 Cache EXPIRED for ${convId}`);
    return null;
  }
  console.log(`📦 Cache HIT for ${convId} — disease: "${e.disease}"`);
  return e;
}

function cacheSet(convId, disease, context) {
  _cache[convId] = { disease, context, updatedAt: Date.now() };
  saveCache(_cache);
  console.log(`📦 Cache SET for ${convId} — disease: "${disease}"`);
  // Save as last context for follow-ups
  _lastContext = { disease, context };
  saveLastContext(disease, context);
}

// ── Disease validation ────────────────────────────────────────────────────────
function isValidDisease(d) {
  if (!d || typeof d !== 'string') return false;
  const t = d.trim().toLowerCase();
  return t.length > 0 && !['null','undefined','none',''].includes(t);
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/query', async (req, res) => {
  try {
    const { query, context, conversationId } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const convId   = conversationId || uuidv4();
    const location = context?.location || '';
    const t0       = Date.now();

    console.log(`\n🔍 Query: "${query}" | convId: ${convId}`);

    // ── Step 0: Load previous context ─────────────────────────────────────
    let previousDisease = null;
    let previousContext = null;

    // Memory cache first (instant)
    const cached = cacheGet(convId);
    if (cached) {
      previousDisease = cached.disease;
      previousContext = cached.context;
      console.log(`📦 Cache HIT — disease: "${previousDisease}"`);
    } else {
      try {
        const conv = await Conversation.findOne({ conversationId: convId }).lean();
        if (conv?.messages?.length > 0) {
          for (let i = conv.messages.length - 1; i >= 0; i--) {
            const m = conv.messages[i];
            if (m.role === 'assistant' && m.response) {
              previousContext = m.response;
              for (const c of [m.disease, m.response?.disease, conv.lastDisease]) {
                if (isValidDisease(c)) { previousDisease = c.trim(); break; }
              }
              break;
            }
          }
        }
        console.log(`🗄️  DB — disease: "${previousDisease}" | context: ${!!previousContext}`);
      } catch (e) {
        console.error('❌ MongoDB load failed:', e.message);
      }
    }

    // ── Step 1: Expand query ───────────────────────────────────────────────
    if (!previousContext && _lastContext?.context && isValidDisease(_lastContext.disease)) {
      previousDisease = previousDisease || _lastContext.disease.trim();
      previousContext = _lastContext.context;
      console.log(`📦 Loaded LAST CONTEXT — disease: "${previousDisease}"`);
    }

    const fakeHistory = previousContext ? [{ role: 'assistant', response: previousContext }] : [];
    const fu = detectFollowUpQuestion(query, fakeHistory, previousDisease);

    const expanded = await expandQuery(query, convId, location);
    const actualDisease = isValidDisease(expanded.disease)
      ? expanded.disease.trim()
      : (previousDisease || _lastContext?.disease || '');

    console.log(`📝 actualDisease: "${actualDisease}" | supplement: "${expanded.supplement || 'none'}"`);

    const shouldUseContext =
      fu.isFollowUp &&
      previousContext !== null &&
      isValidDisease(previousDisease) &&
      isSameDisease(actualDisease, previousDisease);

    console.log(`📋 isFollowUp: ${fu.isFollowUp} | shouldUseContext: ${shouldUseContext}`);

    let response;
    let usingContext = false;

    if (shouldUseContext) {
      // ── CONTEXT PATH ────────────────────────────────────────────────────
      console.log(`⚡ CONTEXT PATH — reusing "${previousDisease}" research`);
      usingContext = true;

      const contextualAnswer = await generateContextualAnswer(query, previousContext, previousDisease);
      const contextSummary   = generateContextSummary(previousContext, previousDisease);
      const answerBody = contextualAnswer
        || contextSummary
        || `I found the previous ${previousDisease} context, but could not generate a specific follow-up answer.`;

      response = {
        overview:          answerBody,
        insights:          '',
        clinical_trials:   '',
        publications:      previousContext.publications  || [],
        trials:            previousContext.trials        || [],
        sources:           [...(previousContext.publications || []), ...(previousContext.trials || [])],
        overallInsight:    previousContext.overallInsight,
        knowledgeGaps:     previousContext.knowledgeGaps,
        trialFocusAreas:   previousContext.trialFocusAreas,
        retrievalDepth:    previousContext.retrievalDepth,
        mostRelevantStudy: previousContext.mostRelevantStudy,
        temporalTrend:     previousContext.temporalTrend,
        disease:           previousDisease,
        supplement:        expanded.supplement,
        fromContext:       true,
        generatedByLLM:    Boolean(contextualAnswer),
      };

    } else {
      // ── FRESH FETCH PATH ─────────────────────────────────────────────────
      console.log(`🔄 FRESH FETCH — disease: "${actualDisease}"`);

      const [pubmedResults, openalexResults, trialsResults] = await Promise.all([
        fetchPubMed(expanded.pubmedQuery, 30),
        fetchOpenAlex(expanded.openAlexQuery, 30),
        fetchClinicalTrials(
          expanded.clinicalTrialsCondition || actualDisease,
          expanded.clinicalTrialsIntervention,
          location, 20
        ),
      ]);

      console.log(`📍 Location: "${location || 'none'}"`);
      console.log(`📊 PubMed: ${pubmedResults.length} | OpenAlex: ${openalexResults.length} | Trials: ${trialsResults.length}`);

      const allPubs   = deduplicatePublications([...pubmedResults, ...openalexResults]);
      const rankedPubs   = rankPublications(allPubs, query, actualDisease, expanded.supplement);
      const rankedTrials = rankTrials(trialsResults, query, actualDisease, expanded.supplement);
      const topPapers    = rankedPubs.slice(0, 6);
      const topTrials    = filterTrialsByLocation(rankedTrials, location).slice(0, 3);
      const suppFound    = !!(expanded.supplement && rankedPubs.some(p => p.mentionsSupplement));

      response = await generateFastResponse(
        query, topPapers, topTrials,
        { pubmedCount: pubmedResults.length, openalexCount: openalexResults.length, trialsCount: trialsResults.length },
        actualDisease, expanded.supplement, suppFound
      );
      response.disease           = actualDisease;
      response.fromContext       = false;
      response.supplement        = expanded.supplement;
      response.supplementEvidence = suppFound ? 'present' : 'limited';
    }

    // ── Step 3: Persist (cache immediately, MongoDB async) ─────────────────
    if (isValidDisease(response.disease)) {
      cacheSet(convId, response.disease, response);
    }
    saveToMongo(convId, query, context, response).catch(e =>
      console.error('❌ MongoDB save error:', e.message)
    );

    console.log(`✅ ${usingContext ? 'CONTEXT' : 'FRESH'} — disease: "${response.disease}" | ${Date.now() - t0}ms\n`);

    res.json({
      conversationId: convId,
      ...response,
      meta: {
        fromContext:    usingContext,
        sourceType:     usingContext ? 'conversation-memory' : 'fresh-research',
        generatedByLLM: response.generatedByLLM || false,
      },
    });

  } catch (error) {
    console.error('❌ Route error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

async function saveToMongo(convId, query, context, response) {
  const d = isValidDisease(response.disease) ? response.disease : null;
  await Conversation.findOneAndUpdate(
    { conversationId: convId },
    {
      $push: {
        messages: [
          { role: 'user',      content: query,            context, disease: d },
          { role: 'assistant', content: response.overview, response, disease: d },
        ],
      },
      $set: {
        ...(d ? { lastDisease: d } : {}),
        lastQuery: query,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

function getSafeTitle(pub) {
  if (!pub.title) return '';
  if (typeof pub.title === 'string') return pub.title;
  if (Array.isArray(pub.title)) return pub.title[0] || '';
  if (typeof pub.title === 'object') return pub.title.text || '';
  return '';
}
function filterTrialsByLocation(trials, loc) {
  if (!loc?.trim()) return trials;
  const toks = loc.toLowerCase().split(/[,\s]+/).filter(t => t.length > 2);
  const matches = trials.filter(t => {
    const title = (t.title || '').toLowerCase();
    const eligibility = (t.eligibility || '').toLowerCase();
    const location = (t.location || '').toLowerCase();
    return toks.some(tok =>
      location.includes(tok) ||
      title.includes(tok) ||
      eligibility.includes(tok)
    );
  });
  if (matches.length > 0) return matches;

  // Fallback: try country-only filtering if location is city, country
  const country = loc.split(',').pop()?.trim().toLowerCase();
  if (country && country.length > 2) {
    const countryMatches = trials.filter(t => (t.location || '').toLowerCase().includes(country));
    if (countryMatches.length > 0) return countryMatches;
  }

  return trials;
}
function deduplicatePublications(pubs) {
  const seen = new Map();
  for (const pub of pubs) {
    const title = getSafeTitle(pub);
    if (!title) continue;
    const key = title.toLowerCase().replace(/[^\w]/g, '').substring(0, 60);
    const ex = seen.get(key);
    if (!ex || (pub.abstract || '').length > (ex.abstract || '').length) seen.set(key, pub);
  }
  return Array.from(seen.values());
}

module.exports = router;
