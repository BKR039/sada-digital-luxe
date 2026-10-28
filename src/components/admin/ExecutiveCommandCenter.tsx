import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatCurrency } from "@/types/finance";
import type {
  FullManagementAnalyticsData,
  AnalyticsDrillDownState,
  ClientProfitabilityItem,
  PackageProfitabilityItem,
} from "@/types/notifications-and-audit";
import { buildAnalyticsDrillDown } from "@/lib/analytics-service";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  Briefcase,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Info,
  Sparkles,
  CreditCard,
  FileText,
  UserCheck,
  Building,
  Target,
  ChevronRight,
  ExternalLink,
  Flame,
  PieChart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { isTaskOverdue, type TaskRow, type ProjectRow } from "@/components/admin/project-utils";
import type { FinancialAccount } from "@/types/finance";

// DEF-ECC-06: Helper for Month-over-Month Delta formatting
function formatMoMDelta(
  deltaPercent: number | null | undefined,
  isRTL: boolean,
  type: "revenue" | "expense"
): { text: string; className: string } {
  if (deltaPercent === null || deltaPercent === undefined || !Number.isFinite(deltaPercent)) {
    return {
      text: isRTL ? "بيانات المقارنة غير متوفرة" : "No prior period data",
      className: "text-muted-foreground",
    };
  }

  const rounded = Math.round(deltaPercent * 10) / 10;
  if (Math.abs(rounded) < 0.05) {
    return {
      text: isRTL ? "0.0% مقارنة بالشهر السابق" : "0.0% vs last month",
      className: "text-muted-foreground font-medium",
    };
  }

  const isPositive = rounded > 0;
  const sign = isPositive ? "+" : "";
  const formattedPercent = `${sign}${rounded.toFixed(1)}%`;
  const text = isRTL
    ? `${formattedPercent} مقارنة بالشهر السابق`
    : `${formattedPercent} vs last month`;

  if (type === "revenue") {
    // For revenue: growth (+) is good (emerald), decline (-) is warning (rose)
    return {
      text,
      className: isPositive
        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
        : "text-rose-600 dark:text-rose-400 font-semibold",
    };
  } else {
    // For operating expenses: reduction (-) is savings (emerald), expansion (+) is increased spend (rose)
    return {
      text,
      className: isPositive
        ? "text-rose-600 dark:text-rose-400 font-semibold"
        : "text-emerald-600 dark:text-emerald-400 font-semibold",
    };
  }
}

interface ExecutiveCommandCenterProps {
  analyticsData: FullManagementAnalyticsData;
  tasks: TaskRow[];
  projects: ProjectRow[];
  isSuperAdmin: boolean;
  onOpenDrillDown: (drillDown: AnalyticsDrillDownState) => void;
  onSelectTask?: (task: TaskRow) => void;
}

