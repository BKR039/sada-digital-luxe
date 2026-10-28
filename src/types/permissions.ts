// ============================================================
// SADA WORK OS — Comprehensive Module & Action Permissions Types
// User -> Role -> Effective Granular Permissions Architecture (Phase B)
// Module -> Page Access -> Feature/Action Access
// ============================================================

export type SadaRole = "super_admin" | "admin" | "worker";

export type SadaModule =
  | "dashboard"      // Overview (/admin)
  | "clients"        // Clients CRM (/admin/clients, /admin/clients/$id)
  | "tasks"          // Tasks Execution Center (/admin/my-work)
  | "calendar"       // Production Calendar (/admin/calendar)
  | "workspaces"     // Client Projects & Workspaces (/admin/client-projects)
  | "team"           // Team Workload Matrix (/admin/team-workload)
  | "sales"          // Sales Pipeline & Deals (/admin/sales, /admin/deals)
  | "finance"        // Finance & Accounting (/admin/finance)
  | "compensation"   // My Salary & Advances (/admin/my-salary)
  | "packages"       // Packages Catalog (/admin/packages)
  | "analytics"      // Analytics & KPIs (/admin/analytics)
  | "content_cms"    // Content CMS (/admin/projects, /admin/reels, /admin/blog, /admin/products, /admin/testimonials)
  | "inquiries"      // Inquiries & Discovery (/admin/contact)
  | "workflows"      // Workflow Templates (/admin/workflow-templates)
  | "business_rules" // Centralized Business Rules (/admin/business-rules)
  | "accounts";      // Account & Member Management (/admin/accounts)

// ============================================================
// Granular Action Types Per Module
// ============================================================

export type SalesAction =
  | "view"
  | "create_lead"
  | "edit_lead"
  | "delete_lead"
  | "change_stage"
  | "convert_lead";

export type TasksAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "assign"
  | "create_subtask"
  | "change_status"
  | "change_priority"
  | "change_due_date"
  | "add_deliverable"
  | "complete";

export type ClientsAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "reconcile";

export type FinanceAction =
  | "view"
  | "create_income"
  | "create_expense"
  | "delete_transaction"
  | "manage_salaries"
  | "approve_advance";

export type PackagesAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "publish";

export type WorkspacesAction =
  | "view"
  | "create"
  | "edit"
  | "delete";

export type TeamAction =
  | "view"
  | "manage";

export type ContentCmsAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "publish";

export type InquiriesAction =
  | "view"
  | "manage";

export type CalendarAction =
  | "view"
  | "schedule";

export type CompensationAction =
  | "view"
  | "request_advance";

export type WorkflowsAction =
  | "view"
  | "manage";

export type BusinessRulesAction =
  | "view"
  | "manage";

export type AccountsAction =
  | "view"
  | "manage";

export type DashboardAction =
  | "view"
  | "clear_notification"
  | "manage_preferences";

export type AnalyticsAction =
  | "view";

export type SadaAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | string;

export type GranularPermission =
  | `sales.${SalesAction}`
  | `tasks.${TasksAction}`
  | `clients.${ClientsAction}`
  | `finance.${FinanceAction}`
  | `packages.${PackagesAction}`
  | `workspaces.${WorkspacesAction}`
  | `team.${TeamAction}`
  | `content_cms.${ContentCmsAction}`
  | `inquiries.${InquiriesAction}`
  | `calendar.${CalendarAction}`
  | `compensation.${CompensationAction}`
  | `workflows.${WorkflowsAction}`
  | `business_rules.${BusinessRulesAction}`
  | `accounts.${AccountsAction}`
  | `dashboard.${DashboardAction}`
  | `analytics.${AnalyticsAction}`
  | `${SadaModule}.${string}`
  | SadaModule;

export interface ModulePermissionConfig {
  enabled: boolean;
  actions?: Record<string, boolean>;
}

export type UserModulePermissions = Partial<Record<SadaModule, boolean | ModulePermissionConfig>>;

export interface SadaModuleMeta {
  key: SadaModule;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  path: string;
  category: "operations" | "finance" | "content" | "admin";
  superAdminOnly?: boolean;
}

