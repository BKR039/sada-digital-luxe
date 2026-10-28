import {
  FinancialSummaryKPIs,
  DrillDownCategory,
  formatCurrency,
} from "@/types/finance";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Calculator,
  Layers,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";

interface FinanceRevenueAndProfitSummaryProps {
  kpis: FinancialSummaryKPIs;
  onDrillDown: (category: DrillDownCategory) => void;
}

export function FinanceRevenueAndProfitSummary({
  kpis,
  onDrillDown,
}: FinanceRevenueAndProfitSummaryProps) {
  const grossContribution =
    kpis.clientServicesRevenue + kpis.sponsoringMargin + kpis.otherRevenue;

  const profitMarginPercent =
    kpis.revenue > 0 ? ((kpis.netProfit / kpis.revenue) * 100).toFixed(1) : "0.0";

  const sponsoringMarginPercent =
    kpis.sponsoringCollected > 0
      ? ((kpis.sponsoringMargin / kpis.sponsoringCollected) * 100).toFixed(1)
      : "0.0";

  const payrollRatioPercent =
    kpis.expenses > 0 ? ((kpis.payroll / kpis.expenses) * 100).toFixed(1) : "0.0";

  const operatingRatioPercent =
    kpis.expenses > 0 ? ((kpis.operatingExpenses / kpis.expenses) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. REVENUE BREAKDOWN (Section 3) */}
      <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center border border-emerald-500/20">
                <ArrowDownLeft className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-display text-foreground">
                  Revenue Breakdown
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Realized collections by allocation • Click row to inspect
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono uppercase font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Inflows
            </span>
          </div>

          <div className="mt-4 space-y-2 font-mono text-xs">
            {/* Client Services */}
            <button
              onClick={() => onDrillDown("revenue")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-all text-left group border border-border/40"
            >
              <div className="flex items-center gap-2 font-sans">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Client Services
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  (Agency retainers & execution)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground tabular-nums">
                  {formatCurrency(kpis.clientServicesRevenue)}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Sponsoring Collected */}
            <button
              onClick={() => onDrillDown("sponsoring_margin")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-all text-left group border border-border/40"
            >
              <div className="flex items-center gap-2 font-sans">
                <span className="size-2 rounded-full bg-indigo-500" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Sponsoring Collected
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  (Meta / Google client budget)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {formatCurrency(kpis.sponsoringCollected)}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Other Revenue */}
            <button
              onClick={() => onDrillDown("revenue")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-all text-left group border border-border/40"
            >
              <div className="flex items-center gap-2 font-sans">
                <span className="size-2 rounded-full bg-cyan-500" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Other Revenue
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  (Consulting / one-off fees)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground tabular-nums">
                  {formatCurrency(kpis.otherRevenue)}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* Total Collected */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between font-mono">
          <span className="font-sans font-bold text-xs uppercase text-muted-foreground tracking-wider">
            Total Collected
          </span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums sada-num-metric">
            {formatCurrency(kpis.revenue)}
          </span>
        </div>
      </div>

      {/* 2. ACTUAL PROFIT & CONTRIBUTION WATERFALL (Section 4) */}
      <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center border border-purple-500/20">
                <Calculator className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-display text-foreground">
                  Actual Net Profit Waterfall
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Calculated strictly by formula • Zero hardcoded profit
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono uppercase font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              Contribution
            </span>
          </div>

          <div className="mt-3 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between text-muted-foreground px-2 py-1">
              <span>Client Services Revenue</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatCurrency(kpis.clientServicesRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground px-2 py-1">
              <span className="flex items-center gap-1.5">
                <span>Sponsoring Margin</span>
                <span className="text-[10px] text-muted-foreground font-sans bg-muted px-1.5 rounded">
                  {sponsoringMarginPercent}% margin
                </span>
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                +{formatCurrency(kpis.sponsoringMargin)}
              </span>
            </div>

            {kpis.otherRevenue > 0 && (
              <div className="flex items-center justify-between text-muted-foreground px-2 py-1">
                <span>Other Revenue</span>
                <span className="font-semibold text-foreground tabular-nums">
                  +{formatCurrency(kpis.otherRevenue)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between font-bold text-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
              <span>Gross Contribution</span>
              <span className="tabular-nums">{formatCurrency(grossContribution)}</span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground px-2 py-1">
              <span>Sales Commissions</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                -{formatCurrency(kpis.salesCommissionsCost)}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground px-2 py-1">
              <span>Direct Operating Expenses</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                -{formatCurrency(kpis.operatingExpenses)}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground px-2 py-1">
              <span>Payroll & Salaries</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                -{formatCurrency(kpis.payroll)}
              </span>
            </div>
          </div>
        </div>

        {/* Calculated Net Profit */}
        <button
          onClick={() => onDrillDown("net_profit")}
          className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between font-mono hover:opacity-90 transition-opacity w-full text-left group"
        >
          <div className="flex items-center gap-1.5 font-sans">
            <span className="font-bold text-xs uppercase text-foreground tracking-wider group-hover:text-primary transition-colors">
              Calculated Net Profit
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              ({profitMarginPercent}% Margin)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-purple-600 dark:text-purple-400 tabular-nums sada-num-metric">
              {formatCurrency(kpis.netProfit)}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
