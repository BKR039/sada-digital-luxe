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

async function testSuperAdminAccess() {
  console.log("=== VERIFY SUPER ADMIN POST-MIGRATION ===");

  const { data: auth, error: authErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) throw authErr;
  console.log("Super Admin logged in:", auth.user?.id);

  // 1. All deals visible to Super Admin
  const { data: allDeals, error: dealsErr } = await client.from("deals").select("id, title, stage, deal_value, sales_owner_id");
  console.log("Total deals visible to Super Admin:", allDeals?.length, dealsErr?.message || "OK");

  // 2. All commissions visible to Super Admin
  const { data: allComms, error: commsErr } = await client.from("sales_commissions").select("id, team_member_id, commission_amount, status");
  console.log("Total commissions visible to Super Admin:", allComms?.length, commsErr?.message || "OK");
}

testSuperAdminAccess().catch(console.error);
