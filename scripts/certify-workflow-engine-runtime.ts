/**
 * SADA OS — Configurable Workflow Engine
 * Master Certification & Real Database Integration Test Suite
 *
 * Exercises the complete 20-step lifecycle required by Master Prompt Section 12
 * against isolated local PostgreSQL (sada_local_test), guarded by DataIsolationGuard.
 */

import fs from "node:fs";
import path from "node:path";

// Load .env for auth and service config
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}
if (!process.env.SUPABASE_PUBLISHABLE_KEY && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

import { enforceDatabaseIsolation } from "./test-db-guard";
import {
  createLocalTestClient,
  runLocalSql,
  queryLocalJson,
} from "./local-db-client";
import {
  fetchWorkflowTemplates,
  saveWorkflowTemplate,
  deleteWorkflowTemplate,
  instantiateWorkflowStages,
  checkStageActionability,
  computeWorkflowProgress,
  CANONICAL_WORKFLOW_TEMPLATES,
} from "../src/lib/workflow-service";
import {
  startTask,
  submitTaskForReview,
  completeTask,
  assertPrerequisiteStagesCompleted,
} from "../src/lib/task-execution-service";
import type { WorkflowTemplate } from "../src/types/workflow";
import type { TaskRow, TeamMemberRow, ProfileRow } from "../src/components/admin/project-utils";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

// Enforce test DB isolation
enforceDatabaseIsolation(LOCAL_DB_URL);

let totalChecks = 0;
let passedChecks = 0;
const failures: string[] = [];

function assert(condition: boolean, description: string, detail?: any) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description}`, detail || "");
    failures.push(description);
  }
}

async function runMasterCertification() {
  console.log("\n============================================================");
  console.log("SADA OS — WORKFLOW ENGINE RUNTIME CERTIFICATION SUITE");
  console.log("Target Environment: sada_local_test (PostgreSQL 16 Isolated)");
  console.log("============================================================\n");

  const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const WORKER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const WRITER_ID = WORKER_ID;
  const DESIGNER_ID = WORKER_ID;
  const PUBLISHER_ID = WORKER_ID;

  // Ensure worker specialist team member exists in team_members
  runLocalSql(`
    INSERT INTO public.team_members (id, profile_id, name, position, division, specialties, is_publisher, is_active)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      '${WORKER_ID}',
      'QA Worker Specialist',
      'Creative Copywriter, Designer & Publisher',
      'Creative',
      ARRAY['copywriter', 'designer', 'publisher']::text[],
      true,
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      specialties = EXCLUDED.specialties,
      position = EXCLUDED.position,
      is_publisher = EXCLUDED.is_publisher,
      is_active = true;
  `);

  const localClient = createLocalTestClient(ADMIN_ID);

  // Mock team members and profiles for role resolution
  const mockProfiles: ProfileRow[] = [
    { id: ADMIN_ID, display_name: "Super Admin One", role: "super_admin", email: "root_sa1@sada.tn" } as any,
    { id: WORKER_ID, display_name: "QA Worker Specialist", role: "worker", email: "qa_worker@sada.tn" } as any,
  ];

  const mockTeamMembers: TeamMemberRow[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      profile_id: WORKER_ID,
      name: "QA Worker Specialist",
      position: "Creative Copywriter, Designer & Publisher",
      division: "Creative",
      specialties: ["copywriter", "designer", "publisher"],
      is_publisher: true,
      is_active: true,
    } as any,
  ];

  // ------------------------------------------------------------
  // STEP 1: Record initial canonical template inventory
  // ------------------------------------------------------------
  console.log("--- Step 1: Record initial canonical template inventory ---");
  const initialTemplates = await fetchWorkflowTemplates(true, localClient);
  assert(initialTemplates.length >= 4, `Initial canonical templates >= 4 (found: ${initialTemplates.length})`);

  const initialDbTpls = queryLocalJson<any[]>("SELECT * FROM public.workflow_templates;");
  const initialDbStages = queryLocalJson<any[]>("SELECT * FROM public.workflow_stages;");
  assert(initialDbTpls.length >= 4, `DB public.workflow_templates count >= 4 (found: ${initialDbTpls.length})`);
  assert(initialDbStages.length >= 15, `DB public.workflow_stages count >= 15 (found: ${initialDbStages.length})`);

  // ------------------------------------------------------------
  // STEP 2 & 3: Create uniquely identified test template with 3 stages
  // ------------------------------------------------------------
  console.log("\n--- Step 2 & 3: Create test template with 3 ordered stages ---");
  const uniqueTaskType = `test_pipe_${Date.now().toString().slice(-6)}`;
  const testTemplateId = crypto.randomUUID();

  const testTemplate: WorkflowTemplate = {
    id: testTemplateId,
    task_type: uniqueTaskType,
    name: "Automated Certification Pipeline",
    name_ar: "مسار الفحص الآلي المعتمد",
    description: "End-to-end multi-stage pipeline verifying persistence and lifecycle gating.",
    description_ar: "مسار عمل متعدد المراحل لفحص التخزين والربط التشغيلي.",
    icon: "Workflow",
    color: "purple",
    is_active: true,
    sort_order: 10,
    stages: [
      {
        id: crypto.randomUUID(),
        title: "Stage 1: Brief & Copywriting",
        title_ar: "المرحلة 1: الموجز والنصوص",
        stage_type: "script",
        order: 1,
        duration_days: 2,
        requires_previous_stage: false,
        assignment_rule: "specialist_role",
        default_assignee_role: "copywriter",
        description: "Draft comprehensive brief and copy.",
      },
      {
        id: crypto.randomUUID(),
        title: "Stage 2: Visual Asset Production",
        title_ar: "المرحلة 2: التصميم البصري",
        stage_type: "design",
        order: 2,
        duration_days: 3,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "designer",
        description: "Create key visual mockups.",
      },
      {
        id: crypto.randomUUID(),
        title: "Stage 3: Publishing & Handoff",
        title_ar: "المرحلة 3: النشر والاعتماد",
        stage_type: "publishing",
        order: 3,
        duration_days: 1,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "publisher",
        description: "Review and publish final deliverable.",
      },
    ],
  };

  // ------------------------------------------------------------
  // STEP 4 & 5: Save template and query DB directly to prove persistence
  // ------------------------------------------------------------
  console.log("\n--- Step 4 & 5: Save template & verify database persistence ---");
  const saveRes = await saveWorkflowTemplate({
    template: testTemplate,
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(saveRes.success === true, "saveWorkflowTemplate succeeded without errors", saveRes.error);

  // Direct SQL query against PostgreSQL to prove relational persistence
  const savedDbTpl = queryLocalJson<any[]>(
    `SELECT * FROM public.workflow_templates WHERE id = '${testTemplateId}' OR task_type = '${uniqueTaskType}';`
  );
  assert(savedDbTpl.length === 1, "Template row was genuinely inserted into public.workflow_templates");
  assert(savedDbTpl[0].name === "Automated Certification Pipeline", "Template name correctly persisted in DB");
  assert(savedDbTpl[0].name_ar === "مسار الفحص الآلي المعتمد", "Arabic template name correctly persisted in DB");

  const savedDbStages = queryLocalJson<any[]>(
    `SELECT * FROM public.workflow_stages WHERE template_id = '${savedDbTpl[0].id}' ORDER BY sort_order;`
  );
  assert(savedDbStages.length === 3, `All 3 stages genuinely persisted into public.workflow_stages (found: ${savedDbStages.length})`);
  assert(savedDbStages[0].sort_order === 1 && savedDbStages[0].title === "Stage 1: Brief & Copywriting", "Stage 1 order and title persisted");
  assert(savedDbStages[1].sort_order === 2 && savedDbStages[1].duration_days === 3, "Stage 2 duration (3 days) persisted");
  assert(savedDbStages[2].sort_order === 3 && savedDbStages[2].requires_previous_stage === true, "Stage 3 prerequisite flag persisted");

  // ------------------------------------------------------------
  // STEP 6: Reload service and verify template configuration
  // ------------------------------------------------------------
  console.log("\n--- Step 6: Reload service & verify loaded structure ---");
  const reloadedTemplates = await fetchWorkflowTemplates(true, localClient);
  const reloaded = reloadedTemplates.find((t) => t.task_type === uniqueTaskType);
  assert(Boolean(reloaded), "Reloaded templates list contains newly saved template");
  assert(reloaded?.stages.length === 3, "Reloaded template reflects all 3 persisted stages");

  // ------------------------------------------------------------
  // STEP 7 & 8: Create real parent task and instantiate workflow stages
  // ------------------------------------------------------------
  console.log("\n--- Step 7 & 8: Create parent task and instantiate workflow stages ---");
  const parentTaskId = crypto.randomUUID();
  const testProjectId = crypto.randomUUID();
  const testClientId = "88888888-8888-8888-8888-888888888888";

  // Insert a test client project
  runLocalSql(`
    INSERT INTO public.client_projects (id, title, status)
    VALUES ('${testProjectId}', 'Certification Test Project', 'active')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Insert parent task into project_tasks
  const { data: parentTaskRow, error: pTaskErr } = await localClient.from("project_tasks").insert({
    id: parentTaskId,
    project_id: testProjectId,
    client_id: testClientId,
    title: "Q4 Marketing Deliverable Main Task",
    status: "todo",
    priority: "high",
    deadline: "2026-11-30",
    start_date: "2026-11-01",
    assignee_id: ADMIN_ID,
  }).single();
  assert(!pTaskErr && Boolean(parentTaskRow), "Parent task created successfully in project_tasks");

  // Instantiate stages using the saved template
  const instRes = await instantiateWorkflowStages({
    parentTask: parentTaskRow,
    template: reloaded!,
    teamMembers: mockTeamMembers,
    profiles: mockProfiles,
    currentUserId: ADMIN_ID,
    clientOverride: localClient,
    commitToDatabase: true,
  });
  assert(instRes.success === true, "instantiateWorkflowStages succeeded", instRes.error);
  assert(instRes.createdTasks.length === 3, `Exactly 3 stage subtasks created (created: ${instRes.createdTasks.length})`);

  // Direct database query on project_tasks
  const dbSubtasks = queryLocalJson<any[]>(
    `SELECT * FROM public.project_tasks WHERE parent_task_id = '${parentTaskId}' ORDER BY sort_order;`
  );
  assert(dbSubtasks.length === 3, `3 subtask rows found in public.project_tasks table`);
  assert(dbSubtasks[0].workflow_template_id === savedDbTpl[0].id, "Stage task references workflow_template_id");
  assert(dbSubtasks[0].sort_order === 1, "Stage 1 sort_order is 1");
  assert(dbSubtasks[1].sort_order === 2, "Stage 2 sort_order is 2");
  assert(dbSubtasks[2].sort_order === 3, "Stage 3 sort_order is 3");

  // ------------------------------------------------------------
  // STEP 9: Verify initial assignment and actionable stage behavior
  // ------------------------------------------------------------
  console.log("\n--- Step 9: Verify role assignment resolution & stage gating ---");
  // Stage 1 default role is 'copywriter' -> should match Sara ('p-writer-1')
  assert(dbSubtasks[0].assignee_id === WRITER_ID, `Stage 1 correctly assigned to Copywriter (assigned: ${dbSubtasks[0].assignee_id})`);
  // Stage 2 default role is 'designer' -> should match Yassine ('p-designer-1')
  assert(dbSubtasks[1].assignee_id === DESIGNER_ID, `Stage 2 correctly assigned to Designer (assigned: ${dbSubtasks[1].assignee_id})`);
  // Stage 3 default role is 'publisher' -> should match Amine ('p-pub-1')
  assert(dbSubtasks[2].assignee_id === PUBLISHER_ID, `Stage 3 correctly assigned to Publisher (assigned: ${dbSubtasks[2].assignee_id})`);

  // Actionability check
  const action1 = checkStageActionability(dbSubtasks[0], dbSubtasks);
  assert(action1.isActionable === true, "Stage 1 is immediately actionable");

  const action2 = checkStageActionability(dbSubtasks[1], dbSubtasks);
  assert(action2.isActionable === false && action2.isLocked === true, "Stage 2 is locked waiting on Stage 1");

  const action3 = checkStageActionability(dbSubtasks[2], dbSubtasks);
  assert(action3.isActionable === false && action3.isLocked === true, "Stage 3 is locked waiting on Stage 2");

  // ------------------------------------------------------------
  // STEP 10: Attempt to activate stage 2 before stage 1 completes -> REJECTED
  // ------------------------------------------------------------
  console.log("\n--- Step 10: Attempt to bypass Stage 1 -> authoritative rejection ---");
  // 1. startTask on Stage 2
  const bypassStart = await startTask({
    task: dbSubtasks[1],
    actorId: DESIGNER_ID,
    actorRole: "worker",
    clientOverride: localClient,
  });
  assert(bypassStart.success === false, "startTask on Stage 2 was REJECTED because Stage 1 is incomplete");
  assert(bypassStart.error?.includes("Prerequisite stage"), `Bypass error message is explicit: "${bypassStart.error}"`);

  // 2. completeTask on Stage 2
  const bypassComplete = await completeTask({
    task: dbSubtasks[1],
    actorId: DESIGNER_ID,
    actorRole: "worker",
    clientOverride: localClient,
  });
  assert(bypassComplete.success === false, "completeTask on Stage 2 was REJECTED because Stage 1 is incomplete");

  // 3. submitTaskForReview on Stage 3
  const bypassReview = await submitTaskForReview({
    task: dbSubtasks[2],
    actorId: PUBLISHER_ID,
    actorRole: "worker",
    clientOverride: localClient,
  });
  assert(bypassReview.success === false, "submitTaskForReview on Stage 3 was REJECTED because prior stages are incomplete");

  // ------------------------------------------------------------
  // STEP 11 & 12: Complete Stage 1 -> Stage 2 becomes actionable
  // ------------------------------------------------------------
  console.log("\n--- Step 11 & 12: Complete Stage 1 & verify Stage 2 unlocked ---");
  // Worker starts Stage 1
  const start1 = await startTask({
    task: dbSubtasks[0],
    actorId: WRITER_ID,
    actorRole: "worker",
    clientOverride: localClient,
  });
  assert(start1.success === true, "Stage 1 started successfully");

  // Worker completes Stage 1
  const complete1 = await completeTask({
    task: dbSubtasks[0],
    actorId: WRITER_ID,
    actorRole: "worker",
    resultNotes: "Copywriting complete and verified.",
    clientOverride: localClient,
  });
  assert(complete1.success === true, "Stage 1 completed successfully");

  // Fetch updated subtasks from DB
  const subtasksAfter1 = queryLocalJson<any[]>(
    `SELECT * FROM public.project_tasks WHERE parent_task_id = '${parentTaskId}' ORDER BY sort_order;`
  );
  assert(subtasksAfter1[0].status === "done", "Stage 1 in DB has status = done");

  // Check stage 2 actionability
  const action2After1 = checkStageActionability(subtasksAfter1[1], subtasksAfter1);
  assert(action2After1.isActionable === true, "Stage 2 is now actionable after Stage 1 completed");
  assert(action2After1.isLocked === false, "Stage 2 lock is lifted");

  // Stage 3 must still be locked
  const action3StillLocked = checkStageActionability(subtasksAfter1[2], subtasksAfter1);
  assert(action3StillLocked.isActionable === false && action3StillLocked.isLocked === true, "Stage 3 remains locked waiting on Stage 2");

  // ------------------------------------------------------------
  // STEP 13 & 14: Complete Stage 2 -> Stage 3 becomes actionable
  // ------------------------------------------------------------
  console.log("\n--- Step 13 & 14: Complete Stage 2 & verify Stage 3 unlocked ---");
  const start2 = await startTask({
    task: subtasksAfter1[1],
    actorId: DESIGNER_ID,
    actorRole: "worker",
    clientOverride: localClient,
  });
  assert(start2.success === true, "Stage 2 started successfully");

  const complete2 = await completeTask({
    task: subtasksAfter1[1],
    actorId: DESIGNER_ID,
    actorRole: "worker",
    resultNotes: "Visual assets delivered.",
    clientOverride: localClient,
  });
  assert(complete2.success === true, "Stage 2 completed successfully");

  const subtasksAfter2 = queryLocalJson<any[]>(
    `SELECT * FROM public.project_tasks WHERE parent_task_id = '${parentTaskId}' ORDER BY sort_order;`
  );
  const action3After2 = checkStageActionability(subtasksAfter2[2], subtasksAfter2);
  assert(action3After2.isActionable === true, "Stage 3 is now actionable after Stage 2 completed");
  assert(action3After2.isLocked === false, "Stage 3 lock is lifted");

  // Progress check
  const progress = computeWorkflowProgress(parentTaskId, subtasksAfter2);
  assert(progress?.completed_stages === 2, "Progress shows 2 stages completed");
  assert(progress?.total_stages === 3, "Progress shows 3 total stages");
  assert(progress?.progress_percent === 67, "Progress percent is 67%");

  // ------------------------------------------------------------
  // STEP 15: Edit template & verify historical task integrity
  // ------------------------------------------------------------
  console.log("\n--- Step 15: Template edit and historical snapshot preservation ---");
  const modifiedTemplate: WorkflowTemplate = {
    ...reloaded!,
    name: "Automated Certification Pipeline (v2)",
    stages: [
      ...reloaded!.stages,
      {
        id: crypto.randomUUID(),
        title: "Stage 4: Post-Launch Growth Review",
        stage_type: "optimization",
        order: 4,
        duration_days: 5,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "media_buyer",
        description: "Analyze metrics after 5 days.",
      },
    ],
  };

  const updateRes = await saveWorkflowTemplate({
    template: modifiedTemplate,
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(updateRes.success === true, "Template updated with 4 stages");

  // Verify historical task was NOT mutated
  const existingSubtasks = queryLocalJson<any[]>(
    `SELECT * FROM public.project_tasks WHERE parent_task_id = '${parentTaskId}' ORDER BY sort_order;`
  );
  assert(existingSubtasks.length === 3, "Historical task retained its 3 original stages (not overwritten)");
  assert(existingSubtasks[0].status === "done", "Historical Stage 1 remains 'done'");
  assert(existingSubtasks[1].status === "done", "Historical Stage 2 remains 'done'");

  // ------------------------------------------------------------
  // STEP 16: Disable template & test task creation eligibility
  // ------------------------------------------------------------
  console.log("\n--- Step 16: Disable template & verify availability ---");
  const disabledTemplate = { ...modifiedTemplate, is_active: false };
  await saveWorkflowTemplate({
    template: disabledTemplate,
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });

  const refreshedList = await fetchWorkflowTemplates(true, localClient);
  const foundDisabled = refreshedList.find((t) => t.id === testTemplateId);
  assert(foundDisabled?.is_active === false, "Template marked is_active = false in database");

  // ------------------------------------------------------------
  // STEP 17: Adversarial inputs and validation rules
  // ------------------------------------------------------------
  console.log("\n--- Step 17: Adversarial validation testing ---");

  // 17.1 Empty name
  const badName = await saveWorkflowTemplate({
    template: { ...modifiedTemplate, name: "" },
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(badName.success === false, "Empty template name rejected");

  // 17.2 Invalid task type key
  const badKey = await saveWorkflowTemplate({
    template: { ...modifiedTemplate, task_type: "INVALID KEY WITH SPACES!" },
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(badKey.success === false, "Invalid task_type key with special characters rejected");

  // 17.3 Zero/negative stage duration
  const badDuration = await saveWorkflowTemplate({
    template: {
      ...modifiedTemplate,
      stages: [
        { ...modifiedTemplate.stages[0], duration_days: -5 },
      ],
    },
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(badDuration.success === false, "Negative stage duration rejected");

  // 17.4 Duplicate task_type key collision
  const duplicateKey = await saveWorkflowTemplate({
    template: {
      ...modifiedTemplate,
      id: crypto.randomUUID(), // different ID
      task_type: "reel", // collides with canonical Reel template
      name: "Imposter Reel",
    },
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(duplicateKey.success === false, "Duplicate task_type key collision rejected with unique error");
  assert(duplicateKey.error?.includes("Unique key violation"), `Collision error message: "${duplicateKey.error}"`);

  // 17.5 Worker unauthorized mutation
  try {
    const workerSave = await saveWorkflowTemplate({
      template: modifiedTemplate,
      changedById: WRITER_ID,
      actorRole: "worker",
      clientOverride: localClient,
    });
    assert(workerSave.success === false, "Worker role rejected from modifying templates");
  } catch (e: any) {
    assert(true, "Worker role threw unauthorized exception when attempting template save");
  }

  // ------------------------------------------------------------
  // STEP 18: Safe Deletion and Archival Behavior
  // ------------------------------------------------------------
  console.log("\n--- Step 18: Safe deletion & archival testing ---");

  // 18.1 Attempt to delete referenced template -> should be safely archived, NOT hard deleted!
  const delReferenced = await deleteWorkflowTemplate({
    templateId: testTemplateId,
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(delReferenced.success === true, "deleteWorkflowTemplate succeeded on referenced template");
  assert(delReferenced.archived === true, "Referenced template was safely ARCHIVED instead of destroyed");

  const checkTplStillExists = queryLocalJson<any[]>(
    `SELECT * FROM public.workflow_templates WHERE id = '${testTemplateId}';`
  );
  assert(checkTplStillExists.length === 1, "Referenced template remains in public.workflow_templates (data preserved)");
  assert(checkTplStillExists[0].is_active === false, "Template marked is_active = false");

  // 18.2 Unreferenced template deletion -> should be cleanly deleted
  const disposableId = crypto.randomUUID();
  const disposableKey = `disposable_${Date.now()}`;
  await saveWorkflowTemplate({
    template: {
      id: disposableId,
      task_type: disposableKey,
      name: "Temporary Template",
      description: "Will be deleted",
      icon: "Workflow",
      color: "blue",
      is_active: true,
      sort_order: 99,
      stages: [
        { id: crypto.randomUUID(), title: "Temp Stage", stage_type: "brief", order: 1, duration_days: 1, requires_previous_stage: false, assignment_rule: "project_lead" },
      ],
    },
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });

  const delUnreferenced = await deleteWorkflowTemplate({
    templateId: disposableId,
    changedById: ADMIN_ID,
    actorRole: "super_admin",
    clientOverride: localClient,
  });
  assert(delUnreferenced.success === true, "deleteWorkflowTemplate succeeded on unreferenced template");
  assert(delUnreferenced.archived === false, "Unreferenced template was cleanly deleted");

  const checkDisposableGone = queryLocalJson<any[]>(
    `SELECT * FROM public.workflow_templates WHERE id = '${disposableId}';`
  );
  assert(checkDisposableGone.length === 0, "Unreferenced template removed from public.workflow_templates");

  // ------------------------------------------------------------
  // STEP 19 & 20: Audit trail and safe test cleanup
  // ------------------------------------------------------------
  console.log("\n--- Step 19 & 20: Audit evidence and safe cleanup ---");
  const auditLogs = queryLocalJson<any[]>(
    `SELECT * FROM public.system_audit_logs WHERE entity_type = 'workflow_template' ORDER BY created_at DESC;`
  );
  assert(auditLogs.length >= 2, `Audit logs recorded for workflow template operations (found: ${auditLogs.length})`);

  // Clean up only test records
  runLocalSql(`DELETE FROM public.project_tasks WHERE parent_task_id = '${parentTaskId}';`);
  runLocalSql(`DELETE FROM public.project_tasks WHERE id = '${parentTaskId}';`);
  runLocalSql(`DELETE FROM public.workflow_stages WHERE template_id = '${testTemplateId}';`);
  runLocalSql(`DELETE FROM public.workflow_templates WHERE id = '${testTemplateId}';`);
  runLocalSql(`DELETE FROM public.client_projects WHERE id = '${testProjectId}';`);

  const canonicalLeft = queryLocalJson<any[]>(`SELECT count(*) FROM public.workflow_templates;`);
  assert(Number(canonicalLeft[0].count) >= 4, "Canonical templates intact after safe test cleanup");

  console.log("\n============================================================");
  console.log(`MASTER CERTIFICATION RESULTS: ${passedChecks} PASSED, ${failures.length} FAILED`);
  console.log("============================================================\n");

  if (failures.length > 0) {
    console.error("Failed checks:", failures);
    process.exit(1);
  }
}

runMasterCertification().catch((err) => {
  console.error("Master certification runtime error:", err);
  process.exit(1);
});
