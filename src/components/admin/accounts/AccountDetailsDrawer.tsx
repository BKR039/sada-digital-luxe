import { useState, useEffect, useCallback, useMemo } from "react";
import { AccountRecord, updateAccount, updateAccountEmail, type AccountStatus } from "@/lib/account-service";
import { upsertSalaryRecord } from "@/lib/finance-service";
import { SadaRole, getRoleBadgeStyle, getRoleLabel } from "@/lib/permissions";
import { AccountSecurityPanel } from "./AccountSecurityPanel";
import { AccountActivityTimeline } from "./AccountActivityTimeline";
import { AccountDangerZone } from "./AccountDangerZone";
import { AccountPermissionsPanel } from "./AccountPermissionsPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  History,
  AlertTriangle,
  Briefcase,
  Building,
  Phone,
  Mail,
  Save,
  Loader2,
  Globe,
  Sparkles,
  Share2,
  DollarSign,
  CreditCard,
  Lock,
  ExternalLink,
  Edit2,
  CheckCircle2,
  Radio,
  Laptop,
  Smartphone,
  Tablet,
  LogOut,
  Copy,
  Check,
  ShieldX,
} from "lucide-react";
import { SADASelect } from "@/components/ui/sada-select";
import { SADASwitch, SADADrawer, SADADialog, SADAButton, SADAInput, SADATextarea } from "@/components/ui/sada-ui";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/i18n";
import type { UserSessionRecord, SecurityAlertRecord, UserActivityEvent } from "@/types/security-center";
import type { SecurityCenterTab } from "../security/SecurityControlCenterNav";

interface AccountDetailsDrawerProps {
  account: AccountRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  currentUserId?: string;
  totalActiveSuperAdmins: number;
  sessions?: UserSessionRecord[];
  alerts?: SecurityAlertRecord[];
  activityEvents?: UserActivityEvent[];
  onNavigateToSection?: (section: SecurityCenterTab, targetUser?: string) => void;
  onRevokeSession?: (session: UserSessionRecord) => void;
  onSignOutEverywhere?: (account: AccountRecord) => void;
  onSuspendAccount?: (account: AccountRecord) => void;
  onReactivateAccount?: (account: AccountRecord) => void;
}

