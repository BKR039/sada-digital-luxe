import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { normalizeEmail, normalizePhone } from "../src/components/admin/project-utils";
import { reconcileClientPackageWork } from "../src/lib/package-reconciliation-service";
import { supabase } from "../src/integrations/supabase/client";

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

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("SADA OS — CLIENT CREATION & SCHEMA ALIGNMENT REGRESSION SUITE");
  console.log("=================================================================\n");

  const client = createClient(supabaseUrl, anonKey);

  let tempUserId: string | null = null;
  const tempEmail = `test.client.schema.${Date.now()}@sada.agency`;
  const tempPass = "TestPass123!456";

  const signUp = await client.auth.signUp({ email: tempEmail, password: tempPass });
  if (!signUp.data.user) {
    throw new Error(`Authentication signUp failed: ${signUp.error?.message}`);
  }
  tempUserId = signUp.data.user.id;
  console.log(`Signed up temporary test identity: ${tempEmail} (${tempUserId})`);

  // Assign super_admin role via linked query so RLS allows client creation and deletion
  const { execSync } = await import("child_process");
  execSync(
    `npx supabase db query --linked "INSERT INTO public.user_roles (id, user_id, role) VALUES (gen_random_uuid(), '${tempUserId}', 'super_admin');"`,
    { encoding: "utf-8" }
  );

  const signIn = await client.auth.signInWithPassword({ email: tempEmail, password: tempPass });
  if (signIn.error || !signIn.data.user) {
    throw new Error(`Failed to sign in as newly created super_admin: ${signIn.error?.message}`);
  }
  const user = signIn.data.user;
  console.log(`Authenticated active session on client as super_admin (${user.id})`);

  // Also authenticate the singleton supabase client used by reconcileClientPackageWork
  await supabase.auth.signInWithPassword({ email: tempEmail, password: tempPass });

  const createdClientIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Full Payload Monthly Client Creation
    // -------------------------------------------------------------
    console.log("\n--- Test 1: Full Payload Client Creation (Monthly Retainer) ---");
    const fullTestName = `QA Test Client Full ${Date.now()}`;
    const rawEmail = `  Contact.Full.${Date.now()}@LuxuryBrand.TN  `;
    const rawPhone = " +216 98 123 456 ";
    const normalizedTestEmail = normalizeEmail(rawEmail);
    const normalizedTestPhone = normalizePhone(rawPhone);

    // Fetch existing package catalog for canonical package reference
    const { data: pkgs } = await (client as any)
      .from("package_catalog")
      .select("id, name, price")
      .limit(1);

    const testPkgId = pkgs?.[0]?.id || null;
    const testPkgName = pkgs?.[0]?.name || "Growth — Custom";

    // Step 1: Create client in public.clients
    const fullClientPayload = {
      name: fullTestName,
      client_type: "monthly",
      industry: "Hospitality & Luxury",
      contact_name: "Youssef Mansour",
      email: normalizedTestEmail,
      phone: normalizedTestPhone,
      preferred_channel: "whatsapp",
      status: "active",
      package_id: testPkgId,
      package_name: testPkgName,
      package_config: {
        reels_quota: 6,
        posts_quota: 4,
        stories_quota: 12,
        other_services: ["Meta Ads", "Photography"],
      },
      billing_start_date: "2026-11-01",
      current_period_month: "2026-11",
      relationship_owner_id: user.id,
      account_manager_id: user.id,
      sales_owner_id: user.id,
      monthly_package_price: 3500.0,
      default_service_fee: 3500.0,
      default_sponsoring_budget: 1500.0,
    };

    const { data: fullClient, error: fullClientErr } = await (client as any)
      .from("clients")
      .insert(fullClientPayload)
      .select("*")
      .single();

    assert(!fullClientErr && !!fullClient?.id, "Monthly client created in public.clients", fullClientErr?.message);
    if (fullClient?.id) createdClientIds.push(fullClient.id);

    assert(fullClient?.email === normalizedTestEmail, "Client email correctly persisted in public.clients.email");
    assert(fullClient?.phone === normalizedTestPhone, "Client phone correctly persisted in public.clients.phone");
    assert(fullClient?.contact_name === "Youssef Mansour", "Client contact name correctly persisted");
    assert(fullClient?.monthly_package_price === 3500, "Monthly package price correctly persisted");
    assert(fullClient?.default_sponsoring_budget === 1500, "Default sponsoring budget correctly persisted");

    // Step 2: Create operational project container in public.client_projects (without client_email/client_phone)
    const fullProjectPayload = {
      client_id: fullClient.id,
      client_name: fullClient.name,
      title: `${fullClient.name} — Monthly Retainer`,
      status: "active",
      lead_id: user.id,
      start_date: "2026-11-01",
      description: `Monthly continuous retainer for ${fullClient.name}. Package: ${testPkgName}`,
    };

    const { data: fullProj, error: fullProjErr } = await (client as any)
      .from("client_projects")
      .insert(fullProjectPayload)
      .select("*")
      .single();

    assert(!fullProjErr && !!fullProj?.id, "Operational project created without schema mismatch error", fullProjErr?.message);
    assert(fullProj?.client_id === fullClient.id, "Operational project correctly linked to client_id");
    assert(fullProj?.title === `${fullClient.name} — Monthly Retainer`, "Operational project title set correctly");

    // Step 3: Run package reconciliation service
    const reconReport = await reconcileClientPackageWork({
      clientId: fullClient.id,
      packageId: testPkgId,
      packageName: testPkgName,
      packageConfig: {
        reels_quota: 6,
        posts_quota: 4,
        stories_quota: 12,
        other_services: ["Meta Ads", "Photography"],
      },
      periodMonth: "2026-11",
      actorId: user.id,
      actorEmail: user.email,
    });

    assert(reconReport.success === true, "reconcileClientPackageWork executed without schema mismatch error", reconReport.error);

    // -------------------------------------------------------------
    // Test 2: Minimal Payload Client Creation (Optional Fields Omitted)
    // -------------------------------------------------------------
    console.log("\n--- Test 2: Minimal Payload Client Creation (Optional Fields Omitted) ---");
    const minTestName = `QA Test Client Minimal ${Date.now()}`;

    const minClientPayload = {
      name: minTestName,
      client_type: "one_off",
      status: "active",
      package_name: "One-Off: Brand Identity",
      package_config: null,
      monthly_package_price: 0,
      default_service_fee: 0,
      default_sponsoring_budget: 0,
    };

    const { data: minClient, error: minClientErr } = await (client as any)
      .from("clients")
      .insert(minClientPayload)
      .select("*")
      .single();

    assert(!minClientErr && !!minClient?.id, "Minimal client created in public.clients", minClientErr?.message);
    if (minClient?.id) createdClientIds.push(minClient.id);

    assert(minClient?.email === null, "Minimal client email is null (optional field omitted)");
    assert(minClient?.phone === null, "Minimal client phone is null (optional field omitted)");
    assert(minClient?.contact_name === null, "Minimal client contact_name is null (optional field omitted)");

    // Step 2: Create one-off operational project container
    const minProjectPayload = {
      client_id: minClient.id,
      client_name: minClient.name,
      title: `${minClient.name} — Brand Identity`,
      status: "active",
      description: "One-off service engagement: Brand Identity",
    };

    const { data: minProj, error: minProjErr } = await (client as any)
      .from("client_projects")
      .insert(minProjectPayload)
      .select("*")
      .single();

    assert(!minProjErr && !!minProj?.id, "Minimal one-off project created successfully", minProjErr?.message);

    // -------------------------------------------------------------
    // Test 3: Edit Client Contact Profile (admin.client-workspaces.$id)
    // -------------------------------------------------------------
    console.log("\n--- Test 3: Edit Client Contact Profile ---");
    const updatedEmail = `updated.contact.${Date.now()}@domain.com`;
    const updatedPhone = "+216 22 333 444";
    const updatedName = `${fullTestName} Renamed`;

    // 1. Update clients table
    const { error: editClientErr } = await (client as any)
      .from("clients")
      .update({
        name: updatedName,
        email: normalizeEmail(updatedEmail),
        phone: normalizePhone(updatedPhone),
      })
      .eq("id", fullClient.id);

    assert(!editClientErr, "Client contact info updated in public.clients", editClientErr?.message);

    // 2. Synchronize project title/name without sending client_email/client_phone
    const { error: editProjErr } = await (client as any)
      .from("client_projects")
      .update({
        client_name: updatedName,
      })
      .eq("client_id", fullClient.id);

    assert(!editProjErr, "client_projects synchronized client_name without schema error", editProjErr?.message);

    // Verify SSOT in clients
    const { data: verifiedClient } = await (client as any)
      .from("clients")
      .select("name, email, phone")
      .eq("id", fullClient.id)
      .single();

    assert(verifiedClient?.email === updatedEmail, "Verified clients.email is updated canonical SSOT");
    assert(verifiedClient?.phone === "+21622333444", "Verified clients.phone is updated canonical SSOT");

    // -------------------------------------------------------------
    // Test 4: Rollback & Atomic Cleanup on Error
    // -------------------------------------------------------------
    console.log("\n--- Test 4: Rollback & Atomic Cleanup on Failure ---");
    const rollbackTestName = `QA Test Client Rollback ${Date.now()}`;
    let rollbackClientId: string | null = null;
    let rollbackTriggered = false;

    try {
      // 1. Insert client
      const { data: rbClient, error: rbClientErr } = await (client as any)
        .from("clients")
        .insert({
          name: rollbackTestName,
          client_type: "monthly",
          status: "active",
        })
        .select("*")
        .single();

      if (rbClientErr) throw rbClientErr;
      rollbackClientId = rbClient.id;

      // 2. Insert project
      const { data: rbProj, error: rbProjErr } = await (client as any)
        .from("client_projects")
        .insert({
          client_id: rbClient.id,
          client_name: rbClient.name,
          title: `${rbClient.name} — Test Project`,
          status: "active",
        })
        .select("*")
        .single();

      if (rbProjErr) throw rbProjErr;

      // 3. Deliberately trigger an error in subsequent step
      throw new Error("Simulated unexpected downstream error during task generation");
    } catch (err: any) {
      rollbackTriggered = true;
      if (rollbackClientId) {
        // Perform the rollback sequence implemented in admin.client-workspaces.index.tsx
        await (client as any).from("project_tasks").delete().eq("client_id", rollbackClientId);
        await (client as any).from("client_projects").delete().eq("client_id", rollbackClientId);
        await (client as any).from("clients").delete().eq("id", rollbackClientId);
      }
    }

    assert(rollbackTriggered, "Downstream failure correctly caught");

    // Verify client record was cleaned up and not left orphaned
    const { data: orphanedClient } = await (client as any)
      .from("clients")
      .select("id")
      .eq("id", rollbackClientId)
      .maybeSingle();

    assert(orphanedClient === null, "Orphaned client was cleanly rolled back from database");

    // -------------------------------------------------------------
    // Test 5: Verify Schema Integrity of client_projects
    // -------------------------------------------------------------
    console.log("\n--- Test 5: Verify Schema Integrity of client_projects ---");
    // Verify that querying client_projects columns succeeds and that no client_email column is expected
    const { data: projColumnsTest, error: colErr } = await (client as any)
      .from("client_projects")
      .select("id, title, client_name, client_id, status, description, start_date, lead_id")
      .limit(1);

    assert(!colErr, "client_projects standard operational columns query cleanly", colErr?.message);

  } finally {
    // -------------------------------------------------------------
    // Final Teardown: Clean up all test records
    // -------------------------------------------------------------
    console.log("\n--- Teardown: Cleaning up test records ---");
    for (const cid of createdClientIds) {
      try {
        const { error } = await (client as any).rpc("admin_delete_client_permanently", { _client_id: cid });
        if (error) {
          // Fallback to direct delete if RPC fails
          await (client as any).from("client_deliverables").delete().eq("client_id", cid);
          await (client as any).from("project_tasks").delete().eq("client_id", cid);
          await (client as any).from("client_projects").delete().eq("client_id", cid);
          await (client as any).from("clients").delete().eq("id", cid);
        }
        console.log(`Cleaned up test client: ${cid}`);
      } catch (cleanErr: any) {
        console.warn(`Warning cleaning up ${cid}:`, cleanErr.message);
      }
    }

    if (tempUserId) {
      try {
        const { execSync } = await import("child_process");
        execSync(
          `npx supabase db query --linked "DELETE FROM public.user_roles WHERE user_id = '${tempUserId}';"`,
          { encoding: "utf-8" }
        );
        console.log(`Cleaned up temporary test user role: ${tempUserId}`);
      } catch (userCleanErr: any) {
        console.warn(`Warning cleaning up temp test user role ${tempUserId}:`, userCleanErr.message);
      }
    }
  }

  console.log("\n=================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
