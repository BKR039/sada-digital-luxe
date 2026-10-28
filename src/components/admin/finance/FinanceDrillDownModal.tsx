import { useState } from "react";
import {
  DrillDownState,
  formatCurrency,
  formatAllocationLabel,
} from "@/types/finance";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Clock,
  Layers,
  Building,
  User,
  ShieldCheck,
  X,
} from "lucide-react";
import { SADASearch } from "@/components/ui/sada-search";
import { SADAEmptyState } from "@/components/ui/sada-ui";
import { Button } from "@/components/ui/button";

interface FinanceDrillDownModalProps {
  drillDown: DrillDownState | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity?: (type: "client" | "invoice" | "campaign" | "member", id: string) => void;
}

export function FinanceDrillDownModal({
  drillDown,
  isOpen,
  onClose,
  onSelectEntity,
}: FinanceDrillDownModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!drillDown) return null;

  const filteredTransactions = drillDown.transactions.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.description.toLowerCase().includes(term) ||
      (t.clientName && t.clientName.toLowerCase().includes(term)) ||
      (t.teamMemberName && t.teamMemberName.toLowerCase().includes(term)) ||
      (t.reference && t.reference.toLowerCase().includes(term)) ||
      (t.categoryName && t.categoryName.toLowerCase().includes(term)) ||
      (t.allocation && t.allocation.toLowerCase().includes(term))
    );
  });

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 dark:bg-black/65 backdrop-blur-[2px] data-[state=open]:animate-[sada-overlay-in_150ms_ease-out] data-[state=closed]:animate-[sada-overlay-out_100ms_ease-in]" />
        <DialogPrimitive.Content
          className="fixed z-50 bg-card text-foreground border-border shadow-2xl flex flex-col outline-none overflow-hidden max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[90dvh] max-sm:w-full max-sm:rounded-t-[28px] max-sm:border-t sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-4xl sm:w-[94vw] sm:rounded-3xl sm:border sm:max-h-[88vh] data-[state=open]:animate-[sada-drawer-in-bottom_180ms_ease-out] sm:data-[state=open]:animate-[sada-dialog-in_120ms_ease-out]"
        >
          {/* Mobile Drag Handle */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />

          {/* Header */}
          <div className="px-4 sm:px-6 pt-1 pb-3 sm:py-4 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Calculator className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-base sm:text-xl font-bold font-display text-foreground tracking-tight truncate">
                    {drillDown.title}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-[11px] sm:text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                    <span>Period: {drillDown.periodLabel}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="size-3" /> Authoritative Ledger Trace
                    </span>
                  </DialogPrimitive.Description>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                    Calculated Total
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums">
                    {formatCurrency(drillDown.totalAmount)}
                  </div>
                </div>
                <DialogPrimitive.Close
                  onClick={onClose}
                  className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 outline-none ms-1"
                >
                  <X className="size-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 min-h-0 sada-scrollbar">
            {/* 1. Mathematical Formula Breakdown */}
            {drillDown.formulaBreakdown && drillDown.formulaBreakdown.length > 0 && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-muted/30 border border-border/70 space-y-2.5">
                <div className="text-xs font-mono font-semibold uppercase text-muted-foreground tracking-wider flex items-center justify-between">
                  <span>Mathematical Derivation Formula</span>
                  <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md font-sans">
                    Real-Time Aggregation
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                  {drillDown.formulaBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        item.highlight
                          ? "bg-card font-bold border-primary/40 text-primary shadow-xs md:col-span-2"
                          : "bg-background/80 border-border/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`size-5 rounded-md grid place-items-center text-xs font-bold ${
                            item.operator === "+"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.operator === "-"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {item.operator}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>

                      <span className="font-semibold tabular-nums shrink-0 ml-2">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Underlying Canonical Transactions Ledger */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs font-mono font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                  <Layers className="size-3.5 text-primary" />
                  <span>
                    Underlying Authoritative Records ({filteredTransactions.length})
                  </span>
                </div>

                <div className="w-full sm:w-64">
                  <SADASearch
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Filter transactions..."
                    size="compact"
                  />
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-border/70 text-center">
                  <SADAEmptyState
                    title="No Matching Records"
                    description="No transaction rows matched your filter in this calculation scope."
                  />
                </div>
              ) : (
                <>
                  {/* Mobile Structured Transaction Cards (< md) */}
                  <div className="md:hidden space-y-2.5">
                    {filteredTransactions.map((tx) => {
                      const isInflow = tx.direction === "inflow";
                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-xl sm:rounded-2xl bg-card border border-border/70 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono text-muted-foreground" dir="ltr">
                              {tx.date}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                              {formatAllocationLabel(tx.allocation)}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-foreground leading-snug">
                            {tx.description}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate max-w-[160px]">
                              {tx.clientName ? (
                                <button
                                  type="button"
                                  onClick={() => tx.clientId && onSelectEntity?.("client", tx.clientId)}
                                  className="inline-flex items-center gap-1 text-foreground hover:text-primary truncate"
                                >
                                  <Building className="size-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{tx.clientName}</span>
                                </button>
                              ) : tx.teamMemberName ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground truncate">
                                  <User className="size-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{tx.teamMemberName}</span>
                                </span>
                              ) : (
                                <span>{tx.vendor || "Agency Operational"}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  tx.status === "received" || tx.status === "paid"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : tx.status === "pending"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {tx.status}
                              </span>

                              <span
                                className={`font-mono font-bold ${
                                  isInflow
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {isInflow ? "+" : "-"}
                                {formatCurrency(tx.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (hidden md:block) */}
                  <div className="hidden md:block rounded-2xl border border-border/70 bg-card overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/40 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                          <th className="p-3">Date</th>
                          <th className="p-3">Description & Allocation</th>
                          <th className="p-3">Source / Owner</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {filteredTransactions.map((tx) => {
                          const isInflow = tx.direction === "inflow";
                          return (
                            <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                              <td className="p-3 text-muted-foreground whitespace-nowrap text-[11px]">
                                {tx.date}
                              </td>
                              <td className="p-3 max-w-xs">
                                <div className="font-sans font-medium text-foreground text-xs truncate">
                                  {tx.description}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                                    {formatAllocationLabel(tx.allocation)}
                                  </span>
                                  {tx.paymentMethod && (
                                    <span className="text-[10px] text-muted-foreground">
                                      via {tx.paymentMethod}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-xs">
                                {tx.clientName && (
                                  <button
                                    type="button"
                                    onClick={() => tx.clientId && onSelectEntity?.("client", tx.clientId)}
                                    className="inline-flex items-center gap-1 text-[11px] text-foreground font-medium hover:text-primary transition-colors text-left"
                                  >
                                    <Building className="size-3 text-muted-foreground shrink-0" />
                                    <span className="truncate max-w-[120px]">{tx.clientName}</span>
                                  </button>
                                )}
                                {tx.teamMemberName && (
                                  <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <User className="size-3 text-muted-foreground shrink-0" />
                                    <span className="truncate max-w-[120px]">{tx.teamMemberName}</span>
                                  </div>
                                )}
                                {!tx.clientName && !tx.teamMemberName && (
                                  <span className="text-muted-foreground text-[11px]">
                                    {tx.vendor || "Agency Operational"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    tx.status === "received" || tx.status === "paid"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : tx.status === "pending"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  }`}
                                >
                                  {tx.status === "received" || tx.status === "paid" ? (
                                    <CheckCircle2 className="size-2.5" />
                                  ) : (
                                    <Clock className="size-2.5" />
                                  )}
                                  {tx.status}
                                </span>
                              </td>
                              <td className="p-3 text-right whitespace-nowrap font-bold">
                                <span
                                  className={`inline-flex items-center gap-0.5 ${
                                    isInflow
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {isInflow ? (
                                    <ArrowDownLeft className="size-3" />
                                  ) : (
                                    <ArrowUpRight className="size-3" />
                                  )}
                                  {isInflow ? "+" : "-"}
                                  {formatCurrency(tx.amount)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-border/50 bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="font-mono text-[11px]">
              Total Entries: {filteredTransactions.length}
            </div>
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full px-6 py-2 h-9 text-xs font-semibold border-border bg-card hover:bg-muted text-foreground shrink-0"
            >
              Close Drill-Down
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
