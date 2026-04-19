import { useState } from 'react';
import { Send, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserContext } from '@/types/research';

interface ChatInputProps {
  onSend: (query: string, context?: UserContext) => void;
  isLoading: boolean;
  userContext: UserContext | null;
  setUserContext?: (context: UserContext) => void;
}

export default function ChatInput({ onSend, isLoading, userContext, setUserContext }: ChatInputProps) {
  const [query, setQuery] = useState('');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    patientName: '',
    location: '',
    additionalQuery: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If no user context yet, show form
    if (!userContext) {
      setShowPatientForm(true);
      return;
    }

    if (!query.trim() || isLoading) return;

    onSend(query.trim(), userContext);
    setQuery('');
  };

  const handlePatientFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.patientName.trim()) {
      setFormError('Patient name is required');
      return;
    }
    if (!formData.location.trim()) {
      setFormError('Location is required');
      return;
    }

    const context: UserContext = {
      patientName: formData.patientName.trim(),
      location: formData.location.trim(),
      additionalQuery: formData.additionalQuery.trim(),
    };

    setUserContext?.(context);
    setShowPatientForm(false);
    
    // Send the query after setting context
    if (query.trim()) {
      onSend(query.trim(), context);
      setQuery('');
    }
  };

  return (
    <>
      {/* Patient Info Modal */}
      <AnimatePresence>
        {showPatientForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-xl border border-border p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Patient Information</h3>
                <button
                  onClick={() => setShowPatientForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handlePatientFormSubmit} className="space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Patient Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter patient name"
                    value={formData.patientName}
                    onChange={(e) => {
                      setFormData({ ...formData, patientName: e.target.value });
                      setFormError('');
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Location <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Boston, MA or London, UK"
                    value={formData.location}
                    onChange={(e) => {
                      setFormData({ ...formData, location: e.target.value });
                      setFormError('');
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Additional Details <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., symptoms, medications, treatment interests"
                    value={formData.additionalQuery}
                    onChange={(e) => setFormData({ ...formData, additionalQuery: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={userContext ? "Ask about research, trials, or treatment..." : "Click Send to start..."}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2.5"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  );
}
