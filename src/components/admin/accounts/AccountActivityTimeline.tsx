import { useEffect, useState } from "react";
import { AccountAuditLog, fetchAccountAuditLogs } from "@/lib/account-service";
import { format, parseISO } from "date-fns";
import { useTranslation } from "@/i18n";
import {
  History,
  ShieldCheck,
  UserCheck,
  UserX,
  KeyRound,
  RotateCcw,
  Edit,
  Trash2,
  Loader2,
  Clock,
} from "lucide-react";

interface AccountActivityTimelineProps {
  targetUserId: string;
}

export function AccountActivityTimeline({ targetUserId }: AccountActivityTimelineProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [logs, setLogs] = useState<AccountAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const data = await fetchAccountAuditLogs(targetUserId);
        setLogs(data);
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground font-mono text-xs">
        <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
        {isAr ? "جاري تحميل سجل التدقيق الأمني..." : "Loading immutable audit log..."}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center border border-border/80 rounded-2xl bg-muted/20">
        <History className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
        <p className="text-xs text-muted-foreground font-mono">
          {isAr ? "لم يتم تسجيل أي أحداث أمنية لهذا الحساب." : "No security events recorded for this account."}
        </p>
      </div>
    );
  }

  const getEventBadge = (action: string) => {
    switch (action) {
      case "account_created":
        return {
          icon: UserCheck,
          label: isAr ? "إنشاء الحساب" : "Account Created",
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        };
      case "account_updated":
        return {
          icon: Edit,
          label: isAr ? "تحديث الملف" : "Profile Updated",
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        };
      case "role_changed":
        return {
          icon: ShieldCheck,
          label: isAr ? "تعديل الدور" : "Role Modified",
          color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        };
      case "account_suspended":
        return {
          icon: UserX,
          label: isAr ? "تعليق الوصول" : "Access Suspended",
          color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
        };
      case "account_reactivated":
        return {
          icon: RotateCcw,
          label: isAr ? "إعادة تفعيل الوصول" : "Access Reactivated",
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        };
      case "account_permissions_updated":
      case "permissions_updated":
        return {
          icon: ShieldCheck,
          label: isAr ? "تعديل الصلاحيات" : "Permissions Updated",
          color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        };
      case "password_changed":
        return {
          icon: KeyRound,
          label: isAr ? "تغيير كلمة المرور" : "Password Reset / Changed",
          color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        };
      case "account_deleted":
        return {
          icon: Trash2,
          label: isAr ? "حذف الحساب" : "Account Deleted",
          color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
        };
      default:
        return {
          icon: History,
          label: action,
          color: "text-muted-foreground bg-muted border-border",
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h4 className="font-display font-bold text-sm text-foreground">
            {isAr ? "سجل التدقيق الأمني الثابت" : "Immutable Security Audit Trail"}
          </h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          <span dir="ltr">{logs.length}</span> {isAr ? "أحداث مسجلة" : "events logged"}
        </span>
      </div>

      <div className="space-y-3 relative before:absolute before:start-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
        {logs.map((log) => {
          const badge = getEventBadge(log.action);
          const Icon = badge.icon;

          return (
            <div key={log.id} className="relative ps-8 text-xs text-start">
              <div
                className={`absolute start-1.5 top-0.5 size-5 rounded-full border grid place-items-center ${badge.color}`}
              >
                <Icon className="size-2.5" />
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-semibold px-2 py-0.5 rounded-md text-[10px] border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground" dir="ltr">
                    <Clock className="size-2.5" />
                    <span>{format(parseISO(log.created_at), "yyyy-MM-dd HH:mm:ss")}</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  <span>{isAr ? "المنفّذ: " : "Actor: "}</span>
                  <span className="font-mono text-foreground" dir="ltr">{log.actor_email || (isAr ? "النظام" : "System")}</span>
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="p-2 rounded-lg bg-muted/40 font-mono text-[10px] text-muted-foreground space-y-0.5 overflow-x-auto text-start" dir="ltr">
                    {Object.entries(log.metadata).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-foreground/70 font-semibold">{k}:</span>
                        <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
