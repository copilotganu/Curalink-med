import { ExternalLink, BookOpen, Award } from 'lucide-react';
import type { Publication } from '@/types/research';

const paperTypeLabels: Record<string, string> = {
  'systematic-review': 'Systematic Review',
  'rct': 'RCT',
  'cohort-study': 'Cohort Study',
  'case-report': 'Case Report',
  'research-article': 'Research Article',
};

const confidenceBadgeColor: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',
  1: 'bg-red-100 text-red-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-green-100 text-green-700',
  5: 'bg-emerald-100 text-emerald-700',
};

export default function PublicationCard({ pub }: { pub: Publication }) {
  const authors = (pub.authors || []).slice(0, 3);
  const authorsText = authors.length > 0 ? authors.join(', ') + (authors.length < (pub.authors?.length || 0) ? ' et al.' : '') : 'Unknown';
  const snippet = pub.snippet || (pub.abstract ? pub.abstract.substring(0, 140) + '...' : 'No summary available');
  
  const paperType = pub.paperType ? paperTypeLabels[pub.paperType] || 'Research' : 'Research';
  const confidenceScore = Math.round((pub.confidence || 0.5) * 5);
  const confidenceText = confidenceScore >= 4 ? 'Very High' : confidenceScore >= 3 ? 'High' : confidenceScore >= 2 ? 'Moderate' : 'Low';
  const badgeColor = confidenceBadgeColor[confidenceScore] || confidenceBadgeColor[0];

  return (
    <a
      href={pub.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-lg border border-border bg-card hover:shadow-elevated transition-shadow group"
    >
      {/* Title with Icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <h4 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {pub.title}
          </h4>
        </div>
        {pub.url && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
      </div>

      {/* Badges: Paper Type + Confidence */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium text-xs">
          {paperType}
        </span>
        <span className={`px-2 py-0.5 rounded font-medium text-xs flex items-center gap-1 ${badgeColor}`}>
          <Award className="h-3 w-3" />
          {confidenceText}
        </span>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-xs">
        {/* Authors */}
        <div className="text-muted-foreground">
          <span className="font-semibold text-foreground">Authors: </span>
          <span className="truncate inline-block">{authorsText}</span>
        </div>

        {/* Year and Source */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">Year: </span>
            {pub.year}
          </span>
          <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-medium text-xs">
            {pub.source || 'Unknown'}
          </span>
        </div>

        {/* Snippet */}
        <div className="text-muted-foreground leading-snug line-clamp-3 bg-muted/50 p-2 rounded border border-border/50">
          <span className="font-semibold text-foreground text-xs">Key Finding: </span>
          <span className="text-xs">{snippet}</span>
        </div>

        {/* URL with full PubMed link */}
        {pub.url && (
          <div className="text-muted-foreground pt-1 border-t border-border/50">
            <span className="font-semibold text-foreground text-xs">Source: </span>
            <span className="text-xs break-all text-blue-600 hover:text-blue-700">{new URL(pub.url).hostname}</span>
          </div>
        )}
      </div>
    </a>
  );
}
