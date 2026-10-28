import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeRole,
  type SadaRole,
  type PermissionContext,
  assertCanDelete,
  assertCanManageAccounts,
} from "@/lib/permissions";
import {
  assertAuthorizedMutation,
  invalidateSecurityContextCache,
  SecurityAuthorizationError,
} from "@/lib/security-isolation-service";
import type { UserModulePermissions, SadaModule } from "@/types/permissions";

export type AccountStatus = "active" | "suspended" | "pending" | "disabled" | "deleted";

export interface AccountRecord {
  user_id: string;
  email: string;
  display_name: string;
  phone: string | null;
  role: SadaRole;
  status: AccountStatus;
  is_super_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  team_member_id: string | null;
  team_member_name: string | null;
  team_position: string | null;
  division: string | null;
  photo_url: string | null;
  bio: string | null;
  specialties: string[];
  socials: Record<string, string>;
  published: boolean;
  is_active: boolean;
  current_password?: string | null;
  module_permissions?: UserModulePermissions;
}

export interface AccountKPIs {
  totalAccounts: number;
  activeCount: number;
  suspendedCount: number;
  pendingCount: number;
  disabledCount: number;
  superAdminCount: number;
  adminCount: number;
  workerCount: number;
}

export interface AccountAuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AccountDependencies {
  user_id: string;
  team_member_id: string | null;
  assigned_tasks: number;
  created_tasks: number;
  activity_count: number;
  lead_projects_count: number;
  salary_records_count: number;
  salary_payments_count: number;
  salary_requests_count: number;
  sales_commissions_count?: number;
  deals_count?: number;
  business_rules_count?: number;
  account_audit_actor_count?: number;
  system_audit_actor_count?: number;
  has_financial_dependencies?: boolean;
  has_operational_dependencies?: boolean;
  has_governance_dependencies?: boolean;
  has_business_dependencies: boolean;
  can_permanently_delete?: boolean;
}

export interface CreateAccountInput {
  email: string;
  password: string;
  displayName: string;
  role: SadaRole;
  division?: string;
  position?: string;
  phone?: string;
  createTeamMember?: boolean;
  status?: AccountStatus;
  modulePermissions?: UserModulePermissions;
}

export interface UpdateAccountInput {
  userId: string;
  displayName: string;
  phone?: string;
  role: SadaRole;
  division: string;
  position: string;
  bio?: string;
  specialties?: string[];
  socials?: Record<string, string>;
  published?: boolean;
  isActive?: boolean;
  status?: AccountStatus;
  modulePermissions?: UserModulePermissions;
}

/**
 * Generate a cryptographically secure random password meeting all SADA security standards.
 */
export function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*-_+=";
  const all = upper + lower + numbers + symbols;

  const getRandomChar = (str: string) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return str[array[0] % str.length];
  };

  // Ensure at least one of each required group
  const chars = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(numbers),
    getRandomChar(symbols),
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(getRandomChar(all));
  }

  // Shuffle array using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

/**
 * Fetch all canonical accounts projection for Super Admin
 */
export async function fetchAccounts(): Promise<AccountRecord[]> {
  const { data, error } = await (supabase as any).rpc("admin_list_accounts");
  if (error) {
    console.error("[AccountService] Error fetching accounts:", error);
    throw new Error(error.message || "Failed to load account records");
  }

  const records: AccountRecord[] = ((data || []) as any[]).map((r) => ({
    user_id: r.user_id,
    email: r.email,
    display_name: r.display_name || r.email,
    phone: r.phone || null,
    role: normalizeRole(r.role),
    status: (r.status || "active") as AccountStatus,
    is_super_admin: Boolean(r.is_super_admin),
    created_at: r.created_at,
    last_sign_in_at: r.last_sign_in_at || null,
    banned_until: r.banned_until || null,
    team_member_id: r.team_member_id || null,
    team_member_name: r.team_member_name || null,
    team_position: r.team_position || null,
    division: r.division || "Development",
    photo_url: r.photo_url || null,
    bio: r.bio || null,
    specialties: Array.isArray(r.specialties) ? r.specialties : [],
    socials: r.socials && typeof r.socials === "object" ? r.socials : {},
    published: r.published ?? true,
    is_active: r.is_active ?? true,
    current_password: r.current_password || null,
    module_permissions: r.module_permissions || undefined,
  }));

  try {
    const { data: profRows } = await (supabase as any)
      .from("profiles")
      .select("id, module_permissions");
    if (profRows && profRows.length > 0) {
      const pMap = new Map<string, any>(profRows.map((p: any) => [p.id, p.module_permissions]));
      for (const rec of records) {
        if (!rec.module_permissions && pMap.has(rec.user_id)) {
          const val = pMap.get(rec.user_id);
          if (val && typeof val === "object" && Object.keys(val).length > 0) {
            rec.module_permissions = val;
          }
        }
      }
    }
  } catch (profErr) {
    // Non-blocking fallback
  }

  return records;
}

