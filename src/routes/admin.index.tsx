import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  FolderKanban, FileText, ShoppingBag, MessageSquare, Star, Briefcase,
  AlertTriangle, Clock, CalendarDays, ArrowRight, CheckCircle2, Eye,
  AlertCircle, Users, Sparkles, ChevronRight, ChevronDown, ChevronUp, Plus, PhoneCall, ShieldAlert,
  FolderCheck, Pause, Play, Lock, ArrowUpRight, Check, RefreshCw, User,
  Filter, CheckCircle, Flame, TrendingUp, Wallet, DollarSign
} from "lucide-react";
import { format, isToday, isPast, isTomorrow, parseISO } from "date-fns";
import {
  computeProgress, isTaskOverdue, computeProjectHealth, computeNextAction,
  getUserExecutionTasks, calculateUserWorkload, getDeliveriesByProject,
  getTeamPulse, getProjectsNeedingAttention, getProjectLeadInfo,
  getAgencyUnassignedTasks, getAgencyOverdueTasks, getAgencyBlockedTasks,
  getAssignmentMemberInfo,
  STATUS_CONFIG, PRIORITY_CONFIG, PROJECT_STATUS_CONFIG,
  type TaskRow, type ProjectRow, type ProfileRow, type TeamMemberRow, type TaskStatus, type ProjectNextAction, type TaskPriority, type ClientRow
} from "@/components/admin/project-utils";
import { TaskModal } from "@/components/admin/TaskModal";
import { TaskDetailModal } from "@/components/admin/TaskDetailModal";
import { ClientFollowupModal } from "@/components/admin/ClientFollowupModal";
import { ExecutiveCommandCenter } from "@/components/admin/ExecutiveCommandCenter";
import { AnalyticsDrillDownModal } from "@/components/admin/AnalyticsDrillDownModal";
import { fetchManagementAnalytics } from "@/lib/analytics-service";
import type { FullManagementAnalyticsData, AnalyticsDrillDownState } from "@/types/notifications-and-audit";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ExecutiveDashboardSkeleton } from "@/components/ui/sada-ui";
import { useTranslation } from "@/i18n";
import { formatDate } from "@/lib/date-locale";

export const Route = createFileRoute("/admin/")({
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
  component: DailyExecutionDashboard,
});

const CONTENT_CARDS = [
  { table: "projects", label: "Case Studies", Icon: FolderKanban },
  { table: "blog_posts", label: "Posts", Icon: FileText },
  { table: "products", label: "Products", Icon: ShoppingBag },
  { table: "testimonials", label: "Testimonials", Icon: Star },
  { table: "contact_submissions", label: "Inquiries", Icon: MessageSquare },
];

