/**
 * ollamaService.js
 * Uses OpenAI-compatible chat APIs (Groq/OpenRouter/OpenAI).
 */

const API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const RAW_BASE_URL = process.env.GROQ_URL || process.env.OPENAI_URL || process.env.OPENROUTER_URL || 'https://api.groq.com/openai/v1';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const BASE_HOST = BASE_URL.toLowerCase();
const PROVIDER = BASE_HOST.includes('openrouter') ? 'openrouter'
  : BASE_HOST.includes('groq.com') ? 'groq'
  : BASE_HOST.includes('openai.com') ? 'openai'
  : 'unknown';

const DEFAULT_MODELS = {
  openrouter: 'x-ai/grok-2',
  groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  unknown: 'llama-3.3-70b-versatile',
};

const FALLBACK_MODELS = {
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  openrouter: ['x-ai/grok-2', 'x-ai/grok-1'],
  openai: ['gpt-4o-mini'],
  unknown: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
};

const MODEL = process.env.GROQ_MODEL || process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_MODELS[PROVIDER];
const MODELS_PATH = PROVIDER === 'openrouter' ? '/v1/models' : PROVIDER === 'groq' ? '/models' : '/v1/models';
const CHAT_PATH = PROVIDER === 'openrouter' ? '/v1/chat/completions' : PROVIDER === 'groq' ? '/chat/completions' : '/v1/chat/completions';
const TIMEOUT_MS = 10000; // 10 seconds max

function hasApiKey() {
  return typeof API_KEY === 'string' && API_KEY.trim().length > 0;
}

async function isOllamaAvailable() {
  if (!hasApiKey()) {
    console.warn('No LLM API key configured');
    return false;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE_URL}${MODELS_PATH}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn('Models API failed:', res.status, res.statusText);
      return false;
    }
    const data = await res.json();
    const available = Array.isArray(data.data) && data.data.some(m => m.id === MODEL);
    console.log('LLM available:', available, 'models:', data.data?.length);
    return available;
  } catch (e) {
    console.warn('LLM availability check error:', e.message);
    return false;
  }
}

function parseChatResponse(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.trim();

  // OpenAI-style response
  if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
    const content = data.choices[0].message?.content;
    if (typeof content === 'string') return content.trim();
  }

  // OpenRouter/Groq-style response body fallback
  if (typeof data?.output === 'string') return data.output.trim();
  if (typeof data?.result === 'string') return data.result.trim();

  return null;
}

function getAlternateModel(requestModel, attemptedModels = new Set()) {
  const fallbackModels = FALLBACK_MODELS[PROVIDER] || FALLBACK_MODELS.unknown;
  return fallbackModels.find(model => model !== requestModel && !attemptedModels.has(model)) || null;
}

function citationForPaper(paper, index) {
  const firstAuthor = Array.isArray(paper.authors) && paper.authors.length > 0
    ? paper.authors[0]
    : 'Study';
  const year = paper.year || 'n.d.';
  const url = paper.url || paper.link || '';
  const label = `${firstAuthor}${Array.isArray(paper.authors) && paper.authors.length > 1 ? ' et al.' : ''}, ${year}`;
  return url ? `[P${index + 1}: ${label}](${url})` : `[P${index + 1}: ${label}]`;
}

function paperEvidenceBlock(papers, limit = 6, abstractLength = 650) {
  return papers.slice(0, limit)
    .map((p, i) => [
      `P${i + 1}. ${p.title || 'Untitled'} (${p.year || 'n.d.'})`,
      `Citation: ${citationForPaper(p, i)}`,
      `Type: ${p.paperType || 'unknown'}`,
      `Authors: ${Array.isArray(p.authors) ? p.authors.slice(0, 4).join(', ') : 'not listed'}`,
      `Finding/snippet: ${p.snippet || (p.abstract || '').substring(0, abstractLength) || 'No abstract available.'}`,
    ].join('\n'))
    .join('\n\n');
}

