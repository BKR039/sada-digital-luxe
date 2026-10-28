// ============================================================
// SADA OS — PHASE 7: MANAGEMENT ANALYTICS & REPORTING SERVICE
// Authoritative Financial OS calculation layer as single source of truth.
// Zero second analytics engine. Pure deterministic derivation.
// Powers: Client, Package, Service, Employee, Sales, Production,
// Monthly P&L, Cash Flow, Commission, and Revenue Trends.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { fetchCompanyFinance, getPresetPeriod, isInvoiceOverdue } from "@/lib/finance-service";
import { assertAuthorizedMutation } from "@/lib/security-isolation-service";
import type { PermissionContext } from "@/lib/permissions";
import type {
  FinancialPeriod,
  ClientProfitabilityRecord,
} from "@/types/finance";
import { formatCurrency } from "@/types/finance";
import type {
  ClientProfitabilityItem,
  PackageProfitabilityItem,
  ServiceProfitabilityItem,
  EmployeePerformanceItem,
  SalesPerformanceReport,
  ProductionPerformanceReport,
  MonthlyPnLStatement,
  CashFlowReport,
  CommissionPerformanceReport,
  RevenueTrendItem,
  AnalyticsFilterState,
  AnalyticsDrillDownState,
  AnalyticsDrillDownSourceRecord,
  ExecutiveBriefingItem,
  ExecutiveCommandStripData,
  OperationsIntelligenceData,
  FullManagementAnalyticsData,
} from "@/types/notifications-and-audit";
import { format, parseISO, subMonths, subDays } from "date-fns";

import { isTaskOverdue } from "@/components/admin/project-utils";

export type { FullManagementAnalyticsData };

export interface ManagementAnalyticsPreloadedData {
  tasks?: any[];
  projects?: any[];
  teamMembers?: any[];
  deals?: any[];
}

export interface ManagementAnalyticsOptions {
  ctx?: PermissionContext;
  preloadedData?: ManagementAnalyticsPreloadedData;
}

// ============================================================
// 1. FETCH FULL MANAGEMENT ANALYTICS
// ============================================================

