import { useState, useMemo } from "react";
import {
  ClientProfitabilityRecord,
  CanonicalFinancialTransaction,
  formatCurrency,
} from "@/types/finance";
import {
  Building,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";
import { SADASearch } from "@/components/ui/sada-search";
import { SADASelect } from "@/components/ui/sada-select";
import { SADAEmptyState } from "@/components/ui/sada-ui";
import { ClientFinancialProfileModal } from "@/components/admin/finance/ClientFinancialProfileModal";

type SortField = "revenue" | "profit" | "margin" | "cost" | "due";

interface ClientProfitabilityViewProps {
  records: ClientProfitabilityRecord[];
  transactions?: CanonicalFinancialTransaction[];
  onSelectClient?: (clientId: string) => void;
}

export function ClientProfitabilityView({
  records,
  transactions = [],
  onSelectClient,
}: ClientProfitabilityViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortField>("profit");
  const [selectedClient, setSelectedClient] = useState<ClientProfitabilityRecord | null>(null);

  const filtered = useMemo(() => {
    return records
      .filter((r) => {
        if (healthFilter !== "all" && r.health !== healthFilter) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return (
            r.clientName.toLowerCase().includes(term) ||
            (r.industry && r.industry.toLowerCase().includes(term))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
        if (sortBy === "profit") return b.contributionProfit - a.contributionProfit;
        if (sortBy === "margin") return b.marginPercent - a.marginPercent;
        if (sortBy === "cost") return (b.sponsoringCost + b.directCost) - (a.sponsoringCost + a.directCost);
        if (sortBy === "due") return b.due - a.due;
        return 0;
      });
  }, [records, healthFilter, searchTerm, sortBy]);

  // Aggregate matrix stats
  const totalClientRevenue = records.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalContributionProfit = records.reduce((sum, r) => sum + r.contributionProfit, 0);
  const averageMarginPercent =
    totalClientRevenue > 0
      ? Math.round((totalContributionProfit / totalClientRevenue) * 100)
      : 0;
  const totalOutstandingDue = records.reduce((sum, r) => sum + r.due, 0);

  const handleRowClick = (client: ClientProfitabilityRecord) => {
    setSelectedClient(client);
    if (onSelectClient) {
      onSelectClient(client.clientId);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Aggregates */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Total Client Revenue
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1">
            {formatCurrency(totalClientRevenue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Across {records.length} Active Accounts
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 shadow-xs bg-emerald-500/5">
          <div className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-300 font-semibold">
            Total Contribution Profit
          </div>
          <div className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalContributionProfit)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Direct Margin After Ad & Commission
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Average Portfolio Margin
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1">
            {averageMarginPercent}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Weighted Agency Health Ratio
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-amber-500/30 shadow-xs bg-amber-500/5">
          <div className="text-[11px] font-mono uppercase text-amber-700 dark:text-amber-300 font-semibold">
            Outstanding Due
          </div>
          <div className="text-xl font-bold font-display text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(totalOutstandingDue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Pending Client Receivables
          </div>
        </div>
      </div>

      {/* 2. Controls Bar */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Award className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-foreground tracking-tight flex items-center gap-2">
              <span>Client Profitability Matrix</span>
              <span className="text-[10px] font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Click client row to inspect Profile & Lineage
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              Formula: Contribution Profit = Service Revenue + Sponsoring Margin - Commission - Direct Costs
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="w-full sm:w-48 min-w-0">
            <SADASearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search client..."
              size="compact"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <div className="w-full sm:w-36 min-w-0">
              <SADASelect
                value={sortBy}
                onChange={(v) => setSortBy(v as SortField)}
                size="compact"
                options={[
                  { value: "profit", label: "Sort: Highest Profit" },
                  { value: "revenue", label: "Sort: Highest Revenue" },
                  { value: "margin", label: "Sort: Highest Margin %" },
                  { value: "cost", label: "Sort: Highest Cost" },
                  { value: "due", label: "Sort: Highest Due" },
                ]}
              />
            </div>

            <div className="w-full sm:w-36 min-w-0">
              <SADASelect
                value={healthFilter}
                onChange={setHealthFilter}
                size="compact"
                options={[
                  { value: "all", label: "All Health Ratings" },
                  { value: "HIGH PROFIT", label: "High Profit (🟢)" },
                  { value: "MEDIUM", label: "Medium Margin (🟡)" },
                  { value: "LOW PROFIT", label: "Low Profit (🔴)" },
                  { value: "NO DATA", label: "No Data (⚪)" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Matrix Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12">
            <SADAEmptyState
              icon={Award}
              title="No Client Profitability Records"
              description="No clients match your filter or search criteria for this period."
            />
          </div>
        ) : (
          <>
            {/* Mobile Representation (< md): Explicit Structured Record Cards */}
            <div className="block md:hidden divide-y divide-border/60">
              {filtered.map((item) => {
                const isHigh = item.health === "HIGH PROFIT";
                const isMedium = item.health === "MEDIUM";
                const isNoData = item.health === "NO DATA";
                const directTotal = item.directCost + item.sponsoringCost;

                return (
                  <div
                    key={item.clientId}
                    onClick={() => handleRowClick(item)}
                    className="p-3.5 space-y-3 font-mono bg-card hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    {/* Row 1: Client / Venue & Health Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          Client / Venue
                        </span>
                        <div className="font-semibold text-foreground text-sm flex items-center gap-1.5 truncate mt-0.5">
                          <Building className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{item.clientName}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                          {item.industry}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isHigh
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            : isMedium
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            : isNoData
                            ? "bg-muted text-muted-foreground border border-border/80"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {isHigh ? (
                          <TrendingUp className="size-2.5" />
                        ) : isMedium ? (
                          <Clock className="size-2.5" />
                        ) : isNoData ? (
                          <HelpCircle className="size-2.5" />
                        ) : (
                          <AlertTriangle className="size-2.5" />
                        )}
                        {item.health}
                      </span>
                    </div>

                    {/* Financial Metrics: Distinct Labeled Blocks */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                      {/* Metric 1: Revenue */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          Revenue
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground block mt-0.5" dir="ltr">
                          {formatCurrency(item.totalRevenue)}
                        </span>
                        {item.due > 0 && (
                          <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 block truncate mt-0.5">
                            Due: {formatCurrency(item.due)}
                          </span>
                        )}
                      </div>

                      {/* Metric 2: Direct Costs */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          Direct Costs
                        </span>
                        <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 block mt-0.5" dir="ltr">
                          -{formatCurrency(directTotal + item.commission)}
                        </span>
                        {item.commission > 0 && (
                          <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                            Direct + Comm
                          </span>
                        )}
                      </div>

                      {/* Metric 3: Contribution Profit */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          Contribution Profit
                        </span>
                        <span className={`text-sm font-bold font-mono block mt-0.5 ${item.contributionProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} dir="ltr">
                          {formatCurrency(item.contributionProfit)}
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                          {item.contributionProfit >= 0 ? "Positive Net" : "Deficit"}
                        </span>
                      </div>

                      {/* Metric 4: Contribution Margin */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          Contribution Margin
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground block mt-0.5" dir="ltr">
                          {item.marginPercent.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                          {item.marginPercent >= 40 ? "High Margin" : "Standard"}
                        </span>
                      </div>
                    </div>

                    {/* Row 6: Relationship / Collection Status */}
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/30">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                        Relationship Status
                      </span>
                      <span className={`text-xs font-mono font-semibold ${item.due === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {item.due === 0 ? "Paid in Full" : `Pending ${formatCurrency(item.due)}`}
                      </span>
                    </div>

                    <div className="text-[11px] text-primary flex items-center justify-end gap-1 font-mono pt-1">
                      <span>View Financial Profile</span>
                      <ArrowUpRight className="size-3" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Representation (>= md): Full Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/70 text-[11px] font-mono uppercase text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3">Client</th>
                    <th className="p-3">Package</th>
                    <th className="p-3">Services</th>
                    <th className="p-3">Sponsoring</th>
                    <th className="p-3">Total Rev</th>
                    <th className="p-3">Paid</th>
                    <th className="p-3">Due</th>
                    <th className="p-3">Commission</th>
                    <th className="p-3">Direct Cost</th>
                    <th className="p-3">Profit [AUTO]</th>
                    <th className="p-3">Margin %</th>
                    <th className="p-3 text-right">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filtered.map((item) => {
                    const isHigh = item.health === "HIGH PROFIT";
                    const isMedium = item.health === "MEDIUM";
                    const isNoData = item.health === "NO DATA";

                    return (
                      <tr
                        key={item.clientId}
                        onClick={() => handleRowClick(item)}
                        className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 max-w-[160px] font-sans">
                          <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 group-hover:text-primary transition-colors">
                            <Building className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{item.clientName}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {item.industry}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {formatCurrency(item.monthlyPackage)}
                        </td>

                        <td className="p-3 whitespace-nowrap text-foreground font-semibold">
                          {formatCurrency(item.serviceRevenue)}
                        </td>

                        <td className="p-3 whitespace-nowrap text-indigo-600 dark:text-indigo-400 font-semibold">
                          {formatCurrency(item.sponsoringBudget)}
                        </td>

                        <td className="p-3 whitespace-nowrap font-bold text-foreground">
                          {formatCurrency(item.totalRevenue)}
                        </td>

                        <td className="p-3 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(item.paid)}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span className={item.due > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                            {item.due > 0 ? formatCurrency(item.due) : "0 TND"}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap text-rose-600 dark:text-rose-400 font-semibold">
                          -{formatCurrency(item.commission)}
                        </td>

                        <td className="p-3 whitespace-nowrap text-rose-600 dark:text-rose-400 font-semibold">
                          -{formatCurrency(item.directCost + item.sponsoringCost)}
                        </td>

                        <td className="p-3 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.contributionProfit)}
                        </td>

                        <td className="p-3 whitespace-nowrap font-semibold">
                          {item.marginPercent.toFixed(1)}%
                        </td>

                        <td className="p-3 text-right whitespace-nowrap">
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
                            {isHigh ? (
                              <TrendingUp className="size-2.5" />
                            ) : isMedium ? (
                              <Clock className="size-2.5" />
                            ) : isNoData ? (
                              <HelpCircle className="size-2.5" />
                            ) : (
                              <AlertTriangle className="size-2.5" />
                            )}
                            {item.health}
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

      {/* 4. Client Financial Profile Modal */}
      <ClientFinancialProfileModal
        record={selectedClient}
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        transactions={transactions}
      />
    </div>
  );
}
