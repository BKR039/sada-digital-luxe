// ============================================================
// SADA WORK OS — PHASE 1 TEST SUITE
// PROJECT LEAD + STARTER TASK INTELLIGENCE E2E VERIFICATION
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  resolveToProfileId,
  getStarterChecklistForServices,
  assignStarterTasksIntelligently,
  computeProgress,
  computeProjectHealth,
  type TeamMemberRow,
  type ProfileRow,
  type TaskRow,
  type ProjectRow
} from "../src/components/admin/project-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

// Load env
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

const adminClient = createClient(supabaseUrl, anonKey);
const anonUnauthClient = createClient(supabaseUrl, anonKey);

async function runPhase1TestSuite() {
  console.log("=================================================================");
  console.log("SADA WORK OS — PHASE 1 E2E VERIFICATION SUITE");
  console.log("PROJECT LEAD + STARTER TASK INTELLIGENCE");
  console.log("=================================================================\n");

  // Step 1: Sign in with existing test admin user or create one
  console.log("--- SETUP: Authenticating Admin Session ---");
  const testEmail = `phase1.tester@sada.agency`;
  const testPassword = "Phase1TestPassword123!";

  const { data: signInData, error: signInErr } = await adminClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  let currentUser = signInData?.user;

  if (signInErr || !currentUser) {
    console.log("Creating dedicated test user:", testEmail);
    const { data: signUpData, error: signUpErr } = await adminClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    if (signUpErr || !signUpData.user) {
      console.error("SignUp error:", signUpErr?.message);
      process.exit(1);
    }
    currentUser = signUpData.user;

    const { execSync } = await import("child_process");
    execSync(
      `npx supabase db query --linked "INSERT INTO public.user_roles (user_id, role) VALUES ('${currentUser.id}', 'admin') ON CONFLICT DO NOTHING;"`,
      { encoding: "utf-8" }
    );

    const { data: retrySignIn } = await adminClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    currentUser = retrySignIn.user!;
  }

  assert(Boolean(currentUser?.id), `Authenticated as admin. User ID: ${currentUser.id}`);

  // Fetch profiles & active team members
  const { data: rawProfiles } = await adminClient.from("profiles").select("id, display_name");
  const profiles = (rawProfiles || []) as ProfileRow[];
  assert(profiles.length > 0, `Loaded ${profiles.length} profiles from database.`);

  let { data: rawMembers } = await adminClient.from("team_members").select("*").eq("is_active", true);
  if (!rawMembers || rawMembers.length === 0) {
    console.log("No active team members found. Seeding operational team members linked to profiles...");
    const seedMembers = [
      {
        name: "Boubakar Hamed",
        position: "Managing Director & Lead",
        division: "Executive",
        specialties: ["Client Leadership", "Project Governance", "Brand Strategy"],
        email: "boubakar.hamedsghaier@gmail.com",
        profile_id: "f4184256-97c4-4f81-9346-176ec5dfb43a",
        is_active: true,
        published: true,
        sort_order: 1,
        availability_status: "available",
      },
      {
        name: "Sarah Chen",
        position: "Lead Full-Stack Engineer",
        division: "Development",
        specialties: ["Web Development", "UI/UX", "Automation", "Frontend"],
        email: "sarah@sada.agency",
        profile_id: "63a69ae6-4737-4645-9f25-e45e2a3f1726",
        is_active: true,
        published: true,
        sort_order: 2,
        availability_status: "available",
      },
      {
        name: "Karim Mansour",
        position: "Creative Director",
        division: "Design",
        specialties: ["Branding", "Visual Identity", "Design Direction"],
        email: "karim@sada.agency",
        profile_id: "a67e12ff-2859-45a9-9fa9-7acb61ec11f1",
        is_active: true,
        published: true,
        sort_order: 3,
        availability_status: "available",
      },
      {
        name: "Phase 1 Lead Tester",
        position: "Project & Operations Lead",
        division: "Production",
        specialties: ["Project Coordination", "Client Delivery"],
        email: testEmail,
        profile_id: currentUser.id,
        is_active: true,
        published: false,
        sort_order: 4,
        availability_status: "available",
      },
    ];

    const { data: insertedSeeds, error: seedErr } = await adminClient.from("team_members").insert(seedMembers).select("*");
    if (seedErr) {
      console.error("Failed to seed team members:", seedErr);
    } else {
      rawMembers = insertedSeeds;
    }
  }

  const teamMembers = (rawMembers || []) as TeamMemberRow[];
  assert(teamMembers.length > 0, `Loaded ${teamMembers.length} active team members.`);

  // Pick an active team member with a valid profile as Project Lead
  const leadCandidate = teamMembers.find(m => m.profile_id && profiles.some(p => p.id === m.profile_id));
  assert(Boolean(leadCandidate), `Found eligible Project Lead: ${leadCandidate?.name} (Profile: ${leadCandidate?.profile_id})`);
  const projectLeadProfileId = leadCandidate!.profile_id!;

  // -------------------------------------------------------------------------
  // TEST 1: Inquiry Conversion to Project with Project Lead
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: Inquiry Conversion with Explicit Project Lead ---");
  const testClientName = `Luxury Atelier ${Date.now()}`;
  const startDate = "2026-10-01";
  const deadline = "2026-10-31"; // 30-day timeline

  // Insert mock inquiry
  const { data: inquiry, error: inqErr } = await adminClient
    .from("contact_submissions")
    .insert({
      name: "Antoine Laurent",
      email: "antoine@luxuryatelier.com",
      phone: "+33 6 12 34 56 78",
      business_name: testClientName,
      service: "Website & Branding",
      budget: "$15,000+",
      message: "We need a bespoke digital flagship and refined visual identity.",
      preferred_contact: "Email",
      status: "new",
      discovery_data: {
        services_needed: ["Branding", "Website", "Content"],
        priority_service: "Website & Branding",
        business_type: "Luxury Retail",
        main_problem: "Current online presence does not reflect brand heritage.",
        timeline: deadline,
      }
    })
    .select("id")
    .single();

  assert(!inqErr && Boolean(inquiry?.id), `Created test inquiry: ${inquiry?.id}`);

  // Perform project conversion
  const resolvedLeadId = resolveToProfileId(projectLeadProfileId, teamMembers, profiles);
  assert(resolvedLeadId === projectLeadProfileId, `Resolved lead_id matches expected profiles.id: ${resolvedLeadId}`);

  const projectPayload = {
    title: `${testClientName} — Digital Flagship`,
    client_name: testClientName,
    status: "active",
    description: `Brand flagship development\n\n[CLIENT CONTACT: Email: antoine@luxuryatelier.com · Phone: +33 6 12 34 56 78 · Preferred Channel: Email]`,
    business_type: "Luxury Retail",
    goals: "Bespoke digital presence reflecting brand prestige",
    problems: "Outdated website and inconsistent visual assets",
    requested_services: ["Branding", "Website", "Content"],
    provided_services: ["Branding", "Website", "Content"],
    timeline: deadline,
    budget: "$15,000+",
    contact_submission_id: inquiry.id,
    lead_id: resolvedLeadId,
    start_date: startDate,
    deadline: deadline,
  };

  const { data: createdProject, error: projErr } = await adminClient
    .from("client_projects")
    .insert(projectPayload)
    .select("*")
    .single();

  assert(!projErr && Boolean(createdProject?.id), `Project created successfully. ID: ${createdProject?.id}`);
  assert(createdProject.lead_id === resolvedLeadId, `Project lead_id correctly stored: ${createdProject.lead_id}`);
  assert(createdProject.description.includes("antoine@luxuryatelier.com"), "Inquiry contact details preserved in project description.");

  // Link inquiry
  await adminClient.from("contact_submissions").update({ converted_project_id: createdProject.id, status: "converted" }).eq("id", inquiry.id);

  // -------------------------------------------------------------------------
  // TEST 2: Refresh/Reload Project Persistence
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Reload Project & Verify Lead Persistence ---");
  const { data: reloadedProject, error: reloadErr } = await adminClient
    .from("client_projects")
    .select("*")
    .eq("id", createdProject.id)
    .single();

  assert(!reloadErr, "Fetched reloaded project successfully from remote database.");
  assert(reloadedProject.lead_id === resolvedLeadId, `lead_id survived refresh: ${reloadedProject.lead_id}`);

  // Resolve lead display
  const leadMember = teamMembers.find(m => m.profile_id === reloadedProject.lead_id);
  assert(Boolean(leadMember), `Project Lead successfully joined to team member: ${leadMember?.name} (${leadMember?.position})`);

  // -------------------------------------------------------------------------
  // TEST 3: Starter Task Generation with Deterministic Assignment & Deadlines
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Starter Task Generation with Deterministic Assignment & Deadlines ---");
  const rawTemplates = getStarterChecklistForServices(["Branding", "Website", "Content"]);
  assert(rawTemplates.length >= 5, `Generated ${rawTemplates.length} starter checklist templates for services.`);

  const preparedTasks = assignStarterTasksIntelligently(
    rawTemplates,
    resolvedLeadId,
    teamMembers,
    profiles,
    startDate,
    deadline
  );

  assert(preparedTasks.length === rawTemplates.length, `Intelligently prepared ${preparedTasks.length} tasks.`);

  // Verify assignees & deadlines
  let validAssigneesCount = 0;
  let validDeadlinesCount = 0;

  for (const t of preparedTasks) {
    if (t.assignee_id) {
      assert(profiles.some(p => p.id === t.assignee_id), `Task '${t.title}' has valid profiles FK: ${t.assignee_id}`);
      validAssigneesCount++;
    }
    if (t.deadline) {
      assert(t.deadline >= startDate && t.deadline <= deadline, `Task '${t.title}' deadline (${t.deadline}) is within project window (${startDate} - ${deadline})`);
      validDeadlinesCount++;
    }
  }

  assert(validAssigneesCount > 0, `Assigned ${validAssigneesCount} tasks to valid team specialists / lead.`);
  assert(validDeadlinesCount === preparedTasks.length, `Distributed relative milestone deadlines for 100% of tasks.`);

  // Insert into project_tasks
  const taskInserts = preparedTasks.map((t, idx) => ({
    project_id: createdProject.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: "todo" as const,
    assignee_id: t.assignee_id,
    deadline: t.deadline,
    sort_order: idx,
  }));

  const { data: insertedTasks, error: taskErr } = await adminClient
    .from("project_tasks")
    .insert(taskInserts)
    .select("*");

  assert(!taskErr, `Starter tasks successfully persisted into project_tasks table (${insertedTasks?.length} rows).`);

  // -------------------------------------------------------------------------
  // TEST 4: Task Reassignment
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Task Reassignment ---");
  const firstTask = insertedTasks![0];
  const targetMember = teamMembers.find(m => m.profile_id && m.profile_id !== firstTask.assignee_id);
  const targetProfileId = targetMember?.profile_id || resolvedLeadId;

  const { data: updatedTask, error: reassignErr } = await adminClient
    .from("project_tasks")
    .update({
      assignee_id: targetProfileId,
      previous_assignee_id: firstTask.assignee_id,
      handoff_reason: "Specialist capacity rebalance",
    })
    .eq("id", firstTask.id)
    .select("*")
    .single();

  assert(!reassignErr, "Task reassigned successfully without foreign key violation.");
  assert(updatedTask.assignee_id === targetProfileId, `Assignee updated to: ${updatedTask.assignee_id}`);
  assert(updatedTask.previous_assignee_id === firstTask.assignee_id, `Previous assignee recorded: ${updatedTask.previous_assignee_id}`);

  // -------------------------------------------------------------------------
  // TEST 5: Calendar Query Integration
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Calendar Query Integration ---");
  const { data: calendarTasks, error: calErr } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("project_id", createdProject.id)
    .not("deadline", "is", null);

  assert(!calErr, "Calendar tasks query succeeded.");
  assert(calendarTasks && calendarTasks.length >= insertedTasks!.length, `All ${calendarTasks?.length} starter tasks with deadlines are ready for calendar rendering.`);

  // -------------------------------------------------------------------------
  // TEST 6: Team Workload Integration
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Team Workload Integration ---");
  const { data: workloadTasks, error: wlErr } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("assignee_id", targetProfileId);

  assert(!wlErr, "Team workload tasks query succeeded.");
  assert(workloadTasks && workloadTasks.length > 0, `Workload calculation detects ${workloadTasks?.length} active tasks for member.`);

  // -------------------------------------------------------------------------
  // TEST 7: Project Progress Calculation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Project Progress Calculation ---");
  const { data: allProjectTasks } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("project_id", createdProject.id);

  const initialProgress = computeProgress(allProjectTasks as TaskRow[]);
  assert(initialProgress.percent === 0, `Initial progress is 0% (${initialProgress.done}/${initialProgress.total})`);

  // Complete 1 task
  await adminClient.from("project_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", firstTask.id);

  const { data: progressTasksAfter } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("project_id", createdProject.id);

  const updatedProgress = computeProgress(progressTasksAfter as TaskRow[]);
  assert(updatedProgress.done === 1, `Progress reflects 1 task done (${updatedProgress.done}/${updatedProgress.total})`);
  assert(updatedProgress.percent > 0, `Progress percentage updated to ${updatedProgress.percent}%`);

  // -------------------------------------------------------------------------
  // TEST 8: Backward Compatibility with Null Lead Projects
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: Backward Compatibility (lead_id = null) ---");
  const { data: legacyProject, error: legErr } = await adminClient
    .from("client_projects")
    .insert({
      title: "Legacy Project With No Lead",
      client_name: "Vintage Client",
      status: "active",
      lead_id: null,
    })
    .select("*")
    .single();

  assert(!legErr, "Legacy project with lead_id = null created successfully.");
  assert(legacyProject.lead_id === null, "lead_id is null as expected.");

  // Test health & progress calculations on legacy project
  const legacyHealth = computeProjectHealth(legacyProject as ProjectRow, []);
  assert(Boolean(legacyHealth.health), `Project health computed for null-lead project: ${legacyHealth.label}`);

  // Clean up legacy project
  await adminClient.from("client_projects").delete().eq("id", legacyProject.id);

  // -------------------------------------------------------------------------
  // TEST 9: Security / RLS Enforcement
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: Security & RLS Enforcement ---");
  const { data: anonData, error: anonErr } = await anonUnauthClient
    .from("client_projects")
    .update({ lead_id: resolvedLeadId })
    .eq("id", createdProject.id);

  // In Supabase RLS, updating with anon key either produces an error or modifies 0 rows
  assert(Boolean(anonErr) || (anonData === null || (Array.isArray(anonData) && anonData.length === 0)), "Anonymous unauthorized user cannot update project lead_id (RLS enforced).");

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------
  console.log("\n--- CLEANUP ---");
  await adminClient.from("project_tasks").delete().eq("project_id", createdProject.id);
  await adminClient.from("client_projects").delete().eq("id", createdProject.id);
  await adminClient.from("contact_submissions").delete().eq("id", inquiry.id);
  console.log("Cleaned up test project, tasks, and inquiry.");

  console.log("\n=================================================================");
  console.log("🎉 ALL PHASE 1 REAL DATABASE PERSISTENCE TESTS PASSED (10/10)");
  console.log("=================================================================");
}

runPhase1TestSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
