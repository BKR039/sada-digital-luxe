import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1]] = val;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY!;
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_ANON_KEY = anonKey;

async function debugRec() {
  const { supabase } = await import("../src/integrations/supabase/client");

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  console.log("Auth login:", auth?.user?.email, "Error:", authErr?.message);

  const { data: projs } = await supabase.from("client_projects").select("id, client_id, client_name").limit(1);
  const p = projs![0];
  console.log("Existing project:", p);

  // 1. Direct task insertion with minimal valid fields
  const { data: t1, error: e1 } = await supabase.from("project_tasks").insert({
    title: "Test Task 1",
    project_id: p.id,
    client_id: p.client_id,
    status: "todo",
    priority: "medium",
  }).select().single();
  console.log("T1 result:", t1?.id, "Error 1:", e1?.message);

  // 2. Direct task insertion with reconciliation fields
  const { data: t2, error: e2 } = await supabase.from("project_tasks").insert({
    title: "Test Task 2",
    project_id: p.id,
    client_id: p.client_id,
    status: "todo",
    priority: "medium",
    source_type: "package_reconciliation",
    is_reconciliation_managed: true,
    delivery_period: "2026-10",
    idempotency_key: `commit_test_2026-10-15_seq1`,
  }).select().single();
  console.log("T2 result:", t2?.id, "Error 2:", e2?.message);

  // 3. Direct task insertion with deliverable_id and commitment_id as strings vs UUIDs
  const { data: t3, error: e3 } = await supabase.from("project_tasks").insert({
    title: "Test Task 3",
    project_id: p.id,
    client_id: p.client_id,
    status: "todo",
    priority: "medium",
    commitment_id: "commit_some_id",
  }).select().single();
  console.log("T3 (string commitment_id) Error:", e3?.message);

  // Clean up
  if (t1) await supabase.from("project_tasks").delete().eq("id", t1.id);
  if (t2) await supabase.from("project_tasks").delete().eq("id", t2.id);
}

debugRec().catch(e => console.error("FATAL:", e));
