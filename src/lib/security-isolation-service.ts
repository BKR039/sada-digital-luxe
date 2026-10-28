// ============================================================
// SADA WORK OS — DEDICATED SECURITY ISOLATION LAYER (PHASE 5)
// Multi-Tier Security Isolation:
// Authentication + Role + Effective Permissions + Data Scope/Ownership + Server/Database Authorization
//
// Invariants:
// 1. Never trust client-provided role or permission strings.
// 2. Never authorize merely because a user knows an ID or direct URL.
// 3. UI hiding is NEVER authorization; guards must execute at route,
//    server/API, and database/RLS levels.
// 4. Zero cross-account data leaks.
// 5. Zero cross-worker compensation or private work session leaks.
// ============================================================

import {
  type SadaRole,
  type SadaModule,
  type SadaAction,
  type UserModulePermissions,
  getEffectiveModulePermission,
  canPerformModuleAction,
  resolveModuleFromPath,
  hasPermission,
  SADA_MODULES,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
} from "@/types/permissions";
import { normalizeRole, type PermissionContext } from "@/lib/permissions";
import { lookupRouteRegistry, type RoutePermissionEntry } from "@/lib/route-permission-registry";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRateLimitCategory, assertRateLimit } from "@/lib/rate-limiter";
import {
  getCurrentSessionId,
  setCurrentSessionId,
  clearCurrentSessionId,
} from "@/lib/security-center-service";

// ------------------------------------------------------------
// ERROR TAXONOMY
// ------------------------------------------------------------

export type SecurityErrorCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_INACTIVE"
  | "SESSION_REVOKED"
  | "SESSION_EXPIRED"
  | "UNAUTHORIZED_ROUTE"
  | "UNAUTHORIZED_API"
  | "UNAUTHORIZED_ACTION"
  | "FORBIDDEN_DELETE"
  | "FORBIDDEN_ADMIN_ACTION"
  | "PARENT_TASK_AUTHORITY_DENIED"
  | "DATA_SCOPE_VIOLATION"
  | "CROSS_ACCOUNT_LEAK"
  | "PRIVILEGE_ESCALATION_BLOCKED"
  | "RATE_LIMIT_EXCEEDED";

export class SecurityAuthorizationError extends Error {
  public readonly code: SecurityErrorCode;
  public readonly details?: Record<string, any>;

  constructor(message: string, code: SecurityErrorCode, details?: Record<string, any>) {
    super(message);
    this.name = "SecurityAuthorizationError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, SecurityAuthorizationError.prototype);
  }
}

// ------------------------------------------------------------
// AUTHORITATIVE SECURITY CONTEXT
// ------------------------------------------------------------

export type AccountStatus = "active" | "suspended" | "pending" | "deactivated";

export interface AuthoritativeSecurityContext {
  authenticated: boolean;
  userId: string;
  email: string;
  role: SadaRole;
  status: AccountStatus;
  teamMemberId?: string | null;
  profileId?: string | null;
  customOverrides?: UserModulePermissions | null;
  effectivePermissions: Record<SadaModule, boolean>;
  accountMetadata?: Record<string, any>;
  allowedClientIds?: string[];
}

export type SecurityResourceType =
  | "salary_record"
  | "salary_request"
  | "salary_payment"
  | "work_session"
  | "project_task"
  | "client_workspace"
  | "client_record"
  | "finance_transaction"
  | "finance_account"
  | "workflow_template"
  | "business_rule"
  | "user_account"
  | "audit_log"
  | "sales_deal"
  | "sales_lead"
  | "package_item"
  | "content_project"
  | "blog_post"
  | "digital_product"
  | "testimonial"
  | "social_reel"
  | "notification_message";

// ------------------------------------------------------------
// CACHE LAYER FOR AUTHORITATIVE SECURITY CONTEXT
// ------------------------------------------------------------

interface CachedSecurityContext {
  context: AuthoritativeSecurityContext;
  expiresAt: number;
}

const contextCache = new Map<string, CachedSecurityContext>();
const CACHE_TTL_MS = 10_000; // 10 seconds TTL

export function invalidateSecurityContextCache(userId?: string): void {
  if (userId) {
    contextCache.delete(userId);
  } else {
    contextCache.clear();
  }
}

// ------------------------------------------------------------
// AUTHORITATIVE CONTEXT RESOLVER
// Never trusts client parameters; queries database authority
// ------------------------------------------------------------

