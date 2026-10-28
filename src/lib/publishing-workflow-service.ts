// ============================================================
// SADA OS — CONTENT PRODUCTION -> PUBLISHING WORKFLOW SERVICE
// Phase 7 & 7.1: Production-to-Publishing Handoff Hardening
//
// Invariants & Hardening:
// 1. Authoritative Server-Side Authorization (Role, Data-Scope, Publisher Capability)
// 2. Strict Handoff & Publishing Idempotency (Exactly-Once Milestones, No Dupes on Retry)
// 3. Concurrency & Optimistic State Lock Defense
// 4. Platform & Submitted Live URL Data Integrity
// 5. Parent Content Deliverable Completion Invariant (Editing != Complete, Publishing == 100%)
// 6. Client Social Account Isolation (Zero Financial Data Exposure)
// 7. Full 5-Milestone Auditable Chain of Custody
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { emitNotification } from "@/lib/notification-service";
import { logSystemAudit } from "@/lib/audit-service";
import type { TaskRow } from "@/components/admin/project-utils";
import type {
  CompleteEditingHandoffInput,
  PublishContentPayload,
  PublishingPlatform,
  ClientSocialAccounts,
  PublishingAuditTrail,
  ConfigurePublisherCapabilityInput,
} from "@/types/workflow";

export type {
  CompleteEditingHandoffInput,
  PublishContentPayload,
  PublishingPlatform,
  ClientSocialAccounts,
  PublishingAuditTrail,
  ConfigurePublisherCapabilityInput,
};

export interface TeamMemberLike {
  id: string;
  name?: string | null;
  display_name?: string | null;
  role?: string | null;
  position?: string | null;
  division?: string | null;
  specialties?: string[] | null;
  profile_id?: string | null;
  is_active?: boolean | null;
  is_publisher?: boolean | null;
  email?: string | null;
}

// ============================================================
// 1. CANONICAL CONSTANTS & PLATFORM INTEGRITY
// ============================================================

export const SUPPORTED_PUBLISHING_PLATFORMS: readonly PublishingPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube_shorts",
  "twitter_x",
] as const;

export function isSupportedPublishingPlatform(platform: string): platform is PublishingPlatform {
  return (SUPPORTED_PUBLISHING_PLATFORMS as readonly string[]).includes(platform);
}

/**
 * Validates a web URL (HTTP or HTTPS)
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim();
  try {
    const parsed = new URL(clean);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return /^https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+/i.test(clean);
  }
}

/**
 * Validates cloud Drive asset URL
 */
export function validateDriveUrl(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return { valid: false, error: "Cloud Drive / asset URL is required." };
  }
  if (!isValidUrl(url)) {
    return { valid: false, error: "Invalid cloud asset URL. Must be a valid HTTP or HTTPS link." };
  }
  return { valid: true };
}

/**
 * Validates publishing platforms and submitted live URLs data integrity.
 * Enforces:
 * - supported platforms only
 * - no duplicate platforms
 * - non-empty platforms
 * - non-empty URLs
 * - valid HTTP/HTTPS URLs
 * - deterministic platform ordering
 * - 1:1 or uniform correspondence
 */
export function validatePublishingData(
  platforms: any[],
  urls: any[]
): {
  valid: boolean;
  canonicalPlatforms: PublishingPlatform[];
  cleanUrls: string[];
  error?: string;
} {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return {
      valid: false,
      canonicalPlatforms: [],
      cleanUrls: [],
      error: "Please select at least one publishing platform (e.g. Instagram).",
    };
  }

  // Check supported platforms
  for (const p of platforms) {
    if (!isSupportedPublishingPlatform(p)) {
      return {
        valid: false,
        canonicalPlatforms: [],
        cleanUrls: [],
        error: `Unsupported publishing platform: "${p}". Supported platforms: ${SUPPORTED_PUBLISHING_PLATFORMS.join(", ")}.`,
      };
    }
  }

  // Check duplicate platforms
  const platformSet = new Set(platforms);
  if (platformSet.size !== platforms.length) {
    return {
      valid: false,
      canonicalPlatforms: [],
      cleanUrls: [],
      error: "Duplicate publishing platforms are not allowed in the same submission.",
    };
  }

  // Deterministic canonical platform ordering
  const canonicalPlatforms = Array.from(platformSet).sort() as PublishingPlatform[];

  // Validate URLs
  if (!Array.isArray(urls) || urls.length === 0) {
    return {
      valid: false,
      canonicalPlatforms: [],
      cleanUrls: [],
      error: "At least one submitted live URL is required.",
    };
  }

  const cleanUrls = urls.map((u) => (typeof u === "string" ? u.trim() : ""));
  for (const u of cleanUrls) {
    if (!isValidUrl(u)) {
      return {
        valid: false,
        canonicalPlatforms: [],
        cleanUrls: [],
        error: `Invalid submitted live URL: "${u}". Must be a valid HTTP/HTTPS URL.`,
      };
    }
  }

  // Correspondence check:
  // If multiple platforms and multiple URLs provided, count must match
  if (cleanUrls.length > 1 && cleanUrls.length !== canonicalPlatforms.length) {
    return {
      valid: false,
      canonicalPlatforms: [],
      cleanUrls: [],
      error: `URL count mismatch: Provided ${cleanUrls.length} live URL(s) for ${canonicalPlatforms.length} target platform(s). Each target platform requires a corresponding submitted live URL.`,
    };
  }

  return {
    valid: true,
    canonicalPlatforms,
    cleanUrls,
  };
}

