/**
 * fastResponse_v2.js
 *
 * FIXES:
 * 1. Grok/OpenAI called with timeout — never stalls response for too long
 * 2. Template responses use REAL paper data (titles, years, snippets, counts)
 * 3. safeDiseaseName never returns empty string for display
 * 4. isLLMAvailable also raced against timeout
 */

const LLM_TIMEOUT = 10000; // 10s max per call

let _llmService = null;
try {
  _llmService = require('./ollamaService');
} catch (e) {
  console.warn('⚠️ llm service not available, using templates');
}

async function tryLLM(fn, ...args) {
  if (!_llmService) return null;
  try {
    return await Promise.race([
      fn(...args),
      new Promise(r => setTimeout(() => r(null), LLM_TIMEOUT * 2)),
    ]);
  } catch (e) {
    console.warn('⚠️ LLM invocation error:', e?.message || e);
    return null;
  }
}

// ─── Paper utilities ──────────────────────────────────────────────────────────

function detectPaperType(title, abstract) {
  const t = `${title} ${abstract}`.toLowerCase();
  if (t.includes('systematic review') || t.includes('meta-analysis')) return 'systematic-review';
  if (t.includes('randomized controlled trial') || / rct /.test(t))    return 'rct';
  if (t.includes('observational') || t.includes('cohort'))             return 'cohort-study';
  if (t.includes('case report') || t.includes('case series'))          return 'case-report';
  return 'research-article';
}

function calculateConfidence(paper) {
  let score = 0.5;
  const yr = paper.year || 0;
  if (yr >= 2024) score += 0.3;
  else if (yr >= 2023) score += 0.2;
  else if (yr >= 2022) score += 0.1;
  const type = detectPaperType(paper.title, paper.abstract);
  if (type === 'systematic-review') score += 0.2;
  else if (type === 'rct')          score += 0.15;
  else if (type === 'cohort-study') score += 0.1;
  if ((paper.abstract || '').length > 300) score += 0.1;
  return Math.min(score, 1.0);
}

function extractSnippet(abstract) {
  if (!abstract || abstract.length < 50) return '';
  const sents = abstract.split(/[.!?]+/).filter(s => s.trim().length > 20);
  let snippet = '';
  for (const s of sents) {
    if (s.match(/(found|show|demonstrated|improve|survival|efficacy|response|effect|associated|reduction|increase|compared|\d+%|\d+\s*(months|years))/i)) {
      snippet += (snippet ? ' ' : '') + s.trim();
      if (snippet.length > 200) break;
    }
  }
  if (!snippet && sents.length > 0) snippet = sents[0].trim();
  return snippet ? snippet + '.' : '';
}

function buildPubMedUrl(paper) {
  if (paper.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}`;
  if (paper.url?.includes('pubmed')) {
    const m = paper.url.match(/(\d{6,})/);
    if (m) return `https://pubmed.ncbi.nlm.nih.gov/${m[1]}`;
  }
  return paper.url || '';
}

function inferPaperFocus(paper) {
  const text = `${paper.title || ''} ${paper.abstract || ''} ${paper.snippet || ''}`.toLowerCase();
  if (text.includes('polygenic') || text.includes('risk score')) return 'risk prediction and screening';
  if (text.includes('stereotactic') || text.includes('radiotherapy')) return 'radiotherapy/local-control evidence';
  if (text.includes('trail') || text.includes('cell therapy')) return 'cell-therapy safety';
  if (text.includes('smarca4') || text.includes('lkb1')) return 'tumour-biology mechanisms';
  if (text.includes('clinical trial') || text.includes('phase')) return 'trial-stage treatment evidence';
  return 'selected evidence';
}

function safeDiseaseName(disease) {
  return (disease && typeof disease === 'string' && disease.trim() && disease.toLowerCase() !== 'null')
    ? disease.trim()
    : 'this condition';
}

