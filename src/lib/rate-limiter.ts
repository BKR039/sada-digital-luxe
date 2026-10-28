// ============================================================
// SADA OS — TARGETED RATE LIMITING & ABUSE PROTECTION ENGINE
// Phase I: High-performance in-memory sliding window rate limiter
// Protects high-risk mutations without degrading normal navigation.
// ============================================================

import { SecurityAuthorizationError } from "@/lib/security-isolation-service";

export type RateLimitCategory =
  | "auth_sensitive"
  | "account_management"
  | "permission_mutation"
  | "bulk_mutation"
  | "entity_creation"
  | "deletion";

export interface RateLimitPolicy {
  category: RateLimitCategory;
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
  description: string;
}

export const RATE_LIMIT_POLICIES: Record<RateLimitCategory, RateLimitPolicy> = {
  auth_sensitive: {
    category: "auth_sensitive",
    maxRequests: 5,
    windowMs: 60_000, // 1 minute
    blockDurationMs: 120_000, // 2 minutes cooldown
    description: "Authentication and recovery attempts",
  },
  account_management: {
    category: "account_management",
    maxRequests: 10,
    windowMs: 60_000, // 1 minute
    description: "Account provisioning and lifecycle management",
  },
  permission_mutation: {
    category: "permission_mutation",
    maxRequests: 15,
    windowMs: 60_000, // 1 minute
    description: "Privilege and module permission updates",
  },
  bulk_mutation: {
    category: "bulk_mutation",
    maxRequests: 5,
    windowMs: 30_000, // 30 seconds
    description: "Bulk operational mutations across tasks and records",
  },
  entity_creation: {
    category: "entity_creation",
    maxRequests: 30,
    windowMs: 60_000, // 1 minute (allows high worker productivity, blocks script spam)
    description: "High-frequency task, deal, and deliverable creation",
  },
  deletion: {
    category: "deletion",
    maxRequests: 10,
    windowMs: 60_000, // 1 minute
    description: "Permanent record deletion attempts",
  },
};

interface RateLimitBucket {
  timestamps: number[];
  blockedUntil?: number;
}

// In-memory sliding window store: key = `${category}:${identifier}`
const rateLimitStore = new Map<string, RateLimitBucket>();

/**
 * Resolves whether an operation requires abuse rate limiting.
 * Normal operations (navigation, queries, views, normal edits) return null.
 */
export function resolveRateLimitCategory(
  module: string,
  action: string
): RateLimitCategory | null {
  const normAction = action.toLowerCase();
  const cleanAction = normAction.includes(".") ? normAction.split(".").pop()! : normAction;

  // 1. Auth sensitive
  if (module === "auth" || normAction.includes("password_reset") || normAction.includes("auth.")) {
    return "auth_sensitive";
  }

  // 2. Account management
  if (module === "accounts" || normAction.includes("provision") || cleanAction === "create_account") {
    return "account_management";
  }

  // 3. Permission mutations
  if (normAction.includes("permission") || cleanAction === "update_permissions") {
    return "permission_mutation";
  }

  // 4. Bulk mutations
  if (cleanAction.startsWith("bulk_") || cleanAction.includes("bulk")) {
    return "bulk_mutation";
  }

  // 5. Permanent deletions
  if (cleanAction === "delete" || cleanAction.startsWith("delete_")) {
    return "deletion";
  }

  // 6. Entity creation spam defense
  if (cleanAction === "create" || cleanAction === "create_lead" || cleanAction === "create_task" || cleanAction === "create_subtask") {
    return "entity_creation";
  }

  // Normal operational velocity (view, search, change_stage, change_status, edit) is not throttled
  return null;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec?: number;
  category: RateLimitCategory;
}

/**
 * Checks and records an attempt under a rate limit policy.
 */
export function checkRateLimit(
  category: RateLimitCategory,
  identifier: string
): RateLimitCheckResult {
  const policy = RATE_LIMIT_POLICIES[category];
  const now = Date.now();
  const key = `${category}:${identifier}`;

  let bucket = rateLimitStore.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    rateLimitStore.set(key, bucket);
  }

  // Check if currently blocked
  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    const retryAfterSec = Math.ceil((bucket.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.blockedUntil,
      retryAfterSec,
      category,
    };
  }

  // Filter out timestamps outside the sliding window
  const windowStart = now - policy.windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length >= policy.maxRequests) {
    // Exceeded limit: apply block duration if configured
    if (policy.blockDurationMs) {
      bucket.blockedUntil = now + policy.blockDurationMs;
    }
    const oldestTimestamp = bucket.timestamps[0] || now;
    const resetAt = bucket.blockedUntil || (oldestTimestamp + policy.windowMs);
    const retryAfterSec = Math.ceil((resetAt - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSec: Math.max(1, retryAfterSec),
      category,
    };
  }

  // Record this attempt
  bucket.timestamps.push(now);
  const remaining = policy.maxRequests - bucket.timestamps.length;
  const resetAt = bucket.timestamps[0] + policy.windowMs;

  return {
    allowed: true,
    remaining,
    resetAt,
    category,
  };
}

/**
 * Asserts that the requested action does not exceed targeted rate limits.
 * Throws SecurityAuthorizationError with code RATE_LIMIT_EXCEEDED when exceeded.
 */
export function assertRateLimit(
  category: RateLimitCategory,
  identifier: string
): void {
  const check = checkRateLimit(category, identifier);
  if (!check.allowed) {
    const policy = RATE_LIMIT_POLICIES[category];
    throw new SecurityAuthorizationError(
      `Rate limit exceeded: Too many requests for ${policy.description}. Please wait ${check.retryAfterSec || 60} seconds before retrying.`,
      "RATE_LIMIT_EXCEEDED",
      {
        category,
        identifier,
        retryAfterSec: check.retryAfterSec,
        resetAt: check.resetAt,
      }
    );
  }
}

/**
 * Resets rate limit buckets. Used for testing and administrative unlock.
 */
export function resetRateLimit(category?: RateLimitCategory, identifier?: string): void {
  if (category && identifier) {
    rateLimitStore.delete(`${category}:${identifier}`);
  } else if (category) {
    for (const key of Array.from(rateLimitStore.keys())) {
      if (key.startsWith(`${category}:`)) {
        rateLimitStore.delete(key);
      }
    }
  } else {
    rateLimitStore.clear();
  }
}
