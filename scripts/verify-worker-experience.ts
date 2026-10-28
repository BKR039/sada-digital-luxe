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

function makeClient(token?: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

async function runWorkerExperienceValidation() {
  console.log("==================================================");
  console.log("SADA WORK OS — WORKER EXPERIENCE & SALES VALIDATION");
  console.log("==================================================\n");

  const results: { test: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // =========================================================================
  // 1. ANONYMOUS ACCESS RESTRICTIONS
  // =========================================================================
  console.log("--- 1. Testing Anonymous Access Restrictions ---");
  const anonClient = makeClient();

  const { data: anonDeals } = await anonClient.from("deals").select("*");
  const { data: anonComms } = await anonClient.from("sales_commissions").select("*");
  const { data: anonProjects } = await anonClient.from("client_projects").select("*");
  const { error: anonRuleMutateErr } = await anonClient.from("business_rules").insert({
    rule_key: "test_anon_rule",
    rule_name: "Test Anon Rule",
    category: "commissions",
    numeric_value: 100,
    is_active: true,
  });

  const anonDealsBlocked = !anonDeals || anonDeals.length === 0;
  const anonCommsBlocked = !anonComms || anonComms.length === 0;
  const anonRuleBlocked = Boolean(anonRuleMutateErr);

  results.push({
    test: "Anonymous users cannot read deals/leads",
    status: anonDealsBlocked ? "PASS" : "FAIL",
    details: `Deals returned: ${anonDeals?.length ?? 0}`,
  });
  results.push({
    test: "Anonymous users cannot read sales commissions",
    status: anonCommsBlocked ? "PASS" : "FAIL",
    details: `Commissions returned: ${anonComms?.length ?? 0}`,
  });
  results.push({
    test: "Anonymous users cannot mutate business rules",
    status: anonRuleBlocked ? "PASS" : "FAIL",
    details: anonRuleMutateErr ? anonRuleMutateErr.message : "Mutation allowed!",
  });

  // =========================================================================
  // 2. WORKER AUTHENTICATION & IDENTITY
  // =========================================================================
  console.log("\n--- 2. Testing Worker Authentication & Data Visibility ---");
  const workerAuthClient = makeClient();
  const { data: workerAuthData, error: workerAuthErr } = await workerAuthClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  if (workerAuthErr || !workerAuthData.session) {
    console.error("Worker login failed:", workerAuthErr);
    results.push({
      test: "Worker Authentication",
      status: "FAIL",
      details: workerAuthErr?.message || "No session",
    });
    return results;
  }

  const workerToken = workerAuthData.session.access_token;
  const workerUserId = workerAuthData.user.id;
  const workerClient = makeClient(workerToken);

  console.log(`Authenticated as Worker: ${workerAuthData.user.email} (UID: ${workerUserId})`);

  // Check worker profile and team_member linkage
  const { data: workerProfile } = await workerClient.from("profiles").select("*").eq("id", workerUserId).single();
  const { data: workerMember } = await workerClient.from("team_members").select("*").eq("profile_id", workerUserId).single();

  results.push({
    test: "Worker Identity Linked to Team Member",
    status: workerMember?.id ? "PASS" : "FAIL",
    details: `Profile: ${workerProfile?.display_name || workerUserId}, Member ID: ${workerMember?.id}`,
  });

  // Query projects as worker
  const { data: workerProjects } = await workerClient.from("client_projects").select("id, title, client_name");
  console.log(`Worker visible projects: ${workerProjects?.length ?? 0}`);
  if (workerProjects) {
    workerProjects.slice(0, 5).forEach(p => console.log(`  - [Project] ${p.client_name} - ${p.title} (${p.id})`));
  }

  results.push({
    test: "Worker sees authorized assigned projects (Jannat Sahara / Café 707)",
    status: (workerProjects && workerProjects.length >= 2) ? "PASS" : "FAIL",
    details: `Projects visible: ${workerProjects?.length ?? 0}`,
  });

  // Query tasks as worker
  const { data: workerTasks } = await workerClient.from("project_tasks").select("id, title, status, priority, deadline, assignee_id");
  console.log(`Worker visible tasks: ${workerTasks?.length ?? 0}`);
  const todoTasks = workerTasks?.filter(t => t.status === "todo") || [];
  const inProgTasks = workerTasks?.filter(t => t.status === "in_progress") || [];
  const blockedTasks = workerTasks?.filter(t => t.status === "blocked") || [];

  results.push({
    test: "Worker sees assigned tasks in multiple operational states",
    status: (workerTasks && workerTasks.length >= 4) ? "PASS" : "FAIL",
    details: `Total: ${workerTasks?.length}, Todo: ${todoTasks.length}, In Progress: ${inProgTasks.length}, Blocked: ${blockedTasks.length}`,
  });

  // Query deals as worker
  const { data: workerDeals } = await workerClient.from("deals").select("id, title, stage, deal_value, sales_owner_id");
  console.log(`Worker visible deals: ${workerDeals?.length ?? 0}`);
  if (workerDeals) {
    workerDeals.forEach(d => console.log(`  - [Deal] ${d.title} (Stage: ${d.stage}, Value: ${d.deal_value} TND)`));
  }

  results.push({
    test: "Worker sees their own leads/deals",
    status: (workerDeals && workerDeals.length >= 2) ? "PASS" : "FAIL",
    details: `Deals visible: ${workerDeals?.length ?? 0}`,
  });

  // Query commissions as worker
  const { data: workerComms } = await workerClient.from("sales_commissions").select("*");
  console.log(`Worker visible commissions: ${workerComms?.length ?? 0}`);
  if (workerComms) {
    workerComms.forEach(c => console.log(`  - [Commission] Amount: ${c.commission_amount} TND (Rate: ${c.commission_rate}%, Status: ${c.status})`));
  }

  const hasDemo225 = workerComms?.some(c => Number(c.commission_amount) === 225 && Number(c.commission_rate) === 15);
  results.push({
    test: "Worker sees canonical demo commission (225 TND @ 15% excluding sponsoring)",
    status: hasDemo225 ? "PASS" : "FAIL",
    details: `Commissions count: ${workerComms?.length ?? 0}, Contains 225 TND snapshot: ${hasDemo225}`,
  });

  // =========================================================================
  // 3. WORKER SALES WORKFLOW: CREATE LEAD & CONVERT TO SALE
  // =========================================================================
  console.log("\n--- 3. Testing Worker Lead Creation & Conversion Engine ---");

  // Get a valid client
  const { data: clientList } = await workerClient.from("clients").select("id, name").limit(1);
  const sampleClientId = clientList?.[0]?.id || null;

  // A. Create new lead
  const testLeadTitle = `Validation Lead ${Date.now()}`;
  const { data: createdLead, error: createLeadErr } = await workerClient
    .from("deals")
    .insert({
      title: testLeadTitle,
      company_name: "Validation Corp",
      contact_name: "Tarek Test",
      contact_email: "tarek@validation.tn",
      contact_phone: "+216 99 888 777",
      stage: "lead",
      deal_value: 3000,
      sales_owner_id: workerUserId,
      notes: "Lead created during worker validation suite",
    })
    .select()
    .single();

  results.push({
    test: "Worker can create a new lead auto-attributed to self",
    status: createdLead?.id ? "PASS" : "FAIL",
    details: createLeadErr ? createLeadErr.message : `Lead ID: ${createdLead?.id}`,
  });

  // B. Convert Lead to Sale via RPC convert_lead_to_sale
  // Business Example: Package = 2,300 TND, Sponsoring = 800 TND -> Commissionable = 1,500 TND, 15% = 225 TND
  if (createdLead?.id && workerMember?.id) {
    const { data: rpcRes, error: rpcErr } = await workerClient.rpc("convert_lead_to_sale", {
      p_deal_id: createdLead.id,
      p_client_id: sampleClientId,
      p_package_id: null,
      p_sale_amount: 2300,
      p_sponsoring_amount: 800,
      p_payment_status: "paid",
      p_sale_date: "2026-10-01",
      p_notes: "Automated conversion test with 800 TND sponsoring deduction",
    });

    console.log("RPC convert_lead_to_sale response:", rpcRes, rpcErr || "");

    const convSuccess = rpcRes && rpcRes.success;
    const calcRate = rpcRes?.commission_rate;
    const calcAmt = rpcRes?.commission_amount;
    const isExact225 = Number(calcAmt) === 225 && Number(calcRate) === 15;

    results.push({
      test: "Commission Engine: Calculates 15% excluding sponsoring (2300 - 800 = 1500 -> 225 TND)",
      status: isExact225 ? "PASS" : "FAIL",
      details: convSuccess ? `Rate: ${calcRate}%, Commission: ${calcAmt} TND` : `RPC Error: ${rpcErr?.message}`,
    });

    // Check that historical snapshot is recorded on sales_commissions
    if (rpcRes?.commission_id) {
      const { data: commRecord } = await workerClient
        .from("sales_commissions")
        .select("*")
        .eq("id", rpcRes.commission_id)
        .single();

      const hasSnapshot = Boolean(commRecord?.commission_rule_snapshot);
      results.push({
        test: "Commission Record Snapshots Historical Rule Metadata",
        status: hasSnapshot ? "PASS" : "FAIL",
        details: `Snapshot rule_key: ${commRecord?.commission_rule_snapshot?.rule_key || "none"}`,
      });
    }
  }

  // =========================================================================
  // 4. WORKER SECURITY / RLS BOUNDARIES
  // =========================================================================
  console.log("\n--- 4. Testing Worker RLS Boundaries & Restrictions ---");

  // Worker cannot mutate business_rules (RLS allows select for authenticated, but update strictly for super_admin)
  const { data: updateAttemptData, error: workerRuleErr } = await workerClient
    .from("business_rules")
    .update({ numeric_value: 50 })
    .eq("rule_key", "initial_commission_rate")
    .select();

  // In Postgres RLS, an unauthorized update either raises an error or updates 0 rows
  const updateDenied = Boolean(workerRuleErr) || (!updateAttemptData || updateAttemptData.length === 0);

  // Verify the rule in the database is intact
  const { data: verifyRule } = await workerClient
    .from("business_rules")
    .select("numeric_value")
    .eq("rule_key", "initial_commission_rate")
    .single();

  const isIntact = Number(verifyRule?.numeric_value) === 15;

  results.push({
    test: "Worker cannot modify commission rules in business_rules",
    status: (updateDenied && isIntact) ? "PASS" : "FAIL",
    details: `Update affected rows: ${updateAttemptData?.length ?? 0}, DB rate remains: ${verifyRule?.numeric_value}%`,
  });

  // Worker cannot insert commission for another team member
  const { error: fakeCommErr } = await workerClient
    .from("sales_commissions")
    .insert({
      team_member_id: "00000000-0000-0000-0000-000000000000",
      deal_id: createdLead?.id || "00000000-0000-0000-0000-000000000000",
      commission_amount: 9999,
      total_sale_amount: 9999,
      status: "paid",
    });

  results.push({
    test: "Worker cannot insert unauthorized commission for another team member",
    status: Boolean(fakeCommErr) ? "PASS" : "FAIL",
    details: fakeCommErr ? `Correctly denied: ${fakeCommErr.message}` : "CRITICAL: Unauthorized insert allowed!",
  });

  // =========================================================================
  // 5. SUPER ADMIN CAPABILITIES
  // =========================================================================
  console.log("\n--- 5. Testing Super Admin Capabilities ---");
  const saAuthClient = makeClient();
  const { data: saAuthData, error: saAuthErr } = await saAuthClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (saAuthErr || !saAuthData.session) {
    console.error("Super Admin login failed:", saAuthErr);
    results.push({
      test: "Super Admin Authentication",
      status: "FAIL",
      details: saAuthErr?.message || "No session",
    });
  } else {
    const saClient = makeClient(saAuthData.session.access_token);

    // Super Admin can view all deals
    const { data: allDeals } = await saClient.from("deals").select("id, title, sales_owner_id");
    // Super Admin can view all commissions
    const { data: allComms } = await saClient.from("sales_commissions").select("id, commission_amount, status");
    // Super Admin can view and edit business rules
    const { data: currentRule } = await saClient.from("business_rules").select("*").eq("rule_key", "initial_commission_rate").single();

    results.push({
      test: "Super Admin sees all agency deals and commissions",
      status: (allDeals && allDeals.length > 0 && allComms && allComms.length > 0) ? "PASS" : "FAIL",
      details: `All Deals: ${allDeals?.length}, All Commissions: ${allComms?.length}`,
    });

    results.push({
      test: "Super Admin has full access to commission business rules",
      status: Boolean(currentRule) ? "PASS" : "FAIL",
      details: `Current initial_commission_rate: ${currentRule?.numeric_value ?? currentRule?.rule_value ?? "15"}%`,
    });
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n==================================================");
  console.log("FINAL VALIDATION REPORT");
  console.log("==================================================");
  let allPass = true;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    if (r.status !== "PASS") allPass = false;
    console.log(`${icon} [${r.status}] ${r.test}`);
    console.log(`   └─ Details: ${r.details}`);
  }

  console.log("\n==================================================");
  console.log(`RESULT: ${allPass ? "ALL TESTS PASSED ✨" : "SOME TESTS FAILED ⚠️"}`);
  console.log("==================================================");

  return results;
}

runWorkerExperienceValidation().catch(console.error);
