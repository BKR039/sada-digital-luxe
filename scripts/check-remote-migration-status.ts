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
const client = createClient(supabaseUrl, anonKey);

async function checkRemoteMigrations() {
  console.log("=== CHECKING REMOTE MIGRATION APPLICATION STATUS (READ-ONLY) ===");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // 1. Check if public_team_members view exists (migration 20261016140000)
  const ptm = await client.from("public_team_members" as any).select("id").limit(1);
  console.log("1. View 'public_team_members' (migration 20261016140000):", !ptm.error ? "EXISTS (APPLIED)" : `MISSING: ${ptm.error.message}`);

  // 2. Check client_projects columns client_email, client_phone (migration 20261017190000)
  const cpCols = await client.from("client_projects").select("id, client_email, client_phone").limit(1);
  console.log("2. client_projects.client_email/phone (migration 20261017190000):", !cpCols.error ? "EXISTS (APPLIED)" : `MISSING: ${cpCols.error.message}`);

  // 3. Check client_projects with title, client_name, client_id
  const cpBasic = await client.from("client_projects").select("id, title, client_name, client_id, status").limit(5);
  console.log("3. client_projects rows:", cpBasic.data?.length, cpBasic.data);

  // 4. Check projects columns title_ar (migration 20261018200000)
  const projAr = await client.from("projects").select("id, title_ar").limit(1);
  console.log("4. projects.title_ar (migration 20261018200000):", !projAr.error ? "EXISTS (APPLIED)" : `MISSING: ${projAr.error.message}`);

  // 5. Check blog_posts columns category_ar (migration 20261018210000)
  const blogAr = await client.from("blog_posts").select("id, category_ar").limit(1);
  console.log("5. blog_posts.category_ar (migration 20261018210000):", !blogAr.error ? "EXISTS (APPLIED)" : `MISSING: ${blogAr.error.message}`);

  // 6. Check products columns gumroad_url, slug (migration 20261018220000)
  const prodGum = await client.from("products").select("id, gumroad_url, slug").limit(1);
  console.log("6. products.gumroad_url/slug (migration 20261018220000):", !prodGum.error ? "EXISTS (APPLIED)" : `MISSING: ${prodGum.error.message}`);

  // 7. Check workflow_templates columns
  const wfTmpl = await client.from("workflow_templates").select("id, name, task_type").limit(1);
  console.log("7. workflow_templates.task_type (migration 20261018170000):", !wfTmpl.error ? "EXISTS (APPLIED)" : `MISSING: ${wfTmpl.error.message}`);

  // 8. Check RPC advance_production_booking_stage (migration 20261017223000)
  // Calling with fake UUID should return not found or forbidden, but NOT function does not exist
  const rpcP4 = await client.rpc("advance_production_booking_stage" as any, {
    _booking_id: "00000000-0000-0000-0000-000000000000",
    _new_stage: "completed",
    _media_urls: [],
    _actor_id: "00000000-0000-0000-0000-000000000000"
  });
  console.log("8. RPC advance_production_booking_stage (migration 20261017223000):", rpcP4.error?.message?.includes("does not exist") ? "MISSING (NOT APPLIED)" : `REGISTERED (Error was: ${rpcP4.error?.message || "none"})`);
}

checkRemoteMigrations().catch(console.error);
