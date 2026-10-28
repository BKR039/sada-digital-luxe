import { useState, useEffect, useMemo } from "react";
import {
  SADA_MODULES,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
  MODULE_ACTIONS_CATALOG,
  getEffectiveModulePermission,
  getEffectiveActionPermission,
  type SadaModule,
  type SadaRole,
  type UserModulePermissions,
  type ModulePermissionConfig,
  type GranularActionMeta,
} from "@/types/permissions";
import {
  AccountRecord,
  fetchUserModulePermissions,
  updateAccountPermissions,
} from "@/lib/account-service";
import { getRoleBadgeStyle, getRoleLabel } from "@/lib/permissions";
import { SADASwitch, SADAButton, SADABadge, SADAInput, SADADialog } from "@/components/ui/sada-ui";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  XCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Building2,
  CheckSquare,
  CalendarDays,
  Briefcase,
  Users,
  Target,
  Package,
  BarChart3,
  MessageSquare,
  Landmark,
  Wallet,
  FolderKanban,
  Workflow,
  Eye,
  Plus,
  Edit2,
  Trash2,
  Award,
  GitBranch,
} from "lucide-react";

interface AccountPermissionsPanelProps {
  account: AccountRecord;
  onUpdated?: () => void;
}

const MODULE_ICONS: Record<SadaModule, any> = {
  dashboard: LayoutDashboard,
  clients: Building2,
  tasks: CheckSquare,
  calendar: CalendarDays,
  workspaces: Briefcase,
  team: Users,
  sales: Target,
  packages: Package,
  analytics: BarChart3,
  inquiries: MessageSquare,
  finance: Landmark,
  compensation: Wallet,
  content_cms: FolderKanban,
  workflows: Workflow,
  business_rules: Sliders,
  accounts: Shield,
};

const CATEGORIES = [
  { key: "operations", label: "Operations & Production", labelAr: "العمليات والإنتاج اليومي" },
  { key: "finance", label: "Finance & Treasury", labelAr: "المالية والخزينة والمستحقات" },
  { key: "content", label: "Content CMS & Marketing", labelAr: "إدارة المحتوى والموقع" },
  { key: "admin", label: "System Administration & Rules", labelAr: "إدارة النظام والسياسات المركزية" },
] as const;