/**
 * Compute KPIs from authoritative account list
 */
export function computeAccountKPIs(accounts: AccountRecord[]): AccountKPIs {
  const totalAccounts = accounts.length;
  let activeCount = 0;
  let suspendedCount = 0;
  let pendingCount = 0;
  let disabledCount = 0;
  let superAdminCount = 0;
  let adminCount = 0;
  let workerCount = 0;

  for (const acc of accounts) {
    if (acc.status === "suspended") {
      suspendedCount++;
    } else if (acc.status === "pending") {
      pendingCount++;
    } else if (acc.status === "disabled") {
      disabledCount++;
    } else {
      activeCount++;
    }

    if (acc.role === "super_admin") {
      superAdminCount++;
    } else if (acc.role === "admin") {
      adminCount++;
    } else {
      workerCount++;
    }
  }

  return {
    totalAccounts,
    activeCount,
    suspendedCount,
    pendingCount,
    disabledCount,
    superAdminCount,
    adminCount,
    workerCount,
  };
}

function getSupabaseEnv() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) ||
    "";
  const key =
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
    (typeof process !== "undefined" &&
      (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env?.VITE_SUPABASE_ANON_KEY ||
        process.env?.SUPABASE_PUBLISHABLE_KEY ||
        process.env?.SUPABASE_ANON_KEY)) ||
    "";
  return { url, key };
}

/**
 * Super Admin creates a new account (The single canonical creation flow)
 * Sends initial password to Auth API, then finalizes role & team profile via Super Admin RPC
 */
export async function createAccount(
  input: CreateAccountInput,
  clientOverride?: any,
  ctx?: PermissionContext
): Promise<{
  user_id: string;
  email: string;
  role: string;
  status: string;
  team_member_id?: string;
}> {
  const activeClient = clientOverride || supabase;
  await assertAuthorizedMutation(activeClient, "accounts", "accounts.manage", {
    ctx,
    resourceType: "user_account",
    resourceAction: "write",
  });

  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error("Missing Supabase configuration");
  }

  // 1. Create an isolated client that won't overwrite current Super Admin session
  const authApiClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cleanEmail = input.email.trim().toLowerCase();

  // 2. Check if auth user already exists in Supabase Auth
  let userId: string | null = null;
  const { data: existingUid } = await (activeClient as any).rpc("admin_get_auth_user_id_by_email", {
    _email: cleanEmail,
  });

  if (existingUid) {
    // Existing user: Synchronize password to the generated/entered password so credentials always work!
    userId = existingUid;
    const { error: resetPassErr } = await (activeClient as any).rpc("admin_reset_account_password", {
      _user_id: userId,
      _new_password: input.password,
    });

    if (resetPassErr) {
      console.error("[AccountService] Error syncing password for existing auth user:", resetPassErr);
      throw new Error(resetPassErr.message || "Failed to update existing user credentials.");
    }
  } else {
    // New user: Create user in Supabase Auth API
    const { data: authData, error: authErr } = await authApiClient.auth.signUp({
      email: cleanEmail,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName.trim(),
          name: input.displayName.trim(),
        },
      },
    });

    if (authErr) {
      console.error("[AccountService] Auth API error:", authErr);
      throw new Error(authErr.message || "Failed to create authentication user.");
    }

    // Double-check user enumeration protection (empty identities means user already exists)
    if (!authData.user?.identities || authData.user.identities.length === 0) {
      const { data: lookedUpUid } = await (activeClient as any).rpc("admin_get_auth_user_id_by_email", {
        _email: cleanEmail,
      });
      if (lookedUpUid) {
        userId = lookedUpUid;
        await (activeClient as any).rpc("admin_reset_account_password", {
          _user_id: userId,
          _new_password: input.password,
        });
      } else {
        throw new Error("Failed to provision authentication identity for this email.");
      }
    } else {
      userId = authData.user?.id || null;
    }
  }

  if (!userId) {
    throw new Error("Failed to resolve valid user ID from Supabase Auth.");
  }

  // 3. Finalize canonical provisioning via Super Admin RPC in a single atomic database transaction
  const { data: provData, error: provErr } = await (activeClient as any).rpc("admin_provision_account", {
    _user_id: userId,
    _email: cleanEmail,
    _display_name: input.displayName.trim(),
    _role: input.role,
    _division: input.division || "Development",
    _position: input.position || "Specialist",
    _phone: input.phone?.trim() || null,
    _create_team_member: input.createTeamMember ?? true,
    _status: input.status || "active",
    _module_permissions: input.modulePermissions || null,
  });

  if (provErr) {
    console.error("[AccountService] Error provisioning account:", provErr);
    // Compensating rollback: Clean up newly created auth user so no orphaned auth user remains
    if (!existingUid && userId) {
      try {
        const { error: delErr } = await (activeClient as any).rpc("admin_delete_account", { _user_id: userId });
        if (delErr) {
          console.error("[AccountService] admin_delete_account error during rollback:", delErr);
        }
      } catch (cleanupErr) {
        console.error("[AccountService] Failed to clean up orphaned auth user during rollback:", cleanupErr);
      }
    }
    throw new Error(provErr.message || "Failed to finalize account provisioning.");
  }

  return provData;
}

