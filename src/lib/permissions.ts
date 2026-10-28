export * from "@/types/permissions";
import {
  type SadaRole,
  type SadaModule,
  type SadaAction,
  type UserModulePermissions,
  type GranularPermission,
  getEffectiveModulePermission,
  getEffectiveActionPermission,
  canPerformAction,
  canPerformModuleAction,
  hasPermission,
  resolveModuleFromPath,
  SADA_MODULES,
  MODULE_ACTIONS_CATALOG,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
} from "@/types/permissions";

export interface PermissionContext {
  role: SadaRole | null;
  userId?: string | null;
  memberProfileId?: string | null;
  memberId?: string | null;
  customPermissions?: UserModulePermissions | null;
  effectivePermissions?: Record<SadaModule, boolean>;
}

export function normalizeRole(roleStr: string | null | undefined): SadaRole {
  if (!roleStr) return "worker";
  const r = roleStr.toLowerCase().trim();
  if (r === "super_admin" || r === "superadmin" || r === "super admin") return "super_admin";
  if (r === "admin") return "admin";
  return "worker";
}

export function getRoleLabel(role: SadaRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "worker":
      return "Worker";
  }
}

export function getRoleBadgeStyle(role: SadaRole): {
  label: string;
  badgeClass: string;
  dotColor: string;
} {
  switch (role) {
    case "super_admin":
      return {
        label: "Super Admin",
        badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
        dotColor: "bg-purple-500",
      };
    case "admin":
      return {
        label: "Admin",
        badgeClass: "bg-primary/10 text-primary border border-primary/20",
        dotColor: "bg-primary",
      };
    case "worker":
      return {
        label: "Worker",
        badgeClass: "bg-muted text-muted-foreground border border-border",
        dotColor: "bg-muted-foreground",
      };
  }
}

/**
 * Checks if a given task is assigned to the current user/worker.
 * Matches on auth user.id, team_member.profile_id, or team_member.id.
 */
export function isTaskAssignedToUser(
  task: { assignee_id?: string | null } | null | undefined,
  ctx: PermissionContext
): boolean {
  if (!task || !task.assignee_id) return false;
  const target = task.assignee_id;
  if (ctx.userId && target === ctx.userId) return true;
  if (ctx.memberProfileId && target === ctx.memberProfileId) return true;
  if (ctx.memberId && target === ctx.memberId) return true;
  return false;
}

/**
 * Phase E: Authority over a specific parent task.
 * Allowed parent-task authorities:
 * 1. Super Admin
 * 2. Task creator (assigned_by_id)
 * 3. Current main task assignee (assignee_id)
 * Note: Subtask assignees do NOT gain authority over the parent task.
 */
export function hasParentTaskAuthority(
  task: { assignee_id?: string | null; assigned_by_id?: string | null } | null | undefined,
  ctx: PermissionContext
): boolean {
  if (!task || !ctx) return false;
  // 1. Super Admin has root authority over all parent tasks
  if (ctx.role === "super_admin") return true;

  const uid = ctx.userId;
  const profileId = ctx.memberProfileId;
  const memberId = ctx.memberId;

  // 2. Task creator (assigned_by_id matches user id, profile id, or team member id)
  if (task.assigned_by_id) {
    if (uid && task.assigned_by_id === uid) return true;
    if (profileId && task.assigned_by_id === profileId) return true;
    if (memberId && task.assigned_by_id === memberId) return true;
  }

  // 3. Current main task assignee (assignee_id matches user id, profile id, or team member id)
  if (task.assignee_id) {
    if (uid && task.assignee_id === uid) return true;
    if (profileId && task.assignee_id === profileId) return true;
    if (memberId && task.assignee_id === memberId) return true;
  }

  return false;
}

/**
 * Phase E Canonical Formula:
 * global permission AND (Super Admin OR creator OR main assignee)
 */
export function canCreateSubtaskForTask(
  ctx: PermissionContext,
  parentTask?: { assignee_id?: string | null; assigned_by_id?: string | null } | null
): boolean {
  const hasGlobalPerm = can(ctx, "tasks.create_subtask");
  if (!hasGlobalPerm) return false;

  // If no parent task context is passed, returns global permission status
  if (!parentTask) return true;

  return hasParentTaskAuthority(parentTask, ctx);
}


/**
 * Checks if a user has effective access to a given SADA module/page.
 * User -> Role -> Effective Permissions.
 */
