import { useState, useMemo } from "react";
import {
  SponsoringCampaign,
  formatCurrency,
  FinancialAccount,
  SponsoringPlatform,
} from "@/types/finance";
import {
  createSponsoringCampaign,
  executeSponsoringPurchase,
} from "@/lib/finance-service";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";
import {
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Building,
  CreditCard,
  Calculator,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SADAInput } from "@/components/ui/sada-ui";
import { SADASearch } from "@/components/ui/sada-search";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { format } from "date-fns";
import { toast } from "sonner";

interface SponsoringEngineViewProps {
  campaigns: SponsoringCampaign[];
  clients: Array<{ id: string; name: string }>;
  accounts: FinancialAccount[];
  sponsoringCollected: number;
  sponsoringPurchasesCost: number;
  sponsoringMargin: number;
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function SponsoringEngineView({
  campaigns,
  clients,
  accounts,
  sponsoringCollected,
  sponsoringPurchasesCost,
  sponsoringMargin,
  onRefresh,
  currentUserId,
  currentUserName,
}: SponsoringEngineViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  // Live Configured Business Rules (FX Rates)
  const defaultPurchaseRate = getBusinessRuleNumber("sponsoring_purchase_rate", 3.37);
  const defaultClientRate = getBusinessRuleNumber("sponsoring_client_rate", 4.00);

  // Create Campaign Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [platform, setPlatform] = useState<SponsoringPlatform>("Meta Ads");
  const [budgetTnd, setBudgetTnd] = useState("800");
  const [usdAmount, setUsdAmount] = useState("200");
  const [purchaseRate, setPurchaseRate] = useState(() => defaultPurchaseRate.toString());
  const [clientRate, setClientRate] = useState(() => defaultClientRate.toString());
  const [campaignDate, setCampaignDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Execute Purchase Modal State
  const [executingCampaign, setExecutingCampaign] = useState<SponsoringCampaign | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [isExecuting, setIsExecuting] = useState(false);

  // FORMULA AUTO-CALCULATIONS (Section 8: Never manually enter calculated cost or margin)
  const numBudget = parseFloat(budgetTnd) || 0;
  const numUsd = parseFloat(usdAmount) || 0;
  const numPurchaseRate = parseFloat(purchaseRate) || defaultPurchaseRate;
  const numClientRate = parseFloat(clientRate) || defaultClientRate;

  const autoPurchaseCost = Number((numUsd * numPurchaseRate).toFixed(3));
  const autoClientCharge = numBudget;
  const autoMargin = Number((autoClientCharge - autoPurchaseCost).toFixed(3));
  const autoMarginPercent = autoClientCharge > 0 ? ((autoMargin / autoClientCharge) * 100).toFixed(1) : "0.0";

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          c.campaignName.toLowerCase().includes(term) ||
          (c.clientName && c.clientName.toLowerCase().includes(term)) ||
          c.platform.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [campaigns, platformFilter, searchTerm]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client.");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Please provide a campaign name.");
      return;
    }
    if (numUsd <= 0 || numBudget <= 0) {
      toast.error("Please provide valid USD budget and client charge values.");
      return;
    }

