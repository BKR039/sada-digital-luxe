import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { supabase } from "../src/integrations/supabase/client";

async function testTableReadsAsWorker() {
  const workerEmail = "qa.worker@sada.agency";
  const { data: wAuth, error: wAuthErr } = await supabase.auth.signInWithPassword({
    email: workerEmail,
    password: "WorkerPassword123!",
  });
  if (wAuthErr) {
    console.error("Worker login failed:", wAuthErr);
    return;
  }
  console.log("Logged in as worker:", wAuth.user.id);

  const tables = [
    "income_transactions",
    "expense_transactions",
    "financial_categories",
    "software_subscriptions",
    "salary_records",
    "salary_payments",
    "salary_advance_requests",
    "invoices",
    "sponsoring_campaigns",
    "sales_commissions",
    "agency_bank_accounts",
    "financial_closing_periods",
    "package_catalog",
    "project_tasks",
    "work_sessions",
    "team_members",
    "deals",
    "production_bookings",
    "client_deliverables",
    "client_projects",
    "clients",
  ];

  for (const t of tables) {
    const { data, error } = await (supabase as any).from(t).select("id").limit(2);
    if (error) {
      console.log(`Table ${t}: READ ERROR:`, error.message, error.code);
    } else {
      console.log(`Table ${t}: READ OK (${data?.length || 0} rows)`);
    }
  }
}

testTableReadsAsWorker().catch(console.error);