export function canAccessModule(
  roleOrCtx: string | SadaRole | PermissionContext | null | undefined,
  module: SadaModule,
  customOverrides?: UserModulePermissions | null
): boolean {
  if (!roleOrCtx) return false;
  if (typeof roleOrCtx === "string") {
    const role = normalizeRole(roleOrCtx);
    return getEffectiveModulePermission(module, role, customOverrides);
  }
  const role = roleOrCtx.role ? normalizeRole(roleOrCtx.role) : "worker";
  const overrides = customOverrides || roleOrCtx.customPermissions;
  return getEffectiveModulePermission(module, role, overrides);
}

/**
 * Checks if a user/context can perform a specific granular permission
 * E.g. can(ctx, "sales.create_lead") or can(ctx, "tasks.assign")
 */
export function can(
  roleOrCtx: string | SadaRole | PermissionContext | null | undefined,
  permission: GranularPermission | string,
  customOverrides?: UserModulePermissions | null
): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? normalizeRole(roleOrCtx) : normalizeRole(roleOrCtx.role);
  const overrides =
    customOverrides ||
    (typeof roleOrCtx === "object"
      ? roleOrCtx.customPermissions || (roleOrCtx as any).customOverrides
      : null);
  return hasPermission(permission, role, overrides);
}

/**
 * Asserts that the current context has access to the specified module.
 */
export function assertCanAccessModule(
  ctx: PermissionContext,
  module: SadaModule
): void {
  if (!canAccessModule(ctx, module)) {
    throw new Error(`Unauthorized: Access to module '${module}' is disabled for this account.`);
  }
}

export const assertActorCanAccessModule = assertCanAccessModule;

/**
 * Asserts that the current context can perform the specified granular permission.
 */
export function assertCan(
  ctx: PermissionContext,
  permission: GranularPermission | string
): void {
  if (!can(ctx, permission)) {
    throw new Error(`Unauthorized: Permission '${permission}' is disabled or prohibited for this account.`);
  }
}

export function assertActorCanPerformAction(
  ctx: PermissionContext,
  module: SadaModule,
  action: string
): void {
  const role = ctx.role ? normalizeRole(ctx.role) : "worker";
  if (!canPerformAction(module, action, role, ctx.customPermissions)) {
    throw new Error(`Unauthorized: Action '${action}' on module '${module}' is prohibited for this account.`);
  }
}

export function assertCanManageSales(ctx: PermissionContext): void {
  assertCan(ctx, "sales.view");
}

export function assertCanManageWorkflows(ctx: PermissionContext): void {
  assertCan(ctx, "workflows.manage");
}

/**
 * Centralized RBAC & Granular Permission Matrix (Phase B)
 */
