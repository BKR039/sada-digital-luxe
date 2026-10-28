import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, AlertCircle, Sparkles, Filter, Search,
  Calendar, User, ExternalLink, ArrowRight, Check, Play, Pause,
  ChevronRight, RefreshCw, Flame, AlertTriangle,
  FileText, Send, Eye, Users, CheckCircle,
  RotateCcw, Circle, X, Lock, Workflow, Share2, Film
} from "lucide-react";
import {
  type TaskRow,
  type ClientRow,
  type ProfileRow,
  type TeamMemberRow,
  type ProjectRow,
  isTaskOverdue
} from "@/components/admin/project-utils";
import { TaskDetailModal } from "@/components/admin/TaskDetailModal";
import { TaskModal } from "@/components/admin/TaskModal";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADASelect } from "@/components/ui/sada-select";
import { MyWorkSkeleton } from "@/components/ui/sada-ui";
import { format, parseISO, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";
import { useTranslation } from "@/i18n";
import { formatDate } from "@/lib/date-locale";
import {
  computeNextTask,
  startTask,
  pauseTask,
  submitTaskForReview,
  approveAndCompleteTask,
  resolveTaskBlocker,
  computeTaskExecutionTier,
  computeBlockedDuration,
  isTaskPaused,
  BLOCKER_CATEGORY_LABELS,
  type BlockerCategory
} from "@/lib/task-execution-service";
import {
  permissions,
  can,
  type PermissionContext,
} from "@/lib/permissions";
import { checkStageActionability } from "@/lib/workflow-service";

export interface MyWorkSearchParams {
  task?: string;
  taskId?: string;
  [key: string]: unknown;
}

export const Route = createFileRoute("/admin/my-work")({
  validateSearch: (search: Record<string, unknown>): MyWorkSearchParams => {
    return {
      ...search,
      task: typeof search.task === "string" ? search.task : undefined,
      taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    };
  },
  component: MyWorkExecutionView,
});

export function MyWorkExecutionView() {
  const { user, role, isAdmin, isSuperAdmin, teamMember } = useAuth();
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Localized action mutation loading (task ID currently undergoing transition)
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);

  // Role Permissions: Only Admins / Super Admins can access Team Execution
  const canViewTeam = isAdmin || isSuperAdmin;
  const [activeView, setActiveView] = useState<"my" | "team">("my");
  const effectiveView = canViewTeam ? activeView : "my";

  // Track tasks that were paused based on project_activity audit logs
  const [pausedTaskIds, setPausedTaskIds] = useState<Set<string>>(new Set());

  // Execution Queue Filters
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("me");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const navigate = useNavigate();
  const search = Route.useSearch();
  const targetTaskId = search.task || search.taskId;

  // Active Task for TaskDetailModal workspace
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);

  // Canonical Task Modal editing state
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Track explicitly closed task ID to prevent race conditions during URL transitions and re-renders
  const closedTaskIdRef = useRef<string | null>(null);

  // Authoritative Open Task Handler: resets closed guard, updates local state, sets URL search param
  const handleOpenTask = useCallback((taskToOpen: TaskRow) => {
    closedTaskIdRef.current = null;
    setActiveTask(taskToOpen);
    navigate({
      search: ((prev: any) => ({
        ...prev,
        task: taskToOpen.id,
        taskId: undefined,
      })) as any,
      replace: false,
    });
  }, [navigate]);

  // Authoritative Close Task Handler: cleans local state, cleans URL search params, preserves all unrelated query params
  const handleCloseTask = useCallback(() => {
    const closingId = activeTask?.id || targetTaskId;
    closedTaskIdRef.current = closingId || "__closed__";
    setActiveTask(null);

    // Synchronously clean window.location to ensure immediate URL accuracy
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("task") || url.searchParams.has("taskId")) {
        url.searchParams.delete("task");
        url.searchParams.delete("taskId");
        window.history.replaceState(window.history.state, "", url.pathname + (url.search ? url.search : "") + url.hash);
      }
    }

    // TanStack Router search update to preserve router state and unrelated search params
    navigate({
      search: ((prev: any) => {
        const next = { ...prev };
        delete next.task;
        delete next.taskId;
        return next;
      }) as any,
      replace: true,
    });
  }, [navigate, activeTask?.id, targetTaskId]);

  // Fast entity lookup maps
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const teamMemberMap = useMemo(() => new Map(teamMembers.map(m => [m.id, m])), [teamMembers]);

  // Current user's team member record
  const myMember = useMemo(() => {
    if (teamMember) return teamMember;
    if (!user) return null;
    return teamMembers.find(m => m.profile_id === user.id || m.id === user.id || (m as any).user_id === user.id) || null;
  }, [user, teamMembers, teamMember]);

  // Load Task & Workspace Data (silent background reload option)
  const loadMyWorkData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    try {
      const [tasksRes, clientsRes, projRes, profRes, teamRes, pausedRes] = await Promise.all([
        (supabase as any).from("project_tasks").select("*").order("deadline", { ascending: true, nullsFirst: false }),
        (supabase as any).from("clients").select("id, name, industry, status, client_type"),
        (supabase as any).from("client_projects").select("id, title, client_name, client_id"),
        (supabase as any).from("profiles").select("id, display_name, avatar_url"),
        (supabase as any).from("team_members").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        (supabase as any).from("project_activity").select("task_id").eq("action", "task_paused"),
      ]);

      setTasks(tasksRes.data || []);
      setClients(clientsRes.data || []);
      setProjects(projRes.data || []);
      setProfiles(profRes.data || []);
      setTeamMembers(teamRes.data || []);
      if (pausedRes?.data) {
        setPausedTaskIds(new Set(pausedRes.data.map((r: any) => r.task_id).filter(Boolean)));
      }
    } catch (err) {
      console.error("[loadMyWorkData] Error loading tasks:", err);
      toast.error("Failed to load latest task data");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyWorkData(true);
  }, [loadMyWorkData]);

  // Silent Realtime Subscription (never triggers full-page skeleton)
  useEffect(() => {
    const channel = supabase
      .channel("my-work-execution-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_tasks" },
        () => {
          loadMyWorkData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMyWorkData]);

  // Contextual Deep Link: Open task from URL parameter (?task=<id> or ?taskId=<id>)
  useEffect(() => {
    if (!targetTaskId) {
      // If URL no longer has a task param, close modal if open and release closed guard
      closedTaskIdRef.current = null;
      if (activeTask) {
        setActiveTask(null);
      }
      return;
    }

    // Guard: If the user explicitly closed this exact task ID and URL hasn't cleared yet, don't reopen
    if (closedTaskIdRef.current === targetTaskId) return;

    // If activeTask is already this task, no action needed
    if (activeTask?.id === targetTaskId) return;

    // A valid new/different task deep link was received
    closedTaskIdRef.current = null;

    const found = tasks.find((t) => t.id === targetTaskId);
    if (found) {
      setActiveTask(found);
    } else if (!loading) {
      (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("id", targetTaskId)
        .maybeSingle()
        .then(({ data, error }: any) => {
          if (data && !error && closedTaskIdRef.current !== targetTaskId) {
            setActiveTask(data);
          }
        });
    }
  }, [targetTaskId, tasks, loading, activeTask]);

  // Filter Tasks by Assigned Worker
  const workerFilteredTasks = useMemo(() => {
    let targetProfileId = user?.id;
    let targetMemberId = myMember?.id;

    if (canViewTeam && selectedWorkerId !== "me" && selectedWorkerId !== "all") {
      const targetMember = teamMembers.find(m => m.id === selectedWorkerId || m.profile_id === selectedWorkerId);
      targetProfileId = targetMember?.profile_id || targetMember?.id;
      targetMemberId = targetMember?.id;
    }

    return tasks.filter(t => {
      if (canViewTeam && selectedWorkerId === "all") return true;
      if (!targetProfileId && !targetMemberId) return true;
      return (
        t.assignee_id === targetProfileId ||
        t.assignee_id === targetMemberId ||
        (myMember && t.assignee_id === myMember.id)
      );
    });
  }, [tasks, selectedWorkerId, user, myMember, teamMembers, canViewTeam]);

  // Deterministic "NEXT TASK" Execution Candidate
  const nextUp = useMemo(() => {
    if (activeView === "team") return null;
    // Stage tasks that are locked due to prerequisite incomplete stages should not be recommended next
    const actionableTasks = workerFilteredTasks.filter((t) => {
      if (t.parent_task_id) {
        const siblingStages = tasks.filter((s) => s.parent_task_id === t.parent_task_id);
        const { isActionable } = checkStageActionability(t, siblingStages);
        if (!isActionable) return false;
      }
      return true;
    });
    return computeNextTask(actionableTasks);
  }, [activeView, workerFilteredTasks, tasks]);

  // Filtered Tasks for the Execution Queue
  const filteredTasks = useMemo(() => {
    return workerFilteredTasks.filter(t => {
      const isFinished = t.status === "done" || t.status === "approved" || t.status === "delivered";

      // Status Filter
      if (statusFilter === "open" && isFinished) return false;
      if (statusFilter === "done" && !isFinished) return false;
      if (statusFilter === "in_progress" && t.status !== "in_progress") return false;
      if (statusFilter === "paused" && t.status !== "paused") return false;
      if (statusFilter === "blocked" && t.status !== "blocked") return false;
      if (statusFilter === "review" && t.status !== "review") return false;
      if (statusFilter === "today") {
        if (isFinished) return false;
        if (!t.deadline) return false;
        const d = parseISO(t.deadline);
        if (!isToday(d) && !isPast(d)) return false;
      }
      if (statusFilter === "upcoming") {
        if (isFinished || t.status === "blocked" || t.status === "review" || t.status === "cancelled") return false;
        if (t.deadline) {
          const d = parseISO(t.deadline);
          if (isToday(d) || isPast(d)) return false;
        }
      }

      // Priority Filter
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

      // Client Filter
      if (clientFilter !== "all" && t.client_id !== clientFilter) return false;

      // Live Search across title, client name, service, notes, description
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const client = t.client_id ? clientMap.get(t.client_id) : null;
        const matchesClient = client?.name.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesService = t.service?.toLowerCase().includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        if (!matchesClient && !matchesTitle && !matchesService && !matchesNotes && !matchesDesc) return false;
      }

      return true;
    });
  }, [workerFilteredTasks, statusFilter, priorityFilter, clientFilter, searchQuery, clientMap]);

  // Execution Queue Buckets in canonical sequence:
  // 1. TODAY & OVERDUE, 2. IN PROGRESS, 3. BLOCKED, 4. WAITING FOR REVIEW, 5. UPCOMING, 6. COMPLETED
  const buckets = useMemo(() => {
    const todayAndOverdue: TaskRow[] = [];
    const inProgress: TaskRow[] = [];
    const blocked: TaskRow[] = [];
    const inReview: TaskRow[] = [];
    const upcoming: TaskRow[] = [];
    const completed: TaskRow[] = [];

    filteredTasks.forEach(t => {
      const isFinished = t.status === "done" || t.status === "approved" || t.status === "delivered";
      if (isFinished) {
        completed.push(t);
        return;
      }

      if (t.status === "blocked") {
        blocked.push(t);
        return;
      }

      if (t.status === "review") {
        inReview.push(t);
        return;
      }

      const d = t.deadline ? parseISO(t.deadline) : null;
      const isDueNow = d ? (isToday(d) || isPast(d)) : false;

      if (isDueNow) {
        todayAndOverdue.push(t);
      } else if (t.status === "in_progress") {
        inProgress.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { todayAndOverdue, inProgress, blocked, inReview, upcoming, completed };
  }, [filteredTasks]);

  // Team Execution Overview Metrics (Admins / Super Admins only)
  const teamMetrics = useMemo(() => {
    if (!canViewTeam) return null;

    let activeCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let inReviewCount = 0;
    let blockedCount = 0;
    let completedTodayCount = 0;

    const workerStatsMap = new Map<string, {
      member: TeamMemberRow;
      active: number;
      dueToday: number;
      overdue: number;
      blocked: number;
      inReview: number;
    }>();

    teamMembers.forEach(m => {
      workerStatsMap.set(m.id, {
        member: m,
        active: 0,
        dueToday: 0,
        overdue: 0,
        blocked: 0,
        inReview: 0,
      });
    });

    tasks.forEach(t => {
      const isFinished = t.status === "done" || t.status === "approved" || t.status === "delivered";
      const d = t.deadline ? parseISO(t.deadline) : null;
      const isDue = d ? isToday(d) : false;
      const isOver = d ? (isPast(d) && !isToday(d)) : false;

      if (!isFinished && t.status !== "cancelled") {
        activeCount++;
        if (isDue) dueTodayCount++;
        if (isOver) overdueCount++;
        if (t.status === "review") inReviewCount++;
        if (t.status === "blocked") blockedCount++;

        const target = teamMembers.find(m => m.id === t.assignee_id || m.profile_id === t.assignee_id);
        if (target) {
          const stats = workerStatsMap.get(target.id);
          if (stats) {
            stats.active++;
            if (isDue) stats.dueToday++;
            if (isOver) stats.overdue++;
            if (t.status === "blocked") stats.blocked++;
            if (t.status === "review") stats.inReview++;
          }
        }
      } else if (isFinished && t.completed_at) {
        try {
          if (isToday(parseISO(t.completed_at))) {
            completedTodayCount++;
          }
        } catch {}
      }
    });

    return {
      activeCount,
      dueTodayCount,
      overdueCount,
      inReviewCount,
      blockedCount,
      completedTodayCount,
      workerStats: Array.from(workerStatsMap.values()),
    };
  }, [tasks, teamMembers, canViewTeam]);

  // Authoritative Permissions Context
  const permCtx = useMemo<PermissionContext>(() => ({
    role: role || (isSuperAdmin ? "super_admin" : isAdmin ? "admin" : "worker"),
    userId: user?.id,
    memberProfileId: myMember?.profile_id,
    memberId: myMember?.id,
  }), [role, isSuperAdmin, isAdmin, user?.id, myMember]);

  const canChangeStatus = useCallback((t: TaskRow) => permissions.canChangeStatus(permCtx, t), [permCtx]);
  const canComplete = useCallback((t: TaskRow) => permissions.canCompleteTask(permCtx, t), [permCtx]);

  // ============================================================
  // TASK EXECUTION ACTIONS (Optimistic Updates + Localized Spinners)
  // ============================================================

  const handleStartTask = async (task: TaskRow, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    if (!canChangeStatus(task)) {
      toast.error(isAr ? "غير مصرح: لا تملك صلاحية تغيير حالة المهمة." : "Unauthorized: You lack permission to change task status.");
      return;
    }

    if (task.parent_task_id) {
      const siblingStages = tasks.filter((t) => t.parent_task_id === task.parent_task_id);
      const actionability = checkStageActionability(task, siblingStages);
      if (!actionability.isActionable) {
        toast.warning(
          actionability.lockedReason ||
            (isAr
              ? "لا يمكن بدء هذه المرحلة قبل إتمام المراحل السابقة."
              : "Cannot start stage: previous stage must be completed first.")
        );
        return;
      }
    }

    setActionLoadingTaskId(task.id);

    const prevTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "in_progress" } : t));

    try {
      const res = await startTask({ task, actorId: user.id, ctx: permCtx });
      if (!res.success) throw new Error(res.error || "Failed to start task");
      toast.success(isAr ? `تم بدء "${task.title}" — قيد التنفيذ` : `Started "${task.title}" — In Progress`);
    } catch (err: any) {
      setTasks(prevTasks);
      toast.error(err.message || (isAr ? "فشل بدء المهمة" : "Failed to start task"));
    } finally {
      setActionLoadingTaskId(null);
    }
  };

  const handlePauseTask = async (task: TaskRow, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    if (!canChangeStatus(task)) {
      toast.error(isAr ? "غير مصرح: لا تملك صلاحية تغيير حالة المهمة." : "Unauthorized: You lack permission to change task status.");
      return;
    }

    setActionLoadingTaskId(task.id);

    const prevTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "todo" } : t));

    try {
      const res = await pauseTask({ task, actorId: user.id, ctx: permCtx });
      if (!res.success) throw new Error(res.error || "Failed to pause task");
      setPausedTaskIds(prev => new Set(prev).add(task.id));
      toast.success(isAr ? `تم إيقاف "${task.title}" مؤقتاً — قابلة للاستئناف` : `Paused "${task.title}" — Marked Resumable`);
    } catch (err: any) {
      setTasks(prevTasks);
      toast.error(err.message || (isAr ? "فشل إيقاف المهمة مؤقتاً" : "Failed to pause task"));
    } finally {
      setActionLoadingTaskId(null);
    }
  };

  const handleResolveBlocker = async (task: TaskRow, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    if (!canChangeStatus(task)) {
      toast.error(isAr ? "غير مصرح: لا تملك صلاحية تغيير حالة المهمة." : "Unauthorized: You lack permission to change task status.");
      return;
    }

    setActionLoadingTaskId(task.id);

    const prevTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "in_progress", blocked_reason: null, waiting_on: null } : t));

    try {
      const res = await resolveTaskBlocker({ task, actorId: user.id, ctx: permCtx });
      if (!res.success) throw new Error(res.error || "Failed to resume task");
      toast.success(isAr ? `تم فك العائق! تم استئناف "${task.title}"` : `Blocker resolved! Resumed "${task.title}"`);
    } catch (err: any) {
      setTasks(prevTasks);
      toast.error(err.message || (isAr ? "فشل فك العائق" : "Failed to resolve blocker"));
    } finally {
      setActionLoadingTaskId(null);
    }
  };

  const handleApproveTask = async (task: TaskRow, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    if (!canComplete(task)) {
      toast.error(isAr ? "غير مصرح: لا تملك صلاحية اعتماد وإكمال المهمة." : "Unauthorized: You lack permission to approve or complete tasks.");
      return;
    }

    setActionLoadingTaskId(task.id);

    const nowIso = new Date().toISOString();
    const prevTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "done", completed_at: nowIso } : t));

    try {
      const res = await approveAndCompleteTask({ task, actorId: user.id, ctx: permCtx });
      if (!res.success) throw new Error(res.error || "Failed to approve task");
      toast.success(isAr ? `تم اعتماد وإكمال "${task.title}" بنجاح!` : `Approved & completed "${task.title}"!`);
    } catch (err: any) {
      setTasks(prevTasks);
      toast.error(err.message || (isAr ? "فشل اعتماد المهمة" : "Failed to approve task"));
    } finally {
      setActionLoadingTaskId(null);
    }
  };

  // Helper to resolve assigner display name
  const getAssignerName = (assignedById?: string | null) => {
    if (!assignedById) return isAr ? "الإدارة / العمليات" : "Lead / Operations";
    const profile = profileMap.get(assignedById);
    if (profile?.display_name) return profile.display_name;
    const member = teamMembers.find(m => m.id === assignedById || m.profile_id === assignedById);
    return member?.name || (isAr ? "مشرف العمليات" : "Operations Lead");
  };

  // Helper to resolve assigned worker display name
  const getWorkerName = (assigneeId?: string | null) => {
    if (!assigneeId) return isAr ? "غير مُعيّن" : "Unassigned";
    const profile = profileMap.get(assigneeId);
    if (profile?.display_name) return profile.display_name;
    const member = teamMembers.find(m => m.id === assigneeId || m.profile_id === assigneeId);
    return member?.name || (isAr ? "أخصائي" : "Specialist");
  };

  // Helper to get localized tier label
  const getTierLabel = (tier: string, isDone?: boolean) => {
    if (isDone) return isAr ? "مكتمل" : "COMPLETED";
    switch (tier) {
      case "CRITICAL":
        return isAr ? "المستوى ١ · حرج" : "TIER 1 · CRITICAL";
      case "HIGH":
        return isAr ? "المستوى ٢ · أولوية عالية" : "TIER 2 · HIGH";
      case "NORMAL":
        return isAr ? "المستوى ٣ · عادي" : "TIER 3 · NORMAL";
      case "UPCOMING":
        return isAr ? "المستوى ٤ · قادم" : "TIER 4 · UPCOMING";
      default:
        return tier;
    }
  };

  const localizeRationale = (reason: string): string => {
    if (!isAr) return reason;
    if (reason.includes("Currently in progress")) return "⚡ قيد التنفيذ حالياً — استئناف العمل الفوري";
    if (reason.includes("Overdue by")) {
      const match = reason.match(/(\d+)/);
      const days = match ? match[1] : "";
      return `🚨 متأخرة بمقدار ${days} يوم — أولوية قصوى فورية`;
    }
    if (reason.includes("Due today")) return "📅 تستحق اليوم قبل نهاية ساعات العمل";
    if (reason.includes("Due tomorrow")) return "⏰ تستحق غداً — التحضير للإنتاج والتسليم";
    if (reason.includes("Urgent priority")) return "🔥 مخرج ذو أولوية حرجة جداً";
    if (reason.includes("High priority")) return "⭐ مخرج ذو أولوية عالية للعميل";
    if (reason.includes("No blockers")) return "✓ لا توجد عوائق مسجلة • جاهزة للتنفيذ";
    if (reason.includes("All assigned deliverables")) return "جميع المهام المسندة مكتملة أو قيد المراجعة أو معالجة بالكامل.";
    return reason;
  };

  // Execution Queue Task Card renderer
  const renderExecutionTaskCard = (task: TaskRow) => {
    const client = task.client_id ? clientMap.get(task.client_id) : null;
    const project = task.project_id ? projectMap.get(task.project_id) : null;
    const clientName = client?.name || project?.client_name || "SADA Client";
    const isDone = task.status === "done" || task.status === "approved" || task.status === "delivered";
    const isInProgress = task.status === "in_progress";
    const isBlocked = task.status === "blocked";
    const isReview = task.status === "review";
    const overdue = isTaskOverdue(task);
    const isMutating = actionLoadingTaskId === task.id;
    const isPaused = isTaskPaused(task, pausedTaskIds);
    const tierInfo = computeTaskExecutionTier(task);

    const assignedByName = getAssignerName(task.assigned_by_id);
    const workerName = getWorkerName(task.assignee_id);
    const briefText = task.notes || task.description;

    const isStage = Boolean(task.parent_task_id);
    const parentTask = isStage ? tasks.find((t) => t.id === task.parent_task_id) : null;
    const siblingStages = isStage ? tasks.filter((t) => t.parent_task_id === task.parent_task_id) : [];
    const stageActionability = isStage
      ? checkStageActionability(task, siblingStages)
      : { isActionable: true, isLocked: false, lockedReason: undefined };

    return (
      <div
        key={task.id}
        onClick={() => handleOpenTask(task)}
        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3.5 group shadow-2xs ${
          isBlocked
            ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50"
            : isInProgress
            ? "border-primary/40 bg-primary/5 hover:border-primary/60"
            : isReview
            ? "border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50"
            : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/15"
        }`}
      >
        <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          {/* Status Icon */}
          <div className="mt-0.5 shrink-0">
            {isDone ? (
              <span className="size-5 rounded-md bg-emerald-500 text-white flex items-center justify-center">
                <Check className="size-3.5 stroke-[3]" />
              </span>
            ) : isBlocked ? (
              <span className="size-5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center" title="Blocked">
                <AlertTriangle className="size-3" />
              </span>
            ) : isInProgress ? (
              <span className="size-5 rounded-md bg-primary/10 text-primary border border-primary/30 flex items-center justify-center animate-pulse" title="In Progress">
                <Play className="size-3 fill-current" />
              </span>
            ) : isReview ? (
              <span className="size-5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center" title="In Review">
                <Eye className="size-3" />
              </span>
            ) : (
              <span className="size-5 rounded-md border border-muted-foreground/40 hover:border-primary flex items-center justify-center">
                <Circle className="size-2.5 text-muted-foreground" />
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-1.5 flex-1">
            {/* Header tags: Tier, Client, Service */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-md border ${tierInfo.badgeClass}`}>
                {getTierLabel(tierInfo.tier, isDone)}
              </span>
              <span className="font-display font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                {clientName}
              </span>
              {task.service && (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {task.service}
                </span>
              )}
              {isStage && (
                <span
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    stageActionability.isLocked
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : "bg-primary/10 text-primary border-primary/20"
                  }`}
                  title={stageActionability.lockedReason}
                >
                  {stageActionability.isLocked ? <Lock className="size-2.5" /> : <Workflow className="size-2.5" />}
                  <span>{isAr ? `مرحلة ${task.sort_order || 1}` : `Stage ${task.sort_order || 1}`}</span>
                </span>
              )}
              {isStage && parentTask && (
                <span
                  className="text-[10px] font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 max-w-[200px] truncate"
                  title={`${isAr ? "المهمة الرئيسية:" : "Parent Task:"} ${parentTask.title}`}
                >
                  <Workflow className="size-2.5 shrink-0" />
                  <span className="truncate">{parentTask.title}</span>
                </span>
              )}
              {/* Phase 7: Ready for Publishing Tag */}
              {isStage &&
                (task.category === "publishing" || task.title.toLowerCase().includes("publishing") || task.title.includes("النشر")) &&
                !stageActionability.isLocked &&
                !isDone && (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 animate-pulse">
                    <Sparkles className="size-2.5" />
                    <span>{isAr ? "جاهز للنشر" : "Ready to Publish"}</span>
                  </span>
                )}
            </div>

            {/* Task Title */}
            <h4 className={`text-sm font-semibold text-foreground leading-snug ${isDone ? "line-through opacity-70" : ""}`}>
              {task.title}
            </h4>

            {/* Blocker Information when Blocked */}
            {isBlocked ? (
              <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20 max-w-2xl flex-wrap">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span className="font-bold">
                  {task.waiting_on ? BLOCKER_CATEGORY_LABELS[task.waiting_on as BlockerCategory] || `${isAr ? "بانتظار" : "Waiting for"} ${task.waiting_on}` : (isAr ? "معلقة" : "Blocked")}:
                </span>
                <span className="italic truncate">{task.blocked_reason || (isAr ? "بانتظار تأكيد إزالة العائق" : "Awaiting unblocking confirmation")}</span>
                <span className="text-[10px] font-mono text-muted-foreground ms-auto" dir="ltr">
                  {isAr ? `معلق منذ ${computeBlockedDuration(task.updated_at)}` : `Blocked ${computeBlockedDuration(task.updated_at)}`}
                </span>
              </div>
            ) : briefText ? (
              <p
                dir="auto"
                className="text-xs text-muted-foreground/90 line-clamp-1 italic bg-muted/30 px-2.5 py-1 rounded-lg border border-border/50 max-w-2xl break-words"
              >
                "{briefText}"
              </p>
            ) : null}

            {/* Context meta: Assigner, Worker, Revisions, Asset Links */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap pt-0.5 font-mono">
              <span>{isAr ? "المُكلِّف:" : "Assigned by:"} <strong className="text-foreground">{assignedByName}</strong></span>
              {canViewTeam && <span>• {isAr ? "المُنفِّذ:" : "Worker:"} <strong className="text-foreground">{workerName}</strong></span>}
              {(task.revision_count || 0) > 0 && (
                <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-bold" dir="ltr">
                  {isAr ? `تعديل #${task.revision_count}` : `Rev #${task.revision_count}`}
                </span>
              )}
              {task.result_links && task.result_links.length > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-semibold">
                  <span dir="ltr">{task.result_links.length}</span> {isAr ? "رابط تسليم" : "deliverable link(s)"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action & Deadline Column */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-border/40 shrink-0 flex-wrap">
          {/* Deadline Badge */}
          {task.deadline && (
            <span
              dir="ltr"
              className={`text-[11px] font-mono font-semibold px-2 sm:px-2.5 py-1 rounded-lg shrink-0 ${
              isDone
                ? "bg-muted text-muted-foreground"
                : overdue
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold animate-pulse"
                : isToday(parseISO(task.deadline))
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                : isTomorrow(parseISO(task.deadline))
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-muted text-foreground"
            }`}>
              {overdue && !isDone
                ? isAr
                  ? `متأخر (${differenceInDays(new Date(), parseISO(task.deadline))}ي)`
                  : `Overdue (${differenceInDays(new Date(), parseISO(task.deadline))}d)`
                : isToday(parseISO(task.deadline))
                ? isAr ? "يستحق اليوم" : "Due Today"
                : isTomorrow(parseISO(task.deadline))
                ? isAr ? "يستحق غداً" : "Due Tomorrow"
                : formatDate(parseISO(task.deadline), "d MMM")}
            </span>
          )}

          {/* Contextual Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isBlocked ? (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenTask(task)}
                  className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {isAr ? "معاينة" : "View"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleResolveBlocker(task, e)}
                  disabled={isMutating}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  {isMutating ? <RefreshCw className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                  <span>{isAr ? "استئناف" : "Resume"}</span>
                </button>
              </>
            ) : isInProgress ? (
              <>
                <button
                  type="button"
                  onClick={(e) => handlePauseTask(task, e)}
                  disabled={isMutating}
                  className="px-2 sm:px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title={isAr ? "إيقاف مؤقت" : "Pause execution"}
                >
                  {isMutating ? <RefreshCw className="size-3 animate-spin" /> : <Pause className="size-3" />}
                  <span className="hidden sm:inline">{isAr ? "إيقاف مؤقت" : "Pause"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenTask(task)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="size-3" />
                  <span className="hidden sm:inline">{isAr ? "إرسال للمراجعة" : "Submit for Review"}</span>
                  <span className="sm:hidden">{isAr ? "إرسال" : "Submit"}</span>
                </button>
              </>
            ) : isReview ? (
              canViewTeam ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleApproveTask(task, e)}
                    disabled={isMutating}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    {isMutating ? <RefreshCw className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                    <span>{isAr ? "اعتماد" : "Approve"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenTask(task)}
                    className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {isAr ? "مراجعة" : "Review"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenTask(task)}
                  className="px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="size-3" />
                  <span>{isAr ? "معاينة" : "View"}</span>
                </button>
              )
            ) : !isDone ? (
              stageActionability.isLocked ? (
                <button
                  type="button"
                  disabled
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed opacity-80"
                  title={stageActionability.lockedReason || undefined}
                >
                  <Lock className="size-3" />
                  <span>{isAr ? "مقفلة" : "Locked"}</span>
                </button>
              ) : (task.category === "publishing" || task.title.toLowerCase().includes("publishing") || task.title.includes("النشر")) ? (
                <button
                  type="button"
                  onClick={() => handleOpenTask(task)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer animate-pulse"
                >
                  <Share2 className="size-3" />
                  <span>{isAr ? "نشر المحتوى" : "Publish"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleStartTask(task, e)}
                  disabled={isMutating}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  {isMutating ? <RefreshCw className="size-3 animate-spin" /> : <Play className="size-3 fill-current" />}
                  <span>{isPaused ? (isAr ? "استئناف" : "Resume") : (isAr ? "بدء التنفيذ" : "Start")}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => handleOpenTask(task)}
                className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
              >
                <Eye className="size-3" />
                <span>{isAr ? "معاينة" : "View"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenTask(task)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={isAr ? "فتح مساحة عمل المهمة" : "Open Workspace"}
            >
              <ChevronRight className={`size-4 ${isAr ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"} transition-transform`} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Initial loading only when no task data is present
  if (loading && tasks.length === 0) {
    return <MyWorkSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 pb-20">
      {/* ============================================================ */}
      {/* 1. HEADER (Visually lightweight SADA OS style) */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase font-mono">
              {isAr ? "مركز تنفيذ المهام" : t("myWork.title", "Task Execution Center")}
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1">
            {isAr ? "مهامي وتكليفاتي" : t("myWork.title", "MY WORK")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr ? "قائمة التنفيذ والمخرجات المجدولة الخاصة بك" : t("myWork.subtitle", "Your execution queue")}
          </p>
        </div>

        {/* View Switcher: ONLY for Admins & Super Admins (Workers NEVER see Team Execution) */}
        {canViewTeam && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-1 bg-muted rounded-xl border border-border flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveView("my")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeView === "my"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isAr ? "تنفيذي الخاص" : t("commandCenter.scopes.myExecutionBtn", "My Execution")}
              </button>
              <button
                type="button"
                onClick={() => setActiveView("team")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === "team"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                <span>{isAr ? "تنفيذ الفريق" : t("team.title", "Team Execution")}</span>
                {teamMetrics && teamMetrics.overdueCount > 0 && (
                  <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Admin Target Worker Selector in Personal View */}
            {activeView === "my" && (
              <div className="flex items-center gap-1.5">
                <SADACombobox
                  value={selectedWorkerId}
                  onChange={setSelectedWorkerId}
                  placeholder={isAr ? "اختر الموظف..." : "Select worker..."}
                  searchPlaceholder={isAr ? "بحث في أعضاء الفريق..." : "Search team members..."}
                  className="w-52"
                  options={[
                    { value: "me", label: isAr ? "تكليفاتي الخاصة" : "My Assignments" },
                    { value: "all", label: isAr ? "كامل أعباء الفريق" : "Entire Team Workload" },
                    ...teamMembers.map(m => ({
                      value: m.id,
                      label: m.name,
                      subtitle: m.position ? `${m.position} (${m.division || "Ops"})` : undefined,
                    })),
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. TEAM EXECUTION VIEW (Admins / Super Admins Only) */}
      {/* ============================================================ */}
      {canViewTeam && activeView === "team" && teamMetrics && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Operational KPI Grid */}
          <div className="flex sm:grid overflow-x-auto sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 no-scrollbar pb-1 snap-x">
            <div className="min-w-[130px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">
                {isAr ? "المخرجات النشطة" : "Active Deliverables"}
              </span>
              <div className="text-2xl font-bold font-mono text-foreground mt-1" dir="ltr">
                {teamMetrics.activeCount}
              </div>
            </div>

            <div className="min-w-[130px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-600 dark:text-amber-400 block">
                {isAr ? "تستحق اليوم" : "Due Today"}
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1" dir="ltr">
                {teamMetrics.dueTodayCount}
              </div>
            </div>

            <div className={`min-w-[130px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border shadow-2xs ${
              teamMetrics.overdueCount > 0
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-border bg-card"
            }`}>
              <span className="text-[10px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400 block">
                {isAr ? "متأخرة" : "Overdue"}
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1" dir="ltr">
                {teamMetrics.overdueCount}
              </div>
            </div>

            <div className="min-w-[130px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-purple-500/30 bg-purple-500/5 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-purple-600 dark:text-purple-400 block">
                {isAr ? "قيد المراجعة" : "In Review"}
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1" dir="ltr">
                {teamMetrics.inReviewCount}
              </div>
            </div>

            <div className={`min-w-[130px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border shadow-2xs ${
              teamMetrics.blockedCount > 0
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-border bg-card"
            }`}>
              <span className="text-[10px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400 block">
                {isAr ? "معلقة / معطلة" : "Blocked"}
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1" dir="ltr">
                {teamMetrics.blockedCount}
              </div>
            </div>

            <div className="min-w-[130px] sm:min-w-0 snap-start shrink-0 sm:shrink p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                {isAr ? "أُنجزت اليوم" : "Done Today"}
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1" dir="ltr">
                {teamMetrics.completedTodayCount}
              </div>
            </div>
          </div>

          {/* Team Workload Matrix */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "مصفوفة أعباء تنفيذ الفريق" : "Team Execution Workload Matrix"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "الطاقة التشغيلية اللحظية، المعوقات، وحالة التنفيذ لجميع أخصائيي الفريق"
                    : "Live operational capacity, blockers, and execution state across all team specialists"}
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                <span dir="ltr">{teamMetrics.workerStats.length}</span> {isAr ? "أعضاء بالفريق" : "team members"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground uppercase font-mono text-[10px]">
                    <th className="text-start py-2.5 px-3">{isAr ? "عضو الفريق" : "Team Member"}</th>
                    <th className="text-start py-2.5 px-3">{isAr ? "المسمى الوظيفي" : "Position"}</th>
                    <th className="text-center py-2.5 px-3">{isAr ? "المهام النشطة" : "Active Tasks"}</th>
                    <th className="text-center py-2.5 px-3">{isAr ? "تستحق اليوم" : "Due Today"}</th>
                    <th className="text-center py-2.5 px-3">{isAr ? "متأخرة" : "Overdue"}</th>
                    <th className="text-center py-2.5 px-3">{isAr ? "قيد المراجعة" : "In Review"}</th>
                    <th className="text-center py-2.5 px-3">{isAr ? "معلقة" : "Blocked"}</th>
                    <th className="text-end py-2.5 px-3">{isAr ? "الإجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {teamMetrics.workerStats.map(({ member, active, dueToday, overdue, blocked, inReview }) => (
                    <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{member.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono" dir="ltr">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {member.position || (isAr ? "أخصائي عمليات" : "Operations Specialist")}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold" dir="ltr">
                        {active}
                      </td>
                      <td className="py-3 px-3 text-center font-mono" dir="ltr">
                        {dueToday > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                            {dueToday}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono" dir="ltr">
                        {overdue > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                            {overdue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono" dir="ltr">
                        {inReview > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                            {inReview}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono" dir="ltr">
                        {blocked > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                            {blocked}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWorkerId(member.id);
                            setActiveView("my");
                          }}
                          className="px-2.5 py-1 rounded-lg border border-border hover:bg-primary hover:text-primary-foreground text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          {isAr ? "معاينة قائمة المهام" : "Inspect Queue"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. PERSONAL EXECUTION QUEUE (Active for Worker and Admin) */}
      {/* ============================================================ */}
      {(effectiveView === "my" || !canViewTeam) && (
        <div className="space-y-6">
          {/* EXECUTION CONTROLS & FILTER BAR */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-3 min-w-0 max-w-full overflow-hidden">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between min-w-0 max-w-full">
              {/* Live Search */}
              <div className="relative w-full md:w-80 min-w-0">
                <Search className="size-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("common.search.placeholder", "Search deliverables, clients, brief...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl ps-9 pe-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-start"
                />
              </div>

              {/* Status Tab Pills */}
              <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto no-scrollbar scrollbar-none min-w-0 py-0.5">
                {[
                  { id: "open", label: isAr ? "قائمة العمل النشطة" : t("myWork.queues.all", "Active Queue") },
                  { id: "today", label: isAr ? "اليوم والمتأخرة" : t("myWork.queues.today", "Today & Overdue") },
                  { id: "in_progress", label: isAr ? "قيد التنفيذ" : t("myWork.queues.inProgress", "In Progress") },
                  { id: "paused", label: isAr ? "متوقفة مؤقتاً" : "Paused" },
                  { id: "blocked", label: isAr ? "معلقة" : t("myWork.queues.blocked", "Blocked") },
                  { id: "review", label: isAr ? "بانتظار المراجعة" : t("myWork.queues.review", "Waiting for Review") },
                  { id: "upcoming", label: isAr ? "القادمة" : t("myWork.queues.upcoming", "Upcoming") },
                  { id: "done", label: isAr ? "المكتملة" : t("myWork.queues.completed", "Completed") },
                  { id: "all", label: isAr ? "جميع المهام" : t("tasks.plural", "All Tasks") },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      statusFilter === tab.id
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdown Filters: Priority & Client */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-border/50 flex-wrap">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">{isAr ? "التصفية:" : t("common.table.filters", "Filter:")}</span>

              <div className="w-36">
                <SADASelect
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  size="compact"
                  placeholder={isAr ? "جميع الأولويات" : t("common.filter.all", "All Priorities")}
                  options={[
                    { value: "all", label: isAr ? "جميع الأولويات" : t("common.filter.all", "All Priorities") },
                    { value: "urgent", label: isAr ? "حرجة عاجلة" : t("common.priority.urgent", "Urgent") },
                    { value: "high", label: isAr ? "أولوية عالية" : t("common.priority.high", "High") },
                    { value: "medium", label: isAr ? "أولوية متوسطة" : t("common.priority.medium", "Medium") },
                    { value: "low", label: isAr ? "أولوية منخفضة" : t("common.priority.low", "Low") },
                  ]}
                />
              </div>

              <div className="w-48">
                <SADASelect
                  value={clientFilter}
                  onChange={setClientFilter}
                  size="compact"
                  placeholder={isAr ? "جميع العملاء" : t("clients.fields.companyName", "All Clients")}
                  options={[
                    { value: "all", label: isAr ? "جميع العملاء" : t("clients.fields.companyName", "All Clients") },
                    ...clients.map(c => ({ value: c.id, label: c.name }))
                  ]}
                />
              </div>

              {(priorityFilter !== "all" || clientFilter !== "all" || searchQuery.trim().length > 0 || statusFilter !== "open") && (
                <button
                  type="button"
                  onClick={() => {
                    setPriorityFilter("all");
                    setClientFilter("all");
                    setSearchQuery("");
                    setStatusFilter("open");
                  }}
                  className="text-[11px] font-mono text-primary hover:underline ms-auto cursor-pointer flex items-center gap-1"
                >
                  <X className="size-3" />
                  <span>{isAr ? "إعادة الضبط" : t("common.actions.reset", "Reset filters")}</span>
                </button>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* 4. THE MAIN FEATURE — NEXT TASK */}
          {/* ============================================================ */}
          {nextUp?.nextTask ? (
            (() => {
              const recTask = nextUp.nextTask;
              const client = recTask.client_id ? clientMap.get(recTask.client_id) : null;
              const project = recTask.project_id ? projectMap.get(recTask.project_id) : null;
              const clientName = client?.name || project?.client_name || "SADA Client";
              const isOverdue = isTaskOverdue(recTask);
              const isMutating = actionLoadingTaskId === recTask.id;
              const briefText = recTask.notes || recTask.description;
              const assignedByName = getAssignerName(recTask.assigned_by_id);
              const workerName = getWorkerName(recTask.assignee_id);
              const isPaused = isTaskPaused(recTask, pausedTaskIds);
              const isInProgress = recTask.status === "in_progress";
              const tierInfo = computeTaskExecutionTier(recTask);

              return (
                <div id="sada-next-task-card" className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm space-y-3.5 sm:space-y-4 relative overflow-hidden scroll-mt-20">
                  {/* Glowing subtle top bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-primary" />

                  {/* Header: NEXT TASK Title + Tier Badge + Deadline */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <Flame className="size-3.5 fill-current" />
                        <span>{isAr ? "المهمة التالية للأولوية" : t("myWork.nextTask.badge", "NEXT UP")}</span>
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-xs uppercase font-mono border ${tierInfo.badgeClass}`}>
                        {getTierLabel(tierInfo.tier, recTask.status === "done")}
                      </span>
                      {isInProgress && (
                        <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold font-mono uppercase tracking-wider animate-pulse">
                          {isAr ? "قيد التنفيذ" : t("common.status.inProgress", "In Progress")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {recTask.deadline && (
                        <span
                          dir="ltr"
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs font-mono ${
                          isOverdue
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse"
                            : isToday(parseISO(recTask.deadline))
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-foreground"
                        }`}>
                          {isOverdue ? (isAr ? "متأخرة" : t("common.time.overdue", "Overdue")) : isToday(parseISO(recTask.deadline)) ? (isAr ? "تستحق اليوم" : t("common.time.today", "Due Today")) : formatDate(parseISO(recTask.deadline), "d MMM")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Client / Service */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground font-mono">
                      <span className="font-bold text-foreground text-sm">{clientName}</span>
                      {recTask.service && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-semibold">{recTask.service}</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground tracking-tight">
                      {recTask.title}
                    </h2>
                  </div>

                  {/* WHY THIS IS NEXT (Deterministic Rationale) */}
                  <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary block">
                      {isAr ? "لماذا تم اختيار هذه المهمة تالياً؟" : t("myWork.nextTask.title", "WHY THIS IS NEXT")}
                    </span>
                    <ul className="text-xs text-foreground/90 space-y-1">
                      {nextUp.rationale.map((reason: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary shrink-0" />
                          <span>{localizeRationale(reason)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ASSIGNMENT (Dedicated Prominent Brief with Multilingual Support) */}
                  <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-b border-border/50 pb-2 flex-wrap gap-2">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                        <FileText className="size-3.5 text-primary" />
                        <span>{isAr ? "التكليف والتعليمات التنفيذية" : t("tasks.singular", "ASSIGNMENT")}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span>{isAr ? "المُكلِّف:" : t("tasks.assignedByLabel", "Assigned by")}: <strong className="text-foreground">{assignedByName}</strong></span>
                        <span>•</span>
                        <span>{isAr ? "المُنفِّذ المسؤول:" : t("tasks.assigneeLabel", "Worker")}: <strong className="text-foreground">{workerName}</strong></span>
                      </div>
                    </div>

                    <div
                      dir="auto"
                      className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed py-1"
                    >
                      {briefText || (isAr ? "لا توجد تعليمات كتابية إضافية. نفّذ المخرج وفقاً للمواصفات القياسية المعتمدة للعميل." : "No additional written instructions. Execute deliverable according to client standard specifications.")}
                    </div>
                  </div>

                  {/* Primary Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isInProgress ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenTask(recTask)}
                            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                          >
                            <Play className="size-3.5 fill-current" />
                            <span>{isAr ? "متابعة المهمة" : t("myWork.nextTask.startWorking", "CONTINUE TASK")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handlePauseTask(recTask, e)}
                            disabled={isMutating}
                            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            {isMutating ? <RefreshCw className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
                            <span>{isAr ? "إيقاف مؤقت" : t("myWork.actions.pause", "PAUSE")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTask(recTask)}
                            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Send className="size-3.5" />
                            <span>{isAr ? "إرسال للمراجعة والاعتماد" : t("myWork.nextTask.submitReview", "SUBMIT FOR REVIEW")}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleStartTask(recTask, e)}
                            disabled={isMutating}
                            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                          >
                            {isMutating ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                            <span>{isPaused ? (isAr ? "استئناف التنفيذ" : t("myWork.nextTask.startWorking", "RESUME TASK")) : (isAr ? "بدء التنفيذ" : t("myWork.nextTask.startWorking", "START TASK"))}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTask(recTask)}
                            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                          >
                            {isAr ? "فتح مساحة عمل التنفيذ" : t("myWork.actions.viewWorkspace", "Open Execution Workspace")}
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenTask(recTask)}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 self-end sm:self-center cursor-pointer"
                    >
                      <span>{isAr ? "مساحة عمل المهمة" : "Task Workspace"}</span>
                      <ArrowRight className={`size-3 ${isAr ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            /* Positive Empty State: ALL CLEAR */
            <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-2.5 sm:space-y-3">
              <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  {isAr ? "كل المهام منجزة ومستقرة" : "ALL CLEAR"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                  {isAr ? "ليس لديك مخرجات أو مهام نشطة تتطلب تدخلاً في الوقت الحالي." : "You have no active deliverables requiring attention right now."}
                </p>
              </div>

              {/* Quick links to review or upcoming queues */}
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                {buckets.inReview.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("review")}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-semibold transition-colors cursor-pointer border border-purple-500/20"
                  >
                    {isAr ? `بانتظار المراجعة (${buckets.inReview.length})` : `Waiting for Review (${buckets.inReview.length})`}
                  </button>
                )}
                {buckets.upcoming.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("upcoming")}
                    className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer border border-border"
                  >
                    {isAr ? `المخرجات القادمة (${buckets.upcoming.length})` : `Upcoming Deliverables (${buckets.upcoming.length})`}
                  </button>
                )}
                {buckets.completed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("done")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors cursor-pointer border border-emerald-500/20"
                  >
                    {isAr ? `المكتملة (${buckets.completed.length})` : `Completed (${buckets.completed.length})`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. EXECUTION QUEUE (Canonical 6 Sections) */}
          {/* ============================================================ */}
          <div className="space-y-8">
            {/* SECTION 1: TODAY & OVERDUE */}
            {(statusFilter === "open" || statusFilter === "today" || statusFilter === "all") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-amber-500" />
                    <h2 className="font-display text-base font-bold text-foreground">
                      {isAr ? "مهام اليوم والمتأخرة" : "TODAY & OVERDUE"}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                    <span dir="ltr">{buckets.todayAndOverdue.length}</span> {isAr ? "عنصر" : "items"}
                  </span>
                </div>

                {buckets.todayAndOverdue.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 italic">
                    {isAr ? "لا توجد مهام تستحق اليوم أو متأخرة في هذه القائمة." : "Nothing due today or overdue in this queue."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {buckets.todayAndOverdue.map(renderExecutionTaskCard)}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: IN PROGRESS */}
            {(statusFilter === "open" || statusFilter === "in_progress" || statusFilter === "all") && buckets.inProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary animate-pulse" />
                    <h2 className="font-display text-base font-bold text-foreground">
                      {isAr ? "قيد التنفيذ" : "IN PROGRESS"}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    <span dir="ltr">{buckets.inProgress.length}</span> {isAr ? "نشطة" : "active"}
                  </span>
                </div>
                <div className="space-y-2">
                  {buckets.inProgress.map(renderExecutionTaskCard)}
                </div>
              </div>
            )}

            {/* SECTION 3: BLOCKED */}
            {(statusFilter === "open" || statusFilter === "blocked" || statusFilter === "all") && buckets.blocked.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <h2 className="font-display text-base font-bold text-rose-600 dark:text-rose-400">
                      {isAr ? "مهام معلقة / معطلة" : "BLOCKED"}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                    <span dir="ltr">{buckets.blocked.length}</span> {isAr ? "معلقة" : "blocked"}
                  </span>
                </div>
                <div className="space-y-2">
                  {buckets.blocked.map(renderExecutionTaskCard)}
                </div>
              </div>
            )}

            {/* SECTION 4: WAITING FOR REVIEW */}
            {(statusFilter === "open" || statusFilter === "review" || statusFilter === "all") && buckets.inReview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-purple-500" />
                    <h2 className="font-display text-base font-bold text-purple-600 dark:text-purple-400">
                      {isAr ? "بانتظار المراجعة والاعتماد" : "WAITING FOR REVIEW"}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                    <span dir="ltr">{buckets.inReview.length}</span> {isAr ? "قيد المراجعة" : "in review"}
                  </span>
                </div>
                <div className="space-y-2">
                  {buckets.inReview.map(renderExecutionTaskCard)}
                </div>
              </div>
            )}

            {/* SECTION 5: UPCOMING */}
            {(statusFilter === "open" || statusFilter === "upcoming" || statusFilter === "all") && buckets.upcoming.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-muted-foreground/60" />
                    <h2 className="font-display text-base font-bold text-foreground">
                      {isAr ? "المهام القادمة المجدولة" : "UPCOMING"}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                    <span dir="ltr">{buckets.upcoming.length}</span> {isAr ? "عنصر" : "items"}
                  </span>
                </div>
                <div className="space-y-2">
                  {buckets.upcoming.map(renderExecutionTaskCard)}
                </div>
              </div>
            )}

            {/* SECTION 6: COMPLETED */}
            {(statusFilter === "done" || statusFilter === "all" || (statusFilter !== "open" && buckets.completed.length > 0)) && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="font-display text-base font-bold text-foreground">
                      {isAr ? "المهام المكتملة" : "COMPLETED"}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    <span dir="ltr">{buckets.completed.length}</span> {isAr ? "مكتملة" : "completed"}
                  </span>
                </div>
                {buckets.completed.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 italic">
                    {isAr ? "لم يتم العثور على مخرجات مكتملة تطابق التصفية الحالية." : "No completed deliverables found for the selected filter."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {buckets.completed.map(renderExecutionTaskCard)}
                  </div>
                )}
              </div>
            )}

            {/* Empty State when filters yield 0 results */}
            {filteredTasks.length === 0 && (
              <div className="p-8 rounded-3xl border border-border/80 bg-card text-center space-y-3">
                <CheckCircle className="size-8 text-muted-foreground mx-auto" />
                <h3 className="font-display font-bold text-base text-foreground">
                  {isAr ? "لا توجد مخرجات مطابقة" : "No Matching Deliverables"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isAr ? "لا توجد مخرجات تطابق كلمات البحث أو معايير التصفية المحددة." : "No deliverables match your search query or filter selection."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("open");
                    setPriorityFilter("all");
                    setClientFilter("all");
                    setSearchQuery("");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
                >
                  {isAr ? "إعادة ضبط التصفية" : "Reset Filters"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. TASK DETAIL WORKSPACE MODAL */}
      {/* ============================================================ */}
      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          project={projectMap.get(activeTask.project_id) || null}
          profiles={profiles}
          teamMembers={teamMembers}
          onEdit={(taskToEdit: TaskRow) => {
            handleCloseTask();
            setEditingTask(taskToEdit);
            setShowTaskModal(true);
          }}
          onStatusChange={(taskId, newStatus) => {
            const nowIso = newStatus === "done" || newStatus === "approved" || newStatus === "delivered" ? new Date().toISOString() : null;
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: nowIso } : t));
          }}
          onClose={handleCloseTask}
        />
      )}

      {/* ============================================================ */}
      {/* 7. CANONICAL TASK MODAL (EDIT TASK DEFINITION) */}
      {/* ============================================================ */}
      {showTaskModal && editingTask && (
        <TaskModal
          task={editingTask}
          projectId={editingTask.project_id || (projects[0]?.id ?? "")}
          profiles={profiles}
          teamMembers={teamMembers}
          projectServices={projects.find(p => p.id === (editingTask.project_id || projects[0]?.id))?.requested_services || []}
          onSaved={async () => {
            const savedTaskId = editingTask.id;
            setShowTaskModal(false);
            setEditingTask(null);
            await loadMyWorkData(false);
            // Fetch latest task state to reopen TaskDetailModal with fresh data
            const { data: updatedTask } = await (supabase as any)
              .from("project_tasks")
              .select("*")
              .eq("id", savedTaskId)
              .maybeSingle();
            if (updatedTask) {
              handleOpenTask(updatedTask);
            }
          }}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