export async function fetchManagementAnalytics(
  filters: AnalyticsFilterState,
  ctxOrOptions?: PermissionContext | ManagementAnalyticsOptions,
  maybeOptions?: ManagementAnalyticsOptions
): Promise<FullManagementAnalyticsData> {
  const options: ManagementAnalyticsOptions =
    maybeOptions ??
    (ctxOrOptions && ("preloadedData" in ctxOrOptions || "ctx" in ctxOrOptions)
      ? (ctxOrOptions as ManagementAnalyticsOptions)
      : { ctx: ctxOrOptions as PermissionContext | undefined });

  const ctx = options.ctx;
  const preloaded = options.preloadedData;

  await assertAuthorizedMutation(supabase, "analytics", "analytics.view", { ctx });
  const period = getPresetPeriod(filters.periodType, filters.customStartDate, filters.customEndDate);

  // Parallel fetch: Canonical Financial State + Operational Data (skipping preloaded datasets to eliminate redundant queries)
  const [
    financeState,
    packagesRes,
    tasksRes,
    workSessionsRes,
    teamMembersRes,
    dealsRes,
    bookingsRes,
    deliverablesRes,
    projectsRes,
  ] = await Promise.all([
    fetchCompanyFinance(period, ctx, { allowAnalyticsRead: true }),
    (supabase as any).from("package_catalog").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    preloaded?.tasks
      ? Promise.resolve({ data: preloaded.tasks, error: null })
      : (supabase as any).from("project_tasks").select("*, client:clients(name), project:client_projects(title)"),
    (supabase as any).from("work_sessions").select("*, client:clients(name), project:client_projects(title), team_member:team_members(name)"),
    preloaded?.teamMembers
      ? Promise.resolve({ data: preloaded.teamMembers, error: null })
      : (supabase as any).from("team_members").select("*, salary_records(*)"),
    preloaded?.deals
      ? Promise.resolve({ data: preloaded.deals, error: null })
      : (supabase as any).from("deals").select("*, client:clients(name), package:package_catalog(name)"),
    (supabase as any).from("production_bookings").select("*, client:clients(name)"),
    (supabase as any).from("client_deliverables").select("*, client:clients(name)"),
    preloaded?.projects
      ? Promise.resolve({ data: preloaded.projects, error: null })
      : (supabase as any).from("client_projects").select("id, title, client_id, status"),
  ]);

  const rawPackages: any[] = (packagesRes.data || []).map((p: any) => ({
    ...p,
    selling_price: Number(p.price) || 0,
  }));
  const rawTasks: any[] = tasksRes.data || [];
  const allSessions: any[] = workSessionsRes.data || [];
  // Strictly filter work sessions to the active reporting period for accurate hourly & labor cost attribution
  const rawSessions: any[] = allSessions.filter((s: any) => {
    const sDate = s.started_at ? s.started_at.split("T")[0] : s.created_at ? s.created_at.split("T")[0] : null;
    if (!sDate) return true;
    return sDate >= period.startDate && sDate <= period.endDate;
  });
  const rawTeamMembers: any[] = teamMembersRes.data || [];
  const rawDeals: any[] = dealsRes.data || [];
  const rawBookings: any[] = bookingsRes.data || [];
  const rawDeliverables: any[] = deliverablesRes.data || [];
  const rawProjects: any[] = projectsRes.data || [];

  // ------------------------------------------------------------
  // 1. CLIENT PROFITABILITY (Canonical Financial OS formula)
  // Revenue - Direct Costs - Sponsoring Cost - Sales Commission = Contribution Profit
  // ------------------------------------------------------------
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const clientProfitability: ClientProfitabilityItem[] = financeState.clientProfitability.map((cp: ClientProfitabilityRecord) => {
    // Client-specific tasks and hours
    const cTasks = rawTasks.filter((t) => t.client_id === cp.clientId);
    const cSessions = rawSessions.filter((s) => s.client_id === cp.clientId);
    const actualHours = Math.round(
      (cSessions.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0) / 60) * 10
    ) / 10;

    // Delivery health based on real client tasks
    const clientOverdueTasks = cTasks.filter((t) => isTaskOverdue(t));
    const overdueTasksCount = clientOverdueTasks.length;
    let deliveryHealth: "ON_TRACK" | "AT_RISK" | "DELAYED" = "ON_TRACK";
    if (overdueTasksCount > 1) {
      deliveryHealth = "DELAYED";
    } else if (overdueTasksCount === 1 || cTasks.some((t) => t.status === "blocked")) {
      deliveryHealth = "AT_RISK";
    }

    // Payment risk based on invoice overdue/pending status
    let paymentRisk: "LOW" | "MODERATE" | "HIGH" = "LOW";
    if (cp.paymentStatus === "OVERDUE") {
      paymentRisk = "HIGH";
    } else if (cp.paymentStatus === "PENDING") {
      paymentRisk = "MODERATE";
    }

    // Invoices issued for this client in the period
    const clientInvoices = financeState.invoices.filter((i: any) => i.clientId === cp.clientId);
    const invoicedRevenue = clientInvoices.reduce((sum: number, i: any) => sum + Number(i.totalAmount || 0), 0);

    // Cost data completeness check:
    // If a client has tasks/work sessions but 0 direct cost recorded, flag incomplete
    const costCompleteness: "complete" | "incomplete" =
      (cTasks.length > 0 || cSessions.length > 0) && cp.directCost === 0 && cp.sponsoringCost === 0
        ? "incomplete"
        : "complete";

    // Profitability Score (0-100) based on margin % and absolute contribution profit
    const normalizedMarginScore = Math.min(50, Math.max(0, (cp.marginPercent / 100) * 50));
    const normalizedProfitScore = Math.min(50, Math.max(0, (cp.contributionProfit / 2000) * 50));
    const profitabilityScore = Math.round(normalizedMarginScore + normalizedProfitScore);

    return {
      clientId: cp.clientId,
      clientName: cp.clientName,
      status: (cp as any).status || "active",
      industry: cp.industry || "General Agency",
      packageTitle: cp.monthlyPackage > 0 ? `${cp.monthlyPackage} TND Retainer` : "Custom Scope",
      revenue: cp.totalRevenue, // strictly collected in period
      invoicedRevenue,
      collectedRevenue: cp.totalRevenue,
      contractedRevenue: (cp as any).status === "archived" || (cp as any).status === "inactive" ? 0 : cp.monthlyPackage,
      costCompleteness,
      directCosts: cp.directCost,
      sponsoringCost: cp.sponsoringCost,
      salesCommission: cp.commission,
      contributionProfit: cp.contributionProfit,
      profitMarginPercent: Math.round(cp.marginPercent * 10) / 10,
      profitabilityScore,
      health: cp.health,
      paymentStatus: cp.paymentStatus,
      deliveryHealth,
      paymentRisk,
      overdueTasksCount,
      invoicesCount: clientInvoices.length,
      tasksCount: cTasks.length,
      actualHours,
    };
  });

  // Calculate unallocated vs client-attributed revenue for strict reconciliation
  const allReceivedInflows = financeState.ledgerTransactions.filter(
    (t: any) => t.direction === "inflow" && t.status === "received"
  );
  const knownClientIds = new Set(financeState.clientProfitability.map((c: any) => c.clientId));
  const unallocatedInflows = allReceivedInflows.filter((t: any) => !t.clientId || !knownClientIds.has(t.clientId));
  const unallocatedRevenue = unallocatedInflows.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const clientAttributedRevenue = clientProfitability.reduce((sum, c) => sum + c.revenue, 0);

  // If there are unallocated inflows in the period, add explicit reconciliation row
  if (unallocatedRevenue > 0) {
    clientProfitability.push({
      clientId: "unallocated-general-agency",
      clientName: "General / Direct Agency Inflows",
      industry: "Direct Agency",
      packageTitle: "Unallocated Retainers / Inflows",
      revenue: unallocatedRevenue,
      invoicedRevenue: 0,
      collectedRevenue: unallocatedRevenue,
      contractedRevenue: 0,
      costCompleteness: "complete",
      directCosts: 0,
      sponsoringCost: 0,
      salesCommission: 0,
      contributionProfit: unallocatedRevenue,
      profitMarginPercent: 100,
      profitabilityScore: 100,
      health: "HIGH PROFIT",
      paymentStatus: "PAID",
      deliveryHealth: "ON_TRACK",
      paymentRisk: "LOW",
      overdueTasksCount: 0,
      invoicesCount: 0,
      tasksCount: 0,
      actualHours: 0,
    });
  }

  // Filter clients if requested
  const filteredClientProf = filters.clientId
    ? clientProfitability.filter((c) => c.clientId === filters.clientId)
    : clientProfitability;

  // ------------------------------------------------------------
  // 2. PACKAGE PROFITABILITY (From canonical packages & active client subscriptions)
  // Selling Price - Employee Cost - Freelancer - Transport - Subscriptions - Commission = Gross Profit
  // With strict incomplete cost data protection!
  // ------------------------------------------------------------
  const packageProfitability: PackageProfitabilityItem[] = rawPackages.map((pkg: any) => {
    // Match deals where stage is won and package matches
    const matchingDeals = rawDeals.filter(
      (d) => d.stage === "won" && (d.package_id === pkg.id || d.package?.name === pkg.name)
    );

    // Find subscribed clients
    const activeSubscribers = financeState.clientProfitability.filter((c: any) => {
      const hasDeal = matchingDeals.some((d) => d.client_id === c.clientId);
      return hasDeal || (Number(pkg.selling_price) > 0 && c.monthlyPackage === Number(pkg.selling_price) && matchingDeals.length === 0);
    });

    const activeSubscriptionsCount = activeSubscribers.length;
    const totalVolumeRevenue = activeSubscriptionsCount * Number(pkg.selling_price || 0);

    const subscribersList = activeSubscribers.map((c: any) => ({
      clientId: c.clientId,
      clientName: c.clientName,
    }));

    // Target vs actual production hours
    const targetHours = Number(pkg.production_hours || 20);
    const packageSessions = rawSessions.filter((s) => {
      return activeSubscribers.some((c: any) => c.clientId === s.client_id);
    });
    const actualProductionHours = Math.round(
      (packageSessions.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0) / 60) * 10
    ) / 10;

    const empCost = Number(pkg.employee_cost || 0);
    const freeCost = Number(pkg.freelancer_cost || 0);
    const transCost = Number(pkg.transport_cost || 0);
    const subCost = Number(pkg.subscription_allocation || 0);
    const commCost = Number(pkg.commission || 0);
    const totalUnitCost = empCost + freeCost + transCost + subCost + commCost;
    const hasRecordedCosts = totalUnitCost > 0;
    const sellingPrice = Number(pkg.selling_price || 0);

    const grossProfit = sellingPrice - totalUnitCost;
    // CRITICAL REQUIREMENT: Do NOT award 100% margin if cost data is zero / missing!
    const grossMarginPercent = hasRecordedCosts && sellingPrice > 0
      ? Math.round((grossProfit / sellingPrice) * 1000) / 10
      : null;

    const isIncompleteCostData = !hasRecordedCosts && sellingPrice > 0;
    const unrecordedCostNotice = isIncompleteCostData
      ? "Cost components unrecorded in catalog"
      : undefined;

    return {
      packageId: pkg.id,
      name: pkg.name,
      tier: pkg.tier || "Standard",
      sellingPrice,
      employeeCost: empCost,
      freelancerCost: freeCost,
      transportCost: transCost,
      subscriptionAllocation: subCost,
      commission: commCost,
      otherDirectCosts: 0,
      grossProfit: hasRecordedCosts ? grossProfit : 0,
      grossMarginPercent,
      activeSubscriptionsCount,
      totalVolumeRevenue,
      targetProductionHours: targetHours,
      actualProductionHours,
      isIncompleteCostData,
      unrecordedCostNotice,
      subscribersList,
    };
  });

  // ------------------------------------------------------------
  // 3. SERVICE PROFITABILITY
  // Categorized by core agency capabilities using authoritative facts
  // ------------------------------------------------------------
  const serviceCategories = [
    { name: "Content & Reel Production", key: "production" },
    { name: "Brand Identity & Strategy", key: "branding" },
    { name: "Web & Digital Platforms", key: "web" },
    { name: "Media Buying & Sponsoring", key: "sponsoring" },
    { name: "Social Media Management", key: "social" },
  ];

  const serviceProfitability: ServiceProfitabilityItem[] = serviceCategories.map((svc) => {
    let serviceRevenue = 0;
    let directLaborCost = 0;
    let allocatedExpenses = 0;
    let activeProjects = 0;

    if (svc.key === "sponsoring") {
      serviceRevenue = financeState.kpis.sponsoringCollected;
      allocatedExpenses = financeState.kpis.sponsoringPurchasesCost;
      activeProjects = financeState.sponsoringCampaigns.length;
    } else {
      // Find matching projects & tasks by category
      const matchedProjects = rawProjects.filter((p) => p.category?.toLowerCase().includes(svc.key));
      activeProjects = matchedProjects.length;

      const matchedProjectIds = new Set(matchedProjects.map((p) => p.id));
      const matchedSessions = rawSessions.filter((s) =>
        s.session_type === svc.key || matchedProjectIds.has(s.project_id)
      );

      directLaborCost = matchedSessions.reduce((sum, s) => sum + Number(s.labor_cost || 0), 0);

      // Distribute verified client services revenue across categories proportionally to active engagements
      const totalEngagementCount = Math.max(1, rawProjects.length);
      const engagementShare = activeProjects > 0 ? activeProjects / totalEngagementCount : 0.2;
      serviceRevenue = Math.round(financeState.kpis.clientServicesRevenue * engagementShare);

      // Allocated share of general operational overhead
      allocatedExpenses = Math.round(financeState.kpis.operatingExpenses * (engagementShare * 0.5));
    }

    const totalDirectCosts = directLaborCost + allocatedExpenses;
    const contributionMargin = serviceRevenue - totalDirectCosts;
    const marginPercent = serviceRevenue > 0 ? Math.round((contributionMargin / serviceRevenue) * 1000) / 10 : 0;

    return {
      serviceName: svc.name,
      serviceRevenue,
      directLaborCost,
      allocatedExpenses,
      totalDirectCosts,
      contributionMargin,
      marginPercent,
      activeProjectsCount: activeProjects,
    };
  });

  // ------------------------------------------------------------
  // 4. EMPLOYEE PERFORMANCE
  // Assigned tasks, completed tasks, overdue tasks, actual vs estimated hours, completion rate
  // ------------------------------------------------------------
  const employeePerformance: EmployeePerformanceItem[] = rawTeamMembers.map((member: any) => {
    const memberTasks = rawTasks.filter(
      (t) => t.assignee_id === member.id || t.assignee_id === member.profile_id
    );
    const assignedTasks = memberTasks.length;
    const completedTasks = memberTasks.filter(
      (t) => t.status === "done" || t.status === "delivered" || t.status === "approved"
    ).length;
    const overdueTasks = memberTasks.filter((t) => isTaskOverdue(t)).length;

    const memberSessions = rawSessions.filter(
      (s) => s.team_member_id === member.id || s.profile_id === member.profile_id
    );
    const actualHours = Math.round(
      (memberSessions.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0) / 60) * 10
    ) / 10;
    const estimatedHours = Math.round(
      memberTasks.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0) * 10
    ) / 10;

    const completionRatePercent = assignedTasks > 0 ? Math.round((completedTasks / assignedTasks) * 100) : 100;
    const hoursVariancePercent = estimatedHours > 0
      ? Math.round(((actualHours - estimatedHours) / estimatedHours) * 100)
      : 0;

    const salRecord = Array.isArray(member.salary_records) ? member.salary_records[0] : member.salary_records;
    const hourlyRate = salRecord?.hourly_rate
      ? Number(salRecord.hourly_rate)
      : salRecord?.base_amount
      ? Math.round((Number(salRecord.base_amount) / (Number(salRecord.standard_monthly_hours) || 160)) * 100) / 100
      : 0;

    const laborCostGenerated = Math.round(actualHours * hourlyRate * 100) / 100;

    const clientsWorkedSet = new Set(memberSessions.map((s) => s.client_id).filter(Boolean));
    const projectsWorkedSet = new Set(memberSessions.map((s) => s.project_id).filter(Boolean));

    return {
      teamMemberId: member.id,
      name: member.name,
      role: member.role || member.position || "Specialist",
      employmentType: member.employment_type || "full_time",
      hourlyRate,
      assignedTasks,
      completedTasks,
      overdueTasks,
      actualHours,
      estimatedHours,
      completionRatePercent,
      hoursVariancePercent,
      laborCostGenerated,
      clientsWorkedCount: clientsWorkedSet.size,
      projectsWorkedCount: projectsWorkedSet.size,
    };
  });

  const filteredEmployeePerf = filters.employeeId
    ? employeePerformance.filter((e) => e.teamMemberId === filters.employeeId)
    : employeePerformance;

  // ------------------------------------------------------------
  // 5. SALES PERFORMANCE
  // Leads, qualified leads, deals in progress, won, conversion, commissions
  // ------------------------------------------------------------
  const totalLeads = rawDeals.filter((d) => d.stage === "lead").length;
  const qualifiedLeads = rawDeals.filter((d) => d.stage === "qualified" || d.stage === "meeting" || d.stage === "proposal" || d.stage === "negotiation").length;
  const dealsInProgress = rawDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").length;
  const wonDeals = rawDeals.filter((d) => d.stage === "won").length;
  const lostDeals = rawDeals.filter((d) => d.stage === "lost").length;
  const closedDeals = wonDeals + lostDeals;
  const conversionRatePercent = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 1000) / 10 : 0;

  const wonPipelineRevenue = rawDeals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + Number(d.deal_value || (Number(d.service_fee || 0) + Number(d.sponsoring_budget || 0))), 0);

  const salesCommissionsAccrued = financeState.commissions.reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
  const averageDealSize = wonDeals > 0 ? Math.round(wonPipelineRevenue / wonDeals) : 0;

  const salesOwnersMap = new Map<string, { dealsWon: number; revenueWon: number; commissions: number; name: string }>();
  for (const d of rawDeals.filter((d) => d.stage === "won")) {
    const ownerId = d.sales_owner_id || "unassigned";
    const existing = salesOwnersMap.get(ownerId) || { dealsWon: 0, revenueWon: 0, commissions: 0, name: "Agency Sales" };
    existing.dealsWon++;
    existing.revenueWon += Number(d.deal_value || d.service_fee || 0);
    const comm = financeState.commissions.find((c: any) => c.clientId === d.client_id)?.commissionAmount || 0;
    existing.commissions += comm;
    salesOwnersMap.set(ownerId, existing);
  }

  const topSalesOwners = Array.from(salesOwnersMap.entries()).map(([teamMemberId, stat]) => ({
    teamMemberId,
    name: stat.name,
    dealsWon: stat.dealsWon,
    revenueWon: stat.revenueWon,
    commissions: stat.commissions,
  }));

  const salesPerformance: SalesPerformanceReport = {
    totalLeads,
    qualifiedLeads,
    dealsInProgress,
    wonDeals,
    lostDeals,
    conversionRatePercent,
    wonPipelineRevenue,
    salesCommissionsAccrued,
    averageDealSize,
    topSalesOwners,
  };

  // ------------------------------------------------------------
  // 6. PRODUCTION PERFORMANCE
  // Strict deterministic calculation from project_tasks and production_bookings
  // ------------------------------------------------------------
  const totalBookings = rawBookings.length;
  const completedShoots = rawBookings.filter((b) => b.status === "completed" || b.status === "delivered").length;
  const scheduledShoots = rawBookings.filter((b) => b.status === "scheduled" || b.status === "brief").length;
  const totalShootingHours = rawBookings.reduce((sum, b) => sum + Number(b.duration_hours || 4), 0);
  const totalEditingHours = Math.round(totalShootingHours * 2.5);

  // Compute on-time delivery rate from real tasks
  const completedTasksWithDeadline = rawTasks.filter((t) => (t.status === "done" || t.status === "delivered" || t.status === "approved") && t.deadline);
  const onTimeTasksCount = completedTasksWithDeadline.filter((t) => {
    if (!t.completed_at) return true; // on-time if marked completed
    return new Date(t.completed_at) <= new Date(t.deadline);
  }).length;
  const onTimeDeliveryRatePercent = completedTasksWithDeadline.length > 0
    ? Math.round((onTimeTasksCount / completedTasksWithDeadline.length) * 1000) / 10
    : 100;

  // Compute average turnaround days from completed tasks
  let turnaroundSumDays = 0;
  let turnaroundCount = 0;
  for (const t of completedTasksWithDeadline) {
    if (t.completed_at && t.created_at) {
      const days = Math.max(0.5, (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
      turnaroundSumDays += days;
      turnaroundCount++;
    }
  }
  const averageTurnaroundDays = turnaroundCount > 0 ? Math.round((turnaroundSumDays / turnaroundCount) * 10) / 10 : 3.5;

  const pipelineStagesBreakdown: Record<string, number> = {};
  for (const b of rawBookings) {
    const st = b.production_pipeline_status || b.status || "brief";
    pipelineStagesBreakdown[st] = (pipelineStagesBreakdown[st] || 0) + 1;
  }

  const productionPerformance: ProductionPerformanceReport = {
    totalBookings,
    completedShoots,
    scheduledShoots,
    totalShootingHours,
    totalEditingHours,
    onTimeDeliveryRatePercent,
    averageTurnaroundDays,
    pipelineStagesBreakdown,
  };

  // ------------------------------------------------------------
  // 7. MONTHLY P&L
  // Revenue - COGS = Gross Profit; Gross Profit - OpEx = Net Profit
  // ------------------------------------------------------------
  const directLaborCost = rawSessions
    .filter((s) => s.session_type === "production")
    .reduce((sum, s) => sum + Number(s.labor_cost || 0), 0);

  const cogsDirectCosts = directLaborCost + financeState.kpis.sponsoringPurchasesCost + financeState.kpis.salesCommissionsCost;
  const grossProfit = financeState.kpis.revenue - cogsDirectCosts;
  const grossMarginPercent = financeState.kpis.revenue > 0
    ? Math.round((grossProfit / financeState.kpis.revenue) * 1000) / 10
    : 0;

  const softwareSubscriptions = financeState.kpis.recurringBurn;
  const generalOverhead = Math.max(0, financeState.kpis.operatingExpenses - softwareSubscriptions);
  const operatingProfitEbitda = grossProfit - financeState.kpis.operatingExpenses;
  const netProfit = financeState.kpis.netProfit;
  const netMarginPercent = financeState.kpis.revenue > 0
    ? Math.round((netProfit / financeState.kpis.revenue) * 1000) / 10
    : 0;

  const monthlyPnL: MonthlyPnLStatement = {
    periodMonth: period.label,
    totalRevenue: financeState.kpis.revenue,
    clientServicesRevenue: financeState.kpis.clientServicesRevenue,
    sponsoringCollected: financeState.kpis.sponsoringCollected,
    otherRevenue: financeState.kpis.otherRevenue,
    cogsDirectCosts,
    directLaborCost,
    sponsoringPurchasesCost: financeState.kpis.sponsoringPurchasesCost,
    salesCommissionsCost: financeState.kpis.salesCommissionsCost,
    grossProfit,
    grossMarginPercent,
    operatingExpenses: financeState.kpis.operatingExpenses,
    softwareSubscriptions,
    generalOverhead,
    operatingProfitEbitda,
    netProfit,
    netMarginPercent,
    prevMonthNetProfit: financeState.kpis.prevNetProfit,
    momProfitGrowthPercent: financeState.kpis.profitDeltaPercent,
  };

  // ------------------------------------------------------------
  // 8. CASH FLOW
  // Cash Inflows, Cash Outflows, Net Movement, Cash at Bank, Outstanding
  // ------------------------------------------------------------
  const cashFlow: CashFlowReport = {
    cashInflows: financeState.kpis.revenue,
    cashOutflows: financeState.kpis.expenses,
    netCashFlow: financeState.kpis.revenue - financeState.kpis.expenses,
    currentCashAtBank: financeState.kpis.cash,
    outstandingInvoices: financeState.kpis.outstandingPayments,
    pendingSalaryAdvanceRequests: financeState.kpis.pendingSalaryRequestsTotal,
    accountBalances: financeState.accounts.map((a: any) => ({
      accountId: a.id,
      accountName: a.name,
      balance: a.currentBalance,
      currency: a.currency,
    })),
  };

  // ------------------------------------------------------------
  // 9. COMMISSION PERFORMANCE
  // Service Revenue Base, Sponsoring Excluded, Accrued, Approved, Paid, Outstanding
  // ------------------------------------------------------------
  const totalEligibleServiceRevenue = financeState.kpis.clientServicesRevenue;
  const sponsoringExcluded = financeState.kpis.sponsoringCollected;
  const totalCommissionsAccrued = financeState.commissions.reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
  const commissionsApproved = financeState.commissions
    .filter((c: any) => c.status === "approved")
    .reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
  const commissionsPaid = financeState.commissions
    .filter((c: any) => c.status === "paid")
    .reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
  const commissionsPending = financeState.commissions
    .filter((c: any) => c.status === "pending")
    .reduce((sum: number, c: any) => sum + c.commissionAmount, 0);

  const repCommissionsMap = new Map<string, { name: string; dealsCount: number; eligibleRevenue: number; commissionAmount: number; status: string }>();
  for (const c of financeState.commissions) {
    const existing = repCommissionsMap.get(c.teamMemberId) || {
      name: c.teamMemberName || "Sales Rep",
      dealsCount: 0,
      eligibleRevenue: 0,
      commissionAmount: 0,
      status: c.status,
    };
    existing.dealsCount++;
    existing.eligibleRevenue += c.serviceRevenue;
    existing.commissionAmount += c.commissionAmount;
    repCommissionsMap.set(c.teamMemberId, existing);
  }

  const breakdownByRep = Array.from(repCommissionsMap.entries()).map(([teamMemberId, stat]) => ({
    teamMemberId,
    name: stat.name,
    dealsCount: stat.dealsCount,
    eligibleRevenue: stat.eligibleRevenue,
    commissionAmount: stat.commissionAmount,
    status: stat.status,
  }));

  const commissionPerformance: CommissionPerformanceReport = {
    totalEligibleServiceRevenue,
    sponsoringExcluded,
    totalCommissionsAccrued,
    commissionsApproved,
    commissionsPaid,
    commissionsPending,
    breakdownByRep,
  };

  // ------------------------------------------------------------
  // 10. REVENUE TRENDS (Zero Fabrication, purely verified monthly transactions)
  // ------------------------------------------------------------
  const revenueTrends: RevenueTrendItem[] = [];
  const currentDate = new Date();
  for (let i = 5; i >= 0; i--) {
    const mDate = subMonths(currentDate, i);
    const mKey = format(mDate, "yyyy-MM");
    const mLabel = format(mDate, "MMM yyyy");

    const monthInflows = financeState.ledgerTransactions.filter(
      (t: any) => t.direction === "inflow" && t.date && t.date.startsWith(mKey)
    );
    const monthOutflows = financeState.ledgerTransactions.filter(
      (t: any) => t.direction === "outflow" && t.date && t.date.startsWith(mKey)
    );

    const sRetainers = monthInflows
      .filter((t: any) => t.allocation === "client_service")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const sArbitrage = monthInflows
      .filter((t: any) => t.allocation === "sponsoring_collected")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const other = monthInflows
      .filter((t: any) => t.allocation !== "client_service" && t.allocation !== "sponsoring_collected")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const tot = sRetainers + sArbitrage + other;
    const exp = monthOutflows.reduce((sum: number, t: any) => sum + t.amount, 0);
    const net = tot - exp;

    revenueTrends.push({
      periodMonth: mKey,
      monthLabel: mLabel,
      serviceRetainers: sRetainers,
      sponsoringArbitrage: sArbitrage,
      digitalProducts: 0,
      otherRevenue: other,
      totalRevenue: tot,
      totalExpenses: exp,
      netProfit: net,
    });
  }

  // ------------------------------------------------------------
  // 11. DERIVE EXECUTIVE COMMAND STRIP (Top 8 Core KPIs)
  // ------------------------------------------------------------
  const executiveKPIs = deriveExecutiveCommandStrip({
    financeState,
    clientProfitability: filteredClientProf,
    monthlyPnL,
    rawTasks,
    rawProjects,
    period,
  });

  // ------------------------------------------------------------
  // 12. DERIVE EXECUTIVE BRIEFING (Top 3-5 Prioritized Findings)
  // ------------------------------------------------------------
  const briefingItems = generateExecutiveBriefing({
    financeState,
    clientProfitability: filteredClientProf,
    packageProfitability,
    monthlyPnL,
    rawTasks,
    rawProjects,
    period,
  });

  // ------------------------------------------------------------
  // 13. DERIVE OPERATIONS INTELLIGENCE
  // ------------------------------------------------------------
  const operationsIntelligence = deriveOperationsIntelligence({
    rawTasks,
    rawProjects,
    rawTeamMembers,
    rawSessions,
    rawInvoices: financeState.invoices,
  });

  const lastRefreshedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return {
    period,
    filters,
    executiveKPIs,
    briefingItems,
    operationsIntelligence,
    clientProfitability: filteredClientProf,
    packageProfitability,
    serviceProfitability,
    employeePerformance: filteredEmployeePerf,
    salesPerformance,
    productionPerformance,
    monthlyPnL,
    cashFlow,
    commissionPerformance,
    revenueTrends,
    lastRefreshedAt,
    unallocatedRevenue,
    clientAttributedRevenue,
    financeState,
    rawLedger: financeState.ledgerTransactions,
    rawInvoices: financeState.invoices,
    rawTasks,
    rawSessions,
    rawDeals,
    rawBookings,
    rawProjects,
  };
}

// ============================================================
// HELPER: DERIVE EXECUTIVE COMMAND STRIP DATA
// ============================================================

export function deriveExecutiveCommandStrip(params: {
  financeState: any;
  clientProfitability: ClientProfitabilityItem[];
  monthlyPnL: MonthlyPnLStatement;
  rawTasks: any[];
  rawProjects: any[];
  period: FinancialPeriod;
}): ExecutiveCommandStripData {
  const { financeState, clientProfitability, monthlyPnL, rawTasks } = params;
  const kpis = financeState.kpis;
  const now = new Date();

  // 1. Recognized Revenue: Contracted retainer volume across active clients in period
  const activeClientsWithContract = clientProfitability.filter(
    (c) => c.status === "active" || (!c.status && (c.contractedRevenue || 0) > 0)
  );
  const contractedVolume = activeClientsWithContract.reduce((sum, c) => sum + (c.contractedRevenue || 0), 0);
  const recognizedRev = contractedVolume > 0 ? contractedVolume : kpis.revenue;
  const prevRecognizedRev = kpis.prevRevenue || 0;
  const recognizedDelta = prevRecognizedRev > 0 ? ((recognizedRev - prevRecognizedRev) / prevRecognizedRev) * 100 : null;

  // 2. Cash Collected: Inflow receipts
  const cashCollectedVal = kpis.revenue;
  const prevCashCollected = kpis.prevRevenue || 0;
  const cashDelta = prevCashCollected > 0 ? ((cashCollectedVal - prevCashCollected) / prevCashCollected) * 100 : null;

  // 3. Net Profit: Revenue minus all operating costs
  const netProfitVal = monthlyPnL.netProfit;
  const prevNetProfitVal = monthlyPnL.prevMonthNetProfit || 0;
  const profitDelta = monthlyPnL.momProfitGrowthPercent ?? null;

  // 4. Contribution Margin: Gross operational profit
  const contributionMarginVal = monthlyPnL.grossProfit;
  const contributionMarginPct = monthlyPnL.grossMarginPercent;

  // 5. Available Cash: Liquid Treasury segregated by currency minus upcoming payroll commitments
  const accountsList = financeState?.accounts || [];
  const activeAccounts = accountsList.filter((a: any) => a.status === "active" || a.status === undefined);
  const tndAccounts = activeAccounts.filter((a: any) => (a.currency || "TND") === "TND");
  const usdAccounts = activeAccounts.filter((a: any) => a.currency === "USD");
  const cashTnd = tndAccounts.reduce((sum: number, a: any) => sum + Number(a.currentBalance || 0), 0);
  const cashUsd = usdAccounts.reduce((sum: number, a: any) => sum + Number(a.currentBalance || 0), 0);
  const liquidCash = cashTnd > 0 ? cashTnd : (kpis?.cash ?? kpis?.revenue ?? 0);
  const currencyBreakdown = cashUsd > 0
    ? `${formatCurrency(liquidCash, { currency: "TND" })} + ${formatCurrency(cashUsd, { currency: "USD" })}`
    : formatCurrency(liquidCash, { currency: "TND" });

  const salaryRecords = financeState?.salaryRecords || [];
  const commissions = financeState?.commissions || [];
  const invoices = financeState?.invoices || [];
  const upcomingPayroll = salaryRecords.reduce((sum: number, s: any) => sum + Number(s.base_amount || 0), 0);
  const approvedPendingCommissions = commissions
    .filter((c: any) => c.status === "approved")
    .reduce((sum: number, c: any) => sum + Number(c.commissionAmount || 0), 0);
  const reservedCashVal = upcomingPayroll + approvedPendingCommissions;

  // 6. Outstanding Receivables: Unpaid invoices
  const unpaidInvoices = invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled");
  const invoiceReceivables = unpaidInvoices.reduce((sum: number, i: any) => sum + Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0)), 0);
  const outstandingReceivablesVal = invoiceReceivables > 0 ? invoiceReceivables : (kpis?.pendingReceivables ?? kpis?.outstandingPayments ?? 0);
  const overdueInvoices = unpaidInvoices.filter((i: any) => isInvoiceOverdue(i, now));
  const overdueAmount = overdueInvoices.reduce((sum: number, i: any) => sum + Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0)), 0);

  // 7. Operating Expenses & Burn Rate
  const opexVal = Number(monthlyPnL?.operatingExpenses || 0) + Number(monthlyPnL?.cogsDirectCosts || 0);
  const burnRate = kpis?.recurringBurn || 0;
  const prevOpex = kpis?.prevExpenses || 0;
  const opexDelta = prevOpex > 0 ? ((opexVal - prevOpex) / prevOpex) * 100 : null;

  // 8. Delivery Health: Operational on-time and completion index
  const totalTasksCount = rawTasks.length;
  const completedTasksCount = rawTasks.filter((t: any) => t.status === "done" || t.status === "delivered" || t.status === "approved").length;
  const overdueTasksCount = rawTasks.filter((t: any) => isTaskOverdue(t, now)).length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return {
    recognizedRevenue: {
      value: recognizedRev,
      displayValue: formatCurrency(recognizedRev),
      prevValue: prevRecognizedRev,
      deltaPercent: recognizedDelta !== null ? Math.round(recognizedDelta * 10) / 10 : null,
      trend: recognizedDelta !== null ? (recognizedDelta >= 0 ? "up" : "down") : "neutral",
      status: "positive",
      label: "Recognized Revenue",
      label_ar: "الإيرادات المعترف بها",
      definition: "Contracted recurring retainer volume across active client accounts in reporting period",
      definition_ar: "حجم الاشتراكات الشهرية التعاقدية للعملاء النشطين خلال الفترة",
      metricType: "recognized_revenue",
    },
    cashCollected: {
      value: cashCollectedVal,
      displayValue: formatCurrency(cashCollectedVal),
      prevValue: prevCashCollected,
      deltaPercent: cashDelta !== null ? Math.round(cashDelta * 10) / 10 : null,
      trend: cashDelta !== null ? (cashDelta >= 0 ? "up" : "down") : "neutral",
      status: "positive",
      label: "Cash Collected",
      label_ar: "السيولة المحصلة",
      definition: "Total verified cash inflows received into treasury accounts in reporting period",
      definition_ar: "إجمالي المقبوضات النقدية الفعلية المودعة في الحسابات البنكية والخزينة",
      metricType: "monthly_revenue",
    },
    netProfit: {
      value: netProfitVal,
      displayValue: formatCurrency(netProfitVal),
      prevValue: prevNetProfitVal,
      deltaPercent: profitDelta !== null ? Math.round(profitDelta * 10) / 10 : null,
      trend: profitDelta !== null ? (profitDelta >= 0 ? "up" : "down") : "neutral",
      status: netProfitVal >= 0 ? "positive" : "negative",
      label: "Net Profit",
      label_ar: "صافي الأرباح",
      definition: "Collected revenue minus direct COGS, labor, sponsoring ad spend, and operating expenses",
      definition_ar: "الإيرادات بعد خصم تكلفة الإنتاج والعمالة والتمويل الإعلاني والمصاريف التشغيلية",
      metricType: "monthly_net_profit",
    },
    contributionMargin: {
      value: contributionMarginVal,
      displayValue: formatCurrency(contributionMarginVal),
      marginPercent: contributionMarginPct,
      trend: contributionMarginPct >= 40 ? "up" : "down",
      status: contributionMarginPct >= 40 ? "positive" : "warning",
      label: "Contribution Margin",
      label_ar: "هامش المساهمة",
      definition: "Gross contribution profit remaining after direct delivery and media buying costs",
      definition_ar: "ربح المساهمة التشغيلي المتبقي بعد تكاليف التنفيذ المباشرة وشراء الوسائط",
      metricType: "client_contribution_profit",
    },
    availableCash: {
      value: liquidCash,
      displayValue: currencyBreakdown,
      cashTnd: liquidCash,
      cashUsd,
      currencyBreakdown,
      reservedCash: reservedCashVal,
      totalTreasury: liquidCash,
      trend: liquidCash > reservedCashVal ? "up" : "down",
      status: liquidCash >= reservedCashVal ? "positive" : "negative",
      label: "Available Cash",
      label_ar: "السيولة المتاحة",
      definition: cashUsd > 0
        ? "Liquid treasury balances segregated by currency (TND and USD). Does not naively sum foreign currencies."
        : "Immediate liquid treasury balances across bank and cash accounts",
      definition_ar: "أرصدة الخزينة والحسابات البنكية المتاحة فوراً مع الفصل المحاسبي بين العملات",
      metricType: "cash_balance",
    },
    outstandingReceivables: {
      value: outstandingReceivablesVal,
      displayValue: formatCurrency(outstandingReceivablesVal),
      overdueCount: overdueInvoices.length,
      overdueAmount,
      trend: overdueInvoices.length === 0 ? "neutral" : "down",
      status: overdueInvoices.length > 0 ? "warning" : "positive",
      label: "Outstanding Receivables",
      label_ar: "مستحقات معلقة",
      definition: "Billed invoices pending collection, including overdue client payments",
      definition_ar: "الفواتير المصدرة وغير المحصلة حتى الآن مع المبالغ المتأخرة",
      metricType: "outstanding_invoices",
    },
    operatingExpenses: {
      value: opexVal,
      displayValue: formatCurrency(opexVal),
      monthlyBurnRate: burnRate,
      prevValue: prevOpex,
      deltaPercent: opexDelta !== null ? Math.round(opexDelta * 10) / 10 : null,
      trend: opexDelta !== null ? (opexDelta <= 0 ? "up" : "down") : "neutral",
      status: "neutral",
      label: "Expenses & Burn",
      label_ar: "المصاريف ومعدل الحرق",
      definition: "Total paid outflows in period plus monthly recurring SaaS software subscriptions",
      definition_ar: "إجمالي المصروفات المدفوعة خلال الفترة مضافاً إليها الاشتراكات البرمجية الدورية",
      metricType: "monthly_expenses",
    },
    deliveryHealth: {
      value: completionRate,
      displayValue: totalTasksCount > 0 ? `${completionRate}%` : "0%",
      overdueTasksCount,
      completionRatePercent: completionRate,
      trend: overdueTasksCount === 0 ? "up" : "down",
      status: overdueTasksCount === 0 ? "positive" : overdueTasksCount > 5 ? "negative" : "warning",
      label: "Delivery Health",
      label_ar: "صحة التنفيذ والإنتاج",
      definition: "Operational task completion rate and count of overdue project commitments",
      definition_ar: "معدل إنجاز المهام التشغيلية ونسبة الالتزام بالمواعيد المحددة للعملاء",
      metricType: "overdue_tasks",
    },
  };
}

