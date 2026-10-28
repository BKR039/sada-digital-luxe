import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function inspect() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  const { data, error } = await supabase
    .from("business_rules")
    .select("*")
    .order("category")
    .order("rule_key");
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Total rules count:", data.length);
  const byCat: Record<string, number> = {};
  for (const r of data) {
    byCat[r.category] = (byCat[r.category] || 0) + 1;
    console.log(
      `[${r.category}] ${r.rule_key} = ${r.numeric_value ?? r.text_value} (def: ${r.default_numeric_value ?? r.default_text_value}) [${r.min_value}-${r.max_value}] op:${r.operator} sev:${r.severity} applies:${r.applies_to}`
    );
  }
  console.log("By category:", JSON.stringify(byCat, null, 2));
}

inspect();
