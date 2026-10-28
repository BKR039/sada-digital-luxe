// ============================================================
// SADA WORK OS — Task Execution Service
// Authoritative lifecycle transitions, activity audit logging,
// deterministic prioritization, and event notifications.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { emitNotification } from "@/lib/notification-service";
import { assertAuthorizedMutation } from "@/lib/security-isolation-service";
import type { TaskRow, TeamMemberRow, ProfileRow } from "@/components/admin/project-utils";
import { resolveToProfileId } from "@/components/admin/project-utils";
import { permissions, type PermissionContext } from "@/lib/permissions";
import { isPast, isToday, isTomorrow, parseISO, differenceInDays } from "date-fns";

export interface TaskActivityEntry {
  id: string;
  project_id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  details: any;
  created_at: string;
  actor?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
}

export type BlockerCategory =
  | "client"
  | "manager"
  | "missing_asset"
  | "missing_info"
  | "technical"
  | "other";

export const BLOCKER_CATEGORY_LABELS: Record<BlockerCategory, string> = {
  get client() {
    return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
      ? "بانتظار العميل"
      : "Waiting for Client";
  },
  get manager() {
    return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
      ? "بانتظار المدير"
      : "Waiting for Manager";
  },
  get missing_asset() {
    return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
      ? "مواد وتصميمات ناقصة"
      : "Missing Assets";
  },
  get missing_info() {
    return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
      ? "معلومات وتفاصيل ناقصة"
      : "Missing Information";
  },
  get technical() {
    return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
      ? "عائق تقني"
      : "Technical Issue";
  },
  get other() {
    return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
      ? "عائق آخر"
      : "Other Blocker";
  },
};

/**
 * Resilient activity logger — records audit event if permitted by RLS,
 * without failing the primary task state mutation.
 */
async function logTaskActivity(payload: {
  project_id: string;
  task_id: string;
  actor_id?: string | null;
  action: string;
  details: any;
  client?: any;
}) {
  try {
    const targetClient = payload.client || supabase;
    let authoritativeActorId = payload.actor_id;
    if (!authoritativeActorId) {
      try {
        const { data } = await targetClient.auth.getUser();
        if (data?.user?.id) {
          authoritativeActorId = data.user.id;
        }
      } catch {
        // fallback
      }
    }

    const { error } = await (targetClient as any).from("project_activity").insert({
      project_id: payload.project_id,
      task_id: payload.task_id,
      action: payload.action,
      details: payload.details,
      actor_id: authoritativeActorId,
    });
    if (error) {
      console.warn("[logTaskActivity] Non-fatal audit log notice:", error.message);
    }
  } catch (e) {
    console.warn("[logTaskActivity] Non-fatal exception:", e);
  }
}

/**
 * Resilient notification dispatcher — dispatches event without blocking execution.
 */
async function safeEmitNotification(params: Parameters<typeof emitNotification>[0]) {
  try {
    await emitNotification(params);
  } catch (e) {
    console.warn("[safeEmitNotification] Non-fatal dispatch notice:", e);
  }
}

/**
 * Workflow prerequisite stage guard:
 * Validates that all prior stages (with lower sort_order) under the same parent task
 * are completed ('done', 'approved', or 'delivered') before this stage can advance.
 */
export async function assertPrerequisiteStagesCompleted(
  client: any,
  task: TaskRow
): Promise<{ allowed: boolean; blockingStageTitle?: string }> {
  if (!task.parent_task_id || (task.sort_order || 0) <= 1) {
    return { allowed: true };
  }
  const { data: siblings, error } = await (client as any)
    .from("project_tasks")
    .select("id, title, sort_order, status")
    .eq("parent_task_id", task.parent_task_id)
    .order("sort_order", { ascending: true });

  if (error || !siblings || siblings.length === 0) {
    return { allowed: true };
  }

  const currentOrder = task.sort_order || 1;
  const incompletePrevious = siblings.find(
    (s: any) =>
      s.id !== task.id &&
      (s.sort_order || 0) < currentOrder &&
      s.status !== "done" &&
      s.status !== "approved" &&
      s.status !== "delivered"
  );

  if (incompletePrevious) {
    return {
      allowed: false,
      blockingStageTitle: incompletePrevious.title,
    };
  }
  return { allowed: true };
}

/**
 * 1. START TASK (todo -> in_progress)
 */
export async function startTask(params: {
  task: TaskRow;
  actorId: string;
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();

    // Workflow prerequisite stage guard: cannot start if previous stage is incomplete
    const prereqCheck = await assertPrerequisiteStagesCompleted(activeClient, params.task);
    if (!prereqCheck.allowed) {
      return {
        success: false,
        error: `Prerequisite stage "${prereqCheck.blockingStageTitle}" must be completed before starting this stage.`,
      };
    }

    const updatePayload: any = {
      status: "in_progress",
      updated_at: nowIso,
    };

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "task_started",
      client: activeClient,
      details: {
        started_at: nowIso,
        previous_status: params.task.status,
      },
    });

    return {
      success: true,
      updatedTask: updatePayload,
    };
  } catch (err: any) {
    console.error("[startTask] Error:", err);
    return { success: false, error: err.message || "Failed to start task" };
  }
}

/**
 * 2. PAUSE TASK (in_progress -> todo / paused)
 */
export async function pauseTask(params: {
  task: TaskRow;
  actorId: string;
  reason?: string;
  usePausedStatus?: boolean;
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: params.usePausedStatus ? "paused" : "todo",
      updated_at: nowIso,
    };

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "task_paused",
      client: activeClient,
      details: {
        paused_at: nowIso,
        reason: params.reason || null,
        status: updatePayload.status,
        is_subtask: Boolean(params.task.parent_task_id),
      },
    });

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[pauseTask] Error:", err);
    return { success: false, error: err.message || "Failed to pause task" };
  }
}

/**
 * 3. SUBMIT FOR REVIEW (in_progress -> review)
 */
