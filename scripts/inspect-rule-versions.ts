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

async function inspectRule() {
  const { data: auth } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  const { data: rule } = await (supabase as any)
    .from("business_rules")
    .select("*")
    .eq("rule_key", "sponsoring_purchase_rate")
    .single();

  console.log("Current rule on disk:", {
    id: rule.id,
    key: rule.rule_key,
    numeric_value: rule.numeric_value,
    version: rule.version,
    updated_at: rule.updated_at,
    change_reason: rule.change_reason,
  });

  const { data: versions } = await (supabase as any)
    .from("business_rule_versions")
    .select("*")
    .eq("rule_key", "sponsoring_purchase_rate")
    .order("version", { ascending: false });

  console.log(`Versions count for sponsoring_purchase_rate: ${versions?.length}`);
  console.log("Latest versions:", versions?.map((v: any) => ({
    version: v.version,
    val: v.numeric_value,
    reason: v.change_reason,
    changed_by: v.changed_by,
    created_at: v.created_at,
  })));
}

inspectRule().catch(console.error);
