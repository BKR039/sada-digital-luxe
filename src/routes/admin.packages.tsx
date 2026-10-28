import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { normalizeRole, canManagePackages } from "@/lib/permissions";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import {
  Package, Plus, Search, Filter, Pencil, Copy, Eye, EyeOff, Archive,
  Trash2, Sparkles, Check, X, ShieldAlert, ArrowLeft, ArrowRight,
  TrendingUp, Layers, HelpCircle, AlertCircle, CheckCircle2, ChevronRight,
  ShieldCheck, Zap, Star, ExternalLink, RefreshCw, MoveUp, MoveDown,
  Info, Globe, MoreHorizontal, MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  fetchPackageCatalog,
  fetchPackageCategories,
  fetchPackageAddons,
  createPackage,
  updatePackage,
  publishPackage,
  hidePackage,
  archivePackage,
  deletePackage,
  duplicatePackage,
  reorderPackages,
  createAddon,
  updateAddon,
  archiveAddon,
  updateCategory,
  slugify,
} from "@/lib/package-service";
import type {
  PackageCatalogItem,
  PackageCategory,
  PackageAddon,
  PackageFeatureItem,
  BillingType,
  PackageBadge,
  PackageType,
  CreatePackageInput,
} from "@/types/package-catalog";
import { PackageEditorDrawer } from "@/components/admin/packages/PackageEditorDrawer";
import { PackageDetailsModal } from "@/components/packages/PackageDetailsModal";
import {
  SADAButton,
  SADAInput,
  SADATextarea,
  SADASelect,
  SADABadge,
  SADADialog,
  SADADrawer,
  SADAConfirmDialog,
  SADAEmptyState,
  SADACounter,
  SADANumberStepper,
  SADASwitch,
  SADACheckbox,
  SkeletonTable,
} from "@/components/ui/sada-ui";

export const Route = createFileRoute("/admin/packages")({
  component: AdminPackagesManagement,
});

