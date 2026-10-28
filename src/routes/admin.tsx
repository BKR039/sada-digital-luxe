import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/i18n";
import {
  getRoleLabel,
  evaluateRouteAccess,
  type AuthoritativeSecurityContext,
  SADA_MODULES,
} from "@/lib/permissions";
import { resolveModuleFromPath, type SadaModule } from "@/types/permissions";
import { ModuleAccessShield } from "@/components/admin/ModuleAccessShield";
import { Logo } from "@/components/site/Logo";
import {
  LayoutDashboard, FolderKanban, FileText, ShoppingBag, MessageSquare,
  Star, LogOut, ArrowLeft, ArrowRight, Briefcase, CalendarDays, Users, Menu, X, Shield, Building2, Film, CheckCircle2,
  Landmark, Wallet, Sun, Moon, Target, BarChart3, Search, Package, Sliders, Coins, Workflow, Sparkles
} from "lucide-react";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { NotificationProvider } from "@/lib/notification-context";
import { GlobalSearchModal } from "@/components/admin/GlobalSearchModal";
import { SADAMobileBottomNav } from "@/components/admin/SADAMobileBottomNav";
import { PWAInstallBanner } from "@/components/admin/PWAInstallBanner";
import { ExecutiveDashboardSkeleton } from "@/components/ui/sada-ui";

function AdminRouteComponent() {
  return (
    <NotificationProvider>
      <AdminLayout />
    </NotificationProvider>
  );
}

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const hasAuthToken = Object.keys(localStorage).some(
        (key) => (key.startsWith("sb-") && key.endsWith("-auth-token")) || key === "supabase.auth.token"
      );
      if (!hasAuthToken) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: AdminRouteComponent,
});

interface NavItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  Icon: any;
  exact?: boolean;
  workerVisible?: boolean;
  superAdminOnly?: boolean;
  workerOnly?: boolean;
  section: "operations" | "finance" | "content";
  module?: SadaModule;
}

const ALL_NAV_ITEMS: NavItem[] = [
  // OPERATIONS
  { to: "/admin", labelKey: "admin.overview", defaultLabel: "Overview", Icon: LayoutDashboard, exact: true, workerVisible: true, section: "operations", module: "dashboard" },
  { to: "/admin/my-work", labelKey: "admin.myWork", defaultLabel: "My Work", Icon: CheckCircle2, workerVisible: true, section: "operations", module: "tasks" },
  { to: "/admin/client-workspaces", labelKey: "admin.clientWorkspaces", defaultLabel: "Client Workspaces", Icon: Briefcase, workerVisible: true, section: "operations", module: "clients" },
  { to: "/admin/sales", labelKey: "admin.sales", defaultLabel: "Sales Pipeline", Icon: Target, workerVisible: true, section: "operations", module: "sales" },
  { to: "/admin/calendar", labelKey: "admin.calendar", defaultLabel: "Calendar", Icon: CalendarDays, workerVisible: true, section: "operations", module: "calendar" },
  { to: "/admin/team-workload", labelKey: "admin.teamWorkload", defaultLabel: "Team Workload", Icon: Users, workerVisible: false, section: "operations", module: "team" },
  { to: "/admin/packages", labelKey: "admin.packages", defaultLabel: "Package Catalog & Pricing", Icon: Package, workerVisible: false, section: "operations", module: "packages" },
  { to: "/admin/analytics", labelKey: "admin.analytics", defaultLabel: "Analytics & KPIs", Icon: BarChart3, workerVisible: false, section: "operations", module: "analytics" },
  { to: "/admin/accounts", labelKey: "admin.accounts", defaultLabel: "Accounts", Icon: Shield, superAdminOnly: true, section: "operations", module: "accounts" },
  { to: "/admin/business-rules", labelKey: "admin.businessRules", defaultLabel: "Business Rules", Icon: Sliders, superAdminOnly: true, section: "operations", module: "business_rules" },
  { to: "/admin/workflow-templates", labelKey: "admin.workflowTemplates", defaultLabel: "Workflows", Icon: Workflow, superAdminOnly: true, section: "operations", module: "workflows" },
  { to: "/admin/contact", labelKey: "admin.inquiries", defaultLabel: "Inquiries", Icon: MessageSquare, workerVisible: false, section: "operations", module: "inquiries" },

  // FINANCE
  { to: "/admin/my-salary", labelKey: "admin.mySalary", defaultLabel: "My Salary", Icon: Wallet, workerVisible: true, workerOnly: true, section: "finance", module: "compensation" },
  { to: "/admin/finance", labelKey: "admin.finance", defaultLabel: "Finance & Accounting", Icon: Landmark, workerVisible: false, section: "finance", module: "finance" },

  // CONTENT
  { to: "/admin/site-content", labelKey: "admin.siteContent", defaultLabel: "Site Metrics & Partners", Icon: Sparkles, workerVisible: false, section: "content", module: "content_cms" },
  { to: "/admin/projects", labelKey: "admin.caseStudies", defaultLabel: "Case Studies", Icon: FolderKanban, workerVisible: false, section: "content", module: "content_cms" },
  { to: "/admin/reels", labelKey: "admin.reelsCms", defaultLabel: "Reels CMS", Icon: Film, workerVisible: false, section: "content", module: "content_cms" },
  { to: "/admin/blog", labelKey: "admin.blog", defaultLabel: "Blog", Icon: FileText, workerVisible: false, section: "content", module: "content_cms" },
  { to: "/admin/products", labelKey: "admin.products", defaultLabel: "Digital Products", Icon: ShoppingBag, workerVisible: false, section: "content", module: "content_cms" },
  { to: "/admin/testimonials", labelKey: "admin.clientProof", defaultLabel: "Client Proof", Icon: Star, workerVisible: false, section: "content", module: "content_cms" },
];

