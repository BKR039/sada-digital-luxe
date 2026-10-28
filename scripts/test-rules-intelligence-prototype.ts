import fs from "fs";
import path from "path";

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
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;

async function runPrototype() {
  const { supabase } = await import("../src/integrations/supabase/client");
  const { fetchCompanyFinance, getPresetPeriod } = await import("../src/lib/finance-service");
  const { fetchBusinessRules } = await import("../src/lib/business-rules-service");

  const auth = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const period = getPresetPeriod("this_month");
  const [rules, financeData, tasksRes, versionsRes] = await Promise.all([
    fetchBusinessRules(true),
    fetchCompanyFinance(period, {
      userId: auth.data?.user?.id,
      role: "super_admin",
      permissions: { finance: true },
    } as any),
    supabase.from("project_tasks").select("id, title, status, due_date").neq("status", "done"),
    supabase.from("business_rule_versions").select("id, rule_key, version, created_at, change_reason"),
  ]);

  console.log("Total Rules fetched:", rules.length);
  console.log("Finance Cash:", financeData.kpis.cash, "Recurring Burn:", financeData.kpis.recurringBurn);
  console.log("Active Tasks:", tasksRes.data?.length);
  console.log("Rule Versions:", versionsRes.data?.length);

  // Check runway
  const runway = financeData.kpis.recurringBurn > 0 ? financeData.kpis.cash / financeData.kpis.recurringBurn : 12;
  console.log("Calculated Cash Runway (months):", runway.toFixed(2));

  // Check burn ratio
  const burnRatio = financeData.kpis.revenue > 0 ? (financeData.kpis.recurringBurn / financeData.kpis.revenue) * 100 : 0;
  console.log("Fixed Burn Ratio (% of revenue):", burnRatio.toFixed(1) + "%");

  // Check client margins
  const lowMarginClients = financeData.clientProfitability.filter((c: any) => c.marginPercent < 20);
  console.log("Low Margin Clients (<20%):", lowMarginClients.length, "of", financeData.clientProfitability.length);

  // Check overdue invoices
  const now = new Date();
  const overdue60 = financeData.invoices.filter((i: any) => {
    if (i.status === "paid") return false;
    const due = new Date(i.dueDate || i.due_date || i.date);
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 60;
  });
  console.log("Overdue Invoices >= 60 days:", overdue60.length, "of", financeData.invoices.length);
}

runPrototype();