async function ollamaGenerate(prompt, opts = {}) {
  if (!hasApiKey()) {
    console.warn('No LLM API key available');
    return null;
  }

  const requestModel = opts.model || MODEL;
  const attemptedModels = new Set(opts.attemptedModels || []);
  attemptedModels.add(requestModel);
  console.log('LLM request:', { provider: PROVIDER, baseUrl: BASE_URL, model: requestModel, chatPath: CHAT_PATH });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT_MS * 2);
    const res = await fetch(`${BASE_URL}${CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: requestModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 400,
      }),
    });
    clearTimeout(t);

    if (!res.ok) {
      let errorText = '';
      try {
        errorText = await res.text();
      } catch (_) {
        errorText = 'Could not read error body';
      }
      console.warn('LLM generation failed:', res.status, res.statusText);
      console.warn('Error response body:', errorText);

      const modelMissing = errorText.toLowerCase().includes('model_not_found')
        || errorText.toLowerCase().includes('does not exist');
      const altModel = modelMissing ? getAlternateModel(requestModel, attemptedModels) : null;
      if (altModel) {
        console.log('Retrying with alternate LLM model:', altModel);
        return await ollamaGenerate(prompt, {
          ...opts,
          model: altModel,
          attemptedModels: [...attemptedModels],
          timeout: opts.timeout || TIMEOUT_MS * 2,
        });
      }

      return null;
    }

    const data = await res.json();
    const text = parseChatResponse(data);
    return text?.length > 20 ? text : null;
  } catch (e) {
    if (e.name === 'AbortError') console.warn('LLM timeout');
    else console.warn('LLM error:', e.message);
    return null;
  }
}

async function generateConditionOverviewLLM(disease, papers = []) {
  const refs = paperEvidenceBlock(papers, 4, 450);
  return ollamaGenerate(
    `You are a medical research assistant. Using only the publications below, write a concise evidence overview of "${disease}".\n\nRules:\n- Use specific findings from the papers, including numbers, endpoints, patient groups, or trial status when available.\n- Cite every study-specific claim with the provided Markdown citation, such as [P1: Author et al., 2026](url).\n- Avoid generic phrases like "some studies suggest", "more research is needed", "promising", or "further investigation" unless directly tied to a cited limitation.\n- Do not mention global publication counts or facts outside the provided papers.\n- 2 short paragraphs maximum.\n\nPublications:\n${refs || 'No publications available.'}\n\nEvidence overview:`,
    { maxTokens: 320, temperature: 0.2 }
  );
}

async function generateResearchInsightsLLM(disease, supplement, papers = [], query = '') {
  const abstracts = paperEvidenceBlock(papers, 6, 700);
  return ollamaGenerate(
    `You are a medical research assistant. Using only the publications below, produce paper-grounded insights about "${disease}"${supplement ? ' and "' + supplement + '"' : ''}.\n\nUser query: "${query}"\n\nRules:\n- Write 3-4 bullets only.\n- Start each bullet with a concrete paper finding, not a generic topic sentence.\n- Cite every bullet with the provided Markdown citation, such as [P2: Author et al., 2026](url).\n- Include study details when present: cohort size, hazard ratio, AUC, trial phase, status, endpoint, or safety signal.\n- Do not say "some studies suggest", "may be promising", "further research is needed", or "latest research shows" unless you immediately anchor it to a cited paper and concrete limitation.\n- Do not invent guideline claims, survival benefits, treatment effects, or publication counts.\n\nPublications:\n${abstracts || 'None.'}\n\nPaper-grounded insights:`,
    { maxTokens: 520, temperature: 0.2 }
  );
}

async function generateOverallInsightLLM(disease, papers = [], trials = []) {
  const rcts = papers.filter(p => /randomized|rct/i.test(`${p.title}${p.abstract}`)).length;
  const topTitle = papers[0]?.title || 'selected publications';
  const trialCount = trials.length;
  const refs = paperEvidenceBlock(papers, 3, 350);
  const trialRefs = trials.slice(0, 3)
    .map((t, i) => `T${i + 1}. ${t.title || 'Untitled'} (${t.status || 'status unknown'}), location: ${t.location || 'not specified'}, url: ${t.url || 'none'}`)
    .join('\n');
  return ollamaGenerate(
    `Summarize the selected evidence for "${disease}" in one tight paragraph.\n\nUse only these selected papers and trials. Do not mention global publication totals. Do not invent randomized trials beyond the selected set.\n\nSelected evidence counts: ${papers.length} publications, ${rcts} randomized/RCT-labeled publications, ${trialCount} clinical trials. Top selected paper: "${topTitle}".\n\nSelected publications:\n${refs || 'No publications available.'}\n\nSelected trials:\n${trialRefs || 'No trials available.'}\n\nRules:\n- Cite the main claim with a provided paper citation when possible.\n- Be specific and concrete.\n- Avoid generic phrases and broad hype.\n- Plain prose only.`,
    { maxTokens: 220, temperature: 0.2 }
  );
}

async function generateFollowUpAnswerLLM(query, disease, previousInsights = '', papers = [], trials = []) {
  const paperContext = paperEvidenceBlock(papers, 6, 750);
  const trialContext = trials.slice(0, 4)
    .map((t, i) => `[T${i + 1}] ${t.title || 'Untitled'} (${t.status || 'status unknown'})\nLocation: ${t.location || 'not specified'}\nEligibility: ${(t.eligibility || '').substring(0, 300)}`)
    .join('\n\n');
  const priorSummary = previousInsights.substring(0, 900);

  return ollamaGenerate(
    `You are a medical research assistant answering a follow-up question in an ongoing conversation.\n\nPrevious condition: "${disease}"\nFollow-up question: "${query}"\n\nRules:\n- Answer the follow-up directly first. Do not recap the previous answer.\n- Use the previous condition as the topic when the user says "this", "it", or "in this".\n- Use specific findings from the provided papers and cite them with the provided Markdown citations, such as [P2: Author et al., 2026](url).\n- If the papers do not directly study the follow-up topic, state that in the first sentence and cite the papers to show what they did study.\n- Avoid generic phrases like "some studies suggest", "further investigation is needed", "may be promising", or "more research is required". Prefer concrete wording: "This selected set does not include..."\n- For supplements or vitamins, separate: evidence in the selected papers, plausible supportive-care role, and safety/clinician guidance.\n- Do not invent study results, guideline claims, or dosing.\n\nPrior answer summary:\n${priorSummary || 'No prior summary available.'}\n\nPrevious publications:\n${paperContext || 'No publications available.'}\n\nPrevious clinical trials:\n${trialContext || 'No trials available.'}\n\nAnswer in 2-3 concise paragraphs. Do not start with a heading.`,
    { maxTokens: 520, temperature: 0.15 }
  );
}

module.exports = {
  isOllamaAvailable,
  generateConditionOverviewLLM,
  generateResearchInsightsLLM,
  generateOverallInsightLLM,
  generateFollowUpAnswerLLM,
};
