import { useState, useMemo } from "react";
import { useTranslation } from "@/i18n";
import { formatDate } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  parseISO, getHours, getMinutes
} from "date-fns";
import {
  ChevronLeft, ChevronRight, PhoneCall, CheckCircle2, AlertTriangle,
  Clock, Sparkles, User, ExternalLink, ArrowRight, Check, AlertCircle,
  Calendar as CalendarIcon, Plus
} from "lucide-react";
import type { TaskRow, ProfileRow, TeamMemberRow, TaskStatus } from "./project-utils";
import {
  STATUS_CONFIG, PRIORITY_CONFIG,
  isTaskActiveOnDay, computeTaskVisualState, getTaskAlertBadge,
  isTaskOverdue, deadlineLabel, getAssignmentMemberInfo,
  isTaskStartDay, isTaskDeadlineDay
} from "./project-utils";

interface ProjectInfo {
  id: string;
  title: string;
  client_name: string;
}

export interface CalendarFollowupEvent {
  id: string;
  projectId: string;
  clientName: string;
  nextFollowupDate: string;
  ownerName?: string;
  summary?: string;
  nextAction?: string;
}

interface Props {
  tasks: TaskRow[];
  projects: ProjectInfo[];
  profiles: ProfileRow[];
  teamMembers?: TeamMemberRow[];
  followups?: CalendarFollowupEvent[];
  onTaskClick: (task: TaskRow) => void;
  onCreateTask: (date: string, hour?: number) => void;
  onFollowupClick?: (followup: CalendarFollowupEvent) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  activeMemberName?: string;
  isWorker?: boolean;
  selectedDate?: Date;
  onSelectDate?: (day: Date) => void;
  currentDate?: Date;
  onCurrentDateChange?: (date: Date) => void;
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  hideToolbar?: boolean;
}

export type ViewMode = "month" | "week" | "day";

