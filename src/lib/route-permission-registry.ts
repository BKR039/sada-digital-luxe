import {
  type SadaModule,
  type SadaRole,
  type GranularPermission,
  type UserModulePermissions,
  getEffectiveModulePermission,
  hasPermission,
} from "@/types/permissions";

export type RouteAccessClassification =
  | "launcher"
  | "overview"
  | "workspace"
  | "deep_link"
  | "alias"
  | "governance";

export interface RoutePermissionEntry {
  id: string;
  path: string;
  module: SadaModule;
  requiredPermission: GranularPermission;
  classification: RouteAccessClassification;
  superAdminOnly?: boolean;
  workerRestricted?: boolean;
  redirectTo?: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export interface RouteAccessCheckResult {
  allowed: boolean;
  code?: "UNAUTHENTICATED" | "ACCOUNT_SUSPENDED" | "FORBIDDEN_ADMIN_ACTION" | "UNAUTHORIZED_ROUTE";
  reason?: string;
  module: SadaModule | null;
  targetPath: string;
  entry: RoutePermissionEntry | null;
}

/**
 * CANONICAL ROUTE-TO-PERMISSION REGISTRY
 * Authoritative single source of truth for route-level access rules across SADA OS.
 */
export const CANONICAL_ROUTE_REGISTRY: RoutePermissionEntry[] = [
  // 1. Protected Launchpad
  {
    id: "sada-os-launcher",
    path: "/sada-os",
    module: "dashboard",
    requiredPermission: "dashboard.view",
    classification: "launcher",
    titleEn: "SADA OS Launchpad",
    titleAr: "بوابة نظام صدى",
    descriptionEn: "Operational entry gate and system launcher",
    descriptionAr: "البوابة الرئيسية لتشغيل المنظومة",
  },

  // 2. Executive Overview & Operations
  {
    id: "admin-overview",
    path: "/admin",
    module: "dashboard",
    requiredPermission: "dashboard.view",
    classification: "overview",
    titleEn: "Executive Overview",
    titleAr: "لوحة التحكم والنظرة العامة",
    descriptionEn: "Agency executive dashboard and key metrics",
    descriptionAr: "لوحة التحكم التنفيذية والمؤشرات الرئيسية",
  },
  {
    id: "admin-tasks",
    path: "/admin/my-work",
    module: "tasks",
    requiredPermission: "tasks.view",
    classification: "workspace",
    titleEn: "My Work & Execution Center",
    titleAr: "مركز المهام والتنفيذ",
    descriptionEn: "Task queues, subtasks, deliverables, and progress",
    descriptionAr: "طابور المهام والتسليمات والتنفيذ اليومي",
  },
  {
    id: "admin-client-workspaces",
    path: "/admin/client-workspaces",
    module: "clients",
    requiredPermission: "clients.view",
    classification: "workspace",
    titleEn: "Client Workspaces",
    titleAr: "مساحات عمل العملاء",
    descriptionEn: "Canonical client workspaces list, operations, and status",
    descriptionAr: "المركز التشغيلي لمساحات عمل العملاء ومتابعة العمليات",
  },
  {
    id: "admin-client-workspaces-detail",
    path: "/admin/client-workspaces/$id",
    module: "clients",
    requiredPermission: "clients.view",
    classification: "deep_link",
    titleEn: "Client Workspace Command Center",
    titleAr: "مساحة عمل العميل",
    descriptionEn: "Deep link into single canonical client operational workspace",
    descriptionAr: "مساحة العمل التشغيلية الموحدة للعميل والتزاماته",
  },
  {
    id: "admin-clients-alias",
    path: "/admin/clients",
    module: "clients",
    requiredPermission: "clients.view",
    classification: "alias",
    redirectTo: "/admin/client-workspaces",
    titleEn: "Clients (Legacy Alias)",
    titleAr: "العملاء (مسار سابق)",
    descriptionEn: "Legacy route redirecting to canonical client workspaces",
    descriptionAr: "مسار سابق يتم توجيهه إلى مساحات عمل العملاء",
  },
  {
    id: "admin-clients-detail-alias",
    path: "/admin/clients/$id",
    module: "clients",
    requiredPermission: "clients.view",
    classification: "alias",
    redirectTo: "/admin/client-workspaces/$id",
    titleEn: "Client Detail (Legacy Alias)",
    titleAr: "تفاصيل العميل (مسار سابق)",
    descriptionEn: "Legacy route redirecting to canonical client workspace detail",
    descriptionAr: "مسار سابق يتم توجيهه إلى مساحة عمل العميل",
  },
  {
    id: "admin-client-projects-alias",
    path: "/admin/client-projects",
    module: "clients",
    requiredPermission: "clients.view",
    classification: "alias",
    redirectTo: "/admin/client-workspaces",
    titleEn: "Client Projects (Legacy Alias)",
    titleAr: "مشاريع العملاء (مسار سابق)",
    descriptionEn: "Legacy route redirecting to canonical client workspaces",
    descriptionAr: "مسار سابق يتم توجيهه إلى مساحات عمل العملاء",
  },
  {
    id: "admin-client-projects-detail-alias",
    path: "/admin/client-projects/$id",
    module: "clients",
    requiredPermission: "clients.view",
    classification: "alias",
    redirectTo: "/admin/client-workspaces/$id",
    titleEn: "Client Project Detail (Legacy Alias)",
    titleAr: "تفاصيل المشروع (مسار سابق)",
    descriptionEn: "Legacy route redirecting to canonical client workspace detail",
    descriptionAr: "مسار سابق يتم توجيهه إلى مساحة عمل العميل",
  },
  {
    id: "admin-sales",
    path: "/admin/sales",
    module: "sales",
    requiredPermission: "sales.view",
    classification: "workspace",
    titleEn: "Sales & Deals Pipeline",
    titleAr: "مسار المبيعات والصفقات",
    descriptionEn: "Kanban pipeline, deal stages, and conversion",
    descriptionAr: "لوحة مسار المبيعات وتتبع الصفقات والتحويل",
  },
  {
    id: "admin-deals-alias",
    path: "/admin/deals",
    module: "sales",
    requiredPermission: "sales.view",
    classification: "alias",
    redirectTo: "/admin/sales",
    titleEn: "Deals (Legacy Alias)",
    titleAr: "الصفقات (مسار بديل)",
    descriptionEn: "Legacy route redirecting to sales workspace",
    descriptionAr: "مسار بديل يوجه إلى مسار المبيعات",
  },
  {
    id: "admin-commissions-alias",
    path: "/admin/commissions",
    module: "sales",
    requiredPermission: "sales.view",
    classification: "alias",
    redirectTo: "/admin/sales",
    titleEn: "Commissions (Legacy Alias)",
    titleAr: "العمولات (مسار بديل)",
    descriptionEn: "Legacy route redirecting to sales workspace",
    descriptionAr: "مسار بديل يوجه إلى مسار المبيعات",
  },
  {
    id: "admin-calendar",
    path: "/admin/calendar",
    module: "calendar",
    requiredPermission: "calendar.view",
    classification: "workspace",
    titleEn: "Operations Calendar",
    titleAr: "تقويم العمليات",
    descriptionEn: "Operational schedule and scheduled task deliverables",
    descriptionAr: "جدول العمليات ومواعيد تسليم المهام",
  },
  {
    id: "admin-team",
    path: "/admin/team-workload",
    module: "team",
    requiredPermission: "team.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Team Workload & Capacity",
    titleAr: "أعباء الفريق والقدرة",
    descriptionEn: "Team capacity, active load, and allocation matrix",
    descriptionAr: "توزيع أعباء الفريق والقدرة الاستيعابية",
  },
  {
    id: "admin-packages",
    path: "/admin/packages",
    module: "packages",
    requiredPermission: "packages.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Packages & Pricing Catalog",
    titleAr: "كتالوج الباقات والأسعار",
    descriptionEn: "Service packages, pricing tiers, and deliverables",
    descriptionAr: "باقات الخدمات وتفاصيل التسعير والبنود",
  },
  {
    id: "admin-analytics",
    path: "/admin/analytics",
    module: "analytics",
    requiredPermission: "analytics.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Analytics & Executive KPIs",
    titleAr: "التحليلات والمؤشرات التنفيذية",
    descriptionEn: "Financial KPIs, client health, and growth reports",
    descriptionAr: "التقارير التحليلية وصحة العملاء والنمو",
  },
  {
    id: "admin-inquiries",
    path: "/admin/contact",
    module: "inquiries",
    requiredPermission: "inquiries.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Contact Inquiries",
    titleAr: "استفسارات التواصل",
    descriptionEn: "Client discovery leads and contact submissions",
    descriptionAr: "طلبات واكتشافات التواصل الواردة",
  },

  // 3. Finance & Compensation
  {
    id: "admin-finance",
    path: "/admin/finance",
    module: "finance",
    requiredPermission: "finance.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Financial Operating System",
    titleAr: "النظام المالي والخزينة",
    descriptionEn: "Treasury, ledger, P&L, and salary administration",
    descriptionAr: "الخزينة والمداخيل والمصاريف وإدارة الرواتب",
  },
  {
    id: "admin-salary",
    path: "/admin/my-salary",
    module: "compensation",
    requiredPermission: "compensation.view",
    classification: "workspace",
    titleEn: "My Compensation & Salary",
    titleAr: "مستحقاتي والرواتب",
    descriptionEn: "Worker personal earnings, payslips, and salary advances",
    descriptionAr: "مستحقات الموظف وقسائم الرواتب وطلبات السلف",
  },
  {
    id: "admin-salary-alias",
    path: "/admin/salary",
    module: "compensation",
    requiredPermission: "compensation.view",
    classification: "alias",
    redirectTo: "/admin/my-salary",
    titleEn: "Salary (Legacy Alias)",
    titleAr: "الراتب (مسار بديل)",
    descriptionEn: "Legacy route redirecting to my compensation",
    descriptionAr: "مسار بديل يوجه إلى قسم المستحقات الشخصية",
  },

  // 4. Content & CMS Workspaces
  {
    id: "admin-cms-projects",
    path: "/admin/projects",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Portfolio & Case Studies CMS",
    titleAr: "إدارة الأعمال ودراسات الحالة",
    descriptionEn: "Manage public case studies and showcase projects",
    descriptionAr: "إدارة دراسات الحالة وأعمال المحفظة",
  },
  {
    id: "admin-cms-projects-detail",
    path: "/admin/projects/$id",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "deep_link",
    workerRestricted: true,
    titleEn: "Case Study Editor",
    titleAr: "محرر دراسة الحالة",
    descriptionEn: "Deep link into case study editor",
    descriptionAr: "رابط مباشر لمحرر دراسة الحالة",
  },
  {
    id: "admin-cms-reels",
    path: "/admin/reels",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Reels & Video Showcase CMS",
    titleAr: "إدارة الريلز والفيديو",
    descriptionEn: "Manage short-form video reels and engagement assets",
    descriptionAr: "إدارة مقاطع الريلز وفيديوهات المنصة",
  },
  {
    id: "admin-cms-blog",
    path: "/admin/blog",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Blog Articles CMS",
    titleAr: "إدارة المقالات والمدونة",
    descriptionEn: "Publish agency editorial articles and industry news",
    descriptionAr: "نشر وإدارة مقالات المدونة",
  },
  {
    id: "admin-cms-blog-detail",
    path: "/admin/blog/$id",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "deep_link",
    workerRestricted: true,
    titleEn: "Blog Article Editor",
    titleAr: "محرر مقال المدونة",
    descriptionEn: "Deep link into blog article editor",
    descriptionAr: "رابط مباشر لمحرر المقال",
  },
  {
    id: "admin-cms-products",
    path: "/admin/products",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Digital Products CMS",
    titleAr: "إدارة المنتجات الرقمية",
    descriptionEn: "Manage digital tools, templates, and downloadable assets",
    descriptionAr: "إدارة الأدوات والمنتجات الرقمية",
  },
  {
    id: "admin-cms-products-detail",
    path: "/admin/products/$id",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "deep_link",
    workerRestricted: true,
    titleEn: "Product Editor",
    titleAr: "محرر المنتج الرقمي",
    descriptionEn: "Deep link into digital product editor",
    descriptionAr: "رابط مباشر لمحرر المنتج الرقمي",
  },
  {
    id: "admin-cms-testimonials",
    path: "/admin/testimonials",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Client Proof & Testimonials CMS",
    titleAr: "شهادات وتوصيات العملاء",
    descriptionEn: "Manage client reviews, proof points, and quotes",
    descriptionAr: "إدارة شهادات وآراء العملاء",
  },
  {
    id: "admin-cms-testimonials-detail",
    path: "/admin/testimonials/$id",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "deep_link",
    workerRestricted: true,
    titleEn: "Testimonial Editor",
    titleAr: "محرر شهادة العميل",
    descriptionEn: "Deep link into testimonial editor",
    descriptionAr: "رابط مباشر لمحرر شهادة العميل",
  },
  {
    id: "admin-cms-site-content",
    path: "/admin/site-content",
    module: "content_cms",
    requiredPermission: "content_cms.view",
    classification: "workspace",
    workerRestricted: true,
    titleEn: "Site Content & Metrics CMS",
    titleAr: "إدارة إحصائيات وشركاء الموقع",
    descriptionEn: "Manage Hero metrics, trusted partner brands, and performance KPIs",
    descriptionAr: "إدارة إحصائيات الواجهة، شعارات وشركاء النجاح، وأرقام الأداء",
  },

  // 5. Root Governance & Super Admin Workspaces
  {
    id: "admin-workflows",
    path: "/admin/workflow-templates",
    module: "workflows",
    requiredPermission: "workflows.view",
    classification: "governance",
    superAdminOnly: true,
    titleEn: "Task Workflow Templates",
    titleAr: "قوالب مسارات العمل",
    descriptionEn: "Stage pipelines and operational delivery workflows",
    descriptionAr: "إدارة قوالب مراحل العمل والتبعيات الإلزامية",
  },
  {
    id: "admin-business-rules",
    path: "/admin/business-rules",
    module: "business_rules",
    requiredPermission: "business_rules.view",
    classification: "governance",
    superAdminOnly: true,
    titleEn: "Centralized Business Rules",
    titleAr: "السياسات والمعادلات المركزية",
    descriptionEn: "Financial formula parameters, commission rates, and policies",
    descriptionAr: "إدارة النسب والسياسات والمعادلات الحسابية",
  },
  {
    id: "admin-business-rules-alias",
    path: "/admin/settings/business-rules",
    module: "business_rules",
    requiredPermission: "business_rules.view",
    classification: "alias",
    superAdminOnly: true,
    redirectTo: "/admin/business-rules",
    titleEn: "Business Rules Settings (Alias)",
    titleAr: "إعدادات القواعد المركزية (مسار بديل)",
    descriptionEn: "Legacy settings route redirecting to business rules",
    descriptionAr: "مسار إعدادات بديل يوجه إلى القواعد المركزية",
  },
  {
    id: "admin-accounts",
    path: "/admin/accounts",
    module: "accounts",
    requiredPermission: "accounts.view",
    classification: "governance",
    superAdminOnly: true,
    titleEn: "Root Account Management Center",
    titleAr: "مركز إدارة الحسابات والصلاحيات",
    descriptionEn: "Root identity provisioning, credentials, and access control",
    descriptionAr: "إنشاء وإدارة حسابات المنظومة وصلاحيات الأعضاء",
  },
  {
    id: "admin-users-alias",
    path: "/admin/users",
    module: "accounts",
    requiredPermission: "accounts.view",
    classification: "alias",
    superAdminOnly: true,
    redirectTo: "/admin/accounts",
    titleEn: "Users & Accounts Management",
    titleAr: "إدارة المستخدمين والحسابات",
    descriptionEn: "Legacy route redirecting to root account management",
    descriptionAr: "مسار بديل يوجه إلى إدارة الحسابات والصلاحيات",
  },
];

/**
 * Normalizes a requested URL pathname for registry lookup
 */
export function normalizeRoutePath(pathname: string): string {
  let p = pathname.trim().toLowerCase();
  // Strip trailing slash except root
  if (p.length > 1 && p.endsWith("/")) {
    p = p.substring(0, p.length - 1);
  }
  return p;
}

/**
 * Looks up the authoritative RoutePermissionEntry for a given pathname.
 * Handles exact matches, deep link path parameters (e.g. /admin/clients/123), and aliases.
 */
export function lookupRouteRegistry(pathname: string): RoutePermissionEntry | null {
  const norm = normalizeRoutePath(pathname);

  // 1. Direct exact path match
  const exactMatch = CANONICAL_ROUTE_REGISTRY.find((e) => e.path.toLowerCase() === norm);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. Sada-OS path mapping
  if (norm === "/sada-os") {
    return CANONICAL_ROUTE_REGISTRY.find((e) => e.id === "sada-os-launcher") || null;
  }
  if (norm.startsWith("/sada-os/")) {
    const adminMapped = norm.replace("/sada-os", "/admin");
    return lookupRouteRegistry(adminMapped);
  }

  // 3. Dynamic Deep Link matching ($id / :id)
  // Check parameterized paths in registry
  for (const entry of CANONICAL_ROUTE_REGISTRY) {
    if (entry.path.includes("/$id")) {
      const basePrefix = entry.path.replace("/$id", "");
      if (norm.startsWith(basePrefix + "/")) {
        return entry;
      }
    }
  }

  // 4. Prefix fallback for nested module routes
  for (const entry of CANONICAL_ROUTE_REGISTRY) {
    if (entry.classification !== "alias" && norm.startsWith(entry.path + "/")) {
      return entry;
    }
  }

  return null;
}

/**
 * Evaluates whether an actor with given role and overrides has authoritative permission
 * to navigate to a target route.
 */
export function evaluateRegistryRouteAccess(
  pathname: string,
  role: SadaRole,
  overrides?: UserModulePermissions | null
): RouteAccessCheckResult {
  const norm = normalizeRoutePath(pathname);
  const entry = lookupRouteRegistry(norm);

  // Unmapped path outside protected SADA OS scope
  if (!entry) {
    return {
      allowed: true,
      module: null,
      targetPath: pathname,
      entry: null,
    };
  }

  // 1. Root Super Admin invariant: Full access to all routes
  if (role === "super_admin") {
    return {
      allowed: true,
      module: entry.module,
      targetPath: pathname,
      entry,
    };
  }

  // 2. Super Admin exclusive routes (accounts, business_rules, workflows)
  if (entry.superAdminOnly) {
    return {
      allowed: false,
      code: "FORBIDDEN_ADMIN_ACTION",
      reason: `Route '${pathname}' (${entry.titleEn}) is strictly restricted to Super Admin root.`,
      module: entry.module,
      targetPath: pathname,
      entry,
    };
  }

  // 3. Module & Action level permission evaluation
  const isModuleGranted = getEffectiveModulePermission(entry.module, role, overrides);
  if (!isModuleGranted) {
    return {
      allowed: false,
      code: "UNAUTHORIZED_ROUTE",
      reason: `Access to module '${entry.module}' is disabled for this account. Route '${pathname}' is denied.`,
      module: entry.module,
      targetPath: pathname,
      entry,
    };
  }

  // 4. Granular action check for the route
  const isActionGranted = hasPermission(entry.requiredPermission, role, overrides);
  if (!isActionGranted) {
    return {
      allowed: false,
      code: "UNAUTHORIZED_ROUTE",
      reason: `Account lacks required action permission '${entry.requiredPermission}' for route '${pathname}'.`,
      module: entry.module,
      targetPath: pathname,
      entry,
    };
  }

  return {
    allowed: true,
    module: entry.module,
    targetPath: pathname,
    entry,
  };
}

/**
 * Returns all protected routes registered in the system
 */
export function getAllProtectedRoutes(): RoutePermissionEntry[] {
  return [...CANONICAL_ROUTE_REGISTRY];
}

/**
 * Returns all routes under a specific module
 */
export function getRoutesForModule(module: SadaModule): RoutePermissionEntry[] {
  return CANONICAL_ROUTE_REGISTRY.filter((e) => e.module === module);
}
