import { useState } from "react";
import { SadaRole, getRoleLabel } from "@/lib/permissions";
import {
  createAccount,
  generateSecurePassword,
  type AccountStatus,
} from "@/lib/account-service";
import { upsertSalaryRecord } from "@/lib/finance-service";
import {
  SADA_MODULES,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
  getEffectiveModulePermission,
  type SadaModule,
  type UserModulePermissions,
} from "@/types/permissions";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import {
  X,
  User,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building,
  Briefcase,
  Phone,
  Mail,
  Activity,
  DollarSign,
  Lock,
  RotateCcw,
  Sliders,
  LayoutDashboard,
  Building2,
  CheckSquare,
  CalendarDays,
  Users,
  Target,
  Package,
  BarChart3,
  MessageSquare,
  Landmark,
  Wallet,
  FolderKanban,
  Workflow,
  Shield,
} from "lucide-react";
import { SADASelect } from "@/components/ui/sada-select";
import { SADACheckbox, SADADialog, SADAButton, SADASwitch } from "@/components/ui/sada-ui";

interface CreateAccountModalProps {
  onCreated: () => void;
  onClose: () => void;
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
  { key: "operations", label: "Operations", labelAr: "العمليات" },
  { key: "finance", label: "Finance", labelAr: "المالية" },
  { key: "content", label: "Content CMS", labelAr: "المحتوى" },
  { key: "admin", label: "Administration", labelAr: "إدارة النظام" },
] as const;

