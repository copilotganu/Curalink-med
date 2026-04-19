import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserContext } from '@/types/research';

interface ChatInputProps {
  onSend: (query: string, context?: UserContext) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim() || isLoading) return;

    onSend(query.trim());
    setQuery('');
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about research, trials, treatments, or any medical condition..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          disabled={isLoading}
          autoFocus
        />
        <Button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="px-4 py-2.5"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
