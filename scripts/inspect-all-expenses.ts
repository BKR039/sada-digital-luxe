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

async function inspectAllExpenses() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: expenses } = await client.from("expense_transactions").select("*").order("date", { ascending: false });
  console.log(`=== ALL 56 EXPENSE TRANSACTIONS ===`);
  
  const byAlloc: Record<string, any[]> = {};
  for (const exp of expenses || []) {
    const alloc = exp.allocation || "unknown";
    if (!byAlloc[alloc]) byAlloc[alloc] = [];
    byAlloc[alloc].push(exp);
  }

  for (const [alloc, list] of Object.entries(byAlloc)) {
    console.log(`\nAllocation: ${alloc} (${list.length} rows, sum=${list.reduce((s, e) => s + Number(e.amount || 0), 0)} TND):`);
    for (const e of list.slice(0, 5)) {
      console.log(`  - [${e.id}] date=${e.date} amt=${e.amount} cat=${e.category} acc=${e.account_id} desc="${e.description}" client=${e.client_id}`);
    }
    if (list.length > 5) {
      console.log(`  ... and ${list.length - 5} more`);
    }
  }
}

inspectAllExpenses().catch(console.error);