export function AdminPackagesManagement() {
  const { user, role, isSuperAdmin, isAdmin } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const authorized = canManagePackages(permCtx);

  // Core Data
  const [packages, setPackages] = useState<PackageCatalogItem[]>([]);
  const [categories, setCategories] = useState<PackageCategory[]>([]);
  const [addons, setAddons] = useState<PackageAddon[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs & Views (5 dedicated Information Architecture views)
  const [activeTab, setActiveTab] = useState<"all" | "internal" | "proposals" | "addons" | "categories">("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "internal" | "public_proposals">("all");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "approved" | "proposed" | "needs_review">("all");

  // Package Details Modal (for View Details action)
  const [viewingDetailsPkg, setViewingDetailsPkg] = useState<PackageCatalogItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Package Editor Modal
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [selectedEditingPkg, setSelectedEditingPkg] = useState<PackageCatalogItem | null>(null);

  // Duplicate Modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatingPkg, setDuplicatingPkg] = useState<PackageCatalogItem | null>(null);
  const [newDuplicateCode, setNewDuplicateCode] = useState("");

  // Addon Modal
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [addonCode, setAddonCode] = useState("");
  const [addonName, setAddonName] = useState("");
  const [addonNameAr, setAddonNameAr] = useState("");
  const [addonPrice, setAddonPrice] = useState<number>(100);
  const [addonUnit, setAddonUnit] = useState("item");
  const [addonPercentage, setAddonPercentage] = useState<number | undefined>(undefined);
  const [addonCategory, setAddonCategory] = useState("general");
  const [addonDesc, setAddonDesc] = useState("");

  const [saving, setSaving] = useState(false);

  // SADA Canonical Confirmation Dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant?: "danger" | "warning";
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const actorInfo = useMemo(
    () => ({
      id: user?.id,
      name: user?.user_metadata?.full_name || user?.email || "Admin",
      role: currentRole,
    }),
    [user, currentRole]
  );

  // Exact census counts (Packages separated from Add-ons)
  const internalCount = useMemo(() => packages.filter((p) => p.is_internal_only).length, [packages]);
  const proposalsCount = useMemo(() => packages.filter((p) => !p.is_internal_only).length, [packages]);
  const liveCount = useMemo(
    () => packages.filter((p) => p.is_published && p.approval_status === "approved").length,
    [packages]
  );
  const unapprovedProposalsCount = useMemo(
    () => packages.filter((p) => !p.is_internal_only && p.approval_status === "proposed").length,
    [packages]
  );

  // Filtered packages for display across tabs
  const displayedPackages = useMemo(() => {
    return packages.filter((pkg) => {
      // 1. Tab-level scope isolation
      if (activeTab === "internal" && !pkg.is_internal_only) return false;
      if (activeTab === "proposals" && pkg.is_internal_only) return false;

      // 2. Search query (code or name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = pkg.code.toLowerCase().includes(q);
        const matchName = pkg.name.toLowerCase().includes(q) || (pkg.name_ar && pkg.name_ar.includes(q));
        if (!matchCode && !matchName) return false;
      }

      // 3. Category filter
      if (selectedCategoryFilter !== "all" && pkg.category_id !== selectedCategoryFilter) {
        return false;
      }

      // 4. Status filter
      if (statusFilter === "published" && !pkg.is_published) return false;
      if (statusFilter === "draft" && (pkg.is_published || !pkg.is_active)) return false;
      if (statusFilter === "archived" && pkg.is_active) return false;

      // 5. Scope filter (when in 'all' tab)
      if (activeTab === "all") {
        if (scopeFilter === "internal" && !pkg.is_internal_only) return false;
        if (scopeFilter === "public_proposals" && pkg.is_internal_only) return false;
      }

      // 6. Approval filter
      if (approvalFilter !== "all" && pkg.approval_status !== approvalFilter) {
        return false;
      }

      return true;
    });
  }, [packages, activeTab, searchQuery, selectedCategoryFilter, statusFilter, scopeFilter, approvalFilter]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: "all", label: isAr ? "جميع التصنيفات" : "All Categories" },
      ...categories.map(c => ({
        value: c.id,
        label: `${c.code} — ${isAr && c.name_ar ? c.name_ar : c.name}`,
      })),
    ],
    [categories, isAr]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: isAr ? "جميع الحالات" : "All Statuses" },
      { value: "published", label: isAr ? "منشورة" : "Published" },
      { value: "draft", label: isAr ? "مسودات" : "Drafts" },
      { value: "archived", label: isAr ? "مؤرشفة" : "Archived" },
    ],
    [isAr]
  );

  const editorCategoryOptions = useMemo(
    () =>
      categories.map(c => ({
        value: c.id,
        label: `${c.code} — ${isAr && c.name_ar ? c.name_ar : c.name}`,
      })),
    [categories, isAr]
  );

  const packageTypeOptions = useMemo(
    () => [
      { value: "standard", label: isAr ? "قياسي" : "Standard" },
      { value: "hybrid", label: isAr ? "شهري مركب" : "Monthly Hybrid" },
      { value: "production", label: isAr ? "وحدة إنتاج" : "Production Unit" },
      { value: "digital", label: isAr ? "منصة رقمية" : "Digital Platform" },
      { value: "custom", label: isAr ? "نطاق مخصص" : "Custom Scope" },
    ],
    [isAr]
  );

  const billingTypeOptions = useMemo(
    () => [
      { value: "monthly", label: isAr ? "اشتراك شهري" : "Monthly Retainer" },
      { value: "one_time", label: isAr ? "مشروع لمرة واحدة" : "One-Time Project" },
      { value: "starting_from", label: isAr ? "يبدأ من" : "Starting From" },
      { value: "custom", label: isAr ? "تسعير مخصص" : "Custom Pricing" },
    ],
    [isAr]
  );

  const badgeOptions = useMemo(
    () => [
      { value: "", label: isAr ? "بدون شارة" : "No Badge" },
      { value: "most_popular", label: isAr ? "الأكثر طلباً" : "Most Popular" },
      { value: "recommended", label: isAr ? "موصى به" : "Recommended" },
      { value: "best_value", label: isAr ? "أفضل قيمة" : "Best Value" },
      { value: "featured", label: isAr ? "مميز" : "Featured" },
    ],
    [isAr]
  );

  const addonUnitOptions = useMemo(
    () => [
      { value: "item", label: isAr ? "لكل عنصر" : "Per Item" },
      { value: "hour", label: isAr ? "لكل ساعة" : "Per Hour" },
      { value: "session", label: isAr ? "لكل جلسة" : "Per Session" },
      { value: "visit", label: isAr ? "لكل زيارة" : "Per Visit" },
      { value: "percentage", label: isAr ? "نسبة مئوية" : "Percentage Modifier" },
    ],
    [isAr]
  );

  const addonCategoryOptions = useMemo(
    () => [
      { value: "general", label: isAr ? "عام" : "General" },
      { value: "content", label: isAr ? "محتوى" : "Content" },
      { value: "production", label: isAr ? "إنتاج" : "Production" },
      { value: "story", label: isAr ? "قصة" : "Story" },
      { value: "web", label: isAr ? "موقع" : "Web" },
      { value: "delivery", label: isAr ? "تسليم" : "Delivery" },
    ],
    [isAr]
  );

  const loadData = async (forceLoading = false) => {
    if (forceLoading || (packages.length === 0 && categories.length === 0)) {
      setLoading(true);
    }
    try {
      const [pkgs, cats, adds] = await Promise.all([
        fetchPackageCatalog(),
        fetchPackageCategories(),
        fetchPackageAddons(false),
      ]);
      setPackages(pkgs);
      setCategories(cats);
      setAddons(adds);
    } catch (err) {
      console.error("Failed to load catalog data:", err);
      toast.error("Failed to load package catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      loadData();
    }
  }, [authorized]);

  // Governance action: Approve proposal
  const handleApproveProposal = (pkg: PackageCatalogItem) => {
    if (!isSuperAdmin) {
      toast.error(
        isAr
          ? "اعتماد الأسعار والمقترحات العامة محصور بالمسؤول الأعلى فقط."
          : "Only Super Admin can approve public pricing proposals."
      );
      return;
    }
    setConfirmState({
      open: true,
      title: isAr ? `اعتماد المقترح ${pkg.code}؟` : `Approve Proposal ${pkg.code}?`,
      description: isAr
        ? `سيتم تحويل الباقة ${pkg.name_ar || pkg.name} إلى حالة "معتمدة". ستبقى غير منشورة تلقائياً حتى يقرر المسؤول نشرها صراحة.`
        : `This will approve ${pkg.name} (${pkg.code}) at ${formatCurrency(pkg.proposed_price || pkg.price)}. It will remain unpublished until explicitly published.`,
      variant: "warning",
      confirmLabel: isAr ? "اعتماد المقترح" : "Approve Proposal",
      onConfirm: async () => {
        const res = await updatePackage(
          {
            id: pkg.id,
            approval_status: "approved",
          },
          actorInfo
        );
        if (res.success) {
          toast.success(isAr ? `تم اعتماد الباقة ${pkg.code} بنجاح.` : `Proposal ${pkg.code} approved successfully.`);
          await loadData();
        } else {
          toast.error(res.error || "Failed to approve proposal");
        }
      },
    });
  };

  // Open Editor for Creation
  const handleOpenCreate = () => {
    setSelectedEditingPkg(null);
    setEditorMode("create");
    setShowEditor(true);
  };

  // Open Editor for Editing
  const handleOpenEdit = (pkg: PackageCatalogItem) => {
    setSelectedEditingPkg(pkg);
    setEditorMode("edit");
    setShowEditor(true);
  };

  // Save Package (Create or Update from PackageEditorDrawer)
  const handleSavePackageInput = async (pkgInput: CreatePackageInput): Promise<boolean> => {
    setSaving(true);
    try {
      let res;
      if (editorMode === "create") {
        res = await createPackage(pkgInput, actorInfo);
      } else if (editorMode === "edit" && selectedEditingPkg?.id) {
        res = await updatePackage({ ...pkgInput, id: selectedEditingPkg.id }, actorInfo);
      }

      if (res?.success) {
        toast.success(
          editorMode === "create"
            ? `Package ${pkgInput.code} created successfully!`
            : `Package ${pkgInput.code} updated successfully!`
        );
        setShowEditor(false);
        await loadData();
        return true;
      } else {
        toast.error(res?.error || "Failed to save package");
        return false;
      }
    } catch (err: any) {
      console.error("Save package error:", err);
      toast.error(err?.message || "An unexpected error occurred while saving package");
      return false;
    } finally {
      setSaving(false);
    }
  };


  // Quick Actions
  const handleTogglePublish = async (pkg: PackageCatalogItem) => {
    if (pkg.is_published) {
      const ok = await hidePackage(pkg.id, actorInfo);
      if (ok) {
        toast.info(isAr ? `تم إخفاء الباقة ${pkg.code} من صفحة الأسعار العامة` : `Package ${pkg.code} hidden from public pricing`);
        loadData();
      }
    } else {
      if (pkg.approval_status !== "approved") {
        toast.error(
          isAr
            ? `لا يمكن نشر الباقة ${pkg.code} علناً لأن سعرها أو نطاقها لا يزال مقترحاً وغير معتمد من الإدارة العليا.`
            : `Cannot publish ${pkg.code} publicly because its pricing is still proposed/unapproved. Super Admin approval required.`
        );
        return;
      }
      if (pkg.is_internal_only) {
        toast.error(
          isAr
            ? `لا يمكن نشر الباقة ${pkg.code} لأنها مصنفة كدليل داخلي فقط.`
            : `Cannot publish ${pkg.code} because it is designated as Internal Master Catalog only.`
        );
        return;
      }
      const ok = await publishPackage(pkg.id, actorInfo);
      if (ok) {
        toast.success(isAr ? `تم نشر الباقة ${pkg.code} في صفحة الأسعار العامة!` : `Package ${pkg.code} published to public pricing!`);
        loadData();
      }
    }
  };

  const handleArchive = (pkg: PackageCatalogItem) => {
    setConfirmState({
      open: true,
      title: isAr ? `أرشفة ${pkg.name_ar || pkg.name} (${pkg.code})؟` : `Archive ${pkg.name} (${pkg.code})?`,
      description: isAr ? "ستظل الباقة نشطة للعقود الحالية ولكن سيتم إخفاؤها من الاختيارات الجديدة." : "It will remain active for existing contracts but will be hidden from new selections.",
      variant: "warning",
      confirmLabel: isAr ? "أرشفة الباقة" : "Archive Package",
      onConfirm: async () => {
        const ok = await archivePackage(pkg.id, actorInfo);
        if (ok) {
          toast.info(isAr ? `تمت أرشفة الباقة ${pkg.code}` : `Package ${pkg.code} archived`);
          loadData();
        }
      },
    });
  };

  const handleDelete = (pkg: PackageCatalogItem) => {
    setConfirmState({
      open: true,
      title: isAr ? `حذف نهائي للباقة ${pkg.code}؟` : `Permanent deletion of ${pkg.code}?`,
      description: isAr ? "تحذير: إذا كانت الباقة مرتبطة بأي عملاء أو صفقات أو مهام، سيتم حظر الحذف بواسطة قواعد تكامل قاعدة البيانات." : "Warning: If referenced by any clients, deals or tasks, deletion will be blocked by database integrity rules.",
      variant: "danger",
      confirmLabel: isAr ? "حذف الباقة" : "Delete Package",
      onConfirm: async () => {
        const res = await deletePackage(pkg.id, actorInfo);
        if (res.success) {
          toast.success(isAr ? `تم حذف الباقة ${pkg.code} نهائياً.` : `Package ${pkg.code} deleted permanently.`);
          loadData();
        } else {
          toast.error(res.error || (isAr ? "تم رفض الحذف: الباقة مرتبطة بسجلات حالية أو سابقة." : "Deletion rejected: package has active or historical references."));
        }
      },
    });
  };

  const handleOpenDuplicate = (pkg: PackageCatalogItem) => {
    setDuplicatingPkg(pkg);
    setNewDuplicateCode(`${pkg.code}-COPY`);
    setShowDuplicateModal(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicatingPkg || !newDuplicateCode.trim()) return;
    setSaving(true);
    const res = await duplicatePackage(duplicatingPkg.id, newDuplicateCode.trim(), actorInfo);
    setSaving(false);
    if (res.success) {
      toast.success(isAr ? `تم تكرار ${duplicatingPkg.code} كمسودة ${res.package?.code}!` : `Duplicated ${duplicatingPkg.code} as draft ${res.package?.code}!`);
      setShowDuplicateModal(false);
      loadData();
    } else {
      toast.error(res.error || (isAr ? "فشل تكرار الباقة" : "Failed to duplicate package"));
    }
  };

  // Reorder Packages
  const handleMoveOrder = async (pkg: PackageCatalogItem, direction: "up" | "down") => {
    const currentIndex = packages.findIndex((p) => p.id === pkg.id);
    if (currentIndex < 0) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= packages.length) return;

    const targetPkg = packages[targetIndex];
    const updates = [
      { id: pkg.id, display_order: targetPkg.display_order },
      { id: targetPkg.id, display_order: pkg.display_order },
    ];
    await reorderPackages(updates, actorInfo);
    loadData();
  };

  // Role Access Barrier
  if (!authorized) {
    return (
      <div className="min-h-[70vh] grid place-items-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl border border-destructive/20 bg-card text-center space-y-4 elevated-shadow">
          <div className="size-12 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mx-auto">
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">
              {isAr ? "الدخول مقيد" : "Access Restricted"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {isAr
                ? "ليس لديك صلاحية لإدارة دليل باقات صدى. يُسمح فقط للمسؤولين المعتمدين بتعديل نماذج التسعير ونطاقات العمل المنشورة."
                : "You do not have permission to manage the SADA Package Catalog. Only Super Admins and authorized managers can modify pricing models and published scopes."}
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
            <span>{isAr ? "العودة للوحة التحكم" : "Return to Dashboard"}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-20">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground tracking-tight">
              {isAr ? "دليل الباقات والتسعير" : "Package Catalog & Pricing CMS"}
            </h1>
            <SADABadge variant="primary" size="xs">
              {isAr ? "المعيار المعتمد" : "Phase 10 Canonical"}
            </SADABadge>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none">
            {isAr
              ? "المصدر المعتمد الوحيد للتسعير العام، وحصص إدارة العملاء، ونطاقات مخرجات الوكالة."
              : "Single canonical source of truth for public pricing, client CRM quotas and agency deliverable scopes."}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <SADAButton
            variant="outline"
            size="sm"
            asChild
            className="h-8.5 sm:h-9 text-xs justify-center"
            leftIcon={<ExternalLink className="size-3.5" />}
          >
            <Link to="/pricing" target="_blank">
              <span>{isAr ? "عرض الصفحة العامة" : "View Public Page"}</span>
            </Link>
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="h-8.5 sm:h-9 text-xs justify-center shadow-xs"
            leftIcon={<Plus className="size-3.5" />}
          >
            <span>{isAr ? "إنشاء باقة جديدة" : "Create New Package"}</span>
          </SADAButton>
        </div>
      </div>

      {/* 2. STATS STRIP — 5 DEDICATED CARDS (Responsive mobile swipeable strip, desktop 5-col grid) */}
      <div className="flex sm:grid overflow-x-auto sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3.5 pb-1 sm:pb-0 no-scrollbar snap-x">
        {/* Card 1: Total Packages */}
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-start transition-all relative overflow-hidden shrink-0 min-w-[130px] sm:min-w-0 flex-1 snap-start cursor-pointer ${
            activeTab === "all"
              ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 hover:border-border"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block tracking-wider truncate">
            {isAr ? "إجمالي الباقات" : "Total Packages"}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums mt-0.5 sm:mt-1 sada-num-kpi">
            {packages.length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground/80 truncate mt-0.5 sm:mt-1">
            {internalCount} {isAr ? "داخلي" : "internal"} + {proposalsCount} {isAr ? "مقترح" : "proposals"}
          </div>
        </button>

        {/* Card 2: Internal Catalog */}
        <button
          type="button"
          onClick={() => setActiveTab("internal")}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-start transition-all relative overflow-hidden shrink-0 min-w-[130px] sm:min-w-0 flex-1 snap-start cursor-pointer ${
            activeTab === "internal"
              ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 hover:border-border"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block tracking-wider truncate">
            {isAr ? "الدليل الداخلي" : "Internal Catalog"}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums mt-0.5 sm:mt-1 sada-num-kpi">
            {internalCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground/80 truncate mt-0.5 sm:mt-1">
            {isAr ? "حصص عمليات وإدارة العملاء" : "Coded operational retainers"}
          </div>
        </button>

        {/* Card 3: Public Proposals */}
        <button
          type="button"
          onClick={() => setActiveTab("proposals")}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-start transition-all relative overflow-hidden shrink-0 min-w-[130px] sm:min-w-0 flex-1 snap-start cursor-pointer ${
            activeTab === "proposals"
              ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 hover:border-border"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-amber-500/90 dark:text-amber-400 block tracking-wider truncate">
            {isAr ? "عروض عامة مقترحة" : "Public Proposals"}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-display tracking-tight text-amber-500/90 dark:text-amber-400 tabular-nums mt-0.5 sm:mt-1 sada-num-kpi">
            {proposalsCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground/80 truncate mt-0.5 sm:mt-1">
            {unapprovedProposalsCount} {isAr ? "مسودات قيد المراجعة" : "unapproved drafts"}
          </div>
        </button>

        {/* Card 4: Master Add-ons */}
        <button
          type="button"
          onClick={() => setActiveTab("addons")}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-start transition-all relative overflow-hidden shrink-0 min-w-[130px] sm:min-w-0 flex-1 snap-start cursor-pointer ${
            activeTab === "addons"
              ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/40 hover:border-border"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block tracking-wider truncate">
            {isAr ? "الإضافات المعتمدة" : "Master Add-ons"}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground tabular-nums mt-0.5 sm:mt-1 sada-num-kpi">
            {addons.length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground/80 truncate mt-0.5 sm:mt-1">
            {isAr ? "معدلات ووحدات إنتاج" : "Modular rates & modifiers"}
          </div>
        </button>

        {/* Card 5: Live on Website */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/80 bg-card text-start space-y-0.5 sm:space-y-1 shrink-0 min-w-[130px] sm:min-w-0 flex-1 snap-start">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider truncate">
            {isAr ? "منشورة على الموقع" : "Live on Website"}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-display tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 sm:mt-1 sada-num-kpi">
            {liveCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground/80 truncate mt-0.5 sm:mt-1">
            {isAr ? "معتمدة ومتاحة للزوار" : "Approved & publicly visible"}
          </div>
        </div>
      </div>

      {/* 3. CATALOG NAVIGATION (DEDICATED FULL-WIDTH ROW) */}
      <div className="w-full border-b border-border/80 pb-3">
        <nav aria-label="Catalog Navigation" className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/80 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{isAr ? "جميع الباقات" : "All Packages"}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === "all" ? "bg-muted text-foreground font-bold" : "bg-background/60 text-muted-foreground"
            }`}>
              {packages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("internal")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "internal"
                ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{isAr ? "الدليل الداخلي" : "Internal Catalog"}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === "internal" ? "bg-muted text-foreground font-bold" : "bg-background/60 text-muted-foreground"
            }`}>
              {internalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("proposals")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "proposals"
                ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{isAr ? "عروض عامة مقترحة" : "Public Proposals"}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === "proposals" ? "bg-amber-500/10 text-amber-500 font-bold" : "bg-background/60 text-muted-foreground"
            }`}>
              {proposalsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("addons")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "addons"
                ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{isAr ? "الإضافات" : "Add-ons"}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === "addons" ? "bg-muted text-foreground font-bold" : "bg-background/60 text-muted-foreground"
            }`}>
              {addons.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "categories"
                ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{isAr ? "التصنيفات" : "Categories"}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === "categories" ? "bg-muted text-foreground font-bold" : "bg-background/60 text-muted-foreground"
            }`}>
              {categories.length}
            </span>
          </button>
        </nav>
      </div>

      {/* 4. SEARCH AND FILTERS (SEPARATE DEDICATED ROW) */}
      {(activeTab === "all" || activeTab === "internal" || activeTab === "proposals") && (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            {/* Search */}
            <div className="w-full sm:w-64">
              <SADAInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث بالرمز أو الاسم..." : "Search code or name..."}
                startIcon={<Search className="size-3.5 text-muted-foreground" />}
                clearable={Boolean(searchQuery)}
                onClear={() => setSearchQuery("")}
                size="compact"
                className="text-xs w-full"
              />
            </div>

            {/* Scope Filter (Only in 'all' view) */}
            {activeTab === "all" && (
              <SADASelect
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e as any)}
                options={[
                  { value: "all", label: isAr ? "جميع النطاقات" : "All Scopes" },
                  { value: "internal", label: isAr ? "الدليل الداخلي" : "Internal Catalog" },
                  { value: "public_proposals", label: isAr ? "عروض مقترحة" : "Public Proposals" },
                ]}
                size="compact"
                className="w-36"
              />
            )}

            {/* Approval Filter */}
            <SADASelect
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e as any)}
              options={[
                { value: "all", label: isAr ? "جميع الاعتمادات" : "All Approvals" },
                { value: "approved", label: isAr ? "معتمدة" : "Approved" },
                { value: "proposed", label: isAr ? "مقترحة (مسودة)" : "Proposed (Draft)" },
              ]}
              size="compact"
              className="w-36"
            />

            {/* Category Filter */}
            <SADASelect
              value={selectedCategoryFilter}
              onChange={setSelectedCategoryFilter}
              options={categoryFilterOptions}
              size="compact"
              className="w-40"
            />

            {/* Status Filter */}
            <SADASelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e as any)}
              options={statusFilterOptions}
              size="compact"
              className="w-32"
            />
          </div>

          {/* View Mode Toggle (Aligned at far end) */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/80 self-end lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "table" ? "bg-card text-foreground shadow-xs ring-1 ring-border/40" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              <span>{isAr ? "جدول" : "Table"}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "cards" ? "bg-card text-foreground shadow-xs ring-1 ring-border/40" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>{isAr ? "بطاقات" : "Cards"}</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEWS: ALL PACKAGES / INTERNAL CATALOG / PUBLIC PROPOSALS
      ===================================================================== */}
      {(activeTab === "all" || activeTab === "internal" || activeTab === "proposals") && (
        <div className="space-y-4">
          {/* Internal Catalog Context Callout */}
          {activeTab === "internal" && (
            <div className="p-3.5 sm:p-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] flex items-start gap-3">
              <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                <Layers className="size-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <h4 className="font-bold text-foreground">
                  {isAr ? `الدليل التشغيلي الداخلي (${internalCount} باقة معتمدة)` : `Internal Operational Catalog (${internalCount} Master Records)`}
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {isAr
                    ? "هذه السجلات مخصصة للعمليات الداخلية، وتحديد حصص العملاء في الـ CRM، ونماذج التكاليف وهوامش الربح. لا يتم نشرها علناً للزوار أو في صفحة الأسعار العامة أبداً."
                    : "These records define operational retainers, CRM client quotas, internal cost structures, and gross margin targets. They are strictly internal and never exposed on the public pricing page."}
                </p>
              </div>
            </div>
          )}

          {/* Public Proposals Governance Callout */}
          {activeTab === "proposals" && (
            <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] flex items-start gap-3">
              <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <ShieldCheck className="size-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <h4 className="font-bold text-foreground">
                  {isAr ? `حوكمة العروض العامة المقترحة (${proposalsCount} باقات مقترحة)` : `Public Proposals Governance (${proposalsCount} Proposed Offers)`}
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {isAr
                    ? "تم تقسيم المقترحات العامة إلى 3 تصنيفات معتمدة. جميع الأسعار مقترحة وغير معتمدة، وتتطلب اعتماد صريح من الإدارة العليا قبل النشر. لم يتم نشر أي باقة تلقائياً."
                    : "The public packages are structured across 3 canonical categories. All records remain proposals until explicitly approved by Super Admin. Zero packages are published automatically."}
                </p>
              </div>
            </div>
          )}

          {loading && packages.length === 0 ? (
            <SkeletonTable rows={6} cols={6} />
          ) : displayedPackages.length === 0 ? (
            <div className="min-h-[260px] grid place-items-center text-center p-8 border border-dashed border-border rounded-3xl bg-card">
              <div className="space-y-2">
                <Package className="size-8 text-muted-foreground/40 mx-auto" />
                <h4 className="text-sm font-bold text-foreground">
                  {isAr ? "لم يتم العثور على أي باقات" : "No packages found"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isAr ? "جرّب مسح عوامل التصفية أو إنشاء باقة جديدة." : "Try clearing search filters or create a new package."}
                </p>
              </div>
            </div>
          ) : viewMode === "table" ? (
            <div className="rounded-3xl border border-border bg-card elevated-shadow overflow-hidden">
              {/* Mobile Structured Record Cards */}
              <div className="block md:hidden divide-y divide-border/60 p-2 sm:p-3">
                {displayedPackages.map((pkg, idx) => (
                  <div key={pkg.id} className="p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-foreground px-2 py-0.5 rounded bg-muted border border-border" dir="ltr">
                          {pkg.code}
                        </span>
                        <SADABadge variant={pkg.is_internal_only ? "neutral" : "warning"} size="xs">
                          {pkg.is_internal_only ? (isAr ? "داخلي" : "Internal") : (isAr ? "عرض عام مقترح" : "Public Proposal")}
                        </SADABadge>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(pkg, "up")}
                            disabled={idx === 0}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                            title={isAr ? "تحريك لأعلى" : "Move Up"}
                          >
                            <MoveUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(pkg, "down")}
                            disabled={idx === displayedPackages.length - 1}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                            title={isAr ? "تحريك لأسفل" : "Move Down"}
                          >
                            <MoveDown className="size-3" />
                          </button>
                        </div>
                      </div>

                      <div>
                        {!pkg.is_active ? (
                          <SADABadge variant="neutral" size="xs">{isAr ? "مؤرشفة" : "Archived"}</SADABadge>
                        ) : pkg.approval_status === "proposed" ? (
                          <SADABadge variant="warning" size="xs">{isAr ? "مقترح" : "Proposed"}</SADABadge>
                        ) : pkg.is_published ? (
                          <SADABadge variant="success" size="xs">{isAr ? "منشورة" : "Published"}</SADABadge>
                        ) : (
                          <SADABadge variant="neutral" size="xs">{isAr ? "مسودة" : "Draft"}</SADABadge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        {isAr && pkg.name_ar ? pkg.name_ar : pkg.name}
                      </h4>
                      {(isAr && pkg.short_description_ar ? pkg.short_description_ar : pkg.short_description) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {isAr && pkg.short_description_ar ? pkg.short_description_ar : pkg.short_description}
                        </p>
                      )}
                      {pkg.source_page_ref && (
                        <span className="text-[10px] font-mono text-muted-foreground/70 mt-1 block">
                          Ref: {pkg.source_page_ref}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{isAr ? "التصنيف" : "Category"}</span>
                        <span className="font-semibold text-foreground truncate block">
                          {(isAr ? categories.find(c => c.id === pkg.category_id)?.name_ar || pkg.category_name : pkg.category_name) || (isAr ? "عام" : "General")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{isAr ? "السعر والفوترة" : "Price & Billing"}</span>
                        <span className="font-semibold text-foreground font-display tabular-nums block">
                          {pkg.custom_pricing
                            ? (isAr ? "مخصص" : "Custom")
                            : pkg.approval_status === "proposed" && pkg.proposed_price
                            ? `${formatCurrency(pkg.proposed_price, { currency: pkg.currency || "TND" })}${pkg.billing_unit ? ` / ${pkg.billing_unit}` : ""} (مقترح)`
                            : `${formatCurrency(pkg.price, { currency: pkg.currency || "TND" })}${pkg.billing_unit ? ` / ${pkg.billing_unit}` : ""}`}
                        </span>
                        {pkg.ad_budget_separate && (
                          <span className="text-[9px] text-muted-foreground block">+ Client Ad Spend Separate</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[10px] text-muted-foreground">{isAr ? "الهامش:" : "Margin:"}</span>
                        {pkg.cost_verification_status === "unverified" || (!pkg.custom_pricing && (pkg.direct_costs === 0 || pkg.direct_costs === undefined)) ? (
                          <span className="text-amber-500 font-semibold text-[10px] inline-flex items-center gap-0.5" title="Direct costs unverified">
                            ⚠️ {isAr ? "غير مؤكد" : "Unverified"}
                          </span>
                        ) : (
                          <span className={(pkg.gross_margin || 0) >= 50 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-500 font-semibold"} dir="ltr">
                            {(pkg.gross_margin || 0).toFixed(1)}%
                          </span>
                        )}
                      </div>

                      {/* Clean primary button + Dropdown Menu */}
                      <div className="flex items-center gap-1.5">
                        <SADAButton
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setViewingDetailsPkg(pkg);
                            setShowDetailsModal(true);
                          }}
                          leftIcon={<Info className="size-3 text-primary" />}
                        >
                          <span>{isAr ? "التفاصيل" : "Details"}</span>
                        </SADAButton>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SADAButton
                              variant="ghost"
                              size="icon-xs"
                              className="hover:bg-muted"
                              title={isAr ? "خيارات إضافية" : "More Options"}
                            >
                              <MoreHorizontal className="size-3.5 text-muted-foreground" />
                            </SADAButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg z-50">
                            <DropdownMenuItem
                              onClick={() => {
                                setViewingDetailsPkg(pkg);
                                setShowDetailsModal(true);
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Info className="size-3.5 text-primary" />
                              <span>{isAr ? "عرض التفاصيل الكاملة" : "Full Details"}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(pkg)}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              <span>{isAr ? "تعديل الباقة" : "Edit Package"}</span>
                            </DropdownMenuItem>

                            {pkg.approval_status === "proposed" && isSuperAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleApproveProposal(pkg)}
                                className="text-xs flex items-center gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-semibold"
                              >
                                <Check className="size-3.5 text-amber-500" />
                                <span>{isAr ? "اعتماد مقترح التسعير" : "Approve Proposed Pricing"}</span>
                              </DropdownMenuItem>
                            )}

                            {!pkg.is_internal_only && (
                              <DropdownMenuItem
                                onClick={() => handleTogglePublish(pkg)}
                                className="text-xs flex items-center gap-2 cursor-pointer"
                              >
                                {pkg.is_published ? (
                                  <>
                                    <EyeOff className="size-3.5 text-muted-foreground" />
                                    <span>{isAr ? "إخفاء من صفحة الأسعار" : "Hide from Public Pricing"}</span>
                                  </>
                                ) : (
                                  <>
                                    <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>{isAr ? "نشر في صفحة الأسعار" : "Publish to Public Pricing"}</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => handleOpenDuplicate(pkg)}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>{isAr ? "تكرار الباقة" : "Duplicate Package"}</span>
                            </DropdownMenuItem>

                            {pkg.is_active && (
                              <DropdownMenuItem
                                onClick={() => handleArchive(pkg)}
                                className="text-xs flex items-center gap-2 cursor-pointer text-muted-foreground"
                              >
                                <Archive className="size-3.5" />
                                <span>{isAr ? "أرشفة الباقة" : "Archive Package"}</span>
                              </DropdownMenuItem>
                            )}

                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(pkg)}
                                  className="text-xs flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>{isAr ? "حذف الباقة" : "Delete Package"}</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Tabular View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-mono text-[10px] uppercase">
                    <tr>
                      <th className="px-3.5 py-3 font-bold w-12 text-center">#</th>
                      <th className="px-3.5 py-3 font-bold text-start w-28">{isAr ? "الرمز والنطاق" : "Code & Scope"}</th>
                      <th className="px-3.5 py-3 font-bold text-start min-w-[220px]">{isAr ? "اسم الباقة" : "Package Name"}</th>
                      <th className="px-3.5 py-3 font-bold text-start w-36">{isAr ? "التصنيف" : "Category"}</th>
                      <th className="px-3.5 py-3 font-bold text-start w-48">{isAr ? "السعر والفوترة" : "Price & Billing"}</th>
                      <th className="px-3.5 py-3 font-bold text-start w-28">{isAr ? "هامش الربح" : "Margin"}</th>
                      <th className="px-3.5 py-3 font-bold text-start w-32">{isAr ? "الحالة" : "Status"}</th>
                      <th className="px-3.5 py-3 font-bold text-start w-28">{isAr ? "الشارات" : "Badges"}</th>
                      <th className="px-3.5 py-3 font-bold text-end w-24">{isAr ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayedPackages.map((pkg, idx) => (
                      <tr key={pkg.id} className="hover:bg-muted/20 transition-colors">
                        {/* Display Order / Move */}
                        <td className="px-3.5 py-3.5 text-center font-mono text-muted-foreground align-top">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-bold text-foreground text-xs">{pkg.display_order}</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => handleMoveOrder(pkg, "up")}
                                disabled={idx === 0}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
                                title={isAr ? "تحريك لأعلى" : "Move Up"}
                              >
                                <MoveUp className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveOrder(pkg, "down")}
                                disabled={idx === displayedPackages.length - 1}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
                                title={isAr ? "تحريك لأسفل" : "Move Down"}
                              >
                                <MoveDown className="size-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Code & Scope */}
                        <td className="px-3.5 py-3.5 text-start space-y-1 align-top">
                          <span className="font-mono font-bold text-xs text-foreground px-2 py-0.5 rounded bg-muted border border-border inline-block" dir="ltr">
                            {pkg.code}
                          </span>
                          <div>
                            <SADABadge variant={pkg.is_internal_only ? "neutral" : "warning"} size="xs">
                              {pkg.is_internal_only ? (isAr ? "داخلي" : "Internal") : (isAr ? "مقترح" : "Proposal")}
                            </SADABadge>
                          </div>
                        </td>

                        {/* Package Name */}
                        <td className="px-3.5 py-3.5 text-start align-top">
                          <div className="font-bold text-foreground text-xs leading-snug">
                            {isAr && pkg.name_ar ? pkg.name_ar : pkg.name}
                          </div>
                          {(isAr && pkg.short_description_ar ? pkg.short_description_ar : pkg.short_description) && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {isAr && pkg.short_description_ar ? pkg.short_description_ar : pkg.short_description}
                            </div>
                          )}
                          {pkg.source_page_ref && (
                            <span className="text-[10px] font-mono text-muted-foreground/60 block mt-0.5">
                              Ref: {pkg.source_page_ref}
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-3.5 py-3.5 text-start align-top">
                          <SADABadge variant="outline" size="sm" className="font-sans font-normal truncate max-w-[140px] block">
                            {(isAr ? categories.find(c => c.id === pkg.category_id)?.name_ar || pkg.category_name : pkg.category_name) || (isAr ? "عام" : "General")}
                          </SADABadge>
                        </td>

                        {/* Price */}
                        <td className="px-3.5 py-3.5 text-start align-top">
                          <div className="font-display font-bold text-foreground tabular-nums text-xs">
                            {pkg.custom_pricing ? (
                              isAr ? "مخصص" : "Custom"
                            ) : pkg.approval_status === "proposed" && pkg.proposed_price ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-amber-500 font-bold">
                                    {formatCurrency(pkg.proposed_price, { currency: pkg.currency || "TND" })}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    {pkg.billing_unit ? `/ ${pkg.billing_unit}` : ""}
                                  </span>
                                </div>
                                <SADABadge variant="warning" size="xs">
                                  {isAr ? "مقترح" : "Proposed"}
                                </SADABadge>
                              </div>
                            ) : (
                              <div>
                                <span>{formatCurrency(pkg.price, { currency: pkg.currency || "TND" })}</span>
                                {pkg.billing_unit && (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    {" "}/ {pkg.billing_unit}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground capitalize mt-0.5">
                            {pkg.billing_type === "monthly" ? (isAr ? "شهري" : "Monthly Retainer") :
                             pkg.billing_type === "one_time" ? (isAr ? "مشروع لمرة واحدة" : "One-Time Project") :
                             pkg.billing_type === "starting_from" ? (isAr ? "يبدأ من" : "Starting From") :
                             (isAr ? "تسعير مخصص" : "Custom Pricing")}
                          </div>
                          {pkg.ad_budget_separate && (
                            <span className="text-[9px] text-muted-foreground/70 block mt-0.5">+ Client Ad Spend Separate</span>
                          )}
                        </td>

                        {/* Margin */}
                        <td className="px-3.5 py-3.5 font-display text-xs tabular-nums text-start align-top">
                          {pkg.cost_verification_status === "unverified" || (!pkg.custom_pricing && (pkg.direct_costs === 0 || pkg.direct_costs === undefined)) ? (
                            <span className="text-amber-500 font-semibold text-[11px] inline-flex items-center gap-1" title="Direct costs unverified. Do not treat as 0.">
                              ⚠️ {isAr ? "غير مؤكد" : "Unverified"}
                            </span>
                          ) : (
                            <span
                              className={
                                (pkg.gross_margin || 0) >= 50
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : "text-amber-500 font-semibold"
                              }
                              dir="ltr"
                            >
                              {(pkg.gross_margin || 0).toFixed(1)}%
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-3.5 text-start align-top">
                          {!pkg.is_active ? (
                            <SADABadge variant="neutral" size="sm">{isAr ? "مؤرشفة" : "Archived"}</SADABadge>
                          ) : pkg.approval_status === "proposed" ? (
                            <SADABadge variant="warning" size="sm">{isAr ? "مقترح (مسودة)" : "Proposed (Draft)"}</SADABadge>
                          ) : pkg.is_published ? (
                            <SADABadge variant="success" size="sm">{isAr ? "منشورة" : "Published"}</SADABadge>
                          ) : (
                            <SADABadge variant="neutral" size="sm">{isAr ? "مسودة" : "Draft"}</SADABadge>
                          )}
                        </td>

                        {/* Badges */}
                        <td className="px-3.5 py-3.5 text-start align-top">
                          {pkg.badge ? (
                            <SADABadge variant="purple" size="sm">
                              {pkg.badge === "most_popular" ? (isAr ? "الأكثر طلباً" : "Most Popular") :
                               pkg.badge === "recommended" ? (isAr ? "موصى به" : "Recommended") :
                               pkg.badge === "best_value" ? (isAr ? "أفضل قيمة" : "Best Value") :
                               pkg.badge === "featured" ? (isAr ? "مميز" : "Featured") :
                               (pkg.badge as string)}
                            </SADABadge>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions: Single Primary Action + DropdownMenu for Secondary Actions */}
                        <td className="px-3.5 py-3.5 text-end align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <SADAButton
                              variant="outline"
                              size="icon-sm"
                              onClick={() => {
                                setViewingDetailsPkg(pkg);
                                setShowDetailsModal(true);
                              }}
                              className="text-primary hover:text-primary"
                              title={isAr ? "معاينة التفاصيل والنطاق" : "View Package Details"}
                            >
                              <Info className="size-3.5" />
                            </SADAButton>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SADAButton
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                  title={isAr ? "خيارات إضافية" : "More Options"}
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </SADAButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg z-50">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setViewingDetailsPkg(pkg);
                                    setShowDetailsModal(true);
                                  }}
                                  className="text-xs flex items-center gap-2 cursor-pointer"
                                >
                                  <Info className="size-3.5 text-primary" />
                                  <span>{isAr ? "عرض التفاصيل الكاملة" : "Full Details"}</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleOpenEdit(pkg)}
                                  className="text-xs flex items-center gap-2 cursor-pointer"
                                >
                                  <Pencil className="size-3.5 text-muted-foreground" />
                                  <span>{isAr ? "تعديل الباقة" : "Edit Package"}</span>
                                </DropdownMenuItem>

                                {pkg.approval_status === "proposed" && isSuperAdmin && (
                                  <DropdownMenuItem
                                    onClick={() => handleApproveProposal(pkg)}
                                    className="text-xs flex items-center gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-semibold"
                                  >
                                    <Check className="size-3.5 text-amber-500" />
                                    <span>{isAr ? "اعتماد مقترح التسعير" : "Approve Proposed Pricing"}</span>
                                  </DropdownMenuItem>
                                )}

                                {!pkg.is_internal_only && (
                                  <DropdownMenuItem
                                    onClick={() => handleTogglePublish(pkg)}
                                    className="text-xs flex items-center gap-2 cursor-pointer"
                                  >
                                    {pkg.is_published ? (
                                      <>
                                        <EyeOff className="size-3.5 text-muted-foreground" />
                                        <span>{isAr ? "إخفاء من صفحة الأسعار" : "Hide from Public Pricing"}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>{isAr ? "نشر في صفحة الأسعار" : "Publish to Public Pricing"}</span>
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem
                                  onClick={() => handleOpenDuplicate(pkg)}
                                  className="text-xs flex items-center gap-2 cursor-pointer"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>{isAr ? "تكرار الباقة" : "Duplicate Package"}</span>
                                </DropdownMenuItem>

                                {pkg.is_active && (
                                  <DropdownMenuItem
                                    onClick={() => handleArchive(pkg)}
                                    className="text-xs flex items-center gap-2 cursor-pointer text-muted-foreground"
                                  >
                                    <Archive className="size-3.5" />
                                    <span>{isAr ? "أرشفة الباقة" : "Archive Package"}</span>
                                  </DropdownMenuItem>
                                )}

                                {isSuperAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(pkg)}
                                      className="text-xs flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{isAr ? "حذف الباقة" : "Delete Package"}</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col justify-between h-full hover:border-primary/40 hover:shadow-md transition-all space-y-3.5"
                >
                  <div className="space-y-2.5">
                    {/* Header Row: Code & Scope + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                        <span className="font-mono font-bold text-xs text-foreground px-2 py-0.5 rounded bg-muted border border-border" dir="ltr">
                          {pkg.code}
                        </span>
                        <SADABadge variant={pkg.is_internal_only ? "neutral" : "warning"} size="xs">
                          {pkg.is_internal_only ? (isAr ? "داخلي" : "Internal") : (isAr ? "مقترح" : "Proposal")}
                        </SADABadge>
                      </div>

                      <div className="shrink-0">
                        {!pkg.is_active ? (
                          <SADABadge variant="neutral" size="xs">{isAr ? "مؤرشفة" : "Archived"}</SADABadge>
                        ) : pkg.approval_status === "proposed" ? (
                          <SADABadge variant="warning" size="xs">{isAr ? "مقترح" : "Proposed"}</SADABadge>
                        ) : pkg.is_published ? (
                          <SADABadge variant="success" size="xs">{isAr ? "منشورة" : "Published"}</SADABadge>
                        ) : (
                          <SADABadge variant="neutral" size="xs">{isAr ? "مسودة" : "Draft"}</SADABadge>
                        )}
                      </div>
                    </div>

                    {/* Package Name & Category */}
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-foreground line-clamp-1">
                        {isAr && pkg.name_ar ? pkg.name_ar : pkg.name}
                      </h4>
                      <span className="text-[11px] font-medium text-primary block truncate mt-0.5">
                        {(isAr ? categories.find(c => c.id === pkg.category_id)?.name_ar || pkg.category_name : pkg.category_name) || (isAr ? "عام" : "General")}
                      </span>
                    </div>

                    {/* Short description */}
                    {(isAr && pkg.short_description_ar ? pkg.short_description_ar : pkg.short_description) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] leading-relaxed">
                        {isAr && pkg.short_description_ar ? pkg.short_description_ar : pkg.short_description}
                      </p>
                    )}

                    {pkg.source_page_ref && (
                      <span className="text-[10px] font-mono text-muted-foreground/60 block">
                        Ref: {pkg.source_page_ref}
                      </span>
                    )}
                  </div>

                  {/* Bottom Section: Price + Footer Actions */}
                  <div className="space-y-3 pt-2">
                    {/* Price strip */}
                    <div className="pt-3 border-t border-border/60 flex items-baseline justify-between gap-1">
                      <div>
                        <div className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums sada-num-metric">
                          {pkg.custom_pricing
                            ? (isAr ? "مخصص" : "Custom")
                            : pkg.approval_status === "proposed" && pkg.proposed_price
                            ? `${formatCurrency(pkg.proposed_price, { currency: pkg.currency || "TND" })}`
                            : `${formatCurrency(pkg.price, { currency: pkg.currency || "TND" })}`}
                          {!pkg.custom_pricing && pkg.billing_unit && (
                            <span className="text-xs font-normal text-muted-foreground"> / {pkg.billing_unit}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground block capitalize mt-0.5">
                          {pkg.billing_type === "monthly" ? (isAr ? "اشتراك شهري" : "Monthly Retainer") :
                           pkg.billing_type === "one_time" ? (isAr ? "مشروع لمرة واحدة" : "One-Time") :
                           pkg.billing_type === "starting_from" ? (isAr ? "يبدأ من" : "Starting From") :
                           (isAr ? "تسعير مخصص" : "Custom Pricing")}
                        </span>
                      </div>

                      {/* Margin pill */}
                      <div className="text-end">
                        {pkg.cost_verification_status === "unverified" || (!pkg.custom_pricing && (pkg.direct_costs === 0 || pkg.direct_costs === undefined)) ? (
                          <span className="text-amber-500 font-semibold text-[10px]" title="Direct costs unverified">
                            ⚠️ {isAr ? "غير مؤكد" : "Unverified"}
                          </span>
                        ) : (
                          <span className={`text-xs font-bold ${ (pkg.gross_margin || 0) >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500" }`} dir="ltr">
                            {(pkg.gross_margin || 0).toFixed(1)}% {isAr ? "هامش" : "margin"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (Clean primary + secondary overflow) */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      <SADAButton
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setViewingDetailsPkg(pkg);
                          setShowDetailsModal(true);
                        }}
                        leftIcon={<Info className="size-3 text-primary" />}
                        className="text-xs font-semibold"
                      >
                        <span>{isAr ? "عرض التفاصيل" : "View Details"}</span>
                      </SADAButton>

                      <div className="flex items-center gap-1">
                        <SADAButton
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleOpenEdit(pkg)}
                          className="hover:bg-muted"
                          title={isAr ? "تعديل" : "Edit"}
                        >
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </SADAButton>

                        {/* Overflow dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SADAButton
                              variant="ghost"
                              size="icon-xs"
                              className="hover:bg-muted"
                              title={isAr ? "خيارات إضافية" : "More Options"}
                            >
                              <MoreHorizontal className="size-3.5 text-muted-foreground" />
                            </SADAButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg z-50">
                            <DropdownMenuItem
                              onClick={() => {
                                setViewingDetailsPkg(pkg);
                                setShowDetailsModal(true);
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Info className="size-3.5 text-primary" />
                              <span>{isAr ? "عرض التفاصيل الكاملة" : "Full Details"}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(pkg)}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              <span>{isAr ? "تعديل الباقة" : "Edit Package"}</span>
                            </DropdownMenuItem>

                            {pkg.approval_status === "proposed" && isSuperAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleApproveProposal(pkg)}
                                className="text-xs flex items-center gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-semibold"
                              >
                                <Check className="size-3.5 text-amber-500" />
                                <span>{isAr ? "اعتماد مقترح التسعير" : "Approve Proposed Pricing"}</span>
                              </DropdownMenuItem>
                            )}

                            {!pkg.is_internal_only && (
                              <DropdownMenuItem
                                onClick={() => handleTogglePublish(pkg)}
                                className="text-xs flex items-center gap-2 cursor-pointer"
                              >
                                {pkg.is_published ? (
                                  <>
                                    <EyeOff className="size-3.5 text-muted-foreground" />
                                    <span>{isAr ? "إخفاء من صفحة الأسعار" : "Hide from Public Pricing"}</span>
                                  </>
                                ) : (
                                  <>
                                    <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>{isAr ? "نشر في صفحة الأسعار" : "Publish to Public Pricing"}</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => handleOpenDuplicate(pkg)}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>{isAr ? "تكرار الباقة" : "Duplicate Package"}</span>
                            </DropdownMenuItem>

                            {pkg.is_active && (
                              <DropdownMenuItem
                                onClick={() => handleArchive(pkg)}
                                className="text-xs flex items-center gap-2 cursor-pointer text-muted-foreground"
                              >
                                <Archive className="size-3.5" />
                                <span>{isAr ? "أرشفة الباقة" : "Archive Package"}</span>
                              </DropdownMenuItem>
                            )}

                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(pkg)}
                                  className="text-xs flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>{isAr ? "حذف الباقة" : "Delete Package"}</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: ADD-ONS CMS
      ===================================================================== */}
      {activeTab === "addons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "الإضافات والوحدات المتاحة للإرفاق بعقود العملاء أو إصدار فواتير بها كمخرجات مستقلة."
                : "Add-ons and units available to be attached to client contracts or billed as individual deliverables."}
            </p>
            <button
              onClick={() => {
                setAddonCode("");
                setAddonName("");
                setAddonNameAr("");
                setAddonPrice(100);
                setAddonUnit("item");
                setAddonPercentage(undefined);
                setAddonCategory("general");
                setAddonDesc("");
                setShowAddonModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 inline-flex items-center gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>{isAr ? "إضافة جديدة" : "New Add-on"}</span>
            </button>
          </div>

          <div className="rounded-3xl border border-border bg-card elevated-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-mono text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الرمز" : "Code"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الاسم (عربي / إنجليزي)" : "Name (EN / AR)"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "السعر / النسبة" : "Price / Modifier"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الوحدة" : "Unit"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "التصنيف" : "Category"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الحالة" : "Status"}</th>
                    <th className="px-4 py-3.5 font-bold text-end">{isAr ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {addons.map((add) => (
                    <tr key={add.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-foreground text-start" dir="ltr">
                        {add.code}
                      </td>
                      <td className="px-4 py-3.5 text-start">
                        <div className="font-bold text-foreground">{isAr && add.name_ar ? add.name_ar : add.name}</div>
                        {(isAr ? add.name : add.name_ar) && (
                          <div className="text-[11px] text-muted-foreground">{isAr ? add.name : add.name_ar}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-display font-semibold text-foreground tabular-nums text-start">
                        {add.percentage_modifier
                          ? <span dir="ltr">+{add.percentage_modifier}%</span>
                          : formatCurrency(add.price)}
                      </td>
                      <td className="px-4 py-3.5 capitalize text-muted-foreground text-start">
                        {add.unit === "item" ? (isAr ? "عنصر" : "item") :
                         add.unit === "hour" ? (isAr ? "ساعة" : "hour") :
                         add.unit === "session" ? (isAr ? "جلسة" : "session") :
                         add.unit === "visit" ? (isAr ? "زيارة" : "visit") :
                         add.unit === "percentage" ? (isAr ? "نسبة مئوية" : "percentage") :
                         add.unit}
                      </td>
                      <td className="px-4 py-3.5 capitalize text-muted-foreground text-start">
                        {add.category === "general" ? (isAr ? "عام" : "general") :
                         add.category === "content" ? (isAr ? "محتوى" : "content") :
                         add.category === "production" ? (isAr ? "إنتاج" : "production") :
                         add.category === "story" ? (isAr ? "قصة" : "story") :
                         add.category === "web" ? (isAr ? "موقع" : "web") :
                         add.category === "delivery" ? (isAr ? "تسليم" : "delivery") :
                         add.category}
                      </td>
                      <td className="px-4 py-3.5 text-start">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            add.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {add.is_active ? (isAr ? "نشطة" : "Active") : (isAr ? "مؤرشفة" : "Archived")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        {add.is_active && (
                          <button
                            onClick={() => {
                              setConfirmState({
                                open: true,
                                title: isAr ? `أرشفة الإضافة ${add.name_ar || add.name}؟` : `Archive add-on ${add.name}?`,
                                description: isAr ? "سيتم إخفاء هذه الإضافة من تكوينات الباقات الجديدة." : "This add-on will be hidden from new package configurations.",
                                variant: "warning",
                                confirmLabel: isAr ? "أرشفة الإضافة" : "Archive Add-on",
                                onConfirm: async () => {
                                  await archiveAddon(add.id, actorInfo);
                                  loadData();
                                },
                              });
                            }}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={isAr ? "أرشفة الإضافة" : "Archive Addon"}
                          >
                            <Archive className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: CATEGORIES CMS
      ===================================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "التصنيفات الرسمية للباقات. يحدد الترتيب تسلسل العرض في صفحة الأسعار العامة."
              : "Official package categories. Ordering determines display sequence on public pricing."}
          </p>

          <div className="rounded-3xl border border-border bg-card elevated-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-mono text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-3.5 font-bold w-12 text-center">{isAr ? "الترتيب" : "Order"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الرمز" : "Code"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "اسم التصنيف" : "Category Name"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "المعرّف اللطيف" : "Slug"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الوصف" : "Description"}</th>
                    <th className="px-4 py-3.5 font-bold text-start">{isAr ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-center text-foreground">
                        {c.display_order}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-foreground text-start" dir="ltr">{c.code}</td>
                      <td className="px-4 py-3.5 text-start">
                        <div className="font-bold text-foreground">{isAr && c.name_ar ? c.name_ar : c.name}</div>
                        {(isAr ? c.name : c.name_ar) && <div className="text-[11px] text-muted-foreground">{isAr ? c.name : c.name_ar}</div>}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-muted-foreground text-start" dir="ltr">{c.slug}</td>
                      <td className="px-4 py-3.5 text-muted-foreground max-w-sm truncate text-start">
                        {(isAr && c.description_ar ? c.description_ar : c.description) || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-start">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {isAr ? "نشط" : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          REDESIGNED CANONICAL PACKAGE EDITOR DRAWER (SECTIONS 1-8 + LIVE PREVIEW)
      ===================================================================== */}
      <PackageEditorDrawer
        open={showEditor}
        onOpenChange={setShowEditor}
        mode={editorMode}
        initialData={selectedEditingPkg}
        categories={categories}
        saving={saving}
        onSave={handleSavePackageInput}
        isAr={isAr}
      />

      {/* =====================================================================
          DUPLICATE PACKAGE MODAL
      ===================================================================== */}
      <SADADialog
        open={showDuplicateModal && Boolean(duplicatingPkg)}
        onOpenChange={(open) => !open && setShowDuplicateModal(false)}
        size="compact"
        title={isAr ? `تكرار الباقة ${duplicatingPkg?.code || ""}` : `Duplicate ${duplicatingPkg?.code || "Package"}`}
        description={
          isAr
            ? `سيؤدي هذا إلى إنشاء مسودة جديدة من ${duplicatingPkg?.name_ar || duplicatingPkg?.name || "الباقة"} مع جميع ميزاتها وحصصها. يُرجى اختيار رمز فريد جديد.`
            : `This will create a new draft copy of ${duplicatingPkg?.name || "the package"} with all its features and quotas. Please choose a new unique code.`
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowDuplicateModal(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={saving || !newDuplicateCode.trim()}
              onClick={handleConfirmDuplicate}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors"
            >
              {saving ? (isAr ? "جارٍ التكرار..." : "Duplicating...") : (isAr ? "تأكيد والتكرار" : "Confirm & Duplicate")}
            </button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground block">
            {isAr ? "رمز الباقة الجديد *" : "New Package Code *"}
          </label>
          <SADAInput
            required
            value={newDuplicateCode}
            onChange={(e) => setNewDuplicateCode(e.target.value)}
            placeholder="e.g. MG-05"
            dir="ltr"
            className="font-mono uppercase font-bold text-sm text-start"
          />
        </div>
      </SADADialog>

      {/* =====================================================================
          ADD-ON CREATION MODAL
      ===================================================================== */}
      <SADADialog
        open={showAddonModal}
        onOpenChange={setShowAddonModal}
        size="compact"
        title={isAr ? "إنشاء إضافة جديدة" : "Create New Add-on"}
        description={
          isAr
            ? "تحديد حصص المخرجات والتكاليف وأسعار البيع لهذه الإضافة الاختيارية."
            : "Configure deliverable quotas, costs, and selling prices for this optional addon."
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddonModal(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!addonCode || !addonName) return;
                setSaving(true);
                const res = await createAddon(
                  {
                    code: addonCode.trim().toUpperCase(),
                    name: addonName.trim(),
                    name_ar: addonNameAr.trim() || undefined,
                    price: addonPrice,
                    unit: addonUnit,
                    category: addonCategory,
                  },
                  actorInfo
                );
                setSaving(false);
                if (res.success) {
                  toast.success(isAr ? "تم إنشاء الإضافة بنجاح" : "Addon created successfully");
                  setShowAddonModal(false);
                  loadData();
                } else {
                  toast.error(res.error || (isAr ? "فشل إنشاء الإضافة" : "Failed to create addon"));
                }
              }}
              disabled={saving || !addonCode || !addonName}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors"
            >
              {saving ? (isAr ? "جارٍ الإنشاء..." : "Creating...") : (isAr ? "إنشاء الإضافة" : "Create Add-on")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground block">{isAr ? "الرمز *" : "Code *"}</label>
              <SADAInput
                required
                placeholder="e.g. ADD-13"
                value={addonCode}
                onChange={(e) => setAddonCode(e.target.value)}
                className="font-mono uppercase text-start"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground block">{isAr ? "الاسم (بالإنجليزية) *" : "Name (EN) *"}</label>
              <SADAInput
                required
                placeholder="e.g. Extra Drone Footage"
                value={addonName}
                onChange={(e) => setAddonName(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground block">{isAr ? "الاسم (بالعربية)" : "Name (AR)"}</label>
              <SADAInput
                placeholder="مثال: تصوير درون إضافي"
                value={addonNameAr}
                onChange={(e) => setAddonNameAr(e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground block text-xs">{isAr ? "السعر (د.ت)" : "Price (TND)"}</label>
              <SADANumberStepper
                value={addonPrice}
                onChange={setAddonPrice}
                min={0}
                step={10}
                unit={isAr ? "د.ت" : "TND"}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground block text-xs">{isAr ? "الوحدة" : "Unit"}</label>
              <SADASelect
                value={addonUnit}
                onChange={setAddonUnit}
                options={addonUnitOptions}
                size="default"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground block text-xs">{isAr ? "التصنيف" : "Category"}</label>
              <SADASelect
                value={addonCategory}
                onChange={setAddonCategory}
                options={addonCategoryOptions}
                size="default"
              />
            </div>
          </div>
        </div>
      </SADADialog>

      {/* SADA Package Details Modal */}
      <PackageDetailsModal
        package={viewingDetailsPkg}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        onSelect={(p) => {
          setShowDetailsModal(false);
          handleOpenEdit(p);
        }}
      />

      {/* SADA Canonical Confirmation Dialog */}
      <SADAConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
        title={confirmState.title}
        description={confirmState.description}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
