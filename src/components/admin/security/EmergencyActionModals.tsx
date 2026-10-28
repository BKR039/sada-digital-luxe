import { useState } from "react";
import { useTranslation } from "@/i18n";
import type { UserSessionRecord } from "@/types/security-center";
import type { AccountRecord } from "@/lib/account-service";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAButton } from "@/components/ui/sada-button";
import { SADAInput, SADATextarea } from "@/components/ui/sada-ui";
import {
  ShieldAlert,
  Radio,
  UserX,
  RotateCcw,
  AlertTriangle,
  Lock,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------
 * 1. Revoke One Session Modal
 * ------------------------------------------------------------ */
interface RevokeSessionModalProps {
  session: UserSessionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (session: UserSessionRecord, reason: string) => Promise<void>;
}

export function RevokeSessionModal({
  session,
  isOpen,
  onClose,
  onConfirm,
}: RevokeSessionModalProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(isAr ? "يرجى كتابة سبب الإلغاء الإداري." : "Please specify a revocation reason.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(session, reason);
      onClose();
      setReason("");
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل إلغاء الجلسة." : "Failed to revoke session."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isAr ? "تأكيد إلغاء جلسة العمل" : "Confirm Session Revocation"}
      size="compact"
    >
      <div className="space-y-4 text-start">
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <ShieldAlert className="size-4 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <span className="font-semibold block mb-0.5">
              {isAr ? "إبطال فوري ومحكم للصلاحيات" : "Immediate Server Invalidation"}
            </span>
            <span>
              {isAr
                ? "سيتم منع هذه الجلسة فوراً من تنفيذ أي عمليات خادم أو قراءة للبيانات، وسيتم تسجيل العملية أمنياً."
                : "This session will be immediately denied from protected database mutations and operations."}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 p-3 rounded-xl bg-card border border-border/80 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "المستخدم المعني:" : "Affected User:"}</span>
            <span className="font-semibold text-foreground">{session.display_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{session.user_email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "معرف الجلسة:" : "Session Reference:"}</span>
            <span className="font-mono text-muted-foreground text-[10px]" dir="ltr">
              {session.session_id.slice(0, 20)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "الجهاز والبيئة:" : "Device & OS:"}</span>
            <span className="font-mono text-muted-foreground text-[11px]">{session.browser_name} ({session.os_name})</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            {isAr ? "سبب الإلغاء الإداري *" : "Revocation Reason *"}
          </label>
          <SADATextarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isAr ? "اكتب سبب إنهاء هذه الجلسة (مطلوب للتدقيق)..." : "Specify the reason for revoking this session (required for audit)..."}
            className="w-full text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <SADAButton variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          <SADAButton
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || !reason.trim()}
          >
            {submitting && <Loader2 className="size-3.5 animate-spin me-1.5" />}
            <span>{isAr ? "تأكيد إبطال الجلسة" : "Confirm Revocation"}</span>
          </SADAButton>
        </div>
      </div>
    </SADADialog>
  );
}

/* ------------------------------------------------------------
 * 2. Sign Out Everywhere Modal (Revoke All Sessions for User)
 * ------------------------------------------------------------ */
interface SignOutEverywhereModalProps {
  userRecord: { user_id: string; display_name: string; email: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, reason: string) => Promise<void>;
}

export function SignOutEverywhereModal({
  userRecord,
  isOpen,
  onClose,
  onConfirm,
}: SignOutEverywhereModalProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userRecord) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(isAr ? "يرجى كتابة سبب تسجيل الخروج الإجباري." : "Please specify a reason.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(userRecord.user_id, reason);
      onClose();
      setReason("");
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل تسجيل الخروج من كل الأجهزة." : "Failed to revoke all user sessions."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isAr ? "تسجيل الخروج من جميع الأجهزة (Sign Out Everywhere)" : "Sign Out Everywhere"}
      size="compact"
    >
      <div className="space-y-4 text-start">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <Radio className="size-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold block mb-0.5">
              {isAr ? "إلغاء جميع الجلسات النشطة للمستخدم" : "Revoke All Active Sessions"}
            </span>
            <span>
              {isAr
                ? `سيتم إنهاء كل جلسات العمل المفتوحة للمستخدم ${userRecord.display_name} على جميع المتصفحات والأجهزة.`
                : `All active sessions for ${userRecord.display_name} across all devices and browsers will be terminated.`}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-card border border-border/80 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "المستخدم المستهدف:" : "Target User:"}</span>
            <span className="font-semibold text-foreground">{userRecord.display_name}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{userRecord.email}</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            {isAr ? "سبب الإلغاء الشامل للجلسات *" : "Reason for Global Revocation *"}
          </label>
          <SADATextarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isAr ? "اكتب سبب تسجيل الخروج الإجباري من جميع الأجهزة..." : "Specify reason for global sign-out..."}
            className="w-full text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <SADAButton variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || !reason.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting && <Loader2 className="size-3.5 animate-spin me-1.5" />}
            <span>{isAr ? "إلغاء جميع الجلسات" : "Revoke All Sessions"}</span>
          </SADAButton>
        </div>
      </div>
    </SADADialog>
  );
}

/* ------------------------------------------------------------
 * 3. Suspend Account Modal (Includes Instant Session Invalidation)
 * ------------------------------------------------------------ */
