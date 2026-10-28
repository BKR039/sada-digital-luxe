// ============================================================
// SADA OS — 5-ROLE COMPREHENSIVE SECURITY & RLS AUDIT SUITE
// Tests Anonymous, Client (User), Worker, Admin, Super Admin
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { runPackageRecommendationEngine, fetchMatcherEligiblePackages } from "../src/lib/smart-match-service";

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

interface RoleTestReport {
  role: string;
  email?: string;
  totalVisible: number;
  internalCount: number;
  proposalCount: number;
  liveCount: number;
  canReadInternal: boolean;
  canReadProposals: boolean;
  canInsert: boolean;
  canUpdatePrice: boolean;
  canPublishOrApprove: boolean;
  canDelete: boolean;
  hasLeakedCosts: boolean;
  canReadAuditLogs: boolean;
}

async function runSecurityAudit() {
  console.log("============================================================");
  console.log("SADA OS — 5-ROLE SECURITY & RLS MULTI-TENANCY VERIFICATION");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title}`);
      if (detail) console.error(`         -> ${detail}`);
      failed++;
    }
  }

  try {
    // Pre-authenticate Super Admin client for maintenance & probe teardown
    const saClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: saAuth, error: saAuthErr } = await saClient.auth.signInWithPassword({
      email: "qa.superadmin@sada.agency",
      password: "SuperAdminPassword123!",
    });
    if (saAuthErr) {
      throw new Error(`Failed to authenticate Super Admin test account: ${saAuthErr.message}`);
    }

    // Ensure database is in pristine baseline state
    await saClient.from("package_catalog").update({ price: 699, approval_status: "approved", is_published: false }).eq("code", "MG-01");
    await saClient.from("package_catalog").update({ approval_status: "proposed", is_published: false }).eq("code", "PUB-MS-01");
    await saClient.from("package_catalog").delete().like("code", "TEST_%");

  // ============================================================
  // ROLE 1: ANONYMOUS VISITOR
  // ============================================================
  console.log("--- 1. Testing Role: Anonymous Visitor ---");
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  const { data: anonData } = await anonClient.from("package_catalog").select("id, code, price, is_internal_only, approval_status, is_published, employee_cost, direct_costs, operational_notes");
  const anonPackages = anonData || [];
  assert(anonPackages.length === 0, `Anon sees 0 packages because 0 public packages are published (found: ${anonPackages.length})`);
  assert(anonPackages.filter(p => p.is_internal_only).length === 0, "Anon CANNOT read internal catalog packages");
  assert(anonPackages.filter(p => p.approval_status === "proposed").length === 0, "Anon CANNOT read unapproved public proposals");
  assert(anonPackages.every(p => p.employee_cost == null && p.direct_costs == null && p.operational_notes == null), "Anon CANNOT access internal costs, margins, or operational notes");

  const { error: anonInsErr } = await anonClient.from("package_catalog").insert({
    code: "TEST_ANON_PROBE",
    name: "Anon Probe",
    slug: "anon-probe",
    price: 100,
    billing_unit: "item",
  });
  assert(Boolean(anonInsErr), `Anon CANNOT insert package records (blocked by RLS, error: ${anonInsErr?.code})`);

  const { data: anonUpd, error: anonUpdErr } = await anonClient.from("package_catalog").update({ price: 99999 }).eq("code", "MG-01").select();
  assert(Boolean(anonUpdErr) || (anonUpd && anonUpd.length === 0), "Anon CANNOT update package prices (blocked by RLS)");

  const { data: anonPub, error: anonPubErr } = await anonClient.from("package_catalog").update({ approval_status: "approved", is_published: true }).eq("code", "PUB-MS-01").select();
  assert(Boolean(anonPubErr) || (anonPub && anonPub.length === 0), "Anon CANNOT publish or approve packages");

  const { data: anonDel, error: anonDelErr } = await anonClient.from("package_catalog").delete().eq("code", "MG-01").select();
  assert(Boolean(anonDelErr) || (anonDel && anonDel.length === 0), "Anon CANNOT delete package records");

  const { data: anonAudit, error: anonAuditErr } = await anonClient.from("system_audit_logs").select("id").limit(1);
  assert(Boolean(anonAuditErr) || (anonAudit && anonAudit.length === 0), "Anon CANNOT access administrative audit logs");

  // ============================================================
  // ROLE 2: AUTHENTICATED ORDINARY USER (Client)
  // ============================================================
  console.log("\n--- 2. Testing Role: Authenticated Ordinary User (Client) ---");
  const clientUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await clientUserClient.auth.signInWithPassword({
    email: "qa.client@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: clientData } = await clientUserClient.from("package_catalog").select("id, code, price, is_internal_only, approval_status, is_published, employee_cost, direct_costs, operational_notes");
  const clientPackages = clientData || [];
  assert(clientPackages.length === 0, `Ordinary User sees 0 packages because 0 are published (found: ${clientPackages.length})`);
  assert(clientPackages.filter(p => p.is_internal_only).length === 0, "Ordinary User CANNOT read internal catalog packages");
  assert(clientPackages.filter(p => p.approval_status === "proposed").length === 0, "Ordinary User CANNOT read unapproved public proposals");
  assert(clientPackages.every(p => p.employee_cost == null && p.direct_costs == null && p.operational_notes == null), "Ordinary User CANNOT access internal costs or margins");

  const { error: clientInsErr } = await clientUserClient.from("package_catalog").insert({
    code: "TEST_CLIENT_PROBE",
    name: "Client Probe",
    slug: "client-probe",
    price: 100,
    billing_unit: "item",
  });
  assert(Boolean(clientInsErr), `Ordinary User CANNOT insert package records (blocked by RLS, error: ${clientInsErr?.code})`);

  const { data: clientUpd, error: clientUpdErr } = await clientUserClient.from("package_catalog").update({ price: 99999 }).eq("code", "MG-01").select();
  assert(Boolean(clientUpdErr) || (clientUpd && clientUpd.length === 0), "Ordinary User CANNOT update package prices");

  const { data: clientPub, error: clientPubErr } = await clientUserClient.from("package_catalog").update({ approval_status: "approved", is_published: true }).eq("code", "PUB-MS-01").select();
  assert(Boolean(clientPubErr) || (clientPub && clientPub.length === 0), "Ordinary User CANNOT publish or approve packages");

  const { data: clientDel, error: clientDelErr } = await clientUserClient.from("package_catalog").delete().eq("code", "MG-01").select();
  assert(Boolean(clientDelErr) || (clientDel && clientDel.length === 0), "Ordinary User CANNOT delete packages");

  const { data: clientAudit, error: clientAuditErr } = await clientUserClient.from("system_audit_logs").select("id").limit(1);
  assert(Boolean(clientAuditErr) || (clientAudit && clientAudit.length === 0), "Ordinary User CANNOT access administrative audit logs");

  // ============================================================
  // ROLE 3: WORKER
  // ============================================================
  console.log("\n--- 3. Testing Role: Worker ---");
  const workerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: workerData } = await workerClient.from("package_catalog").select("id, code, price, is_internal_only, approval_status, is_published, employee_cost, direct_costs, operational_notes");
  const workerPackages = workerData || [];
  assert(workerPackages.length === 0, `Worker sees 0 catalog packages because 0 are published (found: ${workerPackages.length})`);
  assert(workerPackages.filter(p => p.is_internal_only).length === 0, "Worker CANNOT read internal catalog packages");
  assert(workerPackages.filter(p => p.approval_status === "proposed").length === 0, "Worker CANNOT read unapproved proposals");
  assert(workerPackages.every(p => p.employee_cost == null && p.direct_costs == null && p.operational_notes == null), "Worker CANNOT access internal costs or margins");

  const { error: workerInsErr } = await workerClient.from("package_catalog").insert({
    code: "TEST_WORKER_PROBE",
    name: "Worker Probe",
    slug: "worker-probe",
    price: 100,
    billing_unit: "item",
  });
  assert(Boolean(workerInsErr), `Worker CANNOT insert package records (blocked by RLS, error: ${workerInsErr?.code})`);

  const { data: workerUpd, error: workerUpdErr } = await workerClient.from("package_catalog").update({ price: 99999 }).eq("code", "MG-01").select();
  assert(Boolean(workerUpdErr) || (workerUpd && workerUpd.length === 0), "Worker CANNOT update package prices");

  const { data: workerPub, error: workerPubErr } = await workerClient.from("package_catalog").update({ approval_status: "approved", is_published: true }).eq("code", "PUB-MS-01").select();
  assert(Boolean(workerPubErr) || (workerPub && workerPub.length === 0), "Worker CANNOT publish or approve packages");

  const { data: workerDel, error: workerDelErr } = await workerClient.from("package_catalog").delete().eq("code", "MG-01").select();
  assert(Boolean(workerDelErr) || (workerDel && workerDel.length === 0), "Worker CANNOT delete packages");

  const { data: workerAudit, error: workerAuditErr } = await workerClient.from("system_audit_logs").select("id").limit(1);
  assert(Boolean(workerAuditErr) || (workerAudit && workerAudit.length === 0), "Worker CANNOT access administrative audit logs");

  // ============================================================
  // ROLE 4: ADMIN
  // ============================================================
  console.log("\n--- 4. Testing Role: Admin ---");
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await adminClient.auth.signInWithPassword({
    email: "qa.admin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: adminData } = await adminClient.from("package_catalog").select("id, code, price, is_internal_only, approval_status, is_published, employee_cost, direct_costs, operational_notes");
  const adminPackages = adminData || [];
  assert(adminPackages.length === 35, `Admin CAN read all 35 packages (found: ${adminPackages.length})`);
  assert(adminPackages.filter(p => p.is_internal_only).length === 26, "Admin CAN read internal catalog (26 records)");
  assert(adminPackages.filter(p => !p.is_internal_only && p.approval_status === "proposed").length === 9, "Admin CAN read public proposals (9 records)");

  // Admin insert probe package
  const adminProbeCode = `TEST_ADMIN_${Date.now().toString().slice(-6)}`;
  const { data: adminInsData, error: adminInsErr } = await adminClient.from("package_catalog").insert({
    code: adminProbeCode,
    name: "Admin Probe",
    slug: `admin-probe-${Date.now().toString().slice(-6)}`,
    price: 150,
    billing_unit: "item",
    is_internal_only: true,
    approval_status: "proposed",
  }).select();
  assert(!adminInsErr && Boolean(adminInsData && adminInsData.length > 0), "Admin CAN insert package records");

  // Admin update price on probe
  const { data: adminUpdData, error: adminUpdErr } = await adminClient.from("package_catalog").update({ price: 200 }).eq("code", adminProbeCode).select();
  assert(!adminUpdErr && Boolean(adminUpdData && adminUpdData[0]?.price === 200), "Admin CAN update package details & prices");

  // Admin attempt delete probe package (MUST BE BLOCKED: Super Admin only)
  const { data: adminDelData, error: adminDelErr } = await adminClient.from("package_catalog").delete().eq("code", adminProbeCode).select();
  assert(Boolean(adminDelErr) || (adminDelData && adminDelData.length === 0), "Admin is BLOCKED from deleting packages (Super Admin only)");

  // Clean up probe with Super Admin client
  await saClient.from("package_catalog").delete().eq("code", adminProbeCode);

  const { data: adminAudit, error: adminAuditErr } = await adminClient.from("system_audit_logs").select("id").limit(1);
  assert(!adminAuditErr && Boolean(adminAudit && adminAudit.length > 0), "Admin CAN access administrative audit logs");

  // ============================================================
  // ROLE 5: SUPER ADMIN
  // ============================================================
  console.log("\n--- 5. Testing Role: Super Admin ---");
  const { data: saData } = await saClient.from("package_catalog").select("id, code, price, is_internal_only, approval_status, is_published, employee_cost, direct_costs, operational_notes");
  const saPackages = saData || [];
  assert(saPackages.length === 35, `Super Admin CAN read all 35 packages (found: ${saPackages.length})`);
  assert(saPackages.filter(p => p.is_internal_only).length === 26, "Super Admin CAN read internal catalog (26 records)");
  assert(saPackages.filter(p => !p.is_internal_only && p.approval_status === "proposed").length === 9, "Super Admin CAN read proposals (9 records)");

  // Super Admin insert probe package
  const saProbeCode = `TEST_SA_${Date.now().toString().slice(-6)}`;
  const { data: saInsData, error: saInsErr } = await saClient.from("package_catalog").insert({
    code: saProbeCode,
    name: "SA Probe",
    slug: `sa-probe-${Date.now().toString().slice(-6)}`,
    price: 300,
    billing_unit: "item",
    is_internal_only: true,
    approval_status: "proposed",
  }).select();
  assert(!saInsErr && Boolean(saInsData && saInsData.length > 0), "Super Admin CAN insert package records");

  // Super Admin update price
  const { data: saUpdData, error: saUpdErr } = await saClient.from("package_catalog").update({ price: 350 }).eq("code", saProbeCode).select();
  assert(!saUpdErr && Boolean(saUpdData && saUpdData[0]?.price === 350), "Super Admin CAN update prices");

  // Super Admin delete probe package (AUTHORIZED)
  const { data: saDelData, error: saDelErr } = await saClient.from("package_catalog").delete().eq("code", saProbeCode).select();
  assert(!saDelErr && Boolean(saDelData && saDelData.length > 0), "Super Admin CAN delete packages (authorized)");

  const { data: saAudit, error: saAuditErr } = await saClient.from("system_audit_logs").select("id").limit(1);
  assert(!saAuditErr && Boolean(saAudit && saAudit.length > 0), "Super Admin CAN access administrative audit logs");

  // ============================================================
  // 6. SMART MATCHER ISOLATION VERIFICATION
  // ============================================================
  console.log("\n--- 6. Smart Matcher Payload Isolation Verification ---");
  const eligibleForMatcher = await fetchMatcherEligiblePackages();
  assert(
    eligibleForMatcher.length === 0,
    `Smart Matcher sees 0 live public packages when 0 are approved/published (found: ${eligibleForMatcher.length})`
  );
  assert(
    eligibleForMatcher.every((p) => !p.is_internal_only && p.approval_status === "approved" && p.is_published),
    "Smart Matcher payload never contains internal or unapproved packages"
  );

  const recommendation = runPackageRecommendationEngine(eligibleForMatcher, {
    primaryGoal: "grow_presence",
    budgetConstraint: "tier_1",
    needsShooting: true,
  } as any);
  } finally {
    const saCleanup = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await saCleanup.auth.signInWithPassword({
      email: "qa.superadmin@sada.agency",
      password: "SuperAdminPassword123!",
    });
    await saCleanup.from("package_catalog").update({ price: 699, approval_status: "approved", is_published: false }).eq("code", "MG-01");
    await saCleanup.from("package_catalog").update({ approval_status: "proposed", is_published: false }).eq("code", "PUB-MS-01");
    await saCleanup.from("package_catalog").delete().like("code", "TEST_%");
  }

  console.log("\n============================================================");
  console.log(`5-ROLE SECURITY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error("Audit script failed with error:", err);
  process.exit(1);
});
