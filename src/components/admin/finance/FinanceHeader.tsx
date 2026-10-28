import { useState, useMemo } from "react";
import { FinancialPeriod, PeriodType } from "@/types/finance";
import { getPresetPeriod } from "@/lib/finance-service";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADAButton } from "@/components/ui/sada-ui";
import { useTranslation } from "@/i18n";
import { formatDate } from "@/lib/date-locale";
import {
  Download,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Lock,
} from "lucide-react";
import { format } from "date-fns";

interface FinanceHeaderProps {
  period: FinancialPeriod;
  onPeriodChange: (p: FinancialPeriod) => void;
  onRefresh: () => void;
  loading: boolean;
  onOpenNewIncome: () => void;
  onOpenNewExpense: () => void;
  onExport: (type: "all" | "incomes" | "expenses") => void;
  onCloseMonth?: () => void;
}

export function FinanceHeader({
  period,
  onPeriodChange,
  onRefresh,
  loading,
  onOpenNewIncome,
  onOpenNewExpense,
  onExport,
  onCloseMonth,
}: FinanceHeaderProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const periodOptions = useMemo(
    () => [
      { value: "this_month", label: isAr ? "الشهر الحالي" : "This Month" },
      { value: "last_month", label: isAr ? "الشهر الماضي" : "Last Month" },
      { value: "this_quarter", label: isAr ? "الربع الحالي" : "This Quarter" },
      { value: "this_year", label: isAr ? "السنة الحالية" : "This Year" },
      { value: "custom", label: isAr ? "نطاق زمني مخصص" : "Custom Date Range" },
    ],
    [isAr]
  );

  const displayPeriodLabel = useMemo(() => {
    if (!isAr) return period.label;
    if (period.type === "this_month" || period.type === "last_month") {
      return formatDate(period.startDate, "MMMM yyyy");
    }
    if (period.type === "this_year") {
      return `سنة ${formatDate(period.startDate, "yyyy")}`;
    }
    if (period.type === "this_quarter") {
      const q = Math.floor(new Date(period.startDate).getMonth() / 3) + 1;
      return `الربع ${q} ${formatDate(period.startDate, "yyyy")}`;
    }
    return `${formatDate(period.startDate, "d MMM yyyy")} - ${formatDate(period.endDate, "d MMM yyyy")}`;
  }, [period, isAr]);

  const [customStart, setCustomStart] = useState<Date | undefined>(
    period.type === "custom" ? new Date(period.startDate) : undefined
  );
  const [customEnd, setCustomEnd] = useState<Date | undefined>(
    period.type === "custom" ? new Date(period.endDate) : undefined
  );
  const [showCustomRange, setShowCustomRange] = useState(period.type === "custom");

  const handlePeriodSelect = (val: string) => {
    const pType = val as PeriodType;
    if (pType === "custom") {
      setShowCustomRange(true);
      const s = customStart ? format(customStart, "yyyy-MM-dd") : period.startDate;
      const e = customEnd ? format(customEnd, "yyyy-MM-dd") : period.endDate;
      onPeriodChange(getPresetPeriod("custom", s, e));
    } else {
      setShowCustomRange(false);
      onPeriodChange(getPresetPeriod(pType));
    }
  };

  const handleCustomDateApply = (start?: Date, end?: Date) => {
    const sDate = start || customStart || new Date();
    const eDate = end || customEnd || new Date();
    setCustomStart(sDate);
    setCustomEnd(eDate);
    onPeriodChange(
      getPresetPeriod("custom", format(sDate, "yyyy-MM-dd"), format(eDate, "yyyy-MM-dd"))
    );
  };

  return (
    <div className="space-y-4 pb-2 border-b border-border/60">
      {/* Top Bar: Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
              {isAr ? "نظام الإدارة التنفيذية" : "Executive OS"}
            </span>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isAr ? "محاسبة حية" : "Live Accounting"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground mt-1">
            {isAr ? "مركز القيادة المالية" : "Financial Command Center"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isAr
              ? "تدفق نقدي في الوقت الفعلي، المداخيل المعتمدة، نفقات التشغيل، وحوكمة الرواتب."
              : "Real-time cash flow, canonical income, operating expenses, and payroll governance."}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <SADAButton
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={loading}
            leftIcon={<RefreshCw className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />}
            className="text-xs font-mono"
          >
            {isAr ? "مزامنة" : "Sync"}
          </SADAButton>

          {onCloseMonth && (
            <SADAButton
              variant="secondary"
              size="sm"
              onClick={onCloseMonth}
              leftIcon={<Lock className="size-3.5 text-muted-foreground" />}
              className="text-xs font-mono"
            >
              {isAr ? "إغلاق الشهر" : "Close Month"}
            </SADAButton>
          )}

          <SADAButton
            variant="secondary"
            size="sm"
            onClick={() => onExport("all")}
            leftIcon={<Download className="size-3.5 text-muted-foreground" />}
            className="text-xs font-mono"
          >
            {isAr ? "تصدير CSV" : "Export CSV"}
          </SADAButton>

          <SADAButton
            size="sm"
            variant="primary"
            onClick={onOpenNewIncome}
            leftIcon={<ArrowDownLeft className="size-3.5" />}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            {isAr ? "+ مدخول" : "+ Inflow"}
          </SADAButton>

          <SADAButton
            size="sm"
            variant="primary"
            onClick={onOpenNewExpense}
            leftIcon={<ArrowUpRight className="size-3.5" />}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            {isAr ? "+ مصروف" : "+ Outflow"}
          </SADAButton>
        </div>
      </div>

      {/* Period Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground shrink-0">
            <Calendar className="size-3.5 text-primary" />
            <span>{isAr ? "الفترة المحاسبية:" : "Accounting Period:"}</span>
          </div>

          <div className="w-48">
            <SADASelect
              value={period.type}
              onChange={handlePeriodSelect}
              options={periodOptions}
              size="compact"
            />
          </div>

          <span className="text-xs font-mono font-medium text-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/80 shrink-0">
            {displayPeriodLabel}
          </span>
        </div>

        {/* Custom Range Pickers when selected */}
        {showCustomRange && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
              <SADADatePicker
                value={customStart ? format(customStart, "yyyy-MM-dd") : ""}
                onChange={(dStr) => handleCustomDateApply(dStr ? new Date(dStr) : undefined, customEnd)}
                placeholder={isAr ? "تاريخ البدء" : "Start Date"}
                size="compact"
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{isAr ? "إلى" : "to"}</span>
            <div className="w-36">
              <SADADatePicker
                value={customEnd ? format(customEnd, "yyyy-MM-dd") : ""}
                onChange={(dStr) => handleCustomDateApply(customStart, dStr ? new Date(dStr) : undefined)}
                placeholder={isAr ? "تاريخ الانتهاء" : "End Date"}
                size="compact"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