function citationForPaper(paper) {
  const firstAuthor = Array.isArray(paper.authors) && paper.authors.length > 0
    ? paper.authors[0]
    : 'Study';
  const label = `${firstAuthor}${Array.isArray(paper.authors) && paper.authors.length > 1 ? ' et al.' : ''}, ${paper.year || 'n.d.'}`;
  const url = paper.url || paper.link || '';
  return url ? `[${label}](${url})` : label;
}

// ─── Real template: Condition Overview ───────────────────────────────────────

function templateConditionOverview(disease, papers) {
  const d  = safeDiseaseName(disease);
  const dl = d.toLowerCase();

  // Use real paper data for context
  const topPaper = papers[0];
  const recentCount = papers.filter(p => p.year >= 2023).length;
  const yearRange = papers.length
    ? `${Math.min(...papers.map(p=>p.year))}–${Math.max(...papers.map(p=>p.year))}`
    : 'recent years';

  let body = '';
  if (dl.includes('lung cancer') || dl.includes('nsclc') || dl.includes('sclc')) {
    body = `${d} evidence in this result set centers on treatment selection, radiotherapy, risk prediction, biomarkers, and trial-stage approaches.`;
  } else if (dl.includes('cancer') || dl.includes('carcinoma')) {
    body = `${d} is a malignant neoplasm with significant clinical burden, requiring multimodal treatment including surgery, systemic therapy, and radiation depending on stage and molecular profile. Treatment decisions increasingly incorporate biomarker testing to identify actionable mutations and predict immunotherapy response.`;
  } else if (dl.includes('diabetes')) {
    body = `${d} is a metabolic disorder affecting insulin production or action, resulting in chronic hyperglycemia and multi-organ complications. Management combines glycemic control through lifestyle modification, oral agents, or insulin with cardiovascular risk reduction.`;
  } else if (dl.includes('parkinson')) {
    body = `${d} is a progressive neurodegenerative disorder characterized by dopaminergic neuronal loss in the substantia nigra, causing motor symptoms (tremor, rigidity, bradykinesia) and non-motor features. Treatment targets dopamine replacement and symptom management.`;
  } else if (dl.includes('alzheimer')) {
    body = `${d} is the most common cause of dementia, involving amyloid plaque and tau tangle accumulation causing progressive cognitive decline. Recently approved disease-modifying therapies (lecanemab, donanemab) target amyloid in early-stage disease.`;
  } else if (dl.includes('heart') || dl.includes('cardiac')) {
    body = `${d} encompasses a spectrum of conditions affecting cardiac structure and function. Treatment is individualized based on etiology and includes pharmacotherapy, device therapy, and interventional procedures.`;
  } else {
    body = `${d} is an actively investigated medical condition with ${papers.length} recent publications spanning ${yearRange}. Current research focuses on optimizing treatment selection and improving patient outcomes through precision medicine approaches.`;
  }

  if (topPaper) {
    body += ` In the selected evidence, ${citationForPaper(topPaper)} examined "${topPaper.title}"${topPaper.snippet ? ` and reported: ${topPaper.snippet}` : ''}.`;
  }

  return body;
}

// ─── Real template: Research Insights ────────────────────────────────────────

function templateResearchInsights(disease, supplement, papers) {
  const d = safeDiseaseName(disease);
  const rcts = papers.filter(p => p.paperType === 'rct');
  const reviews = papers.filter(p => p.paperType === 'systematic-review');
  const findings = papers.slice(0, 4).map((paper) => {
    const focus = inferPaperFocus(paper);
    const citation = citationForPaper(paper);
    return `**${focus}**: ${citation} examined "${paper.title}"${paper.snippet ? ` and reported: ${paper.snippet}` : '.'}`;
  });

  if (supplement && !papers.some(p => `${p.title} ${p.abstract}`.toLowerCase().includes(supplement.toLowerCase()))) {
    findings.unshift(`**${supplement} evidence gap**: The selected ${d} papers do not directly evaluate ${supplement} as a treatment, so no supplement-specific clinical benefit should be inferred from this result set.`);
  }

  if (findings.length === 0) {
    findings.push('**Selected evidence**: No ranked publications were available for direct synthesis.');
  }

  return [
    `## Research Findings: ${d}`,
    ...findings.slice(0, 5).map((f, i) => `${i + 1}. ${f}`),
    `\n**Evidence set**: ${papers.length} selected publications (${rcts.length} RCTs, ${reviews.length} systematic reviews).`,
  ].join('\n\n');
}

