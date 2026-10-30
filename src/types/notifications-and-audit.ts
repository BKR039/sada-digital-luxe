// ============================================================
// SADA OS — PHASE 7 & 8 TYPES: ANALYTICS, NOTIFICATIONS & AUDIT
// Canonical type definitions for management reporting, drill-down,
// event-driven notifications, user preferences, and audit logs.
// ============================================================

export type NotificationEventType =
  | "TASK_ASSIGNED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "TASK_DEADLINE"
  | "TASK_ALERT"
  | "MANAGER_MESSAGE"
  | "TASK_REASSIGNED"
  | "TASK_BLOCKED"
  | "TASK_UNBLOCKED"
  | "TASK_REVIEW_REQUESTED"
  | "TASK_REVISION_REQUESTED"
  | "TASK_APPROVED"
  | "TASK_PUBLISHING_HANDOFF"
  | "TASK_PUBLISHED"
  | "CLIENT_APPROVAL_REQUIRED"
  | "INVOICE_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "COMMISSION_ELIGIBLE"
  | "COMMISSION_APPROVED"
  | "SALARY_PAID"
  | "SALARY_REQUEST_PENDING"
  | "PRODUCTION_TOMORROW"
  | "DELIVERABLE_BEHIND"
  | "MONTH_END_CLOSING"
  | "SECURITY_AUDIT"
  | "GENERAL";

export type NotificationCategory =
  | "task"
  | "production"
  | "billing"
  | "finance"
  | "security"
  | "messages"
  | "clients"
  | "system";

export type NotificationSemanticSeverity =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "URGENT"
  | "ERROR"
  | "MESSAGE"
  | "SECURITY";

export type NotificationFunctionalCategory =
  | "TASK"
  | "OPERATIONS"
  | "MESSAGE"
  | "SYSTEM"
  | "SECURITY";

export type NotificationPriorityTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface NotificationGroup {
  groupKey: string;
  eventType: NotificationEventType;
  functionalCategory: NotificationFunctionalCategory;
  semanticSeverity: NotificationSemanticSeverity;
  title: string;
  count: number;
  items: NotificationItem[];
  latestCreatedAt: string;
  unreadCount: number;
  linkUrl?: string | null;
  entityType?: string | null;
}

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type RoleTarget = "all" | "worker" | "admin" | "super_admin";