export async function resolveAuthoritativeSecurityContext(
  supabaseClient: SupabaseClient,
  overrideUserId?: string,
  options?: { forceFresh?: boolean; sessionId?: string }
): Promise<AuthoritativeSecurityContext> {
  // Fast path: cached context by overrideUserId
  if (!options?.forceFresh && overrideUserId) {
    const cached = contextCache.get(overrideUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }
  }

  // 1. Resolve Auth Identity
  let authUserId = overrideUserId;
  let authEmail = "";

  if (!authUserId) {
    const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !authData?.user) {
      throw new SecurityAuthorizationError(
        "Unauthenticated: Valid session required.",
        "UNAUTHENTICATED"
      );
    }
    authUserId = authData.user.id;
    authEmail = authData.user.email || "";
  }

  // Fast path: cached context by resolved authUserId
  if (!options?.forceFresh && authUserId) {
    const cached = contextCache.get(authUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }
  }

  // 2. Query Authoritative Role from public.user_roles
  const { data: roleRows } = await (supabaseClient as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", authUserId);

  let rawRole: string | undefined;
  if (roleRows && Array.isArray(roleRows) && roleRows.length > 0) {
    if (roleRows.some((r: any) => r.role === "super_admin")) {
      rawRole = "super_admin";
    } else if (roleRows.some((r: any) => r.role === "admin")) {
      rawRole = "admin";
    } else {
      rawRole = roleRows[0]?.role;
    }
  }

  // 3. Query Profile for status and module_permissions (Note: public.profiles has no email or role column)
  const { data: profileRow } = await (supabaseClient as any)
    .from("profiles")
    .select("id, status, module_permissions")
    .eq("id", authUserId)
    .maybeSingle();

  if (!authEmail) {
    try {
      const { data: tmRow } = await (supabaseClient as any)
        .from("team_members")
        .select("email")
        .or(`profile_id.eq.${authUserId},user_id.eq.${authUserId}`)
        .maybeSingle();
      if (tmRow?.email) {
        authEmail = tmRow.email;
      }
    } catch {
      // team_members lookup fallback
    }
  }

  if (!rawRole) {
    // If user_roles table is restricted by RLS to Super Admin,
    // query authoritative SECURITY DEFINER functions is_super_admin / is_admin
    try {
      const { data: isSA } = await (supabaseClient as any).rpc("is_super_admin", {
        _user_id: authUserId,
      });
      if (isSA) {
        rawRole = "super_admin";
      } else {
        const { data: isAdm } = await (supabaseClient as any).rpc("is_admin", {
          _user_id: authUserId,
        });
        if (isAdm) {
          rawRole = "admin";
        }
      }
    } catch {
      // RPC check fallback
    }

    if (!rawRole) {
      // Check team_members.role which is readable by authenticated users
      try {
        const { data: tmRow } = await (supabaseClient as any)
          .from("team_members")
          .select("role")
          .or(`profile_id.eq.${authUserId},user_id.eq.${authUserId}`)
          .maybeSingle();
        if (tmRow?.role) {
          rawRole = tmRow.role;
        }
      } catch {
        // team_members lookup fallback
      }
    }
  }

  // 2. Authoritative session and account verification via database authority
  // Only verify caller's active session reference against the database when evaluating self
  let sessionUserId: string | null = null;
  try {
    const { data: sessData } = await supabaseClient.auth.getSession();
    sessionUserId = sessData?.session?.user?.id || null;
  } catch {
    // optional / unauthenticated
  }

  const isSelfCheck = !overrideUserId || (sessionUserId !== null && overrideUserId === sessionUserId);
  const isExplicitSession = Boolean(options?.sessionId);
  let activeSessionId: string | null = null;
  if (isSelfCheck) {
    if (isExplicitSession) {
      activeSessionId = options!.sessionId!;
    } else if (typeof window !== "undefined" && sessionUserId) {
      activeSessionId = getCurrentSessionId(sessionUserId);
    }
  }

  if (activeSessionId) {
    try {
      let { data: valData } = await (supabaseClient as any).rpc("verify_session_and_account", {
        _session_id: activeSessionId,
      });

      // If ambient session reference had cross-user mismatch, heal gracefully
      if (valData && !valData.valid && valData.code === "SESSION_USER_MISMATCH" && !isExplicitSession && sessionUserId) {
        clearCurrentSessionId(sessionUserId);
        const { data: regData } = await (supabaseClient as any).rpc("register_user_session", {
          _session_id: null,
          _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          _device_type: "desktop",
          _auth_method: "password",
        });
        if (regData?.session_id) {
          activeSessionId = regData.session_id;
          setCurrentSessionId(regData.session_id, sessionUserId);
          const { data: recheckData } = await (supabaseClient as any).rpc("verify_session_and_account", {
            _session_id: activeSessionId,
          });
          valData = recheckData;
        }
      }

      if (valData && !valData.valid) {
        if (valData.code === "SESSION_USER_MISMATCH") {
          throw new SecurityAuthorizationError(
            "Session Tampering Blocked: Session reference does not match authenticated user.",
            "PRIVILEGE_ESCALATION_BLOCKED",
            { userId: authUserId, code: "SESSION_USER_MISMATCH", sessionId: activeSessionId }
          );
        }
        if (valData.code === "ACCOUNT_SUSPENDED") {
          throw new SecurityAuthorizationError(
            "Account Suspended: Access is prohibited by administrator.",
            "ACCOUNT_SUSPENDED",
            { userId: authUserId, code: "ACCOUNT_SUSPENDED" }
          );
        }
        if (valData.code === "ACCOUNT_INACTIVE") {
          throw new SecurityAuthorizationError(
            "Account Deactivated: This identity is retired.",
            "ACCOUNT_INACTIVE",
            { userId: authUserId, code: "ACCOUNT_INACTIVE" }
          );
        }
        if (valData.code === "SESSION_REVOKED") {
          throw new SecurityAuthorizationError(
            "Session Revoked: Access terminated by administrator.",
            "SESSION_REVOKED",
            { userId: authUserId, code: "SESSION_REVOKED" }
          );
        }
        if (valData.code === "SESSION_EXPIRED") {
          throw new SecurityAuthorizationError(
            "Session Expired: Re-authentication required.",
            "SESSION_EXPIRED",
            { userId: authUserId, code: "SESSION_EXPIRED" }
          );
        }
      }
    } catch (rpcErr) {
      if (rpcErr instanceof SecurityAuthorizationError) throw rpcErr;
    }
  }

  const role = normalizeRole(rawRole || "worker");
  let status: AccountStatus = (profileRow?.status as AccountStatus) || "active";

  // Check account status invariant
  if (status === "suspended") {
    throw new SecurityAuthorizationError(
      "Account Suspended: Access is prohibited by administrator.",
      "ACCOUNT_SUSPENDED",
      { userId: authUserId }
    );
  }
  if (status === "deactivated") {
    throw new SecurityAuthorizationError(
      "Account Deactivated: This identity is retired.",
      "ACCOUNT_INACTIVE",
      { userId: authUserId }
    );
  }

  // 4. Query Linked Team Member
  const { data: teamRow } = await (supabaseClient as any)
    .from("team_members")
    .select("id")
    .or(`profile_id.eq.${authUserId},user_id.eq.${authUserId}`)
    .maybeSingle();

  const teamMemberId = teamRow?.id || null;

  // 5. Query Canonical Module Permissions from user_module_permissions table
  const { data: permRows } = await (supabaseClient as any)
    .from("user_module_permissions")
    .select("module, enabled, actions")
    .eq("user_id", authUserId);

  const customOverrides: UserModulePermissions = {};
  if (permRows && Array.isArray(permRows) && permRows.length > 0) {
    for (const r of permRows) {
      customOverrides[r.module as SadaModule] = {
        enabled: Boolean(r.enabled),
        actions: r.actions || undefined,
      };
    }
  } else if (profileRow?.module_permissions && Object.keys(profileRow.module_permissions).length > 0) {
    Object.assign(customOverrides, profileRow.module_permissions);
  }

  // Fallback to SECURITY DEFINER get_effective_user_permissions RPC if overrides are not yet loaded
  if (Object.keys(customOverrides).length === 0) {
    try {
      const { data: effData } = await (supabaseClient as any).rpc("get_effective_user_permissions", {
        _target_user_id: authUserId,
      });
      if (effData?.modules) {
        for (const [mKey, mVal] of Object.entries(effData.modules as Record<string, any>)) {
          if (mVal && typeof mVal === "object") {
            customOverrides[mKey as SadaModule] = {
              enabled: Boolean(mVal.enabled),
              actions: mVal.actions || undefined,
            };
          }
        }
      }
    } catch {
      // RPC fallback
    }
  }

  // 6. Compute Comprehensive Effective Permissions for all 16 SADA Modules
  const effectivePermissions = {} as Record<SadaModule, boolean>;
  for (const meta of SADA_MODULES) {
    effectivePermissions[meta.key] = getEffectiveModulePermission(
      meta.key,
      role,
      customOverrides
    );
  }

  const resolvedContext: AuthoritativeSecurityContext = {
    authenticated: true,
    userId: authUserId,
    email: authEmail,
    role,
    status,
    teamMemberId,
    profileId: authUserId,
    customOverrides,
    effectivePermissions,
  };

  contextCache.set(authUserId, {
    context: resolvedContext,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return resolvedContext;
}

// ------------------------------------------------------------
// ROUTE ACCESS EVALUATOR (Route Guard Defense)
// ------------------------------------------------------------

export interface RouteEvaluationResult {
  allowed: boolean;
  code?: SecurityErrorCode;
  reason?: string;
  module: SadaModule | null;
  targetPath: string;
}

export function evaluateRouteAccess(
  pathname: string,
  ctx: AuthoritativeSecurityContext
): RouteEvaluationResult {
  const registryEntry = lookupRouteRegistry(pathname);
  const mod = registryEntry?.module || resolveModuleFromPath(pathname);

  // Unmapped path outside admin or root public page
  if (!mod && !registryEntry) {
    return {
      allowed: true,
      module: null,
      targetPath: pathname,
    };
  }

  // Check authentication
  if (!ctx.authenticated || !ctx.userId) {
    return {
      allowed: false,
      code: "UNAUTHENTICATED",
      reason: "Session authentication required to access SADA OS admin routes.",
      module: mod,
      targetPath: pathname,
    };
  }

  // Check account suspension
  if (ctx.status === "suspended") {
    return {
      allowed: false,
      code: "ACCOUNT_SUSPENDED",
      reason: "Account is suspended by administrator.",
      module: mod,
      targetPath: pathname,
    };
  }

  // Root Super Admin Invariant: Full root access to all modules and routes
  if (ctx.role === "super_admin") {
    return {
      allowed: true,
      module: mod,
      targetPath: pathname,
    };
  }

  // Security Invariants: Super Admin root exclusive modules & routes
  const isSuperAdminOnly = Boolean(registryEntry?.superAdminOnly) ||
    mod === "accounts" || mod === "business_rules" || mod === "workflows";

  if (isSuperAdminOnly) {
    return {
      allowed: false,
      code: "FORBIDDEN_ADMIN_ACTION",
      reason: registryEntry?.titleEn
        ? `Route '${pathname}' (${registryEntry.titleEn}) is strictly Super Admin exclusive.`
        : `Root administrative module '${mod}' is strictly Super Admin exclusive.`,
      module: mod,
      targetPath: pathname,
    };
  }

  // Check effective module permission
  const isAllowed = Boolean(ctx.effectivePermissions[mod!]);
  if (!isAllowed) {
    return {
      allowed: false,
      code: "UNAUTHORIZED_ROUTE",
      reason: `Direct access to module '${mod}' via URL '${pathname}' is prohibited for this role/account.`,
      module: mod,
      targetPath: pathname,
    };
  }

  // If registry specifies a required action permission, evaluate it
  if (registryEntry?.requiredPermission) {
    const effectiveOverrides: UserModulePermissions = {
      ...(ctx.customOverrides || {}),
    };
    if (mod && ctx.effectivePermissions[mod] && !effectiveOverrides[mod]) {
      effectiveOverrides[mod] = { enabled: true };
    }

    const isActionAllowed = hasPermission(registryEntry.requiredPermission, ctx.role, effectiveOverrides);
    if (!isActionAllowed) {
      return {
        allowed: false,
        code: "UNAUTHORIZED_ROUTE",
        reason: `Account lacks required permission '${registryEntry.requiredPermission}' for route '${pathname}'.`,
        module: mod,
        targetPath: pathname,
      };
    }
  }

  return {
    allowed: true,
    module: mod,
    targetPath: pathname,
  };
}

// ------------------------------------------------------------
// API / ACTION LEVEL AUTHORIZATION
// ------------------------------------------------------------

export function authorizeModuleAction(
  module: SadaModule,
  action: string,
  ctx: AuthoritativeSecurityContext
): void {
  // 1. Authenticated server identity
  if (!ctx.authenticated || !ctx.userId) {
    throw new SecurityAuthorizationError(
      "Unauthenticated: Valid session required.",
      "UNAUTHENTICATED"
    );
  }

  // 2. Active account
  if (ctx.status === "suspended") {
    throw new SecurityAuthorizationError(
      "Account Suspended: Access is blocked.",
      "ACCOUNT_SUSPENDED",
      { userId: ctx.userId }
    );
  }
  if (ctx.status === "deactivated") {
    throw new SecurityAuthorizationError(
      "Account Deactivated: This identity is retired.",
      "ACCOUNT_INACTIVE",
      { userId: ctx.userId }
    );
  }

  // 3. Super Admin root-exclusive invariants
  const isDelete =
    action === "delete" ||
    action.startsWith("delete_") ||
    action.endsWith(".delete") ||
    action.includes("delete");

  if (isDelete && ctx.role !== "super_admin") {
    const permName = action.includes(".") ? action : `${module}.${action}`;
    throw new SecurityAuthorizationError(
      `Unauthorized: Permanent deletion in module '${module}' is strictly Super Admin exclusive (requires '${permName}' permission).`,
      "FORBIDDEN_DELETE",
      { module, action, role: ctx.role }
    );
  }

  if (module === "accounts" && ctx.role !== "super_admin") {
    throw new SecurityAuthorizationError(
      "Unauthorized: Account management is strictly Super Admin exclusive.",
      "FORBIDDEN_ADMIN_ACTION",
      { module, action, role: ctx.role }
    );
  }

  if (
    (module === "business_rules" || module === "workflows") &&
    (action === "manage" || action === "edit" || action === "create" || isDelete) &&
    ctx.role !== "super_admin"
  ) {
    throw new SecurityAuthorizationError(
      `Unauthorized: Managing '${module}' is strictly Super Admin exclusive.`,
      "FORBIDDEN_ADMIN_ACTION",
      { module, action, role: ctx.role }
    );
  }

  // Super Admin has full root access
  if (ctx.role === "super_admin") {
    return;
  }

  // 4. Effective module permission
  if (!ctx.effectivePermissions[module]) {
    throw new SecurityAuthorizationError(
      `Unauthorized: Access to module '${module}' is disabled for this account.`,
      "UNAUTHORIZED_API",
      { module, action, role: ctx.role }
    );
  }

  // 5. Granular action capability
  const permKey = action.includes(".") ? action : `${module}.${action}`;
  const effectiveOverrides: UserModulePermissions = {
    ...(ctx.customOverrides || {}),
  };
  if (ctx.effectivePermissions[module] && !effectiveOverrides[module]) {
    effectiveOverrides[module] = { enabled: true };
  }

  const isPermitted = hasPermission(permKey, ctx.role, effectiveOverrides);
  if (!isPermitted) {
    throw new SecurityAuthorizationError(
      `Unauthorized: Action '${action}' on module '${module}' is prohibited for this account.`,
      "UNAUTHORIZED_ACTION",
      { module, action, role: ctx.role }
    );
  }
}

export function authorizeApiAction(
  module: SadaModule,
  action: string,
  ctx: AuthoritativeSecurityContext
): void {
  authorizeModuleAction(module, action, ctx);
}

// ------------------------------------------------------------
// DATA SCOPE & OWNERSHIP ISOLATION
// Enforces that workers and accounts cannot access each other's data
// ------------------------------------------------------------

export function authorizeDataScope(
  resourceType: SecurityResourceType,
  resource: any,
  action: "read" | "write" | "delete",
  ctx: AuthoritativeSecurityContext
): void {
  // 1. Super Admin has full administrative data scope
  if (ctx.role === "super_admin") {
    return;
  }

  // 2. Delete is strictly Super Admin exclusive across all resources
  if (action === "delete") {
    throw new SecurityAuthorizationError(
      `Permanent deletion of ${resourceType} is prohibited for non-Super-Admin roles.`,
      "FORBIDDEN_DELETE",
      { resourceType, role: ctx.role }
    );
  }

  // 3. Compensation & Salary Records (Strict Personal Worker Scope)
  if (
    resourceType === "salary_record" ||
    resourceType === "salary_request" ||
    resourceType === "salary_payment"
  ) {
    // Admin with Finance permission can view/manage company salary records in Finance module
    if (ctx.role === "admin" && ctx.effectivePermissions.finance) {
      return;
    }

    // Workers (or Admin without Finance) can ONLY view/touch their OWN salary records
    const isOwner =
      (ctx.teamMemberId && resource?.team_member_id === ctx.teamMemberId) ||
      (ctx.userId && resource?.profile_id === ctx.userId) ||
      (ctx.userId && resource?.user_id === ctx.userId);

    if (!isOwner) {
      throw new SecurityAuthorizationError(
        `Data Scope Violation: Worker cannot access or inspect another worker's ${resourceType}.`,
        "DATA_SCOPE_VIOLATION",
        {
          resourceType,
          resourceOwner: resource?.team_member_id || resource?.user_id,
          requestor: ctx.teamMemberId || ctx.userId,
        }
      );
    }
    return;
  }

  // 4. Work Sessions (Time Tracking Isolation)
  if (resourceType === "work_session") {
    // Admin has team oversight
    if (ctx.role === "admin") {
      return;
    }

    // Worker can only read/edit their own work session
    const isOwner =
      (ctx.teamMemberId && resource?.team_member_id === ctx.teamMemberId) ||
      (ctx.userId && resource?.profile_id === ctx.userId);

    if (!isOwner) {
      throw new SecurityAuthorizationError(
        `Data Scope Violation: Worker cannot tamper with or inspect another worker's work session.`,
        "DATA_SCOPE_VIOLATION",
        {
          resourceType,
          sessionOwner: resource?.team_member_id,
          requestor: ctx.teamMemberId,
        }
      );
    }
    return;
  }

  // 5. Project Tasks
  if (resourceType === "project_task") {
    // Phase E: Resource-level Task & Subtask Authority Enforcement
    // Formula: global permission AND (Super Admin OR creator OR main assignee)
    // Note: Super Admin has already passed root bypass at function entry
    if (resource?._isSubtaskCreation && resource.parentTask) {
      const pTask = resource.parentTask;
      const isCreator = Boolean(
        pTask.assigned_by_id &&
        (pTask.assigned_by_id === ctx.userId ||
         pTask.assigned_by_id === ctx.profileId ||
         pTask.assigned_by_id === ctx.teamMemberId)
      );

      const isMainAssignee = Boolean(
        pTask.assignee_id &&
        (pTask.assignee_id === ctx.userId ||
         pTask.assignee_id === ctx.profileId ||
         pTask.assignee_id === ctx.teamMemberId)
      );

      if (!isCreator && !isMainAssignee) {
        throw new SecurityAuthorizationError(
          "Parent Task Authority Denied: Subtask creation requires Super Admin, Task Creator, or Current Main Assignee authority over the parent task.",
          "PARENT_TASK_AUTHORITY_DENIED",
          {
            resourceType,
            parentTaskId: pTask.id,
            parentAssigneeId: pTask.assignee_id,
            parentCreatorId: pTask.assigned_by_id,
            requestorId: ctx.userId,
          }
        );
      }
      return;
    }

    // Phase G: Granular Task Mutation Authority Checks
    if (action === "write") {
      // 1. Definition modification (title, description, service, category, billing)
      if (resource?._isDefinitionChange) {
        const canEdit = hasPermission("tasks.edit", ctx.role, ctx.customOverrides);
        if (!canEdit) {
          throw new SecurityAuthorizationError(
            "Unauthorized: Modifying task definitions requires 'tasks.edit' permission.",
            "FORBIDDEN_ADMIN_ACTION",
            { resourceType, action, role: ctx.role }
          );
        }
      }

      // 2. Assignment modification (assignee_id)
      if (resource?._isAssignmentChange) {
        const canAssign = hasPermission("tasks.assign", ctx.role, ctx.customOverrides);
        if (!canAssign) {
          throw new SecurityAuthorizationError(
            "Unauthorized: Assigning or reassigning tasks requires 'tasks.assign' permission.",
            "UNAUTHORIZED_ACTION",
            { resourceType, action, role: ctx.role }
          );
        }
      }

      // 3. Priority modification
      if (resource?._isPriorityChange) {
        const canPriority = hasPermission("tasks.change_priority", ctx.role, ctx.customOverrides);
        if (!canPriority) {
          throw new SecurityAuthorizationError(
            "Unauthorized: Modifying task priority requires 'tasks.change_priority' permission.",
            "UNAUTHORIZED_ACTION",
            { resourceType, action, role: ctx.role }
          );
        }
      }

      // 4. Due date / deadline modification
      if (resource?._isDueDateChange) {
        const canDueDate = hasPermission("tasks.change_due_date", ctx.role, ctx.customOverrides);
        if (!canDueDate) {
          throw new SecurityAuthorizationError(
            "Unauthorized: Modifying task due date or deadline requires 'tasks.change_due_date' permission.",
            "UNAUTHORIZED_ACTION",
            { resourceType, action, role: ctx.role }
          );
        }
      }

      // 5. Deliverable modification
      if (resource?._isDeliverableChange) {
        const canDeliverable = hasPermission("tasks.add_deliverable", ctx.role, ctx.customOverrides);
        if (!canDeliverable) {
          throw new SecurityAuthorizationError(
            "Unauthorized: Attaching deliverables requires 'tasks.add_deliverable' permission.",
            "UNAUTHORIZED_ACTION",
            { resourceType, action, role: ctx.role }
          );
        }
      }

      // 6. Worker task execution scope isolation (Workers can only execute/update their own assigned tasks)
      if (ctx.role === "worker") {
        const isAssigned =
          (ctx.userId && resource?.assignee_id === ctx.userId) ||
          (ctx.profileId && resource?.assignee_id === ctx.profileId) ||
          (ctx.teamMemberId && resource?.assignee_id === ctx.teamMemberId);

        if (!isAssigned && !resource?._isAssignmentChange && !resource?._isDefinitionChange) {
          throw new SecurityAuthorizationError(
            "Data Scope Violation: Worker cannot execute or update tasks assigned exclusively to others.",
            "DATA_SCOPE_VIOLATION",
            {
              resourceType,
              taskAssignee: resource?.assignee_id,
              requestor: ctx.userId,
            }
          );
        }
      }
    }
    return;
  }

  // 6. Sales Deals & Leads
  if (resourceType === "sales_deal" || resourceType === "sales_lead") {
    if (!ctx.effectivePermissions.sales) {
      throw new SecurityAuthorizationError(
        "Unauthorized: Access to sales deals is disabled for this account.",
        "UNAUTHORIZED_API",
        { resourceType, role: ctx.role }
      );
    }
    if (ctx.role === "worker" && action === "write" && resource) {
      const isOwner =
        (ctx.userId && resource.sales_owner_id === ctx.userId) ||
        (ctx.teamMemberId && resource.sales_owner_id === ctx.teamMemberId) ||
        (ctx.userId && resource.commission_recipient_id === ctx.userId) ||
        (ctx.teamMemberId && resource.commission_recipient_id === ctx.teamMemberId);
      if (resource.sales_owner_id && !isOwner) {
        throw new SecurityAuthorizationError(
          "Data Scope Violation: Worker cannot modify deals assigned to other sales representatives.",
          "DATA_SCOPE_VIOLATION",
          { resourceType, salesOwner: resource.sales_owner_id, requestor: ctx.userId }
        );
      }
    }
    return;
  }

  // 7. Finance Transactions & Accounts
  if (resourceType === "finance_transaction" || resourceType === "finance_account") {
    const hasFinance = Boolean(ctx.effectivePermissions.finance);
    if (!hasFinance) {
      throw new SecurityAuthorizationError(
        "Unauthorized: Financial accounting records are restricted.",
        "UNAUTHORIZED_API",
        { resourceType, role: ctx.role }
      );
    }
    return;
  }

  // 8. Package Catalog Items
  if (resourceType === "package_item") {
    if (!ctx.effectivePermissions.packages) {
      throw new SecurityAuthorizationError(
        "Unauthorized: Package catalog management is restricted.",
        "UNAUTHORIZED_API",
        { resourceType, role: ctx.role }
      );
    }
    return;
  }

  // 9. Content CMS Items
  if (
    resourceType === "content_project" ||
    resourceType === "blog_post" ||
    resourceType === "digital_product" ||
    resourceType === "testimonial" ||
    resourceType === "social_reel"
  ) {
    if (!ctx.effectivePermissions.content_cms) {
      throw new SecurityAuthorizationError(
        "Unauthorized: Content CMS management is restricted.",
        "UNAUTHORIZED_API",
        { resourceType, role: ctx.role }
      );
    }
    return;
  }

  // 10. Root System Resources (Accounts, Workflows, Rules)
  if (
    resourceType === "user_account" ||
    resourceType === "workflow_template" ||
    resourceType === "business_rule" ||
    resourceType === "audit_log"
  ) {
    throw new SecurityAuthorizationError(
      `Unauthorized: Managing ${resourceType} is restricted to Super Admin only.`,
      "FORBIDDEN_ADMIN_ACTION",
      { resourceType, role: ctx.role }
    );
  }

  // 11. Notifications
  if (resourceType === "notification_message") {
    if (resource?.user_id && resource.user_id !== ctx.userId) {
      throw new SecurityAuthorizationError(
        "Data Scope Violation: Cannot inspect or tamper with another user's notifications.",
        "DATA_SCOPE_VIOLATION",
        { resourceType, recipient: resource.user_id, requestor: ctx.userId }
      );
    }
    return;
  }

  // 12. Cross-Account / Client Isolation
  if (resourceType === "client_workspace" || resourceType === "client_record") {
    const targetAccountId = resource?.account_id || resource?.tenant_id || resource?.owner_account_id;
    if (targetAccountId && targetAccountId !== ctx.userId) {
      throw new SecurityAuthorizationError(
        "Cross-Account Leak Prevented: Account cannot access unauthorized tenant/account data.",
        "CROSS_ACCOUNT_LEAK",
        { resourceType, resourceAccount: targetAccountId, actorAccount: ctx.userId }
      );
    }

    const allowedClients = (ctx as any).allowedClientIds || ctx.accountMetadata?.allowedClientIds;
    if (allowedClients && Array.isArray(allowedClients)) {
      const targetClientId = resource.client_id || resource.id;
      if (!allowedClients.includes(targetClientId)) {
        throw new SecurityAuthorizationError(
          "Cross-Account Leak Prevented: Account cannot access unauthorized client data.",
          "CROSS_ACCOUNT_LEAK",
          { resourceType, clientId: targetClientId }
        );
      }
    }
  }
}

export function authorizeResourceAccess(
  resourceType: SecurityResourceType,
  resource: any,
  action: "read" | "write" | "delete",
  ctx: AuthoritativeSecurityContext
): void {
  authorizeDataScope(resourceType, resource, action, ctx);
}

// ------------------------------------------------------------
// CANONICAL SERVER MUTATION ASSERTION GATE
// Verifies:
// 1. Authenticated server identity
// 2. Active account (not suspended/deactivated)
// 3. Authoritative role (rejects forged Super Admin payloads)
// 4. Effective module & granular action permission
// 5. Resource / task authority
// ------------------------------------------------------------

export async function assertAuthorizedMutation(
  supabaseClient: SupabaseClient,
  module: SadaModule,
  action: string,
  params?: {
    ctx?: PermissionContext | AuthoritativeSecurityContext;
    actorRole?: string;
    actorId?: string;
    sessionId?: string;
    resourceType?: SecurityResourceType;
    resource?: any;
    resourceAction?: "read" | "write" | "delete";
  }
): Promise<AuthoritativeSecurityContext> {
  // 1. Resolve authenticated session identity
  let sessionUserId: string | null = null;
  try {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError && (authError.message?.toLowerCase().includes("banned") || (authError as any).status === 403)) {
      throw new SecurityAuthorizationError(
        "Account Suspended: Access denied by administrator.",
        "ACCOUNT_SUSPENDED"
      );
    }
    sessionUserId = authData?.user?.id || null;
    if (!sessionUserId) {
      const { data: sessData } = await supabaseClient.auth.getSession();
      sessionUserId = sessData?.session?.user?.id || null;
    }
  } catch (err) {
    if (err instanceof SecurityAuthorizationError) throw err;
    try {
      const { data: sessData } = await supabaseClient.auth.getSession();
      sessionUserId = sessData?.session?.user?.id || null;
    } catch {
      // unauthenticated or mock client without auth
    }
  }

  // The actor executing the mutation must be authenticated and authorized
  const actorUserId = sessionUserId || params?.actorId || params?.ctx?.userId;

  if (!actorUserId) {
    throw new SecurityAuthorizationError(
      "Unauthenticated: Valid session required to perform mutations.",
      "UNAUTHENTICATED"
    );
  }

  // Identity spoof defense: if a session is active and caller claims a different actorId,
  // verify caller is super_admin or reject spoofing attempt
  if (sessionUserId && (params?.actorId || params?.ctx?.userId)) {
    const claimedId = params?.actorId || params?.ctx?.userId;
    if (claimedId && claimedId !== sessionUserId) {
      const sessionCtx = await resolveAuthoritativeSecurityContext(supabaseClient, sessionUserId);
      if (sessionCtx.role !== "super_admin") {
        throw new SecurityAuthorizationError(
          "Identity spoof blocked: Cannot perform mutations on behalf of another user.",
          "PRIVILEGE_ESCALATION_BLOCKED",
          { sessionUserId, claimedId }
        );
      }
    }
  }

  // 1b. Targeted Abuse Defense & Rate Limiting (Layer 7)
  const rateLimitCategory = resolveRateLimitCategory(module, action);
  if (rateLimitCategory) {
    assertRateLimit(rateLimitCategory, actorUserId);
  }

  // 2. Fetch authoritative security context for the ACTOR performing the mutation
  let secCtx: AuthoritativeSecurityContext;
  const explicitSessionRef =
    params?.sessionId ||
    (params?.ctx as any)?.sessionId;

  if ((params?.ctx as any)?.authoritative && !sessionUserId) {
    secCtx = params!.ctx as AuthoritativeSecurityContext;
  } else {
    // Invariant: Server authorization evaluates the authenticated actor's authoritative database state
    secCtx = await resolveAuthoritativeSecurityContext(supabaseClient, actorUserId, {
      forceFresh: true,
      sessionId: explicitSessionRef || undefined,
    });
  }

  // 3. Forged identity & role defense:
  // Reject forged Super Admin payloads from untrusted clients
  const claimedRole = params?.actorRole || (params?.ctx ? params.ctx.role : undefined);
  if (claimedRole) {
    const normClaim = normalizeRole(claimedRole);
    if (normClaim === "super_admin" && secCtx.role !== "super_admin") {
      throw new SecurityAuthorizationError(
        "Privilege escalation blocked: Forged Super Admin role.",
        "PRIVILEGE_ESCALATION_BLOCKED",
        { claimedRole, authoritativeRole: secCtx.role, userId: actorUserId }
      );
    }
  }

  // 4. If caller supplied custom overrides in ctx, merge and evaluate
  if (params?.ctx && (params.ctx as any).customPermissions) {
    secCtx.customOverrides = {
      ...(secCtx.customOverrides || {}),
      ...(params.ctx as any).customPermissions,
    };
    secCtx.effectivePermissions[module] = getEffectiveModulePermission(
      module,
      secCtx.role,
      secCtx.customOverrides
    );
  }

  // 5. Authorize Module Action on the ACTOR's context
  authorizeModuleAction(module, action, secCtx);

  // 6. Authorize Resource Access on the ACTOR's context
  if (params?.resourceType) {
    authorizeResourceAccess(
      params.resourceType,
      params.resource,
      params.resourceAction || "write",
      secCtx
    );
  }

  return secCtx;
}

// ------------------------------------------------------------
// CONVENIENCE ASSERTION HELPERS
// ------------------------------------------------------------

export function authorizeRouteAccess(
  pathname: string,
  ctx: AuthoritativeSecurityContext
): RouteEvaluationResult {
  const evalResult = evaluateRouteAccess(pathname, ctx);
  if (!evalResult.allowed) {
    throw new SecurityAuthorizationError(
      evalResult.reason || "Unauthorized route access.",
      evalResult.code || "UNAUTHORIZED_ROUTE",
      { path: pathname, module: evalResult.module }
    );
  }
  return evalResult;
}

export const assertRouteAccess = authorizeRouteAccess;

export function assertApiAccess(
  module: SadaModule,
  action: string,
  ctx: AuthoritativeSecurityContext
): void {
  authorizeModuleAction(module, action, ctx);
}

export function assertScopeAccess(
  resourceType: SecurityResourceType,
  resource: any,
  action: "read" | "write" | "delete",
  ctx: AuthoritativeSecurityContext
): void {
  authorizeDataScope(resourceType, resource, action, ctx);
}