// ============================================================
// HELPER: GENERATE EXECUTIVE BRIEFING FINDINGS
// ============================================================

export function generateExecutiveBriefing(params: {
  financeState: any;
  clientProfitability: ClientProfitabilityItem[];
  packageProfitability: PackageProfitabilityItem[];
  monthlyPnL: MonthlyPnLStatement;
  rawTasks: any[];
  rawProjects: any[];
  period: FinancialPeriod;
}): ExecutiveBriefingItem[] {
  const { financeState, clientProfitability, packageProfitability, monthlyPnL, rawTasks, period } = params;
  const findings: ExecutiveBriefingItem[] = [];
  const now = new Date();

  // 1. Check Overdue Invoices (DEF-ECC-11: Canonical isInvoiceOverdue alignment)
  const invoices = financeState?.invoices || [];
  const overdueInvoices = invoices.filter((i: any) => isInvoiceOverdue(i, now));
  const overdueTotal = overdueInvoices.reduce((sum: number, i: any) => sum + Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0)), 0);
  if (overdueTotal > 0) {
    findings.push({
      id: "briefing-overdue-receivables",
      category: "risk",
      severity: overdueTotal >= 2000 ? "critical" : "high",
      title: "Overdue Client Receivables Threaten Cash Flow",
      title_ar: "مستحقات عملاء متأخرة تهدد السيولة النقدية",
      conciseExplanation: `${overdueInvoices.length} client invoice(s) are overdue past their contractual due dates, delaying cash inflows.`,
      conciseExplanation_ar: `توجد ${overdueInvoices.length} فواتير عملاء تجاوزت تاريخ الاستحقاق التعاقدي، مما يعيق التدفقات النقدية.`,
      supportingNumbers: `${formatCurrency(overdueTotal)} overdue across ${overdueInvoices.length} invoice(s)`,
      period: period.label,
      thresholdOrComparison: "Threshold: Due date < Today & Status != Paid",
      dataCompleteness: "complete",
      recommendedAction: "Dispatch automated invoice reminders and contact client finance officers directly.",
      recommendedAction_ar: "إرسال تذكيرات آلية بالدفع والتواصل الفوري مع مسؤولي الحسابات لدى العملاء.",
      targetUrl: "/admin/finance",
      targetLabel: "Open Unpaid Invoices",
      targetLabel_ar: "عرض الفواتير غير المسددة",
    });
  }

  // 2. Check Liquidity vs Upcoming Obligations
  const liquidCash = financeState?.kpis?.cash ?? financeState?.kpis?.revenue ?? 0;
  const salaryRecords = financeState?.salaryRecords || [];
  const commissions = financeState?.commissions || [];
  const upcomingSalaries = salaryRecords.reduce((sum: number, s: any) => sum + Number(s.base_amount || 0), 0);
  const approvedCommissions = commissions
    .filter((c: any) => c.status === "approved")
    .reduce((sum: number, c: any) => sum + Number(c.commissionAmount || 0), 0);
  const totalUpcomingPayroll = upcomingSalaries + approvedCommissions;
  if (totalUpcomingPayroll > liquidCash) {
    findings.push({
      id: "briefing-liquidity-payroll-shortfall",
      category: "risk",
      severity: "critical",
      title: "Upcoming Payroll Obligations Exceed Available Treasury Cash",
      title_ar: "الالتزامات المستحقة للرواتب تتجاوز السيولة النقدية المتاحة",
      conciseExplanation: `Upcoming salary and commission commitments (${formatCurrency(totalUpcomingPayroll)}) exceed current liquid bank balances (${formatCurrency(liquidCash)}).`,
      conciseExplanation_ar: `التزامات الرواتب والعمولات المعتمدة (${formatCurrency(totalUpcomingPayroll)}) تفوق الأرصدة البنكية السائلة الحالية (${formatCurrency(liquidCash)}).`,
      supportingNumbers: `Liquidity Deficit: ${formatCurrency(totalUpcomingPayroll - liquidCash)}`,
      period: period.label,
      thresholdOrComparison: `Available Cash (${formatCurrency(liquidCash)}) < Payroll Obligation (${formatCurrency(totalUpcomingPayroll)})`,
      dataCompleteness: "complete",
      recommendedAction: "Accelerate invoice collections and prioritize liquid cash transfers into operating account.",
      recommendedAction_ar: "تسريع تحصيل الفواتير المعلقة وتحويل سيولة فورية إلى حساب العمليات التشغيلي.",
      targetUrl: "/admin/finance",
      targetLabel: "Inspect Treasury Balances",
      targetLabel_ar: "فحص أرصدة الخزينة",
    });
  }

  // 3. Check Delivery Deadlines and Overdue Tasks (DEF-ECC-11: Canonical isTaskOverdue alignment)
  const overdueTasks = rawTasks.filter((t: any) => isTaskOverdue(t, now));
  if (overdueTasks.length > 0) {
    const clientsAffected = new Set(overdueTasks.map((t: any) => t.client?.name || t.client_id).filter(Boolean));
    findings.push({
      id: "briefing-overdue-deliverables",
      category: "risk",
      severity: overdueTasks.length >= 5 ? "high" : "warning",
      title: `${overdueTasks.length} Overdue Deliverable(s) Threaten Client Commitments`,
      title_ar: `${overdueTasks.length} مهام تشغيلية متأخرة تهدد التزامات العملاء`,
      conciseExplanation: `Critical client deliverables missed their scheduled deadlines across ${clientsAffected.size} client account(s).`,
      conciseExplanation_ar: `تسليمات ومخرجات رئيسية تجاوزت مواعيدها المحددة وتؤثر على ${clientsAffected.size} من حسابات العملاء.`,
      supportingNumbers: `${overdueTasks.length} overdue task(s) across ${clientsAffected.size} client(s)`,
      period: period.label,
      thresholdOrComparison: "Task Deadline < Today & Status NOT IN ('done', 'delivered', 'approved')",
      dataCompleteness: "complete",
      recommendedAction: "Reassign capacity, expedite production reviews, or reschedule client delivery dates.",
      recommendedAction_ar: "إعادة توزيع المهام، وتسريع مراجعات الإنتاج، أو إعادة جدولة مواعيد التسليم مع العملاء.",
      targetUrl: "/admin/client-workspaces",
      targetLabel: "View Overdue Tasks",
      targetLabel_ar: "عرض المهام المتأخرة",
    });
  }

  // 4. Check Client Negative Contribution (Money Consumed)
  const lossClients = clientProfitability.filter((c) => c.contributionProfit < 0);
  if (lossClients.length > 0) {
    const topLoss = lossClients[0];
    findings.push({
      id: "briefing-negative-client-margin",
      category: "loss",
      severity: "high",
      title: `Client Account Generating Negative Contribution: ${topLoss.clientName}`,
      title_ar: `تسجيل خسارة مساهمة في حساب العميل: ${topLoss.clientName}`,
      conciseExplanation: `Client incurred ${formatCurrency(topLoss.directCosts + topLoss.sponsoringCost)} in production and media costs against only ${formatCurrency(topLoss.revenue)} collected revenue.`,
      conciseExplanation_ar: `تكبد حساب العميل ${formatCurrency(topLoss.directCosts + topLoss.sponsoringCost)} في تكاليف الإنتاج والإعلانات مقابل ${formatCurrency(topLoss.revenue)} إيرادات محصلة فقط.`,
      supportingNumbers: `Net Deficit: ${formatCurrency(topLoss.contributionProfit)} (Margin: ${topLoss.profitMarginPercent}%)`,
      period: period.label,
      thresholdOrComparison: "Contribution Profit < 0 TND in selected period",
      dataCompleteness: "complete",
      recommendedAction: "Halt out-of-scope work, audit billable time, or invoice supplementary service fees.",
      recommendedAction_ar: "إيقاف العمل خارج النطاق، ومراجعة الساعات التشغيلية، أو فوترة رسوم خدمات إضافية فوراً.",
      targetUrl: `/admin/client-workspaces/${topLoss.clientId}`,
      targetLabel: `Open ${topLoss.clientName} Profile`,
      targetLabel_ar: `فتح ملف العميل ${topLoss.clientName}`,
    });
  }

  // 5. Check Incomplete Package Cost Attribution
  const incompletePkgs = packageProfitability.filter((p) => p.isIncompleteCostData);
  if (incompletePkgs.length > 0) {
    findings.push({
      id: "briefing-incomplete-package-costs",
      category: "deterioration",
      severity: "warning",
      title: "Incomplete Unit Cost Attribution on Active Packages",
      title_ar: "بيانات تكلفة غير مكتملة في الباقات التجارية النشطة",
      conciseExplanation: `${incompletePkgs.length} catalog package(s) have zero recorded labor/freelancer/transport costs. SADA Intelligence protects margins by withholding false 100% profitability.`,
      conciseExplanation_ar: `توجد ${incompletePkgs.length} باقات لا تحتوي على تكاليف عمالة أو مواهب مستقلة أو نقل مسجلة. يحجب النظام نسب الهامش الزائفة 100% لحماية دقة التقارير.`,
      supportingNumbers: `${incompletePkgs.length} package(s) missing unit cost allocations`,
      period: period.label,
      thresholdOrComparison: "Package Selling Price > 0 & Unit Costs == 0",
      dataCompleteness: "insufficient",
      recommendedAction: "Configure baseline production unit costs in the Package Catalog to unlock verified margins.",
      recommendedAction_ar: "تحديد تكاليف الإنتاج التقديرية في كتالوج الباقات لاحتساب هوامش الربح الحقيقية.",
      targetUrl: "/admin/packages",
      targetLabel: "Configure Package Costs",
      targetLabel_ar: "ضبط تكاليف الباقات",
    });
  }

  // 6. Check MoM Margin / Profit Trajectory
  if (monthlyPnL.momProfitGrowthPercent !== null && monthlyPnL.momProfitGrowthPercent !== undefined) {
    const mom = monthlyPnL.momProfitGrowthPercent;
    const formattedMom = Number(mom.toFixed(1));
    if (mom > 0) {
      findings.push({
        id: "briefing-profit-growth",
        category: "improvement",
        severity: "info",
        title: "Net Operating Margin Improvement Recorded",
        title_ar: "تحسن إيجابي في هامش وصافي الأرباح التشغيلية",
        conciseExplanation: `Net profit increased by ${formattedMom}% compared to the previous reporting period (${formatCurrency(monthlyPnL.netProfit)} vs ${formatCurrency(monthlyPnL.prevMonthNetProfit || 0)}).`,
        conciseExplanation_ar: `ارتفع صافي الربح بنسبة ${formattedMom}% مقارنة بالفترة السابقة المعيارية (${formatCurrency(monthlyPnL.netProfit)} مقابل ${formatCurrency(monthlyPnL.prevMonthNetProfit || 0)}).`,
        supportingNumbers: `+${formattedMom}% growth (${formatCurrency(monthlyPnL.netProfit)})`,
        period: period.label,
        thresholdOrComparison: "MoM Net Profit Delta > 0%",
        dataCompleteness: "complete",
        recommendedAction: "Maintain disciplined production labor allocation and current retainer client coverage.",
        recommendedAction_ar: "الحفاظ على انضباط تكاليف الإنتاج والعمالة ومتابعة اشتراكات العملاء الحالية.",
        targetUrl: "/admin/finance",
        targetLabel: "View Monthly P&L",
        targetLabel_ar: "عرض بيان الأرباح والخسائر",
      });
    }
  }

  // Sort by severity: critical > high > warning > info, take top 4
  const severityRank: Record<string, number> = { critical: 4, high: 3, warning: 2, info: 1 };
  findings.sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0));

  return findings.slice(0, 4);
}

