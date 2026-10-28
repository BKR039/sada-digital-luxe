import { useState, useEffect } from "react";
import {
  AccountRecord,
  AccountDependencies,
  suspendAccount,
  reactivateAccount,
  deleteAccount,
  analyzeAccountDependencies,
} from "@/lib/account-service";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  FileText,
  DollarSign,
  Briefcase,
  UserX,
  X,
} from "lucide-react";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAButton, SADAInput } from "@/components/ui/sada-ui";

interface AccountDangerZoneProps {
  account: AccountRecord;
  totalActiveSuperAdmins: number;
  isSelf: boolean;
  onActionCompleted: () => void;
  onCloseDrawer?: () => void;
}

export function AccountDangerZone({
  account,
  totalActiveSuperAdmins,
  isSelf,
  onActionCompleted,
  onCloseDrawer,
}: AccountDangerZoneProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const isSuspended = account.status === "suspended";
  const isSuperAdminAccount = account.role === "super_admin";
  const isLastSuperAdmin = isSuperAdminAccount && totalActiveSuperAdmins <= 1;

  // Suspend Dialog State
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  // Reactivate Dialog State
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  // Delete Dialog & Dependency Analysis State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [analyzingDeps, setAnalyzingDeps] = useState(false);
  const [dependencies, setDependencies] = useState<AccountDependencies | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  // Trigger Suspend
  const handleConfirmSuspend = async () => {
    if (isSelf) {
      toast.error(
        isAr
          ? "لا يمكنك تعليق حسابك الخاص (حماية من القفل الإداري العرضي)."
          : "Cannot suspend your own account (administrative self-lockout protection)."
      );
      return;
    }

    if (isLastSuperAdmin) {
      toast.error(isAr ? "مطلوب وجود مشرف متميز نشط واحد على الأقل." : "At least one active Super Admin is required.");
      return;
    }

    setSuspending(true);
    setActionError(null);
    try {
      await suspendAccount(account.user_id, suspendReason);
      toast.success(
        isAr
          ? `تم تعليق حساب ${account.display_name} بنجاح.`
          : `Account for ${account.display_name} has been suspended.`
      );
      setShowSuspendModal(false);
      setSuspendReason("");
      onActionCompleted();
    } catch (err: any) {
      setActionError(err?.message || (isAr ? "فشل تعليق الحساب." : "Failed to suspend account."));
    } finally {
      setSuspending(false);
    }
  };

  // Trigger Reactivate
  const handleConfirmReactivate = async () => {
    setReactivating(true);
    setActionError(null);
    try {
      await reactivateAccount(account.user_id);
      toast.success(
        isAr
          ? `تمت إعادة تفعيل حساب ${account.display_name} بنجاح.`
          : `Account for ${account.display_name} has been reactivated.`
      );
      setShowReactivateModal(false);
      onActionCompleted();
    } catch (err: any) {
      setActionError(err?.message || (isAr ? "فشل إعادة تفعيل الحساب." : "Failed to reactivate account."));
    } finally {
      setReactivating(false);
    }
  };

  // Open Delete Modal and Analyze Dependencies
  const handleOpenDelete = async () => {
    if (isLastSuperAdmin) {
      toast.error(isAr ? "مطلوب وجود مشرف متميز نشط واحد على الأقل." : "At least one active Super Admin is required.");
      return;
    }

    setShowDeleteModal(true);
    setConfirmDeleteText("");
    setAnalyzingDeps(true);
    setActionError(null);

    try {
      const deps = await analyzeAccountDependencies(account.user_id);
      setDependencies(deps);
    } catch (err: any) {
      setActionError(err?.message || (isAr ? "فشل تحليل ارتباطات الحساب." : "Failed to analyze account dependencies."));
    } finally {
      setAnalyzingDeps(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (confirmDeleteText !== account.email) {
      setActionError(
        isAr
          ? `يرجى كتابة "${account.email}" لتأكيد الحذف النهائي.`
          : `Please type "${account.email}" to confirm deletion.`
      );
      return;
    }

    setDeleting(true);
    setActionError(null);
    try {
      await deleteAccount(account.user_id);
      toast.success(
        isAr
          ? `تم حذف الحساب ${account.email} نهائياً.`
          : `Account ${account.email} has been permanently deleted.`
      );
      setShowDeleteModal(false);
      onActionCompleted();
      if (onCloseDrawer) onCloseDrawer();
    } catch (err: any) {
      setActionError(err?.message || (isAr ? "فشل حذف الحساب." : "Failed to delete account."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-rose-500/20 text-start">
      <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs font-mono uppercase tracking-wider">
        <ShieldAlert className="size-4" />
        <span>{isAr ? "منطقة الخطر" : "Danger Zone"}</span>
      </div>

      {isLastSuperAdmin && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
          <div className="font-semibold flex items-center gap-1.5 mb-1">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{isAr ? "حماية المشرف المتميز الوحيد النشط" : "Sole Active Super Admin Protected"}</span>
          </div>
          {isAr
            ? "مطلوب وجود مشرف متميز نشط واحد على الأقل لإدارة صدى. لا يمكنك تعليق هذا الحساب أو حذفه أو تخفيض رتبته."
            : "At least one active Super Admin is required to manage SADA. You cannot suspend, delete, or demote this account."}
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
          {actionError}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-card border border-rose-500/20 shadow-xs space-y-4">
        {/* Suspend or Reactivate Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div>
            <div className="font-semibold text-xs text-foreground">
              {isSuspended
                ? (isAr ? "إعادة تفعيل وصول الحساب" : "Reactivate Account Access")
                : (isAr ? "تعليق وصول الحساب" : "Suspend Account Access")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isSuspended
                ? (isAr
                    ? "يستعيد إمكانية تسجيل الدخول مع الحفاظ التام على جميع البيانات والأدوار الحالية."
                    : "Restores login capabilities while keeping all existing data and roles intact.")
                : (isAr
                    ? "يحظر تسجيل الدخول فوراً. يظل العمل التاريخي والمهام والرواتب محفوظة بنسبة 100%."
                    : "Immediately bans authentication login. Historical work, tasks, and salaries remain 100% preserved.")}
            </p>
          </div>

          <div>
            {isSuspended ? (
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowReactivateModal(true)}
                className="text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
              >
                <RotateCcw className="size-3.5 me-1.5" />
                <span>{isAr ? "إعادة تفعيل" : "Reactivate"}</span>
              </SADAButton>
            ) : (
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                disabled={isLastSuperAdmin || isSelf}
                onClick={() => setShowSuspendModal(true)}
                className="text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50"
              >
                <UserX className="size-3.5 me-1.5" />
                <span>{isAr ? "تعليق الوصول" : "Suspend Access"}</span>
              </SADAButton>
            )}
          </div>
        </div>

        {/* Delete Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-xs text-rose-500">
              {isAr ? "حذف الحساب نهائياً" : "Permanently Delete Account"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isAr
                ? "يقوم بتحليل الارتباطات وإلغاء بيانات المصادقة بأمان دون فقدان التاريخ المالي والمهام."
                : "Performs dependency analysis and safely destroys authentication credentials. Zero cascading loss of financial history."}
            </p>
          </div>

          <div>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              disabled={isLastSuperAdmin}
              onClick={handleOpenDelete}
              className="text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Trash2 className="size-3.5 me-1.5" />
              <span>{isAr ? "حذف الحساب" : "Delete Account"}</span>
            </SADAButton>
          </div>
        </div>
      </div>

      {/* SUSPEND CONFIRMATION MODAL */}
      <SADADialog
        open={showSuspendModal}
        onOpenChange={setShowSuspendModal}
        size="compact"
        title={
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5" />
            <span>{isAr ? "تعليق هذا الحساب؟" : "Suspend this account?"}</span>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2 w-full">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSuspendModal(false)}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmSuspend}
              isLoading={suspending}
              disabled={suspending}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs"
            >
              <span>{isAr ? "تأكيد التعليق" : "Confirm Suspension"}</span>
            </SADAButton>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-muted-foreground text-start">
          <p>
            {isAr ? (
              <>
                سيفقد <strong>{account.display_name}</strong> (<span dir="ltr">{account.email}</span>) إمكانية الوصول إلى صدى فوراً. ستبقى المهام المسندة وسجل المشاريع والرواتب محفوظة تماماً دون تغيير.
              </>
            ) : (
              <>
                <strong>{account.display_name}</strong> ({account.email}) will immediately lose access to SADA. Their assigned tasks, project history, and salary records will remain intact.
              </>
            )}
          </p>

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
              {isAr ? "سبب التعليق (اختياري)" : "Reason for suspension (Optional)"}
            </label>
            <SADAInput
              type="text"
              placeholder={isAr ? "مثال: انتهاء العقد / مراجعة أمنية دورية" : "e.g. End of contract / security review"}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full text-xs text-foreground text-start"
            />
          </div>
        </div>
      </SADADialog>

      {/* REACTIVATE CONFIRMATION MODAL */}
      <SADADialog
        open={showReactivateModal}
        onOpenChange={setShowReactivateModal}
        size="compact"
        title={
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
            <RotateCcw className="size-5" />
            <span>{isAr ? "إعادة تفعيل هذا الحساب؟" : "Reactivate this account?"}</span>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2 w-full">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReactivateModal(false)}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmReactivate}
              isLoading={reactivating}
              disabled={reactivating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              <span>{isAr ? "تأكيد إعادة التفعيل" : "Confirm Reactivation"}</span>
            </SADAButton>
          </div>
        }
      >
        <p className="text-xs text-muted-foreground text-start">
          {isAr ? (
            <>
              ستتم استعادة إمكانية تسجيل الدخول فوراً لـ <strong>{account.display_name}</strong> (<span dir="ltr">{account.email}</span>). سيبقى دوره الحالي وملفه الشخصي دون أي تغيير.
            </>
          ) : (
            <>
              Authentication will be immediately restored for <strong>{account.display_name}</strong> ({account.email}). Their existing role ({account.role}) and profile remain unchanged.
            </>
          )}
        </p>
      </SADADialog>

      {/* DELETE ACCOUNT & DEPENDENCY ANALYSIS MODAL */}
      <SADADialog
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        size="default"
        title={
          <div className="flex items-center gap-2.5 text-rose-500">
            <Trash2 className="size-5" />
            <span>{isAr ? "حذف الحساب بشكل آمن" : "Safe Account Deletion"}</span>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2 w-full">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={deleting}
              disabled={deleting || confirmDeleteText !== account.email || analyzingDeps || dependencies?.has_business_dependencies === true}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
            >
              <span>{isAr ? "حذف نهائي" : "Permanently Delete"}</span>
            </SADAButton>
          </div>
        }
      >
        {analyzingDeps ? (
          <div className="py-8 text-center text-xs text-muted-foreground font-mono">
            <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
            {isAr ? "جاري فحص ارتباطات المهام والمشاريع والمالية..." : "Analyzing task, project, and financial dependencies..."}
          </div>
        ) : dependencies ? (
          <div className="space-y-3.5 text-xs text-start">
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
              <div className="font-semibold text-foreground">{isAr ? "تقرير فحص الارتباطات:" : "Dependency Audit Report:"}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="size-3 text-primary" />
                  <span>{isAr ? "المهام المسندة: " : "Assigned Tasks: "}<strong>{dependencies.assigned_tasks}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Briefcase className="size-3 text-primary" />
                  <span>{isAr ? "المشاريع المدارة: " : "Projects Led: "}<strong>{dependencies.lead_projects_count}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="size-3 text-emerald-500" />
                  <span>{isAr ? "سجلات الرواتب: " : "Salary Records: "}<strong>{dependencies.salary_records_count}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="size-3 text-emerald-500" />
                  <span>{isAr ? "دفعات الرواتب: " : "Salary Payouts: "}<strong>{dependencies.salary_payments_count}</strong></span>
                </div>
                {(dependencies.sales_commissions_count ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                    <DollarSign className="size-3 text-amber-500" />
                    <span>{isAr ? "عمولات المبيعات: " : "Sales Commissions: "}<strong>{dependencies.sales_commissions_count}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {dependencies.has_financial_dependencies ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                  {isAr ? "الحذف النهائي محظور (سجلات مالية ورواتب محمية):" : "Permanent Deletion Blocked (Protected Financial Records):"}
                </span>
                <p className="leading-relaxed">
                  {isAr
                    ? `يرتبط هذا الحساب بسجلات تعويضات أو عمولات محمية (${dependencies.salary_records_count} سجل راتب، ${dependencies.salary_payments_count} دفعة، ${dependencies.sales_commissions_count || 0} عمولة). الحذف النهائي محظور لحفظ السجلات المحاسبية. يرجى تعليق الحساب بدلاً من حذفه لمنع تسجيل الدخول بأمان.`
                    : `This account is linked to protected compensation or commission records (${dependencies.salary_records_count} salary records, ${dependencies.salary_payments_count} payouts, ${dependencies.sales_commissions_count || 0} commissions). Permanent deletion is blocked to preserve financial history. Please suspend the account instead to safely revoke access.`}
                </p>
              </div>
            ) : dependencies.has_business_dependencies ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                  {isAr ? "الحذف النهائي محظور (ارتباطات تشغيلية نشطة):" : "Permanent Deletion Blocked (Active Operational Dependencies):"}
                </span>
                <p className="leading-relaxed">
                  {isAr
                    ? `يمتلك هذا الحساب مهام مسندة (${dependencies.assigned_tasks} مهمة) أو مشاريع تحت إدارته (${dependencies.lead_projects_count} مشروع). يجب إعادة إسناد المهام والمشاريع أولاً قبل حذف الحساب.`
                    : `This account has assigned tasks (${dependencies.assigned_tasks}) or led projects (${dependencies.lead_projects_count}). Reassign all operational responsibilities before permanently deleting.`}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                <span className="font-bold block mb-1">
                  {isAr ? "حساب مؤهل للحذف النهائي الآمن:" : "Eligible for Safe Permanent Deletion:"}
                </span>
                {isAr
                  ? "لم يتم العثور على أي ارتباطات مالية أو مهام تشغيلية. سيتم حذف حساب المصادقة والملف الشخصي نهائياً من auth.users، مع الحفاظ على سجلات التدقيق التاريخية وفق سياسة الأمان."
                  : "No protected financial or operational dependencies detected. The authentication credentials and profiles will be permanently removed from auth.users, while historical audit logs remain safely intact."}
              </div>
            )}

            {!dependencies.has_business_dependencies && (
              <div className="pt-2 space-y-2">
                <label className="block text-[11px] font-mono uppercase text-muted-foreground">
                  {isAr ? (
                    <>
                      لتأكيد الحذف، اكتب <strong className="text-foreground font-mono" dir="ltr">{account.email}</strong> أدناه:
                    </>
                  ) : (
                    <>
                      To confirm deletion, type <strong className="text-foreground font-mono">{account.email}</strong> below:
                    </>
                  )}
                </label>
                <SADAInput
                  type="text"
                  dir="ltr"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder={account.email}
                  className="w-full text-xs font-mono text-foreground text-start"
                />
              </div>
            )}
          </div>
        ) : null}
      </SADADialog>
    </div>
  );
}
