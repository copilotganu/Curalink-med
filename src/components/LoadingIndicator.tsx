import { motion } from 'framer-motion';

export default function LoadingIndicator() {
  return (
    <div className="flex gap-3 max-w-4xl">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-primary text-sm font-bold">AI</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border">
        <span className="text-sm text-muted-foreground">Analyzing research</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
