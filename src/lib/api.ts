import type { UserContext, ResearchResponse, Publication, ClinicalTrial } from '@/types/research';

const DEFAULT_API_BASE = 'https://curalink-med.onrender.com/api';

function getApiBase(): string {
  const configuredApiBase = import.meta.env.VITE_API_URL?.trim();
  const isLocalBackend =
    configuredApiBase?.includes('localhost') ||
    configuredApiBase?.includes('127.0.0.1');

  if (!configuredApiBase || (import.meta.env.PROD && isLocalBackend)) {
    return DEFAULT_API_BASE;
  }

  return configuredApiBase.replace(/\/$/, '');
}

const API_BASE = getApiBase();

export async function sendQuery(
  query: string,
  context?: UserContext,
  conversationId?: string
): Promise<ResearchResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, context, conversationId }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

// Demo mode - simulates API response for frontend development
export function getDemoResponse(query: string, context?: UserContext): ResearchResponse {
  const disease = context?.disease || extractDisease(query);
  
  const publications: Publication[] = [
    {
      title: `Advances in ${disease} Treatment: A Comprehensive Review`,
      abstract: `This review examines recent advances in the treatment of ${disease}, focusing on novel therapeutic approaches and their clinical outcomes. We analyzed data from 45 clinical studies conducted between 2020-2024.`,
      authors: ['Smith J', 'Chen L', 'Williams R'],
      year: 2024,
      source: 'PubMed',
      url: 'https://pubmed.ncbi.nlm.nih.gov/example1',
      relevanceScore: 0.95,
    },
    {
      title: `Immunotherapy Approaches for ${disease}: Current State and Future Directions`,
      abstract: `Immunotherapy has emerged as a promising treatment modality for ${disease}. This paper reviews the latest immunotherapy strategies, including checkpoint inhibitors and CAR-T cell therapy.`,
      authors: ['Johnson M', 'Patel S', 'Lee K'],
      year: 2024,
      source: 'PubMed',
      url: 'https://pubmed.ncbi.nlm.nih.gov/example2',
      relevanceScore: 0.91,
    },
    {
      title: `Machine Learning in ${disease} Diagnosis and Prognosis`,
      abstract: `We present a deep learning framework for early detection and prognosis prediction in ${disease} patients, achieving 94% accuracy on validation datasets.`,
      authors: ['Zhang W', 'Brown A', 'Garcia M'],
      year: 2023,
      source: 'OpenAlex',
      url: 'https://openalex.org/example1',
      relevanceScore: 0.87,
    },
    {
      title: `Genomic Biomarkers for ${disease}: A Systematic Review`,
      abstract: `This systematic review identifies key genomic biomarkers associated with ${disease} susceptibility and treatment response across 128 genome-wide association studies.`,
      authors: ['Kim H', 'Nakamura T', 'Davis R'],
      year: 2023,
      source: 'PubMed',
      url: 'https://pubmed.ncbi.nlm.nih.gov/example3',
      relevanceScore: 0.84,
    },
    {
      title: `Quality of Life Outcomes in ${disease} Patients Receiving Novel Therapies`,
      abstract: `A multi-center study evaluating quality of life improvements in ${disease} patients treated with next-generation therapeutics over a 24-month follow-up period.`,
      authors: ['Anderson P', 'Taylor S', 'Wilson J'],
      year: 2024,
      source: 'OpenAlex',
      url: 'https://openalex.org/example2',
      relevanceScore: 0.82,
    },
    {
      title: `Combination Therapy Strategies for Advanced ${disease}`,
      abstract: `We evaluate the efficacy and safety of combination therapy protocols for advanced-stage ${disease}, comparing dual and triple therapy regimens in a randomized controlled trial.`,
      authors: ['Martinez L', 'Thompson C', 'Harris B'],
      year: 2023,
      source: 'PubMed',
      url: 'https://pubmed.ncbi.nlm.nih.gov/example4',
      relevanceScore: 0.79,
    },
  ];

  const trials: ClinicalTrial[] = [
    {
      title: `Phase III Trial of Novel ${disease} Treatment Protocol`,
      status: 'RECRUITING',
      eligibility: 'Adults 18-75, confirmed diagnosis, no prior immunotherapy',
      location: context?.location || 'Multiple US Sites',
      contact: 'Dr. Sarah Mitchell — trials@example.org',
      url: 'https://clinicaltrials.gov/study/NCT00000001',
      relevanceScore: 0.93,
    },
    {
      title: `Biomarker-Guided Therapy for ${disease}`,
      status: 'RECRUITING',
      eligibility: 'Adults 21+, stage II-III, adequate organ function',
      location: context?.location || 'Boston, MA',
      contact: 'Dr. James Park — biomarker-trial@example.org',
      url: 'https://clinicaltrials.gov/study/NCT00000002',
      relevanceScore: 0.88,
    },
    {
      title: `Long-term Outcomes Study: ${disease} Combination Therapy`,
      status: 'ACTIVE_NOT_RECRUITING',
      eligibility: 'Adults who completed prior combination therapy trial',
      location: context?.location || 'National',
      contact: 'Dr. Emily Chen — outcomes@example.org',
      url: 'https://clinicaltrials.gov/study/NCT00000003',
      relevanceScore: 0.81,
    },
  ];

  return {
    overview: `## Condition Overview\n\n**${disease}** is a complex medical condition that continues to be a major focus of global research efforts. Recent advances in molecular biology, immunotherapy, and precision medicine have significantly expanded the therapeutic landscape.\n\nBased on the analysis of **187 publications** and **42 clinical trials**, here are the key findings relevant to your query: "${query}"`,
    insights: `## Key Research Insights\n\n### 1. Novel Therapeutic Approaches\nRecent studies highlight significant progress in immunotherapy and targeted therapy for ${disease}. Smith et al. (2024) conducted a comprehensive review of 45 clinical studies, demonstrating improved outcomes with combination treatment approaches.\n\n### 2. Precision Medicine Advances\nGenomic biomarker research (Kim et al., 2023) has identified key susceptibility markers across 128 GWAS studies, enabling more personalized treatment selection.\n\n### 3. AI-Assisted Diagnostics\nMachine learning frameworks (Zhang et al., 2023) are achieving 94% accuracy in early detection, potentially transforming diagnostic workflows.\n\n### 4. Quality of Life Improvements\nMulti-center studies show significant QoL improvements with next-generation therapeutics over 24-month follow-up periods (Anderson et al., 2024).`,
    clinical_trials: `## Active Clinical Trials\n\nThere are currently **${trials.length} relevant clinical trials** for ${disease}:\n\n${trials.map((t, i) => `**${i + 1}. ${t.title}**\n- Status: ${t.status}\n- Location: ${t.location}\n- Eligibility: ${t.eligibility}\n- Contact: ${t.contact}`).join('\n\n')}`,
    sources: [...publications, ...trials],
    publications,
    trials,
  };
}

function extractDisease(query: string): string {
  const common = ['cancer', 'diabetes', 'alzheimer', 'parkinson', 'heart disease', 'lung cancer', 'breast cancer'];
  const lower = query.toLowerCase();
  for (const d of common) {
    if (lower.includes(d)) return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return 'the condition';
}
