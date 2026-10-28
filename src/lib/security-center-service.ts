// ============================================================
// SADA OS — SECURITY & SESSION CONTROL CENTER SERVICE
// Real-time Identity Monitoring, Live Session Inventory,
// Deterministic Security Alerts, and Server-Enforced Emergency Controls.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/permissions";
import type { AccountStatus } from "@/lib/account-service";
import {
  assertAuthorizedMutation,
  invalidateSecurityContextCache,
  SecurityAuthorizationError,
} from "@/lib/security-isolation-service";
import type {
  UserSessionRecord,
  SecurityKPIs,
  SecurityAlertRecord,
  UserActivityEvent,
  SessionStatus,
  DeviceType,
  SessionControlResult,
  AlertStatus,
} from "@/types/security-center";

export const SESSION_REF_STORAGE_KEY = "sada_session_ref";

/**
 * Get or initialize persistent client session reference, scoped by user ID to prevent cross-user bleed
 */
export function getCurrentSessionId(userId?: string): string {
  if (typeof window === "undefined") return "server_session";
  try {
    if (userId) {
      const userKey = `${SESSION_REF_STORAGE_KEY}_${userId}`;
      let userRef = localStorage.getItem(userKey);
      if (!userRef) {
        userRef = "sess_" + crypto.randomUUID().replace(/-/g, "");
        localStorage.setItem(userKey, userRef);
      }
      localStorage.setItem(SESSION_REF_STORAGE_KEY, userRef);
      return userRef;
    }

    let ref = localStorage.getItem(SESSION_REF_STORAGE_KEY);
    if (!ref) {
      ref = "sess_" + crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(SESSION_REF_STORAGE_KEY, ref);
    }
    return ref;
  } catch {
    return "sess_ephemeral_" + Date.now();
  }
}

/**
 * Explicitly set and sync current session ID for a specific user
 */
export function setCurrentSessionId(sessionId: string, userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_REF_STORAGE_KEY, sessionId);
    if (userId) {
      localStorage.setItem(`${SESSION_REF_STORAGE_KEY}_${userId}`, sessionId);
    }
  } catch {
    // Non-blocking localStorage error
  }
}

/**
 * Safely purge session reference on sign-out or account switch
 */
export function clearCurrentSessionId(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_REF_STORAGE_KEY);
    if (userId) {
      localStorage.removeItem(`${SESSION_REF_STORAGE_KEY}_${userId}`);
    }
  } catch {
    // Non-blocking localStorage error
  }
}

/**
 * Truthfully parse user-agent into readable device, browser, and OS metadata
 */
