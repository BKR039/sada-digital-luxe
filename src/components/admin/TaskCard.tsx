import { useState, useMemo } from "react";
import {
  type TaskRow, STATUS_CONFIG, PRIORITY_CONFIG, deadlineLabel, isTaskOverdue, type ProfileRow, type TeamMemberRow, getAssignmentMemberInfo
} from "./project-utils";
import {
  CheckCircle2, Check, ExternalLink, AlertCircle, ArrowRightLeft, User, MoreVertical,
  Clock, Pause, MessageSquare, Sparkles, AlertTriangle, Lock, Eye, Workflow
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { permissions, isTaskAssignedToUser, type PermissionContext } from "@/lib/permissions";

interface Props {
  task: TaskRow;
  profiles: ProfileRow[];
  teamMembers?: TeamMemberRow[];
  onStatusChange: (taskId: string, status: TaskRow["status"]) => void;
  onEdit: (task: TaskRow) => void;
  onOpenDetails?: (task: TaskRow) => void;
}

export function TaskCard({ task, profiles, teamMembers = [], onStatusChange, onEdit, onOpenDetails }: Props) {
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const { user, role, isWorker } = useAuth();

  const currentMember = useMemo(() => {
    if (!user) return null;
    return teamMembers.find((m) => m.profile_id === user.id || m.id === user.id) || null;
  }, [user, teamMembers]);

  const permCtx: PermissionContext = useMemo(
    () => ({
      role,
      userId: user?.id,
      memberProfileId: currentMember?.profile_id,
      memberId: currentMember?.id,
    }),
    [role, user?.id, currentMember]
  );

  const isAssignedToMe = isTaskAssignedToUser(task, permCtx);
  const canUpdate = permissions.canUpdateTaskProgress(permCtx, task);
  const canEditDef = permissions.canEditTaskDefinition(permCtx);

  const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const overdue = isTaskOverdue(task);
  const dl = deadlineLabel(task.deadline);

  const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
  const assignedByInfo = getAssignmentMemberInfo(task.assigned_by_id, teamMembers, profiles);
  const prevAssigneeInfo = getAssignmentMemberInfo(task.previous_assignee_id, teamMembers, profiles);

  const hasResult = (task.result_links && task.result_links.length > 0) || !!task.result_title;
  const firstResultLink = task.result_links && task.result_links.length > 0 ? task.result_links[0] : null;

  return (
    <div
      className={`group relative rounded-2xl border bg-card p-3.5 sm:p-4 transition-all hover:elevated-shadow hover:border-primary/40 cursor-pointer ${
        task.status === "cancelled" ? "opacity-60" : ""
      } ${overdue ? "border-destructive/40 bg-destructive/5" : task.status === "blocked" ? "border-rose-500/30 bg-rose-500/5" : "border-border"}`}
      onClick={() => onOpenDetails ? onOpenDetails(task) : onEdit(task)}
    >
      <div className="flex items-start gap-3">
        {/* Status completion toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!canUpdate) return;
            if (task.status === "done") onStatusChange(task.id, "todo");
            else onStatusChange(task.id, "done");
          }}
          disabled={!canUpdate}
          className={`mt-0.5 shrink-0 transition-transform active:scale-95 p-1 rounded-lg ${
            !canUpdate ? "cursor-default opacity-70" : ""
          } ${
            task.status === "done"
              ? "text-emerald-600 hover:bg-emerald-500/10"
              : overdue
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:text-primary hover:bg-muted"
          }`}
          aria-label={task.status === "done" ? "Mark incomplete" : "Mark complete"}
          title={!canUpdate ? "Read only: task is assigned to another team specialist" : undefined}
        >
          {task.status === "done" ? (
            <div className="size-5 rounded-full bg-primary border-2 border-primary grid place-items-center text-white shadow-xs">
              <Check className="size-3 stroke-[3]" />
            </div>
          ) : task.status === "todo" ? (
            <div className="size-5 rounded-full border-2 border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary transition-colors" />
          ) : (
            <statusConf.Icon className="size-5 sm:size-6" />
          )}
        </button>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header Badges & Title */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Category / Phase */}
              {task.category && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {task.category}
                </span>
              )}

              {/* Service Deliverable */}
              {task.service && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {task.service}
                </span>
              )}

              {/* Priority */}
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold ${priorityConf.color} ${priorityConf.bg}`}>
                <span className={`size-1.5 rounded-full ${priorityConf.dot}`} />
                {priorityConf.label}
              </span>

              {/* Subtask Indicator */}
              {task.parent_task_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Workflow className="size-2.5" />
                  {isAr ? "مهمة فرعية" : "Subtask"}
                </span>
              )}

              {/* Worker-specific badge */}
              {isWorker && isAssignedToMe && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  {isAr ? "مهمتك" : "Your Task"}
                </span>
              )}
            </div>

            {/* Quick action menu trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuickMenu(!showQuickMenu);
                }}
                className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={isAr ? "إجراءات سريعة للمهمة" : "Quick task actions"}
              >
                <MoreVertical className="size-4" />
              </button>

              {/* Quick action dropdown menu */}
              {showQuickMenu && (
                <div
                  className="absolute end-0 top-8 z-30 w-44 bg-card border border-border rounded-2xl p-1.5 elevated-shadow space-y-1 text-xs animate-in zoom-in-95 text-start"
                  onClick={e => e.stopPropagation()}
                >
                  {/* WORKER NOT ASSIGNED: Read-only options */}
                  {isWorker && !isAssignedToMe ? (
                    <button
                      onClick={() => {
                        setShowQuickMenu(false);
                        if (onOpenDetails) onOpenDetails(task);
                        else onEdit(task);
                      }}
                      className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                      <span>{isAr ? "عرض المهمة (للقراءة فقط)" : "View Task (Read Only)"}</span>
                    </button>
                  ) : isWorker && isAssignedToMe ? (
                    /* WORKER ASSIGNED: Execution options only */
                    <>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onStatusChange(task.id, task.status === "done" ? "todo" : "done");
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>{task.status === "done" ? (isAr ? "تعيين كقيد الانتظار" : "Mark Todo") : (isAr ? "إكمال" : "Complete")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onEdit(task);
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <Sparkles className="size-3.5 text-primary" />
                        <span>{isAr ? "تحديث التقدم" : "Update Progress"}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onStatusChange(task.id, "blocked");
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <AlertCircle className="size-3.5 text-rose-500" />
                        <span>{isAr ? "تعيين كمتوقفة" : "Mark Blocked"}</span>
                      </button>
                    </>
                  ) : (
                    /* ADMIN / SUPER ADMIN: Full operational options */
                    <>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onStatusChange(task.id, task.status === "done" ? "todo" : "done");
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>{task.status === "done" ? (isAr ? "تعيين كقيد الانتظار" : "Mark Todo") : (isAr ? "إكمال" : "Complete")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onEdit(task);
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <ArrowRightLeft className="size-3.5 text-amber-500" />
                        <span>{isAr ? "إعادة تعيين / تعديل" : "Reassign / Edit"}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onStatusChange(task.id, "postponed");
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <Pause className="size-3.5 text-amber-500" />
                        <span>{isAr ? "تأجيل المهمة" : "Postpone Task"}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onStatusChange(task.id, "blocked");
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <AlertCircle className="size-3.5 text-rose-500" />
                        <span>{isAr ? "تعيين كمتوقفة" : "Mark Blocked"}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowQuickMenu(false);
                          onEdit(task);
                        }}
                        className="w-full text-start px-3 py-1.5 rounded-xl hover:bg-muted flex items-center gap-2 font-medium"
                      >
                        <Sparkles className="size-3.5 text-primary" />
                        <span>{isAr ? "إضافة تسليم / ملاحظة" : "Add Result / Note"}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className={`font-display font-bold text-sm sm:text-base text-foreground ${
            task.status === "done" ? "line-through text-muted-foreground" : ""
          }`}>
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Blocked Info Banner */}
          {task.status === "blocked" && (
            <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 space-y-0.5">
              <div className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <AlertCircle className="size-3" />
                <span>
                  {isAr
                    ? `متوقفة — ${task.waiting_on === "client" ? "بانتظار العميل" : "بانتظار الفريق"}`
                    : `BLOCKED — ${task.waiting_on === "client" ? "Waiting on Client" : "Waiting on Team"}`}
                </span>
              </div>
              <p className="text-foreground text-[11px] font-medium">"{task.blocked_reason || (isAr ? "المهمة متوقفة حالياً" : "Task is blocked")}"</p>
            </div>
          )}

          {/* Postponed Info Banner */}
          {task.status === "postponed" && (
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
              <div className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Pause className="size-3" />
                <span>{isAr ? "مؤجلة" : "POSTPONED"}</span>
              </div>
              <p className="text-foreground text-[11px] font-medium">"{task.postpone_reason || (isAr ? "تم تحديد موعد جديد" : "New deadline set")}"</p>
            </div>
          )}

          {/* Deliverable Result Banner */}
          {hasResult && (
            <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="size-3" /> {isAr ? "النتيجة:" : "Result:"} {task.result_title || (isAr ? "التسليم المنجز" : "Deliverable")}
                </span>
                {firstResultLink && (
                  <a
                    href={firstResultLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline bg-card px-2 py-0.5 rounded-md border border-border"
                  >
                    <span>{isAr ? "فتح النتيجة ↗" : "Open Result ↗"}</span>
                  </a>
                )}
              </div>
              {task.result_notes && (
                <p className="text-[11px] text-muted-foreground italic">"{task.result_notes}"</p>
              )}
            </div>
          )}

          {/* Meta Footer: WHO & WHEN */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs gap-2 flex-wrap">
            {/* WHO: Assigned To & Assigned By */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">{isAr ? "إلى:" : "To:"}</span>
                {assigneeInfo ? (
                  <span className="font-semibold text-foreground">
                    {assigneeInfo.displayName.split(" ")[0]}
                    {isAssignedToMe && (isAr ? " (أنت)" : " (You)")}
                  </span>
                ) : (
                  <span className="italic">{isAr ? "غير معين" : "Unassigned"}</span>
                )}
              </span>

              <span className="text-muted-foreground/40">·</span>

              <span className="flex items-center gap-1">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">{isAr ? "بواسطة:" : "By:"}</span>
                <span className="font-medium text-foreground/80">
                  {assignedByInfo ? assignedByInfo.displayName.split(" ")[0] : (isAr ? "غير مسجل" : "Not recorded")}
                </span>
              </span>

              {prevAssigneeInfo && (
                <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1" title={`${isAr ? "تسليم من" : "Handoff from"} ${prevAssigneeInfo.displayName}`}>
                  <ArrowRightLeft className="size-2.5 rtl:rotate-180" />
                  <span>{isAr ? `من ${prevAssigneeInfo.displayName.split(" ")[0]}` : `from ${prevAssigneeInfo.displayName.split(" ")[0]}`}</span>
                </span>
              )}
            </div>

            {/* WHEN: Deadline */}
            <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
              <Clock className="size-3 text-muted-foreground" />
              <span className={dl?.className || "text-muted-foreground"}>
                {dl?.text || (isAr ? "بلا موعد نهائي" : "No deadline")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
