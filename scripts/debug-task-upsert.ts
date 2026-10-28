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

async function testDeliverableAndTask() {
  const { supabase } = await import("../src/integrations/supabase/client");

  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: projs } = await supabase.from("client_projects").select("id, client_id").limit(1);
  const p = projs![0];

  const { data: pkgs } = await supabase.from("package_catalog").select("id").limit(1);
  const catalogPkgId = pkgs![0].id;

  // Test insert with package_id from package_catalog vs null
  console.log("Testing deliverable insert with catalogPkgId:", catalogPkgId);
  const { data: d1, error: e1 } = await supabase.from("client_deliverables").insert({
    client_id: p.client_id,
    project_id: p.id,
    package_id: catalogPkgId,
    title: "Test Deliverable 1",
    deliverable_type: "reel",
    period_month: "2026-10",
    status: "planned",
  }).select().maybeSingle();
  console.log("Deliverable with catalogPkgId error:", e1?.message);

  const { data: d2, error: e2 } = await supabase.from("client_deliverables").insert({
    client_id: p.client_id,
    project_id: p.id,
    package_id: null,
    title: "Test Deliverable 2",
    deliverable_type: "reel",
    period_month: "2026-10",
    status: "planned",
  }).select().maybeSingle();
  console.log("Deliverable with null package_id result:", d2?.id, "Error:", e2?.message);

  if (d2) {
    // Now test task linking to d2.id
    const { data: t, error: te } = await supabase.from("project_tasks").insert({
      client_id: p.client_id,
      project_id: p.id,
      deliverable_id: d2.id,
      title: "Linked Task Test",
      status: "todo",
      priority: "medium",
    }).select().maybeSingle();
    console.log("Task linked to d2.id result:", t?.id, "Error:", te?.message);

    if (t) await supabase.from("project_tasks").delete().eq("id", t.id);
    await supabase.from("client_deliverables").delete().eq("id", d2.id);
  }
}

testDeliverableAndTask().catch(console.error);
