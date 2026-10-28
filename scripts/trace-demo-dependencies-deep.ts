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
const client = createClient(supabaseUrl, anonKey);

async function runDeepTrace() {
  console.log("=== SADA OS DEEP DEMO DEPENDENCY TRACE (READ-ONLY) ===");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // 1. Trace the 7 synthetic accounts
  const syntheticAccountIds = [
    "63367189-9015-4ee7-b81f-dca00ab52a59", // BIAT Operating 0uiy2
    "3aa28dd6-24f0-4d5c-965e-a594d87ccb73", // BIAT Operating nh6y3
    "23f5926f-8c5e-466d-b477-ed8ee98f2f14", // BIAT Operating b5t46
    "9c950a53-3470-4429-a7e7-c7e23f890d8d", // BIAT Operating 37zy5
    "892bf690-1cd1-4567-8d1e-3d95f5e5024e", // BIAT Operating pkcjc
    "7834d037-7c84-435c-88e6-457d56a57ce5", // BIAT Operating rvloh
    "95e3556c-d74c-40cb-8639-4c1a19df0ca7", // BIAT Operating 6vrn4
  ];

  console.log("\n--- SYNTHETIC ACCOUNTS TRANSACTIONS TRACE ---");
  const { data: allIncomes } = await client.from("income_transactions").select("*");
  const { data: allExpenses } = await client.from("expense_transactions").select("*");

  for (const accId of syntheticAccountIds) {
    const linkedIncomes = allIncomes?.filter(i => i.account_id === accId) || [];
    const linkedExpenses = allExpenses?.filter(e => e.account_id === accId) || [];
    console.log(`Account [${accId}]: ${linkedIncomes.length} incomes, ${linkedExpenses.length} expenses`);
    for (const inc of linkedIncomes) {
      console.log(`   INCOME [${inc.id}] date=${inc.date} amt=${inc.amount} cat=${inc.category} client=${inc.client_id}`);
    }
    for (const exp of linkedExpenses) {
      console.log(`   EXPENSE [${exp.id}] date=${exp.date} amt=${exp.amount} cat=${exp.category} alloc=${exp.allocation}`);
    }
  }

  // 2. Trace all 6 invoices
  console.log("\n--- INVOICES & REVENUE DEPENDENCY TRACE ---");
  const { data: invoices } = await client.from("invoices").select("*");
  for (const inv of invoices || []) {
    const incs = allIncomes?.filter(i => i.invoice_id === inv.id) || [];
    console.log(`Invoice [${inv.id}] num="${inv.invoice_number}" client=${inv.client_id} total=${inv.total_amount} paid=${inv.paid_amount} status=${inv.status} -> linked incomes: ${incs.length}`);
  }

  // 3. Trace all sponsoring campaigns
  console.log("\n--- SPONSORING CAMPAIGNS TRACE ---");
  const { data: sponsoring } = await client.from("sponsoring_campaigns").select("*");
  for (const sc of sponsoring || []) {
    const exp = allExpenses?.filter(e => e.sponsoring_campaign_id === sc.id) || [];
    console.log(`Campaign [${sc.id}] "${sc.campaign_name}" client=${sc.client_id} budget=${sc.budget_tnd} usd=${sc.usd_amount} costTnd=${sc.purchase_cost_tnd} -> linked expenses: ${exp.length}`);
  }

  // 4. Trace all sales commissions
  console.log("\n--- SALES COMMISSIONS TRACE ---");
  const { data: comms } = await client.from("sales_commissions").select("*");
  for (const c of comms || []) {
    const exp = allExpenses?.filter(e => e.commission_id === c.id) || [];
    console.log(`Commission [${c.id}] client=${c.client_id} member=${c.team_member_id} amt=${c.commission_amount} status=${c.status} -> linked expenses: ${exp.length}`);
  }
}

runDeepTrace().catch(console.error);
