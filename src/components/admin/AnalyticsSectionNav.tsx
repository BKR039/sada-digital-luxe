import * as React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import {
  Sparkles,
  Building2,
  Briefcase,
  Layers,
  Users,
  Target,
  Film,
  FileText,
  DollarSign,
  Percent,
  TrendingUp,
  History,
  type LucideIcon,
} from "lucide-react";

export interface AnalyticsSectionItem {
  id: string;
  label: string;
  label_ar: string;
  icon: LucideIcon;
  iconColor?: string;
}

export const ANALYTICS_SECTIONS: AnalyticsSectionItem[] = [
  {
    id: "executive_overview",
    label: "Executive Command",
    label_ar: "مركز القيادة المالي والتشغيلي",
    icon: Sparkles,
    iconColor: "text-amber-500",
  },
  {
    id: "client_profitability",
    label: "1. Client Profitability",
    label_ar: "١. ربحية العملاء",
    icon: Building2,
    iconColor: "text-emerald-500",
  },
  {
    id: "package_profitability",
    label: "2. Package Profitability",
    label_ar: "٢. ربحية الباقات",
    icon: Briefcase,
    iconColor: "text-primary",
  },
  {
    id: "service_profitability",
    label: "3. Service Profitability",
    label_ar: "٣. ربحية الخدمات",
    icon: Layers,
    iconColor: "text-indigo-500",
  },
  {
    id: "employee_performance",
    label: "4. Employee Performance",
    label_ar: "٤. أداء الفريق",
    icon: Users,
    iconColor: "text-purple-500",
  },
  {
    id: "sales_performance",
    label: "5. Sales Performance",
    label_ar: "٥. أداء المبيعات",
    icon: Target,
    iconColor: "text-amber-500",
  },
  {
    id: "production_performance",
    label: "6. Production",
    label_ar: "٦. الإنتاج والتنفيذ",
    icon: Film,
    iconColor: "text-blue-500",
  },
  {
    id: "monthly_pnl",
    label: "7. Monthly P&L",
    label_ar: "٧. الأرباح والخسائر P&L",
    icon: FileText,
    iconColor: "text-rose-500",
  },
  {
    id: "cash_flow",
    label: "8. Cash Flow",
    label_ar: "٨. التدفقات النقدية",
    icon: DollarSign,
    iconColor: "text-cyan-500",
  },
  {
    id: "commission_performance",
    label: "9. Commissions",
    label_ar: "٩. العمولات",
    icon: Percent,
    iconColor: "text-purple-500",
  },
  {
    id: "revenue_trends",
    label: "10. Revenue Trends",
    label_ar: "١٠. اتجاهات الإيرادات",
    icon: TrendingUp,
    iconColor: "text-emerald-500",
  },
  {
    id: "audit_activity",
    label: "Audit & Activity",
    label_ar: "سجل التدقيق والنشاط",
    icon: History,
    iconColor: "text-muted-foreground",
  },
];

export interface AnalyticsSectionNavProps {
  className?: string;
}

export function AnalyticsSectionNav({ className }: AnalyticsSectionNavProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  return (
    <nav
      aria-label="Management Analytics Sections"
      className={cn("w-full overflow-visible", className)}
    >
      <TabsList
        className="w-full h-auto bg-muted/40 dark:bg-muted/20 p-1.5 sm:p-2 rounded-2xl border border-border/80 flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 shadow-xs"
      >
        {ANALYTICS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className={cn(
                // Base layout & dimensions (compact 36px on mobile swipe, 40px on desktop grid)
                "group relative flex items-center shrink-0 w-auto sm:w-full min-w-[130px] sm:min-w-0 h-9 sm:h-10 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-mono font-medium text-start transition-colors duration-150 select-none",
                // Inactive appearance: subtle borders & calm backgrounds
                "bg-card/40 hover:bg-card/90 dark:bg-card/25 dark:hover:bg-card/60 text-muted-foreground hover:text-foreground border border-border/50 hover:border-border/80",
                // Active appearance: prominent background, strong text, distinct ring & shadow
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-xs data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/25",
                // Keyboard accessibility focus
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon
                  className={cn(
                    "size-3.5 sm:size-4 shrink-0 transition-transform group-hover:scale-105",
                    section.iconColor,
                  )}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap truncate font-medium group-data-[state=active]:font-semibold">
                  {isAr ? section.label_ar : section.label}
                </span>
              </div>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </nav>
  );
}
