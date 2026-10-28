import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      env[match[1]] = value;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const superClient = createClient(supabaseUrl, anonKey);

async function main() {
  await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Try to inspect triggers via an RPC or query if available
  // Let's test what RPCs exist or test deleting directly in a test transaction
  console.log("Checking if we can find foreign keys on system_audit_logs or account_audit_logs");
  
  // Can we run a test query on account_audit_logs or system_audit_logs?
  const { data: aal, error: aalErr } = await superClient.from("account_audit_logs").select("*").limit(1);
  console.log("aal accessible:", !aalErr, aalErr?.message);

  const { data: sal, error: salErr } = await superClient.from("system_audit_logs").select("*").limit(1);
  console.log("sal accessible:", !salErr, salErr?.message);
}

main().catch(console.error);
