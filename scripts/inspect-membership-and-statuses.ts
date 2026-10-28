import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Check if project_members or client_project_members exists
  const { data: pm, error: pmErr } = await client.from("project_members").select("*").limit(1);
  console.log("project_members table:", pmErr ? pmErr.message : "Exists!");

  const { data: cpm, error: cpmErr } = await client.from("client_project_members").select("*").limit(1);
  console.log("client_project_members table:", cpmErr ? cpmErr.message : "Exists!");

  // Check client_projects columns
  const { data: cp } = await client.from("client_projects").select("*").limit(1);
  console.log("client_projects columns:", cp ? Object.keys(cp[0]) : "None");

  // Check project_tasks statuses count
  const { data: allTasks } = await client.from("project_tasks").select("status, waiting_on, blocked_reason");
  const statuses: Record<string, number> = {};
  for (const t of allTasks || []) {
    statuses[t.status] = (statuses[t.status] || 0) + 1;
  }
  console.log("Task statuses across DB:", statuses);

  // Check deals
  const { data: allDeals } = await client.from("deals").select("id, title, stage, deal_value, sales_owner_id, commission_recipient_id");
  console.log("Deals count in DB:", allDeals?.length, allDeals);

  // Check sales_commissions
  const { data: allComms } = await client.from("sales_commissions").select("id, team_member_id, status, commission_amount, period_month");
  console.log("sales_commissions in DB:", allComms?.length, allComms);
}

main().catch(console.error);
