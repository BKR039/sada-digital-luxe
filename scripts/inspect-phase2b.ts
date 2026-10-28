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

import { supabase } from "../src/integrations/supabase/client";

async function run() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) throw authErr;

  const { fetchCompanyFinance, getPresetPeriod } = await import("../src/lib/finance-service");
  const period = getPresetPeriod("this_month");
  const finance = await fetchCompanyFinance(period);

  console.log("=== FINANCE STATE KPIS ===");
  console.log({
    totalIncome: finance.kpis.totalIncome,
    prevRevenue: finance.kpis.prevRevenue,
    incomeDeltaPercent: finance.kpis.incomeDeltaPercent,
    totalExpenses: finance.kpis.totalExpenses,
    prevExpenses: finance.kpis.prevExpenses,
    expenseDeltaPercent: finance.kpis.expenseDeltaPercent,
  });

  console.log("\n=== INVOICES STATUS & RECEIVABLES ===");
  console.log("Total Invoices:", finance.invoices.length);
  const byStatus: Record<string, { count: number; total: number; paid: number; remaining: number }> = {};
  for (const inv of finance.invoices) {
    const status = inv.status;
    if (!byStatus[status]) byStatus[status] = { count: 0, total: 0, paid: 0, remaining: 0 };
    byStatus[status].count++;
    byStatus[status].total += Number(inv.totalAmount || 0);
    byStatus[status].paid += Number(inv.paidAmount || 0);
    byStatus[status].remaining += (Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
  }
  console.log("Invoice Breakdowns by Status:", byStatus);

  const oldOutstanding = finance.invoices
    .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((sum: number, i: any) => sum + (Number(i.totalAmount) || 0), 0);

  const newOutstanding = finance.invoices
    .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((sum: number, i: any) => sum + Math.max(0, (Number(i.totalAmount) || 0) - (Number(i.paidAmount) || 0)), 0);

  console.log("Old Outstanding Receivables (ignores paidAmount):", oldOutstanding);
  console.log("New Outstanding Receivables (subtracts paidAmount):", newOutstanding);
  console.log("finance.kpis.outstandingPayments:", finance.kpis.outstandingPayments);

  console.log("\n=== INSPECTING TASKS DEADLINE FORMATS ===");
  const { data: tasks } = await supabase.from("project_tasks").select("id, title, deadline, status").limit(50);
  const deadlineSamples = (tasks || []).filter(t => t.deadline).slice(0, 10).map(t => ({ id: t.id, title: t.title, deadline: t.deadline }));
  console.log("Sample deadlines from DB:", deadlineSamples);
}

run().catch(console.error);
