import React from "react";
import { formatCurrency } from "@/types/finance";
import type { CashFlowReport } from "@/types/notifications-and-audit";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Lock,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";

interface CashFlowTreasuryViewProps {
  cashFlow: CashFlowReport;
  onOpenDrillDown?: (metricType: string, label: string, value: string | number) => void;
}

export function CashFlowTreasuryView({
  cashFlow,
  onOpenDrillDown,
}: CashFlowTreasuryViewProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const {
    cashInflows,
    cashOutflows,
    netCashFlow,
    currentCashAtBank,
    outstandingInvoices,
    pendingSalaryAdvanceRequests,
    accountBalances,
  } = cashFlow;

  return (
    <div className="p-3 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3 sm:space-y-4 text-start">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-500 shrink-0" />
            <h3 className="font-bold text-xs sm:text-sm font-heading text-foreground">
              {isAr ? "ديناميكية التدفقات النقدية والخزينة" : "Cash Flow & Treasury Dynamics"}
            </h3>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono mt-0.5 line-clamp-1 sm:line-clamp-none">
            {isAr
              ? "حركة المقبوضات والمدفوعات وصافي التدفق النقدي للأرصدة البنكية الحقيقية"
              : "Verified cash movements across active bank accounts and liquid treasuries"}
          </p>
        </div>

        <Badge variant="outline" className="font-mono text-[10px] sm:text-xs text-emerald-500 border-emerald-500/20 bg-emerald-500/5 self-start sm:self-auto px-2 py-0.5">
          {isAr ? `إجمالي الخزينة: ${formatCurrency(currentCashAtBank)}` : `Treasury Total: ${formatCurrency(currentCashAtBank)}`}
        </Badge>
      </div>

      {/* Primary Movement Cards - 3 side-by-side compact columns on mobile */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <div
          onClick={() => onOpenDrillDown?.("monthly_revenue", isAr ? "التدفقات النقدية الداخلة" : "Cash Inflows", cashInflows)}
          className="p-2 sm:p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 cursor-pointer hover:border-emerald-500/40 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <span className="truncate">{isAr ? "المقبوضات" : "Inflows (+)"}</span>
            <TrendingUp className="size-3 sm:size-3.5 shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400 truncate">
            {formatCurrency(cashInflows)}
          </div>
        </div>

        <div
          onClick={() => onOpenDrillDown?.("monthly_expenses", isAr ? "المدفوعات الخارجة" : "Cash Outflows", cashOutflows)}
          className="p-2 sm:p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 cursor-pointer hover:border-rose-500/40 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-rose-600 dark:text-rose-400">
            <span className="truncate">{isAr ? "المدفوعات" : "Outflows (-)"}</span>
            <TrendingDown className="size-3 sm:size-3.5 shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-bold font-mono mt-1 text-rose-600 dark:text-rose-400 truncate">
            {formatCurrency(cashOutflows)}
          </div>
        </div>

        <div className="p-2 sm:p-3.5 rounded-xl bg-card border border-border/70">
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-muted-foreground">
            <span className="truncate">{isAr ? "الصافي" : "Net Flow"}</span>
            <ArrowRightLeft className="size-3 sm:size-3.5 shrink-0" />
          </div>
          <div className={`text-xs sm:text-lg font-bold font-mono mt-1 truncate ${netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {formatCurrency(netCashFlow)}
          </div>
        </div>
      </div>

      {/* Account Balances Grid */}
      <div className="space-y-1.5 sm:space-y-2 pt-1">
        <h4 className="text-[10px] sm:text-xs font-mono font-bold uppercase text-muted-foreground">
          {isAr ? "توزيع الأرصدة عبر الحسابات البنكية والخزائن" : "Treasury Accounts Breakdown"}
        </h4>

        {accountBalances.length === 0 ? (
          <p className="text-xs font-mono text-muted-foreground py-2">
            {isAr ? "لا توجد حسابات خزينة مسجلة" : "No active treasury accounts registered"}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2.5">
            {accountBalances.map((acc) => (
              <div
                key={acc.accountId}
                className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between font-mono text-[11px] sm:text-xs"
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="size-5 sm:size-6 rounded-md sm:rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="size-2.5 sm:size-3" />
                  </div>
                  <span className="font-semibold text-foreground truncate">{acc.accountName}</span>
                </div>
                <span className="font-bold text-foreground shrink-0 ms-2">
                  {formatCurrency(acc.balance, { currency: acc.currency })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
