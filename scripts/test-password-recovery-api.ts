import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
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

async function testPasswordRecovery() {
  console.log("Supabase URL:", supabaseUrl);
  console.log("Testing resetPasswordForEmail for qa.superadmin@sada.agency...");

  const res1 = await supabase.auth.resetPasswordForEmail("qa.superadmin@sada.agency", {
    redirectTo: "http://localhost:3001/reset-password",
  });

  console.log("Response for registered email (qa.superadmin@sada.agency):", JSON.stringify(res1, null, 2));

  console.log("\nTesting resetPasswordForEmail for nonexistent email (ghost@nonexistent-domain.xyz)...");
  const res2 = await supabase.auth.resetPasswordForEmail("ghost@nonexistent-domain.xyz", {
    redirectTo: "http://localhost:3001/reset-password",
  });
  console.log("Response for nonexistent email:", JSON.stringify(res2, null, 2));

  console.log("\nTesting resetPasswordForEmail with malformed email...");
  const res3 = await supabase.auth.resetPasswordForEmail("not-an-email", {
    redirectTo: "http://localhost:3001/reset-password",
  });
  console.log("Response for malformed email:", JSON.stringify(res3, null, 2));
}

testPasswordRecovery().catch(console.error);
