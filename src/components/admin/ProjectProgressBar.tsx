import { motion } from "framer-motion";

interface Props {
  percent: number;
  done: number;
  total: number;
  inProgress?: number;
  overdue?: number;
  compact?: boolean;
}

export function ProjectProgressBar({ percent, done, total, inProgress = 0, overdue = 0, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-primary"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{percent}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold text-gradient">{percent}%</span>
          <span className="text-sm text-muted-foreground">complete</span>
        </div>
        <span className="text-sm text-muted-foreground">{done}/{total} tasks</span>
      </div>

      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> {done} completed
        </span>
        {inProgress > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> {inProgress} in progress
          </span>
        )}
        {overdue > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" /> {overdue} overdue
          </span>
        )}
      </div>
    </div>
  );
}