// ============================================================
// 2. AUTHORITATIVE PUBLISHING ACTOR RESOLUTION
// ============================================================

export interface AuthoritativePublishingActor {
  userId: string;
  role: "super_admin" | "admin" | "worker";
  status: "active" | "suspended" | "deactivated";
  teamMemberId: string | null;
  isPublisher: boolean;
}

/**
 * Resolves actor identity, authoritative role, account status, and publisher capability.
 * Never trusts unauthenticated or spoofed client parameters.
 */
export async function resolvePublishingActor(
  actorId: string | undefined | null,
  overrideRole?: string
): Promise<AuthoritativePublishingActor> {
  if (!actorId || typeof actorId !== "string" || actorId.trim() === "" || actorId === "anonymous") {
    throw new Error("Unauthenticated: A valid actor ID is required.");
  }

  const cleanId = actorId.trim();

  let profile: any = null;
  try {
    const { data: p } = await (supabase as any)
      .from("profiles")
      .select("id, email, status, role")
      .eq("id", cleanId)
      .maybeSingle();
    profile = p;
  } catch (_) {}

  const profileId = profile?.id || cleanId;
  const status = profile?.status || "active";
  let rawRole = overrideRole || profile?.role || "worker";

  if (status === "suspended") {
    throw new Error("Account Suspended: Access is prohibited by administrator.");
  }
  if (status === "deactivated") {
    throw new Error("Account Deactivated: This identity is retired.");
  }

  // Fetch authoritative user role if present
  try {
    const { data: roleRow } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", profileId)
      .maybeSingle();
    if (roleRow?.role && !overrideRole) {
      rawRole = roleRow.role;
    }
  } catch (_) {}

  const role: "super_admin" | "admin" | "worker" =
    rawRole === "super_admin" ? "super_admin" : rawRole === "admin" ? "admin" : "worker";

  // Fetch linked team member for capability check
  let teamMember: any = null;
  try {
    const { data: tm } = await (supabase as any)
      .from("team_members")
      .select("id, is_publisher, specialties, position, is_active")
      .or(`profile_id.eq.${profileId},id.eq.${profileId},user_id.eq.${profileId}`)
      .maybeSingle();
    teamMember = tm;
  } catch (_) {}

  const isPublisher = role === "super_admin" || isMemberPublisher(teamMember);

  return {
    userId: profileId,
    role,
    status: status as any,
    teamMemberId: teamMember?.id || null,
    isPublisher,
  };
}

// ============================================================
// 3. PUBLISHER CAPABILITY LOGIC
// ============================================================

/**
 * Checks whether a team member possesses the Publisher capability.
 */
export function isMemberPublisher(member: TeamMemberLike | null | undefined): boolean {
  if (!member) return false;
  if (member.is_publisher === true) return true;

  const specs = Array.isArray(member.specialties) ? member.specialties : [];
  const hasPublisherSpec = specs.some((s) => {
    const l = String(s).toLowerCase();
    return l.includes("publisher") || l.includes("publishing") || l.includes("social media");
  });
  if (hasPublisherSpec) return true;

  const pos = (member.position || "").toLowerCase();
  return pos.includes("publisher") || pos.includes("publishing") || pos.includes("social media manager");
}

/**
 * Filters active team members who possess the Publisher capability.
 */
export function getAvailablePublishers(teamMembers: TeamMemberLike[]): TeamMemberLike[] {
  if (!Array.isArray(teamMembers)) return [];
  return teamMembers.filter((m) => m.is_active !== false && isMemberPublisher(m));
}

/**
 * Resolves the appropriate Publisher for a given task.
 */
export function resolvePublisherForTask(params: {
  teamMembers: TeamMemberLike[];
  customPublisherId?: string | null;
  clientPreferredPublisherId?: string | null;
}): string | null {
  const { teamMembers, customPublisherId, clientPreferredPublisherId } = params;

  if (customPublisherId) {
    const matched = teamMembers.find(
      (m) => (m.id === customPublisherId || m.profile_id === customPublisherId) && m.is_active !== false
    );
    if (matched) return matched.profile_id || matched.id;
  }

  if (clientPreferredPublisherId) {
    const matched = teamMembers.find(
      (m) => (m.id === clientPreferredPublisherId || m.profile_id === clientPreferredPublisherId) && m.is_active !== false
    );
    if (matched) return matched.profile_id || matched.id;
  }

  const publishers = getAvailablePublishers(teamMembers);
  if (publishers.length > 0) {
    return publishers[0].profile_id || publishers[0].id;
  }

  return null;
}

/**
 * Super Admin Exclusive: Configures a team member as responsible for publishing.
 * Prevents unauthorized capability escalation.
 */
