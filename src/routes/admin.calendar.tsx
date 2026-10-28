import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays, CalendarCheck, Check, ChevronDown, ChevronRight, Folder, Search, User, Users,
  AlertTriangle, ArrowRightLeft, Sparkles, CheckCircle2, Circle, Clock, Plus, Filter, X, RotateCcw
} from "lucide-react";
import { CalendarGrid, type CalendarFollowupEvent, type ViewMode } from "@/components/admin/CalendarGrid";
import { TaskModal } from "@/components/admin/TaskModal";
import { TaskDetailModal } from "@/components/admin/TaskDetailModal";
import type { TaskRow, ProfileRow, ProjectRow, TeamMemberRow, TaskStatus, TaskHandoffRow } from "@/components/admin/project-utils";
import {
  isTaskOverdue, isTaskActiveOnDay, STATUS_CONFIG, PRIORITY_CONFIG,
  getAssignmentMemberInfo, resolveToProfileId
} from "@/components/admin/project-utils";
import { useAuth } from "@/lib/auth";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADASelect } from "@/components/ui/sada-select";
import { SADAButton } from "@/components/ui/sada-button";
import { CalendarDashboardSkeleton } from "@/components/ui/sada-page-skeletons";
import {
  parseISO, isToday, isSameDay, differenceInDays, startOfDay, endOfDay,
  format, addDays, isPast, getHours, getMinutes
} from "date-fns";
import { formatDate } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SADADialog } from "@/components/ui/sada-dialog";
import { useTranslation } from "@/i18n";
import { updateTaskStatus, deleteProjectTask } from "@/lib/task-execution-service";
import type { PermissionContext } from "@/lib/permissions";

export const Route = createFileRoute("/admin/calendar")({
  component: AdminCalendar,
});

