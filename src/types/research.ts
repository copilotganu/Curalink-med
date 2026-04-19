export interface UserContext {
  patientName: string;
  disease?: string;
  additionalQuery?: string;
  location: string;
}

export interface Publication {
  title: string;
  abstract: string;
  authors: string[];
  year: number;
  source: 'PubMed' | 'OpenAlex';
  url: string;
  link?: string;
  relevanceScore?: number;
  snippet?: string;
  pmid?: string;
  paperType?: 'systematic-review' | 'rct' | 'cohort-study' | 'case-report' | 'research-article';
  confidence?: number;
}

export interface ClinicalTrial {
  title: string;
  status: string;
  eligibility: string;
  location: string;
  contact: string;
  url: string;
  phase?: string;
  relevanceScore?: number;
  nctId?: string;
  summary?: string;
}

export interface ResearchResponse {
  overview: string;
  insights: string;
  clinical_trials: string;
  sources: (Publication | ClinicalTrial)[];
  publications: Publication[];
  trials: ClinicalTrial[];
  retrievalDepth?: {
    totalPublications: number;
    totalTrials: number;
    selectedPublications: number;
    selectedTrials: number;
  };
  overallInsight?: string;
  knowledgeGaps?: string[];
  trialFocusAreas?: string[];
  mostRelevantStudy?: Publication;
  temporalTrend?: string;
  fromContext?: boolean;
  generatedByLLM?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: UserContext;
  response?: ResearchResponse;
  timestamp: Date;
}
