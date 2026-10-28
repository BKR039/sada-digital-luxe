import { useState } from "react";
import { useTranslation } from "@/i18n";
import type { SecurityAlertRecord } from "@/types/security-center";
import type { SystemAuditLog } from "@/types/notifications-and-audit";
import { SecurityAlertsTab } from "./SecurityAlertsTab";
import { AuditHistoryTab } from "./AuditHistoryTab";
import { AlertTriangle, FileSpreadsheet, ShieldCheck, History } from "lucide-react";

interface SecurityAndAuditTabProps {
  alerts: SecurityAlertRecord[];
  logs: SystemAuditLog[];
  onResolveAlert: (
    alertId: string,
    status: "resolved" | "dismissed" | "acknowledged",
    notes?: string
  ) => Promise<void>;
  onRefresh: () => void;
  loading: boolean;
  currentUserId?: string;
  initialSubtab?: "alerts" | "audit";
}

export function SecurityAndAuditTab({
  alerts,
  logs,
  onResolveAlert,
  onRefresh,
  loading,
  currentUserId,
  initialSubtab = "alerts",
}: SecurityAndAuditTabProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [subtab, setSubtab] = useState<"alerts" | "audit">(initialSubtab);

  const openAlertsCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div className="space-y-6">
      {/* Subtab Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center border border-primary/20 shrink-0">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xs sm:text-sm text-foreground">
              {isAr ? "مركز الأمان وسجلات التدقيق الموحدة" : "Security Events & Audit History"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "تتبع التنبيهات الأمنية الذكية وسجلات التدقيق غير القابلة للتعديل في مكان واحد."
                : "Rule-based security alerts and immutable append-only system audit trails."}
            </p>
          </div>
        </div>

        {/* Switcher Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 self-start sm:self-auto">
          <button
            onClick={() => setSubtab("alerts")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subtab === "alerts"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <AlertTriangle className="size-3.5" />
            <span>{isAr ? "التنبيهات الأمنية" : "Security Alerts"}</span>
            {openAlertsCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-tight ${
                  subtab === "alerts"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                }`}
              >
                {openAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setSubtab("audit")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subtab === "audit"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <FileSpreadsheet className="size-3.5" />
            <span>{isAr ? "سجل التدقيق الشامل" : "System Audit Trail"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-tight ${
                subtab === "audit"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {logs.length}
            </span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-View */}
      {subtab === "alerts" ? (
        <SecurityAlertsTab
          alerts={alerts}
          onResolveAlert={onResolveAlert}
          onRefresh={onRefresh}
          loading={loading}
        />
      ) : (
        <AuditHistoryTab
          logs={logs}
          onRefresh={onRefresh}
          loading={loading}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
