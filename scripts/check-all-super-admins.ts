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

import { supabase } from "../src/integrations/supabase/client";

async function checkAllUsers() {
  console.log("=== CHECKING ALL USERS AND TEAM MEMBERS ===");

  // Sign in as qa.superadmin to query
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  const { data: teamMembers } = await (supabase as any)
    .from("team_members")
    .select("id, name, email, role, profile_id, user_id")
    .in("role", ["super_admin", "admin"]);

  console.log("\nSuper admins & Admins in team_members:");
  for (const tm of teamMembers || []) {
    const idToCheck = tm.user_id || tm.profile_id;
    if (idToCheck) {
      const { data: isSA } = await (supabase as any).rpc("is_super_admin", {
        _user_id: idToCheck
      });
      const { data: isA } = await (supabase as any).rpc("is_admin", {
        _user_id: idToCheck
      });
      console.log(`- ${tm.name} (${tm.email}) | tm.role: ${tm.role} | user_id: ${idToCheck} => is_super_admin: ${isSA}, is_admin: ${isA}`);
    } else {
      console.log(`- ${tm.name} (${tm.email}) | tm.role: ${tm.role} | user_id: NULL`);
    }
  }

  // Also check RPC admin_list_accounts
  const { data: accounts } = await (supabase as any).rpc("admin_list_accounts");
  console.log("\nAccounts from admin_list_accounts:");
  for (const acc of accounts || []) {
    console.log(`- ${acc.display_name} (${acc.email}) | role: ${acc.role} | status: ${acc.status} | is_super_admin: ${acc.is_super_admin}`);
  }
}

checkAllUsers().catch(console.error);
