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

async function testRoleQueries() {
  console.log("=========================================");
  console.log("TESTING SUPABASE QUERIES UNDER SUPER ADMIN VS WORKER");
  console.log("=========================================\n");

  const clientSA = createClient(supabaseUrl, anonKey);
  const clientWorker = createClient(supabaseUrl, anonKey);

  // Authenticate Super Admin
  const { data: saAuth, error: saAuthErr } = await clientSA.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  if (saAuthErr) {
    console.error("Super Admin sign in failed:", saAuthErr);
    return;
  }
  console.log("Super Admin authenticated successfully! User ID:", saAuth.user.id);

  // Authenticate Worker
  const { data: wAuth, error: wAuthErr } = await clientWorker.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!"
  });

  if (wAuthErr) {
    console.error("Worker sign in failed:", wAuthErr);
    return;
  }
  console.log("Worker authenticated successfully! User ID:", wAuth.user.id);

  console.log("\n--- 1. SUPER ADMIN DATA ACCESS ---");
  const [saProj, saTasks, saClients, saTeam] = await Promise.all([
    clientSA.from("client_projects").select("id, title, client_name, lead_id"),
    clientSA.from("project_tasks").select("id, title, status, assignee_id, project_id"),
    clientSA.from("clients").select("id, name, status"),
    clientSA.from("team_members").select("id, name, email, role, profile_id")
  ]);

  console.log(`SA Projects: ${saProj.data?.length || 0} (Error: ${saProj.error?.message || "none"})`);
  console.log(`SA Tasks: ${saTasks.data?.length || 0} (Error: ${saTasks.error?.message || "none"})`);
  console.log(`SA Clients: ${saClients.data?.length || 0} (Error: ${saClients.error?.message || "none"})`);
  console.log(`SA Team Members: ${saTeam.data?.length || 0} (Error: ${saTeam.error?.message || "none"})`);

  console.log("\n--- 2. WORKER DATA ACCESS ---");
  const [wProj, wTasks, wClients, wTeam] = await Promise.all([
    clientWorker.from("client_projects").select("id, title, client_name, lead_id"),
    clientWorker.from("project_tasks").select("id, title, status, assignee_id, project_id"),
    clientWorker.from("clients").select("id, name, status"),
    clientWorker.from("team_members").select("id, name, email, role, profile_id")
  ]);

  console.log(`Worker Projects: ${wProj.data?.length || 0} (Error: ${wProj.error?.message || "none"})`);
  console.log(`Worker Tasks: ${wTasks.data?.length || 0} (Error: ${wTasks.error?.message || "none"})`);
  console.log(`Worker Clients: ${wClients.data?.length || 0} (Error: ${wClients.error?.message || "none"})`);
  console.log(`Worker Team Members: ${wTeam.data?.length || 0} (Error: ${wTeam.error?.message || "none"})`);

  if (wTasks.data && wTasks.data.length > 0) {
    console.log("Worker tasks sample:", wTasks.data.slice(0, 3));
    const assignedToWorker = wTasks.data.filter(t => t.assignee_id === wAuth.user.id);
    console.log(`Worker tasks assigned directly to Worker ID (${wAuth.user.id}):`, assignedToWorker.length);
  } else if (saTasks.data && saTasks.data.length > 0) {
    console.log("SA tasks sample assignees:", saTasks.data.slice(0, 5).map(t => ({ title: t.title, assignee_id: t.assignee_id })));
  }

  // Check Worker Team Member record and profile_id
  const workerMember = saTeam.data?.find(m => m.email === "qa.worker@sada.agency" || m.profile_id === wAuth.user.id);
  console.log("\nWorker Team Member record in team_members:", workerMember);
}

testRoleQueries().catch(console.error);
