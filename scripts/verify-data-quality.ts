/**
 * SADA OS — Data Quality & Source Integrity Audit Script (Authenticated)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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
const supabase = createClient(supabaseUrl, anonKey);

async function verifyDataQuality() {
  console.log("\n=======================================================");
  console.log("SADA OS — Data Quality & Financial Integrity Audit");
  console.log("=======================================================\n");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authError || !authData.session) {
    console.error("Auth failed:", authError?.message);
    process.exit(1);
  }
  console.log("Authenticated as SuperAdmin:", authData.user.email);

  // 1. Task Notes & Serialization in project_tasks
  console.log("\n--- 1. Checking Task Notes & Workflow Serialization in project_tasks ---");
  const { data: tasks, error: taskError } = await supabase
    .from("project_tasks")
    .select("id, title, notes, status, priority, category, service")
    .limit(100);

  if (taskError) {
    console.error("Failed to query project_tasks:", taskError.message);
  } else {
    console.log(`Audited ${tasks.length} tasks from project_tasks.`);
    const tasksWithWorkflowTag = tasks.filter((t) => t.notes && t.notes.includes("[WORKFLOW_STAGE:"));
    console.log(`Tasks with [WORKFLOW_STAGE:...] serialization in DB: ${tasksWithWorkflowTag.length}`);
    tasksWithWorkflowTag.forEach((t) => {
      console.log(`  - Task [${t.id.slice(0, 8)}] "${t.title}": notes prefix = "${t.notes?.slice(0, 50)}..."`);
    });

    const tasksWithDoubleNumbering = tasks.filter((t) => /(?:1\.\s*1\.|2\.\s*2\.|3\.\s*3\.)/.test(t.title || ""));
    console.log(`Tasks with double numbering in DB title: ${tasksWithDoubleNumbering.length}`);
  }

  // 2. Client Records & Descriptions
  console.log("\n--- 2. Auditing Client Records ---");
  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .select("id, name, industry, status, client_type, created_at")
    .limit(50);

  if (clientError) {
    console.error("Failed to query clients:", clientError.message);
  } else {
    console.log(`Audited ${clients.length} clients.`);
    clients.forEach((c) => {
      console.log(`  - Client: "${c.name}" | Industry: "${c.industry || 'N/A'}" | Type: ${c.client_type || 'standard'} | Status: ${c.status}`);
    });
  }

  // 3. Projects Summary
  console.log("\n--- 3. Auditing Client Projects ---");
  const { data: projects, error: projError } = await supabase
    .from("client_projects")
    .select("id, name, status, health_score");

  if (!projError && projects) {
    console.log(`Total projects in client_projects: ${projects.length}`);
    const activeProjects = projects.filter((p) => p.status === "active" || p.status === "in_progress");
    console.log(`Active / In-progress projects: ${activeProjects.length}`);
  }

  // 4. Invoices / Deals
  console.log("\n--- 4. Auditing Deals & Invoices ---");
  const { data: deals, error: dealError } = await supabase
    .from("deals")
    .select("id, title, value, status, stage");

  if (!dealError && deals) {
    console.log(`Audited ${deals.length} deals.`);
    const wonDeals = deals.filter((d) => d.stage === "won" || d.status === "won");
    const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    console.log(`Won deals: ${wonDeals.length} deals totaling ${wonValue.toLocaleString()} TND`);
  }

  console.log("\nData Quality Audit Completed.");
}

verifyDataQuality();
