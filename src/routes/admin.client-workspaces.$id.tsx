import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Building2, ArrowLeft, Plus, Pencil, Phone, Mail, MessageSquare,
  ExternalLink, Briefcase, Calendar, User, Clock, CheckCircle2,
  AlertTriangle, ShieldCheck, Tag, FileText, ChevronRight, ChevronLeft, X,
  Trash2, PhoneCall, Sparkles, Repeat, Zap, Check, AlertCircle,
  FolderKanban, History, ArrowRight, Layers, Users, DollarSign,
  TrendingUp, Coins, CreditCard, Award, ArrowUpRight, Play, Eye,
  FileEdit, CheckSquare, BarChart3, Globe, Save, Pause, Loader2, Workflow,
  Filter, Search, ChevronDown, CheckCheck, ArrowDownLeft, TrendingDown,
  Archive, RotateCcw
} from "lucide-react";
import {
  type ClientRow,
  type ClientStatus,
  type PackageConfig,
  CLIENT_STATUS_CONFIG,
  type ProjectRow,
  type TaskRow,
  type ProfileRow,
  type TeamMemberRow,
  computeProgress,
  computeProjectHealth,
  computeNextAction,
  computeMonthlyProgress,
  formatPeriodMonth,
  getCurrentPeriodMonth,
  normalizeEmail,
  normalizePhone,
  resolveToProfileId,
  resolveToTeamMemberId,
  formatClientErrorMessage,
  isTaskOverdue
} from "@/components/admin/project-utils";
import { CalendarGrid } from "@/components/admin/CalendarGrid";
import { permissions, normalizeRole } from "@/lib/permissions";
import { format, parseISO, addMonths, subMonths } from "date-fns";
import { formatCurrency, type FinancialAccount, type ExpenseCategory } from "@/types/finance";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADASelect } from "@/components/ui/sada-select";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADACounter, SADAInput, SADASwitch, SADAButton, SADAEmptyState, ClientWorkspaceSkeleton } from "@/components/ui/sada-ui";
import {
  type ClientDeliverableRow,
  type ProductionBookingRow,
  type PackageRow,
  type ProductionStage,
  PRODUCTION_WORKFLOW_STEPS,
  updateDeliverableProgress,
  advanceProductionStage,
} from "@/lib/sales-service";
import { useTranslation } from "@/i18n";
import { ServiceCommitmentModal } from "@/components/admin/ServiceCommitmentModal";
import { TaskModal } from "@/components/admin/TaskModal";
import { TaskDetailModal } from "@/components/admin/TaskDetailModal";
import {
  fetchClientCommitments,
  updateCommitmentStatus,
  deleteServiceCommitment,
  generateCommitmentTasks,
  deriveCommitmentsFromPackage,
  saveServiceCommitment,
} from "@/lib/recurring-scheduling-service";
import {
  resolveAuthoritativePackageConfig,
  reconcileClientPackageWork,
  previewPackageReconciliation,
  type AuthoritativePackageState,
} from "@/lib/package-reconciliation-service";
import type { ServiceCommitment } from "@/types/service-commitment";
import { RecordIncomeModal } from "@/components/admin/finance/RecordIncomeModal";
import { RecordExpenseModal } from "@/components/admin/finance/RecordExpenseModal";
import { CreateInvoiceModal } from "@/components/admin/finance/CreateInvoiceModal";
import { RecordInvoicePaymentModal } from "@/components/admin/finance/RecordInvoicePaymentModal";
import { CreateSponsoringModal } from "@/components/admin/finance/CreateSponsoringModal";
import { calculateClientFinancials } from "@/lib/finance-service";
import type { ClientProfitabilityHealth } from "@/types/finance";
import { DeleteClientDialog } from "@/components/admin/DeleteClientDialog";
import { ArchiveClientDialog } from "@/components/admin/ArchiveClientDialog";

export const Route = createFileRoute("/admin/client-workspaces/$id")({
  component: Client360UnifiedConsole,
});

export type WorkspaceTab =
  | "overview"
  | "services"
  | "delivery"
  | "team"
  | "financial"
  | "notes"
  | "history"
  // Legacy aliases for backward compatibility
  | "package"
  | "deliverables"
  | "tasks"
  | "production"
  | "sponsoring"
  | "invoices"
  | "payments"
  | "performance";

function normalizeTab(t: string): WorkspaceTab {
  switch (t) {
    case "package":
      return "services";
    case "deliverables":
    case "tasks":
    case "production":
      return "delivery";
    case "sponsoring":
    case "invoices":
    case "payments":
    case "finance":
      return "financial";
    case "performance":
      return "overview";
    default:
      return t as WorkspaceTab;
  }
}

