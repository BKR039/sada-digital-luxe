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

async function listAllTables() {
  const clientSA = createClient(supabaseUrl, anonKey);
  await clientSA.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  // Query tables via known names or information_schema if permitted
  const candidateTables = [
    "deals", "sales", "commissions", "commission_rules", "sales_leads", 
    "clients", "client_projects", "project_tasks", "client_deliverables",
    "production_bookings", "team_members", "profiles", "user_roles",
    "salary_records", "salary_payments", "salary_requests", "invoices",
    "expenses", "financial_metrics", "business_rules", "business_rule_versions"
  ];

  console.log("Checking candidate tables in public schema:");
  for (const t of candidateTables) {
    const { data, error } = await clientSA.from(t).select("id").limit(1);
    if (!error) {
      console.log(`[EXISTS] ${t}`);
    } else {
      console.log(`[DOES NOT EXIST] ${t}: ${error.message}`);
    }
  }
}

listAllTables().catch(console.error);
