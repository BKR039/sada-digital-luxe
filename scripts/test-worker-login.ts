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
const workerClient = createClient(supabaseUrl, anonKey);

async function main() {
  await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const workerEmail = `worker.qa.${Date.now()}@sada.agency`;
  const workerPassword = "WorkerPassword123!";

  console.log("Provisioning worker account:", workerEmail);
  const { data: prov, error: provErr } = await (superClient as any).rpc("admin_provision_account", {
    _email: workerEmail,
    _password: workerPassword,
    _display_name: "Ephemeral QA Worker",
    _role: "worker",
    _division: "Development",
    _position: "QA Worker",
    _phone: null,
    _create_team_member: true,
  });

  console.log("Provision result:", prov, "Error:", provErr);

  const { data: wAuth, error: wAuthErr } = await workerClient.auth.signInWithPassword({
    email: workerEmail,
    password: workerPassword,
  });

  console.log("Worker login result:", wAuth?.user?.email, "Error:", wAuthErr);
}

main().catch(console.error);
