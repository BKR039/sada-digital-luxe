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

async function testWorkerData() {
  console.log("=== VERIFY WORKER POST-MIGRATION ===");

  const { data: auth, error: authErr } = await client.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  if (authErr) throw authErr;
  console.log("Worker logged in:", auth.user?.id);

  // 1. Check project_members
  const { data: pm, error: pmErr } = await client.from("project_members").select("*");
  console.log("Worker project_members:", pm?.length, pmErr?.message || "OK");

  // 2. Check project_tasks assigned to worker
  const { data: tasks, error: tasksErr } = await client.from("project_tasks").select("id, title, status, priority, deadline, assignee_id").eq("assignee_id", auth.user!.id);
  console.log("Worker assigned tasks count:", tasks?.length, tasksErr?.message || "OK");
  console.log("Tasks:", tasks);

  // 3. Check deals (leads/sales) owned by worker
  const { data: deals, error: dealsErr } = await client.from("deals").select("id, title, stage, deal_value, service_revenue, sponsoring_budget, commission_rate, payment_status, sales_owner_id");
  console.log("Worker deals count (should only be worker's deals):", deals?.length, dealsErr?.message || "OK");
  console.log("Worker deals:", deals);

  // 4. Check sales_commissions
  const { data: comms, error: commsErr } = await client.from("sales_commissions").select("*");
  console.log("Worker commissions count:", comms?.length, commsErr?.message || "OK");
  console.log("Worker commissions:", comms);

  // 5. Check if worker can see other workers' private deals (RLS test)
  const otherDeals = deals?.filter(d => d.sales_owner_id && d.sales_owner_id !== auth.user!.id);
  console.log("Other workers' deals visible to worker (MUST BE 0):", otherDeals?.length);
}

testWorkerData().catch(console.error);