async function resolveActorUserId(client: any, ctx?: PermissionContext): Promise<string | null> {
  if (ctx?.userId) return ctx.userId;
  try {
    const { data: authData } = await client.auth.getUser();
    if (authData?.user?.id) return authData.user.id;
  } catch {
    // fallback
  }
  try {
    const { data: sessData } = await client.auth.getSession();
    if (sessData?.session?.user?.id) return sessData.session.user.id;
  } catch {
    // fallback
  }
  return null;
}

/**
 * Super Admin updates account identity, role, and operational team profile
 */
export async function updateAccount(
  input: UpdateAccountInput,
  ctxOrClient?: PermissionContext | any,
  clientOverride?: any
): Promise<void> {
  const isClient = ctxOrClient && typeof ctxOrClient.from === "function";
  const activeClient = clientOverride || (isClient ? ctxOrClient : supabase);
  const ctx = isClient ? undefined : (ctxOrClient as PermissionContext);

  await assertAuthorizedMutation(activeClient, "accounts", "accounts.manage", {
    ctx,
    resourceType: "user_account",
    resource: { user_id: input.userId },
    resourceAction: "write",
  });

  // Self-demotion / Self-lockout defense: Super Admin cannot demote or suspend/deactivate themselves
  const effectiveCallerId = await resolveActorUserId(activeClient, ctx);
  if (effectiveCallerId && effectiveCallerId === input.userId) {
    if (input.role && input.role !== "super_admin") {
      throw new SecurityAuthorizationError(
        "Cannot demote own account (administrative self-lockout protection).",
        "FORBIDDEN_ADMIN_ACTION",
        { userId: input.userId }
      );
    }
    if (input.status && input.status !== "active") {
      throw new SecurityAuthorizationError(
        "Cannot suspend or deactivate own account (administrative self-lockout protection).",
        "FORBIDDEN_ADMIN_ACTION",
        { userId: input.userId }
      );
    }
  }

  const { error } = await (activeClient as any).rpc("admin_update_account", {
    _user_id: input.userId,
    _display_name: (input.displayName || "").trim() || "User",
    _phone: input.phone?.trim() || null,
    _role: input.role,
    _division: input.division || "Development",
    _position: (input.position || "").trim() || "Specialist",
    _bio: input.bio?.trim() || null,
    _specialties: input.specialties || [],
    _socials: input.socials || {},
    _published: input.published ?? true,
    _is_active: input.isActive ?? true,
    _status: input.status || null,
  });

  if (error) {
    console.error("[AccountService] Error updating account:", error);
    throw new Error(error.message || "Failed to update account");
  }

  // Update custom module permissions if specified
  if (input.modulePermissions !== undefined) {
    await updateAccountPermissions(input.userId, input.modulePermissions, activeClient, ctx);
  }

  invalidateSecurityContextCache(input.userId);
  if (effectiveCallerId && effectiveCallerId !== input.userId) {
    invalidateSecurityContextCache(effectiveCallerId);
  }
}

/**
 * Suspend an account
 */
export async function suspendAccount(
  userId: string,
  reason?: string,
  ctx?: PermissionContext,
  clientOverride?: any
): Promise<void> {
  const activeClient = clientOverride || supabase;
  await assertAuthorizedMutation(activeClient, "accounts", "accounts.manage", {
    ctx,
    resourceType: "user_account",
    resource: { user_id: userId },
    resourceAction: "write",
  });

  // Self-lockout defense: Super Admin cannot suspend themselves
  const effectiveCallerId = await resolveActorUserId(activeClient, ctx);
  if (effectiveCallerId && effectiveCallerId === userId) {
    throw new SecurityAuthorizationError(
      "Cannot suspend own account (administrative self-lockout protection).",
      "FORBIDDEN_ADMIN_ACTION",
      { userId }
    );
  }

  const { error } = await (activeClient as any).rpc("admin_suspend_account_with_sessions", {
    _target_user_id: userId,
    _reason: reason?.trim() || null,
  });

  if (error) {
    console.error("[AccountService] Error suspending account:", error);
    throw new Error(error.message || "Failed to suspend account");
  }

  invalidateSecurityContextCache(userId);
}