export function ExecutiveCommandCenter({
  analyticsData,
  tasks,
  projects,
  isSuperAdmin,
  onOpenDrillDown,
  onSelectTask,
}: ExecutiveCommandCenterProps) {
  const { t, isRTL } = useTranslation();
  const [activeSection, setActiveSection] = useState<
    "all" | "financial" | "operations" | "clients" | "team" | "intelligence"
  >("all");

  const { financeState, clientProfitability, packageProfitability, employeePerformance, commissionPerformance } = analyticsData;
  const kpis = financeState.kpis;

  // 1. Available liquid cash across treasury bank & cash accounts (DEF-ECC-01)
  const rawAccounts: FinancialAccount[] = Array.isArray(financeState?.accounts) ? financeState.accounts : [];
  const hasAccountsData = Boolean(financeState && Array.isArray(financeState.accounts));

  // Active accounts only (exclude inactive)
  const activeAccounts = rawAccounts.filter((a) => a.status === "active" || (a as any).status === undefined);
  const tndAccounts = activeAccounts.filter((a) => (a.currency || "TND") === "TND");
  const usdAccounts = activeAccounts.filter((a) => a.currency === "USD");
  const cashTnd = tndAccounts.reduce((sum, a) => {
    const rawBal = a.currentBalance !== undefined ? a.currentBalance : (a as any).current_balance;
    const num = Number(rawBal);
    return sum + (Number.isFinite(num) ? num : 0);
  }, 0);
  const cashUsd = usdAccounts.reduce((sum, a) => {
    const rawBal = a.currentBalance !== undefined ? a.currentBalance : (a as any).current_balance;
    const num = Number(rawBal);
    return sum + (Number.isFinite(num) ? num : 0);
  }, 0);

  // Authoritative liquid cash: prefer verified TND accounts sum, fallback to kpis.cash if accounts not loaded
  const totalAvailableCash: number | null = hasAccountsData
    ? cashTnd
    : (typeof kpis?.cash === "number" && Number.isFinite(kpis.cash) ? kpis.cash : null);

  const availableCashDisplay = totalAvailableCash !== null
    ? cashUsd > 0
      ? `${formatCurrency(totalAvailableCash, { currency: "TND" })} + ${formatCurrency(cashUsd, { currency: "USD" })}`
      : formatCurrency(totalAvailableCash, { currency: "TND" })
    : "—";

  // 2. Who owes SADA money (DEF-ECC-08: Unpaid & overdue client invoices with partial payment subtraction)
  const unpaidInvoices = financeState.invoices.filter(
    (i: any) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft"
  );
  const totalOutstandingReceivables = unpaidInvoices.reduce(
    (sum: number, i: any) => sum + Math.max(0, (Number(i.totalAmount) || 0) - (Number(i.paidAmount) || 0)),
    0
  );

  // 3. Overdue Tasks (DEF-ECC-09: Synchronized robust deadline evaluation)
  const overdueTasks = tasks.filter((t) => isTaskOverdue(t));

  // 4. Projects at Risk
  const atRiskProjects = projects.filter(
    (p) => p.status === "blocked" || p.status === "in_review" || overdueTasks.some((t) => t.project_id === p.id)
  );

  // 5. Employees with pending salary requests
  const pendingRequests = financeState.salaryRequests.filter((r: any) => r.status === "pending");

  // 6. Upcoming salaries & commissions
  const upcomingSalariesCommitment = financeState.salaryRecords.reduce(
    (sum: number, s: any) => sum + (Number(s.base_amount) || 0),
    0
  );
  const upcomingCommissions =
    (commissionPerformance.commissionsPending || 0) + (commissionPerformance.commissionsApproved || 0);
  const totalUpcomingPayroll = upcomingSalariesCommitment + upcomingCommissions;

  // Intelligence calculations & Runway (DEF-ECC-03)
  const netMargin = analyticsData.monthlyPnL.netMarginPercent ?? 0;
  const rawBurn = (kpis as any).recurringBurn ?? (kpis as any).monthlyBurnRate ?? (analyticsData?.executiveKPIs?.operatingExpenses as any)?.monthlyBurnRate;
  const recurringBurn = typeof rawBurn === "number" && Number.isFinite(rawBurn) && rawBurn > 0 ? rawBurn : 0;
  const isBurnKnown = rawBurn !== undefined && rawBurn !== null && Number.isFinite(Number(rawBurn));

  // Runway projection: strictly requires verified cash data and valid burn data
  let runwayMonths: number | null = null;
  if (totalAvailableCash !== null && isBurnKnown) {
    if (recurringBurn > 0) {
      runwayMonths = Math.max(0, Math.round((totalAvailableCash / recurringBurn) * 10) / 10);
    } else if (totalAvailableCash > 0) {
      // Zero burn with positive cash means infinite / safe runway
      runwayMonths = 999;
    } else {
      runwayMonths = 0;
    }
  }

  // 7. Top most profitable clients
  const sortedClients = [...clientProfitability].sort(
    (a, b) => b.contributionProfit - a.contributionProfit
  );

  // 8. Top most profitable packages
  const sortedPackages = [...packageProfitability].sort(
    (a, b) => b.grossProfit - a.grossProfit
  );

  // Drill down helper
  const triggerDrillDown = (metricType: string, label: string, value: string | number, entityId?: string) => {
    const drill = buildAnalyticsDrillDown({
      metricType,
      metricLabel: label,
      metricValue: value,
      entityId,
      data: analyticsData,
    });
    onOpenDrillDown(drill);
  };

  return (
    <div className="space-y-6 sm:space-y-8" dir={isRTL ? "rtl" : "ltr"}>
      {/* ============================================================ */}
      {/* LEVEL 1: OVERVIEW 2x2 COMPACT METRIC GRID & QUICK INSIGHTS   */}
      {/* ============================================================ */}
      <div className="space-y-4">
        {/* Overview Header Row */}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold font-display text-foreground">
            {t("commandCenter.overviewTitle", isRTL ? "نظرة عامة" : "Overview")}
          </h2>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-card border border-border text-xs font-semibold text-foreground shadow-2xs">
            <span>{t("commandCenter.thisMonth", isRTL ? "هذا الشهر" : "This Month")}</span>
            <ChevronRight className="size-3 text-muted-foreground rotate-90" />
          </div>
        </div>

        {/* 2x2 Metric Grid — Desktop only (md:) to avoid duplicating Collected Revenue & Operating Spent on mobile */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
          {/* Card 1: Collected Revenue (DEF-ECC-06: Live MoM Delta) */}
          <div
            onClick={() => triggerDrillDown("monthly_revenue", t("commandCenter.metrics.collectedRevenue", isRTL ? "الإيرادات المحصلة" : "Collected Revenue"), formatCurrency(kpis.totalIncome))}
            className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-emerald-500/40 shadow-2xs space-y-1 sm:space-y-1.5 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs font-medium gap-1">
              <span className="truncate">{t("commandCenter.metrics.collectedRevenue", isRTL ? "الإيرادات المحصلة" : "Collected Revenue")}</span>
              <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <TrendingUp className="size-3 sm:size-3.5" />
              </span>
            </div>
            <div className="text-base sm:text-xl md:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums truncate">
              {formatCurrency(kpis.totalIncome)}
            </div>
            {(() => {
              const delta = formatMoMDelta(kpis?.incomeDeltaPercent, isRTL, "revenue");
              return (
                <div className={`text-[9px] sm:text-[11px] truncate ${delta.className}`}>
                  {delta.text}
                </div>
              );
            })()}
          </div>

          {/* Card 2: Operating Spent (DEF-ECC-06: Live MoM Delta) */}
          <div
            onClick={() => triggerDrillDown("monthly_expenses", t("commandCenter.metrics.operatingSpent", isRTL ? "المصاريف التشغيلية" : "Operating Spent"), formatCurrency(kpis.totalExpenses))}
            className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-rose-500/40 shadow-2xs space-y-1 sm:space-y-1.5 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs font-medium gap-1">
              <span className="truncate">{t("commandCenter.metrics.operatingSpent", isRTL ? "المصاريف التشغيلية" : "Operating Spent")}</span>
              <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                <TrendingDown className="size-3 sm:size-3.5" />
              </span>
            </div>
            <div className="text-base sm:text-xl md:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums truncate">
              {formatCurrency(kpis.totalExpenses)}
            </div>
            {(() => {
              const delta = formatMoMDelta(kpis?.expenseDeltaPercent, isRTL, "expense");
              return (
                <div className={`text-[9px] sm:text-[11px] truncate ${delta.className}`}>
                  {delta.text}
                </div>
              );
            })()}
          </div>

          {/* Card 3: Active Projects (DEF-ECC-07: Genuine count without arbitrary fallback) */}
          <div
            onClick={() => setActiveSection("operations")}
            className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-primary/40 shadow-2xs space-y-1 sm:space-y-1.5 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs font-medium gap-1">
              <span className="truncate">{t("commandCenter.activeProjects", isRTL ? "المشاريع النشطة" : "Active Projects")}</span>
              <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-primary/10 text-primary shrink-0">
                <Briefcase className="size-3 sm:size-3.5" />
              </span>
            </div>
            <div className="text-base sm:text-xl md:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums truncate">
              {projects.filter(p => p.status === "active" || p.status === "in_progress").length}
            </div>
            <div className="text-[9px] sm:text-[11px] font-medium text-muted-foreground truncate">
              {isRTL ? `${atRiskProjects.length} تحت الخطر` : `${atRiskProjects.length} at risk`}
            </div>
          </div>

          {/* Card 4: Pending Client Items (DEF-ECC-07: Genuine count without fallback || 4) */}
          <div
            onClick={() => setActiveSection("clients")}
            className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-amber-500/40 shadow-2xs space-y-1 sm:space-y-1.5 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs font-medium gap-1">
              <span className="truncate">{t("commandCenter.pendingClientItems", isRTL ? "معاملات العملاء المعلقة" : "Pending Client Items")}</span>
              <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-3 sm:size-3.5" />
              </span>
            </div>
            <div className="text-base sm:text-xl md:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums truncate">
              {unpaidInvoices.length + (overdueTasks.length ? 1 : 0)}
            </div>
            <div className="text-[9px] sm:text-[11px] font-medium text-amber-600 dark:text-amber-400 truncate">
              {isRTL ? "تتطلب متابعة" : "Require attention"}
            </div>
          </div>
        </div>

        {/* Quick Insights Banner (DEF-ECC-07: Genuine counts with all-clear healthy state) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold font-display text-foreground">
              {t("commandCenter.quickInsights", isRTL ? "رؤى سريعة" : "Quick Insights")}
            </h3>
            <button
              type="button"
              onClick={() => setActiveSection("intelligence")}
              className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t("common.viewAll", isRTL ? "عرض الكل" : "View all")}</span>
              <span>{isRTL ? "←" : "→"}</span>
            </button>
          </div>

          {atRiskProjects.length > 0 ? (
            <div
              onClick={() => setActiveSection("operations")}
              className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-3 cursor-pointer hover:bg-rose-500/15 transition-colors"
            >
              <div className="size-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400 leading-snug">
                  {isRTL
                    ? `${atRiskProjects.length} مشاريع تتطلب الانتباه`
                    : `${atRiskProjects.length} Projects Need Attention`}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight truncate">
                  {isRTL
                    ? "عملاء بانتظار المواد أو الاعتماد"
                    : "Clients waiting for assets or approval"}
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setActiveSection("operations")}
              className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 cursor-pointer hover:bg-emerald-500/15 transition-colors"
            >
              <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-snug">
                  {isRTL ? "جميع المشاريع على المسار الصحيح" : "All Projects on Track"}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight truncate">
                  {isRTL ? "لا توجد مشاريع متعثرة أو متأخرة حالياً" : "Zero active client projects are blocked or at risk"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION NAV / FILTER PILLS */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-border/60 pb-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl sm:rounded-2xl bg-muted/80 border border-border overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: "all", label: t("commandCenter.tabs.all", "Executive Overview"), icon: Sparkles },
            { id: "financial", label: t("commandCenter.tabs.financial", "Financial Command"), icon: DollarSign },
            { id: "operations", label: t("commandCenter.tabs.operations", "Operations Command"), icon: Briefcase },
            { id: "clients", label: t("commandCenter.tabs.clients", "Client Command"), icon: Building },
            { id: "team", label: t("commandCenter.tabs.team", "Team Command"), icon: Users },
            { id: "intelligence", label: t("commandCenter.tabs.intelligence", "Intelligence & Risks"), icon: ShieldAlert },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as any)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-card text-foreground shadow-xs font-extrabold border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5 text-primary" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] sm:text-[11px] font-mono bg-primary/5 text-primary border-primary/20 px-2 sm:px-2.5 py-0.5 sm:py-1">
            {t("commandCenter.metrics.canonicalLedgerPulse", "CANONICAL LEDGER PULSE")}
          </Badge>
          <Link
            to="/admin/analytics"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted transition-colors font-medium whitespace-nowrap"
          >
            <span>{t("commandCenter.metrics.fullAnalytics", "Full Analytics")}</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TOP 5 EXECUTIVE METRICS (DIRECT ANSWERS AT A GLANCE) */}
      {/* 1. Collected Revenue | 2. Spent Expenses | 3. Net Profit | 4. Available Cash | 5. Outstanding */}
      {/* ============================================================ */}
      <div className="flex sm:grid overflow-x-auto sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3.5 no-scrollbar pb-1 snap-x">
        {/* CARD 1: COLLECTED REVENUE */}
        <div
          onClick={() => triggerDrillDown("monthly_revenue", t("commandCenter.metrics.collectedRevenue", "Collected Revenue This Month"), formatCurrency(kpis.totalIncome))}
          className="group relative min-w-[155px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1 text-muted-foreground text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2">
            <span className="truncate">{t("commandCenter.metrics.collectedRevenue", "Collected Revenue")}</span>
            <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform shrink-0">
              <TrendingUp className="size-3 sm:size-3.5" />
            </span>
          </div>
          <div className="text-xs min-[360px]:text-sm sm:text-xl md:text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-foreground break-words leading-tight">
            {formatCurrency(kpis.totalIncome)}
          </div>
          <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="truncate">{t("commandCenter.metrics.q1Answer", "Q1: Collected")}</span>
            <span className="text-primary font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-0.5">
              {t("commandCenter.metrics.drillDown", "Drill down")} <ArrowUpRight className="size-2.5" />
            </span>
          </div>
        </div>

        {/* CARD 2: TOTAL SPENT */}
        <div
          onClick={() => triggerDrillDown("monthly_expenses", t("commandCenter.metrics.operatingSpent", "Operating Expenses Spent"), formatCurrency(kpis.totalExpenses))}
          className="group relative min-w-[155px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1 text-muted-foreground text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2">
            <span className="truncate">{t("commandCenter.metrics.operatingSpent", "Operating Spent")}</span>
            <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform shrink-0">
              <TrendingDown className="size-3 sm:size-3.5" />
            </span>
          </div>
          <div className="text-xs min-[360px]:text-sm sm:text-xl md:text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-foreground break-words leading-tight">
            {formatCurrency(kpis.totalExpenses)}
          </div>
          <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="truncate">{t("commandCenter.metrics.q2Answer", "Q2: Spent")}</span>
            <span className="text-primary font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-0.5">
              {t("commandCenter.metrics.drillDown", "Drill down")} <ArrowUpRight className="size-2.5" />
            </span>
          </div>
        </div>

        {/* CARD 3: ACTUAL NET PROFIT */}
        <div
          onClick={() => triggerDrillDown("monthly_net_profit", t("commandCenter.metrics.actualNetProfit", "Net Operating Profit"), formatCurrency(kpis.netProfit))}
          className="group relative min-w-[155px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1 text-muted-foreground text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2">
            <span className="truncate">{t("commandCenter.metrics.actualNetProfit", "Actual Net Profit")}</span>
            <span className={`p-0.5 sm:p-1 rounded-md sm:rounded-lg ${kpis.netProfit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"} group-hover:scale-110 transition-transform shrink-0`}>
              <DollarSign className="size-3 sm:size-3.5" />
            </span>
          </div>
          <div className={`text-xs min-[360px]:text-sm sm:text-xl md:text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi break-words leading-tight ${kpis.netProfit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {formatCurrency(kpis.netProfit)}
          </div>
          <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="truncate">{t("commandCenter.metrics.netMargin", "Margin")}: {netMargin}%</span>
            <span className="text-primary font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-0.5">
              {t("commandCenter.metrics.drillDown", "Drill down")} <ArrowUpRight className="size-2.5" />
            </span>
          </div>
        </div>

        {/* CARD 4: AVAILABLE CASH (DEF-ECC-01) */}
        <div
          onClick={() => triggerDrillDown("cash_balance", t("commandCenter.metrics.availableCash", "Available Liquid Cash Reserves"), availableCashDisplay)}
          className="group relative min-w-[155px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-cyan-500/50 hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1 text-muted-foreground text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2">
            <span className="truncate">{t("commandCenter.metrics.availableCash", "Cash Available")}</span>
            <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-cyan-500/10 text-cyan-500 group-hover:scale-110 transition-transform shrink-0">
              <CreditCard className="size-3 sm:size-3.5" />
            </span>
          </div>
          <div className="text-xs min-[360px]:text-sm sm:text-xl md:text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-foreground break-words leading-tight">
            {availableCashDisplay}
          </div>
          <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="truncate">{t("finance.tabs.overview", "Treasury & Bank")}</span>
            <span className="text-primary font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-0.5">
              {t("commandCenter.metrics.drillDown", "Drill down")} <ArrowUpRight className="size-2.5" />
            </span>
          </div>
        </div>

        {/* CARD 5: OUTSTANDING RECEIVABLES */}
        <div
          onClick={() => triggerDrillDown("outstanding_invoices", t("commandCenter.metrics.outstandingReceivables", "Outstanding Receivables (Unpaid Invoices)"), formatCurrency(totalOutstandingReceivables))}
          className="group relative min-w-[155px] sm:min-w-0 snap-start shrink-0 sm:shrink sm:col-span-1 lg:col-span-1 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1 text-muted-foreground text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2">
            <span className="truncate">{t("commandCenter.metrics.outstandingReceivables", "Outstanding (Owed)")}</span>
            <span className="p-0.5 sm:p-1 rounded-md sm:rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform shrink-0">
              <Clock className="size-3 sm:size-3.5" />
            </span>
          </div>
          <div className="text-xs min-[360px]:text-sm sm:text-xl md:text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-amber-600 dark:text-amber-400 break-words leading-tight">
            {formatCurrency(totalOutstandingReceivables)}
          </div>
          <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="truncate">{unpaidInvoices.length} {t("finance.invoices.status.unpaid", "Unpaid Invoices")}</span>
            <span className="text-primary font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-0.5">
              {t("commandCenter.metrics.drillDown", "Drill down")} <ArrowUpRight className="size-2.5" />
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. FINANCIAL COMMAND: WHO OWES SADA MONEY & REVENUE HEALTH */}
      {/* ============================================================ */}
      {(activeSection === "all" || activeSection === "financial") && (
        <div className="space-y-4">
          {/* Section Heading Card: Financial Command */}
          <div id="executive-financial-command" className="p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 sm:size-11 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                <DollarSign className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-heading text-foreground truncate">
                  {t("commandCenter.tabs.financial", "Financial Command")}
                </h3>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {isRTL
                    ? "التدفق النقدي الفوري، الفواتير، صرف الرواتب، والهوامش التشغيلية."
                    : "Real-time cash flow, invoicing, payroll disbursements, and operational margins."}
                </p>
              </div>
            </div>
            <Link
              to="/admin/finance"
              className="text-xs sm:text-sm text-primary font-semibold hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{isRTL ? "المالية والمحاسبة" : "Finance & Accounting"}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Table / Cards: Who Owes SADA Money */}
            <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-1.5 h-5 sm:h-6 bg-amber-500 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                      {isRTL ? "إجابة س5: مستحقات العملاء غير المدفوعة" : "Q5 Answer: Unpaid Client Receivables"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {unpaidInvoices.length} {isRTL ? (unpaidInvoices.length === 1 ? "فاتورة واحدة" : "فواتير") : (unpaidInvoices.length === 1 ? "invoice" : "invoices")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerDrillDown("outstanding_invoices", t("commandCenter.metrics.outstandingReceivables", "Unpaid Client Receivables"), formatCurrency(totalOutstandingReceivables))}
                  className="rounded-full h-8 px-3 text-xs font-semibold border-border/80 bg-background hover:bg-muted text-foreground gap-1 shrink-0"
                >
                  <span>{isRTL ? "تفصيل" : "Drill down"}</span>
                  <ArrowUpRight className="size-3 rtl:rotate-[-90deg]" />
                </Button>
              </div>

              {unpaidInvoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground rounded-xl bg-muted/20 border border-dashed border-border/60">
                  <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1.5" />
                  {t("invoices.allSettled", "All client invoices settled! Zero overdue receivables.")}
                </div>
              ) : (
                <>
                  {/* Mobile Structured Record Cards (< md) */}
                  <div className="md:hidden space-y-2.5">
                    {unpaidInvoices.slice(0, 5).map((inv: any) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl sm:rounded-2xl bg-muted/20 border border-border/50 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileText className="size-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-bold text-foreground truncate leading-tight">
                              {inv.clientName || "Client"}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground truncate">
                              {inv.invoiceNumber}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between min-[380px]:justify-end gap-2.5 shrink-0 pt-2 min-[380px]:pt-0 border-t min-[380px]:border-t-0 border-border/40">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                            <div className="text-[11px] leading-tight">
                              <span className="text-[10px] text-muted-foreground block">{t("invoices.dueDate", "Due Date")}</span>
                              <span className="font-medium text-foreground" dir="ltr">
                                {inv.dueDate ? inv.dueDate.split("T")[0] : "—"}
                              </span>
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold rounded-full px-2.5 py-0.5 ${
                              inv.status === "overdue"
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {inv.status}
                          </Badge>

                          <div className="text-end shrink-0">
                            {(() => {
                              const remaining = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
                              const isPartial = Number(inv.paidAmount) > 0;
                              return (
                                <>
                                  <div className="text-xs sm:text-sm font-bold font-mono text-foreground">
                                    {formatCurrency(remaining)}
                                  </div>
                                  {isPartial && (
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      {isRTL ? `المتبقي من ${formatCurrency(inv.totalAmount)}` : `Owed of ${formatCurrency(inv.totalAmount)}`}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            <Link
                              to="/admin/client-workspaces/$id"
                              params={{ id: inv.clientId }}
                              className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 font-medium"
                            >
                              <span>{t("common.actions.view", "View")}</span>
                              <ArrowUpRight className="size-2.5 rtl:rotate-[-90deg]" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (hidden md:block) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground text-[11px] uppercase tracking-wider text-start">
                          <th className="py-2 font-semibold">{t("invoices.client", "Client")}</th>
                          <th className="py-2 font-semibold">{t("invoices.invoiceNumber", "Invoice #")}</th>
                          <th className="py-2 font-semibold">{t("invoices.dueDate", "Due Date")}</th>
                          <th className="py-2 font-semibold">{t("invoices.paymentStatus", "Status")}</th>
                          <th className="py-2 font-semibold text-end">{t("invoices.outstandingBalance", isRTL ? "المبلغ المتبقي" : "Outstanding Balance")}</th>
                          <th className="py-2 font-semibold text-end">{t("common.table.actions", "Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {unpaidInvoices.slice(0, 5).map((inv: any) => {
                          const remaining = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
                          const isPartial = Number(inv.paidAmount) > 0;
                          return (
                            <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 font-bold text-foreground">
                                {inv.clientName || "Client"}
                              </td>
                              <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-2.5 text-muted-foreground">
                                {inv.dueDate ? inv.dueDate.split("T")[0] : "—"}
                              </td>
                              <td className="py-2.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] uppercase font-bold ${
                                    inv.status === "overdue"
                                      ? "bg-destructive/10 text-destructive border-destructive/30"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  }`}
                                >
                                  {inv.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 font-bold text-end font-mono text-foreground">
                                <div>{formatCurrency(remaining)}</div>
                                {isPartial && (
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    {isRTL ? `من أصل ${formatCurrency(inv.totalAmount)}` : `of ${formatCurrency(inv.totalAmount)}`}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-end">
                                <Link
                                  to="/admin/client-workspaces/$id"
                                  params={{ id: inv.clientId }}
                                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                                >
                                  {t("common.actions.view", "View")} <ArrowUpRight className="size-2.5" />
                                </Link>
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

            {/* Available Cash Breakdown (DEF-ECC-01, DEF-ECC-02) */}
            {/* On mobile: compact card matching reference */}
            <div
              onClick={() => triggerDrillDown("cash_balance", t("finance.accounts.breakdown", "Available Cash Breakdown"), totalAvailableCash !== null ? formatCurrency(totalAvailableCash) : "—")}
              className="lg:hidden p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 sm:size-11 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CreditCard className="size-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {t("finance.accounts.breakdown", "Available Cash Breakdown")}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-snug truncate">
                    {isRTL ? "رصيد الخزينة الحالي عبر جميع الحسابات النشطة." : "Current treasury balance across all active accounts."}
                  </p>
                </div>
              </div>
              <div className="text-sm sm:text-base font-bold text-primary flex items-center gap-1 shrink-0 font-display">
                <span>{availableCashDisplay}</span>
                <ChevronRight className="size-4 rtl:rotate-180" />
              </div>
            </div>

            {/* Desktop Detailed Treasury Accounts Breakdown (hidden lg:block) */}
            <div className="hidden lg:block p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{t("finance.accounts.breakdown", "Available Cash Breakdown")}</span>
                <span className="text-[10px] font-mono font-bold text-primary">
                  {availableCashDisplay}
                </span>
              </h4>

              <div className="space-y-2.5">
                {!hasAccountsData ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    {t("common.unavailable", "Financial accounts data unavailable")}
                  </div>
                ) : activeAccounts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    {t("finance.accounts.noActive", "No active financial accounts found")}
                  </div>
                ) : (
                  activeAccounts.map((acc) => {
                    const accName = acc.name || acc.accountName || (acc as any).account_name || "Treasury Account";
                    const accType = acc.accountType || (acc as any).account_type || "bank";
                    const bank = acc.bankName || (acc as any).bank_name;
                    const bal = Number(acc.currentBalance ?? (acc as any).current_balance);
                    const validBal = Number.isFinite(bal) ? bal : 0;
                    const accCurr = acc.currency || "TND";

                    return (
                      <div
                        key={acc.id}
                        onClick={() => triggerDrillDown("cash_balance", `Account: ${accName}`, formatCurrency(validBal, { currency: accCurr }), acc.id)}
                        className="p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {accName}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase font-mono">
                            {accType} {bank ? `· ${bank}` : ""}
                          </div>
                        </div>
                        <div className="text-xs font-bold font-mono text-emerald-500">
                          {formatCurrency(validBal, { currency: accCurr })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. OPERATIONS COMMAND: TASKS, PROJECTS AT RISK, PRODUCTION */}
      {/* ============================================================ */}
      {(activeSection === "all" || activeSection === "operations") && (
        <div className="space-y-4">
          {/* Section Heading Card: Operations Command */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 sm:size-11 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold shrink-0">
                <Briefcase className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-heading text-foreground truncate">
                  {t("commandCenter.operations.title", "Operations Command")}
                </h3>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {isRTL
                    ? "إنتاجية المهام، المشاريع المعرضة للمخاطر، وتسليم معالم الإنتاج."
                    : "Task throughput, projects at risk, and production milestone delivery."}
                </p>
              </div>
            </div>
            <Link
              to="/admin/calendar"
              className="text-xs sm:text-sm text-primary font-semibold hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{t("calendar.title", "Agency Calendar")}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* OVERDUE TASKS METRIC */}
            <div
              onClick={() => triggerDrillDown("overdue_tasks", t("commandCenter.kpis.overdueTasks", "Overdue Project Deliverables"), overdueTasks.length)}
              className="p-4 rounded-2xl bg-card border border-border hover:border-destructive/50 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-semibold">
                <span>{t("commandCenter.kpis.overdueTasks", "Overdue Tasks")}</span>
                <AlertTriangle className="size-3.5 text-destructive" />
              </div>
              <div className="text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-destructive">
                {overdueTasks.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {overdueTasks.length > 0 ? t("commandCenter.operations.immediateRequired", "Immediate execution required") : t("commandCenter.operations.zeroLateTasks", "Zero late tasks")}
              </p>
            </div>

            {/* PROJECTS AT RISK METRIC */}
            <div
              onClick={() => triggerDrillDown("at_risk_projects", t("commandCenter.attention.projectsAtRisk", "Projects at Risk"), atRiskProjects.length)}
              className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-semibold">
                <span>{t("commandCenter.attention.projectsAtRisk", "Projects At Risk")}</span>
                <Flame className="size-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-amber-500">
                {atRiskProjects.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("commandCenter.attention.blockedTasks", "Blocked deliverables or missed milestones")}
              </p>
            </div>

            {/* PRODUCTION BOOKINGS METRIC */}
            <div
              onClick={() => triggerDrillDown("production_performance", t("commandCenter.operations.productionShoots", "Production Shoots & Turnaround"), analyticsData.productionPerformance.completedShoots)}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-semibold">
                <span>{t("commandCenter.operations.productionShoots", "Production Shoots")}</span>
                <Calendar className="size-3.5 text-primary" />
              </div>
              <div className="text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-foreground">
                {analyticsData.productionPerformance.completedShoots}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("commandCenter.operations.avgTurnaround", "Avg Turnaround")}: {analyticsData.productionPerformance.averageTurnaroundDays} {t("common.time.days", "days")}
              </p>
            </div>

            {/* DELIVERABLES QUEUE */}
            <div
              onClick={() => triggerDrillDown("employee_actual_hours", t("commandCenter.operations.completedTasks", "Deliverables Throughput"), tasks.filter((t) => t.status === "done").length)}
              className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-semibold">
                <span>{t("commandCenter.operations.completedTasks", "Completed Tasks")}</span>
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-emerald-500">
                {tasks.filter((t) => t.status === "done").length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {tasks.length} {t("tasks.plural", "total operational tasks")}
              </p>
            </div>
          </div>

          {/* Overdue Tasks List */}
          {overdueTasks.length > 0 && (
            <div className="p-4 rounded-2xl bg-card border border-destructive/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-destructive animate-ping" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-destructive">
                    {t("commandCenter.operations.overdueRequiringIntervention", "Overdue Deliverables Requiring Intervention")} ({overdueTasks.length})
                  </h4>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerDrillDown("overdue_tasks", t("commandCenter.kpis.overdueTasks", "Overdue Deliverables"), overdueTasks.length)}
                  className="h-6 text-[10px] rounded-lg px-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  {t("commandCenter.metrics.drillDown", "Drill Down")}
                </Button>
              </div>

              <div className="divide-y divide-border/40">
                {overdueTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask?.(task)}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-muted/20 px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{t("tasks.dueDateLabel", "Deadline")}: {task.deadline?.split("T")[0]}</span>
                        <span>·</span>
                        <span className="capitalize">{task.category || "General"}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-destructive/10 text-destructive border-destructive/30">
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. CLIENT COMMAND: REVENUE, PROFITABILITY & HEALTH */}
      {/* ============================================================ */}
      {(activeSection === "all" || activeSection === "clients") && (
        <div className="space-y-4">
          {/* Section Heading Card: Client Command */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 sm:size-11 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                <Building className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-heading text-foreground truncate">
                  {t("commandCenter.clientsCommand.title", "Client Command")}
                </h3>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {t("commandCenter.clientsCommand.subtitle", "Contribution profit, health ratings, and retainer performance.")}
                </p>
              </div>
            </div>
            <Link
              to="/admin/client-workspaces"
              className="text-xs sm:text-sm text-primary font-semibold hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{t("clients.title", "Client Directory")}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("commandCenter.clientsCommand.rankingTitle", "Which Clients Are Most Profitable? (Ranked by Contribution Profit)")}
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono">
                {sortedClients.length} {t("clients.fields.status", "Active Client Accounts")}
              </Badge>
            </div>

            {/* Mobile Structured Record Cards (< md) */}
            <div className="md:hidden space-y-3">
              {sortedClients.map((client) => {
                const healthBadge =
                  client.health === "HIGH PROFIT"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    : client.health === "MEDIUM"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                    : client.health === "NO DATA"
                    ? "bg-muted text-muted-foreground border-border"
                    : "bg-destructive/10 text-destructive border-destructive/30";

                return (
                  <div
                    key={client.clientId}
                    onClick={() => triggerDrillDown("client_contribution_profit", `Client: ${client.clientName}`, formatCurrency(client.contributionProfit), client.clientId)}
                    className="p-3.5 rounded-xl sm:rounded-2xl bg-card border border-border/70 shadow-2xs space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    {/* 1. Identity & Health */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {client.clientName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {client.industry || "Agency Client"}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-bold tracking-wider shrink-0 ${healthBadge}`}>
                        {client.health === "HIGH PROFIT" ? (isRTL ? "ربح مرتفع" : "HIGH PROFIT") :
                         client.health === "MEDIUM" ? (isRTL ? "متوسط" : "MEDIUM") :
                         client.health === "NO DATA" ? (isRTL ? "لا توجد بيانات" : "NO DATA") :
                         (isRTL ? "ربح منخفض" : "LOW PROFIT")}
                      </Badge>
                    </div>

                    {/* 2-5. 2x2 Metric Grid with Visible Labels */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {t("finance.invoices.totalAmount", "Revenue")}
                        </div>
                        <div className="font-mono font-bold text-foreground">
                          {formatCurrency(client.revenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {t("packages.costs.directCosts", "Direct Costs")}
                        </div>
                        <div className="font-mono font-bold text-rose-500">
                          {formatCurrency(client.directCosts + client.sponsoringCost + client.salesCommission)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {t("packages.costs.contributionProfit", "Contribution Profit")}
                        </div>
                        <div className="font-mono font-bold text-emerald-500">
                          {formatCurrency(client.contributionProfit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {t("packages.costs.marginPercent", "Margin %")}
                        </div>
                        <div className="font-mono font-bold text-foreground">
                          {client.profitMarginPercent}%
                        </div>
                      </div>
                    </div>

                    {/* 6. Drill-down Action */}
                    <div className="flex items-center justify-between pt-1 text-xs text-primary font-medium">
                      <span className="text-[11px] text-muted-foreground">
                        {t("commandCenter.metrics.drillDown", "Drill down")}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <span>{t("common.actions.view", "View Details")}</span>
                        <ArrowUpRight className="size-3 rtl:rotate-[-90deg]" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-[11px] uppercase tracking-wider text-start">
                    <th className="py-2 font-semibold">{t("clients.fields.companyName", "Client Name")}</th>
                    <th className="py-2 font-semibold">{t("clients.fields.industry", "Industry")}</th>
                    <th className="py-2 font-semibold text-end">{t("finance.invoices.totalAmount", "Revenue")}</th>
                    <th className="py-2 font-semibold text-end">{t("packages.costs.directCosts", "Direct Costs")}</th>
                    <th className="py-2 font-semibold text-end">{t("packages.costs.contributionProfit", "Contribution Profit")}</th>
                    <th className="py-2 font-semibold text-end">{t("packages.costs.marginPercent", "Margin %")}</th>
                    <th className="py-2 font-semibold text-center">{t("clients.fields.status", "Health")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sortedClients.map((client) => {
                    const healthBadge =
                      client.health === "HIGH PROFIT"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : client.health === "MEDIUM"
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                        : client.health === "NO DATA"
                        ? "bg-muted text-muted-foreground border-border"
                        : "bg-destructive/10 text-destructive border-destructive/30";

                    return (
                      <tr
                        key={client.clientId}
                        onClick={() => triggerDrillDown("client_contribution_profit", `Client: ${client.clientName}`, formatCurrency(client.contributionProfit), client.clientId)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 font-bold text-foreground flex items-center gap-2">
                          <span>{client.clientName}</span>
                          <ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {client.industry}
                        </td>
                        <td className="py-3 font-mono text-end font-semibold text-foreground">
                          {formatCurrency(client.revenue)}
                        </td>
                        <td className="py-3 font-mono text-end text-rose-500">
                          {formatCurrency(client.directCosts + client.sponsoringCost + client.salesCommission)}
                        </td>
                        <td className="py-3 font-mono text-end font-black text-emerald-500">
                          {formatCurrency(client.contributionProfit)}
                        </td>
                        <td className="py-3 font-mono text-end font-bold">
                          {client.profitMarginPercent}%
                        </td>
                        <td className="py-3 text-center">
                          <Badge variant="outline" className={`text-[10px] font-bold tracking-wider ${healthBadge}`}>
                            {client.health === "HIGH PROFIT" ? (isRTL ? "ربح مرتفع" : "HIGH PROFIT") :
                             client.health === "MEDIUM" ? (isRTL ? "متوسط" : "MEDIUM") :
                             client.health === "NO DATA" ? (isRTL ? "لا توجد بيانات" : "NO DATA") :
                             (isRTL ? "ربح منخفض" : "LOW PROFIT")}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. TEAM COMMAND: WORKLOAD, PAYROLL & PENDING REQUESTS */}
      {/* ============================================================ */}
      {(activeSection === "all" || activeSection === "team") && (
        <div className="space-y-4">
          {/* Section Heading Card: Team Command */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 sm:size-11 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                <Users className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-heading text-foreground truncate">
                  {t("commandCenter.teamCommand.title", "Team Command")}
                </h3>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {t("commandCenter.teamCommand.subtitle", "Resource capacity, pending salary advance requests, and compensation.")}
                </p>
              </div>
            </div>
            <Link
              to="/admin/team-workload"
              className="text-xs sm:text-sm text-primary font-semibold hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{t("commandCenter.teamCommand.workloadCapacity", "Workload Capacity")}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Upcoming Payroll Commitment */}
            <div
              onClick={() => triggerDrillDown("upcoming_payroll", t("commandCenter.metrics.upcomingPayroll", "Upcoming Payroll & Commissions"), formatCurrency(totalUpcomingPayroll))}
              className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3 cursor-pointer hover:border-primary/50 transition-all"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>{t("commandCenter.metrics.upcomingPayroll", "Upcoming Payroll")}</span>
                <DollarSign className="size-4 text-primary" />
              </div>
              <div className="text-2xl font-bold font-display tracking-tight tabular-nums sada-num-kpi text-foreground">
                {formatCurrency(totalUpcomingPayroll)}
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
                <div className="flex justify-between">
                  <span>{t("salaries.fields.baseSalary", "Base Salaries")}:</span>
                  <span className="font-mono font-bold text-foreground tabular-nums">{formatCurrency(upcomingSalariesCommitment)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("finance.tabs.commissions", "Approved Commissions")}:</span>
                  <span className="font-mono font-bold text-foreground tabular-nums">{formatCurrency(upcomingCommissions)}</span>
                </div>
              </div>
            </div>

            {/* Pending Employee Salary Requests Desk */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <span>{t("salaries.advanceModal.title", "Pending Employee Requests")} ({pendingRequests.length})</span>
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerDrillDown("pending_salary_requests", t("salaries.advanceModal.title", "Pending Advance Requests"), pendingRequests.length)}
                  className="h-7 text-[11px] rounded-xl px-2.5"
                >
                  {t("common.actions.review", "Review Requests")}
                </Button>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground rounded-xl bg-muted/20 border border-dashed border-border/60">
                  <CheckCircle2 className="size-5 text-emerald-500 mx-auto mb-1" />
                  {t("salaries.noRequests", "No pending advance requests. All employee requests processed!")}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {pendingRequests.map((req: any) => (
                    <div key={req.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {(req as any).team_member?.name || (req as any).profile?.display_name || "Specialist"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {req.reason} · {t("salaries.requestDate", "Requested")}: {req.request_date ? req.request_date.split("T")[0] : "Recent"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-foreground">
                          {formatCurrency(Number(req.amount || 0))}
                        </span>
                        <Link
                          to="/admin/finance"
                          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                        >
                          {t("common.actions.review", "Review")}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. INTELLIGENCE: DETERMINISTIC RISKS & PACKAGE PROFITABILITY */}
      {/* ============================================================ */}
      {(activeSection === "all" || activeSection === "intelligence") && (
        <div className="space-y-4">
          {/* Section Heading Card: Intelligence & Risk Control */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 sm:size-11 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
                <ShieldAlert className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-heading text-foreground truncate">
                  {t("commandCenter.intelligence.title", "Intelligence & Risk Control")}
                </h3>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {t("commandCenter.intelligence.subtitle", "Deterministic risk warnings, runway safety, and package profitability.")}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[11px] font-mono px-2.5 py-1 shrink-0 ${
              runwayMonths === null
                ? "text-muted-foreground border-border"
                : runwayMonths === 999
                ? "text-emerald-500 border-emerald-500/30"
                : runwayMonths < 3
                ? "text-destructive border-destructive/30"
                : runwayMonths < 6
                ? "text-amber-500 border-amber-500/30"
                : "text-emerald-500 border-emerald-500/30"
            }`}>
              {t("commandCenter.metrics.runway", "Runway")}: {
                runwayMonths === null
                  ? t("common.unavailable", "Unavailable")
                  : runwayMonths === 999
                  ? t("commandCenter.intelligence.noBurnBadge", "No Burn / Safe")
                  : `${runwayMonths} ${t("common.time.months", "Months")}`
              }
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Deterministic Financial & Operational Risks */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("commandCenter.intelligence.risksTitle", "Financial & Operational Risks Requiring Attention")}
              </h4>

              <div className="space-y-2.5">
                {/* Risk 1: Runway Check (DEF-ECC-03) */}
                {(() => {
                  const criticalRunway = getBusinessRuleNumber("critical_runway_months", 3);
                  const warningRunway = getBusinessRuleNumber("warning_runway_months", 6);

                  if (runwayMonths === null || totalAvailableCash === null) {
                    return (
                      <div className="p-3 rounded-xl border bg-muted/20 border-border/60 text-muted-foreground flex items-start gap-3">
                        <Info className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {t("commandCenter.intelligence.runwayUnavailable", "Runway Calculation Indeterminate")}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {t("commandCenter.intelligence.runwayUnavailableDesc", "Financial account balances or monthly burn data is not yet available to project cash runway.")}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (recurringBurn <= 0) {
                    return (
                      <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20 text-foreground flex items-start gap-3">
                        <ShieldCheck className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {t("commandCenter.intelligence.noBurnRunway", "No Active Recurring Burn")}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {t("commandCenter.intelligence.noBurnRunwayDesc", "Zero active recurring subscription burn detected with {cash} in liquid reserves.", {
                              cash: formatCurrency(totalAvailableCash),
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const isRunwayCritical = runwayMonths < criticalRunway;
                  const isRunwayWarning = !isRunwayCritical && runwayMonths < warningRunway;

                  return (
                    <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                      isRunwayCritical
                        ? "bg-destructive/10 border-destructive/30 text-destructive"
                        : isRunwayWarning
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/5 border-emerald-500/20 text-foreground"
                    }`}>
                      {isRunwayCritical ? (
                        <ShieldAlert className="size-4 mt-0.5 shrink-0 text-destructive" />
                      ) : isRunwayWarning ? (
                        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
                      ) : (
                        <ShieldCheck className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                      )}
                      <div>
                        <div className="text-xs font-bold">
                          {isRunwayCritical
                            ? t("commandCenter.intelligence.criticalRunway", "Critical Runway Warning")
                            : isRunwayWarning
                            ? t("commandCenter.intelligence.warningRunway", "Moderate Runway Caution")
                            : t("commandCenter.intelligence.healthyRunway", "Healthy Cash Runway")}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {t("commandCenter.intelligence.runwayDesc", "Current cash reserves cover {months} months at monthly burn of {burn} (Threshold: {threshold} mo).", {
                            months: runwayMonths,
                            burn: formatCurrency(recurringBurn),
                            threshold: criticalRunway,
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Risk 2: Outstanding Receivables Aging */}
                {totalOutstandingReceivables > 0 && (() => {
                  const criticalReceivablesDays = getBusinessRuleNumber("receivables_critical_days", 60);
                  const criticalOverdueInvoices = unpaidInvoices.filter((i: any) => {
                    const invoiceDueDate = i.dueDate || i.due_date;
                    if (!invoiceDueDate) return false;
                    const diffDays = Math.floor((Date.now() - new Date(invoiceDueDate).getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays >= criticalReceivablesDays;
                  });
                  const isCriticalAging = criticalOverdueInvoices.length > 0;
                  return (
                    <div
                      onClick={() => triggerDrillDown("outstanding_invoices", t("commandCenter.metrics.outstandingReceivables", "Outstanding Receivables"), formatCurrency(totalOutstandingReceivables))}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                        isCriticalAging
                          ? "bg-rose-500/10 border-rose-500/30 text-foreground hover:bg-rose-500/15"
                          : "bg-amber-500/5 border-amber-500/20 text-foreground hover:bg-amber-500/10"
                      }`}
                    >
                      <Clock className={`size-4 mt-0.5 shrink-0 ${isCriticalAging ? "text-rose-500" : "text-amber-500"}`} />
                      <div>
                        <div className={`text-xs font-bold ${isCriticalAging ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {unpaidInvoices.length} {t("finance.invoices.status.unpaid", "Unsettled Client Invoices")} ({formatCurrency(totalOutstandingReceivables)})
                          {isCriticalAging && ` • ${criticalOverdueInvoices.length} Exceeding ${criticalReceivablesDays} Days`}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {isCriticalAging
                            ? t("commandCenter.intelligence.criticalAgingAlert", "Critical aging alert: Invoices past {days} days overdue require immediate executive collection intervention.", { days: criticalReceivablesDays })
                            : t("commandCenter.intelligence.pendingAgingAlert", "Client receivables pending. Follow up on accounts approaching {days} days to maintain cash velocity.", { days: criticalReceivablesDays })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Risk 3: Low-Margin Clients */}
                {clientProfitability.filter((c: ClientProfitabilityItem) => c.health === "LOW PROFIT").length > 0 && (
                  <div className="p-3 rounded-xl border bg-destructive/5 border-destructive/20 text-foreground flex items-start gap-3">
                    <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-destructive">
                        {t("commandCenter.intelligence.lowMarginTitle", "{count} Low-Margin Client Accounts", {
                          count: clientProfitability.filter((c: ClientProfitabilityItem) => c.health === "LOW PROFIT").length,
                        })}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t("commandCenter.intelligence.lowMarginDesc", "Direct labor or sponsoring costs exceed target contribution margin (<{percent}%). Review pricing or allocate less hours.", {
                          percent: getBusinessRuleNumber("low_profit_client_margin_percent", 20),
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Most Profitable Packages */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{t("commandCenter.intelligence.packagesTitle", "Which Packages Are Most Profitable?")}</span>
                <span className="text-[10px] font-mono text-primary font-bold">
                  {t("commandCenter.intelligence.offeringsCount", "{count} Offerings", { count: sortedPackages.length })}
                </span>
              </h4>

              <div className="space-y-2">
                {sortedPackages.slice(0, 4).map((pkg) => (
                  <div
                    key={pkg.packageId}
                    onClick={() => triggerDrillDown("package_profitability", `Package: ${pkg.name}`, formatCurrency(pkg.grossProfit), pkg.packageId)}
                    className="p-3 rounded-xl bg-muted/20 border border-border/50 hover:border-primary/40 hover:bg-muted/40 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {pkg.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("packages.sellingPrice", "Selling")}: {formatCurrency(pkg.sellingPrice)} · {t("packages.costs.directCosts", "Direct Costs")}: {formatCurrency(pkg.employeeCost + pkg.freelancerCost + pkg.transportCost + pkg.subscriptionAllocation + pkg.commission)}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs font-black font-mono text-emerald-500">
                        {formatCurrency(pkg.grossProfit)}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {pkg.grossMarginPercent}% {t("packages.costs.marginPercent", "Margin")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
