import { useState } from "react";
import {
  FinancialClosingPeriod,
  FinancialSummaryKPIs,
  ClosingChecklist,
  formatCurrency,
  AuditLogEntry,
} from "@/types/finance";
import {
  closeFinancialPeriod,
  reopenFinancialPeriod,
} from "@/lib/finance-service";
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  History,
  FileCheck,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SADACheckbox, SADAInput } from "@/components/ui/sada-ui";
import { toast } from "sonner";

interface MonthlyClosingViewProps {
  currentPeriodMonth: string;
  closingPeriods: FinancialClosingPeriod[];
  kpis: FinancialSummaryKPIs;
  auditLogs: AuditLogEntry[];
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function MonthlyClosingView({
  currentPeriodMonth,
  closingPeriods,
  kpis,
  auditLogs,
  onRefresh,
  currentUserId,
  currentUserName,
}: MonthlyClosingViewProps) {
  const existingClosing = closingPeriods.find(
    (cp) => cp.periodMonth === currentPeriodMonth
  );
  const isPeriodClosed = existingClosing?.status === "closed";

  // Closing checklist state
  const [checklist, setChecklist] = useState<ClosingChecklist>({
    clientPaymentsRecorded: true,
    invoicesReconciled: true,
    sponsoringRecorded: true,
    commissionsCalculated: true,
    payrollProcessed: true,
    expensesReviewed: true,
    requestsReviewed: true,
    outstandingPaymentsChecked: true,
    profitCalculated: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reopening modal state
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  const toggleCheck = (key: keyof ClosingChecklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecksPassed = Object.values(checklist).every(Boolean);

  const handleClosePeriod = async () => {
    if (!allChecksPassed) {
      toast.error("Please confirm all checklist items before locking this financial period.");
      return;
    }

    setIsSubmitting(true);
    const res = await closeFinancialPeriod({
      periodMonth: currentPeriodMonth,
      checklist,
      summary: {
        revenue: kpis.revenue,
        expenses: kpis.expenses,
        netProfit: kpis.netProfit,
        cash: kpis.cash,
        outstandingPayments: kpis.outstandingPayments,
      },
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Failed to close period: ${res.error.message}`);
    } else {
      toast.success(`Financial period ${currentPeriodMonth} locked successfully.`);
      onRefresh();
    }
  };

  const handleReopenPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      toast.error("Mandatory executive reason required to reopen a closed financial period.");
      return;
    }

    setIsReopening(true);
    const res = await reopenFinancialPeriod({
      periodMonth: currentPeriodMonth,
      reason: reopenReason.trim(),
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsReopening(false);

    if (res.error) {
      toast.error(`Failed to reopen period: ${res.error.message}`);
    } else {
      toast.success(`Financial period ${currentPeriodMonth} reopened.`);
      setIsReopenOpen(false);
      setReopenReason("");
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Monthly Closing Command Header */}
      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl border ${
              isPeriodClosed
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {isPeriodClosed ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-display text-foreground">
                Period Reconciliation: {currentPeriodMonth}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  isPeriodClosed
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {isPeriodClosed ? "PERIOD CLOSED & LOCKED" : "PERIOD OPEN"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {isPeriodClosed
                ? `Locked on ${existingClosing?.closedAt || "N/A"}. Historical records protected against modification.`
                : "Open for operational entries. Complete reconciliation checklist below before closing."}
            </p>
          </div>
        </div>

        <div>
          {isPeriodClosed ? (
            <button
              onClick={() => setIsReopenOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-500/30"
            >
              <Unlock className="size-3.5" />
              <span>Executive Reopen Period</span>
            </button>
          ) : (
            <button
              onClick={handleClosePeriod}
              disabled={isSubmitting || !allChecksPassed}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              <Lock className="size-3.5" />
              <span>{isSubmitting ? "Locking..." : "Close & Lock Period"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Reconciliation Checklist & Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Checklist */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <FileCheck className="size-4 text-primary" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              Period Closing Checklist
            </h4>
          </div>

          <div className="space-y-2.5 text-xs font-sans">
            {[
              { key: "clientPaymentsRecorded", label: "All client payments & receipts recorded" },
              { key: "invoicesReconciled", label: "All client billing invoices reconciled" },
              { key: "sponsoringRecorded", label: "All USD ad campaigns & spend debited" },
              { key: "commissionsCalculated", label: "All sales commissions computed on service revenue" },
              { key: "payrollProcessed", label: "Team salaries and compensation reviewed" },
              { key: "expensesReviewed", label: "Direct operating & recurring expenses audited" },
              { key: "requestsReviewed", label: "All worker advance requests reviewed & resolved" },
              { key: "outstandingPaymentsChecked", label: "Outstanding receivables identified" },
              { key: "profitCalculated", label: "Net Profit mathematical formula verified" },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/30"
              >
                <SADACheckbox
                  checked={checklist[item.key as keyof ClosingChecklist]}
                  disabled={isPeriodClosed}
                  onCheckedChange={() => toggleCheck(item.key as keyof ClosingChecklist)}
                  label={
                    <span
                      className={
                        checklist[item.key as keyof ClosingChecklist]
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {item.label}
                    </span>
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Snapshot Summary */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <History className="size-4 text-primary" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              Period Snapshot State
            </h4>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground">Total Period Revenue:</span>
              <span className="font-bold text-foreground">{formatCurrency(kpis.revenue)}</span>
            </div>

            <div className="flex justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground">Total Period Expenses:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(kpis.expenses)}
              </span>
            </div>

            <div className="flex justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-primary font-bold">Calculated Net Profit:</span>
              <span className="font-bold text-primary">{formatCurrency(kpis.netProfit)}</span>
            </div>

            <div className="flex justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground">Treasury Cash on Hand:</span>
              <span className="font-bold text-foreground">{formatCurrency(kpis.cash)}</span>
            </div>

            <div className="flex justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground">Outstanding Receivables:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(kpis.outstandingPayments)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Financial Audit Trail (Section 17) */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/50 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              Financial Audit Log (Who, What, When, Reason)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {auditLogs.length} Immutable Log Entries
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs font-mono">
            No audit logs recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-muted text-[11px] font-mono uppercase text-muted-foreground border-b border-border/70">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                      {log.actor_name || "System"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px] font-bold border border-border/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {log.entity_type}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground truncate max-w-xs">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REOPEN PERIOD EXECUTIVE MODAL */}
      <Dialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
        <DialogContent className="max-w-md w-[94vw] p-6 rounded-3xl bg-card border border-rose-500/40 shadow-2xl">
          <DialogHeader className="text-left pb-3 border-b border-border/50">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="size-5" />
              <DialogTitle className="text-lg font-bold font-display text-foreground">
                Executive Period Reopening
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Reopening historical financial period {currentPeriodMonth}. An immutable audit trail entry will be created.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReopenPeriod} className="space-y-4 mt-2">
            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Mandatory Audit Reason
              </label>
              <SADAInput
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Discovered post-period ad spend adjustment from Meta..."
                className="text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={() => setIsReopenOpen(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReopening}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                {isReopening ? "Unlocking..." : "Authorize Reopening"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
