import { FinancialSummaryKPIs, formatCurrency, DrillDownCategory } from "@/types/finance";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Users,
  CreditCard,
  Clock,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface FinanceKPICardsProps {
  kpis: FinancialSummaryKPIs;
  periodLabel: string;
  onDrillDown?: (category: DrillDownCategory) => void;
}

export function FinanceKPICards({
  kpis,
  periodLabel,
  onDrillDown,
}: FinanceKPICardsProps) {
  const isNetPositive = kpis.netProfit >= 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1 text-xs text-muted-foreground font-mono">
        <span className="uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary shrink-0" />
          Financial Command Center KPIs
        </span>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Click any card to inspect mathematical derivation & underlying transactions
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. REVENUE */}
        <button
          type="button"
          onClick={() => onDrillDown?.("revenue")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              Revenue
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
              <ArrowDownLeft className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {formatCurrency(kpis.revenue)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            {kpis.revenueDeltaPercent !== null ? (
              <span
                className={`flex items-center gap-1 font-semibold tabular-nums ${
                  kpis.revenueDeltaPercent >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500"
                }`}
              >
                {kpis.revenueDeltaPercent >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {Math.abs(Math.round(kpis.revenueDeltaPercent))}% vs prev
              </span>
            ) : (
              <span className="text-muted-foreground truncate">
                Services: {formatCurrency(kpis.clientServicesRevenue)}
              </span>
            )}

            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Drill <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 2. EXPENSES */}
        <button
          type="button"
          onClick={() => onDrillDown?.("expenses")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              Expenses
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform shrink-0">
              <ArrowUpRight className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {formatCurrency(kpis.expenses)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            {kpis.expenseDeltaPercent !== null ? (
              <span
                className={`flex items-center gap-1 font-semibold tabular-nums ${
                  kpis.expenseDeltaPercent <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500"
                }`}
              >
                {kpis.expenseDeltaPercent <= 0 ? (
                  <TrendingDown className="size-3" />
                ) : (
                  <TrendingUp className="size-3" />
                )}
                {Math.abs(Math.round(kpis.expenseDeltaPercent))}% vs prev
              </span>
            ) : (
              <span className="text-muted-foreground truncate">Operating + Ad Spend</span>
            )}

            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Drill <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 3. NET PROFIT (Strictly Calculated) */}
        <button
          type="button"
          onClick={() => onDrillDown?.("net_profit")}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border shadow-xs relative overflow-hidden group hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full ${
            isNetPositive
              ? "bg-card border-border/70 hover:border-emerald-500/50"
              : "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50"
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              <span className="sm:hidden">Net Profit</span>
              <span className="hidden sm:inline">Net Profit [Calculated]</span>
            </span>
            <div
              className={`p-1.5 sm:p-2 rounded-xl border group-hover:scale-105 transition-transform shrink-0 ${
                isNetPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}
            >
              <Scale className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div
              className={`text-xl sm:text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi ${
                isNetPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatCurrency(kpis.netProfit, { showSign: true })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            <span className="text-muted-foreground truncate">
              {kpis.revenue > 0
                ? `${Math.round((kpis.netProfit / kpis.revenue) * 100)}% margin`
                : "Operational Result"}
            </span>

            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Formula <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 4. CASH */}
        <button
          type="button"
          onClick={() => onDrillDown?.("cash")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-cyan-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              Cash on Hand
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
              <CreditCard className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {kpis.cashUsd && kpis.cashUsd > 0
                ? `${formatCurrency(kpis.cash, { currency: "TND" })} + ${formatCurrency(kpis.cashUsd, { currency: "USD" })}`
                : formatCurrency(kpis.cash, { currency: "TND" })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            <span className="text-muted-foreground truncate">Active Treasury</span>
            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Drill <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 5. OUTSTANDING PAYMENTS */}
        <button
          type="button"
          onClick={() => onDrillDown?.("outstanding")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              <span className="sm:hidden">Outstanding</span>
              <span className="hidden sm:inline">Outstanding Payments</span>
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Clock className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {formatCurrency(kpis.outstandingPayments)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            <span className="text-muted-foreground truncate">Pending Invoices</span>
            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Drill <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 6. SPONSORING MARGIN */}
        <button
          type="button"
          onClick={() => onDrillDown?.("sponsoring_margin")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              Sponsoring Margin
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Layers className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {formatCurrency(kpis.sponsoringMargin)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            <span className="text-muted-foreground truncate">
              Cost: {formatCurrency(kpis.sponsoringPurchasesCost)}
            </span>
            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Arbitrage <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 7. PAYROLL */}
        <button
          type="button"
          onClick={() => onDrillDown?.("payroll")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              Payroll
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Users className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {formatCurrency(kpis.payroll)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            <span className="text-muted-foreground truncate">
              {kpis.pendingSalaryRequestsCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                  {kpis.pendingSalaryRequestsCount} advance reqs
                </span>
              ) : (
                "Compensation"
              )}
            </span>
            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Drill <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>

        {/* 8. OPERATING EXPENSES */}
        <button
          type="button"
          onClick={() => onDrillDown?.("operating_expenses")}
          className="text-left p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs relative overflow-hidden group hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer min-w-0 max-w-full"
        >
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate min-w-0 flex-1">
              <span className="sm:hidden">OpEx</span>
              <span className="hidden sm:inline">Operating Expenses</span>
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Briefcase className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi">
              {formatCurrency(kpis.operatingExpenses)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono pt-2 border-t border-border/40">
            <span className="text-muted-foreground truncate">
              Fixed: {formatCurrency(kpis.recurringBurn)}/mo
            </span>
            <span className="text-primary font-sans text-[10px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Drill <ChevronRight className="size-2.5" />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
