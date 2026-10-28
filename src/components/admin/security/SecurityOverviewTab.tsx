import { useTranslation } from "@/i18n";
import type { SecurityKPIs, SecurityAlertRecord } from "@/types/security-center";
import type { AccountRecord } from "@/lib/account-service";
import { format, parseISO } from "date-fns";
import {
  Radio,
  Users,
  ShieldAlert,
  UserX,
  AlertTriangle,
  Flame,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Clock,
  Eye,
  Lock,
  UserCheck,
  KeyRound,
  Info,
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import type { SecurityCenterTab } from "./SecurityControlCenterNav";

interface SecurityOverviewTabProps {
  kpis: SecurityKPIs;
  alerts: SecurityAlertRecord[];
  accounts?: AccountRecord[];
  onNavigateTab: (tab: SecurityCenterTab, targetUser?: { id: string; email: string }) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function SecurityOverviewTab({
  kpis,
  alerts,
  accounts = [],
  onNavigateTab,
  onRefresh,
  refreshing,
}: SecurityOverviewTabProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const unresolvedAlerts = alerts.filter((a) => a.status === "open");

  // Account calculations
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.status === "active").length;
  const suspendedAccounts = accounts.filter((a) => a.status === "suspended").length || kpis.suspended_accounts_count;
  const pendingAccounts = accounts.filter((a) => a.status === "pending").length;

  const superAdminsCount = accounts.filter((a) => a.role === "super_admin").length;
  const adminsCount = accounts.filter((a) => a.role === "admin").length;
  const workersCount = accounts.filter((a) => a.role === "worker").length;

  const metricCards = [
    {
      label: isAr ? "الجلسات النشطة حالياً" : "Active Sessions Now",
      value: kpis.active_sessions_count,
      subtext: isAr ? "نشاط موثق خلال 24 ساعة" : "Observed activity in 24h",
      badge: isAr ? "قياس لحظي" : "LIVE",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: Radio,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      indicator: "pulse",
      onClick: () => onNavigateTab("sessions"),
    },
    {
      label: isAr ? "المستخدمون النشطون" : "Unique Active Users",
      value: kpis.unique_active_users_count,
      subtext: isAr ? "هويات تم التحقق من جلساتها" : "Verified logged-in identities",
      badge: isAr ? "قياس لحظي" : "LIVE",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: Users,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      onClick: () => onNavigateTab("sessions"),
    },
    {
      label: isAr ? "إجمالي الحسابات المسجلة" : "Total Accounts",
      value: totalAccounts,
      subtext: isAr ? `${activeAccounts} نشط • ${suspendedAccounts} معلق` : `${activeAccounts} active • ${suspendedAccounts} suspended`,
      badge: isAr ? "قاعدة بيانات" : "DATABASE",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: UserCheck,
      color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
      onClick: () => onNavigateTab("accounts"),
    },
    {
      label: isAr ? "الحسابات المعلقة" : "Suspended Accounts",
      value: suspendedAccounts,
      subtext: isAr ? "ممنوعون من الدخول للنظام" : "Authentication banned",
      badge: isAr ? "قاعدة بيانات" : "DATABASE",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      icon: UserX,
      color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
      onClick: () => onNavigateTab("accounts"),
    },
    {
      label: isAr ? "الجلسات الملغاة (30 يوم)" : "Revoked Sessions (30d)",
      value: kpis.revoked_sessions_count,
      subtext: isAr ? "تم إبطالها إدارياً" : "Administratively terminated",
      badge: isAr ? "سجل تاريخي" : "HISTORICAL",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      icon: ShieldAlert,
      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
      onClick: () => onNavigateTab("sessions"),
    },
    {
      label: isAr ? "تنبيهات أمنية معلقة" : "Open Security Alerts",
      value: kpis.open_security_alerts_count,
      subtext: isAr ? "تتطلب مراجعة فورية" : "Requires security review",
      badge: isAr ? "تنبيه لحظي" : "LIVE",
      badgeColor:
        kpis.open_security_alerts_count > 0
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          : "bg-muted text-muted-foreground border-border/60",
      icon: AlertTriangle,
      color:
        kpis.open_security_alerts_count > 0
          ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
          : "text-muted-foreground bg-muted/40 border-border/70",
      onClick: () => onNavigateTab("audit"),
    },
    {
      label: isAr ? "إجراءات إدارية حساسة" : "Privileged Actions (7d)",
      value: kpis.high_risk_actions_count,
      subtext: isAr ? "تعديلات أدوار وإلغاء وصول" : "Role/session/account mutations",
      badge: isAr ? "سجل تاريخي" : "HISTORICAL",
      badgeColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      icon: Flame,
      color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
      onClick: () => onNavigateTab("audit"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center border border-primary/20 shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm text-foreground">
                {isAr ? "مركز التحكم الموحد بالأمان وإدارة الحسابات" : "Unified Account & Security Operations Center"}
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isAr ? "مباشر" : "LIVE ENFORCEMENT"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "مراقبة مباشرة للجلسات والنشاط، مع إبطال فوري عند الاشتباه وضمانات تدقيق غير قابلة للتعديل."
                : "Real-time session telemetry, authoritative revocation, identity health & immutable audit guarantees."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5" dir="ltr">
            <Clock className="size-3.5" />
            <span>
              {kpis.last_security_sync_at
                ? format(parseISO(kpis.last_security_sync_at), "HH:mm:ss")
                : "Just now"}
            </span>
          </div>
          <SADAButton
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 px-3 rounded-lg text-xs"
          >
            <RefreshCw className={`size-3.5 me-1.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{isAr ? "تحديث" : "Sync"}</span>
          </SADAButton>
        </div>
      </div>

      {/* Account Roles & Distribution Strip */}
      <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground font-medium">
          <KeyRound className="size-3.5 text-primary" />
          <span>{isAr ? "توزيع الأدوار والصلاحيات:" : "Identity Roles Distribution:"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <button
            onClick={() => onNavigateTab("accounts")}
            className="px-2.5 py-1 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-foreground transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="size-2 rounded-full bg-rose-500" />
            <span>{isAr ? "مشرف متميز" : "Super Admin"}:</span>
            <span className="font-bold">{superAdminsCount}</span>
          </button>

          <button
            onClick={() => onNavigateTab("accounts")}
            className="px-2.5 py-1 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-foreground transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="size-2 rounded-full bg-blue-500" />
            <span>{isAr ? "مديرو نظام" : "Admin"}:</span>
            <span className="font-bold">{adminsCount}</span>
          </button>

          <button
            onClick={() => onNavigateTab("accounts")}
            className="px-2.5 py-1 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-foreground transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>{isAr ? "أعضاء الفريق" : "Worker"}:</span>
            <span className="font-bold">{workersCount}</span>
          </button>

          {pendingAccounts > 0 && (
            <button
              onClick={() => onNavigateTab("accounts")}
              className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="size-2 rounded-full bg-amber-500" />
              <span>{isAr ? "بانتظار التفعيل" : "Pending"}:</span>
              <span className="font-bold">{pendingAccounts}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={card.onClick}
              className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
                  {card.label}
                </span>
                <div className={`size-7 rounded-lg border grid place-items-center ${card.color} shrink-0`}>
                  <Icon className="size-3.5" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
                  <span>{card.value}</span>
                  {card.indicator === "pulse" && card.value > 0 && (
                    <span className="size-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {card.subtext}
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-mono border ${card.badgeColor}`}>
                    {card.badge}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Attention Panel */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/30 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-amber-500/10 text-amber-500 grid place-items-center border border-amber-500/20">
              <AlertTriangle className="size-3.5" />
            </div>
            <h4 className="font-display font-bold text-sm text-foreground">
              {isAr ? "لوحة الانتباه الأمني والتحقيقات ذات الأولوية" : "Security Attention & Active Risk Items"}
            </h4>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {unresolvedAlerts.length}{" "}
            {isAr ? "تنبيهات غير محلولة" : "unresolved alerts"}
          </span>
        </div>

        <div className="divide-y divide-border/60">
          {unresolvedAlerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-medium text-foreground">
                {isAr ? "لا توجد تهديدات أو تنبيهات أمنية معلقة" : "No Active Security Threats"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto">
                {isAr
                  ? "جميع محاولات تسجيل الدخول، وأنشطة الجلسات، وعمليات النظام ضمن الحدود الطبيعية المعتمدة."
                  : "All authentication lifecycles, active sessions, and system mutations comply with established security rules."}
              </p>
            </div>
          ) : (
            unresolvedAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded-md border ${
                        alert.severity === "critical"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : alert.severity === "high"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="font-semibold text-xs text-foreground">
                      {alert.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                      {format(parseISO(alert.created_at), "yyyy-MM-dd HH:mm")}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {alert.description}
                  </p>

                  <div className="text-[11px] text-muted-foreground font-mono">
                    <span className="text-foreground/70">{isAr ? "الإجراء الموصى به: " : "Recommended: "}</span>
                    <span>{alert.recommended_action}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <SADAButton
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onNavigateTab(
                        "audit",
                        alert.user_id ? { id: alert.user_id, email: alert.user_email || "" } : undefined
                      )
                    }
                    className="h-8 text-xs rounded-xl"
                  >
                    <Eye className="size-3.5 me-1.5" />
                    <span>{isAr ? "التحقيق والحل" : "Investigate"}</span>
                  </SADAButton>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Architecture & Enforcement Transparency Banner */}
      <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Lock className="size-4 text-primary" />
          <span>{isAr ? "نموذج الأمان وإنفاذ الصلاحيات في صدى" : "SADA Enforcement Model & Truthful Telemetry"}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1 text-[11px] font-mono">
          <div className="p-2.5 rounded-xl bg-card border border-border/60">
            <span className="text-foreground font-semibold block mb-0.5">1. Database RLS Invariant</span>
            <span>All mutations verify profile status is active. Suspended users are rejected directly in PostgreSQL.</span>
          </div>
          <div className="p-2.5 rounded-xl bg-card border border-border/60">
            <span className="text-foreground font-semibold block mb-0.5">2. Real-Time Revocation</span>
            <span>Revoking a session halts protected mutations immediately (0ms) through authoritative RPC checks.</span>
          </div>
          <div className="p-2.5 rounded-xl bg-card border border-border/60">
            <span className="text-foreground font-semibold block mb-0.5">3. Immutable Audit Trails</span>
            <span>PostgreSQL triggers prohibit DELETE/UPDATE on audit & session logs. All security attempts are preserved.</span>
          </div>
          <div className="p-2.5 rounded-xl bg-card border border-border/60">
            <span className="text-foreground font-semibold block mb-0.5">4. Truthful Telemetry Boundary</span>
            <span>Browser closure is not inferred as logout. Real inactivity is tracked without fabricating telemetry.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