function AdminLayout() {
  const { user, role, isSuperAdmin, isAdmin, isWorker, loading, signOut, canAccessModule, customModulePermissions } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, isRTL, t } = useTranslation();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/" });
    }
  }, [user, loading, nav]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [path]);

  const navItems = useMemo(() => {
    return ALL_NAV_ITEMS.filter((item) => {
      // 1. Explicit Module & Page Permission filter (User -> Role -> Effective Permissions)
      if (item.module && !canAccessModule(item.module)) return false;
      // Super Admin only routes (Finance)
      if (item.superAdminOnly && !isSuperAdmin) return false;
      // Worker only personal routes (My Salary) - Super admin manages all compensation in Finance
      if (item.workerOnly && isSuperAdmin) return false;
      // Hide non-worker-visible routes for workers unless explicitly authorized via custom module permission
      if (isWorker && !item.workerVisible && (!item.module || !canAccessModule(item.module))) return false;
      return true;
    });
  }, [isWorker, isSuperAdmin, canAccessModule]);

  // Phase 5: Authoritative Route Security Defense (evaluateRouteAccess)
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
      customOverrides: customModulePermissions || undefined,
    };
  }, [user, role, canAccessModule, customModulePermissions]);

  const routeEvaluation = useMemo(() => {
    if (!securityCtx) return { allowed: true, module: null, targetPath: path };
    return evaluateRouteAccess(path, securityCtx);
  }, [path, securityCtx]);

  const isModuleBlocked = !routeEvaluation.allowed;
  const currentModule = routeEvaluation.module || resolveModuleFromPath(path);

  // If auth has finished loading and no user exists, render nothing while redirect fires
  if (!loading && !user) {
    return null;
  }

  if (loading) {
    return <ExecutiveDashboardSkeleton />;
  }

  if (!user) return null;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Team Specialist";

  return (
    <div className="admin-shell bg-gradient-soft">
      {/* Mobile Top Navigation Bar (Logo + Notification Indicator paired) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card/80 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-border/80 px-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="size-9 grid place-items-center rounded-xl bg-muted/40 border border-border/60 text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
            aria-label="Toggle menu"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
          <div className="flex items-center gap-2">
            <Link to="/" className="block shrink-0" onClick={() => setSidebarOpen(false)}>
              <Logo />
            </Link>
            <NotificationCenter userId={user?.id} userRole={role || undefined} displayMode="drawer" />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchOpen(true)}
            className="size-9 grid place-items-center rounded-xl bg-muted/40 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
            aria-label="Search"
            title="Search (Ctrl+K)"
          >
            <Search className="size-4" />
          </button>
        </div>
      </header>

      {/* Sidebar overlay (mobile only) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-foreground/30 backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Canonical Admin Sidebar */}
      <aside
        id="sada-admin-sidebar"
        className={`admin-sidebar p-4 sm:p-5 ${sidebarOpen ? "is-open" : ""}`}
      >
        <div className="flex items-center justify-between shrink-0">
          <Link to="/" className="block shrink-0" onClick={() => setSidebarOpen(false)}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <NotificationCenter
              userId={user?.id}
              userRole={role || undefined}
              displayMode="popover"
            />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* User Identity & Subtle Role Indicator */}
        <div className="mt-4 p-3 rounded-2xl bg-muted/30 border border-border/80 flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground truncate">
              {displayName}
            </div>
            <div className="text-[10px] font-mono font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 mt-0.5">
              <span
                className={`size-1.5 rounded-full ${
                  role === "super_admin"
                    ? "bg-purple-500"
                    : role === "admin"
                    ? "bg-blue-500"
                    : "bg-emerald-500"
                }`}
              />
              <span>{role ? (t(`admin.roles.${role}`) || getRoleLabel(role)) : "Specialist"}</span>
            </div>
          </div>
        </div>

        {/* Quick Global Search Trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/50 text-xs text-muted-foreground hover:text-foreground transition-all shrink-0 group"
          title="Search (Ctrl+K)"
        >
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>{isRTL ? "بحث سريع..." : "Quick Search..."}</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border/60 text-muted-foreground">
            Ctrl+K
          </kbd>
        </button>

        {/* Navigation */}
        <nav className="mt-5 space-y-4 flex-1 overflow-y-auto min-h-0 pe-1">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/70 px-3 block mb-1.5">
              {t("admin.operations")}
            </span>
            {navItems.filter(n => n.section === "operations").map((n) => {
              const active = n.exact
                ? path === n.to
                : path.startsWith(n.to) &&
                  (n.exact !== undefined || path === n.to || path[n.to.length] === "/");
              return (
                <Link
                  key={n.to}
                  to={n.to as any}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? "bg-gradient-primary text-white shadow-md font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <n.Icon className="size-4 shrink-0" />
                  <span className="truncate">{t(n.labelKey) || n.defaultLabel}</span>
                </Link>
              );
            })}
          </div>

          {navItems.some(n => n.section === "finance") && (
            <div className="space-y-1 pt-2 border-t border-border/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/70 px-3 block mb-1.5">
                {t("admin.finance") || "Finance"}
              </span>
              {navItems.filter(n => n.section === "finance").map((n) => {
                const active = n.exact
                  ? path === n.to
                  : path.startsWith(n.to) &&
                    (n.exact !== undefined || path === n.to || path[n.to.length] === "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to as any}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      active
                        ? "bg-gradient-primary text-white shadow-md font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <n.Icon className="size-4 shrink-0" />
                    <span className="truncate">{t(n.labelKey) || n.defaultLabel}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {navItems.some(n => n.section === "content") && (
            <div className="space-y-1 pt-2 border-t border-border/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/70 px-3 block mb-1.5">
                {t("admin.content")}
              </span>
              {navItems.filter(n => n.section === "content").map((n) => {
                const active = n.exact
                  ? path === n.to
                  : path.startsWith(n.to) &&
                    (n.exact !== undefined || path === n.to || path[n.to.length] === "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to as any}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      active
                        ? "bg-gradient-primary text-white shadow-md font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <n.Icon className="size-4 shrink-0" />
                    <span className="truncate">{t(n.labelKey) || n.defaultLabel}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Sidebar Controls & Footer */}
        <div className="mt-auto pt-3 border-t border-border shrink-0 space-y-2.5">
          {/* Appearance Controls */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/80 px-1 block">
              {t("admin.appearance")}
            </span>
            <div className="grid grid-cols-2 p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 text-xs gap-1">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg font-medium transition-all ${
                  theme === "light"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={theme === "light"}
                title="Light Mode"
              >
                <Sun className="size-3.5 shrink-0" />
                <span className="truncate">{t("admin.light")}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg font-medium transition-all ${
                  theme === "dark"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={theme === "dark"}
                title="Dark Mode"
              >
                <Moon className="size-3.5 shrink-0" />
                <span className="truncate">{t("admin.dark")}</span>
              </button>
            </div>
          </div>

          {/* Language Controls */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/80 px-1 block">
              {t("admin.language")}
            </span>
            <div className="grid grid-cols-2 p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 text-xs gap-1">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex items-center justify-center py-1 px-2 rounded-lg font-medium transition-all ${
                  language === "en"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={language === "en"}
              >
                <span className="truncate">English</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage("ar")}
                className={`flex items-center justify-center py-1 px-2 rounded-lg font-medium transition-all ${
                  language === "ar"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={language === "ar"}
              >
                <span className="truncate font-semibold">العربية</span>
              </button>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="pt-2 border-t border-border/50 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {isRTL ? <ArrowRight className="size-3.5 shrink-0" /> : <ArrowLeft className="size-3.5 shrink-0" />}
              <span className="truncate">{t("admin.backToSite")}</span>
            </Link>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-3.5 shrink-0" />
              <span className="truncate">{t("admin.signOut")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main id="sada-admin-main" className="admin-main p-3.5 sm:p-6 md:p-10 pt-16 md:pt-10 pb-28 md:pb-10">
        {isModuleBlocked && currentModule ? (
          <ModuleAccessShield
            module={currentModule}
            customMessage={routeEvaluation.reason}
            errorCode={routeEvaluation.code}
            targetPath={path}
          />
        ) : (
          <Outlet />
        )}
      </main>

      {/* Touch-Friendly Mobile Bottom Navigation Dock */}
      <SADAMobileBottomNav
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenNextTask={() => nav({ to: "/admin/my-work" as any })}
      />

      {/* PWA Home Screen Installation Banner & iOS Guide */}
      <PWAInstallBanner />

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