function DailyExecutionDashboard() {
  const { user, isSuperAdmin, isAdmin, isWorker, teamMember, teamMemberId: authTmId, canAccessModule } = useAuth();
  const { t, isRTL } = useTranslation();
  const isAr = isRTL;

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Executive Management Analytics State
  const [analyticsData, setAnalyticsData] = useState<FullManagementAnalyticsData | null>(null);
  const [drillDownState, setDrillDownState] = useState<AnalyticsDrillDownState | null>(null);

  // Dashboard Mode / Scope Switcher (Session-Persistent)
  const [dashboardScope, setDashboardScope] = useState<"executive_command" | "my_execution" | "agency_oversight">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("sada_dashboard_scope");
      if (saved === "executive_command" || saved === "agency_oversight" || saved === "my_execution") {
        return saved as any;
      }
    }
    return "executive_command";
  });

  // Guard for workers: redirect to my_execution if unauthorized for executive financials
  useEffect(() => {
    if (!isSuperAdmin && !isAdmin) {
      setDashboardScope("my_execution");
    }
  }, [isSuperAdmin, isAdmin]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("sada_dashboard_scope", dashboardScope);
    }
  }, [dashboardScope]);

  // Modals state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [inspectingTask, setInspectingTask] = useState<TaskRow | null>(null);

  // Followup modal state
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupProject, setFollowupProject] = useState<ProjectRow | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  // Execution filter tab (My Execution mode)
  const [executionTab, setExecutionTab] = useState<"all" | "todo" | "in_progress" | "review" | "blocked" | "done">("all");

  // Oversight filter tab (Agency Oversight mode)
  const [oversightTab, setOversightTab] = useState<"all" | "overdue" | "blocked" | "unassigned" | "client_action" | "at_risk">("all");
  // Needs Attention collapsed state (default: collapsed, showing top 3 items)
  const [isExceptionsExpanded, setIsExceptionsExpanded] = useState(false);

  const loadData = async (forceLoading = false) => {
    const isInitial = projects.length === 0 && tasks.length === 0 && clients.length === 0;
    if (forceLoading || isInitial) {
      setLoading(true);
    }

    const [projRes, tasksRes, profRes, teamRes, clientsRes, dealsRes, commsRes] = await Promise.all([
      (supabase as any).from("client_projects").select("*").order("updated_at", { ascending: false }),
      (supabase as any).from("project_tasks").select("*").order("deadline", { ascending: true }),
      (supabase as any).from("profiles").select("id, display_name"),
      (supabase as any).from("team_members").select("*, salary_records(*)").order("sort_order", { ascending: true }),
      (supabase as any).from("clients").select("id, name, industry, status, client_type"),
      (supabase as any).from("deals").select("*, client:clients(name), package:package_catalog(name)").order("created_at", { ascending: false }),
      (supabase as any).from("sales_commissions").select("*").order("created_at", { ascending: false }),
    ]);

    setProjects(projRes.data || []);
    setTasks(tasksRes.data || []);
    setProfiles(profRes.data || []);
    setTeamMembers(teamRes.data || []);
    setClients(clientsRes.data || []);
    setDeals(dealsRes.data || []);
    setCommissions(commsRes.data || []);

    // Fetch Executive Management Analytics for Super Admin / Admin / Authorized Analytics users
    // Reuses preloaded tasks, projects, team members, and deals to eliminate duplicate queries (DEF-ECC-10)
    if (isSuperAdmin || isAdmin || canAccessModule("analytics")) {
      try {
        const aData = await fetchManagementAnalytics(
          { periodType: "this_month" },
          {
            preloadedData: {
              tasks: tasksRes.data || [],
              projects: projRes.data || [],
              teamMembers: teamRes.data || [],
              deals: dealsRes.data || [],
            },
          }
        );
        setAnalyticsData(aData);
      } catch (err) {
        console.error("[ExecutiveCommandCenter] Failed to fetch analytics:", err);
      }
    }

    // Fetch content counts
    Promise.all(CONTENT_CARDS.map(c => (supabase as any).from(c.table).select("*", { count: "exact", head: true })))
      .then(rs => setCounts(Object.fromEntries(CONTENT_CARDS.map((c, i) => [c.table, rs[i].count || 0]))));

    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("realtime:admin_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_tasks" },
        () => { loadData(false); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => { loadData(false); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_commissions" },
        () => { loadData(false); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.display_name || ""])), [profiles]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  // Tasks grouped by project for health computation
  const tasksByProject = useMemo(() => {
    const map: Record<string, TaskRow[]> = {};
    for (const t of tasks) {
      if (!map[t.project_id]) map[t.project_id] = [];
      map[t.project_id].push(t);
    }
    return map;
  }, [tasks]);

  const myMember = useMemo(() => {
    if (teamMember) return teamMember;
    if (!user) return null;
    return teamMembers.find(m => m.profile_id === user.id || m.id === user.id || (m as any).user_id === user.id) || null;
  }, [teamMembers, user, teamMember]);

  const effectiveTmId = myMember?.id || authTmId || undefined;

  // Helper to test if a task or project item is assigned to authenticated user or their team member persona
  const isAssignedToMe = useMemo(() => {
    return (assigneeId?: string | null) => {
      if (!assigneeId) return false;
      return assigneeId === user?.id || (effectiveTmId && assigneeId === effectiveTmId);
    };
  }, [user, effectiveTmId]);

  // Personalized execution tasks (My Execution)
  const userExecution = useMemo(
    () => getUserExecutionTasks(tasks, user?.id, effectiveTmId),
    [tasks, user, effectiveTmId]
  );
  const myWorkload = useMemo(
    () => calculateUserWorkload(tasks, user?.id, effectiveTmId),
    [tasks, user, effectiveTmId]
  );

  // Worker Sales & Commissions Snapshot
  const salesSnapshot = useMemo(() => {
    const myDeals = deals.filter(d => d.sales_owner_id === user?.id || (myMember && d.sales_owner_id === myMember.profile_id));
    const activeLeads = myDeals.filter(d => d.status !== "won" && d.status !== "lost");
    const wonSales = myDeals.filter(d => d.status === "won");
    const pipelineValue = activeLeads.reduce((acc, d) => acc + (Number(d.estimated_value) || 0), 0);
    const wonRevenue = wonSales.reduce((acc, d) => acc + (Number(d.estimated_value) || 0), 0);

    const myComms = commissions.filter(c => {
      if (myMember && c.team_member_id === myMember.id) return true;
      const matchingDeal = myDeals.find(d => d.id === c.deal_id);
      return Boolean(matchingDeal);
    });

    const pendingComms = myComms
      .filter(c => c.status === "pending" || c.status === "approved")
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const paidComms = myComms
      .filter(c => c.status === "paid")
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    return {
      activeLeadsCount: activeLeads.length,
      wonSalesCount: wonSales.length,
      pipelineValue,
      wonRevenue,
      pendingComms,
      paidComms,
      totalComms: pendingComms + paidComms,
    };
  }, [deals, commissions, user, myMember]);

  // Top Deterministic Next Action (Level 1 - My Execution)
  const topNextAction = useMemo<ProjectNextAction>(() => {
    const myActive = tasks.filter(t => (user ? isAssignedToMe(t.assignee_id) : true) && t.status !== "done" && t.status !== "cancelled");

    // 1. Overdue Urgent
    const overdueUrgent = myActive.find(t => isTaskOverdue(t) && t.priority === "urgent");
    if (overdueUrgent) {
      const proj = projectMap.get(overdueUrgent.project_id);
      return {
        type: "task",
        title: overdueUrgent.title,
        subtitle: `${proj?.client_name || "Project"} · Overdue Urgent Task`,
        assigneeId: overdueUrgent.assignee_id,
        priority: overdueUrgent.priority,
        deadline: overdueUrgent.deadline,
        taskId: overdueUrgent.id,
        task: overdueUrgent,
        badgeLabel: "OVERDUE URGENT",
        badgeColor: "text-destructive bg-destructive/10 border-destructive/30",
      };
    }

    // 2. Overdue High
    const overdueHigh = myActive.find(t => isTaskOverdue(t) && t.priority === "high");
    if (overdueHigh) {
      const proj = projectMap.get(overdueHigh.project_id);
      return {
        type: "task",
        title: overdueHigh.title,
        subtitle: `${proj?.client_name || "Project"} · Overdue High Priority`,
        assigneeId: overdueHigh.assignee_id,
        priority: overdueHigh.priority,
        deadline: overdueHigh.deadline,
        taskId: overdueHigh.id,
        task: overdueHigh,
        badgeLabel: "OVERDUE HIGH",
        badgeColor: "text-destructive bg-destructive/10 border-destructive/30",
      };
    }

    // 3. Blocked task
    const blockedTask = myActive.find(t => t.status === "blocked");
    if (blockedTask) {
      const proj = projectMap.get(blockedTask.project_id);
      return {
        type: "task",
        title: blockedTask.title,
        subtitle: `${proj?.client_name || "Project"} · ${blockedTask.waiting_on === "client" ? "Waiting on Client" : "Waiting on Team"}`,
        assigneeId: blockedTask.assignee_id,
        priority: blockedTask.priority,
        deadline: blockedTask.deadline,
        taskId: blockedTask.id,
        task: blockedTask,
        badgeLabel: "BLOCKED TASK",
        badgeColor: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
      };
    }

    // 4. Task due today
    const dueToday = myActive.find(t => t.deadline && isToday(parseISO(t.deadline)));
    if (dueToday) {
      const proj = projectMap.get(dueToday.project_id);
      return {
        type: "task",
        title: dueToday.title,
        subtitle: `${proj?.client_name || "Project"} · Scheduled Due Today`,
        assigneeId: dueToday.assignee_id,
        priority: dueToday.priority,
        deadline: dueToday.deadline,
        taskId: dueToday.id,
        task: dueToday,
        badgeLabel: "DUE TODAY",
        badgeColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
      };
    }

    // 5. In Progress
    const inProg = myActive.find(t => t.status === "in_progress");
    if (inProg) {
      const proj = projectMap.get(inProg.project_id);
      return {
        type: "task",
        title: inProg.title,
        subtitle: `${proj?.client_name || "Project"} · Currently Active Work`,
        assigneeId: inProg.assignee_id,
        priority: inProg.priority,
        deadline: inProg.deadline,
        taskId: inProg.id,
        task: inProg,
        badgeLabel: "IN PROGRESS",
        badgeColor: "text-primary bg-primary/10 border-primary/30",
      };
    }

    // 6. Client Follow-up due today
    const followupDue = projects.find(p => p.followup_status === "followup_due" || (p.next_followup_date && isToday(parseISO(p.next_followup_date))));
    if (followupDue) {
      return {
        type: "followup",
        title: followupDue.followup_next_action || `Follow up with ${followupDue.client_name}`,
        subtitle: `${followupDue.client_name} · Client Communication Due`,
        assigneeId: followupDue.followup_owner_id,
        badgeLabel: "FOLLOW-UP DUE",
        badgeColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
      };
    }

    // 7. Upcoming task
    if (myActive.length > 0) {
      const nextTask = myActive[0];
      const proj = projectMap.get(nextTask.project_id);
      return {
        type: "task",
        title: nextTask.title,
        subtitle: `${proj?.client_name || "Project"} · Next Scheduled Action`,
        assigneeId: nextTask.assignee_id,
        priority: nextTask.priority,
        deadline: nextTask.deadline,
        taskId: nextTask.id,
        task: nextTask,
        badgeLabel: "NEXT ACTION",
        badgeColor: "text-primary bg-primary/10 border-primary/30",
      };
    }

    // 8. All clear
    return {
      type: "none",
      title: "Everything is up to date!",
      subtitle: "No pending tasks or urgent follow-ups required right now.",
      badgeLabel: "ALL CLEAR",
      badgeColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    };
  }, [tasks, projects, user, projectMap]);

  // Client Action Required items (waiting on client or follow-up due)
  const clientActionRequired = useMemo(() => {
    const items: { project: ProjectRow; task?: TaskRow; reason: string; nextAction: string; followupDate: string | null }[] = [];

    for (const p of projects) {
      if (p.status !== "active" && p.status !== "on_hold") continue;

      const pTasks = tasksByProject[p.id] || [];
      const blockedOnClient = pTasks.filter(t => t.status === "blocked" && t.waiting_on === "client");

      if (blockedOnClient.length > 0) {
        for (const bt of blockedOnClient) {
          items.push({
            project: p,
            task: bt,
            reason: bt.blocked_reason || "Waiting for client assets or feedback",
            nextAction: `Follow up on: ${bt.title}`,
            followupDate: bt.deadline,
          });
        }
      } else if (p.followup_status === "waiting_for_client" || p.followup_status === "followup_due") {
        items.push({
          project: p,
          reason: p.followup_summary || "Client communication pending",
          nextAction: p.followup_next_action || `Follow up with ${p.client_name}`,
          followupDate: p.next_followup_date || null,
        });
      }
    }

    return items;
  }, [projects, tasksByProject]);

  // Blocked work (all tasks blocked across agency)
  const blockedTasksList = useMemo(() => {
    return tasks.filter(t => t.status === "blocked");
  }, [tasks]);

  // Upcoming deliveries grouped by project
  const upcomingDeliveries = useMemo(() => {
    return getDeliveriesByProject(projects, tasks);
  }, [projects, tasks]);

  // Projects Needing Attention
  const projectsNeedingAttention = useMemo(() => {
    return getProjectsNeedingAttention(projects, tasks);
  }, [projects, tasks]);

  // Team Pulse — Unified with team_members as single source of truth
  const teamPulse = useMemo(() => {
    return getTeamPulse(teamMembers, tasks, profiles);
  }, [teamMembers, tasks, profiles]);

  // Due Soon tasks (Today, Tomorrow, This Week)
  const dueSoonTasks = useMemo(() => {
    return tasks
      .filter(t => t.deadline && !isPast(new Date(t.deadline + "T23:59:59")) && t.status !== "done" && t.status !== "cancelled")
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 6);
  }, [tasks]);

  // =========================================================================
  // AGENCY OVERSIGHT DETERMINISTIC DATA & EXCEPTIONS
  // =========================================================================
  const agencyUnassignedTasks = useMemo(() => getAgencyUnassignedTasks(tasks), [tasks]);
  const agencyOverdueTasks = useMemo(() => getAgencyOverdueTasks(tasks), [tasks]);
  const agencyBlockedTasks = useMemo(() => getAgencyBlockedTasks(tasks), [tasks]);

  // =========================================================================
  // CANONICAL OPERATIONAL EXCEPTIONS DEDUPLICATION (DEF-ECC-04, DEF-ECC-05)
  // Deduplicates tasks that belong to multiple categories (e.g. Overdue + Unassigned)
  // Ensures distinct entity counting, composite badges, and zero duplicate cards.
  // =========================================================================
  type ExceptionCategory = "overdue" | "blocked" | "unassigned" | "client_action";

  type OversightExceptionItem =
    | {
        kind: "unified_task";
        id: string; // `task-${task.id}`
        task: TaskRow;
        categories: ExceptionCategory[];
        primaryCategory: ExceptionCategory;
        clientActionReason?: string;
      }
    | {
        kind: "client_action_project";
        id: string; // `proj-${project.id}`
        item: {
          project: ProjectRow;
          task?: TaskRow;
          reason: string;
          nextAction: string;
          followupDate: string | null;
        };
      }
    | {
        kind: "at_risk";
        id: string;
        project: ProjectRow;
        health: { label: string; color: string; bg: string; border: string };
        reason: string;
        progress: { total: number; done: number; percent: number };
      };

  // 1. Build canonical deduplicated exception items
  const { allUniqueOperationalExceptions, needsAttentionFeedCount } = useMemo(() => {
    const taskMap = new Map<string, {
      task: TaskRow;
      categories: ExceptionCategory[];
      primaryCategory: ExceptionCategory;
      clientActionReason?: string;
    }>();

    const registerTaskException = (t: TaskRow, category: ExceptionCategory, reason?: string) => {
      let existing = taskMap.get(t.id);
      if (!existing) {
        existing = {
          task: t,
          categories: [],
          primaryCategory: category,
          clientActionReason: reason,
        };
        taskMap.set(t.id, existing);
      }
      if (!existing.categories.includes(category)) {
        existing.categories.push(category);
      }
      if (reason && !existing.clientActionReason) {
        existing.clientActionReason = reason;
      }
      const priorityOrder: Record<ExceptionCategory, number> = {
        blocked: 4,
        overdue: 3,
        client_action: 2,
        unassigned: 1,
      };
      if (priorityOrder[category] > priorityOrder[existing.primaryCategory]) {
        existing.primaryCategory = category;
      }
    };

    // A. Overdue tasks
    for (const t of agencyOverdueTasks) {
      registerTaskException(t, "overdue");
    }

    // B. Blocked tasks
    for (const t of agencyBlockedTasks) {
      registerTaskException(t, "blocked");
    }

    // C. Unassigned tasks
    for (const t of agencyUnassignedTasks) {
      registerTaskException(t, "unassigned");
    }

    // D. Client Action items
    const distinctProjectClientActions: {
      project: ProjectRow;
      task?: TaskRow;
      reason: string;
      nextAction: string;
      followupDate: string | null;
    }[] = [];

    for (let idx = 0; idx < clientActionRequired.length; idx++) {
      const ca = clientActionRequired[idx];
      if (ca.task) {
        registerTaskException(ca.task, "client_action", ca.reason);
      } else {
        distinctProjectClientActions.push(ca);
      }
    }

    const uniqueTaskItems: OversightExceptionItem[] = Array.from(taskMap.values()).map(entry => ({
      kind: "unified_task",
      id: `task-${entry.task.id}`,
      task: entry.task,
      categories: entry.categories,
      primaryCategory: entry.primaryCategory,
      clientActionReason: entry.clientActionReason,
    }));

    const projectItems: OversightExceptionItem[] = distinctProjectClientActions.map(ca => ({
      kind: "client_action_project",
      id: `proj-${ca.project.id}`,
      item: ca,
    }));

    const all = [...uniqueTaskItems, ...projectItems];
    return {
      allUniqueOperationalExceptions: all,
      needsAttentionFeedCount: all.length,
    };
  }, [agencyOverdueTasks, agencyBlockedTasks, agencyUnassignedTasks, clientActionRequired]);

  // Total Critical Operational Exceptions count across SADA (Scope Switcher badge)
  const totalAgencyExceptions = useMemo(() => {
    return needsAttentionFeedCount + projectsNeedingAttention.length;
  }, [needsAttentionFeedCount, projectsNeedingAttention.length]);

  // Filtered active exceptions based on active tab
  const activeExceptions = useMemo<OversightExceptionItem[]>(() => {
    if (oversightTab === "all") {
      return allUniqueOperationalExceptions;
    }

    if (oversightTab === "overdue") {
      return allUniqueOperationalExceptions.filter(exc =>
        exc.kind === "unified_task" && exc.categories.includes("overdue")
      );
    }

    if (oversightTab === "blocked") {
      return allUniqueOperationalExceptions.filter(exc =>
        exc.kind === "unified_task" && exc.categories.includes("blocked")
      );
    }

    if (oversightTab === "unassigned") {
      return allUniqueOperationalExceptions.filter(exc =>
        exc.kind === "unified_task" && exc.categories.includes("unassigned")
      );
    }

    if (oversightTab === "client_action") {
      return allUniqueOperationalExceptions.filter(exc =>
        (exc.kind === "unified_task" && exc.categories.includes("client_action")) ||
        exc.kind === "client_action_project"
      );
    }

    if (oversightTab === "at_risk") {
      return projectsNeedingAttention.map(p => ({
        kind: "at_risk",
        id: `ar-${p.project.id}`,
        project: p.project,
        health: p.health,
        reason: p.reason,
        progress: p.progress,
      }));
    }

    return allUniqueOperationalExceptions;
  }, [
    oversightTab,
    allUniqueOperationalExceptions,
    projectsNeedingAttention,
  ]);

  const visibleExceptions = isExceptionsExpanded ? activeExceptions : activeExceptions.slice(0, 3);

  // Capacity pressure overview
  const capacityAlerts = useMemo(() => {
    const overloaded = teamPulse.filter(m => m.capacityBadge.label === "Overloaded");
    const heavyLoad = teamPulse.filter(m => m.capacityBadge.label === "Heavy Load");
    return { overloaded, heavyLoad };
  }, [teamPulse]);

  // Quick inline status transition for tasks
  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const isDone = newStatus === "done";
    const { error } = await (supabase as any)
      .from("project_tasks")
      .update({
        status: newStatus,
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .eq("id", taskId);

    if (error) {
      toast.error(error.message);
      return;
    }

    await (supabase as any).from("project_activity").insert({
      project_id: targetTask.project_id,
      task_id: taskId,
      actor_id: user?.id ?? null,
      action: isDone ? "completed" : "status_changed",
      details: { from: targetTask.status, to: newStatus },
    });

    toast.success(`Task status updated to ${STATUS_CONFIG[newStatus].label}`);
    loadData();
  };

  const openFollowupForProject = (proj: ProjectRow) => {
    setFollowupProject(proj);
    setShowFollowupModal(true);
  };

  const isInitialLoad = projects.length === 0 && tasks.length === 0 && clients.length === 0;
  if (loading && isInitialLoad) {
    return <ExecutiveDashboardSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* =====================================================================
          HEADER & SCOPE SWITCHER BAR
      ===================================================================== */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-4 border-b border-border pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs uppercase font-mono font-bold tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              {t("commandCenter.scopes.pulseBadge", "SADA WORK OS")}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-[11px] sm:text-xs font-mono text-muted-foreground">
              {formatDate(new Date(), "EEE, d MMM yyyy")}
            </span>
          </div>

          <h1 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {dashboardScope === "executive_command"
              ? t("commandCenter.scopes.executiveCommand", "Executive Command Center")
              : dashboardScope === "my_execution"
              ? t("commandCenter.scopes.myExecution", "Today's Execution Command")
              : t("commandCenter.scopes.agencyOversight", "Agency Oversight Command Center")}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 sm:mt-1 max-w-2xl leading-relaxed">
            {dashboardScope === "executive_command"
              ? t("commandCenter.scopes.executiveDesc", "Agency pulse: financial health, operations, clients, performance and risks.")
              : dashboardScope === "my_execution"
              ? t("commandCenter.scopes.myExecutionDesc", "Personal daily guide: what to do first, what is urgent, what is blocked, and deliverables expected today.")
              : t("commandCenter.scopes.agencyOversightDesc", "Operational exception control: overdue deliverables, blocked workflows, unassigned tasks, and client-delayed projects across SADA.")}
          </p>
        </div>

        {/* Dashboard Scope Switcher & Desktop Quick Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 max-w-full">
          {/* SCOPE SWITCHER: COMMAND vs MY EXECUTION vs AGENCY */}
          <div className="grid grid-cols-3 p-1 rounded-xl sm:rounded-2xl bg-muted/80 border border-border shadow-2xs w-full sm:w-auto shrink-0">
            {(isSuperAdmin || isAdmin || canAccessModule("analytics")) && (
              <button
                type="button"
                onClick={() => setDashboardScope("executive_command")}
                className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  dashboardScope === "executive_command"
                    ? "bg-primary text-primary-foreground shadow-xs font-extrabold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className="size-3.5 shrink-0" />
                <span>{t("commandCenter.scopes.commandShort", "Command")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDashboardScope("my_execution")}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                dashboardScope === "my_execution"
                  ? "bg-primary text-primary-foreground shadow-xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="size-3.5 shrink-0" />
              <span>{t("commandCenter.scopes.myExecutionShort", "My Execution")}</span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardScope("agency_oversight")}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                dashboardScope === "agency_oversight"
                  ? "bg-primary text-primary-foreground shadow-xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="size-3.5 shrink-0" />
              <span>{t("commandCenter.scopes.agencyShort", "Agency")}</span>
              {totalAgencyExceptions > 0 && (
                <span className="size-4 rounded-full bg-destructive text-white text-[10px] font-mono font-extrabold grid place-items-center ms-0.5">
                  {totalAgencyExceptions}
                </span>
              )}
            </button>
          </div>

          {/* Desktop Quick Actions (Hidden on mobile < md where 3-card grid is shown below) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="size-3.5" /> {t("commandCenter.quickActions.newTask", "New Task")}
            </button>

            <Link
              to="/admin/client-workspaces"
              className="bg-card border border-border hover:bg-muted text-foreground px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FolderKanban className="size-3.5 text-primary" /> {t("admin.clientWorkspaces", "Workspaces")}
            </Link>

            {/* Desktop Log Follow-up Popover */}
            <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <PhoneCall className="size-3.5" /> {isAr ? "متابعة" : "Follow-up"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 rounded-2xl border-border shadow-xl z-50" align="end">
                <Command className="rounded-2xl">
                  <CommandInput placeholder="Choose project to log follow-up..." className="text-xs h-10" />
                  <CommandList className="max-h-60 p-1">
                    <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No active project found.</CommandEmpty>
                    <CommandGroup>
                      {projects.map((p) => (
                        <CommandItem
                          key={p.id}
                          onSelect={() => {
                            setProjectPickerOpen(false);
                            openFollowupForProject(p);
                          }}
                          className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">{p.client_name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{p.title}</div>
                          </div>
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Mobile Compact Action Strip (< md) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-card border border-border shadow-2xs md:hidden w-full">
          {/* Action 1: New Task */}
          <button
            type="button"
            onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
            className="h-9 px-2 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-1.5 font-bold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer truncate"
          >
            <Plus className="size-3.5 shrink-0" />
            <span className="truncate">{t("commandCenter.quickActions.newTask", "New Task")}</span>
          </button>

          {/* Action 2: Workspaces */}
          <Link
            to="/admin/client-workspaces"
            className="h-9 px-2 rounded-lg bg-muted/60 hover:bg-muted text-foreground flex items-center justify-center gap-1.5 font-semibold text-xs border border-border/60 transition-all active:scale-95 cursor-pointer truncate"
          >
            <FolderKanban className="size-3.5 text-primary shrink-0" />
            <span className="truncate">{isAr ? "مساحات العمل" : "Workspaces"}</span>
          </Link>

          {/* Action 3: Follow-up */}
          <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-9 px-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center gap-1.5 font-semibold text-xs transition-all active:scale-95 cursor-pointer truncate"
              >
                <PhoneCall className="size-3.5 shrink-0" />
                <span className="truncate">{isAr ? "متابعة" : "Follow-up"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-2xl border-border shadow-xl z-50" align="end">
              <Command className="rounded-2xl">
                <CommandInput placeholder="Choose project to log follow-up..." className="text-xs h-10" />
                <CommandList className="max-h-60 p-1">
                  <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No active project found.</CommandEmpty>
                  <CommandGroup>
                    {projects.map((p) => (
                      <CommandItem
                        key={p.id}
                        onSelect={() => {
                          setProjectPickerOpen(false);
                          openFollowupForProject(p);
                        }}
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{p.client_name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.title}</div>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* =====================================================================
          MODE 0: EXECUTIVE COMMAND CENTER (PHASE 9)
          Answers: Financial, Operational, Client & Team Pulse + Risk Intelligence
      ===================================================================== */}
      {dashboardScope === "executive_command" && (
        analyticsData ? (
          <ExecutiveCommandCenter
            analyticsData={analyticsData}
            tasks={tasks}
            projects={projects}
            isSuperAdmin={isSuperAdmin}
            onOpenDrillDown={(drill) => setDrillDownState(drill)}
            onSelectTask={(task) => setInspectingTask(task)}
          />
        ) : (
          <ExecutiveDashboardSkeleton />
        )
      )}

      {/* =====================================================================
          MODE A: MY EXECUTION
          Answers: "What do I personally need to do?"
      ===================================================================== */}
      {dashboardScope === "my_execution" && (
        <div className="space-y-6">
          {/* LEVEL 1 — "DO THIS NEXT" (DETERMINISTIC PERSONAL TOP ACTION) */}
          {topNextAction && (
            <div className="p-5 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card elevated-shadow space-y-3 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                      LEVEL 1 · DO THIS NEXT
                    </span>
                    <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md border ${topNextAction.badgeColor}`}>
                      {topNextAction.badgeLabel}
                    </span>
                    {topNextAction.priority && (
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PRIORITY_CONFIG[topNextAction.priority].bg} ${PRIORITY_CONFIG[topNextAction.priority].color}`}>
                        {PRIORITY_CONFIG[topNextAction.priority].label} Priority
                      </span>
                    )}
                  </div>

                  <h2 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-tight truncate">
                    {topNextAction.title}
                  </h2>

                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>{topNextAction.subtitle}</span>
                    {topNextAction.deadline && (
                      <span>· Deadline: <strong>{format(parseISO(topNextAction.deadline), "d MMM yyyy")}</strong></span>
                    )}
                    {topNextAction.assigneeId && (
                      <span>· Assigned to: <strong>{profileMap.get(topNextAction.assigneeId) || "You"}</strong></span>
                    )}
                  </div>
                </div>

                {/* Direct Action Trigger */}
                <div className="shrink-0 flex items-center gap-2">
                  {topNextAction.task ? (
                    <button
                      onClick={() => setInspectingTask(topNextAction.task!)}
                      className="bg-gradient-primary text-white px-5 py-2.5 rounded-2xl text-xs font-semibold inline-flex items-center gap-1.5 neon-glow hover:scale-[1.02] transition-transform shadow-md"
                    >
                      <span>Open Task</span>
                      <ArrowRight className="size-4" />
                    </button>
                  ) : topNextAction.type === "followup" ? (
                    <button
                      onClick={() => {
                        const proj = projects.find(p => p.followup_status === "followup_due");
                        if (proj) openFollowupForProject(proj);
                      }}
                      className="bg-gradient-primary text-white px-5 py-2.5 rounded-2xl text-xs font-semibold inline-flex items-center gap-1.5 neon-glow hover:scale-[1.02] transition-transform shadow-md"
                    >
                      <span>Log Follow-up</span>
                      <PhoneCall className="size-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 1.5 — SALES & COMMISSION WORKSPACE SNAPSHOT */}
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 elevated-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-md">
                    <TrendingUp className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">Worker Sales & Commissions Hub</h3>
                    <p className="text-xs text-muted-foreground">Your active leads, closed deals, and earned commissions</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/admin/sales"
                  className="bg-gradient-primary text-white px-4 py-2 rounded-2xl text-xs font-semibold inline-flex items-center gap-1.5 neon-glow hover:scale-[1.02] transition-transform shadow-md"
                >
                  <span>Open Sales Workspace</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl border border-border bg-background/50 space-y-1">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Active Leads</div>
                <div className="text-xl font-bold font-mono text-foreground">{salesSnapshot.activeLeadsCount}</div>
                <div className="text-[10px] text-muted-foreground">In pipeline</div>
              </div>

              <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                <div className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-semibold">Won Deals</div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{salesSnapshot.wonSalesCount}</div>
                <div className="text-[10px] text-emerald-600/80">Converted sales</div>
              </div>

              <div className="p-3.5 rounded-2xl border border-border bg-background/50 space-y-1">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Pipeline Value</div>
                <div className="text-xl font-bold font-mono text-foreground">{salesSnapshot.pipelineValue.toLocaleString()} <span className="text-xs font-normal">TND</span></div>
                <div className="text-[10px] text-muted-foreground">Estimated</div>
              </div>

              <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/5 space-y-1">
                <div className="text-[10px] font-mono uppercase text-primary font-semibold">Won Revenue</div>
                <div className="text-xl font-bold font-mono text-primary">{salesSnapshot.wonRevenue.toLocaleString()} <span className="text-xs font-normal">TND</span></div>
                <div className="text-[10px] text-muted-foreground">Closed volume</div>
              </div>

              <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                <div className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-semibold">Pending Comm.</div>
                <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{salesSnapshot.pendingComms.toLocaleString()} <span className="text-xs font-normal">TND</span></div>
                <div className="text-[10px] text-amber-600/80">Awaiting approval/pay</div>
              </div>

              <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                <div className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-semibold">Paid Comm.</div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{salesSnapshot.paidComms.toLocaleString()} <span className="text-xs font-normal">TND</span></div>
                <div className="text-[10px] text-emerald-600/80">Total received</div>
              </div>
            </div>
          </div>

          {/* LEVEL 2 — MY DAY / TODAY'S EXECUTION (GROUPED TASK STATES) */}
          <div className="rounded-3xl border border-border bg-card p-5 md:p-7 elevated-shadow space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-xl bg-gradient-primary text-white text-xs font-bold grid place-items-center">
                    MY
                  </span>
                  <h2 className="font-display font-bold text-xl">My Day Execution</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tasks assigned to you requiring action today, grouped by operational state.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border overflow-x-auto scrollbar-none self-start sm:self-auto">
                {(["all", "todo", "in_progress", "review", "blocked", "done"] as const).map(tKey => (
                  <button
                    key={tKey}
                    onClick={() => setExecutionTab(tKey)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold capitalize transition-all whitespace-nowrap ${
                      executionTab === tKey
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tKey === "all" ? "All My Tasks" : tKey.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Cards Grid */}
            {userExecution.overdue.length === 0 &&
             userExecution.dueToday.length === 0 &&
             userExecution.inProgress.length === 0 &&
             userExecution.todo.length === 0 &&
             userExecution.review.length === 0 &&
             userExecution.blocked.length === 0 &&
             userExecution.doneToday.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl space-y-2">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
                <div className="font-semibold text-sm text-foreground">You are all clear!</div>
                <p className="text-muted-foreground">No pending tasks currently assigned to you.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* 1. OVERDUE TASKS FIRST */}
                {(executionTab === "all" || executionTab === "todo") &&
                  userExecution.overdue.map(t => {
                    const proj = projectMap.get(t.project_id);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-destructive/40 bg-destructive/5 hover:bg-destructive/10 transition-all space-y-3 flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-destructive uppercase tracking-wider">{proj?.client_name || "Project"}</span>
                            <span className="text-destructive font-extrabold bg-destructive/10 px-2 py-0.5 rounded">OVERDUE</span>
                          </div>
                          <h3
                            onClick={() => setInspectingTask(t)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2"
                          >
                            {t.title}
                          </h3>
                          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                            <span>Deadline: <strong className="text-destructive">{t.deadline ? format(parseISO(t.deadline), "d MMM") : ""}</strong></span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_CONFIG[t.priority].bg} ${PRIORITY_CONFIG[t.priority].color}`}>
                              {PRIORITY_CONFIG[t.priority].label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-destructive/20 text-xs">
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "in_progress")}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <Play className="size-3" /> Start
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "done")}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Check className="size-3" /> Done
                          </button>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Detail →
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* 2. DUE TODAY TASKS */}
                {(executionTab === "all" || executionTab === "todo") &&
                  userExecution.dueToday.map(t => {
                    const proj = projectMap.get(t.project_id);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition-all space-y-3 flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{proj?.client_name || "Project"}</span>
                            <span className="text-amber-600 dark:text-amber-400 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded">DUE TODAY</span>
                          </div>
                          <h3
                            onClick={() => setInspectingTask(t)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2"
                          >
                            {t.title}
                          </h3>
                          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                            <span>{t.service || t.category || "General"}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_CONFIG[t.priority].bg} ${PRIORITY_CONFIG[t.priority].color}`}>
                              {PRIORITY_CONFIG[t.priority].label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs">
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "in_progress")}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <Play className="size-3" /> Start
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "done")}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Check className="size-3" /> Done
                          </button>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Detail →
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* 3. IN PROGRESS TASKS */}
                {(executionTab === "all" || executionTab === "in_progress") &&
                  userExecution.inProgress.map(t => {
                    const proj = projectMap.get(t.project_id);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all space-y-3 flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-foreground uppercase tracking-wider">{proj?.client_name || "Project"}</span>
                            <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">IN PROGRESS</span>
                          </div>
                          <h3
                            onClick={() => setInspectingTask(t)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2"
                          >
                            {t.title}
                          </h3>
                          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                            <span>{t.deadline ? format(parseISO(t.deadline), "d MMM") : "No date"}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_CONFIG[t.priority].bg} ${PRIORITY_CONFIG[t.priority].color}`}>
                              {PRIORITY_CONFIG[t.priority].label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-primary/20 text-xs">
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "review")}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <Eye className="size-3" /> Review
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "done")}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Check className="size-3" /> Done
                          </button>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Detail →
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* 4. BLOCKED & REVIEW TASKS */}
                {(executionTab === "all" || executionTab === "review" || executionTab === "blocked") &&
                  [...userExecution.review, ...userExecution.blocked].map(t => {
                    const proj = projectMap.get(t.project_id);
                    const isBlocked = t.status === "blocked";
                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between group ${
                          isBlocked
                            ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10"
                            : "border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-foreground uppercase tracking-wider">{proj?.client_name || "Project"}</span>
                            <span className={`font-bold px-2 py-0.5 rounded ${isBlocked ? "text-rose-600 bg-rose-500/10" : "text-indigo-600 bg-indigo-500/10"}`}>
                              {t.status.toUpperCase()}
                            </span>
                          </div>
                          <h3
                            onClick={() => setInspectingTask(t)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2"
                          >
                            {t.title}
                          </h3>
                          <div className="text-[11px] text-muted-foreground">
                            {isBlocked ? (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                {t.waiting_on === "client" ? "Waiting on client" : "Waiting on team"} · {t.blocked_reason || "No reason given"}
                              </span>
                            ) : (
                              <span>Pending review & sign-off</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "in_progress")}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <Play className="size-3" /> Resume
                          </button>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Detail →
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* 5. TO DO (SCHEDULED / UPCOMING) TASKS */}
                {(executionTab === "all" || executionTab === "todo") &&
                  userExecution.todo.map(t => {
                    const proj = projectMap.get(t.project_id);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/20 transition-all space-y-3 flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">{proj?.client_name || "Project"}</span>
                            <span className="font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">TO DO</span>
                          </div>
                          <h3
                            onClick={() => setInspectingTask(t)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2"
                          >
                            {t.title}
                          </h3>
                          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                            <span>{t.deadline ? format(parseISO(t.deadline), "d MMM") : (t.service || t.category || "Task")}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_CONFIG[t.priority].bg} ${PRIORITY_CONFIG[t.priority].color}`}>
                              {PRIORITY_CONFIG[t.priority].label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "in_progress")}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <Play className="size-3" /> Start
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(t.id, "done")}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Check className="size-3" /> Done
                          </button>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Detail →
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* 6. DONE TODAY TASKS */}
                {(executionTab === "all" || executionTab === "done") &&
                  userExecution.doneToday.map(t => {
                    const proj = projectMap.get(t.project_id);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all space-y-3 flex flex-col justify-between group opacity-90"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-emerald-600 uppercase tracking-wider">{proj?.client_name || "Project"}</span>
                            <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">DONE TODAY</span>
                          </div>
                          <h3
                            onClick={() => setInspectingTask(t)}
                            className="font-semibold text-sm text-foreground line-through line-clamp-2 cursor-pointer"
                          >
                            {t.title}
                          </h3>
                          <div className="text-[11px] text-muted-foreground">
                            Completed today
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 text-xs">
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="size-3" /> Completed
                          </span>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Detail →
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* LEVEL 3 — CLIENT ACTION REQUIRED & BLOCKED WORK */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* CLIENT ACTION REQUIRED */}
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhoneCall className="size-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">Client Action Required</h3>
                    <p className="text-xs text-muted-foreground">Projects and tasks waiting on client input or assets</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  {clientActionRequired.length} WAITING
                </span>
              </div>

              {clientActionRequired.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-amber-500/20 rounded-2xl">
                  No client action needed. All client communications up to date!
                </div>
              ) : (
                <div className="space-y-3">
                  {clientActionRequired.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-amber-500/20 bg-card hover:bg-amber-500/10 transition-all space-y-2">
                      <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                        <span className="font-bold text-foreground truncate min-w-0 flex-1">{item.project.client_name}</span>
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold uppercase shrink-0">
                          {item.followupDate ? format(parseISO(item.followupDate), "d MMM") : "Waiting"}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Waiting for:</strong> {item.reason}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border text-xs gap-2 min-w-0">
                        <span className="text-[11px] text-primary font-medium truncate min-w-0 flex-1">
                          {item.nextAction}
                        </span>
                        <button
                          onClick={() => openFollowupForProject(item.project)}
                          className="px-2.5 sm:px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-semibold hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1 shrink-0"
                        >
                          <PhoneCall className="size-3" /> Log Contact
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BLOCKED WORK */}
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">Blocked Work</h3>
                    <p className="text-xs text-muted-foreground">Tasks currently stopped due to blockers</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                  {blockedTasksList.length} BLOCKED
                </span>
              </div>

              {blockedTasksList.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-rose-500/20 rounded-2xl">
                  No blocked work. Operations are moving forward smoothly!
                </div>
              ) : (
                <div className="space-y-3">
                  {blockedTasksList.slice(0, 4).map(t => {
                    const proj = projectMap.get(t.project_id);
                    return (
                      <div key={t.id} className="p-4 rounded-2xl border border-rose-500/20 bg-card hover:bg-rose-500/10 transition-all space-y-2">
                        <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                          <span className="font-semibold text-foreground truncate min-w-0 flex-1">{t.title}</span>
                          <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold uppercase shrink-0">
                            {t.waiting_on === "client" ? "Client Blocker" : "Team Blocker"}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <strong className="text-foreground">Project:</strong> {proj?.client_name || "Project"} · <strong className="text-foreground">Reason:</strong> {t.blocked_reason || "No details provided"}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs gap-2 min-w-0">
                          <span className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">
                            Owner: {profileMap.get(t.assignee_id || "") || "Unassigned"}
                          </span>
                          <button
                            onClick={() => setInspectingTask(t)}
                            className="px-2.5 sm:px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/30 text-[11px] font-semibold hover:bg-primary/20 transition-colors shrink-0"
                          >
                            <span className="hidden sm:inline">Inspect & Unblock →</span>
                            <span className="sm:hidden">Unblock →</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LEVEL 4 — UPCOMING DELIVERIES & DUE SOON */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* UPCOMING DELIVERIES */}
            <div className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h3 className="font-display font-bold text-lg">Upcoming Deliveries</h3>
                    <p className="text-xs text-muted-foreground">Expected client deliverables grouped by project</p>
                  </div>
                </div>
              </div>

              {upcomingDeliveries.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No active deliverables configured.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingDeliveries.slice(0, 4).map(item => (
                    <div key={item.project.id} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{item.project.client_name}</span>
                        <Link
                          to={"/admin/client-workspaces/$id" as any}
                          params={{ id: item.project.client_id || item.project.id } as any}
                          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          Open Workspace <ArrowUpRight className="size-3" />
                        </Link>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {item.deliverables.slice(0, 3).map(d => (
                          <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-card border border-border/60">
                            <span className="truncate mr-2 font-medium text-foreground flex items-center gap-1.5">
                              <CheckCircle2 className={`size-3.5 shrink-0 ${d.status === "done" ? "text-emerald-500" : "text-muted-foreground"}`} />
                              <span>{d.title}</span>
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {d.deadline ? format(parseISO(d.deadline), "d MMM") : "Target"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DUE SOON SUMMARY */}
            <div className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-amber-500" />
                  <div>
                    <h3 className="font-display font-bold text-lg">Due Soon Schedule</h3>
                    <p className="text-xs text-muted-foreground">Upcoming task deadlines across all projects</p>
                  </div>
                </div>
                <Link to="/admin/calendar" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  Calendar <ChevronRight className="size-3.5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {dueSoonTasks.map(t => {
                  const proj = projectMap.get(t.project_id);
                  const d = parseISO(t.deadline!);
                  const today = isToday(d);
                  const tomorrow = isTomorrow(d);

                  return (
                    <div
                      key={t.id}
                      onClick={() => setInspectingTask(t)}
                      className="p-3.5 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="truncate max-w-[130px] font-bold text-muted-foreground">{proj?.client_name || "Project"}</span>
                        <span className={`font-bold ${today ? "text-amber-600 dark:text-amber-400" : tomorrow ? "text-amber-500" : "text-foreground"}`}>
                          {today ? "Today" : tomorrow ? "Tomorrow" : format(d, "d MMM")}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-foreground truncate">{t.title}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>{t.service || t.category || "Task"}</span>
                        <span>{profileMap.get(t.assignee_id || "") || "Unassigned"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEVEL 5 — PROJECTS NEEDING ATTENTION & MY WORKLOAD */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* PROJECTS NEEDING ATTENTION */}
            <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg">Projects Needing Attention</h3>
                  <p className="text-xs text-muted-foreground">Active client projects flagged as at risk, overdue, or client waiting</p>
                </div>
                <Link to="/admin/client-workspaces" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  All Client Workspaces ({projects.length}) <ChevronRight className="size-3.5" />
                </Link>
              </div>

              {projectsNeedingAttention.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">All active projects are running smoothly on track!</p>
              ) : (
                <div className="space-y-3">
                  {projectsNeedingAttention.slice(0, 5).map(item => (
                    <Link
                      key={item.project.id}
                      to={"/admin/client-workspaces/$id" as any}
                      params={{ id: item.project.client_id || item.project.id } as any}
                      className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:bg-muted/30 transition-all group"
                    >
                      <div className="min-w-0 flex-1 mr-4 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{item.project.client_name}</span>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${item.health.color} ${item.health.bg} ${item.health.border}`}>
                            {item.health.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.project.title} · <span className="text-foreground font-medium">{item.reason}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="font-mono text-sm font-bold text-foreground">{item.progress.percent}%</div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.project.deadline ? format(parseISO(item.project.deadline), "d MMM") : "No deadline"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* MY WORKLOAD STATS */}
            <div className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg">My Workload Intensity</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${myWorkload.intensityBg} ${myWorkload.intensityColor}`}>
                  {myWorkload.intensity}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-muted-foreground font-medium">Active Tasks Assigned</span>
                  <span className="font-mono font-bold text-foreground text-sm">{myWorkload.activeCount}</span>
                </div>

                <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Tasks Due Today</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">{myWorkload.dueTodayCount}</span>
                </div>

                <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-destructive/10 border border-destructive/20">
                  <span className="text-destructive font-medium">Tasks Overdue</span>
                  <span className="font-mono font-bold text-destructive text-sm">{myWorkload.overdueCount}</span>
                </div>

                <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed Today</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">{myWorkload.completedTodayCount}</span>
                </div>
              </div>

              <Link
                to="/admin/team-workload"
                className="block text-center text-xs font-semibold text-primary hover:underline pt-2"
              >
                View Team Workload Radar →
              </Link>
            </div>
          </div>

          {/* LEVEL 6 — TEAM PULSE & CONTENT COUNTERS */}
          <div className="space-y-6 pt-4 border-t border-border">
            {/* TEAM PULSE — Powered by unified team_members source of truth */}
            <div className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg">Team Pulse</h3>
                  <p className="text-xs text-muted-foreground">Operational task distribution across active team members</p>
                </div>
                <Link to="/admin/team-workload" className="text-xs font-semibold text-primary hover:underline">
                  Team Capacity →
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {teamPulse.map(m => (
                  <div key={m.member.id} className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {m.member.photo_url ? (
                          <img
                            src={m.member.photo_url}
                            alt={m.member.name}
                            className="size-6 rounded-full object-cover shrink-0 ring-1 ring-border"
                          />
                        ) : (
                          <span className="size-6 rounded-full bg-gradient-primary text-white text-[9px] font-bold grid place-items-center shrink-0">
                            {(m.member.name || "?")[0].toUpperCase()}
                          </span>
                        )}
                        <span className="font-semibold text-xs text-foreground truncate">
                          {m.member.name}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${m.capacityBadge.color}`}>
                        {m.activeCount} active
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-1">
                      {m.topTaskTitle ? (
                        <div className="truncate font-medium text-foreground">
                          Focus: {m.topTaskTitle}
                        </div>
                      ) : (
                        <div className="italic text-[10px]">No active task</div>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {m.urgentCount > 0 && <span className="text-destructive font-bold">{m.urgentCount} urgent</span>}
                        {m.dueTodayCount > 0 && <span className="text-amber-600 font-bold">{m.dueTodayCount} due today</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CONTENT MANAGEMENT COUNTERS (DE-EMPHASIZED) */}
            <div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3 font-mono">
                System Content Records
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {CONTENT_CARDS.map(c => (
                  <div key={c.table} className="rounded-2xl border border-border bg-card p-3.5 soft-shadow space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[10px] uppercase tracking-wider font-mono">{c.label}</span>
                      <c.Icon className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-xl font-display font-bold text-gradient">{counts[c.table] ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE B: AGENCY OVERSIGHT
          Answers: "What needs my attention across SADA?"
      ===================================================================== */}
      {dashboardScope === "agency_oversight" && (
        <div className="space-y-6">
          {/* SECTION 1 — AGENCY EXCEPTION OVERVIEW (5 CRITICAL COUNTS) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. OVERDUE */}
            <div
              onClick={() => setOversightTab("overdue")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                oversightTab === "overdue"
                  ? "border-destructive bg-destructive/15 ring-2 ring-destructive/20 shadow-sm"
                  : "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-destructive">Overdue</span>
                <AlertTriangle className="size-3.5 text-destructive" />
              </div>
              <div className="text-2xl md:text-3xl font-display font-bold text-destructive">
                {agencyOverdueTasks.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Late deliveries & tasks</div>
            </div>

            {/* 2. BLOCKED */}
            <div
              onClick={() => setOversightTab("blocked")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                oversightTab === "blocked"
                  ? "border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/20 shadow-sm"
                  : "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-600 dark:text-rose-400">Blocked</span>
                <ShieldAlert className="size-3.5 text-rose-500" />
              </div>
              <div className="text-2xl md:text-3xl font-display font-bold text-rose-600 dark:text-rose-400">
                {agencyBlockedTasks.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Stopped execution items</div>
            </div>

            {/* 3. UNASSIGNED */}
            <div
              onClick={() => setOversightTab("unassigned")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                oversightTab === "unassigned"
                  ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/20 shadow-sm"
                  : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400">Unassigned</span>
                <User className="size-3.5 text-amber-500" />
              </div>
              <div className="text-2xl md:text-3xl font-display font-bold text-amber-600 dark:text-amber-400">
                {agencyUnassignedTasks.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Active work without owner</div>
            </div>

            {/* 4. CLIENT ACTION */}
            <div
              onClick={() => setOversightTab("client_action")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                oversightTab === "client_action"
                  ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/20 shadow-sm"
                  : "border-amber-500/20 bg-card hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-foreground">Client Action</span>
                <PhoneCall className="size-3.5 text-amber-500" />
              </div>
              <div className="text-2xl md:text-3xl font-display font-bold text-foreground">
                {clientActionRequired.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Waiting on client/assets</div>
            </div>

            {/* 5. AT RISK PROJECTS */}
            <div
              onClick={() => setOversightTab("at_risk")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1 col-span-2 sm:col-span-1 ${
                oversightTab === "at_risk"
                  ? "border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/20 shadow-sm"
                  : "border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400">At Risk Projects</span>
                <AlertCircle className="size-3.5 text-indigo-500" />
              </div>
              <div className="text-2xl md:text-3xl font-display font-bold text-indigo-600 dark:text-indigo-400">
                {projectsNeedingAttention.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Projects with health alerts</div>
            </div>
          </div>

          {/* OPERATIONAL DUAL-COLUMN COMMAND GRID: NEEDS ATTENTION & UPCOMING DELIVERIES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* COLUMN 1: HIGHEST-PRIORITY EXCEPTIONS FEED (NEEDS ATTENTION ACROSS SADA) */}
            <div className="rounded-3xl border border-border bg-card p-5 md:p-6 elevated-shadow space-y-4">
              <div className="flex flex-col gap-3 border-b border-border pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded-xl bg-destructive text-white text-xs font-bold grid place-items-center">
                      !
                    </span>
                    <h2 className="font-display font-bold text-xl">Needs Attention Across SADA</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Actionable exceptions prioritized by urgency: overdue deliveries, blockers, unassigned tasks, and client delays.
                </p>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setOversightTab("all")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                      oversightTab === "all"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({needsAttentionFeedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOversightTab("overdue")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                      oversightTab === "overdue"
                        ? "bg-card text-destructive shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Overdue ({agencyOverdueTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOversightTab("blocked")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                      oversightTab === "blocked"
                        ? "bg-card text-rose-600 dark:text-rose-400 shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Blocked ({agencyBlockedTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOversightTab("unassigned")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                      oversightTab === "unassigned"
                        ? "bg-card text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unassigned ({agencyUnassignedTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOversightTab("client_action")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
                      oversightTab === "client_action"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Client Action ({clientActionRequired.length})
                  </button>
                </div>
              </div>

              {/* Exception Items List */}
              {activeExceptions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-emerald-500/30 rounded-2xl space-y-2 bg-emerald-500/5">
                  <CheckCircle className="size-8 text-emerald-500 mx-auto" />
                  <div className="font-semibold text-sm text-foreground">Everything is on track.</div>
                  <p className="text-muted-foreground">
                    {oversightTab === "overdue"
                      ? "Zero overdue tasks across the agency."
                      : oversightTab === "blocked"
                      ? "No blocked work. All team workflows are running unhindered."
                      : oversightTab === "unassigned"
                      ? "All active tasks have an owner. No unassigned work pending."
                      : oversightTab === "client_action"
                      ? "No client action needed. All client approvals and assets received."
                      : oversightTab === "at_risk"
                      ? "All active client projects are on track and healthy."
                      : "All agency operations are running smoothly. Zero blocked, overdue, or unassigned tasks across SADA."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 transition-all duration-300">
                  {visibleExceptions.map(exc => {
                    if (exc.kind === "unified_task") {
                      const t = exc.task;
                      const proj = projectMap.get(t.project_id);
                      const projLead = proj?.lead_id ? getProjectLeadInfo(proj.lead_id, teamMembers, profiles) : null;
                      const taskOwner = t.assignee_id ? getAssignmentMemberInfo(t.assignee_id, teamMembers, profiles) : null;
                      const isBlocked = exc.categories.includes("blocked");
                      const isOverdue = exc.categories.includes("overdue");
                      const isUnassigned = exc.categories.includes("unassigned");
                      const isClientAction = exc.categories.includes("client_action");

                      // Card styling driven by highest priority exception
                      const cardStyle = isBlocked
                        ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10"
                        : isOverdue
                        ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                        : isUnassigned
                        ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                        : "border-border bg-card hover:bg-muted/30";

                      return (
                        <div
                          key={exc.id}
                          className={`p-3.5 sm:p-4 rounded-2xl border ${cardStyle} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                              {/* Composite Exception Badges — all applicable categories displayed on single card */}
                              {isBlocked && (
                                <span className="font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                                  BLOCKED {t.waiting_on === "client" ? "· WAITING ON CLIENT" : "· INTERNAL"}
                                </span>
                              )}
                              {isOverdue && (
                                <span className="font-extrabold text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/30">
                                  OVERDUE
                                </span>
                              )}
                              {isUnassigned && (
                                <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                  UNASSIGNED
                                </span>
                              )}
                              {isClientAction && !isBlocked && (
                                <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                  CLIENT ACTION
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded font-bold ${PRIORITY_CONFIG[t.priority].bg} ${PRIORITY_CONFIG[t.priority].color}`}>
                                {PRIORITY_CONFIG[t.priority].label}
                              </span>
                              <span className="font-bold text-foreground truncate max-w-[140px] sm:max-w-none">{proj?.client_name || "Project"}</span>
                              {projLead && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">
                                  <User className="size-3" /> Lead: {projLead.name}
                                </span>
                              )}
                            </div>

                            <h3
                              onClick={() => setInspectingTask(t)}
                              className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                            >
                              {t.title}
                            </h3>

                            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                              <span>Owner: <strong className="text-foreground">{taskOwner ? taskOwner.name : "Unassigned"}</strong></span>
                              {t.deadline && (
                                <span>· Deadline: <strong className={isOverdue ? "text-destructive" : "text-foreground"}>{format(parseISO(t.deadline), "d MMM yyyy")}</strong></span>
                              )}
                              {isBlocked && (
                                <span>· Reason: <strong className="text-rose-600 dark:text-rose-400">{t.blocked_reason || "Blocked execution"}</strong></span>
                              )}
                              {exc.clientActionReason && !isBlocked && (
                                <span>· Client: <strong className="text-amber-600 dark:text-amber-400">{exc.clientActionReason}</strong></span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                            {isUnassigned && (
                              <button
                                type="button"
                                onClick={() => { setEditingTask(t); setShowTaskModal(true); }}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors inline-flex items-center gap-1 shadow-xs"
                              >
                                <Plus className="size-3.5" /> Assign
                              </button>
                            )}
                            {isBlocked && (
                              <button
                                type="button"
                                onClick={() => setInspectingTask(t)}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/20 transition-colors inline-flex items-center gap-1"
                              >
                                <ShieldAlert className="size-3.5" /> Inspect
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(t.id, "done")}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1"
                            >
                              <Check className="size-3.5" /> Done
                            </button>
                            <button
                              type="button"
                              onClick={() => setInspectingTask(t)}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-primary text-white text-xs font-semibold hover:scale-[1.02] transition-transform inline-flex items-center gap-1 shadow-xs"
                            >
                              Open Task →
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (exc.kind === "client_action_project") {
                      const item = exc.item;
                      const projLead = item.project.lead_id ? getProjectLeadInfo(item.project.lead_id, teamMembers, profiles) : null;

                      return (
                        <div
                          key={exc.id}
                          className="p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 bg-card hover:bg-amber-500/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                              <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                CLIENT ACTION
                              </span>
                              <span className="font-bold text-foreground truncate max-w-[140px] sm:max-w-none">{item.project.client_name}</span>
                              {projLead && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">
                                  <User className="size-3" /> Lead: {projLead.name}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              <strong className="text-foreground">Waiting for:</strong> {item.reason}
                            </div>

                            <div className="text-[11px] text-primary font-medium truncate">
                              Next Action: {item.nextAction}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                            <button
                              type="button"
                              onClick={() => openFollowupForProject(item.project)}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1"
                            >
                              <PhoneCall className="size-3.5" /> Log Contact
                            </button>
                            <Link
                              to={"/admin/client-workspaces/$id" as any}
                              params={{ id: item.project.client_id || item.project.id } as any}
                              className="px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1"
                            >
                              Open Workspace <ArrowUpRight className="size-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    }

                    if (exc.kind === "at_risk") {
                      const projLead = exc.project.lead_id ? getProjectLeadInfo(exc.project.lead_id, teamMembers, profiles) : null;

                      return (
                        <div
                          key={exc.id}
                          className="p-3.5 sm:p-4 rounded-2xl border border-indigo-500/30 bg-card hover:bg-indigo-500/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                              <span className={`px-2 py-0.5 rounded font-bold border ${exc.health.color} ${exc.health.bg} ${exc.health.border}`}>
                                {exc.health.label}
                              </span>
                              <span className="font-bold text-foreground truncate max-w-[140px] sm:max-w-none">{exc.project.client_name}</span>
                              {projLead && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">
                                  <User className="size-3" /> Lead: {projLead.name}
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-medium text-foreground truncate">
                              {exc.project.title}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {exc.reason}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                            <Link
                              to={"/admin/client-workspaces/$id" as any}
                              params={{ id: exc.project.client_id || exc.project.id } as any}
                              className="px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1"
                            >
                              Open Workspace <ArrowUpRight className="size-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}

                  {/* EXPAND / COLLAPSE TOGGLE BUTTON */}
                  {activeExceptions.length > 3 && (
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        aria-expanded={isExceptionsExpanded}
                        onClick={() => setIsExceptionsExpanded(!isExceptionsExpanded)}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-border bg-muted/30 hover:bg-muted/70 text-foreground text-xs font-bold transition-all inline-flex items-center justify-center gap-2 group hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {isExceptionsExpanded ? (
                          <>
                            <span>Show less</span>
                            <ChevronUp className="size-3.5 transition-transform group-hover:-translate-y-0.5" />
                          </>
                        ) : (
                          <>
                            <span>Show all {activeExceptions.length} exceptions</span>
                            <ChevronDown className="size-3.5 transition-transform group-hover:translate-y-0.5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* COLUMN 2: UPCOMING CLIENT DELIVERIES */}
            <div className="rounded-3xl border border-border bg-card p-5 md:p-6 elevated-shadow space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold grid place-items-center border border-emerald-500/20">
                    <FolderCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <div>
                    <h2 className="font-display font-bold text-xl">Upcoming Client Deliveries</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Approaching delivery milestones across active client projects.
                    </p>
                  </div>
                </div>
              </div>

              {upcomingDeliveries.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl space-y-2">
                  <FolderCheck className="size-8 text-muted-foreground mx-auto opacity-50" />
                  <div className="font-semibold text-sm text-foreground">No upcoming deliveries scheduled</div>
                  <p className="text-muted-foreground">All client milestones are fulfilled or no immediate deadlines pending.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingDeliveries.slice(0, 4).map(item => {
                    const projLead = item.project.lead_id ? getProjectLeadInfo(item.project.lead_id, teamMembers, profiles) : null;

                    return (
                      <div key={item.project.id} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground truncate">{item.project.client_name}</div>
                            {projLead && (
                              <div className="text-[10px] text-primary font-medium truncate">Lead: {projLead.name}</div>
                            )}
                          </div>
                          <Link
                            to={"/admin/client-workspaces/$id" as any}
                            params={{ id: item.project.client_id || item.project.id } as any}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            Workspace <ArrowUpRight className="size-3" />
                          </Link>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {item.deliverables.slice(0, 3).map(d => (
                            <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-card border border-border/60">
                              <span className="truncate mr-2 font-medium text-foreground flex items-center gap-1.5">
                                <CheckCircle2 className={`size-3.5 shrink-0 ${d.status === "done" ? "text-emerald-500" : "text-muted-foreground"}`} />
                                <span className="truncate">{d.title}</span>
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {d.deadline ? format(parseISO(d.deadline), "d MMM") : "Target"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {upcomingDeliveries.length > 4 && (
                    <div className="pt-1 text-center">
                      <Link
                        to="/admin/client-workspaces"
                        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        View all {upcomingDeliveries.length} active client workspaces →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3 — PROJECTS AT RISK & REQUIRING ATTENTION */}
          {projectsNeedingAttention.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg">Projects At Risk & Requiring Attention</h3>
                  <p className="text-xs text-muted-foreground">Client projects flagged with health alerts, overdue deadlines, or blocking issues</p>
                </div>
                <Link to="/admin/client-workspaces" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  All Client Workspaces ({projects.length}) <ChevronRight className="size-3.5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                {projectsNeedingAttention.map(item => {
                  const projLead = item.project.lead_id ? getProjectLeadInfo(item.project.lead_id, teamMembers, profiles) : null;

                  return (
                    <Link
                      key={item.project.id}
                      to={"/admin/client-workspaces/$id" as any}
                      params={{ id: item.project.client_id || item.project.id } as any}
                      className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/30 transition-all space-y-2.5 group flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                              {item.project.client_name}
                            </span>
                            {projLead && (
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                                Lead: {projLead.name}
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${item.health.color} ${item.health.bg} ${item.health.border}`}>
                            {item.health.label}
                          </span>
                        </div>

                        <div className="text-xs font-medium text-foreground truncate">
                          {item.project.title}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {item.reason}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${item.progress.percent}%` }} />
                          </div>
                          <span className="font-mono text-[11px] font-bold">{item.progress.percent}%</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {item.project.deadline ? format(parseISO(item.project.deadline), "d MMM yyyy") : "No target date"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 5 — TEAM CAPACITY SIGNAL & PULSE */}
          <div className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="font-display font-bold text-lg">Team Capacity & Workload Pulse</h3>
                <p className="text-xs text-muted-foreground">Real-time capacity signals and task distribution using unified team roster</p>
              </div>
              <Link to="/admin/team-workload" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Full Workload Radar →
              </Link>
            </div>

            {/* Capacity Alerts / Signal Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">Active Roster</span>
                <div className="text-xl font-display font-bold text-foreground">{teamPulse.length} Members</div>
              </div>

              <div className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">Unassigned Work</span>
                <div className={`text-xl font-display font-bold ${agencyUnassignedTasks.length > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                  {agencyUnassignedTasks.length} Tasks
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">Heavy Load</span>
                <div className={`text-xl font-display font-bold ${capacityAlerts.heavyLoad.length > 0 ? "text-amber-500" : "text-foreground"}`}>
                  {capacityAlerts.heavyLoad.length} Members
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">Overloaded</span>
                <div className={`text-xl font-display font-bold ${capacityAlerts.overloaded.length > 0 ? "text-destructive" : "text-emerald-500"}`}>
                  {capacityAlerts.overloaded.length} Members
                </div>
              </div>
            </div>

            {/* Team Members Pulse Grid */}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              {teamPulse.map(m => (
                <div key={m.member.id} className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.member.photo_url ? (
                        <img
                          src={m.member.photo_url}
                          alt={m.member.name}
                          className="size-6 rounded-full object-cover shrink-0 ring-1 ring-border"
                        />
                      ) : (
                        <span className="size-6 rounded-full bg-gradient-primary text-white text-[9px] font-bold grid place-items-center shrink-0">
                          {(m.member.name || "?")[0].toUpperCase()}
                        </span>
                      )}
                      <span className="font-semibold text-xs text-foreground truncate">
                        {m.member.name}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${m.capacityBadge.color}`}>
                      {m.capacityBadge.label}
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span>{m.member.position}</span>
                      <span className="font-mono font-bold text-primary">{m.activeCount} active tasks</span>
                    </div>
                    {m.topTaskTitle ? (
                      <div className="truncate font-medium text-foreground text-[10px]">
                        Focus: {m.topTaskTitle}
                      </div>
                    ) : (
                      <div className="italic text-[10px]">No active task</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 6 — SYSTEM CONTENT RECORDS */}
          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3 font-mono">
              System Content Records
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {CONTENT_CARDS.map(c => (
                <div key={c.table} className="rounded-2xl border border-border bg-card p-3.5 soft-shadow space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] uppercase tracking-wider font-mono">{c.label}</span>
                    <c.Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="text-xl font-display font-bold text-gradient">{counts[c.table] ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS INTEGRATION
      ===================================================================== */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          projectId={editingTask?.project_id || projects[0]?.id || ""}
          profiles={profiles}
          teamMembers={teamMembers}
          projectServices={[]}
          onSaved={() => { loadData(false); }}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
        />
      )}

      {inspectingTask && (
        <TaskDetailModal
          task={inspectingTask}
          project={projectMap.get(inspectingTask.project_id) || null}
          profiles={profiles}
          teamMembers={teamMembers}
          onEdit={(t: TaskRow) => { setInspectingTask(null); setEditingTask(t); setShowTaskModal(true); }}
          onClose={() => setInspectingTask(null)}
          onStatusChange={(taskId, newStatus) => {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
            loadData(false);
          }}
        />
      )}

      {showFollowupModal && followupProject && (
        <ClientFollowupModal
          projectId={followupProject.id}
          clientName={followupProject.client_name}
          profiles={profiles}
          currentFollowupOwnerId={followupProject.followup_owner_id}
          onSaved={loadData}
          onClose={() => { setShowFollowupModal(false); setFollowupProject(null); }}
        />
      )}

      {/* Analytics Drill Down Modal for Executive Command Center */}
      <AnalyticsDrillDownModal
        drillDown={drillDownState}
        onClose={() => setDrillDownState(null)}
      />
    </div>
  );
}
