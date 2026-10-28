import { useState, useEffect, useMemo, useCallback } from "react";
import {
  X, Pencil, CheckCircle2, AlertTriangle, ExternalLink, ArrowRightLeft,
  Calendar, User, Users, Clock, AlertCircle, Sparkles, MessageSquare, Lock, Trash2, ShieldAlert,
  Check, Plus, CheckCheck, XCircle, Send, Loader2, Play, Pause, Ban, CalendarClock,
  RotateCcw, ThumbsUp, HelpCircle, FileText, Paperclip, ChevronDown, ChevronUp, Workflow,
  Film, Share2, Globe, Copy
} from "lucide-react";
import { format, parseISO, isPast, isToday, isTomorrow, addDays } from "date-fns";
import { formatDate } from "@/lib/date-locale";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SADACombobox, type SADAComboboxOption } from "@/components/ui/sada-combobox";
import { SADAConfirmDialog } from "@/components/ui/sada-confirm-dialog";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADASelect } from "@/components/ui/sada-select";
import { SADAButton } from "@/components/ui/sada-button";
import { SADAInput, SADATextarea } from "@/components/ui/sada-input";
import { SADACheckbox } from "@/components/ui/sada-checkbox";
import { SADABadge } from "@/components/ui/sada-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  permissions,
  isTaskAssignedToUser,
  hasParentTaskAuthority,
  canCreateSubtaskForTask,
  can,
  getRoleLabel,
  normalizeRole,
  type PermissionContext,
} from "@/lib/permissions";
import type { TaskRow, ProfileRow, ProjectRow, TeamMemberRow, TaskHandoffRow } from "./project-utils";
import {
  STATUS_CONFIG, PRIORITY_CONFIG, deadlineLabel, isTaskOverdue, getAssignmentMemberInfo,
  getTaskAlertBadge, computeTaskVisualState, resolveToProfileId
} from "./project-utils";
import {
  checkStageActionability,
  computeWorkflowProgress,
} from "@/lib/workflow-service";
import {
  startTask,
  pauseTask,
  submitTaskForReview,
  requestTaskChanges,
  approveAndCompleteTask,
  completeTask,
  postponeTask,
  markTaskBlocked,
  resolveTaskBlocker,
  addTaskNote,
  fetchTaskActivity,
  updateSubtaskAssignee,
  createProjectSubtask,
  BLOCKER_CATEGORY_LABELS,
  type BlockerCategory,
  type TaskActivityEntry,
} from "@/lib/task-execution-service";
import { CompleteEditingModal } from "@/components/admin/tasks/CompleteEditingModal";
import { PublishContentModal } from "@/components/admin/tasks/PublishContentModal";
import { SendTaskAlertModal } from "@/components/admin/tasks/SendTaskAlertModal";
import { SubtaskAssigneePopover } from "./TeamMemberPicker";
import {
  fetchPublishingAuditTrail,
  type PublishingAuditTrail,
} from "@/lib/publishing-workflow-service";

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function cleanUserFacingNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  // Strip internal workflow stage metadata prefix without mutating canonical DB value
  const stripped = notes.replace(/^\[WORKFLOW_STAGE:[^\]]+\]\s*/i, "").trim();
  return stripped || null;
}

interface Props {
  task: TaskRow;
  project?: ProjectRow | null;
  profiles: ProfileRow[];
  teamMembers?: TeamMemberRow[];
  onEdit: (task: TaskRow) => void;
  onStatusChange: (taskId: string, status: TaskRow["status"]) => void;
  onClose: () => void;
  onDelete?: (taskId: string) => void;
}

