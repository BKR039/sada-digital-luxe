import React from "react";
import { formatCurrency } from "@/types/finance";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Layers, ArrowUpRight } from "lucide-react";

interface RevenueSourcesBreakdownProps {
  clientServicesRevenue: number;
  sponsoringCollected: number;
  otherRevenue: number;
  totalRevenue: number;
  onOpenDrillDown?: (metricType: string, label: string, value: string | number) => void;
}

export function RevenueSourcesBreakdown({
  clientServicesRevenue,
  sponsoringCollected,
  otherRevenue,
  totalRevenue,
  onOpenDrillDown,
}: RevenueSourcesBreakdownProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const sources = [
    {
      name: isAr ? "إيرادات خدمات وباقات الوكالة" : "Agency Services & Package Retainers",
      amount: clientServicesRevenue,
      pct: totalRevenue > 0 ? Math.round((clientServicesRevenue / totalRevenue) * 1000) / 10 : 0,
      color: "bg-primary text-primary-foreground",
      barColor: "bg-primary",
      note: isAr ? "أتعاب إنتاج المحتوى، الهوية، وإدارة المنصات" : "Core content production, branding, & retainer fees",
    },
    {
      name: isAr ? "تدفقات ميزانيات التمويل الإعلاني" : "Client Sponsoring & Ad Budgets",
      amount: sponsoringCollected,
      pct: totalRevenue > 0 ? Math.round((sponsoringCollected / totalRevenue) * 1000) / 10 : 0,
      color: "bg-cyan-500 text-white",
      barColor: "bg-cyan-500",
      note: isAr ? "أموال إعلانات ممولة مخصصة لمنصات ميتا وجوجل" : "Direct media funds earmarked for ad platforms",
    },
    {
      name: isAr ? "إيرادات متنوعة ومشاريع منفردة" : "Other Income & One-Off Projects",
      amount: otherRevenue,
      pct: totalRevenue > 0 ? Math.round((otherRevenue / totalRevenue) * 1000) / 10 : 0,
      color: "bg-muted-foreground text-white",
      barColor: "bg-muted-foreground",
      note: isAr ? "عقود استشارية ومنتجات رقمية" : "Consulting and digital deliverables",
    },
  ];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4 text-start font-mono">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <h3 className="font-bold text-sm font-heading text-foreground">
              {isAr ? "مصادر الإيرادات والتدفق التجاري" : "Revenue Streams & Commercial Breakdown"}
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isAr
              ? "فصل أتعاب الوكالة عن ميزانيات التمويل الإعلاني وفقاً للمعايير المحاسبية"
              : "Strict separation between core agency service fees and pass-through client ad spend"}
          </p>
        </div>

        <Badge variant="outline" className="text-xs font-bold text-primary border-primary/20 bg-primary/5">
          {formatCurrency(totalRevenue)}
        </Badge>
      </div>

      <div className="space-y-3">
        {sources.map((s, idx) => (
          <div
            key={idx}
            onClick={() => onOpenDrillDown?.("monthly_revenue", s.name, formatCurrency(s.amount))}
            className="p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/50 transition-colors cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-bold text-foreground block truncate group-hover:text-primary transition-colors">
                  {s.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {s.note}
                </span>
              </div>
              <div className="text-end shrink-0 ms-2">
                <span className="font-bold text-foreground block">{formatCurrency(s.amount)}</span>
                <span className="text-[10px] text-muted-foreground" dir="ltr">{s.pct}%</span>
              </div>
            </div>

            <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${s.barColor} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(1, s.pct))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
