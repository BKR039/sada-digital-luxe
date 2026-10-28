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
  const { data: authData, error: authError } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authError) {
    console.error("Super Admin auth failed:", authError);
    return;
  }
  console.log("Logged in as Super Admin:", authData.user.email);

  const targetEmail = "test.client.schema.1792416191404@sada.agency";

  // Check profiles
  const { data: profiles, error: profError } = await superClient
    .from("profiles")
    .select("*")
    .eq("email", targetEmail);

  console.log("Profile search by email:", profiles, profError);

  // Check all profiles matching test.client
  const { data: matchingProfiles } = await superClient
    .from("profiles")
    .select("id, email, display_name, status")
    .ilike("email", "%1792416191404%");
  console.log("Matching profiles:", matchingProfiles);

  let targetUserId = matchingProfiles?.[0]?.id;

  if (!targetUserId) {
    // List all accounts via RPC admin_list_accounts
    const { data: accounts, error: accError } = await (superClient as any).rpc("admin_list_accounts");
    console.log("Total accounts:", accounts?.length, "Error:", accError);
    const found = accounts?.find((a: any) => a.email.includes("1792416191404"));
    console.log("Found in accounts:", found);
    if (found) targetUserId = found.user_id;
  }

  if (!targetUserId) {
    console.error("Target user not found!");
    return;
  }

  console.log("Target user ID:", targetUserId);

  // 1. Dependency analysis
  const { data: deps, error: depsError } = await (superClient as any).rpc(
    "admin_analyze_account_dependencies",
    { _user_id: targetUserId }
  );
  console.log("Dependencies analysis:", JSON.stringify(deps, null, 2), "Error:", depsError);

  // 2. Check references in audit tables
  const { data: aalActor } = await superClient
    .from("account_audit_logs")
    .select("id, action, actor_id, target_user_id, created_at")
    .eq("actor_id", targetUserId);
  console.log("account_audit_logs as ACTOR:", aalActor);

  const { data: aalTarget } = await superClient
    .from("account_audit_logs")
    .select("id, action, actor_id, target_user_id, created_at")
    .eq("target_user_id", targetUserId);
  console.log("account_audit_logs as TARGET:", aalTarget);

  const { data: salActor } = await superClient
    .from("system_audit_logs")
    .select("id, action, actor_id, entity_id, created_at")
    .eq("actor_id", targetUserId);
  console.log("system_audit_logs as ACTOR:", salActor);

  const { data: salEntity } = await superClient
    .from("system_audit_logs")
    .select("id, action, actor_id, entity_id, created_at")
    .eq("entity_id", targetUserId);
  console.log("system_audit_logs as ENTITY:", salEntity);

  // 3. Attempt admin_delete_account
  console.log("Attempting admin_delete_account...");
  const { data: delResult, error: delError } = await (superClient as any).rpc(
    "admin_delete_account",
    { _user_id: targetUserId }
  );

  console.log("Delete result:", delResult);
  console.log("Delete error:", delError);
}

main().catch(console.error);
