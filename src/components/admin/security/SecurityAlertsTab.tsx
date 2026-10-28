import { useState, useMemo } from "react";
import { useTranslation } from "@/i18n";
import type { SecurityAlertRecord, AlertStatus, AlertSeverity } from "@/types/security-center";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldAlert,
  Clock,
  Filter,
  Check,
  RotateCcw,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADialog } from "@/components/ui/sada-dialog";

interface SecurityAlertsTabProps {
  alerts: SecurityAlertRecord[];
  onResolveAlert: (alertId: string, status: "resolved" | "dismissed" | "acknowledged", notes?: string) => Promise<void>;
  onRefresh: () => void;
  loading: boolean;
}

export function SecurityAlertsTab({
  alerts,
  onResolveAlert,
  onRefresh,
  loading,
}: SecurityAlertsTabProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resolvingAlert, setResolvingAlert] = useState<SecurityAlertRecord | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      return true;
    });
  }, [alerts, statusFilter, severityFilter]);

  const handleConfirmResolution = async () => {
    if (!resolvingAlert) return;
    setSubmitting(true);
    try {
      await onResolveAlert(resolvingAlert.id, "resolved", resolutionNotes);
      setResolvingAlert(null);
      setResolutionNotes("");
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (sev: AlertSeverity) => {
    switch (sev) {
      case "critical":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "high":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "medium":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground border-border/70";
    }
  };

  const getStatusBadge = (st: AlertStatus) => {
    switch (st) {
      case "open":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "acknowledged":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "resolved":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-border/70";
    }
  };

  return (
    <div className="space-y-4 text-start">
      {/* Header and Filter Controls */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <span>{isAr ? "التنبيهات الأمنية وقواعد كشف الاشتباه" : "Security Alerts & Anomaly Detection"}</span>
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr
              ? "رصد آلي وقواعد محددة لاكتشاف محاولات الاختراق، وتكرار الفشل، وتجاوز الصلاحيات."
              : "Rule-based detection for repeated authentication failures, permission bursts, and anomalous account activity."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SADASelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: isAr ? "جميع الحالات" : "All Statuses" },
              { value: "open", label: isAr ? "تنبيهات مفتوحة" : "Open Only" },
              { value: "acknowledged", label: isAr ? "قيد المتابعة" : "Acknowledged" },
              { value: "resolved", label: isAr ? "تم الحل" : "Resolved" },
              { value: "dismissed", label: isAr ? "تم التجاهل" : "Dismissed" },
            ]}
            className="w-36 h-9 text-xs"
          />

          <SADASelect
            value={severityFilter}
            onChange={setSeverityFilter}
            options={[
              { value: "all", label: isAr ? "جميع درجات الخطورة" : "All Severities" },
              { value: "critical", label: isAr ? "حرجة للغاية" : "Critical" },
              { value: "high", label: isAr ? "عالية" : "High" },
              { value: "medium", label: isAr ? "متوسطة" : "Medium" },
              { value: "low", label: isAr ? "منخفضة" : "Low" },
            ]}
            className="w-40 h-9 text-xs"
          />

          <SADAButton
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 px-3 rounded-xl text-xs"
          >
            {isAr ? "تحديث" : "Refresh"}
          </SADAButton>
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-border/80 text-muted-foreground">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h5 className="font-semibold text-sm text-foreground">
              {isAr ? "لا توجد تنبيهات أمنية مطابقة" : "No Matching Security Alerts"}
            </h5>
            <p className="text-xs text-muted-foreground mt-1">
              {isAr
                ? "النظام مستقر ولم يتم إطلاق أي تنبيهات تطابق المعايير المختارة."
                : "No suspicious events or anomalous authentication patterns detected."}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isExpanded = expandedAlertId === alert.id;

            return (
              <div
                key={alert.id}
                className="p-4 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-border transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded-md border ${getSeverityBadge(
                        alert.severity
                      )}`}
                    >
                      {alert.severity}
                    </span>
                    <span
                      className={`text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded-md border ${getStatusBadge(
                        alert.status
                      )}`}
                    >
                      {alert.status}
                    </span>
                    <h5 className="font-bold text-sm text-foreground">
                      {alert.title}
                    </h5>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground" dir="ltr">
                    <Clock className="size-3" />
                    <span>{format(parseISO(alert.created_at), "yyyy-MM-dd HH:mm:ss")}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {alert.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <span className="font-semibold text-foreground text-[11px] block mb-0.5">
                      {isAr ? "الإجراء الموصى به:" : "Recommended Containment Action:"}
                    </span>
                    <span className="text-muted-foreground">{alert.recommended_action}</span>
                  </div>

                  {alert.user_email && (
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <span className="font-semibold text-foreground text-[11px] block mb-0.5">
                        {isAr ? "الحساب المعني:" : "Affected Identity:"}
                      </span>
                      <span className="font-mono text-muted-foreground" dir="ltr">{alert.user_email}</span>
                    </div>
                  )}
                </div>

                {/* Evidence Drawer */}
                {alert.trigger_evidence && Object.keys(alert.trigger_evidence).length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                      className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      <span>{isExpanded ? (isAr ? "إخفاء أدلة التنبيه" : "Hide Evidence") : (isAr ? "عرض أدلة التنبيه" : "Inspect Evidence Details")}</span>
                    </button>

                    {isExpanded && (
                      <div
                        className="mt-2 p-2.5 rounded-lg bg-muted/40 font-mono text-[10px] text-muted-foreground space-y-1 overflow-x-auto text-start border border-border/50"
                        dir="ltr"
                      >
                        {Object.entries(alert.trigger_evidence).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-foreground/70 font-semibold">{k}:</span>
                            <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resolution Notes if Resolved */}
                {alert.status === "resolved" && alert.resolution_notes && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
                    <span className="font-semibold block mb-0.5">{isAr ? "ملاحظات الحل:" : "Resolution Notes:"}</span>
                    <span className="font-mono text-[11px]">{alert.resolution_notes}</span>
                  </div>
                )}

                {/* Action Buttons */}
                {alert.status === "open" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <SADAButton
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-xl"
                      onClick={() => onResolveAlert(alert.id, "acknowledged")}
                    >
                      <span>{isAr ? "إقرار بالمتابعة" : "Acknowledge"}</span>
                    </SADAButton>

                    <SADAButton
                      variant="primary"
                      size="sm"
                      className="h-8 text-xs rounded-xl"
                      onClick={() => setResolvingAlert(alert)}
                    >
                      <Check className="size-3.5 me-1" />
                      <span>{isAr ? "حل التنبيه" : "Resolve Alert"}</span>
                    </SADAButton>

                    <SADAButton
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs rounded-xl text-muted-foreground ms-auto"
                      onClick={() => onResolveAlert(alert.id, "dismissed")}
                    >
                      <span>{isAr ? "تجاهل" : "Dismiss"}</span>
                    </SADAButton>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Resolve Dialog */}
      {resolvingAlert && (
        <SADADialog
          open={Boolean(resolvingAlert)}
          onOpenChange={(open) => {
            if (!open) setResolvingAlert(null);
          }}
          title={isAr ? "تأكيد حل التنبيه الأمني" : "Resolve Security Alert"}
          size="compact"
        >
          <div className="space-y-4 text-start">
            <p className="text-xs text-muted-foreground">
              {isAr
                ? `سيتم وسم التنبيه "${resolvingAlert.title}" كمحلول، وتوثيق ذلك في سجل التدقيق الأمني.`
                : `Marking "${resolvingAlert.title}" as resolved will record your identity and timestamp in the immutable audit log.`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {isAr ? "ملاحظات التحقيق والحل الإداري *" : "Investigation & Resolution Notes *"}
              </label>
              <textarea
                required
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder={isAr ? "اذكر سبب إغلاق التنبيه والإجراءات المتخذة..." : "Document actions taken and why this alert is safely resolved..."}
                className="w-full text-xs p-3 rounded-xl border border-border/80 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <SADAButton
                variant="outline"
                size="sm"
                onClick={() => setResolvingAlert(null)}
                disabled={submitting}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>

              <SADAButton
                variant="primary"
                size="sm"
                onClick={handleConfirmResolution}
                disabled={submitting || !resolutionNotes.trim()}
              >
                {isAr ? "حفظ كـ محلول" : "Mark Resolved"}
              </SADAButton>
            </div>
          </div>
        </SADADialog>
      )}
    </div>
  );
}
