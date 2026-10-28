// ============================================================
// SADA OS — CLIENT INQUIRIES & DISCOVERY CONVERSION SERVICE
// Authoritative Single Source of Truth for Inbound Inquiries,
// Discovery Briefs, CRM Candidate Matching & Project Conversion.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import {
  canAccessModule,
  assertActorCanAccessModule,
  normalizeRole,
  type PermissionContext,
} from "@/lib/permissions";
import { logSystemAudit } from "./audit-service";
import {
  resolveToProfileId,
  normalizeEmail,
  normalizePhone,
  findMatchingClients,
  type ClientRow,
  type TeamMemberRow,
  type ProfileRow,
  type PreparedStarterTask,
} from "@/components/admin/project-utils";

export interface InquiryRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  service: string | null;
  budget: string | null;
  message: string;
  status: string;
  preferred_contact: string | null;
  path_taken: string | null;
  discovery_data?: any;
  questionnaire_answers?: any;
  client_id: string | null;
  converted_project_id: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type DiscoveryPath = "smart_match" | "quick_match" | "direct_package" | "guided";

/**
 * Deterministically resolves the canonical discovery path for an inquiry.
 * Eliminates presentation drift between listing filters and KPI metrics.
 */
export function resolveInquiryPath(inquiry: {
  path_taken?: string | null;
  discovery_data?: any;
}): DiscoveryPath {
  const d = inquiry.discovery_data || {};
  const source = d.source;

  if (source === "smart_match" || Boolean(d.recommendation)) {
    return "smart_match";
  }

  if (source === "quick_match") {
    return "quick_match";
  }

  const isPackage =
    source === "direct_package" ||
    inquiry.path_taken === "package" ||
    d.path_taken === "package" ||
    Boolean(d.package_id) ||
    Boolean(d.package_code);

  if (isPackage) {
    return "direct_package";
  }

  return "guided";
}

/**
 * Checks if an inquiry is converted according to canonical status and FK presence.
 */
export function isInquiryConverted(inquiry: {
  status?: string | null;
  converted_project_id?: string | null;
}): boolean {
  return Boolean(inquiry.converted_project_id) || inquiry.status === "converted";
}

export interface InquiryStats {
  total: number;
  converted: number;
  pending: number;
  smartMatches: number;
  quickMatches: number;
  packages: number;
  guided: number;
}

/**
 * Computes exact KPI statistics from a dataset of inquiries with zero mathematical drift.
 */
export function computeInquiryStats(inquiries: InquiryRecord[]): InquiryStats {
  const total = inquiries.length;
  let converted = 0;
  let smartMatches = 0;
  let quickMatches = 0;
  let packages = 0;
  let guided = 0;

  for (const r of inquiries) {
    if (isInquiryConverted(r)) {
      converted++;
    }

    const path = resolveInquiryPath(r);
    if (path === "smart_match") smartMatches++;
    else if (path === "quick_match") quickMatches++;
    else if (path === "direct_package") packages++;
    else guided++;
  }

  const pending = total - converted;
  return { total, converted, pending, smartMatches, quickMatches, packages, guided };
}

/**
 * Authoritative filter predicate matching search query, status, and path.
 */
export function filterInquiries(
  inquiries: InquiryRecord[],
  options: {
    search?: string;
    statusFilter?: "all" | "new" | "converted";
    pathFilter?: string;
  }
): InquiryRecord[] {
  const { search = "", statusFilter = "all", pathFilter = "all" } = options;
  const q = search.trim().toLowerCase();

  return inquiries.filter((r) => {
    // 1. Text search across advertised dimensions
    if (q) {
      const nameMatch = r.name && r.name.toLowerCase().includes(q);
      const emailMatch = r.email && r.email.toLowerCase().includes(q);
      const bizMatch = r.business_name && r.business_name.toLowerCase().includes(q);
      const serviceMatch = r.service && r.service.toLowerCase().includes(q);
      const messageMatch = r.message && r.message.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch && !bizMatch && !serviceMatch && !messageMatch) {
        return false;
      }
    }

    // 2. Status filter
    const isConv = isInquiryConverted(r);
    if (statusFilter === "new" && isConv) return false;
    if (statusFilter === "converted" && !isConv) return false;

    // 3. Path filter
    if (pathFilter !== "all") {
      const path = resolveInquiryPath(r);
      if (path !== pathFilter) return false;
    }

    return true;
  });
}

