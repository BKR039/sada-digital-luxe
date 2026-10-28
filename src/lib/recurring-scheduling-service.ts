// ============================================================
// SADA OS — RECURRING CLIENT-SERVICE SCHEDULING ENGINE
// Canonical SSOT for Service Commitments, Frequency Rules,
// Idempotent Occurrence Generation, and Workflow Stage Linkage.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  ServiceCommitment,
  CommitmentScheduleRule,
  CommitmentFrequency,
  CommitmentLifecycleStatus,
  GeneratedOccurrence,
  GenerationResult,
  ServiceSchedulingPreset,
} from "@/types/service-commitment";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  getDay,
  getDate,
  addDays,
  isBefore,
  isAfter,
} from "date-fns";
import {
  fetchWorkflowTemplates,
  instantiateWorkflowStages,
  CANONICAL_WORKFLOW_TEMPLATES,
} from "./workflow-service";
import { resolveToProfileId, type TeamMemberRow, type ProfileRow, type TaskRow } from "@/components/admin/project-utils";

/**
 * Creates a timezone-safe calendar Date at 12:00:00 (noon)
 * to prevent date rollback/shifting across UTC and local timezones.
 */
export function createSafeCalendarDate(year: number, month: number, day: number = 1): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Safely parses YYYY-MM or YYYY-MM-DD into a noon Date object
 * ensuring deterministic calendar day semantics.
 */
export function parseSafeCalendarDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return createSafeCalendarDate(dateInput.getFullYear(), dateInput.getMonth() + 1, dateInput.getDate());
  }
  const cleanStr = String(dateInput).split("T")[0].trim();
  const parts = cleanStr.split("-").map((p) => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return createSafeCalendarDate(parts[0], parts[1], parts[2]);
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return createSafeCalendarDate(parts[0], parts[1], 1);
  }
  return new Date();
}

// ============================================================
// CANONICAL PACKAGE COMMITMENT TEMPLATES
// A package may define:
// - Stories shooting: 2 times/week
// - Reels shooting: 2 days/month
// - Posts: 8/month
// - Photography: 1/month
// ============================================================
export const CANONICAL_SERVICE_COMMITMENT_PRESETS: ServiceSchedulingPreset[] = [
  {
    service_name: "Stories Shooting",
    deliverable_type: "stories_shooting",
    quantity: 2,
    frequency: "weekly",
    default_days_of_week: [2, 4], // Tuesday & Thursday (2 times/week)
    schedule_rule: {
      days_of_week: [2, 4],
      default_time: "10:00",
      estimated_minutes: 120,
    },
    duration_hours: 2.0,
    default_role: "videographer",
    workflow_type: "reel",
    description: "On-site or studio daily stories creation (2 times per week)",
    description_ar: "تصوير وإنتاج الستوري الميداني (مرتين أسبوعياً)",
  },
  {
    service_name: "Reels Shooting",
    deliverable_type: "reels_shooting",
    quantity: 2,
    frequency: "monthly",
    default_days_of_month: [5, 20], // 2 dedicated shoot days per month
    schedule_rule: {
      days_of_month: [5, 20],
      default_time: "14:00",
      estimated_minutes: 240,
    },
    duration_hours: 4.0,
    default_role: "videographer",
    workflow_type: "reel",
    description: "Dedicated cinema reel shoot day (2 days per month)",
    description_ar: "يوم تصوير ريلز احترافي مخصص (يومان شهرياً)",
  },
  {
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 8,
    frequency: "monthly",
    schedule_rule: {
      default_time: "11:00",
      estimated_minutes: 90,
    },
    duration_hours: 1.5,
    default_role: "designer",
    workflow_type: "design",
    description: "Graphic design & copywriting social media posts (8 per month)",
    description_ar: "تصميم ونشر منشورات السوشيال ميديا (8 منشورات شهرياً)",
  },
  {
    service_name: "Photography Session",
    deliverable_type: "photography",
    quantity: 1,
    frequency: "monthly",
    default_days_of_month: [10], // 1 dedicated photography session per month
    schedule_rule: {
      days_of_month: [10],
      default_time: "10:00",
      estimated_minutes: 180,
    },
    duration_hours: 3.0,
    default_role: "photographer",
    workflow_type: "design",
    description: "Product and commercial brand photography session (1 per month)",
    description_ar: "جلسة تصوير فوتوغرافي تجاري احترافي (جلسة واحدة شهرياً)",
  },
  {
    service_name: "Paid Ads Campaign Strategy",
    deliverable_type: "ads",
    quantity: 1,
    frequency: "monthly",
    default_days_of_month: [1], // 1st of month setup
    schedule_rule: {
      days_of_month: [1],
      default_time: "09:00",
      estimated_minutes: 180,
    },
    duration_hours: 3.0,
    default_role: "media_buyer",
    workflow_type: "sponsoring",
    description: "Monthly paid ads budget allocation, audience setup and performance optimization",
    description_ar: "استراتيجية وإطلاق الحملات الممولة ومراجعة الأداء شهرياً",
  },
];

