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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function inspectMaya() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: mayas } = await client
    .from("team_members")
    .select("*")
    .ilike("name", "%maya%")
    .order("created_at", { ascending: false });

  console.log("All Maya rows in team_members:", mayas);
}

inspectMaya().catch(console.error);