    setIsSubmitting(true);
    const res = await createSponsoringCampaign({
      clientId,
      campaignName,
      platform,
      budgetTnd: numBudget,
      usdAmount: numUsd,
      purchaseRate: numPurchaseRate,
      clientRate: numClientRate,
      date: campaignDate,
      notes: notes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Failed to create campaign: ${res.error.message}`);
    } else {
      toast.success("Sponsoring campaign created successfully");
      setIsCreateOpen(false);
      setCampaignName("");
      setNotes("");
      onRefresh();
    }
  };

  const handleExecutePurchase = async () => {
    if (!executingCampaign) return;
    setIsExecuting(true);
    const res = await executeSponsoringPurchase({
      campaign: executingCampaign,
      accountId: selectedAccountId || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsExecuting(false);

    if (res.error) {
      toast.error(`Failed to execute purchase: ${res.error.message}`);
    } else {
      toast.success("Sponsoring purchase executed successfully");
      setExecutingCampaign(null);
      onRefresh();
    }
  };

  const marginRatePercent =
    sponsoringCollected > 0
      ? Math.round((sponsoringMargin / sponsoringCollected) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* 1. Sponsoring Arbitrage KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Client Ad Budgets
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1 tabular-nums sada-num-kpi">
            {formatCurrency(sponsoringCollected)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Billed to Clients (TND)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            USD Purchases Cost
          </div>
          <div className="text-xl font-bold font-display text-rose-600 dark:text-rose-400 mt-1 tabular-nums sada-num-kpi">
            {formatCurrency(sponsoringPurchasesCost)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Platform Ad Spend Outflow
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-indigo-500/30 shadow-xs bg-indigo-500/5">
          <div className="text-[11px] font-mono uppercase text-indigo-700 dark:text-indigo-300 font-semibold">
            Net Sponsoring Margin
          </div>
          <div className="text-xl font-bold font-display text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums sada-num-kpi">
            {formatCurrency(sponsoringMargin)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Arbitrage Margin Generated
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Arbitrage Spread
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1 tabular-nums sada-num-kpi">
            {marginRatePercent}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Agency Margin Ratio
          </div>
        </div>
      </div>

      {/* 2. Header and Controls */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Layers className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-foreground tracking-tight">
              Sponsoring & Arbitrage Engine
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              USD platform procurement, conversion tracking & automated margin calculation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <SADASearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search campaigns..."
            size="compact"
            className="w-full sm:w-48"
          />

          <div className="w-full sm:w-36">
            <SADASelect
              value={platformFilter}
              onChange={setPlatformFilter}
              size="compact"
              options={[
                { value: "all", label: "All Platforms" },
                { value: "Meta Ads", label: "Meta Ads" },
                { value: "Google Ads", label: "Google Ads" },
                { value: "TikTok Ads", label: "TikTok Ads" },
                { value: "LinkedIn Ads", label: "LinkedIn Ads" },
              ]}
            />
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Sponsoring Campaign</span>
          </button>
        </div>
      </div>

      {/* 3. Campaigns Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs font-mono">
            No sponsoring campaigns recorded. Add one above to start tracking ad spend arbitrage.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border/40">
              {filteredCampaigns.map((c) => (
                <div key={c.id} className="p-4 space-y-3 text-start">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium border border-border/60 inline-block mb-1">
                        {c.platform}
                      </span>
                      <div className="font-sans font-semibold text-foreground text-xs">
                        {c.campaignName}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Building className="size-3 text-muted-foreground shrink-0" />
                        <span>{c.clientName}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        c.expenseTransactionId
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {c.expenseTransactionId ? (
                        <CheckCircle2 className="size-2.5" />
                      ) : (
                        <Clock className="size-2.5" />
                      )}
                      {c.expenseTransactionId ? "PURCHASED" : "UNPAID"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40 font-mono">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        Client Charge
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        {formatCurrency(c.clientChargeTnd)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        Margin Arbitrage
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        +{formatCurrency(c.marginTnd)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        USD Spend
                      </span>
                      <span className="text-foreground">
                        ${c.usdAmount.toFixed(2)} <span className="text-muted-foreground/70">(@ {c.purchaseRate.toFixed(2)})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        TND Cost
                      </span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {formatCurrency(c.purchaseCostTnd)}
                      </span>
                    </div>
                  </div>

                  {!c.expenseTransactionId && (
                    <div className="pt-2 border-t border-border/40 flex justify-end">
                      <button
                        onClick={() => setExecutingCampaign(c)}
                        className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors border border-indigo-500/30 flex items-center justify-center gap-1"
                      >
                        <CreditCard className="size-3" /> Execute Purchase
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/70 text-[11px] font-mono uppercase text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3.5">Campaign & Client</th>
                    <th className="p-3.5">Platform</th>
                    <th className="p-3.5">USD Spend</th>
                    <th className="p-3.5">FX Rate</th>
                    <th className="p-3.5">Cost (TND) [AUTO]</th>
                    <th className="p-3.5">Client Charge</th>
                    <th className="p-3.5">Margin [AUTO]</th>
                    <th className="p-3.5">Procurement</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono tabular-nums">
                  {filteredCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 max-w-xs">
                        <div className="font-sans font-semibold text-foreground text-xs truncate">
                          {c.campaignName}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <Building className="size-3 text-muted-foreground shrink-0" />
                          <span>{c.clientName}</span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium border border-border/60">
                          {c.platform}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-foreground font-semibold">
                        ${c.usdAmount.toFixed(2)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-muted-foreground text-[11px]">
                        {c.purchaseRate.toFixed(2)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-semibold text-rose-600 dark:text-rose-400">
                        {formatCurrency(c.purchaseCostTnd)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-bold text-foreground">
                        {formatCurrency(c.clientChargeTnd)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-bold text-indigo-600 dark:text-indigo-400">
                        +{formatCurrency(c.marginTnd)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.expenseTransactionId
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {c.expenseTransactionId ? (
                            <CheckCircle2 className="size-2.5" />
                          ) : (
                            <Clock className="size-2.5" />
                          )}
                          {c.expenseTransactionId ? "PURCHASED" : "UNPAID"}
                        </span>
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        {!c.expenseTransactionId ? (
                          <button
                            onClick={() => setExecutingCampaign(c)}
                            className="px-3 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] transition-colors border border-indigo-500/30"
                          >
                            Execute Purchase
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Logged in Ledger
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* CREATE CAMPAIGN MODAL (Section 8) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md w-[94vw] p-6 rounded-3xl bg-card border border-border/80 shadow-2xl">
          <DialogHeader className="text-left pb-3 border-b border-border/50">
            <DialogTitle className="text-lg font-bold font-display text-foreground">
              Add Sponsoring Campaign
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Automatic conversion from USD platform purchase to client charge and margin
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCampaign} className="space-y-4 mt-2">
            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Client
              </label>
              <SADASelect
                value={clientId}
                onChange={setClientId}
                placeholder="Choose Client..."
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Campaign Name
              </label>
              <SADAInput
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Lead Generation Q4..."
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Platform
                </label>
                <SADASelect
                  value={platform}
                  onChange={(v) => setPlatform(v as SponsoringPlatform)}
                  options={[
                    { value: "Meta Ads", label: "Meta Ads" },
                    { value: "Google Ads", label: "Google Ads" },
                    { value: "TikTok Ads", label: "TikTok Ads" },
                    { value: "LinkedIn Ads", label: "LinkedIn Ads" },
                  ]}
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Campaign Date
                </label>
                <SADADatePicker
                  value={campaignDate}
                  onChange={(d) => d && setCampaignDate(d)}
                />
              </div>
            </div>

            {/* Input Variables */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/30 border border-border/60">
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  USD Ad Spend ($)
                </label>
                <SADAInput
                  type="number"
                  step="0.01"
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  placeholder="200.00"
                  prefix="$"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Purchase Rate (TND/USD)
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
                  placeholder={defaultPurchaseRate.toString()}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Client Budget (TND)
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  value={budgetTnd}
                  onChange={(e) => setBudgetTnd(e.target.value)}
                  placeholder="800.000"
                  prefix="TND"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Client Rate Reference
                </label>
                <SADAInput
                  type="number"
                  step="0.01"
                  value={clientRate}
                  onChange={(e) => setClientRate(e.target.value)}
                  placeholder={defaultClientRate.toString()}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* FORMULA AUTO-DERIVATION CARD (Section 8: User never manually enters cost or margin) */}
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5 text-xs font-mono">
              <div className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 tracking-wider flex items-center justify-between">
                <span>Calculated Arbitrage Impact</span>
                <Calculator className="size-3 text-indigo-500" />
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Purchase Cost [AUTO] ({numUsd}$ × {numPurchaseRate}):</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(autoPurchaseCost)}
                </span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Client Charge [AUTO]:</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(autoClientCharge)}
                </span>
              </div>

              <div className="pt-1.5 border-t border-indigo-500/20 flex justify-between font-bold text-sm">
                <span className="text-indigo-700 dark:text-indigo-300">
                  SADA Margin [AUTO] ({autoMarginPercent}%):
                </span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  +{formatCurrency(autoMargin)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Record Campaign"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EXECUTE PURCHASE MODAL */}
      <Dialog open={!!executingCampaign} onOpenChange={(open) => !open && setExecutingCampaign(null)}>
        <DialogContent className="max-w-md w-[94vw] p-6 rounded-3xl bg-card border border-border/80 shadow-2xl">
          <DialogHeader className="text-left pb-3 border-b border-border/50">
            <DialogTitle className="text-lg font-bold font-display text-foreground">
              Execute USD Ad Purchase
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Debit platform ad spend to canonical expenses ledger
            </DialogDescription>
          </DialogHeader>

          {executingCampaign && (
            <div className="space-y-4 mt-2">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign:</span>
                  <span className="font-semibold text-foreground">
                    {executingCampaign.campaignName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USD Platform Spend:</span>
                  <span className="font-semibold text-foreground">
                    ${executingCampaign.usdAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exchange Rate:</span>
                  <span>{executingCampaign.purchaseRate.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-border/50 flex justify-between font-bold text-sm">
                  <span>Outflow Debit:</span>
                  <span className="text-rose-600 dark:text-rose-400">
                    -{formatCurrency(executingCampaign.purchaseCostTnd)}
                  </span>
                </div>
              </div>

              {accounts.length > 0 && (
                <div>
                  <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                    Ad Debit Account / Card
                  </label>
                  <SADASelect
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.accountName || a.name} (${formatCurrency(a.currentBalance)})`,
                    }))}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setExecutingCampaign(null)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecutePurchase}
                  disabled={isExecuting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                >
                  {isExecuting ? "Executing..." : "Confirm & Post Outflow"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
