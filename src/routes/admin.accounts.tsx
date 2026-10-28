import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  AccountRecord,
  fetchAccounts,
  computeAccountKPIs,
} from "@/lib/account-service";
import {
  fetchSecurityKPIs,
  fetchUserSessions,
  fetchSecurityAlerts,
  fetchUserActivityTimeline,
  revokeSession,
  revokeAllUserSessions,
  suspendAccountWithSessions,
  reactivateAccountSecurity,
  resolveSecurityAlert,
} from "@/lib/security-center-service";
import { fetchSystemAuditLogs } from "@/lib/audit-service";
import type {
  SecurityKPIs,
  UserSessionRecord,
  SecurityAlertRecord,
  UserActivityEvent,
} from "@/types/security-center";
import type { SystemAuditLog } from "@/types/notifications-and-audit";

// UI Components
import { AccountsHeader } from "@/components/admin/accounts/AccountsHeader";
import { AccountsKPICards } from "@/components/admin/accounts/AccountsKPICards";
import { AccountsTable } from "@/components/admin/accounts/AccountsTable";
import { CreateAccountModal } from "@/components/admin/accounts/CreateAccountModal";
import { AccountDetailsDrawer } from "@/components/admin/accounts/AccountDetailsDrawer";
import {
  SecurityControlCenterNav,
  type SecurityCenterTab,
} from "@/components/admin/security/SecurityControlCenterNav";
import { SecurityOverviewTab } from "@/components/admin/security/SecurityOverviewTab";
import { LiveSessionsTab } from "@/components/admin/security/LiveSessionsTab";
import { UserActivityTab } from "@/components/admin/security/UserActivityTab";
import { SecurityAndAuditTab } from "@/components/admin/security/SecurityAndAuditTab";
import {
  RevokeSessionModal,
  SignOutEverywhereModal,
  SuspendAccountSecurityModal,
  ReactivateAccountSecurityModal,
} from "@/components/admin/security/EmergencyActionModals";

import {
  ShieldAlert,
  Loader2,
  Lock,
  ShieldCheck,
  Radio,
  Plus,
  RefreshCw,
} from "lucide-react";
import { AccountsDirectorySkeleton } from "@/components/ui/sada-ui";
import { SADAButton } from "@/components/ui/sada-button";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/accounts")({
  validateSearch: (search: Record<string, unknown>) => {
    const rawSection = (search.section as string) || (search.tab as string);
    const validSections: SecurityCenterTab[] = [
      "overview",
      "accounts",
      "sessions",
      "activity",
      "audit",
      "security-audit",
      "alerts",
    ];
    const section: SecurityCenterTab | undefined = validSections.includes(rawSection as any)
      ? (rawSection as SecurityCenterTab)
      : undefined;

    return {
      section,
      tab: typeof search.tab === "string" ? search.tab : undefined,
      user: typeof search.user === "string" ? search.user : undefined,
      account: typeof search.account === "string" ? search.account : undefined,
    };
  },
  component: AdminSecurityCenterPage,
});

