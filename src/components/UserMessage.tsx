import { motion } from 'framer-motion';
import type { ChatMessage } from '@/types/research';

export default function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 max-w-4xl ml-auto justify-end"
    >
      <div className="max-w-lg">
        <div className="px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm">
          {message.content}
        </div>
        {(message.context?.disease || message.context?.location) && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 justify-end">
            {message.context?.disease && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {message.context.disease}
              </span>
            )}
            {message.context?.location && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {message.context.location}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="h-8 w-8 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0 mt-1">
        <span className="text-foreground text-sm font-bold">U</span>
      </div>
    </motion.div>
  );
}
