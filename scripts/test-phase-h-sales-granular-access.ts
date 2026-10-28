// ============================================================
// SADA OS — PHASE H: Sales Granular Access Verification Suite
// Tests:
// 1. sales.view route evaluation, fetchDeals gate, PostgREST RLS
// 2. sales.create_lead creation, negative denial, forged actor defense
// 3. sales.edit_lead modification, negative denial, data scope isolation
// 4. sales.change_stage transitions, OCC concurrency, negative denial
// 5. sales.convert_lead RPC enforcement, commission creation, negative denial
// 6. sales.delete_lead Super Admin exclusivity, negative worker denial
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateRouteAccess,
  assertAuthorizedMutation,
  type AuthoritativeSecurityContext,
} from "../src/lib/security-isolation-service";
import {
  can,
  type PermissionContext,
  canCreateLead,
  canEditLead,
  canDeleteLead,
  canChangeDealStage,
  canConvertLead,
} from "../src/lib/permissions";
import {
  createAccount,
  deleteAccount,
} from "../src/lib/account-service";
import {
  createDeal,
  updateDeal,
  updateLeadStage,
  convertLeadToSale,
  deleteDeal,
  fetchDeals,
  type DealRow,
} from "../src/lib/sales-service";

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

const superClient = createClient(supabaseUrl, anonKey);
const workerClient1 = createClient(supabaseUrl, anonKey);
const restrictedClient = createClient(supabaseUrl, anonKey);
const otherWorkerClient = createClient(supabaseUrl, anonKey);

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  passedAssertions++;
  console.log(`  ✅ PASS: ${message}`);
}

async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedKeyword: string,
  message: string
) {
  totalAssertions++;
  try {
    const res = await fn();
    if (res && res.success === false && res.error) {
      const errStr = String(res.error).toLowerCase();
      if (errStr.includes(expectedKeyword.toLowerCase())) {
        passedAssertions++;
        console.log(`  ✅ PASS: ${message} (Result error matched "${expectedKeyword}")`);
        return;
      }
    }
    console.error(`  ❌ FAIL: ${message} (Expected rejection with keyword "${expectedKeyword}", but operation succeeded or returned unmatched: ${JSON.stringify(res)})`);
    process.exit(1);
  } catch (err: any) {
    const errMsg = String(err.message || err.error || err).toLowerCase();
    if (errMsg.includes(expectedKeyword.toLowerCase())) {
      passedAssertions++;
      console.log(`  ✅ PASS: ${message} (Caught expected "${expectedKeyword}")`);
      return;
    }
    console.error(`  ❌ FAIL: ${message} (Expected keyword "${expectedKeyword}", but got: "${err.message}")`);
    process.exit(1);
  }
}

async function runPhaseHSalesGranularAccessSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE H: SALES GRANULAR ACCESS VERIFICATION SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin");
  const superAdminUserId = saLogin!.user!.id;

  const testAccountsToClean: string[] = [];
  const testDealsToClean: string[] = [];

  try {
    // 2. Set up Test Personas
    const ts = Date.now();

    // Persona A: Sales Worker with full sales permissions
    const worker1Email = `phaseh.salesworker1.${ts}@sada.agency`;
    const acc1 = await createAccount({
      email: worker1Email,
      password: "TestPassword123!",
      displayName: "PhaseH Sales Worker 1",
      role: "worker",
      division: "Sales",
      position: "Sales Representative",
      status: "active",
      modulePermissions: {
        sales: {
          enabled: true,
          actions: {
            "view": true,
            "create_lead": true,
            "edit_lead": true,
            "change_stage": true,
            "convert_lead": true,
            "sales.view": true,
            "sales.create_lead": true,
            "sales.edit_lead": true,
            "sales.change_stage": true,
            "sales.convert_lead": true,
          },
        },
      },
    }, superClient);
    testAccountsToClean.push(acc1.user_id);

    // Persona B: Restricted Worker (only sales.view, no mutation permissions)
    const restrictedEmail = `phaseh.restricted.${ts}@sada.agency`;
    const acc2 = await createAccount({
      email: restrictedEmail,
      password: "TestPassword123!",
      displayName: "PhaseH Restricted Worker",
      role: "worker",
      division: "Production",
      position: "Observer",
      status: "active",
      modulePermissions: {
        sales: {
          enabled: true,
          actions: {
            "view": true,
            "create_lead": false,
            "edit_lead": false,
            "change_stage": false,
            "convert_lead": false,
            "delete_lead": false,
            "sales.view": true,
            "sales.create_lead": false,
            "sales.edit_lead": false,
            "sales.change_stage": false,
            "sales.convert_lead": false,
            "sales.delete_lead": false,
          },
        },
      },
    }, superClient);
    testAccountsToClean.push(acc2.user_id);

    // Persona C: Other Worker (for worker data scope isolation tests)
    const otherWorkerEmail = `phaseh.otherworker.${ts}@sada.agency`;
    const acc3 = await createAccount({
      email: otherWorkerEmail,
      password: "TestPassword123!",
      displayName: "PhaseH Other Worker",
      role: "worker",
      division: "Sales",
      position: "Senior Sales Rep",
      status: "active",
      modulePermissions: {
        sales: {
          enabled: true,
          actions: {
            "view": true,
            "create_lead": true,
            "edit_lead": true,
            "change_stage": true,
            "convert_lead": true,
            "sales.view": true,
            "sales.create_lead": true,
            "sales.edit_lead": true,
            "sales.change_stage": true,
            "sales.convert_lead": true,
          },
        },
      },
    }, superClient);
    testAccountsToClean.push(acc3.user_id);

    // Persona D: Blocked Worker (sales disabled completely)
    const blockedWorkerEmail = `phaseh.blockedsales.${ts}@sada.agency`;
    const acc4 = await createAccount({
      email: blockedWorkerEmail,
      password: "TestPassword123!",
      displayName: "PhaseH Blocked Sales Worker",
      role: "worker",
      division: "Production",
      position: "Video Editor",
      status: "active",
      modulePermissions: {
        sales: {
          enabled: false,
        },
      },
    }, superClient);
    testAccountsToClean.push(acc4.user_id);

    // Sign in as each persona
    const { data: w1Login } = await workerClient1.auth.signInWithPassword({
      email: worker1Email,
      password: "TestPassword123!",
    });
    assert(Boolean(w1Login?.user), "Worker 1 signed in successfully");

    const { data: rLogin } = await restrictedClient.auth.signInWithPassword({
      email: restrictedEmail,
      password: "TestPassword123!",
    });
    assert(Boolean(rLogin?.user), "Restricted Worker signed in successfully");

    const { data: owLogin } = await otherWorkerClient.auth.signInWithPassword({
      email: otherWorkerEmail,
      password: "TestPassword123!",
    });
    assert(Boolean(owLogin?.user), "Other Worker signed in successfully");

    // -----------------------------------------------------------------
    // SECTION 1: sales.view — Route Evaluation and Gate Verification
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 1: sales.view Verification ---");

    // 1.1 Super Admin evaluateRouteAccess for /admin/sales
    const saSecCtx: AuthoritativeSecurityContext = {
      authenticated: true,
      userId: superAdminUserId,
      email: "qa.superadmin@sada.agency",
      role: "super_admin",
      status: "active",
      effectivePermissions: { sales: true } as any,
    };
    const saRouteEval = evaluateRouteAccess("/admin/sales", saSecCtx);
    assert(saRouteEval.allowed, "Super Admin allowed on /admin/sales");

    // 1.2 Worker 1 with sales.view
    const w1SecCtx: AuthoritativeSecurityContext = {
      authenticated: true,
      userId: acc1.user_id,
      email: worker1Email,
      role: "worker",
      status: "active",
      effectivePermissions: { sales: true } as any,
      customOverrides: {
        sales: {
          enabled: true,
          actions: { "sales.view": true },
        },
      },
    };
    const w1RouteEval = evaluateRouteAccess("/admin/sales", w1SecCtx);
    assert(w1RouteEval.allowed, "Worker with sales.view allowed on /admin/sales");

    // 1.3 Blocked Worker (sales disabled)
    const blockedSecCtx: AuthoritativeSecurityContext = {
      authenticated: true,
      userId: acc4.user_id,
      email: blockedWorkerEmail,
      role: "worker",
      status: "active",
      effectivePermissions: { sales: false } as any,
      customOverrides: {
        sales: { enabled: false },
      },
    };
    const blockedRouteEval = evaluateRouteAccess("/admin/sales", blockedSecCtx);
    assert(!blockedRouteEval.allowed, "Worker without sales module access blocked on /admin/sales");

    // 1.4 fetchDeals enforces sales.view
    const blockedPermCtx: PermissionContext = {
      role: "worker",
      userId: acc4.user_id,
      customPermissions: { sales: { enabled: false } },
    };
    await assertThrowsAsync(
      () => fetchDeals({ ctx: blockedPermCtx, client: superClient }),
      "disabled",
      "fetchDeals rejects callers lacking sales.view permission"
    );

    // -----------------------------------------------------------------
    // SECTION 2: sales.create_lead Verification
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 2: sales.create_lead Verification ---");

    const w1PermCtx: PermissionContext = {
      role: "worker",
      userId: acc1.user_id,
      customPermissions: {
        sales: {
          enabled: true,
          actions: {
            "sales.view": true,
            "sales.create_lead": true,
            "sales.edit_lead": true,
            "sales.change_stage": true,
            "sales.convert_lead": true,
          },
        },
      },
    };

    const restrictedPermCtx: PermissionContext = {
      role: "worker",
      userId: acc2.user_id,
      customPermissions: {
        sales: {
          enabled: true,
          actions: {
            "sales.view": true,
            "sales.create_lead": false,
            "sales.edit_lead": false,
            "sales.change_stage": false,
            "sales.convert_lead": false,
          },
        },
      },
    };

    // 2.1 Authorized Lead Creation
    const createdDeal1 = await createDeal({
      title: "Luxury Hotel Retainer Deal",
      companyName: "Dar El Jeld Heritage",
      contactName: "Sami Ben Amor",
      contactEmail: "sami@dareljeld.com",
      serviceRevenue: 3500,
      sponsoringBudget: 500,
      stage: "qualified",
      salesOwnerId: acc1.user_id,
      ctx: w1PermCtx,
      client: workerClient1,
    });
    assert(Boolean(createdDeal1?.id), "Authorized worker creates lead via createDeal");
    if (createdDeal1) testDealsToClean.push(createdDeal1.id);

    // 2.2 Forged Sales Owner Defense: Worker cannot create a deal for someone else
    const forgedDeal = await createDeal({
      title: "Spoofed Owner Deal",
      companyName: "Spoofed Corp",
      serviceRevenue: 2000,
      salesOwnerId: acc3.user_id, // Attempt to spoof owner to other worker
      ctx: w1PermCtx,
      client: workerClient1,
    });
    assert(Boolean(forgedDeal?.id), "Deal created successfully");
    if (forgedDeal) {
      testDealsToClean.push(forgedDeal.id);
      assert(
        forgedDeal.sales_owner_id === acc1.user_id,
        "Worker sales_owner_id is locked to authentic auth identity, spoofed owner rejected"
      );
    }

    // 2.3 Unauthorized Lead Creation Denied by Service
    await assertThrowsAsync(
      () =>
        createDeal({
          title: "Unauthorized Deal",
          companyName: "Blocked Corp",
          serviceRevenue: 1000,
          ctx: restrictedPermCtx,
          client: restrictedClient,
        }),
      "sales.create_lead",
      "Restricted worker lacking sales.create_lead rejected by createDeal"
    );

    // 2.4 Unauthorized Direct PostgREST INSERT Denied by RLS
    const { error: directInsertErr } = await (restrictedClient as any)
      .from("deals")
      .insert({
        title: "Direct RLS Bypass Deal",
        company_name: "Hacker Corp",
        sales_owner_id: acc2.user_id,
        deal_value: 5000,
      });
    assert(
      Boolean(directInsertErr),
      "Direct PostgREST INSERT attempt without sales.create_lead blocked by deals RLS policy"
    );

    // -----------------------------------------------------------------
    // SECTION 3: sales.edit_lead Verification
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 3: sales.edit_lead Verification ---");

    // 3.1 Authorized Deal Edit
    const updatedDeal = await updateDeal(
      createdDeal1!.id,
      {
        title: "Updated Luxury Hotel Retainer Deal",
        companyName: "Dar El Jeld Heritage Palace",
        dealValue: 4200,
        notes: "Negotiated higher monthly deliverable scope",
      },
      {
        ctx: w1PermCtx,
        actorRole: "worker",
        actorId: acc1.user_id,
        client: workerClient1,
      }
    );
    assert(
      updatedDeal.title === "Updated Luxury Hotel Retainer Deal",
      "Authorized worker edits deal details via updateDeal"
    );

    // 3.2 Unauthorized Deal Edit Denied by Service
    await assertThrowsAsync(
      () =>
        updateDeal(
          createdDeal1!.id,
          { title: "Malicious Deal Edit" },
          {
            ctx: restrictedPermCtx,
            actorRole: "worker",
            actorId: acc2.user_id,
            client: restrictedClient,
          }
        ),
      "sales.edit_lead",
      "Restricted worker lacking sales.edit_lead rejected by updateDeal"
    );

    // 3.3 Worker Data Scope Isolation: Worker 1 cannot edit Worker 3's deal
    const otherWorkerPermCtx: PermissionContext = {
      role: "worker",
      userId: acc3.user_id,
      customPermissions: {
        sales: {
          enabled: true,
          actions: {
            "sales.view": true,
            "sales.create_lead": true,
            "sales.edit_lead": true,
            "sales.change_stage": true,
            "sales.convert_lead": true,
          },
        },
      },
    };
    const otherDeal = await createDeal({
      title: "Other Worker Deal",
      companyName: "Other Corp",
      serviceRevenue: 3000,
      salesOwnerId: acc3.user_id,
      ctx: otherWorkerPermCtx,
      client: otherWorkerClient,
    });
    if (otherDeal) testDealsToClean.push(otherDeal.id);

    await assertThrowsAsync(
      () =>
        updateDeal(
          otherDeal!.id,
          { title: "Hijacked Deal" },
          {
            ctx: w1PermCtx,
            actorRole: "worker",
            actorId: acc1.user_id,
            client: workerClient1,
          }
        ),
      "scope",
      "Worker attempting to edit another worker's deal rejected by worker data scope isolation"
    );

    // -----------------------------------------------------------------
    // SECTION 4: sales.change_stage & OCC Verification
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 4: sales.change_stage & OCC Verification ---");

    // 4.1 Authorized Stage Change
    const stageRes1 = await updateLeadStage({
      leadId: createdDeal1!.id,
      fromStage: "qualified",
      newStage: "meeting",
      actorCtx: w1PermCtx,
      actorRole: "worker",
      actorId: acc1.user_id,
      client: workerClient1,
    });
    assert(stageRes1.success && stageRes1.newStage === "meeting", "Authorized worker moves deal stage qualified -> meeting");

    // 4.2 Unauthorized Stage Change Denied by Service
    const stageResUnauth = await updateLeadStage({
      leadId: createdDeal1!.id,
      fromStage: "meeting",
      newStage: "proposal",
      actorCtx: restrictedPermCtx,
      actorRole: "worker",
      actorId: acc2.user_id,
      client: restrictedClient,
    });
    assert(
      !stageResUnauth.success && Boolean(stageResUnauth.error?.includes("sales.change_stage")),
      "Restricted worker lacking sales.change_stage rejected by updateLeadStage"
    );

    // 4.3 Optimistic Concurrency Control (OCC) Protection
    // Attempt to update with stale fromStage "qualified" when deal is currently in "meeting"
    const staleOccRes = await updateLeadStage({
      leadId: createdDeal1!.id,
      fromStage: "qualified", // Stale stage!
      newStage: "proposal",
      actorCtx: w1PermCtx,
      actorRole: "worker",
      actorId: acc1.user_id,
      client: workerClient1,
    });
    assert(
      !staleOccRes.success && Boolean(staleOccRes.error?.includes("Conflict")),
      "OCC detects stale fromStage and aborts concurrent overwrite"
    );

    // 4.4 Move to proposal with correct fromStage
    const stageResProp = await updateLeadStage({
      leadId: createdDeal1!.id,
      fromStage: "meeting",
      newStage: "proposal",
      actorCtx: w1PermCtx,
      actorRole: "worker",
      actorId: acc1.user_id,
      client: workerClient1,
    });
    assert(stageResProp.success && stageResProp.newStage === "proposal", "OCC succeeds with matching fromStage meeting -> proposal");

    // -----------------------------------------------------------------
    // SECTION 5: sales.convert_lead & RPC Verification
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 5: sales.convert_lead & RPC Verification ---");

    // 5.1 Unauthorized Conversion Denied by Service
    const unauthConvertRes = await convertLeadToSale({
      dealId: createdDeal1!.id,
      saleAmount: 4200,
      sponsoringAmount: 500,
      ctx: restrictedPermCtx,
      actorRole: "worker",
      actorId: acc2.user_id,
      client: restrictedClient,
    });
    assert(
      !unauthConvertRes.success && Boolean(unauthConvertRes.error?.includes("sales.convert_lead")),
      "Restricted worker lacking sales.convert_lead rejected by convertLeadToSale"
    );

    // 5.2 Direct RPC Bypass Attempt Denied by PostgreSQL Function
    const { error: directRpcErr } = await (restrictedClient as any).rpc("convert_lead_to_sale", {
      p_deal_id: createdDeal1!.id,
      p_client_id: null,
      p_package_id: null,
      p_sale_amount: 4200,
      p_sponsoring_amount: 500,
      p_payment_status: "paid",
    });
    assert(
      Boolean(directRpcErr) && Boolean(directRpcErr?.message?.includes("sales.convert_lead")),
      "Direct PostgreSQL RPC convert_lead_to_sale rejects callers lacking sales.convert_lead permission"
    );

    // 5.3 Authorized Lead Conversion
    const authConvertRes = await convertLeadToSale({
      dealId: createdDeal1!.id,
      saleAmount: 4200,
      sponsoringAmount: 500,
      paymentStatus: "paid",
      saleDate: "2026-10-07",
      ctx: w1PermCtx,
      actorRole: "worker",
      actorId: acc1.user_id,
      client: workerClient1,
    });
    assert(authConvertRes.success, "Authorized worker converts lead to won sale via convertLeadToSale RPC");

    // Verify deal is won and commission snapshot created
    const { data: wonDeal } = await (workerClient1 as any)
      .from("deals")
      .select("*, commission_rule_snapshot")
      .eq("id", createdDeal1!.id)
      .single();
    assert(wonDeal?.stage === "won", "Deal stage transitioned to 'won'");
    assert(Boolean(wonDeal?.commission_rule_snapshot), "Historical commission snapshot stored on deal");

    // -----------------------------------------------------------------
    // SECTION 6: sales.delete_lead & Super Admin Exclusivity
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 6: sales.delete_lead Verification ---");

    // 6.1 Worker Attempt to Delete Deal Denied by Service
    await assertThrowsAsync(
      () =>
        deleteDeal(createdDeal1!.id, {
          ctx: w1PermCtx,
          actorRole: "worker",
          actorId: acc1.user_id,
          client: workerClient1,
        }),
      "sales.delete_lead",
      "Worker lacking sales.delete_lead rejected by deleteDeal"
    );

    // 6.2 Direct PostgREST DELETE by Worker Denied by RLS
    const { data: deletedRows, error: directDeleteErr } = await (workerClient1 as any)
      .from("deals")
      .delete()
      .eq("id", createdDeal1!.id)
      .select();

    const { data: stillExists } = await (superClient as any)
      .from("deals")
      .select("id")
      .eq("id", createdDeal1!.id)
      .maybeSingle();

    assert(
      (Boolean(directDeleteErr) || (Array.isArray(deletedRows) && deletedRows.length === 0)) && Boolean(stillExists?.id),
      "Direct PostgREST DELETE attempt by worker blocked by deals RLS policy (zero rows affected, deal persists)"
    );

    // 6.3 Super Admin Deletes Deal Successfully
    const saPermCtx: PermissionContext = {
      role: "super_admin",
      userId: superAdminUserId,
    };
    await deleteDeal(createdDeal1!.id, {
      ctx: saPermCtx,
      actorRole: "super_admin",
      actorId: superAdminUserId,
      client: superClient,
    });
    assert(true, "Super Admin deletes deal successfully with sales.delete_lead permission");

    // Verify deal is removed from database
    const { data: checkDeleted } = await (superClient as any)
      .from("deals")
      .select("id")
      .eq("id", createdDeal1!.id)
      .maybeSingle();
    assert(!checkDeleted, "Deal is permanently removed from database");

    // Remove from cleanup queue since already deleted
    const idx = testDealsToClean.indexOf(createdDeal1!.id);
    if (idx !== -1) testDealsToClean.splice(idx, 1);

    // -----------------------------------------------------------------
    // SECTION 7: Audit Trail Verification
    // -----------------------------------------------------------------
    console.log("\n--- SECTION 7: Audit Trail Verification ---");
    const { data: auditLogs } = await (superClient as any)
      .from("system_audit_logs")
      .select("action, entity_type, entity_id")
      .in("action", ["DEAL_STAGE_CHANGE", "DEAL_UPDATED", "DEAL_CONVERTED_TO_SALE", "DEAL_DELETED"])
      .order("created_at", { ascending: false })
      .limit(10);

    const hasStageChange = auditLogs?.some((l: any) => l.action === "DEAL_STAGE_CHANGE");
    const hasDealUpdated = auditLogs?.some((l: any) => l.action === "DEAL_UPDATED");
    const hasConverted = auditLogs?.some((l: any) => l.action === "DEAL_CONVERTED_TO_SALE");
    const hasDeleted = auditLogs?.some((l: any) => l.action === "DEAL_DELETED");

    assert(hasStageChange, "System audit logs captured DEAL_STAGE_CHANGE");
    assert(hasDealUpdated, "System audit logs captured DEAL_UPDATED");
    assert(hasConverted, "System audit logs captured DEAL_CONVERTED_TO_SALE");
    assert(hasDeleted, "System audit logs captured DEAL_DELETED");

  } finally {
    // Cleanup created deals
    for (const dId of testDealsToClean) {
      await (superClient as any).from("deals").delete().eq("id", dId);
    }
    // Cleanup created accounts
    for (const uId of testAccountsToClean) {
      try {
        await deleteAccount(uId, superClient);
      } catch (cleanErr) {
        // Ignore cleanup err
      }
    }
  }

  console.log("\n=======================================================================");
  console.log(`PHASE H VERIFICATION COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED`);
  console.log("=======================================================================\n");
}

runPhaseHSalesGranularAccessSuite().catch((err) => {
  console.error("Unhandled exception in Phase H test suite:", err);
  process.exit(1);
});
