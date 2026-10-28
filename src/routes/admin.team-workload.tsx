import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronUp,
  Eye, EyeOff, AlertCircle, ArrowUpRight, Flame, ShieldAlert, Sparkles, PhoneCall,
  UserPlus, UserCheck, Settings, CheckSquare, Sparkle, Plus, Filter, User, Zap,
  Loader2, RefreshCw
} from "lucide-react";
import { isToday, parseISO, format } from "date-fns";
import {
  isTaskOverdue, STATUS_CONFIG, PRIORITY_CONFIG, resolveToProfileId,
  type TaskRow, type ProfileRow, type ProjectRow, type TeamMemberRow
} from "@/components/admin/project-utils";
import { TaskModal } from "@/components/admin/TaskModal";
import { TeamMemberModal } from "@/components/admin/TeamMemberModal";
import { MemberWorkspaceModal } from "@/components/admin/MemberWorkspaceModal";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADACheckbox, TeamWorkloadSkeleton } from "@/components/ui/sada-ui";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/team-workload")({
  component: TeamWorkloadPage,
});

export function TeamWorkloadPage() {
  const { isWorker, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: "workload" | "directory" | "unassigned"
  const [activeTab, setActiveTab] = useState<"workload" | "directory" | "unassigned">("workload");

  // Modals & Drawers
  const [editingMember, setEditingMember] = useState<TeamMemberRow | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [workspaceMember, setWorkspaceMember] = useState<TeamMemberRow | null>(null);

  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Bulk / Quick Assignment State for Unassigned Tasks
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<string[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadData = async (isBackground = false) => {
    if (isWorker) {
      setLoading(false);
      return;
    }
    if (!isBackground && tasks.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const [tasksRes, profRes, teamRes, projRes] = await Promise.all([
        (supabase as any).from("project_tasks").select("*"),
        (supabase as any).from("profiles").select("id, display_name"),
        (supabase as any).from("team_members").select("*").order("sort_order", { ascending: true }),
        (supabase as any).from("client_projects").select("*"),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (profRes.error) throw profRes.error;
      if (teamRes.error) throw teamRes.error;
      if (projRes.error) throw projRes.error;

      setTasks(tasksRes.data || []);
      setProfiles(profRes.data || []);
      setTeamMembers(teamRes.data || []);
      setProjects(projRes.data || []);
    } catch (err: any) {
      console.error("Error loading team workload data:", err);
      setError(err.message || "Failed to load team management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("realtime:team_workload")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_tasks" },
        () => { loadData(true); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Merge team members with fallback profiles if any profile is not in team_members
  const unifiedMembers = useMemo(() => {
    const list: TeamMemberRow[] = [...teamMembers];
    const existingProfileIds = new Set(teamMembers.map((m) => m.profile_id).filter(Boolean));
    const existingMemberIds = new Set(teamMembers.map((m) => m.id));

    for (const p of profiles) {
      if (!existingProfileIds.has(p.id) && !existingMemberIds.has(p.id)) {
        list.push({
          id: p.id,
          profile_id: p.id,
          name: p.display_name || "Team Member",
          position: "Specialist",
          division: "Development",
          specialties: [],
          sort_order: 99,
          published: false,
          is_active: true,
          availability_status: "available",
          display_name: p.display_name,
        });
      }
    }
    return list;
  }, [teamMembers, profiles]);

  // Group tasks and follow-ups by unified member
  const memberWorkloads = useMemo(() => {
    const map = new Map<
      string,
      {
        member: TeamMemberRow;
        tasks: TaskRow[];
        followups: ProjectRow[];
      }
    >();

    for (const m of unifiedMembers) {
      const entry = { member: m, tasks: [], followups: [] };
      map.set(m.id, entry);
      if (m.profile_id && m.profile_id !== m.id) {
        map.set(m.profile_id, entry);
      }
    }

    const unassignedList: TaskRow[] = [];

    for (const t of tasks) {
      const isTerminal = t.status === "done" || t.status === "cancelled" || t.status === "paused";
      if (!t.assignee_id) {
        if (!isTerminal) {
          unassignedList.push(t);
        }
      } else {
        const target = map.get(t.assignee_id);
        if (target) {
          if (!isTerminal && !target.tasks.includes(t)) target.tasks.push(t);
        } else {
          if (!isTerminal) {
            unassignedList.push(t);
          }
        }
      }
    }

    for (const p of projects) {
      if (p.followup_owner_id) {
        const target = map.get(p.followup_owner_id);
        if (target && !target.followups.includes(p)) {
          target.followups.push(p);
        }
      }
    }

    return { map, unassignedList };
  }, [unifiedMembers, tasks, projects]);

  // Metrics Pulse calculation (reconciled with canonical active tasks & memberWorkloads)
  const pulseMetrics = useMemo(() => {
    const activeMembersCount = unifiedMembers.filter((m) => m.is_active).length;
    const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.status !== "paused");
    const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t));
    const blockedTasks = activeTasks.filter((t) => t.status === "blocked");

    return {
      activeMembersCount,
      activeTasksCount: activeTasks.length,
      unassignedCount: memberWorkloads.unassignedList.length,
      overdueCount: overdueTasks.length,
      blockedCount: blockedTasks.length,
    };
  }, [unifiedMembers, tasks, memberWorkloads.unassignedList.length]);

  // Unassigned tasks deterministic suggestion engine (Zero AI)
  const getSuggestedMembersForTask = (task: TaskRow): TeamMemberRow[] => {
    const serviceName = (task.service || "").toLowerCase();
    const categoryName = (task.category || "").toLowerCase();

    return unifiedMembers
      .filter((m) => m.is_active)
      .map((m) => {
        let score = 0;

        // Division match
        if (serviceName.includes("market") || serviceName.includes("social") || serviceName.includes("brand")) {
          if (m.division === "Marketing") score += 3;
        } else if (serviceName.includes("dev") || serviceName.includes("web") || serviceName.includes("ui") || serviceName.includes("ux")) {
          if (m.division === "Development") score += 3;
        } else if (serviceName.includes("video") || serviceName.includes("reel") || serviceName.includes("photo") || serviceName.includes("content")) {
          if (m.division === "Production") score += 3;
        }

        // Specialties match
        for (const spec of m.specialties || []) {
          if (serviceName.includes(spec.toLowerCase()) || categoryName.includes(spec.toLowerCase())) {
            score += 4;
          }
        }

        // Active task count penalty (favor balanced members)
        const activeCount = (memberWorkloads.map.get(m.id)?.tasks || []).filter(
          (t) => t.status !== "done" && t.status !== "cancelled"
        ).length;
        score -= activeCount * 0.5;

        return { member: m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.member);
  };

  const getDivisionLabel = (division: string) => {
    if (!isAr) return division;
    switch (division?.toLowerCase()) {
      case "development": return "التطوير البرمجي";
      case "marketing": return "التسويق الرقمي";
      case "production": return "الإنتاج والمحتوى";
      case "design": return "التصميم الإبداعي";
      case "management": return "الإدارة التنفيذية";
      case "operations": case "ops": return "العمليات التشغيلية";
      default: return division;
    }
  };

  const getEmploymentTypeLabel = (type?: string | null) => {
    if (!type) return "";
    if (!isAr) return type.replace(/_/g, " ");
    switch (type) {
      case "full_time": return "دوام كامل";
      case "part_time": return "دوام جزئي";
      case "freelance": return "مستقل";
      case "contract": return "عقد محدد";
      case "internship": return "تدريب";
      default: return type.replace(/_/g, " ");
    }
  };

  // Bulk assign handler
  const handleBulkAssign = async () => {
    if (!bulkAssigneeId || selectedUnassignedIds.length === 0) return;
    setBulkAssigning(true);

    try {
      const resolvedProfileId = resolveToProfileId(bulkAssigneeId, teamMembers, profiles);
      if (!resolvedProfileId) {
        toast.error(isAr ? "عضو الفريق المحدد ليس لديه حساب مستخدم نشط." : "Selected team member does not have an active user profile account.");
        setBulkAssigning(false);
        return;
      }

      const { error } = await (supabase as any)
        .from("project_tasks")
        .update({ assignee_id: resolvedProfileId, updated_at: new Date().toISOString() })
        .in("id", selectedUnassignedIds);

      if (error) throw error;
      toast.success(isAr ? `تم تعيين ${selectedUnassignedIds.length} مهام بنجاح.` : `Assigned ${selectedUnassignedIds.length} tasks successfully.`);
      setSelectedUnassignedIds([]);
      setBulkAssigneeId("");
      await loadData();
    } catch (err: any) {
      toast.error((isAr ? "فشل تعيين المهام: " : "Failed to assign tasks: ") + err.message);
    } finally {
      setBulkAssigning(false);
    }
  };

  // Single task assign handler
  const handleAssignSingle = async (taskId: string, assigneeId: string) => {
    try {
      const resolvedProfileId = resolveToProfileId(assigneeId, teamMembers, profiles);
      if (!resolvedProfileId) {
        toast.error(isAr ? "عضو الفريق المحدد ليس لديه حساب مستخدم نشط." : "Selected team member does not have an active user profile account.");
        return;
      }

      const { error } = await (supabase as any)
        .from("project_tasks")
        .update({ assignee_id: resolvedProfileId, updated_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) throw error;
      toast.success(isAr ? "تمت إعادة تعيين المهمة بنجاح." : "Task reassigned successfully.");
      await loadData();
    } catch (err: any) {
      toast.error((isAr ? "فشل تعيين المهمة: " : "Failed to assign task: ") + err.message);
    }
  };

  if (!authLoading && isWorker) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 grid place-items-center mx-auto">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground">
          {isAr ? "صلاحية الوصول مقيدة" : "Access Restricted"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "لوحة إدارة الفريق وطاقة عمل الوكالة مخصصة لمديري وإدارة سدى فقط."
            : "Team Management and Agency Workload views are reserved for SADA Administrators and Management."}
        </p>
        <div className="pt-2">
          <Link
            to="/admin/my-work"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {isAr ? "الانتقال إلى مهامي" : "Go to My Work"}
          </Link>
        </div>
      </div>
    );
  }

  if (loading && tasks.length === 0) {
    return <TeamWorkloadSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 rounded-3xl border border-destructive/30 bg-destructive/5 text-center space-y-4 max-w-lg mx-auto my-16 soft-shadow">
        <AlertCircle className="size-10 text-destructive mx-auto" />
        <h2 className="font-display font-bold text-xl text-foreground">
          {isAr ? "فشل تحميل بيانات طاقة عمل الفريق" : "Failed to Load Team Workload"}
        </h2>
        <p className="text-xs text-muted-foreground">{error}</p>
        <button
          onClick={() => loadData()}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="size-4" /> {isAr ? "إعادة محاولة التحميل" : "Retry Loading Data"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              SADA WORK OS
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {isAr ? "إدارة الفريق والقدرة الاستيعابية الموحدة" : "Unified Team & Capacity Management"}
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            {isAr ? "إدارة الفريق وتوزيع طاقة العمل" : "Team Management & Workload"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? "إدارة أعضاء الفريق، وإعادة موازنة طاقة العمل المباشرة، وتعيين المهام غير المسندة، ومزامنة الملفات التعريفية للموقع."
              : "Manage team members, rebalance live workload, assign unassigned tasks, and sync public website profiles."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setEditingMember(null);
              setShowMemberModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity soft-shadow"
          >
            <UserPlus className="size-4" /> {isAr ? "إضافة عضو فريق" : "Add Team Member"}
          </button>
        </div>
      </div>

      {/* Operational Pulse Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl border border-border bg-card soft-shadow">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {isAr ? "الفريق النشط" : "Active Team"}
          </div>
          <div className="text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
            <Users className="size-5 text-primary" /> {pulseMetrics.activeMembersCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card soft-shadow">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {isAr ? "المهام النشطة" : "Active Tasks"}
          </div>
          <div className="text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
            <Clock className="size-5 text-primary" /> {pulseMetrics.activeTasksCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card soft-shadow">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {isAr ? "غير المعينة" : "Unassigned"}
          </div>
          <div className={`text-2xl font-bold mt-1 flex items-center gap-2 ${pulseMetrics.unassignedCount > 0 ? "text-amber-500" : "text-foreground"}`}>
            <AlertCircle className="size-5" /> {pulseMetrics.unassignedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card soft-shadow">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {isAr ? "المتأخرة" : "Overdue"}
          </div>
          <div className={`text-2xl font-bold mt-1 flex items-center gap-2 ${pulseMetrics.overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>
            <AlertTriangle className="size-5" /> {pulseMetrics.overdueCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card soft-shadow col-span-2 sm:col-span-1">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {isAr ? "المعلقة" : "Blocked"}
          </div>
          <div className={`text-2xl font-bold mt-1 flex items-center gap-2 ${pulseMetrics.blockedCount > 0 ? "text-rose-500" : "text-foreground"}`}>
            <ShieldAlert className="size-5" /> {pulseMetrics.blockedCount}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("workload")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "workload"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {isAr ? "طاقة العمل والقدرة الاستيعابية" : "Capacity & Workload"}
        </button>

        <button
          onClick={() => setActiveTab("directory")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "directory"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {isAr ? `دليل أعضاء الفريق (${unifiedMembers.length})` : `Team Roster (${unifiedMembers.length})`}
        </button>

        <button
          onClick={() => setActiveTab("unassigned")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "unassigned"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {isAr ? "المهام غير المعينة" : "Unassigned Tasks"}
          {memberWorkloads.unassignedList.length > 0 && (
            <span className="size-5 rounded-full bg-amber-500 text-white font-bold text-[10px] grid place-items-center">
              {memberWorkloads.unassignedList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: WORKLOAD & CAPACITY */}
      {activeTab === "workload" && (
        <div className="space-y-4">
          {unifiedMembers.length > 0 ? (
            unifiedMembers.map((m) => {
              const data = memberWorkloads.map.get(m.id) || { member: m, tasks: [], followups: [] };
              const activeTasks = data.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
              const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t));
              const todayTasks = activeTasks.filter((t) => t.deadline && isToday(parseISO(t.deadline)));
              const highOrUrgent = activeTasks.filter((t) => t.priority === "high" || t.priority === "urgent");
              const waitingOnClientTasks = activeTasks.filter((t) => t.status === "blocked" && t.waiting_on === "client");

              let capacityBadge = {
                label: isAr ? "تحت الطاقة" : "Under Capacity",
                color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
              };
              if (activeTasks.length >= 9 || m.availability_status === "overloaded") {
                capacityBadge = {
                  label: isAr ? "فائض عن الطاقة" : "Overloaded",
                  color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
                };
              } else if (activeTasks.length >= 5 || m.availability_status === "busy") {
                capacityBadge = {
                  label: isAr ? "حمل ثقيل" : "Heavy Load",
                  color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                };
              } else if (activeTasks.length > 0) {
                capacityBadge = {
                  label: isAr ? "متوازن" : "Balanced",
                  color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                };
              }

              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden soft-shadow transition-all hover:border-primary/30"
                >
                  <div className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {m.photo_url ? (
                        <img
                          src={m.photo_url}
                          alt={m.name}
                          className="size-10 sm:size-12 rounded-xl sm:rounded-2xl object-cover ring-2 ring-border shrink-0"
                        />
                      ) : (
                        <span className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-gradient-primary text-white text-sm sm:text-base font-bold grid place-items-center shrink-0 ring-2 ring-border">
                          {m.name[0].toUpperCase()}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-sm sm:text-base text-foreground truncate max-w-full">{m.name}</span>
                          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {getDivisionLabel(m.division)}
                          </span>
                          <span className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-md border shrink-0 ${capacityBadge.color}`}>
                            {capacityBadge.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5">
                          <span>{m.position}</span>
                          <span>·</span>
                          <strong className="text-foreground">{isAr ? `${activeTasks.length} مهام نشطة` : `${activeTasks.length} active tasks`}</strong>
                          {overdueTasks.length > 0 && (
                            <span className="text-destructive font-bold"> · {isAr ? `${overdueTasks.length} متأخرة` : `${overdueTasks.length} overdue`}</span>
                          )}
                          {todayTasks.length > 0 && (
                            <span className="text-amber-500 font-semibold"> · {isAr ? `${todayTasks.length} تستحق اليوم` : `${todayTasks.length} due today`}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        onClick={() => setWorkspaceMember(m)}
                        className="px-3 py-1.5 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
                      >
                        <Zap className="size-3.5 text-primary" /> {isAr ? "مساحة العمل" : "Workspace"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingMember(m);
                          setShowMemberModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {isAr ? "تعديل الملف" : "Edit Profile"}
                      </button>
                    </div>
                  </div>

                  {/* Task list preview */}
                  {activeTasks.length > 0 && (
                    <div className="border-t border-border bg-muted/10 divide-y divide-border/60">
                      {activeTasks.slice(0, 4).map((t) => {
                        const proj = projectMap.get(t.project_id);
                        const statusConf = STATUS_CONFIG[t.status];
                        const priorityConf = PRIORITY_CONFIG[t.priority];
                        const overdue = isTaskOverdue(t);

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setEditingTask(t);
                              setShowTaskModal(true);
                            }}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors ${
                              overdue ? "bg-destructive/5" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-foreground truncate">{t.title}</span>
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${priorityConf.color} ${priorityConf.bg}`}>
                                  {priorityConf.label}
                                </span>
                                {t.service && (
                                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {t.service}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                                {proj && <span className="font-medium text-foreground/80">{proj.client_name} — {proj.title}</span>}
                                {t.deadline && (
                                  <span className={overdue ? "text-destructive font-bold" : ""}>
                                    {isAr ? "الاستحقاق: " : "Due: "}
                                    <span dir="ltr">{format(parseISO(t.deadline), "d MMM yyyy")}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${overdue ? "text-destructive bg-destructive/10" : statusConf.color}`}>
                                {overdue ? (isAr ? "متأخرة" : "Overdue") : statusConf.label}
                              </span>
                              <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                                {isAr ? "إدارة" : "Manage"} <ArrowUpRight className="size-3 rtl:rotate-180" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center border border-border rounded-3xl bg-card space-y-3 soft-shadow">
              <Users className="size-10 text-muted-foreground mx-auto mb-2" />
              <h3 className="font-display font-bold text-lg text-foreground">
                {isAr ? "لم يتم العثور على أعضاء في الفريق" : "No Team Members Found"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isAr
                  ? "أضف عضو الفريق الأول لبدء تتبع القدرة التشغيلية وطاقة العمل ونشر الملفات الشخصية على الموقع."
                  : "Add your first team member to start tracking operational capacity, workload, and publishing website profiles."}
              </p>
              <button
                onClick={() => {
                  setEditingMember(null);
                  setShowMemberModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs inline-flex items-center gap-2 hover:opacity-90 transition-opacity mt-2"
              >
                <UserPlus className="size-4" /> {isAr ? "إضافة عضو الفريق الأول" : "Add First Team Member"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEAM ROSTER & DIRECTORY */}
      {activeTab === "directory" && (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {unifiedMembers.length > 0 ? (
            unifiedMembers.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 soft-shadow space-y-3 sm:space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.name} className="size-10 sm:size-12 rounded-xl sm:rounded-2xl object-cover ring-2 ring-border shrink-0" />
                      ) : (
                        <span className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-gradient-primary text-white font-bold text-base sm:text-lg grid place-items-center shrink-0">
                          {m.name[0].toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-bold text-sm sm:text-base text-foreground truncate">{m.name}</h3>
                        <p className="text-xs text-primary font-semibold truncate">{m.position}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingMember(m);
                        setShowMemberModal(true);
                      }}
                      className="size-8 rounded-xl border border-border bg-muted/30 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={isAr ? "تعديل الملف" : "Edit Profile"}
                    >
                      <Settings className="size-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono font-bold text-[10px] uppercase">
                      {getDivisionLabel(m.division)}
                    </span>
                    {m.employment_type && (
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold text-[10px] capitalize">
                        {getEmploymentTypeLabel(m.employment_type)}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {m.is_active ? (isAr ? "نشط" : "Active") : (isAr ? "معطل" : "Deactivated")}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${m.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {m.published ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                      {m.published ? (isAr ? "عام على الموقع" : "Public") : (isAr ? "داخلي فقط" : "Internal")}
                    </span>
                  </div>

                  {m.specialties && m.specialties.length > 0 && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {isAr ? "التخصصات: " : "Specialties: "}
                      {m.specialties.join(isAr ? "، " : ", ")}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <button
                    onClick={() => setWorkspaceMember(m)}
                    className="text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    {isAr ? "عرض مساحة العمل" : "View Workspace"} <ArrowUpRight className="size-3 rtl:rotate-180" />
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {isAr ? "الترتيب: " : "Order: "}
                    <span dir="ltr">#{m.sort_order}</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-12 text-center border border-border rounded-3xl bg-card space-y-3 soft-shadow">
              <Users className="size-10 text-muted-foreground mx-auto mb-2" />
              <h3 className="font-display font-bold text-lg text-foreground">
                {isAr ? "دليل الفريق فارغ" : "Team Roster Empty"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isAr
                  ? "لم يتم العثور على أعضاء في قاعدة البيانات. انقر أدناه لإضافة أول عضو في فريق سدى."
                  : "No team members found in database. Click below to add your first SADA team member."}
              </p>
              <button
                onClick={() => {
                  setEditingMember(null);
                  setShowMemberModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs inline-flex items-center gap-2 hover:opacity-90 transition-opacity mt-2"
              >
                <UserPlus className="size-4" /> {isAr ? "إضافة عضو فريق" : "Add Team Member"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UNASSIGNED TASKS ACTION CENTER */}
      {activeTab === "unassigned" && (
        <div className="space-y-4">
          {/* Bulk Assign Header Bar */}
          {memberWorkloads.unassignedList.length > 0 && (
            <div className="p-4 rounded-2xl border border-border bg-card soft-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                {isAr ? (
                  <>
                    تم تحديد <strong className="text-foreground">{selectedUnassignedIds.length}</strong> من أصل{" "}
                    <strong className="text-foreground">{memberWorkloads.unassignedList.length}</strong> مهمة غير معينة
                  </>
                ) : (
                  <>
                    <strong className="text-foreground">{selectedUnassignedIds.length}</strong> of{" "}
                    <strong className="text-foreground">{memberWorkloads.unassignedList.length}</strong> unassigned tasks selected
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <SADACombobox
                  value={bulkAssigneeId}
                  onChange={setBulkAssigneeId}
                  placeholder={isAr ? "اختر عضو الفريق للتعيين..." : "Select Team Member to Assign..."}
                  searchPlaceholder={isAr ? "ابحث عن عضو في الفريق..." : "Search team members..."}
                  className="w-full sm:w-[280px]"
                  options={unifiedMembers
                    .filter((m) => m.is_active)
                    .map((m) => ({
                      value: m.id,
                      label: m.name,
                      subtitle: `${getDivisionLabel(m.division || "Ops")} · ${m.position || (isAr ? "عضو" : "Member")}`,
                    }))}
                />

                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkAssigneeId || selectedUnassignedIds.length === 0 || bulkAssigning}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-50 hover:opacity-90 transition-opacity w-full sm:w-auto text-center"
                >
                  {bulkAssigning
                    ? (isAr ? "جارٍ التعيين..." : "Assigning...")
                    : (isAr ? "تعيين جماعي" : "Bulk Assign")}
                </button>
              </div>
            </div>
          )}

          {memberWorkloads.unassignedList.length > 0 ? (
            <div className="space-y-3">
              {memberWorkloads.unassignedList.map((t) => {
                const proj = projectMap.get(t.project_id);
                const suggested = getSuggestedMembersForTask(t);
                const isSelected = selectedUnassignedIds.includes(t.id);

                return (
                  <div
                    key={t.id}
                    className={`p-5 rounded-2xl border border-border bg-card soft-shadow space-y-3 ${
                      isSelected ? "border-primary ring-1 ring-primary/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <SADACheckbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUnassignedIds((prev) => [...prev, t.id]);
                            } else {
                              setSelectedUnassignedIds((prev) => prev.filter((id) => id !== t.id));
                            }
                          }}
                          className="mt-0.5"
                        />

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-sm text-foreground">{t.title}</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                              {isAr ? "غير معينة" : "Unassigned"}
                            </span>
                            {t.service && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                                {t.service}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {proj && (
                              <span>
                                {isAr ? "المشروع: " : "Project: "}
                                <strong>{proj.client_name} — {proj.title}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingTask(t);
                          setShowTaskModal(true);
                        }}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        {isAr ? "تعديل المهمة" : "Edit Task"}
                      </button>
                    </div>

                    {/* Deterministic Suggested Members (Zero AI) */}
                    {suggested.length > 0 && (
                      <div className="pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Zap className="size-3 text-amber-500" /> {isAr ? "الأعضاء المقترحون:" : "Suggested Members:"}
                        </span>
                        {suggested.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleAssignSingle(t.id, m.id)}
                            className="px-2.5 py-1 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors"
                          >
                            <User className="size-3" />
                            {m.name} ({getDivisionLabel(m.division)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center border border-border rounded-3xl bg-card">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-display font-bold text-lg text-foreground">
                {isAr ? "لا توجد مهام غير معينة" : "Zero Unassigned Tasks"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isAr
                  ? "تم تعيين جميع مهام نظام العمل النشطة لأعضاء الفريق بنجاح."
                  : "All active Work OS tasks have been assigned to team members."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modals & Workspace Drawers */}
      {showMemberModal && (
        <TeamMemberModal
          member={editingMember}
          onSaved={loadData}
          onClose={() => {
            setShowMemberModal(false);
            setEditingMember(null);
          }}
        />
      )}

      {workspaceMember && (
        <MemberWorkspaceModal
          member={workspaceMember}
          tasks={tasks}
          projects={projects}
          onEditTask={(t) => {
            setEditingTask(t);
            setShowTaskModal(true);
          }}
          onClose={() => setWorkspaceMember(null)}
        />
      )}

      {showTaskModal && editingTask && (
        <TaskModal
          task={editingTask}
          projectId={editingTask.project_id}
          profiles={profiles}
          teamMembers={unifiedMembers}
          onSaved={() => { loadData(true); }}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