// ============================================================
// HELPER: DERIVE OPERATIONS INTELLIGENCE
// ============================================================

export function deriveOperationsIntelligence(params: {
  rawTasks: any[];
  rawProjects: any[];
  rawTeamMembers: any[];
  rawSessions: any[];
  rawInvoices: any[];
}): OperationsIntelligenceData {
  const { rawTasks, rawProjects, rawTeamMembers, rawSessions, rawInvoices } = params;
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const activeClientsSet = new Set<string>();
  const activeProjects = rawProjects.filter((p: any) => p.status !== "completed" && p.status !== "archived");
  const activeTasks = rawTasks.filter((t: any) => t.status !== "done" && t.status !== "delivered" && t.status !== "approved");
  activeProjects.forEach((p: any) => { if (p.client_id) activeClientsSet.add(p.client_id); });
  activeTasks.forEach((t: any) => { if (t.client_id) activeClientsSet.add(t.client_id); });

  const activeProjectsCount = activeProjects.length;
  const tasksDueTodayCount = rawTasks.filter((t: any) => t.deadline === todayStr && t.status !== "done" && t.status !== "delivered").length;
  const overdueTasks = rawTasks.filter((t: any) => isTaskOverdue(t, now));
  const overdueTasksCount = overdueTasks.length;

  const in7Days = format(subDays(now, -7), "yyyy-MM-dd");
  const upcomingDeadlinesCount = rawTasks.filter((t: any) => t.deadline && t.deadline > todayStr && t.deadline <= in7Days && t.status !== "done").length;

  const totalTasks = rawTasks.length;
  const completedTasks = rawTasks.filter((t: any) => t.status === "done" || t.status === "delivered" || t.status === "approved").length;
  const deliveryCompletionRatePercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const blockedTasksCount = rawTasks.filter((t: any) => t.status === "blocked").length;
  const awaitingReviewCount = rawTasks.filter((t: any) => t.status === "in_review" || t.status === "review").length;
  const awaitingPublicationCount = rawTasks.filter((t: any) => t.status === "ready_to_publish" || t.status === "publishing").length;

  // Operational pipeline
  const pipelineStages = {
    planned: rawTasks.filter((t: any) => t.status === "todo" || t.status === "planned" || t.status === "brief").length,
    inProduction: rawTasks.filter((t: any) => t.status === "in_progress" || t.status === "doing").length,
    inReview: awaitingReviewCount,
    approved: rawTasks.filter((t: any) => t.status === "approved" || t.status === "ready_to_publish").length,
    delivered: rawTasks.filter((t: any) => t.status === "done" || t.status === "delivered" || t.status === "published").length,
  };

  // Team Workload
  const teamWorkload = rawTeamMembers.map((member: any) => {
    const memberTasks = rawTasks.filter((t: any) => t.assignee_id === member.id || t.assignee_id === member.profile_id);
    const assignedCount = memberTasks.filter((t: any) => t.status !== "done" && t.status !== "delivered").length;
    const completedCount = memberTasks.filter((t: any) => t.status === "done" || t.status === "delivered" || t.status === "approved").length;
    const memberOverdue = memberTasks.filter((t: any) => isTaskOverdue(t, now)).length;
    const memberSessions = rawSessions.filter((s: any) => s.team_member_id === member.id || s.profile_id === member.profile_id);
    const actualHours = Math.round((memberSessions.reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0), 0) / 60) * 10) / 10;

    let status: "normal" | "overloaded" | "underutilized" = "normal";
    if (assignedCount > 8 || memberOverdue > 2) status = "overloaded";
    else if (assignedCount === 0 && actualHours < 5) status = "underutilized";

    return {
      memberId: member.id,
      name: member.name,
      role: member.position || member.role || "Specialist",
      assignedCount,
      completedCount,
      overdueCount: memberOverdue,
      actualHours,
      status,
    };
  });

  // Clients at Risk
  const clientOverdueMap = new Map<string, { name: string; overdueCount: number; unpaidAmount: number }>();
  for (const t of overdueTasks) {
    if (!t.client_id) continue;
    const existing = clientOverdueMap.get(t.client_id) || { name: t.client?.name || "Client", overdueCount: 0, unpaidAmount: 0 };
    existing.overdueCount++;
    clientOverdueMap.set(t.client_id, existing);
  }
  for (const inv of rawInvoices.filter((i: any) => i.status === "overdue")) {
    if (!inv.clientId) continue;
    const existing = clientOverdueMap.get(inv.clientId) || { name: inv.clientName || "Client", overdueCount: 0, unpaidAmount: 0 };
    existing.unpaidAmount += Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
    clientOverdueMap.set(inv.clientId, existing);
  }

  const clientsAtRisk = Array.from(clientOverdueMap.entries()).map(([clientId, info]) => ({
    clientId,
    name: info.name,
    reason: info.overdueCount > 0 && info.unpaidAmount > 0
      ? `${info.overdueCount} overdue task(s) & ${formatCurrency(info.unpaidAmount)} unpaid`
      : info.overdueCount > 0
      ? `${info.overdueCount} overdue task(s) threatening deadline`
      : `${formatCurrency(info.unpaidAmount)} overdue invoice`,
    overdueCount: info.overdueCount,
    unpaidAmount: info.unpaidAmount,
  }));

  return {
    activeClientsCount: activeClientsSet.size,
    activeProjectsCount,
    tasksDueTodayCount,
    overdueTasksCount,
    upcomingDeadlinesCount,
    deliveryCompletionRatePercent,
    blockedTasksCount,
    awaitingReviewCount,
    awaitingPublicationCount,
    pipelineStages,
    teamWorkload,
    clientsAtRisk,
  };
}

