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

async function checkCatalog() {
  const { data: saLogin, error: lErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  console.log("Login result:", saLogin.user?.email, "Error object:", JSON.stringify(lErr, Object.getOwnPropertyNames(lErr || {})));

  const { data: cats, error: cErr } = await supabase.from("package_categories").select("code, name");
  console.log("Categories count:", cats?.length, "Error:", cErr?.message);

  const { data: pkgs, error } = await supabase.from("package_catalog").select("id, code, name, price, approval_status, is_internal_only, is_published");
  console.log("Package catalog error:", error?.message);
  console.log("Total packages in package_catalog:", pkgs?.length);
  if (pkgs && pkgs.length > 0) {
    console.table(pkgs.slice(0, 10));
  }
}

checkCatalog();
