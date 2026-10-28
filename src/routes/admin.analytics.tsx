// ============================================================
// SADA OS — SADA INTELLIGENCE: EXECUTIVE COMMAND CENTER
// Powered exclusively by the authoritative Financial OS calculation layer.
// Zero second analytics engine. Pure mathematical drill-downs.
// ============================================================

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import {
  fetchManagementAnalytics,
  buildAnalyticsDrillDown,
  exportAnalyticsReportToCSV,
  type FullManagementAnalyticsData,
} from "@/lib/analytics-service";
import { formatCurrency } from "@/types/finance";
import type {
  AnalyticsFilterState,
  AnalyticsDrillDownState,
  ClientProfitabilityItem,
  PackageProfitabilityItem,
  EmployeePerformanceItem,
} from "@/types/notifications-and-audit";
import { AnalyticsDrillDownModal } from "@/components/admin/AnalyticsDrillDownModal";
import { AnalyticsSectionNav } from "@/components/admin/AnalyticsSectionNav";
import { ExecutiveCommandToolbar } from "@/components/admin/analytics/ExecutiveCommandToolbar";
import { ExecutiveCommandStrip } from "@/components/admin/analytics/ExecutiveCommandStrip";
import { ExecutiveBriefingSection } from "@/components/admin/analytics/ExecutiveBriefingSection";
import { FinancialTrendsChart } from "@/components/admin/analytics/FinancialTrendsChart";
import { CashFlowTreasuryView } from "@/components/admin/analytics/CashFlowTreasuryView";
import { ExpenseBreakdownView } from "@/components/admin/analytics/ExpenseBreakdownView";
import { RevenueSourcesBreakdown } from "@/components/admin/analytics/RevenueSourcesBreakdown";
import { OperationsIntelligenceView } from "@/components/admin/analytics/OperationsIntelligenceView";
import { ReceivablesObligationsView } from "@/components/admin/analytics/ReceivablesObligationsView";
import { fetchSystemAuditLogs } from "@/lib/audit-service";
import type { SystemAuditLog } from "@/types/notifications-and-audit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AnalyticsDashboardSkeleton } from "@/components/ui/sada-ui";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Film,
  FileText,
  DollarSign,
  Percent,
  Download,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Briefcase,
  Building2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/types/permissions";
import { ModuleAccessShield } from "@/components/admin/ModuleAccessShield";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalyticsPage,
});

