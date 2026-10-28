import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Building2, Plus, Search, Filter, Phone, Mail, MessageSquare,
  ExternalLink, ArrowUpRight, Calendar, User, Briefcase, Sparkles,
  ShieldCheck, Check, X, AlertCircle, Clock, CheckCircle2,
  Repeat, Zap, ArrowRight, Layers, Award, ChevronRight,
  DollarSign, Table as TableIcon, LayoutGrid, TrendingUp, Coins,
  Archive, RotateCcw, Trash2, MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  type ClientRow,
  type ClientStatus,
  type ClientType,
  type PackageConfig,
  CLIENT_STATUS_CONFIG,
  type ProfileRow,
  type TeamMemberRow,
  type ProjectRow,
  type TaskRow,
  computeMonthlyProgress,
  formatPeriodMonth,
  getCurrentPeriodMonth,
  normalizeEmail,
  normalizePhone,
  resolveToProfileId,
  resolveToTeamMemberId,
  formatClientErrorMessage
} from "@/components/admin/project-utils";
import { permissions, normalizeRole } from "@/lib/permissions";
import { format, parseISO } from "date-fns";
import { SADASelect } from "@/components/ui/sada-select";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADACounter, SADAInput, ClientDirectorySkeleton } from "@/components/ui/sada-ui";
import { fetchPackageCatalog } from "@/lib/package-service";
import { reconcileClientPackageWork } from "@/lib/package-reconciliation-service";
import type { PackageCatalogItem } from "@/types/package-catalog";
import { formatCurrency, type ClientProfitabilityHealth } from "@/types/finance";
import { calculateClientFinancials } from "@/lib/finance-service";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";
import { useTranslation } from "@/i18n";
import { DeleteClientDialog } from "@/components/admin/DeleteClientDialog";
import { ArchiveClientDialog } from "@/components/admin/ArchiveClientDialog";

export const Route = createFileRoute("/admin/client-workspaces/")({
  component: ClientsOperationsHub,
});

interface ClientWithOps extends ClientRow {
  tasks: TaskRow[];
  projects: ProjectRow[];
  workspaceCount: number;
  primaryWorkspace: ProjectRow | null;
  monthlyProgress?: ReturnType<typeof computeMonthlyProgress>;
  oneOffTask?: TaskRow;
  monthlyRevenue: number;
  sponsoringBudget: number;
  paymentStatus: "PAID" | "PENDING" | "OVERDUE";
  clientHealth: ClientProfitabilityHealth;
  accountManagerName: string;
  salesOwnerName: string;
}

