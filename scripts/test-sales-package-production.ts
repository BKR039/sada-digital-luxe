// ============================================================
// SADA OS — PHASE 3 & PHASE 4 AUTOMATED TEST SUITE
// Sales Pipeline, Package Engine, Delivery, Tasks & Production
// Testing Against Live Remote Supabase Database
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  calculateDealCommission,
  computePackageProfitability,
  type DealStage,
  type ProductionStage,
  type DeliverableType,
} from "../src/lib/sales-service";
import { isTaskOverdue, type TaskRow } from "../src/components/admin/project-utils";

// 1. Load environment variables
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

import { supabase } from "../src/integrations/supabase/client";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(
  num: number,
  name: string,
  condition: boolean,
  expected: string,
  actual: string,
  details?: string
) {
  results.push({ num, name, passed: condition, expected, actual, details });
  const icon = condition ? "✓" : "❌";
  console.log(`${icon} [Test ${num.toString().padStart(2, "0")}] ${name}: ${actual}`);
  if (!condition && details) {
    console.error(`  ↳ Expected: ${expected} | Details: ${details}`);
  }
}

async function runSalesPackageProductionSuite() {
  console.log("=================================================================");
  console.log("SADA OS — PHASE 3 & 4 CANONICAL ENGINE AUTOMATED TEST SUITE");
  console.log("Testing Sales → Deal → Package → Revenue → Deliverables → Production");
  console.log("=================================================================\n");

  const runId = Math.random().toString(36).substring(2, 7);

  // Authenticate as Super Admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authErr || !authData.user) {
    console.error("Failed to authenticate test runner as sec.admin:", authErr?.message);
    process.exit(1);
  }
  console.log(`✓ Authenticated as Super Admin: ${authData.user.email} (${authData.user.id})\n`);

  // Track entities created for cleanup
  let createdDealId: string | null = null;
  let createdClientId: string | null = null;
  let createdInvoiceId: string | null = null;
  let createdCommissionId: string | null = null;
  let createdBookingId: string | null = null;
  let createdTaskId: string | null = null;
  let createdOverdueTaskId: string | null = null;
  let createdDeliverableIds: string[] = [];
  let testPackage: any = null;
  let realSalesOwnerProfileId: string = "f4184256-97c4-4f81-9346-176ec5dfb43a"; // Boubakar profile / auth.users ID
  let realCommissionRecipientId: string = "b363b2c1-eb6c-4203-9180-ec69ebf41cb7"; // Boubakar team_members ID
  let realWorkerId: string = "1ca08e63-0b39-4247-bcc8-ce58f71178b2"; // Sarah Chen team_members ID
  let realWorkerProfileId: string = "11111111-1111-1111-1111-111111111111"; // Security Admin profile

  try {
    // -------------------------------------------------------------
    // TEST 1: Package Schema & Mathematical Determinism
    // -------------------------------------------------------------
    console.log("--- PHASE 3: PACKAGE ENGINE & PROFITABILITY FORMULAS ---");
    const { data: pkgs, error: pkgErr } = await supabase
      .from("packages")
      .select("*")
      .order("selling_price", { ascending: true });

    recordTest(
      1,
      "Package Engine — Pre-seeded Canonical Packages Exist",
      !pkgErr && Boolean(pkgs && pkgs.length >= 3),
      ">= 3 canonical packages",
      `${pkgs?.length || 0} packages found`
    );

    testPackage = pkgs?.find((p: any) => p.name === "SADA Growth Luxe") || pkgs?.[0];
    if (testPackage) {
      const sp = Number(testPackage.selling_price);
      const dc = Number(testPackage.direct_costs);
      const gp = Number(testPackage.gross_profit);
      const gm = Number(testPackage.gross_margin);

      const computed = computePackageProfitability({
        sellingPrice: sp,
        employeeCost: Number(testPackage.employee_cost),
        freelancerCost: Number(testPackage.freelancer_cost),
        transportCost: Number(testPackage.transport_cost),
        subscriptionAllocation: Number(testPackage.subscription_allocation),
        commission: Number(testPackage.commission),
      });

      const formulaCorrect =
        Math.abs(computed.directCosts - dc) < 0.01 &&
        Math.abs(computed.grossProfit - gp) < 0.01 &&
        Math.abs(computed.grossMargin - gm) < 0.01;

      recordTest(
        2,
        "Package Engine — Deterministic Profit & Margin Formulas (No Manual Profit)",
        formulaCorrect && gp === sp - dc,
        `Gross Profit = ${sp - dc} TND, Margin = ${Math.round(((sp - dc) / sp) * 10000) / 100}%`,
        `DB Stored: Profit = ${gp} TND, Margin = ${gm}%`
      );
    }

    // -------------------------------------------------------------
    // TEST 2: Sales Pipeline Canonical Progression
    // -------------------------------------------------------------
    console.log("\n--- PHASE 3: SALES PIPELINE CANONICAL PROGRESSION ---");
    const testCompanyName = `Test Luxe Brand ${runId}`;
    const testContactEmail = `luxe.${runId}@example.com`;

    // Create deal at stage 'lead'
    const { data: newDeal, error: dealCreateErr } = await (supabase as any)
      .from("deals")
      .insert({
        title: `Retainer Luxe — ${testCompanyName}`,
        company_name: testCompanyName,
        contact_name: "Amira Ben Salem",
        contact_email: testContactEmail,
        contact_phone: "+216 98 123 456",
        stage: "lead",
        package_id: testPackage.id,
        deal_value: 4300,
        service_revenue: 2800, // SADA Growth Luxe base
        sponsoring_budget: 1500, // Meta ads budget
        commission_rate: 10,
        commission_recipient_id: realCommissionRecipientId,
        sales_owner_id: realSalesOwnerProfileId,
      })
      .select("*")
      .single();

    if (dealCreateErr) {
      console.error("DEBUG dealCreateErr:", dealCreateErr);
    }

    recordTest(
      3,
      "Sales Pipeline — Deal Created at Stage 'lead'",
      !dealCreateErr && newDeal?.stage === "lead",
      "stage: 'lead'",
      `stage: '${newDeal?.stage}'`,
      dealCreateErr ? JSON.stringify(dealCreateErr) : undefined
    );

    createdDealId = newDeal?.id;

    // Transition through stages: contacted → qualified → meeting → proposal → negotiation
    const stagesToTest: DealStage[] = [
      "contacted",
      "qualified",
      "meeting",
      "proposal",
      "negotiation",
    ];

    let allStagesPassed = true;
    for (const stage of stagesToTest) {
      const { error: stageErr } = await (supabase as any)
        .from("deals")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", createdDealId);
      if (stageErr) {
        allStagesPassed = false;
        break;
      }
    }

    const { data: negotiatedDeal } = await (supabase as any)
      .from("deals")
      .select("stage")
      .eq("id", createdDealId)
      .single();

    recordTest(
      4,
      "Sales Pipeline — Transition: contacted → qualified → meeting → proposal → negotiation",
      allStagesPassed && negotiatedDeal?.stage === "negotiation",
      "stage: 'negotiation'",
      `stage: '${negotiatedDeal?.stage}'`
    );

    // -------------------------------------------------------------
    // TEST 3: Deal → Won Canonical Transition Engine
    // -------------------------------------------------------------
    console.log("\n--- PHASE 3: DEAL → WON CANONICAL WORKFLOW ---");

    // Dynamically import winDeal or execute canonical win flow
    const { winDeal } = await import("../src/lib/sales-service");
    const winResult = await winDeal(createdDealId!);

    recordTest(
      5,
      "Deal → Won: Stage transitions to 'won' with won_date timestamp",
      winResult.deal.stage === "won" && Boolean(winResult.deal.won_date),
      "stage: 'won', won_date populated",
      `stage: '${winResult.deal.stage}', won_date: ${winResult.deal.won_date}`
    );

    createdClientId = winResult.client.id;
    recordTest(
      6,
      "Deal → Client: Client record automatically created and linked to Deal",
      Boolean(createdClientId) &&
        winResult.client.name === testCompanyName &&
        winResult.deal.client_id === createdClientId,
      `Linked client id = ${createdClientId}`,
      `deal.client_id = ${winResult.deal.client_id}`
    );

    recordTest(
      7,
      "Deal → Package: Client and Deal linked to canonical Package",
      winResult.client.package_id === testPackage.id &&
        winResult.deal.package_id === testPackage.id,
      `package_id = ${testPackage.id}`,
      `client: ${winResult.client.package_id}, deal: ${winResult.deal.package_id}`
    );

    // -------------------------------------------------------------
    // TEST 4: Revenue & Commission Configuration (Financial OS Connection)
    // -------------------------------------------------------------
    console.log("\n--- PHASE 3: FINANCIAL OS CONNECTION & COMMISSION RULES ---");

    createdInvoiceId = winResult.invoice?.id;
    const inv = winResult.invoice;
    recordTest(
      8,
      "Package → Revenue: Invoice created with Total = Service (2800) + Sponsoring (1500)",
      Boolean(inv) &&
        Number(inv.service_revenue) === 2800 &&
        Number(inv.sponsoring_budget) === 1500 &&
        Number(inv.total_amount) === 4300,
      "Total Amount: 4300 TND (2800 service + 1500 sponsoring)",
      `Total Amount: ${inv?.total_amount} TND (Service: ${inv?.service_revenue}, Sponsoring: ${inv?.sponsoring_budget})`
    );

    createdCommissionId = winResult.commission?.id;
    const comm = winResult.commission;

    // Rule: Sponsoring excluded from commission base!
    recordTest(
      9,
      "Commission Rule — Sponsoring Budget Strictly Excluded from Commission Base",
      Boolean(comm) &&
        Number(comm.service_revenue) === 2800 &&
        Number(comm.commission_amount) === 280, // 10% of 2800, NOT 10% of 4300 (430)
      "Base: 2800 TND, Amount: 280 TND (10% of Service only)",
      `Base: ${comm?.service_revenue} TND, Amount: ${comm?.commission_amount} TND`
    );

    // Rule: Unpaid deal excluded from payout (status: 'pending')
    recordTest(
      10,
      "Commission Rule — Unpaid Deal Excluded from Payout (Status = 'pending')",
      Boolean(comm) && comm.status === "pending",
      "status: 'pending'",
      `status: '${comm?.status}'`
    );

    // Test invoice settlement unlocks commission
    const paidCalc = calculateDealCommission({
      serviceRevenue: 2800,
      sponsoringBudget: 1500,
      commissionRate: 10,
      invoiceStatus: "paid",
    });

    recordTest(
      11,
      "Commission Rule — Settled Invoice Unlocks Commission Approval",
      paidCalc.status === "approved" && paidCalc.isEligible === true && paidCalc.commissionAmount === 280,
      "status: 'approved', isEligible: true",
      `status: '${paidCalc.status}', isEligible: ${paidCalc.isEligible}`
    );

    // Rule: Refunded invoice cancels commission
    const refundCalc = calculateDealCommission({
      serviceRevenue: 2800,
      sponsoringBudget: 1500,
      commissionRate: 10,
      invoiceStatus: "refunded",
    });

    recordTest(
      12,
      "Commission Rule — Refund Excluded from Commission (Status = 'cancelled')",
      refundCalc.status === "cancelled" && refundCalc.commissionAmount === 0 && refundCalc.isEligible === false,
      "status: 'cancelled', commissionAmount: 0",
      `status: '${refundCalc.status}', amount: ${refundCalc.commissionAmount}`
    );

    // -------------------------------------------------------------
    // TEST 5: Phase 4 Deliverables Engine
    // -------------------------------------------------------------
    console.log("\n--- PHASE 4: PACKAGE GENERATES EXPECTED DELIVERABLES ---");

    const deliverables = winResult.deliverables;
    createdDeliverableIds = deliverables.map((d: any) => d.id);

    const reels = deliverables.find((d: any) => d.deliverable_type === "reel");
    const posts = deliverables.find((d: any) => d.deliverable_type === "post");
    const stories = deliverables.find((d: any) => d.deliverable_type === "story");
    const ads = deliverables.find((d: any) => d.deliverable_type === "ads_campaign");

    const hasExpectedDeliverables =
      deliverables.length === 4 &&
      reels?.target_quantity === 8 &&
      posts?.target_quantity === 8 &&
      stories?.target_quantity === 20 &&
      ads?.target_quantity === 4;

    recordTest(
      13,
      "Deliverable Engine — Package Generates Expected Deliverables (8 Reels, 8 Posts, 20 Stories, 4 Ads)",
      hasExpectedDeliverables,
      "8 Reels, 8 Posts, 20 Stories, 4 Ads Campaigns",
      `${reels?.target_quantity} Reels, ${posts?.target_quantity} Posts, ${stories?.target_quantity} Stories, ${ads?.target_quantity} Ads Campaigns`
    );

    // Test Generated Column for Remaining Quantity
    const allRemainingCorrect = deliverables.every(
      (d: any) => d.remaining_quantity === d.target_quantity - d.done_quantity
    );

    recordTest(
      14,
      "Deliverable Engine — Target, Done & Generated Remaining Tracking",
      allRemainingCorrect && reels?.remaining_quantity === 8,
      "Remaining = Target - Done (Deterministic)",
      `Reels: Target=${reels?.target_quantity}, Done=${reels?.done_quantity}, Remaining=${reels?.remaining_quantity}`
    );

    // Update deliverable progress (+1 reel done)
    const { updateDeliverableProgress } = await import("../src/lib/sales-service");
    await updateDeliverableProgress(reels.id, 1);

    const { data: updatedReel } = await (supabase as any)
      .from("client_deliverables")
      .select("*")
      .eq("id", reels.id)
      .single();

    recordTest(
      15,
      "Deliverable Engine — Progress Increment (+1 Done → Remaining Decrements to 7)",
      updatedReel?.done_quantity === 1 && updatedReel?.remaining_quantity === 7,
      "Done: 1, Remaining: 7",
      `Done: ${updatedReel?.done_quantity}, Remaining: ${updatedReel?.remaining_quantity}`
    );

    // -------------------------------------------------------------
    // TEST 6: Phase 4 Task Schema & Workflow
    // -------------------------------------------------------------
    console.log("\n--- PHASE 4: TASK SCHEMA & CANONICAL WORKFLOW ---");

    // Create a task with all Phase 4 fields
    const { data: projectTask, error: taskErr } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: winResult.project?.id || null,
        client_id: createdClientId,
        package_id: testPackage.id,
        deliverable_id: reels.id,
        title: "Produce Hook & Script for Reel #1",
        description: "High-energy brand story reel hook with client luxury aesthetic",
        status: "todo",
        priority: "high",
        assignee_id: realWorkerProfileId,
        reviewer_id: realWorkerId,
        deadline: "2026-10-15",
        estimated_hours: 4.5,
        actual_hours: 0,
        revision_count: 0,
        attachments: ["https://sada.agency/assets/brief-sample.pdf"],
        notes: "Client requested cinematic lighting and minimal color grading.",
      })
      .select("*")
      .single();

    if (taskErr) {
      console.error("DEBUG taskErr:", taskErr);
    }

    recordTest(
      16,
      "Task Schema — Contains Client, Package, Deliverable, Assignee, Reviewer, Est Hours, Attachments",
      !taskErr &&
        projectTask?.client_id === createdClientId &&
        projectTask?.package_id === testPackage.id &&
        projectTask?.deliverable_id === reels.id &&
        Number(projectTask?.estimated_hours) === 4.5,
      "Complete Phase 4 task schema populated",
      `client_id: ${projectTask?.client_id?.slice(0, 8)}..., pkg_id: ${projectTask?.package_id?.slice(0, 8)}..., est_hours: ${projectTask?.estimated_hours}`,
      taskErr ? JSON.stringify(taskErr) : undefined
    );

    createdTaskId = projectTask?.id;

    // Advance task through workflow:
    // TO DO → IN PROGRESS → REVIEW → REVISION → APPROVED → DELIVERED
    const workflowStages = [
      { status: "in_progress", revisionCount: 0 },
      { status: "review", revisionCount: 0 },
      { status: "revision", revisionCount: 1 },
      { status: "approved", revisionCount: 1 },
      { status: "delivered", revisionCount: 1, completed: true },
    ];

    let workflowSuccess = true;
    for (const step of workflowStages) {
      const payload: any = {
        status: step.status,
        revision_count: step.revisionCount,
        updated_at: new Date().toISOString(),
      };
      if (step.completed) {
        payload.completed_at = new Date().toISOString();
      }
      const { error: upErr } = await (supabase as any)
        .from("project_tasks")
        .update(payload)
        .eq("id", createdTaskId);
      if (upErr) {
        console.error(`DEBUG step '${step.status}' upErr:`, upErr);
        workflowSuccess = false;
        break;
      }
    }

    const { data: finishedTask } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", createdTaskId)
      .single();

    recordTest(
      17,
      "Task Workflow — TO DO → IN PROGRESS → REVIEW → REVISION → APPROVED → DELIVERED",
      workflowSuccess &&
        finishedTask?.status === "delivered" &&
        finishedTask?.revision_count === 1 &&
        Boolean(finishedTask?.completed_at),
      "status: 'delivered', revision_count: 1, completed_at set",
      `status: '${finishedTask?.status}', revision_count: ${finishedTask?.revision_count}, completed: ${Boolean(finishedTask?.completed_at)}`
    );

    // -------------------------------------------------------------
    // TEST 7: Late Tasks Surfacing on Dashboards
    // -------------------------------------------------------------
    console.log("\n--- PHASE 4: LATE TASKS SURFACING ON DASHBOARDS ---");

    // Create an overdue task (deadline in the past, uncompleted)
    const pastDate = "2026-09-01";
    const { data: lateTask, error: lateTaskErr } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: winResult.project?.id || null,
        client_id: createdClientId,
        title: "Overdue Video Render",
        status: "in_progress",
        priority: "urgent",
        assignee_id: realWorkerProfileId,
        deadline: pastDate,
      })
      .select("*")
      .single();

    if (lateTaskErr) {
      console.error("DEBUG lateTaskErr:", lateTaskErr);
    }

    createdOverdueTaskId = lateTask?.id;

    const isOverdue = lateTask ? isTaskOverdue(lateTask as TaskRow) : false;

    const todayDateOnly = new Date().toISOString().slice(0, 10);
    // Check manager dashboard logic: status in ('todo', 'in_progress', 'review', 'revision') & deadline < now
    const { data: managerOverdueTasks, error: mErr } = lateTask?.id ? await (supabase as any)
      .from("project_tasks")
      .select("id, title, deadline, status")
      .in("status", ["todo", "in_progress", "review", "revision"])
      .lt("deadline", todayDateOnly)
      .eq("id", lateTask.id) : { data: [], error: null };

    if (mErr) {
      console.error("DEBUG managerOverdueTasks err:", mErr);
    }

    recordTest(
      18,
      "Dashboard Exceptions — Overdue Task Surfaces on Manager & Employee Dashboards",
      Boolean(isOverdue && managerOverdueTasks && managerOverdueTasks.length > 0),
      "isTaskOverdue === true and matches exception queries",
      `isTaskOverdue: ${isOverdue}, surfaced in exception query: ${managerOverdueTasks?.length || 0} match`,
      lateTaskErr ? JSON.stringify(lateTaskErr) : undefined
    );

    // -------------------------------------------------------------
    // TEST 8: Production Booking & Brief Workflow
    // -------------------------------------------------------------
    console.log("\n--- PHASE 4: PRODUCTION MODULE & BRIEF WORKFLOW ---");

    const testBrief = {
      shotList: ["Establish exterior shot", "Product macro shot", "Team candid", "Testimonial clip"],
      requiredReels: ["1x Brand Story Hook", "1x Behind The Scenes"],
      photos: ["8x High-res lifestyle images", "4x Product showcase images"],
      storyAssets: ["12x Interactive poll assets", "8x Swipe-up story clips"],
      references: ["https://instagram.com/p/example1", "https://instagram.com/p/example2"],
      equipment: ["Sony FX3", "24-70mm GM II lens", "Godox SL60W LED", "DJI Mic 2"],
    };

    const { data: booking, error: bookingErr } = await (supabase as any)
      .from("production_bookings")
      .insert({
        client_id: createdClientId,
        deal_id: createdDealId,
        project_id: winResult.project?.id,
        package_id: testPackage.id,
        title: `Commercial Shoot & Reel Batch — ${testCompanyName}`,
        date: "2026-10-10",
        time: "10:00",
        location: "SADA Creative Studios, Tunis",
        team_member_ids: [realCommissionRecipientId, realWorkerId],
        production_type: "Video & Photography Retainer Shoot",
        duration_hours: 4.5,
        brief: testBrief,
        stage: "brief",
      })
      .select("*")
      .single();

    recordTest(
      19,
      "Production Module — Booking Created with Complete Brief & Equipment Specs",
      !bookingErr &&
        booking?.stage === "brief" &&
        booking?.brief?.shotList?.length === 4 &&
        booking?.brief?.equipment?.length === 4,
      "Stage 'brief', 4 shot lists, 4 equipment items",
      `stage: '${booking?.stage}', shots: ${booking?.brief?.shotList?.length}, equipment: ${booking?.brief?.equipment?.length}`
    );

    createdBookingId = booking?.id;

    // Advance booking through canonical 8-stage production workflow:
    // BRIEF → SCHEDULING → SHOOTING → RAW UPLOAD → EDITING → REVIEW → CLIENT APPROVAL → DELIVERY/PUBLISHING
    const productionStages: ProductionStage[] = [
      "scheduling",
      "shooting",
      "raw_upload",
      "editing",
      "review",
      "client_approval",
      "delivery_publishing",
    ];

    let prodWorkflowSuccess = true;
    for (const st of productionStages) {
      const { error: pErr } = await (supabase as any)
        .from("production_bookings")
        .update({
          stage: st,
          raw_upload_url: st === "raw_upload" ? "https://storage.sada.agency/raw/batch-01.zip" : undefined,
          edit_preview_url: st === "review" ? "https://vimeo.com/sada/review-01" : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", createdBookingId);
      if (pErr) {
        prodWorkflowSuccess = false;
        break;
      }
    }

    const { data: finishedBooking } = await (supabase as any)
      .from("production_bookings")
      .select("*")
      .eq("id", createdBookingId)
      .single();

    recordTest(
      20,
      "Production Workflow — BRIEF → SCHEDULING → SHOOTING → RAW UPLOAD → EDITING → REVIEW → CLIENT APPROVAL → DELIVERY/PUBLISHING",
      prodWorkflowSuccess && finishedBooking?.stage === "delivery_publishing",
      "stage: 'delivery_publishing'",
      `stage: '${finishedBooking?.stage}'`
    );

    // -------------------------------------------------------------
    // TEST 9: Actual Hours Feeding Package Profitability
    // -------------------------------------------------------------
    console.log("\n--- PHASE 4: ACTUAL HOURS FEEDING PACKAGE PROFITABILITY ---");

    const { updateTaskHours } = await import("../src/lib/sales-service");
    const hoursUpdated = await updateTaskHours(createdTaskId!, 5.0);

    const { data: hoursTask } = await (supabase as any)
      .from("project_tasks")
      .select("estimated_hours, actual_hours")
      .eq("id", createdTaskId)
      .single();

    recordTest(
      21,
      "Package Profitability Integration — Actual Hours Tracked on Task (Est: 4.5h, Actual: 5.0h)",
      hoursUpdated && Number(hoursTask?.actual_hours) === 5.0,
      "actual_hours: 5.0",
      `actual_hours: ${hoursTask?.actual_hours}`
    );
  } catch (err: any) {
    console.error("Test execution caught exception:", err);
    recordTest(99, "Test Suite Runner Exception", false, "Clean execution", err.message);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP TEST DATA
    // -------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Test Entities ---");
    if (createdOverdueTaskId) {
      await (supabase as any).from("project_tasks").delete().eq("id", createdOverdueTaskId);
    }
    if (createdTaskId) {
      await (supabase as any).from("project_tasks").delete().eq("id", createdTaskId);
    }
    if (createdBookingId) {
      await (supabase as any).from("production_bookings").delete().eq("id", createdBookingId);
    }
    if (createdDeliverableIds.length > 0) {
      await (supabase as any).from("client_deliverables").delete().in("id", createdDeliverableIds);
    }
    if (createdCommissionId) {
      await (supabase as any).from("sales_commissions").delete().eq("id", createdCommissionId);
    }
    if (createdInvoiceId) {
      await (supabase as any).from("invoices").delete().eq("id", createdInvoiceId);
    }
    if (createdDealId) {
      await (supabase as any).from("deals").delete().eq("id", createdDealId);
    }
    if (createdClientId) {
      // Also delete any projects created for this client
      await (supabase as any).from("projects").delete().eq("client_id", createdClientId);
      await (supabase as any).from("clients").delete().eq("id", createdClientId);
    }
    console.log("✓ Cleanup finished successfully.\n");
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("=================================================================");
  console.log(`TEST SUITE RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("=================================================================");

  if (failed > 0) {
    console.error(`\n❌ ${failed} tests failed! Review log above for details.`);
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TESTS PASSED! SADA OS Phase 3 & Phase 4 Canonically Verified.");
    process.exit(0);
  }
}

runSalesPackageProductionSuite();
