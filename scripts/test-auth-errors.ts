import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  // Test 1: Non-existent user
  const res1 = await client.auth.signInWithPassword({
    email: "nonexistent_demo_admin_12345@sada.agency",
    password: "Password123!",
  });
  console.log("Test 1 (non-existent):", {
    error: res1.error,
    message: res1.error?.message,
    name: res1.error?.name,
    status: res1.error?.status,
  });

  // Test 2: Invalid password for existing user
  const res2 = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "WrongPassword123!",
  });
  console.log("Test 2 (wrong password):", {
    error: res2.error,
    message: res2.error?.message,
    name: res2.error?.name,
    status: res2.error?.status,
  });
}

run().catch(console.error);
