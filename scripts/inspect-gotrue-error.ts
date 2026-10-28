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

const testEmail = "test.rpc.create.1790942909790@sada.agency";
const testPass = "SecurePass123!@#";

async function run() {
  const loginClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  const loginRes = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: testPass,
  });

  console.log("loginRes.error keys:", Object.getOwnPropertyNames(loginRes.error || {}));
  console.log("loginRes.error name:", loginRes.error?.name);
  console.log("loginRes.error message:", loginRes.error?.message);
  console.log("loginRes.error status:", (loginRes.error as any)?.status);
  console.log("loginRes.error code:", (loginRes.error as any)?.code);
  console.log("loginRes.error raw:", loginRes.error);

  // Also let's do a direct fetch to Supabase Auth token endpoint to see the RAW JSON response from GoTrue!
  const url = `${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const rawRes = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPass,
    }),
  });

  console.log("\nRAW HTTP status:", rawRes.status);
  console.log("RAW HTTP headers:", Object.fromEntries(rawRes.headers.entries()));
  const rawBody = await rawRes.text();
  console.log("RAW HTTP body:", rawBody);
}

run().catch(console.error);
