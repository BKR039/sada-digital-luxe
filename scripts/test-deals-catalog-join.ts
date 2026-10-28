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

async function testJoin() {
  await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  const res1 = await supabase.from("deals").select("*, package:package_catalog(*)").limit(1);
  console.log("Deals join package_catalog:", res1.error ? "ERROR: " + res1.error.message : "SUCCESS: " + res1.data?.length);

  const res2 = await supabase.from("deals").select("*, package:packages(*)").limit(1);
  console.log("Deals join packages:", res2.error ? "ERROR: " + res2.error.message : "SUCCESS: " + res2.data?.length);
}

testJoin();