export const SADA_MODULES: SadaModuleMeta[] = [
  {
    key: "dashboard",
    label: "Dashboard & Overview",
    labelAr: "لوحة التحكم والنظرة العامة",
    description: "Executive summary, activity stream, and daily metrics",
    descriptionAr: "الملخص التنفيذي ونظرة عامة على النشاط اليومي",
    path: "/admin",
    category: "operations",
  },
  {
    key: "clients",
    label: "Client Workspaces",
    labelAr: "مساحات عمل العملاء",
    description: "Canonical client operational workspaces, directory, and recurring commitments",
    descriptionAr: "مساحات عمل العملاء، دليل العملاء، والالتزامات التعاقدية",
    path: "/admin/client-workspaces",
    category: "operations",
  },
  {
    key: "tasks",
    label: "Tasks & Execution",
    labelAr: "المهام والتنفيذ اليومي",
    description: "Task queue, execution center, and deliverable workflows",
    descriptionAr: "طابور المهام ومركز التنفيذ ومراحل التسليم",
    path: "/admin/my-work",
    category: "operations",
  },
  {
    key: "calendar",
    label: "Production Calendar",
    labelAr: "تقويم الإنتاج والجدولة",
    description: "Shooting sessions, deadlines, and delivery occurrences",
    descriptionAr: "جلسات التصوير، المواعيد النهائية، وتقويم الإنتاج",
    path: "/admin/calendar",
    category: "operations",
  },
  {
    key: "workspaces",
    label: "Client Workspaces (Legacy)",
    labelAr: "مساحات عمل المشاريع (سابق)",
    description: "Legacy workspace route redirecting to client workspaces",
    descriptionAr: "مسار سابق يتم توجيهه إلى مساحات عمل العملاء",
    path: "/admin/client-workspaces",
    category: "operations",
  },
  {
    key: "team",
    label: "Team Workload",
    labelAr: "أعباء وضغط الفريق",
    description: "Team capacity, active tasks, and workload balancing",
    descriptionAr: "مصفوفة أعباء الفريق والقدرة الاستيعابية",
    path: "/admin/team-workload",
    category: "operations",
  },
  {
    key: "sales",
    label: "Sales & Deals Pipeline",
    labelAr: "المبيعات ومسار الصفقات",
    description: "Deals kanban, pipeline stages, proposals, and commissions",
    descriptionAr: "مسار الصفقات، العروض، وحساب العمولات",
    path: "/admin/sales",
    category: "operations",
  },
  {
    key: "packages",
    label: "Package Catalog",
    labelAr: "كتالوج الباقات والأسعار",
    description: "Service packages, add-ons, features, and public pricing",
    descriptionAr: "باقات الخدمات، الإضافات، والتسعير",
    path: "/admin/packages",
    category: "operations",
  },
  {
    key: "analytics",
    label: "Analytics & KPIs",
    labelAr: "التحليلات والمؤشرات",
    description: "Operational throughput, client health, and delivery metrics",
    descriptionAr: "مؤشرات الأداء التشغيلي وصحة الحسابات",
    path: "/admin/analytics",
    category: "operations",
  },
  {
    key: "inquiries",
    label: "Inquiries & Discovery",
    labelAr: "استفسارات التواصل والتقييم",
    description: "Public contact submissions and Smart Match briefs",
    descriptionAr: "استفسارات الموقع واختبار الباقة الذكي",
    path: "/admin/contact",
    category: "operations",
  },
  {
    key: "finance",
    label: "Finance & Accounting",
    labelAr: "المالية والمحاسبة",
    description: "Inflow, outflow, invoices, treasury, and P&L statements",
    descriptionAr: "المداخيل، المصاريف، الفواتير، والخزينة",
    path: "/admin/finance",
    category: "finance",
  },
  {
    key: "compensation",
    label: "My Salary & Advances",
    labelAr: "مستحقاتي والسلف المالية",
    description: "Worker personal compensation records and advance requests",
    descriptionAr: "سجل الراتب الشخصي وطلبات السلفة المالية",
    path: "/admin/my-salary",
    category: "finance",
  },
  {
    key: "content_cms",
    label: "Content CMS",
    labelAr: "إدارة المحتوى والموقع",
    description: "Case studies, Reels showcase, Blog, Products, and Proof",
    descriptionAr: "معرض الأعمال، الريلز، المقالات، والمتجر",
    path: "/admin/projects",
    category: "content",
  },
  {
    key: "workflows",
    label: "Workflow Templates",
    labelAr: "قوالب مسارات العمل",
    description: "Multi-stage production pipelines and dependency rules",
    descriptionAr: "قوالب مسارات الإنتاج وقواعد التبعية",
    path: "/admin/workflow-templates",
    category: "admin",
    superAdminOnly: true,
  },
  {
    key: "business_rules",
    label: "Business Rules Console",
    labelAr: "لوحة قواعد العمل المركزية",
    description: "Financial formulas, rate thresholds, and governance policies",
    descriptionAr: "المعادلات المالية والسياسات المركزية",
    path: "/admin/business-rules",
    category: "admin",
    superAdminOnly: true,
  },
  {
    key: "accounts",
    label: "Account Management",
    labelAr: "إدارة الحسابات والأعضاء",
    description: "Root identity provisioning, credentials, and role security",
    descriptionAr: "إنشاء الهويات وبيانات الاعتماد والأمان الجذري",
    path: "/admin/accounts",
    category: "admin",
    superAdminOnly: true,
  },
];