/**
 * Resolves a canonical scheduling preset given a deliverable name, title, or deliverable_type.
 * Explicitly maps service types to scheduling presets.
 */
export function resolveSchedulingPreset(
  identifier: string
): ServiceSchedulingPreset | undefined {
  if (!identifier) return undefined;
  const norm = identifier.toLowerCase().trim();

  // 1. Direct deliverable_type match
  const byType = CANONICAL_SERVICE_COMMITMENT_PRESETS.find(
    (p) => p.deliverable_type.toLowerCase() === norm
  );
  if (byType) return byType;

  // 2. Direct service_name match
  const byName = CANONICAL_SERVICE_COMMITMENT_PRESETS.find(
    (p) => p.service_name.toLowerCase() === norm
  );
  if (byName) return byName;

  // 3. Keyword / substring match
  if (norm.includes("stor")) {
    return CANONICAL_SERVICE_COMMITMENT_PRESETS.find((p) => p.deliverable_type === "stories_shooting");
  }
  if (norm.includes("reel")) {
    return CANONICAL_SERVICE_COMMITMENT_PRESETS.find((p) => p.deliverable_type === "reels_shooting");
  }
  if (norm.includes("post") || norm.includes("feed") || norm.includes("carousel")) {
    return CANONICAL_SERVICE_COMMITMENT_PRESETS.find((p) => p.deliverable_type === "post");
  }
  if (norm.includes("photo")) {
    return CANONICAL_SERVICE_COMMITMENT_PRESETS.find((p) => p.deliverable_type === "photography");
  }
  if (norm.includes("ad") || norm.includes("sponsor") || norm.includes("campaign")) {
    return CANONICAL_SERVICE_COMMITMENT_PRESETS.find((p) => p.deliverable_type === "ads");
  }

  return undefined;
}

/**
 * Derives initial service commitments from a package definition for a client.
 * Enforces explicit relationship: Service Type / Deliverable -> Scheduling Preset -> Commitment Rule.
 * Preserves package catalog quantities and deliverable linkages.
 */