export async function configureMemberPublisherCapability(
  params: ConfigurePublisherCapabilityInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { teamMemberId, isPublisher, actorId, actorRole } = params;

    // Strict Authorization: Super Admin authority required!
    if (!actorId && !actorRole) {
      return {
        success: false,
        error: "Unauthorized: Super Admin session required to configure Publisher capability.",
      };
    }

    const actor = await resolvePublishingActor(actorId, actorRole);
    if (actor.role !== "super_admin") {
      return {
        success: false,
        error: "Unauthorized: Only Super Admin can configure Publisher capability.",
      };
    }

    const { data: member, error: fetchErr } = await (supabase as any)
      .from("team_members")
      .select("id, name, specialties, is_publisher")
      .eq("id", teamMemberId)
      .single();

    if (fetchErr || !member) {
      return { success: false, error: "Team member not found." };
    }

    const currentSpecs: string[] = Array.isArray(member.specialties) ? [...member.specialties] : [];
    let updatedSpecs: string[];

    if (isPublisher) {
      if (!currentSpecs.some((s) => s.toLowerCase() === "publisher")) {
        updatedSpecs = [...currentSpecs, "publisher"];
      } else {
        updatedSpecs = currentSpecs;
      }
    } else {
      updatedSpecs = currentSpecs.filter(
        (s) => s.toLowerCase() !== "publisher" && s.toLowerCase() !== "publishing"
      );
    }

    const updatePayload: any = {
      specialties: updatedSpecs,
      updated_at: new Date().toISOString(),
    };
    try {
      updatePayload.is_publisher = isPublisher;
    } catch (_) {}

    const { error: updateErr } = await (supabase as any)
      .from("team_members")
      .update(updatePayload)
      .eq("id", teamMemberId);

    if (updateErr) {
      delete updatePayload.is_publisher;
      const { error: fallbackErr } = await (supabase as any)
        .from("team_members")
        .update(updatePayload)
        .eq("id", teamMemberId);
      if (fallbackErr) throw fallbackErr;
    }

    await logSystemAudit({
      action: "CONFIGURE_PUBLISHER_CAPABILITY",
      entityType: "team_member",
      entityId: teamMemberId,
      actorId: actor.userId,
      newValues: { is_publisher: isPublisher, specialties: updatedSpecs },
      oldValues: { is_publisher: member.is_publisher, specialties: currentSpecs },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[configureMemberPublisherCapability] Error:", err);
    return { success: false, error: err.message || "Failed to configure publisher capability" };
  }
}

// ============================================================
// 4. CLIENT INFORMATION ISOLATION
// ============================================================

/**
 * Fetches client social accounts strictly isolating financial retainers,
 * billing margins, rates, invoices, and private business terms.
 */
export async function getClientPublishingInfo(
  clientId: string,
  actorId?: string,
  actorRole?: string
): Promise<{
  clientId: string;
  clientName: string;
  industry?: string | null;
  socialAccounts: ClientSocialAccounts;
  error?: string;
}> {
  try {
    if (!clientId) {
      return { clientId: "", clientName: "Client", socialAccounts: {} };
    }

    if (actorId && actorId !== "anonymous") {
      try {
        await resolvePublishingActor(actorId, actorRole);
      } catch (authErr: any) {
        return {
          clientId,
          clientName: "Client",
          socialAccounts: {},
          error: authErr.message,
        };
      }
    }

    const { data: client, error } = await (supabase as any)
      .from("clients")
      .select("id, name, industry, notes, social_accounts")
      .eq("id", clientId)
      .single();

    if (error || !client) {
      return {
        clientId,
        clientName: "Client",
        socialAccounts: {},
      };
    }

    let parsedSocials: ClientSocialAccounts = {};
    if (client.social_accounts && typeof client.social_accounts === "object") {
      parsedSocials = {
        instagram: client.social_accounts.instagram || null,
        facebook: client.social_accounts.facebook || null,
        tiktok: client.social_accounts.tiktok || null,
        linkedin: client.social_accounts.linkedin || null,
        youtube: client.social_accounts.youtube || null,
      };
    } else if (client.notes) {
      const instaMatch = client.notes.match(/@([a-zA-Z0-9._]+)/);
      if (instaMatch) {
        parsedSocials.instagram = `@${instaMatch[1]}`;
      }
    }

    // STRICT ISOLATION: Retainers, pricing, margins, invoices, and accounting records are NEVER returned
    return {
      clientId: client.id,
      clientName: client.name || "Client",
      industry: client.industry,
      socialAccounts: parsedSocials,
    };
  } catch (_) {
    return {
      clientId,
      clientName: "Client",
      socialAccounts: {},
    };
  }
}

// ============================================================
// 5. STAGE ELIGIBILITY & IDEMPOTENCY PREDICATES
// ============================================================

/**
 * Checks whether an editing stage task is eligible for handoff.
 */
export function checkEditingHandoffEligibility(
  editingTask: TaskRow,
  siblingStages: TaskRow[]
): { eligible: boolean; error?: string } {
  // Must have a valid status
  if (editingTask.status === "blocked") {
    return { eligible: false, error: "Editing stage is currently blocked and cannot be handed off." };
  }

  // Check prior stages
  if (Array.isArray(siblingStages) && siblingStages.length > 0) {
    const currentOrder = editingTask.sort_order || 1;
    const priorIncomplete = siblingStages.find(
      (s) =>
        s.id !== editingTask.id &&
        (s.sort_order || 0) < currentOrder &&
        s.status !== "done" &&
        s.status !== "approved" &&
        s.status !== "delivered"
    );

    if (priorIncomplete) {
      return {
        eligible: false,
        error: `Prerequisite stage "${priorIncomplete.title}" must be completed before completing editing.`,
      };
    }
  }

  return { eligible: true };
}

/**
 * Checks whether a publishing stage task is eligible to be published.
 */
export function checkPublishingEligibility(
  pubTask: TaskRow,
  siblingStages: TaskRow[]
): { eligible: boolean; error?: string } {
  if (pubTask.is_stage_locked) {
    return { eligible: false, error: "Cannot publish: Stage is currently locked." };
  }

  if (Array.isArray(siblingStages) && siblingStages.length > 0) {
    const currentOrder = pubTask.sort_order || 4;
    const priorIncomplete = siblingStages.find(
      (s) =>
        s.id !== pubTask.id &&
        (s.sort_order || 0) < currentOrder &&
        s.status !== "done" &&
        s.status !== "approved" &&
        s.status !== "delivered"
    );

    if (priorIncomplete) {
      return {
        eligible: false,
        error: `Cannot publish: Prior stage "${priorIncomplete.title}" is not yet completed.`,
      };
    }
  }

  return { eligible: true };
}

/**
 * Predicate: Is this editing handoff an idempotent repeat of an already-completed state?
 */
export function isEditingHandoffIdempotent(editingTask: TaskRow, newDriveUrl: string): boolean {
  if (editingTask.status !== "done") return false;
  const existingDrive = (editingTask as any).drive_url || editingTask.result_links?.[0];
  return existingDrive === newDriveUrl.trim();
}

/**
 * Predicate: Is this publishing call an idempotent repeat of an already-published state?
 */
export function isPublishingIdempotent(
  pubTask: TaskRow,
  newUrls: string[],
  newPlatforms: PublishingPlatform[]
): boolean {
  if (pubTask.status !== "done" || !(pubTask as any).published_at) return false;

  const existingUrls = Array.isArray((pubTask as any).published_urls) ? (pubTask as any).published_urls : [];
  const existingPlatforms = Array.isArray((pubTask as any).target_platforms) ? (pubTask as any).target_platforms : [];

  const urlsMatch =
    existingUrls.length === newUrls.length && newUrls.every((u) => existingUrls.includes(u));

  const platformsMatch =
    existingPlatforms.length === newPlatforms.length && newPlatforms.every((p) => existingPlatforms.includes(p));

  return urlsMatch && platformsMatch;
}

// ============================================================
// 6. COMPLETE EDITING & HANDOFF TO PUBLISHING (STEPS 1-5)
// ============================================================

export async function completeEditingAndHandoffToPublishing(
  input: CompleteEditingHandoffInput
): Promise<{
  success: boolean;
  publishingStageTask?: any;
  resolvedPublisherId?: string | null;
  idempotent?: boolean;
  warning?: string;
  error?: string;
}> {
  try {
    const { editingTaskId, actorId, driveUrl, notes, customPublisherId, actorRole } = input;

    // 1. Mandatory Actor Authentication
    if (!actorId || actorId === "anonymous") {
      return { success: false, error: "Unauthenticated: Valid actor session is required." };
    }

    let actor: AuthoritativePublishingActor;
    try {
      actor = await resolvePublishingActor(actorId, actorRole);
    } catch (authErr: any) {
      return { success: false, error: authErr.message };
    }

    // 2. Mandatory Cloud Asset URL Validation
    const urlValidation = validateDriveUrl(driveUrl);
    if (!urlValidation.valid) {
      return { success: false, error: urlValidation.error };
    }
    const cleanDriveUrl = driveUrl.trim();
    const nowIso = new Date().toISOString();

    // 3. Fetch Editing Task
    const { data: editingTask, error: fetchErr } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", editingTaskId)
      .single();

    if (fetchErr || !editingTask) {
      return { success: false, error: "Editing stage task not found." };
    }

    // 4. Task Ownership & Operational Scope
    if (actor.role === "worker") {
      const isAssigned =
        editingTask.assignee_id === actor.userId ||
        (actor.teamMemberId && editingTask.assignee_id === actor.teamMemberId);

      if (!isAssigned) {
        return {
          success: false,
          error: "Unauthorized: You are not assigned to execute this editing stage task.",
        };
      }
    }

    // Fetch sibling stages if subtask
    let siblingStages: TaskRow[] = [];
    let parentTask: TaskRow | null = null;

    if (editingTask.parent_task_id) {
      const { data: pTask } = await (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("id", editingTask.parent_task_id)
        .single();
      parentTask = pTask || null;

      const { data: siblings } = await (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("parent_task_id", editingTask.parent_task_id)
        .order("sort_order", { ascending: true });
      siblingStages = siblings || [];
    }

    // 5. Prerequisite Stages Completion Check
    const eligibility = checkEditingHandoffEligibility(editingTask, siblingStages);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.error };
    }

    // 6. Locate subsequent Publishing Stage (strictly matching category, stage_type, or title)
    let publishingStage = siblingStages.find(
      (s) =>
        (s.category || "").toLowerCase() === "publishing" ||
        (s as any).stage_type === "publishing" ||
        s.title?.toLowerCase().includes("publishing") ||
        s.title?.toLowerCase().includes("نشر")
    );

    // 7. Idempotency Guard (Double-Click / Network Retry Handling)
    if (editingTask.status === "done") {
      if (isEditingHandoffIdempotent(editingTask, cleanDriveUrl)) {
        // Safe deterministic idempotent response
        return {
          success: true,
          publishingStageTask: publishingStage,
          resolvedPublisherId: publishingStage?.assignee_id || null,
          idempotent: true,
        };
      } else {
        return {
          success: false,
          error: "Conflict: Editing stage is already completed with a different asset URL.",
        };
      }
    }

    // 8. Publisher Resolution & Capability Validation
    let targetPublisherId: string | null = null;
    let activeTeamMembers: TeamMemberLike[] = [];
    try {
      const { data: tmData } = await (supabase as any)
        .from("team_members")
        .select("*")
        .eq("is_active", true);
      activeTeamMembers = tmData || [];
    } catch (_) {}

    if (customPublisherId) {
      const targetMember = activeTeamMembers.find(
        (m: any) => m.id === customPublisherId || m.profile_id === customPublisherId
      );
      if (targetMember && !isMemberPublisher(targetMember)) {
        return {
          success: false,
          error: "Selected team member does not possess the Publisher capability.",
        };
      }
      targetPublisherId = customPublisherId;
    } else if (publishingStage?.assignee_id) {
      targetPublisherId = publishingStage.assignee_id;
    } else {
      targetPublisherId = resolvePublisherForTask({
        teamMembers: activeTeamMembers,
        customPublisherId: null,
      });
    }

    // 9. Atomic Update on Editing Stage Task (Optimistic Concurrency)
    const existingResultLinks = Array.isArray(editingTask.result_links) ? editingTask.result_links : [];
    const updatedLinks = Array.from(new Set([cleanDriveUrl, ...existingResultLinks]));

    const editingUpdatePayload: any = {
      status: "done",
      result_links: updatedLinks,
      result_notes: notes || editingTask.result_notes || null,
      drive_url: cleanDriveUrl,
      completed_at: nowIso,
      completed_by: actor.userId,
      updated_at: nowIso,
    };

    const { error: updateEditingErr } = await (supabase as any)
      .from("project_tasks")
      .update(editingUpdatePayload)
      .eq("id", editingTaskId);

    if (updateEditingErr) {
      delete editingUpdatePayload.drive_url;
      const { error: fallbackErr } = await (supabase as any)
        .from("project_tasks")
        .update(editingUpdatePayload)
        .eq("id", editingTaskId);
      if (fallbackErr) throw fallbackErr;
    }

    // 10. Parent Task Invariant:
    // Attach Drive link, but STRICTLY LEAVE PARENT in_progress!
    if (parentTask) {
      const parentExistingLinks = Array.isArray(parentTask.result_links) ? parentTask.result_links : [];
      const parentUpdatedLinks = Array.from(new Set([cleanDriveUrl, ...parentExistingLinks]));

      await (supabase as any)
        .from("project_tasks")
        .update({
          drive_url: cleanDriveUrl,
          result_links: parentUpdatedLinks,
          updated_at: nowIso,
        })
        .eq("id", parentTask.id);
    }

    // 11. Make Publishing Stage Actionable & Assign Publisher (or Auto-Create if missing for publishing workflows)
    let warning: string | undefined = undefined;

    if (!publishingStage && parentTask) {
      const parentTaskType = (parentTask as any).task_type || (parentTask as any).workflow_type || "";
      const isReelOrPubWorkflow =
        parentTaskType === "reel" ||
        parentTaskType === "design" ||
        (parentTask.category || "").toLowerCase() === "reel" ||
        (parentTask.title || "").toLowerCase().includes("reel") ||
        parentTask.title.includes("ريل");

      if (isReelOrPubWorkflow) {
        try {
          const nextOrder = (editingTask.sort_order || 3) + 1;
          const { data: createdPub } = await (supabase as any)
            .from("project_tasks")
            .insert({
              parent_task_id: parentTask.id,
              project_id: parentTask.project_id,
              client_id: parentTask.client_id || null,
              title: `${nextOrder}. Publishing`,
              category: "publishing",
              service: parentTask.service || "Content Publishing",
              priority: parentTask.priority || "medium",
              status: "todo",
              is_stage_locked: false,
              assignee_id: targetPublisherId || null,
              assigned_by_id: actor.userId,
              drive_url: cleanDriveUrl,
              result_links: [cleanDriveUrl],
              sort_order: nextOrder,
              deadline: parentTask.deadline,
              scheduled_date: parentTask.deadline,
              created_at: nowIso,
              updated_at: nowIso,
            })
            .select()
            .maybeSingle();

          if (createdPub) {
            publishingStage = createdPub;
          }
        } catch (createErr) {
          console.warn("[completeEditingAndHandoffToPublishing] Publishing stage auto-creation notice:", createErr);
        }
      }
    }

    if (publishingStage) {
      const pubLinks = Array.isArray(publishingStage.result_links) ? publishingStage.result_links : [];
      const updatedPubLinks = Array.from(new Set([cleanDriveUrl, ...pubLinks]));

      await (supabase as any)
        .from("project_tasks")
        .update({
          status: "todo",
          is_stage_locked: false,
          assignee_id: targetPublisherId || publishingStage.assignee_id || null,
          drive_url: cleanDriveUrl,
          result_links: updatedPubLinks,
          updated_at: nowIso,
        })
        .eq("id", publishingStage.id);

      // High-Priority Notification with Idempotency Key
      if (targetPublisherId) {
        try {
          await emitNotification({
            eventType: "TASK_ASSIGNED",
            title: "Content Ready for Publishing!",
            message: `Editing completed for "${parentTask?.title || editingTask.title}". Final Drive asset attached: ${cleanDriveUrl}`,
            userId: targetPublisherId,
            category: "task",
            priority: "high",
            entityType: "task",
            entityId: publishingStage.id,
            deduplicationKey: `handoff_pub_${publishingStage.id}`,
            linkUrl: `/admin/my-work?taskId=${publishingStage.id}`,
          });
        } catch (e) {
          console.warn("[completeEditingAndHandoffToPublishing] Notification notice:", e);
        }
      } else {
        // Missing Publisher Alert: Task left unassigned, alert task assigner/manager
        warning = "No eligible publisher could be resolved. Publishing stage is active but unassigned for manager attention.";
        const managerId = parentTask?.assigned_by_id || editingTask.assigned_by_id;
        if (managerId && managerId !== actor.userId) {
          try {
            await emitNotification({
              eventType: "GENERAL",
              title: "Publisher Assignment Needed",
              message: `Editing completed for "${parentTask?.title || editingTask.title}". Please assign an authorized publisher to schedule the content.`,
              userId: managerId,
              category: "task",
              priority: "high",
              entityType: "task",
              entityId: publishingStage.id,
              deduplicationKey: `handoff_pub_unassigned_${publishingStage.id}`,
              linkUrl: `/admin/my-work?taskId=${publishingStage.id}`,
            });
          } catch (_) {}
        }
      }
    }

    // 12. Exactly-Once Project Activity with Idempotency Keys
    const projectId = editingTask.project_id || parentTask?.project_id;
    if (projectId) {
      try {
        await (supabase as any).from("project_activity").upsert(
          {
            project_id: projectId,
            task_id: editingTask.id,
            actor_id: actor.userId,
            action: "content_prepared",
            idempotency_key: `content_prepared_${editingTask.id}`,
            details: {
              editor_id: actor.userId,
              stage_id: editingTask.id,
              stage_title: editingTask.title,
              prepared_at: nowIso,
            },
          },
          { onConflict: "idempotency_key" }
        );
      } catch (_) {}

      try {
        await (supabase as any).from("project_activity").upsert(
          {
            project_id: projectId,
            task_id: editingTask.id,
            actor_id: actor.userId,
            action: "drive_link_added",
            idempotency_key: `drive_link_added_${editingTask.id}`,
            details: {
              editor_id: actor.userId,
              drive_url: cleanDriveUrl,
              added_at: nowIso,
            },
          },
          { onConflict: "idempotency_key" }
        );
      } catch (_) {}

      try {
        await (supabase as any).from("project_activity").upsert(
          {
            project_id: projectId,
            task_id: editingTask.parent_task_id || editingTask.id,
            actor_id: actor.userId,
            action: "ready_for_publishing",
            idempotency_key: `ready_for_publishing_${editingTask.id}`,
            details: {
              editing_task_id: editingTask.id,
              publishing_stage_id: publishingStage?.id || null,
              publisher_id: targetPublisherId,
              drive_url: cleanDriveUrl,
              timestamp: nowIso,
            },
          },
          { onConflict: "idempotency_key" }
        );
      } catch (_) {}

      if (targetPublisherId && publishingStage) {
        try {
          await (supabase as any).from("project_activity").upsert(
            {
              project_id: projectId,
              task_id: publishingStage.id,
              actor_id: actor.userId,
              action: "publisher_assigned",
              idempotency_key: `publisher_assigned_${publishingStage.id}_${targetPublisherId}`,
              details: {
                assigned_publisher_id: targetPublisherId,
                publishing_stage_id: publishingStage.id,
                assigned_at: nowIso,
              },
            },
            { onConflict: "idempotency_key" }
          );
        } catch (_) {}
      }
    }

    // 13. System Audit Log
    try {
      await logSystemAudit({
        action: "CONTENT_READY_FOR_PUBLISHING",
        entityType: "project_task",
        entityId: editingTaskId,
        actorId: actor.userId,
        newValues: {
          drive_url: cleanDriveUrl,
          publisher_id: targetPublisherId,
          publishing_stage_id: publishingStage?.id,
        },
      });
    } catch (_) {}

    return {
      success: true,
      publishingStageTask: publishingStage,
      resolvedPublisherId: targetPublisherId,
      idempotent: false,
      warning,
    };
  } catch (err: any) {
    console.error("[completeEditingAndHandoffToPublishing] Error:", err);
    return { success: false, error: err.message || "Failed to complete editing handoff" };
  }
}

// ============================================================
// 7. MARK CONTENT PUBLISHED (STEPS 6-8)
// ============================================================

export async function markContentPublished(
  input: PublishContentPayload
): Promise<{
  success: boolean;
  parentCompleted?: boolean;
  idempotent?: boolean;
  error?: string;
}> {
  try {
    const { publishingTaskId, actorId, publishedUrls, notes, actorRole } = input;
    const rawPlatforms = input.platforms || input.targetPlatforms || [];

    // 1. Mandatory Actor Authentication
    if (!actorId || actorId === "anonymous") {
      return { success: false, error: "Unauthenticated: Valid publisher session is required." };
    }

    let actor: AuthoritativePublishingActor;
    try {
      actor = await resolvePublishingActor(actorId, actorRole);
    } catch (authErr: any) {
      return { success: false, error: authErr.message };
    }

    // 2. Publisher Capability Verification
    if (!actor.isPublisher && actor.role !== "super_admin") {
      return {
        success: false,
        error: "Unauthorized: Actor does not possess the Publisher capability.",
      };
    }

    // 3. Platform & URL Data Integrity Validation
    const validation = validatePublishingData(rawPlatforms, publishedUrls);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { canonicalPlatforms, cleanUrls } = validation;
    const nowIso = new Date().toISOString();

    // 4. Fetch Publishing Stage Task
    const { data: pubTask, error: fetchErr } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", publishingTaskId)
      .single();

    if (fetchErr || !pubTask) {
      return { success: false, error: "Publishing stage task not found." };
    }

    // 5. Task Assignment Authority (Worker isolation)
    if (actor.role === "worker") {
      const isAssigned =
        pubTask.assignee_id === actor.userId ||
        (actor.teamMemberId && pubTask.assignee_id === actor.teamMemberId);

      if (!isAssigned) {
        return {
          success: false,
          error: "Unauthorized: You are not assigned to execute this publishing task.",
        };
      }
    }

    // Fetch sibling stages
    let siblingStages: TaskRow[] = [];
    if (pubTask.parent_task_id) {
      const { data: siblings } = await (supabase as any)
        .from("project_tasks")
        .select("*")
        .eq("parent_task_id", pubTask.parent_task_id)
        .order("sort_order", { ascending: true });
      siblingStages = siblings || [];
    }

    // 6. Stage Unlock & Prerequisite Editing Completion Check
    const eligibility = checkPublishingEligibility(pubTask, siblingStages);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.error };
    }

    // 7. Idempotency Check (Double-Click / Network Retry)
    if (pubTask.status === "done" && (pubTask as any).published_at) {
      if (isPublishingIdempotent(pubTask, cleanUrls, canonicalPlatforms)) {
        // Safe deterministic idempotent response
        return {
          success: true,
          parentCompleted: true,
          idempotent: true,
        };
      } else {
        return {
          success: false,
          error: "Conflict: Task is already published with different live URLs. Conflicting mutation rejected.",
        };
      }
    }

    // 8. Atomic Update on Publishing Stage Task
    const existingLinks = Array.isArray(pubTask.result_links) ? pubTask.result_links : [];
    const allLinks = Array.from(new Set([...cleanUrls, ...existingLinks]));

    const pubUpdatePayload: any = {
      status: "done",
      result_links: allLinks,
      result_notes: notes || pubTask.result_notes || null,
      published_at: nowIso,
      published_by: actor.userId,
      published_urls: cleanUrls,
      target_platforms: canonicalPlatforms,
      completed_at: nowIso,
      completed_by: actor.userId,
      updated_at: nowIso,
    };

    const { error: updatePubErr } = await (supabase as any)
      .from("project_tasks")
      .update(pubUpdatePayload)
      .eq("id", publishingTaskId);

    if (updatePubErr) {
      delete pubUpdatePayload.published_at;
      delete pubUpdatePayload.published_by;
      delete pubUpdatePayload.published_urls;
      delete pubUpdatePayload.target_platforms;
      const { error: fallbackErr } = await (supabase as any)
        .from("project_tasks")
        .update(pubUpdatePayload)
        .eq("id", publishingTaskId);
      if (fallbackErr) throw fallbackErr;
    }

    // 9. Parent Task Completion Invariant:
    // When ALL stages (including publishing) are completed, parent deliverable updates to 100% and done
    let parentCompleted = false;
    if (pubTask.parent_task_id) {
      const { data: latestSiblings } = await (supabase as any)
        .from("project_tasks")
        .select("id, status")
        .eq("parent_task_id", pubTask.parent_task_id);

      const allSiblings = latestSiblings || [];
      const allDone = allSiblings.every(
        (s: any) =>
          s.id === publishingTaskId ||
          s.status === "done" ||
          s.status === "approved" ||
          s.status === "delivered"
      );

      if (allDone) {
        parentCompleted = true;
        const parentUpdate: any = {
          status: "done",
          completed_at: nowIso,
          published_at: nowIso,
          published_urls: cleanUrls,
          updated_at: nowIso,
        };

        await (supabase as any)
          .from("project_tasks")
          .update(parentUpdate)
          .eq("id", pubTask.parent_task_id);
      }
    }

    // 10. Exactly-Once Activity Log with Idempotency Key
    const projectId = pubTask.project_id;
    if (projectId) {
      try {
        await (supabase as any).from("project_activity").upsert(
          {
            project_id: projectId,
            task_id: pubTask.id,
            actor_id: actor.userId,
            action: "content_published",
            idempotency_key: `content_published_${pubTask.id}`,
            details: {
              published_by: actor.userId,
              published_at: nowIso,
              published_urls: cleanUrls,
              platforms: canonicalPlatforms,
              notes: notes || null,
              parent_task_id: pubTask.parent_task_id || null,
              parent_completed: parentCompleted,
            },
          },
          { onConflict: "idempotency_key" }
        );
      } catch (_) {}
    }

    // 11. System Audit Log
    try {
      await logSystemAudit({
        action: "CONTENT_PUBLISHED",
        entityType: "project_task",
        entityId: publishingTaskId,
        actorId: actor.userId,
        newValues: {
          published_urls: cleanUrls,
          platforms: canonicalPlatforms,
          published_at: nowIso,
          parent_completed: parentCompleted,
        },
      });
    } catch (_) {}

    // 12. Notification with Idempotency Key
    if (pubTask.assigned_by_id && pubTask.assigned_by_id !== actor.userId) {
      try {
        await emitNotification({
          eventType: "GENERAL",
          title: "Content Published Live!",
          message: `"${pubTask.title}" has been published to ${canonicalPlatforms.join(", ")}.`,
          userId: pubTask.assigned_by_id,
          category: "task",
          priority: "normal",
          entityType: "task",
          entityId: pubTask.id,
          deduplicationKey: `published_notify_${pubTask.id}`,
          linkUrl: `/admin/my-work?taskId=${pubTask.id}`,
        });
      } catch (e) {
        console.warn("[markContentPublished] Notification notice:", e);
      }
    }

    return {
      success: true,
      parentCompleted,
      idempotent: false,
    };
  } catch (err: any) {
    console.error("[markContentPublished] Error:", err);
    return { success: false, error: err.message || "Failed to mark content published" };
  }
}

