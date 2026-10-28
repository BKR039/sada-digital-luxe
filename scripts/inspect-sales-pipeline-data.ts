import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  console.log("=== SADA SALES PIPELINE LIVE DATA INSPECTION ===");
  const authRes = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authRes.error) {
    console.error("Auth error:", authRes.error);
    process.exit(1);
  }

  // 1. Fetch all deals
  const { data: deals, error: dealsErr } = await client
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });

  if (dealsErr) {
    console.error("Error fetching deals:", dealsErr);
  } else {
    console.log(`\nTotal deals in DB: ${deals?.length || 0}`);
    console.log("Deals by stage:");
    const stages: Record<string, number> = {};
    deals?.forEach((d) => {
      stages[d.stage] = (stages[d.stage] || 0) + 1;
    });
    console.table(stages);

    console.log("\nDeals Summary List:");
    console.table(
      deals?.map((d) => ({
        id: d.id.slice(0, 8),
        title: d.title,
        company: d.company,
        stage: d.stage,
        deal_value: d.deal_value,
        service_rev: d.service_revenue,
        sponsoring: d.sponsoring_budget,
        comm_rate: d.commission_rate,
        assigned_to: d.assigned_to ? d.assigned_to.slice(0, 8) : "None",
        client_id: d.client_id ? d.client_id.slice(0, 8) : "None",
        package_id: d.package_id ? d.package_id.slice(0, 8) : "None",
        created_at: d.created_at?.slice(0, 19),
      }))
    );
  }

  // 2. Fetch all sales commissions
  const { data: comms, error: commsErr } = await client
    .from("sales_commissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (commsErr) {
    console.error("Error fetching sales_commissions:", commsErr);
  } else {
    console.log(`\nTotal sales_commissions in DB: ${comms?.length || 0}`);
    console.table(
      comms?.map((c) => ({
        id: c.id.slice(0, 8),
        deal_id: c.deal_id ? c.deal_id.slice(0, 8) : "None",
        salesperson_id: c.salesperson_id ? c.salesperson_id.slice(0, 8) : "None",
        client_id: c.client_id ? c.client_id.slice(0, 8) : "None",
        deal_value: c.total_sale_amount,
        service_rev: c.service_revenue,
        sponsoring: c.sponsoring_amount,
        rate: c.commission_rate,
        comm_amount: c.commission_amount,
        status: c.status,
        created_at: c.created_at?.slice(0, 19),
      }))
    );
  }

  // 3. Fetch commission business rules
  const { data: rules, error: rulesErr } = await client
    .from("business_rules")
    .select("*")
    .ilike("rule_key", "%commiss%");

  console.log(`\nCommission Business Rules:`);
  console.table(
    rules?.map((r) => ({
      key: r.rule_key,
      name: r.name,
      val: JSON.stringify(r.rule_value),
      active: r.is_active,
      updated_at: r.updated_at,
    }))
  );

  // 4. Duplicate Investigation
  console.log("\n=== DUPLICATE & QA RECORD INVESTIGATION ===");
  // Look for Audit Enterprise or Phase1 Protected Client
  const auditEnterpriseDeals = deals?.filter(
    (d) => (d.title && d.title.includes("Audit Enterprise")) || (d.company && d.company.includes("Audit Enterprise"))
  );
  console.log(`'Audit Enterprise' deals count: ${auditEnterpriseDeals?.length || 0}`);
  auditEnterpriseDeals?.forEach((d) => console.log("Deal:", d.id, d.title, d.company, d.stage, d.created_at));

  const protectedDeals = deals?.filter(
    (d) =>
      (d.title && d.title.toLowerCase().includes("protected")) ||
      (d.company && d.company.toLowerCase().includes("protected")) ||
      (d.title && d.title.toLowerCase().includes("phase1")) ||
      (d.company && d.company.toLowerCase().includes("phase1"))
  );
  console.log(`'Protected / Phase1' deals count: ${protectedDeals?.length || 0}`);
  protectedDeals?.forEach((d) => console.log("Deal:", d.id, d.title, d.company, d.stage, d.created_at));

  // Check for duplicate titles or companies in deals
  const titleCounts: Record<string, number> = {};
  deals?.forEach((d) => {
    const key = `${d.title} | ${d.company}`;
    titleCounts[key] = (titleCounts[key] || 0) + 1;
  });
  const dupTitles = Object.entries(titleCounts).filter(([_, count]) => count > 1);
  console.log("\nRepeated Deal Titles/Companies:", dupTitles);

  // Check commission duplicates
  const commDealCounts: Record<string, number> = {};
  comms?.forEach((c) => {
    if (c.deal_id) {
      commDealCounts[c.deal_id] = (commDealCounts[c.deal_id] || 0) + 1;
    }
  });
  const dupCommDeals = Object.entries(commDealCounts).filter(([_, count]) => count > 1);
  console.log("Deals with multiple commission records:", dupCommDeals);

  // 5. Calculate KPI Metrics directly from deals and commissions
  console.log("\n=== LIVE KPI COMPUTATION ===");
  const activePipelineStages = ["lead", "contacted", "meeting", "proposal", "negotiation"];
  const wonStages = ["won"];
  const lostStages = ["lost"];

  const activeDeals = deals?.filter((d) => activePipelineStages.includes(d.stage)) || [];
  const wonDeals = deals?.filter((d) => wonStages.includes(d.stage)) || [];
  const lostDeals = deals?.filter((d) => lostStages.includes(d.stage)) || [];
  const totalLeads = deals?.length || 0;

  const pipelineValue = activeDeals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
  const wonRevenue = wonDeals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
  const winRate =
    wonDeals.length + lostDeals.length > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
      : 0;

  // Commissions
  const pendingComms = comms?.filter((c) => c.status === "pending" || c.status === "approved") || [];
  const disbursedComms = comms?.filter((c) => c.status === "paid") || [];
  const pendingLiability = pendingComms.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
  const disbursedAmount = disbursedComms.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
  const totalEarned = (comms || []).reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);

  console.log({
    totalLeads,
    activePipelineCount: activeDeals.length,
    wonCount: wonDeals.length,
    lostCount: lostDeals.length,
    winRate: `${winRate}%`,
    pipelineValue: `${pipelineValue} TND`,
    wonRevenue: `${wonRevenue} TND`,
    pendingLiability: `${pendingLiability} TND`,
    disbursedComms: `${disbursedAmount} TND`,
    totalEarned: `${totalEarned} TND`,
  });

  // 6. Check Worker Performance matrix calculation
  console.log("\n=== WORKER ATTRIBUTIONS ===");
  const workerAttribution: Record<string, { total: number; won: number; lost: number; pipeline: number; revenue: number; comms: number }> = {};
  deals?.forEach((d) => {
    const user = d.assigned_to || "unassigned";
    if (!workerAttribution[user]) {
      workerAttribution[user] = { total: 0, won: 0, lost: 0, pipeline: 0, revenue: 0, comms: 0 };
    }
    workerAttribution[user].total++;
    if (activePipelineStages.includes(d.stage)) {
      workerAttribution[user].pipeline += Number(d.deal_value) || 0;
    }
    if (d.stage === "won") {
      workerAttribution[user].won++;
      workerAttribution[user].revenue += Number(d.deal_value) || 0;
    }
    if (d.stage === "lost") {
      workerAttribution[user].lost++;
    }
  });

  comms?.forEach((c) => {
    const user = c.salesperson_id || "unassigned";
    if (workerAttribution[user]) {
      workerAttribution[user].comms += Number(c.commission_amount) || 0;
    }
  });

  console.table(workerAttribution);
}

main().catch(console.error);
