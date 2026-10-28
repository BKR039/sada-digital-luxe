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

  const deletedUserId = "be8e976f-82de-4f6a-999a-a52c42241f7a";
  const deletedEmail = "test.client.schema.1792416191404@sada.agency";

  console.log("=== VERIFYING PERMANENT DELETION OF TARGET TEST ACCOUNT ===");

  // 1. Verify user does NOT exist in accounts
  const { data: accounts } = await (superClient as any).rpc("admin_list_accounts");
  const foundInAccounts = accounts?.find((a: any) => a.user_id === deletedUserId || a.email === deletedEmail);
  console.log("1. Account in admin_list_accounts:", foundInAccounts ? "FOUND (FAIL)" : "NOT FOUND (PASS - CLEANLY PURGED)");

  // 2. Verify profiles
  const { data: profiles } = await superClient.from("profiles").select("*").eq("id", deletedUserId);
  console.log("2. Profile in profiles table:", profiles?.length === 0 ? "REMOVED (PASS)" : "STILL EXISTS (FAIL)");

  // 3. Verify user_roles
  const { data: roles } = await superClient.from("user_roles").select("*").eq("user_id", deletedUserId);
  console.log("3. User roles in user_roles table:", roles?.length === 0 ? "REMOVED (PASS)" : "STILL EXISTS (FAIL)");

  // 4. Verify system_audit_logs: the 3 original logs must still exist, with actor_id nullified!
  const { data: historicalLogs } = await superClient
    .from("system_audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, actor_name, created_at")
    .in("id", [
      "699cb657-4641-45d4-8d86-a6f114ffad30",
      "e2d0716a-aac9-4b69-84a0-7c4f81986f56",
      "19aff3cf-61e3-4d2b-862c-66eaf00d9449"
    ]);

  console.log("4. Historical system_audit_logs count:", historicalLogs?.length, "(Expected: 3)");
  console.log("   Historical system_audit_logs details:", historicalLogs);

  const allPreservedWithNullActor = historicalLogs?.length === 3 && historicalLogs.every(l => l.actor_id === null);
  console.log("   All 3 historical audit logs preserved with actor_id = NULL:", allPreservedWithNullActor ? "PASS" : "FAIL");

  // 5. Verify deletion audit log in account_audit_logs and system_audit_logs
  const { data: delAccountAudit } = await superClient
    .from("account_audit_logs")
    .select("id, action, target_user_id, target_email, actor_email, metadata, created_at")
    .eq("target_user_id", deletedUserId);
  console.log("5. account_audit_logs deletion event:", delAccountAudit);

  const { data: delSystemAudit } = await superClient
    .from("system_audit_logs")
    .select("id, action, entity_type, entity_id, actor_name, old_values, new_values, created_at")
    .eq("action", "ACCOUNT_DELETED")
    .eq("entity_id", deletedUserId);
  console.log("6. system_audit_logs deletion event:", delSystemAudit);
}

main().catch(console.error);
