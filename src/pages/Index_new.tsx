import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Microscope, Sparkles } from 'lucide-react';
import ChatInput from '@/components/ChatInput';
import UserMessage from '@/components/UserMessage';
import AssistantMessage from '@/components/AssistantMessage';
import LoadingIndicator from '@/components/LoadingIndicator';
import { sendQuery } from '@/lib/api';
import type { ChatMessage, UserContext } from '@/types/research';

const EXAMPLE_QUERIES = [
  'Latest lung cancer research outcomes',
  'Best biomarkers for targeted cancer therapy',
  'Current clinical trials in Toronto',
  'Treatment advances for metastatic disease',
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
    if (context && !userContext) {
      setUserContext(context);
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      context,
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

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Microscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-heading font-bold text-foreground">MedResearch AI</h1>
            <p className="text-xs text-muted-foreground">
              {userContext ? `Patient: ${userContext.patientName} • Location: ${userContext.location}` : 'Medical research assistant for clinical questions'}
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
              Ask about research, clinical trials, treatment options, or any specific medical condition.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
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
      <ChatInput onSend={handleSend} isLoading={isLoading} userContext={userContext} setUserContext={setUserContext} />
    </div>
  );
}