function ProjectPicker({
  projects,
  value,
  onChange,
}: {
  projects: { id: string; title: string; client_name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { language, isRTL } = useTranslation();
  const isAr = isRTL || language === "ar";
  const [open, setOpen] = useState(false);
  const selectedProj = projects.find((p) => p.id === value);

  return (
    <div className="space-y-1.5 mb-4">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
        {isAr ? "حدد مشروع العميل المستهدف *" : "Select Target Client Project *"}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between gap-3 w-full p-2.5 bg-card hover:bg-muted/40 border border-border rounded-2xl text-start transition-all shadow-xs"
          >
            {selectedProj ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-6 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
                  <Folder className="size-3.5" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-semibold text-foreground truncate block">
                    {selectedProj.client_name} — {selectedProj.title}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="size-3.5" />
                <span>{isAr ? "ابحث واختر مشروعاً..." : "Search and choose a project…"}</span>
              </div>
            )}
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 rounded-2xl border-border shadow-xl z-50" align="start">
          <Command className="rounded-2xl">
            <CommandInput placeholder={isAr ? "البحث في المشاريع..." : "Search projects..."} className="text-xs h-10" />
            <CommandList className="max-h-56 p-1">
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                {isAr ? "لم يتم العثور على مشاريع نشطة." : "No active projects found."}
              </CommandEmpty>
              <CommandGroup>
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    <div className="truncate">
                      <div className="font-semibold text-foreground truncate">{p.client_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.title}</div>
                    </div>
                    {value === p.id && <Check className="size-4 text-primary shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. SELECTED DAY SUMMARY PANEL (Section 7 & 8)
// ---------------------------------------------------------------------------
function SelectedDayPanel({
  selectedDate,
  tasks,
  followups,
  projectMap,
  profiles,
  teamMembers,
  onTaskClick,
  onFollowupClick,
  onStatusChange,
  onCreateTask,
  onGoToday,
  isWorker,
}: {
  selectedDate: Date;
  tasks: TaskRow[];
  followups: CalendarFollowupEvent[];
  projectMap: Map<string, ProjectRow>;
  profiles: ProfileRow[];
  teamMembers: TeamMemberRow[];
  onTaskClick: (task: TaskRow) => void;
  onFollowupClick?: (followup: CalendarFollowupEvent) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onCreateTask: (dateStr: string) => void;
  onGoToday: () => void;
  isWorker: boolean;
}) {
  const { language, isRTL } = useTranslation();
  const isAr = isRTL || language === "ar";
  const selectedIsToday = isToday(selectedDate);

  function formatTime(t: TaskRow): string {
    if (t.start_date) {
      const d = parseISO(t.start_date);
      const h = getHours(d);
      const m = getMinutes(d);
      if (h === 0 && m === 0) return "";
      return format(d, "HH:mm");
    }
    return "";
  }

  return (
    <div id="selected-day-panel" className="p-5 rounded-3xl border border-border bg-card shadow-xs space-y-4 scroll-mt-20">
      {/* Header */}
      <div className="border-b border-border/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          {selectedIsToday ? (
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold font-mono uppercase tracking-wider inline-flex items-center gap-1.5">
              <CalendarDays className="size-3" /> {isAr ? "اليوم" : "TODAY"} · {formatDate(selectedDate, "EEEE", { lang: isAr ? "ar" : "en" })}
            </span>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold font-mono uppercase tracking-wider inline-flex items-center gap-1.5">
                <CalendarDays className="size-3" /> {isAr ? "اليوم المحدد" : "SELECTED"} · {formatDate(selectedDate, "EEEE", { lang: isAr ? "ar" : "en" })}
              </span>
              <button
                type="button"
                onClick={onGoToday}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>{isAr ? "العودة لليوم" : "Back to Today"}</span>
              </button>
            </div>
          )}
        </div>

        <h3 className="font-display font-extrabold text-xl text-foreground mt-1.5">
          {formatDate(selectedDate, "d MMMM yyyy", { lang: isAr ? "ar" : "en" })}
        </h3>

        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono mt-0.5">
          <span>
            {tasks.length} {isAr ? "مهام مجدولة" : (tasks.length === 1 ? "scheduled task" : "scheduled tasks")}
          </span>
          {followups.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              +{followups.length} {isAr ? "متابعات" : "follow-ups"}
            </span>
          )}
        </div>
      </div>

      {/* Follow-up Alerts for the Day */}
      {followups.length > 0 && (
        <div className="space-y-2">
          {followups.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFollowupClick?.(f)}
              className="w-full text-start p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-all text-xs"
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold mb-0.5">
                <span>{isAr ? "متابعة عميل" : "CLIENT FOLLOW-UP"}</span>
                {f.nextFollowupDate && (
                  <span dir="ltr">{format(parseISO(f.nextFollowupDate), "HH:mm")}</span>
                )}
              </div>
              <div className="font-bold text-foreground text-xs">{f.clientName}</div>
              <div className="text-[11px] text-muted-foreground truncate">{f.nextAction || f.summary}</div>
            </button>
          ))}
        </div>
      )}

      {/* Scheduled Tasks List */}
      {tasks.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
          <div className="size-10 rounded-2xl bg-muted/60 text-muted-foreground grid place-items-center mx-auto">
            <CalendarCheck className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">{isAr ? "لا توجد مهام مجدولة" : "No tasks scheduled"}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isAr ? "الجدول الزمني فارغ لهذا اليوم." : "Your calendar is clear for this day."}
            </p>
          </div>
          {!isWorker && (
            <button
              type="button"
              onClick={() => onCreateTask(format(selectedDate, "yyyy-MM-dd"))}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{isAr ? "إضافة مهمة لهذا اليوم" : "Add task for this day"}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="max-h-[440px] overflow-y-auto space-y-2.5 pe-1">
          {tasks.map((task) => {
            const proj = projectMap.get(task.project_id);
            const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
            const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
            const isDone = task.status === "done";
            const isOverdue = isTaskOverdue(task, selectedDate);
            const timeStr = formatTime(task);

            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className={cn(
                  "p-3 rounded-2xl border transition-all duration-150 cursor-pointer text-start group hover:border-primary/50 hover:shadow-xs",
                  isDone
                    ? "bg-emerald-500/[0.04] border-emerald-500/30 opacity-75"
                    : isOverdue
                    ? "bg-rose-500/[0.06] border-rose-500/40"
                    : "bg-card border-border/80"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-primary truncate max-w-[130px]">
                      {proj?.client_name || "SADA CLIENT"}
                    </span>
                    {timeStr ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground shrink-0" dir="ltr">
                        {timeStr}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground shrink-0">
                        {isAr ? "طوال اليوم" : "All Day"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn("text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded", priorityConf.color, priorityConf.bg)}>
                      {priorityConf.label}
                    </span>
                    <span className={cn("text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded", statusConf.color, statusConf.bg)}>
                      {statusConf.label}
                    </span>
                  </div>
                </div>

                <h4 className={cn("text-xs font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors", isDone && "line-through opacity-70")}>
                  {task.title}
                </h4>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10px]">
                  <div className="flex items-center gap-1.5 truncate text-muted-foreground">
                    {assigneeInfo?.photoUrl ? (
                      <img src={assigneeInfo.photoUrl} alt="" className="size-4 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-4 rounded-full bg-primary/10 text-primary grid place-items-center text-[8px] font-bold font-mono shrink-0">
                        {assigneeInfo?.displayName?.slice(0, 1) || "U"}
                      </div>
                    )}
                    <span className="truncate">{assigneeInfo?.displayName || (isAr ? "غير معين" : "Unassigned")}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(task.id, isDone ? "todo" : "done");
                    }}
                    className={cn(
                      "p-1 rounded-lg transition-colors cursor-pointer shrink-0",
                      isDone ? "text-emerald-600 hover:bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                    )}
                    title={isDone ? (isAr ? "تعليم كغير مكتملة" : "Mark as incomplete") : (isAr ? "تعليم كمكتملة" : "Mark as completed")}
                  >
                    {isDone ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. UPCOMING PREVIEW PANEL (Section 9 & 10)
// ---------------------------------------------------------------------------
function UpcomingPanel({
  upcomingTasks,
  projectMap,
  profiles,
  teamMembers,
  onTaskClick,
}: {
  upcomingTasks: TaskRow[];
  projectMap: Map<string, ProjectRow>;
  profiles: ProfileRow[];
  teamMembers: TeamMemberRow[];
  onTaskClick: (task: TaskRow) => void;
}) {
  const { language, isRTL } = useTranslation();
  const isAr = isRTL || language === "ar";

  return (
    <div className="p-5 rounded-3xl border border-border bg-card shadow-xs space-y-3.5">
      <div className="flex items-center justify-between pb-2.5 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h4 className="font-display font-bold text-sm text-foreground">
            {isAr ? "المهام القادمة" : "UPCOMING SCHEDULE"}
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {upcomingTasks.length} {isAr ? "قادمة" : "upcoming"}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isAr ? "نظرة سريعة على المواعيد التشغيلية المقبلة للفريق." : "Operational preview of next scheduled tasks."}
      </p>

      {upcomingTasks.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground rounded-2xl bg-muted/10 border border-dashed border-border/60">
          {isAr ? "لا توجد أعمال مجدولة في الفترة القادمة." : "No scheduled work found."}
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto space-y-2 pe-1">
          {upcomingTasks.map((task) => {
            const proj = projectMap.get(task.project_id);
            const taskDate = task.start_date ? parseISO(task.start_date) : task.deadline ? parseISO(task.deadline) : null;
            const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);

            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="flex items-center gap-3 p-2.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all cursor-pointer group text-start"
              >
                {/* Date Badge */}
                <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0 text-center font-mono">
                  <span className="text-[8px] font-bold text-primary uppercase leading-none">
                    {taskDate ? formatDate(taskDate, "MMM", { lang: isAr ? "ar" : "en" }) : "—"}
                  </span>
                  <span className="text-sm font-extrabold text-foreground leading-none mt-0.5">
                    {taskDate ? format(taskDate, "dd") : "—"}
                  </span>
                </div>

                {/* Task Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-mono font-bold text-primary uppercase truncate max-w-[120px]">
                      {proj?.client_name || "SADA CLIENT"}
                    </span>
                    {task.service && (
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground truncate max-w-[90px]">
                        {task.service}
                      </span>
                    )}
                  </div>
                  <h5 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {task.title}
                  </h5>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    {task.deadline && (
                      <span className="truncate">{formatDate(task.deadline, "d MMM", { lang: isAr ? "ar" : "en" })}</span>
                    )}
                    {assigneeInfo && (
                      <span className="truncate">· {assigneeInfo.displayName}</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all rtl:rotate-180 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. MAIN DASHBOARD PAGE
// ---------------------------------------------------------------------------
function AdminCalendar() {
  const { user, role, isSuperAdmin, isAdmin, isWorker, teamMember, teamMemberId: authTmId } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = isRTL || language === "ar";

  const permCtx: PermissionContext = useMemo(
    () => ({
      userId: user?.id,
      role: role || (isSuperAdmin ? "super_admin" : isWorker ? "worker" : "admin"),
      memberProfileId: teamMember?.profile_id || undefined,
      memberId: teamMember?.id || undefined,
    }),
    [role, isSuperAdmin, isWorker, user?.id, teamMember]
  );

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [followups, setFollowups] = useState<CalendarFollowupEvent[]>([]);
  const [pendingHandoffs, setPendingHandoffs] = useState<TaskHandoffRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar Navigation & Selected Day State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<ViewMode>("month");

  // Filters State
  const [selectedMemberId, setSelectedMemberId] = useState<string>(isWorker ? "me" : "all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");

  // Task Detail Modal State
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  // Create Task Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [archivedClientIds, setArchivedClientIds] = useState<Set<string>>(new Set());

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const load = async (forceLoading = false) => {
    if (forceLoading || (tasks.length === 0 && projects.length === 0)) {
      setLoading(true);
    }

    try {
      let taskQuery = (supabase as any).from("project_tasks").select("*");
      if (isWorker && user?.id) {
        const tmId = teamMember?.id || authTmId;
        if (tmId) {
          taskQuery = taskQuery.or(`assignee_id.eq.${user.id},assignee_id.eq.${tmId}`);
        } else {
          taskQuery = taskQuery.eq("assignee_id", user.id);
        }
      }
      taskQuery = taskQuery.order("start_date", { ascending: true });

      const [tasksRes, projRes, profRes, teamRes, handoffsRes, clientsRes] = await Promise.all([
        taskQuery,
        (supabase as any).from("client_projects").select("*").eq("status", "active"),
        (supabase as any).from("profiles").select("*"),
        (supabase as any).from("team_members").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        (supabase as any).from("task_handoffs").select("*").eq("status", "pending"),
        (supabase as any).from("clients").select("id, status"),
      ]);

      const archivedIds = new Set<string>(
        (clientsRes.data || [])
          .filter((c: any) => c.status === "archived")
          .map((c: any) => String(c.id))
      );
      setArchivedClientIds(archivedIds);

      setTasks(tasksRes.data || []);
      setProjects(projRes.data || []);
      setProfiles(profRes.data || []);
      setTeamMembers(teamRes.data || []);
      setPendingHandoffs(handoffsRes.data || []);

      // Build followup calendar events (excluding archived clients)
      const followupList: CalendarFollowupEvent[] = [];
      (projRes.data || []).forEach((p: any) => {
        if (p.client_id && archivedIds.has(p.client_id)) return;
        if (isWorker) {
          const tmId = teamMember?.id || authTmId;
          const isMyProject = p.lead_id === user?.id || (tmId && p.lead_id === tmId) || p.followup_owner_id === user?.id;
          if (!isMyProject) return;
        }
        if (p.next_followup_date) {
          followupList.push({
            id: `followup-${p.id}`,
            projectId: p.id,
            clientName: p.client_name,
            nextFollowupDate: p.next_followup_date,
            nextAction: p.followup_next_action || "Client Follow-up",
            summary: p.followup_summary,
            ownerName: profRes.data?.find((pr: any) => pr.id === p.followup_owner_id)?.display_name,
          });
        }
      });

      setFollowups(followupList);
    } catch (err) {
      console.error("[Calendar] Data load failed:", err);
      toast.error(isAr ? "فشل تحديث بيانات التقويم" : "Failed to load latest calendar data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Silent Realtime Subscription on project_tasks (never triggers full-page skeleton)
    const channel = supabase
      .channel("calendar-execution-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_tasks" },
        () => {
          load(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isWorker]);

  // Worker is strictly locked to My Calendar
  useEffect(() => {
    if (isWorker && selectedMemberId !== "me") {
      setSelectedMemberId("me");
    }
  }, [isWorker, selectedMemberId]);

  // Current logged in member identity
  const myMember = useMemo(() => {
    if (!user) return null;
    return teamMembers.find(m => m.profile_id === user.id || m.id === user.id) || null;
  }, [user, teamMembers]);

  // Selected member object
  const activeMember = useMemo(() => {
    if (selectedMemberId === "me") return myMember;
    if (selectedMemberId === "all") return null;
    return teamMembers.find(m => m.id === selectedMemberId || m.profile_id === selectedMemberId) || null;
  }, [selectedMemberId, myMember, teamMembers]);

  // Dynamic Options for Filters
  const clientOptions = useMemo(() => {
    const set = new Map<string, string>();
    projects.forEach(p => {
      if (p.client_id && archivedClientIds.has(p.client_id)) return;
      if (p.client_name) set.set(p.client_name, p.client_name);
    });
    return Array.from(set.entries()).map(([k, v]) => ({ value: k, label: v }));
  }, [projects, archivedClientIds]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.service) set.add(t.service);
    });
    return Array.from(set).map(s => ({ value: s, label: s }));
  }, [tasks]);

  const isAnyFilterActive = useMemo(() => {
    return filterClient !== "all" || filterStatus !== "all" || filterService !== "all" || (!isWorker && selectedMemberId !== "all");
  }, [filterClient, filterStatus, filterService, selectedMemberId, isWorker]);

  const resetFilters = () => {
    setFilterClient("all");
    setFilterStatus("all");
    setFilterService("all");
    if (!isWorker) setSelectedMemberId("all");
  };

  // -------------------------------------------------------------------------
  // CANONICAL FILTER ENGINE — Unifies Calendar, Today, and Upcoming
  // -------------------------------------------------------------------------
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Assignee / Member filter
      if (isWorker) {
        const myProfileId = myMember?.profile_id || user?.id;
        const myTmId = myMember?.id;
        const matchesWorker =
          task.assignee_id === myProfileId ||
          task.assignee_id === myTmId ||
          (user?.id && resolveToProfileId(task.assignee_id, teamMembers, profiles) === user.id);
        if (!matchesWorker) return false;
      } else if (selectedMemberId === "me") {
        const myProfileId = myMember?.profile_id || user?.id;
        const myTmId = myMember?.id;
        const matchesMe =
          task.assignee_id === myProfileId ||
          task.assignee_id === myTmId ||
          (user?.id && resolveToProfileId(task.assignee_id, teamMembers, profiles) === user.id);
        if (!matchesMe) return false;
      } else if (selectedMemberId !== "all") {
        const targetProfileId = activeMember?.profile_id || activeMember?.id;
        const targetTmId = activeMember?.id;
        const resolvedTarget = resolveToProfileId(selectedMemberId, teamMembers, profiles);
        const resolvedTaskAssignee = resolveToProfileId(task.assignee_id, teamMembers, profiles);
        const matchesTarget =
          task.assignee_id === targetProfileId ||
          task.assignee_id === targetTmId ||
          (resolvedTarget && resolvedTaskAssignee === resolvedTarget);
        if (!matchesTarget) return false;
      }

      // 2. Client filter
      if (filterClient !== "all") {
        const proj = projectMap.get(task.project_id);
        const matchesClient =
          task.client_id === filterClient ||
          task.project_id === filterClient ||
          proj?.client_name === filterClient ||
          proj?.client_id === filterClient;
        if (!matchesClient) return false;
      }

      // 3. Status filter
      if (filterStatus !== "all") {
        if (task.status !== filterStatus) return false;
      } else {
        // By default, exclude paused tasks and tasks of archived clients from active calendar
        if (task.status === "paused") return false;
        if (task.client_id && archivedClientIds.has(task.client_id)) return false;
      }

      // 4. Service filter
      if (filterService !== "all") {
        if (task.service !== filterService) return false;
      }

      return true;
    });
  }, [tasks, isWorker, selectedMemberId, myMember, user, activeMember, filterClient, filterStatus, filterService, projectMap, teamMembers, profiles, archivedClientIds]);

  // Tasks active on Selected Date
  const selectedDayTasks = useMemo(() => {
    return filteredTasks.filter(t => isTaskActiveOnDay(t, selectedDate) || (isToday(selectedDate) && isTaskOverdue(t)));
  }, [filteredTasks, selectedDate]);

  // Follow-ups on Selected Date
  const selectedDayFollowups = useMemo(() => {
    return followups.filter(f => {
      if (!f.nextFollowupDate) return false;
      return isSameDay(parseISO(f.nextFollowupDate), selectedDate);
    });
  }, [followups, selectedDate]);

  // Upcoming Tasks Chronologically (starting tomorrow or future dates, strictly active)
  const upcomingTasks = useMemo(() => {
    return filteredTasks
      .filter(t => {
        if (t.status === "done" || t.status === "cancelled") return false;
        const taskDate = t.start_date ? parseISO(t.start_date) : t.deadline ? parseISO(t.deadline) : null;
        if (!taskDate) return false;
        return !isPast(endOfDay(taskDate)) && !isSameDay(taskDate, selectedDate);
      })
      .sort((a, b) => {
        const dateA = a.start_date ? parseISO(a.start_date).getTime() : a.deadline ? parseISO(a.deadline).getTime() : 0;
        const dateB = b.start_date ? parseISO(b.start_date).getTime() : b.deadline ? parseISO(b.deadline).getTime() : 0;
        return dateA - dateB;
      })
      .slice(0, 8);
  }, [filteredTasks, selectedDate]);

  // Execution Summary Metrics
  const summaryMetrics = useMemo(() => {
    const today = new Date();
    const activeTasks = filteredTasks.filter(t => t.status !== "done" && t.status !== "cancelled");
    const todayTasks = filteredTasks.filter(t => isTaskActiveOnDay(t, today));
    const overdueTasks = filteredTasks.filter(t => isTaskOverdue(t));
    const completedTasks = filteredTasks.filter(t => t.status === "done");

    const dueSoonTasks = activeTasks.filter(t => {
      if (!t.deadline || isTaskOverdue(t)) return false;
      const days = differenceInDays(startOfDay(parseISO(t.deadline)), startOfDay(today));
      return days >= 0 && days <= 3;
    });

    const clientSet = new Set(
      filteredTasks
        .map(t => t.client_id || projectMap.get(t.project_id)?.client_id || projectMap.get(t.project_id)?.client_name)
        .filter(Boolean)
    );

    return {
      todayCount: todayTasks.length,
      overdueCount: overdueTasks.length,
      dueSoonCount: dueSoonTasks.length,
      completedCount: completedTasks.length,
      clientsCount: clientSet.size,
    };
  }, [filteredTasks, projectMap]);

  // Filter pending handoffs relevant to current user
  const myPendingHandoffs = useMemo(() => {
    const myProfileId = myMember?.profile_id || user?.id;
    const myTmId = myMember?.id;

    return pendingHandoffs.filter(h =>
      h.to_assignee_id === myProfileId || h.to_assignee_id === myTmId ||
      h.assigner_id === myProfileId || h.assigner_id === myTmId ||
      h.from_assignee_id === myProfileId || h.from_assignee_id === myTmId
    );
  }, [pendingHandoffs, myMember, user]);

  // Open canonical TaskDetailModal
  const handleTaskClick = (task: TaskRow) => {
    setSelectedTask(task);
  };

  // Open create task modal
  const handleCreateTask = (dateStr: string, _hour?: number) => {
    if (isWorker) return;
    setEditingTask(null);
    setDefaultDate(dateStr);

    // If currently filtered by a client, check if they have a matching project
    if (filterClient !== "all") {
      const matched = projects.find(p => p.client_name === filterClient || p.client_id === filterClient);
      if (matched) {
        setSelectedProjectId(matched.id);
        setShowCreateModal(true);
        return;
      }
    }

    // If only one project exists, pre-select it; otherwise allow choosing via ProjectPicker (Step 1)
    if (projects.length === 1) {
      setSelectedProjectId(projects[0].id);
    } else {
      setSelectedProjectId("");
    }
    setShowCreateModal(true);
  };

  // Mobile-aware date selection handler
  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const el = document.getElementById("selected-day-panel");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  // Status toggle with optimistic update
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;
    const nowIso = newStatus === "done" ? new Date().toISOString() : null;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: nowIso } : t));

    const res = await updateTaskStatus({
      task: targetTask,
      newStatus,
      ctx: permCtx,
      actorId: user?.id,
      actorRole: permCtx.role || undefined,
    });

    if (!res.success) {
      toast.error(`Status update failed: ${res.error}`);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetTask.status, completed_at: targetTask.completed_at } : t));
    } else {
      toast.success(newStatus === "done" ? (isAr ? "تم تعليم المهمة كمكتملة!" : "Task marked completed!") : (isAr ? "تم تعليم المهمة كقيد الانتظار" : "Task marked pending"));
      load(false);
    }
  };

  const activeProject = useMemo(() => {
    if (!selectedTask) return null;
    return projects.find(p => p.id === selectedTask.project_id) || null;
  }, [selectedTask, projects]);

  if (loading && tasks.length === 0 && projects.length === 0) {
    return <CalendarDashboardSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] sm:text-[11px] font-bold tracking-wider uppercase font-mono">
              SADA OS · {isAr ? "التنفيذ" : "Execution"}
            </span>
            <span className="text-[11px] sm:text-xs font-mono text-muted-foreground truncate">· {isAr ? "لوحة التقويم التشغيلية" : "Operations Calendar Dashboard"}</span>
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl md:text-3xl text-foreground flex items-center gap-2 mt-0.5 sm:mt-1">
            <CalendarDays className="size-5 sm:size-7 text-primary shrink-0" />
            <span className="truncate">{isAr ? "تقويم مهام الفريق" : "Team Task Calendar"}</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none">
            {isAr
              ? "الجدول الزمني التشغيلي لنطاقات العمل النشطة، والمواعيد النهائية المقتربة، ومتابعات العملاء المجدولة."
              : "Operational schedule of active work ranges, approaching deadlines, and scheduled client follow-ups."}
          </p>
        </div>

        {/* Action Controls & Member Switcher */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
          {isWorker ? (
            <div className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-xs inline-flex items-center justify-center gap-1.5 h-8.5 sm:h-9">
              <User className="size-3.5" />
              <span>{isAr ? "تقويمي" : "My Calendar"}</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedMemberId(prev => prev === "me" ? "all" : "me")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer h-8.5 sm:h-9 ${
                  selectedMemberId === "me"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <User className="size-3.5" />
                <span className="truncate">{isAr ? "تقويمي" : "My Calendar"}</span>
              </button>

              <SADAButton
                variant="primary"
                size="sm"
                onClick={() => handleCreateTask(format(selectedDate, "yyyy-MM-dd"))}
                className="gap-1.5 rounded-xl shadow-xs justify-center h-8.5 sm:h-9 text-xs"
              >
                <Plus className="size-3.5" />
                <span>{isAr ? "مهمة جديدة" : "New Task"}</span>
              </SADAButton>

              <div className="col-span-2 sm:w-56">
                <SADACombobox
                  value={selectedMemberId}
                  onChange={(val) => setSelectedMemberId(val)}
                  allOption={{
                    value: "all",
                    label: isAr ? "كل الفريق" : "All Team",
                    icon: <Users className="size-3.5 text-primary" />,
                  }}
                  options={teamMembers.map((m) => ({
                    value: m.id,
                    label: m.display_name || m.name,
                    subtitle: m.position || m.role,
                    avatar: m.photo_url || null,
                  }))}
                  placeholder={isAr ? "اختر عضواً من الفريق..." : "Select team member..."}
                  searchPlaceholder={isAr ? "البحث عن عضو..." : "Search team member..."}
                  size="compact"
                  triggerClassName="rounded-xl h-8.5 sm:h-9"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. SUMMARY METRICS BAR (Horizontal swipeable strip on mobile, 5-col grid on desktop) */}
      <div className="flex sm:grid overflow-x-auto sm:grid-cols-5 gap-2 sm:gap-3 pb-1 sm:pb-0 no-scrollbar snap-x">
        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card shadow-xs shrink-0 min-w-[105px] sm:min-w-0 flex-1 snap-start">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block mb-0.5 sm:mb-1 truncate">{isAr ? "اليوم" : "Today"}</span>
          <div className="flex items-center justify-between">
            <span className="text-lg sm:text-xl font-display font-extrabold text-foreground">{summaryMetrics.todayCount}</span>
            <Clock className="size-3.5 sm:size-4 text-primary opacity-80" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card shadow-xs shrink-0 min-w-[105px] sm:min-w-0 flex-1 snap-start">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block mb-0.5 sm:mb-1 truncate">{isAr ? "متأخرة" : "Overdue"}</span>
          <div className="flex items-center justify-between">
            <span className={`text-lg sm:text-xl font-display font-extrabold ${summaryMetrics.overdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
              {summaryMetrics.overdueCount}
            </span>
            <AlertTriangle className={`size-3.5 sm:size-4 ${summaryMetrics.overdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground opacity-60"}`} />
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card shadow-xs shrink-0 min-w-[105px] sm:min-w-0 flex-1 snap-start">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block mb-0.5 sm:mb-1 truncate">{isAr ? "تستحق قريباً" : "Due Soon"}</span>
          <div className="flex items-center justify-between">
            <span className="text-lg sm:text-xl font-display font-extrabold text-amber-600 dark:text-amber-400">
              {summaryMetrics.dueSoonCount}
            </span>
            <Sparkles className="size-3.5 sm:size-4 text-amber-600 dark:text-amber-400 opacity-80" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card shadow-xs shrink-0 min-w-[105px] sm:min-w-0 flex-1 snap-start">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block mb-0.5 sm:mb-1 truncate">{isAr ? "مكتملة" : "Completed"}</span>
          <div className="flex items-center justify-between">
            <span className="text-lg sm:text-xl font-display font-extrabold text-emerald-600 dark:text-emerald-400">
              {summaryMetrics.completedCount}
            </span>
            <CheckCircle2 className="size-3.5 sm:size-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card shadow-xs shrink-0 min-w-[105px] sm:min-w-0 flex-1 snap-start">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-muted-foreground block mb-0.5 sm:mb-1 truncate">{isAr ? "الحسابات" : "Accounts"}</span>
          <div className="flex items-center justify-between">
            <span className="text-lg sm:text-xl font-display font-extrabold text-foreground">{summaryMetrics.clientsCount}</span>
            <Users className="size-3.5 sm:size-4 text-muted-foreground opacity-60" />
          </div>
        </div>
      </div>

      {/* 3. COMPACT SADA FILTERS BAR (Section 11) */}
      <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0 me-1">
          <Filter className="size-3.5 text-primary" />
          <span>{isAr ? "التصفية:" : "Filters:"}</span>
        </div>

        {/* Client Filter */}
        <div className="w-full sm:w-56">
          <SADACombobox
            value={filterClient}
            onChange={(val) => setFilterClient(val)}
            allOption={{
              value: "all",
              label: isAr ? "جميع العملاء" : "All Clients",
            }}
            options={clientOptions}
            placeholder={isAr ? "تصفية بالعميل..." : "Filter by client..."}
            searchPlaceholder={isAr ? "البحث عن عميل..." : "Search client..."}
            size="compact"
            triggerClassName="rounded-xl"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-44">
          <SADASelect
            value={filterStatus}
            onChange={(val) => setFilterStatus(val)}
            options={[
              { value: "all", label: isAr ? "جميع الحالات" : "All Statuses" },
              { value: "todo", label: isAr ? "قيد الانتظار" : "To Do" },
              { value: "in_progress", label: isAr ? "قيد التنفيذ" : "In Progress" },
              { value: "review", label: isAr ? "قيد المراجعة" : "Under Review" },
              { value: "done", label: isAr ? "مكتملة" : "Completed" },
              { value: "blocked", label: isAr ? "معطلة" : "Blocked" },
            ]}
            placeholder={isAr ? "الحالة..." : "Status..."}
            size="compact"
            className="rounded-xl"
          />
        </div>

        {/* Service Filter */}
        {serviceOptions.length > 0 && (
          <div className="w-full sm:w-44">
            <SADASelect
              value={filterService}
              onChange={(val) => setFilterService(val)}
              options={[
                { value: "all", label: isAr ? "جميع الخدمات" : "All Services" },
                ...serviceOptions,
              ]}
              placeholder={isAr ? "الخدمة..." : "Service..."}
              size="compact"
              className="rounded-xl"
            />
          </div>
        )}

        {/* Reset Filters CTA */}
        {isAnyFilterActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 ms-auto cursor-pointer"
          >
            <X className="size-3.5" />
            <span>{isAr ? "إلغاء التصفية" : "Reset Filters"}</span>
          </button>
        )}
      </div>

      {/* 4. PENDING HANDOFFS ALERT */}
      {myPendingHandoffs.length > 0 && (
        <div className="p-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-amber-500/20 grid place-items-center text-amber-700 dark:text-amber-300 shrink-0">
              <ArrowRightLeft className="size-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block">
                {isAr
                  ? `طلب(ات) تحويل مهمة معلقة تتطلب اتخاذ إجراء (${myPendingHandoffs.length})`
                  : `${myPendingHandoffs.length} Task Transfer Request(s) Pending Action`}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {isAr
                  ? "راجع ووافق على طلبات تحويل المهام ضمن قائمة التنفيذ الشخصية الخاصة بك."
                  : "Review and approve task transfers under your personal execution queue."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {myPendingHandoffs.slice(0, 2).map(h => {
              const hTask = tasks.find(t => t.id === h.task_id);
              if (!hTask) return null;
              return (
                <button
                  key={h.id}
                  onClick={() => setSelectedTask(hTask)}
                  className="px-3 py-1.5 rounded-xl bg-card border border-amber-500/30 text-xs font-semibold text-foreground hover:bg-muted transition-colors truncate max-w-[200px] cursor-pointer"
                >
                  {isAr ? "مراجعة: " : "Review: "}{hTask.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. MAIN 2-COLUMN OPERATIONS LAYOUT (Section 2 Reference Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Primary Calendar */}
        <div className="lg:col-span-8">
          <CalendarGrid
            tasks={filteredTasks}
            projects={projects}
            profiles={profiles}
            teamMembers={teamMembers}
            followups={followups}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            onStatusChange={handleStatusChange}
            activeMemberName={selectedMemberId === "all" ? (isAr ? "كل الفريق" : "All Team") : activeMember?.display_name || activeMember?.name || (isAr ? "عملك" : "Your Work")}
            isWorker={isWorker}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            currentDate={currentDate}
            onCurrentDateChange={setCurrentDate}
            view={view}
            onViewChange={setView}
          />
        </div>

        {/* Right Column (4 cols): Today & Upcoming Panels */}
        <div className="lg:col-span-4 space-y-6">
          {/* Top Panel: Today / Selected Day Summary */}
          <SelectedDayPanel
            selectedDate={selectedDate}
            tasks={selectedDayTasks}
            followups={selectedDayFollowups}
            projectMap={projectMap}
            profiles={profiles}
            teamMembers={teamMembers}
            onTaskClick={handleTaskClick}
            onFollowupClick={(f) => {
              const p = projects.find(pr => pr.id === f.projectId);
              if (p) toast.info(`${f.clientName}: ${f.nextAction || f.summary}`);
            }}
            onStatusChange={handleStatusChange}
            onCreateTask={handleCreateTask}
            onGoToday={() => {
              const now = new Date();
              setSelectedDate(now);
              setCurrentDate(now);
            }}
            isWorker={isWorker}
          />

          {/* Bottom Panel: Upcoming Preview */}
          <UpcomingPanel
            upcomingTasks={upcomingTasks}
            projectMap={projectMap}
            profiles={profiles}
            teamMembers={teamMembers}
            onTaskClick={handleTaskClick}
          />
        </div>
      </div>

      {/* Canonical Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          project={activeProject}
          profiles={profiles}
          teamMembers={teamMembers}
          onEdit={(taskToEdit) => {
            setSelectedTask(null);
            setEditingTask(taskToEdit);
            setDefaultDate(taskToEdit.deadline || "");
            setSelectedProjectId(taskToEdit.project_id);
            setShowCreateModal(true);
          }}
          onStatusChange={handleStatusChange}
          onClose={() => setSelectedTask(null)}
          onDelete={async (taskId) => {
            const res = await deleteProjectTask({
              taskId,
              ctx: permCtx,
              actorId: user?.id,
              actorRole: permCtx.role || undefined,
            });
            if (!res.success) {
              toast.error(res.error || "Failed to delete task");
            } else {
              toast.success(isAr ? "تم حذف المهمة بنجاح" : "Task deleted");
              setSelectedTask(null);
              load();
            }
          }}
        />
      )}

      {/* Create Task: Step 1 (Project Picker Dialog) */}
      {showCreateModal && !selectedProjectId && (
        <SADADialog
          open={showCreateModal && !selectedProjectId}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateModal(false);
              setEditingTask(null);
              setDefaultDate("");
            }
          }}
          size="compact"
          title={isAr ? "اختر المشروع للمهمة" : "Select Project for Task"}
          footer={
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTask(null);
                  setDefaultDate("");
                }}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {isAr ? "اختر مشروع العميل الذي يتبع له هذا التسليم:" : "Choose the client project this deliverable belongs to:"}
            </p>
            <ProjectPicker
              projects={projects}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
            />
          </div>
        </SADADialog>
      )}

      {/* Create / Edit Task: Step 2 (Task Modal with selected project) */}
      {showCreateModal && selectedProjectId && (
        <TaskModal
          task={editingTask}
          projectId={selectedProjectId}
          profiles={profiles}
          teamMembers={teamMembers}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingTask(null);
            setSelectedProjectId("");
            setDefaultDate("");
            load(false);
          }}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTask(null);
            setSelectedProjectId("");
            setDefaultDate("");
          }}
          defaultDate={defaultDate}
        />
      )}
    </div>
  );
}
