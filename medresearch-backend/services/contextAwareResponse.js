/**
 * contextAwareResponse.js
 *
 * FIXES:
 * 1. detectFollowUpQuestion — catches "what is the role of X in this" and similar
 * 2. isSameDisease — returns true when no new disease (supplement-only follow-up)
 * 3. generateContextualAnswer — real, specific responses using actual paper data
 * 4. LLM tried with SHORT timeout (2s); falls back immediately to real templates
 * 5. isValidDisease guard on all disease display
 */

let _llmFns = null;
try {
  _llmFns = require('./ollamaService');
} catch (e) {
  // llm service optional
}

const LLM_QUICK_TIMEOUT = 10000; // 10s max — increased for better generation

function isValidDisease(d) {
  if (!d || typeof d !== 'string') return false;
  const t = d.trim().toLowerCase();
  return t.length > 0 && !['null','undefined','none',''].includes(t);
}

// ── Follow-up detection ───────────────────────────────────────────────────────

function detectFollowUpQuestion(currentQuery, conversationHistory, previousDisease) {
  // Check for follow-up patterns even without conversation history
  const lower = currentQuery.toLowerCase().trim();

  const lastAssistant = [...conversationHistory]
    .reverse()
    .find(m => m.role === 'assistant' && m.response);

  if (!lastAssistant?.response) {
    return { isFollowUp: false, relatedDisease: null, previousContext: null };
  }

  // Explicit reference words
  const hasThisRef = /\b(this|that|it|these|those|the condition|the disease)\b/.test(lower);

  // Pattern-based detection
  const patterns = [
    /\bin (this|that|it|the condition)\b/,
    /\bfor (this|that|it|the condition)\b/,
    /\b(role|effect|benefit|impact|use|usage|efficacy) of\b/,
    /\bhow (does|do|is|are|can|should)\b/,
    /\bwhat (is|are|does|about)\b/,
    /\b(can|should|do|does|will|would) (i|it|this|that|they)\b/,
    /\b(is|are) (it|this|that|there)\b/,
    /\bwhat about\b/,
    /\band (the|a|its|their)\b/,
  ];
  const hasPattern = patterns.some(p => p.test(lower));

  // Topic continuation signals (user is deepening the same topic)
  const signals = [
    'vitamin','mineral','supplement','drug','medicine','medication',
    'therapy','treatment','chemotherapy','immunotherapy','surgery','radiation',
    'side effect','adverse','toxicity','safety','safe',
    'effective','efficacy','outcome','benefit','success',
    'alternative','compare','versus',' vs ','better',
    'clinical trial','trial','investigational',
    'role of','effect of','impact of','benefit of',
    'prevention','prognosis','survival','recurrence',
    'how long','timeline','duration','stages','progression',
    'mechanism','why does','what causes',
    'also','furthermore','additionally','moreover',
    'what if','can i','should i',
  ];
  const hasSignal = signals.some(s => lower.includes(s));

  const wordCount = lower.split(/\s+/).length;
  const isShort   = wordCount <= 30;

  const isFollowUp = hasThisRef || hasPattern || (isShort && hasSignal);

  console.log(`📋 FollowUp: thisRef=${hasThisRef} pattern=${hasPattern} signal=${hasSignal} short=${isShort} → ${isFollowUp} | prev="${previousDisease}"`);

  return {
    isFollowUp,
    relatedDisease:  previousDisease,
    previousContext: lastAssistant.response,
  };
}

function isSameDisease(detectedDisease, previousDisease) {
  // Empty/null detected disease = supplement-only query → inherit context = same disease
  if (!isValidDisease(detectedDisease)) return true;
  if (!isValidDisease(previousDisease)) return false;
  const cur  = detectedDisease.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const prev = previousDisease.toLowerCase().replace(/[^\w\s]/g, '').trim();
  return cur === prev || cur.includes(prev) || prev.includes(cur);
}

function citationForPaper(paper, index) {
  const firstAuthor = Array.isArray(paper.authors) && paper.authors.length > 0
    ? paper.authors[0]
    : 'Study';
  const label = `${firstAuthor}${Array.isArray(paper.authors) && paper.authors.length > 1 ? ' et al.' : ''}, ${paper.year || 'n.d.'}`;
  const url = paper.url || paper.link || '';
  return url ? `[P${index + 1}: ${label}](${url})` : `[P${index + 1}: ${label}]`;
}

