// ============================================================
// SADA OS — CENTRALIZED BUSINESS RULES SERVICE
// Single Source of Truth for configurable business rules,
// mathematical parameters, commission policies, and thresholds.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  BusinessRule,
  BusinessRuleKey,
  BusinessRuleVersion,
  ResetBusinessRuleParams,
  SADABusinessRulesMap,
  UpdateBusinessRuleParams,
} from "@/types/business-rules";
import { logSystemAudit } from "./audit-service";

// ============================================================
// CANONICAL DEFAULT RULES (Deterministic Fallbacks)
// ============================================================
export const DEFAULT_BUSINESS_RULES: SADABusinessRulesMap = {
  // Sales & Commissions
  initial_commission_rate: 15,
  initial_sales_commission_rate: 15,
  initial_commission_duration_months: 6,
  renewal_commission_rate: 5,
  renewal_sales_commission_rate: 5,
  renewal_commission_duration_months: 12,
  upsell_commission_rate: 5,
  upsell_sales_commission_rate: 5,
  high_commission_amount: 200,

  // Sponsoring & Advertising
  sponsoring_purchase_rate: 3.37,
  sponsoring_client_rate: 4.0,
  sponsoring_min_margin_percent: 15,
  minimum_net_margin_for_sponsoring_efficiency: 15,

  // Profitability
  client_high_profit_margin_percent: 50,
  high_profit_margin_percent: 50,
  client_high_profit_amount_tnd: 1000,
  high_profit_contribution_tnd: 1000,
  client_medium_profit_margin_percent: 25,
  client_medium_profit_amount_tnd: 400,
  low_profit_client_margin_percent: 20,
  low_margin_client_threshold_percent: 20,
  historical_profit_zero_behavior: "null",

  // Cash & Treasury
  critical_runway_months: 3,
  warning_runway_months: 6,
  runway_default_months: 12,

  // Fixed Burn
  fixed_burn_warning_percent: 40,
  high_fixed_burn_revenue_percent: 40,

  // Smart Insights
  high_commission_insight_threshold_tnd: 200,
  receivables_critical_days: 60,

  // Notifications & Alerts
  notification_deduplication_hours: 24,
  task_due_soon_days: 2,
  task_due_soon_lead_days: 2,

  // Operations
  standard_monthly_working_hours: 160,
  max_salary_advance_percent: 50,
};

// Aliases mapping for seamless bidirectional lookup
const KEY_ALIASES: Record<string, string[]> = {
  low_profit_client_margin_percent: ["low_margin_client_threshold_percent"],
  low_margin_client_threshold_percent: ["low_profit_client_margin_percent"],
  high_profit_margin_percent: ["client_high_profit_margin_percent"],
  client_high_profit_margin_percent: ["high_profit_margin_percent"],
  high_profit_contribution_tnd: ["client_high_profit_amount_tnd"],
  client_high_profit_amount_tnd: ["high_profit_contribution_tnd"],
  high_commission_amount: ["high_commission_insight_threshold_tnd"],
  high_commission_insight_threshold_tnd: ["high_commission_amount"],
  high_fixed_burn_revenue_percent: ["fixed_burn_warning_percent"],
  fixed_burn_warning_percent: ["high_fixed_burn_revenue_percent"],
  minimum_net_margin_for_sponsoring_efficiency: ["sponsoring_min_margin_percent"],
  sponsoring_min_margin_percent: ["minimum_net_margin_for_sponsoring_efficiency"],
  initial_sales_commission_rate: ["initial_commission_rate"],
  initial_commission_rate: ["initial_sales_commission_rate"],
  renewal_sales_commission_rate: ["renewal_commission_rate"],
  renewal_commission_rate: ["renewal_sales_commission_rate"],
  upsell_sales_commission_rate: ["upsell_commission_rate"],
  upsell_commission_rate: ["upsell_sales_commission_rate"],
  task_due_soon_lead_days: ["task_due_soon_days"],
  task_due_soon_days: ["task_due_soon_lead_days"],
};

// In-memory cache
let cachedRulesList: BusinessRule[] | null = null;
let cachedRulesMap: SADABusinessRulesMap = { ...DEFAULT_BUSINESS_RULES };
let cachedTextRulesMap: Record<string, string> = {
  historical_profit_zero_behavior: "null",
};
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// Event bus listeners
const listeners = new Set<() => void>();

export function subscribeToBusinessRules(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error("[business-rules-service] Listener error:", e);
    }
  }
}

// Realtime subscription setup
let realtimeSubscribed = false;