export function parseUserAgent(uaString?: string): {
  deviceType: DeviceType;
  browserName: string;
  osName: string;
} {
  const ua = uaString || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) {
    return { deviceType: "unknown", browserName: "Unknown Browser", osName: "Unknown OS" };
  }

  // Device Type
  let deviceType: DeviceType = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (navigator?.maxTouchPoints > 1 && /Macintosh/i.test(ua))) {
    deviceType = "tablet";
  } else if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = "mobile";
  }

  // OS
  let osName = "Unknown OS";
  if (/Windows NT 10.0/i.test(ua)) osName = "Windows 11 / 10";
  else if (/Windows NT/i.test(ua)) osName = "Windows";
  else if (/Mac OS X/i.test(ua)) osName = "macOS";
  else if (/Android/i.test(ua)) osName = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) osName = "iOS";
  else if (/Linux/i.test(ua)) osName = "Linux";

  // Browser
  let browserName = "Web Browser";
  if (/Edg\//i.test(ua)) browserName = "Microsoft Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) browserName = "Google Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browserName = "Apple Safari";
  else if (/Firefox\//i.test(ua)) browserName = "Mozilla Firefox";
  else if (/Opera|OPR\//i.test(ua)) browserName = "Opera";

  return { deviceType, browserName, osName };
}

/**
 * Register current browser session in authoritative public.user_sessions table
 */
export async function registerCurrentSession(clientOverride?: SupabaseClient): Promise<void> {
  if (typeof window === "undefined") return;
  const client = clientOverride || supabase;

  try {
    const { data: sessData } = await client.auth.getSession();
    const user = sessData?.session?.user;
    if (!user) return;

    const sessionId = getCurrentSessionId(user.id);
    const { deviceType, browserName, osName } = parseUserAgent();

    const { data, error } = await (client as any).rpc("register_user_session", {
      _session_id: sessionId,
      _user_agent: navigator.userAgent,
      _ip_address: null, // IP populated by edge/network layer
      _device_type: deviceType,
      _browser_name: browserName,
      _os_name: osName,
      _auth_method: "password",
    });

    if (!error && data?.session_id) {
      setCurrentSessionId(data.session_id, user.id);
    }
  } catch (err) {
    console.warn("[SecurityCenter] Error registering session:", err);
  }
}

let lastHeartbeatTime = 0;
const HEARTBEAT_THROTTLE_MS = 60_000; // 1 minute throttle

/**
 * Throttled session heartbeat to keep session status fresh
 */
export async function heartbeatCurrentSession(
  clientOverride?: SupabaseClient,
  force = false
): Promise<{ valid: boolean; status?: string }> {
  if (typeof window === "undefined") return { valid: true };
  const now = Date.now();
  if (!force && now - lastHeartbeatTime < HEARTBEAT_THROTTLE_MS) {
    return { valid: true };
  }
  lastHeartbeatTime = now;

  const client = clientOverride || supabase;
  let userId: string | undefined;
  try {
    const { data: sessData } = await client.auth.getSession();
    userId = sessData?.session?.user?.id;
  } catch {
    // optional
  }
  const sessionId = getCurrentSessionId(userId);

  try {
    const { data, error } = await (client as any).rpc("record_session_heartbeat", {
      _session_id: sessionId,
    });

    if (error || !data?.success) {
      return { valid: false, status: data?.error || "INVALID" };
    }
    return { valid: true, status: data?.status || "active" };
  } catch {
    return { valid: true };
  }
}

/**
 * Verify session and account validity on demand
 */
export async function verifySessionAndAccount(
  sessionId?: string,
  clientOverride?: SupabaseClient
): Promise<{ valid: boolean; code: string }> {
  const client = clientOverride || supabase;
  let userId: string | undefined;
  if (!sessionId) {
    try {
      const { data: sessData } = await client.auth.getSession();
      userId = sessData?.session?.user?.id;
    } catch {
      // optional
    }
  }
  const sid = sessionId || getCurrentSessionId(userId);

  try {
    const { data, error } = await (client as any).rpc("verify_session_and_account", {
      _session_id: sid,
    });
    if (error || !data) return { valid: true, code: "CHECK_SKIPPED" };
    return { valid: Boolean(data.valid), code: data.code || "UNKNOWN" };
  } catch {
    return { valid: true, code: "CHECK_FAILED" };
  }
}

/**
 * Fetch authoritative Security KPIs
 */
export async function fetchSecurityKPIs(clientOverride?: SupabaseClient): Promise<SecurityKPIs> {
  const client = clientOverride || supabase;
  const { data, error } = await (client as any).rpc("admin_get_security_kpis");
  if (error) {
    console.error("[SecurityCenter] Error fetching KPIs:", error);
    throw new Error(error.message || "Failed to load security KPIs");
  }

  return {
    active_sessions_count: Number(data?.active_sessions_count || 0),
    unique_active_users_count: Number(data?.unique_active_users_count || 0),
    revoked_sessions_count: Number(data?.revoked_sessions_count || 0),
    suspended_accounts_count: Number(data?.suspended_accounts_count || 0),
    open_security_alerts_count: Number(data?.open_security_alerts_count || 0),
    high_risk_actions_count: Number(data?.high_risk_actions_count || 0),
    last_security_sync_at: data?.last_security_sync_at || new Date().toISOString(),
  };
}

/**
 * Fetch full session inventory for Super Admin
 */
export async function fetchUserSessions(
  params?: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
  clientOverride?: SupabaseClient
): Promise<UserSessionRecord[]> {
  const client = clientOverride || supabase;
  const { data, error } = await (client as any).rpc("admin_list_user_sessions", {
    _user_id: params?.userId || null,
    _status: params?.status === "all" ? null : params?.status || null,
    _limit: params?.limit || 100,
    _offset: params?.offset || 0,
  });

  if (error) {
    console.error("[SecurityCenter] Error fetching user sessions:", error);
    throw new Error(error.message || "Failed to load user sessions");
  }

  return ((data || []) as any[]).map((r) => ({
    id: r.id,
    session_id: r.session_id,
    user_id: r.user_id,
    user_email: r.user_email,
    display_name: r.display_name,
    role: normalizeRole(r.role),
    account_status: (r.account_status || "active") as AccountStatus,
    session_status: (r.session_status || "active") as SessionStatus,
    sign_in_at: r.sign_in_at,
    last_activity_at: r.last_activity_at,
    expires_at: r.expires_at,
    revoked_at: r.revoked_at || null,
    revocation_reason: r.revocation_reason || null,
    ip_address: r.ip_address || null,
    user_agent: r.user_agent || null,
    device_type: (r.device_type || "desktop") as DeviceType,
    browser_name: r.browser_name || null,
    os_name: r.os_name || null,
    auth_method: r.auth_method || "password",
    is_suspicious: Boolean(r.is_suspicious),
    created_at: r.created_at,
  }));
}

async function resolveCallerUserId(client: SupabaseClient): Promise<string | null> {
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
 * Super Admin Revokes a Specific Session
 */
export async function revokeSession(
  sessionId: string,
  reason: string,
  clientOverride?: SupabaseClient
): Promise<SessionControlResult> {
  const client = clientOverride || supabase;
  await assertAuthorizedMutation(client, "accounts", "accounts.manage", {
    resourceType: "user_account",
    resourceAction: "write",
  });

  // Self-lockout check: Super Admin cannot revoke their current active session
  const currentSid = typeof window !== "undefined" ? localStorage.getItem(SESSION_REF_STORAGE_KEY) : null;
  if (currentSid && sessionId === currentSid) {
    throw new SecurityAuthorizationError(
      "Cannot revoke your own active administrative session (self-lockout protection).",
      "FORBIDDEN_ADMIN_ACTION",
      { sessionId }
    );
  }

  const { data, error } = await (client as any).rpc("admin_revoke_session", {
    _session_id: sessionId,
    _reason: reason.trim(),
  });

  if (error) {
    console.error("[SecurityCenter] Error revoking session:", error);
    throw new Error(error.message || "Failed to revoke session");
  }

  if (data?.target_user_id) {
    invalidateSecurityContextCache(data.target_user_id);
  }

  return {
    success: true,
    session_id: sessionId,
    target_user_id: data?.target_user_id,
    message: "Session revoked successfully.",
  };
}

/**
 * Super Admin Signs Out Everywhere (Revokes All Sessions for User)
 */
export async function revokeAllUserSessions(
  targetUserId: string,
  reason: string,
  clientOverride?: SupabaseClient
): Promise<SessionControlResult> {
  const client = clientOverride || supabase;
  await assertAuthorizedMutation(client, "accounts", "accounts.manage", {
    resourceType: "user_account",
    resource: { user_id: targetUserId },
    resourceAction: "write",
  });

  // Self-lockout check: Super Admin cannot revoke all sessions of their own account
  const sessionUserId = await resolveCallerUserId(client);
  if (sessionUserId && sessionUserId === targetUserId) {
    throw new SecurityAuthorizationError(
      "Cannot revoke all sessions for your own Super Admin account (self-lockout protection).",
      "FORBIDDEN_ADMIN_ACTION",
      { targetUserId }
    );
  }

  const { data, error } = await (client as any).rpc("admin_revoke_all_user_sessions", {
    _target_user_id: targetUserId,
    _reason: reason.trim(),
  });

  if (error) {
    console.error("[SecurityCenter] Error revoking all user sessions:", error);
    throw new Error(error.message || "Failed to revoke user sessions");
  }

  invalidateSecurityContextCache(targetUserId);

  return {
    success: true,
    target_user_id: targetUserId,
    revoked_count: data?.revoked_count,
    message: `Revoked ${data?.revoked_count || 0} active sessions for this account.`,
  };
}

/**
 * Super Admin Suspends Account & Invalidates All Sessions (Atomic Server Action)
 */
export async function suspendAccountWithSessions(
  targetUserId: string,
  reason: string,
  clientOverride?: SupabaseClient
): Promise<SessionControlResult> {
  const client = clientOverride || supabase;
  await assertAuthorizedMutation(client, "accounts", "accounts.manage", {
    resourceType: "user_account",
    resource: { user_id: targetUserId },
    resourceAction: "write",
  });

  // Self-lockout check: Super Admin cannot suspend their own account
  const sessionUserId = await resolveCallerUserId(client);
  if (sessionUserId && sessionUserId === targetUserId) {
    throw new SecurityAuthorizationError(
      "Cannot suspend your own account (administrative self-lockout protection).",
      "FORBIDDEN_ADMIN_ACTION",
      { targetUserId }
    );
  }

  const { data, error } = await (client as any).rpc("admin_suspend_account_with_sessions", {
    _target_user_id: targetUserId,
    _reason: reason.trim(),
  });

  if (error) {
    console.error("[SecurityCenter] Error suspending account with sessions:", error);
    throw new Error(error.message || "Failed to suspend account");
  }

  invalidateSecurityContextCache(targetUserId);

  return {
    success: true,
    target_user_id: targetUserId,
    revoked_count: data?.revoked_sessions,
    message: "Account suspended and all active sessions revoked.",
  };
}

/**
 * Super Admin Reactivates Account (Forces Fresh Authentication)
 */
export async function reactivateAccountSecurity(
  targetUserId: string,
  reason?: string,
  clientOverride?: SupabaseClient
): Promise<SessionControlResult> {
  const client = clientOverride || supabase;
  await assertAuthorizedMutation(client, "accounts", "accounts.manage", {
    resourceType: "user_account",
    resource: { user_id: targetUserId },
    resourceAction: "write",
  });

  const { error } = await (client as any).rpc("admin_reactivate_account_with_security", {
    _target_user_id: targetUserId,
    _reason: reason?.trim() || null,
  });

  if (error) {
    console.error("[SecurityCenter] Error reactivating account:", error);
    throw new Error(error.message || "Failed to reactivate account");
  }

  invalidateSecurityContextCache(targetUserId);

  return {
    success: true,
    target_user_id: targetUserId,
    message: "Account reactivated. The user must authenticate with fresh credentials.",
  };
}

/**
 * Fetch Rule-Based Security Alerts
 */
export async function fetchSecurityAlerts(
  statusFilter?: string,
  clientOverride?: SupabaseClient
): Promise<SecurityAlertRecord[]> {
  const client = clientOverride || supabase;
  let query = (client as any)
    .from("security_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[SecurityCenter] Error fetching security alerts:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    rule_id: row.rule_id,
    severity: row.severity,
    title: row.title,
    description: row.description,
    user_id: row.user_id,
    user_email: row.user_email,
    session_id: row.session_id,
    trigger_evidence: row.trigger_evidence || {},
    recommended_action: row.recommended_action,
    status: row.status as AlertStatus,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution_notes: row.resolution_notes,
    created_at: row.created_at,
  }));
}

/**
 * Resolve or Dismiss a Security Alert
 */
export async function resolveSecurityAlert(
  alertId: string,
  status: "resolved" | "dismissed" | "acknowledged",
  notes?: string,
  clientOverride?: SupabaseClient
): Promise<void> {
  const client = clientOverride || supabase;
  const { data: userResp } = await client.auth.getUser();
  const actorId = userResp?.user?.id;

  const { error } = await (client as any)
    .from("security_alerts")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      resolved_by: actorId || null,
      resolution_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) {
    console.error("[SecurityCenter] Error resolving security alert:", error);
    throw new Error(error.message || "Failed to update alert status");
  }
}

