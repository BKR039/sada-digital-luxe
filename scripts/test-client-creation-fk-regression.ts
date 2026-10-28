import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load environment variables
const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[m[1]] = val;
    process.env[m[1]] = val;
  }
});

import {
  resolveToProfileId,
  resolveToTeamMemberId,
  formatClientErrorMessage,
} from "../src/components/admin/project-utils";
import { determineCommissionRate, calculateDealCommission } from "../src/lib/sales-service";

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

async function runClientCreationRegressionSuite() {
  console.log("================================================================================");
  console.log("SADA OS — CLIENT CREATION & COMMISSION RECIPIENT FK REGRESSION SUITE");
  console.log("================================================================================");

  const client = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Authenticate as Super Admin
  console.log("\n0. Authenticating as Super Admin...");
  const { error: authErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);
  console.log("✅ Authenticated as Super Admin");

  // Load team members and profiles
  const { data: teamMembers, error: tmErr } = await client
    .from("team_members")
    .select("id, name, role, position, profile_id, user_id, is_active");
  if (tmErr) throw tmErr;

  const { data: profiles, error: profErr } = await client
    .from("profiles")
    .select("id, display_name");
  if (profErr) throw profErr;

  console.log(`Loaded ${teamMembers?.length || 0} team members and ${profiles?.length || 0} profiles.`);

  // Find Maya Trabelsi and Boubakar Hamed
  const maya = teamMembers?.find((m) => m.name.toLowerCase().includes("maya"));
  const boubakar = teamMembers?.find((m) => m.name.toLowerCase().includes("boubakar"));

  if (!maya) throw new Error("Maya Trabelsi not found in team_members!");
  if (!boubakar) throw new Error("Boubakar Hamed not found in team_members!");

  console.log("\n--- Team Member Test Entities ---");
  console.log("Maya Trabelsi:", {
    team_member_id: maya.id,
    profile_id: maya.profile_id,
    user_id: maya.user_id,
  });
  console.log("Boubakar Hamed:", {
    team_member_id: boubakar.id,
    profile_id: boubakar.profile_id,
    user_id: boubakar.user_id,
  });

  // Verify that maya.id !== maya.profile_id (this was the exact condition that triggered the bug!)
  console.log(`Maya's team_member_id !== profile_id: ${maya.id !== maya.profile_id}`);

  // ---------------------------------------------------------------------------
  // TEST 1: The Exact Reported Form Submission ("panneaux solaire")
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 1] Creating the exact reported client: 'panneaux solaire'...");

  // Simulate UI resolution with Maya Trabelsi as Sales Owner
  const rawSelectedSalesOwner = maya.profile_id || maya.id;
  const rawSelectedAccountManager = boubakar.profile_id || boubakar.id;

  const resolvedAccountManager = resolveToProfileId(rawSelectedAccountManager, teamMembers, profiles);
  const resolvedSalesOwner = resolveToProfileId(rawSelectedSalesOwner, teamMembers, profiles);
  const resolvedCommissionRecipient = resolveToTeamMemberId(rawSelectedSalesOwner, teamMembers);

  console.log("Resolution check for Panneaux Solaire:");
  console.log("  - resolvedAccountManager (profile_id):", resolvedAccountManager);
  console.log("  - resolvedSalesOwner (profile_id):", resolvedSalesOwner);
  console.log("  - resolvedCommissionRecipient (team_members.id):", resolvedCommissionRecipient);

  if (resolvedCommissionRecipient !== maya.id) {
    throw new Error(`Expected resolvedCommissionRecipient to be Maya's team_members.id (${maya.id}), got ${resolvedCommissionRecipient}`);
  }

  const clientPayload = {
    name: "panneaux solaire (Regression Test)",
    client_type: "monthly",
    industry: "Solar Energy",
    contact_name: "hamdi ben hamad",
    email: "hamdi@sunpower.tn",
    phone: "5222541",
    preferred_channel: "whatsapp",
    status: "active",
    package_name: "[CUS-01] Build Your Package",
    package_config: {
      reels_quota: 6,
      posts_quota: 6,
      stories_quota: 20,
      other_services: ["Meta Ads", "Brand Strategy", "Copywriting", "Website Maintenance", "SEO"],
    },
    billing_start_date: "2026-10-10",
    current_period_month: "2026-10",
    relationship_owner_id: resolvedAccountManager,
    account_manager_id: resolvedAccountManager,
    sales_owner_id: resolvedSalesOwner,
    commission_recipient_id: resolvedCommissionRecipient,
    monthly_package_price: 2150,
    default_service_fee: 2150,
    default_sponsoring_budget: 1500,
  };

  const { data: createdClient, error: createErr } = await (client as any)
    .from("clients")
    .insert(clientPayload)
    .select("*")
    .single();

  if (createErr) {
    throw new Error(`TEST 1 FAILED! Database rejected client creation: ${createErr.message}`);
  }

  console.log("✅ Client 'panneaux solaire' created successfully!");
  console.log("Created client database row:", {
    id: createdClient.id,
    name: createdClient.name,
    account_manager_id: createdClient.account_manager_id,
    sales_owner_id: createdClient.sales_owner_id,
    commission_recipient_id: createdClient.commission_recipient_id,
    monthly_package_price: createdClient.monthly_package_price,
    default_sponsoring_budget: createdClient.default_sponsoring_budget,
  });

  // Verify that commission_recipient_id is verified against team_members
  const { data: verifiedTM } = await client
    .from("team_members")
    .select("id, name")
    .eq("id", createdClient.commission_recipient_id)
    .single();

  if (!verifiedTM || verifiedTM.id !== maya.id) {
    throw new Error("Created client's commission_recipient_id does not match Maya's team member record!");
  }
  console.log("✅ FK constraint satisfied! Referenced team member verified:", verifiedTM.name);

  // ---------------------------------------------------------------------------
  // TEST 2 (Requirement 5.B): Create client with a DIFFERENT Sales Owner
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] Creating client with a DIFFERENT Sales Owner (Boubakar as Sales Owner)...");
  const diffSalesOwner = resolveToProfileId(boubakar.id, teamMembers, profiles);
  const diffCommissionRecipient = resolveToTeamMemberId(boubakar.id, teamMembers);

  const { data: clientDiff, error: diffErr } = await (client as any)
    .from("clients")
    .insert({
      name: "Different Sales Owner Client",
      client_type: "monthly",
      status: "active",
      sales_owner_id: diffSalesOwner,
      commission_recipient_id: diffCommissionRecipient,
      monthly_package_price: 1800,
      default_service_fee: 1800,
      default_sponsoring_budget: 600,
    })
    .select("*")
    .single();

  if (diffErr) throw new Error(`TEST 2 FAILED: ${diffErr.message}`);
  if (clientDiff.commission_recipient_id !== boubakar.id) {
    throw new Error("Commission recipient ID mismatch for Boubakar!");
  }
  console.log("✅ Client created with different sales owner. Recipient ID:", clientDiff.commission_recipient_id);

  // ---------------------------------------------------------------------------
  // TEST 3 (Requirement 5.C): Create client with NO Sales Owner (null recipient)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 3] Creating client with NO Sales Owner (null recipient)...");
  const { data: clientNoSales, error: noSalesErr } = await (client as any)
    .from("clients")
    .insert({
      name: "No Sales Owner Client",
      client_type: "one_off",
      status: "active",
      sales_owner_id: null,
      commission_recipient_id: null,
      monthly_package_price: 1200,
      default_service_fee: 1200,
      default_sponsoring_budget: 0,
    })
    .select("*")
    .single();

  if (noSalesErr) throw new Error(`TEST 3 FAILED: ${noSalesErr.message}`);
  if (clientNoSales.commission_recipient_id !== null) {
    throw new Error("Expected commission_recipient_id to be null!");
  }
  console.log("✅ Client created with NO Sales Owner. commission_recipient_id is cleanly NULL.");

  // ---------------------------------------------------------------------------
  // TEST 4 (Requirement 5.D & 5.E): Edit client and change Sales Owner
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 4] Editing client 'panneaux solaire' to change Sales Owner from Maya to Boubakar...");
  const newSalesOwnerProfile = resolveToProfileId(boubakar.id, teamMembers, profiles);
  const newSalesOwnerTM = resolveToTeamMemberId(boubakar.id, teamMembers);

  const { data: updatedClient, error: updateErr } = await (client as any)
    .from("clients")
    .update({
      sales_owner_id: newSalesOwnerProfile,
      commission_recipient_id: newSalesOwnerTM,
    })
    .eq("id", createdClient.id)
    .select("*")
    .single();

  if (updateErr) throw new Error(`TEST 4 FAILED: ${updateErr.message}`);
  if (updatedClient.commission_recipient_id !== boubakar.id) {
    throw new Error("Commission recipient was not updated correctly!");
  }
  console.log("✅ Client updated successfully! New commission_recipient_id:", updatedClient.commission_recipient_id);

  // Test re-opening and resolving Sales Owner in UI
  const reloadedRecipientTM = resolveToTeamMemberId(updatedClient.commission_recipient_id, teamMembers);
  if (reloadedRecipientTM !== boubakar.id) {
    throw new Error("Re-opening client failed to resolve Sales Owner to team member!");
  }
  console.log("✅ Re-opened client correctly resolves Sales Owner in UI dropdown to:", reloadedRecipientTM);

  // ---------------------------------------------------------------------------
  // TEST 5 (Requirement 6): Financial & Commission Calculation Integrity
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing Financial Commission Calculation with resolved recipient...");
  const rateResult = determineCommissionRate({
    dealType: "initial",
    billingStartDate: createdClient.billing_start_date,
    periodMonth: "2026-10",
  });

  const commResult = calculateDealCommission({
    serviceRevenue: Number(createdClient.default_service_fee),
    sponsoringBudget: Number(createdClient.default_sponsoring_budget),
    commissionRate: rateResult.rate,
    dealType: "initial",
    billingStartDate: createdClient.billing_start_date,
    periodMonth: "2026-10",
    invoiceStatus: "paid",
  });

  console.log("Commission calculation result:", {
    serviceRevenue: commResult.serviceRevenue,
    sponsoringBudget: commResult.sponsoringBudget,
    rate: commResult.commissionRate,
    commissionAmount: commResult.commissionAmount,
    status: commResult.status,
  });

  // Verify: Service Revenue = 2150, Sponsoring = 1500 strictly EXCLUDED
  // Rate = 15%, Commission = 2150 * 0.15 = 322.500 TND
  if (commResult.serviceRevenue !== 2150) throw new Error("Service revenue mismatch!");
  if (commResult.commissionAmount !== 322.5) {
    throw new Error(`Expected commission 322.5, got ${commResult.commissionAmount}`);
  }
  console.log("✅ Financial OS Invariant Verified: Commission applies ONLY to Service Revenue (322.500 TND), Sponsoring (1500 TND) is strictly excluded!");

  // ---------------------------------------------------------------------------
  // TEST 6 (Requirement 7): Error Handling for Invalid/Nonexistent Sales Owner
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 6] Testing Error Handling for invalid/nonexistent Sales Owner...");
  const invalidId = "00000000-0000-0000-0000-000000000000";
  const invalidRecipient = resolveToTeamMemberId(invalidId, teamMembers);
  console.log("resolveToTeamMemberId for invalid ID returned:", invalidRecipient);

  if (invalidRecipient !== null) {
    throw new Error("Expected null for invalid team member ID!");
  }

  // Simulate a direct raw FK error formatting
  const mockFkError = {
    message: 'insert or update on table "clients" violates foreign key constraint "clients_commission_recipient_id_fkey"',
  };
  const formattedError = formatClientErrorMessage(mockFkError);
  console.log("Raw DB error:", mockFkError.message);
  console.log("Sanitized UI error:", formattedError);

  if (formattedError.includes("foreign key") || formattedError.includes("clients_commission_recipient_id_fkey")) {
    throw new Error("Raw PostgreSQL error was not sanitized!");
  }
  if (!formattedError.includes("Selected Sales Owner is no longer available")) {
    throw new Error(`Unexpected formatted error message: ${formattedError}`);
  }
  console.log("✅ Error handling verified: Raw PostgreSQL error is transformed into user-friendly message.");

  // Clean up test clients
  await client.from("clients").delete().in("id", [createdClient.id, clientDiff.id, clientNoSales.id]);
  console.log("\nCleaned up test client rows.");

  console.log("\n================================================================================");
  console.log("ALL 6 REGRESSION TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runClientCreationRegressionSuite().catch((err) => {
  console.error("FATAL REGRESSION SUITE ERROR:", err);
  process.exit(1);
});
