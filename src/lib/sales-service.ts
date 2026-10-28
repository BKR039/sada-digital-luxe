// ============================================================
// SADA OS — SALES PIPELINE, PACKAGE & PRODUCTION SERVICE
// Canonical implementation of Phase 3 and Phase 4
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { getBusinessRuleNumber } from "./business-rules-service";
import { resolveAuthoritativeSecurityContext, assertAuthorizedMutation, SecurityAuthorizationError } from "@/lib/security-isolation-service";
import {
  assertActorCanAccessModule,
  canAccessModule,
  canPerformModuleAction,
  can,
  hasPermission,
  canPerformAction,
  normalizeRole,
  type PermissionContext,
  type SadaRole,
} from "@/lib/permissions";
import { logSystemAudit } from "@/lib/audit-service";

/**
 * Authoritatively resolves the sales caller context.
 * Never trusts client-supplied actorRole or actorId.
 */
async function resolveSalesCallerContext(
  explicitCtx?: PermissionContext,
  actorRole?: string,
  actorId?: string
): Promise<{
  userId: string;
  role: string;
  hasSalesAccess: boolean;
  isSuperAdmin: boolean;
  canPerform: (action: string) => boolean;
}> {
  try {
    const authCtx = await assertAuthorizedMutation(supabase, "sales", "sales.view", {
      ctx: explicitCtx,
      actorRole,
      actorId,
    });
    return {
      userId: authCtx.userId,
      role: authCtx.role,
      hasSalesAccess: Boolean(authCtx.effectivePermissions.sales),
      isSuperAdmin: authCtx.role === "super_admin",
      canPerform: (action: string) => {
        if (authCtx.role === "super_admin") return true;
        if (action.includes("delete")) return false; // Permanent delete is strictly super_admin
        const permKey = action.includes(".") ? action : `sales.${action}`;
        return hasPermission(permKey, authCtx.role as SadaRole, authCtx.customOverrides);
      },
    };
  } catch {
    return {
      userId: "",
      role: "worker",
      hasSalesAccess: false,
      isSuperAdmin: false,
      canPerform: () => false,
    };
  }
}

export type DealStage =
  | "lead"
  | "contacted"
  | "qualified"
  | "meeting"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export const STAGE_ORDER: DealStage[] = [
  "lead",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

function isRtl(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";
}

export const STAGE_CONFIG: Record<DealStage, { label: string; color: string; bg: string; border: string }> = {
  lead: {
    get label() { return isRtl() ? "عميل محتمل" : "Lead"; },
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20"
  },
  contacted: {
    get label() { return isRtl() ? "تم التواصل" : "Contacted"; },
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20"
  },
  qualified: {
    get label() { return isRtl() ? "مؤهل" : "Qualified"; },
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20"
  },
  meeting: {
    get label() { return isRtl() ? "اجتماع" : "Meeting"; },
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20"
  },
  proposal: {
    get label() { return isRtl() ? "تقديم العرض" : "Proposal"; },
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20"
  },
  negotiation: {
    get label() { return isRtl() ? "مفاوضات" : "Negotiation"; },
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20"
  },
  won: {
    get label() { return isRtl() ? "تم الإغلاق بنجاح" : "Won"; },
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20"
  },
  lost: {
    get label() { return isRtl() ? "صفقة ملغاة" : "Lost"; },
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20"
  },
};

export interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  services: string[];
  deliverables: Array<{ title: string; type: string; target: number }>;
  target_quantities: {
    reels?: number;
    posts?: number;
    stories?: number;
    ads_campaigns?: number;
    [key: string]: number | undefined;
  };
  production_hours: number;
  employee_cost: number;
  freelancer_cost: number;
  transport_cost: number;
  subscription_allocation: number;
  commission: number;
  direct_costs: number;
  gross_profit: number;
  gross_margin: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Canonical package_catalog SSOT properties
  code?: string;
  package_code?: string;
  category_name?: string;
  category_name_ar?: string | null;
  is_popular?: boolean;
  is_recommended?: boolean;
  billing_type?: string;
  is_published?: boolean;
  price?: number;
  name_ar?: string | null;
  description_ar?: string | null;
}

export interface DealRow {
  id: string;
  title: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company_name: string;
  stage: DealStage;
  client_id: string | null;
  package_id: string | null;
  sales_owner_id: string | null;
  commission_recipient_id: string | null;
  deal_value: number;
  service_revenue: number;
  sponsoring_budget: number;
  commission_rate: number;
  expected_close_date: string | null;
  won_date: string | null;
  lost_reason: string | null;
  contract_agreement: Record<string, any>;
  revenue_config: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  client?: any;
  package?: PackageRow;
  commission_recipient?: any;
  sales_owner?: any;
}

export type DeliverableType = "reel" | "post" | "story" | "ads_campaign" | "video" | "branding" | "other";

