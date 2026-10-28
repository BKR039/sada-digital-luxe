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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

function makeClient(token?: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

async function main() {
  console.log("=== Diagnosing Worker Identity & Data Access ===");
  const authClient = makeClient();
  const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  if (authErr || !authData.session) {
    console.error("Worker login failed:", authErr);
    return;
  }

  const workerToken = authData.session.access_token;
  const workerUserId = authData.user.id;
  const workerClient = makeClient(workerToken);
  console.log(`Worker authenticated: ${authData.user.email} (UID: ${workerUserId})`);

  // Admin client
  const { data: adminAuth } = await authClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  const adminClient = makeClient(adminAuth?.session?.access_token);

  const { data: profiles } = await adminClient.from("profiles").select("*");
  console.log("All Profiles count:", profiles?.length);
  profiles?.forEach((p: any) => console.log(`Profile: ${p.id} | ${p.email} | ${p.role} | ${p.display_name}`));

  const { data: allMembers } = await adminClient.from("team_members").select("id, profile_id, name, email, role, is_active");
  console.log("All team_members count:", allMembers?.length);
  const linked = allMembers?.filter((m: any) => m.profile_id);
  console.log("Linked team members:", linked);

  // 1. Check team_members columns and record for QA Worker Lead
  const { data: tmRecord } = await adminClient.from("team_members").select("*").eq("id", "9c0937f7-4617-4803-b718-a3d9a5175dd9").single();
  console.log("Worker team_members record columns:", Object.keys(tmRecord || {}));
  console.log("Worker team_members values:", tmRecord);

  // 2. Check team_members query as worker
  // Note: in admin.my-work.tsx, it runs: .from("team_members").select("*").eq("is_active", true)
  const { data: teamMembers, error: tmErr } = await workerClient.from("team_members").select("id, profile_id, name, is_active, role");
  console.log("team_members visible to Worker:", teamMembers?.length, "Error:", tmErr?.message);
  if (teamMembers) {
    const workerInTm = teamMembers.find((m: any) => m.profile_id === workerUserId);
    console.log("Worker record found in team_members:", workerInTm);
  }

  // 3. Check fetchWorkerSalaryData simulation
  const queryStr = `profile_id.eq.${workerUserId},email.eq.`;
  console.log("Filter string being tested:", queryStr);
  const { data: brokenQueryData, error: brokenQueryErr } = await workerClient
    .from("team_members")
    .select("id")
    .or(queryStr)
    .maybeSingle();
  console.log("brokenQueryData:", brokenQueryData, "brokenQueryErr:", brokenQueryErr);

  const { data: memberByProfile } = await workerClient
    .from("team_members")
    .select("id")
    .eq("profile_id", workerUserId)
    .maybeSingle();
  console.log("Member resolved by profile_id:", memberByProfile);

  // 4. Check salary_records as worker vs superadmin
  const { data: salaryRecs, error: srErr } = await workerClient
    .from("salary_records")
    .select("*")
    .eq("team_member_id", memberByProfile?.id);
  console.log("salary_records visible to Worker:", salaryRecs?.length, "Error:", srErr?.message);


  const { data: allSalaryRecs } = await adminClient.from("salary_records").select("*, team_member:team_members(name, email, role)");
  console.log("All salary records in DB:", JSON.stringify(allSalaryRecs, null, 2));

  // Check work_sessions columns
  const { data: sampleSession } = await adminClient.from("work_sessions").select("*").limit(1);
  if (sampleSession && sampleSession[0]) {
    console.log("work_sessions columns:", Object.keys(sampleSession[0]));
  }

  // 6. Test submitting a salary advance request
  if (memberByProfile?.id) {
    const { data: newReq, error: reqInsertErr } = await workerClient.from("salary_requests").insert({
      team_member_id: memberByProfile.id,
      requested_amount: 150,
      requested_date: new Date().toISOString().split("T")[0],
      reason: "Diagnostic test advance",
      status: "pending",
    }).select().single();
    console.log("Salary request insert result:", newReq ? `SUCCESS (id: ${newReq.id})` : `FAIL: ${reqInsertErr?.message}`);
    if (newReq) {
      // Clean up
      await workerClient.from("salary_requests").delete().eq("id", newReq.id);
      console.log("Cleaned up test salary request");
    }
  }

  // 7. Test clockIn (work_sessions insert)
  if (memberByProfile?.id) {
    const { data: session, error: sessErr } = await workerClient.from("work_sessions").insert({
      team_member_id: memberByProfile.id,
      profile_id: workerUserId,
      session_type: "production",
      started_at: new Date().toISOString(),
      duration_minutes: 0,
      hourly_cost_rate: 0,
      labor_cost: 0,
      status: "active",
    }).select().single();
    console.log("Work session insert result:", session ? `SUCCESS (id: ${session.id})` : `FAIL: ${sessErr?.message}`);
    if (session) {
      await workerClient.from("work_sessions").delete().eq("id", session.id);
      console.log("Cleaned up test work session");
    }
  }

  // 8. Test calendar / deliverables queries as worker
  const { data: tasks, error: taskErr } = await workerClient.from("project_tasks").select("id, title, deadline, assignee_id");
  console.log("project_tasks count visible to Worker:", tasks?.length, "Error:", taskErr?.message);

  const { data: projects, error: projErr } = await workerClient.from("client_projects").select("id, title, client_name");
  console.log("client_projects count visible to Worker:", projects?.length, "Error:", projErr?.message);
}

main().catch(console.error);
