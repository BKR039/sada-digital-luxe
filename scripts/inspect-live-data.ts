import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function inspectData() {
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const [
    incomes,
    expenses,
    invoices,
    sponsoring,
    clients,
    tasks,
    subscriptions,
    salaryRecords,
    salaryRequests,
    deals,
    commissions,
    versions,
  ] = await Promise.all([
    supabase.from("income_transactions").select("id, amount, date, status, allocation"),
    supabase.from("expense_transactions").select("id, amount, date, status, allocation, category"),
    supabase.from("invoices").select("id, amount, status, due_date, date, total_amount, client_id"),
    supabase.from("sponsoring_transactions").select("id, amount_tnd, purchase_rate, client_rate, platform"),
    supabase.from("clients").select("id, name, status, package_config"),
    supabase.from("project_tasks").select("id, title, status, due_date"),
    supabase.from("subscriptions").select("id, name, cost_per_month, status"),
    supabase.from("salary_records").select("id, base_salary, status"),
    supabase.from("salary_requests").select("id, requested_amount, status"),
    supabase.from("deals").select("id, value, stage, commission_rate"),
    supabase.from("sales_commissions").select("id, amount, status"),
    supabase.from("business_rule_versions").select("id, rule_key, version, created_at"),
  ]);

  console.log({
    incomesCount: incomes.data?.length,
    expensesCount: expenses.data?.length,
    invoicesCount: invoices.data?.length,
    sponsoringCount: sponsoring.data?.length,
    clientsCount: clients.data?.length,
    tasksCount: tasks.data?.length,
    subscriptionsCount: subscriptions.data?.length,
    salaryRecordsCount: salaryRecords.data?.length,
    salaryRequestsCount: salaryRequests.data?.length,
    dealsCount: deals.data?.length,
    commissionsCount: commissions.data?.length,
    versionsCount: versions.data?.length,
  });

  if (subscriptions.data) {
    const totalBurn = subscriptions.data.reduce((acc, s) => acc + Number(s.cost_per_month || 0), 0);
    console.log("Total subscriptions burn:", totalBurn);
  }

  if (invoices.data) {
    console.log("Invoices sample:", invoices.data.slice(0, 3));
  }

  if (versions.data) {
    console.log("Rule versions count:", versions.data.length, "sample:", versions.data.slice(0, 3));
  }
}

inspectData();