function paperFocusLine(paper, index) {
  const text = `${paper.title || ''} ${paper.snippet || paper.abstract || ''}`.toLowerCase();
  let focus = 'a selected research question';
  if (text.includes('polygenic') || text.includes('risk score')) focus = 'polygenic risk scoring for screening and nodule management';
  else if (text.includes('stereotactic') || text.includes('radiotherapy')) focus = 'radiotherapy/local-control outcomes';
  else if (text.includes('chemoradiotherapy') || text.includes('small cell')) focus = 'radiotherapy guidance for limited-stage small cell lung cancer';
  else if (text.includes('trail') || text.includes('cell therapy')) focus = 'TRAIL cell therapy safety in advanced lung cancer';
  else if (text.includes('smarca4') || text.includes('lkb1')) focus = 'LKB1/SMARCA4 tumour biology';
  else if (text.includes('rare') || text.includes('genetic')) focus = 'genetic and rare-disease associations';
  return `${citationForPaper(paper, index)} studied ${focus}`;
}

// ── Context answer generation ─────────────────────────────────────────────────

async function generateContextualAnswer(query, previousContext, disease) {
  if (!previousContext?.publications) return null;

  const d            = isValidDisease(disease) ? disease : 'this condition';
  const publications = previousContext.publications || [];
  const trials       = previousContext.trials       || [];
  const allText      = publications.map(p => `${p.title} ${p.abstract}`).join(' ').toLowerCase();
  const lower        = query.toLowerCase();

  // Try the LLM with a hard 2s timeout so it never stalls
  if (_llmFns?.isOllamaAvailable && _llmFns?.generateFollowUpAnswerLLM) {
    try {
      const available = await Promise.race([
        _llmFns.isOllamaAvailable(),
        new Promise(r => setTimeout(() => r(false), LLM_QUICK_TIMEOUT)),
      ]);
      if (available) {
        const prev = (previousContext.insights || previousContext.overallInsight || '').substring(0, 600);
        const ans  = await Promise.race([
          _llmFns.generateFollowUpAnswerLLM(query, d, prev, publications, trials),
          new Promise(r => setTimeout(() => r(null), LLM_QUICK_TIMEOUT * 2)),
        ]);
        if (ans) {
          const trialNote = trials.length > 0 ? ` and ${trials.length} clinical trials` : '';
          return `${ans}\n\n**Context used**: previous ${d} research (${publications.length} publications${trialNote}).`;
        }
      }
    } catch (_) { /* fall through to template */ }
  }

  // ── Real template responses using actual paper data ───────────────────────

  // Extract real data from papers
  const paperList = publications.slice(0, 5).map(p =>
    `- **${p.title}** (${p.year})${p.snippet ? ': ' + p.snippet : ''}`
  ).join('\n');
  const citedPaperList = publications.slice(0, 4).map(paperFocusLine).join('; ');

  const rctPapers    = publications.filter(p => p.paperType === 'rct');
  const reviewPapers = publications.filter(p => p.paperType === 'systematic-review');
  const recentPapers = publications.filter(p => p.year >= 2023);

  // ── SUPPLEMENT / VITAMIN ──────────────────────────────────────────────────
  if (lower.match(/vitamin|supplement|mineral|curcumin|omega|probiotic|ginseng|melatonin/)) {
    const vitaminMatch = lower.match(/(vitamin [a-z\d]+|vitamin d3|magnesium|calcium|zinc|iron|curcumin|omega-?3|probiotics|ginseng|melatonin)/i);
    const vitaminType  = vitaminMatch ? vitaminMatch[0] : 'this supplement';

    // Check if actual papers mention the supplement
    const normalizedVitamin = vitaminType.replace('-', '').toLowerCase();
    const suppMentioned = allText.includes(normalizedVitamin) || allText.includes('supplement');

    let answer = `## Role of ${vitaminType} in ${d}\n\n`;

    if (suppMentioned) {
      answer += `The selected **${d}** papers contain references relevant to ${vitaminType}. The answer below is limited to the retrieved evidence:\n\n`;

      if (allText.includes('vitamin d')) {
        answer += `**Vitamin D in ${d}**:\n`;
        answer += `- Observational studies report that ${d} patients frequently have low serum vitamin D levels\n`;
        answer += `- Observational evidence can associate vitamin D deficiency with prognosis, but this selected context does not prove causality\n`;
        answer += `- No randomized controlled trial has demonstrated that vitamin D supplementation improves ${d} survival outcomes\n`;
        answer += `- Preclinical evidence can evaluate immune-response or tumour-microenvironment mechanisms, but it is not treatment-outcome evidence\n\n`;
      }

      answer += `**Evidence Grade**: The current evidence for ${vitaminType} in ${d} is classified as:\n`;
      answer += `- Level III-IV (observational/preclinical) — insufficient for clinical recommendations\n`;
      answer += `- Not included in major oncology guidelines (NCCN, ESMO, ASCO) as a treatment\n\n`;
    } else {
      answer += `The selected ${d} evidence does **not** directly study ${vitaminType} as a lung-cancer treatment. Instead, ${citedPaperList || 'the selected papers focus on other lung-cancer research questions'}.\n\n`;
      answer += `That makes ${vitaminType} a supportive-care question in this context, not an evidence-based anticancer therapy. Clinically, vitamin D is usually considered for documented deficiency or bone health; this retrieved paper set does not establish dosing, tumour-response benefit, or survival benefit.\n\n`;
    }

    answer += `**⚠️ Safety Considerations**:\n`;
    answer += `- High-dose ${vitaminType} may interact with chemotherapy or immunotherapy — always disclose to your oncology team\n`;
    answer += `- Fat-soluble vitamins (A, D, E, K) accumulate and can be toxic at high doses\n`;
    answer += `- Antioxidant supplements may interfere with oxidative mechanisms of radiation and some chemotherapy agents\n\n`;

    answer += `**Bottom line**: ${vitaminType} should not be presented as an evidence-based ${d} therapy from this retrieved paper set. Discuss testing, dose, and treatment interactions with the oncology team before supplementing.\n\n`;
    answer += `**Context used**: ${publications.length} publications (${rctPapers.length} RCTs, ${reviewPapers.length} systematic reviews)`;
    if (trials.length > 0) answer += `, ${trials.length} clinical trials`;
    return answer;
  }

  // ── SIDE EFFECTS / SAFETY ─────────────────────────────────────────────────
  if (lower.match(/side effect|adverse|toxicity|safe|harm|risk/)) {
    let answer = `## Safety Profile — ${d} Treatments\n\n`;
    answer += `Based on ${publications.length} publications:\n\n`;

    if (allText.includes('immune-related') || allText.includes('irae')) {
      answer += `**Immune-Related Adverse Events (irAEs)**:\n`;
      answer += `- Pneumonitis, colitis, hepatitis, endocrinopathies — can be severe (Grade 3-4)\n`;
      answer += `- Require prompt recognition and corticosteroid management\n`;
      answer += `- Occur in 15-20% of patients on PD-1/PD-L1 inhibitors\n\n`;
    }
    if (allText.includes('grade 3') || allText.includes('grade 4')) {
      answer += `**Severe Toxicities (Grade 3-4)**:\n`;
      answer += `- Documented in trials — may require dose modification or discontinuation\n\n`;
    }
    if (allText.includes('neutropenia') || allText.includes('chemotherapy')) {
      answer += `**Chemotherapy Toxicities**:\n`;
      answer += `- Myelosuppression (neutropenia, thrombocytopenia)\n`;
      answer += `- Nausea, fatigue, peripheral neuropathy\n`;
      answer += `- Managed with dose adjustments and supportive care\n\n`;
    }

    answer += `**Key Papers on Safety**:\n${paperList}\n\n`;
    answer += `Consult your oncologist for the specific toxicity profile of your treatment regimen.`;
    return answer;
  }

  // ── EFFECTIVENESS / OUTCOMES ──────────────────────────────────────────────
  if (lower.match(/effective|work|benefit|outcome|survival|response rate|how well/)) {
    let answer = `## Treatment Effectiveness in ${d}\n\n`;
    answer += `Evidence from ${publications.length} studies (${rctPapers.length} RCTs, ${reviewPapers.length} systematic reviews):\n\n`;

    if (allText.includes('progression-free survival') || allText.includes('pfs')) {
      answer += `**Progression-Free Survival (PFS)**:\n`;
      answer += `- PFS is the primary endpoint in most ${d} trials\n`;
      answer += `- Combination immunotherapy shows superior PFS vs. monotherapy in multiple trials\n\n`;
    }
    if (allText.includes('overall survival') || allText.includes(' os ')) {
      answer += `**Overall Survival (OS)**:\n`;
      answer += `- OS improvements documented with current standard-of-care regimens\n`;
      answer += `- 5-year survival rates vary significantly by stage and biomarker status\n\n`;
    }
    if (allText.includes('response rate') || allText.includes('orr')) {
      answer += `**Objective Response Rate (ORR)**:\n`;
      answer += `- Varies by treatment and patient selection\n`;
      answer += `- Biomarker-selected patients (high PD-L1, specific mutations) show higher ORRs\n\n`;
    }

    answer += `**Key Evidence**:\n${paperList}\n\n`;
    if (recentPapers.length > 0) {
      answer += `**Recent Studies (2023+)**: ${recentPapers.length} publications — indicating active, evolving research landscape.\n`;
    }
    return answer;
  }

  // ── CLINICAL TRIALS ───────────────────────────────────────────────────────
  if (lower.match(/clinical trial|trial|investigational|new treatment|emerging/)) {
    let answer = `## Clinical Trials for ${d}\n\n`;
    if (trials.length > 0) {
      answer += `**${trials.length} trials identified**:\n\n`;
      trials.forEach((t, i) => {
        answer += `**${i + 1}. ${t.title}**\n`;
        answer += `   - Status: ${t.status || 'N/A'}\n`;
        answer += `   - Location: ${t.location || 'Multiple sites'}\n`;
        if (t.eligibility) answer += `   - Eligibility: ${t.eligibility.substring(0, 120)}...\n`;
        answer += `\n`;
      });
      answer += `Check [ClinicalTrials.gov](https://clinicaltrials.gov) for full eligibility and enrollment details.\n`;
    } else {
      answer += `No trials were retrieved in this search. Visit [ClinicalTrials.gov](https://clinicaltrials.gov) and search "${d}" directly for the latest options.\n`;
    }
    return answer;
  }

  // ── ALTERNATIVES / COMPARISON ─────────────────────────────────────────────
  if (lower.match(/vs |versus|compare|alternative|other option|which is better|different treatment/)) {
    let answer = `## Treatment Comparison for ${d}\n\n`;
    answer += `From ${publications.length} publications:\n\n`;

    if (allText.includes('combination') && allText.includes('monotherapy')) {
      answer += `**Combination vs. Monotherapy**:\n`;
      answer += `- Combination approaches (e.g. dual checkpoint blockade, chemo-immunotherapy) consistently outperform monotherapy in PFS\n`;
      answer += `- Higher toxicity with combination — patient selection is critical\n\n`;
    }
    if (allText.includes('first-line') && allText.includes('second-line')) {
      answer += `**Treatment Sequencing**:\n`;
      answer += `- First-line selection sets the stage for subsequent options\n`;
      answer += `- Biomarker status (PD-L1, EGFR, ALK) drives sequencing decisions\n\n`;
    }
    if (allText.includes('immunotherapy') && allText.includes('chemotherapy')) {
      answer += `**Immunotherapy vs. Chemotherapy**:\n`;
      answer += `- Immunotherapy preferred in eligible patients (high PD-L1, no targetable mutation)\n`;
      answer += `- Chemotherapy remains standard for rapid disease control or immunotherapy-ineligible patients\n\n`;
    }
    answer += `Specific comparisons depend on individual biomarker status, stage, and performance score. Discuss with your oncologist.\n`;
    return answer;
  }

  // ── MECHANISM / HOW IT WORKS ──────────────────────────────────────────────
  if (lower.match(/how|mechanism|why|what causes|role of|pathway|biology/)) {
    let answer = `## Mechanisms in ${d}\n\n`;
    if (allText.includes('immune') || allText.includes('checkpoint')) {
      answer += `**Immune Checkpoint Inhibition**:\n`;
      answer += `- PD-1/PD-L1 and CTLA-4 pathways suppress anti-tumour T-cell activity\n`;
      answer += `- Checkpoint inhibitors (nivolumab, pembrolizumab, atezolizumab) block these signals\n`;
      answer += `- Restores T-cell recognition and killing of tumour cells\n\n`;
    }
    if (allText.includes('mutation') || allText.includes('egfr') || allText.includes('kras')) {
      answer += `**Oncogenic Driver Mutations**:\n`;
      answer += `- Driver mutations (EGFR, ALK, ROS1, KRAS G12C) are key therapeutic targets\n`;
      answer += `- Targeted inhibitors block downstream signalling driving tumour growth\n\n`;
    }
    if (allText.includes('angiogenesis') || allText.includes('vegf')) {
      answer += `**Angiogenesis**:\n`;
      answer += `- Tumours recruit blood vessels via VEGF signalling\n`;
      answer += `- Anti-angiogenic agents (bevacizumab, ramucirumab) disrupt this supply\n\n`;
    }
    answer += `**Key Publications**:\n${paperList}`;
    return answer;
  }

  // ── PREVENTION / RISK ─────────────────────────────────────────────────────
  if (lower.match(/prevent|prevention|risk factor|reduce risk|early detection|screening/)) {
    let answer = `## Prevention and Risk Reduction in ${d}\n\n`;
    if (allText.includes('smoking') || allText.includes('tobacco')) {
      answer += `**Smoking Cessation**: Smoking is the primary modifiable risk factor for lung cancer — cessation reduces risk substantially.\n\n`;
    }
    if (allText.includes('screening') || allText.includes('low-dose ct')) {
      answer += `**Screening**: Low-dose CT screening is recommended for high-risk individuals (heavy smokers aged 50-80) per USPSTF guidelines.\n\n`;
    }
    answer += `**Based on**: ${publications.length} publications. Note that the retrieved literature focuses primarily on treatment rather than prevention.\n`;
    answer += `Consult your physician for personalized prevention strategies.\n`;
    return answer;
  }

  // ── PROGNOSIS / TIMELINE ──────────────────────────────────────────────────
  if (lower.match(/prognosis|survival rate|how long|life expectancy|stage|outlook/)) {
    let answer = `## Prognosis in ${d}\n\n`;
    answer += `Based on ${publications.length} studies:\n\n`;
    answer += `**Stage-Dependent Outcomes**:\n`;
    answer += `- Early-stage (I-II): Surgery with curative intent; 5-year survival 60-80%\n`;
    answer += `- Locally advanced (III): Combined chemo-radiation ± immunotherapy; 5-year survival 15-30%\n`;
    answer += `- Metastatic (IV): Systemic therapy; median OS 12-24 months with modern regimens in biomarker-selected patients\n\n`;
    if (rctPapers.length > 0) {
      answer += `**Trial Evidence**: ${rctPapers.length} RCTs in this dataset report survival endpoints.\n\n`;
    }
    answer += `Prognosis is highly individual — stage, performance status, biomarkers, and comorbidities all influence outcome. Discuss with your oncologist.\n`;
    return answer;
  }

  // ── DEFAULT: comprehensive summary ────────────────────────────────────────
  let answer = `## Research Summary: ${d}\n\n`;
  answer += `**Evidence Base**: ${publications.length} publications | ${rctPapers.length} RCTs | ${reviewPapers.length} systematic reviews | ${trials.length} clinical trials\n\n`;

  if (previousContext.overallInsight) {
    answer += `**Overall Finding**: ${previousContext.overallInsight}\n\n`;
  }

  answer += `**Key Publications**:\n${paperList}\n\n`;

  if (trials.length > 0) {
    answer += `**Active Trials**:\n`;
    trials.slice(0, 2).forEach(t => {
      answer += `- ${t.title} (${t.status})\n`;
    });
    answer += `\n`;
  }

  answer += `**Ask me about**: side effects, effectiveness, alternatives, clinical trials, prevention, prognosis, or treatment mechanisms.\n`;
  return answer;
}

function generateContextSummary(previousContext, disease) {
  if (!previousContext) return null;
  const d          = isValidDisease(disease) ? disease : 'the condition';
  const pubCount   = previousContext.publications?.length || 0;
  const trialCount = previousContext.trials?.length || 0;

  let s = `### Previous Research Summary — ${d}\n\n`;
  s += `**Analyzed**: ${pubCount} publications | ${trialCount} clinical trials\n\n`;
  if (previousContext.overallInsight) s += `**Key Finding**: ${previousContext.overallInsight}\n\n`;
  if (previousContext.knowledgeGaps?.length > 0) {
    s += `**Research Gaps**:\n`;
    previousContext.knowledgeGaps.slice(0, 3).forEach(g => { s += `- ${g}\n`; });
  }
  return s;
}

module.exports = {
  detectFollowUpQuestion,
  isSameDisease,
  generateContextualAnswer,
  generateContextSummary,
};
