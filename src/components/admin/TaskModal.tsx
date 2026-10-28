import { useState, useMemo, useEffect } from "react";
import {
  X, Plus, Trash2, ExternalLink, ArrowRightLeft, AlertCircle, AlertTriangle, Sparkles,
  ChevronDown, ChevronUp, User, Users, Calendar, Clock, Check, Search, ShieldCheck,
  Tag, Layers, Link as LinkIcon, Flag, CheckCircle2, ListChecks, Lock, ShieldAlert, Workflow
} from "lucide-react";
import { format, addDays } from "date-fns";
import { formatDate } from "@/lib/date-locale";
import { useTranslation } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  permissions,
  can,
  isTaskAssignedToUser,
  getRoleLabel,
  normalizeRole,
  type PermissionContext,
} from "@/lib/permissions";
import type { TaskRow, TaskStatus, TaskPriority, ProfileRow, TeamMemberRow } from "./project-utils";
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPICAL_PHASES, resolveToProfileId, getAssignmentMemberInfo } from "./project-utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { SADAButton } from "@/components/ui/sada-button";
import { SADAInput } from "@/components/ui/sada-input";
import { SADABadge } from "@/components/ui/sada-badge";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADADateDateTimePicker } from "@/components/ui/sada-date-time-picker";
import { SADASwitch, SADACounter } from "@/components/ui/sada-ui";
import { SADAConfirmDialog } from "@/components/ui/sada-confirm-dialog";
import {
  fetchWorkflowTemplates,
  instantiateWorkflowStages,
  matchWorkerForStageRole,
} from "@/lib/workflow-service";
import type { WorkflowTemplate, WorkflowStageDefinition } from "@/types/workflow";

interface Props {
  task: TaskRow | null; // null = create mode
  projectId: string;
  profiles: ProfileRow[];
  teamMembers?: TeamMemberRow[];
  projectServices?: string[];
  onSaved: () => void;
  onClose: () => void;
  onDelete?: (taskId: string) => void;
  defaultDate?: string;
  defaultCategory?: string;
}

const STATUS_OPTIONS: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "revision",
  "approved",
  "delivered",
  "blocked",
  "paused",
  "done",
  "postponed",
  "cancelled",
];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

import { MemberPicker } from "./TeamMemberPicker";