export function AdminSecurityCenterPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { language } = useTranslation();
  const isAr = language === "ar";

  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();

  // Tab State with URL query sync
  const [activeTab, setActiveTab] = useState<SecurityCenterTab>(() => {
    const initial = searchParams.section || searchParams.tab;
    if (initial === "security-audit" || initial === "alerts") return "audit";
    if (initial && ["overview", "accounts", "sessions", "activity", "audit"].includes(initial)) {
      return initial as SecurityCenterTab;
    }
    return "overview";
  });

  // Core Data States
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [activityEvents, setActivityEvents] = useState<UserActivityEvent[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemAuditLog[]>([]);
  const [securityKpis, setSecurityKpis] = useState<SecurityKPIs>({
    active_sessions_count: 0,
    unique_active_users_count: 0,
    revoked_sessions_count: 0,
    suspended_accounts_count: 0,
    open_security_alerts_count: 0,
    high_risk_actions_count: 0,
    last_security_sync_at: new Date().toISOString(),
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters for Accounts Tab
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Modals & Action Dialogs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);

  // Emergency Control Modals State
  const [targetSessionToRevoke, setTargetSessionToRevoke] = useState<UserSessionRecord | null>(null);
  const [targetUserToSignOut, setTargetUserToSignOut] = useState<{
    user_id: string;
    display_name: string;
    email: string;
  } | null>(null);
  const [targetAccountToSuspend, setTargetAccountToSuspend] = useState<AccountRecord | null>(null);
  const [targetAccountToReactivate, setTargetAccountToReactivate] = useState<AccountRecord | null>(null);

  // Sync tab from URL if it changes externally
  useEffect(() => {
    const target = searchParams.section || searchParams.tab;
    if (target) {
      const normalized = target === "security-audit" || target === "alerts" ? "audit" : target;
      if (["overview", "accounts", "sessions", "activity", "audit"].includes(normalized)) {
        setActiveTab((prev) => (prev !== normalized ? (normalized as SecurityCenterTab) : prev));
      }
    }
  }, [searchParams.section, searchParams.tab]);

  // Tab change handler updating URL
  const handleTabChange = useCallback(
    (tab: SecurityCenterTab) => {
      const normalized = tab === "security-audit" || (tab as any) === "alerts" ? "audit" : tab;
      setActiveTab(normalized);
      setSelectedAccount(null);
      navigate({
        search: (prev) => ({
          ...prev,
          section: normalized,
          account: undefined,
        }),
        replace: true,
      });
    },
    [navigate]
  );

  // Deep navigation to section with user filter
  const handleNavigateToSectionWithUser = useCallback(
    (sec: SecurityCenterTab, targetUser?: string) => {
      const normalized = sec === "security-audit" || (sec as any) === "alerts" ? "audit" : sec;
      setActiveTab(normalized);
      setSelectedAccount(null);
      navigate({
        search: (prev) => ({
          ...prev,
          section: normalized,
          account: undefined,
          user: targetUser || undefined,
        }),
        replace: true,
      });
    },
    [navigate]
  );

  // Account selection with URL synchronization
  const handleSelectAccount = useCallback(
    (acc: AccountRecord | null) => {
      setSelectedAccount(acc);
      navigate({
        search: (prev) => ({
          ...prev,
          account: acc ? acc.user_id : undefined,
        }),
        replace: true,
      });
    },
    [navigate]
  );

  // Load All Authoritative Security & Account Data
  const loadAllSecurityData = useCallback(
    async (isRefresh = false) => {
      if (!isSuperAdmin) return;
      if (isRefresh || accounts.length > 0) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [
          accountsData,
          kpisData,
          sessionsData,
          alertsData,
          activityData,
          auditLogsData,
        ] = await Promise.all([
          fetchAccounts(),
          fetchSecurityKPIs(),
          fetchUserSessions({ limit: 100 }),
          fetchSecurityAlerts("all"),
          fetchUserActivityTimeline({ limit: 150 }),
          fetchSystemAuditLogs({ limit: 200 }),
        ]);

        setAccounts(accountsData);
        setSecurityKpis(kpisData);
        setSessions(sessionsData);
        setAlerts(alertsData);
        setActivityEvents(activityData);
        setSystemLogs(auditLogsData);

        // Keep selected account drawer in sync if open
        if (selectedAccount) {
          const updated = accountsData.find((a) => a.user_id === selectedAccount.user_id);
          if (updated) setSelectedAccount(updated);
        }
      } catch (err: any) {
        console.error("[AdminSecurityCenterPage] Error loading security data:", err);
        setError(err?.message || "Failed to load security center telemetry.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isSuperAdmin, selectedAccount, accounts.length]
  );

  useEffect(() => {
    loadAllSecurityData();
  }, [isSuperAdmin]);

  // Deep-link to an account on load if searchParams.account exists
  useEffect(() => {
    if (searchParams.account && accounts.length > 0) {
      const match = accounts.find((a) => a.user_id === searchParams.account);
      if (match && selectedAccount?.user_id !== match.user_id) {
        setSelectedAccount(match);
      }
    }
  }, [searchParams.account, accounts, selectedAccount?.user_id]);

  // Derived Account KPIs
  const accountKpis = useMemo(() => computeAccountKPIs(accounts), [accounts]);

  const totalActiveSuperAdmins = useMemo(() => {
    return accounts.filter((a) => a.role === "super_admin" && a.status === "active").length;
  }, [accounts]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = acc.display_name.toLowerCase().includes(q);
          const matchEmail = acc.email.toLowerCase().includes(q);
          if (!matchName && !matchEmail) return false;
        }

        if (roleFilter !== "all" && acc.role !== roleFilter) return false;
        if (statusFilter !== "all" && acc.status !== statusFilter) return false;
        if (divisionFilter !== "all" && acc.division !== divisionFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === "last_login") {
          const timeA = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
          const timeB = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
          return timeB - timeA;
        }
        if (sortBy === "name_asc") {
          return a.display_name.localeCompare(b.display_name);
        }
        if (sortBy === "role") {
          const priority: Record<string, number> = { super_admin: 1, admin: 2, worker: 3 };
          return (priority[a.role] || 99) - (priority[b.role] || 99);
        }
        return 0;
      });
  }, [accounts, search, roleFilter, statusFilter, divisionFilter, sortBy]);

  // ============================================================
  // EMERGENCY ACTION HANDLERS
  // ============================================================

  // 1. Revoke One Session
  const handleExecuteRevokeSession = async (session: UserSessionRecord, reason: string) => {
    const res = await revokeSession(session.session_id, reason);
    toast.success(
      isAr
        ? `تم إبطال الجلسة للمستخدم ${session.display_name} بنجاح.`
        : `Session for ${session.display_name} revoked successfully.`
    );
    await loadAllSecurityData(true);
  };

  // 2. Sign Out Everywhere
  const handleExecuteSignOutEverywhere = async (userId: string, reason: string) => {
    const res = await revokeAllUserSessions(userId, reason);
    toast.success(
      isAr
        ? `تم إنهاء جميع الجلسات النشطة (${res.revoked_count || 0}) بنجاح.`
        : `Revoked all active sessions (${res.revoked_count || 0}) for this user.`
    );
    await loadAllSecurityData(true);
  };

  // 3. Suspend Account with Sessions
  const handleExecuteSuspendAccount = async (userId: string, reason: string) => {
    const res = await suspendAccountWithSessions(userId, reason);
    toast.success(
      isAr
        ? `تم تعليق الحساب وإبطال جميع جلساته النشطة بنجاح.`
        : `Account suspended and all active sessions revoked.`
    );
    await loadAllSecurityData(true);
  };

  // 4. Reactivate Account
  const handleExecuteReactivateAccount = async (userId: string, reason?: string) => {
    await reactivateAccountSecurity(userId, reason);
    toast.success(
      isAr
        ? `تمت إعادة تفعيل وصول الحساب بنجاح. يلزم تسجيل الدخول مجدداً.`
        : `Account reactivated. Fresh authentication is required.`
    );
    await loadAllSecurityData(true);
  };

  // 5. Resolve Security Alert
  const handleExecuteResolveAlert = async (
    alertId: string,
    status: "resolved" | "dismissed" | "acknowledged",
    notes?: string
  ) => {
    await resolveSecurityAlert(alertId, status, notes);
    toast.success(
      status === "resolved"
        ? isAr
          ? "تم حل التنبيه الأمني وتوثيق الملاحظات."
          : "Security alert marked as resolved."
        : isAr
        ? "تم تحديث حالة التنبيه الأمني."
        : "Alert status updated."
    );
    await loadAllSecurityData(true);
  };

  // 1. Authorization Shield: Loading
  if (authLoading) {
    return <AccountsDirectorySkeleton />;
  }

  // 2. Authorization Shield: Denied (Admin / Worker / Unauthenticated)
  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-3xl bg-card border border-rose-500/30 text-center shadow-2xl">
        <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 grid place-items-center mx-auto mb-4 border border-rose-500/20">
          <ShieldAlert className="size-7" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground tracking-tight">
          {isAr ? "مطلوب صلاحية المشرف المتميز (Super Admin)" : "Super Admin Access Required"}
        </h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {isAr
            ? "مركز التحكم الأمني وإدارة الجلسات في صدى مخصص حصرياً للمشرف المتميز (Super Admin). يتم عزل المديرين والموظفين تماماً عن مراقبة الجلسات، وسجلات التدقيق، وإدارة الهويات."
            : "The SADA Security & Session Control Center is dedicated exclusively to the Super Admin. Admins and Workers are strictly isolated from session monitoring, identity management, and audit logs."}
        </p>
        <div className="mt-6 p-3 rounded-xl bg-muted/40 font-mono text-[10px] text-muted-foreground inline-flex items-center gap-2">
          <Lock className="size-3 text-rose-500" />
          <span dir="ltr">Security Policy: SADA_RBAC_SECURITY_ROOT_ENFORCED</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Security Center Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center border border-primary/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
                {isAr ? "مركز إدارة الحسابات والتحكم الأمني الموحد" : "Unified Account & Security Operations Center"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "منصة موحدة لإدارة الهويات، الصلاحيات، الجلسات الحية، وسجلات التدقيق غير القابلة للتعديل"
                  : "Single canonical workspace for user identities, roles, live sessions, activity & immutable audit trail"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => loadAllSecurityData(true)}
            disabled={refreshing}
            className="h-9 px-3 rounded-xl text-xs"
          >
            <RefreshCw className={`size-3.5 me-1.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{isAr ? "تحديث المزامنة" : "Live Sync"}</span>
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold"
          >
            <Plus className="size-3.5 me-1.5" />
            <span>{isAr ? "إنشاء حساب جديد" : "Create Account"}</span>
          </SADAButton>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Segment Navigation Bar */}
      <SecurityControlCenterNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activeSessionsCount={securityKpis.active_sessions_count}
        openAlertsCount={securityKpis.open_security_alerts_count}
        totalAccountsCount={accounts.length}
      />

      {/* TAB CONTENT PANELS */}
      {loading && accounts.length === 0 ? (
        <AccountsDirectorySkeleton />
      ) : (
        <>
          {/* TAB 1: Overview */}
          {activeTab === "overview" && (
            <SecurityOverviewTab
              kpis={securityKpis}
              alerts={alerts}
              accounts={accounts}
              onNavigateTab={(tab, targetUser) => {
                handleNavigateToSectionWithUser(tab, targetUser?.email || targetUser?.id);
              }}
              onRefresh={() => loadAllSecurityData(true)}
              refreshing={refreshing}
            />
          )}

          {/* TAB 2: Accounts Directory */}
          {activeTab === "accounts" && (
            <div className="space-y-6">
              <AccountsHeader
                search={search}
                onSearchChange={setSearch}
                roleFilter={roleFilter}
                onRoleFilterChange={setRoleFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                divisionFilter={divisionFilter}
                onDivisionFilterChange={setDivisionFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                onOpenCreate={() => setShowCreateModal(true)}
                onRefresh={() => loadAllSecurityData(true)}
                refreshing={refreshing}
                canCreate={isSuperAdmin}
              />

              <AccountsKPICards kpis={accountKpis} />

              <AccountsTable
                accounts={filteredAccounts}
                onSelectAccount={(acc) => handleSelectAccount(acc)}
                onOpenSuspend={(acc) => setTargetAccountToSuspend(acc)}
                onOpenReactivate={(acc) => setTargetAccountToReactivate(acc)}
                onOpenResetPassword={(acc) => handleSelectAccount(acc)}
                onOpenDelete={(acc) => handleSelectAccount(acc)}
                currentUserId={user?.id}
              />
            </div>
          )}

          {/* TAB 3: Live Sessions Monitor */}
          {activeTab === "sessions" && (
            <LiveSessionsTab
              sessions={sessions}
              initialSearch={searchParams.user}
              onRevokeSession={(sess) => setTargetSessionToRevoke(sess)}
              onSignOutEverywhere={(sess) =>
                setTargetUserToSignOut({
                  user_id: sess.user_id,
                  display_name: sess.display_name,
                  email: sess.user_email,
                })
              }
              onSuspendAccount={(sess) => {
                const acc = accounts.find((a) => a.user_id === sess.user_id);
                if (acc) setTargetAccountToSuspend(acc);
              }}
              onRefresh={() => loadAllSecurityData(true)}
              refreshing={refreshing}
              currentUserId={user?.id}
            />
          )}

          {/* TAB 4: User Activity Timeline */}
          {activeTab === "activity" && (
            <UserActivityTab
              events={activityEvents}
              accounts={accounts}
              selectedUserId={searchParams.user}
              onRefresh={() => loadAllSecurityData(true)}
              loading={refreshing}
            />
          )}

          {/* TAB 5: Security & Audit */}
          {(activeTab === "audit" ||
            activeTab === "security-audit" ||
            (activeTab as any) === "alerts") && (
            <SecurityAndAuditTab
              alerts={alerts}
              logs={systemLogs}
              onResolveAlert={handleExecuteResolveAlert}
              onRefresh={() => loadAllSecurityData(true)}
              loading={refreshing}
              currentUserId={user?.id}
            />
          )}
        </>
      )}

      {/* Account Details Drawer */}
      {selectedAccount && (
        <AccountDetailsDrawer
          account={selectedAccount}
          isOpen={Boolean(selectedAccount)}
          onClose={() => handleSelectAccount(null)}
          onUpdated={() => loadAllSecurityData(true)}
          currentUserId={user?.id}
          totalActiveSuperAdmins={totalActiveSuperAdmins}
          sessions={sessions}
          alerts={alerts}
          activityEvents={activityEvents}
          onNavigateToSection={(section, targetUser) => {
            handleNavigateToSectionWithUser(section, targetUser);
          }}
          onRevokeSession={(sess) => setTargetSessionToRevoke(sess)}
          onSignOutEverywhere={(acc) =>
            setTargetUserToSignOut({
              user_id: acc.user_id,
              display_name: acc.display_name,
              email: acc.email,
            })
          }
          onSuspendAccount={(acc) => setTargetAccountToSuspend(acc)}
          onReactivateAccount={(acc) => setTargetAccountToReactivate(acc)}
        />
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <CreateAccountModal
          onCreated={() => loadAllSecurityData(true)}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Emergency Action Dialogs */}
      {targetSessionToRevoke && (
        <RevokeSessionModal
          session={targetSessionToRevoke}
          isOpen={Boolean(targetSessionToRevoke)}
          onClose={() => setTargetSessionToRevoke(null)}
          onConfirm={handleExecuteRevokeSession}
        />
      )}

      {targetUserToSignOut && (
        <SignOutEverywhereModal
          userRecord={targetUserToSignOut}
          isOpen={Boolean(targetUserToSignOut)}
          onClose={() => setTargetUserToSignOut(null)}
          onConfirm={handleExecuteSignOutEverywhere}
        />
      )}

      {targetAccountToSuspend && (
        <SuspendAccountSecurityModal
          userRecord={targetAccountToSuspend}
          isOpen={Boolean(targetAccountToSuspend)}
          onClose={() => setTargetAccountToSuspend(null)}
          onConfirm={handleExecuteSuspendAccount}
          isSelf={targetAccountToSuspend.user_id === user?.id}
          isLastSuperAdmin={
            targetAccountToSuspend.role === "super_admin" && totalActiveSuperAdmins <= 1
          }
        />
      )}

      {targetAccountToReactivate && (
        <ReactivateAccountSecurityModal
          userRecord={targetAccountToReactivate}
          isOpen={Boolean(targetAccountToReactivate)}
          onClose={() => setTargetAccountToReactivate(null)}
          onConfirm={handleExecuteReactivateAccount}
        />
      )}
    </div>
  );
}

