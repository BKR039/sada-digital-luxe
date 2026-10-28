import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^"|"$/g, "").trim();
});

process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

import { createAccount } from "../src/lib/account-service";

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data: auth, error } = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (error || !auth.user) {
    console.error("Super Admin login failed:", error?.message);
    return;
  }

  const workerEmail = "qa.worker@sada.agency";
  const workerPassword = "WorkerPassword123!";

  try {
    const res = await createAccount(
      {
        email: workerEmail,
        password: workerPassword,
        displayName: "QA Worker Lead",
        role: "worker",
        division: "operations",
        position: "Video Editor",
        salaryBasis: "monthly",
        baseSalary: 1200,
      },
      client
    );
    console.log("Successfully created test worker account:", res);
  } catch (err: any) {
    console.log("Account create response/status:", err.message);
  }

  // Test worker login
  const testClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const { data: workerAuth, error: workerErr } = await testClient.auth.signInWithPassword({
    email: workerEmail,
    password: workerPassword,
  });

  if (workerErr) {
    console.error("Worker login failed:", workerErr.message);
  } else {
    console.log("Worker login SUCCESS! User ID:", workerAuth.user?.id);
    const { data: roles } = await testClient.from("user_roles").select("*").eq("user_id", workerAuth.user?.id);
    console.log("Worker user_roles:", roles);
  }
}

run();
