import { SmartInsight } from "@/types/finance";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  CreditCard,
  Building,
  Users,
} from "lucide-react";

interface FinanceInsightsSectionProps {
  insights: SmartInsight[];
}

export function FinanceInsightsSection({ insights }: FinanceInsightsSectionProps) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-bold font-display uppercase tracking-wider text-foreground">
          Financial Intelligence & Signals
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/70">
          Deterministic
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((ins) => {
          const isWarning = ins.type === "warning" || ins.type === "negative";
          const isPositive = ins.type === "positive";

          return (
            <div
              key={ins.id}
              className={`p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                isWarning
                  ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                  : isPositive
                  ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
                  : "bg-card border-border/70 hover:border-primary/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {isWarning ? (
                      <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                    ) : isPositive ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Info className="size-4 text-primary shrink-0" />
                    )}
                    <span className="text-xs font-bold text-foreground truncate">
                      {ins.title}
                    </span>
                  </div>

                  {ins.badge && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider border ${
                        isWarning
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : isPositive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {ins.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {ins.description}
                </p>
              </div>

              {ins.metric && (
                <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono font-bold text-foreground">
                  <span className="text-muted-foreground font-normal">Metric:</span>
                  <span>{ins.metric}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
