import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getPresetPeriod, fetchCompanyFinance } from "../src/lib/finance-service";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const client = createClient(supabaseUrl!, anonKey!);

async function testFetch() {
  console.log("1. Authenticating as Super Admin (sec.admin@sada.agency)...");
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  console.log("Auth result:", authData?.user?.email, "error:", authErr?.message);

  const period = getPresetPeriod("this_month");
  console.log("2. Testing fetchCompanyFinance for period:", period);

  try {
    const data = await fetchCompanyFinance(period);
    console.log("✓ fetchCompanyFinance succeeded!");
    console.log("KPIs:", data.kpis);
    console.log("Incomes count:", data.incomes.length);
    console.log("Expenses count:", data.expenses.length);
    console.log("Categories count:", data.categories.length);
    console.log("Subscriptions count:", data.subscriptions.length);
    console.log("Salaries count:", data.salaryRecords.length);
    console.log("Insights count:", data.insights.length);
  } catch (err: any) {
    console.error("❌ fetchCompanyFinance threw error:", err);
  }
}

testFetch().catch(console.error);