export function CalendarGrid({
  tasks,
  projects,
  profiles,
  teamMembers = [],
  followups = [],
  onTaskClick,
  onCreateTask,
  onFollowupClick,
  onStatusChange,
  activeMemberName,
  isWorker = false,
  selectedDate,
  onSelectDate,
  currentDate: controlledDate,
  onCurrentDateChange,
  view: controlledView,
  onViewChange,
  hideToolbar = false,
}: Props) {
  const { t, isRTL } = useTranslation();
  const [internalDate, setInternalDate] = useState(new Date());
  const [internalView, setInternalView] = useState<ViewMode>("month");

  const effectiveCurrentDate = controlledDate || internalDate;
  const effectiveView = controlledView || internalView;
  const effectiveSelectedDate = selectedDate || effectiveCurrentDate;

  const setCurrentDate = (updater: Date | ((d: Date) => Date)) => {
    const nextDate = typeof updater === "function" ? updater(effectiveCurrentDate) : updater;
    if (onCurrentDateChange) {
      onCurrentDateChange(nextDate);
    } else {
      setInternalDate(nextDate);
    }
  };

  const setView = (v: ViewMode) => {
    if (onViewChange) {
      onViewChange(v);
    } else {
      setInternalView(v);
    }
  };

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Navigation
  const navigate = (dir: -1 | 1) => {
    const effectiveDir = isRTL ? -dir : dir;
    if (effectiveView === "month") setCurrentDate(d => effectiveDir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    else if (effectiveView === "week") setCurrentDate(d => effectiveDir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => effectiveDir === 1 ? addDays(d, 1) : subDays(d, 1));
  };

  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    if (onSelectDate) onSelectDate(now);
  };

  const heading = effectiveView === "day"
    ? formatDate(effectiveCurrentDate, "EEEE, d MMMM yyyy")
    : effectiveView === "week"
      ? (() => {
          const ws = startOfWeek(effectiveCurrentDate, { weekStartsOn: 0 });
          const we = endOfWeek(effectiveCurrentDate, { weekStartsOn: 0 });
          return `${formatDate(ws, "d MMM")} – ${formatDate(we, "d MMM yyyy")}`;
        })()
      : formatDate(effectiveCurrentDate, "MMMM yyyy");

  // Filter tasks using work range [start_date, deadline]
  function tasksForDay(day: Date): TaskRow[] {
    return tasks.filter(t => isTaskActiveOnDay(t, day) || (isToday(day) && isTaskOverdue(t)));
  }

  function followupsForDay(day: Date): CalendarFollowupEvent[] {
    return followups.filter(f => {
      if (!f.nextFollowupDate) return false;
      return isSameDay(parseISO(f.nextFollowupDate), day);
    });
  }

  function taskTime(t: TaskRow): string {
    if (t.start_date) {
      const d = parseISO(t.start_date);
      const h = getHours(d);
      const m = getMinutes(d);
      if (h === 0 && m === 0) return "";
      return format(d, "HH:mm");
    }
    return "";
  }

  // ---------------------------------------------------------------------------
  // Redesigned Event Pill for Month & Week Views
  // ---------------------------------------------------------------------------
  function EventPill({ task, currentDay }: { task: TaskRow; currentDay?: Date }) {
    const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
    const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const proj = projectMap.get(task.project_id);
    const time = taskTime(task);

    const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
    const alertInfo = getTaskAlertBadge(task, currentDay || effectiveCurrentDate);
    const visualState = computeTaskVisualState(task, currentDay || effectiveCurrentDate);

    const isStart = currentDay ? isTaskStartDay(task, currentDay) : false;
    const isDeadline = currentDay ? isTaskDeadlineDay(task, currentDay) : false;
    const isMultiDay = !!(task.start_date && task.deadline && !isSameDay(parseISO(task.start_date), parseISO(task.deadline)));

    // Visual state border and bg accents
    let stateStyles = "bg-card border-border/70 hover:border-primary/60";
    if (visualState === "completed") {
      stateStyles = "bg-emerald-500/5 border-emerald-500/30 text-emerald-800 dark:text-emerald-300";
    } else if (visualState === "overdue") {
      stateStyles = "bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-300 ring-1 ring-rose-500/20";
    } else if (visualState === "deadline_today") {
      stateStyles = "bg-rose-500/10 border-rose-500/50 text-rose-800 dark:text-rose-300 font-medium";
    } else if (visualState === "urgent") {
      stateStyles = "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300";
    } else if (visualState === "approaching") {
      stateStyles = "bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-300";
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
        className={`w-full text-start text-[10px] leading-tight p-2 rounded-xl transition-all hover:scale-[1.01] border shadow-xs mb-1.5 ${stateStyles}`}
        title={`${proj?.client_name || ""} · ${task.title}`}
      >
        {/* Top: Client Name & Multi-day Phase Indicator */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="font-mono font-bold uppercase truncate text-[9px] tracking-wider text-primary">
            {proj?.client_name || "SADA CLIENT"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isDeadline ? (
              <span className="text-[7.5px] uppercase font-mono font-bold px-1 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                {isRTL ? "🏁 موعد نهائي" : "🏁 Deadline"}
              </span>
            ) : isStart ? (
              <span className="text-[7.5px] uppercase font-mono font-bold px-1 rounded bg-primary/20 text-primary border border-primary/30">
                {isRTL ? "▶ بدء" : "▶ Start"}
              </span>
            ) : isMultiDay ? (
              <span className="text-[7.5px] uppercase font-mono font-medium px-1 rounded bg-muted text-muted-foreground">
                {isRTL ? "━ قيد التنفيذ" : "━ In Progress"}
              </span>
            ) : (
              <span className={`text-[7.5px] uppercase font-mono font-bold px-1 rounded ${priorityConf.color} ${priorityConf.bg}`}>
                {priorityConf.label}
              </span>
            )}
          </div>
        </div>

        {/* Middle: Title, Service & Stage */}
        <div className="space-y-1 mb-1">
          {(task.service || task.parent_task_id) && (
            <div className="flex items-center gap-1 flex-wrap">
              {task.service && (
                <span className="text-[8px] font-bold font-mono px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 truncate max-w-[110px]">
                  {task.service}
                </span>
              )}
              {task.parent_task_id && (
                <span className="text-[8px] font-bold font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  {isRTL ? `مرحلة ${task.sort_order || 1}` : `Stage ${task.sort_order || 1}`}
                </span>
              )}
            </div>
          )}
          <div className={`font-semibold truncate text-[11px] ${task.status === "done" ? "line-through opacity-70" : "text-foreground"}`}>
            {task.title}
          </div>
        </div>

        {/* Bottom: Assignee & Alert countdown / message */}
        <div className="flex items-center justify-between text-[9px] gap-1 flex-wrap">
          <span className="text-muted-foreground truncate font-medium">
            {assigneeInfo ? assigneeInfo.displayName : (isRTL ? "غير معين" : "Unassigned")}
          </span>
          {alertInfo?.show && (
            <span className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-tight shrink-0 ${
              alertInfo.severity === "critical"
                ? "bg-rose-500 text-white"
                : alertInfo.severity === "urgent"
                ? "bg-amber-500 text-white"
                : alertInfo.severity === "amber"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                : alertInfo.severity === "completed"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            }`}>
              {alertInfo.text}
            </span>
          )}
        </div>
      </button>
    );
  }

  function FollowupPill({ followup }: { followup: CalendarFollowupEvent }) {
    const time = followup.nextFollowupDate ? format(parseISO(followup.nextFollowupDate), "HH:mm") : "";
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onFollowupClick?.(followup); }}
        className="w-full text-start text-[10px] leading-tight px-1.5 py-1 rounded-lg transition-all hover:scale-[1.01] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs mb-1 overflow-hidden"
        title={`Client Follow-up: ${followup.clientName}`}
      >
        <div className="flex items-center justify-between gap-1 mb-0.5 min-w-0 flex-wrap">
          <span className="font-mono font-bold uppercase tracking-wider text-[8px] bg-amber-500/20 px-1 py-0.2 rounded flex items-center gap-0.5 shrink-0">
            <PhoneCall className="size-2.5" /> {isRTL ? "متابعة" : "FOLLOW-UP"}
          </span>
          {time && <span className="font-mono text-[9px] font-bold shrink-0" dir="ltr">{time}</span>}
        </div>
        <div className="font-bold truncate text-foreground text-[11px] min-w-0">{followup.clientName}</div>
        <div className="text-[9px] text-muted-foreground truncate min-w-0">{followup.nextAction || followup.summary || (isRTL ? "مستحقة المتابعة" : "Follow-up due")}</div>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // MONTH VIEW
  // ---------------------------------------------------------------------------
  function MonthView() {
    const monthStart = startOfMonth(effectiveCurrentDate);
    const monthEnd = endOfMonth(effectiveCurrentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    const weekdays = isRTL
      ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div>
        <div className="grid grid-cols-7 mb-0 bg-muted/40 py-2.5 border-b border-border/80">
          {weekdays.map(d => (
            <div key={d} className="text-center text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-mono font-bold">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-s border-border/80">
          {days.map(day => {
            const dayTasks = tasksForDay(day);
            const dayFollowups = followupsForDay(day);
            const totalEvents = dayTasks.length + dayFollowups.length;
            const inMonth = isSameMonth(day, effectiveCurrentDate);
            const today = isToday(day);
            const isSelected = effectiveSelectedDate ? isSameDay(day, effectiveSelectedDate) : false;

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  if (!inMonth && onCurrentDateChange) {
                    onCurrentDateChange(day);
                  }
                  if (onSelectDate) {
                    onSelectDate(day);
                  } else {
                    onCreateTask(format(day, "yyyy-MM-dd"));
                  }
                }}
                className={cn(
                  "min-h-[90px] sm:min-h-[115px] md:min-h-[125px] border-e border-b border-border/80 p-1 sm:p-1.5 cursor-pointer transition-all duration-150 relative group",
                  !inMonth ? "opacity-35 bg-muted/15" : "bg-card hover:bg-muted/30",
                  isSelected && "ring-2 ring-primary ring-inset bg-primary/[0.04]",
                )}
              >
                <div className="flex items-center justify-between mb-1 min-w-0 gap-0.5">
                  <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                    <span className={cn(
                      "text-[10.5px] sm:text-xs font-semibold size-5 sm:size-6.5 shrink-0 flex items-center justify-center rounded-full transition-colors",
                      today ? "bg-primary text-primary-foreground font-bold shadow-xs" :
                      isSelected ? "text-primary font-bold bg-primary/10" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    {!isWorker && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateTask(format(day, "yyyy-MM-dd"));
                        }}
                        title={isRTL ? "إضافة مهمة لهذا اليوم" : "Add task for this date"}
                        className="opacity-0 group-hover:opacity-100 transition-opacity size-5 rounded-md hover:bg-primary/20 hover:text-primary text-muted-foreground hidden sm:flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="size-3" />
                      </button>
                    )}
                  </div>
                  {totalEvents > 0 && (
                    <span className="text-[7.5px] sm:text-[9px] font-mono font-bold text-muted-foreground px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-md bg-muted/60 shrink-0">
                      {totalEvents}
                    </span>
                  )}
                </div>

                {/* Mobile indicators */}
                <div className="sm:hidden flex flex-wrap gap-1 mt-1">
                  {dayTasks.slice(0, 4).map(t => (
                    <span
                      key={t.id}
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        t.status === "done" ? "bg-emerald-500" :
                        isTaskOverdue(t) ? "bg-rose-500" : "bg-primary"
                      )}
                    />
                  ))}
                  {totalEvents > 4 && <span className="text-[7.5px] font-mono text-muted-foreground">+{totalEvents - 4}</span>}
                </div>

                {/* Desktop / Tablet cards */}
                <div className="hidden sm:block space-y-1">
                  {dayFollowups.map(f => <FollowupPill key={f.id} followup={f} />)}
                  {dayTasks.slice(0, 3 - dayFollowups.length).map(t => <EventPill key={t.id} task={t} currentDay={day} />)}
                  {totalEvents > 3 && (
                    <div className="text-[9px] text-muted-foreground text-center font-mono py-0.5 bg-muted/40 rounded-md">
                      +{totalEvents - 3} {isRTL ? "إضافية" : "more"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // WEEK VIEW
  // ---------------------------------------------------------------------------
  function WeekView() {
    const ws = startOfWeek(effectiveCurrentDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: ws, end: addDays(ws, 6) });
    const hours = Array.from({ length: 14 }, (_, i) => i + 8);

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[65px_repeat(7,1fr)] border-b border-border bg-muted/30">
            <div className="border-e border-border" />
            {days.map(d => (
              <div key={d.toISOString()} className={`text-center py-2.5 text-xs font-medium border-e border-border ${isToday(d) ? "bg-primary/5 text-primary" : "text-muted-foreground"}`}>
                <div className="uppercase font-mono text-[10px] tracking-wider font-bold">{formatDate(d, "EEE")}</div>
                <div className={`text-lg font-display font-extrabold mt-0.5 ${isToday(d) ? "bg-primary text-primary-foreground size-7 rounded-full inline-flex items-center justify-center shadow-xs" : "text-foreground"}`}>
                  {format(d, "d")}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[65px_repeat(7,1fr)]">
            {hours.map(h => (
              <div key={h} className="contents">
                <div className="text-[10px] text-muted-foreground text-end pe-2.5 py-3 border-b border-e border-border font-mono font-medium bg-muted/10">
                  {String(h).padStart(2, "0")}:00
                </div>
                {days.map(d => {
                  const dayTasks = tasksForDay(d).filter(t => {
                    if (!t.start_date) return h === 9;
                    const dObj = parseISO(t.start_date);
                    const taskHour = getHours(dObj);
                    const taskMin = getMinutes(dObj);
                    if (taskHour === 0 && taskMin === 0) return h === 9;
                    return taskHour === h;
                  });
                  const dayFollowups = followupsForDay(d).filter(f => {
                    if (!f.nextFollowupDate) return h === 10;
                    const fObj = parseISO(f.nextFollowupDate);
                    const fHour = getHours(fObj);
                    const fMin = getMinutes(fObj);
                    if (fHour === 0 && fMin === 0) return h === 10;
                    return fHour === h;
                  });

                  return (
                    <div
                      key={`${d.toISOString()}-${h}`}
                      onClick={() => onCreateTask(format(d, "yyyy-MM-dd"), h)}
                      className="border-b border-e border-border min-h-[60px] p-1 cursor-pointer hover:bg-muted/30 transition-colors bg-card"
                    >
                      {dayFollowups.map(f => <FollowupPill key={f.id} followup={f} />)}
                      {dayTasks.map(t => <EventPill key={t.id} task={t} currentDay={d} />)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // DAY VIEW — TRUE EXECUTION QUEUE ("شنوة عندي نخدم اليوم؟")
  // ---------------------------------------------------------------------------
  function DayView() {
    const targetDay = effectiveSelectedDate || effectiveCurrentDate;
    const dayTasks = tasksForDay(targetDay);
    const dayFollowups = followupsForDay(targetDay);

    const isTargetToday = isToday(targetDay);
    const overdueTasks = dayTasks.filter(t => isTaskOverdue(t, targetDay));
    const dueOnDayTasks = dayTasks.filter(t => {
      if (isTaskOverdue(t, targetDay) || t.status === "done") return false;
      return t.deadline ? isSameDay(parseISO(t.deadline), targetDay) : false;
    });
    const inProgressTasks = dayTasks.filter(t => {
      if (isTaskOverdue(t, targetDay) || t.status === "done") return false;
      if (t.deadline && isSameDay(parseISO(t.deadline), targetDay)) return false;
      return t.status === "in_progress";
    });
    const upcomingTasks = dayTasks.filter(t => {
      if (isTaskOverdue(t, targetDay) || t.status === "done") return false;
      if (t.deadline && isSameDay(parseISO(t.deadline), targetDay)) return false;
      return t.status === "todo" || t.status === "review" || t.status === "blocked";
    });
    const completedTasks = dayTasks.filter(t => t.status === "done");

    function ExecutionTaskCard({ task }: { task: TaskRow }) {
      const proj = projectMap.get(task.project_id);
      const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
      const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
      const isDone = task.status === "done";
      const isOverdue = isTaskOverdue(task);
      const alertInfo = getTaskAlertBadge(task, targetDay);
      const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
      const assignedByInfo = getAssignmentMemberInfo(task.assigned_by_id, teamMembers, profiles);

      return (
        <div className={`p-4 rounded-2xl border transition-all ${
          isDone
            ? "bg-emerald-500/5 border-emerald-500/30 opacity-80"
            : isOverdue
            ? "bg-rose-500/5 border-rose-500/40 shadow-xs"
            : "bg-card border-border hover:border-primary/40 shadow-xs"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold font-mono uppercase tracking-wider">
                {proj?.client_name || "SADA CLIENT"}
              </span>
              {task.service && (
                <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 bg-muted rounded-md">
                  {task.service}
                </span>
              )}
              <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded ${priorityConf.color} ${priorityConf.bg}`}>
                {t(`priority.${task.priority}`) || priorityConf.label}
              </span>
              <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded ${statusConf.color} ${statusConf.bg}`}>
                {t(`status.${task.status}`) || statusConf.label}
              </span>
            </div>

            {alertInfo?.show && (
              <span className={`px-2.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-tight flex items-center gap-1 shrink-0 ${
                alertInfo.severity === "critical"
                  ? "bg-rose-500 text-white animate-pulse"
                  : alertInfo.severity === "urgent"
                  ? "bg-amber-500 text-white"
                  : alertInfo.severity === "amber"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                  : alertInfo.severity === "completed"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-muted text-muted-foreground"
              }`}>
                {alertInfo.severity === "critical" && <AlertTriangle className="size-3" />}
                {alertInfo.text}
              </span>
            )}
          </div>

          <h3 className={`text-sm md:text-base font-bold text-foreground mb-1.5 ${isDone ? "line-through opacity-70" : ""}`}>
            {task.title}
          </h3>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Metadata Row: Assigned By / Assigned To / Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-2.5 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs mb-3 font-mono">
            <div>
              <span className="text-[9px] uppercase text-muted-foreground block font-bold">{isRTL ? "المسؤول عن التنفيذ" : "Assigned To"}</span>
              <span className="font-semibold text-foreground truncate block">
                {assigneeInfo ? assigneeInfo.displayName : (isRTL ? "غير معين" : "Unassigned")}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase text-muted-foreground block font-bold">{isRTL ? "المكلف بواسطة" : "Assigned By"}</span>
              <span className="font-semibold text-foreground truncate block">
                {assignedByInfo ? assignedByInfo.displayName : "Boubakar Hamed"}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase text-muted-foreground block font-bold">{isRTL ? "فترة العمل" : "Work Range"}</span>
              <span className="font-semibold text-foreground truncate block" dir="ltr">
                {task.start_date ? formatDate(task.start_date, "d MMM") : "—"} → {task.deadline ? formatDate(task.deadline, "d MMM") : "—"}
              </span>
            </div>
          </div>

          {/* Delivery link preview if present */}
          {task.result_links && task.result_links.length > 0 && (
            <div className="mb-3 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="size-3" /> {isRTL ? "تم إرفاق النتيجة" : "Result Attached"}
              </span>
              <a
                href={task.result_links[0]}
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="text-primary hover:underline truncate max-w-[200px] text-xs font-mono"
              >
                {task.result_links[0]}
              </a>
            </div>
          )}

          {/* Execution CTAs */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              {onStatusChange && (
                <button
                  type="button"
                  onClick={() => onStatusChange(task.id, isDone ? "todo" : "done")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-xs ${
                    isDone
                      ? "bg-muted text-muted-foreground hover:bg-muted/80"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  {isDone ? (isRTL ? "تعليم كقيد الانتظار" : "Mark Pending") : (isRTL ? "✓ إكمال المهمة" : "✓ Complete")}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onTaskClick(task)}
              className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <span>{isRTL ? "فتح المهمة" : "Open Task"}</span>
              <ArrowRight className="size-3 rtl:rotate-180" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* Day Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-primary">
                {isRTL ? "قائمة التنفيذ" : "Execution Queue"}
              </span>
              <span className="text-xs text-muted-foreground">· {isRTL ? (activeMemberName ? `يوم ${activeMemberName}` : "عمل اليوم") : (activeMemberName ? `${activeMemberName}'s Day` : "Today's Work")}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-extrabold text-foreground mt-0.5">
              {formatDate(targetDay, "EEEE, d MMMM yyyy")}
            </h2>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-card border border-border font-bold text-foreground">
              {isRTL
                ? `${dayTasks.length} تسليم نشط`
                : `${dayTasks.length} ${dayTasks.length === 1 ? "Active Deliverable" : "Active Deliverables"}`}
            </span>
          </div>
        </div>

        {/* Client Follow-ups Section */}
        {dayFollowups.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1.5">
              <PhoneCall className="size-3.5" /> {isRTL ? `متابعات العملاء (${dayFollowups.length})` : `Client Follow-ups (${dayFollowups.length})`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {dayFollowups.map(f => <FollowupPill key={f.id} followup={f} />)}
            </div>
          </div>
        )}

        {/* Empty State */}
        {dayTasks.length === 0 && dayFollowups.length === 0 && (
          <div className="py-16 text-center border border-dashed border-border rounded-3xl bg-muted/10">
            <CalendarIcon className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-display font-bold text-base text-foreground">{isRTL ? "لا توجد مهام مجدولة لهذا اليوم" : "No tasks scheduled for this day"}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {isRTL
                ? `ليس لدى هذا العضو تسليمات نشطة أو مواعيد نهائية في ${formatDate(targetDay, "d MMMM yyyy")}.`
                : `This team member has no active deliverables or deadlines on ${formatDate(targetDay, "d MMMM yyyy")}.`}
            </p>
            {isWorker ? (
              <a
                href="/admin/my-work"
                className="mt-4 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all inline-flex items-center gap-1.5"
              >
                <Clock className="size-3.5" /> {isRTL ? "تسجيل العمل في مهامي" : "Log Work in My Work"}
              </a>
            ) : (
              <button
                onClick={() => onCreateTask(format(targetDay, "yyyy-MM-dd"))}
                className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {isRTL ? "+ إنشاء تسليم" : "+ Create Deliverable"}
              </button>
            )}
          </div>
        )}

        {/* 1. OVERDUE SECTION */}
        {overdueTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="size-4" /> 🔴 {isRTL ? "متأخرة" : "Overdue"} ({overdueTasks.length})
              </span>
              <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                {isRTL ? "تتطلب تسليماً فورياً" : "Needs immediate delivery"}
              </span>
            </div>
            <div className="space-y-3">
              {overdueTasks.map(t => <ExecutionTaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {/* 2. DUE TODAY / ON SELECTED DAY SECTION */}
        {dueOnDayTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="size-4" /> 🟠 {isTargetToday ? (isRTL ? "مستحقة اليوم" : "Due Today") : (isRTL ? "مستحقة في هذا اليوم" : "Due on this Day")} ({dueOnDayTasks.length})
              </span>
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                {isTargetToday ? (isRTL ? "الموعد النهائي اليوم" : "Deadline today") : (isRTL ? "الموعد النهائي في هذا اليوم" : "Deadline on this day")}
              </span>
            </div>
            <div className="space-y-3">
              {dueOnDayTasks.map(t => <ExecutionTaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {/* 3. IN PROGRESS SECTION */}
        {inProgressTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-primary/30 pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="size-4" /> 🔵 {isRTL ? "قيد التنفيذ" : "In Progress"} ({inProgressTasks.length})
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {isRTL ? "قيد التنفيذ حالياً" : "Currently executing"}
              </span>
            </div>
            <div className="space-y-3">
              {inProgressTasks.map(t => <ExecutionTaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {/* 4. UPCOMING SECTION */}
        {upcomingTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="size-4" /> ⚪ {isRTL ? "قادمة" : "Upcoming"} ({upcomingTasks.length})
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {isRTL ? "ضمن نافذة العمل" : "Active in work window"}
              </span>
            </div>
            <div className="space-y-3">
              {upcomingTasks.map(t => <ExecutionTaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {/* 5. COMPLETED SECTION */}
        {completedTasks.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> 🟢 {isRTL ? "مكتملة" : "Completed"} ({completedTasks.length})
              </span>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                {isRTL ? "تم التسليم" : "Delivered"}
              </span>
            </div>
            <div className="space-y-3">
              {completedTasks.map(t => <ExecutionTaskCard key={t.id} task={t} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Calendar Controls Bar */}
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="size-8 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
              title={isRTL ? "السابق" : "Previous"}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
            >
              {isRTL ? "اليوم" : "Today"}
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="size-8 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
              title={isRTL ? "التالي" : "Next"}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
            <h2 className="font-display text-base md:text-lg font-bold mx-2 text-foreground">
              {heading}
            </h2>
          </div>

          {/* View Mode Selector: Month | Week | Day */}
          <div className="flex items-center gap-1 bg-muted/60 border border-border/80 rounded-2xl p-1">
            {(["month", "week", "day"] as ViewMode[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  effectiveView === v
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {v === "month" ? (isRTL ? "شهري" : "Month") : v === "week" ? (isRTL ? "أسبوعي" : "Week") : (isRTL ? "يومي" : "Day")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Calendar Viewport */}
      <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
        {effectiveView === "month" && <MonthView />}
        {effectiveView === "week" && <WeekView />}
        {effectiveView === "day" && <DayView />}
      </div>
    </div>
  );
}
