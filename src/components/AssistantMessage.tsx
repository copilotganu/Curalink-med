import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { BookOpen, FlaskConical, BarChart3, AlertCircle, Lightbulb, TrendingUp, Award } from 'lucide-react';
import PublicationCard from './PublicationCard';
import TrialCard from './TrialCard';
import type { ChatMessage } from '@/types/research';

export default function AssistantMessage({ message }: { message: ChatMessage }) {
  const res = message.response;
  const isContextAnswer = Boolean(res?.fromContext);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 max-w-5xl"
    >
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
        <span className="text-primary text-sm font-bold">AI</span>
      </div>
      <div className="flex-1 min-w-0 space-y-6">
        {/* Overview + Insights */}
        {res ? (
          <>
            {/* Overview Section */}
            <div className="prose-research text-sm">
              <ReactMarkdown>{res.overview}</ReactMarkdown>
            </div>

            {/* Insights Section */}
            {res.insights && (
              <div className="prose-research text-sm">
                <ReactMarkdown>{res.insights}</ReactMarkdown>
              </div>
            )}

            {/* Retrieval Pipeline Visualization */}
            {!isContextAnswer && res.retrievalDepth && (
              <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Research Pipeline</h3>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-card rounded border border-border/50">
                    <div className="font-bold text-primary">{res.retrievalDepth.totalPublications}</div>
                    <div className="text-muted-foreground">Retrieved</div>
                  </div>
                  <div className="flex items-center justify-center text-muted-foreground">→</div>
                  <div className="text-center p-2 bg-card rounded border border-border/50">
                    <div className="font-bold text-secondary">{res.retrievalDepth.selectedPublications}</div>
                    <div className="text-muted-foreground">Ranked</div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground flex items-center justify-center">Analyzed</div>
                </div>
              </div>
            )}

            {/* Most Relevant Study Highlight */}
            {!isContextAnswer && res.mostRelevantStudy && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-emerald-900">Most Relevant Study</h3>
                </div>
                <p className="text-sm text-emerald-900 font-semibold mb-2">{res.mostRelevantStudy.title}</p>
                <p className="text-xs text-emerald-800 mb-2">
                  <span className="font-semibold">{res.mostRelevantStudy.authors?.[0]} et al.</span> ({res.mostRelevantStudy.year})
                </p>
                <p className="text-xs text-emerald-700 leading-relaxed">{res.mostRelevantStudy.snippet}</p>
                <a 
                  href={res.mostRelevantStudy.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold mt-2 inline-block"
                >
                  Read full paper →
                </a>
              </div>
            )}

            {/* Temporal Trend */}
            {!isContextAnswer && res.temporalTrend && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">Research Trend</h3>
                </div>
                <p className="text-xs text-muted-foreground">{res.temporalTrend}</p>
              </div>
            )}

            {/* Publications Grid */}
            {!isContextAnswer && res.publications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-heading font-semibold text-foreground">
                    Research Publications ({res.publications.length})
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {res.publications.map((p, i) => (
                    <PublicationCard key={i} pub={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Clinical Trials Section */}
            {!isContextAnswer && res.trials.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical className="h-4 w-4 text-secondary" />
                  <h3 className="text-sm font-heading font-semibold text-foreground">
                    Active Clinical Trials ({res.trials.length})
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {res.trials.map((t, i) => (
                    <TrialCard key={i} trial={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Trial Focus Areas */}
            {!isContextAnswer && res.trialFocusAreas && res.trialFocusAreas.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Trial Research Directions</h3>
                <ul className="text-xs text-muted-foreground space-y-2">
                  {res.trialFocusAreas.map((area, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-secondary font-bold">→</span>
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clinical Trials Analysis */}
            {!isContextAnswer && res.clinical_trials && (
              <div className="prose-research text-sm">
                <ReactMarkdown>{res.clinical_trials}</ReactMarkdown>
              </div>
            )}

            {/* Overall Insight - Highlighted */}
            {!isContextAnswer && res.overallInsight && (
              <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border-l-4 border-primary rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-2">Clinical Evidence Summary</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {res.overallInsight}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Knowledge Gaps - Structured */}
            {!isContextAnswer && res.knowledgeGaps && res.knowledgeGaps.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-amber-900 mb-3">Research Gaps & Opportunities</h3>
                    <ul className="space-y-2">
                      {res.knowledgeGaps.map((gap, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-2">
                          <span className="font-bold text-amber-600 shrink-0">→</span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="prose-research text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
}
