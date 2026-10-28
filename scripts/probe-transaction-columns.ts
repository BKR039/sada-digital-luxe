import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

async function checkColumns() {
  await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  // Test insert into income_transactions to see columns
  const testInc = {
    amount: 100,
    currency: "TND",
    date: "2026-09-27",
    category: "Client Payment",
    description: "Test Inflow Probe",
  };
  const { data: incData, error: incErr } = await client.from("income_transactions").insert(testInc).select().single();
  if (incErr) {
    console.error("income_transactions insert error:", incErr);
  } else {
    console.log("income_transactions columns:", Object.keys(incData));
    await client.from("income_transactions").delete().eq("id", incData.id);
  }

  // Test insert into expense_transactions
  const testExp = {
    amount: 50,
    currency: "TND",
    date: "2026-09-27",
    category_name: "Software & SaaS",
    description: "Test Outflow Probe",
  };
  const { data: expData, error: expErr } = await client.from("expense_transactions").insert(testExp).select().single();
  if (expErr) {
    console.error("expense_transactions insert error:", expErr);
  } else {
    console.log("expense_transactions columns:", Object.keys(expData));
    await client.from("expense_transactions").delete().eq("id", expData.id);
  }
}

checkColumns().catch(console.error);
