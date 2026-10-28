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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function main() {
  console.log("=== AUTHENTICATING AS SUPER ADMIN ===");
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    process.exit(1);
  }
  console.log("Authenticated as:", authData.user.email);

  console.log("\n=== CHECKING PROFILES STATUS ===");
  const { data: profiles, error: pErr } = await client.from("profiles").select("id, display_name, status").limit(50);
  console.log("Profiles count:", profiles?.length, "Error:", pErr);
  const statuses = new Set(profiles?.map((p) => p.status));
  console.log("Distinct profile statuses:", Array.from(statuses));

  console.log("\n=== CHECKING ORPHAN PROJECTS ===");
  const { data: orphans, error: oErr } = await client
    .from("client_projects")
    .select("id, title, client_id, created_at")
    .is("client_id", null);
  console.log("Orphan projects count:", orphans?.length, "Error:", oErr);
  if (orphans && orphans.length > 0) {
    console.log("Orphans:", JSON.stringify(orphans, null, 2));
  }

  console.log("\n=== CHECKING CLIENTS ===");
  const { data: clients, error: cErr } = await client.from("clients").select("id, name, status").limit(5);
  console.log("Clients count:", clients?.length, "Error:", cErr);
  if (clients && clients.length > 0) {
    console.log("Sample clients:", JSON.stringify(clients, null, 2));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