export function AccountPermissionsPanel({ account, onUpdated }: AccountPermissionsPanelProps) {
  const { isSuperAdmin: currentUserIsSuperAdmin, user } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const isSelf = user?.id === account.user_id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissionsState, setPermissionsState] = useState<UserModulePermissions>({});
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [auditReason, setAuditReason] = useState("");

  // Load authoritative permissions for this account
  useEffect(() => {
    let isMounted = true;
    async function loadPerms() {
      setLoading(true);
      try {
        const perms = await fetchUserModulePermissions(account.user_id);
        if (isMounted) {
          setPermissionsState(perms || account.module_permissions || {});
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPerms();
    return () => {
      isMounted = false;
    };
  }, [account.user_id, account.module_permissions]);

  // Compute effective status for each module master switch
  const effectiveStatus = useMemo(() => {
    const result: Record<SadaModule, boolean> = {} as any;
    for (const mod of SADA_MODULES) {
      result[mod.key] = getEffectiveModulePermission(mod.key, account.role, permissionsState);
    }
    return result;
  }, [account.role, permissionsState]);

  // Toggle module on/off
  const handleToggleModule = (modKey: SadaModule, nextVal: boolean) => {
    if (!currentUserIsSuperAdmin) {
      toast.error(
        isAr
          ? "تعديل الصلاحيات مقتصر حصرياً على المشرف المتميز (Super Admin)."
          : "Only Super Admin can modify account permissions."
      );
      return;
    }

    if (modKey === "accounts") {
      if (isSelf && !nextVal) {
        toast.error(
          isAr
            ? "لا يمكنك إلغاء وصولك الخاص لإدارة الحسابات (حماية من القفل الإداري العرضي)."
            : "Cannot revoke your own access to account management (administrative self-lockout protection)."
        );
        return;
      }

      if (account.role !== "super_admin") {
        toast.error(
          isAr
            ? "إدارة الحسابات مخصصة حصرياً للمشرف المتميز ولا يمكن تفويضها."
            : "Account Management is root-exclusive to Super Admin and cannot be delegated."
        );
        return;
      }
    }

    setPermissionsState((prev) => {
      const cur = prev[modKey];
      if (typeof cur === "object" && cur !== null) {
        return {
          ...prev,
          [modKey]: {
            ...cur,
            enabled: nextVal,
          },
        };
      }
      return {
        ...prev,
        [modKey]: nextVal,
      };
    });
  };

  // Toggle granular action
  const handleToggleAction = (modKey: SadaModule, actionKey: string, nextVal: boolean) => {
    if (!currentUserIsSuperAdmin) {
      toast.error(
        isAr
          ? "تعديل الصلاحيات مقتصر حصرياً على المشرف المتميز (Super Admin)."
          : "Only Super Admin can modify account permissions."
      );
      return;
    }

    const isDeleteAction = actionKey === "delete" || actionKey === "delete_lead" || actionKey === "delete_transaction";
    if (isDeleteAction && account.role !== "super_admin") {
      toast.error(
        isAr
          ? "صلاحية الحذف النهائي مقتصرة دائماً على المشرف المتميز."
          : "Permanent deletion authority is restricted strictly to Super Admin."
      );
      return;
    }

    setPermissionsState((prev) => {
      const cur = prev[modKey];
      const curObj: ModulePermissionConfig =
        typeof cur === "object" && cur !== null
          ? cur
          : { enabled: typeof cur === "boolean" ? cur : true, actions: {} };

      return {
        ...prev,
        [modKey]: {
          ...curObj,
          actions: {
            ...curObj.actions,
            [actionKey]: nextVal,
          },
        },
      };
    });
  };

  // Preset: Reset to Role Baseline Defaults
  const handleResetToRoleDefaults = () => {
    if (!currentUserIsSuperAdmin) return;
    setPermissionsState({});
    toast.info(
      isAr
        ? `تمت إعادة التعيين إلى الإعدادات الافتراضية لرتبة ${getRoleLabel(account.role)}`
        : `Reset to default permissions for ${getRoleLabel(account.role)}`
    );
  };

  // Preset: Worker Operational Profile
  const handleApplyWorkerPreset = () => {
    if (!currentUserIsSuperAdmin) return;
    const preset: UserModulePermissions = {
      dashboard: true,
      clients: true,
      tasks: true,
      calendar: true,
      compensation: true,
      sales: false,
      finance: false,
      workspaces: false,
      team: false,
      packages: false,
      analytics: false,
      inquiries: false,
      content_cms: false,
      workflows: false,
      business_rules: false,
      accounts: false,
    };
    setPermissionsState(preset);
    toast.success(
      isAr
        ? "تم تطبيق نمط الموظف: لوحة التحكم والمهام والعملاء مفعلة؛ المالية والمبيعات معطلة"
        : "Applied Worker Profile: Dashboard, Tasks, Clients ON; Finance, Sales OFF"
    );
  };

  // Preset: Admin Operational Oversight
  const handleApplyAdminPreset = () => {
    if (!currentUserIsSuperAdmin) return;
    const preset: UserModulePermissions = {
      dashboard: true,
      clients: true,
      tasks: true,
      calendar: true,
      workspaces: true,
      team: true,
      sales: true,
      packages: true,
      analytics: true,
      inquiries: true,
      content_cms: true,
      compensation: true,
      finance: false, // Default finance off unless explicitly granted
      workflows: false,
      business_rules: false,
      accounts: false,
    };
    setPermissionsState(preset);
    toast.success(
      isAr
        ? "تم تطبيق نمط المدير: العمليات والمشاريع مفعلة؛ الإدارة المركزية والمالية معطلة"
        : "Applied Admin Profile: Operations & Workspaces ON; Root Admin & Finance OFF"
    );
  };

  // Preset: Enable All Modules (excluding accounts root check)
  const handleAllowAllModules = () => {
    if (!currentUserIsSuperAdmin) return;
    const preset: UserModulePermissions = {};
    for (const mod of SADA_MODULES) {
      if (mod.key !== "accounts" || account.role === "super_admin") {
        preset[mod.key] = true;
      }
    }
    setPermissionsState(preset);
    toast.success(isAr ? "تم تمكين جميع الوحدات المسموح بها" : "Enabled all permissible modules");
  };

  // Save changes via Super Admin RPC with audit modal
  const handleOpenSaveDialog = () => {
    if (!currentUserIsSuperAdmin) {
      toast.error(
        isAr
          ? "تعديل الصلاحيات مقتصر حصرياً على المشرف المتميز (Super Admin)."
          : "Only Super Admin can modify account permissions."
      );
      return;
    }

    if (isSelf) {
      const rawAccounts = permissionsState.accounts;
      const isAccountsDisabled =
        rawAccounts === false ||
        (typeof rawAccounts === "object" && rawAccounts !== null && rawAccounts.enabled === false);
      if (isAccountsDisabled) {
        toast.error(
          isAr
            ? "لا يمكنك إلغاء وصولك الخاص لإدارة الحسابات (حماية من القفل الإداري العرضي)."
            : "Cannot revoke your own access to account management (administrative self-lockout protection)."
        );
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!currentUserIsSuperAdmin) return;
    setSaving(true);
    try {
      await updateAccountPermissions(
        account.user_id,
        permissionsState,
        undefined,
        undefined,
        { reason: auditReason.trim() || undefined }
      );
      toast.success(
        isAr
          ? "تم حفظ صلاحيات الوحدات والعمليات التفصيلية وتوثيقها في سجل التدقيق بنجاح"
          : "Granular permissions saved and logged to audit trail successfully"
      );
      setShowConfirmModal(false);
      setAuditReason("");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error("Save permissions error:", err);
      toast.error(
        err?.message || (isAr ? "فشل حفظ الصلاحيات" : "Failed to update permissions")
      );
    } finally {
      setSaving(false);
    }
  };

  const roleBadge = getRoleBadgeStyle(account.role);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">
              {isAr ? "صلاحيات الوصول والعمليات التفصيلية" : "Granular Access & Action Permissions"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${roleBadge.badgeClass}`}
            >
              <span className={`size-1.5 rounded-full ${roleBadge.dotColor}`} />
              {getRoleLabel(account.role)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "تحكم حصري للمشرف المتميز بتعطيل أو تمكين أي وحدة أو عملية فرعية (Module -> Page -> Action) مع توضيح الصلاحيات الافتراضية والمخصصة."
              : "Super Admin exclusive control to grant, revoke, or override specific module pages and granular actions."}
          </p>
        </div>

        {currentUserIsSuperAdmin ? (
          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleOpenSaveDialog}
            isLoading={saving}
            disabled={saving || loading}
            className="shrink-0 bg-primary text-white cursor-pointer shadow-sm"
          >
            <Save className="size-3.5 me-1.5" />
            <span>{saving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ الصلاحيات" : "Save Permissions")}</span>
          </SADAButton>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-mono">
            <Lock className="size-3" />
            <span>{isAr ? "وضع القراءة فقط" : "Read-Only"}</span>
          </div>
        )}
      </div>

      {/* Non-Super-Admin Warning Notice */}
      {!currentUserIsSuperAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            {isAr
              ? "تنبيه: أنت تتصفح الصلاحيات بوضع القراءة فقط. المشرف المتميز (Super Admin) هو المخول الوحيد بإجراء أي تعديل."
              : "Notice: You are viewing permissions in read-only mode. Only the Super Admin is authorized to grant, revoke, or modify permissions."}
          </span>
        </div>
      )}

      {/* Quick Presets Toolbar (Super Admin only) */}
      {currentUserIsSuperAdmin && (
        <div className="space-y-2">
          <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider block">
            {isAr ? "نماذج الضبط السريع" : "Quick Permission Presets"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyWorkerPreset}
              className="text-xs font-medium"
            >
              <Sparkles className="size-3.5 text-amber-500 me-1.5" />
              <span>{isAr ? "نمط الموظف (العمليات فقط)" : "Worker Default (Ops Only)"}</span>
            </SADAButton>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyAdminPreset}
              className="text-xs font-medium"
            >
              <ShieldCheck className="size-3.5 text-primary me-1.5" />
              <span>{isAr ? "نمط المدير (المشاريع والإشراف)" : "Admin Default (Oversight)"}</span>
            </SADAButton>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAllowAllModules}
              className="text-xs font-medium"
            >
              <CheckCircle2 className="size-3.5 text-emerald-500 me-1.5" />
              <span>{isAr ? "تمكين الكل" : "Enable All"}</span>
            </SADAButton>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToRoleDefaults}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3 text-muted-foreground me-1.5" />
              <span>{isAr ? "إعادة الضبط لرتبة الحساب" : "Reset to Role"}</span>
            </SADAButton>
          </div>
        </div>
      )}

      {/* Grouped Modules by Category */}
      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const categoryModules = SADA_MODULES.filter((m) => m.category === cat.key);
          if (categoryModules.length === 0) return null;

          return (
            <div key={cat.key} className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-xs font-semibold font-display text-foreground tracking-tight">
                  {isAr ? cat.labelAr : cat.label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {categoryModules.filter((m) => effectiveStatus[m.key]).length}/{categoryModules.length}{" "}
                  {isAr ? "مفعل" : "Active"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {categoryModules.map((mod) => {
                  const Icon = MODULE_ICONS[mod.key] || Shield;
                  const isEnabled = effectiveStatus[mod.key];
                  const isAccountsRoot = mod.key === "accounts";
                  const isExpanded = Boolean(expandedActions[mod.key]);

                  // Determine if module status is overridden or inherited
                  const rawOverride = permissionsState[mod.key];
                  const hasModuleOverride = rawOverride !== undefined;

                  // Catalog actions for this module
                  const catalogActions: GranularActionMeta[] = MODULE_ACTIONS_CATALOG[mod.key] || [];

                  return (
                    <div
                      key={mod.key}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isEnabled
                          ? "bg-card border-border/90 shadow-2xs"
                          : "bg-muted/20 border-border/40 opacity-80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-9 rounded-xl grid place-items-center shrink-0 border ${
                              isEnabled
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            <Icon className="size-4.5" />
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground truncate">
                                {isAr ? mod.labelAr : mod.label}
                              </span>
                              <span
                                className="text-[10px] font-mono text-muted-foreground/80 px-1.5 py-0.2 rounded bg-muted/60"
                                dir="ltr"
                              >
                                {mod.path}
                              </span>

                              {/* Inherited vs Override Badge */}
                              {hasModuleOverride ? (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  {isAr ? "تخصيص يدوي" : "Custom Override"}
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                                  {isAr ? "افتراضي من الرتبة" : "Default"}
                                </span>
                              )}

                              {isAccountsRoot && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                  <Lock className="size-2.5" />
                                  {isAr ? "جذري فقط" : "Root Only"}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {isAr ? mod.descriptionAr : mod.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Granular action trigger */}
                          {isEnabled && !isAccountsRoot && catalogActions.length > 0 && (
                            <SADAButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedActions((prev) => ({
                                  ...prev,
                                  [mod.key]: !prev[mod.key],
                                }))
                              }
                              className="text-[11px] font-mono text-muted-foreground hover:text-foreground h-7 px-2"
                              title={isAr ? "صلاحيات العمليات الفرعية" : "Granular action permissions"}
                            >
                              <span>{isAr ? `العمليات (${catalogActions.length})` : `Actions (${catalogActions.length})`}</span>
                              {isExpanded ? (
                                <ChevronUp className="size-3 ms-1" />
                              ) : (
                                <ChevronDown className="size-3 ms-1" />
                              )}
                            </SADAButton>
                          )}

                          {/* Master module toggle */}
                          <SADASwitch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggleModule(mod.key, checked)}
                            disabled={!currentUserIsSuperAdmin || (isAccountsRoot && account.role !== "super_admin")}
                            size="default"
                            className="cursor-pointer"
                            aria-label={`Toggle ${mod.label}`}
                          />
                        </div>
                      </div>

                      {/* Granular Feature / Action Switches Sub-panel */}
                      {isEnabled && isExpanded && !isAccountsRoot && catalogActions.length > 0 && (
                        <div className="mt-3.5 pt-3.5 border-t border-border/50 space-y-2 animate-in fade-in-50 duration-150">
                          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1">
                            <span>{isAr ? "العملية والوصف" : "Action & Description"}</span>
                            <span>{isAr ? "الحالة والمصدر" : "Status & Source"}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {catalogActions.map((act) => {
                              const actStatus = getEffectiveActionPermission(
                                mod.key,
                                act.key,
                                account.role,
                                permissionsState
                              );

                              return (
                                <div
                                  key={act.key}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                                    actStatus.isLocked
                                      ? "bg-muted/30 border-border/40 opacity-80"
                                      : actStatus.isOverride
                                      ? "bg-blue-500/5 border-blue-500/20 shadow-2xs"
                                      : "bg-muted/20 border-border/50"
                                  }`}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-semibold text-foreground truncate">
                                        {isAr ? act.labelAr : act.label}
                                      </span>
                                      <span className="text-[9px] font-mono text-muted-foreground" dir="ltr">
                                        {mod.key}.{act.key}
                                      </span>

                                      {/* Source Indicator */}
                                      {actStatus.isLocked ? (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                          <Lock className="size-2" />
                                          <span>{isAr ? "المشرف فقط" : "Super Admin"}</span>
                                        </span>
                                      ) : actStatus.isOverride ? (
                                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                          {isAr ? "مخصص" : "Override"}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground/80">
                                          {isAr ? "افتراضي" : "Default"}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {isAr ? act.descriptionAr : act.description}
                                    </p>
                                  </div>

                                  <SADASwitch
                                    checked={actStatus.enabled}
                                    onCheckedChange={(ch) => handleToggleAction(mod.key, act.key, ch)}
                                    disabled={
                                      !currentUserIsSuperAdmin ||
                                      actStatus.isLocked ||
                                      (act.superAdminOnly && account.role !== "super_admin")
                                    }
                                    size="sm"
                                    className="cursor-pointer shrink-0"
                                    aria-label={`Toggle ${act.label}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Save Reminder (Super Admin only) */}
      {currentUserIsSuperAdmin && (
        <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            {isAr
              ? "يتم تفعيل الصلاحيات فوراً في الجلسة وتسجيل التعديل في سجل تدقيق الأمان."
              : "Permissions take effect across all active sessions and log to security audit trail."}
          </span>
          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleOpenSaveDialog}
            isLoading={saving}
            disabled={saving || loading}
            className="bg-primary text-white cursor-pointer shadow-sm"
          >
            <Save className="size-3.5 me-1.5" />
            <span>{saving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Changes")}</span>
          </SADAButton>
        </div>
      )}

      {/* SENSITIVE PERMISSION CHANGE CONFIRMATION & AUDIT MODAL */}
      <SADADialog
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        size="compact"
        title={
          <div className="flex items-center gap-2.5 text-primary">
            <Shield className="size-5" />
            <span>{isAr ? "تأكيد تعديل الصلاحيات الإدارية" : "Confirm Permission Modifications"}</span>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2 w-full">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmSave}
              isLoading={saving}
              disabled={saving}
              className="bg-primary text-white"
            >
              <Save className="size-3.5 me-1.5" />
              <span>{isAr ? "تأكيد وتطبيق الصلاحيات" : "Confirm & Apply"}</span>
            </SADAButton>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-muted-foreground text-start">
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{account.display_name}</span>
              <SADABadge variant="outline" className={`text-[10px] ${roleBadge.badgeClass}`}>
                {getRoleLabel(account.role)}
              </SADABadge>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground" dir="ltr">
              {account.email}
            </p>
          </div>

          {isSelf && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" />
              <span>
                {isAr
                  ? "حماية الإدارة: الوصول إلى وحدة إدارة الحسابات محفوظ تلقائياً لمنع القفل العرضي."
                  : "Self-Lockout Guard: Your access to Account Management is strictly protected."}
              </span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
              {isAr ? "سبب التعديل (سجل التدقيق الأمني)" : "Reason for Modification (Audit Trail)"}
            </label>
            <SADAInput
              type="text"
              placeholder={
                isAr
                  ? "مثال: تفويض صلاحيات المبيعات لحملة الربع الرابع"
                  : "e.g. Granted sales workspace access for Q4 campaign"
              }
              value={auditReason}
              onChange={(e) => setAuditReason(e.target.value)}
              className="w-full text-xs text-foreground text-start"
            />
          </div>
        </div>
      </SADADialog>
    </div>
  );
}