export function CreateAccountModal({ onCreated, onClose }: CreateAccountModalProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const roleOptions = [
    { value: "worker", label: isAr ? "عضو فريق (تنفيذ العمليات والمهام)" : "Worker (Operational execution & task assignments)" },
    { value: "admin", label: isAr ? "مدير نظام (المشاريع والعمليات وإشراف الفريق)" : "Admin (Operations, projects, calendar & team oversight)" },
    { value: "super_admin", label: isAr ? "مشرف متميز (تحكم جذري كامل والمالية والأمان)" : "Super Admin (Full root access, finance, deletion & security)" },
  ];

  const divisionOptions = [
    { value: "Development", label: isAr ? "التطوير البرمجي" : "Development" },
    { value: "Marketing", label: isAr ? "التسويق" : "Marketing" },
    { value: "Production", label: isAr ? "الإنتاج" : "Production" },
    { value: "Design", label: isAr ? "التصميم" : "Design" },
    { value: "Executive", label: isAr ? "الإدارة التنفيذية" : "Executive" },
  ];

  const statusOptions = [
    { value: "active", label: isAr ? "نشط (وصول فوري للنظام)" : "ACTIVE (Immediate Platform Access)" },
    { value: "pending", label: isAr ? "قيد الانتظار (بانتظار تفعيل التدفق)" : "PENDING (Pre-provisioned, Awaiting Workflow Activation)" },
    { value: "suspended", label: isAr ? "معلق (محظور الوصول)" : "SUSPENDED (Locked, Access Immediately Prohibited)" },
    { value: "disabled", label: isAr ? "معطل (مؤرشف / غير نشط)" : "DISABLED (Archived / Inactive)" },
  ];

  // Wizard steps: 1 = Identity, 2 = Permissions, 3 = Credentials, 4 = One-Time Reveal
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Identity
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SadaRole>("worker");
  const [division, setDivision] = useState("Development");
  const [position, setPosition] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [status, setStatus] = useState<AccountStatus>("active");
  const [createTeamMember, setCreateTeamMember] = useState(true);

  // Step 2: Module Permissions
  const [modulePermissions, setModulePermissions] = useState<UserModulePermissions>(() => ({
    ...ROLE_DEFAULT_MODULE_PERMISSIONS["worker"],
  }));

  // Step 3: Credentials
  const [password, setPassword] = useState(() => generateSecurePassword(16));
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Update permissions baseline when role changes
  const handleRoleChange = (newRole: SadaRole) => {
    setRole(newRole);
    setModulePermissions({ ...ROLE_DEFAULT_MODULE_PERMISSIONS[newRole] });
  };

  // Generate secure persistent password
  const handleGeneratePassword = () => {
    const p = generateSecurePassword(16);
    setPassword(p);
    toast.success(isAr ? "تم توليد كلمة مرور آمنة ومشفرة" : "Generated cryptographically secure password");
  };

  const handleNextToPermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError(isAr ? "الاسم الكامل مطلوب." : "Full name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError(isAr ? "عنوان بريد إلكتروني صالح مطلوب." : "A valid email address is required.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleToggleModule = (modKey: SadaModule, checked: boolean) => {
    if (modKey === "accounts") {
      toast.error(
        isAr
          ? "إدارة الحسابات مخصصة حصرياً للمشرف المتميز ولا يمكن تفويضها."
          : "Account Management is root-exclusive to Super Admin and cannot be delegated."
      );
      return;
    }
    setModulePermissions((prev) => ({
      ...prev,
      [modKey]: checked,
    }));
  };

  // Preset: Worker Operational Profile (Dashboard, Clients, Tasks, Calendar ON; Finance, Sales OFF)
  const handleApplyWorkerPreset = () => {
    setModulePermissions({
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
    });
    toast.success(isAr ? "تم تطبيق نمط الموظف: العمليات فقط" : "Applied Worker Profile: Operations Only");
  };

  // Preset: Admin Operational Oversight
  const handleApplyAdminPreset = () => {
    setModulePermissions({
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
      finance: false,
      workflows: false,
      business_rules: false,
      accounts: false,
    });
    toast.success(isAr ? "تم تطبيق نمط المدير: العمليات والإشراف" : "Applied Admin Profile: Operations & Oversight");
  };

  const handleCreateAccount = async () => {
    if (!password || password.length < 8) {
      setError(isAr ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل." : "Password must be at least 8 characters long.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const provResult = await createAccount({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        division,
        position: position.trim() || (isAr ? "مختص" : "Specialist"),
        phone: phone.trim() || undefined,
        createTeamMember,
        status,
        modulePermissions,
      });

      if (provResult?.team_member_id && baseSalary.trim()) {
        const numSal = parseFloat(baseSalary);
        if (!isNaN(numSal) && numSal >= 0) {
          await upsertSalaryRecord({
            teamMemberId: provResult.team_member_id,
            baseAmount: numSal,
            salaryType: "monthly",
            paymentFrequency: "monthly",
            paymentMethod: "Bank Transfer",
            status: "active",
            effectiveDate: format(new Date(), "yyyy-MM-dd"),
          });
        }
      }

      toast.success(isAr ? "تمت تهيئة الحساب وتعيين الصلاحيات بنجاح" : "Account and permissions provisioned successfully");
      setStep(4);
    } catch (err: any) {
      console.error("Account creation failure:", err);
      setError(err?.message || (isAr ? "فشل إنشاء الحساب." : "Failed to create account."));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCredentials = async () => {
    const creds = `بيانات اعتماد منصة صدى / SADA Credentials\nالبريد الإلكتروني / Email: ${email.trim()}\nكلمة المرور / Password: ${password}\nالصلاحية / Role: ${getRoleLabel(role)}\nالرابط / Portal: ${window.location.origin}/auth`;
    await navigator.clipboard.writeText(creds);
    setCopied(true);
    toast.success(isAr ? "تم نسخ بيانات الاعتماد إلى الحافظة" : "Credentials copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFinish = () => {
    onCreated();
    onClose();
  };

  return (
    <SADADialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      size="default"
      title={
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 grid place-items-center shrink-0 shadow-sm">
            <ShieldCheck className="size-4.5" />
          </div>
          <div>
            <span className="font-display font-bold text-base text-foreground block">
              {step === 4
                ? (isAr ? "بيانات اعتماد الحساب جاهزة" : "Account Credentials Ready")
                : (isAr ? "تهيئة حساب صدى جديد" : "Provision SADA Account")}
            </span>
          </div>
        </div>
      }
      description={
        step === 1
          ? (isAr ? "الخطوة 1 من 3: الهوية والدور التشغيلي" : "Step 1 of 3: Identity & Role")
          : step === 2
          ? (isAr ? "الخطوة 2 من 3: صلاحيات الوحدات والصفحات" : "Step 2 of 3: Module & Page Permissions")
          : step === 3
          ? (isAr ? "الخطوة 3 من 3: الأمان وبيانات الاعتماد الأولية" : "Step 3 of 3: Security & Initial Password")
          : (isAr ? "كشف بيانات الاعتماد لمرة واحدة فقط" : "One-time session credentials reveal")
      }
      showCloseButton={step !== 4}
      footer={
        step === 1 ? (
          <>
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
              form="step1-form"
              variant="primary"
              size="sm"
              className="bg-primary text-white cursor-pointer"
            >
              <span>{isAr ? "التالي: الصلاحيات" : "Next: Permissions"}</span>
              <ArrowRight className={`size-3.5 ${isAr ? "mr-1 rotate-180" : "ml-1"}`} />
            </SADAButton>
          </>
        ) : step === 2 ? (
          <>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="cursor-pointer"
            >
              <ArrowLeft className={`size-3.5 ${isAr ? "ml-1 rotate-180" : "mr-1"}`} />
              <span>{isAr ? "السابق" : "Back"}</span>
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setStep(3)}
              className="bg-primary text-white cursor-pointer"
            >
              <span>{isAr ? "التالي: بيانات الاعتماد" : "Next: Credentials"}</span>
              <ArrowRight className={`size-3.5 ${isAr ? "mr-1 rotate-180" : "ml-1"}`} />
            </SADAButton>
          </>
        ) : step === 3 ? (
          <>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(2)}
              className="cursor-pointer"
            >
              <ArrowLeft className={`size-3.5 ${isAr ? "ml-1 rotate-180" : "mr-1"}`} />
              <span>{isAr ? "السابق" : "Back"}</span>
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreateAccount}
              isLoading={saving}
              disabled={saving}
              className="bg-primary text-white cursor-pointer"
            >
              <span>{saving ? (isAr ? "جاري الإنشاء..." : "Provisioning...") : (isAr ? "تأكيد وإنشاء الحساب" : "Confirm & Create")}</span>
            </SADAButton>
          </>
        ) : (
          <div className="w-full flex items-center justify-end gap-2.5">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCredentials}
              className="cursor-pointer"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500 ms-1" />
              ) : (
                <Copy className="size-3.5 ms-1" />
              )}
              <span>{copied ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ بيانات الاعتماد" : "Copy Credentials")}</span>
            </SADAButton>
            <SADAButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleFinish}
              className="bg-primary text-white cursor-pointer"
            >
              {isAr ? "تم الانتهاء" : "Done"}
            </SADAButton>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <form id="step1-form" onSubmit={handleNextToPermissions} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "الاسم الكامل *" : "Full Name *"}
                </label>
                <div className="relative">
                  <User className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    required
                    type="text"
                    placeholder={isAr ? "مثال: سارة الطرابلسي" : "e.g. Maya Trabelsi"}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "عنوان البريد الإلكتروني (هوية تسجيل الدخول) *" : "Email Address (Login Identity) *"}
                </label>
                <div className="relative">
                  <Mail className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    required
                    type="email"
                    dir="ltr"
                    placeholder="specialist@sada.tn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "رقم الهاتف" : "Phone Number"}
                </label>
                <div className="relative">
                  <Phone className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="+216 98 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "الرتبة والدور الأساسي *" : "Primary Role & Access Level *"}
                </label>
                <SADASelect
                  value={role}
                  onChange={(val) => handleRoleChange(val as SadaRole)}
                  options={roleOptions}
                  placeholder={isAr ? "اختر الصلاحية" : "Select Role"}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "القسم / التخصص" : "Division / Department"}
                </label>
                <SADASelect
                  value={division}
                  onChange={(val) => setDivision(val)}
                  options={divisionOptions}
                  placeholder={isAr ? "اختر القسم" : "Select Division"}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "المسمى الوظيفي" : "Position Title"}
                </label>
                <div className="relative">
                  <Briefcase className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder={isAr ? "مثال: مخرج إعلاني / ممنتج" : "e.g. Lead Video Editor"}
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "الراتب الشهري الأساسي (TND)" : "Base Monthly Compensation (TND)"}
                </label>
                <div className="relative">
                  <DollarSign className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="1400"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl glass border border-border/80 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-start"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {isAr ? "الحالة الأولية لدورة حياة الحساب *" : "Initial Account Lifecycle Status *"}
                </label>
                <SADASelect
                  value={status}
                  onChange={(val) => setStatus(val as AccountStatus)}
                  options={statusOptions}
                  placeholder={isAr ? "اختر الحالة" : "Select Status"}
                />
              </div>
            </div>

            {/* Team Member Checkbox */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 mt-2">
              <SADACheckbox
                id="create-tm"
                checked={createTeamMember}
                onCheckedChange={(checked) => setCreateTeamMember(Boolean(checked))}
                label={isAr ? "إنشاء ملف عضو فريق تشغيلي" : "Create Team Member Profile"}
                description={
                  isAr
                    ? "يقوم تلقائياً بتهيئة عضو فريق تشغيلي مرتبط بهذا الحساب لإسناد المهام ومتابعة عبء العمل في التقويم."
                    : "Automatically provisions an operational team member linked to this account for task assignments and team workload."
                }
              />
            </div>
          </form>
        )}

        {/* STEP 2: MODULE & PAGE PERMISSIONS */}
        {step === 2 && (
          <div className="space-y-4 max-h-[58vh] overflow-y-auto pe-1">
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  {isAr ? "تخصيص صلاحيات الوحدات للعضو" : "Member Module Access Control"}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {isAr
                    ? `الرتبة المحددة: ${getRoleLabel(role)}. يمكنك تفعيل أو تعطيل أي صفحة صراحة.`
                    : `Role: ${getRoleLabel(role)}. You can explicitly enable or disable any module.`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <SADAButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyWorkerPreset}
                  className="text-[11px] h-7 px-2.5"
                  title="Worker Preset"
                >
                  {isAr ? "نمط موظف" : "Worker"}
                </SADAButton>
                <SADAButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyAdminPreset}
                  className="text-[11px] h-7 px-2.5"
                  title="Admin Preset"
                >
                  {isAr ? "نمط مدير" : "Admin"}
                </SADAButton>
              </div>
            </div>

            {/* Modules by category */}
            <div className="space-y-4">
              {CATEGORIES.map((cat) => {
                const catMods = SADA_MODULES.filter((m) => m.category === cat.key);
                if (catMods.length === 0) return null;

                return (
                  <div key={cat.key} className="space-y-2">
                    <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider block">
                      {isAr ? cat.labelAr : cat.label}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catMods.map((mod) => {
                        const Icon = MODULE_ICONS[mod.key] || Shield;
                        const isEnabled = getEffectiveModulePermission(mod.key, role, modulePermissions);
                        const isAccountsRoot = mod.key === "accounts";

                        return (
                          <div
                            key={mod.key}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                              isEnabled
                                ? "bg-card border-border/90 shadow-2xs"
                                : "bg-muted/20 border-border/40 opacity-70"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`size-7 rounded-lg grid place-items-center shrink-0 border ${
                                  isEnabled
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                <Icon className="size-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate block">
                                  {isAr ? mod.labelAr : mod.label}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground truncate block" dir="ltr">
                                  {mod.path}
                                </span>
                              </div>
                            </div>

                            <SADASwitch
                              checked={isEnabled}
                              onCheckedChange={(ch) => handleToggleModule(mod.key, ch)}
                              disabled={isAccountsRoot && role !== "super_admin"}
                              size="sm"
                              className="cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: CREDENTIALS */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-start">
              <div className="text-[11px] font-mono uppercase text-muted-foreground">
                {isAr ? "الحساب قيد الإنشاء:" : "Account Being Created:"}
              </div>
              <div className="text-sm font-bold text-foreground mt-0.5">{displayName}</div>
              <div className="text-xs text-muted-foreground font-mono" dir="ltr">{email}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-semibold">
                <ShieldCheck className="size-3" />
                <span>{isAr ? "الصلاحية: " : "Role: "}{getRoleLabel(role)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  {isAr ? "كلمة المرور الأولية *" : "Initial Password *"}
                </label>
                <SADAButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePassword}
                  className="text-xs text-primary hover:underline flex items-center gap-1 h-auto p-0"
                >
                  <Sparkles className="size-3" />
                  <span>{isAr ? "توليد كلمة مرور قوية" : "Generate New Secure"}</span>
                </SADAButton>
              </div>

              <div className="relative">
                <KeyRound className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full ps-9 pe-10 py-2.5 rounded-xl glass border border-border/80 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-start"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground text-start">
                {isAr
                  ? "الحد الأدنى 8 أحرف. ستكون هذه كلمة المرور الدائمة للحساب، وتستطيع نسخها وتزويدها للمستخدم فور الانتهاء."
                  : "Minimum 8 characters. This will be the account's persistent password, and you can copy and provide it to the user once created."}
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: ONE-TIME REVEAL */}
        {step === 4 && (
          <div className="space-y-4 py-2 text-center">
            <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 grid place-items-center mx-auto shadow-sm">
              <CheckCircle2 className="size-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold font-display text-foreground">
                {isAr ? "تم إنشاء الحساب بنجاح" : "Account Successfully Created"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "تمت تهيئة الحساب وضبط الصلاحيات بنجاح. يُرجى نسخ بيانات اعتماد الحساب الآن وتزويد المستخدم بها."
                  : "The account and permissions have been provisioned. Please copy the account credentials now to share them with the account owner."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 text-start space-y-2.5 font-mono text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">{isAr ? "المستخدم:" : "User:"}</span>
                <span className="font-semibold text-foreground">{displayName}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">{isAr ? "البريد الإلكتروني (تسجيل الدخول):" : "Email (Login):"}</span>
                <span className="text-foreground" dir="ltr">{email}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">{isAr ? "كلمة مرور الحساب (دائمة):" : "Account Password (Persistent):"}</span>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted border border-border mt-0.5">
                  <span className="text-foreground font-bold tracking-wider" dir="ltr">{password}</span>
                  <SADAButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyCredentials}
                    className="size-7 text-primary hover:text-primary/80"
                    title={isAr ? "نسخ كلمة المرور" : "Copy Password"}
                  >
                    {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                  </SADAButton>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-start text-xs">
              <strong>{isAr ? "تنبيه أمني هام:" : "Important:"}</strong>{" "}
              {isAr
                ? "لا يتم حفظ كلمات المرور كنص صريح على الإطلاق ولا يمكن استعادتها بعد إغلاق هذه النافذة. احرص على نسخ البيانات وتزويدها للعضو الآن."
                : "Passwords are never stored in plaintext and cannot be retrieved again after closing this window. Ensure you copy the credentials now."}
            </div>
          </div>
        )}
      </div>
    </SADADialog>
  );
}