function setupRealtimeListener() {
  if (realtimeSubscribed) return;
  try {
    const channel = supabase
      .channel("business_rules_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_rules" },
        () => {
          // Invalidate cache immediately on change
          lastFetchTime = 0;
          fetchBusinessRules(true).then(() => {
            notifyListeners();
          }).catch(() => {});
        }
      )
      .subscribe();

    realtimeSubscribed = true;
  } catch (err) {
    console.warn("[business-rules-service] Could not set up realtime listener:", err);
  }
}

/**
 * Validates whether a business rule is currently effective based on:
 * 1. is_active flag
 * 2. effective_from timestamp (must be <= asOfDate, with 5m clock-skew buffer)
 * 3. effective_until timestamp (if set, must be >= asOfDate)
 */
export function isRuleCurrentlyEffective(
  rule: BusinessRule,
  asOfDate: Date = new Date()
): boolean {
  if (!rule.is_active) return false;
  const time = asOfDate.getTime();
  if (rule.effective_from) {
    const fromTime = new Date(rule.effective_from).getTime();
    // Allow up to 5 minutes tolerance for server-client clock drift
    if (!isNaN(fromTime) && fromTime - time > 5 * 60 * 1000) return false;
  }
  if (rule.effective_until) {
    const untilTime = new Date(rule.effective_until).getTime();
    if (!isNaN(untilTime) && untilTime < time) return false;
  }
  return true;
}

// ============================================================
// 1. FETCH BUSINESS RULES LIST
// ============================================================
export async function fetchBusinessRules(forceRefresh = false): Promise<BusinessRule[]> {
  setupRealtimeListener();

  const now = Date.now();
  if (!forceRefresh && cachedRulesList && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedRulesList;
  }

  try {
    const { data, error } = await (supabase as any)
      .from("business_rules")
      .select("*")
      .order("category", { ascending: true })
      .order("rule_name", { ascending: true });

    if (error) throw error;

    if (data && Array.isArray(data)) {
      cachedRulesList = data as BusinessRule[];
      lastFetchTime = now;

      // Update cached map respecting live effective dates
      const newMap = { ...DEFAULT_BUSINESS_RULES };
      const newTextMap: Record<string, string> = { ...cachedTextRulesMap };
      const nowDate = new Date(now);

      for (const r of cachedRulesList) {
        if (isRuleCurrentlyEffective(r, nowDate)) {
          if (r.numeric_value !== null && r.numeric_value !== undefined) {
            (newMap as any)[r.rule_key] = Number(r.numeric_value);
          }
          if (r.text_value !== null && r.text_value !== undefined) {
            newTextMap[r.rule_key] = r.text_value;
          }
        }
      }
      cachedRulesMap = newMap;
      cachedTextRulesMap = newTextMap;
      return cachedRulesList;
    }

    return cachedRulesList || [];
  } catch (err) {
    console.warn("[fetchBusinessRules] Falling back to default business rules:", err);
    return cachedRulesList || [];
  }
}

// ============================================================
// 2. GET BUSINESS RULES (Fast synchronous reads from cache)
// ============================================================
export async function getBusinessRulesMap(forceRefresh = false): Promise<SADABusinessRulesMap> {
  await fetchBusinessRules(forceRefresh);
  return cachedRulesMap;
}

export function getCachedBusinessRulesMap(): SADABusinessRulesMap {
  return cachedRulesMap;
}

export function getBusinessRuleNumber(
  key: BusinessRuleKey | string,
  fallback?: number
): number {
  const map = cachedRulesMap as Record<string, any>;
  if (map && map[key] !== undefined && map[key] !== null) {
    return Number(map[key]);
  }

  // Check aliases
  const aliases = KEY_ALIASES[key] || [];
  for (const alias of aliases) {
    if (map && map[alias] !== undefined && map[alias] !== null) {
      return Number(map[alias]);
    }
  }

  if (fallback !== undefined) return fallback;
  const defVal = (DEFAULT_BUSINESS_RULES as any)[key];
  return defVal !== undefined ? Number(defVal) : 0;
}

export function getBusinessRuleText(
  key: BusinessRuleKey | string,
  fallback = ""
): string {
  if (cachedTextRulesMap && cachedTextRulesMap[key] !== undefined) {
    return cachedTextRulesMap[key];
  }
  const aliases = KEY_ALIASES[key] || [];
  for (const alias of aliases) {
    if (cachedTextRulesMap && cachedTextRulesMap[alias] !== undefined) {
      return cachedTextRulesMap[alias];
    }
  }
  return fallback;
}

export function getBusinessRuleBoolean(
  key: BusinessRuleKey | string,
  fallback = false
): boolean {
  if (!cachedRulesList) return fallback;
  const rule = cachedRulesList.find((r) => r.rule_key === key);
  if (rule && rule.boolean_value !== null && rule.boolean_value !== undefined) {
    return !!rule.boolean_value;
  }
  const aliases = KEY_ALIASES[key] || [];
  for (const alias of aliases) {
    const aliasRule = cachedRulesList.find((r) => r.rule_key === alias);
    if (aliasRule && aliasRule.boolean_value !== null && aliasRule.boolean_value !== undefined) {
      return !!aliasRule.boolean_value;
    }
  }
  return fallback;
}