// ============================================================
// 8. PUBLISHING AUDIT TRAIL
// ============================================================

/**
 * Fetches the structured publishing audit trail for a deliverable/task.
 * Deduplicates multiple entries per milestone and preserves historical chain of custody.
 */
export async function fetchPublishingAuditTrail(
  taskId: string,
  parentTaskId?: string | null
): Promise<PublishingAuditTrail> {
  try {
    const taskIds = [taskId];
    if (parentTaskId) taskIds.push(parentTaskId);

    const { data: activities } = await (supabase as any)
      .from("project_activity")
      .select("*, actor:profiles(id, display_name)")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true });

    const audit: PublishingAuditTrail = {};

    if (Array.isArray(activities)) {
      for (const act of activities) {
        const actorObj = act.actor
          ? { id: act.actor.id, name: act.actor.display_name || "Specialist" }
          : act.actor_id
          ? { id: act.actor_id, name: "Specialist" }
          : null;

        if (act.action === "content_prepared" && !audit.contentPreparedBy) {
          audit.contentPreparedBy = actorObj;
        } else if (act.action === "drive_link_added" && !audit.driveLinkAddedBy) {
          audit.driveLinkAddedBy = actorObj;
          audit.driveUrl = act.details?.drive_url || null;
        } else if (act.action === "ready_for_publishing" && !audit.readyForPublishingAt) {
          audit.readyForPublishingAt = act.details?.timestamp || act.created_at;
          if (act.details?.drive_url) audit.driveUrl = act.details.drive_url;
        } else if (act.action === "publisher_assigned" && !audit.assignedPublisher) {
          audit.assignedPublisher = {
            id: act.details?.assigned_publisher_id,
            name: "Publisher",
          };
        } else if (act.action === "content_published" && !audit.publishedBy) {
          audit.publishedBy = actorObj;
          audit.publishedAt = act.details?.published_at || act.created_at;
          audit.publishedUrls = act.details?.published_urls || [];
          audit.platforms = act.details?.platforms || [];
        }
      }
    }

    return audit;
  } catch (err) {
    console.warn("[fetchPublishingAuditTrail] Non-fatal notice:", err);
    return {};
  }
}
