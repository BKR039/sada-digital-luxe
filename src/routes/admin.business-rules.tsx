// ============================================================
// SADA OS — BUSINESS RULES INTELLIGENCE & GOVERNANCE CONSOLE
// Executive Dashboard, Real-Time Evaluations, Smart Insights,
// Impact Simulator, Immutable Audit Logs, and Rollback Workflow.
// ============================================================

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  Sliders,
  ShieldCheck,
  History,
  TrendingUp,
  Percent,
  DollarSign,
  AlertTriangle,
  Bell,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
  Info,
  Calendar,
  ShieldAlert,
  Flame,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  Filter,
} from "lucide-react";
import {
  fetchBusinessRules,
  updateBusinessRule,
  resetBusinessRuleToDefault,
  fetchRuleVersions,
  subscribeToBusinessRules,
} from "@/lib/business-rules-service";
import {
  fetchLiveBusinessContext,
  evaluateAllBusinessRules,
  generateBusinessRulesSmartInsights,
  RULE_METADATA_REGISTRY,
} from "@/lib/business-rules-intelligence-service";
import type {
  BusinessRule,
  BusinessRuleCategory,
  BusinessRuleSeverity,
  BusinessRuleSmartInsight,
  BusinessRuleVersion,
  ExecutiveRulesOverview,
  LiveBusinessContext,
  RuleEvaluationResult,
  RuleEvaluationStatus,
} from "@/types/business-rules";
import {
  SADAButton,
  SADATextarea,
  SADADialog,
  SADABadge,
  SADAEmptyState,
  SADASearch,
  BusinessRulesSkeleton,
} from "@/components/ui/sada-ui";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

// Dedicated Modular Components
import { BusinessRulesExecutiveOverview } from "@/components/admin/business-rules/BusinessRulesExecutiveOverview";
import { BusinessRuleCard } from "@/components/admin/business-rules/BusinessRuleCard";
import { AdvancedRuleEditorModal } from "@/components/admin/business-rules/AdvancedRuleEditorModal";
import { RuleVersionHistoryModal } from "@/components/admin/business-rules/RuleVersionHistoryModal";
import { BusinessRulesSmartInsightsPanel } from "@/components/admin/business-rules/BusinessRulesSmartInsightsPanel";

export const Route = createFileRoute("/admin/business-rules")({
  ssr: false,
  component: BusinessRulesConsolePage,
});

function isRtl(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";
}

// Category Metadata
export const CATEGORY_METADATA: Record<
  BusinessRuleCategory,
  { label: string; icon: any; color: string; description: string }
> = {
  sales_commissions: {
    get label() { return isRtl() ? "المبيعات والعمولات" : "Sales & Commissions"; },
    icon: Percent,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    get description() {
      return isRtl()
        ? "نسب العمولات الأولية، حوافز التجديد والتوسيع، ومدد الاستحقاق."
        : "Initial commission rates, renewal/upsell incentives, and duration periods.";
    },
  },
  sponsoring_advertising: {
    get label() { return isRtl() ? "الإعلانات الممولة والوسائط" : "Sponsoring & Media"; },
    icon: TrendingUp,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    get description() {
      return isRtl()
        ? "أسعار صرف العملات، هوامش التحكيم المالي الدنيا، وقواعد الإنفاق الإعلاني."
        : "FX rates, minimum arbitrage margins, and paid ad spend allocation rules.";
    },
  },
  profitability: {
    get label() { return isRtl() ? "الربحية وهامش المساهمة" : "Profitability & Margin"; },
    icon: DollarSign,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    get description() {
      return isRtl()
        ? "نطاقات تصنيف صحة العملاء، تحذيرات انخفاض الهامش، ومعايير إجمالي الأرباح."
        : "Client health rating brackets, low-margin warnings, and gross profit benchmarks.";
    },
  },
  cash_treasury: {
    get label() { return isRtl() ? "الخزينة والسيولة النقدية" : "Cash & Treasury"; },
    icon: ShieldCheck,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    get description() {
      return isRtl()
        ? "عتبات أشهر الأمان المالي، التقديرات الاحتياطية، واحتياطيات السيولة السائلة."
        : "Runway month thresholds, default fallback runway, and liquidity reserves.";
    },
  },
  fixed_burn: {
    get label() { return isRtl() ? "معدل الحرق الشهري الثابت" : "Fixed Monthly Burn"; },
    icon: Flame,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    get description() {
      return isRtl()
        ? "سقوف المصاريف العامة المتكررة، حدود اشتراكات البرمجيات، وتنبيهات الاستنزاف."
        : "Recurring overhead ceilings, SaaS subscription limits, and burn warnings.";
    },
  },
  smart_insights: {
    get label() { return isRtl() ? "التحليلات الذكية والرؤى" : "Smart Insights"; },
    icon: Sparkles,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    get description() {
      return isRtl()
        ? "محددات تنبيهات الذكاء الاصطناعي، تأثير العمولات، ومؤشرات تركز المخاطر."
        : "AI insight triggers, commission impact limits, and concentration alerts.";
    },
  },
  notifications_alerts: {
    get label() { return isRtl() ? "التنبيهات والإشعارات" : "Alerts & Notifications"; },
    icon: Bell,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    get description() {
      return isRtl()
        ? "عتبات التذكير بالمهام، إشعارات تأخر الفواتير، ومصفوفة التصعيد الإداري."
        : "24h deduplication horizons, task lead times, and urgent event escalations.";
    },
  },
  operations: {
    get label() { return isRtl() ? "العمليات والرواتب" : "Operations & Payroll"; },
    icon: Layers,
    color: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    get description() {
      return isRtl()
        ? "ساعات العمل الشهرية القياسية وسقوف طلبات السلف المالية للموظفين."
        : "Standard monthly labor hours and employee advance request caps.";
    },
  },
};