export function getBusinessRuleJson<T = any>(
  key: BusinessRuleKey | string,
  fallback: T | null = null
): T | null {
  if (!cachedRulesList) return fallback;
  const rule = cachedRulesList.find((r) => r.rule_key === key);
  if (rule && rule.json_value !== null && rule.json_value !== undefined) {
    return rule.json_value as T;
  }
  const aliases = KEY_ALIASES[key] || [];
  for (const alias of aliases) {
    const aliasRule = cachedRulesList.find((r) => r.rule_key === alias);
    if (aliasRule && aliasRule.json_value !== null && aliasRule.json_value !== undefined) {
      return aliasRule.json_value as T;
    }
  }
  return fallback;
}

/**
 * Retrieves a rule value evaluated as of a specific date.
 * If effective date constraints are active, checks that the rule was active on asOfDate.
 */
export function getBusinessRuleForDate(
  key: BusinessRuleKey | string,
  asOfDate: Date = new Date(),
  fallback?: number
): number {
  if (!cachedRulesList) return getBusinessRuleNumber(key, fallback);
  const matching = cachedRulesList.filter(
    (r) =>
      (r.rule_key === key || (KEY_ALIASES[key] && KEY_ALIASES[key].includes(r.rule_key))) &&
      isRuleCurrentlyEffective(r, asOfDate)
  );
  if (matching.length > 0) {
    const active = matching[0];
    if (active.numeric_value !== null && active.numeric_value !== undefined) {
      return Number(active.numeric_value);
    }
  }
  return getBusinessRuleNumber(key, fallback);
}

// ============================================================
// 3. UPDATE BUSINESS RULE (Super Admin Only)
// ============================================================
export async function updateBusinessRule(
  params: UpdateBusinessRuleParams
): Promise<{ success: boolean; data?: BusinessRule; error?: string }> {
  try {
    if (!params.changeReason || !params.changeReason.trim()) {
      return { success: false, error: "A change reason is required for regulatory auditability." };
    }

    // Resolve authenticated actor fallback if not explicitly provided
    let resolvedActorId = params.actorId;
    let resolvedActorName = params.actorName;
    if (!resolvedActorId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          resolvedActorId = authData.user.id;
          resolvedActorName =
            resolvedActorName ||
            authData.user.user_metadata?.full_name ||
            authData.user.email?.split("@")[0] ||
            "Super Admin";
        }
      } catch {
        // Fall back gracefully
      }
    }

    // Fetch existing rule to validate bounds
    const { data: existing, error: fetchErr } = await (supabase as any)
      .from("business_rules")
      .select("*")
      .eq("id", params.ruleId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: "Business rule not found or inaccessible." };
    }

    // Strict Type Safety based on rule's value_type
    let sanitizedNumeric: number | undefined = undefined;
    if (existing.value_type === "numeric") {
      let rawVal: any = params.numericValue;
      if (typeof rawVal === "string") {
        rawVal = Number(rawVal.trim().replace(",", "."));
      }
      if (rawVal === undefined || rawVal === null || isNaN(Number(rawVal)) || !isFinite(Number(rawVal))) {
        return { success: false, error: "A valid numeric value is required for this rule." };
      }
      sanitizedNumeric = Number(rawVal);

      if (existing.min_value !== null && sanitizedNumeric < Number(existing.min_value)) {
        return {
          success: false,
          error: `Value cannot be less than minimum allowed (${existing.min_value} ${existing.unit || ""}).`,
        };
      }
      if (existing.max_value !== null && sanitizedNumeric > Number(existing.max_value)) {
        return {
          success: false,
          error: `Value cannot exceed maximum allowed (${existing.max_value} ${existing.unit || ""}).`,
        };
      }
    } else if (existing.value_type === "boolean") {
      if (params.booleanValue === undefined || typeof params.booleanValue !== "boolean") {
        return { success: false, error: "Boolean value is required for boolean rule." };
      }
    } else if (existing.value_type === "text") {
      if (params.textValue === undefined || typeof params.textValue !== "string") {
        return { success: false, error: "Text value is required for text rule." };
      }
    }

    const payload: any = {
      change_reason: params.changeReason.trim(),
      updated_by: resolvedActorId || null,
      updated_at: new Date().toISOString(),
    };

    if (sanitizedNumeric !== undefined) payload.numeric_value = sanitizedNumeric;
    if (params.booleanValue !== undefined) payload.boolean_value = params.booleanValue;
    if (params.textValue !== undefined) {
      payload.text_value = params.textValue !== null ? params.textValue.trim() : null;
    }
    if (params.jsonValue !== undefined) payload.json_value = params.jsonValue;

    const { data: updated, error: updateErr } = await (supabase as any)
      .from("business_rules")
      .update(payload)
      .eq("id", params.ruleId)
      .select()
      .single();

    if (updateErr) {
      console.error("[updateBusinessRule] Supabase error:", updateErr);
      if (updateErr.code === "42501" || updateErr.message?.toLowerCase().includes("policy")) {
        return {
          success: false,
          error: "Permission denied: Only authorized Super Admins may modify business governance rules.",
        };
      }
      throw updateErr;
    }

    // Log to System Audit Trail (non-blocking)
    try {
      await logSystemAudit({
        action: "BUSINESS_RULE_CHANGE",
        entityType: "business_rule",
        entityId: params.ruleId,
        actorId: resolvedActorId,
        actorName: resolvedActorName || "Super Admin",
        oldValues: {
          rule_key: existing.rule_key,
          numeric_value: existing.numeric_value,
          boolean_value: existing.boolean_value,
          text_value: existing.text_value,
          version: existing.version,
        },
        newValues: {
          numeric_value: updated.numeric_value,
          boolean_value: updated.boolean_value,
          text_value: updated.text_value,
          version: updated.version,
          change_reason: params.changeReason.trim(),
        },
      });
    } catch (auditErr) {
      console.warn("[updateBusinessRule] Non-critical audit log failure:", auditErr);
    }

    // Invalidate local cache and re-fetch synchronously
    lastFetchTime = 0;
    await fetchBusinessRules(true);
    notifyListeners();

    return { success: true, data: updated as BusinessRule };
  } catch (err: any) {
    console.error("[updateBusinessRule] Unexpected error:", err);
    return { success: false, error: err.message || "Failed to update business rule." };
  }
}

