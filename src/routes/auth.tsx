import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { useI18n } from "@/i18n";
import { ShieldCheck, KeyRound, ArrowLeft, Loader2, Mail, AlertTriangle } from "lucide-react";
import { requestPasswordRecovery } from "@/lib/auth-recovery-service";

export const Route = createFileRoute("/auth")({
  component: Auth,
});

function Auth() {
  const { signIn, user } = useAuth();
  const nav = useNavigate();
  const { language } = useI18n();
  const isAr = language === "ar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [forgotFeedback, setForgotFeedback] = useState("");

  useEffect(() => {
    // Intercept password recovery tokens specifically without hijacking normal session tokens or codes
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const isRecovery =
        hash.includes("type=recovery") ||
        search.includes("type=recovery") ||
        (search.includes("code=") && search.includes("recovery"));

      if (isRecovery) {
        nav({ to: "/reset-password" });
        return;
      }
    }

    if (user) nav({ to: "/admin" });
  }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate login submissions while request is running
    setLoading(true);

    try {
      const res = await signIn(email, password);
      if (!res.success || res.error) {
        const errorMsg = res.errorMessage || (res.error ? res.error.message : "Invalid login credentials.");
        toast.error(errorMsg);
      } else {
        toast.success(isAr ? "مرحباً بعودتك" : "Welcome back");
        nav({ to: "/admin" });
      }
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "فشل تسجيل الدخول." : "Authentication failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatus("loading");
    setForgotFeedback("");

    const res = await requestPasswordRecovery(email, isAr);

    if (!res.success) {
      setForgotStatus("error");
      setForgotFeedback(res.message);
      toast.error(res.message);
    } else {
      setForgotStatus("success");
      setForgotFeedback(res.message);
      toast.success(
        isAr
          ? "تم إرسال تعليمات الاستعادة. يرجى التحقق من بريدك الإلكتروني."
          : "Recovery email sent. Check your inbox and spam folder."
      );
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 grid-bg">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 cyan-glow border border-border/80 soft-shadow">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>

        {!showForgot ? (
          <>
            <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isAr ? "تسجيل الدخول" : "Sign in to SADA"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isAr ? "وصول الإدارة وفريق العمل الداخلي" : "Authorized administrative & operations portal"}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "البريد الإلكتروني" : "Email Address"}
                </label>
                <input
                  required
                  type="email"
                  dir="ltr"
                  placeholder="name@sada.agency"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full glass rounded-xl px-4 py-3 text-start text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {isAr ? "كلمة المرور" : "Password"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setForgotStatus("idle");
                      setForgotFeedback("");
                    }}
                    className="text-xs text-primary hover:underline transition-all"
                  >
                    {isAr ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                  </button>
                </div>
                <input
                  required
                  type="password"
                  dir="ltr"
                  placeholder="••••••••••••"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass rounded-xl px-4 py-3 text-start text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-semibold neon-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 transition-all cursor-pointer"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                <span>
                  {loading
                    ? isAr
                      ? "جاري التحقق..."
                      : "Signing in..."
                    : isAr
                      ? "تسجيل الدخول"
                      : "Sign In"}
                </span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span>
                  {isAr
                    ? "الحسابات مخصصة فقط ومُنشأة حصرياً من قبل المشرف العام."
                    : "Accounts are provisioned exclusively by the Super Admin."}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setShowForgot(false);
                setForgotStatus("idle");
              }}
              className="mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5 rtl:rotate-180" />
              <span>{isAr ? "العودة لتسجيل الدخول" : "Back to Sign In"}</span>
            </button>

            <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
              {isAr ? "استعادة كلمة المرور" : "Password Recovery"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isAr
                ? "أدخل بريدك الإلكتروني المسجل وسنرسل لك رابط استعادة آمن."
                : "Enter your registered email and we'll send a secure password reset link."}
            </p>

            {forgotStatus === "success" ? (
              <div className="mt-6 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-500 grid place-items-center mx-auto">
                  <Mail className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400 font-display">
                    {isAr ? "تم إرسال بريد الاستعادة" : "Recovery Email Sent"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {forgotFeedback ||
                      (isAr
                        ? "إذا كان الحساب مسجلاً، فقد تم إرسال تعليمات الاستعادة. تحقق من صندوق الوارد ومجلد الرسائل غير المرغوب فيها (Spam)."
                        : "If an account exists for this email, recovery instructions have been sent. Check your inbox and spam folder.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(false);
                    setForgotStatus("idle");
                  }}
                  className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:brightness-105 transition-all"
                >
                  <ArrowLeft className="size-3.5 rtl:rotate-180" />
                  <span>{isAr ? "العودة لتسجيل الدخول" : "Back to Sign In"}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
                {forgotStatus === "error" && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {forgotFeedback ||
                        (isAr
                          ? "تعذر إرسال بريد الاستعادة. يرجى المحاولة مرة أخرى."
                          : "Unable to send recovery email. Please try again.")}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    {isAr ? "البريد الإلكتروني" : "Email Address"}
                  </label>
                  <input
                    required
                    type="email"
                    dir="ltr"
                    placeholder="name@sada.agency"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (forgotStatus === "error") setForgotStatus("idle");
                    }}
                    className="w-full glass rounded-xl px-4 py-3 text-start text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotStatus === "loading"}
                  className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-semibold neon-glow disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  {forgotStatus === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{isAr ? "جاري الإرسال..." : "Sending Link..."}</span>
                    </>
                  ) : (
                    <span>
                      {isAr ? "إرسال رابط الاستعادة" : "Send Recovery Link"}
                    </span>
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
