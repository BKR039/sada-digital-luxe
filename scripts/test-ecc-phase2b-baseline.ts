import fs from "fs";
import path from "path";
import { supabase } from "../src/integrations/supabase/client";

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

async function measureBaseline() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) throw authErr;

  console.log("Measuring Baseline for Executive Command Center cold load...");

  // Measure admin.index.tsx queries
  const startAdmin = performance.now();
  const [projRes, tasksRes, profRes, teamRes, clientsRes, dealsRes, commsRes] = await Promise.all([
    (supabase as any).from("client_projects").select("*").order("updated_at", { ascending: false }),
    (supabase as any).from("project_tasks").select("*").order("deadline", { ascending: true }),
    (supabase as any).from("profiles").select("id, display_name"),
    (supabase as any).from("team_members").select("*").order("sort_order", { ascending: true }),
    (supabase as any).from("clients").select("id, name, industry, status, client_type"),
    (supabase as any).from("deals").select("*").order("created_at", { ascending: false }),
    (supabase as any).from("sales_commissions").select("*").order("created_at", { ascending: false }),
  ]);
  const adminDuration = performance.now() - startAdmin;

  const adminPayloadBytes = [
    JSON.stringify(projRes.data || "").length,
    JSON.stringify(tasksRes.data || "").length,
    JSON.stringify(profRes.data || "").length,
    JSON.stringify(teamRes.data || "").length,
    JSON.stringify(clientsRes.data || "").length,
    JSON.stringify(dealsRes.data || "").length,
    JSON.stringify(commsRes.data || "").length,
  ].reduce((a, b) => a + b, 0);

  // Measure fetchManagementAnalytics unoptimized (duplicate queries)
  const { fetchManagementAnalytics } = await import("../src/lib/analytics-service");
  const startAnalytics = performance.now();
  const analyticsData = await fetchManagementAnalytics({ periodType: "this_month" });
  const analyticsDuration = performance.now() - startAnalytics;

  console.log({
    adminQueryCount: 7,
    adminDurationMs: Math.round(adminDuration),
    adminPayloadBytes,
    analyticsDurationMs: Math.round(analyticsDuration),
    totalDurationMs: Math.round(adminDuration + analyticsDuration),
    tasksCount: tasksRes.data?.length || 0,
    projectsCount: projRes.data?.length || 0,
  });
}

measureBaseline().catch(console.error);