interface SuspendAccountSecurityModalProps {
  userRecord: { user_id: string; display_name: string; email: string; role?: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, reason: string) => Promise<void>;
  isSelf: boolean;
  isLastSuperAdmin: boolean;
}

export function SuspendAccountSecurityModal({
  userRecord,
  isOpen,
  onClose,
  onConfirm,
  isSelf,
  isLastSuperAdmin,
}: SuspendAccountSecurityModalProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userRecord) return null;

  const handleConfirm = async () => {
    if (isSelf) {
      setError(
        isAr
          ? "لا يمكنك تعليق حسابك الخاص (حماية من القفل الإداري العرضي)."
          : "Cannot suspend own account (administrative self-lockout protection)."
      );
      return;
    }

    if (isLastSuperAdmin) {
      setError(
        isAr
          ? "مطلوب وجود مشرف متميز نشط واحد على الأقل."
          : "At least one active Super Admin is required."
      );
      return;
    }

    if (!reason.trim()) {
      setError(isAr ? "يرجى كتابة سبب تعليق الحساب." : "Please provide a reason for account suspension.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(userRecord.user_id, reason);
      onClose();
      setReason("");
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل تعليق الحساب." : "Failed to suspend account."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isAr ? "تعليق وصول الحساب وإلغاء جميع الجلسات" : "Suspend Account & Revoke All Sessions"}
      size="compact"
    >
      <div className="space-y-4 text-start">
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <UserX className="size-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="space-y-1">
            <span className="font-semibold block">
              {isAr ? "عواقب تعليق الحساب الأمنية:" : "Security Enforcement Consequences:"}
            </span>
            <ul className="list-disc ps-4 space-y-0.5 text-[11px]">
              <li>{isAr ? "حظر تسجيل الدخول فوراً في GoTrue." : "Immediate ban on GoTrue authentication."}</li>
              <li>{isAr ? "إبطال جميع الجلسات النشطة في قاعدة البيانات." : "Immediate revocation of all active sessions in PostgreSQL."}</li>
              <li>{isAr ? "رفض أي عمليات خادم أو طلبات RLS حتى لو بقي JWT غير منتهٍ." : "Rejection of server mutations and RLS queries even if JWT unexpired."}</li>
              <li>{isAr ? "الحفاظ على السجلات والمسارات التاريخية دون حذف أي بيانات." : "Preservation of all historical data, tasks, and audit logs."}</li>
            </ul>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-card border border-border/80 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "الحساب المستهدف:" : "Target Account:"}</span>
            <span className="font-semibold text-foreground">{userRecord.display_name}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{userRecord.email}</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            {isAr ? "سبب التعليق الإداري *" : "Reason for Suspension *"}
          </label>
          <SADATextarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isAr ? "اكتب سبب تعليق هذا الحساب (مطلوب للتدقيق)..." : "State the reason for suspending this account (required for audit)..."}
            className="w-full text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <SADAButton variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          <SADAButton
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || !reason.trim() || isSelf || isLastSuperAdmin}
          >
            {submitting && <Loader2 className="size-3.5 animate-spin me-1.5" />}
            <span>{isAr ? "تأكيد تعليق الحساب" : "Confirm Suspension"}</span>
          </SADAButton>
        </div>
      </div>
    </SADADialog>
  );
}

/* ------------------------------------------------------------
 * 4. Reactivate Account Modal (Fresh Authentication Enforced)
 * ------------------------------------------------------------ */
interface ReactivateAccountSecurityModalProps {
  userRecord: { user_id: string; display_name: string; email: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, reason?: string) => Promise<void>;
}

export function ReactivateAccountSecurityModal({
  userRecord,
  isOpen,
  onClose,
  onConfirm,
}: ReactivateAccountSecurityModalProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userRecord) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(userRecord.user_id, reason || "Administrative access restoration");
      onClose();
      setReason("");
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل إعادة تفعيل الحساب." : "Failed to reactivate account."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isAr ? "إعادة تفعيل وصول الحساب" : "Reactivate Account Access"}
      size="compact"
    >
      <div className="space-y-4 text-start">
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
          <span className="font-semibold block mb-0.5">
            {isAr ? "شروط إعادة التفعيل:" : "Reactivation Policy:"}
          </span>
          <span className="text-[11px]">
            {isAr
              ? "إعادة التفعيل ترفع الحظر عن الحساب لكنها لا تستعيد الجلسات القديمة الملغاة. سيتوجب على المستخدم تسجيل الدخول ببيانات اعتماد صالحة."
              : "Reactivating this account removes the authentication ban. Revoked sessions are NOT restored; the user must perform fresh authentication."}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-card border border-border/80 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "الحساب المستهدف:" : "Target Account:"}</span>
            <span className="font-semibold text-foreground">{userRecord.display_name}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{userRecord.email}</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            {isAr ? "سبب إعادة التفعيل (اختياري للتدقيق)" : "Reactivation Reason (Optional)"}
          </label>
          <SADAInput
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isAr ? "سبب إعادة تفعيل الحساب..." : "Reason for restoring account access..."}
            className="w-full text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <SADAButton variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting && <Loader2 className="size-3.5 animate-spin me-1.5" />}
            <span>{isAr ? "تأكيد إعادة التفعيل" : "Reactivate Account"}</span>
          </SADAButton>
        </div>
      </div>
    </SADADialog>
  );
}
