// ============================================================
// SADA OS — BUSINESS RULES SMART INSIGHTS PANEL
// Evidence-based executive briefing cards connecting rule
// evaluations directly to business impacts and authorized routes.
// ============================================================

import {
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Info,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import type { BusinessRuleSmartInsight } from "@/types/business-rules";
import { SADABadge, SADAButton } from "@/components/ui/sada-ui";

interface BusinessRulesSmartInsightsPanelProps {
  insights: BusinessRuleSmartInsight[];
  onSelectInsightRule?: (ruleKey: string) => void;
}

export function BusinessRulesSmartInsightsPanel({
  insights,
  onSelectInsightRule,
}: BusinessRulesSmartInsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-card to-muted/20 border border-border shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-foreground">
              Executive Governance Intelligence & Actionable Insights
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Automated, deterministic findings derived from live Financial OS records and configured rule thresholds.
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {insights.length} Findings
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {insights.map((insight) => {
          const typeBadge = (() => {
            switch (insight.type) {
              case "critical":
                return {
                  label: "Critical Condition",
                  className: "bg-destructive/10 text-destructive border-destructive/30",
                  icon: ShieldAlert,
                };
              case "warning":
                return {
                  label: "Executive Warning",
                  className: "bg-amber-500/10 text-amber-500 border-amber-500/30",
                  icon: AlertTriangle,
                };
              case "positive":
                return {
                  label: "Compliant Baseline",
                  className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
                  icon: CheckCircle2,
                };
              case "info":
              default:
                return {
                  label: "Operational Intelligence",
                  className: "bg-sky-500/10 text-sky-500 border-sky-500/30",
                  icon: Info,
                };
            }
          })();

          const TypeIcon = typeBadge.icon;

          return (
            <div
              key={insight.id}
              className={`p-4 rounded-xl bg-card border transition-all flex flex-col justify-between space-y-3 ${
                insight.type === "critical"
                  ? "border-destructive/40 shadow-xs"
                  : insight.type === "warning"
                  ? "border-amber-500/40 shadow-xs"
                  : "border-border shadow-2xs hover:border-border"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border flex items-center gap-1 ${typeBadge.className}`}
                  >
                    <TypeIcon className="size-2.5" />
                    <span>{typeBadge.label}</span>
                  </span>

                  <span className="text-[10px] font-mono text-muted-foreground/70">
                    Confidence: <strong className="uppercase text-foreground">{insight.confidence}</strong>
                  </span>
                </div>

                <h4 className="text-xs font-bold text-foreground font-display">
                  {insight.title}
                </h4>

                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  {insight.finding}
                </p>

                <div className="p-2.5 rounded-lg bg-muted/40 text-[11px] space-y-1 border border-border/40">
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Impact: </strong>
                    {insight.businessImpact}
                  </p>
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Evidence: </strong>
                    {insight.supportingEvidence} ({insight.observationPeriod})
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs">
                {onSelectInsightRule && (
                  <button
                    type="button"
                    onClick={() => onSelectInsightRule(insight.ruleKey)}
                    className="text-[11px] font-mono text-primary hover:underline cursor-pointer truncate text-start"
                  >
                    Rule: {insight.ruleKey}
                  </button>
                )}

                <a
                  href={insight.actionRoute}
                  className="flex items-center justify-between xs:justify-start gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold transition-all shrink-0 max-w-full truncate"
                >
                  <span className="truncate">{insight.actionLabel}</span>
                  <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
