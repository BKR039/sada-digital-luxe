import { useState, useEffect } from "react";
import {
  AccountRecord,
  resetAccountPassword,
  changeOwnPassword,
  generateSecurePassword,
} from "@/lib/account-service";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Clock,
  ShieldAlert,
  Info,
  CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { SADAButton } from "@/components/ui/sada-button";
import { SADADialog } from "@/components/ui/sada-dialog";

interface AccountSecurityPanelProps {
  account: AccountRecord;
  isSelf: boolean;
  onSecurityUpdated: () => void;
}

export function AccountSecurityPanel({
  account,
  isSelf,
  onSecurityUpdated,
}: AccountSecurityPanelProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  // Password visibility & tracking
  const [activePassword, setActivePassword] = useState<string | null>(account.current_password || null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Self Password Change Form (optional standard flow)
  const [selfMode, setSelfMode] = useState<"direct" | "verify">("direct");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSelfNew, setShowSelfNew] = useState(false);

  // Super Admin Password Management Form for Target Account
  const [adminResetPass, setAdminResetPass] = useState("");
  const [showAdminResetPass, setShowAdminResetPass] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [revealedPass, setRevealedPass] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Loading and Error states
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if account changes
  useEffect(() => {
    setActivePassword(account.current_password || null);
  }, [account.current_password, account.user_id]);

  // Handle Copy Credentials
  const handleCopyCredentials = async (passToCopy: string) => {
    const text = `بيانات اعتماد صدى / SADA Credentials\nالاسم / Name: ${account.display_name}\nالبريد الإلكتروني / Email: ${account.email}\nكلمة المرور / Password: ${passToCopy}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(isAr ? "تم نسخ بيانات الاعتماد إلى الحافظة" : "Credentials copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  // Handle Self Password Change with Verification
  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError(isAr ? "يرجى إدخال كلمة المرور الحالية." : "Please provide your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setError(isAr ? "يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل." : "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isAr ? "كلمتا المرور غير متطابقتين." : "New passwords do not match.");
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setActivePassword(newPassword);
      toast.success(isAr ? "تم تحديث كلمة المرور الخاصة بك بنجاح." : "Your password has been successfully updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSecurityUpdated();
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل تحديث كلمة المرور." : "Failed to update password."));
    } finally {
      setUpdating(false);
    }
  };

  // Open confirmation modal after validating admin password input
  const handleRequestAdminPasswordChange = () => {
    if (!adminResetPass || adminResetPass.length < 8) {
      setError(isAr ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل." : "Password must be at least 8 characters long.");
      return;
    }
    setError(null);
    setShowConfirmModal(true);
  };

  // Execute confirmed Super Admin password change
  const handleExecuteAdminPasswordChange = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await resetAccountPassword(account.user_id, adminResetPass);
      const updatedPass = res?.current_password || adminResetPass;
      setActivePassword(updatedPass);
      setRevealedPass(updatedPass);
      setShowCurrentPassword(true);
      setShowConfirmModal(false);
      toast.success(
        isAr
          ? "تم تحديث وحفظ كلمة مرور الحساب وربطها بنظام Supabase Auth بنجاح."
          : "Account password updated and synchronized with Supabase Auth successfully."
      );
      onSecurityUpdated();
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل تحديث كلمة مرور الحساب." : "Failed to update account password."));
    } finally {
      setUpdating(false);
    }
  };

  // Generate secure password on demand
  const handleGeneratePassword = () => {
    const generated = generateSecurePassword(16);
    setAdminResetPass(generated);
    setShowAdminResetPass(true);
    setError(null);
    toast.success(isAr ? "تم توليد كلمة مرور آمنة ومشفرة" : "Generated cryptographically secure password");
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-muted-foreground">
            <Clock className="size-3" />
            <span>{isAr ? "آخر تسجيل دخول" : "Last Sign In"}</span>
          </div>
          <div className="mt-1 font-semibold text-xs text-foreground font-mono" dir="ltr">
            {account.last_sign_in_at
              ? format(parseISO(account.last_sign_in_at), "yyyy-MM-dd HH:mm:ss 'UTC'")
              : (isAr ? "لم يسجل الدخول مطلقاً" : "Never logged in")}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-muted-foreground">
            <ShieldCheck className="size-3" />
            <span>{isAr ? "حالة أمان الحساب" : "Account Security Status"}</span>
          </div>
          <div className="mt-1 font-semibold text-xs text-foreground flex items-center gap-1.5">
            {account.status === "suspended" ? (
              <span className="text-rose-500 flex items-center gap-1">
                <ShieldAlert className="size-3.5" />
                {isAr ? "الوصول معلق (محظور تسجيل الدخول)" : "Access Suspended (Login Banned)"}
              </span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1">
                <ShieldCheck className="size-3.5" />
                {isAr ? "نشط ومفعل" : "Active & Enforced"}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* SECTION 1: Authoritative Current Password Display */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3.5 text-start">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h4 className="font-display font-bold text-sm text-foreground">
              {isAr ? "كلمة المرور الحالية المعتمدة" : "Authoritative Current Password"}
            </h4>
          </div>
          <span className="text-[10px] font-mono text-emerald-500 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="size-3" />
            <span>{isAr ? "متصل بـ Supabase Auth" : "Supabase Auth Synced"}</span>
          </span>
        </div>

        {activePassword ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/80 font-mono text-xs">
              <span className="font-bold text-foreground tracking-wider select-all text-sm" dir="ltr">
                {showCurrentPassword ? activePassword : "••••••••••••••••"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                  title={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <SADAButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCredentials(activePassword)}
                  className="px-2.5 py-1.5 h-auto text-primary hover:bg-muted flex items-center gap-1.5 text-xs font-semibold rounded-lg"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  <span>{copied ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ البيانات" : "Copy Credentials")}</span>
                </SADAButton>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isAr
                ? "كلمة المرور هذه هي كلمة المرور الرسمية المخزنة للحساب، وهي متصلة بنظام Supabase Auth وتتيح الدخول من أي جهاز آخر."
                : "This credential is authenticated against Supabase Auth. Use it to sign in directly to SADA OS from any device."}
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2.5">
            <Info className="size-4 shrink-0" />
            <div className="space-y-0.5">
              <div className="font-semibold">
                {isAr ? "لا توجد كلمة مرور مسجلة بعد في الخزينة" : "No saved password record on file"}
              </div>
              <div className="text-[11px] opacity-90">
                {isAr
                  ? "قم بتعيين كلمة مرور جديدة أدناه لحفظها ومزامنتها مباشرة مع Supabase Auth."
                  : "Set a new password below to record and activate it immediately in Supabase Auth."}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Set New Password Form */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4 text-start">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h4 className="font-display font-bold text-sm text-foreground">
              {isAr ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </h4>
          </div>
          {isSelf && (
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => setSelfMode("direct")}
                className={`px-2 py-0.5 rounded-md font-medium cursor-pointer ${
                  selfMode === "direct" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                {isAr ? "تعيين إداري فوري" : "Admin Direct"}
              </button>
              <button
                type="button"
                onClick={() => setSelfMode("verify")}
                className={`px-2 py-0.5 rounded-md font-medium cursor-pointer ${
                  selfMode === "verify" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                {isAr ? "التحقق من الحالية" : "Verify Current"}
              </button>
            </div>
          )}
        </div>

        {isSelf && selfMode === "verify" ? (
          // Self Password Change Form (Verify current)
          <form onSubmit={handleSelfPasswordChange} className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                {isAr ? "كلمة المرور الحالية *" : "Current Password *"}
              </label>
              <input
                required
                type="password"
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-start"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "كلمة المرور الجديدة *" : "New Password *"}
                </label>
                <div className="relative">
                  <input
                    required
                    type={showSelfNew ? "text" : "password"}
                    dir="ltr"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={isAr ? "8 أحرف على الأقل" : "Min 8 characters"}
                    className="w-full pe-8 ps-3 py-2 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-start"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfNew(!showSelfNew)}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showSelfNew ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "تأكيد كلمة المرور الجديدة *" : "Confirm New Password *"}
                </label>
                <input
                  required
                  type="password"
                  dir="ltr"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={isAr ? "أعد إدخال كلمة المرور" : "Repeat new password"}
                  className="w-full px-3 py-2 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-start"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <SADAButton
                type="submit"
                variant="primary"
                disabled={updating}
                className="text-xs px-4 py-2 rounded-xl flex items-center gap-2"
              >
                {updating && <Loader2 className="size-3.5 animate-spin" />}
                <span>{isAr ? "تحديث كلمة المرور" : "Update Password"}</span>
              </SADAButton>
            </div>
          </form>
        ) : (
          // Super Admin Direct Set Password (for target user or self direct reset)
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAr ? (
                <>
                  تعيين كلمة مرور محددة ودائمة لـ <strong>{account.display_name}</strong> (<span dir="ltr">{account.email}</span>). يتم حفظ وتشفير كلمة المرور في Supabase Auth وخزينة الأمان، وتبقى نشطة بشكل دائم حتى يتم تغييرها مجدداً.
                </>
              ) : (
                <>
                  Set a specific persistent password for <strong>{account.display_name}</strong> ({account.email}). This password is synchronized directly with Supabase Auth and saved in the credentials vault for complete visibility and reliability.
                </>
              )}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {isAr ? "كلمة المرور الجديدة للحساب" : "New Account Password"}
                </label>
                <SADAButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePassword}
                  className="text-xs text-primary hover:underline flex items-center gap-1 h-auto p-0 cursor-pointer"
                >
                  <Sparkles className="size-3" />
                  <span>{isAr ? "توليد كلمة مرور آمنة" : "Generate Secure Password"}</span>
                </SADAButton>
              </div>

              <div className="relative">
                <input
                  type={showAdminResetPass ? "text" : "password"}
                  dir="ltr"
                  value={adminResetPass}
                  onChange={(e) => {
                    setAdminResetPass(e.target.value);
                    setError(null);
                  }}
                  placeholder={isAr ? "أدخل كلمة مرور محددة أو اضغط توليد" : "Enter a specific password or generate one"}
                  className="w-full pe-9 ps-3 py-2 rounded-xl glass border border-border/80 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminResetPass(!showAdminResetPass)}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title={showAdminResetPass ? "Hide" : "Show"}
                >
                  {showAdminResetPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className={adminResetPass.length >= 8 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                  {isAr ? "الحد الأدنى 8 أحرف" : "Minimum 8 characters"} ({adminResetPass.length}/8)
                </span>
                <span className="font-mono text-[10px]">
                  {isAr ? "مزامنة فورية مع Supabase Auth" : "Instant Supabase Auth Sync"}
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <SADAButton
                  type="button"
                  variant="primary"
                  onClick={handleRequestAdminPasswordChange}
                  disabled={updating || adminResetPass.length < 8}
                  className="text-xs px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  {updating && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{isAr ? "تعيين وحفظ كلمة المرور" : "Set & Save Account Password"}</span>
                </SADAButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <SADADialog
        open={showConfirmModal}
        onOpenChange={(open) => {
          if (!open && !updating) setShowConfirmModal(false);
        }}
        size="compact"
        title={isAr ? "تأكيد تعيين كلمة مرور الحساب" : "Confirm Password Change"}
      >
        <div className="space-y-4 text-start">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{isAr ? "يرجى مراجعة وتأكيد كلمة المرور الجديدة" : "Please review and confirm new password"}</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {isAr
                ? "ستصبح كلمة المرور هذه هي كلمة المرور الدائمة للحساب في Supabase Auth وسيتم حفظها في خزينة بيانات الاعتماد لتتمكن من مراجعتها في أي وقت."
                : "This will become the user's permanent credential in Supabase Auth and will be recorded in the credentials vault for anytime access."}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border space-y-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block">{isAr ? "المستخدم:" : "Target User:"}</span>
              <span className="font-semibold text-foreground">{account.display_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
              <span className="text-foreground" dir="ltr">{account.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block">{isAr ? "كلمة المرور الجديدة:" : "New Password:"}</span>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted border border-border mt-0.5">
                <span className="text-foreground font-bold tracking-wider" dir="ltr">
                  {showAdminResetPass ? adminResetPass : "••••••••••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAdminResetPass(!showAdminResetPass)}
                  className="text-xs text-primary hover:underline ms-2 cursor-pointer"
                >
                  {showAdminResetPass ? (isAr ? "إخفاء" : "Hide") : (isAr ? "إظهار" : "Show")}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <SADAButton
              type="button"
              variant="outline"
              disabled={updating}
              onClick={() => setShowConfirmModal(false)}
              className="text-xs px-3 py-1.5 rounded-xl cursor-pointer"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              disabled={updating}
              onClick={handleExecuteAdminPasswordChange}
              className="text-xs px-4 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              {updating && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isAr ? "تأكيد وتطبيق كلمة المرور" : "Confirm & Apply Password"}</span>
            </SADAButton>
          </div>
        </div>
      </SADADialog>
    </div>
  );
}
