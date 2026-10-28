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

const workerClient = createClient(supabaseUrl, anonKey);
const superClient = createClient(supabaseUrl, anonKey);

async function main() {
  await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Debug 1: register_user_session
  const testSid = "debug_sess_" + Date.now();
  const regRes = await (workerClient as any).rpc("register_user_session", {
    _session_id: testSid,
    _user_agent: "Mozilla/5.0 Chrome/120",
    _ip_address: "127.0.0.1",
    _device_type: "desktop",
    _browser_name: "Google Chrome",
    _os_name: "Windows 11",
    _auth_method: "password",
  });
  console.log("register_user_session result:", regRes);

  // Debug 2: DELETE on user_sessions
  const delRes = await (superClient as any).from("user_sessions").delete().eq("session_id", testSid);
  console.log("DELETE result:", delRes);

  // Check trigger on user_sessions
  const trgCheck = await (superClient as any).rpc("is_super_admin", { _user_id: (await superClient.auth.getUser()).data.user?.id });
  console.log("is_super_admin:", trgCheck);
}

main().catch(console.error);
