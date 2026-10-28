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

async function inspectAllRules() {
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  const { data: rules } = await (supabase as any)
    .from("business_rules")
    .select("*")
    .order("category");

  console.log(`Total rules: ${rules?.length}`);
  for (const r of rules || []) {
    console.log(`- [${r.category}] ${r.rule_key} | type: ${r.value_type} | num: ${r.numeric_value} (min: ${r.min_value}, max: ${r.max_value}) | text: ${r.text_value} | bool: ${r.boolean_value} | v${r.version}`);
  }
}

inspectAllRules().catch(console.error);
