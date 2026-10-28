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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  const emails = [
    "demo.admin.test.1790942033375@sada.agency",
    "demo.admin.test.1790932575829@sada.agency",
    "demo.admin.test.1790932488007@sada.agency",
    "demo.admin.test.1790932428778@sada.agency",
  ];

  for (const email of emails) {
    const res = await client.auth.signInWithPassword({
      email,
      password: "DemoPassword123!@#",
    });
    console.log(`Login ${email}:`, {
      user: res.data.user?.id,
      error: res.error?.message,
    });
  }
}

run().catch(console.error);