export const permissions = {
  // --- View Capabilities ---
  canViewWorkspace: (ctx: PermissionContext) => can(ctx, "workspaces.view"),
  canViewTask: (ctx: PermissionContext) => can(ctx, "tasks.view"),
  canViewCalendar: (ctx: PermissionContext) => can(ctx, "calendar.view"),
  canViewDashboard: (ctx: PermissionContext) => can(ctx, "dashboard.view"),
  canViewClients: (ctx: PermissionContext) => can(ctx, "clients.view"),
  canViewSales: (ctx: PermissionContext) => can(ctx, "sales.view"),
  canViewPackages: (ctx: PermissionContext) => can(ctx, "packages.view"),
  canViewFinance: (ctx: PermissionContext) => can(ctx, "finance.view"),
  canViewCompensation: (ctx: PermissionContext) => can(ctx, "compensation.view"),

  // --- Sales Granular Capabilities ---
  canCreateLead: (ctx: PermissionContext) => can(ctx, "sales.create_lead"),
  canEditLead: (ctx: PermissionContext) => can(ctx, "sales.edit_lead"),
  canDeleteLead: (ctx: PermissionContext) => can(ctx, "sales.delete_lead"),
  canChangeDealStage: (ctx: PermissionContext) => can(ctx, "sales.change_stage"),
  canConvertLead: (ctx: PermissionContext) => can(ctx, "sales.convert_lead"),

  // --- Task Definition & Administration ---
  canCreateTask: (ctx: PermissionContext) => can(ctx, "tasks.create"),
  canEditTaskDefinition: (ctx: PermissionContext) => can(ctx, "tasks.edit"),
  canAssignTask: (ctx: PermissionContext) => can(ctx, "tasks.assign"),
  canReassignTask: (ctx: PermissionContext) => can(ctx, "tasks.assign"),
  canCreateSubtask: (ctx: PermissionContext, parentTask?: { assignee_id?: string | null; assigned_by_id?: string | null } | null) =>
    canCreateSubtaskForTask(ctx, parentTask),
  canChangeDeadline: (ctx: PermissionContext) => can(ctx, "tasks.change_due_date"),
  canChangePriority: (ctx: PermissionContext) => can(ctx, "tasks.change_priority"),
  canChangePhase: (ctx: PermissionContext) => can(ctx, "tasks.edit"),
  canChangeCategory: (ctx: PermissionContext) => can(ctx, "tasks.edit"),
  canChangeService: (ctx: PermissionContext) => can(ctx, "tasks.edit"),
  canEditEstimatedTime: (ctx: PermissionContext) => can(ctx, "tasks.edit"),

  // --- Task Execution & Progress (Admin, Super Admin, or Assigned Worker) ---
  canUpdateTaskProgress: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin") return true;
    if (can(ctx, "tasks.change_status")) {
      if (ctx.role === "admin") return true;
      if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    }
    return false;
  },
  canChangeStatus: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin") return true;
    if (can(ctx, "tasks.change_status")) {
      if (ctx.role === "admin") return true;
      if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    }
    return false;
  },
  canCompleteTask: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin") return true;
    if (can(ctx, "tasks.complete")) {
      if (ctx.role === "admin") return true;
      if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    }
    return false;
  },
  canAddDeliverable: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin") return true;
    if (can(ctx, "tasks.add_deliverable")) {
      if (ctx.role === "admin") return true;
      if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    }
    return false;
  },
  canEditDeliverables: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin") return true;
    if (can(ctx, "tasks.add_deliverable")) {
      if (ctx.role === "admin") return true;
      if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    }
    return false;
  },
  canUpdateActualTime: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin" || ctx.role === "admin") return true;
    if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    return false;
  },
  canEditInternalNotes: (ctx: PermissionContext, task?: { assignee_id?: string | null }) => {
    if (!can(ctx, "tasks.view")) return false;
    if (ctx.role === "super_admin" || ctx.role === "admin") return true;
    if (ctx.role === "worker") return isTaskAssignedToUser(task, ctx);
    return false;
  },

  // --- Project, Client & Team Management ---
  canCreateProject: (ctx: PermissionContext) => can(ctx, "workspaces.create"),
  canEditProject: (ctx: PermissionContext) => can(ctx, "workspaces.edit"),
  canCreateClient: (ctx: PermissionContext) => can(ctx, "clients.create"),
  canEditClient: (ctx: PermissionContext) => can(ctx, "clients.edit"),
  canReconcilePackage: (ctx: PermissionContext) => can(ctx, "clients.reconcile"),
  canViewClient: (ctx: PermissionContext) => can(ctx, "clients.view"),
  canManageTeam: (ctx: PermissionContext) => can(ctx, "team.manage"),

  // --- Financial & Compensation Command Center ---
  canCreateIncome: (ctx: PermissionContext) => can(ctx, "finance.create_income"),
  canCreateExpense: (ctx: PermissionContext) => can(ctx, "finance.create_expense"),
  canManageFinance: (ctx: PermissionContext) => can(ctx, "finance.view") && ctx.role === "super_admin",
  canManageSalaries: (ctx: PermissionContext) => can(ctx, "finance.manage_salaries"),
  canApproveSalaryRequest: (ctx: PermissionContext) => can(ctx, "finance.approve_advance"),
  canViewOwnCompensation: (ctx: PermissionContext) => can(ctx, "compensation.view"),
  canRequestEarlyPayment: (ctx: PermissionContext) => can(ctx, "compensation.request_advance"),

  // --- Package Management ---
  canCreatePackage: (ctx: PermissionContext) => can(ctx, "packages.create"),
  canEditPackage: (ctx: PermissionContext) => can(ctx, "packages.edit"),
  canPublishPackages: (ctx: PermissionContext) => can(ctx, "packages.publish"),

  // --- System Level Management (Super Admin only) ---
  canManageRoles: (ctx: PermissionContext) => ctx.role === "super_admin",
  canManageAccounts: (ctx: PermissionContext) => ctx.role === "super_admin",
  canArchive: (ctx: PermissionContext) => ctx.role === "super_admin" || ctx.role === "admin",

  // --- CRITICAL: Permanent Delete / Remove is SUPER ADMIN ONLY! ---
  canDelete: (ctx: PermissionContext) => ctx.role === "super_admin",
  canDeleteTask: (ctx: PermissionContext) => ctx.role === "super_admin",
  canDeleteProject: (ctx: PermissionContext) => ctx.role === "super_admin",
  canDeleteClient: (ctx: PermissionContext) => ctx.role === "super_admin",
  canDeleteTeamMember: (ctx: PermissionContext) => ctx.role === "super_admin",
  canDeleteFile: (ctx: PermissionContext) => ctx.role === "super_admin",
};

