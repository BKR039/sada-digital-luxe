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

async function testInsert() {
  const res = await supabase.from("contact_submissions").insert({
    name: "Test Smart Match",
    email: "test@sada.agency",
    message: "This is a test submission for smart match package system.",
    status: "new",
    path_taken: "guided",
    discovery_data: {
      source: "smart_match",
      recommendation: {
        packageName: "Growth",
        score: 95
      }
    }
  });
  console.log("Insert result without select:", res.error ? res.error.message : "SUCCESS (error is null)");
}

testInsert();
