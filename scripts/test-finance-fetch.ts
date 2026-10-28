import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchCompanyFinance, getPresetPeriod } from "../src/lib/finance-service";

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

const { supabase } = await import("../src/integrations/supabase/client");
const { fetchCompanyFinance, getPresetPeriod } = await import("../src/lib/finance-service");

async function testFinanceFetch() {
  const auth = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  console.log("Auth user:", auth.data?.user?.email);

  const period = getPresetPeriod("this_month");
  console.log("Period:", period);

  try {
    const financeData = await fetchCompanyFinance(period, {
      userId: auth.data?.user?.id,
      role: "super_admin",
      permissions: { finance: true },
    } as any);

    console.log("KPIs:", financeData.kpis);
    console.log("Incomes count:", financeData.incomes.length);
    console.log("Expenses count:", financeData.expenses.length);
    console.log("Invoices count:", financeData.invoices.length);
    console.log("Client Profitability count:", financeData.clientProfitability.length);
    console.log("Deterministic Insights count:", financeData.insights.length);
    console.log("Subscriptions count:", financeData.subscriptions.length);
  } catch (err: any) {
    console.error("fetchCompanyFinance error:", err);
  }
}

testFinanceFetch();
