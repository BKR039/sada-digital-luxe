import React from "react";
import { formatCurrency } from "@/types/finance";
import type { ExecutiveCommandStripData, ExecutiveCommandMetric } from "@/types/notifications-and-audit";
import { useTranslation } from "@/i18n";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CreditCard,
  Layers,
  Sparkles,
} from "lucide-react";

interface ExecutiveCommandStripProps {
  data: ExecutiveCommandStripData;
  onOpenDrillDown: (metricType: string, label: string, value: string | number) => void;
}

export function ExecutiveCommandStrip({
  data,
  onOpenDrillDown,
}: ExecutiveCommandStripProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const {
    recognizedRevenue,
    cashCollected,
    netProfit,
    contributionMargin,
    availableCash,
    outstandingReceivables,
    operatingExpenses,
    deliveryHealth,
  } = data;

  const cards: Array<{
    metric: ExecutiveCommandMetric & Record<string, any>;
    icon: React.ElementType;
    iconBg: string;
    valueColor?: string;
    subtext: string;
    subtext_ar: string;
  }> = [
    {
      metric: recognizedRevenue,
      icon: Briefcase,
      iconBg: "bg-primary/10 text-primary border-primary/20",
      subtext: "Contracted Retainer Volume",
      subtext_ar: "حجم الاشتراكات التعاقدية",
    },
    {
      metric: cashCollected,
      icon: DollarSign,
      iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      valueColor: "text-emerald-500 dark:text-emerald-400",
      subtext: "Verified Treasury Inflows",
      subtext_ar: "المقبوضات النقدية المحصلة",
    },
    {
      metric: netProfit,
      icon: Sparkles,
      iconBg: netProfit.value >= 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20",
      valueColor: netProfit.value >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
      subtext: "Revenue - COGS - OpEx",
      subtext_ar: "صافي بعد كافة المصاريف",
    },
    {
      metric: contributionMargin,
      icon: Layers,
      iconBg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
      subtext: `${contributionMargin.marginPercent}% Gross Margin`,
      subtext_ar: `هامش مساهمة ${contributionMargin.marginPercent}%`,
    },
    {
      metric: availableCash,
      icon: CreditCard,
      iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      subtext: `Reserved: ${formatCurrency(availableCash.reservedCash)}`,
      subtext_ar: `المقيد: ${formatCurrency(availableCash.reservedCash)}`,
    },
    {
      metric: outstandingReceivables,
      icon: AlertTriangle,
      iconBg: outstandingReceivables.overdueCount > 0 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-muted text-muted-foreground border-border",
      valueColor: outstandingReceivables.overdueCount > 0 ? "text-amber-500 dark:text-amber-400" : undefined,
      subtext: `${outstandingReceivables.overdueCount} Overdue Invoices`,
      subtext_ar: `${outstandingReceivables.overdueCount} فواتير متأخرة`,
    },
    {
      metric: operatingExpenses,
      icon: TrendingDown,
      iconBg: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      valueColor: "text-rose-500 dark:text-rose-400",
      subtext: `Burn: ${formatCurrency(operatingExpenses.monthlyBurnRate)}/mo`,
      subtext_ar: `حرق: ${formatCurrency(operatingExpenses.monthlyBurnRate)}/شهر`,
    },
    {
      metric: deliveryHealth,
      icon: ShieldCheck,
      iconBg: deliveryHealth.overdueTasksCount === 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20",
      valueColor: deliveryHealth.overdueTasksCount === 0 ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400",
      subtext: `${deliveryHealth.overdueTasksCount} Overdue Deliverables`,
      subtext_ar: `${deliveryHealth.overdueTasksCount} تسليمات متأخرة`,
    },
  ];

  return (
    <section aria-label="Executive Command Strip" className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          {isAr ? "مؤشرات القيادة التنفيذية الثمانية (SSOT)" : "Executive Command Strip (SSOT)"}
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground">
          {isAr ? "انقر على أي مؤشر لعرض تفاصيل القيود وسجلات المصدر" : "Click any KPI to inspect underlying records"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          const { metric } = c;

          return (
            <div
              key={idx}
              onClick={() => onOpenDrillDown(metric.metricType, isAr ? metric.label_ar : metric.label, metric.displayValue)}
              className="group relative p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/80 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-2xs"
            >
              {/* Header: Label + Icon */}
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-[10px] sm:text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-tight leading-tight line-clamp-2 min-h-[26px] sm:min-h-0 text-start break-words flex-1">
                  {isAr ? metric.label_ar : metric.label}
                </span>
                <div className={`size-6 sm:size-7 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border ${c.iconBg} group-hover:scale-105 transition-transform`}>
                  <Icon className="size-3 sm:size-3.5" />
                </div>
              </div>

              {/* Value */}
              <div className="my-1.5 sm:my-2 text-start min-w-0">
                <div className={`text-xs min-[360px]:text-sm sm:text-lg lg:text-xl font-bold font-mono tracking-tight tabular-nums break-words leading-tight ${c.valueColor || "text-foreground"}`}>
                  {metric.displayValue}
                </div>
              </div>

              {/* Footer: Delta / Subtext + Drill-Down Arrow */}
              <div className="flex items-center justify-between text-[10px] font-mono border-t border-border/40 pt-1.5 sm:pt-2 gap-1 text-start">
                <div className="flex items-center gap-1 text-muted-foreground truncate">
                  {metric.deltaPercent !== undefined && metric.deltaPercent !== null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 font-bold ${
                        metric.deltaPercent >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                      dir="ltr"
                    >
                      {metric.deltaPercent >= 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                      {metric.deltaPercent >= 0 ? `+${metric.deltaPercent}%` : `${metric.deltaPercent}%`}
                    </span>
                  ) : (
                    <span className="truncate">{isAr ? c.subtext_ar : c.subtext}</span>
                  )}
                </div>

                <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-0.5 font-medium">
                  <span className="hidden xs:inline">{isAr ? "تفصيل" : "Drill"}</span>
                  <ArrowUpRight className="size-2.5 rtl:rotate-180" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
