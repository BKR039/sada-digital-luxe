import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
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

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, serviceKey);

async function check() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });
  console.log("Super admin auth:", authErr ? authErr.message : "OK", auth?.user?.id);

  const { data: srs, error: srErr } = await supabase.from("salary_records").select("*");
  console.log("salary_records error:", srErr);
  console.log("salary_records count:", srs?.length);

  const { data: sqs, error: sqErr } = await supabase.from("salary_requests").select("*");
  console.log("salary_requests error:", sqErr);
  console.log("salary_requests count:", sqs?.length);
}

check();