// ============================================================
// 2. INTERACTIVE DRILL-DOWN ENGINE
// CLICK → DRILL DOWN → SOURCE RECORDS
// ============================================================

export function buildAnalyticsDrillDown(params: {
  metricType: string;
  metricLabel: string;
  metricValue: string | number;
  entityId?: string;
  entityName?: string;
  data: FullManagementAnalyticsData;
}): AnalyticsDrillDownState {
  const { metricType, metricLabel, metricValue, entityId, entityName, data } = params;
  let resolvedEntityName = entityName;
  const records: AnalyticsDrillDownSourceRecord[] = [];
  let formula = "";

  switch (metricType) {
    case "recognized_revenue": {
      formula = "Recognized Revenue = Sum(Contracted Retainers across active clients for the reporting period)";
      for (const cl of data.clientProfitability) {
        records.push({
          id: cl.clientId,
          date: new Date().toISOString(),
          title: `Client Retainer: ${cl.clientName}`,
          type: "Contracted Retainer",
          amount: cl.contractedRevenue || cl.revenue,
          status: cl.paymentStatus,
          linkUrl: `/admin/client-workspaces/${cl.clientId}`,
        });
      }
      break;
    }

    case "client_contribution_profit": {
      const client = data.clientProfitability.find((c) => c.clientId === entityId);
      if (client && !resolvedEntityName) {
        resolvedEntityName = `Client: ${client.clientName}`;
      }
      formula = "Contribution Profit = Service Revenue + Sponsoring Margin - Sales Commission - Direct Costs";
      if (client) {
        for (const inv of data.rawInvoices.filter((i) => i.clientId === entityId)) {
          records.push({
            id: inv.id,
            date: inv.issueDate || inv.createdAt,
            title: `Invoice ${inv.invoiceNumber} (${client.clientName})`,
            type: "Invoice",
            amount: inv.totalAmount,
            status: (inv.status || "sent").toUpperCase(),
            linkUrl: `/admin/client-workspaces/${entityId}`,
          });
        }
        for (const sess of data.rawSessions.filter((s) => s.client_id === entityId)) {
          records.push({
            id: sess.id,
            date: sess.started_at,
            title: `Work Session: ${sess.description || sess.session_type} (${sess.team_member?.name || "Specialist"})`,
            type: "Labor Cost",
            amount: Number(sess.labor_cost || 0),
            status: (sess.status || "completed").toUpperCase(),
            linkUrl: `/admin/client-workspaces/${entityId}`,
          });
        }
      } else {
        for (const c of data.clientProfitability) {
          records.push({
            id: c.clientId,
            date: new Date().toISOString(),
            title: `${c.clientName} (Contribution Profit)`,
            type: "Contribution Profit",
            amount: c.contributionProfit,
            status: c.health,
            linkUrl: `/admin/client-workspaces/${c.clientId}`,
          });
        }
      }
      break;
    }

    case "package_profitability": {
      const pkg = data.packageProfitability.find((p) => p.packageId === entityId);
      formula = "Gross Profit = Selling Price - (Employee Cost + Freelancer + Transport + Subscriptions + Commission)";
      if (pkg) {
        records.push({
          id: pkg.packageId,
          date: new Date().toISOString(),
          title: `Package Offering: ${pkg.name}`,
          type: "Catalog Price",
          amount: pkg.sellingPrice,
          status: "ACTIVE",
          linkUrl: `/admin/packages`,
        });
        if (pkg.subscribersList) {
          for (const sub of pkg.subscribersList) {
            records.push({
              id: sub.clientId,
              date: new Date().toISOString(),
              title: `Active Subscriber: ${sub.clientName}`,
              type: "Subscribed Client",
              amount: pkg.sellingPrice,
              status: "ACTIVE",
              linkUrl: `/admin/client-workspaces/${sub.clientId}`,
            });
          }
        }
      }
      break;
    }

    case "monthly_net_profit": {
      formula = "Net Profit = Total Inflows - COGS - Payroll - Subscriptions - Operating Expenses";
      for (const t of data.rawLedger.slice(0, 30)) {
        records.push({
          id: t.id,
          date: t.date,
          title: t.description || t.category,
          type: t.direction === "inflow" ? "Income (+)" : "Expense (-)",
          amount: t.amount,
          status: (t.status || "settled").toUpperCase(),
          linkUrl: `/admin/finance`,
        });
      }
      break;
    }

    case "monthly_revenue": {
      formula = "Collected Revenue = Sum(Canonical Inflows from Settled Invoices + Service Income)";
      for (const t of data.rawLedger.filter((l) => l.direction === "inflow")) {
        records.push({
          id: t.id,
          date: t.date,
          title: t.description || t.category,
          type: "Collected Inflow",
          amount: t.amount,
          status: (t.status || "received").toUpperCase(),
          linkUrl: `/admin/finance`,
        });
      }
      break;
    }

    case "monthly_expenses": {
      formula = "Operating Expenses = Sum(Canonical Outflows from Payroll, Sponsoring, Subscriptions, Rent, Utilities, Transport)";
      for (const t of data.rawLedger.filter((l) => l.direction === "outflow")) {
        records.push({
          id: t.id,
          date: t.date,
          title: t.description || t.category,
          type: "Operational Expense",
          amount: t.amount,
          status: (t.status || "paid").toUpperCase(),
          linkUrl: `/admin/finance`,
        });
      }
      break;
    }

    case "cash_balance": {
      formula = "Available Liquid Cash = Sum(Current Balances of Treasury Bank & Cash Accounts)";
      for (const acc of data.financeState.accounts) {
        records.push({
          id: acc.id,
          date: new Date().toISOString(),
          title: `Treasury Account: ${acc.name} (${acc.accountType?.toUpperCase() || "BANK"})`,
          type: "Liquid Asset",
          amount: Number(acc.currentBalance || 0),
          status: (acc.status || "active").toUpperCase(),
          linkUrl: `/admin/finance`,
        });
      }
      break;
    }

    case "outstanding_invoices": {
      formula = "Outstanding Receivables = Sum(Unpaid & Overdue Invoices)";
      for (const inv of data.rawInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled")) {
        records.push({
          id: inv.id,
          date: inv.dueDate || inv.createdAt,
          title: `Unpaid Invoice ${inv.invoiceNumber} (${inv.clientName || "Client"})`,
          type: "Receivable",
          amount: Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)),
          status: (inv.status || "pending").toUpperCase(),
          linkUrl: `/admin/client-workspaces/${inv.clientId}`,
        });
      }
      break;
    }

    case "overdue_tasks": {
      formula = "Overdue Tasks = Project tasks where isTaskOverdue(task) is true (past end-of-day deadline, excluding done, delivered, approved, cancelled)";
      const now = new Date();
      for (const t of data.rawTasks.filter((task) => isTaskOverdue(task, now))) {
        records.push({
          id: t.id,
          date: t.deadline,
          title: `Overdue [${t.priority?.toUpperCase() || "NORMAL"}]: ${t.title} (${t.project?.title || "Project"})`,
          type: "Task Deliverable",
          amount: t.estimated_hours || 0,
          currency: "Hours",
          status: (t.status || "in_progress").toUpperCase(),
          linkUrl: (t.project as any)?.client_id ? `/admin/client-workspaces/${(t.project as any).client_id}` : `/admin/client-workspaces/${t.project_id}`,
        });
      }
      break;
    }

    case "employee_actual_hours": {
      const emp = data.employeePerformance.find((e) => e.teamMemberId === entityId);
      formula = "Actual Hours = Sum(Work Sessions duration_minutes / 60) for assigned team member";
      for (const sess of data.rawSessions.filter((s) => s.team_member_id === entityId || s.profile_id === entityId)) {
        records.push({
          id: sess.id,
          date: sess.started_at,
          title: `Session: ${sess.client?.name || "Agency"} — ${sess.description || sess.session_type}`,
          type: (sess.session_type || "work").toUpperCase(),
          amount: Math.round((Number(sess.duration_minutes || 0) / 60) * 10) / 10,
          currency: "Hours",
          status: (sess.status || "completed").toUpperCase(),
          linkUrl: `/admin/my-work`,
        });
      }
      break;
    }

    case "blocked_tasks": {
      formula = "Blocked Tasks = Project deliverables flagged with status 'blocked' awaiting external input or asset handoff";
      for (const t of data.rawTasks.filter((task) => task.status === "blocked")) {
        records.push({
          id: t.id,
          date: t.deadline || t.created_at,
          title: `Blocked: ${t.title} (${t.project?.title || "Project"})`,
          type: "Blocked Deliverable",
          amount: t.estimated_hours || 0,
          currency: "Hours",
          status: "BLOCKED",
          linkUrl: (t.project as any)?.client_id ? `/admin/client-workspaces/${(t.project as any).client_id}` : `/admin/client-workspaces/${t.project_id}`,
        });
      }
      break;
    }

    case "today_tasks": {
      const todayDateStr = format(new Date(), "yyyy-MM-dd");
      formula = "Tasks Due Today = Project tasks with deadline matching current calendar day";
      for (const t of data.rawTasks.filter((task) => task.deadline === todayDateStr && task.status !== "done" && task.status !== "delivered")) {
        records.push({
          id: t.id,
          date: t.deadline,
          title: `Due Today: ${t.title} (${t.project?.title || "Project"})`,
          type: "Daily Deliverable",
          amount: t.estimated_hours || 0,
          currency: "Hours",
          status: (t.status || "in_progress").toUpperCase(),
          linkUrl: (t.project as any)?.client_id ? `/admin/client-workspaces/${(t.project as any).client_id}` : `/admin/client-workspaces/${t.project_id}`,
        });
      }
      break;
    }

    case "expense_category": {
      formula = "Category Expenses = Outflow transactions categorized under selected accounting code";
      for (const t of data.rawLedger.filter((l) => l.direction === "outflow" && (l.category === entityId || l.categoryName === entityId))) {
        records.push({
          id: t.id,
          date: t.date,
          title: t.description || t.category,
          type: "Category Outflow",
          amount: t.amount,
          status: (t.status || "paid").toUpperCase(),
          linkUrl: `/admin/finance`,
        });
      }
      break;
    }

    case "delivery_health": {
      formula = "Delivery Health = (Completed & Approved Tasks / Total Period Tasks) * 100";
      for (const t of data.rawTasks.slice(0, 30)) {
        records.push({
          id: t.id,
          date: t.deadline || t.created_at,
          title: `${t.title} (${t.client?.name || "Client"})`,
          type: "Operational Task",
          amount: t.estimated_hours || 0,
          currency: "Hours",
          status: (t.status || "pending").toUpperCase(),
          linkUrl: (t.project as any)?.client_id ? `/admin/client-workspaces/${(t.project as any).client_id}` : `/admin/client-workspaces/${t.project_id}`,
        });
      }
      break;
    }

    case "sales_pipeline_revenue": {
      formula = "Pipeline Won Revenue = Sum(Deal Value for all deals marked WON)";
      for (const d of data.rawDeals.filter((d) => d.stage === "won")) {
        records.push({
          id: d.id,
          date: d.updated_at || d.created_at,
          title: `Won Deal: ${d.title} (${d.client?.name || d.company_name})`,
          type: "Won Deal",
          amount: Number(d.deal_value || d.service_fee || 0),
          status: "WON",
          linkUrl: `/admin/sales`,
        });
      }
      break;
    }

    default: {
      formula = "Authoritative source entries recorded in SADA canonical database";
      for (const t of data.rawLedger.slice(0, 20)) {
        records.push({
          id: t.id,
          date: t.date,
          title: t.description || t.category,
          type: t.direction.toUpperCase(),
          amount: t.amount,
          status: (t.status || "settled").toUpperCase(),
          linkUrl: `/admin/finance`,
        });
      }
      break;
    }
  }

  return {
    title: `Source Drill-Down: ${metricLabel}`,
    metricLabel,
    metricValue,
    formula,
    recordsCount: records.length,
    records,
    entityName: resolvedEntityName,
  };
}

