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

async function evaluateDashboardData() {
  const clientWorker = createClient(supabaseUrl, anonKey);
  const { data: wAuth } = await clientWorker.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!"
  });

  const workerId = wAuth?.user?.id;
  console.log("Authenticated Worker ID:", workerId);

  const [projRes, tasksRes] = await Promise.all([
    clientWorker.from("client_projects").select("*"),
    clientWorker.from("project_tasks").select("*")
  ]);

  const projects = projRes.data || [];
  const tasks = tasksRes.data || [];

  console.log("Total fetched projects:", projects.length);
  console.log("Total fetched tasks:", tasks.length);

  // Check task statuses
  const statusCounts: Record<string, number> = {};
  for (const t of tasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }
  console.log("Tasks status counts:", statusCounts);

  // Check blocked tasks
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  console.log("Blocked tasks total count across all projects:", blockedTasks.length);

  // Tasks assigned to this worker
  const workerTasks = tasks.filter(t => t.assignee_id === workerId);
  console.log("Tasks assigned to worker:", workerTasks.length);

  // Check project lead IDs
  const myProjects = projects.filter(p => p.lead_id === workerId || p.project_lead_id === workerId);
  console.log("Projects led by worker:", myProjects.length);

  // Check client followup status
  const followups = projects.filter(p => p.followup_status);
  console.log("Projects with followup_status:", followups.map(p => ({ client: p.client_name, status: p.followup_status, date: p.next_followup_date })));

  // Check deliverable tasks (top level deliverables: parent_task_id is null)
  const deliverables = tasks.filter(t => !t.parent_task_id && (t.category?.toLowerCase().includes("reel") || t.category?.toLowerCase().includes("post") || t.service));
  console.log("Deliverable tasks count:", deliverables.length);
}

evaluateDashboardData().catch(console.error);
