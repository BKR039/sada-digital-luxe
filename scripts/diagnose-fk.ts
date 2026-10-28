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

async function main() {
  await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Check if we can inspect foreign keys referencing auth.users
  // Let's test with rpc or standard query
  console.log("Checking user_sessions...");
  const { data: sessions } = await superClient
    .from("user_sessions")
    .select("*")
    .eq("user_id", "be8e976f-82de-4f6a-999a-a52c42241f7a");
  console.log("Sessions:", sessions);

  // Let's check team_members
  const { data: tm } = await superClient
    .from("team_members")
    .select("*")
    .eq("user_id", "be8e976f-82de-4f6a-999a-a52c42241f7a");
  console.log("Team members:", tm);
}

main().catch(console.error);
