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
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Explicit list of audited, confirmed test and duplicate fixture client IDs
const CONFIRMED_FIXTURES_TO_CLEAN = [
  { id: "1c005bea-9e89-454f-a296-cbeea9c36d67", reason: "Test fixture from test-client-lifecycle-management (SEC_TEST)" },
  { id: "30537d2d-48ff-4cb9-bbb3-85616a6672ee", reason: "Test fixture from test-client-lifecycle-management (OP_CLIENT)" },
  { id: "b403d04e-f845-4fb2-9e9c-49ef942f6275", reason: "Test fixture from test-client-lifecycle-management (SEC_TEST)" },
  { id: "39627f09-89d9-4735-a188-30a3bf098f32", reason: "Test fixture from test-client-lifecycle-management (FIN_CLIENT)" },
  { id: "c4b7359d-c49f-4603-a4fb-2762c3e542a1", reason: "Test fixture from test-client-lifecycle-management (SEC_TEST)" },
  { id: "7cddf8f4-d701-4ee4-b580-6f70ffb3e88c", reason: "Test fixture from test-client-lifecycle-management (FIN_CLIENT)" },
  { id: "edbde293-5899-44f1-bb64-8b3a6fbd7c0c", reason: "Test fixture from test-client-lifecycle-management (SEC_TEST)" },
  { id: "2cd7a3f0-8a08-4f16-8292-0c8f1eefee17", reason: "Test fixture from test-client-creation-schema-fix (Rollback)" },
  { id: "779db25b-0066-4891-a04e-96a5482ad809", reason: "Test fixture from test-client-creation-schema-fix (Minimal)" },
  { id: "2b2f9b96-f8d0-44ae-b39f-85152636d09b", reason: "Test fixture from test-client-creation-schema-fix (Full Renamed)" },
  { id: "5df640d5-2bb5-43d1-bcfb-10b783338cd3", reason: "Duplicate Janat Sahara created 26s after authentic record bba95f6e-305f-4caf-bd4b-e03b50e6943a" }
];

const PRESERVED_CLIENT_IDS = [
  "bba95f6e-305f-4caf-bd4b-e03b50e6943a" // Authentic Janat Sahara client
];

async function runCleanup() {
  console.log("=======================================================================");
  console.log("SADA OS — AUDITED TEST CLIENTS CLEANUP");
  console.log("=======================================================================\n");

  // Authenticate as Super Admin
  const { data: saLogin, error: saLoginErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saLoginErr || !saLogin?.user) {
    throw new Error(`Failed to log in as Super Admin: ${saLoginErr?.message}`);
  }
  console.log(`Authenticated as Super Admin: qa.superadmin@sada.agency (${saLogin.user.id})\n`);

  for (const item of CONFIRMED_FIXTURES_TO_CLEAN) {
    if (PRESERVED_CLIENT_IDS.includes(item.id)) {
      console.warn(`⚠️ SKIPPING preserved client ID: ${item.id}`);
      continue;
    }

    console.log(`Auditing client: ${item.id} (${item.reason})...`);

    // 1. Check if client exists
    const { data: clientRecord, error: checkErr } = await client
      .from("clients")
      .select("id, name, status, created_at")
      .eq("id", item.id)
      .maybeSingle();

    if (checkErr) {
      console.error(`  Error checking client ${item.id}:`, checkErr.message);
      continue;
    }

    if (!clientRecord) {
      console.log(`  ℹ️ Client ${item.id} no longer exists in database.`);
      continue;
    }

    console.log(`  Found client: "${clientRecord.name}" (Status: ${clientRecord.status}, Created: ${clientRecord.created_at})`);

    // 2. Pre-flight dependency audit
    const { data: analysis, error: anaErr } = await client.rpc("admin_analyze_client_lifecycle", {
      _client_id: item.id
    });

    if (anaErr) {
      console.error(`  ❌ Failed lifecycle pre-flight analysis for ${item.id}:`, anaErr.message);
      continue;
    }

    console.log(`  Analysis: can_delete=${analysis.can_delete_permanently}, invoices=${analysis.counts.invoices}, commissions=${analysis.counts.financial_commissions}, tasks=${analysis.counts.tasks}, projects=${analysis.counts.projects}`);

    if (!analysis.can_delete_permanently) {
      console.error(`  🛑 FINANCIAL SAFEGUARD BLOCKED DELETION:`, analysis.blocking_reasons);
      continue;
    }

    // 3. Execute permanent deletion via secure RPC
    const { data: delResult, error: delErr } = await client.rpc("admin_delete_client_permanently", {
      _client_id: item.id
    });

    if (delErr) {
      console.error(`  ❌ Failed permanent deletion for ${item.id}:`, delErr.message);
      continue;
    }

    console.log(`  ✅ Successfully purged test fixture: "${clientRecord.name}" (${item.id})\n`);
  }

  // Final verification: Count remaining clients
  const { data: remainingClients, error: remErr } = await client
    .from("clients")
    .select("id, name, status, created_at");

  console.log("\n=======================================================================");
  console.log(`AUDIT SUMMARY: ${remainingClients?.length ?? 0} CLIENT(S) REMAIN IN DATABASE`);
  console.log("=======================================================================");
  if (remainingClients) {
    for (const c of remainingClients) {
      console.log(`  - [${c.id}] "${c.name}" (${c.status}) created ${c.created_at}`);
    }
  }
}

runCleanup().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