// --- Direct Convenience Helpers ---
export function canDelete(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin";
}

export function canDeleteTask(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canDelete(roleOrCtx);
}

export function canCreateTask(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "tasks.create");
}

export function canEditTask(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "tasks.edit");
}

export function canAssignTask(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "tasks.assign");
}

export function canChangeTaskPriority(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "tasks.change_priority");
}

export function canChangeTaskDueDate(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "tasks.change_due_date");
}

export function canChangeTaskStatus(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): boolean {
  return permissions.canChangeStatus(ctx, task);
}

export function canAddDeliverable(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): boolean {
  return permissions.canAddDeliverable(ctx, task);
}

export function canCompleteTask(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): boolean {
  return permissions.canCompleteTask(ctx, task);
}

export function canDeleteProject(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canDelete(roleOrCtx);
}

export function canDeleteClient(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canDelete(roleOrCtx);
}

export function canDeleteTeamMember(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canDelete(roleOrCtx);
}

export function canManageRoles(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin";
}

export function canManageAccounts(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin";
}

export function assertCanManageAccounts(ctx: PermissionContext): void {
  if (!permissions.canManageAccounts(ctx)) {
    throw new Error("Unauthorized: Account management is restricted to Super Admin only.");
  }
}

export function canViewFinance(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canAccessModule(roleOrCtx, "finance");
}

export function canAccessFinance(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canAccessModule(roleOrCtx, "finance");
}

export function canManageTeam(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return (role === "super_admin" || role === "admin") && canAccessModule(roleOrCtx, "team");
}

export function canViewAuditLogs(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin";
}

export function canManageClients(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return (role === "super_admin" || role === "admin") && canAccessModule(roleOrCtx, "clients");
}

export function canManageSales(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  return canAccessModule(roleOrCtx, "sales");
}

export function canManagePackages(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return (role === "super_admin" || role === "admin") && canAccessModule(roleOrCtx, "packages");
}

export function canPublishPackages(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return (role === "super_admin" || role === "admin") && canAccessModule(roleOrCtx, "packages");
}

export function canManageFinance(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin" && canAccessModule(roleOrCtx, "finance");
}

export function canManageSalaries(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin" && canAccessModule(roleOrCtx, "finance");
}

export function canApproveSalaryRequest(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  if (!roleOrCtx) return false;
  const role = typeof roleOrCtx === "string" ? roleOrCtx : roleOrCtx.role;
  return role === "super_admin";
}

export function canViewOwnCompensation(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canAccessModule(roleOrCtx, "compensation");
}

export function canRequestEarlyPayment(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canAccessModule(roleOrCtx, "compensation");
}

/**
 * Data/Action-level assertion guards.
 * Throws an error or returns false if unauthorized.
 */
export function assertCanDelete(ctx: PermissionContext, entityName = "data"): void {
  if (!permissions.canDelete(ctx)) {
    throw new Error(`Unauthorized: Only Super Admin can permanently delete ${entityName}.`);
  }
}

export function assertCanViewFinance(ctx: PermissionContext): void {
  if (!permissions.canViewFinance(ctx)) {
    throw new Error("Unauthorized: Company finance is restricted to Super Admin or Finance-authorized administrators.");
  }
}

export function assertCanManageFinance(ctx: PermissionContext): void {
  if (!permissions.canManageFinance(ctx)) {
    throw new Error("Unauthorized: Modifying financial accounts is restricted to Super Admin only.");
  }
}

export function assertCanApproveSalaryRequest(ctx: PermissionContext): void {
  if (!permissions.canApproveSalaryRequest(ctx)) {
    throw new Error("Unauthorized: Only Super Admin can approve or reject salary advance requests.");
  }
}

