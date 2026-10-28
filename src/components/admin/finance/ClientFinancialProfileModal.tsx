import {
  ClientProfitabilityRecord,
  CanonicalFinancialTransaction,
  formatCurrency,
  formatAllocationLabel,
} from "@/types/finance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface ClientFinancialProfileModalProps {
  record: ClientProfitabilityRecord | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: CanonicalFinancialTransaction[];
}

function safeFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const p = parseISO(d);
    if (isNaN(p.getTime())) return d;
    return format(p, "MMM d, yyyy");
  } catch {
    return d || "—";
  }
}

export function ClientFinancialProfileModal({
  record,
  isOpen,
  onClose,
  transactions,
}: ClientFinancialProfileModalProps) {
  if (!record) return null;

  // Filter transactions belonging to this client
  const clientTransactions = transactions.filter(
    (t) => t.clientId === record.clientId
  );

  const isHigh = record.health === "HIGH PROFIT";
  const isMedium = record.health === "MEDIUM";
  const isNoData = record.health === "NO DATA";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[85vh] overflow-y-auto rounded-3xl bg-card border-border/80 shadow-2xl p-6 sm:p-7">
        <DialogHeader className="space-y-1.5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
                <Building className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                  <span>{record.clientName}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isHigh
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : isMedium
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        : isNoData
                        ? "bg-muted text-muted-foreground border border-border/80"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {record.health}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  {record.industry || "General Client"} • {record.clientType === "monthly" ? "Monthly Retainer" : "One-Off Project"}
                </DialogDescription>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">
                Payment Status
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold mt-0.5 ${
                  record.paymentStatus === "PAID"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : record.paymentStatus === "OVERDUE"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                {record.paymentStatus === "PAID" ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <Clock className="size-3" />
                )}
                {record.paymentStatus}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* 1. Core Financial Profile Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              Total Revenue
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-0.5 block">
              {formatCurrency(record.totalRevenue)}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Pkg: {formatCurrency(record.monthlyPackage)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              Service Fee
            </span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {formatCurrency(record.serviceRevenue)}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Retainer Services
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              Sponsoring Budget
            </span>
            <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 block">
              {formatCurrency(record.sponsoringBudget)}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Cost: {formatCurrency(record.sponsoringCost)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-300 block font-semibold">
              Contribution Profit
            </span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {formatCurrency(record.contributionProfit)}
            </span>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-mono">
              Margin: {record.marginPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* 2. Mathematical Contribution Breakdown */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-border/50 font-semibold text-foreground">
            <span>Client Financial Lineage & Arbitrage</span>
            <span className="font-mono text-[11px] text-muted-foreground">Mathematical Waterfall</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-foreground">
              <span className="text-muted-foreground">Service Revenue</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(record.serviceRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between text-foreground">
              <span className="text-muted-foreground">
                Sponsoring Margin ({formatCurrency(record.sponsoringBudget)} - {formatCurrency(record.sponsoringCost)} cost)
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                +{formatCurrency(record.sponsoringMargin)}
              </span>
            </div>

            <div className="flex items-center justify-between text-foreground">
              <span className="text-muted-foreground">Sales Commission Paid</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                -{formatCurrency(record.commission)}
              </span>
            </div>

            {record.directCost > 0 && (
              <div className="flex items-center justify-between text-foreground">
                <span className="text-muted-foreground">Direct Production Costs</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  -{formatCurrency(record.directCost)}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold">
              <span className="text-foreground">Net Contribution Profit</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {formatCurrency(record.contributionProfit)} ({record.marginPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
              <span>Outstanding Receivable (Due)</span>
              <span className={record.due > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                {record.due > 0 ? formatCurrency(record.due) : "0 TND (Settled)"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Underlying Canonical Transactions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Receipt className="size-3.5 text-primary" />
              <span>Underlying Transaction History ({clientTransactions.length})</span>
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Authoritative Database Records
            </span>
          </div>

          <div className="rounded-2xl border border-border/80 overflow-hidden bg-muted/20">
            {clientTransactions.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-muted-foreground">
                No individual ledger transactions tied directly to this client yet.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-border/40 text-xs font-mono">
                {clientTransactions.map((tx) => {
                  const isInflow = tx.direction === "inflow";
                  return (
                    <div
                      key={tx.id}
                      className="p-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`size-7 rounded-lg grid place-items-center shrink-0 ${
                            isInflow
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="size-3.5" />
                          ) : (
                            <ArrowUpRight className="size-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-sans font-medium text-foreground text-xs truncate">
                            {tx.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {safeFormatDate(tx.date)} • {formatAllocationLabel(tx.allocation)} • {tx.paymentMethod}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-bold ${
                            isInflow
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isInflow ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground uppercase">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
