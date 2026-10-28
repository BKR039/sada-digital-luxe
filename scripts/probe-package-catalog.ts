import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
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
}

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  const { data: saAuth, error: saAuthErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saAuthErr) throw new Error("Super Admin auth failed: " + saAuthErr.message);
  console.log("Logged in as Super Admin:", saAuth.user?.email);
  console.log("=== CHECKING PACKAGE CATEGORIES ===");
  const { data: categories, error: catError } = await supabase
    .from("package_categories")
    .select("*")
    .order("display_order");
  if (catError) console.error("Cat error:", catError);
  console.log(`Categories count: ${categories?.length || 0}`);
  for (const c of categories || []) {
    console.log(`- [${c.code}] ${c.name} (${c.slug}) | Active: ${c.is_active} | Order: ${c.display_order}`);
  }

  console.log("\n=== CHECKING PACKAGE CATALOG ===");
  const { data: packages, error: pkgError } = await supabase
    .from("package_catalog")
    .select("id, code, name, price, currency, billing_type, is_active, is_published, category_id, custom_pricing")
    .order("code");
  if (pkgError) console.error("Pkg error:", pkgError);
  console.log(`Packages count: ${packages?.length || 0}`);
  for (const p of packages || []) {
    console.log(`- [${p.code}] ${p.name} | ${p.price} ${p.currency} (${p.billing_type}) | Active: ${p.is_active} | Pub: ${p.is_published} | CatId: ${p.category_id}`);
  }

  console.log("\n=== CHECKING PACKAGE ADDONS ===");
  const { data: addons, error: addonError } = await supabase
    .from("package_addons")
    .select("*")
    .order("code");
  if (addonError) console.error("Addon error:", addonError);
  console.log(`Addons count: ${addons?.length || 0}`);
  for (const a of addons || []) {
    console.log(`- [${a.code}] ${a.name} | ${a.price} TND / ${a.unit} | Active: ${a.is_active}`);
  }
}

main().catch(console.error);
