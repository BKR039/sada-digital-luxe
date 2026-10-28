import React from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExecutiveBriefingItem } from "@/types/notifications-and-audit";
import { useTranslation } from "@/i18n";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface ExecutiveBriefingSectionProps {
  briefingItems: ExecutiveBriefingItem[];
  onActionClick?: (item: ExecutiveBriefingItem) => void;
}

export function ExecutiveBriefingSection({
  briefingItems,
  onActionClick,
}: ExecutiveBriefingSectionProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  if (!briefingItems || briefingItems.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-card border border-border/80 text-start space-y-2">
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
          <CheckCircle2 className="size-4" />
          <span>{isAr ? "كافة مؤشرات العمليات والمالية مستقرة" : "All Operational & Financial Indicators Stable"}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {isAr
            ? "لا توجد مستحقات متأخرة، أو عجز في السيولة، أو مهام متأخرة تجاوزت الحدود المحددة في الفترة الحالية."
            : "No overdue receivables, liquidity deficits, or delivery bottlenecks currently exceed threshold."}
        </p>
      </div>
    );
  }

  const getCategoryBadge = (category: ExecutiveBriefingItem["category"]) => {
    switch (category) {
      case "risk":
        return { label: isAr ? "المخاطر الرئيسية" : "Key Risk", className: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
      case "loss":
        return { label: isAr ? "استنزاف الأموال" : "Capital Drain", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case "deterioration":
        return { label: isAr ? "تراجع في الأداء" : "Deterioration", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
      case "improvement":
        return { label: isAr ? "تحسن ملحوظ" : "Improvement", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
      case "client_action":
        return { label: isAr ? "متابعة عميل" : "Client Attention", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      case "opportunity":
        return { label: isAr ? "فرصة نمو" : "Opportunity", className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" };
      default:
        return { label: isAr ? "ملاحظة" : "Finding", className: "bg-muted text-muted-foreground border-border" };
    }
  };

  const getSeverityBadge = (severity: ExecutiveBriefingItem["severity"]) => {
    switch (severity) {
      case "critical":
        return {
          icon: AlertOctagon,
          className: "bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30",
          label: isAr ? "حرج للغاية" : "CRITICAL",
        };
      case "high":
        return {
          icon: AlertTriangle,
          className: "bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30",
          label: isAr ? "أولوية عالية" : "HIGH PRIORITY",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          label: isAr ? "تنبيه" : "WARNING",
        };
      case "info":
      default:
        return {
          icon: Info,
          className: "bg-primary/15 text-primary border-primary/30",
          label: isAr ? "إيجابي / تحسن" : "POSITIVE",
        };
    }
  };

  return (
    <section aria-label="Executive Briefing" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-heading text-foreground">
              {isAr ? "الموجز التنفيذي — ما الذي يتطلب انتباه الإدارة الآن؟" : "Executive Briefing — What Needs Immediate Attention?"}
            </h2>
            <p className="text-[11px] text-muted-foreground font-mono">
              {isAr
                ? "نتائج مستنتجة رياضياً • خالية من الرسائل العامة • مدعومة بأرقام ومسارات معتمدة"
                : "Top prioritized deterministic findings • Zero fabricated advice • Direct deep links"}
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-[10px] font-mono border-border">
          {briefingItems.length} {isAr ? "نتائج معتمدة" : "Active Findings"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {briefingItems.map((item) => {
          const sev = getSeverityBadge(item.severity);
          const cat = getCategoryBadge(item.category);
          const SevIcon = sev.icon;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl bg-card border transition-all flex flex-col justify-between text-start ${
                item.severity === "critical"
                  ? "border-rose-500/40 shadow-xs hover:border-rose-500/70"
                  : item.severity === "high"
                  ? "border-amber-500/40 shadow-xs hover:border-amber-500/70"
                  : "border-border/80 hover:border-primary/50"
              }`}
            >
              <div>
                {/* Header row: Category Pill + Severity Badge + Data Completeness */}
                <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${sev.className}`}>
                      <SevIcon className="size-3" />
                      <span>{sev.label}</span>
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${cat.className}`}>
                      <span>{cat.label}</span>
                    </Badge>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground">
                    {item.dataCompleteness === "complete"
                      ? isAr ? "بيانات مكتملة 100%" : "Complete Facts"
                      : isAr ? "بيانات ناقصة" : "Incomplete Costs"}
                  </span>
                </div>

                {/* Finding Title */}
                <h3 className="font-bold text-sm text-foreground font-heading leading-snug">
                  {isAr ? item.title_ar : item.title}
                </h3>

                {/* Explanation */}
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {isAr ? item.conciseExplanation_ar : item.conciseExplanation}
                </p>

                {/* Supporting Numbers Banner */}
                <div className="my-3 p-2.5 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/60 flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-muted-foreground text-[11px] truncate">
                    {isAr ? "الأرقام الداعمة:" : "Supporting Numbers:"}
                  </span>
                  <span className="font-bold text-foreground text-[11px] shrink-0">
                    {item.supportingNumbers}
                  </span>
                </div>

                {/* Recommended Action */}
                <div className="text-[11px] text-foreground/90 font-mono space-y-0.5">
                  <span className="text-primary font-bold block">
                    {isAr ? "الإجراء الإداري الموصى به:" : "Recommended Management Action:"}
                  </span>
                  <p className="text-muted-foreground leading-normal">
                    {isAr ? item.recommendedAction_ar : item.recommendedAction}
                  </p>
                </div>
              </div>

              {/* Action Link Footer */}
              <div className="mt-4 pt-3 border-t border-border/60 flex flex-col xs:flex-row xs:items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-muted-foreground truncate pe-2">
                  {item.thresholdOrComparison}
                </span>

                <Link
                  to={item.targetUrl as any}
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-primary hover:text-primary/80 transition-colors shrink-0"
                >
                  <span>{isAr ? item.targetLabel_ar : item.targetLabel}</span>
                  <ArrowUpRight className="size-3 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
