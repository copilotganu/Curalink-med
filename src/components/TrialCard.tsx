import { ExternalLink, FlaskConical, MapPin } from 'lucide-react';
import type { ClinicalTrial } from '@/types/research';

const statusColors: Record<string, string> = {
  RECRUITING: 'bg-secondary/15 text-secondary font-semibold',
  ACTIVE_NOT_RECRUITING: 'bg-accent/15 text-accent font-semibold',
  COMPLETED: 'bg-muted text-muted-foreground',
};

export default function TrialCard({ trial }: { trial: ClinicalTrial }) {
  const statusClass = statusColors[trial.status] || 'bg-muted text-muted-foreground';
  const summary = trial.eligibility ? trial.eligibility.substring(0, 120) + '...' : 'No eligibility info available';

  return (
    <a
      href={trial.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-lg border border-border bg-card hover:shadow-elevated transition-shadow group"
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
          <h4 className="text-sm font-semibold text-foreground leading-snug group-hover:text-secondary transition-colors line-clamp-2">
            {trial.title}
          </h4>
        </div>
        {trial.url && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
      </div>

      {/* Clean metadata format */}
      <div className="space-y-2 text-xs">
        {/* Status */}
        <div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
            {trial.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="font-semibold text-foreground mr-1">Location:</span>
          <span className="truncate">{trial.location || 'Multiple locations'}</span>
        </div>

        {/* Phase (if available) */}
        {trial.phase && (
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">Phase: </span>
            {trial.phase}
          </div>
        )}

        {/* Summary of eligibility */}
        <p className="text-muted-foreground leading-snug line-clamp-2">
          <span className="font-semibold text-foreground">Eligibility: </span>
          {summary}
        </p>
      </div>
    </a>
  );
}
