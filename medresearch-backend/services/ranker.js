/**
 * Ranking Service - STRICT DISEASE FILTERING
 * Aggressive relevance filtering to prevent generalization
 * CRITICAL: No disease mixing or fuzzy matches
 */

function isStrictlyRelevant(text, disease, query) {
  const lower = (text || '').toLowerCase();
  const diseaseLower = (disease || '').toLowerCase();
  const queryLower = (query || '').toLowerCase();
  
  // MUST contain disease OR must contain multiple query terms
  const hasDisease = diseaseLower && lower.includes(diseaseLower);
  
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 3);
  const matchedTerms = queryTerms.filter(term => lower.includes(term)).length;
  const hasQuery = matchedTerms >= 2 || (matchedTerms === 1 && queryTerms.length === 1);
  
  return hasDisease || hasQuery;
}

function isLowQuality(text) {
  const lower = (text || '').toLowerCase();
  
  // Reject news, opinion, promotional content
  if (lower.includes('news') || lower.includes('press release')) return true;
  if (lower.includes('opinion') || lower.includes('blog')) return true;
  if (lower.includes('advertisement') || lower.includes('promotional')) return true;
  
  return false;
}

function rankPublications(publications, query, disease, supplement = null) {
  const queryTerms = tokenize(query);
  const diseaseLower = (disease || '').toLowerCase();
  const supplementLower = (supplement || '').toLowerCase();

  // STRICT FILTER: Only publications truly relevant to disease + query
  const filtered = publications.filter(pub => {
    const title = pub.title || '';
    const abstract = pub.abstract || '';
    const fullText = `${title} ${abstract}`;
    
    // Reject low quality content
    if (isLowQuality(fullText)) {
      return false;
    }
    
    // MUST be strictly relevant
    return isStrictlyRelevant(fullText, disease, query);
  });

  const scored = filtered.map(pub => {
    let score = 0;
    const titleLower = (pub.title || '').toLowerCase();
    const abstractLower = (pub.abstract || '').toLowerCase();
    const fullText = `${titleLower} ${abstractLower}`;

    // CRITICAL: +5 if title contains disease (lock it in)
    if (diseaseLower && titleLower.includes(diseaseLower)) {
      score += 5;
    }

    // NEW: BONUS SCORING for requested supplement
    let mentionsSupplement = false;
    if (supplementLower && fullText.includes(supplementLower)) {
      score += 8; // HIGHEST PRIORITY: +8 for supplement mention
      mentionsSupplement = true;
    }
    // Also check for common supplement variants
    if (supplementLower === 'vitamin d' && fullText.match(/vitamin\s*d|calcitriol|cholecalciferol|25-hydroxyvitamin/i)) {
      score += 8;
      mentionsSupplement = true;
    }

    // +3 if abstract contains disease multiple times (shows focus)
    const diseaseMatches = (abstractLower.match(new RegExp(diseaseLower, 'g')) || []).length;
    if (diseaseMatches >= 2) {
      score += 3;
    } else if (diseaseMatches === 1) {
      score += 1;
    }

    // +3 if query terms in title
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        score += 3;
        break;
      }
    }

    // +2 if query terms in abstract
    for (const term of queryTerms) {
      if (abstractLower.includes(term)) {
        score += 2;
        break;
      }
    }

    // +2 if published after 2022
    if (pub.year >= 2023) score += 2;
    else if (pub.year >= 2022) score += 1;

    // +1 if abstract is comprehensive (>200 chars)
    if (pub.abstract && pub.abstract.length > 200) score += 1;

    return { ...pub, relevanceScore: score, mentionsSupplement };
  });

  // Sort by score descending, then by year
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore || b.year - a.year);
  
  // CRITICAL: Check if supplement was requested but not found in top results
  if (supplement) {
    const supplementMentions = scored.filter(s => s.mentionsSupplement).length;
    if (supplementMentions === 0) {
      console.warn(`⚠️ LIMITED EVIDENCE: No papers mention "${supplement}" with "${disease}"`);
    }
  }
  
  // CRITICAL: If top score is low, data may be insufficient
  if (scored.length > 0 && scored[0].relevanceScore < 2) {
    console.warn(`⚠️ WARNING: Low relevance scores for "${disease}" - insufficient matching data`);
  }
  
  return scored;
}

function rankTrials(trials, query, disease, supplement = null) {
  const queryTerms = tokenize(query);
  const diseaseLower = (disease || '').toLowerCase();
  const supplementLower = (supplement || '').toLowerCase();

  // STRICT FILTER: Trials must be relevant to disease
  const filtered = trials.filter(trial => {
    const title = trial.title || '';
    const eligibility = trial.eligibility || '';
    const fullText = `${title} ${eligibility}`;
    
    // Reject low quality
    if (isLowQuality(fullText)) {
      return false;
    }
    
    // MUST be strictly relevant
    return isStrictlyRelevant(fullText, disease, query);
  });

  const scored = filtered.map(trial => {
    let score = 0;
    const titleLower = (trial.title || '').toLowerCase();
    const eligibilityLower = (trial.eligibility || '').toLowerCase();
    const fullText = `${titleLower} ${eligibilityLower}`;

    // CRITICAL: +5 if title contains disease
    if (diseaseLower && titleLower.includes(diseaseLower)) {
      score += 5;
    }

    // NEW: BONUS for supplement in trials
    if (supplementLower && fullText.includes(supplementLower)) {
      score += 8;
    }

    // +3 if eligibility mentions disease
    if (diseaseLower && eligibilityLower.includes(diseaseLower)) {
      score += 3;
    }

    // +2 for query terms in title
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        score += 2;
        break;
      }
    }

    // +3 for recruiting status (higher priority)
    if (trial.status === 'RECRUITING') score += 3;
    if (trial.status === 'ACTIVE_NOT_RECRUITING') score += 1;

    return { ...trial, relevanceScore: score };
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored;
}

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 3);
}

module.exports = { rankPublications, rankTrials };

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

module.exports = { rankPublications, rankTrials };
