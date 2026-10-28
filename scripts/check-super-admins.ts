import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || "").trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[match[1]] = value;
      }
    });
  }
} catch (e) {}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

async function checkSuperAdmins() {
  console.log("=== CHECKING SUPER ADMIN ROLES AND PROFILES IN DATABASE ===");

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }
  console.log("Signed in as Super Admin ID:", auth.user.id);

  // 1. Fetch user_roles with role = 'super_admin'
  const { data: superAdminRoles, error: rolesErr } = await (supabase as any)
    .from("user_roles")
    .select("user_id, role");

  console.log("user_roles rows:", superAdminRoles);

  // 2. Fetch profiles
  const { data: profiles, error: profErr } = await (supabase as any)
    .from("profiles")
    .select("id, email, status, display_name");

  console.log("profiles rows count:", profiles?.length);

  // 3. For each profile / user, test is_super_admin(id)
  for (const r of superAdminRoles || []) {
    const { data: isSA } = await (supabase as any).rpc("is_super_admin", {
      _user_id: r.user_id,
    });
    const prof = profiles?.find((p: any) => p.id === r.user_id);
    console.log(`User: ${r.user_id} (${prof?.email || "no profile"}) | user_roles.role: ${r.role} | profile.status: ${prof?.status || "NO PROFILE"} | is_super_admin RPC: ${isSA}`);
  }

  // Also check boubakar's accounts
  const boubakarProfiles = profiles?.filter((p: any) => p.email && p.email.toLowerCase().includes("boubakar"));
  console.log("\nBoubakar profiles:", boubakarProfiles);
  for (const bp of boubakarProfiles || []) {
    const { data: isSA } = await (supabase as any).rpc("is_super_admin", {
      _user_id: bp.id,
    });
    console.log(`Boubakar ID ${bp.id} (${bp.email}): is_super_admin => ${isSA}`);
  }
}

checkSuperAdmins().catch(console.error);
