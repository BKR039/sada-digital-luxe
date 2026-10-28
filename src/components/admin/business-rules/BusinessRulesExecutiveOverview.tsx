// ============================================================
// SADA OS — BUSINESS RULES EXECUTIVE OVERVIEW COMPONENT
// Executive KPI strip, segmented health distribution bar,
// category risk density pills, and drill-down filters.
// ============================================================

import { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Activity,
  History,
  TrendingUp,
  Info,
  Flame,
  Percent,
  Layers,
  Sparkles,
  Bell,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import type {
  BusinessRuleCategory,
  ExecutiveRulesOverview,
  RuleEvaluationStatus,
} from "@/types/business-rules";
import { SADABadge, SADAButton } from "@/components/ui/sada-ui";

interface BusinessRulesExecutiveOverviewProps {
  overview: ExecutiveRulesOverview;
  activeStatusFilter: RuleEvaluationStatus | "all" | "triggered" | "review_needed";
  onSelectStatusFilter: (status: RuleEvaluationStatus | "all" | "triggered" | "review_needed") => void;
  activeCategory: BusinessRuleCategory | "all";
  onSelectCategory: (category: BusinessRuleCategory | "all") => void;
  isRtl?: boolean;
}

export function BusinessRulesExecutiveOverview({
  overview,
  activeStatusFilter,
  onSelectStatusFilter,
  activeCategory,
  onSelectCategory,
  isRtl = false,
}: BusinessRulesExecutiveOverviewProps) {
  const [showMetricDetails, setShowMetricDetails] = useState(false);

  const total = overview.totalRules || 27;
  const criticalPct = Math.round((overview.criticalCount / total) * 100);
  const warningPct = Math.round((overview.warningCount / total) * 100);
  const healthyPct = Math.round((overview.healthyCount / total) * 100);
  const policiesPct = 100 - (criticalPct + warningPct + healthyPct);

  return (
    <div className="space-y-4">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Rules */}
        <div
          onClick={() => onSelectStatusFilter("all")}
          className={`p-3.5 rounded-2xl bg-card border transition-all cursor-pointer hover:border-primary/40 ${
            activeStatusFilter === "all" ? "border-primary ring-1 ring-primary/20 shadow-xs" : "border-border shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Canonical Rules</span>
            <Sliders className="size-3.5 text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-display tabular-nums text-foreground">
              {overview.totalRules}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">active</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            {overview.liveEvaluatedCount} live · {overview.configurationPolicyCount} policies
          </p>
        </div>

        {/* Triggered Alerts */}
        <div
          onClick={() => onSelectStatusFilter("triggered")}
          className={`p-3.5 rounded-2xl bg-card border transition-all cursor-pointer hover:border-amber-500/50 ${
            activeStatusFilter === "triggered" ? "border-amber-500 ring-1 ring-amber-500/20 shadow-xs" : "border-border shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Triggered Rules</span>
            <AlertTriangle className="size-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-display tabular-nums text-amber-500">
              {overview.triggeredRulesCount}
            </span>
            <span className="text-[10px] text-amber-500/80 font-mono">exceptions</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            {overview.criticalCount} critical · {overview.warningCount} warning
          </p>
        </div>

        {/* Critical Risks */}
        <div
          onClick={() => onSelectStatusFilter("critical")}
          className={`p-3.5 rounded-2xl bg-card border transition-all cursor-pointer hover:border-destructive/50 ${
            activeStatusFilter === "critical" ? "border-destructive ring-1 ring-destructive/20 shadow-xs" : "border-border shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Critical Floor</span>
            <ShieldAlert className="size-3.5 text-destructive" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-display tabular-nums text-destructive">
              {overview.criticalCount}
            </span>
            <span className="text-[10px] text-destructive/80 font-mono">floors breached</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            {overview.criticalCount > 0 ? "Requires executive action" : "Zero floor breaches"}
          </p>
        </div>

        {/* Healthy & Compliant */}
        <div
          onClick={() => onSelectStatusFilter("healthy")}
          className={`p-3.5 rounded-2xl bg-card border transition-all cursor-pointer hover:border-emerald-500/50 ${
            activeStatusFilter === "healthy" ? "border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs" : "border-border shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Healthy & Compliant</span>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-display tabular-nums text-emerald-500">
              {overview.healthyCount}
            </span>
            <span className="text-[10px] text-emerald-500/80 font-mono">verified</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            Within safety margins
          </p>
        </div>

        {/* Needs Review */}
        <div
          onClick={() => onSelectStatusFilter("review_needed")}
          className={`p-3.5 rounded-2xl bg-card border transition-all cursor-pointer hover:border-primary/50 ${
            activeStatusFilter === "review_needed" ? "border-primary ring-1 ring-primary/20 shadow-xs" : "border-border shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Needs Review</span>
            <Activity className="size-3.5 text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-display tabular-nums text-foreground">
              {overview.rulesRequiringReviewCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">rules</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            Custom or active alerts
          </p>
        </div>

        {/* Changes in 30 Days */}
        <div
          className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">30-Day Versions</span>
            <History className="size-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-display tabular-nums text-foreground">
              {overview.recentChangesCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">commits</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            Audited rule versions
          </p>
        </div>
      </div>

      {/* Segmented Status Distribution Track & Drill-Down Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Portfolio Health & Risk Distribution
            </h3>
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              · 1-click drill down to filter underlying rules
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setShowMetricDetails(!showMetricDetails)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Info className="size-3 text-primary" />
              <span>{showMetricDetails ? "Hide Definitions" : "Metric Definitions"}</span>
            </button>
            {activeStatusFilter !== "all" && (
              <SADAButton
                variant="ghost"
                size="sm"
                onClick={() => onSelectStatusFilter("all")}
                className="h-6 text-[10px] px-2 text-primary"
              >
                Reset Filter
              </SADAButton>
            )}
          </div>
        </div>

        {/* Segmented Distribution Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex p-0.5 gap-0.5">
            {overview.criticalCount > 0 && (
              <div
                onClick={() => onSelectStatusFilter("critical")}
                style={{ width: `${Math.max(criticalPct, 8)}%` }}
                className="h-full rounded-full bg-destructive hover:opacity-85 transition-opacity cursor-pointer"
                title={`Critical Breaches: ${overview.criticalCount} (${criticalPct}%)`}
              />
            )}
            {overview.warningCount > 0 && (
              <div
                onClick={() => onSelectStatusFilter("warning")}
                style={{ width: `${Math.max(warningPct, 8)}%` }}
                className="h-full rounded-full bg-amber-500 hover:opacity-85 transition-opacity cursor-pointer"
                title={`Warning Conditions: ${overview.warningCount} (${warningPct}%)`}
              />
            )}
            {overview.healthyCount > 0 && (
              <div
                onClick={() => onSelectStatusFilter("healthy")}
                style={{ width: `${Math.max(healthyPct, 15)}%` }}
                className="h-full rounded-full bg-emerald-500 hover:opacity-85 transition-opacity cursor-pointer"
                title={`Healthy & Compliant: ${overview.healthyCount} (${healthyPct}%)`}
              />
            )}
            {overview.configurationPolicyCount > 0 && (
              <div
                onClick={() => onSelectStatusFilter("config_only")}
                style={{ width: `${Math.max(policiesPct, 15)}%` }}
                className="h-full rounded-full bg-slate-400 dark:bg-slate-600 hover:opacity-85 transition-opacity cursor-pointer"
                title={`Configuration Policies: ${overview.configurationPolicyCount}`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectStatusFilter("critical")}
                className={`flex items-center gap-1.5 hover:text-foreground cursor-pointer ${
                  activeStatusFilter === "critical" ? "font-bold text-destructive" : ""
                }`}
              >
                <span className="size-2 rounded-full bg-destructive" />
                <span>Critical: {overview.criticalCount}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectStatusFilter("warning")}
                className={`flex items-center gap-1.5 hover:text-foreground cursor-pointer ${
                  activeStatusFilter === "warning" ? "font-bold text-amber-500" : ""
                }`}
              >
                <span className="size-2 rounded-full bg-amber-500" />
                <span>Warnings: {overview.warningCount}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectStatusFilter("healthy")}
                className={`flex items-center gap-1.5 hover:text-foreground cursor-pointer ${
                  activeStatusFilter === "healthy" ? "font-bold text-emerald-500" : ""
                }`}
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Healthy: {overview.healthyCount}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectStatusFilter("config_only")}
                className={`flex items-center gap-1.5 hover:text-foreground cursor-pointer ${
                  activeStatusFilter === "config_only" ? "font-bold text-foreground" : ""
                }`}
              >
                <span className="size-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                <span>Policies: {overview.configurationPolicyCount}</span>
              </button>
            </div>

            <span className="text-[10px] font-mono text-muted-foreground/80">
              Evaluated: {new Date(overview.lastEvaluatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Metric Definitions Accordion */}
        {showMetricDetails && (
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground space-y-2 mt-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" />
              <span>Documented Calculation Sources (Zero Fabrication Guarantee)</span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] list-disc list-inside">
              <li>
                <strong>Cash Runway:</strong> Liquid bank cash reserves divided by recurring monthly subscriptions and fixed overhead.
              </li>
              <li>
                <strong>Fixed Burn Ratio:</strong> Monthly recurring software subscriptions divided by collected monthly revenue.
              </li>
              <li>
                <strong>Sponsoring Arbitrage:</strong> FX spread: (Client Invoicing Rate - Purchase Cost Rate) / Client Rate.
              </li>
              <li>
                <strong>Client Low Margin:</strong> Active client accounts delivering contribution margin below the configured floor.
              </li>
              <li>
                <strong>Tasks Due Soon:</strong> Active, incomplete production tasks with deadlines within the configured proximity horizon.
              </li>
              <li>
                <strong>Configuration Policies:</strong> Structural baselines (e.g. 160h standard labor hours) governing future calculations.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Category Risk Breakdown Track */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 me-1">
          Category Risk:
        </span>
        {Object.entries(overview.categoryRiskDistribution).map(([catKey, counts]) => {
          const hasRisk = counts.critical > 0 || counts.warning > 0;
          const isActive = activeCategory === catKey;
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => onSelectCategory(catKey as BusinessRuleCategory)}
              className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : hasRisk
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-card text-muted-foreground border-border hover:border-border/80 hover:text-foreground"
              }`}
            >
              <span className="capitalize">{catKey.replace("_", " ")}</span>
              {hasRisk ? (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white dark:text-black font-bold text-[10px] font-mono">
                  {counts.critical + counts.warning}
                </span>
              ) : (
                <span className="text-[10px] font-mono opacity-70">
                  {counts.total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