export function assertCanEditTaskDefinition(ctx: PermissionContext): void {
  if (!permissions.canEditTaskDefinition(ctx)) {
    throw new Error("Unauthorized: Only authorized Admins can modify task definitions.");
  }
}

export function assertCanCreateTask(ctx: PermissionContext): void {
  if (!canCreateTask(ctx)) {
    throw new Error("Unauthorized: Account lacks 'tasks.create' permission.");
  }
}

export function assertCanEditTask(ctx: PermissionContext): void {
  if (!canEditTask(ctx)) {
    throw new Error("Unauthorized: Modifying task definitions requires 'tasks.edit' permission.");
  }
}

export function assertCanAssignTask(ctx: PermissionContext): void {
  if (!canAssignTask(ctx)) {
    throw new Error("Unauthorized: Assigning or reassigning tasks requires 'tasks.assign' permission.");
  }
}

export function assertCanChangeTaskPriority(ctx: PermissionContext): void {
  if (!canChangeTaskPriority(ctx)) {
    throw new Error("Unauthorized: Modifying task priority requires 'tasks.change_priority' permission.");
  }
}

export function assertCanChangeTaskDueDate(ctx: PermissionContext): void {
  if (!canChangeTaskDueDate(ctx)) {
    throw new Error("Unauthorized: Modifying task due date or deadline requires 'tasks.change_due_date' permission.");
  }
}

export function assertCanAddDeliverable(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): void {
  if (!canAddDeliverable(ctx, task)) {
    throw new Error("Unauthorized: Attaching deliverables requires 'tasks.add_deliverable' permission on assigned tasks.");
  }
}

export function assertCanCompleteTask(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): void {
  if (!canCompleteTask(ctx, task)) {
    throw new Error("Unauthorized: Completing tasks requires 'tasks.complete' permission on assigned tasks.");
  }
}

export function assertCanChangeTaskStatus(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): void {
  if (!canChangeTaskStatus(ctx, task)) {
    throw new Error("Unauthorized: Updating task status requires 'tasks.change_status' permission on assigned tasks.");
  }
}

export function assertCanUpdateTaskProgress(
  ctx: PermissionContext,
  task?: { assignee_id?: string | null }
): void {
  if (!permissions.canUpdateTaskProgress(ctx, task)) {
    throw new Error("Unauthorized: Workers can only update execution on tasks assigned to them.");
  }
}

// ============================================================
// Phase H: Sales Granular Access Helpers & Assertions
// ============================================================
export function canCreateLead(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "sales.create_lead");
}

export function canEditLead(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "sales.edit_lead");
}

export function canDeleteLead(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return canDelete(roleOrCtx) && can(roleOrCtx, "sales.delete_lead");
}

export function canChangeDealStage(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "sales.change_stage");
}

export function canConvertLead(roleOrCtx: string | SadaRole | PermissionContext | null | undefined): boolean {
  return can(roleOrCtx, "sales.convert_lead");
}

export function assertCanCreateLead(ctx: PermissionContext): void {
  if (!canCreateLead(ctx)) {
    throw new Error("Unauthorized: Account lacks 'sales.create_lead' permission.");
  }
}

export function assertCanEditLead(ctx: PermissionContext): void {
  if (!canEditLead(ctx)) {
    throw new Error("Unauthorized: Modifying deal details requires 'sales.edit_lead' permission.");
  }
}

export function assertCanDeleteLead(ctx: PermissionContext): void {
  if (!canDeleteLead(ctx)) {
    throw new Error("Unauthorized: Permanent deletion in module 'sales' is strictly Super Admin exclusive (requires 'sales.delete_lead' permission).");
  }
}

export function assertCanChangeDealStage(ctx: PermissionContext): void {
  if (!canChangeDealStage(ctx)) {
    throw new Error("Unauthorized: Moving deal stages requires 'sales.change_stage' permission.");
  }
}

export function assertCanConvertLead(ctx: PermissionContext): void {
  if (!canConvertLead(ctx)) {
    throw new Error("Unauthorized: Finalizing won sales requires 'sales.convert_lead' permission.");
  }
}


// Re-export Phase 5 Security Isolation Layer
export * from "./security-isolation-service";

// Re-export Phase C Canonical Route Permission Registry
export * from "./route-permission-registry";

// Re-export Phase I Targeted Rate Limiting & Abuse Protection
export * from "./rate-limiter";
