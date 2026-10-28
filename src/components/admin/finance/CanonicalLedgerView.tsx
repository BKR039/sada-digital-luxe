import { useState, useMemo } from "react";
import {
  CanonicalFinancialTransaction,
  FinancialAllocation,
  formatCurrency,
  formatAllocationLabel,
} from "@/types/finance";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Building,
  User,
  Download,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { SADASearch } from "@/components/ui/sada-search";
import { SADASelect } from "@/components/ui/sada-select";
import { SADAButton, SADAEmptyState } from "@/components/ui/sada-ui";

interface CanonicalLedgerViewProps {
  transactions: CanonicalFinancialTransaction[];
  onRefresh: () => void;
  onExport: () => void;
  onSelectEntity?: (type: "client" | "invoice" | "campaign" | "member", id: string) => void;
}

export function CanonicalLedgerView({
  transactions,
  onRefresh,
  onExport,
  onSelectEntity,
}: CanonicalLedgerViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [allocationFilter, setAllocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // Direction
      if (directionFilter !== "all" && tx.direction !== directionFilter) {
        return false;
      }
      // Allocation
      if (allocationFilter !== "all" && tx.allocation !== allocationFilter) {
        return false;
      }
      // Status
      if (statusFilter !== "all") {
        if (statusFilter === "settled" && tx.status !== "received" && tx.status !== "paid") return false;
        if (statusFilter === "pending" && tx.status !== "pending") return false;
      }
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          tx.description.toLowerCase().includes(term) ||
          (tx.clientName && tx.clientName.toLowerCase().includes(term)) ||
          (tx.teamMemberName && tx.teamMemberName.toLowerCase().includes(term)) ||
          (tx.vendor && tx.vendor.toLowerCase().includes(term)) ||
          (tx.reference && tx.reference.toLowerCase().includes(term)) ||
          (tx.categoryName ? tx.categoryName.toLowerCase().includes(term) : false);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, directionFilter, allocationFilter, statusFilter, searchTerm]);

  // Totals for current filtered set
  const totalInflow = filtered
    .filter((t) => t.direction === "inflow")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalOutflow = filtered
    .filter((t) => t.direction === "outflow")
    .reduce((acc, t) => acc + t.amount, 0);

  const netBalance = totalInflow - totalOutflow;

  return (
    <div className="space-y-4">
      {/* Top Filter and Overview Card */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Unified Canonical Ledger</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Immutable journal uniting customer invoices, operational inflows, expenses, payroll, and sponsoring.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SADAButton
              size="sm"
              variant="secondary"
              onClick={onExport}
              leftIcon={<Download className="size-3.5 text-muted-foreground" />}
              className="text-xs font-mono"
            >
              Export Ledger
            </SADAButton>
            <SADAButton
              size="sm"
              variant="secondary"
              onClick={onRefresh}
              leftIcon={<ArrowUpDown className="size-3.5 text-primary" />}
              className="text-xs font-mono text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
            >
              Refresh
            </SADAButton>
          </div>
        </div>

        {/* Filter Controls with SADASelect and SADASearch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-border/50">
          <div>
            <SADASearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search description, client, vendor..."
              size="compact"
            />
          </div>

          <div>
            <SADASelect
              value={directionFilter}
              onChange={setDirectionFilter}
              placeholder="Flow Direction"
              size="compact"
              options={[
                { value: "all", label: "All Movements" },
                { value: "inflow", label: "Inflows (+)" },
                { value: "outflow", label: "Outflows (-)" },
              ]}
            />
          </div>

          <div>
            <SADASelect
              value={allocationFilter}
              onChange={setAllocationFilter}
              placeholder="Financial Allocation"
              size="compact"
              options={[
                { value: "all", label: "All Allocations" },
                { value: "client_services", label: "Client Retainers / Services" },
                { value: "sponsoring_collected", label: "Sponsoring Collected" },
                { value: "sponsoring_purchase", label: "Sponsoring Ad Purchases" },
                { value: "payroll", label: "Team Payroll & Advances" },
                { value: "sales_commission", label: "Sales Commissions" },
                { value: "operating_expense", label: "Operating & SaaS Expenses" },
                { value: "other_income", label: "Other Income" },
              ]}
            />
          </div>

          <div>
            <SADASelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Settlement Status"
              size="compact"
              options={[
                { value: "all", label: "All Statuses" },
                { value: "settled", label: "Settled (Received / Paid)" },
                { value: "pending", label: "Pending Execution" },
              ]}
            />
          </div>
        </div>

        {/* Live Filter Summary Pills */}
        <div className="flex items-center justify-between text-xs font-mono pt-1 text-muted-foreground border-t border-border/40 flex-wrap gap-2">
          <span>Showing {filtered.length} of {transactions.length} records</span>
          <div className="flex items-center gap-3">
            <span className="text-emerald-600 dark:text-emerald-400">
              Inflows: +{formatCurrency(totalInflow)}
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              Outflows: -{formatCurrency(totalOutflow)}
            </span>
            <span className="font-bold text-foreground">
              Net: {netBalance >= 0 ? "+" : ""}{formatCurrency(netBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12">
            <SADAEmptyState
              icon={Layers}
              title="No Ledger Records Found"
              description="No financial transactions match your selected search criteria and filters."
              action={
                searchTerm || directionFilter !== "all" || allocationFilter !== "all"
                  ? {
                      label: "Reset Filters",
                      onClick: () => {
                        setSearchTerm("");
                        setDirectionFilter("all");
                        setAllocationFilter("all");
                        setStatusFilter("all");
                      },
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border/40">
              {filtered.map((tx) => {
                const isInflow = tx.direction === "inflow";
                return (
                  <div key={tx.id} className="p-4 space-y-2.5 text-start">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isInflow
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="size-3" />
                          ) : (
                            <ArrowUpRight className="size-3" />
                          )}
                          {isInflow ? "INFLOW" : "OUTFLOW"}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground" dir="ltr">
                          {tx.date}
                        </span>
                      </div>

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
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-foreground font-sans text-xs min-w-0 pr-2">
                        {tx.description}
                      </div>
                      <span
                        className={`text-base font-bold font-mono shrink-0 ${
                          isInflow
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                        dir="ltr"
                      >
                        {isInflow ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <span className="px-1.5 py-0.5 rounded bg-muted border border-border/60">
                        {formatAllocationLabel(tx.allocation as FinancialAllocation)}
                      </span>
                      {tx.categoryName && (
                        <span className="text-muted-foreground font-mono">{tx.categoryName}</span>
                      )}
                      {tx.clientName && (
                        <div className="flex items-center gap-1 text-primary">
                          <Building className="size-3 shrink-0" />
                          <span className="truncate">{tx.clientName}</span>
                        </div>
                      )}
                      {tx.teamMemberName && (
                        <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <User className="size-3 shrink-0" />
                          <span className="truncate">{tx.teamMemberName}</span>
                        </div>
                      )}
                      {tx.vendor && !tx.clientName && !tx.teamMemberName && (
                        <span className="truncate">{tx.vendor}</span>
                      )}
                      {tx.reference && (
                        <span className="font-mono text-muted-foreground/80" dir="ltr">Ref: {tx.reference}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/70 text-[11px] font-mono uppercase text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Flow</th>
                    <th className="p-3.5">Description & Allocation</th>
                    <th className="p-3.5">Client / Member / Vendor</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filtered.map((tx) => {
                    const isInflow = tx.direction === "inflow";
                    return (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 text-muted-foreground whitespace-nowrap text-[11px]">
                          {tx.date}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isInflow
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {isInflow ? (
                              <ArrowDownLeft className="size-3" />
                            ) : (
                              <ArrowUpRight className="size-3" />
                            )}
                            {isInflow ? "INFLOW" : "OUTFLOW"}
                          </span>
                        </td>

                        <td className="p-3.5 max-w-sm">
                          <div className="font-semibold text-foreground truncate font-sans">
                            {tx.description}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span className="px-1.5 py-0.5 rounded bg-muted border border-border/60">
                              {formatAllocationLabel(tx.allocation as FinancialAllocation)}
                            </span>
                            {tx.reference && (
                              <span className="truncate">Ref: {tx.reference}</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5 text-muted-foreground text-[11px]">
                          {tx.clientName && (
                            <div className="flex items-center gap-1 text-primary">
                              <Building className="size-3 shrink-0" />
                              <span className="truncate">{tx.clientName}</span>
                            </div>
                          )}
                          {tx.teamMemberName && (
                            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                              <User className="size-3 shrink-0" />
                              <span className="truncate">{tx.teamMemberName}</span>
                            </div>
                          )}
                          {tx.vendor && !tx.clientName && !tx.teamMemberName && (
                            <span className="truncate block">{tx.vendor}</span>
                          )}
                          {!tx.clientName && !tx.teamMemberName && !tx.vendor && (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-muted-foreground text-[11px] whitespace-nowrap">
                          {tx.categoryName}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
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

                        <td className="p-3.5 text-right whitespace-nowrap font-bold text-xs">
                          <span
                            className={
                              isInflow
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
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
  );
}