export function deriveCommitmentsFromPackage(
  pkgOrId: any,
  clientId: string,
  deliverablesList?: any[]
): Array<Partial<ServiceCommitment>> {
  const commitments: Array<Partial<ServiceCommitment>> = [];
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const pkgId = typeof pkgOrId === "string" ? pkgOrId : pkgOrId?.id;
  const pkgObj = typeof pkgOrId === "object" && pkgOrId !== null ? pkgOrId : {};
  const deliverables = Array.isArray(deliverablesList) && deliverablesList.length > 0
    ? deliverablesList
    : Array.isArray(pkgObj.deliverables)
    ? pkgObj.deliverables
    : null;

  if (deliverables && deliverables.length > 0) {
    for (const d of deliverables) {
      const name = String(d.name || d.title || "").trim();
      const count = Number(d.count ?? d.quantity ?? d.target_quantity ?? 0);
      const preset = resolveSchedulingPreset(d.deliverable_type || name);

      if (preset) {
        const resolvedQty = count > 0 ? count : preset.quantity;
        const scheduleRule: CommitmentScheduleRule = {
          frequency: preset.frequency,
          quantity: resolvedQty,
          duration_hours: preset.duration_hours,
          default_time: preset.schedule_rule?.default_time,
          estimated_minutes: preset.schedule_rule?.estimated_minutes,
        };

        if (preset.frequency === "weekly") {
          scheduleRule.days_of_week = preset.schedule_rule?.days_of_week || (resolvedQty === 1 ? [2] : resolvedQty === 2 ? [2, 4] : [1, 3, 5]);
        } else if (preset.frequency === "monthly") {
          if (preset.schedule_rule?.days_of_month) {
            scheduleRule.days_of_month = resolvedQty === 1 ? [10] : preset.schedule_rule.days_of_month;
          }
        }

        commitments.push({
          client_id: clientId,
          package_id: pkgId,
          deliverable_id: d.id || null,
          service_name: d.name || d.title || preset.service_name,
          deliverable_type: preset.deliverable_type,
          quantity: resolvedQty,
          frequency: preset.frequency,
          schedule_rule: scheduleRule,
          start_date: todayStr,
          duration_hours: preset.duration_hours,
          assignment_rule: "specialist_role",
          default_role: preset.default_role,
          task_type: preset.workflow_type,
          status: "active",
          notes: `Derived from package preset: ${preset.service_name} (${preset.frequency}, ${resolvedQty}x)`,
        });
      }
    }

    if (commitments.length > 0) {
      return commitments;
    }
  }

  // Fallback derivation based on package catalog fields:
  // 1. Stories Shooting: 2 times/week if monthly_stories or package has stories
  if (pkgObj.monthly_stories || (pkgObj.included_items && JSON.stringify(pkgObj.included_items).toLowerCase().includes("stor"))) {
    const storiesPreset = resolveSchedulingPreset("stories_shooting")!;
    commitments.push({
      client_id: clientId,
      package_id: pkgId,
      service_name: "Stories Shooting",
      deliverable_type: "stories_shooting",
      quantity: 2,
      frequency: "weekly",
      schedule_rule: {
        frequency: "weekly",
        quantity: 2,
        days_of_week: [2, 4],
        duration_hours: storiesPreset.duration_hours,
      },
      start_date: todayStr,
      duration_hours: storiesPreset.duration_hours,
      assignment_rule: "specialist_role",
      default_role: storiesPreset.default_role,
      task_type: storiesPreset.workflow_type,
      status: "active",
      notes: "Derived from package: Stories shooting 2 times/week",
    });
  }

  // 2. Reels Shooting: 2 days/month (or calculated from monthly_reels / production sessions)
  const reelsQty = pkgObj.production_sessions > 0 ? pkgObj.production_sessions : (pkgObj.monthly_reels > 0 ? pkgObj.monthly_reels : 2);
  const reelsPreset = resolveSchedulingPreset("reels_shooting")!;
  commitments.push({
    client_id: clientId,
    package_id: pkgId,
    service_name: "Reels Shooting",
    deliverable_type: "reels_shooting",
    quantity: reelsQty,
    frequency: "monthly",
    schedule_rule: {
      frequency: "monthly",
      quantity: reelsQty,
      days_of_month: reelsQty === 1 ? [10] : [5, 20],
      duration_hours: reelsPreset.duration_hours,
    },
    start_date: todayStr,
    duration_hours: reelsPreset.duration_hours,
    assignment_rule: "specialist_role",
    default_role: reelsPreset.default_role,
    task_type: reelsPreset.workflow_type,
    status: "active",
    notes: `Derived from package: Reels shooting ${reelsQty} days/month`,
  });

  // 3. Posts Publishing: 8/month (or pkgObj.monthly_posts)
  const postsQty = pkgObj.monthly_posts > 0 ? pkgObj.monthly_posts : 8;
  const postsPreset = resolveSchedulingPreset("post")!;
  commitments.push({
    client_id: clientId,
    package_id: pkgId,
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: postsQty,
    frequency: "monthly",
    schedule_rule: {
      frequency: "monthly",
      quantity: postsQty,
      duration_hours: postsPreset.duration_hours,
    },
    start_date: todayStr,
    duration_hours: postsPreset.duration_hours,
    assignment_rule: "specialist_role",
    default_role: postsPreset.default_role,
    task_type: postsPreset.workflow_type,
    status: "active",
    notes: `Derived from package: Posts ${postsQty}/month`,
  });

  // 4. Photography: 1/month
  const photoPreset = resolveSchedulingPreset("photography")!;
  commitments.push({
    client_id: clientId,
    package_id: pkgId,
    service_name: "Photography Session",
    deliverable_type: "photography",
    quantity: 1,
    frequency: "monthly",
    schedule_rule: {
      frequency: "monthly",
      quantity: 1,
      days_of_month: [10],
      duration_hours: photoPreset.duration_hours,
    },
    start_date: todayStr,
    duration_hours: photoPreset.duration_hours,
    assignment_rule: "specialist_role",
    default_role: photoPreset.default_role,
    task_type: photoPreset.workflow_type,
    status: "active",
    notes: "Derived from package: Photography 1/month",
  });

  return commitments;
}

// In-memory cache for fast lookup and fallback resilience
let cachedCommitments: Record<string, ServiceCommitment[]> = {};

/**
 * Fetches all recurring service commitments for a given client.
 */
export async function fetchClientCommitments(clientId: string): Promise<ServiceCommitment[]> {
  try {
    // 1. Try dedicated table
    const { data, error } = await (supabase as any)
      .from("service_commitments")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      cachedCommitments[clientId] = data;
      return data;
    }

    // 2. Try business_rules fallback storage
    const ruleKey = `commitments_client_${clientId}`;
    const { data: ruleData } = await (supabase as any)
      .from("business_rules")
      .select("value")
      .eq("key", ruleKey)
      .maybeSingle();

    if (ruleData?.value && Array.isArray(ruleData.value)) {
      cachedCommitments[clientId] = ruleData.value;
      return ruleData.value;
    }

    return cachedCommitments[clientId] || [];
  } catch (err) {
    console.warn("fetchClientCommitments fallback to memory cache:", err);
    return cachedCommitments[clientId] || [];
  }
}

