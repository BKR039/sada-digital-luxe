import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { useI18n } from "@/i18n";
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Check,
} from "lucide-react";
import { updateUserPassword } from "@/lib/auth-recovery-service";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type RecoveryState = "verifying" | "ready" | "updating" | "success" | "invalid";

function ResetPasswordPage() {
  const nav = useNavigate();
  const { language } = useI18n();
  const isAr = language === "ar";

  const [state, setState] = useState<RecoveryState>("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Verify recovery session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      // 1. Listen for Supabase PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMounted) return;

          console.log("[ResetPasswordPage] Auth state event:", event);

          if (event === "PASSWORD_RECOVERY") {
            setState("ready");
          } else if (session) {
            setState("ready");
          }
        }
      );

      // 2. Check if a session already exists
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        console.error("[ResetPasswordPage] Get session error:", error);
        setState("invalid");
        setErrorMessage(
          isAr
            ? "تعذر التحقق من رابط الاستعادة. قد يكون الرابط قد انتهت صلاحيته."
            : "Could not verify recovery link. The link may have expired."
        );
        return;
      }

      // Check URL hash or query for recovery indicators
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const search = typeof window !== "undefined" ? window.location.search : "";

      const hasRecoveryToken =
        hash.includes("type=recovery") ||
        hash.includes("access_token=") ||
        search.includes("code=");

      if (session || hasRecoveryToken) {
        setState("ready");
      } else {
        // Allow a 1.5s grace period for Supabase auth client to process the URL fragment
        setTimeout(async () => {
          if (!isMounted) return;
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData?.session) {
            setState("ready");
          } else {
            setState("invalid");
            setErrorMessage(
              isAr
                ? "رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد."
                : "This password recovery link is invalid or has expired. Please request a new link."
            );
          }
        }, 1500);
      }

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    checkRecoverySession();
  }, [isAr]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error(
        isAr
          ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل."
          : "Password must be at least 8 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error(
        isAr ? "كلمتا المرور غير متطابقتين." : "Passwords do not match."
      );
      return;
    }

    setState("updating");

    const result = await updateUserPassword(password, isAr);

    if (!result.success) {
      setState("ready");
      toast.error(result.message);
      return;
    }

    setState("success");
    toast.success(
      isAr
        ? "تم تحديث كلمة المرور بنجاح!"
        : "Password updated successfully!"
    );

    // Sign out the recovery session cleanly
    await supabase.auth.signOut();

    // Redirect to login after 2 seconds
    setTimeout(() => {
      nav({ to: "/auth" });
    }, 2000);
  };

  const hasMinLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);

  return (
    <div className="min-h-screen grid place-items-center px-4 grid-bg">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 cyan-glow border border-border/80 soft-shadow">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>

        {/* 1. STATE: VERIFYING */}
        {state === "verifying" && (
          <div className="mt-8 text-center space-y-4 py-8">
            <Loader2 className="size-10 text-primary animate-spin mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold font-display text-foreground">
                {isAr ? "جاري التحقق من رابط الاستعادة..." : "Verifying recovery link..."}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "يتم التحقق من صحة جلسة الأمان المشفرة."
                  : "Establishing secure recovery session with Supabase Auth."}
              </p>
            </div>
          </div>
        )}

        {/* 2. STATE: INVALID OR EXPIRED LINK */}
        {state === "invalid" && (
          <div className="mt-6 space-y-4 text-center">
            <div className="size-12 rounded-full bg-rose-500/10 border border-rose-500/20 grid place-items-center mx-auto text-rose-500">
              <AlertTriangle className="size-6" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold font-display text-foreground">
                {isAr ? "رابط الاستعادة غير صالح" : "Recovery Link Expired"}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage ||
                  (isAr
                    ? "انتهت صلاحية هذا الرابط أو تم استخدامه مسبقاً. روابط استعادة كلمة المرور صالحة للاستخدام مرة واحدة فقط."
                    : "This recovery link is invalid or has already been used. Password reset links are strictly single-use.")}
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-3 rounded-xl text-xs font-bold transition-all"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
                <span>{isAr ? "طلب رابط استعادة جديد" : "Request a New Recovery Link"}</span>
              </Link>
            </div>
          </div>
        )}

        {/* 3. STATE: READY TO RESET PASSWORD */}
        {(state === "ready" || state === "updating") && (
          <>
            <div className="mt-6 space-y-1">
              <div className="flex items-center gap-2 text-primary text-xs font-mono font-semibold uppercase tracking-wider">
                <KeyRound className="size-4" />
                <span>{isAr ? "إعادة تعيين كلمة المرور" : "Set New Password"}</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {isAr ? "إنشاء كلمة مرور جديدة" : "Create New Password"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "اختر كلمة مرور قوية لتأمين حسابك في نظام SADA."
                  : "Choose a strong password to protect your SADA OS account."}
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "كلمة المرور الجديدة" : "New Password"}
                </label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    minLength={8}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3 pe-11 text-start text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "تأكيد كلمة المرور" : "Confirm Password"}
                </label>
                <div className="relative">
                  <input
                    required
                    type={showConfirm ? "text" : "password"}
                    dir="ltr"
                    minLength={8}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3 pe-11 text-start text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5 text-[11px]">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                  {isAr ? "متطلبات الأمان:" : "Security Requirements:"}
                </span>
                <div className="grid grid-cols-1 gap-1">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                    <Check className={`size-3 ${hasMinLength ? "opacity-100" : "opacity-40"}`} />
                    <span>{isAr ? "8 أحرف على الأقل" : "At least 8 characters"}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasMixedCase ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                    <Check className={`size-3 ${hasMixedCase ? "opacity-100" : "opacity-40"}`} />
                    <span>{isAr ? "أحرف كبيرة وصغيرة (A-Z, a-z)" : "Upper & lowercase letters"}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumbers ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                    <Check className={`size-3 ${hasNumbers ? "opacity-100" : "opacity-40"}`} />
                    <span>{isAr ? "رقم واحد على الأقل (0-9)" : "At least one number"}</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={state === "updating" || !hasMinLength}
                className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-semibold neon-glow disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {state === "updating" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{isAr ? "جاري تحديث كلمة المرور..." : "Updating Password..."}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    <span>{isAr ? "حفظ كلمة المرور الجديدة" : "Save New Password"}</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* 4. STATE: SUCCESS */}
        {state === "success" && (
          <div className="mt-8 text-center space-y-4 py-4">
            <div className="size-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 grid place-items-center mx-auto text-emerald-500 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold font-display text-foreground">
                {isAr ? "تم تحديث كلمة المرور!" : "Password Updated!"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isAr
                  ? "تم حفظ كلمة المرور الجديدة بنجاح. جاري تحويلك إلى صفحة تسجيل الدخول..."
                  : "Your new password has been saved securely. Redirecting to sign in..."}
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-105 transition-all shadow-md"
              >
                <span>{isAr ? "تسجيل الدخول الآن" : "Sign In Now"}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 pt-5 border-t border-border/50 text-center">
          <Link
            to="/auth"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            <span>{isAr ? "العودة إلى تسجيل الدخول" : "Back to Sign In"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
