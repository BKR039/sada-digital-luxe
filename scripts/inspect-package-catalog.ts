import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://mtfkzabiscyleztypqks.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { error: authErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    process.exit(1);
  }

  const { data: packages, error: pErr } = await client
    .from("package_catalog")
    .select("*")
    .order("code");

  if (pErr) {
    console.error("Packages error:", pErr);
    process.exit(1);
  }

  const { data: addons, error: aErr } = await client
    .from("package_addons")
    .select("*")
    .order("code");

  if (aErr) {
    console.error("Addons error:", aErr);
    process.exit(1);
  }

  fs.writeFileSync("catalog_dump.json", JSON.stringify({ packages, addons }, null, 2));
  console.log(`Successfully dumped ${packages.length} packages and ${addons.length} addons to catalog_dump.json`);
}

main().catch(console.error);
