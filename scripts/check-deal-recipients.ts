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
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data } = await client.from("deals").select("id, title, sales_owner_id, commission_recipient_id, stage");
  console.log("Total deals:", data?.length);
  const withRecipient = data?.filter((d) => d.commission_recipient_id) || [];
  console.log("Deals with commission_recipient_id:", withRecipient.length);
  console.log("Deals without commission_recipient_id:", (data?.length || 0) - withRecipient.length);
  console.log("Sample deals without recipient:", data?.filter((d) => !d.commission_recipient_id).slice(0, 5));
}

main().catch(console.error);