/**
 * Fetch Unified User Activity Timeline across audit sources
 */
export async function fetchUserActivityTimeline(
  params: {
    userId?: string;
    sessionId?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
  clientOverride?: SupabaseClient
): Promise<UserActivityEvent[]> {
  const client = clientOverride || supabase;
  const events: UserActivityEvent[] = [];
  const limit = params.limit || 150;

  try {
    // 1. Fetch from public.system_audit_logs
    let sysQuery = (client as any)
      .from("system_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (params.userId) {
      sysQuery = sysQuery.or(`actor_id.eq.${params.userId},entity_id.eq.${params.userId}`);
    }
    if (params.dateFrom) sysQuery = sysQuery.gte("created_at", params.dateFrom);
    if (params.dateTo) sysQuery = sysQuery.lte("created_at", params.dateTo);

    const { data: sysLogs } = await sysQuery;
    if (sysLogs) {
      for (const row of sysLogs) {
        let cat: UserActivityEvent["category"] = "business";
        const act = (row.action || "").toUpperCase();
        if (act.includes("AUTH") || act.includes("SESSION") || act.includes("SIGN_OUT")) {
          cat = "auth";
        } else if (act.includes("ROLE") || act.includes("PERMISSION") || act.includes("SUSPEND") || act.includes("REACTIVATE")) {
          cat = "admin";
        } else if (act.includes("NAVIGATE") || act.includes("VIEW")) {
          cat = "navigation";
        }

        if (!params.category || params.category === "all" || params.category === cat) {
          events.push({
            id: "sys_" + row.id,
            timestamp: row.created_at,
            actor_id: row.actor_id,
            actor_name: row.actor_name || "System",
            actor_role: row.actor_role || "system",
            target_user_id: row.entity_type === "user_account" ? row.entity_id : null,
            target_email: row.new_values?.target_email || null,
            category: cat,
            action: row.action,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            session_reference: row.new_values?.session_id || null,
            details: {
              ...(row.old_values && Object.keys(row.old_values).length > 0 ? { old: row.old_values } : {}),
              ...(row.new_values || {}),
              ip_address: row.ip_address,
              user_agent: row.user_agent,
            },
            evidence_source: "system_audit_logs",
            is_security_sensitive: cat === "admin" || cat === "auth",
          });
        }
      }
    }

    // 2. Fetch from public.account_audit_logs if relevant
    if (!params.category || params.category === "all" || params.category === "admin" || params.category === "auth") {
      let accQuery = (client as any)
        .from("account_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (params.userId) {
        accQuery = accQuery.or(`target_user_id.eq.${params.userId},actor_id.eq.${params.userId}`);
      }
      if (params.dateFrom) accQuery = accQuery.gte("created_at", params.dateFrom);
      if (params.dateTo) accQuery = accQuery.lte("created_at", params.dateTo);

      const { data: accLogs } = await accQuery;
      if (accLogs) {
        for (const row of accLogs) {
          const act = (row.action || "").toLowerCase();
          const cat = act.includes("session") || act.includes("sign_out") ? "auth" : "admin";
          events.push({
            id: "acc_" + row.id,
            timestamp: row.created_at,
            actor_id: row.actor_id,
            actor_name: row.actor_email || "Admin",
            actor_role: "super_admin",
            target_user_id: row.target_user_id,
            target_email: row.target_email,
            category: cat,
            action: row.action,
            entity_type: "user_account",
            entity_id: row.target_user_id,
            session_reference: row.metadata?.session_id || null,
            details: row.metadata || {},
            evidence_source: "account_audit_logs",
            is_security_sensitive: true,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[SecurityCenter] Error gathering activity timeline:", err);
  }

  // Sort chronologically descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Deduplicate by ID
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

/**
 * Record Failed Sign-In Attempt (Generates Audit & Automated Security Alert)
 */
export async function recordAuthFailure(
  email: string,
  reason?: string,
  clientOverride?: SupabaseClient
): Promise<void> {
  const client = clientOverride || supabase;
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    await (client as any).rpc("record_failed_sign_in_attempt", {
      _email: email.trim().toLowerCase(),
      _ip_address: null,
      _user_agent: ua,
      _reason: reason || "Invalid credentials",
    });
  } catch (err) {
    console.warn("[SecurityCenter] Error recording auth failure:", err);
  }
}
