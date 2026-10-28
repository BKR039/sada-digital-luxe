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

async function inspectAll12Incomes() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: incomes } = await client.from("income_transactions").select("*").order("date", { ascending: false });
  console.log("=== ALL 12 INCOME TRANSACTIONS ===");
  for (const inc of incomes || []) {
    console.log(`[${inc.id}] date=${inc.date} amt=${inc.amount} cat=${inc.category} alloc=${inc.allocation} client=${inc.client_id} acc=${inc.account_id} inv=${inc.invoice_id} desc="${inc.description}" status=${inc.status}`);
  }
}

inspectAll12Incomes().catch(console.error);