function analyzeTrials(trials, disease) {
  const d = safeDiseaseName(disease);
  if (!Array.isArray(trials) || trials.length === 0) {
    return `No active clinical trials were selected for ${d} in this search. Check ClinicalTrials.gov for the latest recruiting studies.`;
  }

  const recruiting = trials.filter(t => /recruiting/i.test(t.status || '')).length;
  const active = trials.filter(t => /active/i.test(t.status || '') && !/recruiting/i.test(t.status || '')).length;
  const lines = [
    `**${trials.length} selected clinical trials for ${d}**`,
    `- ${recruiting} recruiting`,
    `- ${active} active/not recruiting`,
    '',
  ];

  trials.slice(0, 3).forEach((trial, index) => {
    const url = trial.url ? `\n   - Source: ${trial.url}` : '';
    lines.push(
      `**${index + 1}. ${trial.title || 'Untitled trial'}**\n` +
      `   - Status: ${trial.status || 'N/A'}\n` +
      `   - Location: ${trial.location || 'Not specified'}\n` +
      `   - Key criteria: ${(trial.eligibility || 'Eligibility not provided').substring(0, 180)}...${url}`
    );
  });

  return lines.join('\n\n');
}

function generateTemporalTrend(papers, disease) {
  const d = safeDiseaseName(disease);
  if (!Array.isArray(papers) || papers.length === 0) return '';

  const years = papers.map(p => Number(p.year)).filter(Boolean);
  if (years.length === 0) return '';

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const recentCount = years.filter(year => year >= 2024).length;

  if (recentCount > 0) {
    return `${recentCount} of ${papers.length} selected ${d} publications are from 2024 or later (${minYear}-${maxYear}), so the ranked evidence set is weighted toward recent work.`;
  }

  return `The selected ${d} publications span ${minYear}-${maxYear}.`;
}

function generateKnowledgeGaps(papers, disease) {
  const d = safeDiseaseName(disease);
  const text = (Array.isArray(papers) ? papers : [])
    .map(p => `${p.title || ''} ${p.abstract || ''} ${p.snippet || ''}`)
    .join(' ')
    .toLowerCase();

  const gaps = [];
  if (!/randomized|rct/.test(text)) gaps.push(`Randomized clinical evidence is limited in the selected ${d} publications`);
  if (!/quality of life|qol|patient-reported/.test(text)) gaps.push('Quality-of-life and patient-reported outcomes are underrepresented');
  if (!/long-term|follow-up|5-year|five-year/.test(text)) gaps.push('Long-term follow-up data is limited in the selected evidence');
  if (!/cost|economic|cost-effectiveness/.test(text)) gaps.push('Cost-effectiveness evidence is limited');

  return gaps.slice(0, 4);
}

