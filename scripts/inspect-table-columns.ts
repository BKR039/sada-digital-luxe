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

async function inspectColumns() {
  const clientSA = createClient(supabaseUrl, anonKey);
  await clientSA.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  const { data: cp } = await clientSA.from("client_projects").select("*").limit(1);
  if (cp && cp.length > 0) {
    console.log("client_projects columns:", Object.keys(cp[0]));
  }

  const { data: pt } = await clientSA.from("project_tasks").select("*").limit(1);
  if (pt && pt.length > 0) {
    console.log("project_tasks columns:", Object.keys(pt[0]));
  }

  const { data: dl } = await clientSA.from("deals").select("*").limit(1);
  if (dl && dl.length > 0) {
    console.log("deals columns:", Object.keys(dl[0]));
  }
}

inspectColumns().catch(console.error);