/**
 * Baseline default module permissions per role
 */
export const ROLE_DEFAULT_MODULE_PERMISSIONS: Record<SadaRole, Record<SadaModule, boolean>> = {
  super_admin: {
    dashboard: true,
    clients: true,
    tasks: true,
    calendar: true,
    workspaces: true,
    team: true,
    sales: true,
    packages: true,
    analytics: true,
    inquiries: true,
    finance: true,
    compensation: true,
    content_cms: true,
    workflows: true,
    business_rules: true,
    accounts: true,
  },
  admin: {
    dashboard: true,
    clients: true,
    tasks: true,
    calendar: true,
    workspaces: true,
    team: true,
    sales: true,
    packages: true,
    analytics: true,
    inquiries: true,
    content_cms: true,
    compensation: true,
    workflows: false,
    finance: false,       // Can be explicitly granted by Super Admin
    business_rules: false, // Super Admin only by default
    accounts: false,       // Super Admin root only
  },
  worker: {
    dashboard: true,
    clients: true,         // Operational deliverables view
    tasks: true,
    calendar: true,
    compensation: true,    // Personal salary & advances
    sales: false,          // Can be explicitly granted by Super Admin
    workspaces: false,
    team: false,
    packages: false,
    analytics: false,
    inquiries: false,
    content_cms: false,
    finance: false,
    workflows: false,
    business_rules: false,
    accounts: false,
  },
};

// ============================================================
// Authoritative Granular Action Catalog & Role Defaults
// ============================================================

export interface GranularActionMeta {
  key: string;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  superAdminOnly?: boolean;
  defaultByRole: Record<SadaRole, boolean>;
}

