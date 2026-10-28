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

async function inspectAssignments() {
  const clientSA = createClient(supabaseUrl, anonKey);
  await clientSA.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  const { data: tasks } = await clientSA.from("project_tasks").select("id, title, assignee_id, status, project_id");
  const { data: projects } = await clientSA.from("client_projects").select("id, title, client_name, lead_id");
  const { data: team } = await clientSA.from("team_members").select("id, name, email, profile_id");

  const teamByProfile = new Map(team?.map(t => [t.profile_id, t]));
  const teamById = new Map(team?.map(t => [t.id, t]));

  console.log("--- TASK ASSIGNEE BREAKDOWN ---");
  const assigneeCounts: Record<string, number> = {};
  for (const t of tasks || []) {
    const key = t.assignee_id || "UNASSIGNED";
    assigneeCounts[key] = (assigneeCounts[key] || 0) + 1;
  }

  for (const [assigneeId, count] of Object.entries(assigneeCounts)) {
    const member = teamByProfile.get(assigneeId) || teamById.get(assigneeId);
    console.log(`Assignee ID: ${assigneeId} | Count: ${count} | Member: ${member?.name || "Unknown/Deleted"} (${member?.email || "no-email"})`);
  }

  console.log("\n--- PROJECT LEAD BREAKDOWN ---");
  const leadCounts: Record<string, number> = {};
  for (const p of projects || []) {
    const key = p.lead_id || "NO_LEAD";
    leadCounts[key] = (leadCounts[key] || 0) + 1;
  }

  for (const [leadId, count] of Object.entries(leadCounts)) {
    const member = teamByProfile.get(leadId) || teamById.get(leadId);
    console.log(`Lead ID: ${leadId} | Count: ${count} | Member: ${member?.name || "Unknown"} (${member?.email || "no-email"})`);
  }
}

inspectAssignments().catch(console.error);
