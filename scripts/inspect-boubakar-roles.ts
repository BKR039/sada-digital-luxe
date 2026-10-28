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

async function inspectBoubakar() {
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  // Query profiles for Boubakar
  const { data: profs } = await (supabase as any)
    .from("profiles")
    .select("*")
    .ilike("email", "%boubakar%");

  console.log("Boubakar profiles:", profs);

  // For each profile, query user_roles
  for (const p of profs || []) {
    const { data: roles } = await (supabase as any)
      .from("user_roles")
      .select("*")
      .eq("user_id", p.id);
    const { data: isSA } = await (supabase as any).rpc("is_super_admin", {
      _user_id: p.id
    });
    console.log(`Profile ID: ${p.id} (${p.email}) -> status: ${p.status} | user_roles:`, roles, `| is_super_admin: ${isSA}`);
  }
}

inspectBoubakar().catch(console.error);
