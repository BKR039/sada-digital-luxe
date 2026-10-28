// ============================================================
// SADA OS — PHASE 8: COMPREHENSIVE AUDIT LOGGING ENGINE
// Immutable, authoritative audit trails for all sensitive operations:
// role/permission changes, account lifecycle, salaries, commissions,
// invoices, expenses, payments, and financial closing periods.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type { SystemAuditLog } from "@/types/notifications-and-audit";

export interface LogAuditParams {
  action:
    | "ROLE_CHANGE"
    | "PERMISSION_CHANGE"
    | "ACCOUNT_CREATE"
    | "ACCOUNT_SUSPEND"
    | "ACCOUNT_REACTIVATE"
    | "ACCOUNT_DELETE"
    | "SALARY_CHANGE"
    | "COMMISSION_CHANGE"
    | "INVOICE_CHANGE"
    | "EXPENSE_APPROVAL"
    | "PAYMENT_EXECUTION"
    | "FINANCIAL_CLOSING"
    | "FINANCIAL_REOPENING"
    | string;
  entityType:
    | "user"
    | "role"
    | "profile"
    | "salary_record"
    | "salary_request"
    | "salary_payment"
    | "sales_commission"
    | "invoice"
    | "expense_transaction"
    | "financial_closing_period"
    | string;
  entityId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  client?: any;
}

export async function logSystemAudit(params: LogAuditParams): Promise<{ success: boolean; id?: string }> {
  try {
    const db = params.client || supabase;
    const { error } = await (db as any)
      .from("system_audit_logs")
      .insert({
        actor_id: params.actorId || null,
        actor_name: params.actorName || "System / Admin",
        actor_role: params.actorRole || "super_admin",
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        old_values: params.oldValues || {},
        new_values: params.newValues || {},
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
      });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("[logSystemAudit] Error:", err);
    return { success: false };
  }
}

export async function fetchSystemAuditLogs(params?: {
  limit?: number;
  entityType?: string;
  action?: string;
}): Promise<SystemAuditLog[]> {
  try {
    let query = (supabase as any)
      .from("system_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(params?.limit || 100);

    if (params?.entityType) query = query.eq("entity_type", params.entityType);
    if (params?.action) query = query.eq("action", params.action);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_name: row.actor_name,
      actor_role: row.actor_role,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_values: row.old_values || {},
      new_values: row.new_values || {},
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error("[fetchSystemAuditLogs] Error:", err);
    return [];
  }
}
