import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  TrendingUp, Plus, DollarSign, Building2, CheckCircle2,
  Clock, ArrowRight, Sparkles, Filter, Search, Layers,
  ChevronLeft, ChevronRight, AlertCircle, XCircle, ArrowRightLeft,
  Calendar, User, Check, ShieldCheck, Tag, ShieldAlert, Loader2,
  Percent, Wallet, Award, Users, FileText, ArrowUpRight, Sliders,
  HelpCircle, Eye, RefreshCw, GripVertical, Edit3, Trash2
} from "lucide-react";
import {
  type DealStage,
  type DealRow,
  type PackageRow,
  STAGE_ORDER,
  STAGE_CONFIG,
  fetchDeals,
  fetchPackages,
  createDeal,
  updateDeal,
  updateDealStage,
  updateLeadStage,
  convertLeadToSale,
  deleteDeal,
  calculateDealCommission,
  type CommissionRow,
  fetchSalesCommissions,
  approveCommission,
  payoutCommission,
} from "@/lib/sales-service";
import {
  SADAButton,
  SADAInput,
  SADATextarea,
  SADASelect,
  type SADASelectOption,
  SADADatePicker,
  SADABadge,
  SADACard,
  SADANumber,
  SADADialog,
  SADAConfirmDialog,
  SADAEmptyState,
  SADASearch,
  SalesPipelineSkeleton,
} from "@/components/ui/sada-ui";
import { ModuleAccessShield } from "@/components/admin/ModuleAccessShield";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/types/finance";
import { getBusinessRuleNumber, subscribeToBusinessRules } from "@/lib/business-rules-service";
import { useTranslation } from "@/i18n";
import { can, type PermissionContext } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STAGE_BADGE_VARIANTS: Record<DealStage, "primary" | "success" | "warning" | "danger" | "sky" | "purple" | "neutral"> = {
  lead: "neutral",
  contacted: "sky",
  qualified: "primary",
  meeting: "warning",
  proposal: "purple",
  negotiation: "primary",
  won: "success",
  lost: "danger",
};

