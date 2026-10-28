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

async function inspectSchema() {
  const authRes = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authRes.error) {
    console.error("Auth error:", authRes.error);
    process.exit(1);
  }

  const supabase = client;

  const tablesToCheck = [
    "clients",
    "client_projects",
    "project_tasks",
    "team_members",
    "profiles",
    "user_roles",
    "expense_categories",
    "subscriptions",
    "salary_records",
    "salary_payments",
    "salary_requests",
    "expense_transactions",
    "income_transactions",
    "financial_audit_logs",
    "invoices",
    "sponsoring_campaigns",
    "financial_transactions",
    "financial_closing_periods",
    "financial_accounts"
  ];

  console.log("Checking table existence and sample columns:");
  for (const table of tablesToCheck) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`- ${table}: NOT FOUND or Error (${error.message})`);
    } else {
      const keys = data && data.length > 0 ? Object.keys(data[0]) : "table exists, 0 rows";
      console.log(`- ${table}: EXISTS -> columns:`, keys);
    }
  }
}

inspectSchema().catch(console.error);