export async function submitTaskForReview(params: {
  task: TaskRow;
  actorId: string;
  notes?: string;
  deliveryLinks?: string[];
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    // Workflow prerequisite stage guard: cannot advance to review if previous stage is incomplete
    const prereqCheck = await assertPrerequisiteStagesCompleted(activeClient, params.task);
    if (!prereqCheck.allowed) {
      return {
        success: false,
        error: `Prerequisite stage "${prereqCheck.blockingStageTitle}" must be completed before submitting this stage for review.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: "review",
      updated_at: nowIso,
    };
    if (params.notes !== undefined) updatePayload.result_notes = params.notes;
    if (params.deliveryLinks && params.deliveryLinks.length > 0) {
      updatePayload.result_links = params.deliveryLinks;
    }

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "review_requested",
      client: activeClient,
      details: {
        notes: params.notes || null,
        links: params.deliveryLinks || [],
        submitted_at: nowIso,
      },
    });

    // Notify Reviewer / Managers
    await safeEmitNotification({
      eventType: "GENERAL",
      title: "Deliverable Ready for Review",
      message: `"${params.task.title}" was submitted for review.`,
      userId: params.task.reviewer_id || undefined,
      roleTarget: params.task.reviewer_id ? undefined : "admin",
      category: "task",
      priority: "high",
      entityType: "task",
      entityId: params.task.id,
      linkUrl: `/admin/my-work?taskId=${params.task.id}`,
    });

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[submitTaskForReview] Error:", err);
    return { success: false, error: err.message || "Failed to submit for review" };
  }
}

/**
 * 4. REQUEST CHANGES (review -> in_progress with feedback)
 */
export async function requestTaskChanges(params: {
  task: TaskRow;
  actorId: string;
  feedback: string;
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();
    const nextRevision = (params.task.revision_count || 0) + 1;
    const updatePayload: any = {
      status: "in_progress",
      notes: params.feedback,
      revision_count: nextRevision,
      updated_at: nowIso,
    };

    const { error: updateErr } = await (supabase as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "changes_requested",
      details: {
        feedback: params.feedback,
        revision: nextRevision,
        requested_at: nowIso,
      },
    });

    // Notify Assignee
    if (params.task.assignee_id) {
      await safeEmitNotification({
        eventType: "TASK_ASSIGNED",
        title: "Changes Requested on Deliverable",
        message: `Feedback on "${params.task.title}": ${params.feedback}`,
        userId: params.task.assignee_id,
        category: "task",
        priority: "high",
        entityType: "task",
        entityId: params.task.id,
        linkUrl: `/admin/my-work?taskId=${params.task.id}`,
      });
    }

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[requestTaskChanges] Error:", err);
    return { success: false, error: err.message || "Failed to request changes" };
  }
}

/**
 * 5. APPROVE & COMPLETE TASK (review -> done / approved)
 */
export async function approveAndCompleteTask(params: {
  task: TaskRow;
  actorId: string;
  deliveryLinks?: string[];
  resultNotes?: string;
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.complete", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    // Workflow prerequisite stage guard: cannot approve if previous stage is incomplete
    const prereqCheck = await assertPrerequisiteStagesCompleted(activeClient, params.task);
    if (!prereqCheck.allowed) {
      return {
        success: false,
        error: `Prerequisite stage "${prereqCheck.blockingStageTitle}" must be completed before approving this stage.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: "done",
      completed_at: nowIso,
      completed_by: effectiveActorId,
      updated_at: nowIso,
    };
    if (params.deliveryLinks && params.deliveryLinks.length > 0) {
      updatePayload.result_links = params.deliveryLinks;
    }
    if (params.resultNotes !== undefined) {
      updatePayload.result_notes = params.resultNotes;
    }

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "approved",
      client: activeClient,
      details: {
        approved_at: nowIso,
        completed_by: effectiveActorId,
        delivery_links: params.deliveryLinks || params.task.result_links || [],
        is_subtask: Boolean(params.task.parent_task_id),
      },
    });

    // Notify Worker
    if (params.task.assignee_id && params.task.assignee_id !== effectiveActorId) {
      await safeEmitNotification({
        eventType: "GENERAL",
        title: "Deliverable Approved!",
        message: `"${params.task.title}" was approved and marked complete.`,
        userId: params.task.assignee_id,
        category: "task",
        priority: "normal",
        entityType: "task",
        entityId: params.task.id,
        linkUrl: `/admin/my-work?taskId=${params.task.id}`,
      });
    }

    // Workflow pipeline propagation: check next stage unlock (parent completion is independent)
    if (params.task.parent_task_id) {
      try {
        const { data: siblingStages } = await (supabase as any)
          .from("project_tasks")
          .select("id, title, sort_order, status, assignee_id")
          .eq("parent_task_id", params.task.parent_task_id)
          .order("sort_order", { ascending: true });

        if (siblingStages && siblingStages.length > 0) {
          const currentOrder = params.task.sort_order || 1;
          const nextStage = siblingStages.find((s: any) => (s.sort_order || 0) === currentOrder + 1);
          if (nextStage && nextStage.assignee_id) {
            await safeEmitNotification({
              eventType: "GENERAL",
              title: "Next Workflow Stage Ready!",
              message: `Stage "${params.task.title}" was approved. Your stage "${nextStage.title}" is now unlocked!`,
              userId: nextStage.assignee_id,
              category: "task",
              priority: "high",
              entityType: "task",
              entityId: nextStage.id,
              linkUrl: `/admin/my-work?taskId=${nextStage.id}`,
            });
          }
        }
      } catch (e) {
        console.warn("[workflow-progression] Non-fatal notice:", e);
      }
    }

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[approveAndCompleteTask] Error:", err);
    return { success: false, error: err.message || "Failed to approve task" };
  }
}

/**
 * 5b. DIRECT COMPLETE TASK (in_progress / todo -> done)
 * Logs activity 'completed' and records delivery details.
 * Phase F: Records completed_by, completed_at, drive_url. Parent task completion is independent.
 */
