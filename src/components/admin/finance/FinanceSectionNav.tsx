import * as React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  ArrowDownLeft,
  FileText,
  DollarSign,
  TrendingDown,
  Repeat,
  Users,
  Percent,
  CreditCard,
  Landmark,
  Award,
  Lock,
  type LucideIcon,
} from "lucide-react";

export interface FinanceSectionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  count?: number;
  hasAlert?: boolean;
}

export interface FinanceSectionNavProps {
  counts: {
    ledger: number;
    inflows: number;
    sponsoring: number;
    expenses: number;
    subscriptions: number;
    commissions: number;
  };
  hasPendingSalaryRequests?: boolean;
  className?: string;
}

export function getFinanceSections(
  counts: FinanceSectionNavProps["counts"],
  hasPendingSalaryRequests?: boolean,
): FinanceSectionItem[] {
  const isRtl = typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar");

  return [
    {
      id: "overview",
      label: isRtl ? "نظرة عامة" : "Overview",
      icon: LayoutDashboard,
      iconColor: "text-primary",
    },
    {
      id: "ledger",
      label: isRtl ? "دفتر الأستاذ" : "Ledger",
      icon: Layers,
      iconColor: "text-primary",
      count: counts.ledger,
    },
    {
      id: "inflows",
      label: isRtl ? "المقبوضات" : "Inflows",
      icon: ArrowDownLeft,
      iconColor: "text-emerald-500",
      count: counts.inflows,
    },
    {
      id: "revenue",
      label: isRtl ? "الفواتير والفوترة" : "Invoices & Billing",
      icon: FileText,
      iconColor: "text-emerald-500",
    },
    {
      id: "sponsoring",
      label: isRtl ? "الإعلانات الممولة" : "Sponsoring",
      icon: DollarSign,
      iconColor: "text-indigo-500",
      count: counts.sponsoring,
    },
    {
      id: "expenses",
      label: isRtl ? "المصروفات" : "Outflows",
      icon: TrendingDown,
      iconColor: "text-rose-500",
      count: counts.expenses,
    },
    {
      id: "subscriptions",
      label: isRtl ? "الاشتراكات والبرمجيات" : "SaaS Subscriptions",
      icon: Repeat,
      iconColor: "text-blue-500",
      count: counts.subscriptions,
    },
    {
      id: "salaries",
      label: isRtl ? "الرواتب والتعويضات" : "Payroll",
      icon: Users,
      iconColor: "text-purple-500",
    },
    {
      id: "commissions",
      label: isRtl ? "العمولات" : "Commissions",
      icon: Percent,
      iconColor: "text-purple-500",
      count: counts.commissions,
    },
    {
      id: "requests",
      label: isRtl ? "طلبات السلف" : "Worker Requests",
      icon: CreditCard,
      iconColor: "text-amber-500",
      hasAlert: !!hasPendingSalaryRequests,
    },
    {
      id: "cashflow",
      label: isRtl ? "الخزينة والسيولة" : "Cash Flow & Treasury",
      icon: Landmark,
      iconColor: "text-cyan-500",
    },
    {
      id: "profitability",
      label: isRtl ? "ربحية العملاء" : "Client Profitability",
      icon: Award,
      iconColor: "text-amber-500",
    },
    {
      id: "closing",
      label: isRtl ? "الإقفال والتدقيق" : "Period Closing & Audit",
      icon: Lock,
      iconColor: "text-muted-foreground",
    },
  ];
}

/**
 * FinanceSectionNav
 * Desktop-grade Command Center navigation for SADA Financial Operating System.
 * Replaces single-row horizontal scrolling with a responsive multi-row grid where
 * all sections remain 100% visible across mobile, tablet, and desktop viewports.
 */
export function FinanceSectionNav({
  counts,
  hasPendingSalaryRequests,
  className,
}: FinanceSectionNavProps) {
  const sections = React.useMemo(
    () => getFinanceSections(counts, hasPendingSalaryRequests),
    [counts, hasPendingSalaryRequests],
  );

  return (
    <nav
      aria-label="Finance navigation sections"
      className={cn("w-full overflow-visible", className)}
    >
      <TabsList
        className={cn(
          "w-full h-auto bg-muted/40 dark:bg-muted/20 p-1.5 sm:p-2 rounded-2xl border border-border/80 shadow-xs",
          "flex overflow-x-auto no-scrollbar gap-1.5 sm:grid sm:gap-2",
        )}
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 205px), 1fr))",
        }}
      >
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className={cn(
                // Base layout & dimensions (consistent 38px/40px height, left aligned content)
                "group relative flex items-center justify-between shrink-0 sm:shrink sm:w-full h-9 sm:h-10 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium text-left transition-all duration-150 select-none snap-start",
                // Inactive appearance: subtle borders & calm backgrounds
                "bg-card/60 hover:bg-card/90 dark:bg-card/25 dark:hover:bg-card/60 text-muted-foreground hover:text-foreground border border-border/50 hover:border-border/80",
                // Active appearance: prominent background, strong text, distinct ring & shadow
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-xs data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/25",
                // Keyboard accessibility focus
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-transform group-hover:scale-105",
                    section.iconColor,
                  )}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap font-medium group-data-[state=active]:font-semibold">
                  {section.label}
                </span>
              </div>

              {/* Underlying Badge Count */}
              {typeof section.count === "number" && (
                <span
                  className={cn(
                    "ms-2 shrink-0 px-1.5 py-0.5 rounded-full text-[10.5px] font-mono leading-none transition-colors",
                    "bg-muted-foreground/10 text-muted-foreground group-hover:text-foreground",
                    "group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary group-data-[state=active]:font-bold",
                  )}
                >
                  {section.count}
                </span>
              )}

              {/* Status Alert Indicator */}
              {section.hasAlert && (
                <span className="ms-2 shrink-0 flex items-center gap-1" title="Pending requests">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </nav>
  );
}