export function TaskDetailModal({
  task: initialTask,
  project,
  profiles,
  teamMembers = [],
  onEdit,
  onStatusChange,
  onClose,
  onDelete,
}: Props) {
  const { user, role, isSuperAdmin, isAdmin, isWorker } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const [task, setTask] = useState<TaskRow>(initialTask);

  useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

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
  const canUpdateProg = permissions.canUpdateTaskProgress(permCtx, task);
  const canEditDef = permissions.canEditTaskDefinition(permCtx);
  const canDelete = permissions.canDeleteTask(permCtx);
  const hasAuthorityOverTask = hasParentTaskAuthority(task, permCtx);
  const hasGlobalSubtaskPermission = can(permCtx, "tasks.create_subtask");
  const canCreateSubtask = canCreateSubtaskForTask(permCtx, task);
  const canAssign = can(permCtx, "tasks.assign");
  const canChangePriority = can(permCtx, "tasks.change_priority");
  const canChangeDueDate = can(permCtx, "tasks.change_due_date");
  const canChangeStatus = permissions.canChangeStatus(permCtx, task);
  const canComplete = permissions.canCompleteTask(permCtx, task);
  const canAddDeliverable = permissions.canAddDeliverable(permCtx, task);
  const isManagerOrReviewer = isAdmin || isSuperAdmin || (task.reviewer_id && currentMember?.id === task.reviewer_id);
  const canSendAlert = isAdmin || isSuperAdmin || isAssignedToMe || (task.reviewer_id && currentMember?.id === task.reviewer_id);

  const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const overdue = isTaskOverdue(task);
  const dl = deadlineLabel(task.deadline);
  const alertBadge = getTaskAlertBadge(task);

  const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
  const assignedByInfo = getAssignmentMemberInfo(task.assigned_by_id || (task as any).created_by, teamMembers, profiles);
  const reviewerInfo = getAssignmentMemberInfo(task.reviewer_id, teamMembers, profiles);
  const completedByInfo = (task as any).completed_by ? getAssignmentMemberInfo((task as any).completed_by, teamMembers, profiles) : null;

  // Subtasks State
  const [subtasks, setSubtasks] = useState<TaskRow[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [reassigningSubtaskId, setReassigningSubtaskId] = useState<string | null>(null);

  // Parent Task State (When inspecting a Subtask)
  const [parentTask, setParentTask] = useState<TaskRow | null>(null);

  useEffect(() => {
    if (task.parent_task_id) {
      (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("id", task.parent_task_id)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) setParentTask(data);
        });
    } else {
      setParentTask(null);
    }
  }, [task.parent_task_id]);

  const parentAssigneeInfo = useMemo(() => {
    if (!parentTask?.assignee_id) return null;
    return getAssignmentMemberInfo(parentTask.assignee_id, teamMembers, profiles);
  }, [parentTask?.assignee_id, teamMembers, profiles]);

  // Collapsible accordion state for high mobile information density & scannability
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [subtasksAccordionOpen, setSubtasksAccordionOpen] = useState(false);
  const [activityAccordionOpen, setActivityAccordionOpen] = useState(false);

  const leadInfo = parentAssigneeInfo || assignedByInfo || reviewerInfo || assigneeInfo;

  // Assignment Authorization & Handler
  const canAssignTask = canAssign;

  const handleSubtaskAssigneeChange = async (subtaskId: string, newAssigneeId: string | null) => {
    if (!canAssignTask) {
      toast.error(isAr ? "غير مصرح: يحتاج تعيين المهام إلى صلاحية 'tasks.assign'." : "Unauthorized: Assigning tasks requires 'tasks.assign' permission.");
      return;
    }

    setReassigningSubtaskId(subtaskId);
    const resolvedProfile = newAssigneeId ? resolveToProfileId(newAssigneeId, teamMembers, profiles) || newAssigneeId : null;

    // Optimistic UI update
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, assignee_id: resolvedProfile } : s));

    const res = await updateSubtaskAssignee({
      taskId: subtaskId,
      newAssigneeId,
      actorCtx: permCtx,
      actorId: user?.id,
      teamMembers,
      profiles,
    });

    setReassigningSubtaskId(null);

    if (res.success) {
      toast.success(isAr ? "تم تحديث المنفذ المكلف بالمرحلة بنجاح!" : "Subtask assignee updated successfully!");
      loadActivity();
    } else {
      loadSubtasks();
      toast.error(res.error || (isAr ? "فشل إعادة تعيين المنفذ" : "Failed to reassign subtask"));
    }
  };

  // Subtask Creation Assignee Inheritance:
  // Defaults to Main Task assignee if assigned, or "" (Unassigned) if main task has no assignee.
  const defaultSubtaskAssignee = useMemo(() => {
    return resolveToProfileId(task.assignee_id, teamMembers, profiles) || "";
  }, [task.assignee_id, teamMembers, profiles]);

  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState<string>(defaultSubtaskAssignee);

  useEffect(() => {
    setNewSubtaskAssigneeId(defaultSubtaskAssignee);
  }, [defaultSubtaskAssignee]);

  const memberComboboxOptions = useMemo<SADAComboboxOption[]>(() => {
    const list: SADAComboboxOption[] = [];
    const covered = new Set<string>();

    for (const tm of teamMembers) {
      const pid = tm.profile_id || tm.id;
      list.push({
        value: pid,
        label: tm.display_name || tm.name,
        subtitle: tm.position,
        avatar: tm.photo_url || undefined,
      });
      if (tm.profile_id) covered.add(tm.profile_id);
    }

    for (const p of profiles) {
      if (!covered.has(p.id)) {
        list.push({
          value: p.id,
          label: p.display_name || "Team Member",
          subtitle: "Specialist",
          avatar: undefined,
        });
      }
    }
    return list;
  }, [teamMembers, profiles]);

  const completedSubtasksCount = useMemo(() => {
    return subtasks.filter((s) => s.status === "done" || s.status === "approved").length;
  }, [subtasks]);

  const progressPercent = useMemo(() => {
    if (task.status === "done" || task.status === "approved") return 100;
    if (subtasks.length > 0) {
      return Math.round((completedSubtasksCount / subtasks.length) * 100);
    }
    if (task.status === "in_progress") return 50;
    if (task.status === "review") return 80;
    return 0;
  }, [task.status, subtasks.length, completedSubtasksCount]);

  // Workflow Pipeline State
  const [parentSiblings, setParentSiblings] = useState<TaskRow[]>([]);

  useEffect(() => {
    if (task.parent_task_id) {
      (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("parent_task_id", task.parent_task_id)
        .order("sort_order", { ascending: true })
        .then(({ data }: any) => {
          if (data) setParentSiblings(data);
        });
    }
  }, [task.parent_task_id]);

  const directStageActionability = useMemo(() => {
    if (!task.parent_task_id || parentSiblings.length === 0) return { isActionable: true, isLocked: false };
    return checkStageActionability(task, parentSiblings);
  }, [task, parentSiblings]);

  const workflowSummary = useMemo(() => {
    return computeWorkflowProgress(task.id, subtasks);
  }, [task.id, subtasks]);

  // Delivery Link State
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryUrlInput, setDeliveryUrlInput] = useState("");
  const [deliveryNotesInput, setDeliveryNotesInput] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);

  // Forward / Handoff State
  const [pendingHandoff, setPendingHandoff] = useState<TaskHandoffRow | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargetId, setForwardTargetId] = useState("");
  const [forwardReason, setForwardReason] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [respondingHandoff, setRespondingHandoff] = useState(false);

  // Phase 7: Content Production -> Publishing Workflow State
  const [showCompleteEditingModal, setShowCompleteEditingModal] = useState(false);
  const [showPublishContentModal, setShowPublishContentModal] = useState(false);
  const [selectedStageForHandoff, setSelectedStageForHandoff] = useState<TaskRow | null>(null);
  const [selectedStageForPublishing, setSelectedStageForPublishing] = useState<TaskRow | null>(null);
  const [publishingAuditTrail, setPublishingAuditTrail] = useState<PublishingAuditTrail | null>(null);

  const isEditingStage = useMemo(() => {
    const cat = (task.category || "").toLowerCase();
    const tit = (task.title || "").toLowerCase();
    return cat === "editing" || tit.includes("editing") || task.title.includes("المونتاج");
  }, [task.category, task.title]);

  const isPublishingStage = useMemo(() => {
    const cat = (task.category || "").toLowerCase();
    const tit = (task.title || "").toLowerCase();
    return cat === "publishing" || tit.includes("publishing") || task.title.includes("النشر");
  }, [task.category, task.title]);

  const currentDriveUrl = useMemo(() => {
    return (
      (task as any).drive_url ||
      publishingAuditTrail?.driveUrl ||
      task.result_links?.find(l => l.includes("drive.google.com") || l.includes("dropbox") || l.includes("http")) ||
      (task.result_links && task.result_links[0]) ||
      ""
    );
  }, [task, publishingAuditTrail]);

  const currentStageHeading = useMemo(() => {
    if (workflowSummary && workflowSummary.stages.length > 0) {
      const activeStage = workflowSummary.stages.find(stg => stg.status === "in_progress" || stg.status === "todo") || workflowSummary.stages[0];
      if (activeStage) {
        const cleanTitle = activeStage.title.replace(/^\d+[\.\-\s]+/, "").trim();
        return `${activeStage.order}. ${cleanTitle || activeStage.title}`;
      }
    }
    const cleanTitle = (task.title || "").replace(/^\d+[\.\-\s]+/, "").trim();
    return `1. ${cleanTitle || task.title}`;
  }, [workflowSummary, task.title]);

  const fileCount = (task.result_links?.length || 0) + (currentDriveUrl ? 1 : 0);

  const loadPublishingAudit = useCallback(async () => {
    const audit = await fetchPublishingAuditTrail(task.id, task.parent_task_id);
    setPublishingAuditTrail(audit);
  }, [task.id, task.parent_task_id]);

  useEffect(() => {
    loadPublishingAudit();
  }, [loadPublishingAudit]);

  const handleEditingHandoffCompleted = async () => {
    setShowCompleteEditingModal(false);
    setSelectedStageForHandoff(null);
    const { data: updatedTask } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", task.id)
      .maybeSingle();
    if (updatedTask) {
      setTask(updatedTask);
      onStatusChange(updatedTask.id, updatedTask.status);
    }
    loadSubtasks();
    loadActivity();
    loadPublishingAudit();
  };

  const handlePublishingCompleted = async () => {
    setShowPublishContentModal(false);
    setSelectedStageForPublishing(null);
    const { data: updatedTask } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", task.id)
      .maybeSingle();
    if (updatedTask) {
      setTask(updatedTask);
      onStatusChange(updatedTask.id, updatedTask.status);
    }
    loadSubtasks();
    loadActivity();
    loadPublishingAudit();
  };

  // Execution Action Loading States
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Submit Review Flow State
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [reviewResultNotes, setReviewResultNotes] = useState("");
  const [reviewDeliveryLink, setReviewDeliveryLink] = useState("");

  // Postpone Dialog State
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [selectedQuickChoice, setSelectedQuickChoice] = useState<string | null>(null);
  const [selectedReasonChip, setSelectedReasonChip] = useState<string | null>(null);
  const [postponeReason, setPostponeReason] = useState("");

  const getNextMonday = useCallback(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    return format(addDays(d, diff), "yyyy-MM-dd");
  }, []);

  // Block Dialog State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockCategory, setBlockCategory] = useState<BlockerCategory>("client");
  const [blockReason, setBlockReason] = useState("");

  // Request Changes Dialog State
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changesFeedback, setChangesFeedback] = useState("");

  // Task Activity Timeline State
  const [activities, setActivities] = useState<TaskActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Delete Confirm State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Send Task Alert Modal State
  const [showSendAlertModal, setShowSendAlertModal] = useState(false);

  // Load Subtasks
  const loadSubtasks = useCallback(async () => {
    setLoadingSubtasks(true);
    const { data, error } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("parent_task_id", task.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setSubtasks(data);
    }
    setLoadingSubtasks(false);
  }, [task.id]);

  // Load Handoffs
  const loadHandoff = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("task_handoffs")
      .select("*")
      .eq("task_id", task.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    setPendingHandoff(data && data.length > 0 ? data[0] : null);
  }, [task.id]);

  // Load Activity Timeline
  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    const data = await fetchTaskActivity(task.id);
    setActivities(data);
    setLoadingActivity(false);
  }, [task.id]);

  useEffect(() => {
    loadSubtasks();
    loadHandoff();
    loadActivity();
  }, [loadSubtasks, loadHandoff, loadActivity]);

  // -------------------------------------------------------------
  // Execution Handlers
  // -------------------------------------------------------------

  const handleStartTask = async () => {
    if (!user) return;
    if (directStageActionability.isLocked) {
      toast.warning(
        directStageActionability.lockedReason ||
          (isAr
            ? "لا يمكن بدء هذه المرحلة قبل إتمام المراحل السابقة."
            : "Cannot start stage: previous stage must be completed first.")
      );
      return;
    }
    setActionLoading("start");
    const prevStatus = task.status;
    // Optimistic UI update
    setTask(prev => ({ ...prev, status: "in_progress" }));
    onStatusChange(task.id, "in_progress");

    const res = await startTask({ task, actorId: user.id });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم بدء العمل على المهمة بنجاح!" : "Task started! You are now working on this deliverable.");
      loadActivity();
    } else {
      // Rollback
      setTask(prev => ({ ...prev, status: prevStatus }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل بدء المهمة" : "Failed to start task"));
    }
  };

  const handlePauseTask = async () => {
    if (!user) return;
    setActionLoading("pause");
    const prevStatus = task.status;
    setTask(prev => ({ ...prev, status: "todo" }));
    onStatusChange(task.id, "todo");

    const res = await pauseTask({ task, actorId: user.id });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم إيقاف المهمة مؤقتاً وإعادتها لقائمتك." : "Task paused and returned to your queue.");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل إيقاف المهمة مؤقتاً" : "Failed to pause task"));
    }
  };

  const handleSubmitReviewConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionLoading("submit_review");
    const prevStatus = task.status;
    const prevLinks = task.result_links || [];
    const prevNotes = task.result_notes;
    const newLinks = reviewDeliveryLink.trim() ? [...prevLinks, reviewDeliveryLink.trim()] : prevLinks;
    const newNotes = reviewResultNotes.trim() || prevNotes;

    setTask(prev => ({
      ...prev,
      status: "review",
      result_links: newLinks,
      result_notes: newNotes,
    }));
    onStatusChange(task.id, "review");

    const res = await submitTaskForReview({
      task,
      actorId: user.id,
      notes: reviewResultNotes.trim() || undefined,
      deliveryLinks: reviewDeliveryLink.trim() ? [reviewDeliveryLink.trim()] : undefined,
    });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم إرسال التسليم للمراجعة بنجاح!" : "Deliverable submitted for review with delivery notes!");
      setShowSubmitReviewModal(false);
      setReviewResultNotes("");
      setReviewDeliveryLink("");
      loadActivity();
    } else {
      setTask(prev => ({
        ...prev,
        status: prevStatus,
        result_links: prevLinks,
        result_notes: prevNotes,
      }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل إرسال التسليم للمراجعة" : "Failed to submit for review"));
    }
  };

  const handleDirectCompleteTask = async () => {
    if (!user) return;
    if (isEditingStage) {
      setSelectedStageForHandoff(task);
      setShowCompleteEditingModal(true);
      return;
    }
    if (isPublishingStage) {
      setSelectedStageForPublishing(task);
      setShowPublishContentModal(true);
      return;
    }
    setActionLoading("complete");
    const prevStatus = task.status;
    const nowIso = new Date().toISOString();
    setTask(prev => ({ ...prev, status: "done", completed_at: nowIso }));
    onStatusChange(task.id, "done");

    const res = await completeTask({ task, actorId: user.id });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم إكمال التسليم بنجاح!" : "Deliverable completed!");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus, completed_at: task.completed_at }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل إكمال التسليم" : "Failed to complete deliverable"));
    }
  };

  const handleApproveAndComplete = async () => {
    if (!user) return;
    setActionLoading("approve");
    const prevStatus = task.status;
    const nowIso = new Date().toISOString();
    setTask(prev => ({ ...prev, status: "done", completed_at: nowIso }));
    onStatusChange(task.id, "done");

    const res = await approveAndCompleteTask({ task, actorId: user.id });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم اعتماد وإكمال التسليم بنجاح!" : "Deliverable approved & completed!");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus, completed_at: task.completed_at }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل اعتماد التسليم" : "Failed to approve deliverable"));
    }
  };

  const handleRequestChangesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !changesFeedback.trim()) return;

    setActionLoading("request_changes");
    const prevStatus = task.status;
    const prevNotes = task.notes;
    const nextRev = (task.revision_count || 0) + 1;

    setTask(prev => ({ ...prev, status: "in_progress", notes: changesFeedback, revision_count: nextRev }));
    onStatusChange(task.id, "in_progress");

    const res = await requestTaskChanges({
      task,
      actorId: user.id,
      feedback: changesFeedback.trim(),
    });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم طلب التعديلات وإرسال الملاحظات للمنفّذ." : "Changes requested and feedback sent to worker.");
      setShowChangesModal(false);
      setChangesFeedback("");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus, notes: prevNotes }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل طلب التعديلات" : "Failed to request changes"));
    }
  };

  const handlePostponeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !postponeDate) return;

    setActionLoading("postpone");
    const prevStatus = task.status;
    const prevDeadline = task.deadline;
    const prevReason = task.postpone_reason;

    setTask(prev => ({ ...prev, status: "postponed", deadline: postponeDate, postpone_reason: postponeReason }));
    onStatusChange(task.id, "postponed");

    const res = await postponeTask({
      task,
      actorId: user.id,
      newDeadline: postponeDate,
      reason: postponeReason.trim() || "Postponed via Execution Center",
    });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? `تم تأجيل المهمة إلى ${postponeDate}` : `Task postponed to ${postponeDate}`);
      setShowPostponeModal(false);
      setPostponeReason("");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus, deadline: prevDeadline, postpone_reason: prevReason }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل تأجيل المهمة" : "Failed to postpone task"));
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !blockReason.trim()) return;

    setActionLoading("block");
    const prevStatus = task.status;
    const prevBlockedReason = task.blocked_reason;
    const prevWaitingOn = task.waiting_on;

    setTask(prev => ({ ...prev, status: "blocked", blocked_reason: blockReason, waiting_on: blockCategory }));
    onStatusChange(task.id, "blocked");

    const res = await markTaskBlocked({
      task,
      actorId: user.id,
      reason: blockReason.trim(),
      category: blockCategory,
    });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم تسجيل العطل وإرسال التنبيهات للإدارة." : "Task marked as blocked. Alerts dispatched.");
      setShowBlockModal(false);
      setBlockReason("");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus, blocked_reason: prevBlockedReason, waiting_on: prevWaitingOn }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل تسجيل العطل" : "Failed to mark task blocked"));
    }
  };

  const handleResolveBlocker = async () => {
    if (!user) return;
    setActionLoading("unblock");
    const prevStatus = task.status;
    setTask(prev => ({ ...prev, status: "in_progress", blocked_reason: null, waiting_on: null }));
    onStatusChange(task.id, "in_progress");

    const res = await resolveTaskBlocker({ task, actorId: user.id });
    setActionLoading(null);

    if (res.success) {
      toast.success(isAr ? "تم حل العطل واستئناف العمل على المهمة!" : "Blocker resolved! Task resumed in progress.");
      loadActivity();
    } else {
      setTask(prev => ({ ...prev, status: prevStatus, blocked_reason: task.blocked_reason, waiting_on: task.waiting_on }));
      onStatusChange(task.id, prevStatus);
      toast.error(res.error || (isAr ? "فشل حل العطل" : "Failed to resolve blocker"));
    }
  };

  const handleAddCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmittingComment(true);
    const res = await addTaskNote({
      task,
      actorId: user.id,
      note: newComment.trim(),
    });
    setSubmittingComment(false);

    if (res.success && res.entry) {
      setActivities(prev => [res.entry!, ...prev]);
      setNewComment("");
      toast.success(isAr ? "تمت إضافة الملاحظة إلى السجل بنجاح." : "Note added to timeline.");
    } else {
      toast.error(res.error || (isAr ? "فشل إضافة الملاحظة" : "Failed to add note"));
    }
  };

  const handleToggleSubtask = async (st: TaskRow) => {
    // Prerequisite check: cannot mark done if previous required stage is not done
    if (st.status !== "done") {
      const { isActionable, lockedReason } = checkStageActionability(st, subtasks);
      if (!isActionable) {
        toast.warning(lockedReason || (isAr ? "لا يمكن إنجاز هذه المرحلة قبل إتمام المراحل السابقة." : "Cannot advance stage: previous stage must be completed first."));
        return;
      }
    }

    const nextStatus = st.status === "done" ? "todo" : "done";
    const completedAt = nextStatus === "done" ? new Date().toISOString() : null;
    const completedBy = nextStatus === "done" ? (user?.id || null) : null;

    // Invariant: Intercept Editing stage in publishing workflows to require Drive link handoff
    const isEditingSubtask =
      (st.category || "").toLowerCase() === "editing" ||
      (st.title || "").toLowerCase().includes("editing") ||
      st.title.includes("المونتاج");
    const hasPublishingSibling = subtasks.some(
      (s) =>
        (s.category || "").toLowerCase() === "publishing" ||
        (s as any).stage_type === "publishing" ||
        (s.title || "").toLowerCase().includes("publishing") ||
        s.title.includes("نشر")
    );

    if (nextStatus === "done" && isEditingSubtask && hasPublishingSibling) {
      setSelectedStageForHandoff(st);
      setShowCompleteEditingModal(true);
      return;
    }

    // Invariant: Intercept Publishing stage to require live URLs & platform selection
    const isPublishingSubtask =
      (st.category || "").toLowerCase() === "publishing" ||
      (st as any).stage_type === "publishing" ||
      (st.title || "").toLowerCase().includes("publishing") ||
      st.title.includes("نشر");

    if (nextStatus === "done" && isPublishingSubtask) {
      setSelectedStageForPublishing(st);
      setShowPublishContentModal(true);
      return;
    }

    setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, status: nextStatus, completed_at: completedAt, completed_by: completedBy } : s));

    if (nextStatus === "done") {
      await completeTask({
        task: st,
        actorId: user?.id || "",
        actorRole: role || undefined,
        ctx: permCtx,
      });
      toast.success(isAr ? "تم إكمال المهمة الفرعية بنجاح!" : "Subtask completed successfully!");
    } else {
      await (supabase as any)
        .from("project_tasks")
        .update({ status: "todo", completed_at: null, completed_by: null })
        .eq("id", st.id);
      toast.info(isAr ? "تمت إعادة فتح المهمة الفرعية." : "Subtask reopened.");
    }

    // CRITICAL (Phase F): Parent task does NOT automatically become completed.
    // Existing Content Production -> Publishing rules remain authoritative.
    loadActivity();
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    if (!hasGlobalSubtaskPermission) {
      toast.error(isAr ? "صلاحية إضافة المهام الفرعية غير مفعلة لهذا الحساب." : "Permission 'tasks.create_subtask' is disabled for this account.");
      return;
    }

    if (!hasAuthorityOverTask) {
      toast.error(isAr ? "غير مصرح: إضافة المهام الفرعية تتطلب صلاحية المشرف العام، منشئ المهمة، أو المنفذ الرئيسي المكلف بها." : "Unauthorized: Subtask creation requires Super Admin, Task Creator, or Current Main Assignee authority.");
      return;
    }

    setAddingSubtask(true);
    const assignedProfileId = newSubtaskAssigneeId
      ? resolveToProfileId(newSubtaskAssigneeId, teamMembers, profiles)
      : undefined;

    const res = await createProjectSubtask({
      parentTaskId: task.id,
      subtaskData: {
        project_id: task.project_id,
        client_id: task.client_id || null,
        title: newSubtaskTitle.trim(),
        status: "todo",
        priority: task.priority || "medium",
        deadline: task.deadline,
        assignee_id: assignedProfileId,
        sort_order: subtasks.length + 1,
      },
      ctx: permCtx,
      actorRole: role || undefined,
      actorId: user?.id,
    });

    if (res.success && res.data) {
      setSubtasks(prev => [...prev, res.data!]);
      setNewSubtaskTitle("");
      setNewSubtaskAssigneeId(defaultSubtaskAssignee);
      toast.success(isAr ? "تمت إضافة المهمة الفرعية بنجاح" : "Subtask added successfully");
      loadActivity();
    } else {
      toast.error(res.error || (isAr ? "فشل إضافة المهمة الفرعية" : "Failed to add subtask"));
    }
    setAddingSubtask(false);
  };

  const handleAddDeliveryLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryUrlInput.trim()) return;

    if (!canAddDeliverable) {
      toast.error(isAr ? "غير مصرح: لا تملك صلاحية إرفاق التسليمات." : "Unauthorized: You lack permission to attach deliverables.");
      return;
    }

    setSavingDelivery(true);
    const link = deliveryUrlInput.trim();
    const currentLinks = task.result_links || [];
    const updatedLinks = [...currentLinks, link];
    const notes = deliveryNotesInput.trim() || undefined;

    const res = await completeTask({
      task,
      actorId: user?.id || "",
      actorRole: role || undefined,
      deliveryLinks: updatedLinks,
      driveUrl: link.includes("drive.google.com") ? link : (task as any).drive_url,
      resultNotes: notes,
      ctx: permCtx,
    });

    if (res.success) {
      const nowIso = new Date().toISOString();
      setTask(prev => ({
        ...prev,
        result_links: updatedLinks,
        result_notes: notes || prev.result_notes,
        status: "done",
        completed_at: nowIso,
        completed_by: user?.id || prev.completed_by,
        drive_url: link.includes("drive.google.com") ? link : (prev as any).drive_url,
      }));
      onStatusChange(task.id, "done");
      setShowDeliveryForm(false);
      setDeliveryUrlInput("");
      setDeliveryNotesInput("");
      toast.success(isAr ? "تم إرفاق ملف التسليم وتعليم المهمة كمكتملة!" : "Delivery asset attached and task marked completed!");
      loadActivity();
    } else {
      toast.error(res.error || (isAr ? "فشل حفظ ملف التسليم" : "Failed to save delivery asset"));
    }
    setSavingDelivery(false);
  };

  // Handoff transfer helpers
  const handoffFromInfo = pendingHandoff ? getAssignmentMemberInfo(pendingHandoff.from_assignee_id, teamMembers, profiles) : null;
  const handoffToInfo = pendingHandoff ? getAssignmentMemberInfo(pendingHandoff.to_assignee_id, teamMembers, profiles) : null;
  const canAcceptTransfer = pendingHandoff && user && (pendingHandoff.to_assignee_id === user.id || currentMember?.id === pendingHandoff.to_assignee_id);
  const canApproveTransfer = pendingHandoff && user && (pendingHandoff.assigner_id === user.id || isSuperAdmin || isAdmin);
  const canRejectTransfer = canAcceptTransfer || canApproveTransfer;

  const handleInitiateHandoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !forwardTargetId || !forwardReason.trim()) return;

    setSubmittingForward(true);
    try {
      const fromAssigneeProfileId = resolveToProfileId(assigneeInfo?.id || user.id, teamMembers, profiles) || user.id;
      const assignerProfileId = resolveToProfileId(assignedByInfo?.id || user.id, teamMembers, profiles) || user.id;
      const toAssigneeProfileId = resolveToProfileId(forwardTargetId, teamMembers, profiles) || forwardTargetId;

      const { data, error } = await (supabase as any)
        .from("task_handoffs")
        .insert({
          task_id: task.id,
          project_id: task.project_id,
          requested_by_id: user.id,
          from_assignee_id: fromAssigneeProfileId,
          to_assignee_id: toAssigneeProfileId,
          assigner_id: assignerProfileId,
          request_reason: forwardReason.trim(),
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      setPendingHandoff(data);
      setShowForwardModal(false);
      setForwardReason("");
      setForwardTargetId("");
      toast.success(isAr ? "تم طلب تحويل المهمة. بانتظار الموافقة." : "Task transfer requested. Awaiting approval.");
      loadActivity();
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل طلب تحويل المهمة" : "Failed to request transfer"));
    } finally {
      setSubmittingForward(false);
    }
  };

  const handleRespondHandoff = async (action: "accept" | "approve" | "reject") => {
    if (!pendingHandoff || !user) return;
    setRespondingHandoff(true);
    try {
      const nowIso = new Date().toISOString();
      const updates: any = {};

      if (action === "accept") updates.new_assignee_accepted_at = nowIso;
      if (action === "approve") updates.assigner_approved_at = nowIso;
      if (action === "reject") {
        updates.rejected_at = nowIso;
        updates.rejected_by_id = user.id;
        updates.status = "rejected";
      }

      const isNowFullyApproved =
        (action === "approve" && pendingHandoff.new_assignee_accepted_at) ||
        (action === "accept" && pendingHandoff.assigner_approved_at);

      if (isNowFullyApproved) updates.status = "accepted";

      const { error: handoffErr } = await (supabase as any)
        .from("task_handoffs")
        .update(updates)
        .eq("id", pendingHandoff.id);

      if (handoffErr) throw handoffErr;

      if (isNowFullyApproved) {
        const resolvedTo = resolveToProfileId(pendingHandoff.to_assignee_id, teamMembers, profiles) || pendingHandoff.to_assignee_id;
        const resolvedFrom = resolveToProfileId(pendingHandoff.from_assignee_id, teamMembers, profiles) || pendingHandoff.from_assignee_id;
        await (supabase as any)
          .from("project_tasks")
          .update({
            assignee_id: resolvedTo,
            previous_assignee_id: resolvedFrom,
            handoff_reason: pendingHandoff.request_reason,
            updated_at: nowIso,
          })
          .eq("id", task.id);

        setTask(prev => ({
          ...prev,
          assignee_id: resolvedTo,
          previous_assignee_id: resolvedFrom,
          handoff_reason: pendingHandoff.request_reason,
        }));
        setPendingHandoff(null);
        toast.success(isAr ? "تم إتمام التحويل وتعيين المهمة للمسؤول الجديد!" : "Transfer finalized! Task reassigned to new owner.");
      } else if (action === "reject") {
        setPendingHandoff(null);
        toast.info(isAr ? "تم رفض طلب تحويل المهمة." : "Task transfer request was rejected.");
      } else {
        setPendingHandoff(prev => prev ? ({ ...prev, ...updates }) : null);
        toast.success(isAr ? `تم تسجيل ${action === "accept" ? "قبول" : "موافقة"} التحويل. بانتظار التأكيد النهائي.` : `Transfer ${action} recorded. Waiting for final confirmation.`);
      }
      loadActivity();
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل تحديث التحويل" : "Failed to update transfer"));
    } finally {
      setRespondingHandoff(false);
    }
  };

  // Keyboard shortcut: Escape to close modal (if no child confirm/form dialog is active)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          showDeleteConfirm ||
          showSendAlertModal ||
          showCompleteEditingModal ||
          showPublishContentModal ||
          showSubmitReviewModal ||
          showPostponeModal ||
          showBlockModal ||
          showChangesModal ||
          showForwardModal ||
          showDeliveryForm
        ) {
          if (showDeleteConfirm) setShowDeleteConfirm(false);
          else if (showSendAlertModal) setShowSendAlertModal(false);
          else if (showCompleteEditingModal) setShowCompleteEditingModal(false);
          else if (showPublishContentModal) setShowPublishContentModal(false);
          else if (showSubmitReviewModal) setShowSubmitReviewModal(false);
          else if (showPostponeModal) setShowPostponeModal(false);
          else if (showBlockModal) setShowBlockModal(false);
          else if (showChangesModal) setShowChangesModal(false);
          else if (showForwardModal) setShowForwardModal(false);
          else if (showDeliveryForm) setShowDeliveryForm(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onClose,
    showDeleteConfirm,
    showSendAlertModal,
    showCompleteEditingModal,
    showPublishContentModal,
    showSubmitReviewModal,
    showPostponeModal,
    showBlockModal,
    showChangesModal,
    showForwardModal,
    showDeliveryForm,
  ]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
          className="w-full max-w-4xl bg-card border-0 sm:border border-border rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] max-h-[100dvh] animate-in fade-in zoom-in-95 duration-200"
        >
          {/* ============================================================== */}
          {/* HEADER: CONTEXT & IDENTITY (CLEAN TOP BAR - FIXED/STICKY)      */}
          {/* ============================================================== */}
          <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-border bg-card shrink-0 flex-none">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Task Hierarchy Badge: SUBTASK vs MAIN TASK */}
              {task.parent_task_id ? (
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-[10px] sm:text-xs font-mono uppercase inline-flex items-center gap-1 shrink-0">
                  <Workflow className="size-3 shrink-0" />
                  <span>{isAr ? "مهمة فرعية" : "SUBTASK"}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold text-[10px] sm:text-xs font-mono uppercase inline-flex items-center gap-1 shrink-0">
                  <Sparkles className="size-3 shrink-0" />
                  <span>{isAr ? "مهمة رئيسية" : "MAIN TASK"}</span>
                </span>
              )}

              {/* Client Badge with dot indicator */}
              <span className="px-2.5 py-0.5 rounded-lg bg-muted text-foreground font-bold font-mono text-[10px] sm:text-xs uppercase inline-flex items-center gap-1.5 shrink-0">
                <span className="size-1.5 rounded-full bg-primary shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-none">{project?.client_name || (isAr ? "مساحة عمل سدى" : "MAISON CARTHAGE")}</span>
              </span>
            </div>

            {/* Top Right Window Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {canEditDef && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(task); }}
                  className="hidden sm:inline-flex px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-semibold items-center gap-1 transition-colors cursor-pointer"
                  title={isAr ? "تعديل تعريف المهمة" : "Edit task definition"}
                >
                  <Pencil className="size-3" />
                  <span>{isAr ? "تعديل" : "Edit"}</span>
                </button>
              )}

              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title={isAr ? "حذف التسليم نهائياً" : "Permanently delete deliverable"}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label={isAr ? "إغلاق" : "Close"}
                className="size-7 sm:size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SINGLE PRIMARY SCROLL CONTAINER (ALL TASK CONTENT FLOWS HERE)  */}
          {/* ============================================================== */}
          <div
            id="task-detail-scroll-container"
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* ============================================================== */}
            {/* TITLE & KEY METADATA SUMMARY                                   */}
            {/* ============================================================== */}
            <div className="p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 bg-muted/10 border-b border-border shrink-0">
            {/* Task Title */}
            <h2 id="task-detail-title" className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight leading-snug break-words" dir="auto">
              <bdi>{task.title}</bdi>
            </h2>

            {/* Meta Row 1: Lead on left, Priority pill on right */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-muted-foreground">{isAr ? "المسؤول:" : "Lead:"}</span>
                <span className="font-semibold text-foreground truncate">{leadInfo?.displayName || "BRR039"}</span>
                <Avatar className="size-5 shrink-0 border border-border">
                  {leadInfo?.photoUrl ? <AvatarImage src={leadInfo.photoUrl} /> : null}
                  <AvatarFallback className="text-[9px] font-bold font-mono bg-primary/10 text-primary">
                    {getInitials(leadInfo?.displayName || "BK")}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Priority Pill */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono ${priorityConf.bg} ${priorityConf.color} shrink-0`}>
                <span className={`size-1.5 rounded-full ${priorityConf.dot}`} />
                {priorityConf.label}
              </span>
            </div>

            {/* Meta Row 2: Due Date on left, Status pill on right */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                <Calendar className="size-3.5 shrink-0" />
                <span>
                  {task.deadline
                    ? (isAr ? `الموعد ${formatDate(parseISO(task.deadline), "d MMM yyyy")}` : `Due ${format(parseISO(task.deadline), "d MMM yyyy")}`)
                    : (isAr ? "بدون موعد" : "No deadline")}
                </span>
              </div>

              {/* Status Pill */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono ${statusConf.bg} ${statusConf.color} shrink-0`}>
                <span className="size-1.5 rounded-full bg-current" />
                {statusConf.label}
              </span>
            </div>

            {/* Parent Task Card (when subtask) */}
            {task.parent_task_id && (
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider">
                    {isAr ? "المهمة الرئيسية" : "Parent Task"}
                  </div>
                  <div className="text-xs font-bold text-foreground truncate mt-0.5">
                    {parentTask?.title || (isAr ? "جاري تحميل المهمة..." : "Main Task")}
                  </div>
                </div>
                {parentTask && (
                  <button
                    type="button"
                    onClick={() => setTask(parentTask)}
                    className="px-3 py-1 rounded-xl bg-card border border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 text-xs font-bold inline-flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    <span>{isAr ? "عرض ←" : "View →"}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* CURRENT STAGE HEADING & BRIEF                                   */}
          {/* ============================================================== */}
          <div className="px-3.5 sm:px-5 py-3 space-y-1 bg-card border-b border-border shrink-0">
            <h3 className="text-sm sm:text-base font-bold font-display text-foreground" dir="auto">
              <bdi>{currentStageHeading}</bdi>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {task.description || (isAr ? "راجع أهداف العميل، إرشادات الهوية البصرية، والرسائل الأساسية." : "Review client objectives, branding guidelines, target audience, and key messaging.")}
            </p>
          </div>

          {/* ============================================================== */}
          {/* PRIMARY WORKER ACTION BAR (CONTEXT-AWARE STATE MACHINE)         */}
          {/* ============================================================== */}
          <div className="px-3.5 py-2.5 sm:px-6 sm:py-3.5 bg-card border-b border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Context Action 1: START TASK (when todo) */}
              {task.status === "todo" && (
                <>
                  {directStageActionability.isLocked ? (
                    <div
                      className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold inline-flex items-center gap-2 shadow-2xs w-full sm:w-auto"
                      title={directStageActionability.lockedReason || undefined}
                    >
                      <Lock className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {directStageActionability.lockedReason ||
                          (isAr
                            ? "المرحلة مقفلة بانتظار إنجاز المرحلة السابقة"
                            : "Stage locked: pending previous stage")}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(actionLoading)}
                      onClick={handleStartTask}
                      className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      {actionLoading === "start" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5 fill-current" />
                      )}
                      <span>{isAr ? "بدء العمل" : "Start Task"}</span>
                    </button>
                  )}
                </>
              )}

              {/* Phase 7: Editing Stage Action — Complete & Hand Off */}
              {isEditingStage && task.status !== "done" && task.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageForHandoff(task);
                    setShowCompleteEditingModal(true);
                  }}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Film className="size-3.5" />
                  <span>{isAr ? "إتمام المونتاج والتحويل للنشر" : "Complete & Hand Off to Publishing"}</span>
                </button>
              )}

              {/* Phase 7: Publishing Stage Action — Publish to Socials */}
              {isPublishingStage && task.status !== "done" && task.status !== "approved" && !directStageActionability.isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageForPublishing(task);
                    setShowPublishContentModal(true);
                  }}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer animate-pulse whitespace-nowrap"
                >
                  <Share2 className="size-3.5" />
                  <span>{isAr ? "نشر المحتوى على الحسابات" : "Publish to Social Accounts"}</span>
                </button>
              )}

              {/* Context Action 2: IN PROGRESS ACTIONS */}
              {task.status === "in_progress" && (
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => setShowSubmitReviewModal(true)}
                    className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {actionLoading === "submit_review" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    <span>{isAr ? "إرسال للمراجعة" : "Submit Review"}</span>
                  </button>

                  {!isEditingStage && !isPublishingStage && (
                    <button
                      type="button"
                      disabled={Boolean(actionLoading)}
                      onClick={handleDirectCompleteTask}
                      className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      {actionLoading === "complete" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      <span>{isAr ? "تعليم كمكتمل" : "Complete"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={handlePauseTask}
                    className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {actionLoading === "pause" ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
                    <span>{isAr ? "إيقاف مؤقت" : "Pause"}</span>
                  </button>
                </div>
              )}

              {/* Context Action 3: REVIEW ACTIONS */}
              {task.status === "review" && (
                <>
                  {isManagerOrReviewer ? (
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={Boolean(actionLoading)}
                        onClick={handleApproveAndComplete}
                        className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {actionLoading === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <ThumbsUp className="size-3.5" />}
                        <span>{isAr ? "اعتماد التسليم" : "Approve"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(actionLoading)}
                        onClick={() => setShowChangesModal(true)}
                        className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>{isAr ? "طلب تعديلات" : "Request Changes"}</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-2 font-semibold">
                      <Clock className="size-3.5 animate-pulse" />
                      {isAr ? "مرسلة للمراجعة — بانتظار الاعتماد" : "In Review — Waiting approval"}
                    </span>
                  )}
                </>
              )}

              {/* Context Action 4: BLOCKED RESOLUTION */}
              {task.status === "blocked" && (
                <button
                  type="button"
                  disabled={Boolean(actionLoading)}
                  onClick={handleResolveBlocker}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  {actionLoading === "unblock" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>{isAr ? "حل التعطل واستئناف العمل" : "Resolve Blocker & Resume"}</span>
                </button>
              )}

              {/* Context Action 5: DONE / APPROVED REOPEN */}
              {(task.status === "done" || task.status === "approved") && (
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    {isAr ? "تم إنجاز التسليم" : "Completed"}
                  </span>
                  <button
                    type="button"
                    onClick={handleStartTask}
                    className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isAr ? "إعادة فتح المهمة" : "Reopen Task"}
                  </button>
                </div>
              )}

              {/* Context Action 6: POSTPONED RESUME */}
              {task.status === "postponed" && (
                <button
                  type="button"
                  disabled={Boolean(actionLoading)}
                  onClick={handleStartTask}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>{isAr ? "استئناف التنفيذ" : "Resume"}</span>
                </button>
              )}
            </div>

            {/* Secondary Action Triggers: Postpone & Block */}
            {task.status !== "done" && task.status !== "approved" && (
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowPostponeModal(true)}
                  className="justify-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-border hover:bg-muted text-[11px] sm:text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title={isAr ? "تأجيل الموعد النهائي مع تسجيل السبب" : "Reschedule deadline with auditable reason"}
                >
                  <CalendarClock className="size-3.5 shrink-0" />
                  <span>{isAr ? "تأجيل الموعد" : "Postpone"}</span>
                </button>

                {task.status !== "blocked" && (
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(true)}
                    className="justify-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title={isAr ? "تسجيل المهمة كمعطلة وإبلاغ الإدارة" : "Flag blocker and notify management"}
                  >
                    <Ban className="size-3.5 shrink-0" />
                    <span>{isAr ? "تسجيل كمعطلة" : "Mark Blocked"}</span>
                  </button>
                )}

                {canSendAlert && (
                  <button
                    type="button"
                    onClick={() => setShowSendAlertModal(true)}
                    className="col-span-2 sm:col-span-1 justify-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title={isAr ? "إرسال تنبيه مباشر للمسؤول عن المهمة" : "Send direct task alert to specialist"}
                  >
                    <Send className="size-3.5 shrink-0" />
                    <span>{isAr ? "إرسال تنبيه" : "Send Alert"}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* BODY: EXECUTION WORKSPACE & ACCORDIONS                          */}
          {/* ============================================================== */}
          <div className="p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 pb-8 sm:pb-8 flex-1">
            {/* ACTIVE BLOCKER WARNING (IF BLOCKED) */}
            {task.status === "blocked" && (
              <div className="p-4 rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 uppercase tracking-wider font-mono">
                    <Ban className="size-4 text-rose-600 shrink-0" />
                    {isAr
                      ? `المهمة معطلة: ${BLOCKER_CATEGORY_LABELS[task.waiting_on as BlockerCategory] || "اعتمادية خارجية"}`
                      : `Deliverable Blocked: ${BLOCKER_CATEGORY_LABELS[task.waiting_on as BlockerCategory] || "External Dependency"}`}
                  </span>
                  <span className="text-[10px] font-mono text-rose-600 bg-rose-500/20 px-2 py-0.5 rounded font-bold">
                    {isAr ? "مطلوب إجراء" : "Action Required"}
                  </span>
                </div>
                <p className="text-xs text-foreground font-medium">
                  {task.blocked_reason || (isAr ? "المهمة معطلة بواسطة المنفّذ." : "Task blocked by specialist.")}
                </p>
              </div>
            )}

            {/* POSTPONED NOTICE (IF POSTPONED) */}
            {task.status === "postponed" && (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-1 text-xs">
                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0" />
                  {isAr ? "تسليم مؤجّل" : "Postponed Deliverable"}
                </div>
                <p className="text-muted-foreground">
                  {isAr ? "السبب:" : "Reason:"} "{task.postpone_reason || (isAr ? "مجدولة للتنفيذ لاحقاً" : "Scheduled for later execution")}"
                </p>
              </div>
            )}

            {/* ============================================================== */}
            {/* ACCORDION 1: TASK DETAILS (EXPANDED BY DEFAULT)                */}
            {/* ============================================================== */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setDetailsOpen(!detailsOpen)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 text-xs font-bold font-display text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span>{isAr ? "تفاصيل المهمة" : "Task Details"}</span>
                </span>
                {detailsOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {detailsOpen && (
                <div className="p-3.5 sm:p-4 border-t border-border space-y-4 pt-3.5">
                  {/* 6-ITEM KPI SUMMARY GRID */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    {/* Status */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                        {isAr ? "الحالة" : "Status"}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${statusConf.bg} ${statusConf.color}`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                        {isAr ? "الأولوية" : "Priority"}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${priorityConf.bg} ${priorityConf.color}`}>
                        <span className={`size-1.5 rounded-full ${priorityConf.dot}`} />
                        {priorityConf.label}
                      </span>
                    </div>

                    {/* Deadline */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                        {isAr ? "الموعد النهائي" : "Deadline"}
                      </span>
                      <span className={`text-xs font-semibold font-mono block ${overdue && task.status !== "done" ? "text-rose-600 dark:text-rose-400 font-bold" : "text-foreground"}`}>
                        {task.deadline ? formatDate(parseISO(task.deadline), "d MMM yyyy") : (isAr ? "بدون موعد" : "No deadline")}
                      </span>
                    </div>

                    {/* Assignee */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                        {isAr ? "المنفّذ المسؤول" : "Assignee"}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar className="size-5 shrink-0 border border-border">
                          {assigneeInfo?.photoUrl ? <AvatarImage src={assigneeInfo.photoUrl} /> : null}
                          <AvatarFallback className="text-[9px] font-bold font-mono bg-primary/10 text-primary">
                            {getInitials(assigneeInfo?.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-foreground truncate">
                          {assigneeInfo?.displayName || (isAr ? "غير معين" : "Unassigned")}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                        {isAr ? "نسبة الإنجاز" : "Progress"}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {progressPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-bold">
                        {isAr ? "المراحل والمهام" : "Subtasks"}
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground block">
                        {subtasks.length > 0
                          ? `${completedSubtasksCount} / ${subtasks.length}`
                          : (isAr ? "مهمة مباشرة" : "Single task")}
                      </span>
                    </div>
                  </div>

                  {/* Task Ownership Card (Desktop/Tablet Only) */}
                  <div className="hidden sm:block p-3 sm:p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-primary flex items-center gap-1.5">
                        <Users className="size-3.5 shrink-0" /> {isAr ? "مسؤوليات الإسناد والتنفيذ" : "Task Ownership"}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {task.parent_task_id ? (isAr ? "مستوى المهمة الفرعية" : "Subtask Level") : (isAr ? "مستوى المهمة الرئيسية" : "Main Task Level")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {/* ASSIGNED TO */}
                      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border shadow-2xs">
                        <Avatar className="size-9 shrink-0 border border-primary/30">
                          {assigneeInfo?.photoUrl ? <AvatarImage src={assigneeInfo.photoUrl} /> : null}
                          <AvatarFallback className="text-xs font-bold font-mono bg-primary/10 text-primary">
                            {getInitials(assigneeInfo?.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-primary font-bold block">
                            {isAr ? "المسؤول عن التنفيذ" : "Assigned To"}
                          </span>
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {assigneeInfo?.displayName || (isAr ? "غير معين بعد" : "Unassigned")}
                          </h4>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {assigneeInfo?.position || (isAr ? "مكلف بالتنفيذ" : "Responsible for execution")}
                          </span>
                        </div>
                      </div>

                      {/* ASSIGNED BY */}
                      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border shadow-2xs">
                        <Avatar className="size-9 shrink-0 border border-border">
                          {assignedByInfo?.photoUrl ? <AvatarImage src={assignedByInfo.photoUrl} /> : null}
                          <AvatarFallback className="text-xs font-bold font-mono bg-muted text-muted-foreground">
                            {getInitials(assignedByInfo?.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground font-bold block">
                            {isAr ? "تم التكليف بواسطة" : "Assigned By"}
                          </span>
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {assignedByInfo?.displayName || (isAr ? "قائد العمليات" : "Operations Lead")}
                          </h4>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {assignedByInfo?.position || (isAr ? "مشرف العمليات" : "Operations Supervisor")}
                          </span>
                        </div>
                      </div>

                      {/* COMPLETED BY */}
                      {(task.status === "done" || task.status === "approved" || task.completed_at) && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-emerald-500/30 shadow-2xs">
                          <Avatar className="size-9 shrink-0 border border-emerald-500/40">
                            {completedByInfo?.photoUrl ? <AvatarImage src={completedByInfo.photoUrl} /> : null}
                            <AvatarFallback className="text-xs font-bold font-mono bg-emerald-500/10 text-emerald-600">
                              {getInitials(completedByInfo?.displayName || assigneeInfo?.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold block">
                              {isAr ? "أنجزت واعتمدت بواسطة" : "Completed By"}
                            </span>
                            <h4 className="text-xs font-bold text-foreground truncate">
                              {completedByInfo?.displayName || assigneeInfo?.displayName || (isAr ? "المنفذ المسؤول" : "Execution Specialist")}
                            </h4>
                            <span className="text-[10px] text-muted-foreground block truncate font-mono">
                              {task.completed_at ? formatDate(parseISO(task.completed_at), "d MMM yyyy") : (isAr ? "مكتملة" : "Completed")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* ACCORDION 2: ASSIGNMENT BRIEF & INSTRUCTIONS                    */}
            {/* ============================================================== */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setBriefOpen(!briefOpen)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 text-xs font-bold font-display text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span>{isAr ? "موجز وتعليمات المهمة" : "Assignment Brief & Instructions"}</span>
                </span>
                {briefOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {briefOpen && (
                <div className="p-3.5 sm:p-4 border-t border-border pt-3.5 space-y-3">
                  {/* Direct Worker Instruction */}
                  {cleanUserFacingNotes(task.notes) ? (
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-foreground font-medium text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-start" dir="auto">
                      {cleanUserFacingNotes(task.notes)}
                    </div>
                  ) : task.description ? (
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-foreground font-medium text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-start" dir="auto">
                      {task.description}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {isAr
                        ? "لم يتم تقديم ملاحظات إسناد محددة. يرجى اتباع إرشادات التسليم القياسية."
                        : "No specific assignment note provided. Follow standard deliverable guidelines."}
                    </p>
                  )}

                  {/* Key Meta Attributes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-border/70">
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-muted-foreground">{isAr ? "المنفّذ المكلّف" : "Assigned Worker"}</span>
                      <span className="font-semibold text-foreground">{assigneeInfo?.displayName || (isAr ? "غير مسند" : "Unassigned")}</span>
                    </div>
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-muted-foreground">{isAr ? "المشرف / المراجع" : "Supervisor / Lead"}</span>
                      <span className="font-semibold text-foreground">{reviewerInfo?.displayName || "Operations Lead"}</span>
                    </div>
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-muted-foreground">{isAr ? "المراجعات" : "Revisions"}</span>
                      <span className="font-semibold text-foreground">{isAr ? `${task.revision_count || 0} مراجعات` : `${task.revision_count || 0} revisions`}</span>
                    </div>
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-muted-foreground">{isAr ? "الوقت التقديري" : "Estimated Time"}</span>
                      <span className="font-semibold text-foreground">{isAr ? `${task.estimated_hours || 1} س` : `${task.estimated_hours || 1} hrs`}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* ACCORDION 3: RELATED FILES & DELIVERABLE ASSETS                 */}
            {/* ============================================================== */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setFilesOpen(!filesOpen)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 text-xs font-bold font-display text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="size-4 text-primary" />
                  <span>{isAr ? `الملفات والروابط المرفقة (${fileCount})` : `Related Files (${fileCount})`}</span>
                </span>
                {filesOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {filesOpen && (
                <div className="p-3.5 sm:p-4 border-t border-border pt-3.5 space-y-3">
                  {/* Google Drive Production Asset Banner */}
                  {currentDriveUrl && (
                    <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 grid place-items-center shrink-0">
                          <Film className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground font-display">
                              {isAr ? "ملف الإنتاج الجاهز للنشر (Drive)" : "Production Asset (Drive)"}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                              {isAr ? "جاهز للنشر" : "Ready"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-xs pt-0.5 font-mono" dir="ltr">
                            {currentDriveUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={currentDriveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <ExternalLink className="size-3" />
                          <span>{isAr ? "فتح" : "Open"}</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Result Links List */}
                  {task.result_links && task.result_links.length > 0 ? (
                    <div className="space-y-2">
                      {task.result_links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border hover:border-primary text-xs text-primary font-medium hover:underline transition-colors text-start"
                        >
                          <ExternalLink className="size-3.5 shrink-0" />
                          <span className="truncate">{link}</span>
                        </a>
                      ))}
                      {task.result_notes && (
                        <p className="text-xs text-muted-foreground italic pt-1 text-start" dir="auto">
                          "{task.result_notes}"
                        </p>
                      )}
                    </div>
                  ) : (
                    !currentDriveUrl && (
                      <p className="text-xs text-muted-foreground italic">
                        {isAr ? "لا توجد ملفات أو روابط تسليم مرفقة حتى الآن." : "No files or delivery links attached yet."}
                      </p>
                    )
                  )}

                  {/* Attach Deliverable URL Form */}
                  {canAddDeliverable && (!showDeliveryForm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeliveryForm(true)}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>{isAr ? "إرفاق ملف / رابط التسليم" : "Attach Deliverable Asset / URL"}</span>
                    </button>
                  ) : (
                    <form onSubmit={handleAddDeliveryLink} className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{isAr ? "إرفاق رابط التسليم" : "Attach Deliverable Link"}</span>
                        <SADAButton
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setShowDeliveryForm(false)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isAr ? "إلغاء" : "Cancel"}
                        </SADAButton>
                      </div>
                      <SADAInput
                        type="url"
                        required
                        placeholder="https://drive.google.com/... or Vimeo / Instagram link"
                        value={deliveryUrlInput}
                        onChange={e => setDeliveryUrlInput(e.target.value)}
                        className="w-full text-xs"
                      />
                      <SADAInput
                        type="text"
                        placeholder={isAr ? "ملاحظات التسليم (اختياري)..." : "Delivery notes (optional)..."}
                        value={deliveryNotesInput}
                        onChange={e => setDeliveryNotesInput(e.target.value)}
                        className="w-full text-xs"
                      />
                      <SADAButton
                        type="submit"
                        variant="primary"
                        disabled={savingDelivery}
                        className="w-full text-xs font-bold"
                      >
                        {savingDelivery
                          ? (isAr ? "جاري حفظ الرابط..." : "Saving Asset...")
                          : (isAr ? "حفظ رابط التسليم وإتمام المهمة" : "Save Delivery Link & Mark Complete")}
                      </SADAButton>
                    </form>
                  ))}
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* ACCORDION 4: WORKFLOW STAGES & SUBTASKS                         */}
            {/* ============================================================== */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setSubtasksAccordionOpen(!subtasksAccordionOpen)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 text-xs font-bold font-display text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Workflow className="size-4 text-primary" />
                  <span>
                    {isAr
                      ? `المراحل والمهام الفرعية (${completedSubtasksCount}/${subtasks.length || 0})`
                      : `Workflow Stages & Subtasks (${completedSubtasksCount}/${subtasks.length || 0})`}
                  </span>
                </span>
                {subtasksAccordionOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {subtasksAccordionOpen && (
                <div className="p-3.5 sm:p-4 border-t border-border pt-3.5 space-y-4">
                  {/* WORKFLOW PIPELINE STEPPER */}
                  {workflowSummary && (
                    <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold font-display uppercase tracking-wider text-foreground">
                          {isAr ? "مسار العمل" : "Workflow Pipeline"}
                        </span>
                        <span className="font-mono text-primary font-bold">
                          {workflowSummary.progress_percent}% ({workflowSummary.completed_stages}/{workflowSummary.total_stages})
                        </span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                          style={{ width: `${workflowSummary.progress_percent}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {workflowSummary.stages.map((stg) => {
                          const isStgDone = stg.status === "done" || stg.status === "approved";
                          const isStgActive = !isStgDone && !stg.is_locked;
                          return (
                            <div
                              key={stg.id}
                              className={`p-2 rounded-xl border flex flex-col justify-between gap-1 transition-all text-xs ${
                                isStgDone
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                  : isStgActive
                                  ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-xs"
                                  : "bg-muted/30 border-border/60 text-muted-foreground opacity-60"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="size-4 rounded-full bg-background/80 font-bold font-mono text-[9px] grid place-items-center">
                                  {stg.order}
                                </span>
                                {isStgDone ? (
                                  <CheckCircle2 className="size-3 text-emerald-500" />
                                ) : stg.is_locked ? (
                                  <Lock className="size-3 text-muted-foreground" />
                                ) : (
                                  <Play className="size-3 text-primary fill-current" />
                                )}
                              </div>
                              <span className="font-semibold truncate text-[10px] leading-tight">
                                {stg.title}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Subtasks List */}
                  {subtasks.length > 0 ? (
                    <div className="space-y-2">
                      {subtasks.map((st) => {
                        const isDone = st.status === "done" || st.status === "approved";
                        const { isLocked, lockedReason } = checkStageActionability(st, subtasks);

                        return (
                          <div
                            key={st.id}
                            className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                              isDone
                                ? "bg-muted/30 border-border opacity-75"
                                : isLocked
                                ? "bg-muted/15 border-border/70 hover:border-amber-500/40"
                                : "bg-card border-border hover:border-primary/40 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {isLocked && !isDone ? (
                                <div className="size-5 rounded-md bg-amber-500/10 border border-amber-500/25 grid place-items-center text-amber-600 dark:text-amber-400 shrink-0" title={lockedReason}>
                                  <Lock className="size-3" />
                                </div>
                              ) : (
                                <SADACheckbox
                                  checked={isDone}
                                  onCheckedChange={() => handleToggleSubtask(st)}
                                  size="sm"
                                  shape="circle"
                                  aria-label={isDone ? (isAr ? "إلغاء إكمال المهمة الفرعية" : "Mark subtask incomplete") : (isAr ? "إكمال المهمة الفرعية" : "Mark subtask complete")}
                                  className="shrink-0"
                                />
                              )}

                              <div
                                className="min-w-0 flex-1 cursor-pointer group/title"
                                onClick={() => setTask(st)}
                                title={isAr ? "فتح المهمة الفرعية بكامل تفاصيلها" : "Open subtask details"}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold truncate block group-hover/title:text-primary transition-colors ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                    {st.title}
                                  </span>
                                  <ExternalLink className="size-3 text-muted-foreground opacity-40 group-hover/title:opacity-100 shrink-0" />
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5 flex-wrap">
                                  <span className="px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold uppercase">
                                    {st.status}
                                  </span>
                                  {(st.deadline || (st as any).due_date) && (
                                    <span>
                                      {isAr ? "استحقاق:" : "Due:"} {formatDate(parseISO((st.deadline || (st as any).due_date)!), "d MMM")}
                                    </span>
                                  )}
                                  {isDone && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                      ✓ {isAr ? "أنجزت" : "Done"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <SubtaskAssigneePopover
                                subtask={st}
                                teamMembers={teamMembers}
                                profiles={profiles}
                                canAssign={canAssignTask}
                                isUpdating={reassigningSubtaskId === st.id}
                                onAssignChange={(newId) => handleSubtaskAssigneeChange(st.id, newId)}
                                isAr={isAr}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-muted-foreground rounded-xl bg-muted/20 border border-dashed border-border/80">
                      {isAr ? "لا توجد مهام فرعية بعد." : "No subtasks created yet."}
                    </div>
                  )}

                  {/* Subtask Creation Form */}
                  {canCreateSubtask && (
                    <form onSubmit={handleAddSubtask} className="p-3 rounded-xl bg-muted/30 border border-border/80 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span className="font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                          <Plus className="size-3 text-primary" />
                          {isAr ? "إضافة مرحلة جديدة" : "Add New Subtask"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-7">
                          <SADAInput
                            type="text"
                            placeholder={isAr ? "عنوان المرحلة..." : "Subtask title..."}
                            value={newSubtaskTitle}
                            onChange={e => setNewSubtaskTitle(e.target.value)}
                            size="compact"
                            className="text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <SADACombobox
                            value={newSubtaskAssigneeId}
                            onChange={setNewSubtaskAssigneeId}
                            options={memberComboboxOptions}
                            placeholder={isAr ? "تعيين المنفذ..." : "Assign to..."}
                            searchPlaceholder={isAr ? "بحث في الفريق..." : "Search members..."}
                            size="compact"
                            clearable
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <SADAButton
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={addingSubtask || !newSubtaskTitle.trim()}
                            className="w-full text-xs font-bold"
                          >
                            {addingSubtask ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                            <span>{addingSubtask ? (isAr ? "جاري..." : "Adding...") : (isAr ? "إضافة" : "Add")}</span>
                          </SADAButton>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* ACCORDION 5: ACTIVITY HISTORY & AUDIT TIMELINE                  */}
            {/* ============================================================== */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setActivityAccordionOpen(!activityAccordionOpen)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 text-xs font-bold font-display text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <span>
                    {isAr
                      ? `سجل النشاط والملاحظات (${activities.length})`
                      : `Activity History & Notes (${activities.length})`}
                  </span>
                </span>
                {activityAccordionOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {activityAccordionOpen && (
                <div className="p-3.5 sm:p-4 border-t border-border pt-3.5 space-y-4">
                  {/* Publishing Audit Trail */}
                  {(publishingAuditTrail?.driveUrl || publishingAuditTrail?.publishedAt || publishingAuditTrail?.readyForPublishingAt) && (
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-muted/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary shrink-0" />
                          {isAr ? "سجل الإنتاج والنشر" : "Publishing Audit Trail"}
                        </span>
                        {publishingAuditTrail.publishedAt ? (
                          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                            {isAr ? "تم النشر" : "Published Live"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded font-bold border border-purple-500/20">
                            {isAr ? "بانتظار النشر" : "Pending Publishing"}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-card border border-border/70 space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-muted-foreground block font-semibold">1. Prepared by</span>
                          <span className="font-semibold text-foreground truncate block text-xs">{publishingAuditTrail.contentPreparedBy?.name || assigneeInfo?.displayName || "Specialist"}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-card border border-border/70 space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-muted-foreground block font-semibold">2. Ready</span>
                          <span className="font-semibold text-foreground truncate block text-xs">
                            {publishingAuditTrail.readyForPublishingAt ? formatDate(parseISO(publishingAuditTrail.readyForPublishingAt), "d MMM · HH:mm") : "Editing Done"}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-card border border-border/70 space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-muted-foreground block font-semibold">3. Publisher</span>
                          <span className="font-semibold text-foreground truncate block text-xs">{publishingAuditTrail.assignedPublisher?.name || "Configured"}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-card border border-border/70 space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-muted-foreground block font-semibold">4. Live</span>
                          <span className="font-semibold text-foreground truncate block text-xs">{publishingAuditTrail.publishedBy?.name || "Pending Post"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add Note Composer */}
                  <form onSubmit={handleAddCommentSubmit} className="flex gap-2">
                    <SADAInput
                      type="text"
                      placeholder={isAr ? "إضافة ملاحظة أو تعليق تشغيلي..." : "Add note or comment to timeline..."}
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      className="w-full text-xs"
                    />
                    <SADAButton
                      type="submit"
                      variant="primary"
                      disabled={submittingComment || !newComment.trim()}
                      className="px-3.5 text-xs font-semibold shrink-0"
                    >
                      {submittingComment ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5 rtl:rotate-180" />}
                      <span>{isAr ? "نشر" : "Post"}</span>
                    </SADAButton>
                  </form>

                  {/* Activity Timeline List */}
                  {loadingActivity ? (
                    <div className="py-4 text-center text-xs text-muted-foreground font-mono">
                      {isAr ? "جاري تحميل سجل النشاط..." : "Loading activity history..."}
                    </div>
                  ) : activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      {isAr ? "لا يوجد نشاط مسجل حتى الآن." : "No activity logged yet."}
                    </p>
                  ) : (
                    <div className="space-y-2.5 relative before:absolute ltr:before:left-3 rtl:before:right-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                      {activities.map((act) => {
                        const actorName = act.actor?.display_name || (isAr ? "أحد المنفّذين" : "Specialist");
                        const rawAction = act.action.replace("_", " ").toUpperCase();
                        const actionLabel = isAr ? (
                          act.action === "status_change" ? "تغيير الحالة" :
                          act.action === "comment" ? "تعليق داخلي" :
                          act.action === "postpone" ? "تأجيل الموعد" :
                          act.action === "block" ? "تسجيل عطل" :
                          act.action === "unblock" ? "حل العطل واستئناف" :
                          act.action === "submit_review" ? "إرسال للمراجعة" :
                          act.action === "request_changes" ? "طلب تعديلات" :
                          act.action === "approve" ? "اعتماد التسليم" :
                          act.action === "create" ? "إنشاء المهمة" : rawAction
                        ) : rawAction;
                        return (
                          <div key={act.id} className="relative flex items-start gap-2.5 ltr:pl-7 rtl:pr-7 text-xs">
                            <div className="absolute ltr:left-1.5 rtl:right-1.5 top-1 size-3 rounded-full bg-primary ring-4 ring-card shrink-0" />
                            <div className="flex-1 space-y-0.5 bg-muted/30 p-2.5 rounded-xl border border-border/60 text-start">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-foreground">{actorName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {formatDate(parseISO(act.created_at), "d MMM · HH:mm")}
                                </span>
                              </div>
                              <div className="text-primary font-mono text-[10px] font-bold">
                                {actionLabel}
                              </div>
                              {act.details?.reason && (
                                <p className="text-muted-foreground italic mt-0.5">"{act.details.reason}"</p>
                              )}
                              {act.details?.feedback && (
                                <p className="text-amber-700 dark:text-amber-400 font-medium mt-0.5">"{act.details.feedback}"</p>
                              )}
                              {act.details?.note && (
                                <p className="text-foreground mt-0.5 whitespace-pre-wrap">{act.details.note}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* End of #task-detail-scroll-container */}
          </div>

          {/* ============================================================== */}
          {/* FOOTER: CLOSE (FULL-WIDTH TOUCH-FRIENDLY ACTION)               */}
          {/* ============================================================== */}
          <div className="p-3 sm:p-4 bg-card border-t border-border mt-auto shrink-0 pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-bold text-foreground transition-colors cursor-pointer shadow-2xs"
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: POSTPONE DELIVERABLE                                  */}
      {/* ============================================================== */}
      {showPostponeModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handlePostponeSubmit}
            className="w-full max-w-md bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-start"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary shrink-0" /> {isAr ? "تأجيل الموعد النهائي" : "POSTPONE DELIVERABLE"}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAr ? "ترحيل هذا التسليم إلى موعد نهائي جديد مع تسجيل السبب." : "Move this deliverable to a new deadline."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPostponeModal(false)}
                className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* NEW DEADLINE */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "الموعد النهائي الجديد *" : "NEW DEADLINE *"}
              </label>

              {/* Quick choices: [ Tomorrow ] [ In 3 days ] [ Next Monday ] */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "tomorrow", label: isAr ? "غداً" : "Tomorrow", date: format(addDays(new Date(), 1), "yyyy-MM-dd") },
                  { id: "in_3_days", label: isAr ? "خلال 3 أيام" : "In 3 days", date: format(addDays(new Date(), 3), "yyyy-MM-dd") },
                  { id: "next_monday", label: isAr ? "الإثنين القادم" : "Next Monday", date: getNextMonday() },
                ].map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      setPostponeDate(choice.date);
                      setSelectedQuickChoice(choice.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      postponeDate === choice.date
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>

              {/* Custom SADA Date Picker */}
              <SADADatePicker
                value={postponeDate}
                onChange={(dateStr) => {
                  setPostponeDate(dateStr);
                  setSelectedQuickChoice(null);
                }}
                placeholder={isAr ? "اختر الموعد النهائي الجديد..." : "Select new deadline date..."}
                minDate={new Date()}
                className="w-full"
              />
            </div>

            {/* REASON */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "السبب التشغيلي *" : "REASON *"}
              </label>

              {/* Structured reasons: [ Client delay ] [ Missing asset ] [ Waiting for approval ] [ Priority changed ] [ Capacity ] [ Other ] */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "Client delay", label: isAr ? "تأخر العميل" : "Client delay" },
                  { id: "Missing asset", label: isAr ? "ملفات ناقصة" : "Missing asset" },
                  { id: "Waiting for approval", label: isAr ? "بانتظار الموافقة" : "Waiting for approval" },
                  { id: "Priority changed", label: isAr ? "تغيير الأولويات" : "Priority changed" },
                  { id: "Capacity", label: isAr ? "ضغط العمل" : "Capacity" },
                  { id: "Other", label: isAr ? "سبب آخر" : "Other" },
                ].map(reasonChoice => (
                  <button
                    key={reasonChoice.id}
                    type="button"
                    onClick={() => {
                      setSelectedReasonChip(reasonChoice.id);
                      if (!postponeReason || postponeReason.includes("delay") || postponeReason.includes("asset") || postponeReason.includes("approval") || postponeReason.includes("Priority") || postponeReason.includes("Capacity") || postponeReason.includes("العميل") || postponeReason.includes("الموافقة")) {
                        setPostponeReason(reasonChoice.id === "Other" ? "" : `${reasonChoice.label}: `);
                      } else {
                        setPostponeReason(prev => `${reasonChoice.label} — ${prev}`);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      selectedReasonChip === reasonChoice.id
                        ? "bg-card text-foreground border-primary shadow-2xs font-bold ring-1 ring-primary/40"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
                    }`}
                  >
                    {reasonChoice.label}
                  </button>
                ))}
              </div>

              <SADATextarea
                required
                rows={3}
                placeholder={isAr ? "لماذا يحتاج التسليم للتأجيل؟ اذكر التفاصيل التشغيلية..." : "Why does this need to move? Specific operational details..."}
                value={postponeReason}
                onChange={e => setPostponeReason(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPostponeModal(false)}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton
                type="submit"
                variant="primary"
                size="sm"
                disabled={actionLoading === "postpone" || !postponeDate || !postponeReason.trim()}
                className="font-bold shadow-xs"
              >
                {actionLoading === "postpone"
                  ? (isAr ? "جاري التأجيل..." : "Postponing...")
                  : (isAr ? "تأكيد تأجيل التسليم" : "Postpone Deliverable")}
              </SADAButton>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: MARK TASK BLOCKED                                     */}
      {/* ============================================================== */}
      {showBlockModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleBlockSubmit}
            className="w-full max-w-md bg-card border border-rose-500/30 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-start"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <Ban className="size-4 shrink-0" /> {isAr ? "ما سبب توقف المهمة؟" : "WHY ARE YOU BLOCKED?"}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAr ? "أبلغ عن العائق والاعتماديات ليتمكن المشرفون من إزالة التعطيل." : "Flag deliverable dependency so leads can unblock execution."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "التصنيف *" : "Category *"}
              </label>
              <SADASelect
                value={blockCategory}
                onChange={val => setBlockCategory(val as BlockerCategory)}
                options={[
                  { value: "client", label: isAr ? "بانتظار العميل (موافقة / رد)" : "Waiting for Client" },
                  { value: "manager", label: isAr ? "بانتظار الإدارة والمشرف" : "Waiting for Manager" },
                  { value: "missing_asset", label: isAr ? "مواد وملفات ناقصة (صور، شعارات، تصوير)" : "Missing Assets (photos, logos, footage)" },
                  { value: "missing_info", label: isAr ? "معلومات وموجز ناقص" : "Missing Information" },
                  { value: "technical", label: isAr ? "عطل تقني أو برمجي" : "Technical Issue" },
                  { value: "other", label: isAr ? "عائق تشغيلي آخر" : "Other Blocker" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "السبب والتوضيح التشغيلي *" : "Reason / Explanation *"}
              </label>
              <SADATextarea
                required
                rows={3}
                placeholder={isAr ? "اشرح ما هو مفقود أو معطّل حتى يتمكن المشرفون من اتخاذ الإجراء المناسب..." : "Explain what is missing or blocking execution so managers can take action..."}
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowBlockModal(false)}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton
                type="submit"
                variant="destructive"
                size="sm"
                disabled={actionLoading === "block" || !blockReason.trim()}
                className="font-bold shadow-xs"
              >
                {actionLoading === "block"
                  ? (isAr ? "جاري التسجيل..." : "Flagging...")
                  : (isAr ? "تأكيد تسجيل العطل" : "Confirm Blocker")}
              </SADAButton>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: REQUEST CHANGES                                       */}
      {/* ============================================================== */}
      {showChangesModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleRequestChangesSubmit}
            className="w-full max-w-md bg-card border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-start"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <RotateCcw className="size-4 shrink-0" /> {isAr ? "طلب تعديلات على التسليم" : "Request Deliverable Changes"}
              </span>
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "ملاحظات المراجعة والتعليمات المطلوبة *" : "Review Feedback & Instructions *"}
              </label>
              <SADATextarea
                required
                rows={4}
                placeholder={isAr ? "حدد التعديلات المطلوبة بدقة (مثلاً: تعديل العنوان، ضبط المؤثرات الصوتية، تكبير حجم المنتج)..." : "Specify what needs adjustments (e.g. Change the headline, adjust sound design, make product larger)..."}
                value={changesFeedback}
                onChange={e => setChangesFeedback(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowChangesModal(false)}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton
                type="submit"
                variant="secondary"
                size="sm"
                disabled={actionLoading === "request_changes" || !changesFeedback.trim()}
                className="font-bold shadow-xs bg-amber-600 hover:bg-amber-700 text-white border-transparent"
              >
                {actionLoading === "request_changes"
                  ? (isAr ? "جاري الإرسال..." : "Sending...")
                  : (isAr ? "إرسال الملاحظات للمنفّذ" : "Send Feedback to Worker")}
              </SADAButton>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: SUBMIT FOR REVIEW (WITH DELIVERY NOTES & ASSET LINK)   */}
      {/* ============================================================== */}
      {showSubmitReviewModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReviewConfirm}
            className="w-full max-w-md bg-card border border-purple-500/30 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-start"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                <Send className="size-4 shrink-0 rtl:rotate-180" /> {isAr ? "إرسال التسليم للمراجعة والاعتماد" : "Submit Deliverable for Review"}
              </span>
              <button
                type="button"
                onClick={() => setShowSubmitReviewModal(false)}
                className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "ملخص العمل وملاحظات التسليم *" : "Delivery Notes / Summary of Work *"}
              </label>
              <SADATextarea
                required
                rows={3}
                placeholder={isAr ? "اشرح ما تم إنجازه أو تسليمه (مثلاً: تم الانتهاء من المونتاج الأولي والميكساج الصوتي وفقاً للموجز)..." : "Explain what was produced or delivered (e.g. Completed initial edit and sound mix according to brief)..."}
                value={reviewResultNotes}
                onChange={e => setReviewResultNotes(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold">
                {isAr ? "رابط الملف / التسليم (اختياري)" : "Asset Link / URL (Optional)"}
              </label>
              <SADAInput
                type="url"
                placeholder={isAr ? "رابط Google Drive أو Vimeo أو Figma..." : "https://drive.google.com/... or Vimeo / Figma URL"}
                value={reviewDeliveryLink}
                onChange={e => setReviewDeliveryLink(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <SADAButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSubmitReviewModal(false)}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton
                type="submit"
                variant="primary"
                size="sm"
                disabled={actionLoading === "submit_review" || !reviewResultNotes.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                {actionLoading === "submit_review" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5 rtl:rotate-180" />}
                <span>{isAr ? "إرسال للمراجعة" : "Submit for Review"}</span>
              </SADAButton>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      <SADAConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={isAr ? "حذف التسليم نهائياً؟" : "Permanently Delete Deliverable?"}
        description={
          isAr
            ? "هل أنت متأكد من رغبتك في حذف هذا التسليم نهائياً؟ هذا الإجراء متاح للمدير العام فقط ولا يمكن التراجع عنه."
            : "Are you sure you want to permanently delete this deliverable? This action is authorized for Super Admins only and cannot be undone."
        }
        confirmLabel={isAr ? "تأكيد حذف التسليم" : "Delete Deliverable"}
        cancelLabel={isAr ? "إلغاء" : "Cancel"}
        variant="destructive"
        onConfirm={() => {
          onClose();
          if (onDelete) onDelete(task.id);
        }}
      />
      {/* Phase 7: Complete Editing Modal */}
      {showCompleteEditingModal && (
        <CompleteEditingModal
          open={showCompleteEditingModal}
          onOpenChange={setShowCompleteEditingModal}
          editingTask={selectedStageForHandoff || task}
          parentTask={task.parent_task_id ? null : task}
          teamMembers={teamMembers as any}
          onCompleted={handleEditingHandoffCompleted}
        />
      )}

      {/* Phase 7: Publish Content Modal */}
      {showPublishContentModal && (
        <PublishContentModal
          open={showPublishContentModal}
          onOpenChange={setShowPublishContentModal}
          publishingTask={selectedStageForPublishing || task}
          parentTask={task.parent_task_id ? null : task}
          clientId={task.client_id || project?.client_id}
          onPublished={handlePublishingCompleted}
        />
      )}

      {/* Operational Task Alert Modal */}
      {showSendAlertModal && (
        <SendTaskAlertModal
          open={showSendAlertModal}
          onOpenChange={setShowSendAlertModal}
          task={task}
          teamMembers={teamMembers}
          profiles={profiles}
          clientName={project?.client_name}
          onSuccess={loadActivity}
        />
      )}
    </>
  );
}
