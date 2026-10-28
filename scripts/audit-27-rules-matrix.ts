import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { supabase } from "../src/integrations/supabase/client";
import {
  RULE_METADATA_REGISTRY,
  evaluateSingleRule,
  fetchLiveBusinessContext,
} from "../src/lib/business-rules-intelligence-service";
import { fetchBusinessRules } from "../src/lib/business-rules-service";

async function run() {
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const rules = await fetchBusinessRules(true);
  const context = await fetchLiveBusinessContext(true);

  console.log(`Auditing ${rules.length} canonical rules against live context...\n`);

  const results = rules.map((r, i) => {
    const meta = RULE_METADATA_REGISTRY[r.rule_key];
    const evaluation = evaluateSingleRule(r, context);

    return {
      index: i + 1,
      ruleKey: r.rule_key,
      category: r.category,
      name: r.rule_name,
      configuredValue: r.numeric_value ?? r.text_value ?? r.boolean_value ?? "null",
      unit: r.unit || "—",
      evaluationType: meta?.evaluationType || "unknown",
      observedDisplay: evaluation.observedDisplay,
      status: evaluation.status,
      consumers: meta?.consumers || [],
      observedDataSource: meta?.observedDataSource || "unknown",
      finding: evaluation.finding,
    };
  });

  console.log(JSON.stringify(results, null, 2));
}

run();
