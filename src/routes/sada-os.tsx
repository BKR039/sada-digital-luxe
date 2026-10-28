import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/i18n";
import {
  SADAButton,
  SADABadge,
  SADACard,
  SADACardHeader,
  SADACardTitle,
  SADACardDescription,
  SADACardContent,
  ExecutiveDashboardSkeleton,
} from "@/components/ui/sada-ui";
import {
  evaluateRouteAccess,
  type AuthoritativeSecurityContext,
  type SecurityErrorCode,
  getRoleBadgeStyle,
} from "@/lib/permissions";
import { SADA_MODULES, type SadaModule } from "@/types/permissions";
import { ModuleAccessShield } from "@/components/admin/ModuleAccessShield";
import { Logo } from "@/components/site/Logo";
import {
  LayoutDashboard,
  Building2,
  CheckCircle2,
  CalendarDays,
  Briefcase,
  Users,
  Target,
  Landmark,
  Wallet,
  Package,
  BarChart3,
  FolderKanban,
  MessageSquare,
  Workflow,
  Sliders,
  Shield,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Lock,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/sada-os")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const hasAuthToken = Object.keys(localStorage).some(
        (key) => (key.startsWith("sb-") && key.endsWith("-auth-token")) || key === "supabase.auth.token"
      );
      if (!hasAuthToken) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: SadaOsGate,
});

const MODULE_ICONS: Record<SadaModule, any> = {
  dashboard: LayoutDashboard,
  clients: Building2,
  tasks: CheckCircle2,
  calendar: CalendarDays,
  workspaces: Briefcase,
  team: Users,
  sales: Target,
  finance: Landmark,
  compensation: Wallet,
  packages: Package,
  analytics: BarChart3,
  content_cms: FolderKanban,
  inquiries: MessageSquare,
  workflows: Workflow,
  business_rules: Sliders,
  accounts: Shield,
};

function SadaOsGate() {
  const { user, role, isSuperAdmin, isWorker, loading, signOut, canAccessModule, teamMember } = useAuth();
  const { theme } = useTheme();
  const { language, isRTL, t } = useTranslation();
  const isAr = language === "ar";
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/auth" });
    }
  }, [user, loading, nav]);

  // Build Security Context
  const securityCtx = useMemo((): AuthoritativeSecurityContext | null => {
    if (!user) return null;
    const effectiveMap = {} as Record<SadaModule, boolean>;
    for (const m of SADA_MODULES) {
      effectiveMap[m.key] = canAccessModule(m.key);
    }
    return {
      authenticated: true,
      userId: user.id,
      email: user.email || "",
      role: role || "worker",
      status: "active",
      effectivePermissions: effectiveMap,
    };
  }, [user, role, canAccessModule]);

  // Evaluate entry access
  const routeEvaluation = useMemo(() => {
    if (!securityCtx) {
      return {
        allowed: false,
        code: "UNAUTHENTICATED" as SecurityErrorCode,
        reason: "Session authentication required to access SADA OS.",
        module: null,
        targetPath: "/sada-os",
      };
    }
    return evaluateRouteAccess("/sada-os", securityCtx);
  }, [securityCtx]);

  if (loading) {
    return <ExecutiveDashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  // Suspended or unauthorized account handling
  if (!routeEvaluation.allowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 p-4">
        <ModuleAccessShield
          module="dashboard"
          customMessage={
            routeEvaluation.reason ||
            (isAr
              ? "غير مصرح لك بالدخول إلى بيئة تشغيل SADA OS."
              : "Access to SADA OS entry gate is unauthorized for this account.")
          }
        />
      </div>
    );
  }

  // Filter accessible modules for the user
  const permittedModules = SADA_MODULES.filter((m) => {
    if (m.key === "accounts" && !isSuperAdmin) return false;
    if (m.key === "business_rules" && !isSuperAdmin) return false;
    if (m.key === "workflows" && !isSuperAdmin) return false;
    if (m.key === "compensation" && isSuperAdmin) return false;
    return canAccessModule(m.key);
  });

  const roleMeta = getRoleBadgeStyle(role || "worker");

  // Determine default target route
  const defaultLaunchRoute = isWorker && !canAccessModule("dashboard") && canAccessModule("tasks")
    ? "/admin/my-work"
    : "/admin";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Bar */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo forceDark={true} />
            <span className="hidden sm:inline-block text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              OPERATING SYSTEM v4.1
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${roleMeta.dotColor}`} />
              <span className="text-xs font-medium text-slate-300 hidden sm:inline">
                {user.email}
              </span>
              <SADABadge variant="outline" className={`${roleMeta.badgeClass} text-xs font-mono`}>
                {roleMeta.label}
              </SADABadge>
            </div>

            <SADAButton
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="text-xs text-slate-400 hover:text-white border-white/10 hover:bg-white/5 cursor-pointer"
            >
              <LogOut className="size-3.5 me-1.5" />
              <span>{isAr ? "تسجيل خروج" : "Sign Out"}</span>
            </SADAButton>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-between">
        <div className="space-y-8">
          {/* Welcome Banner */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 end-0 size-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
                  <ShieldCheck className="size-4" />
                  <span>{isAr ? "مصادقة أمنية معتمدة" : "Verified Security Clearance"}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-white">
                  {isAr ? "بيئة تشغيل صدى الرقمية" : "SADA Work OS Environment"}
                </h1>
                <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                  {isAr
                    ? "بوابة الدخول المحمية لإدارة العمليات والإنتاج والمهام والتقويم المالي."
                    : "Authoritative protected portal for operational execution, production, scheduling, and agency oversight."}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <SADAButton
                  variant="primary"
                  size="default"
                  onClick={() => nav({ to: defaultLaunchRoute as any })}
                  className="cursor-pointer neon-glow font-display"
                >
                  <span>{isAr ? "فتح مساحة العمل الكاملة" : "Enter Work OS"}</span>
                  <ArrowRight className="size-4 ms-2 rtl-flip" />
                </SADAButton>
              </div>
            </div>
          </div>

          {/* Module Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">
                {isAr ? "الوحدات والأنظمة المصرح بها" : "Authorized Modules & Workspaces"}
              </h2>
              <span className="text-xs font-mono text-slate-500">
                {permittedModules.length} {isAr ? "وحدة مفعلة" : "active"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {permittedModules.map((m) => {
                const Icon = MODULE_ICONS[m.key] || LayoutDashboard;
                const title = isAr ? m.labelAr : m.label;
                const desc = isAr ? m.descriptionAr : m.description;

                return (
                  <Link
                    key={m.key}
                    to={m.path as any}
                    className="group block p-5 rounded-2xl bg-slate-900/40 hover:bg-slate-900/90 border border-white/5 hover:border-cyan-500/30 transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow-cyan-500/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="size-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 grid place-items-center group-hover:bg-cyan-500/20 transition-colors">
                        <Icon className="size-5" />
                      </div>
                      <ExternalLink className="size-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors rtl-flip" />
                    </div>

                    <div className="mt-4 space-y-1">
                      <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors font-display">
                        {title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {desc}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{m.path}</span>
                      <span className="text-cyan-400/80 group-hover:text-cyan-300">
                        {isAr ? "دخول ↗" : "Open ↗"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            <span>SADA OS PROTECTED RUNTIME</span>
            <span className="mx-2">•</span>
            <span>RLS + RBAC ACTIVE</span>
          </div>
          <div dir="ltr">
            © {new Date().getFullYear()} SADA Agency. All rights reserved.
          </div>
        </footer>
      </main>
    </div>
  );
}
