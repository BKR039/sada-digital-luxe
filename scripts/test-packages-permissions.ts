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

async function checkDdl() {
  await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  // Check if packages table can be inserted/updated
  const { data: catPkgs } = await supabase.from("package_catalog").select("*");
  const { data: pkgs } = await supabase.from("packages").select("id");
  console.log("package_catalog count:", catPkgs?.length, "packages count:", pkgs?.length);

  // Can we insert into packages?
  const testPkgId = "88888888-8888-4888-8888-888888888888";
  const insRes = await supabase.from("packages").insert({
    id: testPkgId,
    name: "DDL Test Package",
    selling_price: 1000
  }).select();

  console.log("Can insert into packages?:", insRes.error ? insRes.error.message : "YES!");
  if (insRes.data) {
    await supabase.from("packages").delete().eq("id", testPkgId);
  }
}

checkDdl();