export async function completeTask(params: {
  task: TaskRow;
  actorId: string;
  deliveryLinks?: string[];
  driveUrl?: string;
  resultNotes?: string;
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.complete", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = params.actorId || authCtx.userId;

    // Workflow prerequisite stage guard: cannot complete if previous stage is incomplete
    const prereqCheck = await assertPrerequisiteStagesCompleted(activeClient, params.task);
    if (!prereqCheck.allowed) {
      return {
        success: false,
        error: `Prerequisite stage "${prereqCheck.blockingStageTitle}" must be completed before completing this stage.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: "done",
      completed_at: nowIso,
      completed_by: effectiveActorId,
      updated_at: nowIso,
    };
    if (params.driveUrl) {
      updatePayload.drive_url = params.driveUrl;
    }
    const combinedLinks = [
      ...(params.driveUrl ? [params.driveUrl] : []),
      ...(params.deliveryLinks || []),
    ];
    if (combinedLinks.length > 0) {
      updatePayload.result_links = Array.from(new Set([
        ...combinedLinks,
        ...(Array.isArray(params.task.result_links) ? params.task.result_links : []),
      ]));
    }
    if (params.resultNotes !== undefined) {
      updatePayload.result_notes = params.resultNotes;
    }

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity 'completed' (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "completed",
      client: activeClient,
      details: {
        completed_at: nowIso,
        completed_by: effectiveActorId,
        delivery_links: updatePayload.result_links || [],
        drive_url: params.driveUrl || (params.task as any).drive_url || null,
        notes: params.resultNotes || null,
        is_subtask: Boolean(params.task.parent_task_id),
        parent_task_id: params.task.parent_task_id || null,
      },
    });

    // Notify Assigner / Lead if completed by someone other than the assigner
    if (params.task.assigned_by_id && params.task.assigned_by_id !== effectiveActorId) {
      await safeEmitNotification({
        eventType: "GENERAL",
        title: "Deliverable Completed",
        message: `"${params.task.title}" has been completed.`,
        userId: params.task.assigned_by_id,
        category: "task",
        priority: "normal",
        entityType: "task",
        entityId: params.task.id,
        linkUrl: `/admin/my-work?taskId=${params.task.id}`,
      });
    }

    // Workflow pipeline propagation: unlock next stage (parent completion remains independent)
    if (params.task.parent_task_id) {
      try {
        const { data: siblingStages } = await (activeClient as any)
          .from("project_tasks")
          .select("id, title, sort_order, status, assignee_id")
          .eq("parent_task_id", params.task.parent_task_id)
          .order("sort_order", { ascending: true });

        if (siblingStages && siblingStages.length > 0) {
          const currentOrder = params.task.sort_order || 1;
          const nextStage = siblingStages.find((s: any) => (s.sort_order || 0) === currentOrder + 1);
          if (nextStage && nextStage.assignee_id) {
            await safeEmitNotification({
              eventType: "GENERAL",
              title: "Next Workflow Stage Ready!",
              message: `Stage "${params.task.title}" was completed. Your stage "${nextStage.title}" is now unlocked!`,
              userId: nextStage.assignee_id,
              category: "task",
              priority: "high",
              entityType: "task",
              entityId: nextStage.id,
              linkUrl: `/admin/my-work?taskId=${nextStage.id}`,
            });
          }
        }
      } catch (e) {
        console.warn("[workflow-progression] Non-fatal notice:", e);
      }
    }

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[completeTask] Error:", err);
    return { success: false, error: err.message || "Failed to complete task" };
  }
}

/**
 * 5c. AUTHORITATIVE TASK / SUBTASK STATUS TRANSITION ROUTER
 * Handles canonical workflow statuses:
 * todo, in_progress, review, revision, approved, delivered, postponed, paused, blocked, cancelled, done.
 */
export async function updateTaskStatus(params: {
  task: TaskRow;
  newStatus: TaskRow["status"];
  actorId?: string;
  reason?: string;
  deliveryLinks?: string[];
  driveUrl?: string;
  resultNotes?: string;
  ctx?: PermissionContext;
  actorRole?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  if (params.newStatus === "done" || params.newStatus === "delivered" || params.newStatus === "approved") {
    return completeTask({
      task: params.task,
      actorId: params.actorId || "",
      deliveryLinks: params.deliveryLinks,
      driveUrl: params.driveUrl,
      resultNotes: params.resultNotes,
      ctx: params.ctx,
      actorRole: params.actorRole,
      clientOverride: params.clientOverride,
    });
  }

  if (params.newStatus === "in_progress") {
    return startTask({
      task: params.task,
      actorId: params.actorId || "",
      ctx: params.ctx,
      actorRole: params.actorRole,
      clientOverride: params.clientOverride,
    });
  }

  if (params.newStatus === "review") {
    return submitTaskForReview({
      task: params.task,
      actorId: params.actorId || "",
      notes: params.resultNotes,
      deliveryLinks: params.deliveryLinks,
      ctx: params.ctx,
      actorRole: params.actorRole,
      clientOverride: params.clientOverride,
    });
  }

  if (params.newStatus === "blocked") {
    return markTaskBlocked({
      task: params.task,
      actorId: params.actorId || "",
      reason: params.reason || "Task marked blocked",
      category: "other",
      ctx: params.ctx,
      actorRole: params.actorRole,
    });
  }

  if (params.newStatus === "postponed") {
    return postponeTask({
      task: params.task,
      actorId: params.actorId || "",
      newDeadline: params.task.deadline || new Date().toISOString().split("T")[0],
      reason: params.reason || "Postponed",
      ctx: params.ctx,
      actorRole: params.actorRole,
    });
  }

  if (params.newStatus === "paused") {
    return pauseTask({
      task: params.task,
      actorId: params.actorId || "",
      reason: params.reason,
      usePausedStatus: true,
      ctx: params.ctx,
      actorRole: params.actorRole,
      clientOverride: params.clientOverride,
    });
  }

  // Handle generic status updates ('todo', 'revision', 'cancelled', etc.)
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;
    const nowIso = new Date().toISOString();

    const updatePayload: any = {
      status: params.newStatus,
      updated_at: nowIso,
    };
    if (params.newStatus === "todo") {
      updatePayload.completed_at = null;
      updatePayload.completed_by = null;
    }
    if (params.reason && params.newStatus === "cancelled") {
      updatePayload.cancelled_reason = params.reason;
    }

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: `status_${params.newStatus}`,
      client: activeClient,
      details: {
        from_status: params.task.status,
        to_status: params.newStatus,
        reason: params.reason || null,
        is_subtask: Boolean(params.task.parent_task_id),
        parent_task_id: params.task.parent_task_id || null,
      },
    });

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[updateTaskStatus] Error:", err);
    return { success: false, error: err.message || "Failed to update task status" };
  }
}

/**
 * 6. POSTPONE TASK (sets new deadline, status=postponed, logs reason)
 */
export async function postponeTask(params: {
  task: TaskRow;
  actorId: string;
  newDeadline: string;
  reason: string;
  ctx?: PermissionContext;
  actorRole?: string;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const authCtx = await assertAuthorizedMutation(supabase, "tasks", "tasks.change_due_date", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: "postponed",
      deadline: params.newDeadline,
      postpone_reason: params.reason,
      updated_at: nowIso,
    };

    const { error: updateErr } = await (supabase as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "postponed",
      details: {
        original_deadline: params.task.deadline,
        new_deadline: params.newDeadline,
        reason: params.reason,
        postponed_at: nowIso,
      },
    });

    // Notify Manager / Assigner
    await safeEmitNotification({
      eventType: "GENERAL",
      title: "Deliverable Postponed",
      message: `"${params.task.title}" postponed to ${params.newDeadline}. Reason: ${params.reason}`,
      roleTarget: "admin",
      category: "task",
      priority: "normal",
      entityType: "task",
      entityId: params.task.id,
      linkUrl: `/admin/my-work?taskId=${params.task.id}`,
    });

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[postponeTask] Error:", err);
    return { success: false, error: err.message || "Failed to postpone task" };
  }
}

/**
 * 7. MARK AS BLOCKED (status=blocked, sets blocked_reason & waiting_on)
 */
export async function markTaskBlocked(params: {
  task: TaskRow;
  actorId: string;
  reason: string;
  category: BlockerCategory;
  ctx?: PermissionContext;
  actorRole?: string;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const authCtx = await assertAuthorizedMutation(supabase, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: "blocked",
      blocked_reason: params.reason,
      waiting_on: params.category,
      updated_at: nowIso,
    };

    const { error: updateErr } = await (supabase as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "blocked",
      details: {
        reason: params.reason,
        category: params.category,
        category_label: BLOCKER_CATEGORY_LABELS[params.category] || params.category,
        blocked_at: nowIso,
      },
    });

    // Alert Admin / Lead
    await safeEmitNotification({
      eventType: "GENERAL",
      title: "🚨 Task Blocked",
      message: `"${params.task.title}" is blocked: ${params.reason}`,
      roleTarget: "admin",
      category: "task",
      priority: "urgent",
      entityType: "task",
      entityId: params.task.id,
      linkUrl: `/admin/my-work?taskId=${params.task.id}`,
    });

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[markTaskBlocked] Error:", err);
    return { success: false, error: err.message || "Failed to mark task blocked" };
  }
}

/**
 * 8. RESOLVE BLOCKER / RESUME (status=in_progress, clears blocker)
 */
export async function resolveTaskBlocker(params: {
  task: TaskRow;
  actorId: string;
  resolutionNote?: string;
  ctx?: PermissionContext;
  actorRole?: string;
}): Promise<{ success: boolean; updatedTask?: Partial<TaskRow>; error?: string }> {
  try {
    const authCtx = await assertAuthorizedMutation(supabase, "tasks", "tasks.change_status", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: "in_progress",
      blocked_reason: null,
      waiting_on: null,
      updated_at: nowIso,
    };

    const { error: updateErr } = await (supabase as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.task.id);

    if (updateErr) throw updateErr;

    // Log Activity (resilient)
    await logTaskActivity({
      project_id: params.task.project_id,
      task_id: params.task.id,
      actor_id: effectiveActorId,
      action: "unblocked",
      details: {
        previous_reason: params.task.blocked_reason,
        resolution_note: params.resolutionNote || "Blocker resolved by team member",
        unblocked_at: nowIso,
      },
    });

    return { success: true, updatedTask: updatePayload };
  } catch (err: any) {
    console.error("[resolveTaskBlocker] Error:", err);
    return { success: false, error: err.message || "Failed to resolve blocker" };
  }
}

/**
 * 9. ADD ACTIVITY NOTE / COMMENT
 */
export async function addTaskNote(params: {
  task: TaskRow;
  actorId: string;
  note: string;
  ctx?: PermissionContext;
  actorRole?: string;
}): Promise<{ success: boolean; entry?: TaskActivityEntry; error?: string }> {
  try {
    const authCtx = await assertAuthorizedMutation(supabase, "tasks", "tasks.edit", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: params.task,
      resourceAction: "write",
    });
    const effectiveActorId = authCtx.userId || params.actorId;

    const nowIso = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from("project_activity")
      .insert({
        project_id: params.task.project_id,
        task_id: params.task.id,
        actor_id: effectiveActorId,
        action: "note_added",
        details: {
          note: params.note,
          created_at: nowIso,
        },
      })
      .select("*")
      .single();

    if (error) throw error;
    return { success: true, entry: data };
  } catch (err: any) {
    console.error("[addTaskNote] Error:", err);
    return { success: false, error: err.message || "Failed to add note" };
  }
}

/**
 * 10. FETCH TASK ACTIVITY TIMELINE
 */
export async function fetchTaskActivity(taskId: string, client?: any): Promise<TaskActivityEntry[]> {
  try {
    const activeClient = client || supabase;
    const { data, error } = await (activeClient as any)
      .from("project_activity")
      .select("*, actor:profiles(id, display_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[fetchTaskActivity] Error:", err);
    return [];
  }
}

/**
 * 11. DETERMINISTIC "NEXT TASK" SCORING ENGINE
 * Evaluates candidate tasks and deterministically returns the highest priority action item
 * along with transparent rationale.
 */
export function computeNextTask(tasks: TaskRow[]): {
  nextTask: TaskRow | null;
  rationale: string[];
} {
  // Exclude non-executable statuses
  const candidates = tasks.filter((t) => {
    if (
      t.status === "done" ||
      t.status === "approved" ||
      t.status === "cancelled" ||
      t.status === "blocked" || // Cannot work on blocked task next
      t.status === "review" // Waiting for manager review
    ) {
      return false;
    }

    // Exclude postponed tasks that are not currently due for execution
    if (t.status === "postponed") {
      if (!t.deadline) return false;
      const dl = parseISO(t.deadline);
      if (!isToday(dl) && !isPast(dl)) return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    return { nextTask: null, rationale: ["All assigned deliverables are completed, in review, or clear."] };
  }

  const scored = candidates.map((task) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. In Progress momentum (+500)
    if (task.status === "in_progress") {
      score += 500;
      reasons.push("⚡ Currently in progress — Resume execution");
    }

    // 2. Overdue (+1000 + days overdue)
    if (task.deadline) {
      const dl = parseISO(task.deadline);
      if (isPast(dl) && !isToday(dl)) {
        const days = Math.abs(differenceInDays(new Date(), dl));
        score += 1000 + days * 100;
        reasons.push(`🚨 Overdue by ${days} day${days > 1 ? "s" : ""} — Immediate priority`);
      } else if (isToday(dl)) {
        score += 350;
        reasons.push("📅 Due today by close of business");
      } else if (isTomorrow(dl)) {
        score += 150;
        reasons.push("⏰ Due tomorrow — Prepare production");
      }
    }

    // 3. Priority Weighting
    if (task.priority === "urgent") {
      score += 400;
      reasons.push("🔥 Urgent priority deliverable");
    } else if (task.priority === "high") {
      score += 250;
      reasons.push("⭐ High priority client deliverable");
    } else if (task.priority === "medium") {
      score += 100;
    }

    // 4. Instructions / Brief available
    if (task.notes || task.description) {
      score += 20;
    }

    // 5. Task age tie-breaker (older tasks get modest priority)
    if (task.created_at) {
      const ageDays = differenceInDays(new Date(), parseISO(task.created_at));
      score += Math.min(ageDays * 2, 50);
    }

    // Baseline guarantee: no blockers
    reasons.push("✓ No blockers detected • Clear to execute");

    return { task, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    nextTask: best.task,
    rationale: best.reasons,
  };
}

/**
 * 12. HELPER: Check if a task was previously started or paused
 */
export function isTaskPaused(task: TaskRow, pausedTaskIds?: Set<string>): boolean {
  if (task.status === "paused") return true;
  if (task.status !== "todo") return false;
  if (pausedTaskIds && pausedTaskIds.has(task.id)) return true;
  return false;
}

/**
 * 13. EXECUTION PRIORITY TIERS (Derived from execution urgency)
 * - TIER 1 — CRITICAL
 * - TIER 2 — HIGH
 * - TIER 3 — NORMAL
 * - TIER 4 — UPCOMING
 */
export type ExecutionTier = "CRITICAL" | "HIGH" | "NORMAL" | "UPCOMING";

export interface ExecutionTierInfo {
  tier: ExecutionTier;
  label: string; // e.g. "TIER 1 · CRITICAL"
  badgeClass: string;
}

export function computeTaskExecutionTier(task: TaskRow): ExecutionTierInfo {
  const isFinished = task.status === "done" || task.status === "approved" || task.status === "delivered";
  if (isFinished) {
    return {
      tier: "NORMAL",
      label: "COMPLETED",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  }

  const d = task.deadline ? parseISO(task.deadline) : null;
  const isOverdue = d ? isPast(d) && !isToday(d) : false;
  const isDueToday = d ? isToday(d) : false;
  const isDueTomorrow = d ? isTomorrow(d) : false;
  const isUrgent = task.priority === "urgent";
  const isHigh = task.priority === "high";
  const isInProgress = task.status === "in_progress";

  // TIER 1 — CRITICAL: Overdue, or (Urgent/High and Due Today), or (Urgent and In Progress)
  if (isOverdue || (isUrgent && isDueToday) || (isHigh && isDueToday && isInProgress)) {
    return {
      tier: "CRITICAL",
      label: "TIER 1 · CRITICAL",
      badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    };
  }

  // TIER 2 — HIGH: High priority due today, or Urgent due tomorrow, or In Progress high priority
  if (isDueToday || (isUrgent && isDueTomorrow) || (isHigh && isInProgress) || isHigh) {
    return {
      tier: "HIGH",
      label: "TIER 2 · HIGH",
      badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    };
  }

  // TIER 3 — NORMAL: Due tomorrow, or Medium priority in progress, or medium priority
  if (isDueTomorrow || task.priority === "medium" || isInProgress) {
    return {
      tier: "NORMAL",
      label: "TIER 3 · NORMAL",
      badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    };
  }

  // TIER 4 — UPCOMING: Low priority or due in future
  return {
    tier: "UPCOMING",
    label: "TIER 4 · UPCOMING",
    badgeClass: "bg-muted text-muted-foreground border-border",
  };
}

/**
 * 14. HELPER: Calculate human-readable blocked duration
 */
export function computeBlockedDuration(updatedAt?: string | null): string {
  if (!updatedAt) return "< 1h";
  try {
    const diffMs = Date.now() - parseISO(updatedAt).getTime();
    if (diffMs <= 0) return "< 1m";
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24) return `${hours}h ${remMins}m`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  } catch {
    return "< 1h";
  }
}

/**
 * 15. UPDATE SUBTASK ASSIGNEE
 * Authoritative, isolated subtask reassignment service.
 * - Enforces role authorization (Admins/Super Admins, or authorized delegators).
 * - Denies unauthorized workers server/service side.
 * - Updates only target task/subtask's assignee_id in public.project_tasks.
 * - Records audit activity in public.project_activity.
 * - Emits notification strictly to the new assignee (no duplicate or cross-task spam).
 * - Leaves parent task and sibling subtasks completely untouched.
 */
export async function updateSubtaskAssignee(params: {
  taskId: string;
  newAssigneeId: string | null;
  actorCtx: PermissionContext;
  actorId?: string;
  teamMembers?: TeamMemberRow[];
  profiles?: ProfileRow[];
  reason?: string;
  isMock?: boolean;
  clientOverride?: any;
  client?: any;
}): Promise<{
  success: boolean;
  updatedTask?: Partial<TaskRow>;
  error?: string;
}> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.assign", {
      ctx: params.actorCtx,
      actorRole: params.actorCtx?.role || undefined,
      actorId: params.actorId || params.actorCtx?.userId || undefined,
      resourceType: "project_task",
      resource: { id: params.taskId },
      resourceAction: "write",
    });

    if (params.isMock) {
      return {
        success: true,
        updatedTask: {
          id: params.taskId,
          assignee_id: params.newAssigneeId,
        },
      };
    }

    // 2. Fetch current task
    const { data: currentTask, error: fetchErr } = await (activeClient as any)
      .from("project_tasks")
      .select("id, project_id, title, assignee_id, parent_task_id, previous_assignee_id")
      .eq("id", params.taskId)
      .maybeSingle();

    if (fetchErr || !currentTask) {
      return {
        success: false,
        error: fetchErr?.message || "Task not found",
      };
    }

    // 3. Resolve assignee to canonical profile_id
    const resolvedProfileId = params.newAssigneeId
      ? resolveToProfileId(params.newAssigneeId, params.teamMembers, params.profiles) || params.newAssigneeId
      : null;

    const prevAssigneeId = currentTask.assignee_id;
    const nowIso = new Date().toISOString();

    const updatePayload: any = {
      assignee_id: resolvedProfileId,
      previous_assignee_id: prevAssigneeId || null,
      updated_at: nowIso,
    };

    const { error: updateErr } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.taskId);

    if (updateErr) throw updateErr;

    // 4. Log Activity in project_activity (resilient)
    await logTaskActivity({
      project_id: currentTask.project_id,
      task_id: currentTask.id,
      actor_id: authCtx.userId || params.actorId || params.actorCtx.userId || null,
      action: "reassigned",
      details: {
        actor_role: authCtx.role,
        from_assignee_id: prevAssigneeId,
        to_assignee_id: resolvedProfileId,
        is_subtask: Boolean(currentTask.parent_task_id),
        parent_task_id: currentTask.parent_task_id || null,
        reason: params.reason || "Subtask assignee updated",
      },
      client: activeClient,
    });

    // 5. Emit isolated notification strictly to the new assignee
    if (resolvedProfileId && resolvedProfileId !== prevAssigneeId) {
      await safeEmitNotification({
        eventType: "GENERAL",
        title: currentTask.parent_task_id ? "Subtask Reassigned" : "Task Reassigned",
        message: `You were assigned to: "${currentTask.title}"`,
        userId: resolvedProfileId,
        category: "task",
        priority: "normal",
        entityType: "task",
        entityId: currentTask.id,
        linkUrl: `/admin/my-work?taskId=${currentTask.id}`,
      });
    }

    return {
      success: true,
      updatedTask: {
        id: currentTask.id,
        assignee_id: resolvedProfileId,
        previous_assignee_id: prevAssigneeId,
        updated_at: nowIso,
      },
    };
  } catch (err: any) {
    console.error("[updateSubtaskAssignee] Error:", err);
    return {
      success: false,
      error: err.message || "Failed to update subtask assignee",
    };
  }
}

/**
 * 16. CREATE PROJECT TASK
 */
export async function createProjectTask(params: {
  taskData: Partial<TaskRow> & { project_id: string; title: string };
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;

    // Subtask creation must route through createProjectSubtask to verify tasks.create_subtask and parent authority
    if (params.taskData.parent_task_id) {
      return createProjectSubtask({
        parentTaskId: params.taskData.parent_task_id,
        subtaskData: params.taskData,
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        clientOverride: params.clientOverride,
      });
    }

    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.create", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
    });
    const nowIso = new Date().toISOString();
    const insertPayload = {
      ...params.taskData,
      assigned_by_id: params.taskData.assigned_by_id || authCtx.userId,
      created_by: (params.taskData as any).created_by || params.taskData.assigned_by_id || authCtx.userId,
      due_date: (params.taskData as any).due_date || params.taskData.deadline || null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw error;
    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx.userId,
      action: "task_created",
      details: { title: data.title },
      client: activeClient,
    });
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create task" };
  }
}

/**
 * 17. CREATE PROJECT SUBTASK
 * Phase E: Resource-level Task Authority
 * Formula: global permission AND (Super Admin OR creator OR main assignee)
 */
export async function createProjectSubtask(params: {
  parentTaskId: string;
  subtaskData: Partial<TaskRow> & { project_id?: string; title: string };
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  clientOverride?: any;
  client?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;

    // 1. Fetch parent task to inspect authority and default inheritance
    const { data: parentTask, error: parentErr } = await (activeClient as any)
      .from("project_tasks")
      .select("id, project_id, client_id, assigned_by_id, assignee_id, priority, deadline")
      .eq("id", params.parentTaskId)
      .maybeSingle();

    if (parentErr || !parentTask) {
      throw new Error(parentErr?.message || "Parent task not found");
    }

    // 2. Authoritative security mutation gate with resource-level authority check
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.create_subtask", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: {
        _isSubtaskCreation: true,
        parentTask,
      },
      resourceAction: "write",
    });

    const nowIso = new Date().toISOString();

    // 3. Subtask Assignee Inheritance:
    // Defaults to the parent task's current main assignee if not explicitly specified
    const resolvedAssigneeId = params.subtaskData.assignee_id !== undefined
      ? params.subtaskData.assignee_id
      : (parentTask.assignee_id || null);

    const insertPayload = {
      project_id: parentTask.project_id || params.subtaskData.project_id,
      client_id: params.subtaskData.client_id || parentTask.client_id || null,
      priority: params.subtaskData.priority || parentTask.priority || "medium",
      deadline: params.subtaskData.deadline || parentTask.deadline || null,
      due_date: (params.subtaskData as any).due_date || params.subtaskData.deadline || parentTask.deadline || null,
      ...params.subtaskData,
      parent_task_id: params.parentTaskId,
      assignee_id: resolvedAssigneeId,
      assigned_by_id: params.subtaskData.assigned_by_id || authCtx.userId,
      created_by: (params.subtaskData as any).created_by || params.subtaskData.assigned_by_id || authCtx.userId,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) throw error;

    // 4. Log Audit Activity (resilient)
    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx.userId,
      action: "subtask_created",
      details: {
        title: data.title,
        parent_task_id: params.parentTaskId,
        assignee_id: data.assignee_id,
      },
      client: activeClient,
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create subtask" };
  }
}

/**
 * 18. UPDATE PROJECT TASK DEFINITION (Admin exclusive definition edits)
 */
export async function updateProjectTaskDefinition(params: {
  taskId: string;
  updates: Partial<TaskRow>;
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  clientOverride?: any;
  client?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;

    // Granular permission gates based on modified fields:
    if (params.updates.assignee_id !== undefined) {
      await assertAuthorizedMutation(activeClient, "tasks", "tasks.assign", {
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        resourceType: "project_task",
        resource: { id: params.taskId, assignee_id: params.updates.assignee_id, _isAssignmentChange: true },
        resourceAction: "write",
      });
    }

    if (params.updates.priority !== undefined) {
      await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_priority", {
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        resourceType: "project_task",
        resource: { id: params.taskId, priority: params.updates.priority, _isPriorityChange: true },
        resourceAction: "write",
      });
    }

    if (params.updates.deadline !== undefined || (params.updates as any).due_date !== undefined) {
      await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_due_date", {
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        resourceType: "project_task",
        resource: { id: params.taskId, deadline: params.updates.deadline, _isDueDateChange: true },
        resourceAction: "write",
      });
    }

    if ((params.updates as any).drive_url !== undefined || params.updates.result_links !== undefined) {
      await assertAuthorizedMutation(activeClient, "tasks", "tasks.add_deliverable", {
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        resourceType: "project_task",
        resource: { id: params.taskId, drive_url: (params.updates as any).drive_url, _isDeliverableChange: true },
        resourceAction: "write",
      });
    }

    const hasDefinitionFields =
      params.updates.title !== undefined ||
      params.updates.description !== undefined ||
      params.updates.category !== undefined ||
      params.updates.service !== undefined ||
      (params.updates as any).billing_rate !== undefined ||
      params.updates.estimated_minutes !== undefined;

    let authCtx: any = null;
    if (hasDefinitionFields || Object.keys(params.updates).length === 0) {
      authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.edit", {
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        resourceType: "project_task",
        resource: { id: params.taskId, _isDefinitionChange: true },
        resourceAction: "write",
      });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      ...params.updates,
      updated_at: nowIso,
    };
    if (params.updates.deadline && !(params.updates as any).due_date) {
      updatePayload.due_date = params.updates.deadline;
    }

    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.taskId)
      .select("*")
      .single();

    if (error) throw error;

    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx?.userId || params.actorId,
      action: "task_updated",
      details: { updates: params.updates },
      client: activeClient,
    });
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update task" };
  }
}

/**
 * 19. DELETE PROJECT TASK (Locked unconditionally to Super Admin)
 */
export async function deleteProjectTask(params: {
  taskId: string;
  projectId?: string;
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  clientOverride?: any;
  client?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;
    await assertAuthorizedMutation(activeClient, "tasks", "tasks.delete", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: { id: params.taskId },
      resourceAction: "delete",
    });
    const { error } = await (activeClient as any)
      .from("project_tasks")
      .delete()
      .eq("id", params.taskId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete task" };
  }
}

/**
 * 20. GRANULAR TASK ACTION MUTATIONS (Phase G)
 */

export async function updateTaskPriority(params: {
  taskId: string;
  priority: TaskRow["priority"];
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_priority", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: { id: params.taskId, priority: params.priority, _isPriorityChange: true },
      resourceAction: "write",
    });

    const nowIso = new Date().toISOString();
    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update({ priority: params.priority, updated_at: nowIso })
      .eq("id", params.taskId)
      .select("*")
      .single();

    if (error) throw error;

    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx.userId || params.actorId,
      action: "priority_changed",
      details: { new_priority: params.priority },
      client: activeClient,
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update priority" };
  }
}

export async function updateTaskDueDate(params: {
  taskId: string;
  dueDate: string;
  deadline?: string;
  reason?: string;
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.change_due_date", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: { id: params.taskId, due_date: params.dueDate, _isDueDateChange: true },
      resourceAction: "write",
    });

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      due_date: params.dueDate,
      deadline: params.deadline || params.dueDate,
      updated_at: nowIso,
    };
    if (params.reason) {
      updatePayload.postpone_reason = params.reason;
    }

    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.taskId)
      .select("*")
      .single();

    if (error) throw error;

    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx.userId || params.actorId,
      action: "due_date_changed",
      details: { new_due_date: params.dueDate, reason: params.reason || null },
      client: activeClient,
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update due date" };
  }
}

export async function assignProjectTask(params: {
  taskId: string;
  assigneeId: string | null;
  reason?: string;
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.assign", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: { id: params.taskId, assignee_id: params.assigneeId, _isAssignmentChange: true },
      resourceAction: "write",
    });

    const nowIso = new Date().toISOString();
    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update({ assignee_id: params.assigneeId, updated_at: nowIso })
      .eq("id", params.taskId)
      .select("*")
      .single();

    if (error) throw error;

    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx.userId || params.actorId,
      action: "assignee_changed",
      details: { new_assignee_id: params.assigneeId, reason: params.reason || null },
      client: activeClient,
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign task" };
  }
}

export async function addTaskDeliverable(params: {
  taskId: string;
  deliverableUrl: string;
  notes?: string;
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const { data: currentTask, error: fetchErr } = await (activeClient as any)
      .from("project_tasks")
      .select("*")
      .eq("id", params.taskId)
      .maybeSingle();

    if (fetchErr || !currentTask) throw new Error("Task not found");

    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.add_deliverable", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resource: { ...currentTask, _isDeliverableChange: true },
      resourceAction: "write",
    });

    const nowIso = new Date().toISOString();
    const existingLinks: string[] = Array.isArray(currentTask.result_links) ? currentTask.result_links : [];
    const updatedLinks = Array.from(new Set([...existingLinks, params.deliverableUrl]));
    const updatePayload: any = {
      result_links: updatedLinks,
      updated_at: nowIso,
    };
    if (params.deliverableUrl.includes("drive.google.com")) {
      updatePayload.drive_url = params.deliverableUrl;
    }
    if (params.notes) {
      updatePayload.result_notes = params.notes;
    }

    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", params.taskId)
      .select("*")
      .single();

    if (error) throw error;

    await logTaskActivity({
      project_id: data.project_id,
      task_id: data.id,
      actor_id: authCtx.userId || params.actorId,
      action: "deliverable_added",
      details: { url: params.deliverableUrl, notes: params.notes || null },
      client: activeClient,
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add deliverable" };
  }
}

export async function bulkUpdateTasksStatus(params: {
  taskIds: string[];
  newStatus: TaskRow["status"];
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const requiredAction = (params.newStatus === "done" || params.newStatus === "delivered" || params.newStatus === "approved")
      ? "tasks.complete"
      : "tasks.change_status";

    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", requiredAction, {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
    });

    // Validate resource scope and task-level authorization for each target task
    const { data: targetTasks, error: fetchErr } = await (activeClient as any)
      .from("project_tasks")
      .select("id, title, project_id, parent_task_id, sort_order, assignee_id, status")
      .in("id", params.taskIds);

    if (fetchErr) throw fetchErr;

    // Prerequisite stage checks on all target tasks if advancing status
    if (params.newStatus === "in_progress" || params.newStatus === "review" || params.newStatus === "done" || params.newStatus === "delivered" || params.newStatus === "approved") {
      for (const t of targetTasks || []) {
        const prereq = await assertPrerequisiteStagesCompleted(activeClient, t);
        if (!prereq.allowed) {
          return {
            success: false,
            updatedCount: 0,
            error: `Cannot update status: stage "${t.title || t.id}" requires prerequisite stage "${prereq.blockingStageTitle}" to be completed first.`,
          };
        }
      }
    }

    for (const t of targetTasks || []) {
      await assertAuthorizedMutation(activeClient, "tasks", requiredAction, {
        ctx: params.ctx,
        actorRole: params.actorRole,
        actorId: params.actorId,
        resourceType: "project_task",
        resource: t,
        resourceAction: "write",
      });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = { status: params.newStatus, updated_at: nowIso };
    if (params.newStatus === "done" || params.newStatus === "delivered" || params.newStatus === "approved") {
      updatePayload.completed_at = nowIso;
      updatePayload.completed_by = authCtx.userId || params.actorId || null;
    }

    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update(updatePayload)
      .in("id", params.taskIds)
      .select("id, project_id");

    if (error) throw error;

    for (const t of data || []) {
      await logTaskActivity({
        project_id: t.project_id,
        task_id: t.id,
        actor_id: authCtx.userId || params.actorId,
        action: "bulk_status_changed",
        details: { new_status: params.newStatus },
        client: activeClient,
      });
    }

    return { success: true, updatedCount: data?.length || 0 };
  } catch (err: any) {
    return { success: false, updatedCount: 0, error: err.message || "Failed to bulk update status" };
  }
}

export async function bulkAssignTasks(params: {
  taskIds: string[];
  assigneeId: string | null;
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "tasks", "tasks.assign", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
    });

    const nowIso = new Date().toISOString();
    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .update({ assignee_id: params.assigneeId, updated_at: nowIso })
      .in("id", params.taskIds)
      .select("id, project_id");

    if (error) throw error;

    for (const t of data || []) {
      await logTaskActivity({
        project_id: t.project_id,
        task_id: t.id,
        actor_id: authCtx.userId || params.actorId,
        action: "bulk_assigned",
        details: { assignee_id: params.assigneeId },
        client: activeClient,
      });
    }

    return { success: true, updatedCount: data?.length || 0 };
  } catch (err: any) {
    return { success: false, updatedCount: 0, error: err.message || "Failed to bulk assign tasks" };
  }
}

export async function bulkDeleteTasks(params: {
  taskIds: string[];
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const activeClient = params.clientOverride || supabase;
    await assertAuthorizedMutation(activeClient, "tasks", "tasks.delete", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "project_task",
      resourceAction: "delete",
    });

    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .delete()
      .in("id", params.taskIds)
      .select("id");

    if (error) throw error;
    return { success: true, deletedCount: data?.length || 0 };
  } catch (err: any) {
    return { success: false, deletedCount: 0, error: err.message || "Failed to bulk delete tasks" };
  }
}



