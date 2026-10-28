import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1]] = val;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY!;
const client = createClient(supabaseUrl, anonKey);

async function check() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: projects } = await client.from("client_projects").select("id, status").limit(50);
  console.log("Projects count:", projects?.length);
  const pStatuses = Array.from(new Set(projects?.map(p => p.status)));
  console.log("Distinct client_projects.status:", pStatuses);

  const { data: invoices } = await client.from("invoices").select("id, status").limit(50);
  console.log("Invoices count:", invoices?.length);
  const invStatuses = Array.from(new Set(invoices?.map(i => i.status)));
  console.log("Distinct invoices.status:", invStatuses);
}

check();