/**
 * Reactivate an account
 */
export async function reactivateAccount(
  userId: string,
  ctx?: PermissionContext,
  clientOverride?: any
): Promise<void> {
  const activeClient = clientOverride || supabase;
  await assertAuthorizedMutation(activeClient, "accounts", "accounts.manage", {
    ctx,
    resourceType: "user_account",
    resource: { user_id: userId },
    resourceAction: "write",
  });
  const { error } = await (activeClient as any).rpc("admin_reactivate_account_with_security", {
    _target_user_id: userId,
    _reason: "Account reactivated by administrator",
  });

  if (error) {
    console.error("[AccountService] Error reactivating account:", error);
    throw new Error(error.message || "Failed to reactivate account");
  }

  invalidateSecurityContextCache(userId);
}

/**
 * Super Admin sets a persistent password for an account
 * Persists the password permanently in Supabase Auth, logs audit event, and revokes stale sessions
 */
export async function resetAccountPassword(
  userId: string,
  newPassword: string,
  ctx?: PermissionContext,
  clientOverride?: any
): Promise<{ success: boolean; user_id: string; current_password?: string }> {
  const activeClient = clientOverride || supabase;

  if (ctx) {
    assertCanManageAccounts(ctx);
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const { data, error } = await (activeClient as any).rpc("admin_reset_account_password", {
    _user_id: userId,
    _new_password: newPassword,
  });

  if (error) {
    console.error("[AccountService] Error setting account password:", error);
    throw new Error(error.message || "Failed to update account password");
  }

  // Revoke prior active sessions for security hygiene; new password persists across all future logins
  try {
    await (activeClient as any).rpc("admin_revoke_all_user_sessions", {
      _target_user_id: userId,
      _reason: "Account password updated by Super Admin",
    });
  } catch (sessErr) {
    console.warn("[AccountService] Non-blocking notice on session revocation:", sessErr);
  }

  invalidateSecurityContextCache(userId);
  return data || { success: true, user_id: userId, current_password: newPassword };
}

/**
 * Super Admin updates account email address, synchronizing auth.users, auth.identities, team_members, and credentials
 */
export async function updateAccountEmail(
  userId: string,
  newEmail: string,
  ctx?: PermissionContext,
  clientOverride?: any
): Promise<{ success: boolean; user_id: string; old_email?: string; email: string }> {
  const activeClient = clientOverride || supabase;

  if (ctx) {
    assertCanManageAccounts(ctx);
  }

  const cleanEmail = (newEmail || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    throw new Error("Please enter a valid email address with a domain (e.g. user@domain.com).");
  }

  const { data, error } = await (activeClient as any).rpc("admin_update_account_email", {
    _user_id: userId,
    _new_email: cleanEmail,
  });

  if (error) {
    console.error("[AccountService] Error updating account email:", error);
    throw new Error(error.message || "Failed to update account email");
  }

  invalidateSecurityContextCache(userId);
  return data || { success: true, user_id: userId, email: cleanEmail };
}

/**
 * Super Admin changes their own password safely
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  // 1. Re-authenticate to verify current password
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user?.email;
  if (!email) {
    throw new Error("No active session found.");
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInErr) {
    throw new Error("Current password verification failed. Please check your credentials.");
  }

  // 2. Update to new password via Supabase Auth
  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateErr) {
    throw new Error(updateErr.message || "Failed to update password.");
  }
}

/**
 * Dependency analysis before account deletion
 */
export async function analyzeAccountDependencies(userId: string): Promise<AccountDependencies> {
  const { data, error } = await (supabase as any).rpc("admin_analyze_account_dependencies", {
    _user_id: userId,
  });

  if (error) {
    console.error("[AccountService] Error analyzing account dependencies:", error);
    throw new Error(error.message || "Failed to analyze dependencies");
  }

  return data;
}

/**
 * Permanently delete an account with safe dependency preservation
 */
export async function deleteAccount(userId: string, ctx?: PermissionContext, clientOverride?: any): Promise<void> {
  const activeClient = clientOverride || supabase;
  await assertAuthorizedMutation(activeClient, "accounts", "accounts.delete", {
    ctx,
    resourceType: "user_account",
    resource: { user_id: userId },
    resourceAction: "delete",
  });
  const { error } = await (activeClient as any).rpc("admin_delete_account", {
    _user_id: userId,
  });

  if (error) {
    console.error("[AccountService] Error deleting account:", error);
    throw new Error(error.message || "Failed to delete account");
  }
}

/**
 * Fetch account audit logs
 */
export async function fetchAccountAuditLogs(targetUserId?: string): Promise<AccountAuditLog[]> {
  const { data, error } = await (supabase as any).rpc("admin_list_account_audit_logs", {
    _target_user_id: targetUserId || null,
  });

  if (error) {
    console.error("[AccountService] Error fetching account audit logs:", error);
    throw new Error(error.message || "Failed to load audit logs");
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    actor_id: row.actor_id,
    actor_email: row.actor_email,
    target_user_id: row.target_user_id,
    target_email: row.target_email,
    action: row.action,
    metadata: row.metadata || {},
    created_at: row.created_at,
  }));
}

