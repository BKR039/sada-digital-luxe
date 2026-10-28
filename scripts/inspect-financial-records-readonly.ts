import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
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

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function inspectReadOnly() {
  console.log("=== SADA FINANCIAL READ-ONLY PRODUCTION INSPECTION ===");
  console.log("Connecting to:", supabaseUrl);

  const authRes = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authRes.error) {
    console.error("Auth error:", authRes.error.message);
  } else {
    console.log("Authenticated as Super Admin:", authRes.data.user.email);
  }

  // 1. Financial Accounts
  const { data: accounts, error: accErr } = await supabase.from("financial_accounts").select("*");
  console.log("\n--- Financial Accounts ---");
  if (accErr) {
    console.log("Error:", accErr.message);
  } else {
    console.log(`Found ${accounts?.length || 0} accounts:`);
    for (const a of accounts || []) {
      console.log(`  - [${a.id}] ${a.name} (${a.account_type}): opening=${a.opening_balance}, current=${a.current_balance}, currency=${a.currency}, status=${a.status}`);
    }
  }

  // 2. Clients
  const { data: clients, error: clErr } = await supabase.from("clients").select("id, name, client_type, monthly_package_price, default_service_fee, default_sponsoring_budget, commission_rate, created_at");
  console.log("\n--- Clients Sample & Stats ---");
  if (clErr) {
    console.log("Error:", clErr.message);
  } else {
    console.log(`Found ${clients?.length || 0} total clients:`);
    for (const c of clients || []) {
      console.log(`  - [${c.id}] "${c.name}" | type=${c.client_type} | pkg=${c.monthly_package_price} | srvFee=${c.default_service_fee} | sponBudget=${c.default_sponsoring_budget} | commRate=${c.commission_rate} | created=${c.created_at}`);
    }
  }

  // 3. Incomes
  const { data: incomes, error: incErr } = await supabase.from("income_transactions").select("*").limit(50);
  console.log("\n--- Income Transactions (First 50) ---");
  if (incErr) {
    console.log("Error:", incErr.message);
  } else {
    console.log(`Found ${incomes?.length || 0} income transactions:`);
    for (const inc of incomes || []) {
      console.log(`  - [${inc.id}] date=${inc.date} | amt=${inc.amount} ${inc.currency} | cat=${inc.category} | alloc=${inc.allocation} | status=${inc.status} | client_id=${inc.client_id} | invoice_id=${inc.invoice_id}`);
    }
  }

  // 4. Expenses
  const { data: expenses, error: expErr } = await supabase.from("expense_transactions").select("*").limit(50);
  console.log("\n--- Expense Transactions (First 50) ---");
  if (expErr) {
    console.log("Error:", expErr.message);
  } else {
    console.log(`Found ${expenses?.length || 0} expense transactions:`);
    for (const exp of expenses || []) {
      console.log(`  - [${exp.id}] date=${exp.date} | amt=${exp.amount} ${exp.currency} | cat=${exp.category_name} | alloc=${exp.allocation} | status=${exp.status} | vendor=${exp.vendor} | client_id=${exp.client_id} | campaign_id=${exp.sponsoring_campaign_id}`);
    }
  }

  // 5. Invoices
  const { data: invoices, error: invErr } = await supabase.from("invoices").select("*");
  console.log("\n--- Invoices ---");
  if (invErr) {
    console.log("Error:", invErr.message);
  } else {
    console.log(`Found ${invoices?.length || 0} invoices:`);
    for (const inv of invoices || []) {
      console.log(`  - [${inv.id}] num=${inv.invoice_number} | client=${inv.client_id} | issue=${inv.issue_date} | due=${inv.due_date} | total=${inv.total_amount} | paid=${inv.paid_amount} | status=${inv.status}`);
    }
  }

  // 6. Sponsoring Campaigns
  const { data: campaigns, error: scErr } = await supabase.from("sponsoring_campaigns").select("*");
  console.log("\n--- Sponsoring Campaigns ---");
  if (scErr) {
    console.log("Error:", scErr.message);
  } else {
    console.log(`Found ${campaigns?.length || 0} campaigns:`);
    for (const sc of campaigns || []) {
      console.log(`  - [${sc.id}] "${sc.campaign_name}" | client=${sc.client_id} | platform=${sc.platform} | usd=${sc.usd_amount} | rate=${sc.purchase_rate} | costTnd=${sc.purchase_cost_tnd} | chargeTnd=${sc.client_charge_tnd} | margin=${sc.margin_tnd} | payStatus=${sc.payment_status} | execStatus=${sc.execution_status}`);
    }
  }

  // 7. Sales Commissions
  const { data: commissions, error: commErr } = await supabase.from("sales_commissions").select("*");
  console.log("\n--- Sales Commissions ---");
  if (commErr) {
    console.log("Error:", commErr.message);
  } else {
    console.log(`Found ${commissions?.length || 0} commissions:`);
    for (const comm of commissions || []) {
      console.log(`  - [${comm.id}] member=${comm.team_member_id} | client=${comm.client_id} | rev=${comm.service_revenue} | rate=${comm.commission_rate}% | amt=${comm.commission_amount} | status=${comm.status}`);
    }
  }

  // 8. Closing Periods
  const { data: closings, error: closeErr } = await supabase.from("financial_closing_periods").select("*");
  console.log("\n--- Closing Periods ---");
  if (closeErr) {
    console.log("Error:", closeErr.message);
  } else {
    console.log(`Found ${closings?.length || 0} closing periods:`);
    for (const cp of closings || []) {
      console.log(`  - [${cp.id}] month=${cp.period_month} | status=${cp.status} | closedAt=${cp.closed_at} | reopenedAt=${cp.reopened_at}`);
    }
  }
}

inspectReadOnly().catch(console.error);
