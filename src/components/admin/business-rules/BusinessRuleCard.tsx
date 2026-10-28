// ============================================================
// SADA OS — INTELLIGENT BUSINESS RULE CARD COMPONENT
// Distinguishes configured thresholds from live business state,
// shows evaluated findings, impacts, and contextual actions.
// ============================================================

import { format, parseISO } from "date-fns";
import {
  History,
  RotateCcw,
  ExternalLink,
  Sliders,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Layers,
  ChevronRight,
} from "lucide-react";
import type {
  BusinessRule,
  BusinessRuleCategory,
  RuleEvaluationResult,
} from "@/types/business-rules";
import { SADABadge, SADAButton } from "@/components/ui/sada-ui";

interface BusinessRuleCardProps {
  rule: BusinessRule;
  evaluation?: RuleEvaluationResult;
  categoryMetadata: {
    label: string;
    icon: any;
    color: string;
  };
  onEdit: (rule: BusinessRule) => void;
  onReset: (rule: BusinessRule) => void;
  onHistory: (rule: BusinessRule) => void;
}

export function BusinessRuleCard({
  rule,
  evaluation,
  categoryMetadata,
  onEdit,
  onReset,
  onHistory,
}: BusinessRuleCardProps) {
  const Icon = categoryMetadata.icon;

  const hasNumericDefault = rule.default_numeric_value !== null && rule.default_numeric_value !== undefined;
  const hasTextDefault = rule.default_text_value !== null && rule.default_text_value !== undefined;
  const isNumericModified = hasNumericDefault && Number(rule.numeric_value) !== Number(rule.default_numeric_value);
  const isTextModified = hasTextDefault && rule.text_value !== rule.default_text_value;
  const isModifiedFromDefault = isNumericModified || isTextModified;

  const status = evaluation?.status || "config_only";

  const statusBadge = (() => {
    switch (status) {
      case "critical":
        return {
          label: "Critical Floor",
          className: "bg-destructive/10 text-destructive border-destructive/30",
          icon: ShieldAlert,
        };
      case "warning":
        return {
          label: "Alert Triggered",
          className: "bg-amber-500/10 text-amber-500 border-amber-500/30",
          icon: AlertTriangle,
        };
      case "healthy":
        return {
          label: "Compliant",
          className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
          icon: CheckCircle2,
        };
      case "config_only":
      default:
        return {
          label: "Policy Baseline",
          className: "bg-muted text-muted-foreground border-border",
          icon: Sliders,
        };
    }
  })();

  const StatusIcon = statusBadge.icon;

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-card border transition-all flex flex-col justify-between space-y-4 hover:shadow-xs min-w-0 max-w-full overflow-hidden ${
        status === "critical"
          ? "border-destructive/50 ring-1 ring-destructive/10"
          : status === "warning"
          ? "border-amber-500/50 ring-1 ring-amber-500/10"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="space-y-3.5 min-w-0">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`p-1.5 rounded-lg border shrink-0 ${categoryMetadata.color}`}>
              <Icon className="size-3.5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              {categoryMetadata.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border flex items-center gap-1 ${statusBadge.className}`}
            >
              <StatusIcon className="size-2.5 shrink-0" />
              <span className="truncate max-w-[130px]">{statusBadge.label}</span>
            </span>
            <SADABadge variant="outline" size="sm" className="font-mono text-[10px] shrink-0">
              v{rule.version}
            </SADABadge>
          </div>
        </div>

        {/* Rule Title & Scope */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground font-display break-words">
              {rule.rule_name}
            </h3>
            {isModifiedFromDefault && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
                Custom
              </span>
            )}
            {evaluation?.isContradictory && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-destructive/10 text-destructive border border-destructive/20 font-mono flex items-center gap-0.5">
                <AlertTriangle className="size-2.5" /> Contradiction
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {rule.description}
          </p>
        </div>

        {/* Comparative State Deck: Configured vs Observed */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/60">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Configured Threshold
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold font-display tabular-nums text-foreground">
                {rule.value_type === "numeric" ? rule.numeric_value : (rule.text_value || "—")}
              </span>
              {rule.unit && (
                <span className="text-xs font-semibold text-muted-foreground">
                  {rule.unit}
                </span>
              )}
            </div>
            {hasNumericDefault && (
              <span className="text-[9px] text-muted-foreground/70 block truncate mt-0.5 font-mono">
                Def: {rule.default_numeric_value} {rule.unit || ""}
              </span>
            )}
          </div>

          <div className="border-s border-border/50 ps-2.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Observed State
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-base font-bold font-display tabular-nums ${
                  status === "critical"
                    ? "text-destructive"
                    : status === "warning"
                    ? "text-amber-500"
                    : status === "healthy"
                    ? "text-emerald-500"
                    : "text-foreground"
                }`}
              >
                {evaluation?.observedDisplay || "—"}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground/70 block truncate mt-0.5 font-mono">
              {evaluation?.affectedEntityCount !== undefined && evaluation.affectedEntityCount > 0
                ? `${evaluation.affectedEntityCount} accounts`
                : rule.operator ? `Condition: ${rule.operator} limit` : "Active Policy"}
            </span>
          </div>
        </div>

        {/* Evaluated Finding Banner */}
        {evaluation && (
          <div
            className={`p-2.5 rounded-xl text-xs space-y-1 border ${
              status === "critical"
                ? "bg-destructive/5 border-destructive/20 text-foreground"
                : status === "warning"
                ? "bg-amber-500/5 border-amber-500/20 text-foreground"
                : "bg-muted/30 border-border/50 text-muted-foreground"
            }`}
          >
            <p className="font-semibold text-foreground text-[11px] leading-snug">
              {evaluation.finding}
            </p>
            {evaluation.isContradictory && evaluation.contradictionDetails && (
              <p className="text-[10px] text-destructive font-mono pt-0.5">
                ⚠️ {evaluation.contradictionDetails}
              </p>
            )}
            {evaluation.businessImpact && (
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {evaluation.businessImpact}
              </p>
            )}
          </div>
        )}

        {/* Consumers & Dependencies */}
        {evaluation?.consumers && evaluation.consumers.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground/80 font-mono">Consumers:</span>
            {evaluation.consumers.map((c) => (
              <span
                key={c}
                className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-muted/60 text-muted-foreground border border-border"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer & Action Deck */}
      <div className="space-y-2.5 pt-3 border-t border-border/50">
        {/* Contextual Operational Link if actionable */}
        {evaluation?.actionRoute && (
          <a
            href={evaluation.actionRoute}
            className="flex items-center justify-between p-2 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary text-xs font-semibold transition-all group min-w-0"
          >
            <span className="flex items-center gap-1.5 min-w-0 flex-1 truncate pe-1">
              <ExternalLink className="size-3 shrink-0" />
              <span className="truncate">{evaluation.actionLabel || "Inspect Operational Module"}</span>
            </span>
            <ChevronRight className="size-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </a>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono text-[10px] text-muted-foreground/80 truncate max-w-[150px]">
            {rule.rule_key}
          </span>
          <span className="text-[10px]">
            {rule.effective_from ? format(parseISO(rule.effective_from), "MMM dd, yyyy") : "Active"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => onHistory(rule)}
            className="text-xs w-full px-1.5 sm:px-2"
            title="View change history"
          >
            <History className="size-3 me-1" /> Log
          </SADAButton>

          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => onReset(rule)}
            disabled={!isModifiedFromDefault}
            className={`text-xs w-full px-1.5 sm:px-2 ${
              isModifiedFromDefault
                ? "text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                : "opacity-40"
            }`}
            title={isModifiedFromDefault ? "Reset to factory default" : "Already at default value"}
          >
            <RotateCcw className="size-3 me-1" /> Reset
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={() => onEdit(rule)}
            className="text-xs w-full px-1.5 sm:px-2"
          >
            <span className="hidden sm:inline">Edit & Simulate</span>
            <span className="sm:hidden">Edit</span>
          </SADAButton>
        </div>
      </div>
    </div>
  );
}
