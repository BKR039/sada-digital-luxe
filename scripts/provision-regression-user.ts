import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[m[1]] = val;
    process.env[m[1]] = val;
  }
});

import { createAccount } from "../src/lib/account-service";

async function main() {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  console.log("Signing in as Super Admin...");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  console.log("Provisioning regression user: demo.admin.regression@sada.agency...");
  const res = await createAccount(
    {
      email: "demo.admin.regression@sada.agency",
      password: "DemoAdminRegression2026!",
      displayName: "Regression Demo Admin",
      role: "admin",
      division: "Operations",
      position: "Operations Lead",
      createTeamMember: true,
      status: "active",
    },
    client
  );
  console.log("Provisioned regression user:", res);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