/**
 * Fetch custom module permissions for a user from the CANONICAL store
 */
export async function fetchUserModulePermissions(
  userId: string,
  clientOverride?: any
): Promise<UserModulePermissions | null> {
  const activeClient = clientOverride || supabase;
  try {
    // 1. Authoritative canonical store: public.user_module_permissions
    const { data: permRows, error: permErr } = await (activeClient as any)
      .from("user_module_permissions")
      .select("module, enabled, actions")
      .eq("user_id", userId);

    if (!permErr && permRows && permRows.length > 0) {
      const result: UserModulePermissions = {};
      for (const r of permRows) {
        result[r.module as SadaModule] = {
          enabled: Boolean(r.enabled),
          actions: r.actions || {},
        };
      }
      return result;
    }

    // 2. High-performance cached projection: profiles.module_permissions
    const { data: profileData, error: profileErr } = await (activeClient as any)
      .from("profiles")
      .select("module_permissions")
      .eq("id", userId)
      .maybeSingle();

    if (!profileErr && profileData?.module_permissions && typeof profileData.module_permissions === "object") {
      return profileData.module_permissions as UserModulePermissions;
    }
  } catch (err) {
    console.error("[AccountService] Error fetching module permissions:", err);
  }
  return null;
}

/**
 * Super Admin explicitly updates module permissions for an account.
 * Single Authoritative Write Path: Super Admin Security Definer RPC.
 * Transactionally clears prior overrides, inserts new canonical overrides into public.user_module_permissions,
 * updates public.profiles cache, and writes to account_audit_logs.
 */
export async function updateAccountPermissions(
  userId: string,
  modulePermissions: UserModulePermissions,
  clientOverride?: any,
  ctx?: PermissionContext,
  options?: {
    reason?: string;
    requestMetadata?: Record<string, any>;
  }
): Promise<any> {
  const activeClient = clientOverride || supabase;
  await assertAuthorizedMutation(activeClient, "accounts", "accounts.manage", {
    ctx,
    resourceType: "user_account",
    resource: { user_id: userId },
    resourceAction: "write",
  });

  const sanitizedPermissions = { ...modulePermissions };

  const effectiveCallerId = await resolveActorUserId(activeClient, ctx);
  if (effectiveCallerId && effectiveCallerId === userId) {
    const accountsSetting = (sanitizedPermissions as any).accounts;
    if (
      accountsSetting === false ||
      (typeof accountsSetting === "object" && accountsSetting?.enabled === false)
    ) {
      throw new SecurityAuthorizationError(
        "Cannot revoke own access to account management (administrative self-lockout protection).",
        "FORBIDDEN_ADMIN_ACTION",
        { userId }
      );
    }
  }

  // Super Admin Security Definer RPC with Audit Logging & Atomic Transaction
  const { data: rpcData, error: rpcErr } = await (activeClient as any).rpc("admin_update_account_permissions", {
    _target_user_id: userId,
    _permissions: sanitizedPermissions,
    _reason: options?.reason || null,
    _request_metadata: options?.requestMetadata || {},
  });

  if (rpcErr) {
    console.error("[AccountService] admin_update_account_permissions RPC failed:", rpcErr);
    throw new Error(rpcErr.message || "Failed to update account permissions: Unauthorized or database rejection.");
  }

  // Invalidate cached context for user
  invalidateSecurityContextCache(userId);
  if (effectiveCallerId && effectiveCallerId !== userId) {
    invalidateSecurityContextCache(effectiveCallerId);
  }

  return rpcData;
}

