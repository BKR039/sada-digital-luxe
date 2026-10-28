import { useTranslation } from "@/i18n";
import {
  ShieldCheck,
  Radio,
  History,
  ShieldAlert,
  Users,
} from "lucide-react";

export type SecurityCenterTab =
  | "overview"
  | "accounts"
  | "sessions"
  | "activity"
  | "audit"
  | "security-audit"
  | "alerts";

interface SecurityControlCenterNavProps {
  activeTab: SecurityCenterTab;
  onTabChange: (tab: SecurityCenterTab) => void;
  activeSessionsCount?: number;
  openAlertsCount?: number;
  totalAccountsCount?: number;
}

export function SecurityControlCenterNav({
  activeTab,
  onTabChange,
  activeSessionsCount = 0,
  openAlertsCount = 0,
  totalAccountsCount = 0,
}: SecurityControlCenterNavProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  // Canonical 5 sections mandated by architectural consolidation
  const tabs: {
    id: SecurityCenterTab;
    label: string;
    icon: any;
    badge?: number;
    badgeVariant?: "default" | "warning" | "danger" | "success";
  }[] = [
    {
      id: "overview",
      label: isAr ? "نظرة عامة على الأمان والحسابات" : "Overview",
      icon: ShieldCheck,
    },
    {
      id: "accounts",
      label: isAr ? "دليل الحسابات والأدوار" : "Accounts",
      icon: Users,
      badge: totalAccountsCount,
      badgeVariant: "default",
    },
    {
      id: "sessions",
      label: isAr ? "الجلسات المباشرة" : "Live Sessions",
      icon: Radio,
      badge: activeSessionsCount,
      badgeVariant: "success",
    },
    {
      id: "activity",
      label: isAr ? "الجدول الزمني للنشاط" : "User Activity",
      icon: History,
    },
    {
      id: "audit",
      label: isAr ? "الأمان وسجل التدقيق" : "Security & Audit",
      icon: ShieldAlert,
      badge: openAlertsCount,
      badgeVariant: openAlertsCount > 0 ? "danger" : "default",
    },
  ];

  // Map active tab to canonical tab id
  const resolveCanonicalTab = (tab: SecurityCenterTab): SecurityCenterTab => {
    if (tab === "alerts" || tab === "security-audit") return "audit";
    return tab;
  };

  const canonicalActiveTab = resolveCanonicalTab(activeTab);

  return (
    <div className="w-full border-b border-border/70 pb-3">
      <nav
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
        aria-label="Security Center Navigation"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = canonicalActiveTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "bg-muted/30 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span>{tab.label}</span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-tight ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : tab.badgeVariant === "danger"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      : tab.badgeVariant === "success"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