export function SalesWorkspaceView({ initialTab }: { initialTab?: "pipeline" | "commissions" | "performance" } = {}) {
  const { user, role, isSuperAdmin, isAdmin, isWorker, customModulePermissions, loading: authLoading } = useAuth();
  const { t, language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const nav = useNavigate();

  // Granular Sales Permission Context
  const permCtx: PermissionContext = useMemo(() => ({
    role: role || "worker",
    userId: user?.id,
    customPermissions: customModulePermissions,
  }), [role, user?.id, customModulePermissions]);

  const canViewSales = useMemo(() => can(permCtx, "sales.view"), [permCtx]);
  const canCreateLead = useMemo(() => can(permCtx, "sales.create_lead"), [permCtx]);
  const canEditLead = useMemo(() => can(permCtx, "sales.edit_lead"), [permCtx]);
  const canChangeStage = useMemo(() => can(permCtx, "sales.change_stage"), [permCtx]);
  const canConvertLead = useMemo(() => can(permCtx, "sales.convert_lead"), [permCtx]);
  const canDeleteLead = useMemo(() => isSuperAdmin && can(permCtx, "sales.delete_lead"), [isSuperAdmin, permCtx]);

  // Primary Data State
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  // Workers: "pipeline" (Leads & Pipeline) | "commissions" (My Commissions)
  // Admins: "pipeline" | "commissions" | "performance"
  const [activeTab, setActiveTab] = useState<"pipeline" | "commissions" | "performance">(initialTab || "pipeline");

  // Pipeline Views & Filters
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("all");

  // Drag and Drop & Move Stage State
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<DealStage | null>(null);
  const [isMutatingStageMap, setIsMutatingStageMap] = useState<Record<string, boolean>>({});
  const wasDraggedRef = useRef(false);
  const dragStartTimestampRef = useRef(0);

  // Horizontal Kanban Scrolling & Stage Quick-Jump
  const kanbanTrackRef = useRef<HTMLDivElement>(null);
  const stageColumnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeVisibleStage, setActiveVisibleStage] = useState<DealStage>("lead");

  // Create Lead Modal State
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const [leadTitle, setLeadTitle] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadContactName, setLeadContactName] = useState("");
  const [leadContactEmail, setLeadContactEmail] = useState("");
  const [leadContactPhone, setLeadContactPhone] = useState("");
  const [leadPackageId, setLeadPackageId] = useState("");
  const [leadEstimatedValue, setLeadEstimatedValue] = useState<number>(2300);
  const [leadStage, setLeadStage] = useState<DealStage>("qualified");
  const [leadCloseDate, setLeadCloseDate] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadSalesOwnerId, setLeadSalesOwnerId] = useState("");
  const [creatingLead, setCreatingLead] = useState(false);

  // Convert Lead to Sale Modal State
  const [convertingDeal, setConvertingDeal] = useState<DealRow | null>(null);
  const [saleClientId, setSaleClientId] = useState("");
  const [salePackageId, setSalePackageId] = useState("");
  const [saleTotalAmount, setSaleTotalAmount] = useState<number>(2300);
  const [saleSponsoringAmount, setSaleSponsoringAmount] = useState<number>(800);
  const [salePaymentStatus, setSalePaymentStatus] = useState<"unpaid" | "partially_paid" | "paid">("paid");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saleNotes, setSaleNotes] = useState("");
  const [saleClientError, setSaleClientError] = useState(false);
  const [converting, setConverting] = useState(false);

  // Detail Modal & Edit Mode State
  const [inspectingDeal, setInspectingDeal] = useState<DealRow | null>(null);
  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editPackageId, setEditPackageId] = useState("");
  const [editStage, setEditStage] = useState<DealStage>("qualified");
  const [editDealValue, setEditDealValue] = useState<number>(2300);
  const [editSponsoringBudget, setEditSponsoringBudget] = useState<number>(0);
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSalesOwnerId, setEditSalesOwnerId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Deal Confirmation State
  const [dealToDelete, setDealToDelete] = useState<DealRow | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);

  // Worker Performance Matrix Search & Filter State
  const [perfSearchQuery, setPerfSearchQuery] = useState("");
  const [onlyActiveSalesReps, setOnlyActiveSalesReps] = useState(false);

  // Commission Rules State (for Admin inspection & quick editing)
  const initialCommissionRateRule = getBusinessRuleNumber("initial_commission_rate", 15);
  const renewalCommissionRateRule = getBusinessRuleNumber("renewal_commission_rate", 5);
  const upsellCommissionRateRule = getBusinessRuleNumber("upsell_commission_rate", 5);

  const loadSalesData = useCallback(async (isBackground = false) => {
    if (!user) return;
    if (!canViewSales) {
      setLoading(false);
      return;
    }
    if (!isBackground && deals.length === 0) {
      setLoading(true);
    }

    try {
      const [dealsRes, commsRes, pkgsRes, clientsRes, teamRes] = await Promise.all([
        fetchDeals({ ctx: permCtx, includeClientDetails: true }),
        fetchSalesCommissions({ ctx: permCtx }),
        fetchPackages(),
        (supabase as any).from("clients").select("id, name, industry, status").order("name", { ascending: true }),
        (supabase as any).from("team_members").select("*").eq("is_active", true).order("name", { ascending: true }),
      ]);

      setDeals(dealsRes || []);
      setCommissions(commsRes || []);
      setPackages(pkgsRes || []);
      setClients(clientsRes.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (err: any) {
      console.error("[SalesWorkspace] Error loading sales data:", err);
      toast.error("Failed to load sales pipeline");
    } finally {
      setLoading(false);
    }
  }, [user, canViewSales, permCtx, deals.length]);

  useEffect(() => {
    loadSalesData();

    const channel = supabase
      .channel("realtime:sales_workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => loadSalesData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_commissions" }, () => loadSalesData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSalesData]);

  // Realtime Business Rules Subscription
  useEffect(() => {
    const unsub = subscribeToBusinessRules(() => {
      loadSalesData(true);
    });
    return () => {
      unsub();
    };
  }, [loadSalesData]);

  // Horizontal Kanban Scrolling & Active Column Sync
  const updateScrollState = useCallback(() => {
    const el = kanbanTrackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const scrollLeft = el.scrollLeft;
    if (isRTL) {
      const absScroll = Math.abs(scrollLeft);
      setCanScrollLeft(absScroll < maxScroll - 5);
      setCanScrollRight(absScroll > 5);
    } else {
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < maxScroll - 5);
    }

    // Determine center/visible stage
    const containerRect = el.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let closestStage: DealStage = "lead";
    let minDistance = Infinity;

    STAGE_ORDER.forEach((stageKey) => {
      const col = stageColumnRefs.current[stageKey];
      if (col) {
        const colRect = col.getBoundingClientRect();
        const colCenter = colRect.left + colRect.width / 2;
        const dist = Math.abs(colCenter - containerCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestStage = stageKey;
        }
      }
    });

    setActiveVisibleStage(closestStage);
  }, [isRTL]);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState, deals.length, viewMode]);

  const handleKanbanScroll = () => {
    updateScrollState();
  };

  const scrollKanban = (direction: "left" | "right") => {
    if (!kanbanTrackRef.current) return;
    const step = 336; // 320px column width + 16px gap
    const sign = direction === "left" ? (isRTL ? 1 : -1) : (isRTL ? -1 : 1);
    kanbanTrackRef.current.scrollBy({ left: sign * step, behavior: "smooth" });
  };

  const scrollToStage = (stage: DealStage) => {
    const track = kanbanTrackRef.current;
    if (!track) return;
    if (stage === STAGE_ORDER[0]) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      setActiveVisibleStage(stage);
      return;
    }
    const col = stageColumnRefs.current[stage];
    if (col) {
      col.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      setActiveVisibleStage(stage);
    }
  };

  // Current authenticated worker's team member row
  const myMember = useMemo(() => {
    if (!user) return null;
    return teamMembers.find(m => m.profile_id === user.id || m.id === user.id) || null;
  }, [user, teamMembers]);

  // Scoped Deals:
  // - Worker sees only their own deals (handled by RLS and UI)
  // - Admin sees all or filtered by selectedWorkerFilter
  const visibleDeals = useMemo(() => {
    return deals.filter(d => {
      // Worker filter
      if (isWorker) {
        const isMine = d.sales_owner_id === user?.id || (myMember?.id && d.commission_recipient_id === myMember.id);
        if (!isMine) return false;
      } else if (selectedWorkerFilter !== "all") {
        const matches = d.sales_owner_id === selectedWorkerFilter || d.commission_recipient_id === selectedWorkerFilter;
        if (!matches) return false;
      }

      // Stage filter
      if (selectedStage !== "all" && d.stage !== selectedStage) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientName = (d as any).client?.name?.toLowerCase() || "";
        const title = (d.title || "").toLowerCase();
        const company = (d.company_name || "").toLowerCase();
        const contact = (d.contact_name || "").toLowerCase();
        if (!title.includes(q) && !company.includes(q) && !contact.includes(q) && !clientName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [deals, isWorker, selectedWorkerFilter, selectedStage, searchQuery, user, myMember]);

  // Scoped Commissions:
  // - Worker sees only their own commissions (RLS + frontend filter)
  // - Admin sees all or filtered by selectedWorkerFilter
  const visibleCommissions = useMemo(() => {
    return commissions.filter(c => {
      if (isWorker) {
        const isMine = (myMember?.id && c.team_member_id === myMember.id) || deals.some(d => d.id === c.deal_id && d.sales_owner_id === user?.id);
        if (!isMine) return false;
      } else if (selectedWorkerFilter !== "all") {
        if (c.team_member_id !== selectedWorkerFilter) return false;
      }
      return true;
    });
  }, [commissions, isWorker, selectedWorkerFilter, myMember, deals, user]);

  // Financial Metrics Breakdown
  const metrics = useMemo(() => {
    const targetDeals = isWorker
      ? deals.filter(d => d.sales_owner_id === user?.id || (myMember?.id && d.commission_recipient_id === myMember.id))
      : deals;

    const leads = targetDeals.filter(d => d.stage === "lead" || d.stage === "contacted");
    const activeOpportunities = targetDeals.filter(d => ["qualified", "meeting", "proposal", "negotiation"].includes(d.stage));
    const wonDeals = targetDeals.filter(d => d.stage === "won");
    const lostDeals = targetDeals.filter(d => d.stage === "lost");

    const pipelineValue = activeOpportunities.reduce((sum, d) => sum + Number(d.deal_value || 0), 0);
    const wonRevenue = wonDeals.reduce((sum, d) => sum + Number(d.deal_value || 0), 0);

    const paidComms = visibleCommissions
      .filter(c => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
    const pendingComms = visibleCommissions
      .filter(c => c.status === "pending" || c.status === "approved")
      .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

    const totalDealsFinished = wonDeals.length + lostDeals.length;
    const conversionRate = totalDealsFinished > 0 ? (wonDeals.length / totalDealsFinished) * 100 : 0;

    return {
      leadsCount: leads.length,
      activeOpportunitiesCount: activeOpportunities.length,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      pipelineValue,
      wonRevenue,
      paidCommissions: paidComms,
      pendingCommissions: pendingComms,
      totalCommissions: paidComms + pendingComms,
      conversionRate,
    };
  }, [deals, visibleCommissions, isWorker, user, myMember]);

  // Handle Create Lead Submission (sales.create_lead)
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateLead) {
      toast.error(isAr ? "ليس لديك صلاحية إنشاء الصفقات (sales.create_lead)." : "Unauthorized: Account lacks 'sales.create_lead' permission.");
      return;
    }
    if (!leadTitle.trim() || !leadCompany.trim()) {
      toast.error("Please provide both deal title and company name");
      return;
    }

    setCreatingLead(true);
    try {
      const selectedPkg = packages.find(p => p.id === leadPackageId);
      const estValue = leadEstimatedValue || selectedPkg?.selling_price || 2300;
      const sponsoring = 0; // Default 0 for lead stage

      // Resolve sales representative / owner and commission beneficiary
      const resolvedOwnerId = (!isWorker && leadSalesOwnerId) ? leadSalesOwnerId : user?.id;
      const resolvedMember = teamMembers.find(m => m.profile_id === resolvedOwnerId || m.id === resolvedOwnerId) || myMember;
      const beneficiaryId = resolvedMember?.id;

      const created = await createDeal({
        title: leadTitle.trim(),
        companyName: leadCompany.trim(),
        contactName: leadContactName.trim() || undefined,
        contactEmail: leadContactEmail.trim() || undefined,
        contactPhone: leadContactPhone.trim() || undefined,
        packageId: leadPackageId || undefined,
        stage: leadStage,
        salesOwnerId: resolvedOwnerId,
        commissionRecipientId: beneficiaryId || undefined,
        serviceRevenue: estValue,
        dealValue: estValue,
        sponsoringBudget: sponsoring,
        commissionRate: initialCommissionRateRule,
        expectedCloseDate: leadCloseDate || undefined,
        notes: leadNotes.trim() || undefined,
        ctx: permCtx,
        actorRole: role || "worker",
      });

      if (!created) {
        throw new Error("Failed to create deal");
      }

      toast.success(isAr ? "تم إنشاء الصفقة بنجاح!" : "Lead created successfully!");
      setShowCreateLeadModal(false);
      resetLeadForm();
      loadSalesData(true);
    } catch (err: any) {
      console.error("[CreateLead] Error:", err);
      toast.error(`Failed to create lead: ${err.message}`);
    } finally {
      setCreatingLead(false);
    }
  };

  const resetLeadForm = () => {
    setLeadTitle("");
    setLeadCompany("");
    setLeadContactName("");
    setLeadContactEmail("");
    setLeadContactPhone("");
    setLeadPackageId("");
    setLeadEstimatedValue(2300);
    setLeadStage("qualified");
    setLeadCloseDate("");
    setLeadNotes("");
    setLeadSalesOwnerId(user?.id || "");
  };

  // Open Convert to Sale modal for a lead
  const openConvertToSaleModal = (deal: DealRow) => {
    if (!canConvertLead) {
      toast.error(isAr ? "ليس لديك صلاحية تحويل الصفقات (sales.convert_lead)." : "Unauthorized: Account lacks 'sales.convert_lead' permission.");
      return;
    }
    setConvertingDeal(deal);
    setSaleClientError(false);

    // Auto-match heuristic if deal.client_id is not yet linked:
    let resolvedClientId = deal.client_id || "";
    if (!resolvedClientId && clients.length > 0) {
      const match = clients.find(c =>
        (deal.company_name && c.name?.toLowerCase().trim() === deal.company_name.toLowerCase().trim()) ||
        (deal.contact_email && (c as any).email?.toLowerCase().trim() === deal.contact_email.toLowerCase().trim())
      );
      if (match) {
        resolvedClientId = match.id;
      }
    }

    setSaleClientId(resolvedClientId);
    setSalePackageId(deal.package_id || "");
    setSaleTotalAmount(Number(deal.deal_value || 2300));
    setSaleSponsoringAmount(Number(deal.sponsoring_budget || 800));
    setSalePaymentStatus("paid");
    setSaleDate(format(new Date(), "yyyy-MM-dd"));
    setSaleNotes(deal.notes || `Converted from lead: ${deal.title}`);
  };

  // Convert Lead to Sale (Lead Conversion - sales.convert_lead)
  const handleConvertToSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingDeal) return;
    if (!canConvertLead) {
      toast.error(isAr ? "ليس لديك صلاحية تحويل الصفقات (sales.convert_lead)." : "Unauthorized: Account lacks 'sales.convert_lead' permission.");
      return;
    }

    // Strict client validation before any mutation or service invocation
    if (!saleClientId || !saleClientId.trim()) {
      setSaleClientError(true);
      toast.error(
        isAr
          ? "يرجى اختيار عميل صدى صالح لإتمام البيع واحتساب العمولة."
          : "Please select a valid SADA Client to finalize sale and calculate commission."
      );
      return;
    }
    setSaleClientError(false);

    setConverting(true);
    try {
      const res = await convertLeadToSale({
        dealId: convertingDeal.id,
        clientId: saleClientId.trim(),
        packageId: salePackageId || undefined,
        saleAmount: Number(saleTotalAmount),
        sponsoringAmount: Number(saleSponsoringAmount || 0),
        paymentStatus: salePaymentStatus,
        saleDate,
        notes: saleNotes.trim() || undefined,
        ctx: permCtx,
        actorRole: role || "worker",
        actorId: user?.id,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to convert lead to sale");
      }

      toast.success(isAr ? "تم تحويل الصفقة إلى بيع ناجح بنجاح!" : "Lead successfully converted to Won Sale!");
      setConvertingDeal(null);
      loadSalesData(true);
    } catch (err: any) {
      console.error("[ConvertToSale] Error:", err);
      toast.error(`Failed to convert lead: ${err.message}`);
    } finally {
      setConverting(false);
    }
  };

  // Handle Deal Definition Edit (sales.edit_lead)
  const startEditingDeal = (deal: DealRow) => {
    setEditTitle(deal.title || "");
    setEditCompany(deal.company_name || "");
    setEditContactName(deal.contact_name || "");
    setEditContactEmail(deal.contact_email || "");
    setEditContactPhone(deal.contact_phone || "");
    setEditPackageId(deal.package_id || "");
    setEditStage(deal.stage || "qualified");
    setEditDealValue(Number(deal.deal_value || 0));
    setEditSponsoringBudget(Number(deal.sponsoring_budget || 0));
    setEditCloseDate(deal.expected_close_date || "");
    setEditNotes(deal.notes || "");
    setEditSalesOwnerId(deal.sales_owner_id || "");
    setIsEditingDeal(true);
  };

  const handleSaveDealEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingDeal) return;
    if (!canEditLead) {
      toast.error(isAr ? "ليس لديك صلاحية تعديل الصفقات (sales.edit_lead)." : "Unauthorized: Account lacks 'sales.edit_lead' permission.");
      return;
    }
    if (!editTitle.trim() || !editCompany.trim()) {
      toast.error("Please provide both deal title and company name");
      return;
    }

    setSavingEdit(true);
    try {
      // 1. Stage transition check if changed in edit modal
      if (editStage !== inspectingDeal.stage) {
        if (editStage === "won") {
          toast.info(
            isAr
              ? "تحويل الصفقة إلى ناجحة يتطلب إتمام البيع عبر 'تحويل إلى بيع'."
              : "Marking a deal as Won requires finalizing the sale via 'Convert to Sale'."
          );
        } else if (canChangeStage) {
          await updateLeadStage({
            leadId: inspectingDeal.id,
            fromStage: inspectingDeal.stage,
            newStage: editStage,
            actorCtx: permCtx,
            actorRole: role,
            actorId: user?.id,
            actorName: user?.email,
          });
        }
      }

      const resolvedOwner = (!isWorker && editSalesOwnerId) ? editSalesOwnerId : inspectingDeal.sales_owner_id;
      const targetMember = teamMembers.find(m => m.profile_id === resolvedOwner || m.id === resolvedOwner);

      const updated = await updateDeal(
        inspectingDeal.id,
        {
          title: editTitle.trim(),
          companyName: editCompany.trim(),
          contactName: editContactName.trim() || null,
          contactEmail: editContactEmail.trim() || null,
          contactPhone: editContactPhone.trim() || null,
          packageId: editPackageId || null,
          dealValue: editDealValue,
          serviceRevenue: Math.max(0, editDealValue - editSponsoringBudget),
          sponsoringBudget: editSponsoringBudget,
          expectedCloseDate: editCloseDate || null,
          notes: editNotes.trim() || null,
          salesOwnerId: resolvedOwner || null,
          commissionRecipientId: targetMember?.id || inspectingDeal.commission_recipient_id || null,
        },
        {
          ctx: permCtx,
          actorRole: role || "worker",
          actorId: user?.id,
        }
      );

      toast.success(isAr ? "تم تحديث بيانات الصفقة بنجاح!" : "Deal updated successfully!");
      setInspectingDeal(updated);
      setIsEditingDeal(false);
      loadSalesData(true);
    } catch (err: any) {
      console.error("[EditDeal] Error:", err);
      toast.error(err.message || "Failed to update deal");
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Deal Permanent Deletion (sales.delete_lead)
  const handleDeleteDeal = async () => {
    if (!dealToDelete) return;
    if (!canDeleteLead) {
      toast.error(isAr ? "حذف الصفقات مخصص لمدير النظام الأعلى فقط (sales.delete_lead)." : "Unauthorized: Deal deletion is strictly Super Admin exclusive (sales.delete_lead).");
      return;
    }

    setDeletingDeal(true);
    try {
      await deleteDeal(dealToDelete.id, {
        ctx: permCtx,
        actorRole: role || "super_admin",
        actorId: user?.id,
      });

      toast.success(isAr ? "تم حذف الصفقة نهائياً بنجاح!" : "Deal permanently deleted successfully!");
      setDealToDelete(null);
      setInspectingDeal(null);
      loadSalesData(true);
    } catch (err: any) {
      console.error("[DeleteDeal] Error:", err);
      toast.error(err.message || "Failed to delete deal");
    } finally {
      setDeletingDeal(false);
    }
  };

  const netRev = (total: number, spon: number) => Math.max(0, total - spon);

  // Unified Canonical Stage Transition Engine (Optimistic UI + Authorized Server Mutation + Rollback)
  const executeStageTransition = async (dealId: string, nextStage: DealStage) => {
    if (!canChangeStage) {
      toast.error(isAr ? "ليس لديك صلاحية نقل مرحلة الصفقة (sales.change_stage)." : "Unauthorized: Account lacks 'sales.change_stage' permission.");
      return;
    }

    // 1. Guard against in-flight mutation (race condition / double drop prevention)
    if (isMutatingStageMap[dealId]) return;

    const targetDeal = deals.find(d => d.id === dealId);
    if (!targetDeal) return;

    // 2. Same stage no-op
    if (targetDeal.stage === nextStage) return;

    // 3. Convert to Sale separation: winning a deal requires explicit conversion
    if (nextStage === "won") {
      openConvertToSaleModal(targetDeal);
      return;
    }

    const previousStage = targetDeal.stage;

    // 4. Mark deal as mutating in-flight
    setIsMutatingStageMap(prev => ({ ...prev, [dealId]: true }));

    // 5. OPTIMISTIC UPDATE: Move card immediately in local state
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: nextStage } : d));

    const nextLabel = STAGE_CONFIG[nextStage]?.label || nextStage;
    const toastId = toast.loading(
      isAr ? `جاري نقل الصفقة إلى ${nextLabel}...` : `Moving lead to ${nextLabel}...`
    );

    try {
      const result = await updateLeadStage({
        leadId: dealId,
        fromStage: previousStage,
        newStage: nextStage,
        actorCtx: permCtx,
        actorRole: role,
        actorId: user?.id,
        actorName: user?.email,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update lead stage");
      }

      toast.success(
        isAr ? `تم نقل الصفقة بنجاح إلى ${nextLabel}` : `Moved to ${nextLabel}`,
        { id: toastId }
      );

      // Silent canonical reload in background to guarantee database synchronization
      loadSalesData(true);
    } catch (err: any) {
      // 6. ROLLBACK ON FAILURE: Restore original stage and metrics
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: previousStage } : d));
      toast.error(
        err.message || (isAr
          ? `تعذر نقل هذه الصفقة إلى ${nextLabel}. تم استرجاع الحالة السابقة.`
          : `Couldn't move this lead to ${nextLabel}. Your changes were not saved.`),
        { id: toastId }
      );
    } finally {
      setIsMutatingStageMap(prev => {
        const next = { ...prev };
        delete next[dealId];
        return next;
      });
    }
  };

  const handleStageChange = executeStageTransition;

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, deal: DealRow) => {
    if (!canChangeStage || isMutatingStageMap[deal.id]) {
      e.preventDefault();
      return;
    }
    wasDraggedRef.current = true;
    dragStartTimestampRef.current = Date.now();
    setDraggedDealId(deal.id);
    e.dataTransfer.setData("text/plain", deal.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
    setDragOverColumnKey(null);
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 150);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: DealStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (kanbanTrackRef.current) {
      const rect = kanbanTrackRef.current.getBoundingClientRect();
      const edgeThreshold = 65;
      if (e.clientX - rect.left < edgeThreshold) {
        kanbanTrackRef.current.scrollLeft -= isRTL ? -14 : 14;
      } else if (rect.right - e.clientX < edgeThreshold) {
        kanbanTrackRef.current.scrollLeft += isRTL ? -14 : 14;
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent, stageKey: DealStage) => {
    e.preventDefault();
    if (draggedDealId) {
      setDragOverColumnKey(stageKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageKey: DealStage) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverColumnKey === stageKey) {
        setDragOverColumnKey(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, stageKey: DealStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain") || draggedDealId;
    setDragOverColumnKey(null);
    setDraggedDealId(null);

    if (dealId) {
      executeStageTransition(dealId, stageKey);
    }
  };

  // Package Options for SADASelect
  const packageOptions: SADASelectOption[] = useMemo(() => {
    return [
      { value: "", label: isAr ? "بدون باقة محددة / نطاق مخصص" : "No Specific Package / Custom Scope" },
      ...packages.map(p => ({
        value: p.id,
        label: `${p.name} — ${formatCurrency(p.selling_price)}`,
      })),
    ];
  }, [packages, isAr]);

  // Client Options for SADASelect
  const clientOptions: SADASelectOption[] = useMemo(() => {
    return [
      { value: "", label: isAr ? "اختر العميل..." : "Select Client..." },
      ...clients.map(c => ({
        value: c.id,
        label: c.name,
      })),
    ];
  }, [clients, isAr]);

  // Worker Options for Filters
  const workerFilterOptions: SADASelectOption[] = useMemo(() => {
    return [
      { value: "all", label: isAr ? "جميع مسؤولي المبيعات" : "All Sales Representatives" },
      ...teamMembers.map(m => ({
        value: m.profile_id || m.id,
        label: m.name,
      })),
    ];
  }, [teamMembers, isAr]);

  // Sales Assignee Options for Create/Edit Modal
  const salesAssigneeOptions: SADASelectOption[] = useMemo(() => {
    return [
      { value: "", label: isAr ? "اختر مسؤول المبيعات..." : "Select Sales Representative..." },
      ...teamMembers.map(m => ({
        value: m.profile_id || m.id,
        label: `${m.name} (${m.role})`,
      })),
    ];
  }, [teamMembers, isAr]);

  // Stage Options for Filter
  const stageFilterOptions: SADASelectOption[] = useMemo(() => {
    return [
      { value: "all", label: isAr ? "جميع المراحل" : "All Stages" },
      ...STAGE_ORDER.map(s => ({ value: s, label: STAGE_CONFIG[s].label })),
    ];
  }, [isAr]);

  // Stage Options for Lead Creation
  const stageLeadCreateOptions: SADASelectOption[] = useMemo(() => {
    return STAGE_ORDER.filter(s => s !== "won").map(s => ({
      value: s,
      label: STAGE_CONFIG[s].label,
    }));
  }, [isAr]);

  // Stage Options for Deal Edit
  const stageEditOptions: SADASelectOption[] = useMemo(() => {
    return STAGE_ORDER.map(s => ({
      value: s,
      label: STAGE_CONFIG[s].label,
    }));
  }, [isAr]);

  // Commercial Team Performance Metrics with active pipeline correction & search/filter
  const filteredPerformanceMembers = useMemo(() => {
    return teamMembers
      .map(member => {
        const memberDeals = deals.filter(
          d =>
            d.sales_owner_id === member.profile_id ||
            d.sales_owner_id === member.id ||
            d.commission_recipient_id === member.id ||
            d.commission_recipient_id === member.profile_id
        );
        const won = memberDeals.filter(d => d.stage === "won");
        // Canonical active pipeline: all non-won and non-lost stages
        const active = memberDeals.filter(d => !["won", "lost"].includes(d.stage));
        const pipeVal = active.reduce((s, d) => s + Number(d.deal_value || 0), 0);
        const wonRev = won.reduce((s, d) => s + Number(d.deal_value || 0), 0);
        const winRate = memberDeals.length > 0 ? (won.length / memberDeals.length) * 100 : 0;
        const commsTotal = commissions
          .filter(
            c =>
              c.team_member_id === member.id ||
              c.team_member_id === member.profile_id ||
              memberDeals.some(d => d.id === c.deal_id)
          )
          .reduce((s, c) => s + Number(c.commission_amount || 0), 0);

        return {
          member,
          memberDeals,
          won,
          active,
          pipeVal,
          wonRev,
          winRate,
          commsTotal,
          hasActivity: memberDeals.length > 0 || commsTotal > 0,
        };
      })
      .filter(item => {
        if (onlyActiveSalesReps && !item.hasActivity) return false;
        if (perfSearchQuery.trim()) {
          const q = perfSearchQuery.toLowerCase().trim();
          const name = (item.member.name || "").toLowerCase();
          const email = (item.member.email || "").toLowerCase();
          const roleStr = (item.member.role || "").toLowerCase();
          return name.includes(q) || email.includes(q) || roleStr.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (b.memberDeals.length !== a.memberDeals.length) {
          return b.memberDeals.length - a.memberDeals.length;
        }
        return b.wonRev - a.wonRev;
      });
  }, [teamMembers, deals, commissions, onlyActiveSalesReps, perfSearchQuery]);

  // Payment Status Options
  const paymentStatusOptions: SADASelectOption[] = useMemo(() => [
    { value: "paid", label: isAr ? "مدفوعة (العمولة معتمدة)" : "Paid (Commission Approved)" },
    { value: "unpaid", label: isAr ? "غير مدفوعة (العمولة معلقة)" : "Unpaid (Commission Pending)" },
    { value: "partially_paid", label: isAr ? "مدفوعة جزئياً" : "Partially Paid" },
  ], [isAr]);

  if (!authLoading && user && !canViewSales) {
    return (
      <ModuleAccessShield
        module="sales"
        customMessage={isAr ? "ليس لديك صلاحية الوصول إلى مساحة المبيعات (sales.view)." : "You lack permission to access the Sales workspace (sales.view)."}
        errorCode="UNAUTHORIZED_ROUTE"
        targetPath="/admin/sales"
      />
    );
  }

  if (loading && deals.length === 0) {
    return <SalesPipelineSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-20">
      {/* =====================================================================
          HEADER SECTION
      ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <SADABadge variant="primary" size="sm" className="font-mono">
              {isAr ? (isWorker ? "نظام مبيعات المنفّذ" : "إشراف المبيعات والصفقات") : (isWorker ? "Worker Sales OS" : "Agency Sales Oversight")}
            </SADABadge>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              {isAr ? (isWorker ? "أدائي وخط الصفقات" : "المحرك التجاري الشامل للوكالة") : (isWorker ? "My Performance & Pipeline" : "Agency-Wide Commercial Engine")}
            </span>
          </div>

          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {isAr ? (isWorker ? "مبيعات وعمولات المنفّذ" : "إدارة خط المبيعات والعمولات") : (isWorker ? "Worker Sales & Commissions" : "Sales Pipeline & Commission Management")}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {isAr
              ? (isWorker
                  ? "تابع صفقاتك المؤهلة، وحوّل الفرص إلى مبيعات ناجحة، واطّلع على عمولاتك المستحقة فورياً."
                  : "التحكم في خط صفقات الوكالة، محرك العمولات القابل للتخصيص، ومؤشرات أداء الفريق والالتزامات المالية.")
              : (isWorker
                  ? "Track your qualified leads, convert opportunities into sales, and inspect your earned commissions in real time."
                  : "Agency pipeline control, configurable commission engine, worker performance metrics, and financial liability governance.")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <SADAButton
            variant="outline"
            size="icon"
            onClick={() => loadSalesData()}
            title={isAr ? "تحديث البيانات" : "Refresh Data"}
          >
            <RefreshCw className="size-4" />
          </SADAButton>

          {canCreateLead && (
            <SADAButton
              variant="primary"
              onClick={() => {
                resetLeadForm();
                setShowCreateLeadModal(true);
              }}
            >
              <Plus className="size-4" />
              <span>{isAr ? "صفقة جديدة" : "New Lead"}</span>
            </SADAButton>
          )}
        </div>
      </div>

      {/* =====================================================================
          SECTION A: SALES & COMMISSION OVERVIEW (KPI CARDS)
      ===================================================================== */}
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Leads & Active Opportunities */}
        <SADACard className="p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
              {isAr ? (isWorker ? "صفقاتي النشطة" : "خط الصفقات النشط") : (isWorker ? "My Active Leads" : "Active Pipeline")}
            </span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              {metrics.activeOpportunitiesCount}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {isAr ? `${metrics.leadsCount} جديدة` : `${metrics.leadsCount} new leads`}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/60">
            <span>{isAr ? "قيمة الخط النشط:" : "Pipeline Value:"}</span>
            <SADANumber value={metrics.pipelineValue} currency="TND" variant="table" className="font-bold text-foreground" />
          </div>
        </SADACard>

        {/* Card 2: Won Sales & Revenue */}
        <SADACard className="p-4 sm:p-5 space-y-2 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
              {isAr ? (isWorker ? "صفقاتي المكتملة" : "إجمالي الصفقات الناجحة") : (isWorker ? "My Won Sales" : "Total Won Sales")}
            </span>
            <Award className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              {metrics.wonCount}
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
              <SADANumber value={metrics.conversionRate} variant="percent" decimals={0} /> {isAr ? "معدل الإغلاق" : "Win Rate"}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-emerald-500/20">
            <span>{isAr ? "عوائد الصفقات:" : "Won Revenue:"}</span>
            <SADANumber value={metrics.wonRevenue} currency="TND" variant="table" className="font-bold text-foreground" />
          </div>
        </SADACard>

        {/* Card 3: Pending Commissions */}
        <SADACard className="p-4 sm:p-5 space-y-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
              {isAr ? (isWorker ? "عمولات معلقة" : "التزامات عمولات معلقة") : (isWorker ? "Pending Commission" : "Pending Liability")}
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-amber-600 dark:text-amber-400">
            <SADANumber value={metrics.pendingCommissions} currency="TND" variant="kpi" />
          </div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t border-amber-500/20">
            {isAr ? "بانتظار تسوية دفعات العملاء" : "Awaiting client payment clearance"}
          </div>
        </SADACard>

        {/* Card 4: Paid Commissions */}
        <SADACard className="p-4 sm:p-5 space-y-2 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between text-primary">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
              {isAr ? (isWorker ? "عمولات مستلمة" : "عمولات منصرفة") : (isWorker ? "Paid Commissions" : "Disbursed Commissions")}
            </span>
            <Wallet className="size-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-primary">
            <SADANumber value={metrics.paidCommissions} currency="TND" variant="kpi" />
          </div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t border-primary/20 flex items-center justify-between">
            <span>{isAr ? "إجمالي المستحقات:" : "Total Earned:"}</span>
            <SADANumber value={metrics.totalCommissions} currency="TND" variant="table" className="font-bold text-primary" />
          </div>
        </SADACard>
      </div>

      {/* =====================================================================
          NAVIGATION TABS
      ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <SADAButton
          size="sm"
          variant={activeTab === "pipeline" ? "primary" : "ghost"}
          onClick={() => setActiveTab("pipeline")}
          className="shrink-0 whitespace-nowrap"
        >
          <TrendingUp className="size-3.5 me-1" />
          <span>{isAr ? (isWorker ? "صفقاتي والفرص" : "خط المبيعات والصفقات") : (isWorker ? "My Leads & Pipeline" : "Sales Pipeline")}</span>
          <SADABadge
            variant={activeTab === "pipeline" ? "luxury" : "neutral"}
            size="xs"
            className="ms-1.5"
          >
            {visibleDeals.length}
          </SADABadge>
        </SADAButton>

        <SADAButton
          size="sm"
          variant={activeTab === "commissions" ? "primary" : "ghost"}
          onClick={() => setActiveTab("commissions")}
          className="shrink-0 whitespace-nowrap"
        >
          <Percent className="size-3.5 me-1" />
          <span>{isAr ? (isWorker ? "عمولاتي" : "إدارة العمولات والقواعد") : (isWorker ? "My Commissions" : "Commission Management & Rules")}</span>
          <SADABadge
            variant={activeTab === "commissions" ? "luxury" : "neutral"}
            size="xs"
            className="ms-1.5"
          >
            {visibleCommissions.length}
          </SADABadge>
        </SADAButton>

        {!isWorker && (
          <SADAButton
            size="sm"
            variant={activeTab === "performance" ? "primary" : "ghost"}
            onClick={() => setActiveTab("performance")}
            className="shrink-0 whitespace-nowrap"
          >
            <Users className="size-3.5 me-1" />
            <span>{isAr ? "مصفوفة أداء الفريق" : "Worker Performance Matrix"}</span>
          </SADAButton>
        )}
      </div>

      {/* =====================================================================
          TAB 1: PIPELINE & LEADS
      ===================================================================== */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <SADACard className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 w-full">
              {/* Search with SADASearch */}
              <SADASearch
                size="compact"
                placeholder={isAr ? "بحث في الصفقات، الشركات، جهات الاتصال..." : "Search leads, company, contact..."}
                value={searchQuery}
                onChange={setSearchQuery}
                className="w-full sm:w-64"
              />

              <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center">
                {/* Stage Filter with SADASelect */}
                <SADASelect
                  size="compact"
                  value={selectedStage}
                  onChange={setSelectedStage}
                  options={stageFilterOptions}
                  className="w-full sm:w-40"
                />

                {/* Admin Worker Filter with SADASelect */}
                {!isWorker && (
                  <SADASelect
                    size="compact"
                    value={selectedWorkerFilter}
                    onChange={setSelectedWorkerFilter}
                    options={workerFilterOptions}
                    className="w-full sm:w-48"
                  />
                )}
              </div>
            </div>

            {/* View Mode Toggle with SADAButton */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border shrink-0 self-end sm:self-auto">
              <SADAButton
                size="xs"
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                onClick={() => setViewMode("kanban")}
              >
                {isAr ? "لوحة كانبان" : "Kanban"}
              </SADAButton>
              <SADAButton
                size="xs"
                variant={viewMode === "table" ? "secondary" : "ghost"}
                onClick={() => setViewMode("table")}
              >
                {isAr ? "جدول" : "Table"}
              </SADAButton>
            </div>
          </SADACard>

          {/* Kanban View */}
          {viewMode === "kanban" && (
            <div className="space-y-3">
              {/* Horizontal Stage Navigation Controls & Quick-Jump */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
                {/* Horizontally Scrollable Stage Quick-Jump Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1">
                  {STAGE_ORDER.map((stageKey) => {
                    const count = visibleDeals.filter(d => d.stage === stageKey).length;
                    const isActive = activeVisibleStage === stageKey;
                    return (
                      <button
                        key={stageKey}
                        type="button"
                        onClick={() => scrollToStage(stageKey)}
                        className={cn(
                          "px-2.5 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border shrink-0",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                        )}
                        title={isAr ? `الانتقال إلى مرحلة ${STAGE_CONFIG[stageKey].label}` : `Jump to ${STAGE_CONFIG[stageKey].label}`}
                        aria-label={isAr ? `الانتقال إلى ${STAGE_CONFIG[stageKey].label}` : `Jump to ${STAGE_CONFIG[stageKey].label}`}
                      >
                        <span className={cn("size-1.5 rounded-full shrink-0", isActive ? "bg-white" : STAGE_CONFIG[stageKey].color.replace("text-", "bg-"))} />
                        <span>{STAGE_CONFIG[stageKey].label}</span>
                        <span className={cn("text-[10px] px-1 py-0.2 rounded-full font-mono", isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Left/Right Scroll Arrow Controls */}
                <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => scrollKanban(isRTL ? "right" : "left")}
                    disabled={!canScrollLeft}
                    className={cn(
                      "p-1.5 rounded-lg border border-border/70 transition-all text-muted-foreground",
                      canScrollLeft
                        ? "hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer shadow-sm"
                        : "opacity-35 cursor-not-allowed"
                    )}
                    aria-label={isAr ? "التمرير لليسار" : "Scroll Left"}
                    title={isAr ? "التمرير لليسار" : "Scroll Left"}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollKanban(isRTL ? "left" : "right")}
                    disabled={!canScrollRight}
                    className={cn(
                      "p-1.5 rounded-lg border border-border/70 transition-all text-muted-foreground",
                      canScrollRight
                        ? "hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer shadow-sm"
                        : "opacity-35 cursor-not-allowed"
                    )}
                    aria-label={isAr ? "التمرير لليمين" : "Scroll Right"}
                    title={isAr ? "التمرير لليمين" : "Scroll Right"}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Single-Row Horizontal Kanban Stage Track */}
              <div
                ref={kanbanTrackRef}
                onScroll={handleKanbanScroll}
                className="flex flex-row items-start gap-4 overflow-x-auto kanban-horizontal-track pb-6 pt-1 px-1 scroll-px-2 scroll-smooth focus:outline-none"
                tabIndex={0}
                role="region"
                aria-label={isAr ? "مسار مراحل صفقات المبيعات" : "Sales Pipeline Stage Track"}
              >
                {STAGE_ORDER.map((stageKey) => {
                  const stageDeals = visibleDeals.filter(d => d.stage === stageKey);
                  const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.deal_value || 0), 0);
                  const cfg = STAGE_CONFIG[stageKey];

                  return (
                    <div
                      key={stageKey}
                      ref={(el) => { stageColumnRefs.current[stageKey] = el; }}
                      onDragOver={(e) => handleDragOver(e, stageKey)}
                      onDragEnter={(e) => handleDragEnter(e, stageKey)}
                      onDragLeave={(e) => handleDragLeave(e, stageKey)}
                      onDrop={(e) => handleDrop(e, stageKey)}
                      className={cn(
                        "p-3.5 rounded-3xl border border-border/80 bg-muted/20 space-y-3 flex flex-col shrink-0 w-[290px] sm:w-[310px] md:w-[320px] max-w-[320px] transition-all duration-200 select-none",
                        dragOverColumnKey === stageKey && "border-primary bg-primary/[0.04] ring-2 ring-primary/40 shadow-xl"
                      )}
                    >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <SADABadge variant={STAGE_BADGE_VARIANTS[stageKey]} size="xs">
                          {cfg.label}
                        </SADABadge>
                        <span className="text-xs font-mono font-semibold text-muted-foreground">
                          ({stageDeals.length})
                        </span>
                      </div>
                      <SADANumber
                        value={stageValue}
                        currency="TND"
                        variant="table"
                        className="text-[11px] font-bold text-foreground"
                      />
                    </div>

                    {/* Visual Drop Target Indicator */}
                    {dragOverColumnKey === stageKey && (
                      <div className="py-2.5 px-3 border-2 border-dashed border-primary/70 bg-primary/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-primary animate-pulse transition-all">
                        <ArrowRightLeft className="size-3.5" />
                        <span>{isAr ? `إفلات في ${cfg.label}` : `Drop Lead Here (${cfg.label})`}</span>
                      </div>
                    )}

                    {/* Column Cards */}
                    <div className="space-y-2.5 flex-1 min-h-[150px]">
                      {stageDeals.length === 0 && dragOverColumnKey !== stageKey ? (
                        <div className="p-4 text-center text-xs text-muted-foreground/60 italic border border-dashed border-border/60 rounded-2xl">
                          {isAr ? `لا توجد صفقات في مرحلة ${cfg.label}` : `No ${cfg.label.toLowerCase()} deals`}
                        </div>
                      ) : (
                        stageDeals.map((deal) => {
                          const netRevenue = Math.max(0, Number(deal.service_revenue || deal.deal_value || 0));
                          const sponsoring = Number(deal.sponsoring_budget || 0);
                          const isBeingDragged = draggedDealId === deal.id;
                          const isMutating = Boolean(isMutatingStageMap[deal.id]);

                          return (
                            <SADACard
                              key={deal.id}
                              hoverable
                              draggable={canChangeStage && !isMutating}
                              onDragStart={(e) => handleDragStart(e, deal)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                if (wasDraggedRef.current || (dragStartTimestampRef.current && Date.now() - dragStartTimestampRef.current < 250)) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  return;
                                }
                                setInspectingDeal(deal);
                              }}
                              className={cn(
                                "p-4 cursor-pointer space-y-2.5 group text-start relative transition-all duration-150",
                                canChangeStage && "cursor-grab active:cursor-grabbing",
                                isBeingDragged && "opacity-40 scale-[0.98] border-primary/60 bg-primary/5 shadow-2xl ring-2 ring-primary/40",
                                isMutating && "opacity-60 pointer-events-none"
                              )}
                            >
                              {/* Loading Overlay during mutation */}
                              {isMutating && (
                                <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center gap-1.5 text-xs text-primary font-medium z-10">
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>{isAr ? "جاري الحفظ..." : "Saving..."}</span>
                                </div>
                              )}

                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-1.5 min-w-0">
                                  {canChangeStage && (
                                    <span
                                      className="text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 transition-colors cursor-grab active:cursor-grabbing shrink-0"
                                      title={isAr ? "سحب وإفلات لتغيير المرحلة" : "Drag to move stage"}
                                    >
                                      <GripVertical className="size-3.5" />
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-mono text-muted-foreground uppercase truncate">
                                      {deal.company_name}
                                    </div>
                                    <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                      {deal.title}
                                    </h4>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <SADANumber
                                    value={deal.deal_value}
                                    currency="TND"
                                    variant="table"
                                    className="font-bold text-xs text-foreground"
                                  />

                                  {/* Accessible / Mobile "Move to Stage" Dropdown */}
                                  {canChangeStage && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                          title={isAr ? "نقل إلى مرحلة أخرى" : "Move to Stage"}
                                          aria-label={isAr ? `نقل ${deal.title} إلى مرحلة أخرى` : `Move ${deal.title} to stage`}
                                        >
                                          <ArrowRightLeft className="size-3" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48 bg-popover/95 backdrop-blur-md border-border shadow-xl">
                                        <div className="px-2 py-1.5 text-[10px] font-mono uppercase text-muted-foreground">
                                          {isAr ? "نقل إلى مرحلة" : "Move to Stage"}
                                        </div>
                                        {STAGE_ORDER.filter(s => s !== deal.stage).map((s) => (
                                          <DropdownMenuItem
                                            key={s}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              executeStageTransition(deal.id, s);
                                            }}
                                            className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className={cn("size-2 rounded-full", STAGE_CONFIG[s].color.replace("text-", "bg-"))} />
                                              <span>{STAGE_CONFIG[s].label}</span>
                                            </div>
                                            {s === "won" && <Sparkles className="size-3 text-emerald-500" />}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>

                              {/* Contact info */}
                              {deal.contact_name && (
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {isAr ? "جهة الاتصال: " : "Contact: "} {deal.contact_name} {deal.contact_phone && `(${deal.contact_phone})`}
                                </div>
                              )}

                              {/* Financial details: Service vs Sponsoring */}
                              {sponsoring > 0 && (
                                <div className="text-[10px] font-mono text-muted-foreground bg-muted/40 p-1.5 rounded-lg flex items-center justify-between">
                                  <span>{isAr ? "الخدمات: " : "Service: "}<SADANumber value={netRevenue} currency="TND" /></span>
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {isAr ? "الإعلانات: " : "Sponsoring: "}<SADANumber value={sponsoring} currency="TND" />
                                  </span>
                                </div>
                              )}

                              {/* Card Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                                {stageKey !== "won" ? (
                                  canConvertLead ? (
                                    <SADAButton
                                      type="button"
                                      size="xs"
                                      variant="primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openConvertToSaleModal(deal);
                                      }}
                                    >
                                      <Check className="size-3 me-1" />
                                      <span>{isAr ? "تحويل إلى بيع" : "Convert to Sale"}</span>
                                    </SADAButton>
                                  ) : null
                                ) : (
                                  <SADABadge variant="success" size="xs" dot>
                                    {isAr ? "صفقة ناجحة" : "Won Sale"}
                                  </SADABadge>
                                )}

                                <SADAButton
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectingDeal(deal);
                                  }}
                                >
                                  <span>{isAr ? "عرض ←" : "View →"}</span>
                                </SADAButton>
                              </div>
                            </SADACard>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Table View */}
          {viewMode === "table" && (
            <SADACard className="overflow-hidden">
              {/* Mobile Card List View (< md) */}
              <div className="block md:hidden divide-y divide-border">
                {visibleDeals.length === 0 ? (
                  <div className="p-6">
                    <SADAEmptyState
                      compact
                      title={isAr ? "لا توجد صفقات" : "No deals found"}
                      description={isAr ? "لا توجد فرص تطابق معايير البحث أو تصنيف المرحلة الحالي." : "No opportunities match your current search criteria or stage filter."}
                    />
                  </div>
                ) : (
                  visibleDeals.map((deal) => {
                    const netRevenue = Math.max(0, Number(deal.service_revenue || deal.deal_value || 0));
                    const sponsoring = Number(deal.sponsoring_budget || 0);
                    const comm = Math.round(((netRevenue * initialCommissionRateRule) / 100) * 100) / 100;

                    return (
                      <div
                        key={deal.id}
                        onClick={() => setInspectingDeal(deal)}
                        className="p-4 space-y-3 hover:bg-muted/10 transition-colors cursor-pointer text-start"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-sm text-foreground break-words">
                              {deal.title}
                            </h4>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground">{deal.company_name}</span>
                              {deal.contact_name && <span className="ms-1.5 font-mono text-[11px]">· {deal.contact_name}</span>}
                            </div>
                          </div>
                          <SADABadge variant={STAGE_BADGE_VARIANTS[deal.stage]} size="xs" className="shrink-0">
                            {STAGE_CONFIG[deal.stage].label}
                          </SADABadge>
                        </div>

                        {/* Structured Labeled Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40 font-mono">
                          <div className="p-2 rounded-lg bg-muted/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                              {isAr ? "قيمة الصفقة" : "Deal Value"}
                            </span>
                            <SADANumber value={deal.deal_value} currency="TND" variant="table" className="font-bold text-foreground" />
                          </div>
                          <div className="p-2 rounded-lg bg-muted/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                              {isAr ? "الخاضع للعمولة" : "Commissionable"}
                            </span>
                            <SADANumber value={netRevenue} currency="TND" variant="table" className="font-semibold text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="p-2 rounded-lg bg-muted/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                              {isAr ? "الميزانية الإعلانية" : "Sponsoring"}
                            </span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {sponsoring > 0 ? formatCurrency(sponsoring) : "—"}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                              {isAr ? "العمولة التقديرية" : "Est. Commission"}
                            </span>
                            <SADANumber value={comm} currency="TND" variant="table" className="font-bold text-primary" />
                          </div>
                        </div>

                        {/* Action Row */}
                        <div className="flex items-center justify-between pt-1 text-xs" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {deal.expected_close_date || "—"}
                          </span>
                          {deal.stage !== "won" ? (
                            canConvertLead ? (
                              <SADAButton
                                type="button"
                                size="xs"
                                variant="primary"
                                onClick={() => openConvertToSaleModal(deal)}
                              >
                                <Check className="size-3 me-1" />
                                <span>{isAr ? "تحويل لبيع" : "Convert to Sale"}</span>
                              </SADAButton>
                            ) : null
                          ) : (
                            <SADABadge variant="success" size="xs" dot>
                              {isAr ? "ناجحة" : "Won"}
                            </SADABadge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[10px] border-b border-border">
                    <tr>
                      <th className="py-3 px-4 text-start">{isAr ? "الصفقة / الفرصة" : "Deal / Opportunity"}</th>
                      <th className="py-3 px-4 text-start">{isAr ? "الشركة وجهة الاتصال" : "Company & Contact"}</th>
                      <th className="py-3 px-4 text-start">{isAr ? "المرحلة" : "Stage"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "قيمة الصفقة" : "Deal Value"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "الميزانية الإعلانية" : "Sponsoring"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "الخاضع للعمولة" : "Commissionable"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "العمولة التقديرية" : "Est. Commission"}</th>
                      <th className="py-3 px-4 text-center">{isAr ? "إجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleDeals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6">
                          <SADAEmptyState
                            compact
                            title={isAr ? "لا توجد صفقات" : "No deals found"}
                            description={isAr ? "لا توجد فرص تطابق معايير البحث أو تصنيف المرحلة الحالي." : "No opportunities match your current search criteria or stage filter."}
                          />
                        </td>
                      </tr>
                    ) : (
                      visibleDeals.map((deal) => {
                        const netRevenue = Math.max(0, Number(deal.service_revenue || deal.deal_value || 0));
                        const sponsoring = Number(deal.sponsoring_budget || 0);
                        const comm = Math.round(((netRevenue * initialCommissionRateRule) / 100) * 100) / 100;

                        return (
                          <tr
                            key={deal.id}
                            onClick={() => setInspectingDeal(deal)}
                            className="hover:bg-muted/20 transition-colors cursor-pointer text-start"
                          >
                            <td className="py-3.5 px-4 font-semibold text-foreground">
                              {deal.title}
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground">
                              <div className="text-foreground font-medium">{deal.company_name}</div>
                              <div className="text-[11px] text-muted-foreground">{deal.contact_name} {deal.contact_phone}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <SADABadge variant={STAGE_BADGE_VARIANTS[deal.stage]} size="xs">
                                {STAGE_CONFIG[deal.stage].label}
                              </SADABadge>
                            </td>
                            <td className="py-3.5 px-4 text-end">
                              <SADANumber value={deal.deal_value} currency="TND" variant="table" className="font-bold text-foreground" />
                            </td>
                            <td className="py-3.5 px-4 text-end text-amber-600 dark:text-amber-400">
                              {sponsoring > 0 ? (
                                <SADANumber value={sponsoring} currency="TND" variant="table" />
                              ) : "—"}
                            </td>
                            <td className="py-3.5 px-4 text-end text-emerald-600 dark:text-emerald-400">
                              <SADANumber value={netRevenue} currency="TND" variant="table" className="font-semibold" />
                            </td>
                            <td className="py-3.5 px-4 text-end text-primary">
                              <SADANumber value={comm} currency="TND" variant="table" className="font-bold" />
                            </td>
                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              {deal.stage !== "won" ? (
                                canConvertLead ? (
                                  <SADAButton
                                    type="button"
                                    size="xs"
                                    variant="primary"
                                    onClick={() => openConvertToSaleModal(deal)}
                                  >
                                    <Check className="size-3 me-1" />
                                    <span>{isAr ? "تحويل" : "Convert"}</span>
                                  </SADAButton>
                                ) : null
                              ) : (
                                <SADABadge variant="success" size="xs" dot>
                                  {isAr ? "ناجحة" : "Won"}
                                </SADABadge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SADACard>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: COMMISSIONS & RULES
      ===================================================================== */}
      {activeTab === "commissions" && (
        <div className="space-y-6">
          {/* Super Admin Commission Rules & Policy Banner */}
          {!isWorker && (
            <SADACard className="p-5 border-primary/30 bg-primary/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sliders className="size-4 text-primary" />
                    <h3 className="font-display font-bold text-base text-foreground">
                      {isAr ? "قواعد العمولات القابلة للتهيئة للمشرف العام" : "Super Admin Configurable Commission Rules"}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "معايير عمولات الوكالة المعتمدة والمحفوظة في محرك القواعد البرمجية. التعديلات لا تؤثر على سجلات العمولات التاريخية."
                      : "Canonical agency commission parameters stored in PostgreSQL business rules engine. Changes do not mutate historical snapshots."}
                  </p>
                </div>
                <SADAButton asChild variant="outline" size="sm" className="self-start sm:self-auto shrink-0">
                  <Link to="/admin/business-rules">
                    <span>{isAr ? "تعديل في وحدة قواعد الأعمال" : "Edit in Business Rules Console"}</span>
                    <ArrowUpRight className="size-3.5 ms-1" />
                  </Link>
                </SADAButton>
              </div>

              {/* Rules Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-primary/20">
                <SADACard className="p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{isAr ? "نسبة البيع الأولي" : "Initial Sales Rate"}</span>
                  <div className="text-lg font-bold font-mono text-primary">{initialCommissionRateRule}%</div>
                  <div className="text-[10px] text-muted-foreground">{isAr ? "تستثني ميزانية الإعلانات والتمويل" : "Excludes sponsoring / ad spend"}</div>
                </SADACard>
                <SADACard className="p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{isAr ? "نسبة التجديد" : "Renewal Rate"}</span>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{renewalCommissionRateRule}%</div>
                  <div className="text-[10px] text-muted-foreground">{isAr ? "تطبق بعد انتهاء الفترة الأولية" : "Applied post-initial period"}</div>
                </SADACard>
                <SADACard className="p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{isAr ? "نسبة التوسيع والترقية" : "Upsell Rate"}</span>
                  <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">{upsellCommissionRateRule}%</div>
                  <div className="text-[10px] text-muted-foreground">{isAr ? "تطبق عند توسيع نطاق الخدمات" : "Applied on scope expansion"}</div>
                </SADACard>
              </div>
            </SADACard>
          )}

          {/* Commissions Table */}
          <SADACard className="overflow-hidden space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? (isWorker ? "سجل عمولاتي" : "دفتر عمولات الوكالة") : (isWorker ? "My Commission Records" : "Agency Commission Ledger")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? (isWorker
                        ? "تفصيل العمولات لكل صفقة مكتملة منسوبة لحسابك"
                        : "الالتزامات التجارية الكاملة وحالة صرف العمولات لجميع ممثلي الوكالة")
                    : (isWorker
                        ? "Detailed commission breakdown for each finalized sale attributed to your account"
                        : "Complete commercial commission liability and payout status across all agency representatives")}
                </p>
              </div>
              <SADABadge variant="primary" size="sm">
                {isAr ? `${visibleCommissions.length} سجل` : `${visibleCommissions.length} records`}
              </SADABadge>
            </div>

            {/* Mobile Card List View (< md) */}
            <div className="block md:hidden divide-y divide-border">
              {visibleCommissions.length === 0 ? (
                <div className="p-6">
                  <SADAEmptyState
                    compact
                    title={isAr ? "لا توجد عمولات مسجلة" : "No commissions recorded"}
                    description={isAr ? "لم يتم تسجيل أي عمولات حتى الآن. حقق صفقة ناجحة لإنشاء عمولتك الأولى!" : "No commissions recorded yet. Win a sale to generate your first commission!"}
                  />
                </div>
              ) : (
                visibleCommissions.map((comm) => {
                  const clientName = (comm as any).client?.name || (isAr ? "عميل" : "Client");
                  const dealTitle = (comm as any).deal?.title || (isAr ? "بيع" : "Sale");
                  const repName = (comm as any).team_member?.name || (isAr ? "غير محدد" : "Unassigned");
                  const isPaid = comm.status === "paid";
                  const isApproved = comm.status === "approved";
                  const totalSale = comm.total_sale_amount || (Number(comm.service_revenue) + Number(comm.sponsoring_amount || 0));

                  const statusLabel = isAr ? (
                    comm.status === "paid" ? "مدفوعة" :
                    comm.status === "approved" ? "معتمدة" : "معلقة"
                  ) : comm.status;

                  return (
                    <div key={comm.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors text-start">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-sm text-foreground break-words">{clientName}</h4>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{dealTitle}</div>
                          {!isWorker && (
                            <div className="text-[11px] font-mono text-primary mt-1">
                              {repName}
                            </div>
                          )}
                        </div>
                        <SADABadge
                          variant={isPaid ? "success" : isApproved ? "primary" : "warning"}
                          size="xs"
                          dot
                          className="shrink-0"
                        >
                          {statusLabel}
                        </SADABadge>
                      </div>

                      {/* Structured Labeled Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40 font-mono">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                            {isAr ? "مبلغ البيع" : "Sale Amount"}
                          </span>
                          <SADANumber value={totalSale} currency="TND" variant="table" className="font-bold text-foreground" />
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                            {isAr ? "الخاضع للعمولة" : "Commissionable"}
                          </span>
                          <SADANumber value={comm.service_revenue} currency="TND" variant="table" className="font-semibold text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                            {isAr ? "نسبة العمولة" : "Rate"}
                          </span>
                          <span className="font-bold text-foreground">
                            {comm.commission_rate || 15}%
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                            {isAr ? "العمولة المستحقة" : "Commission"}
                          </span>
                          <SADANumber value={comm.commission_amount} currency="TND" variant="table" className="font-bold text-primary" />
                        </div>
                      </div>

                      {/* Bottom row: Package + Action */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {comm.package_name || (isAr ? "باقة نمو" : "Growth Retainer")}
                        </span>

                        {!isWorker && (
                          <div className="shrink-0">
                            {comm.status === "pending" && (
                              (() => {
                                const isSelf = !isSuperAdmin && (
                                  (myMember?.id && comm.team_member_id === myMember.id) ||
                                  ((comm as any).deal?.sales_owner_id === user?.id)
                                );

                                if (isSelf) {
                                  return (
                                    <SADABadge variant="neutral" size="xs">
                                      {isAr ? "انتظار المشرف" : "Awaiting Admin"}
                                    </SADABadge>
                                  );
                                }

                                return (
                                  <SADAButton
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={async () => {
                                      const res = await approveCommission(comm.id, {
                                        ctx: permCtx,
                                        actorRole: role || "admin",
                                        actorId: user?.id,
                                      });
                                      if (!res.success) {
                                        toast.error(res.error || "Failed to approve commission");
                                      } else {
                                        toast.success(isAr ? "تم اعتماد العمولة بنجاح!" : "Commission approved successfully!");
                                        loadSalesData(true);
                                      }
                                    }}
                                  >
                                    <ShieldCheck className="size-3 me-1 text-primary" />
                                    <span>{isAr ? "اعتماد" : "Approve"}</span>
                                  </SADAButton>
                                );
                              })()
                            )}
                            {comm.status === "approved" && (
                              <SADAButton
                                type="button"
                                size="xs"
                                variant="primary"
                                onClick={async () => {
                                  const res = await payoutCommission(comm.id, {
                                    ctx: permCtx,
                                    actorRole: role || "admin",
                                    actorId: user?.id,
                                  });
                                  if (!res.success) {
                                    toast.error(res.error || "Failed to disburse commission");
                                  } else {
                                    toast.success(isAr ? "تم تسجيل صرف العمولة كمدفوعة!" : "Commission recorded as disbursed/paid!");
                                    loadSalesData(true);
                                  }
                                }}
                              >
                                <Wallet className="size-3 me-1" />
                                <span>{isAr ? "تسجيل كمدفوعة" : "Mark Paid"}</span>
                              </SADAButton>
                            )}
                            {comm.status === "paid" && (
                              <SADABadge variant="success" size="xs">
                                {isAr ? "مكتمل الصرف" : "Disbursed"}
                              </SADABadge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[10px] border-b border-border">
                  <tr>
                    <th className="py-3 px-3 text-start">{isAr ? "العميل والصفقة" : "Client & Deal"}</th>
                    {!isWorker && <th className="py-3 px-3 text-start">{isAr ? "ممثل المبيعات" : "Sales Representative"}</th>}
                    <th className="py-3 px-3 text-start">{isAr ? "الباقة" : "Package"}</th>
                    <th className="py-3 px-3 text-end">{isAr ? "مبلغ البيع" : "Sale Amount"}</th>
                    <th className="py-3 px-3 text-end">{isAr ? "الإعلانات" : "Sponsoring"}</th>
                    <th className="py-3 px-3 text-end">{isAr ? "الخاضع للعمولة" : "Commissionable"}</th>
                    <th className="py-3 px-3 text-center">{isAr ? "النسبة" : "Rate"}</th>
                    <th className="py-3 px-3 text-end">{isAr ? "العمولة" : "Commission"}</th>
                    <th className="py-3 px-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-3 px-3 text-end">{isAr ? "الفترة" : "Period"}</th>
                    {!isWorker && <th className="py-3 px-3 text-center">{isAr ? "إدارة" : "Manage"}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={isWorker ? 9 : 11} className="p-6">
                        <SADAEmptyState
                          compact
                          title={isAr ? "لا توجد عمولات مسجلة" : "No commissions recorded"}
                          description={isAr ? "لم يتم تسجيل أي عمولات حتى الآن. حقق صفقة ناجحة لإنشاء عمولتك الأولى!" : "No commissions recorded yet. Win a sale to generate your first commission!"}
                        />
                      </td>
                    </tr>
                  ) : (
                    visibleCommissions.map((comm) => {
                      const clientName = (comm as any).client?.name || (isAr ? "عميل" : "Client");
                      const dealTitle = (comm as any).deal?.title || (isAr ? "بيع" : "Sale");
                      const repName = (comm as any).team_member?.name || (isAr ? "غير محدد" : "Unassigned");
                      const repEmail = (comm as any).team_member?.email || "";
                      const isPaid = comm.status === "paid";
                      const isApproved = comm.status === "approved";
                      const totalSale = comm.total_sale_amount || (Number(comm.service_revenue) + Number(comm.sponsoring_amount || 0));

                      const statusLabel = isAr ? (
                        comm.status === "paid" ? "مدفوعة" :
                        comm.status === "approved" ? "معتمدة" : "معلقة"
                      ) : comm.status;

                      return (
                        <tr key={comm.id} className="hover:bg-muted/20 transition-colors text-start">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-foreground">{clientName}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{dealTitle}</div>
                          </td>
                          {!isWorker && (
                            <td className="py-3 px-3">
                              <div className="font-medium text-foreground">{repName}</div>
                              {repEmail && (
                                <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">{repEmail}</div>
                              )}
                            </td>
                          )}
                          <td className="py-3 px-3 text-muted-foreground">
                            {comm.package_name || (isAr ? "باقة نمو" : "Growth Retainer")}
                          </td>
                          <td className="py-3 px-3 text-end">
                            <SADANumber value={totalSale} currency="TND" variant="table" className="font-bold text-foreground" />
                          </td>
                          <td className="py-3 px-3 text-end text-amber-600 dark:text-amber-400">
                            {comm.sponsoring_amount ? (
                              <SADANumber value={comm.sponsoring_amount} currency="TND" variant="table" />
                            ) : "—"}
                          </td>
                          <td className="py-3 px-3 text-end text-emerald-600 dark:text-emerald-400">
                            <SADANumber value={comm.service_revenue} currency="TND" variant="table" className="font-semibold" />
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                            {comm.commission_rate || 15}%
                          </td>
                          <td className="py-3 px-3 text-end text-primary">
                            <SADANumber value={comm.commission_amount} currency="TND" variant="table" className="font-bold" />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <SADABadge
                              variant={isPaid ? "success" : isApproved ? "primary" : "warning"}
                              size="xs"
                              dot
                            >
                              {statusLabel}
                            </SADABadge>
                          </td>
                          <td className="py-3 px-3 text-end font-mono text-muted-foreground">
                            {comm.period_month || (isAr ? "الحالي" : "Current")}
                          </td>
                          {!isWorker && (
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {comm.status === "pending" && (
                                (() => {
                                  const isSelf = !isSuperAdmin && (
                                    (myMember?.id && comm.team_member_id === myMember.id) ||
                                    ((comm as any).deal?.sales_owner_id === user?.id)
                                  );

                                  if (isSelf) {
                                    return (
                                      <SADABadge variant="neutral" size="xs" title={isAr ? "لا يمكنك اعتماد عمولتك الخاصة" : "Self-approval restricted"}>
                                        {isAr ? "انتظار المشرف" : "Awaiting Admin"}
                                      </SADABadge>
                                    );
                                  }

                                  return (
                                    <SADAButton
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      onClick={async () => {
                                        const res = await approveCommission(comm.id, {
                                          ctx: permCtx,
                                          actorRole: role || "admin",
                                          actorId: user?.id,
                                        });
                                        if (!res.success) {
                                          toast.error(res.error || "Failed to approve commission");
                                        } else {
                                          toast.success(isAr ? "تم اعتماد العمولة بنجاح!" : "Commission approved successfully!");
                                          loadSalesData(true);
                                        }
                                      }}
                                    >
                                      <ShieldCheck className="size-3 me-1 text-primary" />
                                      <span>{isAr ? "اعتماد" : "Approve"}</span>
                                    </SADAButton>
                                  );
                                })()
                              )}
                              {comm.status === "approved" && (
                                <SADAButton
                                  type="button"
                                  size="xs"
                                  variant="primary"
                                  onClick={async () => {
                                    const res = await payoutCommission(comm.id, {
                                      ctx: permCtx,
                                      actorRole: role || "admin",
                                      actorId: user?.id,
                                    });
                                    if (!res.success) {
                                      toast.error(res.error || "Failed to disburse commission");
                                    } else {
                                      toast.success(isAr ? "تم تسجيل صرف العمولة كمدفوعة!" : "Commission recorded as disbursed/paid!");
                                      loadSalesData(true);
                                    }
                                  }}
                                >
                                  <Wallet className="size-3 me-1" />
                                  <span>{isAr ? "تسجيل كمدفوعة" : "Mark Paid"}</span>
                                </SADAButton>
                              )}
                              {comm.status === "paid" && (
                                <SADABadge variant="success" size="xs">
                                  {isAr ? "مكتمل الصرف" : "Disbursed"}
                                </SADABadge>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SADACard>
        </div>
      )}

      {/* =====================================================================
          TAB 3: WORKER PERFORMANCE MATRIX (ADMIN ONLY)
      ===================================================================== */}
      {activeTab === "performance" && !isWorker && (
        <SADACard className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-base text-foreground">
                {isAr ? "مصفوفة أداء الفريق التجاري" : "Commercial Team Performance Matrix"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "النسب المباشر لصفقات المبيعات، العقود المغلقة، حجم العوائد، ومطالبات العمولات لكل ممثل."
                  : "Direct attribution of sales leads, won contracts, revenue volume, and commission claims per representative."}
              </p>
            </div>

            {/* Performance Controls: Search & Active Filter Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-56">
                <SADASearch
                  size="compact"
                  placeholder={isAr ? "بحث بالاسم أو البريد..." : "Search rep name, email..."}
                  value={perfSearchQuery}
                  onChange={setPerfSearchQuery}
                  onClear={() => setPerfSearchQuery("")}
                />
              </div>
              <SADAButton
                size="xs"
                variant={onlyActiveSalesReps ? "secondary" : "outline"}
                onClick={() => setOnlyActiveSalesReps(!onlyActiveSalesReps)}
              >
                <Filter className="size-3 me-1" />
                <span>
                  {onlyActiveSalesReps
                    ? (isAr ? "النشطون تجارياً فقط" : "Active Reps Only")
                    : (isAr ? "جميع الأعضاء" : "All Members")}
                </span>
                <SADABadge variant="neutral" size="xs" className="ms-1">
                  {filteredPerformanceMembers.length}
                </SADABadge>
              </SADAButton>
            </div>
          </div>

          {filteredPerformanceMembers.length === 0 ? (
            <div className="py-8">
              <SADAEmptyState
                compact
                title={isAr ? "لا توجد نتائج" : "No representatives found"}
                description={isAr ? "لا يوجد ممثلون يطابقون معايير البحث المحددة." : "No team members match your current search or filter."}
              />
            </div>
          ) : (
            <>
              {/* Mobile Card List View (< md) */}
              <div className="block md:hidden divide-y divide-border">
                {filteredPerformanceMembers.map(({ member, memberDeals, won, active, pipeVal, wonRev, winRate, commsTotal }) => (
                  <div key={member.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors text-start">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm text-foreground">{member.name}</h4>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">{member.email}</div>
                      </div>
                      <SADABadge variant="neutral" size="xs">
                        {member.role}
                      </SADABadge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 border-y border-border/40 font-mono">
                      <div className="p-1.5 rounded-lg bg-muted/30">
                        <span className="text-[9px] text-muted-foreground uppercase block font-sans">
                          {isAr ? "إجمالي" : "Leads"}
                        </span>
                        <span className="font-bold text-foreground">{memberDeals.length}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-muted/30">
                        <span className="text-[9px] text-muted-foreground uppercase block font-sans">
                          {isAr ? "ناجحة" : "Won"}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{won.length}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-muted/30">
                        <span className="text-[9px] text-muted-foreground uppercase block font-sans">
                          {isAr ? "نسبة النجاح" : "Win Rate"}
                        </span>
                        <span className="font-bold text-foreground">
                          <SADANumber value={winRate} variant="percent" decimals={0} />
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-muted/30">
                        <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                          {isAr ? "قيمة الخط" : "Pipeline"}
                        </span>
                        <SADANumber value={pipeVal} currency="TND" variant="table" className="font-semibold text-foreground" />
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                          {isAr ? "العوائد المحققة" : "Won Rev"}
                        </span>
                        <SADANumber value={wonRev} currency="TND" variant="table" className="font-bold text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                          {isAr ? "العمولات" : "Comms"}
                        </span>
                        <SADANumber value={commsTotal} currency="TND" variant="table" className="font-bold text-primary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[10px] border-b border-border">
                    <tr>
                      <th className="py-3 px-4 text-start">{isAr ? "ممثل المبيعات" : "Sales Representative"}</th>
                      <th className="py-3 px-4 text-center">{isAr ? "الدور" : "Role"}</th>
                      <th className="py-3 px-4 text-center">{isAr ? "إجمالي الصفقات" : "Total Leads"}</th>
                      <th className="py-3 px-4 text-center">{isAr ? "الصفقات الناجحة" : "Won Sales"}</th>
                      <th className="py-3 px-4 text-center">{isAr ? "معدل الإغلاق" : "Win Rate"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "قيمة الخط" : "Pipeline Value"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "العوائد المحققة" : "Won Revenue"}</th>
                      <th className="py-3 px-4 text-end">{isAr ? "العمولات المستحقة" : "Commissions Claimed"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPerformanceMembers.map(({ member, memberDeals, won, active, pipeVal, wonRev, winRate, commsTotal }) => (
                      <tr key={member.id} className="hover:bg-muted/20 transition-colors text-start">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {member.name}
                          <div className="text-[10px] font-mono text-muted-foreground">{member.email}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <SADABadge variant="neutral" size="xs">
                            {member.role}
                          </SADABadge>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-foreground">
                          {memberDeals.length}
                        </td>
                        <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">
                          <span className="font-mono font-bold">{won.length}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <SADANumber value={winRate} variant="percent" decimals={0} />
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          <SADANumber value={pipeVal} currency="TND" variant="table" className="font-semibold text-foreground" />
                        </td>
                        <td className="py-3.5 px-4 text-end text-emerald-600 dark:text-emerald-400">
                          <SADANumber value={wonRev} currency="TND" variant="table" className="font-bold" />
                        </td>
                        <td className="py-3.5 px-4 text-end text-primary">
                          <SADANumber value={commsTotal} currency="TND" variant="table" className="font-bold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SADACard>
      )}

      {/* =====================================================================
          MODAL: CREATE LEAD (MY LEADS - PHASE 3B)
      ===================================================================== */}
      {showCreateLeadModal && (
        <SADADialog
          open={showCreateLeadModal}
          onOpenChange={setShowCreateLeadModal}
          title={isAr ? "إنشاء صفقة وفرصة تجارية جديدة" : "Create New Lead & Opportunity"}
          description={isAr ? "تسجيل استفسار تجاري جديد، عميل محتمل، أو فرصة عقد منسوبة لك." : "Record a new commercial inquiry, prospect, or retainer opportunity assigned to you."}
          size="large"
        >
          <form onSubmit={handleCreateLead} className="space-y-4 pt-2 text-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <SADAInput
                label={isAr ? "عنوان الصفقة / الفرصة *" : "Deal / Opportunity Title *"}
                placeholder="e.g. Dar Ben Gacem — Retainer"
                value={leadTitle}
                onChange={(e) => setLeadTitle(e.target.value)}
                required
              />
              <SADAInput
                label={isAr ? "اسم الشركة / العلامة التجارية *" : "Company / Brand Name *"}
                placeholder="e.g. Dar Ben Gacem"
                value={leadCompany}
                onChange={(e) => setLeadCompany(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <SADAInput
                label={isAr ? "اسم جهة الاتصال" : "Contact Name"}
                placeholder="e.g. Leila Ben Gacem"
                value={leadContactName}
                onChange={(e) => setLeadContactName(e.target.value)}
              />
              <SADAInput
                label={isAr ? "البريد الإلكتروني" : "Contact Email"}
                placeholder="leila@darbengacem.com"
                type="email"
                dir="ltr"
                value={leadContactEmail}
                onChange={(e) => setLeadContactEmail(e.target.value)}
              />
              <SADAInput
                label={isAr ? "رقم الهاتف" : "Contact Phone"}
                placeholder="+216 71 200 300"
                dir="ltr"
                value={leadContactPhone}
                onChange={(e) => setLeadContactPhone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "الباقة المهتم بها" : "Interested Package"}</label>
                <SADASelect
                  value={leadPackageId}
                  onChange={(pId) => {
                    setLeadPackageId(pId);
                    const sel = packages.find(p => p.id === pId);
                    if (sel) setLeadEstimatedValue(sel.selling_price);
                  }}
                  options={packageOptions}
                  placeholder={isAr ? "اختر الباقة..." : "Select package..."}
                />
              </div>

              <SADAInput
                label={isAr ? "القيمة التقديرية (د.ت)" : "Estimated Value (TND)"}
                type="number"
                value={leadEstimatedValue}
                onChange={(e) => setLeadEstimatedValue(Number(e.target.value))}
              />

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "مرحلة خط الصفقات" : "Pipeline Stage"}</label>
                <SADASelect
                  value={leadStage}
                  onChange={(s) => setLeadStage(s as DealStage)}
                  options={stageLeadCreateOptions}
                  placeholder={isAr ? "اختر المرحلة..." : "Select stage..."}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {!isWorker && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{isAr ? "مسؤول المبيعات المعين" : "Assigned Sales Representative"}</label>
                  <SADASelect
                    value={leadSalesOwnerId}
                    onChange={setLeadSalesOwnerId}
                    options={salesAssigneeOptions}
                    placeholder={isAr ? "اختر ممثل المبيعات..." : "Select representative..."}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "تاريخ الإغلاق المتوقع" : "Expected Close Date"}</label>
                <SADADatePicker
                  value={leadCloseDate}
                  onChange={setLeadCloseDate}
                  placeholder={isAr ? "اختر التاريخ المتوقع..." : "Pick expected close date..."}
                />
              </div>
            </div>

            <SADATextarea
              label={isAr ? "ملاحظات الفرصة والإجراء القادم للمتابعة" : "Opportunity Notes & Next Follow-up Action"}
              placeholder={isAr ? "سجل متطلبات العميل، مكالمة المتابعة القادمة، والخدمات الخاصة التي نوقشت..." : "Record client requirements, next follow-up call, and specific services discussed..."}
              value={leadNotes}
              onChange={(e) => setLeadNotes(e.target.value)}
              rows={3}
            />

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
                <span>{isAr ? "يتم تعيين مسؤول المبيعات تلقائياً لحسابك" : "Salesperson automatically assigned to your account"}</span>
              </div>

              <div className="flex items-center gap-2">
                <SADAButton
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateLeadModal(false)}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </SADAButton>
                <SADAButton
                  type="submit"
                  variant="primary"
                  isLoading={creatingLead}
                >
                  {isAr ? "حفظ الصفقة" : "Save Lead"}
                </SADAButton>
              </div>
            </div>
          </form>
        </SADADialog>
      )}

      {/* =====================================================================
          MODAL: CONVERT LEAD TO SALE (CREATE SALE - PHASE 3C & PHASE 4)
      ===================================================================== */}
      {convertingDeal && (
        <SADADialog
          open={Boolean(convertingDeal)}
          onOpenChange={(open) => !open && setConvertingDeal(null)}
          title={isAr ? "تحويل الصفقة إلى بيع ناجح" : "Convert Lead to Finalized Sale"}
          description={
            isAr
              ? `إتمام البيع لصفقة "${convertingDeal.title}". يتم احتساب العمولة باستثناء ميزانية الإعلانات مع حفظ لقطة تاريخية.`
              : `Finalize sale for "${convertingDeal.title}". Calculates commission excluding sponsoring budget with historical snapshot.`
          }
          size="large"
        >
          <form onSubmit={handleConvertToSale} className="space-y-4 pt-2 text-start">
            {/* Client Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  {isAr ? "اختر عميل صدى *" : "Select SADA Client *"}
                </label>
                {saleClientError && (
                  <span className="text-[11px] font-medium text-destructive animate-pulse">
                    {isAr ? "مطلوب لاحتساب العمولة" : "Required for commission"}
                  </span>
                )}
              </div>
              <SADASelect
                id="sale-client-select"
                name="clientId"
                value={saleClientId}
                onChange={(val) => {
                  setSaleClientId(val);
                  if (val) setSaleClientError(false);
                }}
                options={clientOptions}
                placeholder={isAr ? "اختر العميل..." : "Select client..."}
                error={saleClientError}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "يجب ربط الصفقة بسجل عميل معتمد في النظام لحفظ العمولة وإنشاء السجلات المالية."
                  : "Lead must be anchored to an authoritative client record to link commissions and financial tracking."}
              </p>
            </div>

            {/* Package Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{isAr ? "الباقة / نطاق التسليمات" : "Package / Deliverable Scope"}</label>
              <SADASelect
                value={salePackageId}
                onChange={(pId) => {
                  setSalePackageId(pId);
                  const sel = packages.find(p => p.id === pId);
                  if (sel) setSaleTotalAmount(sel.selling_price);
                }}
                options={packageOptions}
                placeholder={isAr ? "اختر النطاق / الباقة..." : "Select scope/package..."}
              />
            </div>

            {/* Financial Amounts: Sale Amount vs Sponsoring Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <SADAInput
                label={isAr ? "إجمالي قيمة البيع (د.ت) *" : "Total Sale Amount (TND) *"}
                type="number"
                value={saleTotalAmount}
                onChange={(e) => setSaleTotalAmount(Number(e.target.value))}
                required
              />
              <SADAInput
                label={isAr ? "ميزانية الإعلانات والتمويل (د.ت)" : "Sponsoring / Ad Spend Amount (TND)"}
                type="number"
                value={saleSponsoringAmount}
                onChange={(e) => setSaleSponsoringAmount(Number(e.target.value))}
              />
            </div>

            {/* Live Commission Calculation Box */}
            <SADACard className="p-4 border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{isAr ? "القيمة الصافية الخاضعة للعمولة (المبلغ - الإعلانات):" : "Net Commissionable Amount (Sale - Sponsoring):"}</span>
                <SADANumber
                  value={Math.max(0, saleTotalAmount - saleSponsoringAmount)}
                  currency="TND"
                  variant="table"
                  className="font-bold text-foreground"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{isAr ? "النسبة الأولية المعتمدة:" : "Configured Initial Rate:"}</span>
                <span className="font-mono font-bold text-foreground">{initialCommissionRateRule}%</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-primary/20">
                <span className="font-semibold text-primary">{isAr ? "العمولة المحتسبة:" : "Calculated Commission:"}</span>
                <SADANumber
                  value={((Math.max(0, saleTotalAmount - saleSponsoringAmount) * initialCommissionRateRule) / 100)}
                  currency="TND"
                  variant="metric"
                  className="font-bold text-sm text-primary"
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                {isAr
                  ? `قاعدة: ميزانية الإعلانات (${saleSponsoringAmount} د.ت) مستثناة كلياً من احتساب العمولة.`
                  : `Rule: Sponsoring budget (${saleSponsoringAmount} TND) is strictly excluded from commission calculation.`}
              </p>
            </SADACard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "حالة الدفع" : "Payment Status"}</label>
                <SADASelect
                  value={salePaymentStatus}
                  onChange={(s) => setSalePaymentStatus(s as any)}
                  options={paymentStatusOptions}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "تاريخ البيع" : "Sale Date"}</label>
                <SADADatePicker
                  value={saleDate}
                  onChange={setSaleDate}
                  placeholder={isAr ? "اختر تاريخ البيع..." : "Select sale date..."}
                />
              </div>
            </div>

            <SADATextarea
              label={isAr ? "ملاحظات البيع النهائي / مرجع العقد" : "Final Sale Notes / Contract Reference"}
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              rows={2}
            />

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-[11px] text-muted-foreground">
                {isAr ? "المنفّذ:" : "Worker:"} <strong dir="ltr">{user?.email}</strong>
              </div>

              <div className="flex items-center gap-2">
                <SADAButton
                  type="button"
                  variant="outline"
                  onClick={() => setConvertingDeal(null)}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </SADAButton>
                <SADAButton
                  type="submit"
                  variant="primary"
                  isLoading={converting}
                >
                  {isAr ? "تأكيد البيع الناجح" : "Finalize Won Sale"}
                </SADAButton>
              </div>
            </div>
          </form>
        </SADADialog>
      )}

      {/* =====================================================================
          MODAL: VIEW OR EDIT DEAL DETAILS
      ===================================================================== */}
      {inspectingDeal && (
        <SADADialog
          open={Boolean(inspectingDeal)}
          onOpenChange={(open) => {
            if (!open) {
              setInspectingDeal(null);
              setIsEditingDeal(false);
            }
          }}
          title={isEditingDeal ? (isAr ? "تعديل بيانات الصفقة" : "Edit Deal Details") : inspectingDeal.title}
          description={
            isEditingDeal
              ? (isAr ? "تعديل تفاصيل الصفقة وجهة الاتصال والميزانية." : "Update deal scope, contact details, and financial parameters.")
              : `${inspectingDeal.company_name} · ${STAGE_CONFIG[inspectingDeal.stage]?.label || inspectingDeal.stage}`
          }
          size={isEditingDeal ? "large" : "standard"}
        >
          {isEditingDeal ? (
            <form onSubmit={handleSaveDealEdit} className="space-y-4 pt-2 text-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <SADAInput
                  label={isAr ? "عنوان الصفقة / الفرصة *" : "Deal / Opportunity Title *"}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
                <SADAInput
                  label={isAr ? "اسم الشركة / العلامة التجارية *" : "Company / Brand Name *"}
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <SADAInput
                  label={isAr ? "اسم جهة الاتصال" : "Contact Name"}
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                />
                <SADAInput
                  label={isAr ? "البريد الإلكتروني" : "Contact Email"}
                  type="email"
                  dir="ltr"
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
                />
                <SADAInput
                  label={isAr ? "رقم الهاتف" : "Contact Phone"}
                  dir="ltr"
                  value={editContactPhone}
                  onChange={(e) => setEditContactPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{isAr ? "الباقة المرتبطة" : "Associated Package"}</label>
                  <SADASelect
                    value={editPackageId}
                    onChange={(pId) => {
                      setEditPackageId(pId);
                      const sel = packages.find(p => p.id === pId);
                      if (sel && editDealValue === 0) setEditDealValue(sel.selling_price);
                    }}
                    options={packageOptions}
                    placeholder={isAr ? "اختر الباقة..." : "Select package..."}
                  />
                </div>

                <SADAInput
                  label={isAr ? "قيمة الصفقة الإجمالية (د.ت)" : "Total Deal Value (TND)"}
                  type="number"
                  value={editDealValue}
                  onChange={(e) => setEditDealValue(Number(e.target.value))}
                />

                <SADAInput
                  label={isAr ? "ميزانية الإعلانات (د.ت)" : "Sponsoring Budget (TND)"}
                  type="number"
                  value={editSponsoringBudget}
                  onChange={(e) => setEditSponsoringBudget(Number(e.target.value))}
                />
              </div>

            <div className={cn("grid gap-3.5", !isWorker ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "مرحلة خط الصفقات" : "Pipeline Stage"}</label>
                <SADASelect
                  value={editStage}
                  onChange={(s) => setEditStage(s as DealStage)}
                  options={stageEditOptions}
                  placeholder={isAr ? "اختر المرحلة..." : "Select stage..."}
                />
              </div>

              {!isWorker && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{isAr ? "مسؤول المبيعات المعين" : "Assigned Sales Representative"}</label>
                  <SADASelect
                    value={editSalesOwnerId}
                    onChange={setEditSalesOwnerId}
                    options={salesAssigneeOptions}
                    placeholder={isAr ? "اختر ممثل المبيعات..." : "Select representative..."}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{isAr ? "تاريخ الإغلاق المتوقع" : "Expected Close Date"}</label>
                <SADADatePicker
                  value={editCloseDate}
                  onChange={setEditCloseDate}
                  placeholder={isAr ? "اختر التاريخ المتوقع..." : "Pick expected close date..."}
                />
              </div>
            </div>

              <SADATextarea
                label={isAr ? "الملاحظات" : "Notes"}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <SADAButton
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingDeal(false)}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </SADAButton>
                <SADAButton
                  type="submit"
                  variant="primary"
                  isLoading={savingEdit}
                >
                  {isAr ? "حفظ التغييرات" : "Save Changes"}
                </SADAButton>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-2 text-start">
              {/* Deal Stage Banner & Quick Transition Dropdown */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{isAr ? "المرحلة الحالية:" : "Current Stage:"}</span>
                  <SADABadge variant={STAGE_BADGE_VARIANTS[inspectingDeal.stage]} size="xs">
                    {STAGE_CONFIG[inspectingDeal.stage]?.label || inspectingDeal.stage}
                  </SADABadge>
                </div>
                {canChangeStage && inspectingDeal.stage !== "won" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-primary font-medium flex items-center gap-1.5 hover:underline py-1 px-2 rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        <ArrowRightLeft className="size-3.5" />
                        <span>{isAr ? "نقل إلى مرحلة أخرى" : "Change Stage"}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-popover/95 backdrop-blur-md border-border shadow-xl">
                      <div className="px-2 py-1.5 text-[10px] font-mono uppercase text-muted-foreground">
                        {isAr ? "نقل إلى مرحلة" : "Move to Stage"}
                      </div>
                      {STAGE_ORDER.filter(s => s !== inspectingDeal.stage).map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={async () => {
                            await executeStageTransition(inspectingDeal.id, s);
                            setInspectingDeal(prev => prev ? { ...prev, stage: s } : null);
                          }}
                          className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", STAGE_CONFIG[s].color.replace("text-", "bg-"))} />
                            <span>{STAGE_CONFIG[s].label}</span>
                          </div>
                          {s === "won" && <Sparkles className="size-3 text-emerald-500" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-mono uppercase">{isAr ? "قيمة الصفقة" : "Deal Value"}</span>
                  <SADANumber value={inspectingDeal.deal_value} currency="TND" variant="metric" className="font-bold text-foreground text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-mono uppercase">{isAr ? "ميزانية الإعلانات" : "Sponsoring Budget"}</span>
                  <div className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                    {inspectingDeal.sponsoring_budget ? (
                      <SADANumber value={inspectingDeal.sponsoring_budget} currency="TND" variant="metric" />
                    ) : "0 TND"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-mono uppercase">{isAr ? "جهة الاتصال" : "Contact"}</span>
                  <span className="text-foreground font-medium">{inspectingDeal.contact_name || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-mono uppercase">{isAr ? "البريد / الهاتف" : "Email / Phone"}</span>
                  <span className="text-foreground font-medium" dir="ltr">{inspectingDeal.contact_email || inspectingDeal.contact_phone || "—"}</span>
                </div>
              </div>

              {/* Commission Snapshot If Won */}
              {(inspectingDeal as any).commission_rule_snapshot && (
                <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/5 space-y-1.5 text-xs">
                  <SADABadge variant="primary" size="xs">
                    {isAr ? "لقطة العمولة التاريخية" : "Historical Commission Snapshot"}
                  </SADABadge>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>{isAr ? "القاعدة:" : "Rule:"} {(inspectingDeal as any).commission_rule_snapshot.rule_name}</div>
                    <div>{isAr ? "النسبة:" : "Rate:"} {(inspectingDeal as any).commission_rule_snapshot.rate_percent || (inspectingDeal as any).commission_rule_snapshot.commission_rate}%</div>
                    <div>
                      {isAr ? "الخاضع للعمولة:" : "Commissionable:"} <SADANumber value={(inspectingDeal as any).commission_rule_snapshot.commissionable_amount} currency="TND" />
                    </div>
                    <div className="font-bold text-primary">
                      {isAr ? "العمولة:" : "Commission:"} <SADANumber value={(inspectingDeal as any).commission_rule_snapshot.calculated_commission} currency="TND" />
                    </div>
                  </div>
                </div>
              )}

              {inspectingDeal.notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">{isAr ? "ملاحظات" : "Notes"}</span>
                  <p className="text-xs text-foreground bg-muted/20 p-3 rounded-xl border border-border italic whitespace-pre-wrap" dir="auto">
                    "{inspectingDeal.notes}"
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {canEditLead && (
                    <SADAButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEditingDeal(inspectingDeal)}
                    >
                      <Edit3 className="size-3.5 me-1" />
                      <span>{isAr ? "تعديل الصفقة" : "Edit Deal"}</span>
                    </SADAButton>
                  )}

                  {canDeleteLead && (
                    <SADAButton
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDealToDelete(inspectingDeal)}
                    >
                      <Trash2 className="size-3.5 me-1" />
                      <span>{isAr ? "حذف نهائي" : "Delete"}</span>
                    </SADAButton>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {inspectingDeal.stage !== "won" ? (
                    canConvertLead && (
                      <SADAButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const d = inspectingDeal;
                          setInspectingDeal(null);
                          openConvertToSaleModal(d);
                        }}
                      >
                        <Check className="size-3.5 me-1" />
                        <span>{isAr ? "تحويل إلى بيع" : "Convert to Sale"}</span>
                      </SADAButton>
                    )
                  ) : (
                    <SADABadge variant="success" size="sm" dot>
                      {isAr ? "صفقة مكتملة وناجحة" : "Won Sale Finalized"}
                    </SADABadge>
                  )}

                  <SADAButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInspectingDeal(null)}
                  >
                    {isAr ? "إغلاق" : "Close"}
                  </SADAButton>
                </div>
              </div>
            </div>
          )}
        </SADADialog>
      )}

      {/* =====================================================================
          DIALOG: PERMANENT DELETE DEAL CONFIRMATION (sales.delete_lead)
      ===================================================================== */}
      {dealToDelete && (
        <SADAConfirmDialog
          open={Boolean(dealToDelete)}
          onOpenChange={(open) => !open && setDealToDelete(null)}
          title={isAr ? "تأكيد حذف الصفقة نهائياً" : "Confirm Permanent Deal Deletion"}
          description={
            isAr
              ? `هل أنت متأكد من حذف صفقة "${dealToDelete.title}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وهو مخصص لمدير النظام الأعلى فقط.`
              : `Are you sure you want to permanently delete "${dealToDelete.title}"? This action is irreversible and strictly exclusive to Super Admin.`
          }
          confirmLabel={isAr ? "حذف نهائي" : "Delete Permanently"}
          cancelLabel={isAr ? "إلغاء" : "Cancel"}
          variant="danger"
          isLoading={deletingDeal}
          onConfirm={handleDeleteDeal}
        />
      )}
    </div>
  );
}
