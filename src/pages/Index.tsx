import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Microscope, Sparkles, CheckCircle } from 'lucide-react';
import ChatInput from '@/components/ChatInput';
import UserMessage from '@/components/UserMessage';
import AssistantMessage from '@/components/AssistantMessage';
import LoadingIndicator from '@/components/LoadingIndicator';
import { getDemoResponse, sendQuery } from '@/lib/api';
import type { ChatMessage, UserContext } from '@/types/research';

const EXAMPLE_QUERIES = [
  'Latest research findings',
  'Treatment options and therapies',
  'Clinical trial availability',
  'Patient outcomes and efficacy',
];

export default function Index() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (query: string, context?: UserContext) => {
    if (context) {
      setUserContext(context);
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      context: context || userContext,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const response = await sendQuery(query, context || userContext);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.overview,
      response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsLoading(false);
  };

  // Show initial setup form if no user context yet
  if (!userContext) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Microscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-heading font-bold text-foreground">MedResearch AI - Medical Research Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by PubMed • OpenAlex • ClinicalTrials.gov</p>
          </div>
        </header>

        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full"
          >
            <div className="text-center mb-8">
              <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 mx-auto">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-3xl font-heading font-bold text-foreground mb-3">
                Welcome to MedResearch AI
              </h2>
              <p className="text-lg text-muted-foreground mb-2">
                AI-powered research assistant for any medical condition
              </p>
              <p className="text-sm text-muted-foreground">
                Get access to latest research publications and clinical trials tailored to your specific medical query.
              </p>
            </div>

            {/* Setup Form */}
            <div className="bg-card rounded-xl border border-border p-6 mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-6">Patient Information</h3>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const patientName = formData.get('patientName') as string;
                const location = formData.get('location') as string;

                if (!patientName.trim() || !location.trim()) {
                  alert('Please fill in all required fields');
                  return;
                }

                const context: UserContext = {
                  patientName: patientName.trim(),
                  location: location.trim(),
                  additionalQuery: (formData.get('additionalQuery') as string) || '',
                };

                setUserContext(context);
              }}>
                <div className="space-y-4">
                  {/* Patient Name */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Patient Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="patientName"
                      placeholder="Enter patient name"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Location (City, State/Country) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g., Boston, MA or London, UK"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Location helps us find relevant clinical trials in your area.
                    </p>
                  </div>

                  {/* Additional Details */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Additional Details <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      type="text"
                      name="additionalQuery"
                      placeholder="e.g., specific symptoms, current medications, or treatment interests"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors mt-6"
                  >
                    <CheckCircle className="inline h-4 w-4 mr-2" />
                    Start Research Session
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3">What you'll get:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Latest research publications (ranked by relevance)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Active clinical trials in your location</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Expert-generated insights and summaries</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Conversation history and context awareness</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show chat interface after setup
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with user context */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Microscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-heading font-bold text-foreground">MedResearch AI</h1>
            <p className="text-xs text-muted-foreground">
              Patient: {userContext.patientName} • Location: {userContext.location}
            </p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-2">
              Research Assistant Ready
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Ask about any medical condition, disease, treatment, or clinical trial. Get instant access to latest research and trials.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q, userContext)}
                  className="px-3 py-1.5 text-xs rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          messages.map((msg) =>
            msg.role === 'user' ? (
              <UserMessage key={msg.id} message={msg} />
            ) : (
              <AssistantMessage key={msg.id} message={msg} />
            )
          )
        )}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
