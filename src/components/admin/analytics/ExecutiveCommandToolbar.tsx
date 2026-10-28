import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SADASelect } from "@/components/ui/sada-select";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { useTranslation } from "@/i18n";
import type { AnalyticsFilterState, FullManagementAnalyticsData } from "@/types/notifications-and-audit";
import {
  Sparkles,
  Download,
  RefreshCw,
  Calendar,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

interface ExecutiveCommandToolbarProps {
  filters: AnalyticsFilterState;
  onFilterChange: (filters: AnalyticsFilterState) => void;
  periodLabel: string;
  loading: boolean;
  onRefresh: () => void;
  onExport: (type: "full" | "executive_briefing" | "client_profitability" | "package_profitability" | "monthly_pnl" | "operations") => void;
  userId?: string;
  userRole?: string;
  lastRefreshedAt?: string;
}

export function ExecutiveCommandToolbar({
  filters,
  onFilterChange,
  periodLabel,
  loading,
  onRefresh,
  onExport,
  userId,
  userRole,
  lastRefreshedAt,
}: ExecutiveCommandToolbarProps) {
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const periodOptions = [
    { value: "this_month", label: isAr ? "الشهر الحالي" : "This Month" },
    { value: "last_month", label: isAr ? "الشهر الماضي" : "Last Month" },
    { value: "last_30_days", label: isAr ? "آخر 30 يوماً" : "Last 30 Days" },
    { value: "this_quarter", label: isAr ? "الربع الحالي" : "This Quarter" },
    { value: "this_year", label: isAr ? "السنة الحالية" : "This Year" },
    { value: "custom", label: isAr ? "فترة مخصصة" : "Custom Range" },
  ];

  return (
    <header className="flex flex-col gap-4 pb-5 border-b border-border/70" aria-label="SADA Intelligence Header">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Context */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-2.5">
            <div className="size-9 sm:size-10 rounded-2xl bg-gradient-to-br from-primary/20 via-cyan-500/10 to-primary/5 border border-primary/30 flex items-center justify-center text-primary shadow-xs shrink-0 mt-0.5">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold font-heading text-foreground tracking-tight">
                  {isAr ? "سدى إنتليجنس — مركز القيادة التنفيذي" : "SADA Intelligence — Executive Command Center"}
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isAr ? "مباشر • قاعدة البيانات المعتمدة SSOT" : "Live • Authoritative SSOT"}
                </Badge>
                {lastRefreshedAt && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-muted-foreground border-border/60 bg-muted/30 px-2 py-0.5 rounded-full"
                  >
                    {isAr ? `آخر تحديث: ${lastRefreshedAt}` : `Updated: ${lastRefreshedAt}`}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {isAr
                  ? `فترة التقرير: ${periodLabel} • حسابات مالية وتشغيلية دقيقة بدون افتراضات`
                  : `Reporting Scope: ${periodLabel} • Pure deterministic financial & operational facts`}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Notification Center (Preserved on tablet/desktop, hidden on mobile where app shell header already provides it) */}
          <div className="hidden sm:inline-flex">
            <NotificationCenter userId={userId} userRole={(userRole as any) || "super_admin"} />
          </div>

          {/* Period Selector */}
          <div className="w-[140px] sm:w-[150px] shrink-0">
            <SADASelect
              value={filters.periodType}
              onChange={(val: any) => onFilterChange({ ...filters, periodType: val })}
              options={periodOptions}
              placeholder={isAr ? "الفترة الزمنية" : "Period Scope"}
            />
          </div>

          {/* Compare Toggle */}
          <Button
            type="button"
            variant={filters.compareWithPrevious ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange({ ...filters, compareWithPrevious: !filters.compareWithPrevious })}
            className="text-xs gap-1.5 h-9 font-mono border-border shrink-0 select-none"
            title={isAr ? "مقارنة مع الفترة السابقة المعيارية" : "Compare against previous equivalent period"}
          >
            <ArrowRightLeft className="size-3.5" />
            <span className="hidden sm:inline">{isAr ? "مقارنة بالفترة السابقة" : "Compare Period"}</span>
          </Button>

          {/* Export Dropdown / Action */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExport("full")}
            className="text-xs gap-1.5 h-9 font-mono border-border hover:bg-muted shrink-0"
            title={isAr ? "تصدير التقرير التنفيذي بصيغة CSV" : "Export executive report to CSV"}
          >
            <Download className="size-3.5" />
            <span className="hidden xs:inline">{isAr ? "تصدير CSV" : "Export CSV"}</span>
          </Button>

          {/* Refresh Action */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 border border-border/50"
            title={isAr ? "تحديث كافة المؤشرات والبيانات" : "Refresh all live facts"}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker (Only visible when "custom" is selected) */}
      {filters.periodType === "custom" && (
        <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-muted-foreground">{isAr ? "تاريخ البدء:" : "Start Date:"}</span>
            <input
              type="date"
              value={filters.customStartDate || ""}
              onChange={(e) => onFilterChange({ ...filters, customStartDate: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{isAr ? "تاريخ الانتهاء:" : "End Date:"}</span>
            <input
              type="date"
              value={filters.customEndDate || ""}
              onChange={(e) => onFilterChange({ ...filters, customEndDate: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            className="h-8 text-xs font-mono px-3 ms-auto"
          >
            {isAr ? "تطبيق النطاق" : "Apply Range"}
          </Button>
        </div>
      )}
    </header>
  );
}