// ---------------------------------------------------------------------------
// Custom Selector 2: Status Popover Pill Selector
// ---------------------------------------------------------------------------
function StatusPicker({
  value,
  onChange,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
}) {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const [open, setOpen] = useState(false);
  const currentConfig = STATUS_CONFIG[value];
  const Icon = currentConfig.Icon;

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {isAr ? "الحالة" : "Status"}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex items-center justify-between gap-2.5 w-full px-3.5 py-2 rounded-xl text-xs font-semibold border ${currentConfig.bg} ${currentConfig.border} ${currentConfig.color} transition-all hover:opacity-90 shadow-xs`}
          >
            <div className="flex items-center gap-2 truncate">
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{currentConfig.label}</span>
            </div>
            <ChevronDown className="size-3.5 opacity-70 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1.5 rounded-2xl border-border shadow-xl z-50" align="start">
          <div className="space-y-1">
            {STATUS_OPTIONS.map((st) => {
              const cfg = STATUS_CONFIG[st];
              const StIcon = cfg.Icon;
              const isSelected = st === value;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onChange(st);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? `${cfg.bg} ${cfg.color} font-bold shadow-xs`
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <StIcon className={`size-4 ${cfg.color}`} />
                    <span>{cfg.label}</span>
                  </div>
                  {isSelected && <Check className="size-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Selector 3: Priority Segmented Selector
// ---------------------------------------------------------------------------
function PrioritySegmented({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (p: TaskPriority) => void;
}) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {isAr ? "الأولوية" : "Priority"}
      </span>
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 border border-border/80 rounded-2xl">
        {PRIORITY_OPTIONS.map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          const isSelected = p === value;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all ${
                isSelected
                  ? `bg-card ${cfg.color} shadow-xs border border-border/60 scale-[1.02]`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className={`size-2 rounded-full ${cfg.dot} shrink-0`} />
              <span className="truncate">{cfg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Selector 4: Phase & Service Combobox Picker
// ---------------------------------------------------------------------------
function ComboboxPicker({
  value,
  onChange,
  options,
  label,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: readonly string[] | string[];
  label: string;
  placeholder: string;
}) {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = Array.from(new Set([...options, ...(value ? [value] : [])]));
    if (!search.trim()) return list;
    return list.filter((item) => item.toLowerCase().includes(search.toLowerCase()));
  }, [options, value, search]);

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between gap-2 w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium hover:bg-muted/30 transition-all text-start truncate"
          >
            <span className={value ? "text-foreground font-semibold truncate" : "text-muted-foreground truncate"}>
              {value || placeholder}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0 rounded-2xl border-border shadow-xl z-50" align="start">
          <Command className="rounded-2xl">
            <CommandInput
              placeholder={isAr ? `بحث ${label}...` : `Search ${label.toLowerCase()}…`}
              value={search}
              onValueChange={setSearch}
              className="text-xs h-9"
            />
            <CommandList className="max-h-48 p-1">
              <CommandEmpty className="py-2 px-3 text-xs text-muted-foreground">
                {search.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(search.trim());
                      setOpen(false);
                    }}
                    className="text-primary font-semibold hover:underline text-start w-full"
                  >
                    {isAr ? `استخدام "${search.trim()}"` : `Use "${search.trim()}"`}
                  </button>
                ) : (
                  isAr ? "لا توجد خيارات" : "No options"
                )}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt}
                    onSelect={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer"
                  >
                    <span>{opt}</span>
                    {value === opt && <Check className="size-3.5 text-primary shrink-0" />}
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
// MAIN TASK MODAL COMPOSER
// ---------------------------------------------------------------------------
export function TaskModal({
  task,
  projectId,
  profiles,
  teamMembers = [],
  projectServices = [],
  onSaved,
  onClose,
  onDelete,
  defaultDate,
  defaultCategory,
}: Props) {
  const { user, role, isSuperAdmin, isAdmin, isWorker } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const isEdit = !!task;

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

  const canCreate = can(permCtx, "tasks.create");
  const canEdit = can(permCtx, "tasks.edit");
  const canAssign = can(permCtx, "tasks.assign");
  const canChangePriority = can(permCtx, "tasks.change_priority");
  const canChangeDueDate = can(permCtx, "tasks.change_due_date");
  const canChangeStatus = permissions.canChangeStatus(permCtx, task ?? undefined);
  const canComplete = permissions.canCompleteTask(permCtx, task ?? undefined);
  const canEditDef = canEdit;
  const isAssignedToMe = isTaskAssignedToUser(task, permCtx);
  const canUpdateProg = permissions.canUpdateTaskProgress(permCtx, task ?? undefined);
  const canDelete = permissions.canDeleteTask(permCtx);

  // Section 1: WHAT
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");

  // Section 2: WHO — Always resolve to profile_id for FK safety
  const initialAssigneeId = useMemo(
    () => resolveToProfileId(task?.assignee_id, teamMembers, profiles) ?? "",
    [task?.assignee_id, teamMembers, profiles]
  );
  const initialAssignedById = useMemo(
    () => resolveToProfileId(task?.assigned_by_id ?? user?.id, teamMembers, profiles) ?? "",
    [task?.assigned_by_id, user?.id, teamMembers, profiles]
  );

  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [assignedById, setAssignedById] = useState(initialAssignedById);

  // Assignment display metadata
  const assigneeInfo = useMemo(
    () => getAssignmentMemberInfo(task?.assignee_id ?? assigneeId, teamMembers, profiles),
    [task?.assignee_id, assigneeId, teamMembers, profiles]
  );
  const assignedByInfo = useMemo(
    () => getAssignmentMemberInfo(task?.assigned_by_id ?? assignedById, teamMembers, profiles),
    [task?.assigned_by_id, assignedById, teamMembers, profiles]
  );

  // Section 3: WHEN
  const [startDate, setStartDate] = useState(
    task?.start_date ? task.start_date.slice(0, 16) : defaultDate ? `${defaultDate}T09:00` : ""
  );
  const [endDate, setEndDate] = useState(task?.end_date ? task.end_date.slice(0, 16) : "");
  const [deadline, setDeadline] = useState(task?.deadline ?? (defaultDate ? defaultDate.slice(0, 10) : ""));
  const [deadlineAlertEnabled, setDeadlineAlertEnabled] = useState<boolean>(task?.deadline_alert_enabled ?? false);
  const [deadlineAlertDays, setDeadlineAlertDays] = useState<number>(task?.deadline_alert_days ?? 3);
  const [deadlineAlertMessage, setDeadlineAlertMessage] = useState<string>(task?.deadline_alert_message ?? "");

  // Section 4: EXECUTION
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [category, setCategory] = useState(task?.category ?? defaultCategory ?? "Production");
  const [service, setService] = useState(task?.service ?? "");

  // Section 5: DONE LOOKS LIKE
  const [resultTitle, setResultTitle] = useState(task?.result_title ?? "");
  const [resultLinks, setResultLinks] = useState<string[]>(task?.result_links?.length ? [...task.result_links] : []);
  const [newLinkInput, setNewLinkInput] = useState("");
  const [resultNotes, setResultNotes] = useState(task?.result_notes ?? "");

  // Section 6: ADVANCED / EFFORT / HANDOFF / BLOCKERS
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimated_minutes?.toString() ?? "");
  const [actualMinutes, setActualMinutes] = useState(task?.actual_minutes?.toString() ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [handoffReason, setHandoffReason] = useState<string>(task?.handoff_reason ?? "");
  const [postponeReason, setPostponeReason] = useState(task?.postpone_reason ?? "");
  const [waitingOn, setWaitingOn] = useState<string>(task?.waiting_on ?? "client");
  const [blockedReason, setBlockedReason] = useState<string>(task?.blocked_reason ?? "");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);

  // Workflow Template Integration
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [stageAssignees, setStageAssignees] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEdit) {
      fetchWorkflowTemplates().then(list => {
        setWorkflowTemplates(list.filter(t => t.is_active));
      });
    }
  }, [isEdit]);

  const activeWorkflowTemplate = useMemo(() => {
    if (selectedTemplateId === "none") return null;
    return workflowTemplates.find(t => t.id === selectedTemplateId || t.task_type === selectedTemplateId) || null;
  }, [selectedTemplateId, workflowTemplates]);

  // Parent task resolution for subtasks, and subtasks list for main tasks
  const [parentTask, setParentTask] = useState<TaskRow | null>(null);
  const [subtasks, setSubtasks] = useState<TaskRow[]>([]);

  useEffect(() => {
    if (task?.parent_task_id) {
      (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("id", task.parent_task_id)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          if (data) setParentTask(data as TaskRow);
        });
    } else {
      setParentTask(null);
    }

    if (task?.id && !task.parent_task_id) {
      (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("parent_task_id", task.id)
        .order("order_index", { ascending: true })
        .then(({ data }: { data: any }) => {
          if (data) setSubtasks(data as TaskRow[]);
        });
    } else {
      setSubtasks([]);
    }
  }, [task?.id, task?.parent_task_id]);

  const parentAssigneeInfo = useMemo(() => {
    if (!parentTask?.assignee_id) return null;
    return getAssignmentMemberInfo(parentTask.assignee_id, teamMembers, profiles);
  }, [parentTask?.assignee_id, teamMembers, profiles]);

  const handleSelectWorkflowTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") return;
    const tpl = workflowTemplates.find(t => t.id === templateId || t.task_type === templateId);
    if (!tpl) return;

    if (!category || category === "Production") {
      setCategory(tpl.name);
    }
    if (!service) {
      setService(tpl.name);
    }

    const initialAssignees: Record<string, string> = {};
    tpl.stages.forEach((stage: WorkflowStageDefinition) => {
      // RULE: Stages default to Main Task Assignee (if set), otherwise fallback to matching by role
      const matched = matchWorkerForStageRole(stage.default_assignee_role, teamMembers, profiles);
      const defaultAssignee = assigneeId || matched;
      if (defaultAssignee) {
        initialAssignees[stage.id] = defaultAssignee;
      }
    });
    setStageAssignees(initialAssignees);
  };

  const handleAssigneeChange = (newAssigneeId: string) => {
    setAssigneeId(newAssigneeId);
    if (activeWorkflowTemplate && newAssigneeId) {
      setStageAssignees(prev => {
        const next = { ...prev };
        activeWorkflowTemplate.stages.forEach(stg => {
          if (!next[stg.id] || next[stg.id] === assigneeId) {
            next[stg.id] = newAssigneeId;
          }
        });
        return next;
      });
    }
  };

  const assigneeChanged = isEdit && assigneeId !== (task?.assignee_id ?? "");
  const statusChanged = isEdit && status !== task?.status;
  const needsPostponeReason = status === "postponed" && (statusChanged || !task?.postpone_reason);
  const needsBlockedReason = status === "blocked" && (statusChanged || !task?.blocked_reason);

  const setQuickDeadline = (daysAhead: number) => {
    const target = addDays(new Date(), daysAhead);
    setDeadline(format(target, "yyyy-MM-dd"));
  };

  const addResultLink = () => {
    if (!newLinkInput.trim()) return;
    let url = newLinkInput.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
      url = `https://${url}`;
    }
    setResultLinks([...resultLinks, url]);
    setNewLinkInput("");
  };

  const removeResultLink = (idx: number) => {
    setResultLinks(resultLinks.filter((_, i) => i !== idx));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    // 0. Top-Level Granular Permission Enforcement
    if (!isEdit && !canCreate) {
      toast.error(isAr ? "غير مصرح: لا تملك صلاحية إنشاء مهام جديدة ('tasks.create')." : "Unauthorized: You lack permission to create tasks ('tasks.create').");
      return;
    }

    if (isEdit) {
      if (assigneeChanged && !canAssign) {
        toast.error(isAr ? "غير مصرح: لا تملك صلاحية تعيين المهام ('tasks.assign')." : "Unauthorized: You lack permission to assign tasks ('tasks.assign').");
        return;
      }
      if (priority !== task?.priority && !canChangePriority) {
        toast.error(isAr ? "غير مصرح: لا تملك صلاحية تغيير أولوية المهمة ('tasks.change_priority')." : "Unauthorized: You lack permission to change task priority ('tasks.change_priority').");
        return;
      }
      if (deadline !== (task?.deadline || "") && !canChangeDueDate) {
        toast.error(isAr ? "غير مصرح: لا تملك صلاحية تعديل الموعد النهائي ('tasks.change_due_date')." : "Unauthorized: You lack permission to change due dates ('tasks.change_due_date').");
        return;
      }
      const isDefinitionChanged =
        title.trim() !== (task?.title || "").trim() ||
        (description.trim() || "") !== (task?.description || "").trim() ||
        category.trim() !== (task?.category || "").trim() ||
        service.trim() !== (task?.service || "").trim();

      if (isDefinitionChanged && !canEdit) {
        toast.error(isAr ? "غير مصرح: لا تملك صلاحية تعديل بيانات المهمة ('tasks.edit')." : "Unauthorized: You lack permission to edit task definition ('tasks.edit').");
        return;
      }
    }

    // 1. WORKER EXECUTION-ONLY PATH
    if (isWorker) {
      if (!isEdit) {
        toast.error(isAr ? "لا يمكن للمنفذين إنشاء مهام جديدة." : "Workers cannot create new tasks.");
        return;
      }
      if (!isAssignedToMe) {
        toast.error(isAr ? "يمكنك فقط تحديث المهام المعينة لك." : "You can only update tasks assigned to you.");
        return;
      }

      if (needsPostponeReason && !postponeReason.trim()) {
        toast.error(isAr ? "يرجى توضيح سبب تأجيل هذه المهمة ليبقى الفريق على اطلاع." : "Please explain why this task is postponed so the team stays aligned.");
        return;
      }
      if (needsBlockedReason && !blockedReason.trim()) {
        toast.error(isAr ? "يرجى توضيح ما يعطل تقدم هذه المهمة." : "Please explain what is blocking this task.");
        return;
      }

      setSaving(true);
      const isMarkedDone = status === "done" || status === "approved" || status === "delivered";
      const completedAt = isMarkedDone
        ? (task?.completed_at || new Date().toISOString())
        : null;

      // Sanitized Worker Payload — Strictly execution fields only
      const workerBody: any = {
        status,
        actual_minutes: actualMinutes ? parseInt(actualMinutes) : null,
        notes: notes.trim() || null,
        result_title: resultTitle.trim() || null,
        result_links: resultLinks,
        result_notes: resultNotes.trim() || null,
        waiting_on: status === "blocked" ? waitingOn : null,
        blocked_reason: status === "blocked" ? (blockedReason.trim() || null) : null,
        postpone_reason: status === "postponed" ? (postponeReason.trim() || null) : null,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      };

      const res = await (supabase as any).from("project_tasks").update(workerBody).eq("id", task!.id);
      if (res.error) {
        toast.error(res.error.message);
        setSaving(false);
        return;
      }

      await (supabase as any).from("project_activity").insert({
        project_id: projectId,
        task_id: task!.id,
        actor_id: user?.id ?? null,
        action: statusChanged ? "status_changed" : "progress_updated",
        details: {
          actor_role: "worker",
          actor_name: currentMember?.name || user?.email,
          from_status: task!.status,
          to_status: status,
          actual_minutes: actualMinutes ? parseInt(actualMinutes) : undefined,
          result_title: resultTitle.trim() || undefined,
        },
      });

      toast.success(isAr ? "تم تحديث تقدم المهمة بنجاح" : "Task progress updated");
      setSaving(false);
      onSaved();
      onClose();
      return;
    }

    // 2. ADMIN / SUPER ADMIN FULL TASK DEFINITION PATH
    if (!title.trim()) {
      setTitleError(true);
      toast.error(isAr ? "أضف عنواناً للمهمة ليعلم الفريق ما يجب إنجازه." : "Add a task title so the team knows what needs to be done.");
      return;
    }
    setTitleError(false);

    if (needsPostponeReason && !postponeReason.trim()) {
      toast.error(isAr ? "يرجى توضيح سبب تأجيل هذه المهمة ليبقى الفريق على اطلاع." : "Please explain why this task is postponed so the team stays aligned.");
      return;
    }
    if (needsBlockedReason && !blockedReason.trim()) {
      toast.error(isAr ? "يرجى توضيح ما يعطل تقدم هذه المهمة." : "Please explain what is blocking this task.");
      return;
    }

    setSaving(true);

    // Resolve profile_id for all FK assignment fields
    const finalAssigneeId = resolveToProfileId(assigneeId, teamMembers, profiles);
    let finalAssignedById = resolveToProfileId(assignedById, teamMembers, profiles);

    if (!finalAssignedById && user?.id) {
      const userIsInProfiles = profiles.some((p) => p.id === user.id);
      if (userIsInProfiles) {
        finalAssignedById = user.id;
      }
    }

    if (assigneeId && !finalAssigneeId) {
      toast.error(isAr ? "المسؤول المعين المحدد ليس لديه حساب مستخدم نشط." : "Selected assignee does not have a valid user profile account.");
      setSaving(false);
      return;
    }

    // Final FK safety guard: reject writes with IDs not in profiles
    if (finalAssignedById && profiles.length > 0 && !profiles.some((p) => p.id === finalAssignedById)) {
      console.error("[TaskModal FK GUARD] assigned_by_id NOT in profiles:", finalAssignedById);
      toast.error(isAr ? "تعذر التحقق من هوية الشخص 'المكلف بواسطة'. يرجى إعادة الاختيار أو مسح الحقل." : "The 'Assigned By' person could not be verified. Please re-select or clear the field.");
      setSaving(false);
      return;
    }
    if (finalAssigneeId && profiles.length > 0 && !profiles.some((p) => p.id === finalAssigneeId)) {
      console.error("[TaskModal FK GUARD] assignee_id NOT in profiles:", finalAssigneeId);
      toast.error(isAr ? "تعذر التحقق من هوية المسؤول المعين. يرجى إعادة الاختيار أو مسح الحقل." : "The assignee could not be verified. Please re-select or clear the field.");
      setSaving(false);
      return;
    }

    const isMarkedDone = status === "done" || status === "approved" || status === "delivered";
    const completedAt = isMarkedDone
      ? (task?.completed_at || new Date().toISOString())
      : null;

    const previousAssigneeId = assigneeChanged && task?.assignee_id
      ? (resolveToProfileId(task.assignee_id, teamMembers, profiles) || null)
      : (task?.previous_assignee_id || null);

    const body: any = {
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      assignee_id: finalAssigneeId || null,
      assigned_by_id: finalAssignedById || null,
      created_by: finalAssignedById || user?.id || null,
      category: category.trim() || null,
      service: service.trim() || null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      deadline: deadline || null,
      due_date: deadline || null,
      deadline_alert_enabled: deadlineAlertEnabled,
      deadline_alert_days: deadlineAlertDays,
      deadline_alert_message: deadlineAlertMessage.trim() || null,
      estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
      actual_minutes: actualMinutes ? parseInt(actualMinutes) : null,
      notes: notes.trim() || null,
      postpone_reason: status === "postponed" ? (postponeReason.trim() || null) : null,
      waiting_on: status === "blocked" ? waitingOn : null,
      blocked_reason: status === "blocked" ? (blockedReason.trim() || null) : null,
      previous_assignee_id: previousAssigneeId,
      handoff_reason: assigneeChanged ? (handoffReason.trim() || null) : (task?.handoff_reason || null),
      result_title: resultTitle.trim() || null,
      result_links: resultLinks,
      result_notes: resultNotes.trim() || null,
      completed_at: completedAt,
      completed_by: isMarkedDone ? (task?.completed_by || user?.id || null) : null,
      package_id: task?.package_id || null,
      deliverable_id: task?.deliverable_id || null,
      reviewer_id: task?.reviewer_id || null,
      estimated_hours: task?.estimated_hours || null,
      actual_hours: task?.actual_hours || null,
      revision_count: task?.revision_count ?? 0,
      attachments: task?.attachments || [],
    };

    let error: any;
    let newTaskId: string | null = null;

    if (isEdit) {
      const res = await (supabase as any).from("project_tasks").update(body).eq("id", task!.id);
      error = res.error;
      newTaskId = task!.id;
    } else {
      const res = await (supabase as any).from("project_tasks").insert(body).select("*").single();
      error = res.error;
      newTaskId = res.data?.id ?? null;

      // If a workflow template was selected, instantiate the ordered stages
      if (!error && res.data && activeWorkflowTemplate) {
        await instantiateWorkflowStages({
          parentTask: res.data,
          template: activeWorkflowTemplate,
          customStageAssignees: stageAssignees,
          teamMembers,
          profiles,
          currentUserId: user?.id,
        });
      }
    }

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Activity log
    if (isEdit && task) {
      if (statusChanged) {
        let action = "status_changed";
        if (status === "done") action = "completed";
        if (status === "postponed") action = "postponed";
        if (status === "blocked") action = "blocked";

        await (supabase as any).from("project_activity").insert({
          project_id: projectId,
          task_id: task.id,
          actor_id: user?.id ?? null,
          action,
          details: {
            actor_role: role,
            from: task.status,
            to: status,
            postpone_reason: status === "postponed" ? postponeReason : undefined,
            new_deadline: status === "postponed" ? deadline : undefined,
            waiting_on: status === "blocked" ? waitingOn : undefined,
            blocked_reason: status === "blocked" ? blockedReason : undefined,
          },
        });
      }

      if (assigneeChanged) {
        const prevInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
        const newInfo = getAssignmentMemberInfo(finalAssigneeId, teamMembers, profiles);
        const prevName = prevInfo?.displayName || "Unassigned";
        const newName = newInfo?.displayName || "Unassigned";
        await (supabase as any).from("project_activity").insert({
          project_id: projectId,
          task_id: task.id,
          actor_id: user?.id ?? null,
          action: "reassigned",
          details: {
            actor_role: role,
            from_assignee: prevName,
            to_assignee: newName,
            reason: handoffReason || "No reason specified",
          },
        });
      }
    } else {
      await (supabase as any).from("project_activity").insert({
        project_id: projectId,
        task_id: newTaskId,
        actor_id: user?.id ?? null,
        action: "created",
        details: { actor_role: role, title: title.trim(), category, priority },
      });
    }

    toast.success(isEdit ? (isAr ? "تم تحديث المهمة بنجاح" : "Task updated") : (isAr ? "تم إنشاء المهمة بنجاح" : "Task created"));
    setSaving(false);
    onSaved();
    onClose();
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const confirmDelete = async () => {
    if (!canDelete || !task || !onDelete) {
      toast.error(isAr ? "غير مصرح: يحق للمدير العام فقط حذف المهام نهائياً." : "Unauthorized: Only Super Admin can permanently delete tasks.");
      return;
    }
    setShowDeleteConfirm(false);
    onDelete(task.id);
    onClose();
  };

  const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1";
  const sectionHeaderCls = "font-display text-xs font-bold uppercase tracking-widest text-primary/90 flex items-center gap-1.5 pb-2 border-b border-border mb-3";

  const isAdvancedExpanded =
    showAdvanced ||
    status === "blocked" ||
    status === "postponed" ||
    assigneeChanged ||
    (resultLinks && resultLinks.length > 0);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] animate-[sada-overlay-in_120ms_ease-out]"
        onClick={onClose}
      >
        <form
          onSubmit={save}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-[sada-dialog-in_120ms_ease-out] overflow-hidden"
        >
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur z-20 px-5 md:px-6 py-3.5 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase">
                SADA Work OS
              </span>
              {task?.parent_task_id ? (
                <SADABadge variant="sky" size="xs">
                  <Layers className="size-2.5 mr-1 inline" />
                  {isAr ? "مهمة فرعية" : "SUBTASK"}
                </SADABadge>
              ) : (
                <SADABadge variant="purple" size="xs">
                  <Flag className="size-2.5 mr-1 inline" />
                  {isAr ? "مهمة رئيسية" : "MAIN TASK"}
                </SADABadge>
              )}
              {isWorker && isAssignedToMe && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  {isAr ? "معينة لك" : "Assigned To You"}
                </span>
              )}
              {isWorker && !isAssignedToMe && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                  {isAr ? "للقراءة فقط" : "Read Only"}
                </span>
              )}
              {!isWorker && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                  {isAr ? (isSuperAdmin ? "مدير عام" : "إدارة") : (isSuperAdmin ? "Super Admin" : "Admin")}
                </span>
              )}
              {category && (
                <span className="text-xs text-muted-foreground font-medium">
                  · {category}
                </span>
              )}
            </div>
            <h2 className="font-display text-lg md:text-xl font-bold text-foreground mt-0.5 flex items-center gap-2">
              {isWorker
                ? isAssignedToMe
                  ? (isAr ? "تحديث تقدم المهمة" : "Update Task Progress")
                  : (isAr ? "تفاصيل المهمة (للقراءة فقط)" : "Task Details (Read Only)")
                : isEdit
                ? (isAr ? "تعديل المهمة" : "Edit Task")
                : (isAr ? "مهمة جديدة" : "New Task")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
            className="size-8 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="space-y-6 px-5 md:px-6 py-5 overflow-y-auto flex-1">
          {/* CASE A: WORKER — UNASSIGNED TASK (READ ONLY) */}
          {isWorker && !isAssignedToMe ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2.5">
                <Lock className="size-4 shrink-0" />
                <span>{isAr ? "تم تعيين هذه المهمة لمختص آخر في الفريق. لديك صلاحية القراءة فقط." : "This task is assigned to another team specialist. You have read-only visibility."}</span>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">{isAr ? "عنوان المهمة" : "Task Title"}</span>
                  <h3 className="font-display text-xl font-bold text-foreground mt-0.5">{title}</h3>
                </div>
                {description && (
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">{isAr ? "الوصف" : "Description"}</span>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed bg-muted/20 p-3 rounded-xl">{description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">{isAr ? "الحالة" : "Status"}</span>
                    <div className="text-xs font-bold text-foreground mt-0.5">{STATUS_CONFIG[status]?.label || status}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">{isAr ? "الأولوية" : "Priority"}</span>
                    <div className="text-xs font-bold text-foreground mt-0.5">{PRIORITY_CONFIG[priority]?.label || priority}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">{isAr ? "الموعد النهائي" : "Deadline"}</span>
                    <div className="text-xs font-bold text-foreground mt-0.5">{deadline ? formatDate(new Date(deadline), "d MMM yyyy") : (isAr ? "لا يوجد" : "None")}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">{isAr ? "المعين" : "Assigned To"}</span>
                    <div className="text-xs font-bold text-foreground mt-0.5">{assigneeInfo?.displayName || (isAr ? "غير معين" : "Unassigned")}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : isWorker && isAssignedToMe ? (
            /* CASE B: WORKER — ASSIGNED TASK (READ-ONLY DEFINITION + EDITABLE EXECUTION) */
            <div className="space-y-6">
              {/* SECTION 1: READ-ONLY TASK CONTEXT */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/80 flex items-center gap-1">
                          <Lock className="size-3 text-muted-foreground" /> {isAr ? "سياق المهمة (للقراءة فقط)" : "Task Context (Read Only)"}
                        </span>
                        {category && (
                          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {category}
                          </span>
                        )}
                        {service && (
                          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {service}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg md:text-xl font-bold text-foreground">{title}</h3>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md shrink-0 ${PRIORITY_CONFIG[priority].bg} ${PRIORITY_CONFIG[priority].color} border border-border/60 flex items-center gap-1.5`}>
                      <span className={`size-1.5 rounded-full ${PRIORITY_CONFIG[priority].dot}`} />
                      {PRIORITY_CONFIG[priority].label} {isAr ? "أولوية" : "Priority"}
                    </span>
                  </div>

                  {description ? (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-card/60 p-3 rounded-xl border border-border/40">
                      {description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">{isAr ? "لم يتم تقديم وصف تفصيلي." : "No description provided."}</p>
                  )}

                  {/* Context Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/60">
                    <div className="p-2.5 rounded-xl bg-card border border-border/50 space-y-0.5">
                      <span className="block text-[10px] font-mono uppercase text-muted-foreground font-semibold">{isAr ? "المعين" : "Assigned To"}</span>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1">
                        <span className="truncate">{assigneeInfo?.displayName || (isAr ? "أنت" : "You")}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 shrink-0">{isAr ? "أنت" : "You"}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-card border border-border/50 space-y-0.5">
                      <span className="block text-[10px] font-mono uppercase text-muted-foreground font-semibold">{isAr ? "المكلف بواسطة" : "Assigned By"}</span>
                      <div className="text-xs font-bold text-foreground truncate">
                        {assignedByInfo?.displayName || (isAr ? "الإدارة" : "Admin")}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">
                          · {assignedByInfo?.role ? getRoleLabel(normalizeRole(assignedByInfo.role)) : (isAr ? "الإدارة" : "Admin")}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-card border border-border/50 space-y-0.5">
                      <span className="block text-[10px] font-mono uppercase text-muted-foreground font-semibold">{isAr ? "الموعد النهائي" : "Deadline"}</span>
                      <div className="text-xs font-bold text-foreground">
                        {deadline ? formatDate(new Date(deadline), "d MMM yyyy") : (isAr ? "لا يوجد" : "None")}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-card border border-border/50 space-y-0.5">
                      <span className="block text-[10px] font-mono uppercase text-muted-foreground font-semibold">{isAr ? "الجهد المقدر" : "Estimated Effort"}</span>
                      <div className="text-xs font-bold text-foreground">
                        {estimatedMinutes ? `${estimatedMinutes} ${isAr ? "دقيقة" : "min"}` : (isAr ? "غير محدد" : "Not specified")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: EDITABLE EXECUTION PROGRESS */}
              <div className="space-y-4 pt-1">
                <div className="border-t border-border pt-4">
                  <h3 className={sectionHeaderCls}>
                    <Sparkles className="size-3.5" /> {isAr ? "سير التنفيذ والتقدم" : "Your Progress & Execution"}
                  </h3>
                </div>

                {/* Status Picker */}
                <div className="space-y-1.5">
                  <StatusPicker value={status} onChange={setStatus} />
                </div>

                {/* Deliverables / Done looks like */}
                <div className="space-y-3 p-4 rounded-2xl border border-primary/20 bg-primary/5">
                  <div>
                    <h4 className="font-display text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-primary" /> {isAr ? "مواصفات التسليم / المخرجات المطلوبة" : "Done Looks Like / Deliverables"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isAr ? "أرفق روابط المخرجات، عناوين التسليمات، وإثبات اكتمال العمل." : "Attach output links, deliverable titles, and completion proof."}
                    </p>
                  </div>

                  <label className="block">
                    <span className={labelCls}>{isAr ? "عنوان النتيجة / المخرج" : "Result / Deliverable Title"}</span>
                    <input
                      value={resultTitle}
                      onChange={(e) => setResultTitle(e.target.value)}
                      placeholder={isAr ? "مثال: مونتاج ريلز كافيه 707 الإصدار الأول" : "e.g. Café 707 Reel v1, Figma Prototype"}
                      className={inputCls}
                    />
                  </label>

                  <div>
                    <span className={labelCls}>{isAr ? "روابط المخرجات (درايف، فيغما، وسائل التواصل...)" : "Deliverable Links (Drive, Figma, Socials…)"}</span>
                    {resultLinks.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {resultLinks.map((lnk, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 text-xs shadow-xs"
                          >
                            <ExternalLink className="size-3.5 text-primary shrink-0" />
                            <a
                              href={lnk}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-primary font-medium hover:underline flex-1"
                              dir="ltr"
                            >
                              {lnk}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeResultLink(idx)}
                              className="size-6 grid place-items-center text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        value={newLinkInput}
                        onChange={(e) => setNewLinkInput(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addResultLink();
                          }
                        }}
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={addResultLink}
                        className="px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold shrink-0 inline-flex items-center gap-1"
                      >
                        <Plus className="size-3.5" />
                        <span>{isAr ? "إضافة" : "Add"}</span>
                      </button>
                    </div>
                  </div>

                  <label className="block">
                    <span className={labelCls}>{isAr ? "ملاحظات وإثباتات التسليم" : "Deliverable Notes & Proof Details"}</span>
                    <textarea
                      value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                      placeholder={isAr ? "ما الذي تم إنجازه؟ أي ملاحظات للعميل أو روابط تسليم..." : "What was completed? Any client-facing notes or handover links..."}
                      rows={2}
                      className={inputCls}
                    />
                  </label>
                </div>

                {/* Effort & Time: Actual Time Spent */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border border-border bg-card">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {isAr ? "الوقت المقدر (محدد من الإدارة)" : "Estimated Time (Admin Set)"}
                    </span>
                    <div className="px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground font-semibold flex items-center justify-between">
                      <span>{estimatedMinutes ? `${estimatedMinutes} ${isAr ? "دقيقة" : "minutes"}` : (isAr ? "غير محدد" : "Not specified")}</span>
                      <Lock className="size-3 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className={labelCls}>{isAr ? "الوقت الفعلي المستغرق (بالدقائق)" : "Actual Time Spent (minutes)"}</span>
                    <SADACounter
                      value={Number(actualMinutes) || 0}
                      onChange={(val) => setActualMinutes(String(val))}
                      min={0}
                      step={15}
                      suffix={isAr ? "د" : "min"}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Internal Team Notes */}
                <div className="space-y-1.5">
                  <label className="block">
                    <span className={labelCls}>{isAr ? "ملاحظات الفريق وسجل التنفيذ الداخلي" : "Internal Team Notes & Execution Log"}</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={isAr ? "ملاحظات التنفيذ (مثال: 'بانتظار شعار العميل'، 'تم تصدير الفيديو'، إلخ.)" : "Execution notes (e.g. 'Waiting for client logo', 'Export completed', etc.)"}
                      rows={3}
                      className={inputCls}
                    />
                  </label>
                </div>

                {/* Blocker details if status is blocked */}
                {status === "blocked" && (
                  <div className="space-y-3 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5">
                    <span className="block text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="size-4" /> {isAr ? "بيانات التعطل والعائق *" : "Blocker Information *"}
                    </span>
                    <div className="space-y-1">
                      <span className={labelCls}>{isAr ? "بانتظار من؟" : "Who are we waiting on?"}</span>
                      <SADASelect
                        value={waitingOn}
                        onChange={(val) => setWaitingOn(val as any)}
                        options={[
                          { value: "client", label: isAr ? "العميل (مواد، ملاحظات، موافقة)" : "Client (Asset, feedback, approval)" },
                          { value: "team", label: isAr ? "الفريق الداخلي / زميل" : "Internal Team / Colleague" },
                        ]}
                      />
                    </div>
                    <label className="block">
                      <span className={labelCls}>{isAr ? "سبب التعطل *" : "Blocker Reason *"}</span>
                      <textarea
                        value={blockedReason}
                        onChange={(e) => setBlockedReason(e.target.value)}
                        placeholder={isAr ? "اشرح ما الذي يعطل هذه المهمة حتى تتمكن الإدارة من معالجته..." : "Explain what is blocking this task so leadership can unblock it..."}
                        rows={2}
                        className={inputCls}
                        required
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CASE C: ADMIN / SUPER ADMIN — 7 WELL-ORGANIZED SECTIONS */
            <div className="space-y-6">
              {/* ============================================================ */}
              {/* SECTION 1: WHAT IS IT? */}
              {/* ============================================================ */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-card/60">
                <h3 className={sectionHeaderCls}>
                  <Sparkles className="size-3.5 text-primary" />
                  {isAr ? "1. ما الذي نريد تنفيذه؟" : "1. What is it?"}
                </h3>
                <div className="space-y-3">
                  <SADAInput
                    label={isAr ? "عنوان المهمة *" : "Task Title *"}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (titleError) setTitleError(false);
                    }}
                    placeholder={isAr ? "مثال: مونتاج فيديو ريلز كافيه 707 رقم #03" : "e.g. Edit Caffè 707 Reel #03"}
                    error={titleError ? (isAr ? "أضف عنواناً للمهمة ليعلم الفريق ما يجب إنجازه." : "Add a task title so the team knows what needs to be done.") : undefined}
                    helperText={!titleError ? (isAr ? "اجعل العنوان واضحاً وقابلاً للتنفيذ المباشر." : "Keep it clear and actionable for the team.") : undefined}
                    autoFocus
                  />

                  <div className="space-y-1">
                    <span className={labelCls}>
                      {isAr ? "الوصف والتفاصيل التشغيلية" : "Description & Operational Brief"}
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={isAr ? "ما الذي يجب أن يعرفه المنفذ قبل البدء؟ (تفاصيل تشغيلية، روابط مراجع، توقعات...)" : "What should the person know before starting? (Operational details, reference links, expectations…)"}
                      rows={3}
                      className="w-full bg-muted/20 hover:bg-muted/40 focus:bg-background border border-border/80 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 2: WHO OWNS IT? */}
              {/* ============================================================ */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-card/60">
                <h3 className={sectionHeaderCls}>
                  <User className="size-3.5 text-primary" />
                  {isAr ? "2. من المسؤول عن التنفيذ؟" : "2. Who owns it?"}
                </h3>

                {/* Subtask Parent Banner (if editing a subtask) */}
                {task?.parent_task_id && (
                  <div className="p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                          {isAr ? "مهمة فرعية تابعة للمهمة الرئيسية:" : "Subtask of Main Task:"}
                        </span>
                      </div>
                      <SADABadge variant="sky" size="xs">
                        {isAr ? "تعيين مستقل" : "Independent Assignment"}
                      </SADABadge>
                    </div>
                    <div className="text-xs font-bold text-foreground">
                      {parentTask?.title || (isAr ? "المهمة الرئيسية" : "Parent Task")}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5 border-t border-sky-500/20">
                      <span>{isAr ? "المسؤول عن المهمة الرئيسية:" : "Main Task Assignee:"}</span>
                      <span className="font-semibold text-foreground">
                        {parentAssigneeInfo?.displayName || (isAr ? "غير معين" : "Unassigned")}
                      </span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-[10px] text-muted-foreground italic">
                        {isAr
                          ? "إعادة تعيين هذه المهمة الفرعية تؤثر عليها فقط ولا تغير المسؤول عن المهمة الرئيسية."
                          : "Reassigning this subtask affects only this subtask; the main task owner remains unchanged."}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MemberPicker
                    value={assigneeId}
                    onChange={handleAssigneeChange}
                    profiles={profiles}
                    teamMembers={teamMembers}
                    label={isAr ? "المسؤول عن التنفيذ (المكلف)" : "Assigned To (Execution Owner)"}
                    placeholder={isAr ? "تعيين عضو من الفريق" : "Assign a team member"}
                    unassignedLabel={isAr ? "غير معين" : "Unassigned"}
                  />
                  <MemberPicker
                    value={assignedById}
                    onChange={setAssignedById}
                    profiles={profiles}
                    teamMembers={teamMembers}
                    label={isAr ? "المكلف بواسطة" : "Assigned By (Delegated By)"}
                    placeholder={isAr ? "اختر المكلف" : "Select assigner"}
                    unassignedLabel={isAr ? "المكلف بواسطة — غير مسجل" : "Assigned by — Not recorded"}
                  />
                </div>

                {/* Handoff Reason when assignee changes */}
                {assigneeChanged && (
                  <div className="space-y-1.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 animate-in fade-in">
                    <span className={labelCls}>
                      {isAr ? "سبب إعادة التعيين (يسجل في سجل النشاط)" : "Handoff Reason (Logged to Activity)"}
                    </span>
                    <input
                      value={handoffReason}
                      onChange={(e) => setHandoffReason(e.target.value)}
                      placeholder={isAr ? "مثال: تم التحويل إلى زميل آخر بسبب ضغط العمل" : "e.g. Reassigned due to workload or stage specialization"}
                      className={inputCls}
                    />
                  </div>
                )}

                {/* Previous Assignee History */}
                {task?.previous_assignee_id && !assigneeChanged && (
                  <div className="p-2.5 rounded-xl border border-border/80 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <ArrowRightLeft className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {isAr ? "كانت معينة سابقاً إلى: " : "Previously assigned to: "}
                        <strong className="text-foreground">
                          {profiles.find((p) => p.id === task?.previous_assignee_id)?.display_name || (isAr ? "غير معروف" : "Unknown")}
                        </strong>
                      </span>
                    </div>
                    {task.handoff_reason && (
                      <span className="text-[10px] italic truncate max-w-[180px]">
                        "{task.handoff_reason}"
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ============================================================ */}
              {/* SECTION 3: WHEN IS IT DUE? */}
              {/* ============================================================ */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-card/60">
                <h3 className={sectionHeaderCls}>
                  <Calendar className="size-3.5 text-primary" />
                  {isAr ? "3. موعد الاستحقاق والتسليم" : "3. When is it due?"}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={labelCls}>{isAr ? "الموعد النهائي *" : "Deadline *"}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuickDeadline(0)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {isAr ? "اليوم" : "Today"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDeadline(1)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {isAr ? "غداً" : "Tomorrow"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDeadline(3)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {isAr ? "+3 أيام" : "+3d"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDeadline(7)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {isAr ? "+أسبوع" : "+1w"}
                      </button>
                    </div>
                  </div>
                  <SADADatePicker
                    value={deadline}
                    onChange={(val) => setDeadline(val)}
                    placeholder={isAr ? "اختر الموعد النهائي..." : "Pick deadline..."}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className={labelCls}>{isAr ? "تاريخ ووقت البدء" : "Start Date & Time"}</span>
                    <SADADateDateTimePicker
                      value={startDate}
                      onChange={(val) => setStartDate(val)}
                      placeholder={isAr ? "تاريخ ووقت البدء..." : "Start date & time..."}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelCls}>{isAr ? "الوقت المستهدف للتسليم" : "Target Delivery Time"}</span>
                    <SADADateDateTimePicker
                      value={endDate}
                      onChange={(val) => setEndDate(val)}
                      placeholder={isAr ? "الوقت المستهدف للتسليم..." : "Target delivery time..."}
                    />
                  </div>
                </div>

                {/* Deadline Alert Engine Configuration */}
                <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-foreground">{isAr ? "إعداد تنبيه اقتراب الموعد النهائي" : "Deadline Alert Configuration"}</span>
                    </div>
                    <SADASwitch
                      checked={deadlineAlertEnabled}
                      onCheckedChange={setDeadlineAlertEnabled}
                      label={isAr ? "تفعيل التنبيه" : "Enable Alert"}
                      size="sm"
                    />
                  </div>

                  {deadlineAlertEnabled && (
                    <div className="space-y-2.5 pt-1 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="block text-[10px] font-mono uppercase text-muted-foreground font-bold">
                            {isAr ? "توقيت التنبيه" : "Alert Timing"}
                          </span>
                          <SADASelect
                            value={String(deadlineAlertDays)}
                            onChange={(val) => setDeadlineAlertDays(parseInt(val, 10))}
                            options={[
                              { value: "7", label: isAr ? "قبل 7 أيام من الموعد النهائي" : "7 days before deadline" },
                              { value: "5", label: isAr ? "قبل 5 أيام من الموعد النهائي" : "5 days before deadline" },
                              { value: "3", label: isAr ? "قبل 3 أيام من الموعد النهائي (افتراضي)" : "3 days before deadline (Default)" },
                              { value: "2", label: isAr ? "قبل يومين من الموعد النهائي" : "2 days before deadline" },
                              { value: "1", label: isAr ? "قبل يوم واحد من الموعد النهائي (غداً)" : "1 day before deadline (Tomorrow)" },
                              { value: "0", label: isAr ? "في يوم الموعد النهائي نفسه" : "On deadline day" },
                            ]}
                          />
                        </div>

                        <div>
                          <span className="block text-[10px] font-mono uppercase text-muted-foreground mb-1 font-bold">
                            {isAr ? "رسالة تنبيه مخصصة (اختياري)" : "Custom Alert Message (Optional)"}
                          </span>
                          <input
                            type="text"
                            placeholder={isAr ? "مثال: لم يعد هناك وقت — متبقي 3 أيام" : "e.g. Ma3adch wa9t — 3 days remaining"}
                            value={deadlineAlertMessage}
                            onChange={(e) => setDeadlineAlertMessage(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 4: EXECUTION & PRIORITY */}
              {/* ============================================================ */}
              <div className="space-y-4 p-4 rounded-2xl border border-border bg-card/60">
                <h3 className={sectionHeaderCls}>
                  <Flag className="size-3.5 text-primary" />
                  {isAr ? "4. التنفيذ والأولوية" : "4. Execution & Priority"}
                </h3>

                <PrioritySegmented value={priority} onChange={setPriority} />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatusPicker value={status} onChange={setStatus} />
                  <ComboboxPicker
                    value={category}
                    onChange={setCategory}
                    options={TYPICAL_PHASES}
                    label={isAr ? "المرحلة / القسم" : "Phase / Category"}
                    placeholder={isAr ? "اختر المرحلة" : "Select Phase"}
                  />
                  <ComboboxPicker
                    value={service}
                    onChange={setService}
                    options={projectServices}
                    label={isAr ? "خدمة التسليم" : "Service Deliverable"}
                    placeholder={isAr ? "اختر الخدمة" : "Select Service"}
                  />
                </div>

                {/* Conditional Blocker / Postpone Details */}
                {(status === "blocked" || status === "postponed") && (
                  <div className="space-y-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 animate-in fade-in">
                    <h4 className="font-display font-bold text-xs uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pb-1 border-b border-rose-500/20">
                      <AlertCircle className="size-3.5" />
                      {isAr ? "سبب التعطل أو التأجيل" : "Blocker / Postpone Details"}
                    </h4>
                    {status === "blocked" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className={labelCls}>{isAr ? "بانتظار" : "Waiting On"}</span>
                          <div className="grid grid-cols-2 gap-1 p-1 bg-background border border-border rounded-xl">
                            <button
                              type="button"
                              onClick={() => setWaitingOn("client")}
                              className={`py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                                waitingOn === "client"
                                  ? "bg-rose-500/10 text-rose-600 border border-rose-500/30 shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {isAr ? "العميل" : "Client"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setWaitingOn("team")}
                              className={`py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                                waitingOn === "team"
                                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/30 shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {isAr ? "الفريق" : "Team"}
                            </button>
                          </div>
                        </div>
                        <label className="block">
                          <span className={labelCls}>{isAr ? "سبب التعطل *" : "Blocked Reason *"}</span>
                          <input
                            value={blockedReason}
                            onChange={(e) => setBlockedReason(e.target.value)}
                            placeholder={isAr ? "مثال: بانتظار اعتماد النصوص" : "e.g. Waiting for approved copy"}
                            className={inputCls}
                            required
                          />
                        </label>
                      </div>
                    )}
                    {status === "postponed" && (
                      <label className="block">
                        <span className={labelCls}>{isAr ? "سبب تأجيل المهمة *" : "Reason for Postponement *"}</span>
                        <textarea
                          value={postponeReason}
                          onChange={(e) => setPostponeReason(e.target.value)}
                          placeholder={isAr ? "مثال: تم تأجيل موعد مراجعة العميل" : "e.g. Client review rescheduled"}
                          rows={2}
                          className={inputCls}
                          required
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Deliverables / Done Looks Like */}
                <div className="space-y-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                  <div>
                    <h4 className="font-display text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-primary" />
                      {isAr ? "معايير اكتمال التسليم (Done Looks Like)" : "Done Looks Like / Deliverables"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isAr ? "ما المخرجات التي يجب أن تتوفر عند اكتمال المهمة؟" : "What should exist when this task is complete?"}
                    </p>
                  </div>

                  <label className="block">
                    <span className={labelCls}>{isAr ? "عنوان النتيجة / المخرج" : "Result / Deliverable Title"}</span>
                    <input
                      value={resultTitle}
                      onChange={(e) => setResultTitle(e.target.value)}
                      placeholder={isAr ? "مثال: الفيديو النهائي #03، نموذج فيغما" : "e.g. Final Reel #03, Figma Prototype"}
                      className={inputCls}
                    />
                  </label>

                  <div>
                    <span className={labelCls}>{isAr ? "روابط المخرجات (درايف، فيغما، وسائل التواصل...)" : "Deliverable Links (Drive, Figma, Socials…)"}</span>
                    {resultLinks.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {resultLinks.map((lnk, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 text-xs shadow-xs"
                          >
                            <ExternalLink className="size-3.5 text-primary shrink-0" />
                            <a
                              href={lnk}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-primary font-medium hover:underline flex-1"
                              dir="ltr"
                            >
                              {lnk}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeResultLink(idx)}
                              className="size-6 grid place-items-center text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        value={newLinkInput}
                        onChange={(e) => setNewLinkInput(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addResultLink();
                          }
                        }}
                        className={inputCls}
                      />
                      <SADAButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addResultLink}
                        leftIcon={<Plus className="size-3.5" />}
                      >
                        {isAr ? "إضافة" : "Add"}
                      </SADAButton>
                    </div>
                  </div>

                  <label className="block">
                    <span className={labelCls}>{isAr ? "ملاحظات التسليم" : "Deliverable Notes"}</span>
                    <textarea
                      value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                      placeholder={isAr ? "أين يمكن للعميل أو الفريق العثور على المخرجات؟ أي روابط مراجعة أو ملاحظات..." : "Where can the client or team find the deliverables? Any review links or notes..."}
                      rows={2}
                      className={inputCls}
                    />
                  </label>
                </div>

                {/* Effort & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className={labelCls}>{isAr ? "الوقت المقدر (بالدقائق)" : "Estimated Time (minutes)"}</span>
                    <SADACounter
                      value={Number(estimatedMinutes) || 0}
                      onChange={(val) => setEstimatedMinutes(String(val))}
                      min={0}
                      step={15}
                      suffix={isAr ? "د" : "min"}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelCls}>{isAr ? "الوقت الفعلي المستغرق (بالدقائق)" : "Actual Time Spent (minutes)"}</span>
                    <SADACounter
                      value={Number(actualMinutes) || 0}
                      onChange={(val) => setActualMinutes(String(val))}
                      min={0}
                      step={15}
                      suffix={isAr ? "د" : "min"}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="space-y-1 pt-1">
                  <label className="block">
                    <span className={labelCls}>{isAr ? "ملاحظات داخلية (للفريق فقط)" : "Internal Notes (Team Only)"}</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={isAr ? "ملاحظات خاصة لأعضاء الفريق..." : "Private notes for team members..."}
                      rows={2}
                      className={inputCls}
                    />
                  </label>
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 5: WORKFLOW */}
              {/* ============================================================ */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-card/60">
                <div className="flex items-center justify-between">
                  <h3 className={sectionHeaderCls.replace("mb-3", "mb-0")}>
                    <Workflow className="size-3.5 text-primary" />
                    {isAr ? "5. مسار العمل والمراحل" : "5. Workflow"}
                  </h3>
                  {activeWorkflowTemplate && (
                    <SADABadge variant="primary" size="xs">
                      {isAr ? `${activeWorkflowTemplate.stages.length} مراحل مرتبة` : `${activeWorkflowTemplate.stages.length} Ordered Stages`}
                    </SADABadge>
                  )}
                </div>

                {!isEdit ? (
                  /* Create Mode: Select Template and Configure Stages */
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                        {isAr ? "اختر مسار العمل (أو مهمة مفردة)" : "Select Workflow Engine Template"}
                      </label>
                      <SADASelect
                        value={selectedTemplateId}
                        onChange={handleSelectWorkflowTemplate}
                        options={[
                          { value: "none", label: isAr ? "مهمة مفردة (بدون مسار تلقائي)" : "Single Task (No Workflow Template)" },
                          ...workflowTemplates.map((t) => ({
                            value: t.id,
                            label: isAr && t.name_ar ? `${t.name_ar} (${t.stages.length} مراحل)` : `${t.name} (${t.stages.length} Stages)`,
                          })),
                        ]}
                      />
                    </div>

                    {activeWorkflowTemplate && (
                      <div className="space-y-2 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-semibold">
                            {isAr ? "المراحل التي سيتم توليدها تلقائياً مع هذه المهمة:" : "Stages that will be auto-generated under this parent task:"}
                          </span>
                          <span className="text-[10px] text-primary italic">
                            {isAr ? "ترث المنفذ الافتراضي مع إمكانية التخصيص" : "Inherits Main Assignee by default with override"}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {activeWorkflowTemplate.stages.map((stg: WorkflowStageDefinition) => (
                            <div
                              key={stg.id}
                              className="p-2.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="size-5 rounded-full bg-primary/10 text-primary font-bold font-mono text-[10px] grid place-items-center shrink-0">
                                  {stg.order}
                                </span>
                                <span className="font-bold truncate text-foreground">
                                  {isAr && stg.title_ar ? stg.title_ar : stg.title}
                                </span>
                                {stg.requires_previous_stage ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 font-mono font-semibold shrink-0">
                                    🔒 {isAr ? `تتطلب ${stg.order - 1}` : `Requires ${stg.order - 1}`}
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono font-semibold shrink-0">
                                    {isAr ? "مباشرة" : "Starts First"}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                  ⏱ {stg.duration_days}d
                                </span>
                              </div>

                              <div className="w-full sm:w-48 shrink-0">
                                <SADASelect
                                  value={stageAssignees[stg.id] || "unassigned"}
                                  onChange={(val) => setStageAssignees((prev) => ({ ...prev, [stg.id]: val === "unassigned" ? "" : val }))}
                                  options={[
                                    { value: "unassigned", label: isAr ? "غير معين" : "Unassigned" },
                                    ...teamMembers.map((m) => ({
                                      value: m.profile_id || m.id,
                                      label: `${m.name} (${m.position || m.division || "Member"})`,
                                    })),
                                  ]}
                                  placeholder={isAr ? "اختر المنفذ..." : "Assign Worker..."}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Edit Mode: Workflow Status Overview */
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {task?.parent_task_id
                          ? (isAr ? "مرحلة تابعة لمسار عمل" : "Workflow Stage / Execution Unit")
                          : (isAr ? "مهمة تشغيلية مباشرة" : "Direct Operational Deliverable")}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {task?.parent_task_id
                        ? (isAr ? "هذه المهمة تمثل مرحلة مخصصة ضمن مسار العمل، وترتبط بالمهمة الرئيسية مع الحفاظ على استقلالية التعيين والتنفيذ." : "This task represents a dedicated workflow stage under a parent task with independent assignment and progress tracking.")
                        : (isAr ? "يمكنك إدارة المهام الفرعية المستقلة عبر قسم العلاقات أدناه أو في نافذة استعراض المهمة." : "You can manage independent subtasks in the Relationship section below or from the Task Preview detail view.")}
                    </p>
                  </div>
                )}
              </div>

              {/* ============================================================ */}
              {/* SECTION 6: RELATIONSHIP & SUBTASKS */}
              {/* ============================================================ */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-card/60">
                <div className="flex items-center justify-between">
                  <h3 className={sectionHeaderCls.replace("mb-3", "mb-0")}>
                    <Layers className="size-3.5 text-primary" />
                    {isAr ? "6. العلاقات والمهام الفرعية" : "6. Relationship & Subtasks"}
                  </h3>
                  {subtasks.length > 0 && (
                    <SADABadge variant="neutral" size="xs">
                      {isAr ? `${subtasks.length} مهام فرعية` : `${subtasks.length} Subtasks`}
                    </SADABadge>
                  )}
                </div>

                {task?.parent_task_id ? (
                  /* Case A: This task is a Subtask */
                  <div className="space-y-2.5 pt-2">
                    <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Layers className="size-3.5 text-sky-600" />
                          {isAr ? "المهمة الرئيسية التابعة لها:" : "Parent Task Deliverable:"}
                        </span>
                        <SADABadge variant="sky" size="xs">
                          {isAr ? "مهمة فرعية مستقلة" : "Independent Subtask"}
                        </SADABadge>
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {parentTask?.title || (isAr ? "مهمة رئيسية" : "Parent Task")}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1 border-t border-sky-500/10">
                        <span>{isAr ? "المسؤول عن المهمة الرئيسية:" : "Parent Assignee:"}</span>
                        <strong className="text-foreground">
                          {parentAssigneeInfo?.displayName || (isAr ? "غير معين" : "Unassigned")}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                      {isAr
                        ? "تحتفظ هذه المهمة الفرعية بمسؤولها وموعدها وحالتها بشكل مستقل تماماً عن المهمة الرئيسية."
                        : "This subtask maintains its own assignee, deadline, and status completely independently from the main task."}
                    </p>
                  </div>
                ) : isEdit ? (
                  /* Case B: Main Task with Existing Subtasks */
                  <div className="space-y-3 pt-2">
                    {subtasks.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">
                          {isAr
                            ? "المهام الفرعية المرتبطة بهذه المهمة. لكل مهمة منفذها المستقل:"
                            : "Subtasks attached to this deliverable. Each has its own independent assignee:"}
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {subtasks.map((st) => {
                            const stAssignee = getAssignmentMemberInfo(st.assignee_id, teamMembers, profiles);
                            const stCfg = STATUS_CONFIG[st.status as TaskStatus] || STATUS_CONFIG.todo;
                            return (
                              <div
                                key={st.id}
                                className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="size-2 rounded-full bg-primary shrink-0" />
                                  <span className="font-semibold text-foreground truncate">{st.title}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stCfg.bg} ${stCfg.color}`}>
                                    {stCfg.label}
                                  </span>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Avatar className="size-5 border border-primary/20">
                                      <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                                        {getInitials(stAssignee?.displayName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-foreground truncate max-w-[90px]">
                                      {stAssignee?.displayName || (isAr ? "غير معين" : "Unassigned")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          {isAr
                            ? "قاعدة التعيين: إعادة تعيين هذه المهمة الرئيسية لا تغير المنفذين الحاليين للمهام الفرعية أعلاه."
                            : "Assignment Invariant: Reassigning this main task does not overwrite existing subtask assignees."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">
                          {isAr ? "لا توجد مهام فرعية مسجلة حالياً." : "No subtasks registered yet."}
                        </p>
                        <p className="text-[11px]">
                          {isAr
                            ? "يمكنك إضافة مهام فرعية لاحقاً من نافذة استعراض المهمة. سترث تلقائياً المكلف بهذه المهمة كنقطة بداية، مع إمكانية إعادة تعيينها بشكل مستقل."
                            : "You can add subtasks from the Task Preview. They will inherit this task's assignee by default, and can then be reassigned independently."}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Case C: New Task Mode */
                  <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1 pt-2">
                    <div className="flex items-center gap-1.5 font-bold text-primary">
                      <ShieldCheck className="size-4" />
                      <span>{isAr ? "وراثة التعيين الافتراضي للمهام الفرعية" : "Default Subtask Assignee Inheritance"}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {isAr
                        ? "أي مهمة فرعية جديدة تضاف لاحقاً لهذه المهمة سترث المنفذ المعين في (القسم 2) افتراضياً. بعد الإنشاء، يمكن إعادة تعيين كل مهمة فرعية لمنفذ مختلف بشكل مستقل تماماً."
                        : "Any new subtasks added to this task will initially default to the execution owner selected in Section 2. Once created, each subtask can be independently reassigned without affecting the main deliverable."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Modal Footer (SECTION 7: SAVE & ACTIONS) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sticky bottom-0 bg-card/95 backdrop-blur z-20 px-4 sm:px-6 py-3 border-t border-border shrink-0">
          <div>
            {isEdit && onDelete && canDelete ? (
              <SADAButton
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto"
              >
                {isAr ? "حذف المهمة" : "Delete Task"}
              </SADAButton>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 sm:flex-initial"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="submit"
              variant="primary"
              size="sm"
              isLoading={saving}
              className="flex-1 sm:flex-initial"
            >
              {saving
                ? (isAr ? "جاري الحفظ..." : "Saving…")
                : isEdit
                ? (isAr ? "حفظ التغييرات" : "Save Changes")
                : (isAr ? "إنشاء المهمة" : "Create Task")}
            </SADAButton>
          </div>
        </div>
      </form>
    </div>

      <SADAConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={isAr ? "حذف المهمة نهائياً؟" : "Permanently Delete Task?"}
        description={isAr ? "هل أنت متأكد من رغبتك في حذف هذه المهمة نهائياً؟ هذا الإجراء مصرح به للمدير العام فقط ولا يمكن التراجع عنه." : "Are you sure you want to permanently delete this task? This action is only authorized for Super Admins and cannot be undone."}
        confirmLabel={isAr ? "حذف المهمة" : "Delete Task"}
        cancelLabel={isAr ? "إلغاء" : "Cancel"}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}