export function ClientsOperationsHub() {
  const { user, role, isSuperAdmin, isAdmin } = useAuth();
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const nav = useNavigate();
  const canViewFinance = isSuperAdmin || isAdmin;
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canCreate = permissions.canCreateClient(permCtx);
  const canDelete = isSuperAdmin;
  const canArchive = isSuperAdmin || isAdmin;

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sponsoring, setSponsoring] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "monthly" | "one_off" | "archived">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Lifecycle Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetClientForDelete, setTargetClientForDelete] = useState<{ id: string; name: string } | null>(null);

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveDialogMode, setArchiveDialogMode] = useState<"archive" | "restore">("archive");
  const [targetClientForArchive, setTargetClientForArchive] = useState<{ id: string; name: string; type?: string } | null>(null);

  const handleOpenDelete = (c: ClientRow | ClientWithOps) => {
    setTargetClientForDelete({ id: c.id, name: c.name });
    setDeleteDialogOpen(true);
  };

  const handleOpenArchive = (c: ClientRow | ClientWithOps) => {
    setTargetClientForArchive({ id: c.id, name: c.name, type: c.client_type });
    setArchiveDialogMode("archive");
    setArchiveDialogOpen(true);
  };

  const handleOpenRestore = (c: ClientRow | ClientWithOps) => {
    setTargetClientForArchive({ id: c.id, name: c.name, type: c.client_type });
    setArchiveDialogMode("restore");
    setArchiveDialogOpen(true);
  };

  // Add Client Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ClientType>("monthly");

  // Common Form Fields
  const [newClientName, setNewClientName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPreferredChannel, setNewPreferredChannel] = useState("whatsapp");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newAccountManagerId, setNewAccountManagerId] = useState("");
  const [newSalesOwnerId, setNewSalesOwnerId] = useState("");
  const [newMonthlyRate, setNewMonthlyRate] = useState<number>(0);
  const [newSponsoringBudget, setNewSponsoringBudget] = useState<number>(0);

  // Monthly Form Fields
  const [availablePackages, setAvailablePackages] = useState<PackageCatalogItem[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [newPackageName, setNewPackageName] = useState("Growth — Custom");
  const [reelsQuota, setReelsQuota] = useState(5);
  const [postsQuota, setPostsQuota] = useState(4);
  const [storiesQuota, setStoriesQuota] = useState(10);
  const [selectedOtherServices, setSelectedOtherServices] = useState<string[]>(["Meta Ads"]);
  const [billingStartDate, setBillingStartDate] = useState(format(new Date(), "yyyy-MM-01"));

  // One-Off Form Fields
  const [oneOffService, setOneOffService] = useState("Reel Production");
  const [oneOffRequestDate, setOneOffRequestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oneOffDeliveryDate, setOneOffDeliveryDate] = useState(format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd"));
  const [oneOffPriority, setOneOffPriority] = useState<"low" | "medium" | "high" | "urgent">("high");
  const [oneOffAssignedBy, setOneOffAssignedBy] = useState("");
  const [oneOffAssignedTo, setOneOffAssignedTo] = useState("");
  const [oneOffSubtasks, setOneOffSubtasks] = useState<string[]>([
    "Shooting",
    "Editing",
    "Review",
    "Delivery"
  ]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");

  const [savingNew, setSavingNew] = useState(false);

  const loadData = async (forceLoading = false) => {
    if (forceLoading || clients.length === 0) {
      setLoading(true);
    }
    const [clientsRes, projectsRes, tasksRes, profRes, teamRes, invRes, sponsRes, catalogPkgs] = await Promise.all([
      (supabase as any).from("clients").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("client_projects").select("*").order("updated_at", { ascending: false }),
      (supabase as any).from("project_tasks").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("profiles").select("id, display_name"),
      (supabase as any).from("team_members").select("*").order("sort_order", { ascending: true }),
      canViewFinance ? (supabase as any).from("invoices").select("*") : Promise.resolve({ data: [] }),
      canViewFinance ? (supabase as any).from("sponsoring_campaigns").select("*") : Promise.resolve({ data: [] }),
      fetchPackageCatalog({ isActive: true }),
    ]);

    setClients(clientsRes.data || []);
    setProjects(projectsRes.data || []);
    setTasks(tasksRes.data || []);
    setProfiles(profRes.data || []);
    setTeamMembers(teamRes.data || []);
    setInvoices(invRes.data || []);
    setSponsoring(sponsRes.data || []);
    setAvailablePackages(catalogPkgs || []);

    if (catalogPkgs && catalogPkgs.length > 0 && !selectedPackageId) {
      const defaultPkg = catalogPkgs.find(p => p.code === "MG-02") || catalogPkgs[0];
      if (defaultPkg) {
        setSelectedPackageId(defaultPkg.id);
        setNewPackageName(defaultPkg.name);
        setNewMonthlyRate(defaultPkg.price);
        setReelsQuota(defaultPkg.monthly_reels || 5);
        setPostsQuota(defaultPkg.monthly_posts || 4);
        setStoriesQuota(defaultPkg.monthly_stories ? (parseInt(defaultPkg.monthly_stories, 10) || 10) : 10);
      }
    }

    if (user?.id && !newOwnerId) {
      setNewOwnerId(user.id);
      setNewAccountManagerId(user.id);
      setNewSalesOwnerId(user.id);
      setOneOffAssignedBy(user.id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Default to cards on mobile screens (< 768px) while preserving manual user toggle
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("cards");
    }
  }, []);

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

  const getMemberDisplayName = (id?: string | null) => {
    if (!id) return "Unassigned";
    return teamMemberMap.get(id) || profileMap.get(id) || "Team Member";
  };

  // Combine clients with operational work & canonical financial metrics
  const clientsWithOps: ClientWithOps[] = useMemo(() => {
    const currentMonth = getCurrentPeriodMonth();
    return clients.map((c) => {
      const clientTasks = tasks.filter((t) => t.client_id === c.id);
      const clientProjects = projects.filter((p) => p.client_id === c.id);
      const isMonthly = c.client_type === "monthly";
      const primaryWorkspace = clientProjects[0] || null;

      // Financial OS Derivations (Canonical Single Source of Truth)
      const clientInvoices = invoices.filter((inv) => inv.client_id === c.id);
      const clientSponsoring = sponsoring.filter((sc) => sc.client_id === c.id);
      const fin = calculateClientFinancials({
        client: c,
        invoices: clientInvoices,
        sponsoring: clientSponsoring,
      });

      const monthlyRevenue = fin.monthlyRevenue;
      const sponsoringBudget = fin.sponsoringBudget;
      const paymentStatus = fin.paymentStatus;
      const clientHealth = fin.clientHealth;

      const accountManagerName = getMemberDisplayName(c.account_manager_id || c.relationship_owner_id);
      const salesOwnerName = getMemberDisplayName(c.sales_owner_id || c.commission_recipient_id);

      if (isMonthly) {
        const period = c.current_period_month || currentMonth;
        const currentPeriodTasks = clientTasks.filter((t) => t.delivery_period === period || !t.delivery_period);
        const monthlyProgress = computeMonthlyProgress(currentPeriodTasks, c.package_config);
        return {
          ...c,
          tasks: clientTasks,
          projects: clientProjects,
          workspaceCount: clientProjects.length,
          primaryWorkspace,
          monthlyProgress,
          monthlyRevenue,
          sponsoringBudget,
          paymentStatus,
          clientHealth,
          accountManagerName,
          salesOwnerName,
        };
      } else {
        // One-off client: find primary deliverable/task
        const primaryTask = clientTasks.find((t) => !t.parent_task_id) || clientTasks[0];
        return {
          ...c,
          tasks: clientTasks,
          projects: clientProjects,
          workspaceCount: clientProjects.length,
          primaryWorkspace,
          oneOffTask: primaryTask,
          monthlyRevenue,
          sponsoringBudget,
          paymentStatus,
          clientHealth,
          accountManagerName,
          salesOwnerName,
        };
      }
    });
  }, [clients, projects, tasks, invoices, sponsoring, teamMembers, profiles]);

  // Summary counts
  const totalActiveCount = clients.filter(c => c.status !== "archived").length;
  const totalMonthlyCount = clients.filter(c => c.client_type === "monthly" && c.status !== "archived").length;
  const totalOneOffCount = clients.filter(c => c.client_type !== "monthly" && c.status !== "archived").length;
  const totalArchivedCount = clients.filter(c => c.status === "archived").length;

  // Filtering
  const filteredClients = useMemo(() => {
    return clientsWithOps.filter((c) => {
      // Type / Category Tab filter
      if (activeTab === "archived") {
        if (c.status !== "archived") return false;
      } else {
        // Exclude archived clients by default from active tabs ("all", "monthly", "one_off")
        // unless statusFilter is explicitly set to "archived"
        if (statusFilter !== "archived" && c.status === "archived") return false;

        if (activeTab === "monthly" && c.client_type !== "monthly") return false;
        if (activeTab === "one_off" && c.client_type === "monthly") return false;
      }

      // Status filter
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesContact = (c.contact_name || "").toLowerCase().includes(q);
        const matchesIndustry = (c.industry || "").toLowerCase().includes(q);
        const matchesPackage = (c.package_name || "").toLowerCase().includes(q);
        const matchesService = c.oneOffTask?.service?.toLowerCase().includes(q) || c.oneOffTask?.title?.toLowerCase().includes(q);
        if (!matchesName && !matchesContact && !matchesIndustry && !matchesPackage && !matchesService) return false;
      }

      return true;
    });
  }, [clientsWithOps, activeTab, statusFilter, searchQuery]);

  const monthlyClients = useMemo(() => filteredClients.filter(c => c.client_type === "monthly" && c.status !== "archived"), [filteredClients]);
  const oneOffClients = useMemo(() => filteredClients.filter(c => c.client_type !== "monthly" && c.status !== "archived"), [filteredClients]);
  const archivedClients = useMemo(() => filteredClients.filter(c => c.status === "archived"), [filteredClients]);

  const handleOpenAddModal = () => {
    setAddStep(1);
    setSelectedType("monthly");
    setNewClientName("");
    setNewIndustry("");
    setNewContactName("");
    setNewEmail("");
    setNewPhone("");
    setNewPreferredChannel("whatsapp");
    setNewPackageName("Growth — Custom");
    setReelsQuota(5);
    setPostsQuota(4);
    setStoriesQuota(10);
    setSelectedOtherServices(["Meta Ads"]);
    setOneOffService("Reel Production");
    setOneOffSubtasks(["Shooting", "Editing", "Review", "Delivery"]);
    setNewMonthlyRate(0);
    setNewSponsoringBudget(0);
    setNewSalesOwnerId("");
    setShowAddModal(true);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast.error("Business name is required");
      return;
    }

    setSavingNew(true);
    const resolvedOwnerId = resolveToProfileId(newOwnerId || user?.id, teamMembers, profiles);
    const resolvedAccountManager = resolveToProfileId(newAccountManagerId || newOwnerId || user?.id, teamMembers, profiles);
    const resolvedSalesOwner = resolveToProfileId(newSalesOwnerId, teamMembers, profiles);
    const resolvedCommissionRecipient = resolveToTeamMemberId(newSalesOwnerId, teamMembers);

    if (newSalesOwnerId && !resolvedCommissionRecipient) {
      toast.error("Selected Sales Owner is no longer available. Please select an active team member.");
      setSavingNew(false);
      return;
    }

    let createdClientId: string | null = null;

    try {
      if (selectedType === "monthly") {
        // 1. Create Monthly Client
        const clientPayload = {
          name: newClientName.trim(),
          client_type: "monthly",
          industry: newIndustry.trim() || null,
          contact_name: newContactName.trim() || null,
          email: normalizeEmail(newEmail),
          phone: normalizePhone(newPhone),
          preferred_channel: newPreferredChannel || "whatsapp",
          status: "active",
          package_id: selectedPackageId || null,
          package_name: newPackageName,
          package_config: {
            reels_quota: reelsQuota,
            posts_quota: postsQuota,
            stories_quota: storiesQuota,
            other_services: selectedOtherServices,
          },
          billing_start_date: billingStartDate || null,
          current_period_month: getCurrentPeriodMonth(),
          relationship_owner_id: resolvedAccountManager || resolvedOwnerId || null,
          account_manager_id: resolvedAccountManager || null,
          sales_owner_id: resolvedSalesOwner || null,
          commission_recipient_id: resolvedCommissionRecipient || null,
          monthly_package_price: Number(newMonthlyRate) || 0,
          default_service_fee: Number(newMonthlyRate) || 0,
          default_sponsoring_budget: Number(newSponsoringBudget) || 0,
        };

        const { data: createdClient, error: clientErr } = await (supabase as any)
          .from("clients")
          .insert(clientPayload)
          .select("*")
          .single();

        if (clientErr) throw clientErr;
        createdClientId = createdClient.id;

        // 2. Create internal client_project container for operational compatibility
        const { data: createdProject, error: projErr } = await (supabase as any)
          .from("client_projects")
          .insert({
            client_id: createdClient.id,
            client_name: createdClient.name,
            title: `${createdClient.name} — Monthly Retainer`,
            status: "active",
            lead_id: resolvedAccountManager || resolvedOwnerId || null,
            start_date: billingStartDate,
            description: `Monthly continuous retainer for ${createdClient.name}. Package: ${newPackageName}`,
          })
          .select("*")
          .single();

        if (projErr) throw projErr;

        // 3. Initialize canonical SSOT deliverables, commitments, and calendar tasks via reconciliation engine
        await reconcileClientPackageWork({
          clientId: createdClient.id,
          packageId: selectedPackageId || null,
          packageName: newPackageName || "Monthly Retainer",
          packageConfig: {
            reels_quota: reelsQuota,
            posts_quota: postsQuota,
            stories_quota: storiesQuota,
            other_services: selectedOtherServices,
          },
          periodMonth: getCurrentPeriodMonth(),
          actorId: user?.id,
          actorEmail: user?.email,
          teamMembers,
          profiles,
        });

        // Successful completion: mark client committed so rollback will not trigger
        createdClientId = null;

        toast.success(`Monthly client "${createdClient.name}" created with active cycle!`);
        setShowAddModal(false);
        loadData();
        nav({ to: `/admin/client-workspaces/${createdClient.id}` });
      } else {
        // 1. Create One-Off Client
        const clientPayload = {
          name: newClientName.trim(),
          client_type: "one_off",
          industry: newIndustry.trim() || null,
          contact_name: newContactName.trim() || null,
          email: normalizeEmail(newEmail),
          phone: normalizePhone(newPhone),
          preferred_channel: newPreferredChannel || "whatsapp",
          status: "active",
          package_name: `One-Off: ${oneOffService}`,
          package_config: null,
          relationship_owner_id: resolvedAccountManager || resolvedOwnerId || null,
          account_manager_id: resolvedAccountManager || null,
          sales_owner_id: resolvedSalesOwner || null,
          commission_recipient_id: resolvedCommissionRecipient || null,
          monthly_package_price: Number(newMonthlyRate) || 0,
          default_service_fee: Number(newMonthlyRate) || 0,
          default_sponsoring_budget: Number(newSponsoringBudget) || 0,
        };

        const { data: createdClient, error: clientErr } = await (supabase as any)
          .from("clients")
          .insert(clientPayload)
          .select("*")
          .single();

        if (clientErr) throw clientErr;
        createdClientId = createdClient.id;

        // 2. Create project container
        const { data: createdProject, error: projErr } = await (supabase as any)
          .from("client_projects")
          .insert({
            client_id: createdClient.id,
            client_name: createdClient.name,
            title: `${createdClient.name} — ${oneOffService}`,
            status: "active",
            lead_id: resolveToProfileId(oneOffAssignedBy || user?.id, teamMembers, profiles),
            start_date: oneOffRequestDate,
            deadline: oneOffDeliveryDate,
            description: `One-off service engagement: ${oneOffService}`,
          })
          .select("*")
          .single();

        if (projErr) throw projErr;

        const resolvedAssignedBy = resolveToProfileId(oneOffAssignedBy || user?.id, teamMembers, profiles);
        const resolvedAssignedTo = resolveToProfileId(oneOffAssignedTo, teamMembers, profiles);

        // 3. Create Main Deliverable Task
        const { data: mainTask, error: taskErr } = await (supabase as any)
          .from("project_tasks")
          .insert({
            project_id: createdProject.id,
            client_id: createdClient.id,
            title: `${oneOffService} — ${createdClient.name}`,
            service: oneOffService,
            category: "Service",
            status: "in_progress",
            priority: oneOffPriority,
            deadline: oneOffDeliveryDate,
            assigned_by_id: resolvedAssignedBy || null,
            assignee_id: resolvedAssignedTo || null,
            delivery_period: "one_off",
            sort_order: 1,
          })
          .select("*")
          .single();

        if (taskErr) throw taskErr;

        // 4. Create subtasks
        if (oneOffSubtasks.length > 0 && mainTask?.id) {
          const subtaskRows = oneOffSubtasks.map((st, idx) => ({
            project_id: createdProject.id,
            client_id: createdClient.id,
            parent_task_id: mainTask.id,
            title: st,
            status: idx === 0 ? "done" : idx === 1 ? "in_progress" : "todo",
            priority: oneOffPriority,
            deadline: oneOffDeliveryDate,
            assigned_by_id: resolvedAssignedBy || null,
            assignee_id: resolvedAssignedTo || null,
            delivery_period: "one_off",
            sort_order: idx + 1,
          }));

          await (supabase as any).from("project_tasks").insert(subtaskRows);
        }

        // Successful completion: mark client committed so rollback will not trigger
        createdClientId = null;

        toast.success(`One-Off client "${createdClient.name}" created with service!`);
        setShowAddModal(false);
        loadData();
        nav({ to: `/admin/client-workspaces/${createdClient.id}` });
      }
    } catch (err: any) {
      if (createdClientId) {
        try {
          await (supabase as any).from("project_tasks").delete().eq("client_id", createdClientId);
          await (supabase as any).from("client_projects").delete().eq("client_id", createdClientId);
          await (supabase as any).from("clients").delete().eq("id", createdClientId);
        } catch (cleanupErr) {
          console.error("Failed to clean up partial client creation:", cleanupErr);
        }
      }
      toast.error(`Creation failed: ${formatClientErrorMessage(err)}`);
    } finally {
      setSavingNew(false);
    }
  };

  const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono mb-1.5";

  if (loading && clients.length === 0) {
    return <ClientDirectorySkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-7xl mx-auto animate-in fade-in duration-300 pb-12 overflow-x-hidden min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase font-mono">
              {isAr ? "SADA OS · دليل العملاء" : "SADA OS · Client Directory"}
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1 truncate">
            {isAr ? "العملاء" : "Clients"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {isAr ? "دليل العملاء · شركاء النجاح والتعاون" : "Client directory · Who we work with"}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenAddModal}
            className="bg-gradient-primary text-white px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 neon-glow hover:scale-[1.02] transition-transform w-full sm:w-auto shadow-md shrink-0 h-10 sm:h-auto"
          >
            <Plus className="size-4" />
            <span>{isAr ? "إضافة عميل" : "Add Client"}</span>
          </button>
        )}
      </div>

      {/* Primary Navigation Tabs, Search & View Switcher */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card space-y-3 shadow-2xs w-full min-w-0">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between min-w-0">
          {/* Search Box */}
          <div className="relative w-full lg:w-72 xl:w-80 min-w-0 shrink-0">
            <Search className="size-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={isAr ? "البحث في العملاء، الخدمات، التسليمات..." : "Search clients, services, deliverables..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl ps-9 pe-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-start"
            />
          </div>

          {/* Filter Pills & View Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 min-w-0">
            {/* Filter Pills (Clean wrap without horizontal scrolling) */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  activeTab === "all"
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {isAr ? `العملاء النشطون (${totalActiveCount})` : `Active Clients (${totalActiveCount})`}
              </button>
              <button
                onClick={() => setActiveTab("monthly")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === "monthly"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Repeat className="size-3.5" />
                <span>{isAr ? `الاشتراكات الشهرية (${totalMonthlyCount})` : `Monthly Retainers (${totalMonthlyCount})`}</span>
              </button>
              <button
                onClick={() => setActiveTab("one_off")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === "one_off"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Zap className="size-3.5" />
                <span>{isAr ? `مشاريع حسب الطلب (${totalOneOffCount})` : `One-Off / À La Carte (${totalOneOffCount})`}</span>
              </button>
              <button
                onClick={() => setActiveTab("archived")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === "archived"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Archive className="size-3.5" />
                <span>{isAr ? `الأرشيف (${totalArchivedCount})` : `Archived (${totalArchivedCount})`}</span>
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border shrink-0 ms-auto lg:ms-0">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isAr ? "عرض الجدول" : "Table View"}
              >
                <TableIcon className="size-3.5" />
                <span className="inline">{isAr ? "جدول" : "Table"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "cards"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isAr ? "عرض البطاقات" : "Cards View"}
              >
                <LayoutGrid className="size-3.5" />
                <span className="inline">{isAr ? "بطاقات" : "Cards"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {(loading && clients.length === 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="h-56 rounded-3xl border border-border bg-card/60 animate-pulse" />
          ))}
        </div>
      ) : viewMode === "table" ? (
        /* =====================================================================
           CANONICAL CRM TABLE VIEW (ZERO HORIZONTAL OVERFLOW SYSTEM)
        ===================================================================== */
        <div className="rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xs overflow-hidden w-full min-w-0">
          {/* DESKTOP TABLE (>= 1100px / xl:block) */}
          <div className="hidden xl:block w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                {canViewFinance ? (
                  <>
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8%]" />
                  </>
                ) : (
                  <>
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                  </>
                )}
                <col className="w-[6%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="bg-muted/40 text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-3.5 py-3 font-bold text-start truncate">{isAr ? "اسم العميل" : "Client Name"}</th>
                  <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "القطاع" : "Industry"}</th>
                  <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "مدير الحساب" : "Account Mgr"}</th>
                  <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "مسؤول المبيعات" : "Sales Owner"}</th>
                  <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "الباقة" : "Package"}</th>
                  {canViewFinance ? (
                    <>
                      <th className="px-2.5 py-3 font-bold text-end truncate">{isAr ? "الإيراد" : "Revenue"}</th>
                      <th className="px-2.5 py-3 font-bold text-end truncate">{isAr ? "الممول" : "Sponsoring"}</th>
                      <th className="px-2 py-3 font-bold text-center truncate">{isAr ? "الدفع" : "Payment"}</th>
                      <th className="px-2 py-3 font-bold text-center truncate">{isAr ? "الربحية" : "Health"}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "مساحات العمل" : "Workspaces"}</th>
                      <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "التسليمات" : "Deliverables"}</th>
                      <th className="px-2.5 py-3 font-bold text-center truncate">{isAr ? "الإنجاز" : "Progress"}</th>
                    </>
                  )}
                  <th className="px-2 py-3 font-bold text-center truncate">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3.5 py-3 font-bold text-end truncate">{isAr ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-xs text-muted-foreground">
                      {isAr ? "لم يتم العثور على عملاء يطابقون معايير البحث المحددة." : "No clients found matching the selected criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                        {/* 1. Name */}
                        <td className="px-3.5 py-3 align-middle overflow-hidden">
                          <Link
                            to="/admin/client-workspaces/$id"
                            params={{ id: c.id }}
                            className="flex items-center gap-2.5 group/link min-w-0"
                            title={`${c.name} — ${c.contact_name || c.email || ""}`}
                          >
                            <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[11px] shrink-0 group-hover/link:scale-105 transition-transform">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-foreground group-hover/link:text-primary transition-colors truncate">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {c.contact_name || c.email || (isAr ? "حساب مباشر" : "Direct Account")}
                              </div>
                            </div>
                          </Link>
                        </td>

                        {/* 2. Industry */}
                        <td className="px-2.5 py-3 align-middle overflow-hidden" title={c.industry || (isAr ? "عام" : "General")}>
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium text-[10px] truncate block text-center">
                            {c.industry || (isAr ? "عام" : "General")}
                          </span>
                        </td>

                        {/* 3. Account Manager */}
                        <td className="px-2.5 py-3 align-middle overflow-hidden" title={c.accountManagerName}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="size-4.5 rounded-full bg-primary/20 text-primary font-mono text-[9px] flex items-center justify-center shrink-0">
                              {c.accountManagerName.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="text-[11px] text-foreground font-medium truncate">
                              {c.accountManagerName}
                            </span>
                          </div>
                        </td>

                        {/* 4. Sales Owner */}
                        <td className="px-2.5 py-3 align-middle overflow-hidden" title={c.salesOwnerName}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="size-4.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] flex items-center justify-center shrink-0">
                              {c.salesOwnerName.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="text-[11px] text-foreground font-medium truncate">
                              {c.salesOwnerName}
                            </span>
                          </div>
                        </td>

                        {/* 5. Package */}
                        <td className="px-2.5 py-3 align-middle overflow-hidden" title={c.package_name || (c.client_type === "monthly" ? "Growth — Custom" : (c.oneOffTask?.service || "One-Off"))}>
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[10px] truncate block text-center">
                            {c.package_name || (c.client_type === "monthly" ? "Growth — Custom" : (c.oneOffTask?.service || (isAr ? "حسب الطلب" : "One-Off")))}
                          </span>
                        </td>

                        {canViewFinance ? (
                          <>
                            {/* 6. Monthly Revenue */}
                            <td className="px-2.5 py-3 align-middle font-mono font-bold text-foreground text-end overflow-hidden whitespace-nowrap tabular-nums" dir="ltr">
                              {c.monthlyRevenue > 0 ? formatCurrency(c.monthlyRevenue) : "—"}
                            </td>

                            {/* 7. Sponsoring Budget */}
                            <td className="px-2.5 py-3 align-middle font-mono text-muted-foreground text-end overflow-hidden whitespace-nowrap tabular-nums" dir="ltr">
                              {c.sponsoringBudget > 0 ? formatCurrency(c.sponsoringBudget) : formatCurrency(0)}
                            </td>

                            {/* 8. Payment Status */}
                            <td className="px-2 py-3 align-middle text-center overflow-hidden">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border truncate ${
                                c.paymentStatus === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : c.paymentStatus === "PENDING"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              }`}>
                                <span className="size-1 rounded-full bg-current shrink-0" />
                                <span className="truncate">
                                  {isAr
                                    ? c.paymentStatus === "PAID" ? "مدفوع" : c.paymentStatus === "PENDING" ? "معلق" : "متأخر"
                                    : c.paymentStatus}
                                </span>
                              </span>
                            </td>

                            {/* 9. Client Health */}
                            <td className="px-2 py-3 align-middle text-center overflow-hidden">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border truncate ${
                                c.clientHealth === "HIGH PROFIT"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : c.clientHealth === "MEDIUM"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : c.clientHealth === "NO DATA"
                                  ? "bg-muted/80 text-muted-foreground border-border/80"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              }`}>
                                <span className="size-1 rounded-full bg-current shrink-0" />
                                <span className="truncate">
                                  {isAr
                                    ? c.clientHealth === "HIGH PROFIT" ? "ربح مرتفع" : c.clientHealth === "MEDIUM" ? "متوسط" : c.clientHealth === "NO DATA" ? "لا توجد بيانات" : "ربح منخفض"
                                    : c.clientHealth}
                                </span>
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2.5 py-3 align-middle font-mono text-muted-foreground overflow-hidden truncate text-center" dir="ltr">
                              {c.workspaceCount} {isAr ? "مساحة" : "ws"}
                            </td>
                            <td className="px-2.5 py-3 align-middle font-mono text-foreground overflow-hidden truncate text-center" dir="ltr">
                              {c.tasks.filter(t => t.status !== "done").length} {isAr ? "مهمة" : "tasks"}
                            </td>
                            <td className="px-2.5 py-3 align-middle text-center overflow-hidden">
                              {c.monthlyProgress ? (
                                <span className="font-mono text-xs font-semibold text-primary" dir="ltr">
                                  {c.monthlyProgress.percent}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* 10. Active / Inactive / Archived */}
                        <td className="px-2 py-3 align-middle text-center overflow-hidden">
                          {c.status === "archived" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <Archive className="size-2.5 shrink-0" />
                              <span className="truncate">{isAr ? "مؤرشف" : "Archived"}</span>
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              c.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            }`}>
                              <span className={`size-1.5 rounded-full shrink-0 ${c.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                              <span className="truncate">{c.status === "active" ? (isAr ? "نشط" : "Active") : (isAr ? "غير نشط" : "Inactive")}</span>
                            </span>
                          )}
                        </td>

                        {/* 11. Actions */}
                        <td className="px-3.5 py-3 align-middle text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 shrink-0">
                            <Link
                              to="/admin/client-workspaces/$id"
                              params={{ id: c.id }}
                              className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                              title={isAr ? "فتح ملف العميل الشامل 360" : "Open Client 360"}
                            >
                              <span>{isAr ? "فتح العميل" : "Open Client"}</span>
                              <ArrowRight className="size-3 rtl:rotate-180" />
                            </Link>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  aria-label={isAr ? "إجراءات إضافية" : "More actions"}
                                  title={isAr ? "إجراءات إضافية" : "More actions"}
                                >
                                  <MoreVertical className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-card border border-border shadow-md">
                                {c.status === "archived" ? (
                                  canArchive && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenRestore(c)}
                                      className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                    >
                                      <RotateCcw className="size-3.5" />
                                      <span>{isAr ? "استعادة وتنشيط العميل" : "Restore Client"}</span>
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  canArchive && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenArchive(c)}
                                      className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 cursor-pointer"
                                    >
                                      <Archive className="size-3.5" />
                                      <span>{isAr ? "تجميد وأرشفة العميل" : "Archive Client"}</span>
                                    </DropdownMenuItem>
                                  )
                                )}

                                {isSuperAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleOpenDelete(c)}
                                      className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{isAr ? "حذف العميل نهائياً" : "Delete Client Permanently"}</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLET COMPACT TABLE (768px - 1099px / hidden md:block xl:hidden) */}
          <div className="hidden md:block xl:hidden w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-muted/40 text-muted-foreground uppercase font-mono text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-3.5 py-3 font-bold text-start truncate">{isAr ? "العميل والفريق" : "Client & Team"}</th>
                  <th className="px-2.5 py-3 font-bold text-start truncate">{isAr ? "الباقة" : "Package"}</th>
                  <th className="px-2.5 py-3 font-bold text-end truncate">{canViewFinance ? (isAr ? "الإيراد" : "Revenue") : (isAr ? "مساحات العمل" : "Workspaces")}</th>
                  <th className="px-2 py-3 font-bold text-center truncate">{canViewFinance ? (isAr ? "الدفع" : "Payment") : (isAr ? "المهام" : "Tasks")}</th>
                  <th className="px-2 py-3 font-bold text-center truncate">{canViewFinance ? (isAr ? "الربحية" : "Health") : (isAr ? "الإنجاز" : "Progress")}</th>
                  <th className="px-3.5 py-3 font-bold text-end truncate">{isAr ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                      {isAr ? "لم يتم العثور على عملاء يطابقون معايير البحث المحددة." : "No clients found matching the selected criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                        {/* 1. Client Identity & Secondary Team info */}
                        <td className="px-3.5 py-3 align-middle overflow-hidden">
                          <Link
                            to="/admin/client-workspaces/$id"
                            params={{ id: c.id }}
                            className="flex items-center gap-2.5 group/link min-w-0"
                            title={`${c.name} — ${c.contact_name || c.email || ""}`}
                          >
                            <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[11px] shrink-0 group-hover/link:scale-105 transition-transform">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-foreground group-hover/link:text-primary transition-colors truncate">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                <span>{c.contact_name || c.email || (isAr ? "حساب مباشر" : "Direct Account")}</span>
                                {c.industry && <span> · {c.industry}</span>}
                                <span> · {isAr ? "مدير الحساب: " : "AM: "}{c.accountManagerName}</span>
                              </div>
                            </div>
                          </Link>
                        </td>

                        {/* 2. Package */}
                        <td className="px-2.5 py-3 align-middle overflow-hidden">
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold truncate block text-start" title={c.package_name || ""}>
                            {c.package_name || (c.client_type === "monthly" ? "Growth — Custom" : (c.oneOffTask?.service || (isAr ? "حسب الطلب" : "One-Off")))}
                          </span>
                          {c.client_type === "monthly" && c.current_period_month && (
                            <span className="text-[9px] font-mono text-muted-foreground truncate block mt-0.5" dir="ltr">
                              {formatPeriodMonth(c.current_period_month)}
                            </span>
                          )}
                        </td>

                        {/* 3. Revenue / Workspaces */}
                        <td className="px-2.5 py-3 align-middle text-end overflow-hidden">
                          {canViewFinance ? (
                            <>
                              <div className="font-mono font-bold text-foreground text-xs whitespace-nowrap tabular-nums" dir="ltr">
                                {c.monthlyRevenue > 0 ? formatCurrency(c.monthlyRevenue) : "—"}
                              </div>
                              <div className="font-mono text-[9px] text-muted-foreground whitespace-nowrap tabular-nums" dir="ltr">
                                {c.sponsoringBudget > 0 ? `+${formatCurrency(c.sponsoringBudget)} ${isAr ? "ممول" : "spons."}` : `0 ${isAr ? "د.ت ممول" : "TND spons."}`}
                              </div>
                            </>
                          ) : (
                            <div className="font-mono text-foreground text-xs tabular-nums text-center" dir="ltr">
                              {c.workspaceCount} {isAr ? "مساحة" : "ws"}
                            </div>
                          )}
                        </td>

                        {/* 4. Payment / Tasks */}
                        <td className="px-2 py-3 align-middle text-center overflow-hidden">
                          {canViewFinance ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border truncate ${
                              c.paymentStatus === "PAID"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : c.paymentStatus === "PENDING"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            }`}>
                              <span className="size-1 rounded-full bg-current shrink-0" />
                              <span className="truncate">
                                {isAr
                                  ? c.paymentStatus === "PAID" ? "مدفوع" : c.paymentStatus === "PENDING" ? "معلق" : "متأخر"
                                  : c.paymentStatus}
                              </span>
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-foreground" dir="ltr">
                              {c.tasks.filter(t => t.status !== "done").length} {isAr ? "مفتوحة" : "open"}
                            </span>
                          )}
                        </td>

                        {/* 5. Health / Progress */}
                        <td className="px-2 py-3 align-middle text-center overflow-hidden">
                          {canViewFinance ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border truncate ${
                              c.clientHealth === "HIGH PROFIT"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : c.clientHealth === "MEDIUM"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : c.clientHealth === "NO DATA"
                                ? "bg-muted/80 text-muted-foreground border-border/80"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}>
                              <span className="size-1 rounded-full bg-current shrink-0" />
                              <span className="truncate">
                                {isAr
                                  ? c.clientHealth === "HIGH PROFIT" ? "ربح مرتفع" : c.clientHealth === "MEDIUM" ? "متوسط" : c.clientHealth === "NO DATA" ? "لا توجد بيانات" : "ربح منخفض"
                                  : c.clientHealth}
                              </span>
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-primary" dir="ltr">
                              {c.monthlyProgress ? `${c.monthlyProgress.percent}%` : "—"}
                            </span>
                          )}
                        </td>

                        {/* 6. Actions */}
                        <td className="px-3.5 py-3 align-middle text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 shrink-0">
                            <Link
                              to="/admin/client-workspaces/$id"
                              params={{ id: c.id }}
                              className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[10px] inline-flex items-center gap-1 transition-colors shadow-2xs shrink-0"
                              title={isAr ? "فتح ملف العميل 360" : "Open Client 360"}
                            >
                              <span>{isAr ? "فتح" : "Open"}</span>
                              <ArrowRight className="size-2.5 rtl:rotate-180" />
                            </Link>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  aria-label={isAr ? "إجراءات إضافية" : "More actions"}
                                  title={isAr ? "إجراءات إضافية" : "More actions"}
                                >
                                  <MoreVertical className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-card border border-border shadow-md">
                                {c.status === "archived" ? (
                                  canArchive && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenRestore(c)}
                                      className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                    >
                                      <RotateCcw className="size-3.5" />
                                      <span>{isAr ? "استعادة وتنشيط العميل" : "Restore Client"}</span>
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  canArchive && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenArchive(c)}
                                      className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 cursor-pointer"
                                    >
                                      <Archive className="size-3.5" />
                                      <span>{isAr ? "تجميد وأرشفة العميل" : "Archive Client"}</span>
                                    </DropdownMenuItem>
                                  )
                                )}

                                {isSuperAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleOpenDelete(c)}
                                      className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{isAr ? "حذف العميل نهائياً" : "Delete Client Permanently"}</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE COMPACT TABLE (< 768px / block md:hidden) */}
          <div className="block md:hidden w-full overflow-hidden divide-y divide-border/60">
            {filteredClients.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {isAr ? "لم يتم العثور على عملاء يطابقون معايير البحث المحددة." : "No clients found matching the selected criteria."}
              </div>
            ) : (
              filteredClients.map((c) => {
                return (
                  <div key={c.id} className="p-3.5 space-y-2.5 bg-card hover:bg-muted/20 transition-colors min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <Link
                        to="/admin/client-workspaces/$id"
                        params={{ id: c.id }}
                        className="flex items-center gap-2.5 min-w-0 flex-1"
                      >
                        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-foreground text-xs truncate">
                            {c.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {c.contact_name || c.email || (isAr ? "حساب مباشر" : "Direct Account")}
                          </div>
                        </div>
                      </Link>

                      {c.status === "archived" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0">
                          <Archive className="size-2.5" />
                          <span>{isAr ? "مؤرشف" : "Archived"}</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${
                          c.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>
                          <span className={`size-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                          {c.status === "active" ? (isAr ? "نشط" : "Active") : (isAr ? "غير نشط" : "Inactive")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[10px] truncate max-w-[140px]">
                        {c.package_name || (c.client_type === "monthly" ? "Growth — Custom" : (c.oneOffTask?.service || (isAr ? "حسب الطلب" : "One-Off")))}
                      </span>
                      {canViewFinance && (
                        <span className="font-mono font-bold text-foreground text-xs shrink-0 tabular-nums" dir="ltr">
                          {c.monthlyRevenue > 0 ? formatCurrency(c.monthlyRevenue) : "—"}
                        </span>
                      )}
                    </div>

                    {/* Touch Friendly Action Row */}
                    <div className="flex items-center gap-2 pt-1 min-w-0">
                      <Link
                        to="/admin/client-workspaces/$id"
                        params={{ id: c.id }}
                        className="flex-1 h-9 rounded-xl bg-gradient-primary text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                      >
                        <span>{isAr ? "فتح ملف العميل 360" : "Open Client 360"}</span>
                        <ArrowRight className="size-3 rtl:rotate-180" />
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            aria-label={isAr ? "خيارات إضافية" : "More options"}
                            title={isAr ? "خيارات إضافية" : "More options"}
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-card border border-border shadow-md">
                          {c.status === "archived" ? (
                            canArchive && (
                              <DropdownMenuItem
                                onClick={() => handleOpenRestore(c)}
                                className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 cursor-pointer"
                              >
                                <RotateCcw className="size-3.5" />
                                <span>{isAr ? "استعادة وتنشيط العميل" : "Restore Client"}</span>
                              </DropdownMenuItem>
                            )
                          ) : (
                            canArchive && (
                              <DropdownMenuItem
                                onClick={() => handleOpenArchive(c)}
                                className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 cursor-pointer"
                              >
                                <Archive className="size-3.5" />
                                <span>{isAr ? "تجميد وأرشفة العميل" : "Archive Client"}</span>
                              </DropdownMenuItem>
                            )
                          )}

                          {isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleOpenDelete(c)}
                                className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                <span>{isAr ? "حذف العميل نهائياً" : "Delete Client Permanently"}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* =====================================================================
           RESPONSIVE CRM CARDS VIEW (FULL CLIENT INFORMATION VISIBILITY)
        ===================================================================== */
        <div className="space-y-8 sm:space-y-10 w-full min-w-0">
          {/* SECTION 1: MONTHLY CLIENTS */}
          {(activeTab === "all" || activeTab === "monthly") && (
            <div className="space-y-4 w-full min-w-0">
              <div className="flex items-center justify-between border-b border-border pb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Repeat className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                      {isAr ? "عملاء الاشتراكات الشهرية" : "Monthly Retainer Clients"}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isAr ? "باقات دورية مستمرة مع تسليمات ومخرجات شهرية مجدولة" : "Continuous packages with recurring monthly deliverables"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground shrink-0" dir="ltr">
                  {monthlyClients.length}
                </span>
              </div>

              {monthlyClients.length === 0 ? (
                <div className="p-8 rounded-3xl border border-dashed border-border bg-card text-center text-xs text-muted-foreground">
                  {isAr ? "لم يتم العثور على عملاء اشتراكات شهرية يطابقون المعايير." : "No monthly retainer clients found matching criteria."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
                  {monthlyClients.map((c) => {
                    const prog = c.monthlyProgress;
                    const attentionBadge = prog?.attentionState === "completed"
                      ? { label: isAr ? "مكتمل" : "Completed", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" }
                      : prog?.attentionState === "attention"
                      ? { label: isAr ? "يتطلب تدخلاً" : "Needs Attention", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" }
                      : { label: isAr ? "منتظم ومستقر" : "On Track", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };

                    return (
                      <div
                        key={c.id}
                        className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-border/80 bg-card hover:border-primary/50 transition-all elevated-shadow flex flex-col justify-between group space-y-4 min-w-0"
                      >
                        <div className="space-y-3.5 min-w-0">
                          {/* Card Top: Avatar, Name, Contact, Status */}
                          <div className="flex items-start justify-between gap-2.5 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0 group-hover:scale-105 transition-transform">
                                {c.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-display font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate" title={c.name}>
                                  {c.name}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate" title={c.contact_name || c.email || ""}>
                                  {c.contact_name || c.email || (isAr ? "حساب مباشر" : "Direct Account")}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${
                              c.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}>
                              <span className={`size-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                              {c.status === "active" ? (isAr ? "نشط" : "Active") : (isAr ? "غير نشط" : "Inactive")}
                            </span>
                          </div>

                          {/* Badges: Industry & Package */}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium text-[10px] truncate max-w-[120px]">
                              {c.industry || (isAr ? "عام" : "General")}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[10px] truncate max-w-[150px]">
                              {c.package_name || "Growth — Custom"}
                            </span>
                            {c.current_period_month && (
                              <span className="text-[9px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50 border border-border/50 shrink-0" dir="ltr">
                                {formatPeriodMonth(c.current_period_month)}
                              </span>
                            )}
                          </div>

                          {/* Financial Metrics 4-Box Grid (or Operations for worker) */}
                          {canViewFinance ? (
                            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 rounded-2xl bg-muted/30 border border-border/60">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "الإيراد الشهري" : "Revenue"}
                                </span>
                                <span className="font-mono text-xs sm:text-sm font-bold text-foreground block truncate tabular-nums" dir="ltr">
                                  {c.monthlyRevenue > 0 ? formatCurrency(c.monthlyRevenue) : "—"}
                                </span>
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "الممول" : "Sponsoring"}
                                </span>
                                <span className="font-mono text-xs sm:text-sm font-semibold text-muted-foreground block truncate tabular-nums" dir="ltr">
                                  {c.sponsoringBudget > 0 ? formatCurrency(c.sponsoringBudget) : formatCurrency(0)}
                                </span>
                              </div>
                              <div className="space-y-0.5 pt-1.5 border-t border-border/40 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "حالة الدفع" : "Payment"}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold truncate ${
                                  c.paymentStatus === "PAID"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : c.paymentStatus === "PENDING"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}>
                                  <span className="size-1.5 rounded-full bg-current shrink-0" />
                                  <span className="truncate">
                                    {isAr
                                      ? c.paymentStatus === "PAID" ? "مدفوع" : c.paymentStatus === "PENDING" ? "معلق" : "متأخر"
                                      : c.paymentStatus}
                                  </span>
                                </span>
                              </div>
                              <div className="space-y-0.5 pt-1.5 border-t border-border/40 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "مستوى الربحية" : "Health"}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold truncate ${
                                  c.clientHealth === "HIGH PROFIT"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : c.clientHealth === "MEDIUM"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : c.clientHealth === "NO DATA"
                                    ? "text-muted-foreground"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}>
                                  <span className="size-1.5 rounded-full bg-current shrink-0" />
                                  <span className="truncate">
                                    {isAr
                                      ? c.clientHealth === "HIGH PROFIT" ? "ربح مرتفع" : c.clientHealth === "MEDIUM" ? "متوسط" : c.clientHealth === "NO DATA" ? "لا توجد بيانات" : "ربح منخفض"
                                      : c.clientHealth}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 rounded-2xl bg-muted/30 border border-border/60">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "مساحات العمل" : "Workspaces"}
                                </span>
                                <span className="font-mono text-xs font-bold text-foreground block truncate" dir="ltr">
                                  {c.workspaceCount} {isAr ? "مساحة" : "ws"}
                                </span>
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "المهام النشطة" : "Active Tasks"}
                                </span>
                                <span className="font-mono text-xs font-semibold text-foreground block truncate" dir="ltr">
                                  {c.tasks.filter(t => t.status !== "done").length} {isAr ? "مفتوحة" : "open"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Monthly Progress Bar */}
                          {prog && (
                            <div className="space-y-1.5 p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs min-w-0">
                              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                <span>{isAr ? "المخرجات الشهرية" : "Monthly Deliverables"}</span>
                                <span className="font-bold text-foreground" dir="ltr">
                                  {prog.totalDone} / {prog.totalQuota} ({prog.percent}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, prog.percent)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Team Row */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 min-w-0">
                            <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground shrink-0">{isAr ? "المدير:" : "AM:"}</span>
                              <span className="text-foreground font-medium truncate text-xs">{c.accountManagerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground shrink-0">{isAr ? "المبيعات:" : "Sales:"}</span>
                              <span className="text-foreground font-medium truncate text-xs">{c.salesOwnerName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="flex items-center gap-2 pt-2 min-w-0">
                          <Link
                            to="/admin/client-workspaces/$id"
                            params={{ id: c.id }}
                            className="flex-1 h-11 rounded-xl bg-gradient-primary text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-transform"
                          >
                            <span>{isAr ? "فتح ملف العميل 360" : "Open Client 360"}</span>
                            <ArrowRight className={`size-3.5 ${isAr ? "rotate-180" : ""}`} />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="size-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                aria-label={isAr ? "خيارات إضافية" : "More options"}
                                title={isAr ? "خيارات إضافية" : "More options"}
                              >
                                <MoreVertical className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-card border border-border shadow-md">
                              {canArchive && (
                                <DropdownMenuItem
                                  onClick={() => handleOpenArchive(c)}
                                  className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 cursor-pointer"
                                >
                                  <Archive className="size-3.5" />
                                  <span>{isAr ? "تجميد وأرشفة العميل" : "Archive Client"}</span>
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDelete(c)}
                                    className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>{isAr ? "حذف العميل نهائياً" : "Delete Client Permanently"}</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: ONE-OFF / À LA CARTE CLIENTS */}
          {(activeTab === "all" || activeTab === "one_off") && (
            <div className="space-y-4 w-full min-w-0">
              <div className="flex items-center justify-between border-b border-border pb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Zap className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                      {isAr ? "عملاء المشاريع المستقلة وحسب الطلب" : "One-Off / À La Carte Clients"}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isAr ? "خدمات فردية ومشاريع محددة النطاق والتسليم" : "Individual services and targeted project deliveries"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground shrink-0" dir="ltr">
                  {oneOffClients.length}
                </span>
              </div>

              {oneOffClients.length === 0 ? (
                <div className="p-8 rounded-3xl border border-dashed border-border bg-card text-center text-xs text-muted-foreground">
                  {isAr ? "لم يتم العثور على عملاء مشاريع فردية يطابقون المعايير." : "No one-off clients found matching criteria."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
                  {oneOffClients.map((c) => {
                    const task = c.oneOffTask;
                    const statusLabel = task?.status === "done" ? (isAr ? "مكتملة" : "Completed") : task?.status === "in_progress" ? (isAr ? "قيد التنفيذ" : "In Progress") : (isAr ? "معلقة" : "Pending");
                    const statusClass = task?.status === "done"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-primary/10 text-primary border-primary/20";

                    return (
                      <div
                        key={c.id}
                        className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-border/80 bg-card hover:border-primary/50 transition-all elevated-shadow flex flex-col justify-between group space-y-4 min-w-0"
                      >
                        <div className="space-y-3.5 min-w-0">
                          {/* Card Top: Avatar, Name, Contact, Status */}
                          <div className="flex items-start justify-between gap-2.5 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0 group-hover:scale-105 transition-transform">
                                {c.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-display font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate" title={c.name}>
                                  {c.name}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate" title={c.contact_name || c.email || ""}>
                                  {c.contact_name || c.email || (isAr ? "حساب مباشر" : "Direct Account")}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${
                              c.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}>
                              <span className={`size-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                              {c.status === "active" ? (isAr ? "نشط" : "Active") : (isAr ? "غير نشط" : "Inactive")}
                            </span>
                          </div>

                          {/* Badges: Industry & Service */}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium text-[10px] truncate max-w-[120px]">
                              {c.industry || (isAr ? "خدمة حسب الطلب" : "One-Off Service")}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${statusClass}`}>
                              <span className="size-1.5 rounded-full bg-current shrink-0" />
                              {statusLabel}
                            </span>
                          </div>

                          {/* Service Details */}
                          <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5 text-xs min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-2 truncate">
                              <Sparkles className="size-3.5 text-primary shrink-0" />
                              <span className="truncate">{task?.service || task?.title || (isAr ? "إنتاج ريلز" : "Reel Production")}</span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                              <span>{isAr ? "الموعد:" : "Due"} {task?.deadline ? format(parseISO(task.deadline), "d MMM") : (isAr ? "مفتوح" : "Open")}</span>
                              <span className="font-medium text-foreground truncate max-w-[120px]">
                                {getMemberDisplayName(task?.assignee_id)}
                              </span>
                            </div>
                          </div>

                          {/* Financial Metrics 4-Box Grid (or Operations for worker) */}
                          {canViewFinance ? (
                            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 rounded-2xl bg-muted/30 border border-border/60">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "قيمة المشروع" : "Revenue"}
                                </span>
                                <span className="font-mono text-xs sm:text-sm font-bold text-foreground block truncate tabular-nums" dir="ltr">
                                  {c.monthlyRevenue > 0 ? formatCurrency(c.monthlyRevenue) : "—"}
                                </span>
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "الممول" : "Sponsoring"}
                                </span>
                                <span className="font-mono text-xs sm:text-sm font-semibold text-muted-foreground block truncate tabular-nums" dir="ltr">
                                  {c.sponsoringBudget > 0 ? formatCurrency(c.sponsoringBudget) : formatCurrency(0)}
                                </span>
                              </div>
                              <div className="space-y-0.5 pt-1.5 border-t border-border/40 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "حالة الدفع" : "Payment"}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold truncate ${
                                  c.paymentStatus === "PAID"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : c.paymentStatus === "PENDING"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}>
                                  <span className="size-1.5 rounded-full bg-current shrink-0" />
                                  <span className="truncate">
                                    {isAr
                                      ? c.paymentStatus === "PAID" ? "مدفوع" : c.paymentStatus === "PENDING" ? "معلق" : "متأخر"
                                      : c.paymentStatus}
                                  </span>
                                </span>
                              </div>
                              <div className="space-y-0.5 pt-1.5 border-t border-border/40 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "مستوى الربحية" : "Health"}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold truncate ${
                                  c.clientHealth === "HIGH PROFIT"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : c.clientHealth === "MEDIUM"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : c.clientHealth === "NO DATA"
                                    ? "text-muted-foreground"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}>
                                  <span className="size-1.5 rounded-full bg-current shrink-0" />
                                  <span className="truncate">
                                    {isAr
                                      ? c.clientHealth === "HIGH PROFIT" ? "ربح مرتفع" : c.clientHealth === "MEDIUM" ? "متوسط" : c.clientHealth === "NO DATA" ? "لا توجد بيانات" : "ربح منخفض"
                                      : c.clientHealth}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 rounded-2xl bg-muted/30 border border-border/60">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "مساحات العمل" : "Workspaces"}
                                </span>
                                <span className="font-mono text-xs font-bold text-foreground block truncate" dir="ltr">
                                  {c.workspaceCount} {isAr ? "مساحة" : "ws"}
                                </span>
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] uppercase font-mono font-bold text-muted-foreground tracking-wider block truncate">
                                  {isAr ? "المهام النشطة" : "Active Tasks"}
                                </span>
                                <span className="font-mono text-xs font-semibold text-foreground block truncate" dir="ltr">
                                  {c.tasks.filter(t => t.status !== "done").length} {isAr ? "مفتوحة" : "open"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Team Row */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 min-w-0">
                            <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground shrink-0">{isAr ? "المدير:" : "AM:"}</span>
                              <span className="text-foreground font-medium truncate text-xs">{c.accountManagerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground shrink-0">{isAr ? "المبيعات:" : "Sales:"}</span>
                              <span className="text-foreground font-medium truncate text-xs">{c.salesOwnerName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="flex items-center gap-2 pt-2 min-w-0">
                          <Link
                            to="/admin/client-workspaces/$id"
                            params={{ id: c.id }}
                            className="flex-1 h-11 rounded-xl bg-gradient-primary text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-transform"
                          >
                            <span>{isAr ? "فتح ملف العميل 360" : "Open Client 360"}</span>
                            <ArrowRight className={`size-3.5 ${isAr ? "rotate-180" : ""}`} />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="size-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                aria-label={isAr ? "خيارات إضافية" : "More options"}
                                title={isAr ? "خيارات إضافية" : "More options"}
                              >
                                <MoreVertical className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-card border border-border shadow-md">
                              {canArchive && (
                                <DropdownMenuItem
                                  onClick={() => handleOpenArchive(c)}
                                  className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 cursor-pointer"
                                >
                                  <Archive className="size-3.5" />
                                  <span>{isAr ? "تجميد وأرشفة العميل" : "Archive Client"}</span>
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDelete(c)}
                                    className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>{isAr ? "حذف العميل نهائياً" : "Delete Client Permanently"}</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: ARCHIVED CLIENTS */}
          {activeTab === "archived" && (
            <div className="space-y-4 w-full min-w-0">
              <div className="flex items-center justify-between border-b border-border pb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <Archive className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                      {isAr ? "العملاء المؤرشفون والمجمدون" : "Archived & Frozen Clients"}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isAr ? "سجلات مجمدة مع الحفاظ على كامل التاريخ والمخرجات والفواتير القانونية" : "Frozen workspaces with full historical deliverables, tasks, and legal invoices preserved"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full text-amber-600 dark:text-amber-400 shrink-0" dir="ltr">
                  {archivedClients.length}
                </span>
              </div>

              {archivedClients.length === 0 ? (
                <div className="p-12 rounded-3xl border border-dashed border-border bg-card text-center space-y-2">
                  <Archive className="size-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "لا يوجد عملاء مؤرشفون حالياً." : "No archived clients at this time."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
                  {archivedClients.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-500/30 bg-card hover:border-amber-500/60 transition-all elevated-shadow flex flex-col justify-between group space-y-4 min-w-0"
                    >
                      <div className="space-y-3.5 min-w-0">
                        {/* Top: Avatar, Name, Badge */}
                        <div className="flex items-start justify-between gap-2.5 min-w-0">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 text-xs shrink-0">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-display font-bold text-sm sm:text-base text-foreground truncate" title={c.name}>
                                {c.name}
                              </h3>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.contact_name || c.email || (isAr ? "حساب مباشر" : "Direct Account")}
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0">
                            <Archive className="size-3" />
                            <span>{isAr ? "مؤرشف" : "Archived"}</span>
                          </span>
                        </div>

                        {/* Preserved metadata */}
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5 text-muted-foreground">
                          <div className="flex justify-between items-center text-[11px]">
                            <span>{isAr ? "نوع الباقة:" : "Package:"}</span>
                            <span className="font-semibold text-foreground">{c.package_name || (c.client_type === "monthly" ? "Retainer" : "One-Off")}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span>{isAr ? "السجلات التشغيلية المحفوظة:" : "Preserved Tasks:"}</span>
                            <span className="font-mono font-bold text-foreground">{c.tasks.length}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span>{isAr ? "مساحات العمل المحفوظة:" : "Workspaces:"}</span>
                            <span className="font-mono font-bold text-foreground">{c.workspaceCount}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                        {canArchive && (
                          <button
                            type="button"
                            onClick={() => handleOpenRestore(c)}
                            className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>{isAr ? "استعادة وتنشيط" : "Restore"}</span>
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(c)}
                            className="h-9 px-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title={isAr ? "حذف نهائي" : "Delete Permanently"}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                        <Link
                          to="/admin/client-workspaces/$id"
                          params={{ id: c.id }}
                          className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
                        >
                          <span>{isAr ? "تفاصيل" : "Details"}</span>
                          <ArrowRight className="size-3 rtl:rotate-180" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* 2-STEP ADD CLIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] animate-[sada-overlay-in_120ms_ease-out]" onClick={() => setShowAddModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-6 animate-[sada-dialog-in_120ms_ease-out] sada-scrollbar"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest block">
                  {isAr ? `الخطوة ${addStep} من 2` : `Step ${addStep} of 2`}
                </span>
                <h2 className="font-display font-bold text-xl text-foreground mt-0.5">
                  {addStep === 1
                    ? (isAr ? "ما هو نوع العميل؟" : "What Type of Client?")
                    : selectedType === "monthly"
                    ? (isAr ? "عميل اشتراك شهري جديد" : "New Monthly Retainer Client")
                    : (isAr ? "عميل خدمة حسب الطلب جديد" : "New One-Off Service Client")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="size-8 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* STEP 1: TYPE SELECTION */}
            {addStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "اختر نموذج التعاقد التشغيلي لهذا العميل. يتيح نظام SADA مسارات مخصصة للاشتراكات الشهرية المتكررة والمشاريع المستقلة حسب الطلب."
                    : "Select the operating engagement model for this client. SADA optimizes workflows specifically for recurring monthly retainers vs one-off targeted services."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType("monthly");
                      setAddStep(2);
                    }}
                    className="p-5 rounded-2xl border-2 border-border hover:border-primary bg-card/60 hover:bg-primary/5 text-start space-y-3 transition-all group"
                  >
                    <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center group-hover:scale-110 transition-transform">
                      <Repeat className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground text-sm">
                        {isAr ? "اشتراك شهري متكرر" : "Monthly Retainer"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isAr
                          ? "باقات شهرية مستمرة، حصص مخرجات محددة (ريلز، منشورات، قصص)، وتتبع دورات الفوترة الدورية."
                          : "Recurring package, monthly deliverable quotas (Reels, Posts, Stories), and monthly historical cycles."}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
                      {isAr ? "اختيار اشتراك شهري" : "Select Monthly"} <ArrowRight className="size-3 rtl:rotate-180" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType("one_off");
                      setAddStep(2);
                    }}
                    className="p-5 rounded-2xl border-2 border-border hover:border-emerald-500 bg-card/60 hover:bg-emerald-500/5 text-start space-y-3 transition-all group"
                  >
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center group-hover:scale-110 transition-transform">
                      <Zap className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground text-sm">
                        {isAr ? "مشروع حسب الطلب / لمرة واحدة" : "One-Off / À La Carte"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isAr
                          ? "خدمة فردية مركزة (مثل إنتاج فيديو ترويجي)، موعد تسليم نهائي محدد، مهام فرعية للتنفيذ، ومخرجات مستقلة."
                          : "Individual service (e.g. Reel Production), dedicated delivery deadline, execution subtasks, and delivery link."}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
                      {isAr ? "اختيار مشروع لمرة واحدة" : "Select One-Off"} <ArrowRight className="size-3 rtl:rotate-180" />
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: FORM */}
            {addStep === 2 && (
              <form onSubmit={handleCreateClient} className="space-y-5">
                {/* General Client Details */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground block">
                    {isAr ? "هوية العميل وبيانات الاتصال" : "Client Identity"}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>{isAr ? "اسم الشركة / النشاط التجاري *" : "Business Name *"}</label>
                      <input
                        type="text"
                        required
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                        placeholder={isAr ? "مثال: واحة سياحية، مقهى 707" : "e.g. Jannat Sahara, Café 707"}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{isAr ? "القطاع / التصنيف" : "Industry / Category"}</label>
                      <input
                        type="text"
                        value={newIndustry}
                        onChange={e => setNewIndustry(e.target.value)}
                        placeholder={isAr ? "مثال: ضيافة، مقاهي، تجارة تجزئة" : "e.g. Hospitality, Café, Retail"}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{isAr ? "المسؤول المباشر" : "Contact Person"}</label>
                      <input
                        type="text"
                        value={newContactName}
                        onChange={e => setNewContactName(e.target.value)}
                        placeholder={isAr ? "مثال: سارة المنصور" : "e.g. Sarah Mansour"}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{isAr ? "البريد الإلكتروني" : "Email"}</label>
                      <input
                        type="email"
                        dir="ltr"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="contact@client.tn"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{isAr ? "رقم الهاتف" : "Phone"}</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="+216 98 000 000"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                {/* CRM Ownership & Financial Parameters */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground block">
                    {isAr ? "المسؤولية والمعاملات المالية" : "CRM Ownership & Financial Parameters"}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelCls}>{isAr ? "مدير الحساب" : "Account Manager"}</label>
                      <SADACombobox
                        value={resolveToTeamMemberId(newAccountManagerId, teamMembers) || newAccountManagerId}
                        onChange={val => setNewAccountManagerId(val)}
                        options={teamMembers.map(m => ({
                          value: m.id,
                          label: m.display_name || m.name,
                          subtitle: m.position || m.role,
                          avatar: m.photo_url || null,
                        }))}
                        placeholder={isAr ? "اختر مدير الحساب..." : "Select Account Manager..."}
                        searchPlaceholder={isAr ? "بحث في أعضاء الفريق..." : "Search team member..."}
                        clearable
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>{isAr ? "مسؤول المبيعات" : "Sales Owner"}</label>
                      <SADACombobox
                        value={resolveToTeamMemberId(newSalesOwnerId, teamMembers) || newSalesOwnerId}
                        onChange={val => setNewSalesOwnerId(val)}
                        options={teamMembers.map(m => ({
                          value: m.id,
                          label: m.display_name || m.name,
                          subtitle: m.position || m.role,
                          avatar: m.photo_url || null,
                        }))}
                        placeholder={isAr ? "اختر مسؤول المبيعات..." : "Select Sales Owner..."}
                        searchPlaceholder={isAr ? "بحث في أعضاء الفريق..." : "Search team member..."}
                        clearable
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>{isAr ? "الإيراد الشهري (د.ت)" : "Monthly Revenue / Rate (TND)"}</label>
                      <SADAInput
                        type="number"
                        min="0"
                        value={String(newMonthlyRate)}
                        onChange={e => setNewMonthlyRate(Number(e.target.value) || 0)}
                        placeholder="0"
                        prefix={isAr ? "د.ت" : "TND"}
                        className="font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>{isAr ? "ميزانية الإعلانات الممولة (د.ت)" : "Sponsoring Budget (TND)"}</label>
                      <SADAInput
                        type="number"
                        min="0"
                        value={String(newSponsoringBudget)}
                        onChange={e => setNewSponsoringBudget(Number(e.target.value) || 0)}
                        placeholder="0"
                        prefix={isAr ? "د.ت" : "TND"}
                        className="font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* MONTHLY CLIENT SPECIFIC FIELDS */}
                {selectedType === "monthly" && (
                  <div className="space-y-4 pt-3 border-t border-border">
                    <span className="text-[10px] font-mono uppercase font-bold text-primary block">
                      {isAr ? "الباقة والتسليمات الشهرية" : "Package & Monthly Deliverables"}
                    </span>

                    {/* Canonical Package Selection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className={labelCls}>{isAr ? "اختيار الباقة المعتمدة" : "Select Canonical Package"}</label>
                        <span className="text-[10px] font-mono text-primary font-bold">
                          {isAr ? "المصدر المعتمد والموحد" : "Single Source of Truth"}
                        </span>
                      </div>
                      <SADACombobox
                        value={selectedPackageId}
                        onChange={(val) => {
                          setSelectedPackageId(val);
                          const chosen = availablePackages.find(p => p.id === val);
                          if (chosen) {
                            setNewPackageName(chosen.name);
                            if (chosen.price) setNewMonthlyRate(chosen.price);
                            setReelsQuota(chosen.monthly_reels ?? 0);
                            setPostsQuota(chosen.monthly_posts ?? 0);
                            setStoriesQuota(chosen.monthly_stories ? (parseInt(chosen.monthly_stories, 10) || 0) : 0);
                            if (chosen.included_items && chosen.included_items.length > 0) {
                              setSelectedOtherServices(chosen.included_items.map(it => it.text));
                            }
                          }
                        }}
                        options={availablePackages.map(pkg => ({
                          value: pkg.id,
                          label: `${pkg.code ? `[${pkg.code}] ` : ""}${pkg.name}`,
                          subtitle: `${pkg.category_name || (isAr ? "عام" : "General")} · ${formatCurrency(pkg.price)} ${pkg.billing_type === "monthly" ? (isAr ? "/شهر" : "/mo") : ""}`,
                        }))}
                        placeholder={isAr ? "اختر باقة من الكتالوج..." : "Choose package from catalog..."}
                        searchPlaceholder={isAr ? "بحث بالاسم أو الرمز..." : "Search packages by name or code..."}
                      />
                    </div>

                    {/* Quota Customization */}
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 space-y-3">
                      <span className="text-[11px] font-bold text-foreground block">
                        {isAr ? "تخصيص الحصص الشهرية (حسب العميل)" : "Customize Monthly Quotas (Client-Specific)"}
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className={labelCls}>{isAr ? "ريلز / شهر" : "Reels / mo"}</label>
                          <SADACounter
                            min={0}
                            value={reelsQuota}
                            onChange={setReelsQuota}
                            suffix={isAr ? "ريلز" : "reels"}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelCls}>{isAr ? "منشورات / شهر" : "Posts / mo"}</label>
                          <SADACounter
                            min={0}
                            value={postsQuota}
                            onChange={setPostsQuota}
                            suffix={isAr ? "منشورات" : "posts"}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelCls}>{isAr ? "قصص / شهر" : "Stories / mo"}</label>
                          <SADACounter
                            min={0}
                            value={storiesQuota}
                            onChange={setStoriesQuota}
                            suffix={isAr ? "قصص" : "stories"}
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Included Services */}
                      <div>
                        <label className={labelCls}>{isAr ? "خدمات أخرى متضمنة" : "Other Included Services"}</label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {["Meta Ads", "Brand Strategy", "Copywriting", "Website Maintenance", "SEO"].map(serv => {
                            const active = selectedOtherServices.includes(serv);
                            return (
                              <button
                                key={serv}
                                type="button"
                                onClick={() => {
                                  if (active) setSelectedOtherServices(selectedOtherServices.filter(s => s !== serv));
                                  else setSelectedOtherServices([...selectedOtherServices, serv]);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {serv}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className={labelCls}>{isAr ? "تاريخ البداية" : "Start Date"}</label>
                        <SADADatePicker
                          value={billingStartDate}
                          onChange={val => setBillingStartDate(val)}
                          placeholder={isAr ? "اختر تاريخ البداية..." : "Select start date..."}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ONE-OFF CLIENT SPECIFIC FIELDS */}
                {selectedType === "one_off" && (
                  <div className="space-y-4 pt-3 border-t border-border">
                    <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                      {isAr ? "الخدمة المحددة والمهام الفرعية" : "One-Off Service & Subtasks"}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>{isAr ? "الخدمة المطلوبة *" : "Requested Service *"}</label>
                        <input
                          type="text"
                          required
                          value={oneOffService}
                          onChange={e => setOneOffService(e.target.value)}
                          placeholder={isAr ? "مثال: إنتاج فيديو ترويجي، جلسة تصوير هوية" : "e.g. Reel Production, Brand Photoshoot"}
                          className={inputCls}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className={labelCls}>{isAr ? "موعد التسليم النهائي" : "Delivery Deadline"}</label>
                        <SADADatePicker
                          value={oneOffDeliveryDate}
                          onChange={val => setOneOffDeliveryDate(val)}
                          placeholder={isAr ? "اختر الموعد النهائي..." : "Select deadline..."}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className={labelCls}>{isAr ? "الأولوية" : "Priority"}</label>
                        <SADASelect
                          value={oneOffPriority}
                          onChange={val => setOneOffPriority(val as any)}
                          options={[
                            { value: "low", label: isAr ? "منخفضة" : "Low" },
                            { value: "medium", label: isAr ? "متوسطة" : "Medium" },
                            { value: "high", label: isAr ? "عالية" : "High" },
                            { value: "urgent", label: isAr ? "عاجلة" : "Urgent" },
                          ]}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className={labelCls}>{isAr ? "المسند من قِبل (القائد)" : "Assigned By (Lead)"}</label>
                        <SADACombobox
                          value={oneOffAssignedBy}
                          onChange={val => setOneOffAssignedBy(val)}
                          options={teamMembers.map(m => ({
                            value: m.profile_id || m.id,
                            label: m.display_name || m.name,
                            subtitle: m.position || m.role,
                            avatar: m.photo_url || null,
                          }))}
                          placeholder={isAr ? "اختر المفوض..." : "Select Delegator..."}
                          searchPlaceholder={isAr ? "بحث..." : "Search delegator..."}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className={labelCls}>{isAr ? "المسند إليه (المختص)" : "Assigned To (Specialist)"}</label>
                        <SADACombobox
                          value={oneOffAssignedTo}
                          onChange={val => setOneOffAssignedTo(val)}
                          options={teamMembers.map(m => ({
                            value: m.profile_id || m.id,
                            label: m.display_name || m.name,
                            subtitle: m.position || m.role,
                            avatar: m.photo_url || null,
                          }))}
                          placeholder={isAr ? "اختر المنفذ..." : "Select Assignee..."}
                          searchPlaceholder={isAr ? "بحث..." : "Search assignee..."}
                        />
                      </div>
                    </div>

                    {/* Subtasks Checklist */}
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 space-y-2.5">
                      <span className="text-[11px] font-bold text-foreground block">
                        {isAr ? "مهام التنفيذ الفرعية" : "Initial Execution Subtasks"}
                      </span>
                      <div className="space-y-1.5">
                        {oneOffSubtasks.map((st, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 text-xs">
                            <span>{st}</span>
                            <button
                              type="button"
                              onClick={() => setOneOffSubtasks(oneOffSubtasks.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder={isAr ? "إضافة مهمة فرعية (مثال: تصحيح الألوان)..." : "Add subtask (e.g. Color Grading)..."}
                          value={newSubtaskInput}
                          onChange={e => setNewSubtaskInput(e.target.value)}
                          className={inputCls}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newSubtaskInput.trim()) {
                                setOneOffSubtasks([...oneOffSubtasks, newSubtaskInput.trim()]);
                                setNewSubtaskInput("");
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newSubtaskInput.trim()) {
                              setOneOffSubtasks([...oneOffSubtasks, newSubtaskInput.trim()]);
                              setNewSubtaskInput("");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-muted hover:bg-primary hover:text-primary-foreground text-xs font-semibold shrink-0"
                        >
                          {isAr ? "إضافة" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setAddStep(1)}
                    className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {isAr ? "العودة لاختيار النوع" : "Back to Type Selection"}
                  </button>
                  <button
                    type="submit"
                    disabled={savingNew}
                    className="bg-gradient-primary text-white px-5 py-2.5 rounded-xl text-xs font-semibold neon-glow hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    {savingNew ? (isAr ? "جاري إنشاء العميل..." : "Creating Client...") : (isAr ? "إنشاء ملف العميل" : "Create Client")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Client Dialog */}
      <DeleteClientDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        clientId={targetClientForDelete?.id || null}
        clientName={targetClientForDelete?.name || ""}
        onDeleted={() => {
          loadData(true);
        }}
        onRequestArchive={() => {
          if (targetClientForDelete) {
            setTargetClientForArchive({ id: targetClientForDelete.id, name: targetClientForDelete.name });
            setArchiveDialogMode("archive");
            setArchiveDialogOpen(true);
          }
        }}
      />

      {/* Archive / Restore Dialog */}
      <ArchiveClientDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        clientId={targetClientForArchive?.id || null}
        clientName={targetClientForArchive?.name || ""}
        clientType={targetClientForArchive?.type}
        mode={archiveDialogMode}
        onSuccess={() => {
          loadData(true);
        }}
      />
    </div>
  );
}
