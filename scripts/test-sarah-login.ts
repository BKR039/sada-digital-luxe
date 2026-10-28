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

async function main() {
  const passwordsToTry = [
    "WorkerPassword123!",
    "AdminPassword123!",
    "SuperAdminPassword123!",
    "SadaAdmin2026!",
    "SarahPassword123!",
    "password123",
  ];

  for (const pw of passwordsToTry) {
    const { data, error } = await client.auth.signInWithPassword({
      email: "sarah@sada.agency",
      password: pw
    });
    if (!error && data.user) {
      console.log(`Sarah login succeeded with password: ${pw}! User ID: ${data.user.id}`);
      return;
    }
  }
  console.log("Could not log in as sarah@sada.agency with common test passwords.");
}

main().catch(console.error);
