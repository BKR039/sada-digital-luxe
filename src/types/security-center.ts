// ============================================================
// SADA OS — SECURITY & SESSION CONTROL CENTER TYPES
// Authoritative type definitions for identity monitoring, live sessions,
// security alerts, activity timelines, and emergency access control.
// ============================================================

import type { SadaRole } from "@/lib/permissions";
import type { AccountStatus } from "@/lib/account-service";

export type SessionStatus = "active" | "idle" | "expired" | "revoked";

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export interface UserSessionRecord {
  id: string;
  session_id: string;
  user_id: string;
  user_email: string;
  display_name: string;
  role: SadaRole;
  account_status: AccountStatus;
  session_status: SessionStatus;
  sign_in_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: DeviceType;
  browser_name: string | null;
  os_name: string | null;
  auth_method: string;
  is_suspicious: boolean;
  created_at: string;
}

export interface SecurityKPIs {
  active_sessions_count: number;
  unique_active_users_count: number;
  revoked_sessions_count: number;
  suspended_accounts_count: number;
  open_security_alerts_count: number;
  high_risk_actions_count: number;
  last_security_sync_at: string;
}

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface SecurityAlertRecord {
  id: string;
  rule_id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  user_id: string | null;
  user_email: string | null;
  session_id: string | null;
  trigger_evidence: Record<string, any>;
  recommended_action: string;
  status: AlertStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export type ActivityCategory =
  | "auth"
  | "navigation"
  | "admin"
  | "business"
  | "security";

export interface UserActivityEvent {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  target_user_id: string | null;
  target_email: string | null;
  category: ActivityCategory;
  action: string;
  entity_type: string;
  entity_id: string | null;
  session_reference: string | null;
  details: Record<string, any>;
  evidence_source: "system_audit_logs" | "account_audit_logs" | "security_alerts" | "user_sessions";
  is_security_sensitive?: boolean;
}

export interface SessionControlResult {
  success: boolean;
  message?: string;
  session_id?: string;
  target_user_id?: string;
  revoked_count?: number;
  error?: string;
}