/**
 * Saves (creates or updates) a Service Commitment.
 */
export async function saveServiceCommitment(
  commitment: Partial<ServiceCommitment> & { client_id: string; service_name: string },
  actorId?: string
): Promise<{ success: boolean; data?: ServiceCommitment; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const id = commitment.id || crypto.randomUUID();

    const fullRecord: ServiceCommitment = {
      id,
      client_id: commitment.client_id,
      package_id: commitment.package_id || null,
      deliverable_id: commitment.deliverable_id || null,
      service_name: commitment.service_name,
      deliverable_type: commitment.deliverable_type || "custom",
      quantity: commitment.quantity || 1,
      frequency: commitment.frequency || "monthly",
      schedule_rule: commitment.schedule_rule || {
        frequency: commitment.frequency || "monthly",
        quantity: commitment.quantity || 1,
      },
      start_date: commitment.start_date || format(new Date(), "yyyy-MM-dd"),
      end_date: commitment.end_date || null,
      preferred_time: commitment.preferred_time || null,
      duration_hours: commitment.duration_hours || null,
      assignee_id: commitment.assignee_id || null,
      assignment_rule: commitment.assignment_rule || "specialist_role",
      default_role: commitment.default_role || null,
      workflow_template_id: commitment.workflow_template_id || null,
      task_type: commitment.task_type || null,
      status: commitment.status || "active",
      paused_at: commitment.paused_at || null,
      reactivated_at: commitment.reactivated_at || null,
      notes: commitment.notes || null,
      created_at: commitment.created_at || nowIso,
      updated_at: nowIso,
    };

    // 1. Try upserting to service_commitments table
    try {
      await (supabase as any).from("service_commitments").upsert(fullRecord);
    } catch (_) {}

    // 2. Also mirror to business_rules fallback
    const ruleKey = `commitments_client_${commitment.client_id}`;
    const existing = await fetchClientCommitments(commitment.client_id);
    const updatedList = existing.some((c) => c.id === id)
      ? existing.map((c) => (c.id === id ? fullRecord : c))
      : [...existing, fullRecord];

    cachedCommitments[commitment.client_id] = updatedList;

    try {
      await (supabase as any).from("business_rules").upsert({
        key: ruleKey,
        name: `Service Commitments for Client ${commitment.client_id}`,
        category: "operations",
        value: updatedList,
        value_type: "json",
        is_active: true,
        updated_at: nowIso,
      });
    } catch (_) {}

    return { success: true, data: fullRecord };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save service commitment" };
  }
}

/**
 * Updates commitment lifecycle status (active, paused, inactive, completed).
 */
export async function updateCommitmentStatus(
  commitmentId: string,
  clientId: string,
  status: CommitmentLifecycleStatus,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await fetchClientCommitments(clientId);
    const target = existing.find((c) => c.id === commitmentId);
    if (!target) return { success: false, error: "Commitment not found" };

    const nowIso = new Date().toISOString();
    const updated: ServiceCommitment = {
      ...target,
      status,
      paused_at: status === "paused" ? nowIso : target.paused_at,
      reactivated_at: status === "active" && (target.status === "paused" || target.status === "inactive") ? nowIso : target.reactivated_at,
      updated_at: nowIso,
    };

    return saveServiceCommitment(updated, actorId);
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update commitment status" };
  }
}

/**
 * Deletes or deactivates a service commitment.
 * Historical records and existing tasks are permanently preserved!
 */
