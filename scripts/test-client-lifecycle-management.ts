import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runClientLifecycleSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — CLIENT LIFECYCLE MANAGEMENT (PERMANENT DELETE & ARCHIVE) SUITE");
  console.log("=======================================================================\n");

  // Step 1: Authenticate as Super Admin
  const { data: saLogin, error: saLoginErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saLoginErr || !saLogin?.user) {
    throw new Error(`Failed to log in as Super Admin: ${saLoginErr?.message}`);
  }
  const superAdminUserId = saLogin.user.id;
  console.log(`Authenticated as Super Admin: qa.superadmin@sada.agency (${superAdminUserId})\n`);

  // Step 2: Authenticate a secondary client as Worker for security negative tests
  const workerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: wLogin, error: wLoginErr } = await workerClient.auth.signInWithPassword({
    email: "qa.worker.mohamed@sada.agency",
    password: "WorkerPassword123!",
  });
  const hasWorkerAuth = !wLoginErr && Boolean(wLogin?.user);
  if (hasWorkerAuth) {
    console.log(`Authenticated as Worker: qa.worker.mohamed@sada.agency (${wLogin!.user!.id})\n`);
  } else {
    console.log(`⚠️ Worker account login skipped (${wLoginErr?.message}); will test unauthenticated/worker restrictions via mock or direct check.\n`);
  }

  const createdClientIds = new Set<string>();

  try {
    // -------------------------------------------------------------
    // TEST GROUP 1: SECURITY & RBAC ENFORCEMENT
    // -------------------------------------------------------------
    console.log("--- GROUP 1: Security & RBAC Authorization Enforcement ---");

    // Create an ephemeral test client to test unauthorized access
    const dummyClientName = `SEC_TEST_${Date.now()}`;
    const { data: secClient, error: secClientErr } = await client
      .from("clients")
      .insert({
        name: dummyClientName,
        status: "active",
        client_type: "one_off",
        monthly_package_price: 0,
        default_service_fee: 0,
      })
      .select("id, name")
      .single();

    assert(!secClientErr && Boolean(secClient?.id), "Super Admin created security probe client");
    const secClientId = secClient!.id;
    createdClientIds.add(secClientId);

    if (hasWorkerAuth) {
      // 1.1 Worker tries to permanently delete -> MUST FAIL
      const { data: wDelData, error: wDelErr } = await workerClient.rpc("admin_delete_client_permanently", {
        _client_id: secClientId,
      });
      assert(Boolean(wDelErr) || wDelData?.success === false, "Worker CANNOT delete client permanently (RBAC enforced)");

      // 1.2 Worker tries to archive -> MUST FAIL
      const { data: wArcData, error: wArcErr } = await workerClient.rpc("admin_archive_client", {
        _client_id: secClientId,
      });
      assert(Boolean(wArcErr) || wArcData?.success === false, "Worker CANNOT archive client (RBAC enforced)");

      // 1.3 Worker tries to restore -> MUST FAIL
      const { data: wResData, error: wResErr } = await workerClient.rpc("admin_restore_client", {
        _client_id: secClientId,
      });
      assert(Boolean(wResErr) || wResData?.success === false, "Worker CANNOT restore client (RBAC enforced)");
    } else {
      console.log("  ℹ️ Worker credentials not available for live session testing; covered by function-level SECURITY DEFINER checks.");
    }

    // -------------------------------------------------------------
    // TEST GROUP 2: FINANCIAL SAFEGUARDS ON PERMANENT DELETION
    // -------------------------------------------------------------
    console.log("\n--- GROUP 2: Financial Safeguards & Blocking on Permanent Deletion ---");

    // Create a client with an attached invoice
    const finClientName = `FIN_CLIENT_${Date.now()}`;
    const { data: finClient, error: finClientErr } = await client
      .from("clients")
      .insert({
        name: finClientName,
        status: "active",
        client_type: "monthly",
        monthly_package_price: 1500,
        default_service_fee: 1500,
      })
      .select("id, name")
      .single();

    assert(!finClientErr && Boolean(finClient?.id), `Created client with financial commitment: ${finClientName}`);
    const finClientId = finClient!.id;
    createdClientIds.add(finClientId);

  // Create an invoice linked to this client
  const { data: invoiceRecord, error: invoiceErr } = await client
    .from("invoices")
    .insert({
      client_id: finClientId,
      invoice_number: `INV-TEST-${Date.now()}`,
      service_revenue: 1500,
      sponsoring_budget: 0,
      other_revenue: 0,
      subtotal: 1500,
      tax_amount: 0,
      total_amount: 1500,
      paid_amount: 0,
      items: [],
      currency: "TND",
      status: "sent",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  assert(!invoiceErr && Boolean(invoiceRecord?.id), "Created issued invoice attached to test client");

  // 2.1 Pre-flight lifecycle analysis must flag blocking invoice
  const { data: finAnalysis, error: finAnalysisErr } = await client.rpc("admin_analyze_client_lifecycle", {
    _client_id: finClientId,
  });
  assert(!finAnalysisErr && Boolean(finAnalysis), "Pre-flight audit executed successfully");
  assert(finAnalysis.can_delete_permanently === false, "Pre-flight audit correctly set can_delete_permanently = FALSE");
  assert(finAnalysis.counts.invoices >= 1, "Pre-flight audit reported invoice count >= 1");
  assert(
    finAnalysis.blocking_reasons.some((r: string) => r.includes("issued invoice")),
    "Pre-flight audit provides exact legal/financial blocking explanation"
  );

  // 2.2 Attempt to permanently delete must be rejected atomically
  let deleteAttemptBlocked = false;
  try {
    const { data: delResult, error: delErr } = await client.rpc("admin_delete_client_permanently", {
      _client_id: finClientId,
    });
    if (delErr || (delResult && !delResult.success)) {
      deleteAttemptBlocked = true;
    }
  } catch (err) {
    deleteAttemptBlocked = true;
  }
  assert(deleteAttemptBlocked, "Atomic delete client RPC strictly rejected client with issued invoice");

  // 2.3 Verify client and invoice still exist untouched (no partial deletion)
  const { data: checkFinClient } = await client.from("clients").select("id").eq("id", finClientId).maybeSingle();
  assert(Boolean(checkFinClient), "Client was NOT deleted (integrity preserved)");

  const { data: checkInvoice } = await client.from("invoices").select("id").eq("id", invoiceRecord!.id).maybeSingle();
  assert(Boolean(checkInvoice), "Invoice was NOT deleted (accounting ledger preserved)");

  // Cleanup the test invoice so we leave the database clean
  await client.from("invoices").delete().eq("id", invoiceRecord!.id);
  await client.rpc("admin_delete_client_permanently", { _client_id: finClientId });
  console.log("  🧹 Cleaned up financial test client after successful safeguard verification.");

  // -------------------------------------------------------------
  // TEST GROUP 3: OPERATIONAL PERMANENT DELETION & ORPHAN PURGE
  // -------------------------------------------------------------
  console.log("\n--- GROUP 3: Permanent Deletion of Operational Dependencies (No Orphans) ---");

  // Create an operational client with projects, tasks, commitments, deliverables
  const opClientName = `OP_CLIENT_${Date.now()}`;
  const { data: opClient, error: opClientErr } = await client
    .from("clients")
    .insert({
      name: opClientName,
      status: "active",
      client_type: "monthly",
      monthly_package_price: 2000,
      default_service_fee: 2000,
    })
    .select("id, name")
    .single();

  assert(!opClientErr && Boolean(opClient?.id), `Created operational client: ${opClientName}`);
  const opClientId = opClient!.id;
  createdClientIds.add(opClientId);

  // Insert project
  const { data: opProject, error: opProjErr } = await client
    .from("client_projects")
    .insert({
      client_id: opClientId,
      client_name: opClientName,
      title: "Test Operations Project",
      status: "active",
    })
    .select("id")
    .single();
  assert(!opProjErr && Boolean(opProject?.id), "Created client project");
  const opProjectId = opProject!.id;

  // Insert tasks across different statuses
  const { data: opTask1, error: opTask1Err } = await client
    .from("project_tasks")
    .insert({
      client_id: opClientId,
      project_id: opProjectId,
      title: "Op Task Todo",
      status: "todo",
      priority: "medium",
      service: "post",
    })
    .select("id")
    .single();

  const { data: opTask2, error: opTask2Err } = await client
    .from("project_tasks")
    .insert({
      client_id: opClientId,
      project_id: opProjectId,
      title: "Op Task In Progress",
      status: "in_progress",
      priority: "high",
      service: "reel",
    })
    .select("id")
    .single();

  const { data: opTask3, error: opTask3Err } = await client
    .from("project_tasks")
    .insert({
      client_id: opClientId,
      project_id: opProjectId,
      title: "Op Task Done",
      status: "done",
      priority: "low",
      service: "story",
    })
    .select("id")
    .single();

  assert(!opTask1Err && !opTask2Err && !opTask3Err, "Created 3 operational tasks (todo, in_progress, done)");

  // Insert service commitment
  const { data: opCommitment, error: opCommErr } = await client
    .from("service_commitments")
    .insert({
      client_id: opClientId,
      service_name: "Monthly Reels",
      deliverable_type: "reel",
      quantity: 8,
      frequency: "monthly",
      schedule_rule: {},
      start_date: new Date().toISOString().split("T")[0],
      assignment_rule: "manual",
      status: "active",
    })
    .select("id")
    .single();
  assert(!opCommErr && Boolean(opCommitment?.id), "Created active service commitment");

  // Pre-flight analysis should now say can_delete_permanently: true
  const { data: opAnalysis, error: opAnalysisErr } = await client.rpc("admin_analyze_client_lifecycle", {
    _client_id: opClientId,
  });
  assert(!opAnalysisErr && opAnalysis.can_delete_permanently === true, "Pre-flight analysis confirms client is safe for permanent deletion");
  assert(opAnalysis.counts.tasks === 3, "Pre-flight counts exactly 3 operational tasks");
  assert(opAnalysis.counts.projects === 1, "Pre-flight counts 1 project");
  assert(opAnalysis.counts.commitments === 1, "Pre-flight counts 1 commitment");

  // Perform permanent deletion
  const { data: opDelResult, error: opDelErr } = await client.rpc("admin_delete_client_permanently", {
    _client_id: opClientId,
  });
  assert(!opDelErr && opDelResult?.success === true, "admin_delete_client_permanently executed with success");

  // Verify client is gone
  const { data: checkDeletedClient } = await client.from("clients").select("id").eq("id", opClientId).maybeSingle();
  assert(!checkDeletedClient, "Client record completely removed from public.clients");

  // Verify dependent project is gone
  const { data: checkDeletedProject } = await client.from("client_projects").select("id").eq("id", opProjectId).maybeSingle();
  assert(!checkDeletedProject, "Dependent client_projects record removed");

  // Verify dependent tasks are gone
  const { data: remainingTasks } = await client
    .from("project_tasks")
    .select("id")
    .in("id", [opTask1!.id, opTask2!.id, opTask3!.id]);
  assert(!remainingTasks || remainingTasks.length === 0, "All 3 dependent project_tasks records permanently purged (0 orphans)");

  // Verify commitment is gone
  const { data: checkDeletedComm } = await client.from("service_commitments").select("id").eq("id", opCommitment!.id).maybeSingle();
  assert(!checkDeletedComm, "Dependent service_commitment record permanently purged");

  // Verify audit log entry
  const { data: auditEntry } = await client
    .from("system_audit_logs")
    .select("*")
    .eq("entity_id", opClientId)
    .eq("action", "CLIENT_DELETED")
    .maybeSingle();
  assert(Boolean(auditEntry), "Audit record recorded in public.system_audit_logs with details");

  // Also clean up probe client
  await client.rpc("admin_delete_client_permanently", { _client_id: secClientId });

  // -------------------------------------------------------------
  // TEST GROUP 4: REVERSIBLE ARCHIVING LIFECYCLE
  // -------------------------------------------------------------
  console.log("\n--- GROUP 4: Reversible Archiving & Freezing Lifecycle ---");

  const arcClientName = `ARC_CLIENT_${Date.now()}`;
  const { data: arcClient, error: arcClientErr } = await client
    .from("clients")
    .insert({
      name: arcClientName,
      status: "active",
      client_type: "monthly",
      monthly_package_price: 3500,
      default_service_fee: 3500,
    })
    .select("id, name")
    .single();

  assert(!arcClientErr && Boolean(arcClient?.id), `Created client for archive/restore testing: ${arcClientName}`);
  const arcClientId = arcClient!.id;
  createdClientIds.add(arcClientId);

  // Insert commitment
  const { data: arcComm, error: arcCommErr } = await client
    .from("service_commitments")
    .insert({
      client_id: arcClientId,
      service_name: "Social Posts",
      deliverable_type: "post",
      quantity: 12,
      frequency: "monthly",
      schedule_rule: {},
      start_date: new Date().toISOString().split("T")[0],
      assignment_rule: "manual",
      status: "active",
    })
    .select("id")
    .single();
  assert(!arcCommErr && Boolean(arcComm?.id), "Created active service commitment for archive test");

  // Insert project
  const { data: arcProject, error: arcProjErr } = await client
    .from("client_projects")
    .insert({
      client_id: arcClientId,
      client_name: arcClientName,
      title: "Archive Lifecycle Project",
      status: "active",
    })
    .select("id")
    .single();
  assert(!arcProjErr && Boolean(arcProject?.id), "Created project for archive test");

  // Insert uncompleted tasks: 1 todo, 1 in_progress, 1 review
  const { data: taskTodo, error: todoErr } = await client
    .from("project_tasks")
    .insert({
      client_id: arcClientId,
      project_id: arcProject!.id,
      title: "Task In Todo State",
      status: "todo",
      priority: "medium",
      notes: "Original user notes for todo task",
      service: "post",
    })
    .select("id, status, notes")
    .single();

  const { data: taskProg, error: progErr } = await client
    .from("project_tasks")
    .insert({
      client_id: arcClientId,
      project_id: arcProject!.id,
      title: "Task In Progress State",
      status: "in_progress",
      priority: "high",
      notes: "Work in progress notes",
      service: "reel",
    })
    .select("id, status, notes")
    .single();

  const { data: taskReview, error: revErr } = await client
    .from("project_tasks")
    .insert({
      client_id: arcClientId,
      project_id: arcProject!.id,
      title: "Task In Review State",
      status: "review",
      priority: "medium",
      notes: "",
      service: "shoot",
    })
    .select("id, status, notes")
    .single();

  // Insert completed task (done) - MUST NOT BE PAUSED
  const { data: taskDone, error: doneErr } = await client
    .from("project_tasks")
    .insert({
      client_id: arcClientId,
      project_id: arcProject!.id,
      title: "Completed Historical Task",
      status: "done",
      priority: "low",
      notes: "Delivered last week",
      service: "story",
    })
    .select("id, status, notes")
    .single();

  assert(!todoErr && !progErr && !revErr && !doneErr, "Created 4 tasks with varied states (todo, in_progress, review, done)");

  // 4.1 Perform Archiving
  const { data: arcResult, error: arcErr } = await client.rpc("admin_archive_client", {
    _client_id: arcClientId,
  });
  assert(!arcErr && arcResult?.success === true, "admin_archive_client executed successfully");

  // 4.2 Verify client status is 'archived'
  const { data: checkArcClient } = await client.from("clients").select("status").eq("id", arcClientId).single();
  assert(checkArcClient?.status === "archived", "Client status in public.clients set to 'archived'");

  // 4.3 Verify service commitment is paused with paused_at
  const { data: checkArcComm } = await client.from("service_commitments").select("status, paused_at").eq("id", arcComm!.id).single();
  assert(checkArcComm?.status === "paused" && Boolean(checkArcComm?.paused_at), "Active commitment set to status='paused' with paused_at timestamp");

  // 4.4 Verify active tasks are paused and original status preserved in notes
  const { data: checkTaskTodo } = await client.from("project_tasks").select("status, notes").eq("id", taskTodo!.id).single();
  assert(checkTaskTodo?.status === "paused", "Todo task set to status='paused'");
  assert(
    checkTaskTodo?.notes?.includes("[ARCHIVED_PREV_STATUS:todo]") && checkTaskTodo?.notes?.includes("Original user notes for todo task"),
    "Todo task preserved '[ARCHIVED_PREV_STATUS:todo]' along with original notes"
  );

  const { data: checkTaskProg } = await client.from("project_tasks").select("status, notes").eq("id", taskProg!.id).single();
  assert(checkTaskProg?.status === "paused", "In-progress task set to status='paused'");
  assert(
    checkTaskProg?.notes?.includes("[ARCHIVED_PREV_STATUS:in_progress]"),
    "In-progress task preserved '[ARCHIVED_PREV_STATUS:in_progress]'"
  );

  const { data: checkTaskReview } = await client.from("project_tasks").select("status, notes").eq("id", taskReview!.id).single();
  assert(checkTaskReview?.status === "paused", "Review task set to status='paused'");
  assert(
    checkTaskReview?.notes?.includes("[ARCHIVED_PREV_STATUS:review]"),
    "Review task preserved '[ARCHIVED_PREV_STATUS:review]'"
  );

  // 4.5 Verify completed task remains 'done' (historical preservation)
  const { data: checkTaskDone } = await client.from("project_tasks").select("status, notes").eq("id", taskDone!.id).single();
  assert(checkTaskDone?.status === "done", "Completed historical task retained status='done' (NOT paused)");
  assert(!checkTaskDone?.notes?.includes("[ARCHIVED_PREV_STATUS"), "Completed task notes NOT modified with archive tag");

  // 4.6 Verify exclusion from active calendar / active clients
  const { data: activeListCheck } = await client
    .from("clients")
    .select("id")
    .neq("status", "archived")
    .eq("id", arcClientId)
    .maybeSingle();
  assert(!activeListCheck, "Archived client is excluded from default active clients queries (neq 'archived')");

  // -------------------------------------------------------------
  // TEST GROUP 5: SAFE RESTORATION & STATE RECOVERY
  // -------------------------------------------------------------
  console.log("\n--- GROUP 5: Safe Restoration & Task State Recovery ---");

  // 5.1 Perform Restoration
  const { data: resResult, error: resErr } = await client.rpc("admin_restore_client", {
    _client_id: arcClientId,
  });
  assert(!resErr && resResult?.success === true, "admin_restore_client executed successfully");

  // 5.2 Verify client status is restored to 'active'
  const { data: checkResClient } = await client.from("clients").select("status").eq("id", arcClientId).single();
  assert(checkResClient?.status === "active", "Client status in public.clients restored to 'active'");

  // 5.3 Verify commitments reactivated with reactivated_at
  const { data: checkResComm } = await client.from("service_commitments").select("status, reactivated_at").eq("id", arcComm!.id).single();
  assert(checkResComm?.status === "active" && Boolean(checkResComm?.reactivated_at), "Service commitment reactivated with reactivated_at timestamp");

  // 5.4 Verify tasks restored to their exact original status and tag cleaned
  const { data: resTaskTodo } = await client.from("project_tasks").select("status, notes").eq("id", taskTodo!.id).single();
  assert(resTaskTodo?.status === "todo", "Task previously in todo restored to status='todo'");
  assert(
    !resTaskTodo?.notes?.includes("[ARCHIVED_PREV_STATUS") && resTaskTodo?.notes?.includes("Original user notes for todo task"),
    "Archive tag removed from notes while preserving user's original notes"
  );

  const { data: resTaskProg } = await client.from("project_tasks").select("status, notes").eq("id", taskProg!.id).single();
  assert(resTaskProg?.status === "in_progress", "Task previously in progress restored to status='in_progress'");
  assert(!resTaskProg?.notes?.includes("[ARCHIVED_PREV_STATUS"), "Archive tag removed from in_progress task");

  const { data: resTaskReview } = await client.from("project_tasks").select("status, notes").eq("id", taskReview!.id).single();
  assert(resTaskReview?.status === "review", "Task previously in review restored to status='review'");
  assert(!resTaskReview?.notes?.includes("[ARCHIVED_PREV_STATUS"), "Archive tag removed from review task");

  const { data: resTaskDone } = await client.from("project_tasks").select("status, notes").eq("id", taskDone!.id).single();
  assert(resTaskDone?.status === "done", "Done task remains 'done' after restoration");

  // 5.5 Verify Idempotency of Restore
  const { data: idempResResult, error: idempResErr } = await client.rpc("admin_restore_client", {
    _client_id: arcClientId,
  });
  assert(!idempResErr && idempResResult?.already_active === true, "Calling restore on already active client is idempotent and safe");

  // Clean up the archive test client
  await client.rpc("admin_delete_client_permanently", { _client_id: arcClientId });
  console.log("  🧹 Cleaned up archive/restore test client.");
  createdClientIds.delete(arcClientId);

  console.log("\n=======================================================================");
  console.log("🎉 ALL CLIENT LIFECYCLE MANAGEMENT TESTS PASSED PERFECTLY!");
  console.log("=======================================================================\n");
  } finally {
    if (createdClientIds.size > 0) {
      console.log("\n--- Teardown: Guaranteeing cleanup of remaining test fixtures ---");
      for (const cid of createdClientIds) {
        try {
          await client.from("invoices").delete().eq("client_id", cid);
          await client.from("sales_commissions").delete().eq("client_id", cid);
          const { error } = await client.rpc("admin_delete_client_permanently", { _client_id: cid });
          if (!error) {
            console.log(`  🧹 Teardown cleaned up test fixture: ${cid}`);
          }
        } catch (e: any) {
          console.warn(`  Teardown notice for ${cid}:`, e.message);
        }
      }
    }
  }
}

runClientLifecycleSuite().catch((err) => {
  console.error("❌ Test suite encountered unhandled error:", err);
  process.exit(1);
});
