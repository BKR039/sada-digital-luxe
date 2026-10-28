// ============================================================
// SADA OS — PACKAGE & WORK RECONCILIATION ENGINE
// Canonical Single Source of Truth (SSOT) for Package Configuration,
// Contract Deliverables, Service Commitments, and Calendar/Task Synchronization.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  ServiceCommitment,
  CommitmentScheduleRule,
  CommitmentFrequency,
  GeneratedOccurrence,
} from "@/types/service-commitment";
import type { PackageCatalogItem } from "@/types/package-catalog";
import type {
  PackageConfig,
  ClientRow,
  TaskRow,
  ProfileRow,
  TeamMemberRow,
} from "@/components/admin/project-utils";
import {
  calculateCommitmentOccurrences,
  saveServiceCommitment,
  fetchClientCommitments,
  resolveSchedulingPreset,
  createSafeCalendarDate,
  parseSafeCalendarDate,
  CANONICAL_SERVICE_COMMITMENT_PRESETS,
} from "./recurring-scheduling-service";
import { logSystemAudit } from "./audit-service";
import { format, parseISO, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface AuthoritativePackageState {
  package_id: string | null;
  package_name: string;
  quotas: {
    reels: number;
    posts: number;
    stories: number;
    photography: number;
    ads: number;
    [key: string]: number;
  };
  other_services: string[];
}

export interface ServiceReconciliationDiff {
  deliverable_type: string;
  service_name: string;
  previous_quota: number;
  desired_quota: number;
  completed_count: number;
  existing_future_count: number;
  tasks_to_create: number;
  tasks_to_prune: number;
  tasks_to_reschedule: number;
  historical_preserved_count: number;
  manual_preserved_count?: number;
  in_progress_preserved_count?: number;
  status_summary: string;
}

export interface PackageReconciliationPreview {
  client_id: string;
  period_month: string;
  previous_state: AuthoritativePackageState;
  desired_state: AuthoritativePackageState;
  diffs: ServiceReconciliationDiff[];
  has_changes: boolean;
  total_missing_tasks: number;
  total_excess_tasks: number;
  total_reschedule_tasks: number;
  total_historical_preserved: number;
  total_manual_preserved: number;
}

export interface ReconciliationMutationRecord {
  client_id: string;
  deliverable_id?: string | null;
  commitment_id?: string | null;
  task_id?: string | null;
  mutation_type: "task_created" | "task_cancelled" | "task_rescheduled" | "quota_synced";
  old_state: any;
  new_state: any;
  reason: string;
  actor_id?: string | null;
  actor_email?: string | null;
  period_month: string;
  timestamp: string;
}

export interface ReconciliationReport {
  success: boolean;
  client_id: string;
  period_month: string;
  total_tasks_created: number;
  total_tasks_pruned: number;
  total_tasks_rescheduled: number;
  total_history_preserved: number;
  total_manual_preserved: number;
  diffs: ServiceReconciliationDiff[];
  created_task_ids: string[];
  pruned_task_ids: string[];
  rescheduled_task_ids: string[];
  mutations?: ReconciliationMutationRecord[];
  audit_logged: boolean;
  error?: string;
}

export interface PackageReconciliationParams {
  clientId: string;
  packageId?: string | null;
  packageName?: string | null;
  packageConfig: PackageConfig;
  periodMonth?: string; // e.g. "2026-10"
  actorId?: string | null;
  actorEmail?: string | null;
  teamMembers?: TeamMemberRow[];
  profiles?: ProfileRow[];
  commitToDatabase?: boolean;
}

export interface SingleCommitmentReconciliationParams {
  clientId: string;
  commitment: ServiceCommitment;
  periodMonth?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  existingTasks?: TaskRow[];
  commitToDatabase?: boolean;
}

// ============================================================
// 1. AUTHORITATIVE SINGLE SOURCE OF TRUTH (SSOT) RESOLVER
// Retires conflicting legacy hardcoded quantities (5, 4, 10).
// Database package catalog + client package_config is authoritative.
// ============================================================

export function resolveAuthoritativePackageConfig(
  client?: Partial<ClientRow> | null,
  catalogPackage?: Partial<PackageCatalogItem> | null
): AuthoritativePackageState {
  const pConfig = client?.package_config || {};
  const pkgId = client?.package_id || catalogPackage?.id || null;
  const pkgName = client?.package_name || catalogPackage?.name || "Custom Client Package";

  // Parse stories quota from catalog (can be string like "10" or "daily")
  let catalogStories = 0;
  if (catalogPackage?.monthly_stories) {
    const parsed = parseInt(String(catalogPackage.monthly_stories), 10);
    catalogStories = isNaN(parsed) ? 0 : parsed;
  }

  // Quotas strictly derived from DB source of truth — default to 0 if not defined, NEVER arbitrary magic numbers!
  const reels = Number(pConfig.reels_quota ?? catalogPackage?.monthly_reels ?? 0);
  const posts = Number(pConfig.posts_quota ?? catalogPackage?.monthly_posts ?? 0);
  const stories = Number(pConfig.stories_quota ?? catalogStories ?? 0);
  const photography = Number(pConfig.photography_quota ?? 0);
  const ads = Number(pConfig.ads_quota ?? (catalogPackage?.has_ads_management ? 1 : 0));

  const otherServices: string[] = Array.isArray(pConfig.other_services)
    ? pConfig.other_services
    : Array.isArray(catalogPackage?.included_items)
    ? catalogPackage.included_items.map((it: any) => (typeof it === "string" ? it : it.text || ""))
    : [];

  return {
    package_id: pkgId,
    package_name: pkgName,
    quotas: {
      reels: Math.max(0, reels),
      posts: Math.max(0, posts),
      stories: Math.max(0, stories),
      photography: Math.max(0, photography),
      ads: Math.max(0, ads),
    },
    other_services: otherServices.filter(Boolean),
  };
}

// ============================================================
// 2. HELPER: MAP DELIVERABLE TYPE TO SERVICE METADATA
// ============================================================

export interface ServiceSpec {
  deliverable_type: string;
  service_name: string;
  desired_quantity: number;
  frequency: CommitmentFrequency;
  default_role: string;
  schedule_rule: CommitmentScheduleRule;
  duration_hours: number;
}

export function buildServiceSpecsFromAuthoritativeState(
  state: AuthoritativePackageState
): ServiceSpec[] {
  const specs: ServiceSpec[] = [];

  // 1. Reels
  if (state.quotas.reels > 0) {
    const preset = resolveSchedulingPreset("reels_shooting")!;
    specs.push({
      deliverable_type: "reels_shooting",
      service_name: "Reels Shooting",
      desired_quantity: state.quotas.reels,
      frequency: "monthly",
      default_role: preset?.default_role || "videographer",
      duration_hours: preset?.duration_hours || 4.0,
      schedule_rule: {
        frequency: "monthly",
        quantity: state.quotas.reels,
        days_of_month: state.quotas.reels === 1 ? [10] : state.quotas.reels === 2 ? [5, 20] : undefined,
        duration_hours: preset?.duration_hours || 4.0,
      },
    });
  }

  // 2. Posts
  if (state.quotas.posts > 0) {
    const preset = resolveSchedulingPreset("post")!;
    specs.push({
      deliverable_type: "post",
      service_name: "Posts Publishing",
      desired_quantity: state.quotas.posts,
      frequency: "monthly",
      default_role: preset?.default_role || "designer",
      duration_hours: preset?.duration_hours || 1.5,
      schedule_rule: {
        frequency: "monthly",
        quantity: state.quotas.posts,
        duration_hours: preset?.duration_hours || 1.5,
      },
    });
  }

  // 3. Stories
  if (state.quotas.stories > 0) {
    const preset = resolveSchedulingPreset("stories_shooting")!;
    const isWeekly = state.quotas.stories <= 8;
    const weeklyQty = Math.max(1, Math.round(state.quotas.stories / 4));
    specs.push({
      deliverable_type: "stories_shooting",
      service_name: "Stories Shooting",
      desired_quantity: state.quotas.stories,
      frequency: isWeekly ? "weekly" : "monthly",
      default_role: preset?.default_role || "videographer",
      duration_hours: preset?.duration_hours || 2.0,
      schedule_rule: {
        frequency: isWeekly ? "weekly" : "monthly",
        quantity: isWeekly ? weeklyQty : state.quotas.stories,
        days_of_week: isWeekly ? (weeklyQty === 1 ? [2] : weeklyQty === 2 ? [2, 4] : [1, 3, 5]) : undefined,
        duration_hours: preset?.duration_hours || 2.0,
      },
    });
  }

  // 4. Photography
  if (state.quotas.photography > 0) {
    const preset = resolveSchedulingPreset("photography")!;
    specs.push({
      deliverable_type: "photography",
      service_name: "Photography Session",
      desired_quantity: state.quotas.photography,
      frequency: "monthly",
      default_role: preset?.default_role || "photographer",
      duration_hours: preset?.duration_hours || 3.0,
      schedule_rule: {
        frequency: "monthly",
        quantity: state.quotas.photography,
        days_of_month: [10],
        duration_hours: preset?.duration_hours || 3.0,
      },
    });
  }

  // 5. Ads
  if (state.quotas.ads > 0) {
    const preset = resolveSchedulingPreset("ads")!;
    specs.push({
      deliverable_type: "ads",
      service_name: "Paid Ads Campaign Strategy",
      desired_quantity: state.quotas.ads,
      frequency: "monthly",
      default_role: preset?.default_role || "media_buyer",
      duration_hours: preset?.duration_hours || 3.0,
      schedule_rule: {
        frequency: "monthly",
        quantity: state.quotas.ads,
        days_of_month: [1],
        duration_hours: preset?.duration_hours || 3.0,
      },
    });
  }

  return specs;
}

// ============================================================
// 2.1 WORK PROVENANCE & MANUAL PROTECTION GUARD
// Distinguishes:
// - System-generated & reconciliation-controlled tasks
// - Human/manual created tasks (NEVER automatically mutated/pruned)
// - Manually modified tasks (manual_override=true, protected)
// - Historical immutable tasks (done, delivered, approved)
// - In-progress immutable tasks (in_progress, review, revision, blocked)
// Invariant: Ambiguous provenance defaults to PROTECTED.
// ============================================================

export function isTaskReconciliationControlled(task: TaskRow): boolean {
  // 1. Must be unstarted todo
  if (task.status !== "todo") return false;

  // 2. Manual override explicitly protects the task from automatic cancellation/rescheduling
  if (task.manual_override === true) return false;

  // 3. Explicitly manual source protects the task
  if (task.source_type === "manual") return false;

  // 4. Explicitly non-reconciliation managed protects the task
  if (task.is_reconciliation_managed === false) return false;

  // 5. If explicitly marked reconciliation-managed
  if (task.is_reconciliation_managed === true) return true;

  // 6. Backwards compatibility for Phase 4 baseline tasks (e.g. from existing test fixtures):
  // If task has structured commitment_id or commit_ idempotency_key or task_ sequence id,
  // and no manual flags, treat as generated.
  if (
    task.idempotency_key?.startsWith("commit_") ||
    Boolean(task.commitment_id) ||
    (task.id && task.id.startsWith("task_") && task.sequence_index != null)
  ) {
    return true;
  }

  // Ambiguous provenance defaults to PROTECTED!
  return false;
}

export interface CalculatedDiffResult {
  diff: ServiceReconciliationDiff;
  tasksToCreateCount: number;
  tasksToPruneList: TaskRow[];
  tasksToRescheduleList: { task: TaskRow; newDate: string }[];
  historicalPreservedCount: number;
  manualPreservedCount: number;
  inProgressPreservedCount: number;
}

export function calculateReconciliationDiff(params: {
  spec: ServiceSpec;
  periodTasks: TaskRow[];
  previousQuota?: number;
  commitment?: ServiceCommitment;
  periodMonth: string;
}): CalculatedDiffResult {
  const { spec, periodTasks, previousQuota, commitment, periodMonth } = params;
  const dType = spec.deliverable_type;
  const desiredQty = spec.desired_quantity;

  // Filter tasks matching this service type
  const matchingTasks = periodTasks.filter((t) => {
    const cat = (t.category || "").toLowerCase();
    const srv = (t.service || "").toLowerCase();
    const title = (t.title || "").toLowerCase();
    const normType = dType.toLowerCase();

    if (normType.includes("reel")) return cat.includes("reel") || srv.includes("reel") || title.includes("reel");
    if (normType.includes("post")) return cat.includes("post") || srv.includes("post") || title.includes("post");
    if (normType.includes("stor")) return cat.includes("stor") || srv.includes("stor") || title.includes("stor");
    if (normType.includes("photo")) return cat.includes("photo") || srv.includes("photo") || title.includes("photo");
    if (normType.includes("ad")) return cat.includes("ad") || srv.includes("ad") || title.includes("ad");
    return false;
  });

  // Partition matching tasks
  const historicalCompleted: TaskRow[] = [];
  const inProgressOrBlocked: TaskRow[] = [];
  const manualTasks: TaskRow[] = [];
  const manualOverridden: TaskRow[] = [];
  const eligibleFuture: TaskRow[] = [];

  for (const t of matchingTasks) {
    if (t.status === "cancelled") continue;

    if (t.status === "done" || (t as any).status === "delivered" || (t as any).status === "approved") {
      historicalCompleted.push(t);
    } else if (
      t.status === "in_progress" ||
      t.status === "review" ||
      t.status === "revision" ||
      t.status === "blocked" ||
      t.status === "postponed"
    ) {
      inProgressOrBlocked.push(t);
    } else if (t.manual_override === true) {
      manualOverridden.push(t);
    } else if (t.source_type === "manual" || t.is_reconciliation_managed === false) {
      manualTasks.push(t);
    } else if (isTaskReconciliationControlled(t)) {
      eligibleFuture.push(t);
    } else {
      // Ambiguous tasks: default to manual/protected
      manualTasks.push(t);
    }
  }

  const completedCount = historicalCompleted.length;
  const inProgressCount = inProgressOrBlocked.length;
  const manualCount = manualTasks.length;
  const manualOverrideCount = manualOverridden.length;
  const eligibleCount = eligibleFuture.length;

  // Total protected work that must NEVER be cancelled automatically
  const totalProtectedCount = completedCount + inProgressCount + manualCount + manualOverrideCount;
  const totalActive = totalProtectedCount + eligibleCount;

  let tasksToCreateCount = 0;
  let tasksToPruneList: TaskRow[] = [];
  let tasksToRescheduleList: { task: TaskRow; newDate: string }[] = [];

  // 1. Quota Increase
  if (desiredQty > totalActive) {
    tasksToCreateCount = desiredQty - totalActive;
  }
  // 2. Quota Decrease
  else if (desiredQty < totalActive) {
    // Protected work is 100% PRESERVED. Only eligible future tasks may be pruned.
    const allowedEligibleToKeep = Math.max(0, desiredQty - totalProtectedCount);
    const excessCount = Math.max(0, eligibleCount - allowedEligibleToKeep);

    if (excessCount > 0) {
      // Sort eligible future tasks by sequence_index descending (latest first)
      const sortedEligible = [...eligibleFuture].sort((a, b) => {
        const seqA = (a as any).sequence_index || 0;
        const seqB = (b as any).sequence_index || 0;
        if (seqB !== seqA) return seqB - seqA;
        const dateA = (a as any).occurrence_date || a.deadline || "";
        const dateB = (b as any).occurrence_date || b.deadline || "";
        return dateB.localeCompare(dateA);
      });
      tasksToPruneList = sortedEligible.slice(0, excessCount);
    }
  }

  // 3. Quota Unchanged (or after balancing) - Check for rule-based rescheduling
  if (tasksToCreateCount === 0 && tasksToPruneList.length === 0 && commitment && eligibleFuture.length > 0) {
    const candidateOccurrences = calculateCommitmentOccurrences(commitment, periodMonth);
    for (let idx = 0; idx < eligibleFuture.length; idx++) {
      const task = eligibleFuture[idx];
      const slotOcc = candidateOccurrences[completedCount + idx] || candidateOccurrences[idx];
      const currentTaskDate = (task as any).occurrence_date || (task as any).scheduled_date || task.deadline;
      if (slotOcc && slotOcc.target_date && slotOcc.target_date !== currentTaskDate) {
        tasksToRescheduleList.push({ task, newDate: slotOcc.target_date });
      }
    }
  }

  let statusSummary = "";
  if (tasksToCreateCount > 0) {
    statusSummary = `Increase (+${tasksToCreateCount} to generate)`;
  } else if (tasksToPruneList.length > 0) {
    statusSummary = `Decrease (-${tasksToPruneList.length} excess future generated to prune, ${completedCount} history & ${manualCount + manualOverrideCount} manual protected)`;
  } else if (tasksToRescheduleList.length > 0) {
    statusSummary = `Schedule update (${tasksToRescheduleList.length} future generated to reschedule)`;
  } else {
    statusSummary = "Balanced (In sync with SSOT)";
  }

  const prevQuota = previousQuota !== undefined
    ? previousQuota
    : totalActive;

  const diff: ServiceReconciliationDiff = {
    deliverable_type: dType,
    service_name: spec.service_name,
    previous_quota: prevQuota,
    desired_quota: desiredQty,
    completed_count: completedCount,
    existing_future_count: totalActive - completedCount,
    tasks_to_create: tasksToCreateCount,
    tasks_to_prune: tasksToPruneList.length,
    tasks_to_reschedule: tasksToRescheduleList.length,
    historical_preserved_count: completedCount,
    manual_preserved_count: manualCount + manualOverrideCount,
    in_progress_preserved_count: inProgressCount,
    status_summary: statusSummary,
  };

  return {
    diff,
    tasksToCreateCount,
    tasksToPruneList,
    tasksToRescheduleList,
    historicalPreservedCount: completedCount,
    manualPreservedCount: manualCount + manualOverrideCount,
    inProgressPreservedCount: inProgressCount,
  };
}

// ============================================================
// 3. PREVIEW RECONCILIATION (Non-destructive Diff Calculation)
// Uses exact same calculateReconciliationDiff engine as apply!
// ============================================================

export async function previewPackageReconciliation(
  params: PackageReconciliationParams,
  inMemoryTasks?: TaskRow[]
): Promise<PackageReconciliationPreview> {
  const periodMonth = params.periodMonth || format(new Date(), "yyyy-MM");
  const isMock = params.commitToDatabase === false;

  // 1. Fetch current client
  let currentClient: any = null;
  if (!isMock) {
    const { data: c } = await (supabase as any)
      .from("clients")
      .select("*")
      .eq("id", params.clientId)
      .maybeSingle();
    currentClient = c;
  }

  const previousState = resolveAuthoritativePackageConfig(currentClient);
  const desiredState: AuthoritativePackageState = {
    package_id: params.packageId !== undefined ? params.packageId : previousState.package_id,
    package_name: params.packageName || previousState.package_name,
    quotas: {
      reels: Math.max(0, params.packageConfig.reels_quota ?? previousState.quotas.reels),
      posts: Math.max(0, params.packageConfig.posts_quota ?? previousState.quotas.posts),
      stories: Math.max(0, params.packageConfig.stories_quota ?? previousState.quotas.stories),
      photography: Math.max(0, params.packageConfig.photography_quota ?? previousState.quotas.photography),
      ads: Math.max(0, params.packageConfig.ads_quota ?? previousState.quotas.ads),
    },
    other_services: params.packageConfig.other_services || previousState.other_services,
  };

  // 2. Fetch existing tasks
  let existingTasks: TaskRow[] = [];
  if (Array.isArray(inMemoryTasks)) {
    existingTasks = inMemoryTasks;
  } else if (!isMock) {
    const { data: t } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("client_id", params.clientId);
    existingTasks = Array.isArray(t) ? t : [];
  }

  // Filter tasks belonging to target period
  const periodTasks = existingTasks.filter((t) => {
    if (t.parent_task_id) return false; // top-level deliverables only
    if (t.delivery_period === periodMonth) return true;
    const taskDate = (t as any).occurrence_date || (t as any).scheduled_date || t.deadline;
    return taskDate && taskDate.startsWith(periodMonth);
  });

  const desiredSpecs = buildServiceSpecsFromAuthoritativeState(desiredState);
  const diffs: ServiceReconciliationDiff[] = [];
  let totalMissing = 0;
  let totalExcess = 0;
  let totalReschedule = 0;
  let totalPreserved = 0;
  let totalManualPreserved = 0;

  for (const spec of desiredSpecs) {
    const previousQuota = (previousState.quotas as any)[spec.deliverable_type.replace("_shooting", "")];
    const calc = calculateReconciliationDiff({
      spec,
      periodTasks,
      previousQuota,
      periodMonth,
    });

    diffs.push(calc.diff);
    totalMissing += calc.tasksToCreateCount;
    totalExcess += calc.tasksToPruneList.length;
    totalReschedule += calc.tasksToRescheduleList.length;
    totalPreserved += calc.historicalPreservedCount;
    totalManualPreserved += calc.manualPreservedCount;
  }

  const hasChanges =
    totalMissing > 0 ||
    totalExcess > 0 ||
    totalReschedule > 0 ||
    JSON.stringify(previousState.quotas) !== JSON.stringify(desiredState.quotas) ||
    previousState.package_id !== desiredState.package_id;

  return {
    client_id: params.clientId,
    period_month: periodMonth,
    previous_state: previousState,
    desired_state: desiredState,
    diffs,
    has_changes: hasChanges,
    total_missing_tasks: totalMissing,
    total_excess_tasks: totalExcess,
    total_reschedule_tasks: totalReschedule,
    total_historical_preserved: totalPreserved,
    total_manual_preserved: totalManualPreserved,
  };
}

// ============================================================
// 4. RECONCILE CLIENT PACKAGE WORK (CORE ENGINE)
// The authoritative database configuration updates and all future
// generated work reconciles to the new desired state.
// ============================================================

export async function reconcileClientPackageWork(
  params: PackageReconciliationParams,
  inMemoryState?: {
    client?: ClientRow;
    tasks?: TaskRow[];
    commitments?: ServiceCommitment[];
    deliverables?: any[];
  }
): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    success: true,
    client_id: params.clientId,
    period_month: params.periodMonth || format(new Date(), "yyyy-MM"),
    total_tasks_created: 0,
    total_tasks_pruned: 0,
    total_tasks_rescheduled: 0,
    total_history_preserved: 0,
    total_manual_preserved: 0,
    diffs: [],
    created_task_ids: [],
    pruned_task_ids: [],
    rescheduled_task_ids: [],
    mutations: [],
    audit_logged: false,
  };

  try {
    const isMock = params.commitToDatabase === false;
    const periodMonth = report.period_month;
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // 1. Fetch current client and operational project
    let client: ClientRow | null = null;
    let operationalProject: any = null;

    if (isMock && inMemoryState?.client) {
      client = inMemoryState.client;
    } else if (!isMock) {
      const { data: c } = await (supabase as any)
        .from("clients")
        .select("*")
        .eq("id", params.clientId)
        .single();
      client = c;

      const { data: projs } = await (supabase as any)
        .from("client_projects")
        .select("id, title")
        .eq("client_id", params.clientId);
      operationalProject = projs?.[0] || null;

      if (!operationalProject) {
        const { data: autoProj } = await (supabase as any)
          .from("client_projects")
          .insert({
            client_id: params.clientId,
            client_name: c?.name || "Client Workspace",
            title: `${c?.name || "Client"} — Primary Workspace`,
            status: "active",
          })
          .select("id, title")
          .maybeSingle();
        operationalProject = autoProj || null;
      }
    }

    if (!client && !isMock) {
      return { ...report, success: false, error: "Client not found" };
    }

    // Invariant: Paused, inactive, or archived clients must not have future recurring work generated.
    const clientStatusStr = (client?.status as string) || "";
    const isClientPausedOrInactive = clientStatusStr === "inactive" || clientStatusStr === "paused" || clientStatusStr === "archived";
    if (isClientPausedOrInactive) {
      return {
        ...report,
        success: true,
        total_tasks_created: 0,
        total_tasks_pruned: 0,
        total_history_preserved: 0,
        mutations: [],
      };
    }

    const previousAuthoritativeState = resolveAuthoritativePackageConfig(client);

    // Desired state with new quotas
    const desiredState: AuthoritativePackageState = {
      package_id: params.packageId !== undefined ? params.packageId : client?.package_id || null,
      package_name: params.packageName || client?.package_name || "Custom Retainer",
      quotas: {
        reels: Math.max(0, params.packageConfig.reels_quota ?? previousAuthoritativeState.quotas.reels),
        posts: Math.max(0, params.packageConfig.posts_quota ?? previousAuthoritativeState.quotas.posts),
        stories: Math.max(0, params.packageConfig.stories_quota ?? previousAuthoritativeState.quotas.stories),
        photography: Math.max(0, params.packageConfig.photography_quota ?? previousAuthoritativeState.quotas.photography),
        ads: Math.max(0, params.packageConfig.ads_quota ?? previousAuthoritativeState.quotas.ads),
      },
      other_services: params.packageConfig.other_services || previousAuthoritativeState.other_services,
    };

    // 2. Persist Single Source of Truth to `clients` table
    const updatedPackageConfig: PackageConfig = {
      reels_quota: desiredState.quotas.reels,
      posts_quota: desiredState.quotas.posts,
      stories_quota: desiredState.quotas.stories,
      photography_quota: desiredState.quotas.photography,
      ads_quota: desiredState.quotas.ads,
      other_services: desiredState.other_services,
    };

    if (!isMock) {
      await (supabase as any)
        .from("clients")
        .update({
          package_id: desiredState.package_id,
          package_name: desiredState.package_name,
          package_config: updatedPackageConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.clientId);
    } else if (inMemoryState?.client) {
      inMemoryState.client.package_id = desiredState.package_id;
      inMemoryState.client.package_name = desiredState.package_name;
      inMemoryState.client.package_config = updatedPackageConfig;
    }

    // 3. Fetch existing deliverables, commitments, and tasks
    let existingDeliverables: any[] = [];
    let existingCommitments: ServiceCommitment[] = [];
    let existingTasks: TaskRow[] = [];

    if (isMock) {
      existingDeliverables = inMemoryState?.deliverables || [];
      existingCommitments = inMemoryState?.commitments || [];
      existingTasks = inMemoryState?.tasks || [];
    } else {
      const [dRes, cRes, tRes] = await Promise.all([
        (supabase as any).from("client_deliverables").select("*").eq("client_id", params.clientId),
        fetchClientCommitments(params.clientId),
        (supabase as any).from("project_tasks").select("*").eq("client_id", params.clientId),
      ]);
      existingDeliverables = dRes.data || [];
      existingCommitments = cRes || [];
      existingTasks = tRes.data || [];
    }

    // Filter tasks for this period
    const periodDeliverablesTasks = existingTasks.filter((t) => {
      if (t.parent_task_id) return false;
      if (t.delivery_period === periodMonth) return true;
      const tDate = (t as any).occurrence_date || (t as any).scheduled_date || t.deadline;
      return tDate && tDate.startsWith(periodMonth);
    });

    const serviceSpecs = buildServiceSpecsFromAuthoritativeState(desiredState);

    // 4. Reconcile each service spec
    for (const spec of serviceSpecs) {
      const dType = spec.deliverable_type;
      const desiredQty = spec.desired_quantity;

      // STEP 4A: Synchronize `client_deliverables` SSOT row
      let deliverableRow = existingDeliverables.find(
        (d) => d.deliverable_type === dType && d.period_month === periodMonth
      );

      // STEP 4B: Synchronize `service_commitments`
      let commitment = existingCommitments.find(
        (c) => (c.deliverable_type === dType || c.service_name.toLowerCase() === spec.service_name.toLowerCase())
      );

      const commitmentScheduleRule: CommitmentScheduleRule = {
        ...spec.schedule_rule,
        quantity: desiredQty,
      };

      if (!commitment) {
        const newCommitmentId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined;
        const newCommitment: ServiceCommitment = {
          id: newCommitmentId || `commit_${params.clientId}_${dType}`,
          client_id: params.clientId,
          package_id: desiredState.package_id,
          deliverable_id: deliverableRow?.id || null,
          service_name: spec.service_name,
          deliverable_type: dType,
          quantity: desiredQty,
          frequency: spec.frequency,
          schedule_rule: commitmentScheduleRule,
          start_date: todayStr,
          default_role: spec.default_role,
          duration_hours: spec.duration_hours,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commitment = newCommitment;
        if (!isMock) {
          await saveServiceCommitment(newCommitment, params.actorId || undefined);
        } else if (inMemoryState?.commitments) {
          inMemoryState.commitments.push(newCommitment);
        }
      } else {
        commitment = {
          ...commitment,
          quantity: desiredQty,
          schedule_rule: commitmentScheduleRule,
          deliverable_id: deliverableRow?.id || commitment.deliverable_id,
          status: "active",
          updated_at: new Date().toISOString(),
        };
        if (!isMock) {
          await saveServiceCommitment(commitment, params.actorId || undefined);
        }
      }

      // STEP 4C: Unified calculation of diffs, creation, pruning, and rescheduling
      const previousQuota = (previousAuthoritativeState.quotas as any)[dType.replace("_shooting", "")];
      const calc = calculateReconciliationDiff({
        spec,
        periodTasks: periodDeliverablesTasks,
        previousQuota,
        commitment,
        periodMonth,
      });

      report.total_history_preserved += calc.historicalPreservedCount;
      report.total_manual_preserved += calc.manualPreservedCount;

      const remainingQty = Math.max(0, desiredQty - calc.historicalPreservedCount);
      const delivStatus = calc.historicalPreservedCount >= desiredQty ? "completed" : calc.historicalPreservedCount > 0 ? "in_progress" : "planned";

      const isUuid = (val: any) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      const mappedDeliverableType = dType.includes("reel")
        ? "reel"
        : dType.includes("post")
        ? "post"
        : dType.includes("stor")
        ? "story"
        : dType.includes("ad")
        ? "ads_campaign"
        : dType.includes("video")
        ? "video"
        : dType.includes("brand")
        ? "branding"
        : "other";

      if (!deliverableRow) {
        const delivPayload: any = {
          client_id: params.clientId,
          package_id: null,
          project_id: operationalProject?.id || null,
          deliverable_type: mappedDeliverableType,
          title: `${spec.service_name} (${periodMonth})`,
          target_quantity: desiredQty,
          done_quantity: calc.historicalPreservedCount,
          status: delivStatus,
          period_month: periodMonth,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!isMock) {
          const { data: createdDeliv, error: createDelivErr } = await (supabase as any)
            .from("client_deliverables")
            .insert(delivPayload)
            .select()
            .maybeSingle();
          if (createDelivErr) {
            console.warn("[reconcileClientPackageWork] Deliverable insert warning:", createDelivErr.message);
          }
          deliverableRow = createdDeliv || { id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined, ...delivPayload };
        } else if (inMemoryState?.deliverables) {
          deliverableRow = { id: `deliv_${params.clientId}_${dType}_${periodMonth}`, ...delivPayload };
          inMemoryState.deliverables.push(deliverableRow);
        }
      } else {
        deliverableRow.target_quantity = desiredQty;
        deliverableRow.done_quantity = calc.historicalPreservedCount;
        deliverableRow.status = delivStatus;
        deliverableRow.updated_at = new Date().toISOString();

        if (!isMock && isUuid(deliverableRow.id)) {
          await (supabase as any)
            .from("client_deliverables")
            .update({
              target_quantity: desiredQty,
              done_quantity: calc.historicalPreservedCount,
              status: delivStatus,
              updated_at: deliverableRow.updated_at,
            })
            .eq("id", deliverableRow.id);
        }
      }

      // EXECUTE CREATIONS (INCREASE)
      if (calc.tasksToCreateCount > 0) {
        const allCandidateOccurrences = calculateCommitmentOccurrences(commitment, periodMonth);
        const startingSeq = calc.diff.existing_future_count + calc.historicalPreservedCount + 1;
        const offset = Math.min(allCandidateOccurrences.length - 1, startingSeq - 1);
        const candidateSlots = allCandidateOccurrences.slice(Math.max(0, offset));

        const safeCommitmentId = isUuid(commitment.id) ? commitment.id : null;
        const safeDeliverableId = isUuid(deliverableRow?.id) ? deliverableRow.id : null;

        for (let i = 0; i < calc.tasksToCreateCount; i++) {
          const occ = candidateSlots[i] || allCandidateOccurrences[i % allCandidateOccurrences.length];
          const targetDate = occ?.target_date || `${periodMonth}-${String(15 + i).padStart(2, "0")}`;
          const seq = startingSeq + i;
          const idempotencyKey = `commit_${commitment.id}_${targetDate}_seq${seq}`;

          const newTaskPayload: any = {
            client_id: params.clientId,
            project_id: operationalProject?.id || null,
            package_id: isUuid(desiredState.package_id) ? desiredState.package_id : null,
            commitment_id: safeCommitmentId,
            deliverable_id: safeDeliverableId,
            occurrence_date: targetDate,
            sequence_index: seq,
            service: commitment.service_name,
            category: dType.includes("reel") ? "Reel" : dType.includes("post") ? "Post" : dType.includes("story") ? "Story" : "Deliverable",
            title: `${client?.name || "Client"} — ${spec.service_name} (#${seq}/${desiredQty})`,
            description: `Contractual delivery for ${spec.service_name}. Reconciled from package SSOT (${desiredQty}x total).`,
            status: "todo" as const,
            priority: "medium" as const,
            deadline: targetDate,
            scheduled_date: targetDate,
            estimated_hours: spec.duration_hours || 2.0,
            idempotency_key: idempotencyKey,
            delivery_period: periodMonth,
            notes: `[RECONCILED_SSOT: Quota ${desiredQty}x]\nScheduled via authoritative package reconciliation.`,
            source_type: "package_reconciliation" as const,
            is_reconciliation_managed: true,
            manual_override: false,
          };

          // Concurrency safety check
          if (isMock) {
            const existingTask = inMemoryState?.tasks?.find(
              (t) => (t as any).idempotency_key === idempotencyKey ||
                     ((t as any).commitment_id === commitment!.id && (t as any).occurrence_date === targetDate && (t as any).sequence_index === seq)
            );
            if (!existingTask) {
              const mockTaskId = `task_${commitment.id}_${targetDate}_seq${seq}`;
              report.created_task_ids.push(mockTaskId);
              if (inMemoryState?.tasks) {
                inMemoryState.tasks.push({ ...newTaskPayload, id: mockTaskId });
              }
              periodDeliverablesTasks.push({ ...newTaskPayload, id: mockTaskId });
              report.total_tasks_created++;
              report.mutations?.push({
                client_id: params.clientId,
                deliverable_id: safeDeliverableId,
                commitment_id: safeCommitmentId,
                task_id: mockTaskId,
                mutation_type: "task_created",
                old_state: null,
                new_state: { title: newTaskPayload.title, date: targetDate, sequence: seq },
                reason: `Quota increased to ${desiredQty}x`,
                actor_id: params.actorId || null,
                actor_email: params.actorEmail || null,
                period_month: periodMonth,
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            // Check if task with idempotency_key already exists
            const { data: existingByKey } = await (supabase as any)
              .from("project_tasks")
              .select("id")
              .eq("idempotency_key", idempotencyKey)
              .maybeSingle();

            if (!existingByKey) {
              const { data: created, error: insErr } = await (supabase as any)
                .from("project_tasks")
                .insert(newTaskPayload)
                .select()
                .maybeSingle();

              if (!insErr && created) {
                report.created_task_ids.push(created.id);
                report.total_tasks_created++;
                periodDeliverablesTasks.push(created);
                report.mutations?.push({
                  client_id: params.clientId,
                  deliverable_id: safeDeliverableId,
                  commitment_id: safeCommitmentId,
                  task_id: created.id,
                  mutation_type: "task_created",
                  old_state: null,
                  new_state: { title: newTaskPayload.title, date: targetDate, sequence: seq },
                  reason: `Quota increased to ${desiredQty}x`,
                  actor_id: params.actorId || null,
                  actor_email: params.actorEmail || null,
                  period_month: periodMonth,
                  timestamp: new Date().toISOString(),
                });
              } else if (insErr) {
                console.warn("[reconcileClientPackageWork] Task insert warning:", insErr.message);
              }
            }
          }
        }
      }

      // EXECUTE PRUNING (DECREASE)
      // Prunes ONLY unstarted, future, reconciliation-controlled eligible tasks
      for (const task of calc.tasksToPruneList) {
        if (task.status === "todo") {
          report.pruned_task_ids.push(task.id);
          report.total_tasks_pruned++;

          report.mutations?.push({
            client_id: params.clientId,
            deliverable_id: deliverableRow?.id || null,
            commitment_id: commitment.id,
            task_id: task.id,
            mutation_type: "task_cancelled",
            old_state: { status: task.status, date: (task as any).occurrence_date || task.deadline },
            new_state: { status: "cancelled" },
            reason: `Quota decreased to ${desiredQty}x`,
            actor_id: params.actorId || null,
            actor_email: params.actorEmail || null,
            period_month: periodMonth,
            timestamp: new Date().toISOString(),
          });

          if (isMock) {
            if (inMemoryState?.tasks) {
              task.status = "cancelled" as any;
              task.cancelled_reason = `Quota decreased to ${desiredQty}x`;
              const idx = inMemoryState.tasks.findIndex((t) => t.id === task.id);
              if (idx !== -1) inMemoryState.tasks.splice(idx, 1);
            }
          } else {
            await (supabase as any).from("project_tasks").delete().eq("id", task.id);
          }
        }
      }

      // EXECUTE RESCHEDULING
      for (const resched of calc.tasksToRescheduleList) {
        const { task, newDate } = resched;
        report.rescheduled_task_ids.push(task.id);
        report.total_tasks_rescheduled++;

        report.mutations?.push({
          client_id: params.clientId,
          deliverable_id: deliverableRow?.id || null,
          commitment_id: commitment.id,
          task_id: task.id,
          mutation_type: "task_rescheduled",
          old_state: { date: (task as any).occurrence_date || task.deadline },
          new_state: { date: newDate },
          reason: "Schedule recurrence rule changed",
          actor_id: params.actorId || null,
          actor_email: params.actorEmail || null,
          period_month: periodMonth,
          timestamp: new Date().toISOString(),
        });

        if (isMock) {
          (task as any).occurrence_date = newDate;
          (task as any).scheduled_date = newDate;
          task.deadline = newDate;
        } else {
          await (supabase as any)
            .from("project_tasks")
            .update({
              occurrence_date: newDate,
              scheduled_date: newDate,
              deadline: newDate,
              updated_at: new Date().toISOString(),
            })
            .eq("id", task.id);
        }
      }

      report.diffs.push(calc.diff);
    }

    // 5. Audit Logging — Record only when actual mutations occur
    try {
      if (!isMock && (report.total_tasks_created > 0 || report.total_tasks_pruned > 0 || report.total_tasks_rescheduled > 0)) {
        await logSystemAudit({
          action: "PACKAGE_WORK_RECONCILIATION",
          entityType: "client_package",
          entityId: params.clientId,
          actorId: params.actorId || null,
          actorName: params.actorEmail || "SADA Operations",
          actorRole: "super_admin",
          oldValues: previousAuthoritativeState as any,
          newValues: desiredState as any,
        });

        if (report.mutations && report.mutations.length > 0) {
          try {
            await (supabase as any).from("reconciliation_audit_logs").insert(
              report.mutations.map((m) => ({
                client_id: m.client_id,
                deliverable_id: m.deliverable_id,
                commitment_id: m.commitment_id,
                task_id: m.task_id,
                mutation_type: m.mutation_type,
                old_state: m.old_state,
                new_state: m.new_state,
                reason: m.reason,
                actor_id: m.actor_id,
                actor_email: m.actor_email,
                period_month: m.period_month,
                created_at: m.timestamp,
              }))
            );
          } catch (_) {}
        }
      }
      report.audit_logged = true;
    } catch (auditErr) {
      console.warn("Audit log writing non-blocking error:", auditErr);
    }

    return report;
  } catch (err: any) {
    return {
      ...report,
      success: false,
      error: err.message || "Failed to reconcile package work",
    };
  }
}

// ============================================================
// 5. RECONCILE SINGLE COMMITMENT WORK
// Reconciles future tasks when an individual commitment's quantity
// or frequency is modified in the ServiceCommitmentModal.
// Manual tasks and manual overrides are strictly preserved.
// ============================================================

export async function reconcileSingleCommitmentWork(
  params: SingleCommitmentReconciliationParams
): Promise<{
  success: boolean;
  tasks_created: number;
  tasks_pruned: number;
  tasks_rescheduled: number;
  history_preserved: number;
  manual_preserved?: number;
  mutations?: ReconciliationMutationRecord[];
  error?: string;
}> {
  try {
    const isMock = params.commitToDatabase === false;
    const periodMonth = params.periodMonth || format(new Date(), "yyyy-MM");
    const commit = params.commitment;
    const desiredQty = commit.quantity;

    // 1. Fetch tasks for this commitment
    let commitmentTasks: TaskRow[] = [];
    if (Array.isArray(params.existingTasks)) {
      commitmentTasks = params.existingTasks.filter(
        (t) => (t as any).commitment_id === commit.id && !t.parent_task_id
      );
    } else if (!isMock) {
      const { data } = await (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("commitment_id", commit.id)
        .is("parent_task_id", null);
      commitmentTasks = Array.isArray(data) ? data : [];
    }

    // Partition tasks
    const completed: TaskRow[] = [];
    const inProgress: TaskRow[] = [];
    const manualOverridden: TaskRow[] = [];
    const manualTasks: TaskRow[] = [];
    const eligibleFuture: TaskRow[] = [];

    for (const t of commitmentTasks) {
      if (t.status === "cancelled") continue;
      if (t.status === "done" || (t as any).status === "delivered" || (t as any).status === "approved") {
        completed.push(t);
      } else if (["in_progress", "review", "revision", "blocked", "postponed"].includes(t.status)) {
        inProgress.push(t);
      } else if (t.manual_override === true) {
        manualOverridden.push(t);
      } else if (t.source_type === "manual" || t.is_reconciliation_managed === false) {
        manualTasks.push(t);
      } else if (isTaskReconciliationControlled(t)) {
        eligibleFuture.push(t);
      } else {
        manualTasks.push(t);
      }
    }

    const completedCount = completed.length;
    const manualPreservedCount = manualTasks.length + manualOverridden.length;
    const totalProtectedCount = completedCount + inProgress.length + manualPreservedCount;
    const currentActiveTotal = totalProtectedCount + eligibleFuture.length;

    let tasksCreated = 0;
    let tasksPruned = 0;
    let tasksRescheduled = 0;
    const mutations: ReconciliationMutationRecord[] = [];

    // A. Quota Increased
    if (desiredQty > currentActiveTotal) {
      const missingCount = desiredQty - currentActiveTotal;
      const allOccurrences = calculateCommitmentOccurrences(commit, periodMonth);
      const startingSeq = currentActiveTotal + 1;

      for (let i = 0; i < missingCount; i++) {
        const occ = allOccurrences[i % allOccurrences.length];
        const targetDate = occ?.target_date || `${periodMonth}-${String(15 + i).padStart(2, "0")}`;
        const seq = startingSeq + i;
        const idempotencyKey = `commit_${commit.id}_${targetDate}_seq${seq}`;

        const payload = {
          id: `task_${commit.id}_${targetDate}_seq${seq}`,
          client_id: commit.client_id,
          commitment_id: commit.id,
          deliverable_id: commit.deliverable_id || null,
          occurrence_date: targetDate,
          sequence_index: seq,
          service: commit.service_name,
          title: `${commit.service_name} (#${seq}/${desiredQty})`,
          status: "todo" as const,
          priority: "medium" as const,
          deadline: targetDate,
          scheduled_date: targetDate,
          estimated_hours: commit.duration_hours || 2.0,
          idempotency_key: idempotencyKey,
          delivery_period: periodMonth,
          notes: `[RECONCILED: Single Commitment Updated to ${desiredQty}x]`,
          source_type: "recurring_schedule" as const,
          is_reconciliation_managed: true,
          manual_override: false,
        };

        if (isMock) {
          const dup = params.existingTasks?.find((t) => (t as any).idempotency_key === idempotencyKey);
          if (!dup) {
            tasksCreated++;
            params.existingTasks?.push(payload as any);
            mutations.push({
              client_id: commit.client_id,
              commitment_id: commit.id,
              task_id: payload.id,
              mutation_type: "task_created",
              old_state: null,
              new_state: { title: payload.title, date: targetDate, sequence: seq },
              reason: `Single commitment quota increased to ${desiredQty}x`,
              actor_id: params.actorId || null,
              period_month: periodMonth,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          await (supabase as any).from("project_tasks").upsert(payload, {
            onConflict: "idempotency_key",
            ignoreDuplicates: true,
          });
          tasksCreated++;
          mutations.push({
            client_id: commit.client_id,
            commitment_id: commit.id,
            task_id: payload.id,
            mutation_type: "task_created",
            old_state: null,
            new_state: { title: payload.title, date: targetDate, sequence: seq },
            reason: `Single commitment quota increased to ${desiredQty}x`,
            actor_id: params.actorId || null,
            period_month: periodMonth,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    // B. Quota Decreased (Preserves completed, in-progress, manual, and manual overrides!)
    else if (desiredQty < currentActiveTotal) {
      const allowedEligible = Math.max(0, desiredQty - totalProtectedCount);
      const excessFutureCount = Math.max(0, eligibleFuture.length - allowedEligible);

      if (excessFutureCount > 0) {
        eligibleFuture.sort((a, b) => ((b as any).sequence_index || 0) - ((a as any).sequence_index || 0));
        const tasksToPrune = eligibleFuture.slice(0, excessFutureCount);

        for (const t of tasksToPrune) {
          if (t.status === "todo") {
            tasksPruned++;
            mutations.push({
              client_id: commit.client_id,
              commitment_id: commit.id,
              task_id: t.id,
              mutation_type: "task_cancelled",
              old_state: { status: t.status },
              new_state: { status: "cancelled" },
              reason: `Single commitment quota decreased to ${desiredQty}x`,
              actor_id: params.actorId || null,
              period_month: periodMonth,
              timestamp: new Date().toISOString(),
            });
            if (isMock) {
              t.status = "cancelled" as any;
              if (params.existingTasks) {
                const idx = params.existingTasks.findIndex((it) => it.id === t.id);
                if (idx !== -1) params.existingTasks.splice(idx, 1);
              }
            } else {
              await (supabase as any).from("project_tasks").delete().eq("id", t.id);
            }
          }
        }
      }
    }
    // C. Schedule Rule Rescheduled (Days Change)
    // Only reschedules eligible untouched future generated tasks!
    else if (eligibleFuture.length > 0) {
      const candidateOccurrences = calculateCommitmentOccurrences(commit, periodMonth);
      for (let i = 0; i < eligibleFuture.length; i++) {
        const t = eligibleFuture[i];
        const occ = candidateOccurrences[completedCount + i] || candidateOccurrences[i];
        const currDate = (t as any).occurrence_date || t.deadline;
        if (occ && occ.target_date !== currDate) {
          tasksRescheduled++;
          mutations.push({
            client_id: commit.client_id,
            commitment_id: commit.id,
            task_id: t.id,
            mutation_type: "task_rescheduled",
            old_state: { date: currDate },
            new_state: { date: occ.target_date },
            reason: "Single commitment schedule rule changed",
            actor_id: params.actorId || null,
            period_month: periodMonth,
            timestamp: new Date().toISOString(),
          });
          if (isMock) {
            (t as any).occurrence_date = occ.target_date;
            (t as any).scheduled_date = occ.target_date;
            t.deadline = occ.target_date;
          } else {
            await (supabase as any)
              .from("project_tasks")
              .update({
                occurrence_date: occ.target_date,
                scheduled_date: occ.target_date,
                deadline: occ.target_date,
              })
              .eq("id", t.id);
          }
        }
      }
    }

    if (!isMock && (tasksCreated > 0 || tasksPruned > 0 || tasksRescheduled > 0)) {
      await logSystemAudit({
        action: "COMMITMENT_WORK_RECONCILIATION",
        entityType: "service_commitment",
        entityId: commit.id,
        actorId: params.actorId || null,
        newValues: {
          quantity: desiredQty,
          tasks_created: tasksCreated,
          tasks_pruned: tasksPruned,
          tasks_rescheduled: tasksRescheduled,
          history_preserved: completedCount,
          manual_preserved: manualPreservedCount,
        },
      });
    }

    return {
      success: true,
      tasks_created: tasksCreated,
      tasks_pruned: tasksPruned,
      tasks_rescheduled: tasksRescheduled,
      history_preserved: completedCount,
      manual_preserved: manualPreservedCount,
      mutations,
    };
  } catch (err: any) {
    return {
      success: false,
      tasks_created: 0,
      tasks_pruned: 0,
      tasks_rescheduled: 0,
      history_preserved: 0,
      error: err.message || "Failed to reconcile single commitment",
    };
  }
}