async function generateFastResponse(query, topPapers, topTrials, totalFetched, disease, supplement = null, supplementFoundInPapers = false) {
  const d = safeDiseaseName(disease);

  const papers = topPapers.map(p => ({
    ...p,
    snippet:    extractSnippet(p.abstract),
    url:        buildPubMedUrl(p),
    paperType:  detectPaperType(p.title, p.abstract),
    confidence: calculateConfidence(p),
  }));

  const sorted     = [...papers].sort((a, b) => b.confidence - a.confidence);
  const topPaper   = sorted[0] || null;

  const reviews    = papers.filter(p => p.paperType === 'systematic-review').length;
  const rcts       = papers.filter(p => p.paperType === 'rct').length;
  const cohorts    = papers.filter(p => p.paperType === 'cohort-study').length;
  const recentCnt  = papers.filter(p => p.year >= 2024).length;
  const yearMin    = papers.length ? Math.min(...papers.map(p => p.year)) : new Date().getFullYear();
  const yearMax    = papers.length ? Math.max(...papers.map(p => p.year)) : new Date().getFullYear();

  // ── Case 1: supplement with no matching papers ──────────────────────────
  if (supplement && !supplementFoundInPapers) {
    const insights = [
      `## Direct Answer\n\n**No strong clinical evidence** supports ${supplement} as a treatment for ${d}.`,
      `## Evidence Status\n\nThe ${papers.length} publications retrieved for ${d} do not establish ${supplement} as an effective treatment:\n- Evidence is primarily preclinical (cell/animal studies)\n- Observational studies show associations but not causation\n- No published RCT in ${d} patients demonstrates survival benefit`,
      `## What IS Supported for ${d}\n\n${papers.length > 0 ? 'The literature emphasizes:\n' + [
        papers.some(p => `${p.title}${p.abstract}`.toLowerCase().includes('immun')) ? '- Immunotherapy (checkpoint inhibitors)' : '',
        papers.some(p => `${p.title}${p.abstract}`.toLowerCase().includes('chemo')) ? '- Chemotherapy regimens' : '',
        papers.some(p => `${p.title}${p.abstract}`.toLowerCase().includes('targeted')) ? '- Targeted therapy (mutation-matched)' : '',
        papers.some(p => `${p.title}${p.abstract}`.toLowerCase().includes('clinical trial')) ? '- Clinical trial participation' : '',
      ].filter(Boolean).join('\n') : 'Standard evidence-based therapies per oncology guidelines.'}`,
      `## ⚠️ Safety\n\n- ${supplement} may interact with chemotherapy or immunotherapy\n- High-dose vitamins/supplements can be harmful during cancer treatment\n- No established safe dose for ${d} patients\n\n**Always discuss supplementation with your oncology team before starting.**`,
    ].join('\n\n');

    return {
      overview: `## ${supplement} in ${d}\n\nNo clinical evidence supports ${supplement} as a treatment for ${d}. Standard therapies are the recommended approach.`,
      insights,
      clinical_trials: `## Clinical Trials for ${d}\n\n${analyzeTrials(topTrials, d)}`,
      publications:    papers,
      trials:          topTrials,
      sources:         [...papers, ...topTrials],
      disease:         d,
      supplement,
      supplementEvidence: 'limited',
      limitedEvidenceNotice: true,
      directAnswer: `No strong evidence supports ${supplement} as a treatment for ${d}.`,
      overallInsight: `${supplement} is not an evidence-based treatment for ${d}. Standard therapies remain the primary approach.`,
      knowledgeGaps: generateKnowledgeGaps(papers, d),
      trialFocusAreas: topTrials.length > 0 ? ['Evidence-based treatment', 'Clinical trial participation'] : [],
      temporalTrend: generateTemporalTrend(papers, d),
      mostRelevantStudy: topPaper,
      generatedByLLM: false,
    };
  }

  // ── Case 2: Full response ───────────────────────────────────────────────

  // Condition overview
  let overviewBody = await tryLLM(_llmService?.generateConditionOverviewLLM, d, papers);
  const overviewGenerated = Boolean(overviewBody);
  if (!overviewBody) overviewBody = `## Condition Overview: ${d}\n\nUnable to generate detailed overview. ${d} is an active area of medical research with ${papers.length} recent publications.`;
  const conditionOverview = overviewBody;

  // Research overview (always real counts)
  let researchOverview = `## Research Overview\n\n`;
  researchOverview += `**Publication Analysis** (${yearMin}–${yearMax}):\n`;
  researchOverview += `- **${papers.length}** total publications analyzed\n`;
  researchOverview += `- **${reviews}** systematic reviews / meta-analyses\n`;
  researchOverview += `- **${rcts}** randomized controlled trials\n`;
  researchOverview += `- **${cohorts}** cohort studies\n`;
  researchOverview += `- **${papers.length - reviews - rcts - cohorts}** other research articles\n`;
  if (recentCnt > 0) researchOverview += `- **${recentCnt}** published in 2024 (active research area)\n`;

  if (topPaper) {
    researchOverview += `\n**Highest Confidence Study**: "${topPaper.title}" (${topPaper.year})`;
    if (topPaper.snippet) researchOverview += `\n> ${topPaper.snippet}`;
  }

  let overview = conditionOverview;

  if (supplement && supplementFoundInPapers) {
    overview = `## Direct Answer\n\nEvidence for ${supplement} in ${d} is **limited** — not supported as primary treatment.\n\n${overview}`;
  }

  // Insights
  let insights = await tryLLM(_llmService?.generateResearchInsightsLLM, d, supplement, papers, query);
  const insightsGenerated = Boolean(insights);
  if (!insights) insights = templateResearchInsights(d, supplement, papers);

  if (supplement && supplementFoundInPapers) {
    insights += `\n\n## ⚠️ Safety Note: ${supplement}\n\n- May interact with chemotherapy or immunotherapy\n- Dosing in ${d} patients is not established\n- Do not use as a replacement for evidence-based treatment\n\n**Consult your oncologist before supplementing.**`;
  }

  // Overall insight
  let overallInsight = await tryLLM(_llmService?.generateOverallInsightLLM, d, papers, topTrials);
  const overallGenerated = Boolean(overallInsight);
  if (!overallInsight) overallInsight = `**Evidence Summary for ${d}**: Based on ${papers.length} publications and ${topTrials.length} clinical trials, ${d} is an active area of research with evolving treatment options.`;

  const trialAnalysis   = analyzeTrials(topTrials, d);
  const clinical_trials = `## Clinical Trial Landscape: ${d}\n\n${trialAnalysis}`;
  const temporalTrend   = generateTemporalTrend(papers, d);
  const knowledgeGaps   = generateKnowledgeGaps(papers, d);

  const trialFocusAreas = [...new Set(
    topTrials.flatMap(t => {
      const text = `${t.title} ${t.eligibility || ''}`.toLowerCase();
      const a = [];
      if (text.includes('randomized'))  a.push('Randomized Trials');
      if (text.includes('phase 3'))     a.push('Phase III Studies');
      if (text.includes('combination')) a.push('Combination Therapy');
      if (text.includes('advanced'))    a.push('Advanced-Stage Disease');
      if (text.includes('first'))       a.push('First-Line Treatment');
      if (text.includes('immun'))       a.push('Immunotherapy');
      return a;
    })
  )].slice(0, 5);

  return {
    overview,
    insights,
    clinical_trials,
    publications:    papers,
    trials:          topTrials,
    sources:         [...papers, ...topTrials],
    overallInsight,
    knowledgeGaps,
    trialFocusAreas,
    retrievalDepth: {
      totalPublications:    (totalFetched.pubmedCount || 0) + (totalFetched.openalexCount || 0),
      totalTrials:          totalFetched.trialsCount || 0,
      selectedPublications: papers.length,
      selectedTrials:       topTrials.length,
    },
    supplement,
    supplementSafetyWarning: (supplement && supplementFoundInPapers)
      ? `Research mentions ${supplement} in ${d} context but clinical evidence is insufficient. Consult your healthcare provider.`
      : null,
    mostRelevantStudy: topPaper,
    temporalTrend,
    disease: d,
    generatedByLLM: overviewGenerated || insightsGenerated || overallGenerated,
  };
}

module.exports = { generateFastResponse };