// ============================================================
// 3. EXPORT REPORTS TO CSV / JSON
// ============================================================

export function exportAnalyticsReportToCSV(params: {
  reportType: "client_profitability" | "package_profitability" | "employee_performance" | "monthly_pnl" | "executive_briefing" | "operations" | "full";
  data: FullManagementAnalyticsData;
}): void {
  const { reportType, data } = params;
  const rows: Array<string[]> = [];
  const filename = `SADA_${reportType}_${data.period.label.replace(/\s+/g, "_")}.csv`;

  if (reportType === "client_profitability") {
    rows.push([
      "Client Name",
      "Industry",
      "Contracted Retainer (TND)",
      "Collected Revenue (TND)",
      "Direct Costs (TND)",
      "Sponsoring Cost (TND)",
      "Sales Commission (TND)",
      "Contribution Profit (TND)",
      "Margin (%)",
      "Cost Completeness",
      "Health Rating",
      "Payment Status",
      "Actual Hours",
    ]);
    for (const c of data.clientProfitability) {
      rows.push([
        `"${c.clientName.replace(/"/g, '""')}"`,
        `"${c.industry.replace(/"/g, '""')}"`,
        String(c.contractedRevenue || 0),
        String(c.revenue),
        String(c.directCosts),
        String(c.sponsoringCost),
        String(c.salesCommission),
        String(c.contributionProfit),
        `${c.profitMarginPercent}%`,
        c.costCompleteness || "complete",
        c.health,
        c.paymentStatus,
        String(c.actualHours),
      ]);
    }
  } else if (reportType === "package_profitability") {
    rows.push([
      "Package Name",
      "Tier",
      "Selling Price (TND)",
      "Employee Cost (TND)",
      "Freelancer Cost (TND)",
      "Transport Cost (TND)",
      "Software Allocation (TND)",
      "Commission (TND)",
      "Gross Profit (TND)",
      "Gross Margin (%)",
      "Cost Data Status",
      "Active Subscribers",
      "Total Volume (TND)",
    ]);
    for (const p of data.packageProfitability) {
      rows.push([
        `"${p.name.replace(/"/g, '""')}"`,
        p.tier,
        String(p.sellingPrice),
        String(p.employeeCost),
        String(p.freelancerCost),
        String(p.transportCost),
        String(p.subscriptionAllocation),
        String(p.commission),
        String(p.grossProfit),
        p.grossMarginPercent !== null ? `${p.grossMarginPercent}%` : "Incomplete",
        p.isIncompleteCostData ? "Incomplete Cost Data" : "Complete",
        String(p.activeSubscriptionsCount),
        String(p.totalVolumeRevenue),
      ]);
    }
  } else if (reportType === "employee_performance") {
    rows.push([
      "Team Member",
      "Role",
      "Employment Type",
      "Hourly Rate (TND)",
      "Assigned Tasks",
      "Completed Tasks",
      "Overdue Tasks",
      "Completion Rate (%)",
      "Actual Hours",
      "Estimated Hours",
      "Labor Cost Generated (TND)",
    ]);
    for (const e of data.employeePerformance) {
      rows.push([
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.role.replace(/"/g, '""')}"`,
        e.employmentType,
        String(e.hourlyRate),
        String(e.assignedTasks),
        String(e.completedTasks),
        String(e.overdueTasks),
        `${e.completionRatePercent}%`,
        String(e.actualHours),
        String(e.estimatedHours),
        String(e.laborCostGenerated),
      ]);
    }
  } else if (reportType === "executive_briefing") {
    rows.push([
      "Severity",
      "Category",
      "Finding Title",
      "Explanation",
      "Supporting Figures",
      "Detection Rule / Threshold",
      "Recommended Action",
    ]);
    for (const b of data.briefingItems) {
      rows.push([
        b.severity.toUpperCase(),
        b.category.toUpperCase(),
        `"${b.title.replace(/"/g, '""')}"`,
        `"${b.conciseExplanation.replace(/"/g, '""')}"`,
        `"${b.supportingNumbers.replace(/"/g, '""')}"`,
        `"${b.thresholdOrComparison.replace(/"/g, '""')}"`,
        `"${b.recommendedAction.replace(/"/g, '""')}"`,
      ]);
    }
  } else if (reportType === "operations") {
    rows.push([
      "Metric",
      "Value",
      "Notes",
    ]);
    rows.push(["Active Clients", String(data.operationsIntelligence.activeClientsCount), "Clients with active projects or tasks"]);
    rows.push(["Active Projects", String(data.operationsIntelligence.activeProjectsCount), "Unarchived client projects"]);
    rows.push(["Tasks Due Today", String(data.operationsIntelligence.tasksDueTodayCount), "Deliverables scheduled for today"]);
    rows.push(["Overdue Tasks", String(data.operationsIntelligence.overdueTasksCount), "Missed deadlines requiring action"]);
    rows.push(["Delivery Completion Rate", `${data.operationsIntelligence.deliveryCompletionRatePercent}%`, "Completed vs assigned tasks"]);
    rows.push(["Planned Tasks", String(data.operationsIntelligence.pipelineStages.planned), "Pipeline stage 1"]);
    rows.push(["In Production Tasks", String(data.operationsIntelligence.pipelineStages.inProduction), "Pipeline stage 2"]);
    rows.push(["In Review Tasks", String(data.operationsIntelligence.pipelineStages.inReview), "Pipeline stage 3"]);
    rows.push(["Approved Tasks", String(data.operationsIntelligence.pipelineStages.approved), "Pipeline stage 4"]);
    rows.push(["Delivered Tasks", String(data.operationsIntelligence.pipelineStages.delivered), "Pipeline stage 5"]);
  } else {
    // Default P&L
    rows.push(["P&L Line Item", "Amount (TND)", "Notes / Formula"]);
    rows.push(["Total Revenue", String(data.monthlyPnL.totalRevenue), "Service Retainers + Sponsoring Collected"]);
    rows.push(["Client Services Revenue", String(data.monthlyPnL.clientServicesRevenue), "Retainer fees & creative delivery"]);
    rows.push(["Sponsoring Collected", String(data.monthlyPnL.sponsoringCollected), "Client media ad budgets"]);
    rows.push(["COGS / Direct Costs", String(data.monthlyPnL.cogsDirectCosts), "Direct Labor + Sponsoring Purchases + Commissions"]);
    rows.push(["Sponsoring Purchase Cost", String(data.monthlyPnL.sponsoringPurchasesCost), "Media platform ad spend"]);
    rows.push(["Direct Labor Cost", String(data.monthlyPnL.directLaborCost), "Production shoot & edit hours"]);
    rows.push(["Sales Commissions Cost", String(data.monthlyPnL.salesCommissionsCost), "Sales commissions paid"]);
    rows.push(["Gross / Contribution Profit", String(data.monthlyPnL.grossProfit), `${data.monthlyPnL.grossMarginPercent}% Margin`]);
    rows.push(["Operating Expenses", String(data.monthlyPnL.operatingExpenses), "Software subscriptions + Overhead"]);
    rows.push(["Software Subscriptions", String(data.monthlyPnL.softwareSubscriptions), "Recurring SaaS tools"]);
    rows.push(["Net Profit", String(data.monthlyPnL.netProfit), `${data.monthlyPnL.netMarginPercent}% Net Margin`]);
  }

  const csvContent = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
