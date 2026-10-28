import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert, Lock, Home, CheckCircle2, Wallet, LogOut, Compass } from "lucide-react";
import {
  SADAButton,
  SADABadge,
  SADACard,
  SADACardContent,
  SADACardHeader,
} from "@/components/ui/sada-ui";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { SADA_MODULES, type SadaModule } from "@/types/permissions";

interface ModuleAccessShieldProps {
  module: SadaModule;
  customMessage?: string;
  errorCode?: string;
  targetPath?: string;
}

export function ModuleAccessShield({
  module,
  customMessage,
  errorCode = "UNAUTHORIZED_ROUTE",
  targetPath,
}: ModuleAccessShieldProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const nav = useNavigate();
  const { canAccessModule, signOut } = useAuth();

  const meta = SADA_MODULES.find((m) => m.key === module);
  const moduleTitle = isAr ? (meta?.labelAr || module) : (meta?.label || module);

  // Intelligently compute accessible fallback navigation to completely avoid redirect loops
  const canGoDashboard = canAccessModule("dashboard");
  const canGoTasks = canAccessModule("tasks");
  const canGoSalary = canAccessModule("compensation");

  const isRateLimited = errorCode === "RATE_LIMIT_EXCEEDED";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <SADACard className="max-w-md w-full border-rose-500/30 text-center shadow-xl space-y-4 animate-in fade-in-50 duration-200">
        <SADACardHeader className="pb-2">
          <div className="size-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 grid place-items-center mx-auto border border-rose-500/20 shadow-inner mb-3">
            <ShieldAlert className="size-8" />
          </div>

          <div className="flex justify-center mb-1">
            <SADABadge variant={isRateLimited ? "warning" : "danger"} className="text-[11px] font-mono font-medium gap-1 px-3 py-0.5">
              <Lock className="size-3" />
              <span>
                {isRateLimited
                  ? (isAr ? "تم تجاوز معدل الطلبات" : "Rate Limit Exceeded")
                  : (isAr ? "الوصول غير مصرح به" : "Access Prohibited")}
              </span>
            </SADABadge>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
            {isRateLimited
              ? (isAr ? "تم تقييد العمليات مؤقتاً" : "Action Temporarily Rate-Limited")
              : (isAr ? `قسم ${moduleTitle} مقيد` : `${moduleTitle} is Restricted`)}
          </h2>
        </SADACardHeader>

        <SADACardContent className="space-y-5">
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {customMessage ||
              (isRateLimited
                ? (isAr
                    ? "تم رصد محاولات متكررة في فترة وجيزة لحماية استقرار المنظومة. يرجى الانتظار دقيقة واحدة ثم إعادة المحاولة."
                    : "High-frequency operations were detected. Rate limiting is active to safeguard system integrity. Please wait a moment before retrying.")
                : (isAr
                    ? "تم تعطيل هذا القسم لحسابك من قبل المشرف المتميز (Super Admin). يتم عزل هذا المسار والبيانات التابعة له لحماية خصوصية وسياسات المنظومة."
                    : "This module has been explicitly disabled for your account by the Super Admin. Direct route access, data querying, and interaction are prohibited."))}
          </p>

          {/* Safe Action Targets (Loop-Proof) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 flex-wrap">
            {canGoDashboard && (
              <SADAButton
                variant="primary"
                size="sm"
                onClick={() => nav({ to: "/admin" })}
                className="w-full sm:w-auto cursor-pointer"
              >
                <Home className="size-3.5 me-1.5" />
                <span>{isAr ? "العودة للوحة التحكم" : "Return to Dashboard"}</span>
              </SADAButton>
            )}

            {canGoTasks && (
              <SADAButton
                variant={canGoDashboard ? "outline" : "primary"}
                size="sm"
                onClick={() => nav({ to: "/admin/my-work" as any })}
                className="w-full sm:w-auto cursor-pointer"
              >
                <CheckCircle2 className="size-3.5 me-1.5" />
                <span>{isAr ? "مركز مهامي اليومية" : "My Work Center"}</span>
              </SADAButton>
            )}

            {!canGoDashboard && !canGoTasks && canGoSalary && (
              <SADAButton
                variant="primary"
                size="sm"
                onClick={() => nav({ to: "/admin/my-salary" as any })}
                className="w-full sm:w-auto cursor-pointer"
              >
                <Wallet className="size-3.5 me-1.5" />
                <span>{isAr ? "مستحقاتي المالية" : "My Salary"}</span>
              </SADAButton>
            )}

            <SADAButton
              variant="outline"
              size="sm"
              onClick={() => nav({ to: "/sada-os" })}
              className="w-full sm:w-auto cursor-pointer text-xs"
            >
              <Compass className="size-3.5 me-1.5" />
              <span>{isAr ? "بوابة النظام" : "Launchpad"}</span>
            </SADAButton>

            <SADAButton
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="w-full sm:w-auto cursor-pointer text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-3.5 me-1.5" />
              <span>{isAr ? "تسجيل خروج" : "Sign Out"}</span>
            </SADAButton>
          </div>

          <div className="pt-3 border-t border-border/50 flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-mono text-muted-foreground/70" dir="ltr">
              Policy Code: SADA_PERM_ENFORCE_{module.toUpperCase()} ({errorCode})
            </span>
            {targetPath && (
              <span className="text-[9px] font-mono text-muted-foreground/50 truncate max-w-xs" dir="ltr">
                Target: {targetPath}
              </span>
            )}
          </div>
        </SADACardContent>
      </SADACard>
    </div>
  );
}
