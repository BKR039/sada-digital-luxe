import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { suspendAccount } from "../src/lib/account-service";
import { revokeAllUserSessions } from "../src/lib/security-center-service";

const envPath = path.resolve(process.cwd(), ".env");
const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

async function run() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  const saUserId = authData.user.id;

  try {
    await suspendAccount(saUserId, "Test", undefined, supabase);
    console.log("suspendAccount DID NOT THROW");
  } catch (err: any) {
    console.log("suspendAccount threw:", err?.constructor?.name, err?.message, err?.code);
  }

  try {
    await revokeAllUserSessions(saUserId, "Test", supabase);
    console.log("revokeAllUserSessions DID NOT THROW");
  } catch (err: any) {
    console.log("revokeAllUserSessions threw:", err?.constructor?.name, err?.message, err?.code);
  }
}

run();