export async function deleteServiceCommitment(
  commitmentId: string,
  clientId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete from service_commitments table
    try {
      await (supabase as any).from("service_commitments").delete().eq("id", commitmentId);
    } catch (_) {}

    // 2. Remove from fallback list
    const existing = await fetchClientCommitments(clientId);
    const updatedList = existing.filter((c) => c.id !== commitmentId);
    cachedCommitments[clientId] = updatedList;

    const ruleKey = `commitments_client_${clientId}`;
    try {
      await (supabase as any).from("business_rules").upsert({
        key: ruleKey,
        name: `Service Commitments for Client ${clientId}`,
        category: "operations",
        value: updatedList,
        value_type: "json",
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    } catch (_) {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete service commitment" };
  }
}

// ============================================================
// OCCURRENCE SCHEDULING CALCULATION
// Daily, Weekly, and Monthly Semantics
// ============================================================

/**
 * Calculates occurrences for a commitment within a specified period (e.g., '2026-10' or date range).
 * Deterministic: identical inputs always yield identical occurrence dates.
 * Timezone safe: uses calendar noon dates to prevent day shifts across UTC/DST.
 */
export function calculateCommitmentOccurrences(
  commitment: ServiceCommitment,
  periodMonthOrStart: string | Date = format(new Date(), "yyyy-MM"),
  rangeEnd?: Date
): GeneratedOccurrence[] {
  // If commitment is inactive or completed, no new occurrences to generate
  const commitStatus = String(commitment.lifecycle_status || commitment.status || "active").toLowerCase();
  if (commitStatus === "inactive" || commitStatus === "completed") {
    return [];
  }

  let periodStart: Date;
  let periodEnd: Date;

  if (periodMonthOrStart instanceof Date) {
    periodStart = createSafeCalendarDate(
      periodMonthOrStart.getFullYear(),
      periodMonthOrStart.getMonth() + 1,
      periodMonthOrStart.getDate()
    );
    periodEnd = rangeEnd instanceof Date
      ? createSafeCalendarDate(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, rangeEnd.getDate())
      : endOfMonth(periodStart);
  } else if (typeof periodMonthOrStart === "string") {
    periodStart = parseSafeCalendarDate(periodMonthOrStart);
    periodEnd = rangeEnd instanceof Date
      ? createSafeCalendarDate(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, rangeEnd.getDate())
      : endOfMonth(periodStart);
  } else {
    periodStart = createSafeCalendarDate(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    periodEnd = endOfMonth(periodStart);
  }

  const commitmentStart = parseSafeCalendarDate(commitment.start_date || format(new Date(), "yyyy-MM-dd"));
  const commitmentEnd = commitment.end_date ? parseSafeCalendarDate(commitment.end_date) : null;

  // Filter interval days to only those within commitment lifecycle
  const allIntervalDays = eachDayOfInterval({ start: startOfDay(periodStart), end: endOfDay(periodEnd) }).filter((d) => {
    if (isBefore(endOfDay(d), startOfDay(commitmentStart))) return false;
    if (commitmentEnd && isAfter(startOfDay(d), endOfDay(commitmentEnd))) return false;
    return true;
  });

  if (allIntervalDays.length === 0) return [];

  const occurrences: GeneratedOccurrence[] = [];
  const rule = commitment.schedule_rule || {
    frequency: commitment.frequency,
    quantity: commitment.quantity,
  };
  const frequency = commitment.frequency;
  const quantity = rule.quantity ?? commitment.quantity ?? 1;

  // -------------------------------------------------------------
  // 1. WEEKLY SEMANTICS (e.g. Stories Shooting: 2 times/week)
  // -------------------------------------------------------------
  if (frequency === "weekly") {
    // Target days of week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    const daysOfWeek = rule.days_of_week && rule.days_of_week.length > 0
      ? rule.days_of_week
      : quantity === 1
      ? [2] // Tuesday
      : quantity === 2
      ? [2, 4] // Tuesday & Thursday
      : [1, 3, 5]; // Mon, Wed, Fri

    let seq = 1;
    for (const d of allIntervalDays) {
      // date-fns getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      const jsDay = getDay(d);
      const isoDay = jsDay === 0 ? 7 : jsDay;

      if (daysOfWeek.includes(isoDay)) {
        const dateStr = format(d, "yyyy-MM-dd");
        occurrences.push({
          commitment_id: commitment.id,
          client_id: commitment.client_id,
          target_date: dateStr,
          occurrence_date: dateStr,
          sequence_index: seq,
          total_in_period: quantity * 4, // approx 4 weeks per month
          title: `${commitment.service_name} #${seq}`,
          service_name: commitment.service_name,
          assignee_id: commitment.assignee_id,
          estimated_hours: commitment.duration_hours || 2.0,
          workflow_template_id: commitment.workflow_template_id,
          deliverable_id: commitment.deliverable_id || null,
          idempotency_key: `commit_${commitment.id}_${dateStr}_seq${seq}`,
        });
        seq++;
      }
    }
  }

  // -------------------------------------------------------------
  // 2. MONTHLY SEMANTICS
  // (e.g. Reels Shooting: 2 days/month; Posts: 8/month; Photo: 1/month)
  // -------------------------------------------------------------
  else if (frequency === "monthly" || frequency === "bi_weekly") {
    // If specific days of month provided (e.g. [5, 20])
    if (rule.days_of_month && rule.days_of_month.length > 0) {
      rule.days_of_month.forEach((targetDayNum, idx) => {
        let matchingDay = allIntervalDays.find((d) => getDate(d) === targetDayNum);
        // Clamping if target day is beyond end of month (e.g. day 31 in Feb 28/29, or 30-day month)
        if (!matchingDay && allIntervalDays.length > 0) {
          const validCandidates = allIntervalDays.filter((d) => getDate(d) <= targetDayNum);
          matchingDay = validCandidates.length > 0
            ? validCandidates[validCandidates.length - 1]
            : allIntervalDays[allIntervalDays.length - 1];
        }

        if (matchingDay) {
          const dateStr = format(matchingDay, "yyyy-MM-dd");
          const seq = idx + 1;
          occurrences.push({
            commitment_id: commitment.id,
            client_id: commitment.client_id,
            target_date: dateStr,
            occurrence_date: dateStr,
            sequence_index: seq,
            total_in_period: rule.days_of_month!.length,
            title: `${commitment.service_name} (${quantity > 1 ? `Day ${seq}/${rule.days_of_month!.length}` : `#1`})`,
            service_name: commitment.service_name,
            assignee_id: commitment.assignee_id,
            estimated_hours: commitment.duration_hours || 4.0,
            workflow_template_id: commitment.workflow_template_id,
            deliverable_id: commitment.deliverable_id || null,
            idempotency_key: `commit_${commitment.id}_${dateStr}_seq${seq}`,
          });
        }
      });
    }
    // Else evenly space quantity across the month
    else {
      for (let i = 1; i <= quantity; i++) {
        let dayIdx: number;
        if (quantity <= allIntervalDays.length) {
          // Symmetric deterministic spacing across the interval
          dayIdx = Math.min(
            allIntervalDays.length - 1,
            Math.floor(((i - 0.5) * allIntervalDays.length) / quantity)
          );
        } else {
          // If quantity > available days, distribute sequentially across available days
          dayIdx = Math.min(
            allIntervalDays.length - 1,
            Math.floor(((i - 1) * allIntervalDays.length) / quantity)
          );
        }

        const dayDate = allIntervalDays[dayIdx];
        if (dayDate) {
          const dateStr = format(dayDate, "yyyy-MM-dd");
          occurrences.push({
            commitment_id: commitment.id,
            client_id: commitment.client_id,
            target_date: dateStr,
            occurrence_date: dateStr,
            sequence_index: i,
            total_in_period: quantity,
            title: `${commitment.service_name} (#${i}/${quantity})`,
            service_name: commitment.service_name,
            assignee_id: commitment.assignee_id,
            estimated_hours: commitment.duration_hours || 1.5,
            workflow_template_id: commitment.workflow_template_id,
            deliverable_id: commitment.deliverable_id || null,
            idempotency_key: `commit_${commitment.id}_${dateStr}_seq${i}`,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. DAILY SEMANTICS (Business days or each day)
  // -------------------------------------------------------------
  else if (frequency === "daily") {
    let seq = 1;
    const intervalDays = rule.interval_days || 1;
    for (let idx = 0; idx < allIntervalDays.length; idx += intervalDays) {
      const d = allIntervalDays[idx];
      const dateStr = format(d, "yyyy-MM-dd");
      occurrences.push({
        commitment_id: commitment.id,
        client_id: commitment.client_id,
        target_date: dateStr,
        occurrence_date: dateStr,
        sequence_index: seq,
        total_in_period: allIntervalDays.length,
        title: `${commitment.service_name} (${format(d, "d MMM")})`,
        service_name: commitment.service_name,
        assignee_id: commitment.assignee_id,
        estimated_hours: commitment.duration_hours || 1.0,
        workflow_template_id: commitment.workflow_template_id,
        deliverable_id: commitment.deliverable_id || null,
        idempotency_key: `commit_${commitment.id}_${dateStr}_seq${seq}`,
      });
      seq++;
    }
  }

  return occurrences;
}

// ============================================================
// IDEMPOTENT TASK & WORKFLOW GENERATION ENGINE
// ============================================================

/**
 * Automatically and idempotently generates tasks and workflow instances
 * for a client or commitment.
 *
 * INVARIANTS:
 * 1. Idempotent: re-running NEVER creates duplicate tasks.
 * 2. Active client: future generation proceeds.
 * 3. Paused client: future generation suspended without deleting history.
 * 4. Inactive client: future generation stops while history remains permanently.
 * 5. Reactivation: safely resumes future generation without duplicates.
 */
export async function generateCommitmentTasks(params: {
  clientId?: string;
  commitmentId?: string;
  periodMonth?: string; // YYYY-MM (defaults to current month)
  actorId?: string;
  teamMembers?: TeamMemberRow[];
  profiles?: ProfileRow[];
  commitment?: ServiceCommitment;
  client?: { id: string; name: string; status: string };
  startDate?: Date;
  endDate?: Date;
  existingTasks?: TaskRow[];
  commitToDatabase?: boolean;
}): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: true,
    commitments_processed: 0,
    occurrences_evaluated: 0,
    tasks_created: 0,
    tasks_skipped_existing: 0,
    tasks_skipped_paused: 0,
    tasks_skipped_inactive: 0,
    created_task_ids: [],
    created_tasks: [],
  };

  try {
    const isMock = params.commitToDatabase === false;
    const clientId = params.clientId || params.commitment?.client_id || params.client?.id || "";
    const commitmentId = params.commitmentId || params.commitment?.id;
    const periodMonth = params.periodMonth || format(params.startDate || new Date(), "yyyy-MM");

    let clientStatus = "active";
    let clientName = "Client";

    if (isMock && params.client) {
      clientStatus = String(params.client.status || "").toLowerCase();
      clientName = params.client.name || "Client";
    } else if (clientId) {
      const { data: client, error: clientErr } = await (supabase as any)
        .from("clients")
        .select("id, name, status")
        .eq("id", clientId)
        .single();

      if (clientErr || !client) {
        return { ...result, success: false, error: "Client not found" };
      }
      clientStatus = String(client.status || "").toLowerCase();
      clientName = client.name || "Client";
    }

    // 1. Check Client Lifecycle Status
    // If client is paused, suspend future generation without deleting history!
    if (clientStatus === "paused") {
      result.tasks_skipped_paused++;
      return {
        ...result,
        success: true,
        error: "Client is currently Paused. Future deliverable generation is suspended without modifying existing records.",
      };
    }

    // If client is inactive or archived or churned, stop generation!
    if (clientStatus === "inactive" || clientStatus === "archived" || clientStatus === "churned") {
      result.tasks_skipped_inactive++;
      return {
        ...result,
        success: true,
        error: "Client is Inactive. Automated deliverable generation is halted while historical records remain intact.",
      };
    }

    // 2. Commitments list
    let commitments: ServiceCommitment[] = [];
    if (params.commitment) {
      commitments = [params.commitment];
    } else if (clientId) {
      commitments = await fetchClientCommitments(clientId);
      if (commitmentId) {
        commitments = commitments.filter((c) => c.id === commitmentId);
      }
    }

    // 3. Existing tasks for idempotency comparison
    let existingTaskList: TaskRow[] = [];
    if (Array.isArray(params.existingTasks)) {
      existingTaskList = params.existingTasks;
    } else if (clientId) {
      const { data: existingTasks } = await (supabase as any)
        .from("project_tasks")
        .select("id, commitment_id, deadline, scheduled_date, occurrence_date, sequence_index, title, idempotency_key")
        .eq("client_id", clientId);
      existingTaskList = Array.isArray(existingTasks) ? existingTasks : [];
    }

    // 4. Pre-load templates and project if not in-memory mock
    const allTemplates = isMock ? [] : await fetchWorkflowTemplates();

    let operationalProject: any = null;
    if (!isMock && clientId) {
      const { data: projects } = await (supabase as any)
        .from("client_projects")
        .select("id, title")
        .eq("client_id", clientId);
      operationalProject = projects?.[0] || null;
    }

    // 5. Evaluate and Process Each Commitment
    for (const commit of commitments) {
      result.commitments_processed++;

      // Commitment lifecycle checks:
      const cStatus = String(commit.lifecycle_status || commit.status || "active").toLowerCase();
      if (cStatus === "paused") {
        result.tasks_skipped_paused++;
        continue;
      }
      if (cStatus === "inactive" || cStatus === "completed") {
        result.tasks_skipped_inactive++;
        continue;
      }

      // Calculate candidate occurrences for this period
      const occurrences = calculateCommitmentOccurrences(
        commit,
        params.startDate || periodMonth,
        params.endDate
      );

      for (const occ of occurrences) {
        result.occurrences_evaluated++;

        // Lifecycle Invariant: Resumed/Reactivated commitments only generate for occurrences >= reactivated_at boundary!
        if (commit.reactivated_at) {
          const reactivateDate = commit.reactivated_at.substring(0, 10);
          if (occ.target_date < reactivateDate) {
            result.tasks_skipped_existing++;
            continue;
          }
        }

        // STRICT IDEMPOTENCY CHECK (Structured Database Fields Only — Never Parse Notes!):
        const isDuplicate = existingTaskList.some((t) => {
          // 1. Structured idempotency_key match
          if (t.idempotency_key && t.idempotency_key === occ.idempotency_key) {
            return true;
          }
          // 2. Structured commitment + date + sequence match
          const matchesCommitment = (t as any).commitment_id === commit.id;
          const taskDate = (t as any).occurrence_date || (t as any).scheduled_date || t.deadline;
          const matchesDate = taskDate === occ.target_date;
          const matchesSeq = (t as any).sequence_index ? (t as any).sequence_index === occ.sequence_index : true;

          return matchesCommitment && matchesDate && matchesSeq;
        });

        if (isDuplicate) {
          // IDEMPOTENT SAFETY: Skip duplicate creation
          result.tasks_skipped_existing++;
          continue;
        }

        // 6. Generate Parent Task Instance with Structured Identity
        const metadataTag = `[COMMITMENT:${commit.id}|DATE:${occ.target_date}|SEQ:${occ.sequence_index}]`;
        const fullNotes = commit.notes
          ? `${metadataTag}\n${commit.notes}`
          : `${metadataTag}\nScheduled recurring commitment deliverable.`;

        const taskPayload = {
          id: `task_${commit.id}_${occ.target_date}_seq${occ.sequence_index}`,
          client_id: clientId,
          project_id: operationalProject?.id || null,
          package_id: commit.package_id || null,
          commitment_id: commit.id,
          deliverable_id: commit.deliverable_id || occ.deliverable_id || null,
          occurrence_date: occ.target_date,
          sequence_index: occ.sequence_index,
          service: commit.service_name,
          category: commit.category || "deliverable",
          title: `${clientName} — ${occ.title}`,
          description: `Contractual delivery for ${commit.service_name}. Scheduled via commitment rule (${commit.frequency}, ${commit.quantity}x).`,
          status: "todo" as const,
          priority: "high" as const,
          deadline: occ.target_date,
          scheduled_date: occ.target_date,
          estimated_hours: occ.estimated_hours || 2.0,
          assignee_id: occ.assignee_id || null,
          idempotency_key: occ.idempotency_key,
          notes: fullNotes,
          delivery_period: periodMonth,
          source_type: "recurring_schedule" as const,
          is_reconciliation_managed: true,
          manual_override: false,
        };

        if (isMock) {
          result.tasks_created++;
          result.created_task_ids.push(taskPayload.id);
          result.created_tasks?.push(taskPayload as any);
          existingTaskList.push(taskPayload as any);
          continue;
        }

        // Atomic insert / upsert with ignoreDuplicates to guarantee concurrency safety in Postgres
        let createdTask: any = null;
        try {
          const { data, error: insertErr } = await (supabase as any)
            .from("project_tasks")
            .upsert(taskPayload, {
              onConflict: "idempotency_key",
              ignoreDuplicates: true,
            })
            .select()
            .maybeSingle();

          if (insertErr) {
            console.warn("Database upsert conflict or error:", insertErr.message);
          }
          createdTask = data;
        } catch (dbErr: any) {
          console.warn("Database error during task upsert:", dbErr?.message);
        }

        if (!createdTask) {
          // Row was skipped by ON CONFLICT DO NOTHING (already exists in DB)
          result.tasks_skipped_existing++;
          continue;
        }

        result.tasks_created++;
        result.created_task_ids.push(createdTask.id);
        result.created_tasks?.push(createdTask);

        // Add to existingTaskList so subsequent loop iterations don't recreate
        existingTaskList.push(createdTask);

        // 7. Workflow Stage Auto-Instantiation
        // If a workflow template is attached (or can be matched by task_type)
        let templateToInstantiate = commit.workflow_template_id
          ? allTemplates.find((t) => t.id === commit.workflow_template_id)
          : null;

        if (!templateToInstantiate && commit.task_type) {
          templateToInstantiate = allTemplates.find((t) => t.task_type === commit.task_type);
        }

        // Fallback matching for canonical presets (Reels -> Reel Template, Posts -> Design Template)
        if (!templateToInstantiate) {
          const dType = String(commit.deliverable_type || "").toLowerCase();
          if (dType.includes("reel")) {
            templateToInstantiate = allTemplates.find((t) => t.task_type === "reel");
          } else if (dType.includes("post") || dType.includes("photo")) {
            templateToInstantiate = allTemplates.find((t) => t.task_type === "design");
          }
        }

        if (templateToInstantiate && params.teamMembers && params.profiles) {
          await instantiateWorkflowStages({
            parentTask: isMock ? (taskPayload as any) : createdTask,
            template: templateToInstantiate,
            teamMembers: params.teamMembers,
            profiles: params.profiles,
            currentUserId: params.actorId,
            commitToDatabase: !isMock,
          });
        }
      }
    }

    return result;
  } catch (err: any) {
    return { ...result, success: false, error: err.message || "Failed to generate commitment tasks" };
  }
}
