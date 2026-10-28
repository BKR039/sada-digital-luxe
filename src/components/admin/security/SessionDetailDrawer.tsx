import { useTranslation } from "@/i18n";
import type { UserSessionRecord, UserActivityEvent } from "@/types/security-center";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  X,
  Radio,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  UserX,
  History,
  Lock,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SADADrawer } from "@/components/ui/sada-drawer";
import { SADAButton } from "@/components/ui/sada-button";

interface SessionDetailDrawerProps {
  session: UserSessionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onRevokeSession: (session: UserSessionRecord) => void;
  onSignOutEverywhere: (session: UserSessionRecord) => void;
  onSuspendAccount: (session: UserSessionRecord) => void;
  currentUserId?: string;
}

export function SessionDetailDrawer({
  session,
  isOpen,
  onClose,
  onRevokeSession,
  onSignOutEverywhere,
  onSuspendAccount,
  currentUserId,
}: SessionDetailDrawerProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const [copiedId, setCopiedId] = useState(false);

  if (!session) return null;

  const isCurrentSession = session.user_id === currentUserId;
  const isRevoked = session.session_status === "revoked";
  const isExpired = session.session_status === "expired";

  const handleCopySessionId = async () => {
    await navigator.clipboard.writeText(session.session_id);
    setCopiedId(true);
    toast.success(isAr ? "تم نسخ معرف الجلسة" : "Session reference copied");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile":
        return Smartphone;
      case "tablet":
        return Tablet;
      default:
        return Laptop;
    }
  };

  const DeviceIcon = getDeviceIcon(session.device_type);

  return (
    <SADADrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isAr ? "تفاصيل جلسة العمل والتحقق الأمني" : "Session Investigation & Details"}
      description={isAr ? "فحص بيانات الجلسة، والتحكم الفوري بإلغاء الوصول" : "Inspect authoritative session evidence and trigger immediate revocation."}
      width="lg"
    >
      <div className="space-y-6 text-start p-1">
        {/* User Identity Card */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 text-primary font-bold text-sm grid place-items-center border border-primary/20">
                {session.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">
                  {session.display_name}
                </h4>
                <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                  {session.user_email}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-muted border border-border/60 text-muted-foreground font-semibold">
                {session.role}
              </span>
              {session.account_status === "suspended" ? (
                <span className="text-[10px] font-semibold text-rose-500 flex items-center gap-1">
                  <UserX className="size-3" />
                  {isAr ? "حساب معلق" : "Suspended"}
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                  <ShieldCheck className="size-3" />
                  {isAr ? "حساب نشط" : "Active"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Session Status & Safe Identifier */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {isAr ? "حالة الجلسة" : "Session State"}
            </span>
            <div className="flex items-center gap-1.5">
              {session.session_status === "active" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isAr ? "نشطة" : "ACTIVE"}
                </span>
              )}
              {session.session_status === "idle" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                  {isAr ? "خاملة" : "IDLE"}
                </span>
              )}
              {session.session_status === "revoked" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
                  {isAr ? "ملغاة إدارياً" : "REVOKED"}
                </span>
              )}
              {session.session_status === "expired" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/70 font-mono">
                  {isAr ? "منتهية" : "EXPIRED"}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              {isAr ? "المعرف الآمن للجلسة" : "Safe Session Reference"}
            </label>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border/60">
              <span className="text-xs font-mono text-foreground truncate flex-1" dir="ltr">
                {session.session_id}
              </span>
              <button
                onClick={handleCopySessionId}
                className="size-7 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center transition-colors cursor-pointer"
                title={isAr ? "نسخ المعرف" : "Copy reference"}
              >
                {copiedId ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>

          {session.revocation_reason && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <span className="font-semibold block mb-0.5">
                {isAr ? "سبب الإلغاء الإداري:" : "Revocation Reason:"}
              </span>
              <span className="font-mono text-[11px]">{session.revocation_reason}</span>
            </div>
          )}
        </div>

        {/* Telemetry & Device Footprint */}
        <div className="space-y-3">
          <h5 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">
            {isAr ? "بيانات البيئة والجهاز الموثقة" : "Recorded Environment & Device"}
          </h5>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-card border border-border/80">
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-mono uppercase mb-1">
                <DeviceIcon className="size-3 text-primary" />
                <span>{isAr ? "نوع الجهاز" : "Device & OS"}</span>
              </div>
              <div className="font-semibold text-foreground">
                {session.os_name || "Unknown OS"}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground capitalize">
                {session.device_type}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/80">
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-mono uppercase mb-1">
                <Globe className="size-3 text-primary" />
                <span>{isAr ? "المتصفح" : "Browser"}</span>
              </div>
              <div className="font-semibold text-foreground truncate">
                {session.browser_name || "Web Browser"}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {session.auth_method} auth
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/80">
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-mono uppercase mb-1">
                <Clock className="size-3 text-primary" />
                <span>{isAr ? "بدء تسجيل الدخول" : "Sign In Time"}</span>
              </div>
              <div className="font-semibold text-foreground font-mono text-[11px]" dir="ltr">
                {format(parseISO(session.sign_in_at), "yyyy-MM-dd HH:mm")}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(parseISO(session.sign_in_at), { addSuffix: true })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/80">
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-mono uppercase mb-1">
                <Radio className="size-3 text-emerald-500" />
                <span>{isAr ? "آخر نشاط موثق" : "Last Verified Activity"}</span>
              </div>
              <div className="font-semibold text-foreground font-mono text-[11px]" dir="ltr">
                {format(parseISO(session.last_activity_at), "yyyy-MM-dd HH:mm")}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(parseISO(session.last_activity_at), { addSuffix: true })}
              </div>
            </div>
          </div>

          {session.user_agent && (
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                {isAr ? "User-Agent الكامل" : "Raw User-Agent"}
              </span>
              <p className="font-mono text-[10px] text-muted-foreground break-all" dir="ltr">
                {session.user_agent}
              </p>
            </div>
          )}
        </div>

        {/* Emergency Actions Section */}
        <div className="pt-4 border-t border-border/70 space-y-3">
          <h5 className="font-display font-bold text-xs uppercase tracking-wider text-rose-500 flex items-center gap-2">
            <ShieldAlert className="size-3.5" />
            <span>{isAr ? "إجراءات التحكم الأمني في الوصول" : "Emergency Access Controls"}</span>
          </h5>

          <div className="space-y-2">
            {!isRevoked && (
              <SADAButton
                variant="destructive"
                className="w-full justify-start text-xs h-10 rounded-xl"
                onClick={() => onRevokeSession(session)}
              >
                <ShieldAlert className="size-4 me-2" />
                <span>{isAr ? "إلغاء هذه الجلسة فوراً" : "Revoke This Session Now"}</span>
              </SADAButton>
            )}

            <SADAButton
              variant="outline"
              className="w-full justify-start text-xs h-10 rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={() => onSignOutEverywhere(session)}
            >
              <Radio className="size-4 me-2" />
              <span>{isAr ? "تسجيل الخروج من كل الأجهزة للمستخدم" : "Sign Out Everywhere For User"}</span>
            </SADAButton>

            {session.account_status !== "suspended" && (
              <SADAButton
                variant="outline"
                className="w-full justify-start text-xs h-10 rounded-xl border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                onClick={() => onSuspendAccount(session)}
              >
                <UserX className="size-4 me-2" />
                <span>{isAr ? "تعليق الحساب بالكامل" : "Suspend Entire Account"}</span>
              </SADAButton>
            )}
          </div>
        </div>
      </div>
    </SADADrawer>
  );
}