export function AdminAnalyticsPage() {
  const { user, isSuperAdmin, isAdmin, isWorker, loading: authLoading, canAccessModule, customModulePermissions, role } = useAuth();
  const canAccessAnalytics = isSuperAdmin || (canAccessModule("analytics") && hasPermission("analytics.view", role || "worker", customModulePermissions));
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const nav = useNavigate();

  // Redirect unauthorized accounts
  useEffect(() => {
    if (!authLoading && !canAccessAnalytics) {
      nav({ to: "/admin/my-work" });
    }
  }, [authLoading, canAccessAnalytics, nav]);

  // Filters State
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    periodType: "this_month",
    compareWithPrevious: true,
  });
  const [activeTab, setActiveTab] = useState("executive_overview");
  const [loading, setLoading] = useState(true);

  // Analytics Data
  const [analyticsData, setAnalyticsData] = useState<FullManagementAnalyticsData | null>(null);
  const [drillDown, setDrillDown] = useState<AnalyticsDrillDownState | null>(null);
  const [auditLogs, setAuditLogs] = useState<SystemAuditLog[]>([]);

  const loadData = useCallback(async () => {
    if (!canAccessAnalytics) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, logs] = await Promise.all([
        fetchManagementAnalytics(filters),
        fetchSystemAuditLogs({ limit: 50 }),
      ]);
      setAnalyticsData(data);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Failed to load management analytics:", err);
      toast.error(isAr ? "فشل تحميل التحليلات الإدارية" : "Failed to load management analytics");
    } finally {
      setLoading(false);
    }
  }, [filters, canAccessAnalytics, isAr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Drill-down click helper
  const openDrillDown = (metricType: string, label: string, value: string | number, entityId?: string) => {
    if (!analyticsData) return;
    const dd = buildAnalyticsDrillDown({
      metricType,
      metricLabel: label,
      metricValue: value,
      entityId,
      data: analyticsData,
    });
    setDrillDown(dd);
  };

  if (authLoading) {
    return <AnalyticsDashboardSkeleton />;
  }

  // Authorization Shield: Unauthorized accounts
  if (!canAccessAnalytics) {
    return <ModuleAccessShield module="analytics" />;
  }

  if (loading && !analyticsData) {
    return <AnalyticsDashboardSkeleton />;
  }

  if (!analyticsData) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-28 text-start" dir={isAr ? "rtl" : "ltr"}>
      {/* 1. TOP GLOBAL TOOLBAR */}
      <ExecutiveCommandToolbar
        filters={filters}
        onFilterChange={setFilters}
        periodLabel={analyticsData.period.label}
        loading={loading}
        onRefresh={loadData}
        onExport={(type) => exportAnalyticsReportToCSV({ reportType: type as any, data: analyticsData })}
        userId={user?.id}
        userRole={isSuperAdmin ? "super_admin" : isAdmin ? "admin" : "worker"}
        lastRefreshedAt={analyticsData.lastRefreshedAt}
      />

      {/* 2. EXECUTIVE COMMAND STRIP (Top 8 Core SSOT KPIs) */}
      <ExecutiveCommandStrip
        data={analyticsData.executiveKPIs}
        onOpenDrillDown={openDrillDown}
      />

      {/* 3. EXECUTIVE BRIEFING — WHAT NEEDS IMMEDIATE ATTENTION? */}
      <ExecutiveBriefingSection
        briefingItems={analyticsData.briefingItems}
      />

      {/* 4. ANALYTICS TABS STRIP */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pt-2">
        <AnalyticsSectionNav />

        {/* ======================================================== */}
        {/* TAB 0: EXECUTIVE COMMAND OVERVIEW                        */}
        {/* ======================================================== */}
        <TabsContent value="executive_overview" className="space-y-6">
          {/* Row 1: Financial Trends & Cash Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <FinancialTrendsChart
              revenueTrends={analyticsData.revenueTrends}
              onOpenDrillDown={openDrillDown}
            />

            <CashFlowTreasuryView
              cashFlow={analyticsData.cashFlow}
              onOpenDrillDown={openDrillDown}
            />
          </div>

          {/* Row 2: Expense Breakdown & Revenue Streams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ExpenseBreakdownView
              rawLedger={analyticsData.rawLedger}
              totalExpenses={analyticsData.monthlyPnL.operatingExpenses + analyticsData.monthlyPnL.cogsDirectCosts}
              onOpenDrillDown={openDrillDown}
            />

            <RevenueSourcesBreakdown
              clientServicesRevenue={analyticsData.monthlyPnL.clientServicesRevenue}
              sponsoringCollected={analyticsData.monthlyPnL.sponsoringCollected}
              otherRevenue={analyticsData.monthlyPnL.otherRevenue}
              totalRevenue={analyticsData.monthlyPnL.totalRevenue}
              onOpenDrillDown={openDrillDown}
            />
          </div>

          {/* Row 3: Operations Pipeline & Delivery Health */}
          <OperationsIntelligenceView
            data={analyticsData.operationsIntelligence}
            onOpenDrillDown={openDrillDown}
          />

          {/* Row 4: Receivables & Obligations */}
          <ReceivablesObligationsView
            rawInvoices={analyticsData.rawInvoices}
            salaryRecords={analyticsData.financeState.salaryRecords}
            commissions={analyticsData.financeState.commissions}
            subscriptions={analyticsData.financeState.subscriptions}
            onOpenDrillDown={openDrillDown}
          />
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 1: CLIENT PROFITABILITY                              */}
        {/* ======================================================== */}
        <TabsContent value="client_profitability" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div
              onClick={() => openDrillDown("client_contribution_profit", isAr ? "إجمالي الإيرادات المحصلة" : "Total Collected Revenue", analyticsData.monthlyPnL.totalRevenue)}
              className="p-3 sm:p-4 rounded-xl bg-card border border-border/60 cursor-pointer hover:border-primary/50 transition-all space-y-1 shadow-2xs"
            >
              <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground uppercase leading-tight line-clamp-2 block min-h-[26px] sm:min-h-0">
                {isAr ? "إجمالي الإيرادات المحصلة" : "Total Collected Revenue"}
              </span>
              <p className="text-base sm:text-xl font-bold font-mono text-foreground truncate">
                {formatCurrency(analyticsData.monthlyPnL.totalRevenue)}
              </p>
              <div className="flex items-center text-[10px] text-primary gap-1 pt-0.5 font-mono">
                <span className="truncate">{isAr ? "انقر لعرض التفاصيل" : "Click to drill down"}</span>
                <ArrowUpRight className="size-2.5 rtl:rotate-180 shrink-0" />
              </div>
            </div>

            <div
              onClick={() => openDrillDown("client_contribution_profit", isAr ? "التكاليف التشغيلية المباشرة" : "Direct Operational Costs", analyticsData.monthlyPnL.cogsDirectCosts)}
              className="p-3 sm:p-4 rounded-xl bg-card border border-border/60 cursor-pointer hover:border-rose-500/50 transition-all space-y-1 shadow-2xs"
            >
              <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground uppercase leading-tight line-clamp-2 block min-h-[26px] sm:min-h-0">
                {isAr ? "التكاليف المباشرة وتكلفة المبيعات" : "Direct Costs & COGS"}
              </span>
              <p className="text-base sm:text-xl font-bold font-mono text-rose-400 truncate">
                {formatCurrency(analyticsData.monthlyPnL.cogsDirectCosts)}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono leading-tight block truncate">
                {isAr ? "العمالة + التمويل + العمولات" : "Labor + Sponsoring + Comm"}
              </span>
            </div>

            <div
              onClick={() => openDrillDown("monthly_net_profit", isAr ? "ربح المساهمة" : "Contribution Profit", analyticsData.monthlyPnL.grossProfit)}
              className="p-3 sm:p-4 rounded-xl bg-card border border-border/60 cursor-pointer hover:border-emerald-500/50 transition-all space-y-1 shadow-2xs"
            >
              <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground uppercase leading-tight line-clamp-2 block min-h-[26px] sm:min-h-0">
                {isAr ? "ربح المساهمة" : "Contribution Profit"}
              </span>
              <p className="text-base sm:text-xl font-bold font-mono text-emerald-400 truncate">
                {formatCurrency(analyticsData.monthlyPnL.grossProfit)}
              </p>
              <span className="text-[10px] text-emerald-500 font-mono leading-tight block truncate">
                {isAr ? `هامش مساهمة ${analyticsData.monthlyPnL.grossMarginPercent}%` : `${analyticsData.monthlyPnL.grossMarginPercent}% Margin`}
              </span>
            </div>

            <div className="p-3 sm:p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground uppercase leading-tight line-clamp-2 block min-h-[26px] sm:min-h-0">
                {isAr ? "العملاء عالي الربحية" : "High Profit Clients"}
              </span>
              <p className="text-base sm:text-xl font-bold font-mono text-foreground truncate">
                {analyticsData.clientProfitability.filter((c) => c.health === "HIGH PROFIT").length} / {analyticsData.clientProfitability.length}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono leading-tight block truncate">
                {isAr ? "≥ 1,000 د.ت أو هامش ≥ 50%" : "≥ 1,000 TND or ≥ 50%"}
              </span>
            </div>
          </div>

          {/* SSOT Revenue Reconciliation Proof Banner */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-card border border-border/80 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 text-xs font-mono shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold text-foreground text-[11px] sm:text-xs">
                {isAr ? "مطابقة الإيرادات مع السجلات المحاسبية المعتمدة (SSOT):" : "Revenue Reconciliation Proof (Authoritative SSOT):"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-3 text-[10px] sm:text-[11px] pt-1.5 sm:pt-0 border-t border-border/40 sm:border-0">
              <div className="bg-muted/40 sm:bg-transparent p-1.5 sm:p-0 rounded-lg text-center sm:text-start">
                <span className="text-muted-foreground block sm:inline">{isAr ? "عقود العملاء:" : "Retainers:"} </span>
                <span className="font-bold text-foreground block sm:inline">{formatCurrency(analyticsData.clientAttributedRevenue || 0)}</span>
              </div>
              <div className="bg-muted/40 sm:bg-transparent p-1.5 sm:p-0 rounded-lg text-center sm:text-start">
                <span className="text-muted-foreground block sm:inline">{isAr ? "تحصيلات الوكالة:" : "Direct Inflows:"} </span>
                <span className="font-bold text-foreground block sm:inline">{formatCurrency(analyticsData.unallocatedRevenue || 0)}</span>
              </div>
              <div className="bg-primary/10 sm:bg-transparent p-1.5 sm:p-0 rounded-lg text-center sm:text-start border border-primary/20 sm:border-0">
                <span className="text-muted-foreground block sm:inline">{isAr ? "الإجمالي المحصل:" : "Headline Total:"} </span>
                <span className="font-bold text-primary block sm:inline">{formatCurrency(analyticsData.monthlyPnL.totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Client Profitability Matrix Container */}
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-heading text-foreground">
                  {isAr ? "مصفوفة ربحية مساهمة العملاء" : "Client Contribution Profitability Matrix"}
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {isAr
                    ? "المعادلة: الإيراد المحصل - التكاليف المباشرة - تمويل الإعلانات - العمولات = ربح المساهمة"
                    : "Formula: Collected Revenue - Direct Costs - Sponsoring Cost - Commission = Contribution Profit"}
                </p>
              </div>
            </div>

            {/* Mobile Representation (< md): Explicit Structured Record Cards */}
            <div className="block md:hidden divide-y divide-border/60">
              {analyticsData.clientProfitability.map((c) => {
                const totalDirectCosts = c.directCosts + (c.sponsoringCost || 0) + (c.salesCommission || 0);
                return (
                  <div key={c.clientId} className="p-3.5 space-y-3 font-mono bg-card hover:bg-muted/10 transition-colors">
                    {/* Row 1: Client / Venue & Profit Tier Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          {isAr ? "العميل / المؤسسة" : "Client / Venue"}
                        </span>
                        <h4 className="text-sm font-bold font-heading text-foreground truncate mt-0.5">
                          {c.clientName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <span className="truncate">{c.packageTitle}</span>
                          {c.industry && (
                            <>
                              <span>•</span>
                              <span className="truncate">{c.industry}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            c.health === "HIGH PROFIT"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.health === "MEDIUM"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : c.health === "NO DATA"
                              ? "bg-muted text-muted-foreground border-border"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.health === "HIGH PROFIT" ? (isAr ? "ربح مرتفع" : "HIGH PROFIT") :
                           c.health === "MEDIUM" ? (isAr ? "متوسط" : "MEDIUM") :
                           c.health === "NO DATA" ? (isAr ? "لا توجد بيانات" : "NO DATA") :
                           (isAr ? "منخفض" : "LOW")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono ${
                            c.costCompleteness === "incomplete"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          }`}
                        >
                          {c.costCompleteness === "incomplete" ? (isAr ? "بيانات ناقصة" : "Cost Incomplete") : (isAr ? "بيانات مكتملة" : "Cost Verified")}
                        </Badge>
                      </div>
                    </div>

                    {/* Financial Metrics: Distinct Labeled Blocks */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                      {/* Metric 1: Revenue */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          {isAr ? "الإيرادات" : "Revenue"}
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground block mt-0.5" dir="ltr">
                          {formatCurrency(c.revenue)}
                        </span>
                        {c.contractedRevenue && c.contractedRevenue !== c.revenue ? (
                          <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                            {isAr ? "التعاقدي:" : "Retainer:"} {formatCurrency(c.contractedRevenue)}
                          </span>
                        ) : null}
                      </div>

                      {/* Metric 2: Direct Costs */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          {isAr ? "التكاليف المباشرة" : "Direct Costs"}
                        </span>
                        <span className="text-sm font-bold font-mono text-rose-500 dark:text-rose-400 block mt-0.5" dir="ltr">
                          {totalDirectCosts > 0 ? `-${formatCurrency(totalDirectCosts)}` : formatCurrency(0)}
                        </span>
                        {(c.sponsoringCost > 0 || c.salesCommission > 0) && (
                          <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                            {isAr ? "تشغيل + إعلانات + عمولة" : "Ops + Ads + Comm"}
                          </span>
                        )}
                      </div>

                      {/* Metric 3: Contribution Profit */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          {isAr ? "ربح المساهمة" : "Contribution Profit"}
                        </span>
                        <span className={`text-sm font-bold font-mono block mt-0.5 ${c.contributionProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`} dir="ltr">
                          {formatCurrency(c.contributionProfit)}
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                          {c.contributionProfit >= 0 ? (isAr ? "فائض إيجابي" : "Positive Net") : (isAr ? "عجز مساهمة" : "Deficit")}
                        </span>
                      </div>

                      {/* Metric 4: Contribution Margin */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-start">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                          {isAr ? "هامش المساهمة" : "Contribution Margin"}
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground block mt-0.5" dir="ltr">
                          {c.profitMarginPercent}%
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate mt-0.5">
                          {c.profitMarginPercent >= 40 ? (isAr ? "هامش ممتاز" : "High Margin") : (isAr ? "هامش اعتيادي" : "Standard")}
                        </span>
                      </div>
                    </div>

                    {/* Row 6: Relationship Status & Risk */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-border/30 text-start">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                        {isAr ? "حالة العلاقة والتسليم" : "Relationship Status"}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono ${
                            c.deliveryHealth === "ON_TRACK"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.deliveryHealth === "AT_RISK"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.deliveryHealth === "ON_TRACK"
                            ? (isAr ? "التسليم: منتظم" : "Delivery: On Track")
                            : c.deliveryHealth === "AT_RISK"
                            ? (isAr ? `مهدد (${c.overdueTasksCount || 1})` : `At Risk (${c.overdueTasksCount || 1})`)
                            : (isAr ? "متأخر" : "Delayed")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono ${
                            c.paymentRisk === "LOW"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.paymentRisk === "MODERATE"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.paymentRisk === "LOW"
                            ? (isAr ? "تحصيل: آمن" : "Risk: Low")
                            : c.paymentRisk === "MODERATE"
                            ? (isAr ? "تحصيل: متوسط" : "Risk: Mod")
                            : (isAr ? "تحصيل: خطر" : "Risk: High")}
                        </Badge>
                      </div>
                    </div>

                    {/* Drill-Down Action Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openDrillDown(
                          "client_contribution_profit",
                          `${c.clientName} ${isAr ? "ربح مساهمة" : "Contribution Profit"}`,
                          formatCurrency(c.contributionProfit),
                          c.clientId
                        )
                      }
                      className="w-full h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10 mt-2 font-mono"
                    >
                      <span>{isAr ? "عرض القيود المحاسبية للمصدر" : "Drill Down Financial Ledger"}</span>
                      <ArrowUpRight className="size-3 rtl:rotate-180" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Representation (>= md): Full Canonical Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{isAr ? "العميل" : "Client"}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? "الباقة / النطاق" : "Package / Scope"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "المحصل / التعاقدي" : "Collected / Retainer"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "التكاليف المباشرة" : "Direct Costs"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "التمويل الإعلاني" : "Sponsoring"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "العمولة" : "Commission"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "ربح المساهمة" : "Contrib. Profit"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "نسبة الهامش %" : "Margin %"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "اكتمال التكلفة" : "Cost Data"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "فئة الربح" : "Profit Tier"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "صحة التسليم" : "Delivery"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "مخاطر التحصيل" : "Payment Risk"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "التفاصيل" : "Drill-Down"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono tabular-nums">
                  {analyticsData.clientProfitability.map((c) => (
                    <tr key={c.clientId} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 font-semibold text-foreground text-start">
                        {c.clientName}
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          {c.industry}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-start">{c.packageTitle}</td>
                      <td className="py-3 px-3 text-end font-medium">
                        <div>
                          <span className="text-foreground">{formatCurrency(c.revenue)}</span>
                          {c.contractedRevenue && c.contractedRevenue !== c.revenue ? (
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              {isAr ? "التعاقدي:" : "Retainer:"} {formatCurrency(c.contractedRevenue)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-end text-rose-400">
                        {c.directCosts > 0 ? `-${formatCurrency(c.directCosts)}` : formatCurrency(0)}
                      </td>
                      <td className="py-3 px-3 text-end text-rose-400">
                        {c.sponsoringCost > 0 ? `-${formatCurrency(c.sponsoringCost)}` : formatCurrency(0)}
                      </td>
                      <td className="py-3 px-3 text-end text-rose-400">
                        {c.salesCommission > 0 ? `-${formatCurrency(c.salesCommission)}` : formatCurrency(0)}
                      </td>
                      <td className={`py-3 px-3 text-end font-bold ${c.contributionProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(c.contributionProfit)}
                      </td>
                      <td className="py-3 px-3 text-end font-bold" dir="ltr">{c.profitMarginPercent}%</td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono ${
                            c.costCompleteness === "incomplete"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          }`}
                        >
                          {c.costCompleteness === "incomplete" ? (isAr ? "ناقصة" : "Incomplete") : (isAr ? "مكتملة" : "Verified")}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            c.health === "HIGH PROFIT"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.health === "MEDIUM"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : c.health === "NO DATA"
                              ? "bg-muted text-muted-foreground border-border"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.health === "HIGH PROFIT" ? (isAr ? "ربح مرتفع" : "HIGH PROFIT") :
                           c.health === "MEDIUM" ? (isAr ? "متوسط" : "MEDIUM") :
                           c.health === "NO DATA" ? (isAr ? "لا توجد بيانات" : "NO DATA") :
                           (isAr ? "منخفض" : "LOW")}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            c.deliveryHealth === "ON_TRACK"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.deliveryHealth === "AT_RISK"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.deliveryHealth === "ON_TRACK"
                            ? (isAr ? "على المسار" : "On Track")
                            : c.deliveryHealth === "AT_RISK"
                            ? (isAr ? `مهدد (${c.overdueTasksCount || 1})` : `At Risk (${c.overdueTasksCount || 1})`)
                            : (isAr ? "متأخر" : "Delayed")}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            c.paymentRisk === "LOW"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.paymentRisk === "MODERATE"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.paymentRisk === "LOW"
                            ? (isAr ? "منخفض" : "Low Risk")
                            : c.paymentRisk === "MODERATE"
                            ? (isAr ? "متوسط" : "Moderate")
                            : (isAr ? "مرتفع" : "High Risk")}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openDrillDown(
                              "client_contribution_profit",
                              `${c.clientName} ${isAr ? "ربح مساهمة" : "Contribution Profit"}`,
                              formatCurrency(c.contributionProfit),
                              c.clientId
                            )
                          }
                          className="h-7 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
                        >
                          <span>{isAr ? "تفصيل" : "Drill Down"}</span>
                          <ArrowUpRight className="size-3 rtl:rotate-180" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: PACKAGE PROFITABILITY                             */}
        {/* With strict protection against fake 100% margins         */}
        {/* ======================================================== */}
        <TabsContent value="package_profitability" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {analyticsData.packageProfitability.map((pkg) => (
              <div
                key={pkg.packageId}
                className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between h-full group"
              >
                <div>
                  {/* HEADER: Package Name, Tier, Margin badge */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-base text-foreground font-heading truncate group-hover:text-primary transition-colors text-start">
                        {pkg.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                          {isAr ? `فئة ${pkg.tier}` : `${pkg.tier} Tier`}
                        </span>
                        {pkg.activeSubscriptionsCount > 0 && (
                          <span className="text-[10px] font-mono text-primary">
                            • {pkg.activeSubscriptionsCount} {isAr ? "مشترك نشط" : "active"}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-lg ${
                        pkg.isIncompleteCostData
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          : (pkg.grossMarginPercent ?? 0) >= 50
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : (pkg.grossMarginPercent ?? 0) >= 30
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                      }`}
                    >
                      {pkg.isIncompleteCostData
                        ? (isAr ? "بيانات تكلفة غير مكتملة" : "Incomplete Cost Data")
                        : (isAr ? `هامش ${pkg.grossMarginPercent}%` : `${pkg.grossMarginPercent}% Margin`)}
                    </Badge>
                  </div>

                  {/* PRIMARY METRIC: SELLING PRICE */}
                  <div className="my-3 p-3 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/60 flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-muted-foreground uppercase">
                      {isAr ? "سعر البيع" : "Selling Price"}
                    </span>
                    <span className="text-lg font-bold font-display tracking-tight tabular-nums sada-num-metric text-foreground">
                      {formatCurrency(pkg.sellingPrice)}
                    </span>
                  </div>

                  {/* COST BREAKDOWN */}
                  <div className="space-y-1.5 text-xs font-mono tabular-nums text-muted-foreground divide-y divide-border/30">
                    <div className="flex justify-between items-center pt-1">
                      <span className="truncate pe-2 text-start">{isAr ? "تكلفة الموظف الداخلي" : "Internal Employee Cost"}</span>
                      <span className="text-foreground shrink-0 font-medium">{formatCurrency(pkg.employeeCost)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="truncate pe-2 text-start">{isAr ? "المواهب المستقلة" : "Freelancer Talent"}</span>
                      <span className="text-foreground shrink-0 font-medium">{formatCurrency(pkg.freelancerCost)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="truncate pe-2 text-start">{isAr ? "النقل واللوجستيات" : "Transport / Logistics"}</span>
                      <span className="text-foreground shrink-0 font-medium">{formatCurrency(pkg.transportCost)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="truncate pe-2 text-start">{isAr ? "مخصصات البرمجيات" : "Software Allocation"}</span>
                      <span className="text-foreground shrink-0 font-medium">{formatCurrency(pkg.subscriptionAllocation)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="truncate pe-2 text-start">{isAr ? "عمولة المبيعات" : "Sales Commission"}</span>
                      <span className="text-foreground shrink-0 font-medium">{formatCurrency(pkg.commission)}</span>
                    </div>
                  </div>
                </div>

                {/* RESULT & ACTION FOOTER */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider block text-start">
                      {isAr ? "الربح الإجمالي" : "Gross Profit"}
                    </span>
                    <p className={`text-base font-bold font-display tracking-tight tabular-nums sada-num-metric ${
                      pkg.isIncompleteCostData ? "text-amber-500" : "text-emerald-500 dark:text-emerald-400"
                    }`}>
                      {pkg.isIncompleteCostData
                        ? (isAr ? "بيانات ناقصة" : "Incomplete Costs")
                        : formatCurrency(pkg.grossProfit)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openDrillDown(
                        "package_profitability",
                        `${pkg.name} ${isAr ? "الربح الإجمالي" : "Gross Profit"}`,
                        pkg.isIncompleteCostData ? "Incomplete" : formatCurrency(pkg.grossProfit),
                        pkg.packageId
                      )
                    }
                    className="text-xs gap-1.5 h-8 px-3 font-mono shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <span>{isAr ? "معاينة" : "Inspect"}</span>
                    <ArrowUpRight className="size-3 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: SERVICE PROFITABILITY                             */}
        {/* ======================================================== */}
        <TabsContent value="service_profitability" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/60">
              <h3 className="text-sm font-bold font-heading text-foreground">
                {isAr ? "ربحية مساهمة خطوط الخدمات" : "Service Line Contribution Profitability"}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                {isAr
                  ? "العمالة المباشرة من جلسات العمل + أدوات الإنتاج المخصصة مقابل الإيرادات المحققة"
                  : "Direct labor from work sessions + allocated production tooling vs revenue generated"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{isAr ? "خط الخدمة" : "Service Line"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "الإيرادات المحققة" : "Service Revenue"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "تكلفة العمالة المباشرة" : "Direct Labor"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "المصاريف المخصصة" : "Allocated Expenses"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "إجمالي التكلفة" : "Total Costs"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "هامش المساهمة" : "Contribution Margin"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "نسبة الهامش %" : "Margin %"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "المشاريع النشطة" : "Active Projects"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono tabular-nums">
                  {analyticsData.serviceProfitability.map((svc) => (
                    <tr key={svc.serviceName} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 font-semibold text-foreground text-start">{svc.serviceName}</td>
                      <td className="py-3 px-3 text-end font-medium">{formatCurrency(svc.serviceRevenue)}</td>
                      <td className="py-3 px-3 text-end text-rose-400">-{formatCurrency(svc.directLaborCost)}</td>
                      <td className="py-3 px-3 text-end text-rose-400">-{formatCurrency(svc.allocatedExpenses)}</td>
                      <td className="py-3 px-3 text-end text-rose-400 font-medium">-{formatCurrency(svc.totalDirectCosts)}</td>
                      <td className="py-3 px-3 text-end font-bold text-emerald-400">
                        {formatCurrency(svc.contributionMargin)}
                      </td>
                      <td className="py-3 px-3 text-end font-bold" dir="ltr">{svc.marginPercent}%</td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {svc.activeProjectsCount}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 4: EMPLOYEE PERFORMANCE                              */}
        {/* ======================================================== */}
        <TabsContent value="employee_performance" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/60">
              <h3 className="text-sm font-bold font-heading text-foreground">
                {isAr ? "مصفوفة أداء وإنتاجية أعضاء الفريق" : "Team Performance & Production Matrix"}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                {isAr
                  ? "الساعات الفعلية من سجلات العمل المعتمدة + معدل إنجاز المهام المسندة"
                  : "Actual hours from verified work sessions + assigned task completion rate"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{isAr ? "العضو" : "Team Member"}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? "الدور الوظيفي" : "Role"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "المسندة" : "Assigned"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "المنجزة" : "Done"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "المتأخرة" : "Overdue"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "الساعات الفعلية" : "Actual Hrs"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "الساعات المقدرة" : "Est. Hrs"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "معدل الإنجاز %" : "Completion %"}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? "تكلفة العمالة المحققة" : "Labor Cost"}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? "التفاصيل" : "Drill-Down"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono tabular-nums">
                  {analyticsData.employeePerformance.map((emp) => (
                    <tr key={emp.teamMemberId} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 font-semibold text-foreground text-start">{emp.name}</td>
                      <td className="py-3 px-3 text-muted-foreground text-start">{emp.role}</td>
                      <td className="py-3 px-3 text-end">{emp.assignedTasks}</td>
                      <td className="py-3 px-3 text-end text-emerald-400 font-bold">{emp.completedTasks}</td>
                      <td className="py-3 px-3 text-end text-rose-400 font-bold">{emp.overdueTasks}</td>
                      <td className="py-3 px-3 text-end font-medium">{emp.actualHours}h</td>
                      <td className="py-3 px-3 text-end text-muted-foreground">{emp.estimatedHours}h</td>
                      <td className="py-3 px-3 text-end font-bold" dir="ltr">{emp.completionRatePercent}%</td>
                      <td className="py-3 px-3 text-end font-bold text-foreground">{formatCurrency(emp.laborCostGenerated)}</td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openDrillDown(
                              "employee_actual_hours",
                              `${emp.name} Hours`,
                              `${emp.actualHours}h`,
                              emp.teamMemberId
                            )
                          }
                          className="h-7 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
                        >
                          <span>{isAr ? "تفصيل" : "Drill"}</span>
                          <ArrowUpRight className="size-3 rtl:rotate-180" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 5: SALES PERFORMANCE                                 */}
        {/* ======================================================== */}
        <TabsContent value="sales_performance" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "إجمالي الفرص" : "Total Deals"}</span>
              <p className="text-xl font-bold font-mono text-foreground">{analyticsData.salesPerformance.totalLeads + analyticsData.salesPerformance.dealsInProgress}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "الصفقات الرابحة" : "Won Deals"}</span>
              <p className="text-xl font-bold font-mono text-emerald-400">{analyticsData.salesPerformance.wonDeals}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "معدل التحويل" : "Conversion Rate"}</span>
              <p className="text-xl font-bold font-mono text-primary" dir="ltr">{analyticsData.salesPerformance.conversionRatePercent}%</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "إيراد الصفقات الرابحة" : "Won Pipeline Revenue"}</span>
              <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(analyticsData.salesPerformance.wonPipelineRevenue)}</p>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 6: PRODUCTION PERFORMANCE                            */}
        {/* ======================================================== */}
        <TabsContent value="production_performance" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "إجمالي الحجوزات" : "Bookings"}</span>
              <p className="text-xl font-bold font-mono text-foreground">{analyticsData.productionPerformance.totalBookings}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "ساعات التصوير" : "Shooting Hours"}</span>
              <p className="text-xl font-bold font-mono text-primary">{analyticsData.productionPerformance.totalShootingHours}h</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "نسبة التسليم في الموعد" : "On-Time Rate"}</span>
              <p className="text-xl font-bold font-mono text-emerald-400" dir="ltr">{analyticsData.productionPerformance.onTimeDeliveryRatePercent}%</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "متوسط مدة الإنجاز" : "Avg Turnaround"}</span>
              <p className="text-xl font-bold font-mono text-foreground">{analyticsData.productionPerformance.averageTurnaroundDays} {isAr ? "أيام" : "days"}</p>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 7: MONTHLY P&L                                       */}
        {/* ======================================================== */}
        <TabsContent value="monthly_pnl" className="space-y-4">
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div>
                <h3 className="text-sm font-bold font-heading text-foreground">
                  {isAr ? "بيان الأرباح والخسائر المعتمد P&L" : "Audited Monthly P&L Statement"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {analyticsData.monthlyPnL.periodMonth}
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-bold text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                {isAr ? "صافي الربح:" : "Net:"} {formatCurrency(analyticsData.monthlyPnL.netProfit)}
              </Badge>
            </div>

            <div className="space-y-2 divide-y divide-border/30">
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-foreground">{isAr ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                <span className="font-bold text-foreground">{formatCurrency(analyticsData.monthlyPnL.totalRevenue)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "أتعاب خدمات وباقات الوكالة" : "Client Services Revenue"}</span>
                <span>{formatCurrency(analyticsData.monthlyPnL.clientServicesRevenue)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "المبالغ المحصلة للتمويل الإعلاني" : "Sponsoring Collected"}</span>
                <span>{formatCurrency(analyticsData.monthlyPnL.sponsoringCollected)}</span>
              </div>

              <div className="flex justify-between items-center pt-3 font-bold text-rose-400">
                <span>{isAr ? "تكلفة المبيعات والتنفيذ المباشر (COGS)" : "COGS & Direct Operational Costs"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.cogsDirectCosts)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "العمالة المباشرة وجلسات الإنتاج" : "Direct Labor & Production"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.directLaborCost)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "شراء الوسائط والإعلانات الممولة" : "Sponsoring Ad Spend"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.sponsoringPurchasesCost)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "عمولات المبيعات المعتمدة" : "Sales Commissions"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.salesCommissionsCost)}</span>
              </div>

              <div className="flex justify-between items-center pt-3 font-bold text-emerald-400 bg-emerald-500/5 p-2 rounded-xl">
                <span>{isAr ? "ربح المساهمة الإجمالي (Gross Profit)" : "Gross Contribution Profit"}</span>
                <span>{formatCurrency(analyticsData.monthlyPnL.grossProfit)} ({analyticsData.monthlyPnL.grossMarginPercent}%)</span>
              </div>

              <div className="flex justify-between items-center pt-3 font-bold text-rose-400">
                <span>{isAr ? "المصاريف التشغيلية (OpEx)" : "Operating Expenses (OpEx)"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.operatingExpenses)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "اشتراكات البرمجيات والأدوات SaaS" : "Software Subscriptions"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.softwareSubscriptions)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 ps-4 text-muted-foreground">
                <span>{isAr ? "المصاريف الإدارية والعمومية" : "General Administrative Overhead"}</span>
                <span>-{formatCurrency(analyticsData.monthlyPnL.generalOverhead)}</span>
              </div>

              <div className="flex justify-between items-center pt-3 font-bold text-base bg-card border border-border/80 p-3 rounded-xl">
                <span className="text-foreground">{isAr ? "صافي الربح النهائي (Net Profit)" : "Final Net Profit"}</span>
                <span className={analyticsData.monthlyPnL.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {formatCurrency(analyticsData.monthlyPnL.netProfit)} ({analyticsData.monthlyPnL.netMarginPercent}%)
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 8: CASH FLOW                                         */}
        {/* ======================================================== */}
        <TabsContent value="cash_flow" className="space-y-4">
          <CashFlowTreasuryView
            cashFlow={analyticsData.cashFlow}
            onOpenDrillDown={openDrillDown}
          />
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 9: COMMISSIONS                                       */}
        {/* ======================================================== */}
        <TabsContent value="commission_performance" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "الإيراد المؤهل للعمولة" : "Eligible Revenue"}</span>
              <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(analyticsData.commissionPerformance.totalEligibleServiceRevenue)}</p>
              <span className="text-[10px] text-muted-foreground font-mono">{isAr ? "مستبعد منه التمويل" : "Sponsoring excluded"}</span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "العمولات المستحقة" : "Accrued Commissions"}</span>
              <p className="text-xl font-bold font-mono text-purple-400">{formatCurrency(analyticsData.commissionPerformance.totalCommissionsAccrued)}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "العمولات المعتمدة" : "Approved"}</span>
              <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(analyticsData.commissionPerformance.commissionsApproved)}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1 shadow-2xs">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{isAr ? "العمولات المدفوعة" : "Paid"}</span>
              <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(analyticsData.commissionPerformance.commissionsPaid)}</p>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 10: REVENUE TRENDS                                   */}
        {/* ======================================================== */}
        <TabsContent value="revenue_trends" className="space-y-4">
          <FinancialTrendsChart
            revenueTrends={analyticsData.revenueTrends}
            onOpenDrillDown={openDrillDown}
          />
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 11: AUDIT & ACTIVITY                                 */}
        {/* ======================================================== */}
        <TabsContent value="audit_activity" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/60">
              <h3 className="text-sm font-bold font-heading text-foreground">
                {isAr ? "سجل التدقيق الإداري والنشاط الأخير" : "System Audit & Activity Logs"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{isAr ? "التاريخ والوقت" : "Timestamp"}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? "المستخدم" : "Actor"}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? "الإجراء" : "Action"}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? "الكيان" : "Entity"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {auditLogs.slice(0, 20).map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground">{log.created_at}</td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">{log.actor_name || "System"}</td>
                      <td className="py-2.5 px-3 text-primary">{log.action}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{log.entity_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 5. DRILL-DOWN MODAL */}
      <AnalyticsDrillDownModal
        drillDown={drillDown}
        onClose={() => setDrillDown(null)}
      />
    </div>
  );
}