// ============================================================
// CONVERT INQUIRY TO PROJECT
// ============================================================

export interface ConvertInquiryParams {
  inquiryId: string;
  chosenClientId?: string | "new";
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  businessType?: string;
  projectTitle: string;
  projectLeadProfileId: string;
  startDate?: string;
  deadline?: string;
  description?: string;
  goals?: string;
  problems?: string;
  requestedServices?: string[];
  starterTasks?: Array<{
    title: string;
    category?: string;
    priority?: string;
    assignee_id?: string | null;
    deadline?: string | null;
    description?: string | null;
  }>;
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}

export interface ConvertInquiryResult {
  success: boolean;
  alreadyConverted?: boolean;
  projectId?: string;
  clientId?: string;
  tasksCreated?: number;
  message?: string;
  error?: string;
  ambiguousCandidates?: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
}

export async function convertInquiryToProject(
  params: ConvertInquiryParams
): Promise<ConvertInquiryResult> {
  const db = params.clientOverride || supabase;

  try {
    // 1. Role-based Access Control Guard
    if (params.ctx) {
      assertActorCanAccessModule(params.ctx, "inquiries");
    } else if (params.actorRole) {
      const norm = normalizeRole(params.actorRole);
      if (!canAccessModule(norm, "inquiries")) {
        throw new Error("Unauthorized: Inquiry conversion is restricted to Super Admin or Admin only.");
      }
    }

    // 2. Fetch Authoritative Inquiry Record
    const { data: inquiry, error: inqErr } = await (db as any)
      .from("contact_submissions")
      .select("*")
      .eq("id", params.inquiryId)
      .maybeSingle();

    if (inqErr || !inquiry) {
      return { success: false, error: inqErr?.message || "Inquiry record not found." };
    }

    // 3. Authoritative Idempotency Invariant:
    // If the inquiry has already been converted, safely return existing project without creating duplicates.
    if (isInquiryConverted(inquiry) && inquiry.converted_project_id) {
      return {
        success: true,
        alreadyConverted: true,
        projectId: inquiry.converted_project_id,
        clientId: inquiry.client_id || undefined,
        message: "Inquiry has already been converted to an operational project. Returning existing project reference.",
      };
    }

    // 4. Resolve Project Lead Profile
    let resolvedLeadId: string | null = null;
    if (params.projectLeadProfileId) {
      const [tmRes, prRes] = await Promise.all([
        (db as any).from("team_members").select("*"),
        (db as any).from("profiles").select("id, display_name"),
      ]);
      resolvedLeadId = resolveToProfileId(
        params.projectLeadProfileId,
        tmRes.data || [],
        prRes.data || []
      );
    }

    if (!resolvedLeadId) {
      return { success: false, error: "A valid Project Lead (profiles.id) is required to convert an inquiry." };
    }

    // 5. CRM Client Resolution & Ambiguity Defense
    const { data: existingClients } = await (db as any)
      .from("clients")
      .select("*")
      .order("name", { ascending: true });

    const allClients: ClientRow[] = existingClients || [];

    const normEmail = normalizeEmail(params.clientEmail || inquiry.email);
    const normPhone = normalizePhone(params.clientPhone || inquiry.phone);
    const effectiveClientName = (params.clientName || inquiry.business_name || inquiry.name || "").trim();

    if (!effectiveClientName) {
      return { success: false, error: "Client name is required." };
    }

    let finalClientId: string | null = null;

    if (params.chosenClientId && params.chosenClientId !== "new") {
      // User explicitly attached to an existing CRM client
      const matched = allClients.find((c) => c.id === params.chosenClientId);
      if (!matched) {
        return { success: false, error: "Specified CRM client does not exist." };
      }
      finalClientId = matched.id;
    } else if (params.chosenClientId === "new") {
      // User explicitly requested creating a brand new client profile
      const newClientPayload = {
        name: effectiveClientName,
        contact_name: inquiry.name?.trim() || null,
        email: normEmail,
        phone: normPhone,
        preferred_channel: inquiry.preferred_contact || null,
        industry: params.businessType?.trim() || null,
        notes: `Client created via inquiry conversion (${inquiry.id.slice(0, 8)})`,
        status: "active",
        relationship_owner_id: resolvedLeadId,
      };

      const { data: createdClient, error: clientErr } = await (db as any)
        .from("clients")
        .insert(newClientPayload)
        .select("id")
        .single();

      if (clientErr || !createdClient) {
        return { success: false, error: `Failed to create client profile: ${clientErr?.message}` };
      }
      finalClientId = createdClient.id;
    } else {
      // No explicit client selection provided: run deterministic candidate matching
      const matches = findMatchingClients(
        {
          email: inquiry.email,
          phone: inquiry.phone,
          business_name: inquiry.business_name,
          name: inquiry.name,
        },
        allClients
      );

      if (matches.length > 1) {
        // Multiple candidate matches -> Strictly reject to prevent accidental client merge
        return {
          success: false,
          error: "Ambiguous client match: Multiple existing CRM clients match this inquiry. Explicit client selection is required.",
          ambiguousCandidates: matches.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email || null,
            phone: m.phone || null,
          })),
        };
      } else if (matches.length === 1) {
        // Exactly one exact candidate match
        finalClientId = matches[0].id;
      } else {
        // Zero matches -> Safely create new client
        const newClientPayload = {
          name: effectiveClientName,
          contact_name: inquiry.name?.trim() || null,
          email: normEmail,
          phone: normPhone,
          preferred_channel: inquiry.preferred_contact || null,
          industry: params.businessType?.trim() || null,
          notes: `Client created via inquiry conversion (${inquiry.id.slice(0, 8)})`,
          status: "active",
          relationship_owner_id: resolvedLeadId,
        };

        const { data: createdClient, error: clientErr } = await (db as any)
          .from("clients")
          .insert(newClientPayload)
          .select("id")
          .single();

        if (clientErr || !createdClient) {
          return { success: false, error: `Failed to create client profile: ${clientErr?.message}` };
        }
        finalClientId = createdClient.id;
      }
    }

    // 6. Clean Description (Strictly eliminate legacy [CLIENT CONTACT: ...] markers)
    let cleanDesc = (params.description || inquiry.message || "").trim();
    cleanDesc = cleanDesc.replace(/\[CLIENT CONTACT:[^\]]*\]/gi, "").trim();

    // 7. Resolve Package if applicable
    const d = inquiry.discovery_data || {};
    const packageIdOrCode = d.package_id || d.package_code;
    let canonicalPackageId: string | null = null;

    if (packageIdOrCode) {
      const { data: pkgRow } = await (db as any)
        .from("package_catalog")
        .select("id, name, price, is_active")
        .or(`id.eq.${packageIdOrCode},code.eq.${packageIdOrCode}`)
        .maybeSingle();

      if (pkgRow?.id && pkgRow.is_active) {
        canonicalPackageId = pkgRow.id;
        // Optionally update client with package if newly registered
        if (params.chosenClientId === "new") {
          await (db as any).from("clients").update({ package_id: canonicalPackageId }).eq("id", finalClientId);
        }
      }
    }

    // 8. Create Operational Project in public.client_projects
    const projectTitle = (params.projectTitle || `${effectiveClientName} — Project`).trim();
    const startDate = params.startDate || new Date().toISOString().slice(0, 10);
    const deadline = params.deadline || null;
    const requestedServices = params.requestedServices || (inquiry.service ? [inquiry.service] : []);

    const projectPayload = {
      title: projectTitle,
      client_name: effectiveClientName,
      client_id: finalClientId,
      status: "active",
      description: cleanDesc || null,
      business_type: params.businessType?.trim() || null,
      goals: params.goals?.trim() || null,
      problems: params.problems?.trim() || null,
      requested_services: requestedServices,
      provided_services: requestedServices,
      timeline: deadline,
      budget: inquiry.budget || null,
      original_message: inquiry.message,
      questionnaire_answers: d,
      contact_submission_id: inquiry.id,
      lead_id: resolvedLeadId,
      start_date: startDate,
      deadline: deadline,
    };

    const { data: newProject, error: projErr } = await (db as any)
      .from("client_projects")
      .insert(projectPayload)
      .select("id")
      .single();

    if (projErr || !newProject) {
      return { success: false, error: `Failed to create operational project: ${projErr?.message}` };
    }

    // 9. Create Starter Tasks in public.project_tasks
    let tasksCreatedCount = 0;
    const starterTasks = params.starterTasks || [];

    if (starterTasks.length > 0) {
      const taskInserts = starterTasks.map((t, idx) => ({
        project_id: newProject.id,
        client_id: finalClientId,
        title: t.title,
        description: t.description || null,
        category: t.category || "kickoff",
        priority: t.priority || "high",
        status: "todo",
        assignee_id: t.assignee_id || resolvedLeadId,
        deadline: t.deadline || deadline,
        sort_order: idx + 1,
      }));

      const { data: insertedTasks, error: taskErr } = await (db as any)
        .from("project_tasks")
        .insert(taskInserts)
        .select("id");

      if (!taskErr && insertedTasks) {
        tasksCreatedCount = insertedTasks.length;
      }
    }

    // 10. Link Inquiry Record & Mark Converted
    const nowIso = new Date().toISOString();
    const { error: updateInqErr } = await (db as any)
      .from("contact_submissions")
      .update({
        converted_project_id: newProject.id,
        client_id: finalClientId,
        status: "converted",
        updated_at: nowIso,
      })
      .eq("id", inquiry.id);

    if (updateInqErr) {
      console.warn("[inquiry-service] Non-fatal link update warning:", updateInqErr.message);
    }

    // 11. Record Activity and Audit Logs
    try {
      await (db as any).from("project_activity").insert({
        project_id: newProject.id,
        actor_id: params.actorId || null,
        activity_type: "created",
        action: "created",
        metadata: {
          source: "contact_submission",
          inquiry_id: inquiry.id,
          client_id: finalClientId,
          lead_id: resolvedLeadId,
          tasks_generated: tasksCreatedCount,
        },
        details: {
          source: "contact_submission",
          inquiry_id: inquiry.id,
          client_id: finalClientId,
          lead_id: resolvedLeadId,
          tasks_generated: tasksCreatedCount,
        },
      });

      await logSystemAudit({
        action: "CONVERT_INQUIRY_TO_PROJECT",
        entityType: "contact_submission",
        entityId: inquiry.id,
        actorId: params.actorId || null,
        newValues: {
          project_id: newProject.id,
          client_id: finalClientId,
          client_name: effectiveClientName,
          lead_id: resolvedLeadId,
          tasks_count: tasksCreatedCount,
        },
        client: db,
      });
    } catch (_) {}

    return {
      success: true,
      projectId: newProject.id,
      clientId: finalClientId || undefined,
      tasksCreated: tasksCreatedCount,
      message: "Inquiry converted to project successfully.",
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// ============================================================
// SAFE INQUIRY DELETION & ARCHIVAL
// ============================================================

export interface DeleteInquiryParams {
  inquiryId: string;
  actorId?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}

export async function deleteInquiry(
  params: DeleteInquiryParams
): Promise<{ success: boolean; message?: string; error?: string }> {
  const db = params.clientOverride || supabase;

  try {
    // 1. RBAC Guard
    if (params.ctx) {
      assertActorCanAccessModule(params.ctx, "inquiries");
    } else if (params.actorRole) {
      const norm = normalizeRole(params.actorRole);
      if (!canAccessModule(norm, "inquiries")) {
        throw new Error("Unauthorized: Inquiry deletion is restricted to Super Admin or Admin only.");
      }
    }

    // 2. Fetch Inquiry
    const { data: inquiry, error: fetchErr } = await (db as any)
      .from("contact_submissions")
      .select("id, status, converted_project_id")
      .eq("id", params.inquiryId)
      .maybeSingle();

    if (fetchErr || !inquiry) {
      return { success: false, error: "Inquiry not found." };
    }

    // 3. Historical Preservation Invariant:
    // Converted inquiries linked to operational projects must NOT be permanently destroyed.
    if (isInquiryConverted(inquiry) || inquiry.converted_project_id) {
      return {
        success: false,
        error: `Cannot delete inquiry: This inquiry is linked to an active converted project (${inquiry.converted_project_id}). Converted inquiries must be preserved for audit and historical integrity.`,
      };
    }

    // 4. Safe Permanent Deletion of Unconverted Inquiries
    const { error: delErr } = await (db as any)
      .from("contact_submissions")
      .delete()
      .eq("id", params.inquiryId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    // 5. Audit Log
    try {
      await logSystemAudit({
        action: "DELETE_INQUIRY",
        entityType: "contact_submission",
        entityId: params.inquiryId,
        actorId: params.actorId || null,
        newValues: {
          change_reason: "Deleted unreferenced inquiry record",
        },
        client: db,
      });
    } catch (_) {}

    return { success: true, message: "Inquiry deleted successfully." };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