// ============================================================
// 4. RESET BUSINESS RULE TO DEFAULT (Super Admin Only)
// ============================================================
export async function resetBusinessRuleToDefault(
  params: ResetBusinessRuleParams
): Promise<{ success: boolean; data?: BusinessRule; error?: string }> {
  try {
    const reason = params.changeReason?.trim() || "Reset to system default value";

    // 1. Attempt RPC call
    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
      "reset_business_rule_to_default",
      {
        p_rule_id: params.ruleId,
        p_reason: reason,
      }
    );

    if (!rpcErr && rpcData) {
      lastFetchTime = 0;
      await fetchBusinessRules(true);
      notifyListeners();
      return { success: true, data: rpcData as BusinessRule };
    }

    // 2. Client-side fallback if RPC is blocked
    const { data: existing, error: fetchErr } = await (supabase as any)
      .from("business_rules")
      .select("*")
      .eq("id", params.ruleId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: "Business rule not found." };
    }

    const payload: any = {
      numeric_value: existing.default_numeric_value !== null ? existing.default_numeric_value : existing.numeric_value,
      boolean_value: existing.default_boolean_value !== null ? existing.default_boolean_value : existing.boolean_value,
      text_value: existing.default_text_value !== null ? existing.default_text_value : existing.text_value,
      json_value: existing.default_json_value !== null ? existing.default_json_value : existing.json_value,
      updated_by: params.actorId || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await (supabase as any)
      .from("business_rules")
      .update(payload)
      .eq("id", params.ruleId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Log to System Audit Trail
    await logSystemAudit({
      action: "BUSINESS_RULE_RESET_DEFAULT",
      entityType: "business_rule",
      entityId: params.ruleId,
      actorId: params.actorId,
      actorName: params.actorName,
      oldValues: {
        numeric_value: existing.numeric_value,
        boolean_value: existing.boolean_value,
        text_value: existing.text_value,
        version: existing.version,
      },
      newValues: {
        numeric_value: updated.numeric_value,
        boolean_value: updated.boolean_value,
        text_value: updated.text_value,
        version: updated.version,
        change_reason: reason,
      },
    });

    lastFetchTime = 0;
    await fetchBusinessRules(true);
    notifyListeners();

    return { success: true, data: updated as BusinessRule };
  } catch (err: any) {
    console.error("[resetBusinessRuleToDefault] Error:", err);
    return { success: false, error: err.message || "Failed to reset business rule" };
  }
}

// ============================================================
// 5. FETCH RULE VERSION HISTORY
// ============================================================
export async function fetchRuleVersions(ruleId: string): Promise<BusinessRuleVersion[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("business_rule_versions")
      .select("*")
      .eq("rule_id", ruleId)
      .order("version", { ascending: false });

    if (error) throw error;
    return (data || []) as BusinessRuleVersion[];
  } catch (err) {
    console.error("[fetchRuleVersions] Error:", err);
    return [];
  }
}