export interface NotificationItem {
  id: string;
  user_id?: string | null;
  role_target: RoleTarget;
  event_type: NotificationEventType;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  link_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  context_title?: string | null;
  source_module?: string | null;
  metadata?: Record<string, any>;
  i18n_key?: string | null;
  i18n_params?: Record<string, any>;
  read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  task_assigned: boolean;
  task_due_soon: boolean;
  task_overdue: boolean;
  client_approval_required: boolean;
  invoice_overdue: boolean;
  payment_received: boolean;
  commission_eligible: boolean;
  commission_approved: boolean;
  salary_paid: boolean;
  salary_request_pending: boolean;
  production_tomorrow: boolean;
  deliverable_behind: boolean;
  month_end_closing: boolean;
  desktop_push_enabled?: boolean;
  mobile_push_enabled?: boolean;
  messages_enabled?: boolean;
  operations_enabled?: boolean;
  security_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PushSubscriptionRecord {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_type?: "desktop" | "mobile" | "tablet" | "browser" | string;
  user_agent?: string;
  is_active?: boolean;
  created_at?: string;
  last_seen_at?: string;
}


export interface SystemAuditLog {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

// ============================================================
// PHASE 7: MANAGEMENT ANALYTICS & REPORTING TYPES
// ============================================================

export type ClientProfitabilityHealth = "HIGH PROFIT" | "MEDIUM" | "LOW PROFIT" | "NO DATA";

export interface ClientProfitabilityItem {
  clientId: string;
  clientName: string;
  status?: string;
  industry: string;
  packageTitle: string;
  revenue: number;
  invoicedRevenue?: number;
  collectedRevenue?: number;
  contractedRevenue?: number;
  costCompleteness?: "complete" | "incomplete";
  directCosts: number;
  sponsoringCost: number;
  salesCommission: number;
  contributionProfit: number;
  profitMarginPercent: number;
  profitabilityScore: number; // 0-100
  health: ClientProfitabilityHealth;
  paymentStatus: "PAID" | "PENDING" | "OVERDUE";
  deliveryHealth?: "ON_TRACK" | "AT_RISK" | "DELAYED";
  paymentRisk?: "LOW" | "MODERATE" | "HIGH";
  overdueTasksCount?: number;
  invoicesCount: number;
  tasksCount: number;
  actualHours: number;
}

export interface PackageProfitabilityItem {
  packageId: string;
  name: string;
  tier: string;
  sellingPrice: number;
  employeeCost: number;
  freelancerCost: number;
  transportCost: number;
  subscriptionAllocation: number;
  commission: number;
  otherDirectCosts: number;
  grossProfit: number;
  grossMarginPercent: number | null;
  activeSubscriptionsCount: number;
  totalVolumeRevenue: number;
  targetProductionHours: number;
  actualProductionHours: number;
  isIncompleteCostData?: boolean;
  unrecordedCostNotice?: string;
  subscribersList?: Array<{ clientId: string; clientName: string }>;
}

export interface ServiceProfitabilityItem {
  serviceName: string;
  serviceRevenue: number;
  directLaborCost: number;
  allocatedExpenses: number;
  totalDirectCosts: number;
  contributionMargin: number;
  marginPercent: number;
  activeProjectsCount: number;
}

export interface EmployeePerformanceItem {
  teamMemberId: string;
  name: string;
  role: string;
  employmentType: string;
  hourlyRate: number;
  assignedTasks: number;
  completedTasks: number;
  overdueTasks: number;
  actualHours: number;
  estimatedHours: number;
  completionRatePercent: number;
  hoursVariancePercent: number;
  laborCostGenerated: number;
  clientsWorkedCount: number;
  projectsWorkedCount: number;
}

export interface SalesPerformanceReport {
  totalLeads: number;
  qualifiedLeads: number;
  dealsInProgress: number;
  wonDeals: number;
  lostDeals: number;
  conversionRatePercent: number;
  wonPipelineRevenue: number;
  salesCommissionsAccrued: number;
  averageDealSize: number;
  topSalesOwners: Array<{
    teamMemberId: string;
    name: string;
    dealsWon: number;
    revenueWon: number;
    commissions: number;
  }>;
}

export interface ProductionPerformanceReport {
  totalBookings: number;
  completedShoots: number;
  scheduledShoots: number;
  totalShootingHours: number;
  totalEditingHours: number;
  onTimeDeliveryRatePercent: number;
  averageTurnaroundDays: number;
  pipelineStagesBreakdown: Record<string, number>;
}

export interface MonthlyPnLStatement {
  periodMonth: string;
  totalRevenue: number;
  clientServicesRevenue: number;
  sponsoringCollected: number;
  otherRevenue: number;
  cogsDirectCosts: number;
  directLaborCost: number;
  sponsoringPurchasesCost: number;
  salesCommissionsCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: number;
  softwareSubscriptions: number;
  generalOverhead: number;
  operatingProfitEbitda: number;
  netProfit: number;
  netMarginPercent: number;
  prevMonthNetProfit?: number;
  momProfitGrowthPercent?: number | null;
}

export interface CashFlowReport {
  cashInflows: number;
  cashOutflows: number;
  netCashFlow: number;
  currentCashAtBank: number;
  outstandingInvoices: number;
  pendingSalaryAdvanceRequests: number;
  accountBalances: Array<{
    accountId: string;
    accountName: string;
    balance: number;
    currency: string;
  }>;
}

export interface CommissionPerformanceReport {
  totalEligibleServiceRevenue: number;
  sponsoringExcluded: number;
  totalCommissionsAccrued: number;
  commissionsApproved: number;
  commissionsPaid: number;
  commissionsPending: number;
  breakdownByRep: Array<{
    teamMemberId: string;
    name: string;
    dealsCount: number;
    eligibleRevenue: number;
    commissionAmount: number;
    status: string;
  }>;
}

export interface RevenueTrendItem {
  periodMonth: string;
  monthLabel: string;
  serviceRetainers: number;
  sponsoringArbitrage: number;
  digitalProducts: number;
  otherRevenue: number;
  totalRevenue: number;
  totalExpenses?: number;
  netProfit: number;
}

export interface AnalyticsFilterState {
  periodType: "this_month" | "last_month" | "last_30_days" | "this_quarter" | "this_year" | "custom";
  customStartDate?: string;
  customEndDate?: string;
  compareWithPrevious?: boolean;
  clientId?: string;
  employeeId?: string;
  packageId?: string;
  projectId?: string;
}

export interface AnalyticsDrillDownSourceRecord {
  id: string;
  date: string;
  title: string;
  type: string;
  category?: string;
  amount?: number;
  currency?: string;
  status?: string;
  details?: Record<string, any>;
  linkUrl?: string;
}

export interface AnalyticsDrillDownState {
  title: string;
  metricLabel: string;
  metricValue: string | number;
  formula: string;
  recordsCount: number;
  records: AnalyticsDrillDownSourceRecord[];
  entityName?: string;
}

export interface ExecutiveBriefingItem {
  id: string;
  category: "risk" | "loss" | "improvement" | "deterioration" | "client_action" | "opportunity";
  severity: "critical" | "high" | "warning" | "info";
  title: string;
  title_ar: string;
  conciseExplanation: string;
  conciseExplanation_ar: string;
  supportingNumbers: string;
  period: string;
  thresholdOrComparison: string;
  dataCompleteness: "complete" | "partial" | "insufficient";
  recommendedAction: string;
  recommendedAction_ar: string;
  targetUrl: string;
  targetLabel: string;
  targetLabel_ar: string;
}

export interface ExecutiveCommandMetric {
  value: number;
  displayValue: string;
  prevValue?: number;
  deltaPercent?: number | null;
  trend: "up" | "down" | "neutral";
  status: "positive" | "negative" | "warning" | "neutral";
  label: string;
  label_ar: string;
  definition: string;
  definition_ar: string;
  metricType: string;
}

export interface ExecutiveCommandStripData {
  recognizedRevenue: ExecutiveCommandMetric;
  cashCollected: ExecutiveCommandMetric;
  netProfit: ExecutiveCommandMetric;
  contributionMargin: ExecutiveCommandMetric & { marginPercent: number };
  availableCash: ExecutiveCommandMetric & {
    reservedCash: number;
    totalTreasury: number;
    cashTnd?: number;
    cashUsd?: number;
    currencyBreakdown?: string;
  };
  outstandingReceivables: ExecutiveCommandMetric & { overdueCount: number; overdueAmount: number };
  operatingExpenses: ExecutiveCommandMetric & { monthlyBurnRate: number };
  deliveryHealth: ExecutiveCommandMetric & { overdueTasksCount: number; completionRatePercent: number };
}

export interface OperationsIntelligenceData {
  activeClientsCount: number;
  activeProjectsCount: number;
  tasksDueTodayCount: number;
  overdueTasksCount: number;
  upcomingDeadlinesCount: number;
  deliveryCompletionRatePercent: number;
  blockedTasksCount: number;
  awaitingReviewCount: number;
  awaitingPublicationCount: number;
  pipelineStages: {
    planned: number;
    inProduction: number;
    inReview: number;
    approved: number;
    delivered: number;
  };
  teamWorkload: Array<{
    memberId: string;
    name: string;
    role: string;
    assignedCount: number;
    completedCount: number;
    overdueCount: number;
    actualHours: number;
    status: "normal" | "overloaded" | "underutilized";
  }>;
  clientsAtRisk: Array<{
    clientId: string;
    name: string;
    reason: string;
    overdueCount: number;
    unpaidAmount: number;
  }>;
}

export interface FullManagementAnalyticsData {
  period: any;
  filters: AnalyticsFilterState;
  executiveKPIs: ExecutiveCommandStripData;
  briefingItems: ExecutiveBriefingItem[];
  operationsIntelligence: OperationsIntelligenceData;
  clientProfitability: ClientProfitabilityItem[];
  packageProfitability: PackageProfitabilityItem[];
  serviceProfitability: ServiceProfitabilityItem[];
  employeePerformance: EmployeePerformanceItem[];
  salesPerformance: SalesPerformanceReport;
  productionPerformance: ProductionPerformanceReport;
  monthlyPnL: MonthlyPnLStatement;
  cashFlow: CashFlowReport;
  commissionPerformance: CommissionPerformanceReport;
  revenueTrends: RevenueTrendItem[];
  lastRefreshedAt?: string;
  unallocatedRevenue?: number;
  clientAttributedRevenue?: number;
  financeState: any;
  rawLedger: any[];
  rawInvoices: any[];
  rawTasks: any[];
  rawSessions: any[];
  rawDeals: any[];
  rawBookings: any[];
  rawProjects: any[];
}

