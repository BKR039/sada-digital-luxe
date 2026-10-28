import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function testRandomUuid() {
  await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  const randomUuid = "99999999-9999-4999-8999-999999999999";
  const testInsert = await supabase.from("deals").insert({
    title: "FK Test Deal",
    company_name: "Test Co",
    stage: "lead",
    package_id: randomUuid,
    deal_value: 1000,
    service_revenue: 1000
  }).select().maybeSingle();

  console.log("Insert with random UUID:", testInsert.error ? testInsert.error.message : "SUCCESS!");
  if (testInsert.data?.id) {
    await supabase.from("deals").delete().eq("id", testInsert.data.id);
  }
}

testRandomUuid();