export const MODULE_ACTIONS_CATALOG: Record<SadaModule, GranularActionMeta[]> = {
  sales: [
    { key: "view", label: "View Deals & Pipeline", labelAr: "عرض مسار الصفقات", description: "View sales kanban and deal details", descriptionAr: "عرض لوحة الصفقات وتفاصيلها", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "create_lead", label: "Create Leads & Deals", labelAr: "إنشاء الصفقات والعملاء المحتملين", description: "Add new leads to the pipeline", descriptionAr: "إضافة صفقات جديدة لمسار المبيعات", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "edit_lead", label: "Edit Deal Information", labelAr: "تعديل بيانات الصفقة", description: "Edit deal properties and details", descriptionAr: "تعديل تفاصيل ومعلومات الصفقات", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "delete_lead", label: "Delete Deals", labelAr: "حذف الصفقات", description: "Permanently delete deals", descriptionAr: "حذف الصفقات نهائياً من النظام", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "change_stage", label: "Change Deal Stage", labelAr: "نقل مراحل الصفقات", description: "Move deals through pipeline stages", descriptionAr: "تغيير مرحلة الصفقة عبر المسار", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "convert_lead", label: "Convert to Sale / Client", labelAr: "تحويل الصفقة إلى بيع / عميل", description: "Convert won deals to clients & projects", descriptionAr: "تحويل الصفقات الرابحة إلى عملاء ومشاريع", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  tasks: [
    { key: "view", label: "View Tasks Queue", labelAr: "عرض المهام", description: "View assigned or project tasks", descriptionAr: "عرض طابور المهام ومركز التنفيذ", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "create", label: "Create Tasks", labelAr: "إنشاء مهام جديدة", description: "Create definition and assign tasks", descriptionAr: "إنشاء مهام جديدة في النظام", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "edit", label: "Edit Task Definition", labelAr: "تعديل مواصفات المهمة", description: "Edit title, deadline, priority, billing", descriptionAr: "تعديل تفاصيل المهمة ومواصفاتها", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "delete", label: "Delete Tasks", labelAr: "حذف المهام", description: "Permanently delete tasks", descriptionAr: "حذف المهام نهائياً من النظام", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "assign", label: "Assign & Reassign", labelAr: "إسناد وإعادة تعيين المهام", description: "Change task assignees", descriptionAr: "تحديد أو تغيير المسؤول عن المهمة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "create_subtask", label: "Create Subtasks", labelAr: "إضافة مهام فرعية", description: "Add subtasks to tasks", descriptionAr: "إنشاء مهام فرعية تحت المهمة الرئيسية", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "change_status", label: "Update Status & Workflow", labelAr: "تحديث حالة التنفيذ", description: "Update task progress status", descriptionAr: "تحديث حالة تقدم وتنفيذ المهمة", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "change_priority", label: "Change Priority", labelAr: "تغيير الأولوية", description: "Update task priority rating", descriptionAr: "تحديث درجة أولوية المهمة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "change_due_date", label: "Change Due Date", labelAr: "تعديل الموعد النهائي", description: "Reschedule task deadline", descriptionAr: "تعديل موعد تسليم المهمة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "add_deliverable", label: "Attach Deliverables", labelAr: "إرفاق التسليمات والروابط", description: "Attach deliverables & results", descriptionAr: "ربط مخرجات العمل والتسليمات", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "complete", label: "Complete & Submit", labelAr: "إنهاء واعتماد المهمة", description: "Mark task complete or submit for review", descriptionAr: "إكمال المهمة وإرسالها للمراجعة", defaultByRole: { super_admin: true, admin: true, worker: true } },
  ],
  clients: [
    { key: "view", label: "View Clients", labelAr: "عرض العملاء", description: "View client directory and profiles", descriptionAr: "عرض سجلات وبيانات العملاء", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "create", label: "Onboard Clients", labelAr: "إضافة عملاء جدد", description: "Create new client profiles", descriptionAr: "تسجيل عملاء جدد في النظام", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "edit", label: "Edit Client Profiles", labelAr: "تعديل بيانات العملاء", description: "Modify client records and contracts", descriptionAr: "تعديل معلومات وبيانات العملاء", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "delete", label: "Delete Clients", labelAr: "حذف العملاء", description: "Permanently delete client profiles", descriptionAr: "حذف العملاء نهائياً", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "reconcile", label: "Reconcile Packages", labelAr: "مطابقة التزامات الباقات", description: "Run deliverable reconciliation", descriptionAr: "مطابقة وتوليد التزامات الباقات التعاقدية", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  finance: [
    { key: "view", label: "View Financial OS", labelAr: "عرض النظام المالي", description: "View treasury, inflow, and outflow", descriptionAr: "عرض الخزينة والمداخيل والمصاريف", defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "create_income", label: "Record Inflow", labelAr: "تسجيل المداخيل", description: "Add incoming revenue transactions", descriptionAr: "إضافة معاملات المداخيل والفواتير", defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "create_expense", label: "Record Outflow", labelAr: "تسجيل المصاريف", description: "Add company expenditures", descriptionAr: "إضافة معاملات المصاريف والمدفوعات", defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "delete_transaction", label: "Delete Transactions", labelAr: "حذف المعاملات المالية", description: "Permanently delete ledger records", descriptionAr: "حذف قيود المعاملات المالية نهائياً", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "manage_salaries", label: "Manage Salaries", labelAr: "إدارة رواتب الموظفين", description: "Manage compensation records", descriptionAr: "إدارة رواتب ومستحقات الموظفين", defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "approve_advance", label: "Approve Advances", labelAr: "اعتماد طلبات السلف", description: "Approve or reject salary advance requests", descriptionAr: "الموافقة على طلبات السلفة المالية أو رفضها", defaultByRole: { super_admin: true, admin: false, worker: false } },
  ],
  packages: [
    { key: "view", label: "View Catalog", labelAr: "عرض الكتالوج", description: "View packages and pricing", descriptionAr: "عرض باقات الخدمات والأسعار", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "create", label: "Create Packages", labelAr: "إنشاء باقات جديدة", description: "Define new service packages", descriptionAr: "إنشاء باقات جديدة في الكتالوج", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "edit", label: "Edit Packages", labelAr: "تعديل الباقات", description: "Modify pricing and deliverables", descriptionAr: "تعديل تفاصيل وتسعير الباقات", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "delete", label: "Delete Packages", labelAr: "حذف الباقات", description: "Permanently delete packages", descriptionAr: "حذف الباقات نهائياً", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "publish", label: "Publish Packages", labelAr: "نشر الباقات في الموقع", description: "Toggle public pricing visibility", descriptionAr: "نشر الباقات في الموقع العام", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  workspaces: [
    { key: "view", label: "View Workspaces", labelAr: "عرض مساحات المشاريع", description: "View client project spaces", descriptionAr: "عرض مساحات عمل المشاريع", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "create", label: "Create Workspaces", labelAr: "إنشاء مساحات جديدة", description: "Create project workspaces", descriptionAr: "إنشاء مساحات عمل جديدة للمشاريع", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "edit", label: "Edit Workspaces", labelAr: "تعديل مساحات المشاريع", description: "Edit workspace details & milestones", descriptionAr: "تعديل مساحة المشروع والمعالم", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "delete", label: "Delete Workspaces", labelAr: "حذف مساحات المشاريع", description: "Permanently delete workspaces", descriptionAr: "حذف مساحات المشاريع نهائياً", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
  ],
  team: [
    { key: "view", label: "View Team Workload", labelAr: "عرض أعباء الفريق", description: "View capacity matrix", descriptionAr: "عرض مصفوفة أعباء الفريق والقدرة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "manage", label: "Manage Team Members", labelAr: "إدارة أعضاء الفريق", description: "Manage positions and capacity", descriptionAr: "إدارة مناصب وسعة أعضاء الفريق", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  content_cms: [
    { key: "view", label: "View CMS Content", labelAr: "عرض محتوى الموقع", description: "View projects, reels, blog, and products", descriptionAr: "عرض المحتوى والمقالات والريلز", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "create", label: "Create Content", labelAr: "إضافة محتوى جديد", description: "Create new CMS posts or items", descriptionAr: "إضافة مقالات أو أعمال جديدة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "edit", label: "Edit Content", labelAr: "تعديل المحتوى", description: "Edit existing content entries", descriptionAr: "تعديل المحتوى والعناصر المنشورة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "delete", label: "Delete Content", labelAr: "حذف المحتوى", description: "Permanently delete content entries", descriptionAr: "حذف المحتوى نهائياً", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "publish", label: "Publish Content", labelAr: "نشر المحتوى", description: "Publish or unpublish to live website", descriptionAr: "نشر أو إلغاء نشر المحتوى في الموقع", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  calendar: [
    { key: "view", label: "View Calendar", labelAr: "عرض التقويم", description: "View production calendar", descriptionAr: "عرض تقويم الإنتاج والمواعيد", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "schedule", label: "Schedule Events", labelAr: "جدولة الجلسات والمواعيد", description: "Create shooting sessions & events", descriptionAr: "إضافة وتعديل جلسات التصوير والمواعيد", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  compensation: [
    { key: "view", label: "View Compensation", labelAr: "عرض المستحقات", description: "View personal salary & payments", descriptionAr: "عرض الراتب الشخصي والمدفوعات", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "request_advance", label: "Request Salary Advance", labelAr: "طلب سلفة مالية", description: "Submit salary advance request", descriptionAr: "تقديم طلب سلفة مالية مبكرة", defaultByRole: { super_admin: true, admin: true, worker: true } },
  ],
  inquiries: [
    { key: "view", label: "View Inquiries", labelAr: "عرض الاستفسارات", description: "View contact form submissions", descriptionAr: "عرض رسائل التواصل واختبار الباقة", defaultByRole: { super_admin: true, admin: true, worker: false } },
    { key: "manage", label: "Manage Inquiries", labelAr: "إدارة والرد على الرسائل", description: "Update status and notes", descriptionAr: "تحديث حالة الاستفسار والملاحظات", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  dashboard: [
    { key: "view", label: "View Dashboard", labelAr: "عرض لوحة التحكم", description: "View operational dashboard", descriptionAr: "عرض النظرة العامة والمؤشرات", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "clear_notification", label: "Clear Notifications", labelAr: "مسح الإشعارات", description: "Clear or dismiss notifications", descriptionAr: "حذف أو استبعاد الإشعارات", defaultByRole: { super_admin: true, admin: true, worker: true } },
    { key: "manage_preferences", label: "Manage Preferences", labelAr: "إدارة التفضيلات", description: "Manage notification preferences", descriptionAr: "إدارة تفضيلات الإشعارات الشخصية", defaultByRole: { super_admin: true, admin: true, worker: true } },
  ],
  analytics: [
    { key: "view", label: "View Analytics", labelAr: "عرض التحليلات", description: "View performance KPIs", descriptionAr: "عرض مؤشرات الأداء والتحليلات", defaultByRole: { super_admin: true, admin: true, worker: false } },
  ],
  workflows: [
    { key: "view", label: "View Workflows", labelAr: "عرض قوالب العمل", description: "View workflow pipelines", descriptionAr: "عرض قوالب مسارات العمل", defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "manage", label: "Manage Workflows", labelAr: "إدارة وتعديل القوالب", description: "Configure workflow stages", descriptionAr: "إنشاء وتعديل مراحل العمل والتبعيات", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
  ],
  business_rules: [
    { key: "view", label: "View Business Rules", labelAr: "عرض قواعد العمل", description: "View governance formulas", descriptionAr: "عرض المعادلات والسياسات المركزية", defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "manage", label: "Manage Business Rules", labelAr: "تعديل السياسات والقواعد", description: "Edit financial formulas & thresholds", descriptionAr: "تعديل المعادلات والنسب المركزية", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
  ],
  accounts: [
    { key: "view", label: "View Accounts", labelAr: "عرض الحسابات", description: "View account members directory", descriptionAr: "عرض دليل حسابات أعضاء النظام", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
    { key: "manage", label: "Manage Accounts & Roles", labelAr: "إدارة الحسابات والأدوار والأمان", description: "Full root identity management & permission control", descriptionAr: "إنشاء وإدارة الهويات وبيانات الاعتماد والصلاحيات", superAdminOnly: true, defaultByRole: { super_admin: true, admin: false, worker: false } },
  ],
};

/**
 * Normalizes a raw permission config to boolean enabled state
 */
export function isModuleEnabled(
  permission: boolean | ModulePermissionConfig | undefined
): boolean {
  if (permission === undefined) return false;
  if (typeof permission === "boolean") return permission;
  return Boolean(permission.enabled);
}

/**
 * Computes effective permission for a module master switch:
 * User Custom Override ?? Role Baseline Default
 */
export function getEffectiveModulePermission(
  module: SadaModule,
  role: SadaRole,
  overrides?: UserModulePermissions | null
): boolean {
  // Security Invariant: Accounts management is strictly Super Admin root exclusive
  if (module === "accounts") {
    return role === "super_admin";
  }

  // Super Admin has full root access by default
  if (role === "super_admin") {
    if (overrides && overrides[module] !== undefined) {
      return isModuleEnabled(overrides[module]);
    }
    return true;
  }

  // Explicit user override takes precedence over role defaults
  if (overrides && overrides[module] !== undefined) {
    return isModuleEnabled(overrides[module]);
  }

  // Fallback to role baseline defaults
  return Boolean(ROLE_DEFAULT_MODULE_PERMISSIONS[role]?.[module]);
}

/**
 * Computes effective permission for a specific granular action within a module:
 * Returns { enabled, isOverride, isSuperAdmin, isLocked, source }
 */
export function getEffectiveActionPermission(
  module: SadaModule,
  action: string,
  role: SadaRole,
  overrides?: UserModulePermissions | null
): {
  enabled: boolean;
  isOverride: boolean;
  isSuperAdmin: boolean;
  isLocked: boolean;
  source: "super_admin" | "override" | "default";
} {
  // 1. Root Super Admin invariant
  if (role === "super_admin") {
    return {
      enabled: true,
      isOverride: false,
      isSuperAdmin: true,
      isLocked: false,
      source: "super_admin",
    };
  }

  // 2. Accounts module is locked root exclusive
  if (module === "accounts") {
    return {
      enabled: false,
      isOverride: false,
      isSuperAdmin: false,
      isLocked: true,
      source: "default",
    };
  }

  // 3. Permanent deletion actions are locked Super Admin only
  const isDeleteAction = action === "delete" || action === "delete_lead" || action === "delete_transaction";
  if (isDeleteAction) {
    return {
      enabled: false,
      isOverride: false,
      isSuperAdmin: false,
      isLocked: true,
      source: "default",
    };
  }

  const cleanAction = action.includes(".") ? action.split(".").pop()! : action;

  // 4. If module master switch is explicitly disabled in overrides, all actions are disabled
  const modOverride = overrides?.[module];
  if (modOverride !== undefined) {
    const isModEnabled = isModuleEnabled(modOverride);
    if (!isModEnabled) {
      return {
        enabled: false,
        isOverride: true,
        isSuperAdmin: false,
        isLocked: false,
        source: "override",
      };
    }

    // Module is enabled in overrides. Check for granular action override
    if (typeof modOverride === "object" && modOverride !== null && modOverride.actions) {
      const actVal =
        modOverride.actions[action] ??
        modOverride.actions[cleanAction] ??
        modOverride.actions[`${module}.${cleanAction}`];
      if (actVal !== undefined) {
        return {
          enabled: Boolean(actVal),
          isOverride: true,
          isSuperAdmin: false,
          isLocked: false,
          source: "override",
        };
      }
    }

    // Baseline: When a module is explicitly enabled via override, viewing that module is enabled by default
    if (cleanAction === "view") {
      return {
        enabled: true,
        isOverride: true,
        isSuperAdmin: false,
        isLocked: false,
        source: "override",
      };
    }

    // For Admin role with explicitly enabled module, grant standard operational actions unless explicitly denied
    if (role === "admin") {
      return {
        enabled: true,
        isOverride: true,
        isSuperAdmin: false,
        isLocked: false,
        source: "override",
      };
    }
  }

  // 5. If module is disabled by role default, action is disabled
  const isModDefaultEnabled = Boolean(ROLE_DEFAULT_MODULE_PERMISSIONS[role]?.[module]);
  if (!isModDefaultEnabled && modOverride === undefined) {
    return {
      enabled: false,
      isOverride: false,
      isSuperAdmin: false,
      isLocked: false,
      source: "default",
    };
  }

  // 6. Look up action in catalog default for this role
  const catActions = MODULE_ACTIONS_CATALOG[module] || [];
  const actionMeta = catActions.find((a) => a.key === action || a.key === cleanAction);
  if (actionMeta) {
    const defaultVal = Boolean(actionMeta.defaultByRole[role]);
    return {
      enabled: defaultVal,
      isOverride: false,
      isSuperAdmin: false,
      isLocked: Boolean(actionMeta.superAdminOnly),
      source: "default",
    };
  }

  // Fallback for generic actions
  if (cleanAction === "view") {
    return { enabled: true, isOverride: false, isSuperAdmin: false, isLocked: false, source: "default" };
  }
  if (role === "admin") {
    const isAllowed = cleanAction === "create" || cleanAction === "edit" || cleanAction === "approve" || cleanAction === "assign";
    return { enabled: isAllowed, isOverride: false, isSuperAdmin: false, isLocked: false, source: "default" };
  }
  return { enabled: false, isOverride: false, isSuperAdmin: false, isLocked: false, source: "default" };
}

/**
 * Checks if a role with optional overrides can perform an action on a module
 */
export function canPerformAction(
  module: SadaModule,
  action: string,
  role: SadaRole,
  overrides?: UserModulePermissions | null
): boolean {
  return getEffectiveActionPermission(module, action, role, overrides).enabled;
}

/**
 * Extensible action-level check: view, create, edit, delete, approve, etc.
 * Backward compatible with Phase A.1 callers
 */
export function canPerformModuleAction(
  module: SadaModule,
  action: SadaAction,
  role: SadaRole,
  overrides?: UserModulePermissions | null
): boolean {
  return canPerformAction(module, action, role, overrides);
}

/**
 * Evaluates any granular permission string (e.g. 'sales.create_lead', 'tasks.assign', or 'finance')
 */
export function hasPermission(
  permission: GranularPermission | string,
  role: SadaRole,
  overrides?: UserModulePermissions | null
): boolean {
  if (!permission) return false;
  const p = permission.trim().toLowerCase();
  const dotIndex = p.indexOf(".");
  if (dotIndex > 0) {
    const mod = p.substring(0, dotIndex) as SadaModule;
    const act = p.substring(dotIndex + 1);
    return canPerformAction(mod, act, role, overrides);
  }
  return getEffectiveModulePermission(p as SadaModule, role, overrides);
}

/**
 * Maps a URL route pathname to its canonical SadaModule
 */
export function resolveModuleFromPath(pathname: string): SadaModule | null {
  let p = pathname.toLowerCase();

  // Protected application entry path obscurity mapping
  if (p === "/sada-os" || p === "/sada-os/") return "dashboard";
  if (p.startsWith("/sada-os/")) {
    p = p.replace("/sada-os", "/admin");
  }

  // Root admin dashboard
  if (p === "/admin" || p === "/admin/") return "dashboard";

  if (p.startsWith("/admin/client-workspaces") || p.startsWith("/admin/clients")) return "clients";
  if (p.startsWith("/admin/my-work")) return "tasks";
  if (p.startsWith("/admin/calendar")) return "calendar";
  if (p.startsWith("/admin/client-projects")) return "clients";
  if (p.startsWith("/admin/team-workload")) return "team";
  if (p.startsWith("/admin/sales") || p.startsWith("/admin/deals") || p.startsWith("/admin/commissions")) return "sales";
  if (p.startsWith("/admin/packages")) return "packages";
  if (p.startsWith("/admin/analytics")) return "analytics";
  if (p.startsWith("/admin/contact")) return "inquiries";
  if (p.startsWith("/admin/finance")) return "finance";
  if (p.startsWith("/admin/my-salary") || p.startsWith("/admin/salary")) return "compensation";
  if (
    p.startsWith("/admin/projects") ||
    p.startsWith("/admin/reels") ||
    p.startsWith("/admin/blog") ||
    p.startsWith("/admin/products") ||
    p.startsWith("/admin/testimonials") ||
    p.startsWith("/admin/site-content")
  ) {
    return "content_cms";
  }
  if (p.startsWith("/admin/workflow-templates")) return "workflows";
  if (p.startsWith("/admin/business-rules") || p.startsWith("/admin/settings/business-rules")) return "business_rules";
  if (p.startsWith("/admin/accounts") || p.startsWith("/admin/users")) return "accounts";

  return null;
}
