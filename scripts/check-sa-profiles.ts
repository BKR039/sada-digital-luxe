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

async function checkProfiles() {
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  const { data: accounts } = await (supabase as any).rpc("admin_list_accounts");
  for (const a of accounts || []) {
    if (a.role === "super_admin" || a.is_super_admin) {
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("id, email, status")
        .eq("id", a.user_id)
        .maybeSingle();
      const { data: isSA } = await (supabase as any).rpc("is_super_admin", {
        _user_id: a.user_id
      });
      console.log(`${a.email} -> profile: ${prof ? prof.status : 'MISSING'} -> is_super_admin RPC: ${isSA}`);
    }
  }
}

checkProfiles().catch(console.error);