function BusinessRulesConsolePage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [liveContext, setLiveContext] = useState<LiveBusinessContext | null>(null);
  const [evaluations, setEvaluations] = useState<Map<string, RuleEvaluationResult>>(new Map());
  const [overview, setOverview] = useState<ExecutiveRulesOverview | null>(null);
  const [insights, setInsights] = useState<BusinessRuleSmartInsight[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<BusinessRuleCategory | "all">("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState<RuleEvaluationStatus | "all" | "triggered" | "review_needed">("all");
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<BusinessRuleSeverity | "all">("all");
  const [customOnly, setCustomOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInsightsPanel, setShowInsightsPanel] = useState(true);

  // Category horizontal scroll
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Edit / Simulation Modal
  const [selectedRule, setSelectedRule] = useState<BusinessRule | null>(null);
  const [rollbackReason, setRollbackReason] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Reset to Default Modal
  const [resetRule, setResetRule] = useState<BusinessRule | null>(null);
  const [resetReason, setResetReason] = useState<string>("");
  const [resetting, setResetting] = useState(false);

  // Version History Modal
  const [historyRule, setHistoryRule] = useState<BusinessRule | null>(null);
  const [ruleVersions, setRuleVersions] = useState<BusinessRuleVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Super Admin security check
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      toast.error("Unauthorized: Business Rules are restricted exclusively to Super Admin.");
    }
  }, [authLoading, isSuperAdmin]);

  const loadData = async (forceLoading = false) => {
    if (forceLoading || rules.length === 0) {
      setLoading(true);
    }
    try {
      const [fetchedRules, context] = await Promise.all([
        fetchBusinessRules(true),
        fetchLiveBusinessContext(true, {
          userId: user?.id,
          role: "super_admin",
          permissions: { finance: true },
        }),
      ]);

      setRules(fetchedRules);
      setLiveContext(context);

      const evaluated = evaluateAllBusinessRules(fetchedRules, context);
      setEvaluations(evaluated.evaluations);
      setOverview(evaluated.overview);

      const smartInsights = generateBusinessRulesSmartInsights(evaluated.evaluations, fetchedRules, context);
      setInsights(smartInsights);
    } catch (err: any) {
      console.error("[loadData] Error loading rules and intelligence:", err);
      toast.error("Failed to load business rules intelligence: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  // Real-time listener
  useEffect(() => {
    const unsubscribe = subscribeToBusinessRules(() => {
      loadData(false);
    });
    return unsubscribe;
  }, []);

  // Category scroll capability
  const checkScroll = useCallback(() => {
    const el = categoriesRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  const scrollCategories = (offset: number) => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({ left: offset, behavior: "smooth" });
      setTimeout(checkScroll, 320);
    }
  };

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [checkScroll, rules.length]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchCat = activeCategory === "all" || r.category === activeCategory;
      const matchSeverity = activeSeverityFilter === "all" || r.severity === activeSeverityFilter;

      const evalRes = evaluations.get(r.rule_key);
      const isCustom = (r.default_numeric_value !== null && Number(r.numeric_value) !== Number(r.default_numeric_value)) ||
                       (r.default_text_value !== null && r.text_value !== r.default_text_value);

      const matchCustom = !customOnly || isCustom;

      let matchStatus = true;
      if (activeStatusFilter === "triggered") {
        matchStatus = evalRes?.status === "critical" || evalRes?.status === "warning";
      } else if (activeStatusFilter === "review_needed") {
        matchStatus = evalRes?.status === "critical" || evalRes?.status === "warning" || isCustom || !!evalRes?.isContradictory;
      } else if (activeStatusFilter !== "all") {
        matchStatus = evalRes?.status === activeStatusFilter;
      }

      const matchSearch =
        searchQuery === "" ||
        r.rule_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.rule_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.applies_to && r.applies_to.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCat && matchSeverity && matchCustom && matchStatus && matchSearch;
    });
  }, [rules, evaluations, activeCategory, activeSeverityFilter, activeStatusFilter, customOnly, searchQuery]);

  // Handle Edit Action
  const handleOpenEdit = (rule: BusinessRule) => {
    setSelectedRule(rule);
    setRollbackReason(undefined);
  };

  // Handle Rollback from History
  const handleRollback = (rule: BusinessRule, version: BusinessRuleVersion) => {
    setSelectedRule({
      ...rule,
      numeric_value: version.numeric_value,
      text_value: version.text_value,
    });
    const dateFormatted = version.created_at ? format(parseISO(version.created_at), "yyyy-MM-dd") : "past";
    setRollbackReason(`Rollback to version v${version.version} (configured on ${dateFormatted}): ${version.change_reason || "Reverting to historical configuration"}`);
    setHistoryRule(null);
  };

  // Save Rule Mutation
  const handleSaveRule = async (rule: BusinessRule, newValue: string, changeReason: string): Promise<boolean> => {
    setSaving(true);
    try {
      const isNumeric = rule.value_type === "numeric";
      const sanitizedNum = isNumeric ? Number(newValue.replace(",", ".")) : undefined;

      const res = await updateBusinessRule({
        ruleId: rule.id,
        numericValue: isNumeric ? sanitizedNum : undefined,
        textValue: !isNumeric ? newValue : undefined,
        changeReason,
        actorId: user?.id,
        actorName: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Super Admin",
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update business rule.");
        return false;
      }

      toast.success(`Rule "${rule.rule_name}" updated to v${res.data?.version}. Audit note committed.`);
      setSelectedRule(null);
      await loadData(false);
      return true;
    } catch (err: any) {
      console.error("[handleSaveRule] Error:", err);
      toast.error(err.message || "Failed to save business rule.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Reset to Factory Default
  const handleOpenReset = (rule: BusinessRule) => {
    setResetRule(rule);
    setResetReason("");
  };

  const handleConfirmReset = async () => {
    if (!resetRule) return;
    setResetting(true);
    try {
      const res = await resetBusinessRuleToDefault({
        ruleId: resetRule.id,
        changeReason: resetReason.trim() || "Reset to system default value via Executive Console",
        actorId: user?.id,
        actorName: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Super Admin",
      });

      if (!res.success) {
        toast.error(res.error || "Failed to reset rule to default.");
      } else {
        toast.success(`Rule "${resetRule.rule_name}" reset to factory default (v${res.data?.version}).`);
        setResetRule(null);
        await loadData(false);
      }
    } catch (err: any) {
      toast.error("Error resetting rule: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  // History Action
  const handleOpenHistory = async (rule: BusinessRule) => {
    setHistoryRule(rule);
    setHistoryLoading(true);
    try {
      const versions = await fetchRuleVersions(rule.id);
      setRuleVersions(versions);
    } catch (err: any) {
      toast.error("Failed to load version history: " + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (authLoading) {
    return <BusinessRulesSkeleton />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <SADAEmptyState
          title="Super Admin Access Restricted"
          description="Business rule configuration and financial parameters are protected. Only Super Admins may view and configure these rules."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const isFiltered =
    activeCategory !== "all" ||
    activeStatusFilter !== "all" ||
    activeSeverityFilter !== "all" ||
    customOnly ||
    searchQuery.trim().length > 0;

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-card to-muted/30 border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sliders className="size-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Governance & Financial Engine
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground">
            Business Rules Intelligence & Governance Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Single canonical configuration layer for SADA OS. Real-time evaluations distinguish configured thresholds from live business conditions. Historical deals and closed financial records remain permanently immutable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="text-xs w-full sm:w-auto justify-center"
          >
            <RefreshCw className={`size-3.5 me-1.5 ${loading ? "animate-spin" : ""}`} />
            Re-evaluate Engine
          </SADAButton>

          <div className="px-3 py-1.5 rounded-xl bg-card border border-border text-[11px] font-mono text-muted-foreground w-full sm:w-auto text-center">
            <span className="font-bold text-foreground">{rules.length}</span> Canonical Rules
          </div>
        </div>
      </div>

      {/* Executive Overview Dashboard */}
      {overview && (
        <BusinessRulesExecutiveOverview
          overview={overview}
          activeStatusFilter={activeStatusFilter}
          onSelectStatusFilter={setActiveStatusFilter}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          isRtl={isRtl()}
        />
      )}

      {/* Smart Insights Panel */}
      {showInsightsPanel && insights.length > 0 && (
        <BusinessRulesSmartInsightsPanel
          insights={insights}
          onSelectInsightRule={(key) => setSearchQuery(key)}
        />
      )}

      {/* Control Bar: Categories, Filters & Search */}
      <div className="p-2.5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Horizontal Category Navigation */}
        <div className="relative flex-1 min-w-0 flex items-center">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollCategories(-220)}
              className="hidden sm:grid absolute -start-1 z-10 size-7 place-items-center rounded-lg bg-card/95 border border-border shadow-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              aria-label="Scroll categories left"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          )}

          <div
            ref={categoriesRef}
            onScroll={checkScroll}
            className="flex items-center gap-1.5 overflow-x-auto w-full scrollbar-none py-0.5 px-0.5 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-xs border border-primary/20"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/40 hover:border-border"
              }`}
            >
              <span>All Categories</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeCategory === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted/80 text-muted-foreground"
                }`}
              >
                {rules.length}
              </span>
            </button>

            {Object.entries(CATEGORY_METADATA).map(([catKey, meta]) => {
              const count = rules.filter((r) => r.category === catKey).length;
              const Icon = meta.icon;
              const isActive = activeCategory === catKey;
              return (
                <button
                  type="button"
                  key={catKey}
                  onClick={() => setActiveCategory(catKey as BusinessRuleCategory)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs border border-primary/20"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/40 hover:border-border"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span>{meta.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollCategories(220)}
              className="hidden sm:grid absolute -end-1 z-10 size-7 place-items-center rounded-lg bg-card/95 border border-border shadow-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              aria-label="Scroll categories right"
            >
              <ChevronRight className="size-3.5" />
            </button>
          )}
        </div>

        {/* Search Control */}
        <div className="w-full lg:w-72 shrink-0">
          <SADASearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search rules, keys, scopes..."
            size="compact"
          />
        </div>
      </div>

      {/* Secondary Refinement Toolbar */}
      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-card border border-border/80 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Filter className="size-3 text-primary" /> Filter:
          </span>

          {/* Status Filter */}
          <select
            value={activeStatusFilter}
            onChange={(e) => setActiveStatusFilter(e.target.value as any)}
            className="px-2 py-1 rounded-lg bg-muted/40 border border-border text-xs text-foreground font-medium cursor-pointer"
          >
            <option value="all">Status: All Conditions</option>
            <option value="triggered">⚡ Triggered Alerts Only</option>
            <option value="critical">🚨 Critical Floors Only</option>
            <option value="warning">⚠️ Warnings Only</option>
            <option value="healthy">✓ Healthy & Compliant</option>
            <option value="config_only">⚙️ Policies Only</option>
            <option value="review_needed">🔍 Needs Review</option>
          </select>

          {/* Severity Filter */}
          <select
            value={activeSeverityFilter}
            onChange={(e) => setActiveSeverityFilter(e.target.value as any)}
            className="px-2 py-1 rounded-lg bg-muted/40 border border-border text-xs text-foreground font-medium cursor-pointer"
          >
            <option value="all">Severity: All Tiers</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          {/* Custom Toggle */}
          <button
            type="button"
            onClick={() => setCustomOnly(!customOnly)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              customOnly
                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Customized Only {customOnly ? "✓" : ""}
          </button>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setActiveCategory("all");
              setActiveStatusFilter("all");
              setActiveSeverityFilter("all");
              setCustomOnly(false);
              setSearchQuery("");
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
          >
            <X className="size-3" /> Clear filters ({filteredRules.length} of {rules.length})
          </button>
        )}
      </div>

      {/* Rules Grid */}
      {loading && rules.length === 0 ? (
        <BusinessRulesSkeleton />
      ) : filteredRules.length === 0 ? (
        <SADAEmptyState
          title="No Business Rules Found"
          description="Try adjusting your category filter, status filter, or search query."
          icon={Sliders}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRules.map((rule) => {
            const catMeta = CATEGORY_METADATA[rule.category] || CATEGORY_METADATA.sales_commissions;
            const evalRes = evaluations.get(rule.rule_key);

            return (
              <BusinessRuleCard
                key={rule.id}
                rule={rule}
                evaluation={evalRes}
                categoryMetadata={catMeta}
                onEdit={handleOpenEdit}
                onReset={handleOpenReset}
                onHistory={handleOpenHistory}
              />
            );
          })}
        </div>
      )}

      {/* Advanced Editor & Simulator Modal */}
      {selectedRule && liveContext && (
        <AdvancedRuleEditorModal
          rule={selectedRule}
          allRules={rules}
          liveContext={liveContext}
          open={!!selectedRule}
          onClose={() => setSelectedRule(null)}
          onSave={handleSaveRule}
          saving={saving}
          initialRollbackReason={rollbackReason}
        />
      )}

      {/* Version History Modal with Rollback Workflow */}
      {historyRule && (
        <RuleVersionHistoryModal
          rule={historyRule}
          versions={ruleVersions}
          loading={historyLoading}
          open={!!historyRule}
          onClose={() => setHistoryRule(null)}
          onRollback={handleRollback}
        />
      )}

      {/* Reset to Factory Default Dialog */}
      {resetRule && (
        <SADADialog
          open={!!resetRule}
          onOpenChange={(open) => !open && setResetRule(null)}
          title={`Reset to Factory Default: ${resetRule.rule_name}`}
          description={`Revert this business parameter back to its system factory default baseline.`}
          size="default"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <SADAButton
                variant="outline"
                size="sm"
                onClick={() => setResetRule(null)}
                disabled={resetting}
              >
                Cancel
              </SADAButton>
              <SADAButton
                variant="destructive"
                size="sm"
                onClick={handleConfirmReset}
                disabled={resetting}
              >
                {resetting ? (
                  <RefreshCw className="size-3.5 animate-spin me-1.5" />
                ) : (
                  <RotateCcw className="size-3.5 me-1.5" />
                )}
                Confirm Reset to Default
              </SADAButton>
            </div>
          }
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs text-foreground/90 space-y-1">
                <p className="font-semibold text-amber-500">Reset Confirmation</p>
                <p>
                  This action will restore the rule from current value{" "}
                  <strong>
                    {resetRule.numeric_value} {resetRule.unit || ""}
                  </strong>{" "}
                  to factory default{" "}
                  <strong>
                    {resetRule.default_numeric_value} {resetRule.unit || ""}
                  </strong>
                  . Future alerts, calculations, and Smart Insights will immediately adopt this default threshold.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rule Key:</span>
                <span className="font-mono text-foreground">{resetRule.rule_key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Configured Value:</span>
                <span className="font-bold text-destructive font-mono">
                  {resetRule.numeric_value} {resetRule.unit || ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Factory Default Value:</span>
                <span className="font-bold text-emerald-500 font-mono">
                  {resetRule.default_numeric_value} {resetRule.unit || ""}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Audit Reason for Reset (Optional)
              </label>
              <SADATextarea
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="Reason for reverting this rule to system default (e.g., policy trial completed, reverting to standard margin threshold)..."
                rows={2}
              />
            </div>
          </div>
        </SADADialog>
      )}
    </div>
  );
}
