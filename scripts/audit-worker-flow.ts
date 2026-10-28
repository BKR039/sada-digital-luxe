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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

// We use serviceRoleKey if available, otherwise anonKey
const adminClient = createClient(supabaseUrl, serviceRoleKey || anonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function auditWorkerFlow() {
  console.log("=========================================");
  console.log("AUDIT WORKER FLOW & DATA SCOPING");
  console.log("=========================================\n");

  // 1. Inspect user roles
  const { data: userRoles, error: rolesError } = await adminClient
    .from("user_roles")
    .select("user_id, role");
  console.log("1. User Roles in system:", userRoles, rolesError || "");

  // 2. Inspect profiles
  const { data: profiles, error: profError } = await adminClient
    .from("profiles")
    .select("id, display_name");
  console.log("2. Profiles in system:", profiles, profError || "");

  // 3. Inspect team_members
  const { data: teamMembers, error: tmError } = await adminClient
    .from("team_members")
    .select("id, name, email, role, profile_id");
  console.log("3. Team Members:", teamMembers, tmError || "");

  // 4. Inspect client_projects
  const { data: projects, error: projError } = await adminClient
    .from("client_projects")
    .select("id, title, client_name, project_lead_id, lead_id");
  console.log("4. Client Projects count:", projects?.length, projError || "");
  console.log("Sample projects:", projects?.slice(0, 5));

  // 5. Inspect project_tasks
  const { data: tasks, error: tasksError } = await adminClient
    .from("project_tasks")
    .select("id, title, status, assignee_id, assigned_by_id, client_id, project_id");
  console.log("5. Project Tasks count:", tasks?.length, tasksError || "");
  console.log("Sample tasks assignee_ids:", tasks?.slice(0, 10).map(t => ({ title: t.title, assignee_id: t.assignee_id })));

  // Unique assignee_ids in tasks
  const uniqueAssignees = [...new Set(tasks?.map(t => t.assignee_id))];
  console.log("Unique assignee_ids in project_tasks:", uniqueAssignees);

  // 6. Inspect deals / sales
  const { data: deals, error: dealsError } = await adminClient
    .from("deals")
    .select("id, name, stage, value, owner_id");
  console.log("6. Deals count:", deals?.length, dealsError || "");
  console.log("Sample deals:", deals?.slice(0, 5));

  // 7. Check if commissions table exists
  const { data: comms, error: commsError } = await adminClient
    .from("commissions")
    .select("*")
    .limit(5);
  console.log("7. 'commissions' table check:", comms ? `Found ${comms.length} rows` : "Error/Not found", commsError?.message || "");

  const { data: commRules, error: commRulesError } = await adminClient
    .from("commission_rules")
    .select("*")
    .limit(5);
  console.log("8. 'commission_rules' table check:", commRules ? `Found ${commRules.length} rows` : "Error/Not found", commRulesError?.message || "");
}

auditWorkerFlow().catch(console.error);
