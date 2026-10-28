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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  const login = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  console.log("Super Admin Login:", login.data?.user?.email, "Error:", login.error?.message);

  const kpis = await supabase.rpc("admin_get_security_kpis");
  console.log("Security KPIs:", kpis.data, "Error:", kpis.error?.message);

  const sessions = await supabase.rpc("admin_list_user_sessions", { _limit: 10 });
  console.log("Sessions count:", sessions.data?.length, "Error:", sessions.error?.message);
}

main().catch(console.error);