export interface ClientDeliverableRow {
  id: string;
  client_id: string;
  package_id: string | null;
  project_id: string | null;
  title: string;
  deliverable_type: DeliverableType;
  period_month: string;
  target_quantity: number;
  done_quantity: number;
  remaining_quantity: number;
  assigned_team_ids: string[];
  deadline: string | null;
  status: "planned" | "in_progress" | "review" | "completed" | "behind_schedule";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskWorkflowState =
  | "todo"
  | "in_progress"
  | "review"
  | "revision"
  | "approved"
  | "delivered"
  | "done"
  | "cancelled";

export const TASK_WORKFLOW_STEPS: TaskWorkflowState[] = [
  "todo",
  "in_progress",
  "review",
  "revision",
  "approved",
  "delivered",
];

export type ProductionStage =
  | "brief"
  | "scheduling"
  | "shooting"
  | "raw_upload"
  | "editing"
  | "review"
  | "client_approval"
  | "delivery_publishing";

export const PRODUCTION_WORKFLOW_STEPS: ProductionStage[] = [
  "brief",
  "scheduling",
  "shooting",
  "raw_upload",
  "editing",
  "review",
  "client_approval",
  "delivery_publishing",
];

export function getProductionStageLabel(stage: ProductionStage): string {
  const rtl = isRtl();
  switch (stage) {
    case "brief": return rtl ? "الموجز الإبداعي" : "Creative Brief";
    case "scheduling": return rtl ? "جدولة المواعيد" : "Scheduling";
    case "shooting": return rtl ? "جلسة التصوير" : "Shooting";
    case "raw_upload": return rtl ? "رفع المواد الخام" : "Raw Upload";
    case "editing": return rtl ? "المونتاج والتعديل" : "Editing";
    case "review": return rtl ? "المراجعة الداخلية" : "Internal Review";
    case "client_approval": return rtl ? "موافقة العميل" : "Client Approval";
    case "delivery_publishing": return rtl ? "التسليم والنشر" : "Delivery & Publishing";
    default: return stage;
  }
}

export interface ProductionBrief {
  shot_list: string[];
  required_reels: number;
  photos: number;
  story_assets: number;
  references: string[];
  equipment: string[];
}

export interface ProductionBookingRow {
  id: string;
  client_id: string;
  deal_id: string | null;
  project_id: string | null;
  package_id: string | null;
  title: string;
  date: string;
  time: string;
  location: string;
  team_member_ids: string[];
  production_type: string;
  duration_hours: number;
  brief: ProductionBrief;
  stage: ProductionStage;
  raw_upload_url: string | null;
  edit_preview_url: string | null;
  client_notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// COMMISSION FORMULA & ELIGIBILITY ENGINE
// ============================================================

export interface CommissionCalculationResult {
  serviceRevenue: number;
  sponsoringBudget: number;
  commissionBase: number;
  commissionRate: number;
  commissionAmount: number;
  isEligible: boolean;
  status: "pending" | "approved" | "cancelled" | "paid";
  rejectionReason?: string;
}

export interface DealCommissionParams {
  serviceRevenue: number;
  sponsoringBudget: number;
  commissionRate?: number;
  dealType?: "initial" | "renewal" | "upsell";
  billingStartDate?: string | Date | null;
  periodMonth?: string;
  invoiceStatus?: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "refunded";
  isRefunded?: boolean;
}

/**
 * Determines the canonical SADA salesperson commission rate based on lifecycle duration:
 * - 15% commission during the first 6 months (initial contract period)
 * - After the initial 6-month period:
 *   - 5% commission on renewal
 *   - 5% commission on upsell
 * - Custom explicit rate allowed if explicitly set by sales leadership
 */
export function determineCommissionRate(params: {
  explicitRate?: number | null;
  dealType?: "initial" | "renewal" | "upsell";
  billingStartDate?: string | Date | null;
  periodMonth?: string;
}): { rate: number; rule: string } {
  // If an explicit custom rate is provided by the sales director/admin, use it
  if (params.explicitRate !== undefined && params.explicitRate !== null && params.explicitRate > 0) {
    return { rate: params.explicitRate, rule: "explicit_custom" };
  }

  // Canonical SADA Business Rules from configuration engine
  const initialRate = getBusinessRuleNumber("initial_commission_rate", 15);
  const initialDuration = getBusinessRuleNumber("initial_commission_duration_months", 6);
  const renewalRate = getBusinessRuleNumber("renewal_commission_rate", 5);
  const upsellRate = getBusinessRuleNumber("upsell_commission_rate", 5);

  if (params.billingStartDate) {
    try {
      const startDate =
        typeof params.billingStartDate === "string"
          ? parseISO(params.billingStartDate)
          : params.billingStartDate;
      const targetDate = params.periodMonth ? parseISO(`${params.periodMonth}-01`) : new Date();
      const diffMonths =
        (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
        (targetDate.getMonth() - startDate.getMonth());

      if (diffMonths >= initialDuration) {
        if (params.dealType === "upsell") {
          return { rate: upsellRate, rule: `upsell_post_${initialDuration}m` };
        }
        return { rate: renewalRate, rule: `renewal_post_${initialDuration}m` };
      } else {
        // Within initial acquisition duration (e.g. first 6 months)
        return { rate: initialRate, rule: `initial_${initialDuration}m_tier` };
      }
    } catch {
      // Fallback to default initial rate
    }
  }

  if (params.dealType === "renewal") {
    return { rate: renewalRate, rule: "renewal_tier" };
  }
  if (params.dealType === "upsell") {
    return { rate: upsellRate, rule: "upsell_tier" };
  }

  // Initial contract period (default from business rules)
  return { rate: initialRate, rule: `initial_${initialRate}_percent` };
}

/**
 * Calculates commission adhering strictly to SADA business rules:
 * 1. Commission applies ONLY to eligible Service Revenue.
 * 2. Sponsoring/ad budget is EXCLUDED from commission base.
 * 3. Initial salesperson commission rate is 15% for the first 6 months.
 * 4. After 6 months: 5% on renewal, 5% on upsell.
 * 5. Commission cannot exceed commissionable service revenue.
 * 6. Unpaid revenue is NOT commission eligible (remains 'pending' until paid).
 * 7. Refunds are excluded (status becomes 'cancelled').
 */
export function calculateDealCommission(params: DealCommissionParams): CommissionCalculationResult {
  const serviceRevenue = Math.max(0, Number(params.serviceRevenue || 0));
  const sponsoringBudget = Math.max(0, Number(params.sponsoringBudget || 0));

  // Resolve canonical commission rate
  let resolvedRate = getBusinessRuleNumber("initial_commission_rate", 15);
  if (params.commissionRate !== undefined && params.commissionRate !== null && params.commissionRate > 0) {
    resolvedRate = params.commissionRate;
  } else {
    resolvedRate = determineCommissionRate({
      explicitRate: params.commissionRate,
      dealType: params.dealType,
      billingStartDate: params.billingStartDate,
      periodMonth: params.periodMonth,
    }).rate;
  }
  const commissionRate = Math.min(100, Math.max(0, resolvedRate));

  // Invariant 1: Base is strictly serviceRevenue, sponsoringBudget is excluded!
  const commissionBase = serviceRevenue;
  const rawCommission = (commissionBase * commissionRate) / 100.0;
  // Invariant 2: Commission cannot exceed commissionable service revenue
  const boundedCommission = Math.min(commissionBase, rawCommission);
  const commissionAmount = Math.round(boundedCommission * 100) / 100;

  const isRefunded = params.isRefunded || params.invoiceStatus === "refunded" || params.invoiceStatus === "cancelled";
  const isPaid = params.invoiceStatus === "paid";

  if (isRefunded) {
    return {
      serviceRevenue,
      sponsoringBudget,
      commissionBase,
      commissionRate,
      commissionAmount: 0,
      isEligible: false,
      status: "cancelled",
      rejectionReason: "Refunded or cancelled invoices are excluded from commission payout",
    };
  }

  if (!isPaid) {
    return {
      serviceRevenue,
      sponsoringBudget,
      commissionBase,
      commissionRate,
      commissionAmount,
      isEligible: false, // Unpaid revenue is not currently eligible for payout
      status: "pending",
      rejectionReason: "Revenue is unpaid; commission is locked in pending status until invoice settlement",
    };
  }

  return {
    serviceRevenue,
    sponsoringBudget,
    commissionBase,
    commissionRate,
    commissionAmount,
    isEligible: true,
    status: "approved",
  };
}

// ============================================================
// PACKAGE ENGINE (Profitability & Margin verification)
// ============================================================

export interface PackageCostsInput {
  sellingPrice: number;
  employeeCost: number;
  freelancerCost: number;
  transportCost: number;
  subscriptionAllocation: number;
  commission: number;
}

export function computePackageProfitability(input: PackageCostsInput) {
  const directCosts =
    input.employeeCost +
    input.freelancerCost +
    input.transportCost +
    input.subscriptionAllocation +
    input.commission;

  const grossProfit = input.sellingPrice - directCosts;
  const grossMargin = input.sellingPrice > 0 ? (grossProfit / input.sellingPrice) * 100 : 0;

  return {
    directCosts,
    grossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
  };
}

// ============================================================
// PIPELINE CRUD & SERVICE OPERATIONS
// ============================================================
// CANONICAL PACKAGE CATALOG MAPPER & PIPELINE QUERIES
// Single Source of Truth: package_catalog
// ============================================================

export function mapCatalogToPackageRow(p: any): PackageRow {
  const directCosts = p.direct_costs ?? (
    (p.employee_cost || 0) +
    (p.freelancer_cost || 0) +
    (p.transport_cost || 0) +
    (p.subscription_allocation || 0) +
    (p.commission || 0)
  );
  const grossProfit = p.gross_profit ?? ((p.price || 0) - directCosts);
  const grossMargin = p.gross_margin ?? (p.price > 0 ? (grossProfit / p.price) * 100 : 0);

  return {
    id: p.id,
    name: p.name,
    name_ar: p.name_ar ?? null,
    description: p.description || p.short_description || null,
    description_ar: p.description_ar || p.short_description_ar || null,
    price: Number(p.price) || 0,
    selling_price: Number(p.price) || 0,
    services: p.platforms || [],
    deliverables: [
      ...(p.monthly_reels > 0 ? [{ title: "Monthly Reels", type: "reel", target: p.monthly_reels }] : []),
      ...(p.monthly_posts > 0 ? [{ title: "Monthly Posts", type: "post", target: p.monthly_posts }] : []),
      ...(p.production_sessions > 0 ? [{ title: "Production Sessions", type: "video", target: p.production_sessions }] : []),
      ...(p.has_website ? [{ title: "Digital Platform / Website", type: "branding", target: 1 }] : []),
    ],
    target_quantities: {
      reels: p.target_quantities?.reels ?? (p.monthly_reels || 0),
      posts: p.target_quantities?.posts ?? (p.monthly_posts || 0),
      stories: p.target_quantities?.stories ?? (parseInt(p.monthly_stories || "0", 10) || 0),
      ads_campaigns: p.target_quantities?.ads_campaigns ?? (p.has_ads_management ? 4 : 0),
    },
    production_hours: p.production_hours || 0,
    employee_cost: p.employee_cost || 0,
    freelancer_cost: p.freelancer_cost || 0,
    transport_cost: p.transport_cost || 0,
    subscription_allocation: p.subscription_allocation || 0,
    commission: p.commission || 0,
    direct_costs: directCosts,
    gross_profit: grossProfit,
    gross_margin: grossMargin,
    is_active: p.is_active ?? true,
    is_published: p.is_published ?? true,
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || new Date().toISOString(),
    // Augmented catalog properties for Deals Combobox
    code: p.code || "PKG",
    package_code: p.code || "PKG",
    category_name: p.category?.name || p.category_name,
    category_name_ar: p.category?.name_ar || p.category_name_ar,
    is_popular: p.badge === "most_popular" || p.is_featured,
    is_recommended: p.badge === "recommended",
    billing_type: p.billing_type || "monthly",
  } as PackageRow;
}

export async function fetchPackages(): Promise<PackageRow[]> {
  const { data, error } = await (supabase as any)
    .from("package_catalog")
    .select("*, category:package_categories(name, name_ar, slug)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[fetchPackages] Error fetching packages from package_catalog:", error);
    return [];
  }
  return (data || []).map(mapCatalogToPackageRow);
}

export async function fetchDeals(
  stageFilterOrOptions?: DealStage | { ctx?: PermissionContext; client?: any; includeClientDetails?: boolean },
  options?: { ctx?: PermissionContext; client?: any; includeClientDetails?: boolean }
): Promise<DealRow[]> {
  const isOptionsFirst = typeof stageFilterOrOptions === "object" && stageFilterOrOptions !== null;
  const stageFilter: DealStage | undefined = isOptionsFirst ? undefined : (stageFilterOrOptions as DealStage | undefined);
  const opts = isOptionsFirst ? stageFilterOrOptions : options;
  const db = opts?.client || supabase;

  if (opts?.ctx) {
    const hasView = can(opts.ctx, "sales.view");
    if (!hasView) {
      throw new Error("Unauthorized: Access to module 'sales' is disabled for this account.");
    }
  }

  let query = (db as any)
    .from("deals")
    .select(`
      *,
      client:clients(id, name, email, phone, status),
      commission_recipient:team_members(id, name, role, email)
    `)
    .order("created_at", { ascending: false });

  if (stageFilter) {
    query = query.eq("stage", stageFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching deals:", error);
    return [];
  }
  const deals: DealRow[] = data || [];
  if (deals.length === 0) return [];

  const packageIds = Array.from(new Set(deals.map((d: any) => d.package_id).filter(Boolean)));
  if (packageIds.length > 0) {
    const { data: catPkgs } = await (db as any)
      .from("package_catalog")
      .select("*, category:package_categories(name)")
      .in("id", packageIds);

    const pkgMap = new Map<string, PackageRow>((catPkgs || []).map((p: any) => [p.id, mapCatalogToPackageRow(p)]));
    for (const d of deals) {
      if (d.package_id && pkgMap.has(d.package_id)) {
        const found = pkgMap.get(d.package_id);
        if (found) {
          d.package = found;
        }
      }
    }
  }

  return deals;
}

export async function createDeal(input: {
  title: string;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage?: DealStage;
  packageId?: string;
  serviceRevenue: number;
  dealValue?: number;
  sponsoringBudget?: number;
  commissionRate?: number;
  commissionRecipientId?: string;
  salesOwnerId?: string;
  expectedCloseDate?: string;
  notes?: string;
  contractAgreement?: Record<string, any>;
  actorRole?: string;
  ctx?: PermissionContext;
  client?: any;
  clientOverride?: any;
}): Promise<DealRow | null> {
  const activeClient = input.clientOverride || input.client || supabase;
  const authCtx = await assertAuthorizedMutation(activeClient, "sales", "sales.create_lead", {
    ctx: input.ctx,
    actorRole: input.actorRole,
    resourceType: "sales_lead",
    resourceAction: "write",
  });

  // Workers must not forge sales_owner_id; force to their authoritative userId
  const salesOwnerId = authCtx.role === "worker"
    ? (authCtx.userId || null)
    : (input.salesOwnerId || authCtx.userId || null);

  const stage = input.stage || "lead";
  const serviceRevenue = Number(input.serviceRevenue) || 0;
  const sponsoringBudget = Number(input.sponsoringBudget) || 0;
  const dealValue = input.dealValue !== undefined ? Number(input.dealValue) : (serviceRevenue + sponsoringBudget);
  const commissionRate = Number(input.commissionRate) || 15;

  const { data, error } = await (activeClient as any)
    .from("deals")
    .insert({
      title: input.title,
      company_name: input.companyName,
      contact_name: input.contactName || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
      stage,
      package_id: input.packageId || null,
      deal_value: dealValue,
      service_revenue: serviceRevenue,
      sponsoring_budget: sponsoringBudget,
      commission_rate: commissionRate,
      commission_recipient_id: input.commissionRecipientId || null,
      sales_owner_id: salesOwnerId,
      expected_close_date: input.expectedCloseDate || null,
      notes: input.notes || null,
      contract_agreement: input.contractAgreement || {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating deal:", error);
    throw error;
  }

  if (data && data.package_id) {
    const { data: catPkg } = await (supabase as any)
      .from("package_catalog")
      .select("*, category:package_categories(name)")
      .eq("id", data.package_id)
      .maybeSingle();
    if (catPkg) {
      data.package = mapCatalogToPackageRow(catPkg);
    }
  }

  return data;
}

export interface UpdateLeadStageParams {
  leadId: string;
  newStage: DealStage;
  fromStage?: DealStage;
  lostReason?: string;
  actorCtx?: PermissionContext;
  actorRole?: string | null;
  actorId?: string;
  actorName?: string;
  idempotencyKey?: string;
  client?: any;
}

export interface UpdateLeadStageResult {
  success: boolean;
  updatedDeal?: DealRow;
  previousStage?: DealStage;
  newStage?: DealStage;
  error?: string;
}

/**
 * Mutation pipeline for updating a lead / deal stage.
 * Execution boundary & Hardening:
 * 1. Client-Side Advisory Pre-check: validates stage enum and checks actor context for fast UX feedback.
 * 2. Authoritative Authorization Boundary: enforced at the PostgreSQL database level via Row Level
 *    Security (RLS) on public.deals (public.is_admin(auth.uid()) OR sales_owner_id = auth.uid()).
 *    Client-supplied actorRole is NOT trusted by the database; only cryptographically verified JWT identity
 *    governs database mutations.
 * 3. Atomic Optimistic Concurrency Control (OCC): updates are conditioned on the expected stage
 *    (WHERE id = $1 AND stage = $2), guaranteeing concurrent mutations cannot silently overwrite each other.
 * 4. System Audit Trail: non-fatal, best-effort logging in public.system_audit_logs to prevent secondary
 *    telemetry failures from rolling back valid primary business transactions.
 */
export async function updateLeadStage(
  params: UpdateLeadStageParams
): Promise<UpdateLeadStageResult> {
  const { leadId, newStage, fromStage } = params;
  const db = params.client || supabase;

  // 1. Stage validation
  if (!leadId) {
    return { success: false, error: "Missing required parameter: leadId" };
  }
  if (!STAGE_ORDER.includes(newStage)) {
    return {
      success: false,
      error: `Invalid stage: "${newStage}". Allowed stages are: ${STAGE_ORDER.join(", ")}`,
    };
  }

  try {
    // 2. Authoritative authorization check for sales.change_stage action capability
    const authCtx = await assertAuthorizedMutation(db, "sales", "sales.change_stage", {
      ctx: params.actorCtx,
      actorRole: params.actorRole || undefined,
      actorId: params.actorId,
    });

    // 2b. Fetch existing deal
    let existingDeal: any = null;
    const { data: clientDeal, error: fetchErr } = await (db as any)
      .from("deals")
      .select("*, client:clients(id, name, email, phone, status)")
      .eq("id", leadId)
      .maybeSingle();

    if (clientDeal) {
      existingDeal = clientDeal;
    } else {
      const { data: globalDeal } = await (supabase as any)
        .from("deals")
        .select("*, client:clients(id, name, email, phone, status)")
        .eq("id", leadId)
        .maybeSingle();

      if (globalDeal) {
        existingDeal = globalDeal;
      }
    }

    if (fetchErr && !existingDeal) {
      return { success: false, error: fetchErr.message };
    }
    if (!existingDeal) {
      if (authCtx.role === "worker") {
        return {
          success: false,
          error: `Data Scope Violation: Worker cannot modify deals assigned to other sales representatives or outside scope.`,
        };
      }
      return { success: false, error: `Deal with ID "${leadId}" not found.` };
    }

    // 3. Authoritative authorization check with resource data scope
    await assertAuthorizedMutation(db, "sales", "sales.change_stage", {
      ctx: params.actorCtx,
      actorRole: params.actorRole || undefined,
      actorId: params.actorId,
      resourceType: "sales_deal",
      resource: existingDeal,
      resourceAction: "write",
    });

    const previousStage = existingDeal.stage as DealStage;

    // 4. Idempotency check: if already at target stage, return success immediately
    if (previousStage === newStage) {
      return {
        success: true,
        updatedDeal: existingDeal,
        previousStage,
        newStage,
      };
    }

    // 4b. Optimistic Concurrency Check: If client supplied fromStage and it differs from current DB stage
    if (fromStage && previousStage !== fromStage) {
      return {
        success: false,
        error: `Conflict: Deal stage has been concurrently modified from "${fromStage}" to "${previousStage}". Please refresh.`,
      };
    }

    // 5. Update payload
    const updatePayload: Record<string, any> = {
      stage: newStage,
      updated_at: new Date().toISOString(),
    };

    if (newStage !== "won") {
      updatePayload.won_date = null;
    }
    if (newStage === "lost" && params.lostReason) {
      updatePayload.lost_reason = params.lostReason;
    }

    // 5b. Atomic Database-Level Optimistic Concurrency Control (OCC)
    // Condition the UPDATE on the expected stage so concurrent writes cannot overwrite stale state
    const expectedStage = fromStage || previousStage;
    let updateQuery = (db as any)
      .from("deals")
      .update(updatePayload)
      .eq("id", leadId);

    if (expectedStage) {
      updateQuery = updateQuery.eq("stage", expectedStage);
    }

    const { data: updatedDeal, error: updateErr } = await updateQuery
      .select("*, client:clients(id, name, email, phone, status)")
      .maybeSingle();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updatedDeal) {
      return {
        success: false,
        error: `Conflict: Deal stage was concurrently modified by another process. Mutation aborted to prevent stale overwrite.`,
      };
    }

    // 6. System audit logging (non-fatal, best-effort telemetry)
    try {
      await logSystemAudit({
        action: "DEAL_STAGE_CHANGE",
        entityType: "deal",
        entityId: leadId,
        actorId: params.actorId || params.actorCtx?.userId || null,
        actorName: params.actorName || "Sales User",
        actorRole: authCtx.role || "admin",
        oldValues: { stage: previousStage },
        newValues: { stage: newStage },
        client: db,
      });
    } catch (auditErr) {
      console.warn("[updateLeadStage] Audit logging notice:", auditErr);
    }

    return {
      success: true,
      updatedDeal,
      previousStage,
      newStage,
    };
  } catch (err: any) {
    console.error("[updateLeadStage] Error:", err);
    return {
      success: false,
      error: err.message || "Failed to update lead stage.",
    };
  }
}

export async function updateDealStage(
  dealId: string,
  newStage: DealStage,
  extra?: {
    fromStage?: DealStage;
    lostReason?: string;
    actorRole?: string;
    actorCtx?: PermissionContext;
    actorId?: string;
    actorName?: string;
    client?: any;
  }
): Promise<boolean> {
  const res = await updateLeadStage({
    leadId: dealId,
    newStage,
    fromStage: extra?.fromStage,
    lostReason: extra?.lostReason,
    actorRole: extra?.actorRole,
    actorCtx: extra?.actorCtx,
    actorId: extra?.actorId,
    actorName: extra?.actorName,
    client: extra?.client,
  });
  return res.success;
}

// ============================================================
// Phase H: Canonical Deal Definition Update (sales.edit_lead)
// ============================================================
export async function updateDeal(
  dealId: string,
  updates: Partial<{
    title: string;
    companyName: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    packageId: string | null;
    serviceRevenue: number;
    sponsoringBudget: number;
    dealValue: number;
    commissionRate: number;
    commissionRecipientId: string | null;
    salesOwnerId: string | null;
    expectedCloseDate: string | null;
    notes: string | null;
  }>,
  options?: {
    ctx?: PermissionContext;
    actorRole?: string;
    actorId?: string;
    client?: any;
    clientOverride?: any;
  }
): Promise<DealRow> {
  const db = options?.clientOverride || options?.client || supabase;

  // 1. Authoritative mutation authorization check for sales.edit_lead action capability
  const authCtx = await assertAuthorizedMutation(db, "sales", "sales.edit_lead", {
    ctx: options?.ctx,
    actorRole: options?.actorRole,
    actorId: options?.actorId,
  });

  // 2. Fetch existing deal
  let existingDeal: any = null;
  const { data: clientDeal, error: fetchErr } = await (db as any)
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (clientDeal) {
    existingDeal = clientDeal;
  } else {
    // If not visible to caller client (e.g. worker client due to RLS), check if deal exists system-wide to enforce worker data scope violation
    const { data: globalDeal } = await (supabase as any)
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .maybeSingle();

    if (globalDeal) {
      existingDeal = globalDeal;
    }
  }

  if (fetchErr && !existingDeal) {
    throw new Error(`Deal "${dealId}" not found: ${fetchErr?.message || "Not found"}`);
  }
  if (!existingDeal) {
    if (authCtx.role === "worker") {
      throw new SecurityAuthorizationError(
        `Worker data scope isolation: Deal "${dealId}" is outside authorized scope or does not exist.`,
        "DATA_SCOPE_VIOLATION",
        { dealId, actorId: authCtx.userId }
      );
    }
    throw new Error(`Deal "${dealId}" not found`);
  }

  // 3. Authoritative authorization check for sales.edit_lead with resource data scope
  await assertAuthorizedMutation(db, "sales", "sales.edit_lead", {
    ctx: options?.ctx,
    actorRole: options?.actorRole,
    actorId: options?.actorId,
    resourceType: "sales_deal",
    resource: existingDeal,
    resourceAction: "write",
  });

  // 3. Build payload
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.companyName !== undefined) payload.company_name = updates.companyName.trim();
  if (updates.contactName !== undefined) payload.contact_name = updates.contactName ? updates.contactName.trim() : null;
  if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail ? updates.contactEmail.trim() : null;
  if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone ? updates.contactPhone.trim() : null;
  if (updates.packageId !== undefined) payload.package_id = updates.packageId || null;
  if (updates.serviceRevenue !== undefined) payload.service_revenue = Number(updates.serviceRevenue) || 0;
  if (updates.sponsoringBudget !== undefined) payload.sponsoring_budget = Number(updates.sponsoringBudget) || 0;

  if (updates.dealValue !== undefined) {
    payload.deal_value = Number(updates.dealValue) || 0;
  } else if (updates.serviceRevenue !== undefined || updates.sponsoringBudget !== undefined) {
    const sRev = updates.serviceRevenue !== undefined ? Number(updates.serviceRevenue) : Number(existingDeal.service_revenue || 0);
    const sBud = updates.sponsoringBudget !== undefined ? Number(updates.sponsoringBudget) : Number(existingDeal.sponsoring_budget || 0);
    payload.deal_value = sRev + sBud;
  }

  if (updates.commissionRate !== undefined) payload.commission_rate = Number(updates.commissionRate) || 15;
  if (updates.commissionRecipientId !== undefined) payload.commission_recipient_id = updates.commissionRecipientId || null;
  if (updates.expectedCloseDate !== undefined) payload.expected_close_date = updates.expectedCloseDate || null;
  if (updates.notes !== undefined) payload.notes = updates.notes ? updates.notes.trim() : null;

  // Workers cannot forge salesOwnerId
  if (updates.salesOwnerId !== undefined && authCtx.role !== "worker") {
    payload.sales_owner_id = updates.salesOwnerId || null;
  }

  const { data: updatedDeal, error: updateErr } = await (db as any)
    .from("deals")
    .update(payload)
    .eq("id", dealId)
    .select("*, client:clients(id, name, email, phone, status)")
    .single();

  if (updateErr) {
    console.error("[updateDeal] Error updating deal:", updateErr);
    throw updateErr;
  }

  // 4. System audit log (best-effort)
  try {
    await logSystemAudit({
      action: "DEAL_UPDATED",
      entityType: "deal",
      entityId: dealId,
      actorId: options?.actorId || options?.ctx?.userId || authCtx.userId,
      actorRole: authCtx.role,
      oldValues: existingDeal,
      newValues: updatedDeal,
      client: db,
    });
  } catch (auditErr) {
    console.warn("[updateDeal] Audit logging notice:", auditErr);
  }

  return updatedDeal;
}

// ============================================================
// CANONICAL DEAL -> WON TRANSITION ENGINE (sales.convert_lead)
// ============================================================

export interface WinDealResult {
  deal: DealRow;
  client: any;
  package: PackageRow;
  invoice: any;
  commission: any;
  deliverables: ClientDeliverableRow[];
  project: any;
  tasks: any[];
}

export async function convertLeadToSale(params: {
  dealId: string;
  clientId: string;
  packageId?: string;
  saleAmount: number;
  sponsoringAmount?: number;
  paymentStatus?: "unpaid" | "partially_paid" | "paid";
  saleDate?: string;
  notes?: string;
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  client?: any;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const db = params.clientOverride || params.client || supabase;
  try {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // 0a. Strict validation: dealId must be a valid UUID
    if (!params.dealId || typeof params.dealId !== "string" || !UUID_REGEX.test(params.dealId.trim())) {
      return {
        success: false,
        error: "Invalid or missing dealId. Must be a valid canonical UUID.",
      };
    }

    // 0b. Strict validation: clientId is mandatory and must be a valid canonical UUID
    if (!params.clientId || typeof params.clientId !== "string" || !params.clientId.trim() || !UUID_REGEX.test(params.clientId.trim())) {
      return {
        success: false,
        error: "A valid SADA Client ID (UUID) is required to convert a lead and record sales commission.",
      };
    }

    const cleanDealId = params.dealId.trim();
    const cleanClientId = params.clientId.trim();

    // 0c. Validate canonical client existence in public.clients before any write operations
    const { data: clientRecord, error: clientErr } = await (db as any)
      .from("clients")
      .select("id, name")
      .eq("id", cleanClientId)
      .maybeSingle();

    if (clientErr || !clientRecord) {
      return {
        success: false,
        error: `Selected SADA Client (${cleanClientId}) does not exist or is inaccessible.`,
      };
    }

    // 1. Authoritative authorization check for sales.convert_lead action capability
    await assertAuthorizedMutation(db, "sales", "sales.convert_lead", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
    });

    // 1b. Fetch existing deal for worker data scope isolation
    let existingDeal: any = null;
    const { data: clientDeal } = await (db as any)
      .from("deals")
      .select("*")
      .eq("id", cleanDealId)
      .maybeSingle();

    if (clientDeal) {
      existingDeal = clientDeal;
    } else {
      const { data: globalDeal } = await (supabase as any)
        .from("deals")
        .select("*")
        .eq("id", cleanDealId)
        .maybeSingle();

      if (globalDeal) {
        existingDeal = globalDeal;
      }
    }

    if (!existingDeal) {
      return {
        success: false,
        error: `Deal ${cleanDealId} not found or inaccessible.`,
      };
    }

    // Guard: Prevent duplicate conversion if deal is already won and commission recorded
    if (existingDeal.stage === "won") {
      const { data: existingComm } = await (db as any)
        .from("sales_commissions")
        .select("id")
        .eq("deal_id", cleanDealId)
        .maybeSingle();

      if (existingComm) {
        return {
          success: true,
          data: {
            deal_id: cleanDealId,
            commission_id: existingComm.id,
            alreadyConverted: true,
          },
        };
      }
    }

    await assertAuthorizedMutation(db, "sales", "sales.convert_lead", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "sales_deal",
      resource: existingDeal,
      resourceAction: "write",
    });

    // 2. Call transactional database RPC (single atomic transaction boundary)
    const { data, error } = await (db as any).rpc("convert_lead_to_sale", {
      p_deal_id: cleanDealId,
      p_client_id: cleanClientId,
      p_package_id: params.packageId || null,
      p_sale_amount: Number(params.saleAmount),
      p_sponsoring_amount: Number(params.sponsoringAmount || 0),
      p_payment_status: params.paymentStatus || "paid",
      p_sale_date: params.saleDate || format(new Date(), "yyyy-MM-dd"),
      p_notes: params.notes ? params.notes.trim() : null,
    });

    if (error) throw error;

    // 3. System audit logging
    try {
      await logSystemAudit({
        action: "DEAL_CONVERTED_TO_SALE",
        entityType: "deal",
        entityId: cleanDealId,
        actorId: params.actorId || params.ctx?.userId || null,
        actorRole: params.actorRole || "admin",
        newValues: {
          clientId: cleanClientId,
          packageId: params.packageId,
          saleAmount: params.saleAmount,
          sponsoringAmount: params.sponsoringAmount,
          paymentStatus: params.paymentStatus,
        },
        client: db,
      });
    } catch (auditErr) {
      console.warn("[convertLeadToSale] Audit logging notice:", auditErr);
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("[convertLeadToSale] Error:", err);
    return { success: false, error: err.message || "Failed to convert lead to sale" };
  }
}

export async function winDeal(dealId: string, options?: {
  immediatePaid?: boolean;
  customBillingStartDate?: string;
  leadMemberId?: string;
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  client?: any;
  clientOverride?: any;
}): Promise<WinDealResult> {
  const activeClient = options?.clientOverride || options?.client || supabase;

  // 1. Fetch deal with recipient
  const { data: deal, error: dealErr } = await (activeClient as any)
    .from("deals")
    .select("*, commission_recipient:team_members(id, name, role, email)")
    .eq("id", dealId)
    .single();

  if (dealErr || !deal) {
    throw new Error(`Deal ${dealId} not found: ${dealErr?.message}`);
  }

  // Authoritative authorization check
  await assertAuthorizedMutation(activeClient, "sales", "sales.convert_lead", {
    ctx: options?.ctx,
    actorRole: options?.actorRole,
    actorId: options?.actorId,
    resourceType: "sales_deal",
    resource: deal,
    resourceAction: "write",
  });

  // 2. Fetch package from canonical package_catalog
  let pkg: PackageRow | null = null;
  if (deal.package_id) {
    const { data: pData } = await (supabase as any)
      .from("package_catalog")
      .select("*, category:package_categories(name)")
      .eq("id", deal.package_id)
      .maybeSingle();
    if (pData) {
      pkg = mapCatalogToPackageRow(pData);
    }
  }
  if (!pkg) {
    // Pick standard package from canonical package_catalog
    const { data: pFallback } = await (supabase as any)
      .from("package_catalog")
      .select("*, category:package_categories(name, name_ar, slug)")
      .eq("is_active", true)
      .order("price", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pFallback) {
      pkg = mapCatalogToPackageRow(pFallback);
    }
  }

  if (!pkg) {
    throw new Error("No package available to link to winning deal.");
  }

  const currentPeriod = format(new Date(), "yyyy-MM");
  const billingStartDate = options?.customBillingStartDate || format(new Date(), "yyyy-MM-01");

  // 3. Resolve or Create Client
  let clientId = deal.client_id;
  let clientRecord: any = null;

  if (clientId) {
    const { data: existingClient } = await (supabase as any).from("clients").select("*").eq("id", clientId).single();
    clientRecord = existingClient;
  }

  if (!clientRecord && deal.contact_email) {
    // Check if client exists with same email
    const { data: existingByEmail } = await (supabase as any)
      .from("clients")
      .select("*")
      .eq("email", deal.contact_email)
      .maybeSingle();
    if (existingByEmail) {
      clientRecord = existingByEmail;
      clientId = clientRecord.id;
    }
  }

  if (!clientRecord) {
    // Create new Client
    const targetQuantities = pkg.target_quantities || { reels: 8, posts: 8, stories: 20, ads_campaigns: 4 };

    const { data: newClient, error: clientErr } = await (supabase as any)
      .from("clients")
      .insert({
        name: deal.company_name,
        contact_name: deal.contact_name || deal.company_name,
        email: deal.contact_email,
        phone: deal.contact_phone,
        status: "active",
        client_type: "monthly",
        package_id: pkg.id,
        package_name: pkg.name,
        package_config: targetQuantities,
        billing_start_date: billingStartDate,
        current_period_month: currentPeriod,
        monthly_package_price: deal.service_revenue || pkg.selling_price,
        default_service_fee: deal.service_revenue || pkg.selling_price,
        default_sponsoring_budget: deal.sponsoring_budget || 0,
        commission_rate: deal.commission_rate || 15,
        commission_recipient_id: deal.commission_recipient_id,
        sales_owner_id: deal.sales_owner_id,
        relationship_owner_id: deal.sales_owner_id,
        notes: `Converted from Sales Pipeline Deal "${deal.title}".`,
      })
      .select("*")
      .single();

    if (clientErr) {
      throw new Error(`Failed to create client from deal: ${clientErr.message}`);
    }
    clientRecord = newClient;
    clientId = newClient.id;
  } else {
    // Determine stepping commission rate based on client contract duration
    const steppingRate = determineCommissionRate({
      explicitRate: deal.commission_rate,
      dealType: "renewal",
      billingStartDate: clientRecord.billing_start_date,
      periodMonth: currentPeriod,
    }).rate;

    // Update existing client with package details
    await (supabase as any)
      .from("clients")
      .update({
        package_id: pkg.id,
        package_name: pkg.name,
        package_config: pkg.target_quantities,
        monthly_package_price: deal.service_revenue || pkg.selling_price,
        default_service_fee: deal.service_revenue || pkg.selling_price,
        default_sponsoring_budget: deal.sponsoring_budget || 0,
        commission_rate: steppingRate,
        commission_recipient_id: deal.commission_recipient_id || clientRecord.commission_recipient_id,
        status: "active",
      })
      .eq("id", clientId);
  }

  // 4. Create Contract / Recurring Agreement
  const contractAgreement = {
    deal_id: deal.id,
    package_name: pkg.name,
    package_id: pkg.id,
    billing_start_date: billingStartDate,
    service_revenue: deal.service_revenue || pkg.selling_price,
    sponsoring_budget: deal.sponsoring_budget || 0,
    total_monthly_value: (deal.service_revenue || pkg.selling_price) + (deal.sponsoring_budget || 0),
    terms: "Monthly recurring retainer agreement with deliverable allocations and creative production.",
    created_at: new Date().toISOString(),
  };

  // 5. Connect to Financial OS: Generate Invoice (Revenue Configuration)
  const isPaid = Boolean(options?.immediatePaid);
  const serviceRev = Number(deal.service_revenue || pkg.selling_price);
  const sponsoringBud = Number(deal.sponsoring_budget || 0);
  const totalAmount = serviceRev + sponsoringBud;
  const invoiceNumber = `INV-${format(new Date(), "yyyyMM")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const invoiceItems = [
    {
      description: `${pkg.name} — Service Retainer (${currentPeriod})`,
      amount: serviceRev,
      type: "service",
    },
  ];

  if (sponsoringBud > 0) {
    invoiceItems.push({
      description: `Meta & TikTok Ads Sponsoring Budget (${currentPeriod})`,
      amount: sponsoringBud,
      type: "sponsoring",
    });
  }

  const { data: invoice, error: invErr } = await (supabase as any)
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      client_id: clientId,
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      service_revenue: serviceRev,
      sponsoring_budget: sponsoringBud,
      other_revenue: 0,
      subtotal: totalAmount,
      tax_amount: 0,
      total_amount: totalAmount,
      paid_amount: isPaid ? totalAmount : 0,
      status: isPaid ? "paid" : "sent",
      items: invoiceItems,
      currency: "TND",
      notes: `Generated upon winning sales deal: ${deal.title}`,
    })
    .select("*")
    .single();

  if (invErr) {
    console.error("Failed to generate invoice for won deal:", invErr);
  }

  // 6. Connect to Financial OS: Generate Commission Record (Commission Configuration)
  // RULE: Commission applies ONLY to Service Revenue. Sponsoring is strictly excluded.
  // RULE: 15% for initial 6 months; 5% for renewal/upsell after initial 6 months.
  // RULE: If unpaid, status is 'pending' (unpaid revenue is not commission eligible).
  let commissionRecord = null;
  const recipientId = deal.commission_recipient_id || clientRecord?.commission_recipient_id;

  if (recipientId) {
    const rateCalc = determineCommissionRate({
      explicitRate: deal.commission_rate,
      dealType: clientRecord?.billing_start_date ? "renewal" : "initial",
      billingStartDate: clientRecord?.billing_start_date || billingStartDate,
      periodMonth: currentPeriod,
    });

    const commCalc = calculateDealCommission({
      serviceRevenue: serviceRev,
      sponsoringBudget: sponsoringBud,
      commissionRate: rateCalc.rate,
      dealType: clientRecord?.billing_start_date ? "renewal" : "initial",
      billingStartDate: clientRecord?.billing_start_date || billingStartDate,
      periodMonth: currentPeriod,
      invoiceStatus: isPaid ? "paid" : "sent",
    });

    // Check for duplicate commission before inserting
    if (invoice?.id) {
      const { data: existingComm } = await (supabase as any)
        .from("sales_commissions")
        .select("*")
        .eq("invoice_id", invoice.id)
        .maybeSingle();

      if (existingComm) {
        commissionRecord = existingComm;
      }
    }

    if (!commissionRecord) {
      const { data: commData, error: commErr } = await (supabase as any)
        .from("sales_commissions")
        .insert({
          team_member_id: recipientId,
          client_id: clientId,
          invoice_id: invoice?.id || null,
          service_revenue: commCalc.serviceRevenue, // Invariant: ONLY service revenue
          commission_rate: commCalc.commissionRate,
          commission_amount: commCalc.commissionAmount,
          period_month: currentPeriod,
          status: commCalc.status, // 'pending' if unpaid, 'approved' if paid
          notes: `Sales commission for deal ${deal.title} (${rateCalc.rule}; Sponsoring budget of ${sponsoringBud} TND strictly excluded).`,
        })
        .select("*")
        .single();

      if (commErr) {
        console.error("Failed to record sales commission:", commErr);
      }
      commissionRecord = commData;
    }
  }

  // 7. Phase 4: Generate Client Deliverables from Package
  // Example: 8 Reels, 8 Posts, 20 Stories, 4 Ads Campaigns
  const deliverablesToInsert: Array<{
    client_id: string;
    package_id: string;
    title: string;
    deliverable_type: DeliverableType;
    period_month: string;
    target_quantity: number;
    done_quantity: number;
    status: "planned";
    deadline: string;
  }> = [];

  const endOfMonthDeadline = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

  const targetQuantities = pkg.target_quantities || {
    reels: 8,
    posts: 8,
    stories: 20,
    ads_campaigns: 4,
  };

  if ((targetQuantities.reels || 0) > 0) {
    deliverablesToInsert.push({
      client_id: clientId,
      package_id: pkg.id,
      title: `${targetQuantities.reels} Reels`,
      deliverable_type: "reel",
      period_month: currentPeriod,
      target_quantity: targetQuantities.reels || 8,
      done_quantity: 0,
      status: "planned",
      deadline: endOfMonthDeadline,
    });
  }

  if ((targetQuantities.posts || 0) > 0) {
    deliverablesToInsert.push({
      client_id: clientId,
      package_id: pkg.id,
      title: `${targetQuantities.posts} Posts`,
      deliverable_type: "post",
      period_month: currentPeriod,
      target_quantity: targetQuantities.posts || 8,
      done_quantity: 0,
      status: "planned",
      deadline: endOfMonthDeadline,
    });
  }

  if ((targetQuantities.stories || 0) > 0) {
    deliverablesToInsert.push({
      client_id: clientId,
      package_id: pkg.id,
      title: `${targetQuantities.stories} Stories`,
      deliverable_type: "story",
      period_month: currentPeriod,
      target_quantity: targetQuantities.stories || 20,
      done_quantity: 0,
      status: "planned",
      deadline: endOfMonthDeadline,
    });
  }

  if ((targetQuantities.ads_campaigns || 0) > 0) {
    deliverablesToInsert.push({
      client_id: clientId,
      package_id: pkg.id,
      title: `${targetQuantities.ads_campaigns} Ads Campaigns`,
      deliverable_type: "ads_campaign",
      period_month: currentPeriod,
      target_quantity: targetQuantities.ads_campaigns || 4,
      done_quantity: 0,
      status: "planned",
      deadline: endOfMonthDeadline,
    });
  }

  const { data: createdDeliverables, error: delivErr } = await (supabase as any)
    .from("client_deliverables")
    .insert(deliverablesToInsert)
    .select("*");

  if (delivErr) {
    console.error("Failed to generate deliverables:", delivErr);
  }

  // 8. Create Dedicated Operational Project Workspace
  const { data: workspace, error: wsErr } = await (supabase as any)
    .from("client_projects")
    .insert({
      client_id: clientId,
      client_name: clientRecord.name,
      title: `${clientRecord.name} — Operational Workspace (${pkg.name})`,
      status: "active",
      lead_id: options?.leadMemberId || null,
      deadline: endOfMonthDeadline,
      description: `Primary delivery environment for ${clientRecord.name}. Managed under package ${pkg.name}.`,
    })
    .select("*")
    .single();

  if (wsErr) {
    console.error("Failed to create operational workspace:", wsErr);
  }

  // 9. Generate Initial Canonical Tasks linked to Package & Deliverables
  // Tasks adhere to: TO DO -> IN PROGRESS -> REVIEW -> REVISION -> APPROVED -> DELIVERED
  const tasksToInsert: any[] = [];
  const createdDelivList: ClientDeliverableRow[] = createdDeliverables || [];

  for (const deliv of createdDelivList) {
    tasksToInsert.push({
      client_id: clientId,
      project_id: workspace?.id || null,
      package_id: pkg.id,
      deliverable_id: deliv.id,
      title: `Execute & Produce: ${deliv.title}`,
      description: `Production deliverable batch for ${deliv.title} (${currentPeriod}). Track revisions and milestones.`,
      status: "todo",
      priority: "high",
      deadline: deliv.deadline || endOfMonthDeadline,
      estimated_hours: deliv.deliverable_type === "reel" ? 12 : deliv.deliverable_type === "ads_campaign" ? 6 : 4,
      actual_hours: 0,
      revision_count: 0,
      delivery_period: currentPeriod,
    });
  }

  const { data: createdTasks, error: taskErr } = await (supabase as any)
    .from("project_tasks")
    .insert(tasksToInsert)
    .select("*");

  if (taskErr) {
    console.error("Failed to create starter tasks:", taskErr);
  }

  // 10. Update Deal Status to WON with Links
  const { data: updatedDeal, error: dealUpdErr } = await (supabase as any)
    .from("deals")
    .update({
      stage: "won",
      won_date: new Date().toISOString(),
      client_id: clientId,
      package_id: pkg.id,
      contract_agreement: contractAgreement,
      revenue_config: {
        invoice_id: invoice?.id,
        invoice_number: invoiceNumber,
        service_revenue: serviceRev,
        sponsoring_budget: sponsoringBud,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .select("*, package:package_catalog(*)")
    .single();

  if (dealUpdErr) {
    console.error("Failed to mark deal as won:", dealUpdErr);
  }

  return {
    deal: updatedDeal || deal,
    client: clientRecord,
    package: pkg,
    invoice,
    commission: commissionRecord,
    deliverables: createdDelivList,
    project: workspace,
    tasks: createdTasks || [],
  };
}

// ============================================================
// PRODUCTION MODULE (Booking + Brief + Production Workflow)
// ============================================================

export function normalizeProductionBrief(brief?: Partial<ProductionBrief> | null): ProductionBrief {
  const sanitizeArray = (val: any): string[] => {
    if (!val || !Array.isArray(val)) return [];
    return val.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  };

  const sanitizeCount = (val: any, fallback = 0): number => {
    if (typeof val !== "number" || isNaN(val)) return fallback;
    return Math.max(0, Math.floor(val));
  };

  return {
    shot_list: sanitizeArray(brief?.shot_list),
    required_reels: sanitizeCount(brief?.required_reels, 0),
    photos: sanitizeCount(brief?.photos, 0),
    story_assets: sanitizeCount(brief?.story_assets, 0),
    references: sanitizeArray(brief?.references),
    equipment: sanitizeArray(brief?.equipment),
  };
}

export async function createProductionBooking(input: {
  clientId: string;
  dealId?: string;
  projectId?: string;
  packageId?: string;
  title: string;
  date: string;
  time: string;
  location: string;
  teamMemberIds?: string[];
  productionType: string;
  durationHours?: number;
  brief?: Partial<ProductionBrief>;
  internalNotes?: string;
}): Promise<ProductionBookingRow> {
  const briefPayload = normalizeProductionBrief(input.brief);

  const { data, error } = await (supabase as any)
    .from("production_bookings")
    .insert({
      client_id: input.clientId,
      deal_id: input.dealId || null,
      project_id: input.projectId || null,
      package_id: input.packageId || null,
      title: input.title,
      date: input.date,
      time: input.time,
      location: input.location,
      team_member_ids: input.teamMemberIds || [],
      production_type: input.productionType,
      duration_hours: input.durationHours || 2.0,
      brief: briefPayload,
      stage: "brief",
      internal_notes: input.internalNotes || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating production booking:", error);
    throw error;
  }
  return data;
}

export async function advanceProductionStage(
  bookingId: string,
  newStage: ProductionStage,
  mediaUrls?: { rawUploadUrl?: string; editPreviewUrl?: string; clientNotes?: string }
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("advance_production_booking_stage", {
    _booking_id: bookingId,
    _new_stage: newStage,
    _media_urls: {
      raw_upload_url: mediaUrls?.rawUploadUrl || null,
      edit_preview_url: mediaUrls?.editPreviewUrl || null,
      client_notes: mediaUrls?.clientNotes || null,
    },
  });

  if (error) {
    console.error("Error advancing production stage via atomic RPC:", error);
    return false;
  }
  return !!data?.success;
}

export async function fetchProductionBookings(clientId?: string): Promise<ProductionBookingRow[]> {
  let query = (supabase as any)
    .from("production_bookings")
    .select("*, client:clients(id, name)")
    .order("date", { ascending: true });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching production bookings:", error);
    return [];
  }
  return data || [];
}

// ============================================================
// DELIVERABLE & TASK PROGRESS ENGINE
// ============================================================

export async function fetchClientDeliverables(
  clientId: string,
  periodMonth?: string
): Promise<ClientDeliverableRow[]> {
  let query = (supabase as any)
    .from("client_deliverables")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (periodMonth) {
    query = query.eq("period_month", periodMonth);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching client deliverables:", error);
    return [];
  }
  return data || [];
}

export async function updateDeliverableProgress(
  deliverableId: string,
  doneQuantity: number
): Promise<boolean> {
  // Fetch target
  const { data: deliv } = await (supabase as any)
    .from("client_deliverables")
    .select("target_quantity")
    .eq("id", deliverableId)
    .single();

  const target = deliv?.target_quantity || 1;
  const status =
    doneQuantity >= target ? "completed" : doneQuantity > 0 ? "in_progress" : "planned";

  const { error } = await (supabase as any)
    .from("client_deliverables")
    .update({
      done_quantity: doneQuantity,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliverableId);

  return !error;
}

export async function updateTaskHours(
  taskId: string,
  actualHours: number
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("project_tasks")
    .update({
      actual_hours: actualHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  return !error;
}

/**
 * Permanently delete a deal.
 * Super Admin exclusive operation with sales.delete_lead permission check.
 */
export async function deleteDeal(
  dealId: string,
  options?: { ctx?: PermissionContext; actorRole?: string; actorId?: string; client?: any } | PermissionContext,
  clientOverride?: any
): Promise<void> {
  const ctx = (options && "role" in options) ? (options as PermissionContext) : options?.ctx;
  const activeClient = clientOverride || (options && !("role" in options) ? options?.client : undefined) || supabase;
  const actorId = (options && !("role" in options) ? options?.actorId : undefined) || ctx?.userId || null;
  const actorRole = (options && !("role" in options) ? options?.actorRole : undefined) || ctx?.role || "super_admin";

  const { data: existingDeal } = await (activeClient as any).from("deals").select("*").eq("id", dealId).maybeSingle();

  await assertAuthorizedMutation(activeClient, "sales", "sales.delete_lead", {
    ctx,
    actorRole,
    actorId: actorId || undefined,
    resourceType: "sales_deal",
    resource: existingDeal || { id: dealId },
    resourceAction: "delete",
  });

  const { error } = await (activeClient as any).from("deals").delete().eq("id", dealId);
  if (error) {
    console.error("[deleteDeal] Error deleting deal:", error);
    throw error;
  }

  try {
    await logSystemAudit({
      action: "DEAL_DELETED",
      entityType: "deal",
      entityId: dealId,
      actorId,
      actorRole,
      oldValues: existingDeal,
      client: activeClient,
    });
  } catch (auditErr) {
    console.warn("[deleteDeal] Audit logging notice:", auditErr);
  }
}

// ============================================================
// COMMISSION MANAGEMENT & APPROVAL ENGINE
// ============================================================

export interface CommissionRow {
  id: string;
  deal_id: string | null;
  team_member_id: string | null;
  client_id: string | null;
  package_id: string | null;
  package_name: string | null;
  total_sale_amount: number | null;
  service_revenue: number;
  sponsoring_amount: number | null;
  commission_rate: number;
  commission_amount: number;
  period_month: string | null;
  status: "pending" | "approved" | "paid" | "cancelled";
  salary_payment_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string } | null;
  deal?: { id: string; title: string; sales_owner_id: string | null } | null;
  team_member?: { id: string; name: string; email: string; role: string; profile_id: string | null } | null;
}

/**
 * Fetch commissions with full relation joins for client, deal, and team member.
 */
export async function fetchSalesCommissions(options?: {
  ctx?: PermissionContext;
  client?: any;
  clientOverride?: any;
}): Promise<CommissionRow[]> {
  const db = options?.clientOverride || options?.client || supabase;
  const { data, error } = await (db as any)
    .from("sales_commissions")
    .select(`
      *,
      client:clients(id, name),
      deal:deals(id, title, sales_owner_id),
      team_member:team_members(id, name, email, role, profile_id)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchSalesCommissions] Error fetching commissions:", error);
    throw error;
  }
  return (data || []) as CommissionRow[];
}

/**
 * Authoritatively approve a sales commission with self-approval protection and audit logging.
 */
export async function approveCommission(
  commissionId: string,
  options?: {
    ctx?: PermissionContext;
    actorRole?: string;
    actorId?: string;
    client?: any;
    clientOverride?: any;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const db = options?.clientOverride || options?.client || supabase;
  try {
    const authCtx = await assertAuthorizedMutation(db, "sales", "sales.edit_lead", {
      ctx: options?.ctx,
      actorRole: options?.actorRole,
      actorId: options?.actorId,
    });

    if (authCtx.role === "worker") {
      throw new SecurityAuthorizationError(
        "Unauthorized: Workers cannot approve sales commissions.",
        "FORBIDDEN_ADMIN_ACTION",
        { commissionId, actorId: authCtx.userId }
      );
    }

    const { data: existingComm, error: fetchErr } = await (db as any)
      .from("sales_commissions")
      .select("*, deal:deals(sales_owner_id)")
      .eq("id", commissionId)
      .maybeSingle();

    if (fetchErr || !existingComm) {
      throw new Error(`Commission record "${commissionId}" not found.`);
    }

    // Self-approval protection: non-super_admin cannot approve own commission
    if (authCtx.role !== "super_admin") {
      const { data: myTm } = await (supabase as any)
        .from("team_members")
        .select("id")
        .eq("profile_id", authCtx.userId)
        .maybeSingle();

      const isSelf =
        (myTm?.id && existingComm.team_member_id === myTm.id) ||
        (existingComm.deal?.sales_owner_id === authCtx.userId);

      if (isSelf) {
        throw new SecurityAuthorizationError(
          "Self-approval policy violation: Sales representatives cannot approve their own commission.",
          "PRIVILEGE_ESCALATION_BLOCKED",
          { commissionId, actorId: authCtx.userId }
        );
      }
    }

    if (existingComm.status === "paid") {
      throw new Error("Commission is already paid and finalized.");
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await (db as any)
      .from("sales_commissions")
      .update({
        status: "approved",
        approved_by: authCtx.userId,
        approved_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", commissionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    try {
      await logSystemAudit({
        action: "COMMISSION_APPROVED",
        entityType: "sales_commission",
        entityId: commissionId,
        actorId: authCtx.userId,
        actorRole: authCtx.role,
        oldValues: existingComm,
        newValues: updated,
        client: db,
      });
    } catch (auditErr) {
      console.warn("[approveCommission] Audit logging notice:", auditErr);
    }

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[approveCommission] Error:", err);
    return { success: false, error: err.message || "Failed to approve commission" };
  }
}

/**
 * Authoritatively disburse a sales commission with status transition to 'paid' and audit logging.
 */
export async function payoutCommission(
  commissionId: string,
  options?: {
    ctx?: PermissionContext;
    actorRole?: string;
    actorId?: string;
    client?: any;
    clientOverride?: any;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const db = options?.clientOverride || options?.client || supabase;
  try {
    const authCtx = await assertAuthorizedMutation(db, "sales", "sales.edit_lead", {
      ctx: options?.ctx,
      actorRole: options?.actorRole,
      actorId: options?.actorId,
    });

    if (authCtx.role === "worker") {
      throw new SecurityAuthorizationError(
        "Unauthorized: Workers cannot record commission payouts.",
        "FORBIDDEN_ADMIN_ACTION",
        { commissionId, actorId: authCtx.userId }
      );
    }

    const { data: existingComm, error: fetchErr } = await (db as any)
      .from("sales_commissions")
      .select("*")
      .eq("id", commissionId)
      .maybeSingle();

    if (fetchErr || !existingComm) {
      throw new Error(`Commission record "${commissionId}" not found.`);
    }

    if (existingComm.status === "paid") {
      return { success: true, data: existingComm }; // Idempotent
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await (db as any)
      .from("sales_commissions")
      .update({
        status: "paid",
        updated_at: nowIso,
      })
      .eq("id", commissionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    try {
      await logSystemAudit({
        action: "COMMISSION_PAID",
        entityType: "sales_commission",
        entityId: commissionId,
        actorId: authCtx.userId,
        actorRole: authCtx.role,
        oldValues: existingComm,
        newValues: updated,
        client: db,
      });
    } catch (auditErr) {
      console.warn("[payoutCommission] Audit logging notice:", auditErr);
    }

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[payoutCommission] Error:", err);
    return { success: false, error: err.message || "Failed to disburse commission" };
  }
}


