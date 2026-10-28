import { CashFlowStatement, formatCurrency, FinancialAccount } from "@/types/finance";
import {
  CreditCard,
  Building2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Landmark,
} from "lucide-react";

interface CashFlowAccountsViewProps {
  cashFlow: CashFlowStatement;
  accounts: FinancialAccount[];
  periodLabel: string;
  onRefresh: () => void;
}

export function CashFlowAccountsView({
  cashFlow,
  accounts,
  periodLabel,
  onRefresh,
}: CashFlowAccountsViewProps) {
  const activeAccounts = accounts.filter((a) => a.status === "active");
  const tndAccounts = activeAccounts.filter((a) => (a.currency || "TND") === "TND");
  const usdAccounts = activeAccounts.filter((a) => a.currency === "USD");
  const totalLiquidTnd = tndAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalLiquidUsd = usdAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <div className="space-y-6">
      {/* 1. Treasury Accounts Cards */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            <h3 className="text-sm font-bold font-display text-foreground">
              Treasury & Financial Accounts
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Total Liquid Cash:{" "}
            <strong className="text-foreground text-sm font-bold">
              {totalLiquidUsd > 0 ? (
                <span>
                  {formatCurrency(totalLiquidTnd, { currency: "TND" })}
                  <span className="text-muted-foreground mx-1.5">+</span>
                  {formatCurrency(totalLiquidUsd, { currency: "USD" })}
                </span>
              ) : (
                formatCurrency(totalLiquidTnd, { currency: "TND" })
              )}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  {acc.accountType === "bank" ? (
                    <Building2 className="size-3.5 text-blue-500" />
                  ) : acc.accountType === "cash" ? (
                    <Wallet className="size-3.5 text-amber-500" />
                  ) : (
                    <CreditCard className="size-3.5 text-purple-500" />
                  )}
                  {acc.accountName || acc.name}
                </span>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                  {acc.status}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-2xl font-bold font-display text-foreground tracking-tight">
                  {formatCurrency(acc.currentBalance, { currency: acc.currency })}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Opening: {formatCurrency(acc.openingBalance, { currency: acc.currency })}</span>
                <span className="font-bold">{acc.currency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Canonical Cash Flow Statement (Section 13) */}
      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold font-display text-foreground tracking-tight flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              Cash Flow Statement
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Period: {periodLabel} • Profit and Cash are distinct authoritative metrics
            </p>
          </div>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors border border-border/60"
          >
            <RefreshCw className="size-3" />
            <span>Recompute Statement</span>
          </button>
        </div>

        {/* The Formal Financial Statement */}
        <div className="space-y-2 font-mono text-xs max-w-2xl">
          {/* Opening Cash */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
            <span className="font-semibold text-muted-foreground">
              Opening Cash Balance
            </span>
            <span className="font-bold text-foreground tabular-nums">
              {formatCurrency(cashFlow.openingCash)}
            </span>
          </div>

          {/* Inflows Section */}
          <div className="pt-2">
            <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1">
              (+) Operating Cash Inflows
            </div>
            <div className="space-y-1.5 pl-2">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowDownLeft className="size-3 text-emerald-500" />
                  Client Collections (Services & Sponsoring)
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatCurrency(cashFlow.clientPayments)}
                </span>
              </div>

              {cashFlow.otherIncome > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDownLeft className="size-3 text-emerald-500" />
                    Other Operating Income
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{formatCurrency(cashFlow.otherIncome)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Outflows Section */}
          <div className="pt-2">
            <div className="text-[11px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400 px-2 py-1">
              (-) Operating Cash Outflows
            </div>
            <div className="space-y-1.5 pl-2">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight className="size-3 text-rose-500" />
                  Sponsoring USD Ad Purchases
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  -{formatCurrency(cashFlow.sponsoringPurchases)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight className="size-3 text-rose-500" />
                  Team Payroll & Advance Disbursements
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  -{formatCurrency(cashFlow.payroll)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight className="size-3 text-rose-500" />
                  Sales Commissions Paid
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  -{formatCurrency(cashFlow.commissions)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight className="size-3 text-rose-500" />
                  Direct Operating & SaaS Expenses
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  -{formatCurrency(cashFlow.operatingExpenses)}
                </span>
              </div>

              {cashFlow.withdrawals > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpRight className="size-3 text-rose-500" />
                    Shareholder / Owner Withdrawals
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    -{formatCurrency(cashFlow.withdrawals)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Closing Cash Calculated Summary */}
          <div className="pt-3 border-t-2 border-border/80">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-primary/30 shadow-xs font-bold text-sm">
              <span className="text-foreground font-display tracking-tight">
                (=) Closing Cash on Hand
              </span>
              <span className="text-primary font-display text-lg tabular-nums">
                {formatCurrency(cashFlow.closingCash)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