export function Client360UnifiedConsole() {
  const { id } = Route.useParams();
  const { user, role, isSuperAdmin, isAdmin } = useAuth();
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const nav = useNavigate();
  const canAccessFinance = isSuperAdmin || isAdmin;
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canEdit = permissions.canEditClient(permCtx);

  const getStatusLabel = (status: ClientStatus | string) => {
    if (!isAr) return CLIENT_STATUS_CONFIG[status as ClientStatus]?.label || status;
    switch (status) {
      case "active": return "نشط";
      case "inactive": return "غير نشط";
      case "prospect": return "محتمل";
      case "archived": return "مؤرشف";
      case "lead": return "عميل محتمل";
      case "churned": return "منقطع";
      default: return CLIENT_STATUS_CONFIG[status as ClientStatus]?.label || status;
    }
  };

  const getDeliverableTypeLabel = (type: string) => {
    if (!isAr) return type;
    switch (type?.toLowerCase()) {
      case "reel":
      case "reels":
        return "ريلز";
      case "post":
      case "posts":
        return "منشور";
      case "story":
      case "stories":
        return "قصة (ستوري)";
      case "campaign":
      case "ads_campaign":
        return "حملة إعلانية";
      case "video":
        return "فيديو";
      case "design":
      case "branding":
        return "تصميم وهويّة";
      case "photo":
      case "photography":
        return "تصوير فوتوغرافي";
      default:
        return type || "أخرى";
    }
  };

  const getHealthBadge = (health?: ClientProfitabilityHealth | null) => {
    if (!health) return isAr ? "غير محدد" : "INDETERMINATE";
    if (!isAr) {
      if (health === "NO DATA") return "NO DATA";
      return health;
    }
    switch (health) {
      case "HIGH PROFIT": return "ربحية مرتفعة · أداء مستقر";
      case "MEDIUM": return "متوسط · أداء منتظم";
      case "LOW PROFIT": return "ربحية منخفضة · يتطلب مراجعة";
      case "NO DATA": return "لا توجد بيانات مالية كافية";
      default: return health;
    }
  };

  const getPaymentStatusBadge = (st?: "PAID" | "PENDING" | "OVERDUE") => {
    if (!isAr) return st || "PAID";
    switch (st) {
      case "PAID": return "مسدد بالكامل";
      case "PENDING": return "قيد السداد";
      case "OVERDUE": return "متأخر";
      default: return st;
    }
  };

  const getProductionStepLabel = (step: string) => {
    if (!isAr) return step.replace("_", " ").toUpperCase();
    const map: Record<string, string> = {
      brief: "الموجز الإبداعي",
      scheduled: "مجدول",
      shooting: "التصوير الميداني",
      raw_upload: "رفع المواد الخام",
      editing: "المونتاج والمعالجة",
      review: "المراجعة الداخلية",
      client_approval: "اعتماد العميل",
      delivered: "التسليم والنشر",
    };
    return (map[step] || step.replace("_", " ")).toUpperCase();
  };

  const getProductionTypeLabel = (type: string) => {
    if (!isAr) return type.replace("_", " ");
    const map: Record<string, string> = {
      reels_shoot: "جلسة تصوير ريلز وفيديو",
      photoshoot: "جلسة تصوير فوتوغرافي",
      commercial: "إنتاج إعلاني تجاري",
      event: "تغطية فعالية",
    };
    return map[type] || type.replace("_", " ");
  };

  const getPriorityLabel = (priority?: string) => {
    if (!isAr) return priority || "normal";
    switch (priority) {
      case "urgent": return "عاجل جداً";
      case "high": return "أولوية عالية";
      case "medium": return "متوسط";
      case "low": return "منخفض";
      default: return "عادي";
    }
  };

  // Tab State (Default to overview, synchronized with URL query)
  const [activeTab, setActiveTabRaw] = useState<WorkspaceTab>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get("tab");
      if (tabParam) return normalizeTab(tabParam);
    }
    return "overview";
  });

  const setActiveTab = (t: WorkspaceTab) => {
    const normalized = normalizeTab(t);
    setActiveTabRaw(normalized);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", normalized);
      window.history.replaceState({}, "", url.toString());
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handlePopState = () => {
        const sp = new URLSearchParams(window.location.search);
        const tabParam = sp.get("tab");
        if (tabParam) setActiveTabRaw(normalizeTab(tabParam));
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, []);

  // Core Data
  const [client, setClient] = useState<ClientRow | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [deliverables, setDeliverables] = useState<ClientDeliverableRow[]>([]);
  const [productionBookings, setProductionBookings] = useState<ProductionBookingRow[]>([]);
  const [linkedPackage, setLinkedPackage] = useState<PackageRow | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sponsoring, setSponsoring] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial Modals & Ledger Filter State
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [showSponsoringModal, setShowSponsoringModal] = useState(false);
  const [financeLedgerTab, setFinanceLedgerTab] = useState<"all" | "income" | "expense" | "invoices" | "sponsoring">("all");
  const [financeSearch, setFinanceSearch] = useState("");

  // Deliverables & Production Modals
  const [showNewDeliverableModal, setShowNewDeliverableModal] = useState(false);
  const [newDelivTitle, setNewDelivTitle] = useState("");
  const [newDelivType, setNewDelivType] = useState<any>("reel");
  const [newDelivTarget, setNewDelivTarget] = useState(8);
  const [newDelivDeadline, setNewDelivDeadline] = useState("");
  const [savingDeliverable, setSavingDeliverable] = useState(false);

  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [newBookingTitle, setNewBookingTitle] = useState("");
  const [newBookingDate, setNewBookingDate] = useState("");
  const [newBookingTime, setNewBookingTime] = useState("10:00");
  const [newBookingLocation, setNewBookingLocation] = useState("SADA Studio / On-Location");
  const [newBookingType, setNewBookingType] = useState("reels_shoot");
  const [newBookingDuration, setNewBookingDuration] = useState(3);
  const [newBookingTeamIds, setNewBookingTeamIds] = useState<string[]>([]);
  const [newBookingReels, setNewBookingReels] = useState(8);
  const [newBookingPhotos, setNewBookingPhotos] = useState(25);
  const [newBookingEquipment, setNewBookingEquipment] = useState("Sony A7IV, Gimbal, Wireless Mics, Softbox 90cm");
  const [savingBooking, setSavingBooking] = useState(false);

  // Task Modal & Task Detail Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [inspectingTask, setInspectingTask] = useState<TaskRow | null>(null);

  // Month Period Navigation State (for Monthly Delivery Center)
  const currentSystemPeriod = getCurrentPeriodMonth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentSystemPeriod);

  // Interactive Notes & Memory State
  const [notesContent, setNotesContent] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showDirectivesEditor, setShowDirectivesEditor] = useState(false);
  const [editingDirectiveCategory, setEditingDirectiveCategory] = useState<string | null>(null);
  const [categoryDraftText, setCategoryDraftText] = useState<string>("");

  // Delivery Filter State
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("all");
  const [deliveryViewMode, setDeliveryViewMode] = useState<"tasks" | "ledger" | "pipeline" | "calendar">("tasks");
  const [attentionFilter, setAttentionFilter] = useState<"all" | "overdue" | "blocked" | "waiting" | "urgent">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [activeSection, setActiveSection] = useState<string>("overview-section");
  const [memoryCategory, setMemoryCategory] = useState<"all" | "brand" | "content" | "preferences" | "approval" | "restrictions" | "instructions">("all");

  // Programmatic Scroll Lock Ref to prevent scroll spy flicker
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 850);

    if (typeof window !== "undefined") {
      const mainEl = document.querySelector("#sada-admin-main") as HTMLElement;
      const targetEl = document.getElementById(sectionId);
      const stickyNav = (document.querySelector("#client-360-nav-wrapper") ||
        document.querySelector("[data-testid='client-360-sticky-nav']") ||
        document.querySelector(".client-360-sticky-nav") ||
        document.querySelector(".sticky")) as HTMLElement;

      if (sectionId === "overview-section" && mainEl) {
        mainEl.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (mainEl && targetEl) {
        const mainRect = mainEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const navRect = stickyNav ? stickyNav.getBoundingClientRect() : null;
        
        // Navigation bottom edge relative to main scroll viewport
        const navBottomRel = navRect ? (navRect.bottom - mainRect.top) : 80;
        // Guaranteed clearance: 24px buffer between sticky nav and section heading
        const clearance = 24;
        const currentTargetTopRel = targetRect.top - mainRect.top;
        const scrollDelta = currentTargetTopRel - (navBottomRel + clearance);
        const scrollTarget = mainEl.scrollTop + scrollDelta;

        mainEl.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      } else if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // History Filter State
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>("all");

  // Service Commitments & Recurring Scheduling State
  const [commitments, setCommitments] = useState<ServiceCommitment[]>([]);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<ServiceCommitment | null>(null);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // Edit Client Modal
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPreferredChannel, setEditPreferredChannel] = useState("whatsapp");
  const [editStatus, setEditStatus] = useState<ClientStatus>("active");
  const [editAccountManagerId, setEditAccountManagerId] = useState("");
  const [editSalesOwnerId, setEditSalesOwnerId] = useState("");
  const [editMonthlyRate, setEditMonthlyRate] = useState<number>(0);
  const [editSponsoringBudget, setEditSponsoringBudget] = useState<number>(0);
  const [savingEditClient, setSavingEditClient] = useState(false);

  // Lifecycle Modals (Permanent Deletion & Archiving)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveDialogMode, setArchiveDialogMode] = useState<"archive" | "restore">("archive");

  // Edit Package Modal (Monthly Clients) with Pricing Calculation
  const [showEditPackageModal, setShowEditPackageModal] = useState(false);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [pkgNameInput, setPkgNameInput] = useState("");
  const [pkgPriceInput, setPkgPriceInput] = useState<number>(0);
  const [reelsQuotaInput, setReelsQuotaInput] = useState(0);
  const [postsQuotaInput, setPostsQuotaInput] = useState(0);
  const [storiesQuotaInput, setStoriesQuotaInput] = useState(0);
  const [otherServicesInput, setOtherServicesInput] = useState<string[]>([]);
  const [savingPackage, setSavingPackage] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const loadCommitments = async () => {
    if (!id) return;
    const data = await fetchClientCommitments(id);
    setCommitments(data);
  };

  const handleToggleCommitmentStatus = async (commitment: ServiceCommitment) => {
    const nextStatus = commitment.status === "active" ? "paused" : "active";
    const res = await updateCommitmentStatus(commitment.id, id, nextStatus, user?.id);
    if (res.success) {
      toast.success(
        nextStatus === "active"
          ? isAr
            ? "تم استئناف الالتزام بنجاح — سيستمر التوليد المستقبلي"
            : "Commitment resumed — future generation will continue"
          : isAr
          ? "تم إيقاف الالتزام مؤقتاً — تم تعليق التوليد المستقبلي مع الاحتفاظ بالتاريخ"
          : "Commitment paused — future generation suspended, history preserved"
      );
      loadCommitments();
    } else {
      toast.error(res.error || (isAr ? "فشل تعديل الحالة" : "Failed to update status"));
    }
  };

  const handleDeleteCommitment = async (commitmentId: string) => {
    const res = await deleteServiceCommitment(commitmentId, id, user?.id);
    if (res.success) {
      toast.success(isAr ? "تم حذف الالتزام بنجاح" : "Service commitment removed");
      loadCommitments();
    } else {
      toast.error(res.error || (isAr ? "فشل الحذف" : "Failed to delete"));
    }
  };

  const handleAutoDeriveCommitments = async () => {
    if (!linkedPackage && !client?.package_config) {
      toast.warning(
        isAr
          ? "لم يتم ربط باقة بهذا العميل لاشتقاق الالتزامات منها."
          : "No package linked to derive commitments from."
      );
      return;
    }
    const pkgObj = linkedPackage || {
      id: client?.package_id,
      name: client?.package_name || "Custom Client Package",
      monthly_reels: client?.package_config?.reels_quota || 0,
      monthly_posts: client?.package_config?.posts_quota || 0,
      monthly_stories: client?.package_config?.stories_quota || 0,
    };
    const derived = deriveCommitmentsFromPackage(pkgObj, id);
    let count = 0;
    for (const c of derived) {
      await saveServiceCommitment(c as any, user?.id);
      count++;
    }
    toast.success(
      isAr
        ? `تم اشتقاق ${count} التزامات تعاقدية من الباقة بنجاح!`
        : `Derived ${count} service commitments from package!`
    );
    loadCommitments();
  };

  const handleGenerateCommitmentTasks = async () => {
    if (!id) return;
    setGeneratingTasks(true);
    const res = await generateCommitmentTasks({
      clientId: id,
      periodMonth: selectedPeriod,
      actorId: user?.id,
      teamMembers,
      profiles,
    });
    setGeneratingTasks(false);

    if (res.success) {
      if (res.tasks_created > 0) {
        toast.success(
          isAr
            ? `تم توليد ${res.tasks_created} مهمة وتسليم بنجاح (${res.tasks_skipped_existing} تم تخطيها كسابقة لمنع التكرار)!`
            : `Generated ${res.tasks_created} tasks (${res.tasks_skipped_existing} skipped as existing - idempotent)!`
        );
      } else if (res.tasks_skipped_paused > 0) {
        toast.info(
          isAr
            ? "العميل أو الالتزام معلق مؤقتاً: تم تعليق التوليد المستقبلي مع الحفاظ على المهام السابقة."
            : "Client or commitment is paused: future generation suspended, history preserved."
        );
      } else if (res.tasks_skipped_existing > 0) {
        toast.info(
          isAr
            ? `جميع التسليمات (${res.tasks_skipped_existing}) موجودة مسبقاً لهذا الشهر — لم يتم إنشاء أي تكرار!`
            : `All ${res.tasks_skipped_existing} deliverables already exist for this month — 0 duplicates created!`
        );
      } else {
        toast.info(
          isAr
            ? "لا توجد التزامات نشطة للتوليد لهذا الشهر."
            : "No active commitments to generate for this month."
        );
      }
      loadClientData(true);
    } else {
      toast.error(res.error || (isAr ? "فشل توليد التسليمات" : "Failed to generate deliverables"));
    }
  };

  // Fallback tab if non-financial role
  useEffect(() => {
    if (!canAccessFinance && ["financial", "sponsoring", "invoices", "payments", "performance"].includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [canAccessFinance, activeTab]);

  const loadClientData = async (isBackground = false) => {
    if (!isBackground && !client) {
      setLoading(true);
    }

    const [clientRes, profRes, teamRes, projRes, tasksRes, invRes, sponsRes, payRes, expRes, accRes, catRes, delivRes, prodRes] = await Promise.all([
      (supabase as any).from("clients").select("*").eq("id", id).single(),
      (supabase as any).from("profiles").select("id, display_name"),
      (supabase as any).from("team_members").select("*").order("sort_order", { ascending: true }),
      (supabase as any).from("client_projects").select("*").eq("client_id", id).order("updated_at", { ascending: false }),
      (supabase as any).from("project_tasks").select("*").eq("client_id", id).order("sort_order", { ascending: true }),
      canAccessFinance ? (supabase as any).from("invoices").select("*").eq("client_id", id).order("issue_date", { ascending: false }) : Promise.resolve({ data: [] }),
      canAccessFinance ? (supabase as any).from("sponsoring_campaigns").select("*").eq("client_id", id).order("date", { ascending: false }) : Promise.resolve({ data: [] }),
      canAccessFinance ? (supabase as any).from("income_transactions").select("*").eq("client_id", id).order("date", { ascending: false }) : Promise.resolve({ data: [] }),
      canAccessFinance ? (supabase as any).from("expense_transactions").select("*").eq("client_id", id).order("date", { ascending: false }) : Promise.resolve({ data: [] }),
      canAccessFinance ? (supabase as any).from("financial_accounts").select("*").order("name", { ascending: true }) : Promise.resolve({ data: [] }),
      canAccessFinance ? (supabase as any).from("expense_categories").select("*").order("sort_order", { ascending: true }) : Promise.resolve({ data: [] }),
      (supabase as any).from("client_deliverables").select("*").eq("client_id", id).order("created_at", { ascending: true }),
      (supabase as any).from("production_bookings").select("*").eq("client_id", id).order("date", { ascending: true }),
    ]);

    if (clientRes.error || !clientRes.data) {
      toast.error(isAr ? "لم يتم العثور على سجل العميل" : "Client not found");
      setLoading(false);
      return;
    }

    const currentClient: ClientRow = clientRes.data;
    setClient(currentClient);
    setProfiles(profRes.data || []);
    setTeamMembers(teamRes.data || []);
    setProjects(projRes.data || []);
    setTasks(tasksRes.data || []);
    setInvoices(invRes.data || []);
    setSponsoring(sponsRes.data || []);
    setPayments(payRes.data || []);
    setExpenses(expRes.data || []);
    setAccounts(accRes.data || []);
    setExpenseCategories(catRes.data || []);
    setDeliverables(delivRes.data || []);
    setProductionBookings(prodRes.data || []);
    setNotesContent(currentClient.notes || "");

    // Fetch canonical catalog packages for picker
    const { data: catPkgs } = await (supabase as any)
      .from("package_catalog")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    setAvailablePackages(catPkgs || []);

    // Fetch linked package if client has package_id
    let pCatalog: any = null;
    if (currentClient.package_id) {
      setSelectedPackageId(currentClient.package_id);
      const { data } = await (supabase as any)
        .from("package_catalog")
        .select("*")
        .eq("id", currentClient.package_id)
        .maybeSingle();

      pCatalog = data;
      setLinkedPackage(pCatalog || null);
    } else {
      setLinkedPackage(null);
      setSelectedPackageId("");
    }

    // Populate Edit Defaults
    setEditName(currentClient.name);
    setEditIndustry(currentClient.industry || "");
    setEditContactName(currentClient.contact_name || "");
    setEditEmail(currentClient.email || "");
    setEditPhone(currentClient.phone || "");
    setEditPreferredChannel(currentClient.preferred_channel || "whatsapp");
    setEditStatus(currentClient.status);
    setEditAccountManagerId(currentClient.account_manager_id || currentClient.relationship_owner_id || "");
    setEditSalesOwnerId(currentClient.commission_recipient_id || currentClient.sales_owner_id || "");
    const baseRate = Number(currentClient.monthly_package_price || currentClient.default_service_fee || 0);
    setEditMonthlyRate(baseRate);
    setPkgPriceInput(baseRate);
    setEditSponsoringBudget(Number(currentClient.default_sponsoring_budget || 0));

    const authState = resolveAuthoritativePackageConfig(currentClient, pCatalog);
    setPkgNameInput(authState.package_name);
    setReelsQuotaInput(authState.quotas.reels);
    setPostsQuotaInput(authState.quotas.posts);
    setStoriesQuotaInput(authState.quotas.stories);
    setOtherServicesInput(authState.other_services);

    const commits = await fetchClientCommitments(id);
    setCommitments(commits);

    setLoading(false);
  };

  useEffect(() => {
    loadClientData();
  }, [id]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.display_name || ""])), [profiles]);
  const teamMemberMap = useMemo(() => {
    const map = new Map<string, string>();
    teamMembers.forEach(m => {
      const name = m.display_name || m.name || "";
      if (m.id) map.set(m.id, name);
      if (m.profile_id) map.set(m.profile_id, name);
      if ((m as any).user_id) map.set((m as any).user_id, name);
    });
    return map;
  }, [teamMembers]);

  const getMemberDisplayName = (memberId?: string | null) => {
    if (!memberId) return isAr ? "غير معين" : "Unassigned";
    return teamMemberMap.get(memberId) || profileMap.get(memberId) || (isAr ? "عضو فريق" : "Team Member");
  };

  const isMonthly = client?.client_type === "monthly";

  // Dynamic Financial Derivations (Authoritative SSOT)
  const clientFinancials = useMemo(() => {
    if (!client) return null;
    return calculateClientFinancials({
      client,
      invoices,
      payments,
      expenses,
      sponsoring,
    });
  }, [client, invoices, sponsoring, payments, expenses]);

  // Unified Client Financial Transactions Ledger (Canonical Data SSOT)
  const unifiedClientTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      type: "income" | "expense" | "invoice" | "sponsoring";
      title: string;
      subtitle?: string;
      category?: string;
      amount: number;
      secondaryAmount?: number;
      status: string;
      reference?: string;
      sourceOrRecipient?: string;
      raw: any;
    }> = [];

    // 1. Income Transactions
    payments.forEach((p) => {
      list.push({
        id: `inc-${p.id}`,
        date: p.date || p.created_at?.slice(0, 10) || "",
        type: "income",
        title: p.description || (isAr ? "إيداع مقبوضات" : "Income Payment"),
        subtitle: p.payment_method || (isAr ? "إيداع بنكي / نقدي" : "Cash / Bank"),
        category: p.category || (isAr ? "إيراد مباشر" : "Direct Revenue"),
        amount: Number(p.amount) || 0,
        status: "completed",
        reference: p.reference || (p.invoice_id ? `Inv #${p.invoice_id.slice(0, 8)}` : undefined),
        sourceOrRecipient: client?.name,
        raw: p,
      });
    });

    // 2. Client Attributed Expenses
    expenses.forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        date: e.date || e.created_at?.slice(0, 10) || "",
        type: "expense",
        title: e.description || (isAr ? "مصروف منسوب للعميل" : "Client Attributed Expense"),
        subtitle: e.vendor || e.recipient || (isAr ? "مصروف تشغيلي" : "Operational Expense"),
        category: e.category || (isAr ? "مصروف عام" : "General Expense"),
        amount: Number(e.amount) || 0,
        status: e.status || "completed",
        reference: e.reference || undefined,
        sourceOrRecipient: e.vendor || e.recipient,
        raw: e,
      });
    });

    // 3. Official Invoices
    invoices.forEach((inv) => {
      list.push({
        id: `inv-${inv.id}`,
        date: inv.issue_date || inv.created_at?.slice(0, 10) || "",
        type: "invoice",
        title: `${isAr ? "فاتورة" : "Invoice"} #${inv.invoice_number || inv.id.slice(0, 8)}`,
        subtitle: `${isAr ? "استحقاق:" : "Due:"} ${inv.due_date || "—"}`,
        category: isAr ? "فاتورة رسمية" : "Official Invoice",
        amount: Number(inv.total_amount) || 0,
        secondaryAmount: Number(inv.paid_amount) || 0,
        status: inv.status || "draft",
        reference: inv.invoice_number,
        sourceOrRecipient: client?.name,
        raw: inv,
      });
    });

    // 4. Sponsoring Ad Campaigns
    sponsoring.forEach((sc) => {
      list.push({
        id: `sp-${sc.id}`,
        date: sc.date || sc.created_at?.slice(0, 10) || "",
        type: "sponsoring",
        title: sc.campaign_name || (isAr ? "حملة إعلانات ممولة" : "Sponsored Ad Campaign"),
        subtitle: `${sc.platform || "Meta Ads"} · ${isAr ? "تكلفة:" : "Cost:"} ${formatCurrency(sc.purchase_cost_tnd || 0)}`,
        category: isAr ? "إعلانات ممولة" : "Sponsored Ads",
        amount: Number(sc.client_charge_tnd) || Number(sc.budget_tnd) || 0,
        secondaryAmount: Number(sc.purchase_cost_tnd) || 0,
        status: sc.status || "active",
        reference: sc.platform,
        sourceOrRecipient: client?.name,
        raw: sc,
      });
    });

    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [payments, expenses, invoices, sponsoring, client, isAr]);

  const filteredClientTransactions = useMemo(() => {
    return unifiedClientTransactions.filter((item) => {
      if (financeLedgerTab !== "all" && item.type !== financeLedgerTab) return false;
      if (financeSearch.trim()) {
        const q = financeSearch.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesCategory = (item.category || "").toLowerCase().includes(q);
        const matchesRef = (item.reference || "").toLowerCase().includes(q);
        const matchesSub = (item.subtitle || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesRef && !matchesSub) return false;
      }
      return true;
    });
  }, [unifiedClientTransactions, financeLedgerTab, financeSearch]);

  // Current Selected Period Tasks
  const monthlyDeliveryTasks = useMemo(() => {
    return tasks.filter(t => (t.delivery_period === selectedPeriod || (!t.delivery_period && selectedPeriod === currentSystemPeriod)));
  }, [tasks, selectedPeriod, currentSystemPeriod]);

  // Deliverables by Category for Selected Period
  const periodReelsTasks = useMemo(() => monthlyDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("reel")), [monthlyDeliveryTasks]);
  const periodPostsTasks = useMemo(() => monthlyDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("post")), [monthlyDeliveryTasks]);
  const periodStoriesTasks = useMemo(() => monthlyDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("story") || (t.category || t.title || "").includes("ستوري")), [monthlyDeliveryTasks]);
  const periodOtherTasks = useMemo(() => monthlyDeliveryTasks.filter(t => !periodReelsTasks.includes(t) && !periodPostsTasks.includes(t) && !periodStoriesTasks.includes(t)), [monthlyDeliveryTasks, periodReelsTasks, periodPostsTasks, periodStoriesTasks]);

  // Total Progress in Selected Period
  const periodProgress = useMemo(() => {
    if (!client) return { totalDone: 0, totalQuota: 0, percent: 0 };
    if (!isMonthly) {
      const total = tasks.length;
      const done = tasks.filter(t => t.status === "done").length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 100;
      return { totalDone: done, totalQuota: total, percent };
    }
    const currentPeriodDeliverables = monthlyDeliveryTasks.filter(t => !t.parent_task_id);
    return computeMonthlyProgress(currentPeriodDeliverables, client.package_config);
  }, [isMonthly, client, tasks, monthlyDeliveryTasks]);

  // Real-time Operational Cycle Pacing
  const cyclePacing = useMemo(() => {
    if (!isMonthly) return null;
    try {
      const now = new Date();
      const currentMonthKey = format(now, "yyyy-MM");
      const isCurrent = selectedPeriod === currentMonthKey;
      const [yearStr, monthStr] = selectedPeriod.split("-");
      const totalDays = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
      const daysElapsed = isCurrent ? now.getDate() : totalDays;
      const timePercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      const deliveryPercent = periodProgress.percent;
      const difference = deliveryPercent - timePercent;
      let status: "ahead" | "on_track" | "behind" = "on_track";
      if (difference >= 10) status = "ahead";
      else if (difference <= -10) status = "behind";
      return { isCurrent, daysElapsed, totalDays, timePercent, deliveryPercent, status, difference };
    } catch {
      return null;
    }
  }, [isMonthly, selectedPeriod, periodProgress]);

  // Team Section Derivation (Contributors currently working on this client)
  const clientTeamMembers = useMemo(() => {
    const memberTaskMap = new Map<string, { total: number; reels: number; posts: number; stories: number; other: number; tasks: TaskRow[] }>();

    tasks.forEach(t => {
      if (!t.assignee_id) return;
      const existing = memberTaskMap.get(t.assignee_id) || { total: 0, reels: 0, posts: 0, stories: 0, other: 0, tasks: [] };
      existing.total += 1;
      existing.tasks.push(t);
      const cat = (t.category || t.title || "").toLowerCase();
      if (cat.includes("reel")) existing.reels += 1;
      else if (cat.includes("post")) existing.posts += 1;
      else if (cat.includes("story") || cat.includes("ستوري")) existing.stories += 1;
      else existing.other += 1;
      memberTaskMap.set(t.assignee_id, existing);
    });

    const list: Array<{
      id: string;
      name: string;
      role: string;
      avatarUrl?: string;
      tasksCount: number;
      reelsCount: number;
      postsCount: number;
      storiesCount: number;
      otherCount: number;
      overdueCount: number;
      tasks: TaskRow[];
    }> = [];

    memberTaskMap.forEach((stats, memberId) => {
      const tm = teamMembers.find(m => m.id === memberId || m.profile_id === memberId || (m as any).user_id === memberId);
      const prof = profiles.find(p => p.id === memberId);
      const name = tm?.display_name || tm?.name || prof?.display_name || (isAr ? "عضو فريق" : "Team Member");
      const roleName = tm?.position || tm?.role || (isAr ? "العمليات والتنفيذ" : "Operations");
      const overdueCount = stats.tasks.filter(t => t.status !== "done" && isTaskOverdue(t)).length;
      list.push({
        id: memberId,
        name,
        role: roleName,
        avatarUrl: tm?.photo_url || undefined,
        tasksCount: stats.total,
        reelsCount: stats.reels,
        postsCount: stats.posts,
        storiesCount: stats.stories,
        otherCount: stats.other,
        overdueCount,
        tasks: stats.tasks,
      });
    });

    return list;
  }, [tasks, teamMembers, profiles, isAr]);

  // Unified Completed Work History (Immutable Archive)
  const completedHistory = useMemo(() => {
    return tasks.filter(t => t.status === "done" || (t as any).status === "delivered" || (t as any).status === "approved");
  }, [tasks]);

  // Attention Task Derivations
  const overdueTasks = useMemo(() => {
    return monthlyDeliveryTasks.filter(t => t.status !== "done" && isTaskOverdue(t));
  }, [monthlyDeliveryTasks]);

  const blockedTasks = useMemo(() => {
    return monthlyDeliveryTasks.filter(t => t.status === "blocked" || (t.blocked_reason && t.status !== "done"));
  }, [monthlyDeliveryTasks]);

  const waitingClientTasks = useMemo(() => {
    return monthlyDeliveryTasks.filter(t =>
      t.status !== "done" && (
        (t.waiting_on && t.waiting_on.toLowerCase().includes("client")) ||
        (t.blocked_reason && t.blocked_reason.toLowerCase().includes("client")) ||
        (t as any).waiting_for_client
      )
    );
  }, [monthlyDeliveryTasks]);

  // Filtered Delivery Tasks
  const filteredDeliveryTasks = useMemo(() => {
    return monthlyDeliveryTasks.filter(t => {
      // Attention filter
      if (attentionFilter === "overdue" && (t.status === "done" || !isTaskOverdue(t))) return false;
      if (attentionFilter === "blocked" && t.status !== "blocked" && !t.blocked_reason) return false;
      if (attentionFilter === "waiting" && !(
        (t.waiting_on && t.waiting_on.toLowerCase().includes("client")) ||
        (t.blocked_reason && t.blocked_reason.toLowerCase().includes("client")) ||
        (t as any).waiting_for_client
      )) return false;
      if (attentionFilter === "urgent" && t.priority !== "urgent") return false;

      // Status filter
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter) return false;

      // Assignee filter
      if (assigneeFilter !== "all" && t.assignee_id !== assigneeFilter) return false;

      // Category filter
      if (taskCategoryFilter !== "all") {
        const cat = (t.category || t.title || "").toLowerCase();
        if (taskCategoryFilter === "reels" && !cat.includes("reel")) return false;
        if (taskCategoryFilter === "posts" && !cat.includes("post")) return false;
        if (taskCategoryFilter === "stories" && !cat.includes("story") && !cat.includes("ستوري")) return false;
        if (taskCategoryFilter === "photos" && !cat.includes("photo") && !cat.includes("تصوير")) return false;
        if (taskCategoryFilter === "other" && (cat.includes("reel") || cat.includes("post") || cat.includes("story") || cat.includes("ستوري") || cat.includes("photo") || cat.includes("تصوير"))) return false;
      }
      return true;
    });
  }, [monthlyDeliveryTasks, attentionFilter, taskStatusFilter, assigneeFilter, taskCategoryFilter]);

  // Grouped Delivery Tasks by Service Type
  const deliveryReels = useMemo(() => filteredDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("reel")), [filteredDeliveryTasks]);
  const deliveryPosts = useMemo(() => filteredDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("post")), [filteredDeliveryTasks]);
  const deliveryStories = useMemo(() => filteredDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("story") || (t.category || t.title || "").includes("ستوري")), [filteredDeliveryTasks]);
  const deliveryPhotos = useMemo(() => filteredDeliveryTasks.filter(t => (t.category || t.title || "").toLowerCase().includes("photo") || (t.category || t.title || "").includes("تصوير")), [filteredDeliveryTasks]);
  const deliveryOther = useMemo(() => filteredDeliveryTasks.filter(t => !deliveryReels.includes(t) && !deliveryPosts.includes(t) && !deliveryStories.includes(t) && !deliveryPhotos.includes(t)), [filteredDeliveryTasks, deliveryReels, deliveryPosts, deliveryStories, deliveryPhotos]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return completedHistory.filter(t => {
      if (historyCategoryFilter === "all") return true;
      const cat = (t.category || t.title || "").toLowerCase();
      if (historyCategoryFilter === "reels") return cat.includes("reel");
      if (historyCategoryFilter === "posts") return cat.includes("post");
      if (historyCategoryFilter === "stories") return cat.includes("story") || cat.includes("ستوري");
      if (historyCategoryFilter === "photos") return cat.includes("photo") || cat.includes("تصوير");
      if (historyCategoryFilter === "other") return !cat.includes("reel") && !cat.includes("post") && !cat.includes("story") && !cat.includes("ستوري") && !cat.includes("photo") && !cat.includes("تصوير");
      return true;
    });
  }, [completedHistory, historyCategoryFilter]);

  // Structured Client Memory Parser
  const parsedMemory = useMemo(() => {
    const categoriesConfig = [
      {
        id: "brand",
        labelAr: "الهوية البصرية",
        labelEn: "Brand Guidelines",
        tag: "### 🎨 Brand Guidelines",
        regex: /(?:###\s*🎨?\s*Brand Guidelines|###\s*الهوية البصرية)([\s\S]*?)(?=\n###|\n##|$)/i,
        icon: Sparkles,
        colorClass: "border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400",
        badgeBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        placeholder: isAr ? "الألوان الرسمية، الخطوط المعتمدة، نبرة الصوت، القالب البصري..." : "Colors, typography, tone of voice, visual aesthetic...",
      },
      {
        id: "content",
        labelAr: "قواعد المحتوى",
        labelEn: "Content Rules",
        tag: "### 📝 Content Rules",
        regex: /(?:###\s*📝?\s*Content Rules|###\s*قواعد المحتوى)([\s\S]*?)(?=\n###|\n##|$)/i,
        icon: FileText,
        colorClass: "border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400",
        badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        placeholder: isAr ? "أنماط المنشورات، هوك الفيديو، قواعد الصياغة والكابشن..." : "Post formats, hook structure, captions, CTA conventions...",
      },
      {
        id: "preferences",
        labelAr: "تفضيلات العميل",
        labelEn: "Client Preferences",
        tag: "### ⏰ Client Preferences",
        regex: /(?:###\s*⏰?\s*Client Preferences|###\s*تفضيلات العميل|###\s*تفضيلات النشر)([\s\S]*?)(?=\n###|\n##|$)/i,
        icon: Clock,
        colorClass: "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
        badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        placeholder: isAr ? "أفضل أوقات النشر، الفئات المستهدفة، لغة الخطاب والتواصل..." : "Best posting windows, audience persona, preferred messaging...",
      },
      {
        id: "approval",
        labelAr: "آلية الاعتماد والموافقة",
        labelEn: "Approval Process",
        tag: "### ✅ Approval Process",
        regex: /(?:###\s*✅?\s*Approval Process|###\s*آلية الاعتماد)([\s\S]*?)(?=\n###|\n##|$)/i,
        icon: ShieldCheck,
        colorClass: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        placeholder: isAr ? "الشخص المخول بالاعتماد، مهلة المراجعة (مثال: خلال 24 ساعة)..." : "Approval authority, review SLA, sign-off process...",
      },
      {
        id: "restrictions",
        labelAr: "المحظورات والخطوط الحمراء",
        labelEn: "Restrictions",
        tag: "### 🚫 Restrictions",
        regex: /(?:###\s*🚫?\s*Restrictions|###\s*المحظورات)([\s\S]*?)(?=\n###|\n##|$)/i,
        icon: AlertTriangle,
        colorClass: "border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400",
        badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        placeholder: isAr ? "تجنب ذكر المنافسين، كلمات محظورة، مواد أو ألوان ممنوعة..." : "Competitors, forbidden phrases, disallowed visuals...",
      },
      {
        id: "instructions",
        labelAr: "توجيهات خاصة",
        labelEn: "Special Instructions",
        tag: "### 📌 Special Instructions",
        regex: /(?:###\s*📌?\s*Special Instructions|###\s*توجيهات خاصة)([\s\S]*?)(?=\n###|\n##|$)/i,
        icon: Zap,
        colorClass: "border-cyan-500/20 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400",
        badgeBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
        placeholder: isAr ? "ملاحظات إضافية، تنبيهات الإنتاج، تفاصيل العقود والشروط..." : "Additional notes, production alerts, contract specifics...",
      },
    ];

    const parsedCategories = categoriesConfig.map(cat => {
      const match = notesContent.match(cat.regex);
      const content = match ? match[1].trim() : "";
      return {
        ...cat,
        content,
        hasContent: content.length > 0,
      };
    });

    // Check for general unclassified text
    const hasStructuredHeaders = /###\s+/i.test(notesContent);
    let generalNotes = "";
    if (!hasStructuredHeaders && notesContent.trim()) {
      generalNotes = notesContent.trim();
    } else if (hasStructuredHeaders) {
      const matchIntro = notesContent.match(/^([\s\S]*?)(?=###)/i);
      if (matchIntro && matchIntro[1].trim()) {
        generalNotes = matchIntro[1].trim();
      }
    }

    const activeCount = parsedCategories.filter(c => c.hasContent).length + (generalNotes ? 1 : 0);

    return {
      categories: parsedCategories,
      generalNotes,
      activeCount,
    };
  }, [notesContent, isAr]);

  // Authoritative Sticky Section Navigator Items
  const navSections = useMemo(() => {
    const list: { id: string; label: string; icon: any; count?: number; adminOnly?: boolean }[] = [
      { id: "overview-section", label: isAr ? "نظرة عامة 360" : "Overview 360", icon: Building2 },
      { id: "services-section", label: isAr ? "الخدمات والباقة" : "Services & Package", icon: Repeat },
      { id: "delivery-section", label: isAr ? "مركز التسليم" : "Delivery Center", icon: CheckCircle2, count: monthlyDeliveryTasks.filter(t => t.status !== "done").length },
      { id: "team-section", label: isAr ? "فريق العمل" : "Team & Work", icon: Users, count: clientTeamMembers.length },
      { id: "financial-section", label: isAr ? "الملف المالي والإعلانات" : "Financial & Ads", icon: DollarSign, adminOnly: true },
      { id: "memory-section", label: isAr ? "ذاكرة العميل" : "Client Memory", icon: FileEdit, count: parsedMemory.activeCount },
      { id: "history-section", label: isAr ? "سجل التسليمات" : "Work History", icon: History, count: completedHistory.length },
    ];
    return list.filter(t => !t.adminOnly || canAccessFinance);
  }, [canAccessFinance, monthlyDeliveryTasks, clientTeamMembers.length, completedHistory.length, parsedMemory.activeCount, isAr]);

  // Legacy Tabs Alias for compatibility
  const tabs = navSections.map(s => ({ ...s, id: s.id.replace("-section", "") as WorkspaceTab }));

  const calendarProjects = useMemo(() => {
    return projects.map(p => ({
      id: p.id,
      title: p.title,
      client_name: (p as any).client_name || client?.name || "",
    }));
  }, [projects, client]);

  // Scroll Spy Observer
  useEffect(() => {
    if (typeof window === "undefined" || loading) return;

    const sectionIds = [
      "overview-section",
      "services-section",
      "delivery-section",
      "team-section",
      "financial-section",
      "memory-section",
      "history-section",
    ];

    const mainEl = document.querySelector("#sada-admin-main") as HTMLElement;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (mainEl && mainEl.scrollTop < 60) {
        setActiveSection("overview-section");
      }
    };
    mainEl?.addEventListener("scroll", handleScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScrollRef.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visible[0].target.id);
        }
      },
      {
        root: mainEl || null,
        rootMargin: "-100px 0px -40% 0px",
        threshold: [0.05, 0.25],
      }
    );

    sectionIds.forEach((sId) => {
      const el = document.getElementById(sId);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      mainEl?.removeEventListener("scroll", handleScroll);
    };
  }, [loading, canAccessFinance]);

  // URL Tab Query Sync
  useEffect(() => {
    if (typeof window !== "undefined" && !loading) {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get("tab");
      if (tabParam) {
        const targetMap: Record<string, string> = {
          overview: "overview-section",
          services: "services-section",
          package: "services-section",
          delivery: "delivery-section",
          deliverables: "delivery-section",
          tasks: "delivery-section",
          production: "delivery-section",
          team: "team-section",
          financial: "financial-section",
          sponsoring: "financial-section",
          invoices: "financial-section",
          payments: "financial-section",
          finance: "financial-section",
          notes: "memory-section",
          memory: "memory-section",
          history: "history-section",
        };
        const secId = targetMap[tabParam];
        if (secId) {
          setTimeout(() => {
            scrollToSection(secId);
          }, 350);
        }
      }
    }
  }, [loading]);

  // Save Notes Mutation & Category Directive Handler
  const handleSaveNotes = async (overrideContent?: string) => {
    if (!client) return;
    setSavingNotes(true);
    const contentToSave = typeof overrideContent === "string" ? overrideContent : notesContent;
    const { error } = await (supabase as any)
      .from("clients")
      .update({ notes: contentToSave })
      .eq("id", client.id);

    if (error) {
      toast.error(isAr ? `فشل حفظ الملاحظات: ${error.message}` : `Failed to save notes: ${error.message}`);
    } else {
      toast.success(isAr ? "تم تحديث ذاكرة وتوجيهات العميل بنجاح!" : "Client memory & guidelines updated!");
      setClient({ ...client, notes: contentToSave });
      if (typeof overrideContent === "string") {
        setNotesContent(overrideContent);
      }
    }
    setSavingNotes(false);
  };

  const handleSaveCategoryDirective = async (catId: string, newText: string) => {
    const targetCat = parsedMemory.categories.find(c => c.id === catId);
    if (!targetCat) return;

    let updated = notesContent;
    const match = updated.match(targetCat.regex);
    if (match) {
      if (newText.trim()) {
        const replacement = `${targetCat.tag}\n${newText.trim()}\n`;
        updated = updated.replace(match[0], replacement);
      } else {
        updated = updated.replace(match[0], "").trim();
      }
    } else if (newText.trim()) {
      const addition = `\n\n${targetCat.tag}\n${newText.trim()}\n`;
      updated = (updated.trim() + addition).trim();
    }

    setEditingDirectiveCategory(null);
    setCategoryDraftText("");
    await handleSaveNotes(updated);
  };

  // Task Status Toggle
  const handleUpdateTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "todo" : currentStatus === "todo" ? "in_progress" : "done";
    const { error } = await (supabase as any)
      .from("project_tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      toast.error(isAr ? `فشل تحديث المهمة: ${error.message}` : `Task update failed: ${error.message}`);
    } else {
      toast.success(isAr ? "تم تحديث حالة المهمة بنجاح" : `Task status updated to ${nextStatus.replace("_", " ")}`);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: nextStatus as any } : t));
    }
  };

  // Task Status Change from Modal
  const handleTaskModalStatusChange = async (taskId: string, nextStatus: TaskRow["status"]) => {
    const { error } = await (supabase as any)
      .from("project_tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      toast.error(isAr ? `فشل تحديث المهمة: ${error.message}` : `Task update failed: ${error.message}`);
    } else {
      toast.success(isAr ? "تم تحديث حالة المهمة" : `Task status updated to ${nextStatus.replace("_", " ")}`);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
      if (inspectingTask && inspectingTask.id === taskId) {
        setInspectingTask({ ...inspectingTask, status: nextStatus });
      }
    }
  };

  // Delete Task Handler
  const handleDeleteTask = async (taskId: string) => {
    const { error } = await (supabase as any)
      .from("project_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast.error(isAr ? `فشل حذف المهمة: ${error.message}` : `Failed to delete task: ${error.message}`);
    } else {
      toast.success(isAr ? "تم حذف المهمة بنجاح" : "Task deleted successfully");
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setShowTaskModal(false);
      setEditingTask(null);
      setInspectingTask(null);
    }
  };

  // Save Client Details Modal
  const handleSaveClientDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !client) return;
    setSavingEditClient(true);

    const resolvedAccountManager = resolveToProfileId(editAccountManagerId || user?.id, teamMembers, profiles);
    const resolvedSalesOwner = resolveToProfileId(editSalesOwnerId, teamMembers, profiles);
    const resolvedCommissionRecipient = resolveToTeamMemberId(editSalesOwnerId, teamMembers);

    if (editSalesOwnerId && !resolvedCommissionRecipient) {
      toast.error(isAr ? "مسؤول المبيعات المحدد لم يعد متاحاً. يرجى اختيار عضو نشط من الفريق." : "Selected Sales Owner is no longer available. Please select an active team member.");
      setSavingEditClient(false);
      return;
    }

    const payload = {
      name: editName.trim(),
      industry: editIndustry.trim() || null,
      contact_name: editContactName.trim() || null,
      email: normalizeEmail(editEmail),
      phone: normalizePhone(editPhone),
      preferred_channel: editPreferredChannel,
      status: editStatus,
      account_manager_id: resolvedAccountManager || null,
      sales_owner_id: resolvedSalesOwner || null,
      relationship_owner_id: resolvedAccountManager || null,
      commission_recipient_id: resolvedCommissionRecipient || null,
      monthly_package_price: Number(editMonthlyRate) || 0,
      default_service_fee: Number(editMonthlyRate) || 0,
      default_sponsoring_budget: Number(editSponsoringBudget) || 0,
    };

    const { error } = await (supabase as any)
      .from("clients")
      .update(payload)
      .eq("id", client.id);

    if (error) {
      toast.error(isAr ? `فشل التحديث: ${formatClientErrorMessage(error)}` : `Update failed: ${formatClientErrorMessage(error)}`);
    } else {
      // Synchronize operational workspace containers if client business name changed
      if (editName.trim() && editName.trim() !== client.name) {
        await (supabase as any)
          .from("client_projects")
          .update({
            client_name: editName.trim(),
          })
          .eq("client_id", client.id);
      }

      toast.success(isAr ? "تم تحديث الملف التعريفي للعميل بنجاح" : "Client profile updated successfully");
      setShowEditClientModal(false);
      loadClientData(true);
    }
    setSavingEditClient(false);
  };

  // Save Package Config Modal with SSOT Live Reconciliation
  const handleSavePackageConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSavingPackage(true);

    const newConfig: PackageConfig = {
      reels_quota: reelsQuotaInput,
      posts_quota: postsQuotaInput,
      stories_quota: storiesQuotaInput,
      other_services: otherServicesInput,
    };

    // Update client price if changed
    if (pkgPriceInput !== Number(client.monthly_package_price || client.default_service_fee)) {
      await (supabase as any)
        .from("clients")
        .update({
          monthly_package_price: pkgPriceInput,
          default_service_fee: pkgPriceInput,
        })
        .eq("id", client.id);
    }

    const recReport = await reconcileClientPackageWork({
      clientId: client.id,
      packageId: selectedPackageId || client.package_id || null,
      packageName: pkgNameInput.trim() || "Custom Retainer",
      packageConfig: newConfig,
      periodMonth: selectedPeriod,
      actorId: user?.id,
      actorEmail: user?.email,
      teamMembers,
      profiles,
    });

    if (recReport.success) {
      const summaryMsg = isAr
        ? `تم تحديث الباقة وتسوية العمل: ${recReport.total_tasks_created} مهام مولدة، ${recReport.total_tasks_pruned} مقلصة، و${recReport.total_history_preserved} تسليم سابق محفوظ بأمان!`
        : `Package updated & work reconciled: ${recReport.total_tasks_created} created, ${recReport.total_tasks_pruned} pruned, ${recReport.total_history_preserved} historical preserved!`;
      toast.success(summaryMsg);
      setShowEditPackageModal(false);
      loadClientData(true);
      loadCommitments();
    } else {
      toast.error(recReport.error || (isAr ? "فشل تسوية الباقة" : "Failed to reconcile package"));
    }
    setSavingPackage(false);
  };

  // Explicit On-Demand Work Reconciliation
  const handleReconcilePackageWork = async () => {
    if (!client) return;
    setReconciling(true);
    const authState = resolveAuthoritativePackageConfig(client, linkedPackage as any);
    const report = await reconcileClientPackageWork({
      clientId: client.id,
      packageId: authState.package_id,
      packageName: authState.package_name,
      packageConfig: client.package_config || {
        reels_quota: authState.quotas.reels,
        posts_quota: authState.quotas.posts,
        stories_quota: authState.quotas.stories,
      },
      periodMonth: selectedPeriod,
      actorId: user?.id,
      actorEmail: user?.email,
      teamMembers,
      profiles,
    });
    setReconciling(false);

    if (report.success) {
      toast.success(
        isAr
          ? `تمت تسوية التسليمات والتقويم (${selectedPeriod}): توليد ${report.total_tasks_created} مهام، تقليص ${report.total_tasks_pruned} زائدة، والحفاظ على ${report.total_history_preserved} مهمة منجزة!`
          : `Reconciled work for ${selectedPeriod}: Created ${report.total_tasks_created}, pruned ${report.total_tasks_pruned}, preserved ${report.total_history_preserved} completed history!`
      );
      loadClientData(true);
      loadCommitments();
    } else {
      toast.error(report.error || (isAr ? "فشل تسوية العمل" : "Failed to reconcile work"));
    }
  };

  // Create Deliverable Handler
  const handleCreateDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelivTitle.trim() || !client) return;
    setSavingDeliverable(true);

    const period = selectedPeriod || client.current_period_month || format(new Date(), "yyyy-MM");
    const { data: created, error } = await (supabase as any)
      .from("client_deliverables")
      .insert({
        client_id: client.id,
        package_id: client.package_id || null,
        title: newDelivTitle.trim(),
        deliverable_type: newDelivType,
        period_month: period,
        target_quantity: Number(newDelivTarget) || 1,
        done_quantity: 0,
        deadline: newDelivDeadline || null,
        status: "planned",
      })
      .select("*")
      .single();

    if (error) {
      toast.error(isAr ? `فشل جدولة التسليم: ${error.message}` : `Failed to create deliverable: ${error.message}`);
    } else {
      toast.success(isAr ? "تمت جدولة هدف التسليم بنجاح!" : "Deliverable target scheduled!");
      setDeliverables(prev => [...prev, created]);
      setShowNewDeliverableModal(false);
      setNewDelivTitle("");
    }
    setSavingDeliverable(false);
  };

  // Increment Deliverable Progress (+1 Done)
  const handleIncrementDeliverable = async (deliv: ClientDeliverableRow) => {
    const nextDone = deliv.done_quantity + 1;
    const ok = await updateDeliverableProgress(deliv.id, nextDone);
    if (ok) {
      toast.success(isAr ? `تم تحديث ${deliv.title}: مكتمل ${nextDone}/${deliv.target_quantity}` : `Updated ${deliv.title}: ${nextDone}/${deliv.target_quantity} completed`);
      setDeliverables(prev =>
        prev.map(d =>
          d.id === deliv.id
            ? {
                ...d,
                done_quantity: nextDone,
                remaining_quantity: Math.max(0, d.target_quantity - nextDone),
                status: nextDone >= d.target_quantity ? "completed" : "in_progress",
              }
            : d
        )
      );
    } else {
      toast.error(isAr ? "فشل تحديث إنجاز التسليم" : "Failed to update deliverable progress");
    }
  };

  // Create Production Booking Handler
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookingTitle.trim() || !newBookingDate || !client) {
      toast.error(isAr ? "العنوان والتاريخ مطلوبان لحجز جلسة التصوير" : "Title and date are required for production booking");
      return;
    }

    setSavingBooking(true);
    const equipList = newBookingEquipment.split(",").map(s => s.trim()).filter(Boolean);
    const brief = {
      shot_list: [`Core hero shots for ${client.name}`, "B-roll customer atmosphere", "Staff in action", "Product spotlight"],
      required_reels: Number(newBookingReels) || 8,
      photos: Number(newBookingPhotos) || 25,
      story_assets: 15,
      references: ["Clean luxury lighting", "Fast-paced punchy audio sync"],
      equipment: equipList.length > 0 ? equipList : ["Sony A7IV", "Gimbal", "Wireless Mics"],
    };

    const { data: created, error } = await (supabase as any)
      .from("production_bookings")
      .insert({
        client_id: client.id,
        package_id: client.package_id || null,
        title: newBookingTitle.trim(),
        date: newBookingDate,
        time: newBookingTime,
        location: newBookingLocation.trim(),
        production_type: newBookingType,
        duration_hours: Number(newBookingDuration) || 3,
        team_member_ids: newBookingTeamIds,
        brief,
        stage: "brief",
      })
      .select("*")
      .single();

    if (error) {
      toast.error(isAr ? `فشل حجز جلسة التصوير: ${error.message}` : `Failed to book shoot: ${error.message}`);
    } else {
      toast.success(isAr ? "تم حجز جلسة التصوير بنجاح!" : "Production shoot booked!");
      setProductionBookings(prev => [...prev, created]);
      setShowNewBookingModal(false);
      setNewBookingTitle("");
    }
    setSavingBooking(false);
  };

  // Advance Production Stage
  const handleAdvanceBookingStage = async (booking: ProductionBookingRow) => {
    const currIdx = PRODUCTION_WORKFLOW_STEPS.indexOf(booking.stage);
    if (currIdx < 0 || currIdx >= PRODUCTION_WORKFLOW_STEPS.length - 1) return;
    const nextStage = PRODUCTION_WORKFLOW_STEPS[currIdx + 1];

    const ok = await advanceProductionStage(booking.id, nextStage);
    if (ok) {
      toast.success(isAr ? `تم تقديم مرحلة الإنتاج إلى: ${getProductionStepLabel(nextStage)}` : `Production advanced to ${nextStage.replace("_", " ").toUpperCase()}`);
      setProductionBookings(prev =>
        prev.map(b => (b.id === booking.id ? { ...b, stage: nextStage } : b))
      );
    } else {
      toast.error(isAr ? "فشل تقديم مرحلة الإنتاج" : "Failed to advance production stage");
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const current = parseISO(`${selectedPeriod}-01`);
    const prev = subMonths(current, 1);
    setSelectedPeriod(format(prev, "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const current = parseISO(`${selectedPeriod}-01`);
    const next = addMonths(current, 1);
    setSelectedPeriod(format(next, "yyyy-MM"));
  };

  if (loading && !client) {
    return <ClientWorkspaceSkeleton />;
  }

  if (!client) {
    return (
      <div className="text-center py-24 space-y-4 max-w-md mx-auto">
        <AlertCircle className="size-10 text-muted-foreground mx-auto" />
        <h2 className="font-display text-xl font-bold text-foreground">
          {isAr ? "لم يتم العثور على سجل العميل" : "Client Record Not Found"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isAr ? "العميل المطلوب غير موجود أو تمت إزالته من نظام صدى OS." : "The requested client does not exist or has been removed from SADA OS."}
        </p>
        <Link to="/admin/client-workspaces" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
          <ArrowLeft className="size-3.5 rtl:rotate-180" /> {isAr ? "العودة إلى دليل العملاء" : "Return to Client Directory"}
        </Link>
      </div>
    );
  }

  const statusConfig = CLIENT_STATUS_CONFIG[client.status] || CLIENT_STATUS_CONFIG.active;
  const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono mb-1.5";

  // Authoritative package quotas
  const currentReelsQuota = client.package_config?.reels_quota || (linkedPackage as any)?.monthly_reels || 0;
  const currentPostsQuota = client.package_config?.posts_quota || (linkedPackage as any)?.monthly_posts || 0;
  const currentStoriesQuota = client.package_config?.stories_quota || ((linkedPackage as any)?.monthly_stories ? parseInt((linkedPackage as any).monthly_stories, 10) : 0) || 0;

  // Real-time calculation for pricing in modal & authoritative display
  const currentPrice = Number(client.monthly_package_price || client.default_service_fee || 0);
  const contractDisplayValue = isMonthly
    ? Number(client.monthly_package_price || client.default_service_fee || clientFinancials?.monthlyRevenue || 0)
    : Number(client.default_service_fee || client.monthly_package_price || (client as any).total_contract_value || 0);
  const priceDifference = pkgPriceInput - currentPrice;

  // Render unified actionable delivery task row with explicit [View Task] and dependency badges
  const renderDeliveryTaskRow = (task: TaskRow, serviceEmblem: string, emblemColor: string) => {
    const isDone = task.status === "done";
    const isOverdue = !isDone && isTaskOverdue(task);
    const isBlocked = !isDone && (task.status === "blocked" || Boolean(task.blocked_reason));
    const isWaitingClient = !isDone && Boolean(
      (task.waiting_on && task.waiting_on.toLowerCase().includes("client")) ||
      (task.blocked_reason && task.blocked_reason.toLowerCase().includes("client")) ||
      (task as any).waiting_for_client
    );

    return (
      <div
        key={task.id}
        className="p-3.5 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => handleUpdateTaskStatus(task.id, task.status)}
            className={`size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"
            }`}
            title={isDone ? (isAr ? "تحديد كغير منجز" : "Mark incomplete") : (isAr ? "تحديد كمنجز" : "Mark done")}
          >
            {isDone && <Check className="size-3.5 stroke-[3]" />}
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${emblemColor}`}>
                {serviceEmblem}
              </span>
              <button
                type="button"
                onClick={() => setInspectingTask(task)}
                className={`font-semibold text-xs text-start truncate block hover:text-primary transition-colors cursor-pointer ${
                  isDone ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {task.title}
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
              <span>{isAr ? "المكلف:" : "Assigned:"} <strong className="text-foreground">{getMemberDisplayName(task.assignee_id)}</strong></span>
              {task.deadline && (
                <span>· {isAr ? "الاستحقاق:" : "Due:"} <span dir="ltr" className="font-mono">{format(parseISO(task.deadline), "d MMM")}</span></span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0 justify-end">
          {/* Attention / Dependency Badges */}
          {isOverdue && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              {isAr ? "متأخرة" : "OVERDUE"}
            </span>
          )}
          {isBlocked && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              {isAr ? "معطلة" : "BLOCKED"}
            </span>
          )}
          {isWaitingClient && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              {isAr ? "بانتظار العميل" : "WAITING CLIENT"}
            </span>
          )}

          {/* Priority Badge */}
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase ${
            task.priority === "urgent" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
            task.priority === "high" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
            "bg-muted text-muted-foreground"
          }`}>
            {getPriorityLabel(task.priority)}
          </span>

          {/* Drive Link */}
          {task.drive_url && (
            <a
              href={task.drive_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:bg-muted"
              title={isAr ? "رابط ملفات Drive" : "Drive link"}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}

          {/* Explicit View Task Action */}
          <button
            type="button"
            onClick={() => setInspectingTask(task)}
            className="px-2.5 py-1 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <Eye className="size-3 text-primary" />
            <span>{isAr ? "عرض المهمة" : "View Task"}</span>
          </button>

          {/* Edit Task Action */}
          <button
            type="button"
            onClick={() => {
              setEditingTask(task);
              setShowTaskModal(true);
            }}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title={isAr ? "تعديل المهمة" : "Edit task"}
          >
            <Pencil className="size-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-20">
      {/* =====================================================================
          PERSISTENT STICKY COMMAND CENTER NAVIGATION BAR
          Pinned at top edge of Client 360, edge-to-edge opaque background
      ===================================================================== */}
      <div
        id="client-360-nav-wrapper"
        data-testid="client-360-sticky-nav"
        className="sticky -top-16 md:-top-10 z-30 -mt-16 md:-mt-10 pt-16 md:pt-10 -mx-4 sm:-mx-6 md:-mx-10 px-4 sm:px-6 md:px-10 bg-background/98 backdrop-blur-md border-b border-border shadow-xs transition-all"
      >
        <div className="max-w-7xl mx-auto py-2.5 space-y-2">
          {/* Top Breadcrumb & Quick Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link
                to="/admin/client-workspaces"
                className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ArrowLeft className="size-3.5 rtl:rotate-180" />
                <span className="hidden sm:inline">{isAr ? "دليل العملاء" : "Clients"}</span>
              </Link>
              <span className="text-muted-foreground/40 hidden sm:inline">/</span>
              <span className="font-display font-bold text-sm text-foreground truncate">
                {client.name}
              </span>
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border shrink-0 hidden md:inline-flex ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                {getStatusLabel(client.status)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowEditPackageModal(true)}
                  className="px-2.5 sm:px-3 py-1 rounded-xl border border-primary/30 bg-primary/10 text-primary text-[11px] sm:text-xs font-semibold hover:bg-primary/20 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Pencil className="size-3" />
                  <span className="hidden sm:inline">{isAr ? "تعديل الباقة والحصص" : "Edit Package"}</span>
                  <span className="sm:hidden">{isAr ? "باقة" : "Pkg"}</span>
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowEditClientModal(true)}
                  className="px-2.5 sm:px-3 py-1 rounded-xl border border-border bg-card hover:bg-muted text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <Pencil className="size-3" />
                  <span className="hidden sm:inline">{isAr ? "بيانات العميل" : "Edit Client"}</span>
                  <span className="sm:hidden">{isAr ? "عميل" : "Client"}</span>
                </button>
              )}
              {client.status === "archived" ? (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveDialogMode("restore");
                      setShowArchiveModal(true);
                    }}
                    className="px-2.5 sm:px-3 py-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs font-semibold hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="size-3" />
                    <span className="hidden sm:inline">{isAr ? "استعادة وتنشيط" : "Restore Client"}</span>
                    <span className="sm:hidden">{isAr ? "استعادة" : "Restore"}</span>
                  </button>
                )
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveDialogMode("archive");
                      setShowArchiveModal(true);
                    }}
                    className="px-2.5 sm:px-3 py-1 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] sm:text-xs font-semibold hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Archive className="size-3" />
                    <span className="hidden sm:inline">{isAr ? "أرشفة وتجميد" : "Archive Client"}</span>
                    <span className="sm:hidden">{isAr ? "أرشفة" : "Archive"}</span>
                  </button>
                )
              )}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-2.5 sm:px-3 py-1 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] sm:text-xs font-semibold hover:bg-rose-500/20 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Trash2 className="size-3" />
                  <span className="hidden sm:inline">{isAr ? "حذف العميل" : "Delete Client"}</span>
                  <span className="sm:hidden">{isAr ? "حذف" : "Del"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Archived Notification Banner */}
          {client.status === "archived" && (
            <div className="p-3 sm:p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <Archive className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <span className="font-bold">
                    {isAr ? "هذا العميل في حالة تجميد وأرشفة (Archived):" : "This client is currently ARCHIVED & FROZEN:"}
                  </span>{" "}
                  <span className="opacity-90">
                    {isAr
                      ? "المهام المعلقة متوقفة مؤقتاً ومحجوبة عن التقويم اليومي وعبء العمل. كافة السجلات التاريخية والفواتير محفوظة بالكامل."
                      : "Operational tasks and recurring schedules are paused and hidden from active calendar views. All history, deliverables, and invoices remain intact."}
                  </span>
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setArchiveDialogMode("restore");
                    setShowArchiveModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shrink-0 inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>{isAr ? "استعادة وتنشيط العميل" : "Restore Client"}</span>
                </button>
              )}
            </div>
          )}

          {/* Canonical 7 Section Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5">
            {navSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  data-section-tab={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span>{sec.label}</span>
                  {typeof sec.count === "number" && sec.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {sec.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: OVERVIEW 360 (EXECUTIVE COCKPIT)
      ===================================================================== */}
      <section id="overview-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">

      {/* =====================================================================
          1. CLIENT 360 HEADER (AUTHORITATIVE COMMERCIAL IDENTITY)
      ===================================================================== */}
      <div className="p-6 md:p-8 rounded-3xl border border-border/80 bg-card/95 elevated-shadow space-y-6 backdrop-blur-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            {/* Badges Strip */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase font-mono tracking-widest text-primary font-bold px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                SADA CLIENT 360
              </span>
              <span className="text-xs text-muted-foreground/60">·</span>

              {/* Explicit Engagement Type Badge */}
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border ${
                isMonthly
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              }`}>
                {isMonthly
                  ? (isAr ? "اشتراك شهري (باقة متكررة)" : "MONTHLY RETAINER")
                  : (isAr ? "خدمة لمرة واحدة (مشروع مستقل)" : "ONE-OFF ENGAGEMENT")}
              </span>

              {/* Status Badge */}
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                {getStatusLabel(client.status)}
              </span>

              {/* Financial Health Badge */}
              {canAccessFinance && clientFinancials && (
                <span className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border ${
                  clientFinancials.clientHealth === "HIGH PROFIT"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : clientFinancials.clientHealth === "MEDIUM"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : clientFinancials.clientHealth === "LOW PROFIT"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-muted/60 text-muted-foreground border-border/80"
                }`}>
                  {getHealthBadge(clientFinancials.clientHealth)}
                </span>
              )}
            </div>

            {/* Client Name & Industry */}
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                {client.name}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground font-medium">
                {client.industry || (isAr ? "قطاع الضيافة والخدمات الفاخرة" : "Luxury & Hospitality Engagement")}
              </p>
            </div>
          </div>

          {/* Quick Communication & Contact Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {client.phone && (
              <>
                <a
                  href={`tel:${client.phone}`}
                  className="px-3.5 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title={isAr ? "اتصال هاتفي مباشر" : "Direct phone call"}
                >
                  <Phone className="size-3.5 text-primary" />
                  <span>{isAr ? "اتصال" : "Call"}</span>
                </a>
                <a
                  href={`https://wa.me/${client.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title={isAr ? "محادثة واتساب" : "Open WhatsApp chat"}
                >
                  <MessageSquare className="size-3.5" />
                  <span>{isAr ? "واتساب" : "WhatsApp"}</span>
                </a>
              </>
            )}

            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="px-3.5 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title={isAr ? "إرسال بريد إلكتروني" : "Send email"}
              >
                <Mail className="size-3.5 text-primary" />
                <span>{isAr ? "بريد إلكتروني" : "Email"}</span>
              </a>
            )}
          </div>
        </div>

        {/* Ownership & Commercial Parameters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/80 text-xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider block text-muted-foreground font-semibold">
              {isAr ? "مدير الحساب (AM)" : "Account Manager"}
            </span>
            <span className="font-semibold text-foreground truncate block mt-0.5">
              {getMemberDisplayName(client.account_manager_id || client.relationship_owner_id)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider block text-muted-foreground font-semibold">
              {isAr ? "مسؤول المبيعات" : "Sales Owner"}
            </span>
            <span className="font-semibold text-foreground truncate block mt-0.5">
              {getMemberDisplayName(client.sales_owner_id || client.commission_recipient_id)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider block text-muted-foreground font-semibold">
              {isMonthly ? (isAr ? "سعر الباقة والاشتراك" : "Package & Price") : (isAr ? "قيمة العقد الإجمالية" : "Total Contract Value")}
            </span>
            <span className="font-mono font-bold text-foreground block tabular-nums mt-0.5">
              {formatCurrency(contractDisplayValue)} {isMonthly ? (isAr ? "/ شهر" : "/ mo") : ""}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider block text-muted-foreground font-semibold">
              {isAr ? "ميزانية الإعلانات الممولة" : "Sponsoring Budget"}
            </span>
            <span className="font-mono font-bold text-foreground block tabular-nums mt-0.5">
              {clientFinancials && clientFinancials.sponsoringBudget > 0 ? formatCurrency(clientFinancials.sponsoringBudget) : (isAr ? "غير محددة" : "None")}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. EXECUTIVE COMMAND STRIP (UNIFIED OPERATIONAL COCKPIT)
      ===================================================================== */}
      <div className="rounded-3xl border border-border/80 bg-card/95 backdrop-blur-md elevated-shadow overflow-hidden divide-y lg:divide-y-0 lg:divide-x rtl:lg:divide-x-reverse divide-border/60 grid grid-cols-2 lg:grid-cols-5">
        {/* Metric 1: PERIOD */}
        <button
          type="button"
          onClick={() => scrollToSection("delivery-section")}
          className="p-4 sm:p-5 text-start hover:bg-muted/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
              {isMonthly ? (isAr ? "الشهر التشغيلي" : "PERIOD") : (isAr ? "تاريخ الاستحقاق" : "TARGET DEADLINE")}
            </span>
            <Calendar className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="my-1.5">
            <div className="text-base sm:text-lg font-bold font-display text-foreground truncate" dir="ltr">
              {isMonthly ? formatPeriodMonth(selectedPeriod) : ((client as any).contract_end_date || client.billing_start_date || "Open Target")}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground block group-hover:text-primary transition-colors">
            {isMonthly
              ? (selectedPeriod === currentSystemPeriod ? (isAr ? "الدورة الحالية · استعراض" : "Current Cycle · View") : (isAr ? "دورة مختارة · استعراض" : "Selected Period · View"))
              : (isAr ? "الموعد النهائي للعقد" : "Final contract target")}
          </span>
        </button>

        {/* Metric 2: DELIVERY PACING */}
        <button
          type="button"
          onClick={() => {
            setDeliveryViewMode("tasks");
            scrollToSection("delivery-section");
          }}
          className="p-4 sm:p-5 text-start hover:bg-muted/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
              {isAr ? "وتيرة التسليم" : "DELIVERY PACING"}
            </span>
            <CheckCircle2 className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="my-1.5 flex items-baseline justify-between gap-2">
            <span className="text-base sm:text-lg font-bold font-display text-foreground" dir="ltr">
              {periodProgress.totalDone} / {periodProgress.totalQuota}
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {periodProgress.percent}%
            </span>
          </div>
          <div className="w-full space-y-1">
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, periodProgress.percent)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground block">
              {Math.max(0, periodProgress.totalQuota - periodProgress.totalDone)} {isAr ? "متبقي للتسليم" : "remaining"}
            </span>
          </div>
        </button>

        {/* Metric 3: FINANCIAL RECONCILIATION */}
        <button
          type="button"
          onClick={() => {
            if (canAccessFinance) scrollToSection("financial-section");
          }}
          disabled={!canAccessFinance}
          className={`p-4 sm:p-5 text-start transition-all flex flex-col justify-between ${
            canAccessFinance ? "hover:bg-muted/40 cursor-pointer group" : "cursor-default opacity-85"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
              {isAr ? "التحصيل المالي" : "PAYMENT RECON"}
            </span>
            <DollarSign className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="my-1.5">
            <div className="text-sm sm:text-base font-bold font-display text-foreground truncate" dir="ltr">
              {clientFinancials ? `${formatCurrency(clientFinancials.totalPaid)} / ${formatCurrency(contractDisplayValue)}` : "—"}
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 text-[10px]">
            {clientFinancials ? (
              clientFinancials.totalOutstanding > 0 ? (
                <span className="text-rose-500 font-semibold font-mono">
                  {formatCurrency(clientFinancials.totalOutstanding)} {isAr ? "متبقي" : "due"}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {isAr ? "مسدد بالكامل" : "Settled in full"}
                </span>
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <span className="scale-90 origin-end">
              {getPaymentStatusBadge(clientFinancials?.paymentStatus)}
            </span>
          </div>
        </button>

        {/* Metric 4: ACTIVE CONTRIBUTORS */}
        <button
          type="button"
          onClick={() => scrollToSection("team-section")}
          className="p-4 sm:p-5 text-start hover:bg-muted/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
              {isAr ? "فريق العمل المكلف" : "ACTIVE TEAM"}
            </span>
            <Users className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="my-1.5">
            <div className="text-base sm:text-lg font-bold font-display text-foreground">
              {clientTeamMembers.length} {isAr ? "مساهمين" : "contributors"}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {monthlyDeliveryTasks.filter(t => t.status !== "done").length} {isAr ? "مهام جارية للتسليم" : "active open tasks"}
          </span>
        </button>

        {/* Metric 5: ATTENTION & RISK */}
        <div className={`p-4 sm:p-5 col-span-2 lg:col-span-1 flex flex-col justify-between transition-colors ${
          overdueTasks.length > 0 || waitingClientTasks.length > 0 || blockedTasks.length > 0
            ? "bg-rose-500/5 dark:bg-rose-500/10"
            : ""
        }`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              {(overdueTasks.length > 0 || blockedTasks.length > 0 || waitingClientTasks.length > 0) && (
                <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              )}
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "تنبيهات ومخاطر التشغيل" : "ATTENTION & RISK"}
              </span>
            </div>
            <AlertTriangle className={`size-3.5 ${overdueTasks.length > 0 ? "text-rose-500" : blockedTasks.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
          </div>

          <div className="my-1.5">
            {overdueTasks.length === 0 && waitingClientTasks.length === 0 && blockedTasks.length === 0 ? (
              <div className="space-y-0.5">
                <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  <span>{isAr ? "الكل بانتظام (0 مخاطر)" : "All on Track (0 risks)"}</span>
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {isAr ? "لا توجد أي مهام متأخرة أو معطلة" : "Workflows on schedule"}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {overdueTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttentionFilter("overdue");
                      setDeliveryViewMode("tasks");
                      scrollToSection("delivery-section");
                    }}
                    className="px-2 py-0.5 rounded-lg bg-rose-500 text-white text-[10px] font-mono font-bold shadow-xs hover:bg-rose-600 transition-colors cursor-pointer"
                    title={isAr ? "تصفية المهام المتأخرة" : "Filter overdue tasks"}
                  >
                    {overdueTasks.length} {isAr ? "متأخرة" : "OVERDUE"}
                  </button>
                )}
                {blockedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttentionFilter("blocked");
                      setDeliveryViewMode("tasks");
                      scrollToSection("delivery-section");
                    }}
                    className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-mono font-bold shadow-xs hover:bg-amber-600 transition-colors cursor-pointer"
                    title={isAr ? "معطلة" : "Blocked tasks"}
                  >
                    {blockedTasks.length} {isAr ? "معطلة" : "BLOCKED"}
                  </button>
                )}
                {waitingClientTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttentionFilter("waiting");
                      setDeliveryViewMode("tasks");
                      scrollToSection("delivery-section");
                    }}
                    className="px-2 py-0.5 rounded-lg bg-purple-600 text-white text-[10px] font-mono font-bold shadow-xs hover:bg-purple-700 transition-colors cursor-pointer"
                    title={isAr ? "بانتظار العميل" : "Waiting on client"}
                  >
                    {waitingClientTasks.length} {isAr ? "بانتظار العميل" : "WAITING"}
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="text-[10px] text-muted-foreground block">
            {overdueTasks.length > 0
              ? (isAr ? "اضغط على التنبيه للوصول الفوري للمهمة" : "Click badge to jump to task")
              : (isAr ? "جاهزية تشغيلية كاملة" : "Zero active blockers")}
          </span>
        </div>
      </div>

        {/* Operational Synthesis & Immediate Next Action Alert Banner Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">
              {isAr ? "1. نظرة عامة والملف التجاري" : "1. Overview & Operational Posture"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "الرؤية التنفيذية للحساب، وتيرة الدورة الشهرية، والمهام ذات الأولوية الفورية."
                : "Executive cockpit, cycle pacing rhythm, and high-priority deliverables."}
            </p>
          </div>
        </div>

        {/* Operational Synthesis & Immediate Next Action Alert Banner */}
        <div className="p-5 md:p-6 rounded-3xl border border-border bg-card elevated-shadow space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {isAr ? "الوضعية التشغيلية للحساب" : "OPERATIONAL POSTURE"}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-semibold text-foreground">
                  {client.package_name || (isMonthly ? (isAr ? "باقة اشتراك شهري" : "Monthly Retainer") : (isAr ? "مشروع لمرة واحدة" : "One-Off Project"))}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="font-mono text-xs font-bold text-foreground" dir="ltr">
                  {formatCurrency(contractDisplayValue)} {isMonthly ? (isAr ? "/ شهر" : "/ mo") : ""}
                </span>
              </div>

              {/* Synthesized Next Action Recommendation */}
              <div className="pt-1">
                {overdueTasks.length > 0 ? (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span className="font-medium truncate">
                        {isAr
                          ? `إجراء فوري مطلوب: يوجد ${overdueTasks.length} مهام تجاوزت موعد الاستحقاق تتطلب إعادة تعيين أو تدخلاً سريعاً.`
                          : `CRITICAL ACTION: ${overdueTasks.length} deliverables are overdue. Reassign or expedite immediately.`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttentionFilter("overdue");
                        setDeliveryViewMode("tasks");
                        scrollToSection("delivery-section");
                      }}
                      className="px-3 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-semibold shrink-0 hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      {isAr ? "استعراض المهام المتأخرة" : "Review Overdue"}
                    </button>
                  </div>
                ) : waitingClientTasks.length > 0 ? (
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="size-4 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="font-medium truncate">
                        {isAr
                          ? `إجراء متابعة: يوجد ${waitingClientTasks.length} مهام بانتظار موافقة أو أصول من العميل.`
                          : `ACTION REQUIRED: ${waitingClientTasks.length} deliverables waiting on client approval or visual assets.`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttentionFilter("waiting");
                        setDeliveryViewMode("tasks");
                        scrollToSection("delivery-section");
                      }}
                      className="px-3 py-1 rounded-xl bg-purple-600 text-white text-[11px] font-semibold shrink-0 hover:bg-purple-700 transition-colors cursor-pointer"
                    >
                      {isAr ? "متابعة الاعتماد" : "Track Approvals"}
                    </button>
                  </div>
                ) : blockedTasks.length > 0 ? (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium truncate">
                        {isAr
                          ? `تنبيه تشغيلي: يوجد ${blockedTasks.length} مهام معطلة بسبب عوائق تقنية أو تصوير.`
                          : `ACTION REQUIRED: ${blockedTasks.length} tasks blocked by operational or production dependencies.`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttentionFilter("blocked");
                        setDeliveryViewMode("tasks");
                        scrollToSection("delivery-section");
                      }}
                      className="px-3 py-1 rounded-xl bg-amber-600 text-white text-[11px] font-semibold shrink-0 hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      {isAr ? "حل التعطيل" : "Resolve Blockers"}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">
                      {isAr
                        ? "جميع مسارات الإنتاج والتسليم تسير بانسيابية ووفق الجدول الزمني المحدد لهذا الشهر."
                        : "ALL SYSTEMS GO: Deliverables in flight are progressing according to calendar milestones."}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cycle Pacing Rhythm Box */}
            {cyclePacing && cyclePacing.isCurrent && (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border shrink-0 min-w-[220px] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground font-semibold">
                  <span>{isAr ? "وتيرة أيام الشهر" : "Cycle Days Elapsed"}</span>
                  <span className="text-foreground font-bold">{cyclePacing.daysElapsed} / {cyclePacing.totalDays}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full"
                    style={{ width: `${cyclePacing.timePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">{isAr ? "إنجاز الحصص" : "Quota Progress"}: {cyclePacing.deliveryPercent}%</span>
                  <span className={`font-bold px-1.5 py-0.2 rounded ${
                    cyclePacing.status === "ahead" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                    cyclePacing.status === "behind" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {cyclePacing.status === "ahead" ? (isAr ? "متقدم عن الوتيرة" : "Ahead of pacing") :
                     cyclePacing.status === "behind" ? (isAr ? "متأخر عن الوتيرة" : "Behind pacing") :
                     (isAr ? "على الجدول تماماً" : "On schedule")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Deliverables in Flight & Client Memory Directives */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Tasks in Flight (2 cols) */}
          <div className="lg:col-span-2 p-6 rounded-3xl border border-border bg-card elevated-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "المهام الجارية ذات الأولوية" : "High Priority Deliverables in Flight"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "المهام ذات الأولوية في جدول الإنتاج والتسليم لهذا الشهر" : "Urgent and upcoming client deliverables for this cycle"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryViewMode("tasks");
                    scrollToSection("delivery-section");
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                >
                  {isAr ? "عرض الكل في مركز التسليم" : "View All in Delivery"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setShowTaskModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  <span>{isAr ? "مهمة جديدة" : "New Task"}</span>
                </button>
              </div>
            </div>

            {monthlyDeliveryTasks.filter(t => t.status !== "done").length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-foreground">{isAr ? "جميع مهام هذه الدورة مكتملة ومسلّمة!" : "All tasks for this period are completed!"}</p>
                <p>{isAr ? "يمكنك توليد مهام جديدة أو التبديل إلى الشهر التالي." : "You can generate tasks for upcoming periods in the Delivery Center."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monthlyDeliveryTasks.filter(t => t.status !== "done").slice(0, 5).map(task => {
                  const catLower = (task.category || task.title || "").toLowerCase();
                  const isReel = catLower.includes("reel");
                  const isPost = catLower.includes("post");
                  const isStory = catLower.includes("story") || catLower.includes("ستوري");
                  const emblemLabel = isReel ? "REEL" : isPost ? "POST" : isStory ? "STORY" : (task.category || "TASK");
                  const emblemClass = isReel ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                                      isPost ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                                      isStory ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" :
                                      "bg-muted text-muted-foreground border border-border";

                  return (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateTaskStatus(task.id, task.status)}
                          className="size-5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:border-primary shrink-0 transition-colors cursor-pointer"
                          title={isAr ? "تحديد كمنجز" : "Mark done"}
                        >
                          {task.status === "done" && <Check className="size-3.5" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${emblemClass}`}>
                              {emblemLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setInspectingTask(task)}
                              className="font-semibold text-xs text-foreground hover:text-primary transition-colors text-start truncate block cursor-pointer"
                            >
                              {task.title}
                            </button>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{getMemberDisplayName(task.assignee_id)}</span>
                            {task.deadline && (
                              <span>· {isAr ? "الاستحقاق" : "Due"} <span dir="ltr">{format(parseISO(task.deadline), "d MMM")}</span></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase ${
                          task.priority === "urgent" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                          task.priority === "high" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {getPriorityLabel(task.priority)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInspectingTask(task)}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title={isAr ? "تفاصيل المهمة" : "Task details"}
                        >
                          <Eye className="size-3 text-primary" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Client Memory Directives Snapshot (1 col) */}
          <div className="p-6 rounded-3xl border border-border bg-card elevated-shadow space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <FileEdit className="size-4 text-primary" />
                  <h3 className="font-display font-bold text-base text-foreground">
                    {isAr ? "ذاكرة العميل والتوجيهات" : "Client Directives & Memory"}
                  </h3>
                  {parsedMemory.activeCount > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {parsedMemory.activeCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => scrollToSection("memory-section")}
                  className="text-primary text-xs font-semibold hover:underline cursor-pointer"
                >
                  {isAr ? "تعديل" : "Edit"}
                </button>
              </div>

              {parsedMemory.activeCount > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {parsedMemory.categories.filter(c => c.hasContent).map(c => (
                      <span key={c.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${c.badgeBg}`}>
                        <c.icon className="size-2.5" />
                        <span>{isAr ? c.labelAr : c.labelEn}</span>
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed line-clamp-4 bg-muted/20 p-3 rounded-2xl border border-border/40">
                    {parsedMemory.generalNotes || parsedMemory.categories.find(c => c.hasContent)?.content || client.notes}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-xl">
                  {isAr ? "لم يتم تدوين أي إرشادات تشغيلية أو هوية بصرية لهذا العميل بعد." : "No operational guidelines or brand directives recorded yet."}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => scrollToSection("memory-section")}
                className="w-full py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-center transition-colors block cursor-pointer"
              >
                {isAr ? "فتح السجل الكامل للملاحظات والتوجيهات" : "Open Full Directives Dossier"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: SERVICES & PACKAGE (SSOT QUOTAS & RECONCILIATION)
      ===================================================================== */}
      <section id="services-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">
                {isAr ? "2. خدمات الباقة والحصص التعاقدية (SSOT)" : "2. Services & Package Quotas"}
              </h2>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {isAr ? "المصدر الرسمي (SSOT)" : "Canonical SSOT"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "ما الذي اشتراه العميل رسمياً من صدى؟ متابعة الحصص الشهرية، الاستخدام الفعلي، والمتبقي."
                : "What did the client buy? Monthly allowances, actual utilization, and remaining deliverables."}
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowEditPackageModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <Pencil className="size-3.5" />
              <span>{isAr ? "تعديل الباقة والحصص" : "Edit Package"}</span>
            </button>
          )}
        </div>

        {/* Quotas Cards Grid */}
        {/* Authoritative Service Commitment Ledger (Monthly Retainer vs One-Off) */}
        {isMonthly ? (
          <div className="p-6 rounded-3xl border border-border bg-card elevated-shadow space-y-5">
            {/* Commitment Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold block">
                  {isAr ? "الاشتراك الشهري المعتمد (SSOT)" : "Contracted Monthly Retainer"}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-display font-bold text-lg text-foreground">
                    {client.package_name || (isAr ? "باقة تسويق رقمي مخصصة" : "Custom Marketing Retainer")}
                  </h3>
                  <span className="text-sm font-mono font-bold text-foreground tabular-nums px-2.5 py-0.5 rounded-lg bg-muted border border-border">
                    {formatCurrency(currentPrice)} {isAr ? "/ شهر" : "/ mo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="text-end">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">{isAr ? "إجمالي الحصص التعاقدية" : "Total Contracted Quota"}</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {currentReelsQuota + currentPostsQuota + currentStoriesQuota} {isAr ? "تسليمات / شهر" : "assets / mo"}
                  </span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-end">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">{isAr ? "إنجاز الشهر الحالي" : "Current Cycle"}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {periodProgress.totalDone} / {periodProgress.totalQuota} ({periodProgress.percent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Quota Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-bold text-start">{isAr ? "نوع الخدمة والتسليم" : "Service Type"}</th>
                    <th className="px-4 py-3 font-bold text-center">{isAr ? "الحصة التعاقدية" : "Contracted"}</th>
                    <th className="px-4 py-3 font-bold text-center">{isAr ? "المُنجز" : "Delivered"}</th>
                    <th className="px-4 py-3 font-bold text-center">{isAr ? "المتبقي" : "Remaining"}</th>
                    <th className="px-4 py-3 font-bold text-start min-w-[140px]">{isAr ? "معدل الإنجاز" : "Progress"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {/* Reels Row */}
                  <tr className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                        <div>
                          <span className="font-bold text-foreground text-xs block">{isAr ? "فيديوهات ريلز (Reels)" : "Reels / Video Content"}</span>
                          <span className="text-[10px] text-muted-foreground">{isAr ? "فيديو قصير، تصوير، ومونتاج إبداعي" : "Short-form video, filming & editing"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                      {currentReelsQuota} <span className="text-[10px] text-muted-foreground font-normal">{isAr ? "/ شهر" : "/ mo"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {periodReelsTasks.filter(t => t.status === "done").length}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-primary">
                      {Math.max(0, currentReelsQuota - periodReelsTasks.filter(t => t.status === "done").length)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">{currentReelsQuota > 0 ? Math.round((periodReelsTasks.filter(t => t.status === "done").length / currentReelsQuota) * 100) : 0}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all"
                            style={{ width: `${currentReelsQuota > 0 ? Math.min(100, (periodReelsTasks.filter(t => t.status === "done").length / currentReelsQuota) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Posts Row */}
                  <tr className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                        <div>
                          <span className="font-bold text-foreground text-xs block">{isAr ? "منشورات وتصاميم (Posts)" : "Posts & Graphic Designs"}</span>
                          <span className="text-[10px] text-muted-foreground">{isAr ? "تصاميم جرافيك، منشورات دائرية، ونصوص" : "Graphics, carousels, and copywriting"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                      {currentPostsQuota} <span className="text-[10px] text-muted-foreground font-normal">{isAr ? "/ شهر" : "/ mo"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {periodPostsTasks.filter(t => t.status === "done").length}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-primary">
                      {Math.max(0, currentPostsQuota - periodPostsTasks.filter(t => t.status === "done").length)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">{currentPostsQuota > 0 ? Math.round((periodPostsTasks.filter(t => t.status === "done").length / currentPostsQuota) * 100) : 0}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${currentPostsQuota > 0 ? Math.min(100, (periodPostsTasks.filter(t => t.status === "done").length / currentPostsQuota) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Stories Row */}
                  <tr className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                        <div>
                          <span className="font-bold text-foreground text-xs block">{isAr ? "قصص تفاعلية (Stories)" : "Stories & Engagement"}</span>
                          <span className="text-[10px] text-muted-foreground">{isAr ? "قصص تفاعلية يومية واستطلاعات رأي" : "Daily interactive stories & audience polls"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                      {currentStoriesQuota} <span className="text-[10px] text-muted-foreground font-normal">{isAr ? "/ شهر" : "/ mo"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {periodStoriesTasks.filter(t => t.status === "done").length}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-primary">
                      {Math.max(0, currentStoriesQuota - periodStoriesTasks.filter(t => t.status === "done").length)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">{currentStoriesQuota > 0 ? Math.round((periodStoriesTasks.filter(t => t.status === "done").length / currentStoriesQuota) * 100) : 0}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${currentStoriesQuota > 0 ? Math.min(100, (periodStoriesTasks.filter(t => t.status === "done").length / currentStoriesQuota) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Included Extra Services Scope Footer */}
            {(client.package_config?.other_services || []).length > 0 && (
              <div className="pt-3 border-t border-border flex items-center gap-2 flex-wrap text-xs">
                <span className="text-muted-foreground font-semibold">{isAr ? "خدمات إضافية مشمولة بالعقد:" : "Included Contract Scope:"}</span>
                {client.package_config?.other_services?.map((srv: string, idx: number) => (
                  <span key={idx} className="px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold">
                    {srv}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ONE-OFF PROJECT COMMITMENT & SCOPE (NO FAKE /MO OR EMPTY QUOTA CARDS) */
          <div className="p-6 rounded-3xl border border-border bg-card elevated-shadow space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold block">
                  {isAr ? "مشروع مستقل لمرة واحدة (One-Off Scope)" : "One-Off Project Engagement"}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-display font-bold text-lg text-foreground">
                    {client.package_name || (isAr ? "نطاق عمل ومخرجات المشروع" : "Project Deliverables Scope")}
                  </h3>
                  <span className="text-sm font-mono font-bold text-foreground tabular-nums px-2.5 py-0.5 rounded-lg bg-muted border border-border">
                    {formatCurrency(contractDisplayValue)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="text-end">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">{isAr ? "الموعد النهائي للعقد" : "Contract Target"}</span>
                  <span className="font-mono font-bold text-foreground text-sm" dir="ltr">
                    {(client as any).contract_end_date || client.billing_start_date || (isAr ? "مشروع جاري" : "In Progress")}
                  </span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-end">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">{isAr ? "إجمالي إنجاز المشروع" : "Project Completion"}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {tasks.filter(t => t.status === "done").length} / {tasks.length} ({tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "done").length / tasks.length) * 100) : 100}%)
                  </span>
                </div>
              </div>
            </div>

            {/* One-Off Deliverables Scope Table */}
            {deliverables.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-bold text-start">{isAr ? "مخرجات المشروع" : "Deliverable"}</th>
                      <th className="px-4 py-3 font-bold text-start">{isAr ? "النوع" : "Type"}</th>
                      <th className="px-4 py-3 font-bold text-center">{isAr ? "الكمية المطلوبة" : "Target"}</th>
                      <th className="px-4 py-3 font-bold text-center">{isAr ? "المُنجز" : "Done"}</th>
                      <th className="px-4 py-3 font-bold text-center">{isAr ? "المتبقي" : "Remaining"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {deliverables.map(deliv => (
                      <tr key={deliv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{deliv.title}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-[10px] uppercase">
                            {getDeliverableTypeLabel(deliv.deliverable_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-center">{deliv.target_quantity}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-center">{deliv.done_quantity}</td>
                        <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400 text-center">{deliv.remaining_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                <span>{isAr ? "تم تحديد نطاق العمل بناءً على مهام المشروع المستقل." : "Project deliverables tracked via project tasks."}</span>
                <button
                  type="button"
                  onClick={() => setShowNewDeliverableModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted font-semibold text-foreground inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>{isAr ? "إضافة مخرج للمشروع" : "Add Deliverable"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recurring Service Commitments & Scheduling Engine */}
        <div className="p-6 rounded-3xl border border-border bg-card space-y-5 elevated-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Repeat className="size-5 text-primary" />
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "الالتزامات التعاقدية المتكررة وقواعد الجدولة" : "Recurring Service Commitments & Rules"}
                </h3>
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {commitments.length} {isAr ? "التزامات" : "Commitments"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "القواعد الآلية لتوليد مهام التقويم شهرياً وأسبوعياً. تضمن عدم ضياع أي خدمة تعاقدية."
                  : "Automated recurring scheduling rules. Generates idempotent deliverables each month."}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(linkedPackage || client?.package_config) && (
                <button
                  type="button"
                  onClick={handleAutoDeriveCommitments}
                  className="px-3 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="size-3.5" />
                  <span>{isAr ? "اشتقاق من الباقة" : "Derive from Package"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingCommitment(null);
                  setShowCommitmentModal(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>{isAr ? "إضافة التزام" : "Add Commitment"}</span>
              </button>
            </div>
          </div>

          {/* Commitments List */}
          {commitments.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
              <p>{isAr ? "لا توجد التزامات خدمات متكررة مسجلة لهذا العميل حتى الآن." : "No recurring service commitments defined for this client yet."}</p>
              <div className="flex items-center justify-center gap-3 pt-1">
                {(linkedPackage || client?.package_config) && (
                  <button
                    type="button"
                    onClick={handleAutoDeriveCommitments}
                    className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="size-3" />
                    {isAr ? "اشتقاق الالتزامات تلقائياً" : "Auto-derive rules"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {commitments.map((commit) => {
                const isActive = commit.status === "active";
                const isPaused = commit.status === "paused";
                const assigneeName = commit.assignee_id ? getMemberDisplayName(commit.assignee_id) : (isAr ? "مطابقة حسب الدور" : "Role-matched");

                return (
                  <div
                    key={commit.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isPaused ? "bg-amber-500/5 border-amber-500/30" : isActive ? "bg-card border-border hover:border-primary/40" : "bg-muted/30 border-border opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground font-display">
                            {commit.service_name}
                          </span>
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                            isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" :
                            isPaused ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                            "bg-muted text-muted-foreground border-border"
                          }`}>
                            {isActive ? (isAr ? "نشط · التوليد مستمر" : "Active") : isPaused ? (isAr ? "معلق مؤقتاً · التاريخ محفوظ" : "Paused") : (isAr ? "غير نشط" : "Inactive")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                          <span className="font-semibold text-primary">
                            {commit.quantity}x {commit.frequency === "weekly" ? (isAr ? "أسبوعياً" : "weekly") : (isAr ? "شهرياً" : "monthly")}
                          </span>
                          {commit.duration_hours && <span>• {commit.duration_hours}h</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleCommitmentStatus(commit)}
                          className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors"
                          title={isActive ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "استئناف" : "Resume")}
                        >
                          {isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommitment(commit);
                            setShowCommitmentModal(true);
                          }}
                          className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCommitment(commit.id)}
                          className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground border-t border-border/50">
                      <span className="flex items-center gap-1 truncate">
                        <User className="size-3 shrink-0" />
                        <span>{assigneeName}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: MONTHLY DELIVERY CENTER (FULL OPERATIONAL WORKSPACE)
      ===================================================================== */}
      <section id="delivery-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">
                {isAr ? "3. مركز التسليم والعمليات التشغيلية" : "3. Monthly Delivery Center"}
              </h2>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {monthlyDeliveryTasks.length} {isAr ? "مهام الدورة" : "Tasks in period"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "المصدر التشغيلي الموحد لجميع المهام وحصص التسليم وجلسات التصوير والتقويم."
                : "Single Source of Truth for tasks, deliverable quotas, shoot bookings, and calendar."}
            </p>
          </div>
        </div>

        {/* Month Selector Bar & Quick Generation */}
        <div className="p-5 rounded-3xl border border-border bg-card elevated-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="size-8 rounded-xl border border-border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={isAr ? "الشهر السابق" : "Previous Month"}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>

            <div className="text-center min-w-[140px]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "الشهر التشغيلي المختار" : "Selected Operational Period"}
              </span>
              <span className="font-display font-bold text-base md:text-lg text-foreground" dir="ltr">
                {formatPeriodMonth(selectedPeriod)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="size-8 rounded-xl border border-border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={isAr ? "الشهر التالي" : "Next Month"}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>

          {/* Actions: Reconcile / Generate / Add Task */}
          <div className="flex items-center gap-2 flex-wrap">
            <SADAButton
              type="button"
              variant="outline"
              disabled={reconciling}
              onClick={handleReconcilePackageWork}
            >
              {reconciling ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Layers className="size-3.5 mr-1.5 text-primary" />}
              <span>{isAr ? "تسوية العمل (SSOT)" : "Reconcile Work"}</span>
            </SADAButton>

            <SADAButton
              type="button"
              variant="primary"
              disabled={generatingTasks}
              onClick={handleGenerateCommitmentTasks}
            >
              {generatingTasks ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Play className="size-3.5 fill-current mr-1.5" />}
              <span>{isAr ? "توليد تسليمات الشهر" : "Generate Deliverables"}</span>
            </SADAButton>

            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-primary text-white text-xs font-semibold shadow-xs hover:scale-[1.01] transition-transform inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{isAr ? "مهمة تشغيلية جديدة" : "New Task"}</span>
            </button>
          </div>
        </div>

        {/* View Mode Switcher + Attention Filters Bar */}
        <div className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
            {[
              { id: "tasks", label: isAr ? "قائمة المهام بالخدمة" : "Tasks by Service", icon: CheckSquare },
              { id: "ledger", label: isAr ? "جدول الحصص والتسليمات" : "Deliverables Ledger", icon: BarChart3 },
              { id: "pipeline", label: isAr ? "مسار التصوير الميداني" : "Shoot Pipeline", icon: Workflow },
              { id: "calendar", label: isAr ? "تقويم الشهر" : "Monthly Calendar", icon: Calendar },
            ].map(vm => {
              const Icon = vm.icon;
              const isActive = deliveryViewMode === vm.id;
              return (
                <button
                  key={vm.id}
                  type="button"
                  onClick={() => setDeliveryViewMode(vm.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{vm.label}</span>
                </button>
              );
            })}
          </div>

          {/* Attention / Category Filters for Tasks view */}
          {deliveryViewMode === "tasks" && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Attention Pills */}
              <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAttentionFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    attentionFilter === "all" ? "bg-card text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isAr ? "الكل" : "All"} ({monthlyDeliveryTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttentionFilter("overdue")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    attentionFilter === "overdue" ? "bg-rose-500 text-white shadow-2xs font-bold" : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  }`}
                >
                  {isAr ? "متأخرة" : "Overdue"} ({overdueTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttentionFilter("waiting")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    attentionFilter === "waiting" ? "bg-purple-600 text-white shadow-2xs font-bold" : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                  }`}
                >
                  {isAr ? "بانتظار العميل" : "Waiting"} ({waitingClientTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttentionFilter("blocked")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    attentionFilter === "blocked" ? "bg-amber-600 text-white shadow-2xs font-bold" : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  {isAr ? "معطلة" : "Blocked"} ({blockedTasks.length})
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
                {["all", "todo", "in_progress", "review", "done"].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTaskStatusFilter(st)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                      taskStatusFilter === st ? "bg-card text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st === "all" ? (isAr ? "الحالة: الكل" : "Status: All") : st.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Attention Filter Chip (Triggered when clicked from Cockpit or Filter Bar) */}
        {attentionFilter !== "all" && (
          <div className={`flex items-center justify-between p-3 rounded-2xl border text-xs ${
            attentionFilter === "overdue" ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300" :
            attentionFilter === "waiting" ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300" :
            attentionFilter === "blocked" ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" :
            "bg-primary/10 border-primary/30 text-primary"
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {isAr ? "تصفية التنبيهات النشطة:" : "Active Attention Filter:"}{" "}
                <strong className="text-foreground">
                  {attentionFilter === "overdue" ? (isAr ? `${overdueTasks.length} مهام متأخرة عن موعد الاستحقاق` : `${overdueTasks.length} Overdue Deliverables`) :
                   attentionFilter === "waiting" ? (isAr ? `${waitingClientTasks.length} مهام بانتظار العميل` : `${waitingClientTasks.length} Waiting on Client`) :
                   attentionFilter === "blocked" ? (isAr ? `${blockedTasks.length} مهام معطلة تشغيلياً` : `${blockedTasks.length} Blocked Tasks`) :
                   (isAr ? "مهام عاجلة" : "Urgent Tasks")}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttentionFilter("all")}
              className="px-2.5 py-1 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="size-3" />
              <span>{isAr ? "إلغاء التصفية (عرض الكل)" : "Clear Filter"}</span>
            </button>
          </div>
        )}

        {/* Active Assignee Filter Chip (Triggered when clicked from Team section) */}
        {assigneeFilter !== "all" && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs">
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <span>
                {isAr ? "تمت تصفية المهام لعرض أعمال العضو فقط:" : "Filtered to show work for team member:"}{" "}
                <strong className="text-foreground">{getMemberDisplayName(assigneeFilter)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAssigneeFilter("all")}
              className="px-2.5 py-1 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <X className="size-3" />
              <span>{isAr ? "إلغاء التصفية وإظهار كل الفريق" : "Clear Filter"}</span>
            </button>
          </div>
        )}

        {/* VIEW 1: CALENDAR VIEW */}
        {deliveryViewMode === "calendar" && (
          <div className="p-4 md:p-6 rounded-3xl border border-border bg-card elevated-shadow">
            <CalendarGrid
              tasks={monthlyDeliveryTasks}
              projects={calendarProjects}
              profiles={profiles}
              teamMembers={teamMembers}
              onTaskClick={(task) => setInspectingTask(task)}
              onCreateTask={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
              onStatusChange={(taskId, status) => handleUpdateTaskStatus(taskId, status)}
            />
          </div>
        )}

        {/* VIEW 2: DELIVERABLES LEDGER TABLE */}
        {deliveryViewMode === "ledger" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 elevated-shadow">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "جدول حصص وأهداف التسليم" : "Deliverables Targets & Ledger"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "متابعة إنجاز الحصص التعاقدية المجدولة" : "Deliverable targets tracked against current monthly cycle"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewDeliverableModal(true)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted inline-flex items-center gap-1.5"
              >
                <Plus className="size-3" />
                <span>{isAr ? "إضافة هدف تسليم" : "Add Target"}</span>
              </button>
            </div>

            {deliverables.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {isAr ? "لا توجد أهداف تسليم مجدولة حالياً." : "No scheduled deliverable targets."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="px-3 py-2.5 font-bold text-start">{isAr ? "التسليم" : "Deliverable"}</th>
                      <th className="px-3 py-2.5 font-bold text-start">{isAr ? "النوع" : "Type"}</th>
                      <th className="px-3 py-2.5 font-bold text-center">{isAr ? "الهدف" : "Target"}</th>
                      <th className="px-3 py-2.5 font-bold text-center">{isAr ? "المنجز" : "Done"}</th>
                      <th className="px-3 py-2.5 font-bold text-center">{isAr ? "المتبقي" : "Remaining"}</th>
                      <th className="px-3 py-2.5 font-bold text-end">{isAr ? "إجراء سريع" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {deliverables.map(deliv => (
                      <tr key={deliv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-semibold text-foreground">{deliv.title}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-[10px] uppercase">
                            {getDeliverableTypeLabel(deliv.deliverable_type)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-center">{deliv.target_quantity}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-center">{deliv.done_quantity}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400 text-center">{deliv.remaining_quantity}</td>
                        <td className="px-3 py-2.5 text-end">
                          <button
                            type="button"
                            onClick={() => handleIncrementDeliverable(deliv)}
                            className="px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <Plus className="size-3" />
                            <span>{isAr ? "+1 إنجاز" : "+1 Done"}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: SHOOT PRODUCTION PIPELINE */}
        {deliveryViewMode === "pipeline" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 elevated-shadow">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "جلسات التصوير والإنتاج الإبداعي" : "Production Shoot Pipeline"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "مسار مراحل الإنتاج الميداني وجلسات التصوير" : "On-location shoots, equipment, and 8-stage pipeline"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewBookingModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>{isAr ? "حجز جلسة تصوير" : "Book Shoot"}</span>
              </button>
            </div>

            {productionBookings.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {isAr ? "لا توجد جلسات تصوير مجدولة حالياً." : "No production shoots scheduled."}
              </div>
            ) : (
              <div className="space-y-4">
                {productionBookings.map(booking => {
                  const currIdx = PRODUCTION_WORKFLOW_STEPS.indexOf(booking.stage);
                  const nextStage = currIdx >= 0 && currIdx < PRODUCTION_WORKFLOW_STEPS.length - 1 ? PRODUCTION_WORKFLOW_STEPS[currIdx + 1] : null;

                  return (
                    <div key={booking.id} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-sm text-foreground">{booking.title}</span>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>📅 <span dir="ltr">{booking.date}</span> ({booking.time})</span>
                            <span>📍 {booking.location}</span>
                          </div>
                        </div>

                        {nextStage ? (
                          <button
                            type="button"
                            onClick={() => handleAdvanceBookingStage(booking)}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                          >
                            <span>{isAr ? `الانتقال إلى: ${getProductionStepLabel(nextStage)}` : `Advance: ${nextStage}`}</span>
                            <ArrowRight className="size-3 rtl:rotate-180" />
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="size-4" /> {isAr ? "تم التسليم والنشر" : "Published"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: TASKS GROUPED BY SERVICE TYPE (PRIMARY DELIVERY VIEW) */}
        {deliveryViewMode === "tasks" && (
          <div className="space-y-6">
            {filteredDeliveryTasks.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-3xl space-y-2">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-foreground text-sm">
                  {isAr ? "لا توجد مهام تطابق معايير التصفية المحددة." : "No tasks matching current filter."}
                </p>
                <p>{isAr ? "يمكنك توليد مهام جديدة أو تعديل خيارات التصفية أعلاه." : "You can generate tasks or clear filters above."}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. REELS SERVICE GROUP */}
                {deliveryReels.length > 0 && (
                  <div className="p-5 rounded-3xl border border-border bg-card space-y-3 elevated-shadow">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-rose-500" />
                        <h4 className="font-display font-bold text-sm text-foreground">
                          {isAr ? "فيديوهات ريلز ومونتاج الفيديو (Reels)" : "Reels & Video Deliverables"}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {deliveryReels.filter(t => t.status === "done").length} / {deliveryReels.length} {isAr ? "منجز" : "done"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {deliveryReels.map(task => renderDeliveryTaskRow(
                        task,
                        isAr ? "ريلز" : "REEL",
                        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. POSTS SERVICE GROUP */}
                {deliveryPosts.length > 0 && (
                  <div className="p-5 rounded-3xl border border-border bg-card space-y-3 elevated-shadow">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-blue-500" />
                        <h4 className="font-display font-bold text-sm text-foreground">
                          {isAr ? "تصاميم ومنشورات الجرافيك (Posts)" : "Posts & Graphic Designs"}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {deliveryPosts.filter(t => t.status === "done").length} / {deliveryPosts.length} {isAr ? "منجز" : "done"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {deliveryPosts.map(task => renderDeliveryTaskRow(
                        task,
                        isAr ? "منشور" : "POST",
                        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. STORIES SERVICE GROUP */}
                {deliveryStories.length > 0 && (
                  <div className="p-5 rounded-3xl border border-border bg-card space-y-3 elevated-shadow">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-purple-500" />
                        <h4 className="font-display font-bold text-sm text-foreground">
                          {isAr ? "القصص التفاعلية اليومية (Stories)" : "Stories & Engagement"}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {deliveryStories.filter(t => t.status === "done").length} / {deliveryStories.length} {isAr ? "منجز" : "done"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {deliveryStories.map(task => renderDeliveryTaskRow(
                        task,
                        isAr ? "ستوري" : "STORY",
                        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. PHOTOGRAPHY SERVICE GROUP */}
                {deliveryPhotos.length > 0 && (
                  <div className="p-5 rounded-3xl border border-border bg-card space-y-3 elevated-shadow">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-amber-500" />
                        <h4 className="font-display font-bold text-sm text-foreground">
                          {isAr ? "التصوير الفوتوغرافي ومعالجة الصور (Photography)" : "Photography & Asset Processing"}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {deliveryPhotos.filter(t => t.status === "done").length} / {deliveryPhotos.length} {isAr ? "منجز" : "done"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {deliveryPhotos.map(task => renderDeliveryTaskRow(
                        task,
                        isAr ? "تصوير" : "PHOTO",
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. OTHER DELIVERABLES GROUP */}
                {deliveryOther.length > 0 && (
                  <div className="p-5 rounded-3xl border border-border bg-card space-y-3 elevated-shadow">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        <h4 className="font-display font-bold text-sm text-foreground">
                          {isAr ? "المهام والخدمات التشغيلية الأخرى (Other)" : "Other Operational Deliverables"}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {deliveryOther.filter(t => t.status === "done").length} / {deliveryOther.length} {isAr ? "منجز" : "done"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {deliveryOther.map(task => renderDeliveryTaskRow(
                        task,
                        isAr ? "خدمة" : "OTHER",
                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          SECTION 4: TEAM & WORK (CONTRIBUTORS WORKING ON CLIENT)
      ===================================================================== */}
      <section id="team-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">
                {isAr ? "4. فريق العمل والمساهمون في الحساب" : "4. Team Members & Active Work"}
              </h2>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {clientTeamMembers.length} {isAr ? "أعضاء مكلفون" : "Contributors"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "الأعضاء المكلفون بتنفيذ أعمال هذا العميل وتوزيع المهام المباشرة عليهم."
                : "Specialists assigned to client deliverables with direct client-work filtering."}
            </p>
          </div>

          <Link
            to="/admin/team-workload"
            className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            <Users className="size-3.5" />
            <span>{isAr ? "فتح جدول الفريق العام" : "Open in Team Workload"}</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {/* Account Leadership Strip */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
              AM
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "مدير الحساب الرئيسي" : "Account Manager (Lead)"}
              </span>
              <span className="font-semibold text-foreground">
                {getMemberDisplayName(client.account_manager_id || client.relationship_owner_id)}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-border/60 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-muted border border-border flex items-center justify-center font-bold text-muted-foreground text-xs shrink-0">
              SO
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "مسؤول المبيعات والصفقة" : "Sales & Deal Owner"}
              </span>
              <span className="font-semibold text-foreground">
                {getMemberDisplayName(client.sales_owner_id || client.commission_recipient_id)}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-border/60 hidden sm:block" />

          <div className="text-[11px] text-muted-foreground">
            <span>{isAr ? "المساهمون المكلفون:" : "Active Specialists:"} </span>
            <strong className="text-foreground font-mono">{clientTeamMembers.length} {isAr ? "أعضاء" : "members"}</strong>
          </div>
        </div>

        {/* Active Contributors Cards */}
        <div className="space-y-4">
          <h3 className="font-display font-bold text-base text-foreground">
            {isAr ? "المنفذون المباشرون للمهام (Active Specialists)" : "Task Assignees & Specialists"}
          </h3>

          {clientTeamMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-3xl">
              {isAr ? "لا يوجد أعضاء مكلفون بمهام مفتوحة لهذا العميل حالياً." : "No team members currently assigned to open tasks."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientTeamMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-5 rounded-3xl border border-border bg-card space-y-4 elevated-shadow hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display font-bold text-sm text-foreground truncate">{member.name}</h4>
                      <p className="text-[11px] text-muted-foreground truncate">{member.role}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {member.overdueCount > 0 && (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          {member.overdueCount} {isAr ? "متأخرة" : "overdue"}
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {member.tasksCount} {isAr ? "مهام" : "tasks"}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center text-xs">
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground block">{isAr ? "ريلز" : "Reels"}</span>
                      <span className="font-mono font-bold text-foreground">{member.reelsCount}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground block">{isAr ? "منشورات" : "Posts"}</span>
                      <span className="font-mono font-bold text-foreground">{member.postsCount}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground block">{isAr ? "ستوري" : "Stories"}</span>
                      <span className="font-mono font-bold text-foreground">{member.storiesCount}</span>
                    </div>
                  </div>

                  {/* Action: View work for this client */}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeFilter(member.id);
                        setDeliveryViewMode("tasks");
                        scrollToSection("delivery-section");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckSquare className="size-3" />
                      <span>{isAr ? "استعراض مهام العضو للعميل" : "View Work for Client"}</span>
                    </button>

                    <Link
                      to="/admin/team-workload"
                      className="text-muted-foreground hover:text-foreground text-[11px] inline-flex items-center gap-1"
                      title={isAr ? "فتح في جدول الفريق العام" : "Open in Team Workload"}
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: FINANCIAL & SPONSORING (CONSOLIDATED)
      ===================================================================== */}
      {canAccessFinance && clientFinancials && (
        <section id="financial-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-foreground">
                  {isAr ? "5. الملف المالي والإعلانات الممولة" : "5. Financial Operations & Sponsoring"}
                </h2>
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {getPaymentStatusBadge(clientFinancials.paymentStatus)}
                </span>
                <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                  clientFinancials.clientHealth === "HIGH PROFIT"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : clientFinancials.clientHealth === "MEDIUM"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : clientFinancials.clientHealth === "LOW PROFIT"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-muted/60 text-muted-foreground border-border/80"
                }`}>
                  {clientFinancials.clientHealth === "NO DATA"
                    ? (isAr ? "لا توجد بيانات مالية كافية" : "NO DATA")
                    : `${clientFinancials.clientHealth} (${Math.round(clientFinancials.marginPercent)}%)`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "إدارة مالية كاملة وموحدة للحساب — تسجيل المقبوضات والمصاريف وإصدار الفواتير ورصد الإعلانات مباشرة دون مغادرة العميل."
                  : "Unified financial command center — record income, expenses, issue invoices, and launch ad campaigns directly in client context."}
              </p>
            </div>

            {/* Inline Action Controls Deck */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowIncomeModal(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowDownLeft className="size-3.5" />
                <span>{isAr ? "تسجيل مقبوضات" : "Record Income"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExpenseModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <TrendingDown className="size-3.5" />
                <span>{isAr ? "تسجيل مصروف" : "Record Expense"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="size-3.5" />
                <span>{isAr ? "فاتورة جديدة" : "New Invoice"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSponsoringModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="size-3.5" />
                <span>{isAr ? "إعلان ممول" : "Sponsoring"}</span>
              </button>

              <Link
                to="/admin/finance"
                className="px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                title={isAr ? "الانتقال إلى الإدارة المالية المركزية العامة" : "Open Financial OS"}
              >
                <Coins className="size-3.5 text-muted-foreground" />
                <span>{isAr ? "النظام المالي" : "Financial OS"}</span>
              </Link>
            </div>
          </div>

          {/* Executive Financial Metrics Grid (6 Canonical Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Contract Value */}
            <div className="p-4 rounded-2xl bg-card border border-border elevated-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isMonthly ? (isAr ? "قيمة الباقة الشهرية" : "Contract Value") : (isAr ? "قيمة العقد" : "Contract Value")}
              </span>
              <div className="text-base md:text-lg font-bold font-display text-foreground tabular-nums">
                {formatCurrency(isMonthly ? clientFinancials.monthlyRevenue : contractDisplayValue)}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">
                {isMonthly ? (isAr ? "اشتراك متكرر شهرياً" : "Monthly Retainer") : (isAr ? "مشروع لمرة واحدة" : "One-off scope")}
              </span>
            </div>

            {/* 2. Invoiced */}
            <div className="p-4 rounded-2xl bg-card border border-border elevated-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "المفوتر رسمياً" : "Total Invoiced"}
              </span>
              <div className="text-base md:text-lg font-bold font-display text-foreground tabular-nums">
                {formatCurrency(clientFinancials.totalInvoiced)}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">
                {invoices.length} {isAr ? "فواتير مسجلة" : "invoices issued"}
              </span>
            </div>

            {/* 3. Collected (Cash Received) */}
            <div className="p-4 rounded-2xl bg-card border border-border elevated-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "المحصّل الفعلي" : "Total Collected"}
              </span>
              <div className="text-base md:text-lg font-bold font-display text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(clientFinancials.totalPaid)}
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block truncate">
                {payments.length} {isAr ? "إيداعات مسددة" : "receipts logged"}
              </span>
            </div>

            {/* 4. Client Attributed Expenses */}
            <div className="p-4 rounded-2xl bg-card border border-border elevated-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "المصاريف المنسوبة" : "Attributed Expenses"}
              </span>
              <div className="text-base md:text-lg font-bold font-display text-rose-600 dark:text-rose-400 tabular-nums">
                {formatCurrency(clientFinancials.clientExpenses)}
              </div>
              <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 block truncate">
                {expenses.length} {isAr ? "سندات صرف" : "expense records"}
              </span>
            </div>

            {/* 5. Outstanding Remaining */}
            <div className="p-4 rounded-2xl bg-card border border-border elevated-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "المتبقي للاستحقاق" : "Remaining Due"}
              </span>
              <div className={`text-base md:text-lg font-bold font-display tabular-nums ${clientFinancials.totalOutstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                {formatCurrency(clientFinancials.totalOutstanding)}
              </div>
              <span className={`text-[10px] block truncate ${clientFinancials.totalOutstanding > 0 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>
                {clientFinancials.totalOutstanding > 0 ? (isAr ? "مستحقات معلقة" : "Pending collection") : (isAr ? "مسدد بالكامل" : "Fully settled")}
              </span>
            </div>

            {/* 6. Sponsoring & Margin */}
            <div className="p-4 rounded-2xl bg-card border border-border elevated-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                {isAr ? "الإعلانات والهامش" : "Ads & Margin"}
              </span>
              <div className="text-base md:text-lg font-bold font-display text-purple-600 dark:text-purple-400 tabular-nums">
                {formatCurrency(clientFinancials.sponsoringAdSpend)}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">
                {isAr ? "هامش الصرف:" : "Margin:"} <strong className="text-foreground">{formatCurrency(clientFinancials.sponsoringMargin)}</strong>
              </span>
            </div>
          </div>

          {/* Unified Client Financial Ledger */}
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 elevated-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "دفتر الأستاذ المالي الموحد للعميل" : "Unified Client Financial Ledger"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "سجل حركات العميل المركزية — مقبوضات، مصاريف، فواتير، وحملات ممولة من واقع قاعدة البيانات الرسمية."
                    : "Authoritative ledger transactions — income, expenses, invoices, and campaigns."}
                </p>
              </div>

              {/* Ledger Tab Filters & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="size-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={financeSearch}
                    onChange={(e) => setFinanceSearch(e.target.value)}
                    placeholder={isAr ? "بحث في المعاملات..." : "Search transactions..."}
                    className="h-8 ps-8 pe-3 rounded-lg border border-border bg-background text-xs w-44 focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setFinanceLedgerTab("all")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      financeLedgerTab === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isAr ? "الكل" : "All"} ({unifiedClientTransactions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceLedgerTab("income")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      financeLedgerTab === "income" ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isAr ? "المقبوضات" : "Income"} ({payments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceLedgerTab("expense")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      financeLedgerTab === "expense" ? "bg-background text-rose-600 dark:text-rose-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isAr ? "المصاريف" : "Expenses"} ({expenses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceLedgerTab("invoices")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      financeLedgerTab === "invoices" ? "bg-background text-blue-600 dark:text-blue-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isAr ? "الفواتير" : "Invoices"} ({invoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceLedgerTab("sponsoring")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      financeLedgerTab === "sponsoring" ? "bg-background text-purple-600 dark:text-purple-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isAr ? "الإعلانات" : "Ads"} ({sponsoring.length})
                  </button>
                </div>
              </div>
            </div>

            {filteredClientTransactions.length === 0 ? (
              <SADAEmptyState
                icon={DollarSign}
                title={isAr ? "لا توجد معاملات مطابقة" : "No Matching Financial Records"}
                description={
                  isAr
                    ? "لم يتم العثور على حركات مالية مسجلة لهذا العميل تطابق معايير الفلترة الحالية."
                    : "No financial transactions found matching the selected category or search term."
                }
                action={{
                  label: isAr ? "تسجيل مقبوضات" : "Record Income",
                  onClick: () => setShowIncomeModal(true),
                  variant: "primary",
                }}
                secondaryAction={{
                  label: isAr ? "تسجيل مصروف" : "Record Expense",
                  onClick: () => setShowExpenseModal(true),
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="px-3.5 py-3 font-bold text-start">{isAr ? "التاريخ" : "Date"}</th>
                      <th className="px-3.5 py-3 font-bold text-start">{isAr ? "النوع" : "Type"}</th>
                      <th className="px-3.5 py-3 font-bold text-start">{isAr ? "البيان / المعاملة" : "Description"}</th>
                      <th className="px-3.5 py-3 font-bold text-start">{isAr ? "التصنيف / الجهة" : "Category / Origin"}</th>
                      <th className="px-3.5 py-3 font-bold text-end">{isAr ? "المبلغ" : "Amount"}</th>
                      <th className="px-3.5 py-3 font-bold text-center">{isAr ? "الحالة" : "Status"}</th>
                      <th className="px-3.5 py-3 font-bold text-end">{isAr ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredClientTransactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      const isExpense = tx.type === "expense";
                      const isInvoice = tx.type === "invoice";
                      const isSponsoring = tx.type === "sponsoring";

                      return (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3.5 py-3 font-mono text-muted-foreground whitespace-nowrap" dir="ltr">
                            {tx.date || "—"}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isIncome
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : isExpense
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : isInvoice
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              }`}
                            >
                              {isIncome
                                ? (isAr ? "مقبوضات" : "Income")
                                : isExpense
                                ? (isAr ? "مصروف" : "Expense")
                                : isInvoice
                                ? (isAr ? "فاتورة" : "Invoice")
                                : (isAr ? "إعلان ممول" : "Ads")}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-medium text-foreground">{tx.title}</div>
                            {tx.subtitle && (
                              <div className="text-[11px] text-muted-foreground">{tx.subtitle}</div>
                            )}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="text-foreground">{tx.category || "—"}</div>
                            {tx.reference && (
                              <div className="text-[10px] font-mono text-muted-foreground">Ref: {tx.reference}</div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-end tabular-nums font-mono font-bold whitespace-nowrap">
                            {isIncome && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(tx.amount)}
                              </span>
                            )}
                            {isExpense && (
                              <span className="text-rose-600 dark:text-rose-400">
                                -{formatCurrency(tx.amount)}
                              </span>
                            )}
                            {isInvoice && (
                              <div className="space-y-0.5">
                                <span className="text-foreground">{formatCurrency(tx.amount)}</span>
                                {typeof tx.secondaryAmount === "number" && tx.secondaryAmount > 0 && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                    {isAr ? "مسدد:" : "Paid:"} {formatCurrency(tx.secondaryAmount)}
                                  </div>
                                )}
                              </div>
                            )}
                            {isSponsoring && (
                              <div className="space-y-0.5">
                                <span className="text-foreground">{formatCurrency(tx.amount)}</span>
                                {typeof tx.secondaryAmount === "number" && (
                                  <div className="text-[10px] text-muted-foreground">
                                    {isAr ? "تكلفة:" : "Cost:"} {formatCurrency(tx.secondaryAmount)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                tx.status === "paid" || tx.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : tx.status === "overdue"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-end whitespace-nowrap">
                            {isInvoice && tx.status !== "paid" ? (
                              <button
                                type="button"
                                onClick={() => setPayingInvoice(tx.raw)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Coins className="size-3" />
                                <span>{isAr ? "تسجيل سداد" : "Record Payment"}</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 6: CLIENT MEMORY (OPERATIONAL INTELLIGENCE PANELS)
      ===================================================================== */}
      <section id="memory-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">
                {isAr ? "6. ذاكرة العميل والتوجيهات التشغيلية" : "6. Client Memory & Operational Directives"}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {parsedMemory.activeCount} {isAr ? "توجيهات معتمدة" : "Active Directives"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "القواعد الملزمة للفريق: الهوية البصرية، أوقات النشر، المحظورات، وآلية الاعتماد المعتمدة."
                : "Operational intelligence: brand guidelines, content rules, restrictions, and approval workflows."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDirectivesEditor(!showDirectivesEditor)}
              className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileEdit className="size-3.5 text-primary" />
              <span>{showDirectivesEditor ? (isAr ? "إخفاء المحرر الشامل" : "Hide Full Editor") : (isAr ? "المحرر الشامل" : "Full Markdown Editor")}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveNotes()}
              disabled={savingNotes}
              className="px-4 py-2 rounded-xl bg-gradient-primary text-white text-xs font-semibold shadow-xs hover:scale-[1.02] transition-transform inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className="size-3.5" />
              <span>{savingNotes ? (isAr ? "جارٍ الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Changes")}</span>
            </button>
          </div>
        </div>

        {/* Category Focus Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: "all", label: isAr ? "الكل" : "All" },
            { id: "brand", label: isAr ? "الهوية البصرية" : "Brand" },
            { id: "content", label: isAr ? "قواعد المحتوى" : "Content" },
            { id: "preferences", label: isAr ? "تفضيلات العميل" : "Preferences" },
            { id: "approval", label: isAr ? "آلية الاعتماد" : "Approval" },
            { id: "restrictions", label: isAr ? "المحظورات" : "Restrictions" },
            { id: "instructions", label: isAr ? "توجيهات خاصة" : "Instructions" },
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setMemoryCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                memoryCategory === cat.id
                  ? "bg-primary text-white shadow-2xs font-bold"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Unclassified Legacy Directives Callout (if any general text exists) */}
        {parsedMemory.generalNotes && (
          <div className="p-5 rounded-3xl border border-amber-500/30 bg-amber-500/5 space-y-2 elevated-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                <h4 className="font-display font-bold text-xs text-amber-700 dark:text-amber-300">
                  {isAr ? "توجيهات وملاحظات عامة" : "General Directives & Legacy Notes"}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectivesEditor(true)}
                className="text-amber-700 dark:text-amber-300 text-[11px] font-semibold hover:underline cursor-pointer"
              >
                {isAr ? "تنظيم في أقسام" : "Organize into Categories"}
              </button>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {parsedMemory.generalNotes}
            </p>
          </div>
        )}

        {/* 6 Structured Operational Intelligence Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(memoryCategory === "all" ? parsedMemory.categories : parsedMemory.categories.filter(c => c.id === memoryCategory)).map(cat => {
            const isEditing = editingDirectiveCategory === cat.id;

            return (
              <div
                key={cat.id}
                className={`p-5 rounded-3xl border bg-card elevated-shadow space-y-4 flex flex-col justify-between transition-all ${
                  cat.hasContent ? cat.colorClass.split(" ")[0] : "border-border"
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-xl border ${cat.badgeBg}`}>
                        <cat.icon className="size-3.5" />
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm text-foreground">
                          {isAr ? cat.labelAr : cat.labelEn}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md border ${
                        cat.hasContent
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {cat.hasContent ? (isAr ? "مفعّل" : "Active") : (isAr ? "غير محدد" : "Not Set")}
                      </span>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDirectiveCategory(cat.id);
                            setCategoryDraftText(cat.content);
                          }}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title={isAr ? "تعديل هذا التوجيه" : "Edit directive"}
                        >
                          <Pencil className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        rows={5}
                        value={categoryDraftText}
                        onChange={(e) => setCategoryDraftText(e.target.value)}
                        placeholder={cat.placeholder}
                        className="w-full bg-background border border-border rounded-xl p-3 text-xs font-sans text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-y"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDirectiveCategory(null);
                            setCategoryDraftText("");
                          }}
                          className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          {isAr ? "إلغاء" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveCategoryDirective(cat.id, categoryDraftText)}
                          disabled={savingNotes}
                          className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="size-3" />
                          <span>{savingNotes ? (isAr ? "حفظ..." : "Saving...") : (isAr ? "حفظ التوجيه" : "Save Directive")}</span>
                        </button>
                      </div>
                    </div>
                  ) : cat.hasContent ? (
                    <div className="text-xs text-foreground/90 space-y-1.5 leading-relaxed font-sans">
                      {cat.content.split("\n").filter(line => line.trim().length > 0).map((line, idx) => {
                        const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");
                        const cleanLine = line.trim().replace(/^[-*]\s*/, "");
                        return (
                          <div key={idx} className="flex items-start gap-1.5">
                            {isBullet && <span className="text-primary font-bold shrink-0 mt-0.5">•</span>}
                            <span className={isBullet ? "text-muted-foreground" : "text-foreground font-medium"}>
                              {cleanLine}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-5 text-center space-y-2 border border-dashed border-border rounded-2xl">
                      <p className="text-[11px] text-muted-foreground italic">
                        {isAr ? "لا توجد توجيهات محددة في هذا القسم حتى الآن." : "No specific directives recorded yet."}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDirectiveCategory(cat.id);
                          setCategoryDraftText("");
                        }}
                        className="px-3 py-1 rounded-lg border border-border hover:bg-muted text-[11px] font-semibold text-primary inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3" />
                        <span>{isAr ? "إضافة توجيه الآن" : "Add Directive"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                {!isEditing && cat.hasContent && (
                  <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{isAr ? "توجيه ملزم للفريق" : "Binding Directive"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDirectiveCategory(cat.id);
                        setCategoryDraftText(cat.content);
                      }}
                      className="text-primary font-semibold hover:underline cursor-pointer"
                    >
                      {isAr ? "تعديل" : "Edit"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Collapsible Master Directives Markdown Editor */}
        {showDirectivesEditor && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 elevated-shadow animate-[sada-dialog-in_120ms_ease-out]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-sm text-foreground">
                  {isAr ? "المحرر الشامل لذاكرة العميل (Markdown)" : "Master Directives Markdown Editor"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "يمكنك كتابة وتعديل كافة التوجيهات مرة واحدة باستخدام صياغة Markdown مع العناوين الفرعية."
                    : "Edit all directives simultaneously using markdown headers and bullet points."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectivesEditor(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Template Shortcuts */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              {[
                { id: "brand", label: isAr ? "الهوية البصرية" : "Brand Guidelines", snippet: "\n\n### 🎨 Brand Guidelines\n- Colors:\n- Fonts:\n- Tone of Voice:\n" },
                { id: "content", label: isAr ? "قواعد المحتوى" : "Content Rules", snippet: "\n\n### 📝 Content Rules\n- Post formats:\n- Hooks & captions:\n- Call to actions:\n" },
                { id: "preferences", label: isAr ? "تفضيلات العميل" : "Client Preferences", snippet: "\n\n### ⏰ Client Preferences\n- Best posting times:\n- Target audience:\n" },
                { id: "approval", label: isAr ? "آلية الاعتماد" : "Approval Process", snippet: "\n\n### ✅ Approval Process\n- Review contact:\n- Turnaround time:\n" },
                { id: "restrictions", label: isAr ? "المحظورات" : "Restrictions", snippet: "\n\n### 🚫 Restrictions\n- Do not mention competitors:\n- Taboo words / images:\n" },
                { id: "instructions", label: isAr ? "توجيهات خاصة" : "Special Instructions", snippet: "\n\n### 📌 Special Instructions\n- Key points:\n" },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (!notesContent.includes(cat.label)) {
                      setNotesContent(prev => prev ? `${prev}${cat.snippet}` : cat.snippet.trim());
                      toast.info(isAr ? `تم إدراج قالب ${cat.label}` : `Inserted template for ${cat.label}`);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="size-2.5 text-primary" />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <textarea
              rows={12}
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder={isAr
                ? "سجل إرشادات الهوية البصرية، ألوان العلامة التجارية، شروط التنسيق، مواعيد النشر المفضلة، المحظورات، أو أي طلبات خاصة..."
                : "Record client brand guidelines, colors, posting rules, restrictions, and special requests here..."}
              className="w-full bg-background border border-border rounded-2xl p-4 text-xs font-mono text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-y"
            />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>{isAr ? "المصدر المرجعي المباشر: public.clients.notes" : "Authoritative source: public.clients.notes"}</span>
              <button
                type="button"
                onClick={() => handleSaveNotes()}
                disabled={savingNotes}
                className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Save className="size-3" />
                <span>{savingNotes ? (isAr ? "جارٍ الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Changes")}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          SECTION 7: WORK HISTORY (DELIVERED RESULTS ARCHIVE)
      ===================================================================== */}
      <section id="history-section" className="space-y-6 scroll-mt-36 md:scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">
                {isAr ? "7. سجل التسليمات والأعمال المنجزة" : "7. Delivered Work Archive"}
              </h2>
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {completedHistory.length} {isAr ? "أعمال مكتملة" : "Items"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "الأرشيف التاريخي الثابت لجميع ما سلمته وكالة صدى لهذا العميل، مع روابط النتائج وروابط Drive."
                : "Immutable permanent record of delivered assets with result links and Drive links."}
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
            {[
              { id: "all", label: isAr ? "الكل" : "All" },
              { id: "reels", label: isAr ? "ريلز" : "Reels" },
              { id: "posts", label: isAr ? "منشورات" : "Posts" },
              { id: "stories", label: isAr ? "ستوري" : "Stories" },
              { id: "other", label: isAr ? "أخرى" : "Other" },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setHistoryCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  historyCategoryFilter === cat.id ? "bg-card text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-3xl">
            {isAr ? "لا توجد تسليمات مكتملة محفوظة في هذا القسم حتى الآن." : "No completed deliverables recorded in this category yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map(task => {
              const hasDrive = !!task.drive_url;
              const hasResult = task.result_links && task.result_links.length > 0;
              const resultLink = hasResult ? task.result_links[0] : null;
              const catLower = (task.category || task.title || "").toLowerCase();
              const isReel = catLower.includes("reel");
              const isPost = catLower.includes("post");
              const isStory = catLower.includes("story") || catLower.includes("ستوري");
              const isPhoto = catLower.includes("photo") || catLower.includes("تصوير");

              return (
                <div
                  key={task.id}
                  className="p-5 rounded-3xl border border-border bg-card space-y-3.5 elevated-shadow flex flex-col justify-between transition-all hover:border-primary/40 group"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Service Emblem + Delivered Badge + Date */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                          isReel ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" :
                          isPost ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                          isStory ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20" :
                          isPhoto ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                          "bg-muted text-muted-foreground border-border"
                        }`}>
                          {isReel ? "REEL" : isPost ? "POST" : isStory ? "STORY" : isPhoto ? "PHOTO" : (task.category || "ASSET")}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCheck className="size-2.5" />
                          <span>{isAr ? "مكتمل ومسلّم" : "Delivered"}</span>
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0" dir="ltr">
                        {task.completed_at ? format(parseISO(task.completed_at), "dd MMM yyyy") : task.delivery_period || "—"}
                      </span>
                    </div>

                    <h4 className="font-display font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                        {getMemberDisplayName(task.assignee_id).charAt(0)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {isAr ? "المنفّذ:" : "By:"} <strong className="text-foreground">{getMemberDisplayName(task.assignee_id)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setInspectingTask(task)}
                        className="px-2.5 py-1 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title={isAr ? "عرض التفاصيل الكاملة للمهمة" : "View task details"}
                      >
                        <Eye className="size-3 text-muted-foreground" />
                        <span>{isAr ? "عرض المهمة" : "View"}</span>
                      </button>

                      {hasDrive && (
                        <a
                          href={task.drive_url!}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Google Drive"
                        >
                          <FolderKanban className="size-3 text-primary" />
                          <span>Drive</span>
                        </a>
                      )}

                      {resultLink && (
                        <a
                          href={resultLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isAr ? "النتيجة" : "Result"}</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          MODALS & DRAWERS
      ===================================================================== */}

      {/* 1. EDIT CLIENT MODAL */}
      {showEditClientModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] animate-[sada-overlay-in_120ms_ease-out]" onClick={() => setShowEditClientModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-5 animate-[sada-dialog-in_120ms_ease-out] shadow-xl max-h-[90vh] overflow-y-auto sada-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">{isAr ? "تعديل الملف التعريفي للعميل" : "Edit Client Profile"}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">{isAr ? "سجل العميل في نظام صدى CRM" : "SADA OS Canonical CRM Entity"}</p>
              </div>
              <button type="button" onClick={() => setShowEditClientModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClientDetails} className="space-y-4">
              <div>
                <label className={labelCls}>{isAr ? "اسم النشاط التجاري *" : "Business Name *"}</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isAr ? "المجال / النشاط" : "Industry"}</label>
                  <input
                    type="text"
                    value={editIndustry}
                    onChange={e => setEditIndustry(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{isAr ? "اسم جهة الاتصال" : "Contact Person"}</label>
                  <input
                    type="text"
                    value={editContactName}
                    onChange={e => setEditContactName(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isAr ? "البريد الإلكتروني" : "Email"}</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{isAr ? "الهاتف" : "Phone"}</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "الحالة التعاقدية" : "Status"}</label>
                  <SADASelect
                    value={editStatus}
                    onChange={(val) => setEditStatus(val as any)}
                    options={[
                      { value: "active", label: isAr ? "نشط" : "Active" },
                      { value: "inactive", label: isAr ? "غير نشط" : "Inactive" },
                      { value: "prospect", label: isAr ? "محتمل" : "Prospect" },
                      { value: "lead", label: isAr ? "عميل محتمل" : "Lead" },
                      { value: "archived", label: isAr ? "مؤرشف" : "Archived" },
                      { value: "churned", label: isAr ? "منقطع" : "Churned" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "قناة التواصل المفضلة" : "Channel"}</label>
                  <SADASelect
                    value={editPreferredChannel}
                    onChange={setEditPreferredChannel}
                    options={[
                      { value: "whatsapp", label: "WhatsApp" },
                      { value: "phone", label: isAr ? "هاتف" : "Phone" },
                      { value: "email", label: isAr ? "بريد إلكتروني" : "Email" },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "مدير الحساب (AM)" : "Account Manager"}</label>
                  <SADACombobox
                    value={editAccountManagerId}
                    onChange={setEditAccountManagerId}
                    options={teamMembers.map(m => ({
                      value: m.profile_id || m.id,
                      label: m.display_name || m.name,
                      subtitle: m.position || m.role,
                    }))}
                    placeholder={isAr ? "اختر مدير الحساب..." : "Select AM..."}
                    searchPlaceholder={isAr ? "بحث..." : "Search..."}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "مسؤول المبيعات" : "Sales Owner"}</label>
                  <SADACombobox
                    value={editSalesOwnerId}
                    onChange={setEditSalesOwnerId}
                    options={teamMembers.map(m => ({
                      value: m.profile_id || m.id,
                      label: m.display_name || m.name,
                      subtitle: m.position || m.role,
                    }))}
                    placeholder={isAr ? "اختر مسؤول المبيعات..." : "Select Sales Owner..."}
                    searchPlaceholder={isAr ? "بحث..." : "Search..."}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isAr ? "سعر الباقة (TND)" : "Package Rate (TND)"}</label>
                  <input
                    type="number"
                    value={editMonthlyRate}
                    onChange={e => setEditMonthlyRate(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{isAr ? "ميزانية الإعلانات (TND)" : "Sponsoring Budget (TND)"}</label>
                  <input
                    type="number"
                    value={editSponsoringBudget}
                    onChange={e => setEditSponsoringBudget(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditClientModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={savingEditClient}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingEditClient ? (isAr ? "جارٍ الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT PACKAGE MODAL WITH LIVE PRICING & RECONCILIATION PREVIEW */}
      <SADADialog
        open={showEditPackageModal}
        onOpenChange={(o) => {
          if (!o) setShowEditPackageModal(false);
        }}
        size="standard"
        title={isAr ? "تعديل الباقة والخدمات وتسوية العمل" : "Customize Package Quotas & Reconcile Work"}
        description={
          isAr
            ? `تحديث الحصص التعاقدية للعميل ${client.name}. ستتم تسوية المهام المستقبلية مع الحفاظ التام على السجلات المكتملة.`
            : `Authoritative Single Source of Truth for ${client.name}. Future scheduled tasks reconcile while historical completed records remain immutable.`
        }
      >
        <form onSubmit={handleSavePackageConfig} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground font-display">
              {isAr ? "الباقة الرسمية من الدليل" : "Canonical Package from Catalog"}
            </label>
            <SADACombobox
              value={selectedPackageId}
              onChange={(val) => {
                setSelectedPackageId(val);
                const chosen = availablePackages.find((p) => p.id === val);
                if (chosen) {
                  setPkgNameInput(chosen.name);
                  setReelsQuotaInput(chosen.monthly_reels ?? 0);
                  setPostsQuotaInput(chosen.monthly_posts ?? 0);
                  setStoriesQuotaInput(chosen.monthly_stories ? parseInt(chosen.monthly_stories, 10) || 0 : 0);
                  const newPr = chosen.price || chosen.selling_price || chosen.price_tnd;
                  if (newPr) setPkgPriceInput(Number(newPr));
                  if (chosen.included_items && chosen.included_items.length > 0) {
                    setOtherServicesInput(chosen.included_items.map((it: any) => it.text));
                  }
                }
              }}
              options={availablePackages.map((pkg) => ({
                value: pkg.id,
                label: `${pkg.code ? `[${pkg.code}] ` : ""}${pkg.name}`,
                subtitle: pkg.category_name || (isAr ? "عام" : "General"),
                price: pkg.price || pkg.selling_price || pkg.price_tnd || 0,
              }))}
              placeholder={isAr ? "اختر الباقة الرسمية..." : "Select canonical package..."}
              searchPlaceholder={isAr ? "بحث في الباقات..." : "Search packages..."}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground font-display">
                {isAr ? "مسمى الباقة" : "Package Title"}
              </label>
              <SADAInput
                type="text"
                value={pkgNameInput}
                onChange={(e) => setPkgNameInput(e.target.value)}
                placeholder={isAr ? "مثال: نمو — مخصص" : "e.g. Growth — Custom"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground font-display">
                {isAr ? "سعر الباقة الجديد (TND)" : "New Package Price (TND)"}
              </label>
              <SADAInput
                type="number"
                value={pkgPriceInput}
                onChange={(e) => setPkgPriceInput(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Steppers */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground font-display">
              {isAr ? "المخصصات التعاقدية الشهرية" : "Monthly Contractual Quotas"}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <SADACounter
                label={isAr ? "ريلز / شهر" : "Reels / mo"}
                min={0}
                value={reelsQuotaInput}
                onChange={setReelsQuotaInput}
                size="sm"
              />
              <SADACounter
                label={isAr ? "منشورات / شهر" : "Posts / mo"}
                min={0}
                value={postsQuotaInput}
                onChange={setPostsQuotaInput}
                size="sm"
              />
              <SADACounter
                label={isAr ? "ستوري / شهر" : "Stories / mo"}
                min={0}
                value={storiesQuotaInput}
                onChange={setStoriesQuotaInput}
                size="sm"
              />
            </div>
          </div>

          {/* Pricing Impact Strip */}
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">{isAr ? "السعر الحالي" : "Current Price"}</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(currentPrice)}</span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground rtl:rotate-180" />
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">{isAr ? "السعر الجديد" : "New Price"}</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(pkgPriceInput)}</span>
            </div>
            <div className="text-end">
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">{isAr ? "أثر السعر" : "Impact"}</span>
              <span className={`font-mono font-bold ${priceDifference > 0 ? "text-emerald-600 dark:text-emerald-400" : priceDifference < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                {priceDifference > 0 ? `+${formatCurrency(priceDifference)}` : formatCurrency(priceDifference)}
              </span>
            </div>
          </div>

          {/* Live Reconciliation Preview Impact */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-foreground font-display">
                <Sparkles className="size-3.5 text-primary" />
                {isAr ? "أثر التسوية على التقويم والمهام:" : "Reconciliation Impact on Calendar & Tasks:"}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                {selectedPeriod}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-card border border-border/60">
                <span className="text-[10px] text-muted-foreground block">{isAr ? "ريلز" : "Reels"}</span>
                <span className="text-xs font-mono font-bold text-foreground" dir="ltr">
                  {currentReelsQuota} → {reelsQuotaInput}
                </span>
                <span className={`text-[10px] font-bold block mt-0.5 ${reelsQuotaInput > currentReelsQuota ? "text-emerald-600 dark:text-emerald-400" : reelsQuotaInput < currentReelsQuota ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {reelsQuotaInput > currentReelsQuota ? `+${reelsQuotaInput - currentReelsQuota} ${isAr ? "توليد" : "create"}` : reelsQuotaInput < currentReelsQuota ? `-${currentReelsQuota - reelsQuotaInput} ${isAr ? "تقليص" : "prune"}` : (isAr ? "متطابق" : "sync")}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-card border border-border/60">
                <span className="text-[10px] text-muted-foreground block">{isAr ? "منشورات" : "Posts"}</span>
                <span className="text-xs font-mono font-bold text-foreground" dir="ltr">
                  {currentPostsQuota} → {postsQuotaInput}
                </span>
                <span className={`text-[10px] font-bold block mt-0.5 ${postsQuotaInput > currentPostsQuota ? "text-emerald-600 dark:text-emerald-400" : postsQuotaInput < currentPostsQuota ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {postsQuotaInput > currentPostsQuota ? `+${postsQuotaInput - currentPostsQuota} ${isAr ? "توليد" : "create"}` : postsQuotaInput < currentPostsQuota ? `-${currentPostsQuota - postsQuotaInput} ${isAr ? "تقليص" : "prune"}` : (isAr ? "متطابق" : "sync")}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-card border border-border/60">
                <span className="text-[10px] text-muted-foreground block">{isAr ? "ستوري" : "Stories"}</span>
                <span className="text-xs font-mono font-bold text-foreground" dir="ltr">
                  {currentStoriesQuota} → {storiesQuotaInput}
                </span>
                <span className={`text-[10px] font-bold block mt-0.5 ${storiesQuotaInput > currentStoriesQuota ? "text-emerald-600 dark:text-emerald-400" : storiesQuotaInput < currentStoriesQuota ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {storiesQuotaInput > currentStoriesQuota ? `+${storiesQuotaInput - currentStoriesQuota} ${isAr ? "توليد" : "create"}` : storiesQuotaInput < currentStoriesQuota ? `-${currentStoriesQuota - storiesQuotaInput} ${isAr ? "تقليص" : "prune"}` : (isAr ? "متطابق" : "sync")}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
              {isAr
                ? "💡 ضمان الأمان: المهام المنجزة والسجلات التاريخية السابقة محفوظة دائماً ولا تحذف أبداً."
                : "💡 Safety guarantee: Completed tasks and historical records are permanently preserved."}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <SADAButton
              type="button"
              variant="secondary"
              onClick={() => setShowEditPackageModal(false)}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="submit"
              variant="primary"
              disabled={savingPackage}
            >
              {savingPackage ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  {isAr ? "جارٍ الحفظ والتسوية..." : "Saving & Reconciling..."}
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 mr-1.5" />
                  {isAr ? "تحديث وتسوية العمل" : "Save & Reconcile Work"}
                </>
              )}
            </SADAButton>
          </div>
        </form>
      </SADADialog>

      {/* 3. NEW DELIVERABLE MODAL */}
      {showNewDeliverableModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] animate-[sada-overlay-in_120ms_ease-out]" onClick={() => setShowNewDeliverableModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-[sada-dialog-in_120ms_ease-out]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display font-bold text-base text-foreground">{isAr ? "إضافة هدف تسليم جديد" : "Add Deliverable Target"}</h3>
              <button type="button" onClick={() => setShowNewDeliverableModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeliverable} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>{isAr ? "عنوان التسليم *" : "Deliverable Title *"}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? "مثال: 8 ريلز — إنتاج متقدم" : "e.g. 8 Reels — High Production"}
                  value={newDelivTitle}
                  onChange={e => setNewDelivTitle(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "نوع التسليم" : "Deliverable Type"}</label>
                  <SADASelect
                    value={newDelivType}
                    onChange={setNewDelivType}
                    options={[
                      { value: "reel", label: isAr ? "ريل / فيديو" : "Reel / Video" },
                      { value: "post", label: isAr ? "منشور / تصميم" : "Post / Graphic" },
                      { value: "story", label: isAr ? "ستوري" : "Story" },
                      { value: "ads_campaign", label: isAr ? "حملة إعلانية" : "Ads Campaign" },
                      { value: "branding", label: isAr ? "هوية بصرية" : "Branding Asset" },
                      { value: "other", label: isAr ? "خدمة أخرى" : "Other" },
                    ]}
                    size="compact"
                  />
                </div>

                <SADACounter
                  label={isAr ? "الكمية المستهدفة" : "Target Quantity"}
                  min={1}
                  value={newDelivTarget}
                  onChange={setNewDelivTarget}
                  size="sm"
                />
              </div>

              <div>
                <label className={labelCls}>{isAr ? "الموعد المستهدف" : "Target Deadline"}</label>
                <SADADatePicker
                  value={newDelivDeadline}
                  onChange={val => setNewDelivDeadline(val)}
                  placeholder={isAr ? "حدد الموعد..." : "Select deadline..."}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewDeliverableModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={savingDeliverable}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-xs font-semibold hover:bg-primary/90"
                >
                  {savingDeliverable ? (isAr ? "جارٍ الجدولة..." : "Scheduling...") : (isAr ? "إضافة التسليم" : "Add Deliverable")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. NEW PRODUCTION BOOKING MODAL */}
      {showNewBookingModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] animate-[sada-overlay-in_120ms_ease-out]" onClick={() => setShowNewBookingModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 animate-[sada-dialog-in_120ms_ease-out] max-h-[90vh] overflow-y-auto sada-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display font-bold text-base text-foreground">{isAr ? "حجز جلسة إنتاج وتصوير" : "Book Production Shoot"}</h3>
              <button type="button" onClick={() => setShowNewBookingModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>{isAr ? "عنوان جلسة التصوير *" : "Shoot Title *"}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? `مثال: ${client.name} — تصوير المحتوى الشهري` : `e.g. ${client.name} Monthly Content Shoot`}
                  value={newBookingTitle}
                  onChange={e => setNewBookingTitle(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "التاريخ *" : "Date *"}</label>
                  <SADADatePicker
                    value={newBookingDate ? parseISO(newBookingDate) : undefined}
                    onChange={d => setNewBookingDate(d ? format(d, "yyyy-MM-dd") : "")}
                    placeholder={isAr ? "اختر التاريخ" : "Pick date"}
                    size="compact"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "وقت البدء" : "Start Time"}</label>
                  <SADASelect
                    value={newBookingTime || "10:00"}
                    onChange={setNewBookingTime}
                    options={[
                      { value: "08:00", label: isAr ? "08:00 ص" : "08:00 AM" },
                      { value: "09:00", label: isAr ? "09:00 ص" : "09:00 AM" },
                      { value: "10:00", label: isAr ? "10:00 ص" : "10:00 AM" },
                      { value: "11:00", label: isAr ? "11:00 ص" : "11:00 AM" },
                      { value: "12:00", label: isAr ? "12:00 م" : "12:00 PM" },
                      { value: "13:00", label: isAr ? "01:00 م" : "01:00 PM" },
                      { value: "14:00", label: isAr ? "02:00 م" : "02:00 PM" },
                      { value: "15:00", label: isAr ? "03:00 م" : "03:00 PM" },
                      { value: "16:00", label: isAr ? "04:00 م" : "04:00 PM" },
                      { value: "17:00", label: isAr ? "05:00 م" : "05:00 PM" },
                      { value: "18:00", label: isAr ? "06:00 م" : "06:00 PM" },
                    ]}
                    size="compact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isAr ? "الموقع / الاستوديو *" : "Location *"}</label>
                  <input
                    type="text"
                    required
                    value={newBookingLocation}
                    onChange={e => setNewBookingLocation(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <SADACounter
                  label={isAr ? "المدة (ساعات)" : "Duration (Hours)"}
                  min={1}
                  step={0.5}
                  value={newBookingDuration}
                  onChange={setNewBookingDuration}
                  suffix={isAr ? "ساعة" : "hrs"}
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>{isAr ? "نوع الإنتاج" : "Production Type"}</label>
                  <SADASelect
                    value={newBookingType}
                    onChange={setNewBookingType}
                    options={[
                      { value: "reels_shoot", label: isAr ? "جلسة تصوير ريلز وفيديو" : "Reels & Video Shoot" },
                      { value: "photoshoot", label: isAr ? "جلسة تصوير فوتوغرافي" : "Brand Photoshoot" },
                      { value: "commercial", label: isAr ? "إنتاج إعلاني تجاري" : "Commercial Campaign" },
                      { value: "event", label: isAr ? "تغطية فعالية" : "Event Coverage" },
                    ]}
                    size="compact"
                  />
                </div>
                <SADACounter
                  label={isAr ? "هدف الريلز" : "Reels Target"}
                  min={0}
                  value={newBookingReels}
                  onChange={setNewBookingReels}
                  suffix={isAr ? "فيديو" : "reels"}
                  size="sm"
                />
              </div>

              <div>
                <label className={labelCls}>{isAr ? "المعدات المحجوزة" : "Equipment Reserved"}</label>
                <input
                  type="text"
                  value={newBookingEquipment}
                  onChange={e => setNewBookingEquipment(e.target.value)}
                  className={inputCls}
                  placeholder={isAr ? "كاميرات، عدسات، مانع اهتزاز، مايكات..." : "Cameras, lenses, gimbals, mics..."}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewBookingModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={savingBooking}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-xs font-semibold hover:bg-primary/90"
                >
                  {savingBooking ? (isAr ? "جارٍ الحجز..." : "Booking...") : (isAr ? "تأكيد وحجز الجلسة" : "Confirm Shoot")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. TASK MODAL (CREATE / EDIT TASK IN PROJECT_TASKS) */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          projectId={projects[0]?.id}
          profiles={profiles}
          teamMembers={teamMembers}
          onSaved={() => {
            setShowTaskModal(false);
            setEditingTask(null);
            loadClientData(true);
          }}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onDelete={isSuperAdmin ? handleDeleteTask : undefined}
          defaultDate={selectedPeriod ? `${selectedPeriod}-15` : undefined}
        />
      )}

      {/* 6. TASK DETAIL MODAL (INSPECT TASK) */}
      {inspectingTask && (
        <TaskDetailModal
          task={inspectingTask}
          project={projects[0] || null}
          profiles={profiles}
          teamMembers={teamMembers}
          onEdit={(t) => {
            setInspectingTask(null);
            setEditingTask(t);
            setShowTaskModal(true);
          }}
          onStatusChange={handleTaskModalStatusChange}
          onClose={() => setInspectingTask(null)}
          onDelete={isSuperAdmin ? handleDeleteTask : undefined}
        />
      )}

      {/* 7. SERVICE COMMITMENT MODAL */}
      <ServiceCommitmentModal
        open={showCommitmentModal}
        onClose={() => {
          setShowCommitmentModal(false);
          setEditingCommitment(null);
        }}
        clientId={id}
        clientName={client?.name || "Client"}
        packageId={client?.package_id}
        profiles={profiles}
        teamMembers={teamMembers}
        existingCommitment={editingCommitment}
        onSaved={() => loadCommitments()}
      />

      {/* 8. FINANCIAL OS CANONICAL INLINE MODALS */}
      {canAccessFinance && client && (
        <>
          <RecordIncomeModal
            isOpen={showIncomeModal}
            onClose={() => setShowIncomeModal(false)}
            onRefresh={() => {
              setShowIncomeModal(false);
              loadClientData(true);
            }}
            clients={[client]}
            projects={projects.map((p) => ({
              id: p.id,
              title: p.title,
              client_name: client.name,
            }))}
            accounts={accounts}
            defaultClientId={client.id}
            defaultProjectId={projects[0]?.id}
          />

          <RecordExpenseModal
            isOpen={showExpenseModal}
            onClose={() => setShowExpenseModal(false)}
            onRefresh={() => {
              setShowExpenseModal(false);
              loadClientData(true);
            }}
            categories={expenseCategories}
            clients={[client]}
            projects={projects.map((p) => ({
              id: p.id,
              title: p.title,
              client_name: client.name,
            }))}
            teamMembers={teamMembers.map((m) => ({
              id: m.id,
              name: m.display_name || m.name || "",
            }))}
            defaultClientId={client.id}
            defaultProjectId={projects[0]?.id}
          />

          <CreateInvoiceModal
            isOpen={showInvoiceModal}
            onClose={() => setShowInvoiceModal(false)}
            onSuccess={() => {
              setShowInvoiceModal(false);
              loadClientData(true);
            }}
            clients={[client]}
            defaultClientId={client.id}
            defaultServiceFee={Number(client.monthly_package_price || client.default_service_fee || 0)}
            defaultSponsoringBudget={Number(client.default_sponsoring_budget || 0)}
          />

          <RecordInvoicePaymentModal
            isOpen={!!payingInvoice}
            invoice={payingInvoice}
            accounts={accounts}
            onClose={() => setPayingInvoice(null)}
            onSuccess={() => {
              setPayingInvoice(null);
              loadClientData(true);
            }}
          />

          <CreateSponsoringModal
            isOpen={showSponsoringModal}
            onClose={() => setShowSponsoringModal(false)}
            onSuccess={() => {
              setShowSponsoringModal(false);
              loadClientData(true);
            }}
            clients={[client]}
            defaultClientId={client.id}
          />

          {/* Delete Client Dialog */}
          <DeleteClientDialog
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            clientId={client?.id || null}
            clientName={client?.name || ""}
            onDeleted={() => {
              nav({ to: "/admin/client-workspaces" });
            }}
            onRequestArchive={() => {
              setArchiveDialogMode("archive");
              setShowArchiveModal(true);
            }}
          />

          {/* Archive / Restore Dialog */}
          <ArchiveClientDialog
            open={showArchiveModal}
            onOpenChange={setShowArchiveModal}
            clientId={client?.id || null}
            clientName={client?.name || ""}
            clientType={client?.client_type}
            mode={archiveDialogMode}
            onSuccess={() => {
              loadClientData(true);
            }}
          />
        </>
      )}
    </div>
  );
}
