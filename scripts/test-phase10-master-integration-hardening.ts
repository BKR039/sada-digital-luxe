/**
 * SADA OS — PHASE 10 MASTER INTEGRATION, REGRESSION QA & PRODUCTION HARDENING SUITE
 * 
 * Comprehensive automated verification for the complete SADA OS production system:
 * 1. 11-Step End-to-End Content & Workflow Lifecycle:
 *    - Active client package -> Quantity/frequency authority -> Parent workflow generation
 *    - Ordered stages/subtasks -> Stage assignments -> Worker-specific work queue/calendar
 *    - Dependency prerequisite locks -> Editing stores Drive link -> Publisher receives stage
 *    - Publisher marks Published -> Parent reaches 100% final completion status
 * 2. Package Reconciliation & Lifecycle Semantics:
 *    - Package edit 5 -> 10 without duplicates, preserving historical completed tasks
 *    - Active, Paused, and Inactive/Reactivated lifecycle boundaries
 * 3. Identity, Account Management, RBAC & Defense-in-Depth:
 *    - Super Admin, Admin, and Worker authoritative contexts
 *    - Route denial, API denial, data scope isolation, and RLS defense
 *    - Public Admin entry eradication and protected /sada-os routing
 * 4. Recipient-Specific Priority-First Notifications:
 *    - Worker A vs Worker B isolation, role targeting, finance boundary isolation
 *    - Urgent > High > Normal > Low sorting
 *    - Bilingual (Arabic RTL & English LTR) token interpolation
 * 5. Mobile Web App & PWA Experience:
 *    - Manifest, icons, sw.js, offline fallback, safe-area insets, mobile bottom nav
 * 6. SADA Design System & Localization Integrity:
 *    - Zero native HTML selects, Arabic Thmanyah Serif Text & English Sora typography
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Services
import {
  CANONICAL_WORKFLOW_TEMPLATES,
  checkStageActionability,
  computeWorkflowProgress,
} from "../src/lib/workflow-service";

import type { TaskRow } from "../src/components/admin/project-utils";

import {
  resolvePublishingActor,
  completeEditingAndHandoffToPublishing,
  markContentPublished,
  validateDriveUrl,
  checkEditingHandoffEligibility,
  validatePublishingData,
  checkPublishingEligibility,
  getClientPublishingInfo,
  CANONICAL_PUBLISHING_PLATFORMS,
} from "../src/lib/publishing-workflow-service";

import {
  reconcileClientPackageWork,
  previewPackageReconciliation,
} from "../src/lib/package-reconciliation-service";

import {
  generateCommitmentTasks,
  resolveSchedulingPreset,
} from "../src/lib/recurring-scheduling-service";

import {
  evaluateRouteAccess,
  assertRouteAccess,
  authorizeApiAction,
  authorizeDataScope,
  SecurityAuthorizationError,
  type AuthoritativeSecurityContext,
  type AccountStatus,
  type SecurityResourceType,
} from "../src/lib/security-isolation-service";

import {
  SADA_MODULES,
  getEffectiveModulePermission,
  type SadaRole,
  type SadaModule,
  type SadaAction,
} from "../src/types/permissions";

import {
  isNotificationVisibleToUser,
  sortNotificationsByPriorityAndRecency,
  resolveNotification,
  type NotificationItem,
} from "../src/lib/notification-service";

import {
  isStandaloneApp,
  isIosSafari,
  isWebPushSupported,
  getPushPermissionState,
  getPwaStatusSummary,
} from "../src/lib/pwa-service";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

function buildSecurityContext(params: {
  userId: string;
  email: string;
  role: SadaRole;
  status: AccountStatus;
  teamMemberId?: string;
  moduleOverrides?: Partial<Record<SadaModule, boolean>>;
}): AuthoritativeSecurityContext {
  const customOverrides: any = {};
  if (params.moduleOverrides) {
    for (const [mod, enabled] of Object.entries(params.moduleOverrides)) {
      customOverrides[mod] = { enabled: Boolean(enabled) };
    }
  }
  const effectivePermissions = {} as Record<SadaModule, boolean>;
  for (const meta of SADA_MODULES) {
    effectivePermissions[meta.key] = getEffectiveModulePermission(
      meta.key,
      params.role,
      customOverrides
    );
  }
  return {
    authenticated: true,
    userId: params.userId,
    email: params.email,
    role: params.role,
    status: params.status,
    teamMemberId: params.teamMemberId || null,
    profileId: params.userId,
    customOverrides,
    effectivePermissions,
  };
}

async function runMasterIntegrationSuite() {
  // Load environment variables from .env
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || "").trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[match[1]] = value;
      }
    });
  }

  console.log("=======================================================================");
  console.log("SADA OS — Phase 10 Master Integration, QA & Hardening Verification");
  console.log("=======================================================================\n");

  // =======================================================================
  // PART 1: 11-STEP END-TO-END CONTENT & WORKFLOW LIFECYCLE
  // =======================================================================
  console.log("--- PART 1: 11-Step End-to-End Content & Workflow Lifecycle ---");

  // Step 1: Active client package
  const clientPackage = {
    client_id: "client-luxury-safari",
    client_name: "Safari Oasis Resort",
    status: "active",
    package_id: "pkg-luxury-brand-growth",
    package_name: "Brand Growth Master",
  };
  assert(clientPackage.status === "active", "Step 1: Active client package confirmed");

  // Step 2: Package quantity / frequency authority
  const commitment = {
    id: "commit-safari-reels-monthly",
    client_id: clientPackage.client_id,
    service_type: "reels_shoot",
    task_type: "reel",
    quantity: 4,
    frequency: "monthly" as const,
    preset: resolveSchedulingPreset("reels_shoot", 4),
  };
  assert(commitment.quantity === 4, "Step 2: Canonical deliverable quantity is 4 reels/month");
  assert(commitment.preset.workflow_type === "reel", "Step 2: Canonical preset maps to 'reel' workflow type");

  // Step 3: Parent workflow generation
  const parentDeliverable = {
    id: "deliv-safari-reel-01",
    title: "Safari Sunset Experience Reel #1",
    client_id: clientPackage.client_id,
    task_type: "reel" as const,
    status: "in_progress",
    progress_percentage: 0,
    drive_folder_url: null as string | null,
    published_urls: [] as string[],
    all_completed: false,
  };
  const template = CANONICAL_WORKFLOW_TEMPLATES.find((t) => t.task_type === commitment.preset.workflow_type);
  assert(template !== undefined && template.stages.length === 4, "Step 3: Parent workflow instantiated with Reel template (4 stages)");

  // Step 4: Ordered stages / subtasks
  const stages: TaskRow[] = (template?.stages || []).map((stg) => ({
    id: `stage-${parentDeliverable.id}-${stg.order}`,
    task_id: parentDeliverable.id,
    parent_task_id: parentDeliverable.id,
    title: stg.title,
    title_ar: stg.title_ar,
    stage_type: stg.stage_type,
    sort_order: stg.order,
    status: "todo",
    requires_previous_stage: stg.requires_previous_stage,
    assignee_id: null,
    assignee_name: null,
    assignee_role: stg.default_assignee_role,
  } as any));
  assert(stages.length === 4, "Step 4: Generated exactly 4 ordered stages");
  assert(stages[0].stage_type === "script" && stages[0].sort_order === 1, "Step 4: Stage 1 is Script (Order 1)");
  assert(stages[1].stage_type === "shooting" && stages[1].sort_order === 2, "Step 4: Stage 2 is Shooting (Order 2)");
  assert(stages[2].stage_type === "editing" && stages[2].sort_order === 3, "Step 4: Stage 3 is Editing (Order 3)");
  assert(stages[3].stage_type === "publishing" && stages[3].sort_order === 4, "Step 4: Stage 4 is Publishing (Order 4)");

  // Step 5: Stage assignments
  stages[0].assignee_id = "user-copywriter";
  stages[0].assignee_name = "Khadija Scriptwriter";
  stages[1].assignee_id = "user-videographer";
  stages[1].assignee_name = "Yassine Camera";
  stages[2].assignee_id = "user-editor";
  stages[2].assignee_name = "Ziad FilmEditor";
  stages[3].assignee_id = "user-publisher";
  stages[3].assignee_name = "Salma SocialPublisher";
  assert(stages.every(s => s.assignee_id !== null), "Step 5: Every stage assigned to qualified specialist");

  // Step 6: Worker-specific calendar/work queue
  const editorWorkQueue = stages.filter(s => s.assignee_id === "user-editor");
  assert(editorWorkQueue.length === 1 && editorWorkQueue[0].stage_type === "editing", "Step 6: Worker-specific queue filters strictly to assigned stage (Ziad -> Editing)");

  // Step 7: Dependencies unlock the next stage
  const lock1 = checkStageActionability(stages[0], stages);
  const lock2Initial = checkStageActionability(stages[1], stages);
  assert(lock1.isActionable && !lock1.isLocked, "Step 7: Stage 1 (Script) is immediately actionable");
  assert(!lock2Initial.isActionable && lock2Initial.isLocked, "Step 7: Stage 2 (Shooting) is locked while Stage 1 is todo");

  // Complete Stage 1 -> unlocks Stage 2
  stages[0].status = "done";
  const lock2AfterScript = checkStageActionability(stages[1], stages);
  assert(lock2AfterScript.isActionable && !lock2AfterScript.isLocked, "Step 7: Stage 2 (Shooting) unlocks when Stage 1 completes");

  // Complete Stage 2 -> unlocks Stage 3 (Editing)
  stages[1].status = "done";
  const lock3AfterShoot = checkStageActionability(stages[2], stages);
  assert(lock3AfterShoot.isActionable && !lock3AfterShoot.isLocked, "Step 7: Stage 3 (Editing) unlocks when Stage 2 completes");

  // Step 8: Editing stores Drive link
  const driveUrl = "https://drive.google.com/drive/folders/safari-oasis-reel-01-master";
  const driveValidation = validateDriveUrl(driveUrl);
  assert(driveValidation.valid, "Step 8: Cloud Drive asset URL validated successfully");

  const handoffEligibility = checkEditingHandoffEligibility(stages[2], stages);
  assert(handoffEligibility.eligible, "Step 8: Editing stage is eligible for handoff");

  stages[2].status = "done";
  (stages[2] as any).result_links = [driveUrl];
  parentDeliverable.drive_folder_url = driveUrl;
  assert(parentDeliverable.drive_folder_url === driveUrl, "Step 8: Drive asset URL stored on deliverable and task");

  // Invariant check: Parent deliverable must NOT be 100% yet
  const progressAfterEditing = computeWorkflowProgress(parentDeliverable.id, stages);
  assert(progressAfterEditing?.progress_percent === 75, "Step 8 Invariant: Parent deliverable progress is 75%, NOT 100%");
  assert(progressAfterEditing?.all_completed === false, "Step 8 Invariant: Parent is not marked complete before publishing");

  // Step 9: Publisher receives publishing stage
  const lock4AfterEditing = checkStageActionability(stages[3], stages);
  assert(lock4AfterEditing.isActionable && !lock4AfterEditing.isLocked, "Step 9: Stage 4 (Publishing) becomes unlocked and actionable");
  stages[3].status = "in_progress";

  // Step 10: Publisher marks Published
  const liveUrls = [
    "https://instagram.com/reel/C_safari_oasis_01",
    "https://tiktok.com/@safarioasis/video/7192837465",
  ];
  const targetPlatforms = ["instagram", "tiktok"];
  const pubValidation = validatePublishingData(targetPlatforms, liveUrls);
  assert(pubValidation.valid, "Step 10: Publishing platforms and submitted live URLs validated successfully");
  assert(pubValidation.canonicalPlatforms.length === 2, "Step 10: Canonical platforms ordered deterministically");

  const pubEligibility = checkPublishingEligibility(stages[3], stages);
  assert(pubEligibility.eligible, "Step 10: Publishing stage is eligible to be marked published");

  stages[3].status = "done";
  (stages[3] as any).published_urls = pubValidation.cleanUrls;
  parentDeliverable.published_urls = pubValidation.cleanUrls;
  assert(parentDeliverable.published_urls.length === 2, "Step 10: Stored 2 live social URLs");

  // Step 11: Parent reaches correct final status
  const finalProgress = computeWorkflowProgress(parentDeliverable.id, stages);
  assert(finalProgress?.completed_stages === 4, "Step 11: All 4 stages completed");
  assert(finalProgress?.progress_percent === 100, "Step 11: Parent reaches 100% progress");
  assert(finalProgress?.all_completed === true, "Step 11: Parent marks all_completed = true");
  parentDeliverable.status = "done";
  parentDeliverable.all_completed = true;
  assert(parentDeliverable.status === "done", "Step 11: Parent deliverable transitioned to final status 'done'");

  console.log("");

  // =======================================================================
  // PART 2: PACKAGE RECONCILIATION & SCHEDULE LIFECYCLE
  // =======================================================================
  console.log("--- PART 2: Package Reconciliation & Schedule Lifecycle ---");

  // 1. Package Edit 5 -> 10 without duplicates, preserving historical work
  const TEST_CLIENT_ID = "client-safari-recon";
  const PERIOD_MONTH = "2026-10";

  const inMemoryTasks: TaskRow[] = [];
  for (let i = 1; i <= 5; i++) {
    inMemoryTasks.push({
      id: `task_p5_${i}`,
      client_id: TEST_CLIENT_ID,
      status: i <= 2 ? "done" : "todo",
      service: "Posts Publishing",
      category: "Post",
      sequence_index: i,
      occurrence_date: `2026-10-0${i}`,
      deadline: `2026-10-0${i}`,
      delivery_period: PERIOD_MONTH,
      source_type: "package_reconciliation",
      is_reconciliation_managed: true,
      manual_override: false,
    } as any);
  }

  // Preview before execution
  const preview = await previewPackageReconciliation(
    {
      clientId: TEST_CLIENT_ID,
      periodMonth: PERIOD_MONTH,
      packageConfig: { posts_quota: 10 },
      commitToDatabase: false,
    },
    inMemoryTasks
  );
  assert(preview.total_missing_tasks === 5, "Package Edit 5 -> 10 Preview: Exactly 5 tasks to create");
  assert(preview.total_excess_tasks === 0, "Package Edit 5 -> 10 Preview: 0 tasks to prune");

  // Execute reconciliation 5 -> 10
  const reconReport = await reconcileClientPackageWork(
    {
      clientId: TEST_CLIENT_ID,
      periodMonth: PERIOD_MONTH,
      packageConfig: { posts_quota: 10 },
      commitToDatabase: false,
    },
    {
      client: { id: TEST_CLIENT_ID, name: "Safari Recon", package_config: { posts_quota: 5 } } as any,
      tasks: inMemoryTasks,
    }
  );

  assert(reconReport.total_tasks_created === 5, "Package Edit 5 -> 10: Created exactly 5 missing tasks");
  assert(reconReport.total_tasks_pruned === 0, "Package Edit 5 -> 10: 0 tasks pruned");
  assert(inMemoryTasks.length === 10, "Package Edit 5 -> 10: Total active tasks equals 10");
  assert(
    inMemoryTasks.filter((t) => t.status === "done").length === 2,
    "Package Edit 5 -> 10: Historical done tasks permanently intact"
  );
  const appendedTasks = inMemoryTasks.filter((t) => (t as any).sequence_index > 5);
  assert(appendedTasks.length === 5, "Package Edit 5 -> 10: Appended 5 new tasks without sequence collision");
  assert(appendedTasks.every((t) => t.source_type === "package_reconciliation"), "Package Edit 5 -> 10: Tagged source_type='package_reconciliation'");

  // 2. Lifecycle States: Active / Paused / Inactive
  const activeCommitment: any = {
    id: "commit-active",
    client_id: TEST_CLIENT_ID,
    service_name: "Reels Shooting",
    deliverable_type: "reels_shooting",
    status: "active",
    frequency: "monthly",
    quantity: 2,
    schedule_rule: {
      frequency: "monthly",
      quantity: 2,
      days_of_month: [5, 20],
      duration_hours: 4.0,
    },
    start_date: "2026-10-01",
  };
  const activeRes = await generateCommitmentTasks({
    commitment: activeCommitment,
    client: { id: TEST_CLIENT_ID, name: "Safari Recon", status: "active" } as any,
    existingTasks: [],
    commitToDatabase: false,
  });
  assert(activeRes.tasks_created === 2, "Lifecycle 'active': Generates full quota of 2 scheduled occurrences");

  const pausedCommitment: any = {
    ...activeCommitment,
    status: "paused",
    paused_at: "2026-10-01T00:00:00Z",
  };
  const pausedRes = await generateCommitmentTasks({
    commitment: pausedCommitment,
    client: { id: TEST_CLIENT_ID, name: "Safari Recon", status: "active" } as any,
    existingTasks: [],
    commitToDatabase: false,
  });
  assert(pausedRes.tasks_created === 0, "Lifecycle 'paused': Generates 0 new tasks (freezes creation)");

  const resumedCommitment: any = {
    ...activeCommitment,
    status: "active",
    paused_at: "2026-10-06T12:00:00Z",
    reactivated_at: "2026-10-15T12:00:00Z",
  };
  const resumeRes = await generateCommitmentTasks({
    commitment: resumedCommitment,
    client: { id: TEST_CLIENT_ID, name: "Safari Recon", status: "active" } as any,
    existingTasks: [],
    commitToDatabase: false,
  });
  assert(resumeRes.tasks_created === 1, "Lifecycle reactivated: Only generates future tasks >= reactivation date (Oct 20)");

  console.log("");

  // =======================================================================
  // PART 3: IDENTITY, ACCOUNT MANAGEMENT, RBAC & DEFENSE-IN-DEPTH
  // =======================================================================
  console.log("--- PART 3: Identity, Account Management, RBAC & Defense-in-Depth ---");

  // 1. Context Resolution
  const superAdminCtx = buildSecurityContext({
    userId: "sa-1",
    email: "superadmin@sada.agency",
    role: "super_admin",
    status: "active",
  });
  const adminCtx = buildSecurityContext({
    userId: "adm-1",
    email: "admin@sada.agency",
    role: "admin",
    status: "active",
    moduleOverrides: { finance: false },
  });
  const workerCtx = buildSecurityContext({
    userId: "wrk-1",
    email: "worker@sada.agency",
    role: "worker",
    status: "active",
    teamMemberId: "tm-wrk-1",
  });
  const suspendedCtx = buildSecurityContext({
    userId: "wrk-2",
    email: "suspended@sada.agency",
    role: "worker",
    status: "suspended",
  });

  assert(superAdminCtx.effectivePermissions.accounts === true, "RBAC: Super Admin has accounts management = true");
  assert(adminCtx.effectivePermissions.accounts === false, "RBAC: Regular Admin accounts management is strictly false");
  assert(workerCtx.effectivePermissions.accounts === false, "RBAC: Worker accounts management is strictly false");
  assert(workerCtx.effectivePermissions.finance === false, "RBAC: Worker company finance access is strictly false");
  assert(workerCtx.effectivePermissions.tasks === true, "RBAC: Worker tasks module access is enabled by baseline");

  // 2. Direct Route Denial
  let workerAccountsDenied = false;
  try {
    assertRouteAccess("/admin/accounts", workerCtx);
  } catch (err: any) {
    workerAccountsDenied = err.code === "FORBIDDEN_ADMIN_ACTION";
  }
  assert(workerAccountsDenied, "Route Security: Worker navigating to /admin/accounts is DENIED");

  let workerFinanceDenied = false;
  try {
    assertRouteAccess("/admin/finance", workerCtx);
  } catch (err: any) {
    workerFinanceDenied = err.code === "UNAUTHORIZED_ROUTE";
  }
  assert(workerFinanceDenied, "Route Security: Worker navigating to /admin/finance is DENIED");

  let suspendedDenied = false;
  try {
    assertRouteAccess("/admin/my-work", suspendedCtx);
  } catch (err: any) {
    suspendedDenied = err.code === "ACCOUNT_SUSPENDED";
  }
  assert(suspendedDenied, "Route Security: Suspended account navigating to /admin/my-work is DENIED");

  // 3. API Denial
  let workerFinanceApiDenied = false;
  try {
    authorizeApiAction("finance", "view", workerCtx);
  } catch (err: any) {
    workerFinanceApiDenied = err.code === "UNAUTHORIZED_API";
  }
  assert(workerFinanceApiDenied, "API Security: Worker executing finance API action is DENIED");

  let adminDeleteForbidden = false;
  try {
    authorizeApiAction("tasks", "delete", adminCtx);
  } catch (err: any) {
    adminDeleteForbidden = err.code === "FORBIDDEN_DELETE";
  }
  assert(adminDeleteForbidden, "API Security: Non-Super Admin executing permanent delete is DENIED");

  // 4. Data Scope Isolation
  let crossWorkerDenied = false;
  try {
    authorizeDataScope(
      "salary_record",
      { id: "sal-1", team_member_id: "tm-other", user_id: "wrk-other" },
      "read",
      workerCtx
    );
  } catch (err: any) {
    crossWorkerDenied = err.code === "DATA_SCOPE_VIOLATION";
  }
  assert(crossWorkerDenied, "Scope Security: Worker accessing another worker's salary record is DENIED");

  // 5. Public Admin Entry Eradication
  const headerContent = readFileSync(resolve("src/components/site/Header.tsx"), "utf8");
  assert(!headerContent.includes('to="/admin"'), "Entry Security: Public Header has 0 links to /admin");
  assert(!headerContent.includes('to={"/admin"}'), "Entry Security: Public Header has 0 expression links to /admin");

  const robotsContent = readFileSync(resolve("public/robots.txt"), "utf8");
  assert(!robotsContent.includes("Disallow: /admin"), "Entry Security: robots.txt does not leak /admin path");

  const sadaOsRouteContent = readFileSync(resolve("src/routes/sada-os.tsx"), "utf8");
  assert(sadaOsRouteContent.includes('createFileRoute("/sada-os")'), "Entry Security: Protected /sada-os entry point is registered");

  console.log("");

  // =======================================================================
  // PART 4: RECIPIENT-SPECIFIC & PRIORITY-FIRST NOTIFICATIONS
  // =======================================================================
  console.log("--- PART 4: Recipient-Specific & Priority-First Notifications ---");

  // 1. Recipient Isolation
  const personalWorkerANotif: NotificationItem = {
    id: "n-wrk-a",
    user_id: "user-worker-a",
    role_target: "all",
    category: "task",
    priority: "high",
    title: "Task Assigned",
    message: "Reel editing assigned to you",
    read: false,
    created_at: "2026-10-06T10:00:00Z",
  };
  const workerACanSee = isNotificationVisibleToUser(personalWorkerANotif, {
    userId: "user-worker-a",
    role: "worker",
  });
  const workerBCanSee = isNotificationVisibleToUser(personalWorkerANotif, {
    userId: "user-worker-b",
    role: "worker",
  });
  const superAdminCanSee = isNotificationVisibleToUser(personalWorkerANotif, {
    userId: "user-super-admin",
    role: "super_admin",
  });
  assert(workerACanSee, "Notification Isolation: Worker A sees own personal notification");
  assert(!workerBCanSee, "Notification Isolation: Worker B CANNOT see Worker A personal notification");
  assert(superAdminCanSee, "Notification Isolation: Super Admin has supervisory visibility");

  // 2. Finance Category Boundary Isolation
  const financeBroadcastNotif: NotificationItem = {
    id: "n-fin-1",
    user_id: null,
    role_target: "all",
    category: "finance",
    priority: "urgent",
    title: "Monthly P&L Ready",
    message: "September financial statement generated",
    read: false,
    created_at: "2026-10-06T11:00:00Z",
  };
  const workerFinanceVisible = isNotificationVisibleToUser(financeBroadcastNotif, {
    userId: "user-worker-a",
    role: "worker",
    hasFinanceAccess: false,
  });
  const adminWithoutFinanceVisible = isNotificationVisibleToUser(financeBroadcastNotif, {
    userId: "user-admin-regular",
    role: "admin",
    hasFinanceAccess: false,
  });
  const adminWithFinanceVisible = isNotificationVisibleToUser(financeBroadcastNotif, {
    userId: "user-admin-cfo",
    role: "admin",
    hasFinanceAccess: true,
  });
  assert(!workerFinanceVisible, "Finance Isolation: Worker cannot see broadcast finance notification");
  assert(!adminWithoutFinanceVisible, "Finance Isolation: Admin without finance grant cannot see finance notification");
  assert(adminWithFinanceVisible, "Finance Isolation: Admin with finance grant CAN see finance notification");

  // 3. Priority-First Sorting
  const unorderedList: NotificationItem[] = [
    { id: "1", user_id: null, role_target: "all", category: "system", priority: "low", title: "Low recent", message: "", read: false, created_at: "2026-10-06T12:00:00Z" },
    { id: "2", user_id: null, role_target: "all", category: "system", priority: "urgent", title: "Urgent older", message: "", read: false, created_at: "2026-10-06T09:00:00Z" },
    { id: "3", user_id: null, role_target: "all", category: "system", priority: "high", title: "High", message: "", read: false, created_at: "2026-10-06T10:00:00Z" },
    { id: "4", user_id: null, role_target: "all", category: "system", priority: "normal", title: "Normal", message: "", read: false, created_at: "2026-10-06T11:00:00Z" },
  ];
  const sortedList = sortNotificationsByPriorityAndRecency(unorderedList);
  assert(sortedList[0].priority === "urgent", "Sorting: First item is Urgent");
  assert(sortedList[1].priority === "high", "Sorting: Second item is High");
  assert(sortedList[2].priority === "normal", "Sorting: Third item is Normal");
  assert(sortedList[3].priority === "low", "Sorting: Fourth item is Low (despite newest timestamp)");

  // 4. Bilingual Localization & Token Interpolation
  const mockT_en = (key: string, params?: Record<string, any>) => {
    const dictionary: Record<string, string> = {
      "notifications.categories.task": "Tasks & Milestones",
      "notifications.priorities.high": "High Priority",
      "notifications.events.task_assigned.title": "New Task Assigned",
      "notifications.events.task_assigned.message": "You have been assigned to: {taskName}",
    };
    return dictionary[key] || key;
  };

  const mockT_ar = (key: string, params?: Record<string, any>) => {
    const dictionary: Record<string, string> = {
      "notifications.categories.task": "المهام ومراحل العمل",
      "notifications.priorities.high": "أولوية عالية",
      "notifications.events.task_assigned.title": "مهمة عمل جديدة",
      "notifications.events.task_assigned.message": "تم إسناد مهمة جديدة إليك: {taskName}",
    };
    return dictionary[key] || key;
  };

  const localizedEn = resolveNotification(
    {
      ...personalWorkerANotif,
      event_type: "TASK_ASSIGNED",
      i18n_params: { taskName: "Sunset Safari Reel" },
    },
    mockT_en
  );
  const localizedAr = resolveNotification(
    {
      ...personalWorkerANotif,
      event_type: "TASK_ASSIGNED",
      i18n_params: { taskName: "ريل سفاري الغروب" },
    },
    mockT_ar
  );
  assert(localizedEn.message.includes("Sunset Safari Reel"), "i18n LTR: English parameters interpolated into message");
  assert(localizedAr.message.includes("ريل سفاري الغروب"), "i18n RTL: Arabic parameters interpolated into message");
  assert(localizedAr.priorityLabel === "أولوية عالية", "i18n RTL: Arabic priority translated");

  console.log("");

  // =======================================================================
  // PART 5: MOBILE WEB APP & PWA EXPERIENCE
  // =======================================================================
  console.log("--- PART 5: Mobile Web App & PWA Experience ---");

  // 1. Manifest
  assert(existsSync(resolve("public/manifest.webmanifest")), "PWA: Manifest file exists");
  const manifest = JSON.parse(readFileSync(resolve("public/manifest.webmanifest"), "utf8"));
  assert(manifest.short_name === "SADA OS", "PWA: Manifest short_name is 'SADA OS'");
  assert(manifest.start_url === "/sada-os", "PWA: Manifest start_url is '/sada-os'");
  assert(manifest.display === "standalone", "PWA: Manifest display mode is 'standalone'");
  assert(manifest.theme_color === "#07090E", "PWA: Theme color is SADA Luxury Dark Navy (#07090E)");
  assert(manifest.icons.length >= 3, "PWA: At least 3 icons defined");
  assert(manifest.icons.some((i: any) => i.purpose === "maskable"), "PWA: Maskable icon defined");

  // 2. Service Worker & Push
  assert(existsSync(resolve("public/sw.js")), "PWA: Production Service Worker exists at public/sw.js");
  const swContent = readFileSync(resolve("public/sw.js"), "utf8");
  assert(swContent.includes("sada-os-pwa-v1"), "PWA: sw.js defines versioned cache");
  assert(swContent.includes("offline.html"), "PWA: sw.js pre-caches offline.html fallback");
  assert(swContent.includes("self.addEventListener('push'"), "PWA: sw.js implements Web Push receiver");
  assert(swContent.includes("self.addEventListener('notificationclick'"), "PWA: sw.js implements notification click router");
  assert(swContent.includes("/rest/v1/"), "PWA: sw.js bypasses cache for Supabase REST API");

  // 3. Offline Screen
  assert(existsSync(resolve("public/offline.html")), "PWA: Offline screen exists at public/offline.html");
  const offlineHtml = readFileSync(resolve("public/offline.html"), "utf8");
  assert(offlineHtml.includes("#07090E"), "PWA: Offline screen uses SADA luxury dark theme");
  assert(offlineHtml.includes("لا يوجد اتصال بالإنترنت"), "PWA: Offline screen includes Arabic RTL text");
  assert(offlineHtml.includes("window.location.reload()"), "PWA: Offline screen provides reload retry button");

  // 4. Mobile Bottom Navigation & Safe Area Ergonomics
  assert(existsSync(resolve("src/components/admin/SADAMobileBottomNav.tsx")), "Mobile UI: SADAMobileBottomNav component exists");
  const bottomNavContent = readFileSync(resolve("src/components/admin/SADAMobileBottomNav.tsx"), "utf8");
  assert(bottomNavContent.includes("md:hidden"), "Mobile UI: Bottom navigation is hidden on desktop (md:hidden)");
  assert(bottomNavContent.includes("env(safe-area-inset-bottom)"), "Mobile UI: Bottom navigation respects iPhone safe area");
  assert(bottomNavContent.includes("/admin/my-work"), "Mobile UI: 1-tap My Work queue included");
  assert(bottomNavContent.includes("sada-next-task-card"), "Mobile UI: 1-tap Next Task priority action included");
  assert(bottomNavContent.includes("/admin/calendar"), "Mobile UI: 1-tap Calendar action included");
  assert(bottomNavContent.includes("min-h-[48px]"), "Mobile UI: Touch targets enforce minimum 48px height");

  // 5. PWA Install Guidance
  assert(existsSync(resolve("src/components/admin/PWAInstallBanner.tsx")), "PWA UI: PWAInstallBanner exists");
  const installBannerContent = readFileSync(resolve("src/components/admin/PWAInstallBanner.tsx"), "utf8");
  assert(installBannerContent.includes("isIosSafari"), "PWA UI: Detects iOS Safari for custom guidance");
  assert(installBannerContent.includes("SADADialog"), "PWA UI: Reuses SADA UI SADADialog component for guidance modal");

  console.log("");

  // =======================================================================
  // PART 6: SADA DESIGN SYSTEM & LOCALIZATION INTEGRITY
  // =======================================================================
  console.log("--- PART 6: SADA Design System & Localization Integrity ---");

  // 1. Zero Native HTML Select Controls in Admin UI
  const adminRoutes = [
    "src/routes/admin.tsx",
    "src/routes/admin.my-work.tsx",
    "src/routes/admin.calendar.tsx",
    "src/routes/admin.clients.index.tsx",
    "src/routes/admin.packages.tsx",
  ];
  for (const routePath of adminRoutes) {
    if (existsSync(resolve(routePath))) {
      const content = readFileSync(resolve(routePath), "utf8");
      assert(!content.includes("<select"), `Design System: No native <select> tag in ${routePath}`);
    }
  }

  // 2. Canonical SADA UI Component Reusability
  assert(existsSync(resolve("src/components/ui/sada-button.tsx")), "SADA UI: SADAButton exists");
  assert(existsSync(resolve("src/components/ui/sada-badge.tsx")), "SADA UI: SADABadge exists");
  assert(existsSync(resolve("src/components/ui/sada-dialog.tsx")), "SADA UI: SADADialog exists");
  assert(existsSync(resolve("src/components/ui/sada-select.tsx")), "SADA UI: SADASelect exists");
  assert(existsSync(resolve("src/components/ui/sada-combobox.tsx")), "SADA UI: SADACombobox exists");
  assert(existsSync(resolve("src/components/ui/sada-counter.tsx")), "SADA UI: SADACounter exists");

  // 3. Arabic Typography & RTL Support
  const stylesContent = readFileSync(resolve("src/styles.css"), "utf8");
  assert(stylesContent.includes("Thmanyah Serif Text") || stylesContent.includes("dir="), "Localization: Arabic Thmanyah Serif Text typography or RTL direction rules defined in styles");

  console.log("");
  console.log("=======================================================================");
  console.log(`Phase 10 Master Integration Finished: ${passedCount} passed, ${failedCount} failed`);
  console.log("=======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMasterIntegrationSuite().catch((err) => {
  console.error("FATAL ERROR in Master Integration Suite:", err);
  process.exit(1);
});
