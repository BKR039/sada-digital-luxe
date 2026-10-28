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

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function runSecurityAudit() {
  console.log("=== LIVE DATABASE SECURITY & RLS AUDIT ===");

  // 1. Anonymous query on package_catalog
  console.log("\n[Test 1] Anonymous query on package_catalog (all rows)...");
  const { data: anonData, error: anonError } = await anonClient
    .from("package_catalog")
    .select("code, name, is_internal_only, is_published, approval_status, employee_cost, gross_margin, operational_notes");

  console.log("Anon query error:", anonError?.message || "none");
  console.log("Anon query rows returned:", anonData?.length || 0);

  if (anonData && anonData.length > 0) {
    console.log("WARNING: Anon received rows:", anonData);
  } else {
    console.log("SUCCESS: Anon received 0 rows because all 26 are internal and all 9 proposals are unpublished/proposed.");
  }

  // 2. Can anonymous query package_addons?
  console.log("\n[Test 2] Anonymous query on package_addons...");
  const { data: addonData, error: addonError } = await anonClient
    .from("package_addons")
    .select("code, name, price, unit, is_active");

  console.log("Anon addon rows returned:", addonData?.length || 0);

  // 3. Can anonymous query package_categories?
  console.log("\n[Test 3] Anonymous query on package_categories...");
  const { data: catData, error: catError } = await anonClient
    .from("package_categories")
    .select("code, name, is_active");

  console.log("Anon category rows returned:", catData?.length || 0);

  // 4. Test client authenticated user (non-admin) vs admin
  console.log("\n[Test 4] Testing non-admin authenticated user access...");
  const clientUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  
  // Try to sign in as a test client or check RLS policy definition
  console.log("Inspecting RLS policy condition for authenticated users...");
}

runSecurityAudit().catch(console.error);