export function AccountDetailsDrawer({
  account,
  isOpen,
  onClose,
  onUpdated,
  currentUserId,
  totalActiveSuperAdmins,
  sessions = [],
  alerts = [],
  activityEvents = [],
  onNavigateToSection,
  onRevokeSession,
  onSignOutEverywhere,
  onSuspendAccount,
  onReactivateAccount,
}: AccountDetailsDrawerProps) {
  if (!isOpen || !account) return null;

  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const roleOptions = [
    { value: "worker", label: isAr ? "عضو فريق (تنفيذ العمليات والمهام)" : "Worker (Operational execution & task assignments)" },
    { value: "admin", label: isAr ? "مدير نظام (المشاريع والعمليات وإشراف الفريق)" : "Admin (Operations, projects, calendar & team oversight)" },
    { value: "super_admin", label: isAr ? "مشرف متميز (تحكم جذري كامل والمالية والأمان)" : "Super Admin (Full root access, finance, deletion & security)" },
  ];

  const statusOptions = [
    { value: "active", label: isAr ? "نشط (الوصول للنظام مفعل)" : "ACTIVE (Platform Access Enabled)" },
    { value: "pending", label: isAr ? "قيد الانتظار (بانتظار التفعيل)" : "PENDING (Pre-provisioned, Awaiting Activation)" },
    { value: "suspended", label: isAr ? "معلق (محظور الوصول)" : "SUSPENDED (Access Immediately Prohibited)" },
    { value: "disabled", label: isAr ? "معطل (مؤرشف / ملغى)" : "DISABLED (Archived / Deactivated)" },
  ];

  const divisionOptions = [
    { value: "Development", label: isAr ? "التطوير البرمجي" : "Development" },
    { value: "Marketing", label: isAr ? "التسويق" : "Marketing" },
    { value: "Production", label: isAr ? "الإنتاج" : "Production" },
    { value: "Design", label: isAr ? "التصميم" : "Design" },
    { value: "Executive", label: isAr ? "الإدارة التنفيذية" : "Executive" },
  ];

  const compFrequencyOptions = [
    { value: "monthly", label: isAr ? "شهرياً" : "Monthly" },
    { value: "bi_weekly", label: isAr ? "كل أسبوعين" : "Bi-Weekly (Every 2 Weeks)" },
    { value: "weekly", label: isAr ? "أسبوعياً" : "Weekly" },
  ];

  const compMethodOptions = [
    { value: "Bank Transfer", label: isAr ? "تحويل بنكي" : "Bank Transfer / Wire" },
    { value: "Cash", label: isAr ? "صرف نقدي" : "Cash Disbursement" },
    { value: "Check", label: isAr ? "شيك مصدق" : "Certified Check" },
  ];

  const compStatusOptions = [
    { value: "active", label: isAr ? "نشط" : "Active" },
    { value: "paused", label: isAr ? "متوقف مؤقتاً" : "Paused" },
    { value: "terminated", label: isAr ? "منتهي" : "Terminated" },
  ];

  const isSelf = currentUserId === account.user_id;

  // Tabs: "identity" | "permissions" | "sessions" | "activity" | "security" | "danger"
  const [activeTab, setActiveTab] = useState<
    "identity" | "permissions" | "sessions" | "activity" | "security" | "danger"
  >("identity");

  // User Sessions & Alerts Derivation
  const userSessions = useMemo(() => {
    return (sessions || []).filter(
      (s: UserSessionRecord) => s.user_id === account.user_id || s.user_email === account.email
    );
  }, [sessions, account.user_id, account.email]);

  const activeSessionsCount = useMemo(() => {
    return userSessions.filter((s: UserSessionRecord) => s.session_status === "active").length;
  }, [userSessions]);

  const userAlerts = useMemo(() => {
    return (alerts || []).filter(
      (a: SecurityAlertRecord) => a.user_id === account.user_id || a.user_email === account.email
    );
  }, [alerts, account.user_id, account.email]);

  const openAlertsCount = useMemo(() => {
    return userAlerts.filter((a: SecurityAlertRecord) => a.status === "open").length;
  }, [userAlerts]);

  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const handleCopySessionId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedSessionId(id);
    toast.success(isAr ? "تم نسخ معرف الجلسة" : "Session reference copied");
    setTimeout(() => setCopiedSessionId(null), 2000);
  };

  // Editable Form State
  const [displayName, setDisplayName] = useState(account.display_name);
  const [email, setEmail] = useState(account.email);
  const [phone, setPhone] = useState(account.phone || "");
  const [role, setRole] = useState<SadaRole>(account.role);
  const [status, setStatus] = useState<AccountStatus>(account.status || "active");
  const [division, setDivision] = useState(account.division || "Development");
  const [position, setPosition] = useState(account.team_position || "");
  const [bio, setBio] = useState(account.bio || "");
  const [specialtiesInput, setSpecialtiesInput] = useState((account.specialties || []).join(", "));
  const [linkedin, setLinkedin] = useState(account.socials?.linkedin || "");
  const [behance, setBehance] = useState(account.socials?.behance || "");
  const [instagram, setInstagram] = useState(account.socials?.instagram || "");
  const [published, setPublished] = useState(account.published ?? true);
  const [isActive, setIsActive] = useState(account.is_active ?? true);

  // Salary reference state
  const [salaryRecord, setSalaryRecord] = useState<any>(null);
  const [loadingSalary, setLoadingSalary] = useState(false);

  // Compensation configuration state
  const [isEditingComp, setIsEditingComp] = useState(false);
  const [compBaseSalary, setCompBaseSalary] = useState("");
  const [compFrequency, setCompFrequency] = useState("monthly");
  const [compMethod, setCompMethod] = useState("Bank Transfer");
  const [compStatus, setCompStatus] = useState("active");
  const [savingComp, setSavingComp] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  // Role impact confirmation modal
  const [showRoleImpactModal, setShowRoleImpactModal] = useState(false);
  const [pendingRole, setPendingRole] = useState<SadaRole | null>(null);

  // Saving states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if selected account changes
  useEffect(() => {
    if (account) {
      setDisplayName(account.display_name);
      setEmail(account.email);
      setPhone(account.phone || "");
      setRole(account.role);
      setStatus(account.status || "active");
      setDivision(account.division || "Development");
      setPosition(account.team_position || "");
      setBio(account.bio || "");
      setSpecialtiesInput((account.specialties || []).join(", "));
      setLinkedin(account.socials?.linkedin || "");
      setBehance(account.socials?.behance || "");
      setInstagram(account.socials?.instagram || "");
      setPublished(account.published ?? true);
      setIsActive(account.is_active ?? true);
      setError(null);
    }
  }, [account]);

  // Fetch salary references if team member attached
  const loadSalary = useCallback(async () => {
    if (!account) return;
    setLoadingSalary(true);
    try {
      let tmId = account.team_member_id;
      if (!tmId) {
        const { data: member } = await (supabase as any)
          .from("team_members")
          .select("id")
          .or(`user_id.eq.${account.user_id},profile_id.eq.${account.user_id}`)
          .maybeSingle();
        if (member?.id) tmId = member.id;
      }
      if (!tmId && account.email) {
        const { data: memberByEmail } = await (supabase as any)
          .from("team_members")
          .select("id")
          .ilike("email", account.email.trim())
          .maybeSingle();
        if (memberByEmail?.id) tmId = memberByEmail.id;
      }

      if (!tmId) {
        setSalaryRecord(null);
        return;
      }

      const { data } = await supabase
        .from("salary_records")
        .select("*")
        .eq("team_member_id", tmId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSalaryRecord(data || null);
      if (data) {
        setCompBaseSalary(String(data.base_amount || ""));
        setCompFrequency(data.payment_frequency || "monthly");
        setCompMethod(data.payment_method || "Bank Transfer");
        setCompStatus(data.status || "active");
      } else {
        setCompBaseSalary("");
        setCompFrequency("monthly");
        setCompMethod("Bank Transfer");
        setCompStatus("active");
      }
    } catch {
      setSalaryRecord(null);
    } finally {
      setLoadingSalary(false);
    }
  }, [account]);

  useEffect(() => {
    loadSalary();
    setIsEditingComp(false);
    setCompError(null);
  }, [loadSalary]);

  const handleSaveCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    const num = parseFloat(compBaseSalary);
    if (isNaN(num) || num < 0) {
      setCompError("Please enter a valid base monthly salary in TND.");
      return;
    }

    setSavingComp(true);
    setCompError(null);

    try {
      let tmId = account.team_member_id;
      if (!tmId) {
        const { data: existingTm } = await (supabase as any)
          .from("team_members")
          .select("id")
          .or(`user_id.eq.${account.user_id},profile_id.eq.${account.user_id}`)
          .maybeSingle();

        if (existingTm?.id) {
          tmId = existingTm.id;
        } else {
          // Provision linked team member
          const { data: newTm, error: tmErr } = await (supabase as any)
            .from("team_members")
            .insert({
              name: account.display_name,
              email: account.email,
              role: account.role,
              position: account.team_position || "Specialist",
              division: account.division || "Development",
              profile_id: account.user_id,
              user_id: account.user_id,
              is_active: account.status === "active",
              published: account.published ?? false,
            })
            .select("id")
            .single();

          if (tmErr) throw tmErr;
          tmId = newTm?.id;
        }
      }

      if (!tmId) {
        throw new Error("Unable to resolve team profile for compensation assignment.");
      }

      const res = await upsertSalaryRecord({
        teamMemberId: tmId,
        baseAmount: num,
        salaryType: "monthly",
        paymentFrequency: compFrequency,
        paymentMethod: compMethod,
        status: compStatus,
        effectiveDate: format(new Date(), "yyyy-MM-dd"),
        actorId: currentUserId,
      });

      if (!res.success) {
        throw res.error || new Error("Failed to save compensation profile.");
      }

      toast.success("Worker compensation profile saved successfully");
      setIsEditingComp(false);
      await loadSalary();
      onUpdated();
    } catch (err: any) {
      console.error("[AccountDetailsDrawer] Compensation save error:", err);
      setCompError(err.message || "Failed to save compensation profile.");
    } finally {
      setSavingComp(false);
    }
  };

  const handleRoleChangeRequest = (newRole: SadaRole) => {
    if (newRole === role) return;

    // Check last super admin guard
    if (account.role === "super_admin" && newRole !== "super_admin" && totalActiveSuperAdmins <= 1) {
      setError("At least one active Super Admin is required. You cannot demote this account.");
      return;
    }

    setPendingRole(newRole);
    setShowRoleImpactModal(true);
  };

  const confirmRoleChange = () => {
    if (pendingRole) {
      setRole(pendingRole);
      setShowRoleImpactModal(false);
      setPendingRole(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Full name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const specialties = specialtiesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const socials: Record<string, string> = {};
    if (linkedin.trim()) socials.linkedin = linkedin.trim();
    if (behance.trim()) socials.behance = behance.trim();
    if (instagram.trim()) socials.instagram = instagram.trim();

    try {
      if (email.trim().toLowerCase() !== account.email.toLowerCase()) {
        await updateAccountEmail(account.user_id, email.trim().toLowerCase());
      }

      await updateAccount({
        userId: account.user_id,
        displayName: displayName.trim(),
        phone: phone.trim() || undefined,
        role,
        division,
        position: position.trim() || "Specialist",
        bio: bio.trim() || undefined,
        specialties,
        socials,
        published,
        isActive,
        status,
      });

      toast.success(isAr ? "تم تحديث وحفظ بيانات الحساب بنجاح" : "Account profile and identity updated successfully");
      onUpdated();
    } catch (err: any) {
      setError(err?.message || (isAr ? "فشل تحديث الحساب." : "Failed to update account."));
    } finally {
      setSaving(false);
    }
  };

  const roleBadge = getRoleBadgeStyle(account.role);

  return (
    <>
      <SADADrawer
        open={isOpen && Boolean(account)}
        onOpenChange={(open) => !open && onClose()}
        width="2xl"
        title={
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 rounded-2xl bg-muted border border-border overflow-hidden shrink-0 grid place-items-center font-display font-bold text-foreground text-sm uppercase shadow-sm">
              {account.photo_url ? (
                <img src={account.photo_url} alt={account.display_name} className="size-full object-cover" />
              ) : (
                account.display_name.slice(0, 2)
              )}
            </div>
            <div className="min-w-0 text-start">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-foreground truncate">
                  {account.display_name}
                </span>
                {isSelf && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {isAr ? "أنت" : "You"}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground font-mono truncate" dir="ltr">{account.email}</div>
            </div>
          </div>
        }
        description={
          <div className="flex items-center gap-2 mt-1 flex-wrap text-start">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${roleBadge.badgeClass}`}>
              <span className={`size-1 rounded-full ${roleBadge.dotColor}`} />
              <span>
                {isAr
                  ? (account.role === "super_admin" ? "مشرف متميز" : account.role === "admin" ? "مدير نظام" : "عضو فريق")
                  : roleBadge.label}
              </span>
            </span>
            {account.status === "suspended" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 font-semibold">
                {isAr ? "معلق" : "Suspended"}
              </span>
            ) : account.status === "pending" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                {isAr ? "قيد الانتظار" : "Pending"}
              </span>
            ) : account.status === "disabled" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 border border-slate-500/20 font-semibold">
                {isAr ? "معطل" : "Disabled"}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                {isAr ? "نشط" : "Active"}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
              ID: {account.user_id.slice(0, 8)}...
            </span>
          </div>
        }
        footer={
          activeTab === "identity" ? (
            <div className="flex items-center justify-end gap-2.5 w-full">
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton
                type="submit"
                form="edit-account-form"
                variant="primary"
                size="sm"
                isLoading={saving}
                disabled={saving}
                className="bg-primary text-white cursor-pointer"
              >
                {isAr ? "حفظ التغييرات" : "Save Changes"}
              </SADAButton>
            </div>
          ) : undefined
        }
      >
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-3 mb-4 text-xs overflow-x-auto shrink-0">
          <button
            type="button"
            data-drawer-tab="identity"
            onClick={() => setActiveTab("identity")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "identity"
                ? "bg-primary text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {isAr ? "الهوية والملف" : "Identity & Profile"}
          </button>
          <button
            type="button"
            data-drawer-tab="permissions"
            onClick={() => setActiveTab("permissions")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "permissions"
                ? "bg-primary text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {isAr ? "صلاحيات الوحدات" : "Module Permissions"}
          </button>
          <button
            type="button"
            data-drawer-tab="sessions"
            onClick={() => setActiveTab("sessions")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "sessions"
                ? "bg-primary text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Radio className="size-3" />
            <span>{isAr ? "الجلسات النشطة" : "Sessions"}</span>
            {activeSessionsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                {activeSessionsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            data-drawer-tab="activity"
            onClick={() => setActiveTab("activity")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "activity"
                ? "bg-primary text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {isAr ? "سجل التدقيق والنشاط" : "Activity Audit"}
          </button>
          <button
            type="button"
            data-drawer-tab="security"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-primary text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>{isAr ? "الأمان وكلمات المرور" : "Security & Events"}</span>
            {openAlertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                {openAlertsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            data-drawer-tab="danger"
            onClick={() => setActiveTab("danger")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "danger"
                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 font-semibold"
                : "text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10"
            }`}
          >
            {isAr ? "إجراءات الطوارئ" : "Emergency & Danger"}
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* TAB 1: IDENTITY & ROLE */}
          {activeTab === "identity" && (
            <form id="edit-account-form" onSubmit={handleSaveProfile} className="space-y-5">
              <div className="space-y-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Authentication Identity
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      Display Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      {isAr ? "البريد الإلكتروني *" : "Email Address *"}
                    </label>
                    <input
                      required
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 rounded-xl glass border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 text-start"
                    />
                    {email.trim().toLowerCase() !== account.email.toLowerCase() && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        {isAr
                          ? "سيتم مزامنة البريد الجديد مباشرة في Supabase Auth وقاعدة البيانات."
                          : "New email will be synchronized across Supabase Auth and database."}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+216 ..."
                      className="w-full px-3 py-2 rounded-xl glass border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Role & Division */}
              <div className="space-y-3.5 pt-4 border-t border-border/60">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Access Level & Operations
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      Role & Permissions
                    </label>
                    <SADASelect
                      value={role}
                      onChange={(val) => handleRoleChangeRequest(val as SadaRole)}
                      options={roleOptions}
                      placeholder="Select Role"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      Lifecycle Status *
                    </label>
                    <SADASelect
                      value={status}
                      onChange={(val) => setStatus(val as AccountStatus)}
                      options={statusOptions}
                      placeholder="Select Status"
                    />
                    {status !== "active" && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        Note: Setting status to {status.toUpperCase()} prohibits authentication access immediately while preserving all historical business and task data.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      Department / Division
                    </label>
                    <SADASelect
                      value={division}
                      onChange={setDivision}
                      options={divisionOptions}
                      placeholder="Department"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                      Position / Title
                    </label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. Senior Strategist"
                      className="w-full px-3 py-2 rounded-xl glass border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Granular Permissions Indicator */}
                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 space-y-2 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="size-3.5 text-primary" />
                    <span>Role Permissions & Capabilities</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${role === "super_admin" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span>Financial OS & P&L Control</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${role === "super_admin" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span>Account Management & Provisioning</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${role !== "worker" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span>CRM & Client Project Oversight</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${role !== "worker" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span>Task Assignment & Scheduling</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span>Operational Execution & Deliverables</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span>Personal Salary & Payout Portal</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Profile / Public Fields */}
              <div className="space-y-3.5 pt-4 border-t border-border/60">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Operational Team Profile
                </div>

                <div>
                  <SADATextarea
                    label="Bio / Summary"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short professional biography..."
                    className="resize-none text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono uppercase text-muted-foreground">
                      Specialties (Comma separated)
                    </label>
                    <SADAButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const specs = specialtiesInput.split(",").map(s => s.trim()).filter(Boolean);
                        const hasPub = specs.some(s => s.toLowerCase() === "publisher");
                        if (hasPub) {
                          setSpecialtiesInput(specs.filter(s => s.toLowerCase() !== "publisher").join(", "));
                        } else {
                          setSpecialtiesInput([...specs, "publisher"].join(", "));
                        }
                      }}
                      className={`text-[10px] h-6 px-2 py-0.5 rounded-full border transition-all ${
                        specialtiesInput.toLowerCase().includes("publisher")
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/50 font-semibold"
                          : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {specialtiesInput.toLowerCase().includes("publisher")
                        ? "✓ Content Publisher Active"
                        : "+ Assign Publisher Capability"}
                    </SADAButton>
                  </div>
                  <input
                    type="text"
                    value={specialtiesInput}
                    onChange={(e) => setSpecialtiesInput(e.target.value)}
                    placeholder="React, Branding, UI/UX, Video Editing, publisher"
                    className="w-full px-3 py-2 rounded-xl glass border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground mb-1">LinkedIn</label>
                    <input
                      type="url"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full px-2.5 py-1.5 rounded-lg glass border border-border text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground mb-1">Behance</label>
                    <input
                      type="url"
                      value={behance}
                      onChange={(e) => setBehance(e.target.value)}
                      placeholder="https://behance.net/..."
                      className="w-full px-2.5 py-1.5 rounded-lg glass border border-border text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground mb-1">Instagram</label>
                    <input
                      type="url"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="https://instagram.com/..."
                      className="w-full px-2.5 py-1.5 rounded-lg glass border border-border text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <SADASwitch
                    checked={published}
                    onCheckedChange={setPublished}
                    label="Public on Website Team Page"
                    size="sm"
                  />

                  <SADASwitch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    label="Active Team Member"
                    size="sm"
                  />
                </div>
              </div>

              {/* Salary & Financial Profile References */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-emerald-500" />
                    <span>Salary & Financial Reference</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SADAButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingComp(!isEditingComp);
                        setCompError(null);
                      }}
                      leftIcon={<Edit2 className="size-3" />}
                    >
                      {isEditingComp ? "Cancel" : salaryRecord ? "Edit Salary" : "Configure Salary"}
                    </SADAButton>
                    <a
                      href="/admin/finance"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>Financial OS</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>

                {loadingSalary ? (
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 text-xs text-muted-foreground font-mono flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Loading salary records from Financial OS...</span>
                  </div>
                ) : isEditingComp ? (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-3.5">
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>{salaryRecord ? "Update Compensation Profile" : "Configure Worker Base Compensation"}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">Authoritative Financial OS</span>
                    </div>

                    {compError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                        {compError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                          Base Monthly Salary (TND) *
                        </label>
                        <SADAInput
                          type="number"
                          step="0.001"
                          min="0"
                          value={compBaseSalary}
                          onChange={(e) => setCompBaseSalary(e.target.value)}
                          placeholder="e.g. 1400"
                          prefix="TND"
                          className="font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                          Payment Frequency
                        </label>
                        <SADASelect
                          value={compFrequency}
                          onChange={setCompFrequency}
                          options={compFrequencyOptions}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                          Payment Method
                        </label>
                        <SADASelect
                          value={compMethod}
                          onChange={setCompMethod}
                          options={compMethodOptions}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                          Status
                        </label>
                        <SADASelect
                          value={compStatus}
                          onChange={setCompStatus}
                          options={compStatusOptions}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      <SADAButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingComp(false);
                          setCompError(null);
                        }}
                      >
                        Cancel
                      </SADAButton>
                      <SADAButton
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={savingComp}
                        disabled={savingComp || !compBaseSalary.trim()}
                        onClick={handleSaveCompensation}
                        className="bg-primary text-white"
                      >
                        Save Compensation Profile
                      </SADAButton>
                    </div>
                  </div>
                ) : salaryRecord ? (
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Base Compensation:</span>
                      <span className="font-bold text-foreground font-mono">{salaryRecord.base_amount} TND</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Payment Frequency:</span>
                      <span className="font-medium text-foreground capitalize">{salaryRecord.payment_frequency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Structure Type:</span>
                      <span className="font-medium text-foreground capitalize">{(salaryRecord.salary_type || "fixed").replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Disbursement Method:</span>
                      <span className="font-medium text-foreground">{salaryRecord.payment_method || "Direct Wire / Transfer"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Compensation Status:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 capitalize">{salaryRecord.status || "active"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-muted/10 border border-dashed border-border/80 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <p>No individual salary profile registered. Member operates under standard operational agreements.</p>
                    <SADAButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingComp(true)}
                      leftIcon={<Edit2 className="size-3" />}
                    >
                      Configure Base Compensation
                    </SADAButton>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* TAB 2: MODULE PERMISSIONS */}
          {activeTab === "permissions" && (
            <AccountPermissionsPanel account={account} onUpdated={onUpdated} />
          )}

          {/* TAB 3: LIVE SESSIONS SUMMARY */}
          {activeTab === "sessions" && (
            <div className="space-y-4 text-start">
              {/* Session Overview Card */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="size-4 text-primary" />
                    <h4 className="font-display font-bold text-sm text-foreground">
                      {isAr ? "ملخص الجلسات الحية والأجهزة" : "Live Sessions & Device Footprint"}
                    </h4>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                      activeSessionsCount > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    }`}
                  >
                    {activeSessionsCount > 0
                      ? isAr
                        ? `${activeSessionsCount} جلسة نشطة الآن`
                        : `${activeSessionsCount} Active Session${activeSessionsCount > 1 ? "s" : ""}`
                      : isAr
                      ? "لا توجد جلسات نشطة"
                      : "No active sessions"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "مراقبة مباشرة لجميع الجلسات المصرح بها لهذا المستخدم، مع إمكانية الإلغاء الفوري لجلسة معينة أو إنهاء كل الجلسات."
                    : "Authoritative sessions registered for this identity. You can revoke individual sessions or force global sign-out."}
                </p>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                  {onSignOutEverywhere && activeSessionsCount > 0 && (
                    <SADAButton
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onSignOutEverywhere(account)}
                      className="h-8 px-2.5 text-xs rounded-xl"
                    >
                      <LogOut className="size-3.5 me-1.5" />
                      <span>{isAr ? "إنهاء جميع الجلسات (خروج إجباري)" : "Sign Out Everywhere"}</span>
                    </SADAButton>
                  )}

                  {onNavigateToSection && (
                    <SADAButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onNavigateToSection("sessions", account.email);
                        onClose();
                      }}
                      className="h-8 px-2.5 text-xs rounded-xl"
                    >
                      <ExternalLink className="size-3.5 me-1.5" />
                      <span>{isAr ? "فتح في شاشة الجلسات المباشرة" : "Inspect in Live Sessions Tab"}</span>
                    </SADAButton>
                  )}
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono px-1">
                  {isAr ? "سجل الجلسات المرصودة" : "Recorded Session History"} ({userSessions.length})
                </div>

                {userSessions.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                    {isAr
                      ? "لم يتم تسجيل أي جلسة نشطة أو سابقة لهذا المستخدم حتى الآن."
                      : "No observable session records registered for this identity yet."}
                  </div>
                ) : (
                  userSessions.map((sess: UserSessionRecord) => {
                    const isActive = sess.session_status === "active";
                    const isRevoked = sess.session_status === "revoked";
                    const DeviceIcon =
                      sess.device_type === "mobile"
                        ? Smartphone
                        : sess.device_type === "tablet"
                        ? Tablet
                        : Laptop;

                    return (
                      <div
                        key={sess.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isActive
                            ? "bg-card border-border/80 shadow-xs"
                            : "bg-muted/15 border-border/50 opacity-80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-xl bg-muted grid place-items-center text-muted-foreground border border-border/60 shrink-0">
                              <DeviceIcon className="size-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground">
                                  {sess.browser_name || "Browser"} • {sess.os_name || "OS"}
                                </span>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold border ${
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                      : isRevoked
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                      : "bg-muted text-muted-foreground border-border/60"
                                  }`}
                                >
                                  {sess.session_status.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1.5" dir="ltr">
                                <span>{sess.session_id.slice(0, 20)}...</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopySessionId(sess.session_id)}
                                  className="hover:text-foreground cursor-pointer"
                                  title={isAr ? "نسخ معرف الجلسة" : "Copy session reference"}
                                >
                                  {copiedSessionId === sess.session_id ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {isActive && onRevokeSession && (
                            <SADAButton
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => onRevokeSession(sess)}
                              className="h-7 px-2 text-[11px] rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20"
                            >
                              <span>{isAr ? "إلغاء الجلسة" : "Revoke"}</span>
                            </SADAButton>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono">
                          <div>
                            <span className="text-foreground/70">{isAr ? "الدخول: " : "Signed in: "}</span>
                            <span>{format(parseISO(sess.sign_in_at), "yyyy-MM-dd HH:mm")}</span>
                          </div>
                          <div>
                            <span className="text-foreground/70">{isAr ? "آخر نشاط: " : "Last active: "}</span>
                            <span>{formatDistanceToNow(parseISO(sess.last_activity_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY AUDIT */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              {onNavigateToSection && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60 text-xs">
                  <span className="text-muted-foreground">
                    {isAr
                      ? "عرض السجل الزمني الكامل في صفحة نشاط المستخدمين:"
                      : "Inspect full chronological timeline in investigator view:"}
                  </span>
                  <SADAButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onNavigateToSection("activity", account.user_id);
                      onClose();
                    }}
                    className="h-7 px-2.5 text-xs rounded-lg"
                  >
                    <ExternalLink className="size-3 me-1" />
                    <span>{isAr ? "فتح في الخط الزمني" : "Investigator View"}</span>
                  </SADAButton>
                </div>
              )}
              <AccountActivityTimeline targetUserId={account.user_id} />
            </div>
          )}

          {/* TAB 5: SECURITY & EVENTS */}
          {activeTab === "security" && (
            <div className="space-y-5 text-start">
              {/* Security Events / Alerts for this User */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-primary" />
                    <h4 className="font-display font-bold text-sm text-foreground">
                      {isAr ? "التنبيهات والأحداث الأمنية للحساب" : "Identity Security Events"}
                    </h4>
                  </div>

                  {openAlertsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      {openAlertsCount} {isAr ? "تنبيه معلق" : "open alert"}
                    </span>
                  )}
                </div>

                {userAlerts.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      {isAr
                        ? "سجل الأمان نظيف: لا توجد تنبيهات أمنية أو محاولات دخول مشبوهة مسجلة لهذا الحساب."
                        : "Clean security status: No suspicious activity alerts recorded for this identity."}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userAlerts.map((alt: SecurityAlertRecord) => (
                      <div
                        key={alt.id}
                        className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{alt.title}</span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-muted border border-border/50">
                            {alt.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{alt.description}</p>
                      </div>
                    ))}
                    {onNavigateToSection && (
                      <div className="pt-1">
                        <SADAButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onNavigateToSection("audit");
                            onClose();
                          }}
                          className="h-8 px-2.5 text-xs rounded-xl"
                        >
                          <ExternalLink className="size-3.5 me-1.5" />
                          <span>{isAr ? "الانتقال إلى سجل التنبيهات والتدقيق" : "Inspect in Security & Audit"}</span>
                        </SADAButton>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Password Management */}
              <AccountSecurityPanel account={account} isSelf={isSelf} onSecurityUpdated={onUpdated} />
            </div>
          )}

          {/* TAB 6: DANGER ZONE */}
          {activeTab === "danger" && (
            <AccountDangerZone
              account={account}
              totalActiveSuperAdmins={totalActiveSuperAdmins}
              isSelf={isSelf}
              onActionCompleted={onUpdated}
              onCloseDrawer={onClose}
            />
          )}
        </div>
      </SADADrawer>

      {/* ROLE CHANGE IMPACT CONFIRMATION MODAL */}
      <SADADialog
        open={showRoleImpactModal && Boolean(pendingRole)}
        onOpenChange={(open) => {
          if (!open) {
            setShowRoleImpactModal(false);
            setPendingRole(null);
          }
        }}
        size="compact"
        title={
          <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="size-5" />
            <span>Change Role to {pendingRole ? getRoleLabel(pendingRole) : ""}?</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRoleImpactModal(false);
                setPendingRole(null);
              }}
            >
              Cancel
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={confirmRoleChange}
              className="bg-primary text-white"
            >
              Confirm Role Change
            </SADAButton>
          </div>
        }
      >
        {pendingRole && (
          <div className="text-xs text-muted-foreground space-y-3">
            <p>
              You are about to modify the role of <strong>{displayName}</strong> from{" "}
              <span className="font-semibold text-foreground">{getRoleLabel(role)}</span> to{" "}
              <span className="font-semibold text-foreground">{getRoleLabel(pendingRole)}</span>.
            </p>

            {pendingRole === "worker" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                <strong>Impact:</strong> This account will lose access to:
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Company Finance & Salary Command Center</li>
                  <li>Account & Identity Management</li>
                  <li>Task Definition & Assignment capabilities</li>
                  <li>Admin-only operations pages</li>
                </ul>
              </div>
            )}

            {pendingRole === "admin" && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs">
                <strong>Impact:</strong> This account will gain access to:
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Operations, Workspaces, and Project Task definitions</li>
                  <li>Calendar planning & Team Workload oversight</li>
                  <li>(Finance and Account Management remain restricted to Super Admin)</li>
                </ul>
              </div>
            )}

            {pendingRole === "super_admin" && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs">
                <strong>Impact:</strong> This account will gain <strong>FULL ROOT CONTROL</strong>:
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Full Company Financial Command Center</li>
                  <li>Account creation, role modification & suspension</li>
                  <li>Permanent data deletion authorization</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </SADADialog>
    </>
  );
}
