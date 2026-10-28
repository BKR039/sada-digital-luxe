// ============================================================
// SADA OS — CONFIGURABLE TASK WORKFLOW ENGINE SERVICE
// Canonical SSOT for Task Types, Workflow Templates, Stages,
// Deterministic Instantiation, and Prerequisite Dependencies.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  WorkflowTemplate,
  WorkflowStageDefinition,
  WorkflowStageInstance,
  WorkflowProgressSummary,
  WorkflowStageType,
  AssignmentRule,
} from "@/types/workflow";
export type {
  WorkflowTemplate,
  WorkflowStageDefinition,
  WorkflowStageInstance,
  WorkflowProgressSummary,
  WorkflowStageType,
  AssignmentRule,
};
import { resolveToProfileId, type TeamMemberRow, type ProfileRow, type TaskRow } from "@/components/admin/project-utils";
import { format, addDays, subDays } from "date-fns";
import { logSystemAudit } from "./audit-service";
import {
  assertActorCanAccessModule,
  canAccessModule,
  type PermissionContext,
} from "@/lib/permissions";

// ============================================================
// CANONICAL DEFAULT WORKFLOW TEMPLATES (Deterministic Fallbacks)
// ============================================================
export const CANONICAL_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    task_type: "reel",
    name: "Reel Production Workflow",
    name_ar: "مسار إنتاج فيديو ريل",
    description: "Standard 4-stage pipeline for commercial & social media video reels.",
    description_ar: "مسار إنتاج متكامل من 4 مراحل لفيديوهات الريلز الإعلانية والتسويقية.",
    icon: "Film",
    color: "purple",
    is_active: true,
    sort_order: 1,
    stages: [
      {
        id: "reel-stage-1",
        title: "Scenario / Script",
        title_ar: "السيناريو والنص الإبداعي",
        stage_type: "script",
        order: 1,
        duration_days: 2,
        requires_previous_stage: false,
        assignment_rule: "specialist_role",
        default_assignee_role: "copywriter",
        description: "Draft hooks, script dialogue, voiceover instructions, and scene sequence.",
        description_ar: "كتابة المقدمة الجاذبة، النص الحواري، وملاحظات المشاهد والتوجيه الصوتي.",
        checklist_items: ["Attention hook defined", "CTA clearly stated", "Length under 60s"],
      },
      {
        id: "reel-stage-2",
        title: "Shooting",
        title_ar: "التصوير الميداني",
        stage_type: "shooting",
        order: 2,
        duration_days: 1,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "videographer",
        description: "On-location or studio camera setup, lighting, sound capture, and raw b-roll.",
        description_ar: "تصوير المشاهد في الموقع أو الاستوديو، ضبط الإضاءة، وتسجيل لقطات B-Roll.",
        checklist_items: ["4K 60fps footage captured", "Clear audio recording", "Raw assets backed up"],
      },
      {
        id: "reel-stage-3",
        title: "Editing",
        title_ar: "المونتاج والمؤثرات",
        stage_type: "editing",
        order: 3,
        duration_days: 3,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "editor",
        description: "Cuts, color grading, sound design, music sync, dynamic subtitles, and motion graphics.",
        description_ar: "قص اللقطات، تصحيح الألوان، إضافة الموسيقى والمؤثرات الصوتية، والترجمة الحركية.",
        checklist_items: ["Pacing aligned with music", "Color graded", "Subtitles animated & reviewed"],
      },
      {
        id: "reel-stage-4",
        title: "Publishing",
        title_ar: "النشر والجدولة",
        stage_type: "publishing",
        order: 4,
        duration_days: 1,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "publisher",
        description: "Final export in 9:16 aspect ratio, caption writing, hashtag strategy, and scheduling.",
        description_ar: "التصدير النهائي بصيغة 9:16، كتابة الكابشن والوسوم، والجدولة على المنصات.",
        checklist_items: ["Cover frame selected", "Caption written with tags", "Scheduled for peak time"],
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    task_type: "design",
    name: "Creative Design Workflow",
    name_ar: "مسار التصميم الإبداعي",
    description: "Structured 3-stage pipeline for branding, graphic design, and social media posts.",
    description_ar: "مسار من 3 مراحل للهويات البصرية وتصميمات السوشيال ميديا.",
    icon: "Palette",
    color: "rose",
    is_active: true,
    sort_order: 2,
    stages: [
      {
        id: "design-stage-1",
        title: "Creative Brief",
        title_ar: "الموجز الإبداعي",
        stage_type: "brief",
        order: 1,
        duration_days: 1,
        requires_previous_stage: false,
        assignment_rule: "project_lead",
        default_assignee_role: "account_manager",
        description: "Define objectives, visual tone, brand guidelines, dimensions, and text copy.",
        description_ar: "تحديد أهداف التصميم، الهوية المعتمدة، الأبعاد المطلوبة، والنصوص الأساسية.",
        checklist_items: ["Brand assets gathered", "Copy approved", "Dimensions confirmed"],
      },
      {
        id: "design-stage-2",
        title: "Design",
        title_ar: "التصميم والتنفيذ",
        stage_type: "design",
        order: 2,
        duration_days: 3,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "designer",
        description: "Produce visual mockups, typography layout, export high-res deliverables.",
        description_ar: "إنتاج التصميم الفني، تنسيق الخطوط والألوان، وتصدير النماذج الأولية.",
        checklist_items: ["High-res visual generated", "Typography checked", "Brand palette respected"],
      },
      {
        id: "design-stage-3",
        title: "Publishing",
        title_ar: "الاعتماد والنشر",
        stage_type: "publishing",
        order: 3,
        duration_days: 1,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "publisher",
        description: "Deliver approved final assets to client or schedule directly to content grid.",
        description_ar: "تسليم الملفات النهائية للعميل أو جدولتها مباشرة على شبكة النشر.",
        checklist_items: ["Final client approval signed", "Assets delivered / posted"],
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    task_type: "web_development",
    name: "Web & Platform Development",
    name_ar: "مسار تطوير المواقع والمنصات",
    description: "Full software delivery lifecycle from architecture to production launch.",
    description_ar: "دورة حياة هندسة البرمجيات وتطوير المنصات حتى الإطلاق النهائي.",
    icon: "Globe",
    color: "blue",
    is_active: true,
    sort_order: 3,
    stages: [
      {
        id: "web-stage-1",
        title: "Architecture & Brief",
        title_ar: "الهندسة المعمارية والمواصفات",
        stage_type: "brief",
        order: 1,
        duration_days: 2,
        requires_previous_stage: false,
        assignment_rule: "project_lead",
        default_assignee_role: "developer",
        description: "Define sitemap, tech stack, database schemas, and integration specifications.",
        description_ar: "تحديد هيكل الموقع، حزمة التقنيات، مخططات قواعد البيانات، ومتطلبات الربط.",
        checklist_items: ["User stories mapped", "Schema approved"],
      },
      {
        id: "web-stage-2",
        title: "UI/UX & Wireframing",
        title_ar: "واجهات المستخدم وتجربة الاستخدام",
        stage_type: "design",
        order: 2,
        duration_days: 4,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "designer",
        description: "Interactive Figma components, responsive mobile/desktop layouts.",
        description_ar: "تصميم واجهات فيجما التفاعلية والمتوافقة مع الهواتف والحواسب.",
        checklist_items: ["Figma prototype approved", "Design system tokens exported"],
      },
      {
        id: "web-stage-3",
        title: "Frontend & Backend Development",
        title_ar: "البرمجة والتطوير التقني",
        stage_type: "development",
        order: 3,
        duration_days: 7,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "developer",
        description: "Implement responsive components, APIs, database RLS, and business logic.",
        description_ar: "برمجة الواجهات والواجهات الخلفية، أمان RLS، وقواعد الأعمال.",
        checklist_items: ["TypeScript 0 errors", "APIs verified", "Responsive tested"],
      },
      {
        id: "web-stage-4",
        title: "QA & Deployment",
        title_ar: "الفحص وضمان الجودة والإطلاق",
        stage_type: "qa",
        order: 4,
        duration_days: 2,
        requires_previous_stage: true,
        assignment_rule: "project_lead",
        default_assignee_role: "developer",
        description: "Cross-browser audit, SEO validation, production deploy and DNS pointing.",
        description_ar: "فحص المتصفحات، تدقيق محركات البحث، ونشر النسخة النهائية على النطاق.",
        checklist_items: ["Lighthouse score > 90", "SSL active", "Client sign-off"],
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    task_type: "sponsoring",
    name: "Paid Ads Campaign Workflow",
    name_ar: "مسار الحملات الإعلانية الممولة",
    description: "Performance marketing workflow covering strategy, ad creative, setup, and optimization.",
    description_ar: "مسار الحملات الممولة يشمل الاستراتيجية، التصميمات، الإطلاق، والتحسين.",
    icon: "Zap",
    color: "amber",
    is_active: true,
    sort_order: 4,
    stages: [
      {
        id: "sponsoring-stage-1",
        title: "Campaign Strategy & Copywriting",
        title_ar: "الاستراتيجية والنصوص الإعلانية",
        stage_type: "strategy",
        order: 1,
        duration_days: 2,
        requires_previous_stage: false,
        assignment_rule: "specialist_role",
        default_assignee_role: "copywriter",
        description: "Determine target audience personas, ad angles, offers, and conversion copy.",
        description_ar: "تحديد الفئات المستهدفة، زوايا العرض الإعلاني، وصياغة النصوص المقنعة.",
        checklist_items: ["Audience personas documented", "Ad copies drafted"],
      },
      {
        id: "sponsoring-stage-2",
        title: "Ad Creative & Visual Assets",
        title_ar: "التصميمات والمواد الإعلانية",
        stage_type: "design",
        order: 2,
        duration_days: 2,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "designer",
        description: "Produce dynamic ad creatives, carousel cards, and video hooks.",
        description_ar: "إنتاج تصاميم وفيديوهات الإعلانات بالأحجام والنسب المطلوبة.",
        checklist_items: ["Ad dimensions formatted", "Brand guidelines applied"],
      },
      {
        id: "sponsoring-stage-3",
        title: "Targeting & Meta/Google Setup",
        stage_type: "media_buying",
        title_ar: "إعداد الإعلانات والاستهداف",
        order: 3,
        duration_days: 1,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "media_buyer",
        description: "Configure Meta Ads Manager / Google Ads, set pixel events, audience exclusions, and budgets.",
        description_ar: "إعداد مدير الإعلانات، بكسل التتبع، الميزانيات والاستهداف الجغرافي.",
        checklist_items: ["Pixel tracking tested", "Daily budget allocated", "Ads scheduled"],
      },
      {
        id: "sponsoring-stage-4",
        title: "Live Optimization & Reporting",
        stage_type: "optimization",
        title_ar: "التحسين الميداني والتقارير",
        order: 4,
        duration_days: 5,
        requires_previous_stage: true,
        assignment_rule: "specialist_role",
        default_assignee_role: "media_buyer",
        description: "Monitor CTR, CPA, ROAS, scale winning creatives, and deliver client ROI dashboard.",
        description_ar: "متابعة تكلفة النقر والتحويل، تعزيز الإعلانات الناجحة، وتقديم تقرير الأداء.",
        checklist_items: ["ROAS calculated", "Weekly insights sent"],
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-memory cache for fast lookup
let cachedTemplates: WorkflowTemplate[] | null = null;
const listeners = new Set<() => void>();

export function subscribeToWorkflowChanges(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifySubscribers() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error("[workflow-service] Subscriber notification error:", e);
    }
  }
}

/**
 * Loads all active workflow templates.
 * 1. Tries loading from public.business_rules (key: task_workflow_templates).
 * 2. Tries public.workflow_templates if available.
 * 3. Falls back safely to CANONICAL_WORKFLOW_TEMPLATES.
 */
export async function fetchWorkflowTemplates(
  forceFresh = false,
  clientOverride?: any
): Promise<WorkflowTemplate[]> {
  if (!forceFresh && cachedTemplates && !clientOverride) {
    return cachedTemplates;
  }

  const activeClient = clientOverride || supabase;

  try {
    // Check centralized business_rules storage first (canonical audited SSOT)
    const { data: brRow, error: brErr } = await (activeClient as any)
      .from("business_rules")
      .select("json_value")
      .eq("rule_key", "task_workflow_templates")
      .maybeSingle();

    if (!brErr && brRow?.json_value && Array.isArray(brRow.json_value) && brRow.json_value.length > 0) {
      if (!clientOverride) cachedTemplates = brRow.json_value;
      return brRow.json_value;
    }

    // Secondary check: dedicated workflow_templates table if seeded
    const { data: dbTemplates, error: dbErr } = await (activeClient as any)
      .from("workflow_templates")
      .select(`
        *,
        stages:workflow_stages(*)
      `)
      .order("sort_order", { ascending: true });

    if (!dbErr && dbTemplates && dbTemplates.length > 0) {
      const mapped: WorkflowTemplate[] = dbTemplates.map((t: any) => ({
        id: t.id,
        task_type: t.task_type,
        name: t.name,
        name_ar: t.name_ar,
        description: t.description,
        description_ar: t.description_ar,
        icon: t.icon || "Workflow",
        color: t.color || "purple",
        is_active: t.is_active ?? true,
        sort_order: t.sort_order ?? 0,
        stages: (t.stages || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((s: any) => ({
            id: s.id,
            title: s.title,
            title_ar: s.title_ar,
            stage_type: s.stage_type,
            order: s.sort_order,
            duration_days: s.duration_days || 1,
            requires_previous_stage: s.requires_previous_stage ?? true,
            assignment_rule: s.assignment_rule || "specialist_role",
            default_assignee_role: s.default_assignee_role,
            default_assignee_id: s.default_assignee_id,
            description: s.description,
            description_ar: s.description_ar,
            checklist_items: s.checklist_items || [],
          })),
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      if (!clientOverride) cachedTemplates = mapped;
      return mapped;
    }
  } catch (err) {
    console.warn("[workflow-service] Non-fatal notice querying workflow tables; using canonical defaults:", err);
  }

  // Canonical fallback
  if (!clientOverride) cachedTemplates = CANONICAL_WORKFLOW_TEMPLATES;
  return CANONICAL_WORKFLOW_TEMPLATES;
}

/**
 * Super Admin: Saves or updates a workflow template.
 * Validates integrity, persists to public.workflow_templates & public.workflow_stages,
 * and maintains public.business_rules JSON snapshot with versioning & audit.
 */
export async function saveWorkflowTemplate(params: {
  template: WorkflowTemplate;
  changedById?: string;
  changeReason?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.ctx) {
      assertActorCanAccessModule(params.ctx, "workflows");
    } else if (params.actorRole && !canAccessModule(params.actorRole, "workflows")) {
      throw new Error("Unauthorized: Workflow template management is restricted to Super Admin only.");
    }

    const activeClient = params.clientOverride || supabase;

    // 1. Authoritative Server-side Validation
    const cleanTaskType = (params.template.task_type || "").trim().toLowerCase();
    if (!cleanTaskType) {
      return { success: false, error: "Task type key is required." };
    }
    if (!/^[a-z0-9_-]+$/.test(cleanTaskType)) {
      return {
        success: false,
        error: "Invalid task_type key. Only alphanumeric characters, dashes, and underscores are allowed.",
      };
    }

    const cleanName = (params.template.name || "").trim();
    if (!cleanName) {
      return { success: false, error: "Workflow template name is required." };
    }

    if (!Array.isArray(params.template.stages) || params.template.stages.length === 0) {
      return { success: false, error: "A workflow template must contain at least 1 stage." };
    }

    // Validate stages
    const seenOrders = new Set<number>();
    for (let i = 0; i < params.template.stages.length; i++) {
      const s = params.template.stages[i];
      if (!s.title || !s.title.trim()) {
        return { success: false, error: `Stage ${i + 1}: Title is required.` };
      }
      const duration = Number(s.duration_days);
      if (isNaN(duration) || duration <= 0) {
        return { success: false, error: `Stage "${s.title}": Duration must be a positive number of days (at least 1).` };
      }
      const order = Number(s.order) || (i + 1);
      if (seenOrders.has(order)) {
        return { success: false, error: `Duplicate stage position: Stage order ${order} is assigned to multiple stages.` };
      }
      seenOrders.add(order);
    }

    const currentList = await fetchWorkflowTemplates(true, activeClient);

    // Check duplicate task_type key across different templates
    const conflicting = currentList.find(
      (t) => t.task_type === cleanTaskType && t.id !== params.template.id
    );
    if (conflicting) {
      return {
        success: false,
        error: `Unique key violation: Task type key "${cleanTaskType}" is already used by template "${conflicting.name}".`,
      };
    }

    const existingIdx = currentList.findIndex(
      (t) => t.id === params.template.id || t.task_type === cleanTaskType
    );

    const nowIso = new Date().toISOString();
    const cleanTemplate: WorkflowTemplate = {
      ...params.template,
      task_type: cleanTaskType,
      name: cleanName,
      name_ar: params.template.name_ar?.trim() || undefined,
      description: params.template.description?.trim() || "",
      description_ar: params.template.description_ar?.trim() || undefined,
      icon: params.template.icon || "Workflow",
      color: params.template.color || "purple",
      is_active: params.template.is_active ?? true,
      sort_order: Number(params.template.sort_order) || 0,
      stages: params.template.stages
        .sort((a, b) => a.order - b.order)
        .map((s, idx) => ({
          ...s,
          order: idx + 1,
          duration_days: Math.max(1, Math.round(Number(s.duration_days) || 1)),
          requires_previous_stage: idx === 0 ? false : Boolean(s.requires_previous_stage),
        })),
      updated_at: nowIso,
    };

    let updatedList: WorkflowTemplate[];
    if (existingIdx >= 0) {
      updatedList = [...currentList];
      updatedList[existingIdx] = cleanTemplate;
    } else {
      updatedList = [...currentList, cleanTemplate];
    }

    // 2. Persist to public.workflow_templates
    let authoritativeTemplateId = cleanTemplate.id;
    try {
      const { data: tplRow, error: tplErr } = await (activeClient as any)
        .from("workflow_templates")
        .upsert({
          id: cleanTemplate.id,
          task_type: cleanTemplate.task_type,
          name: cleanTemplate.name,
          name_ar: cleanTemplate.name_ar,
          description: cleanTemplate.description,
          description_ar: cleanTemplate.description_ar,
          icon: cleanTemplate.icon,
          color: cleanTemplate.color,
          is_active: cleanTemplate.is_active,
          sort_order: cleanTemplate.sort_order,
          updated_at: nowIso,
        }, { onConflict: "task_type" })
        .select()
        .single();

      if (tplErr) {
        console.warn("[workflow-service] workflow_templates upsert notice:", tplErr.message);
      } else if (tplRow?.id) {
        authoritativeTemplateId = tplRow.id;
        cleanTemplate.id = authoritativeTemplateId;
      }
    } catch (e: any) {
      console.warn("[workflow-service] workflow_templates upsert exception:", e?.message);
    }

    // 3. Persist and synchronize stages to public.workflow_stages
    try {
      const { data: existingDbStages } = await (activeClient as any)
        .from("workflow_stages")
        .select("id, sort_order")
        .eq("template_id", authoritativeTemplateId);

      const stageUpserts = cleanTemplate.stages.map((s, idx) => {
        const isUuid = typeof s.id === "string" && s.id.length === 36 && s.id.includes("-");
        return {
          ...(isUuid ? { id: s.id } : {}),
          template_id: authoritativeTemplateId,
          title: s.title.trim(),
          title_ar: s.title_ar?.trim() || null,
          stage_type: s.stage_type || "custom",
          sort_order: s.order || (idx + 1),
          duration_days: Math.max(1, Math.round(Number(s.duration_days) || 1)),
          requires_previous_stage: (idx === 0) ? false : Boolean(s.requires_previous_stage),
          assignment_rule: s.assignment_rule || "specialist_role",
          default_assignee_role: s.default_assignee_role || null,
          default_assignee_id: s.default_assignee_id || null,
          description: s.description?.trim() || null,
          description_ar: s.description_ar?.trim() || null,
          checklist_items: s.checklist_items || [],
          updated_at: nowIso,
        };
      });

      // Delete removed stages
      const newOrders = new Set(stageUpserts.map((s) => s.sort_order));
      const staleStages = (existingDbStages || []).filter((es: any) => !newOrders.has(es.sort_order));
      if (staleStages.length > 0) {
        await (activeClient as any)
          .from("workflow_stages")
          .delete()
          .in("id", staleStages.map((s: any) => s.id));
      }

      // Upsert current stages
      const { error: stagesErr } = await (activeClient as any)
        .from("workflow_stages")
        .upsert(stageUpserts, { onConflict: "template_id,sort_order" });

      if (stagesErr) {
        console.warn("[workflow-service] workflow_stages upsert notice:", stagesErr.message);
      }
    } catch (e: any) {
      console.warn("[workflow-service] workflow_stages sync exception:", e?.message);
    }

    // 4. Persist to business_rules (JSON backup & versioning)
    try {
      const { error: upsertErr } = await (activeClient as any)
        .from("business_rules")
        .upsert({
          rule_key: "task_workflow_templates",
          rule_name: "Configurable Task Workflow Templates",
          description: "Super Admin configured task types and ordered workflow stages.",
          category: "operations",
          value_type: "json",
          json_value: updatedList,
          is_active: true,
          updated_by: params.changedById || null,
          updated_at: nowIso,
        }, { onConflict: "rule_key" });

      if (upsertErr) {
        console.warn("[workflow-service] Could not upsert to business_rules:", upsertErr.message);
      }
    } catch (e: any) {
      console.warn("[workflow-service] business_rules non-fatal:", e?.message);
    }

    // 5. Audit log
    await logSystemAudit({
      action: "UPDATE_WORKFLOW_TEMPLATE",
      entityType: "workflow_template",
      entityId: cleanTemplate.id,
      actorId: params.changedById,
      newValues: {
        task_type: cleanTemplate.task_type,
        name: cleanTemplate.name,
        stage_count: cleanTemplate.stages.length,
        stages: cleanTemplate.stages.map((s) => s.title),
        change_reason: params.changeReason || "Configured workflow template stages",
      },
      client: activeClient,
    });

    if (!params.clientOverride) {
      cachedTemplates = updatedList;
      notifySubscribers();
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save workflow template" };
  }
}

/**
 * Super Admin: Deletes or archives a workflow template.
 * Historical protection: If referenced by active or historical tasks/commitments,
 * it is safely archived (is_active = false) to prevent data corruption.
 */
export async function deleteWorkflowTemplate(params: {
  templateId: string;
  changedById?: string;
  changeReason?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; archived?: boolean; message?: string; error?: string }> {
  try {
    if (params.ctx) {
      assertActorCanAccessModule(params.ctx, "workflows");
    } else if (params.actorRole && !canAccessModule(params.actorRole, "workflows")) {
      throw new Error("Unauthorized: Workflow template deletion is restricted to Super Admin only.");
    }

    const activeClient = params.clientOverride || supabase;

    // Check if template exists
    const currentList = await fetchWorkflowTemplates(true, activeClient);
    const targetTpl = currentList.find((t) => t.id === params.templateId);
    if (!targetTpl) {
      return { success: false, error: "Workflow template not found." };
    }

    // Check historical task and deliverable references
    let isReferenced = false;
    try {
      const { data: refTasks } = await (activeClient as any)
        .from("project_tasks")
        .select("id")
        .eq("workflow_template_id", params.templateId)
        .limit(1);

      if (refTasks && refTasks.length > 0) {
        isReferenced = true;
      }

      if (!isReferenced && targetTpl.task_type) {
        const { data: refCommitments } = await (activeClient as any)
          .from("service_commitments")
          .select("id")
          .eq("task_type", targetTpl.task_type)
          .limit(1);

        if (refCommitments && refCommitments.length > 0) {
          isReferenced = true;
        }
      }
    } catch (_) {}

    const nowIso = new Date().toISOString();

    if (isReferenced) {
      // Historical preservation: Safe archival / disabling
      try {
        await (activeClient as any)
          .from("workflow_templates")
          .update({ is_active: false, updated_at: nowIso })
          .eq("id", params.templateId);
      } catch (_) {}

      const updatedList = currentList.map((t) =>
        t.id === params.templateId ? { ...t, is_active: false, updated_at: nowIso } : t
      );

      try {
        await (activeClient as any)
          .from("business_rules")
          .upsert({
            rule_key: "task_workflow_templates",
            rule_name: "Configurable Task Workflow Templates",
            description: "Super Admin configured task types and ordered workflow stages.",
            category: "operations",
            value_type: "json",
            json_value: updatedList,
            is_active: true,
            updated_by: params.changedById || null,
            updated_at: nowIso,
          }, { onConflict: "rule_key" });
      } catch (_) {}

      await logSystemAudit({
        action: "ARCHIVE_WORKFLOW_TEMPLATE",
        entityType: "workflow_template",
        entityId: params.templateId,
        actorId: params.changedById,
        newValues: {
          change_reason: params.changeReason || "Archived workflow template (referenced by operational records)",
          is_active: false,
        },
        client: activeClient,
      });

      if (!params.clientOverride) {
        cachedTemplates = updatedList;
        notifySubscribers();
      }

      return {
        success: true,
        archived: true,
        message: "Template is referenced by active or historical tasks; safely archived (disabled) to preserve operational records.",
      };
    }

    // If unreferenced, safe permanent removal
    const updatedList = currentList.filter((t) => t.id !== params.templateId);

    try {
      await (activeClient as any).from("workflow_stages").delete().eq("template_id", params.templateId);
      await (activeClient as any).from("workflow_templates").delete().eq("id", params.templateId);
    } catch (_) {}

    try {
      await (activeClient as any)
        .from("business_rules")
        .upsert({
          rule_key: "task_workflow_templates",
          rule_name: "Configurable Task Workflow Templates",
          description: "Super Admin configured task types and ordered workflow stages.",
          category: "operations",
          value_type: "json",
          json_value: updatedList,
          is_active: true,
          updated_by: params.changedById || null,
          updated_at: nowIso,
        }, { onConflict: "rule_key" });
    } catch (_) {}

    await logSystemAudit({
      action: "DELETE_WORKFLOW_TEMPLATE",
      entityType: "workflow_template",
      entityId: params.templateId,
      actorId: params.changedById,
      newValues: {
        change_reason: params.changeReason || "Deleted unreferenced workflow template",
      },
      client: activeClient,
    });

    if (!params.clientOverride) {
      cachedTemplates = updatedList;
      notifySubscribers();
    }
    return { success: true, archived: false, message: "Workflow template permanently deleted." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete workflow template" };
  }
}

/**
 * Deterministically finds the best suited team member for a stage role.
 */
export function matchWorkerForStageRole(
  roleKeyword: string | undefined,
  teamMembers: TeamMemberRow[],
  profiles: ProfileRow[]
): string | null {
  if (!roleKeyword || !teamMembers || teamMembers.length === 0) return null;
  const kw = roleKeyword.toLowerCase().trim();

  // 1. Direct specialty or position match
  const matched = teamMembers.find((m) => {
    if (!m.is_active || m.availability_status === "on_leave") return false;
    const pos = (m.position || "").toLowerCase();
    const div = (m.division || "").toLowerCase();
    const specs: string[] = Array.isArray(m.specialties) ? m.specialties.map((s) => String(s).toLowerCase()) : [];
    const isPubMatch = (kw === "publisher" || kw === "publishing") && Boolean((m as any).is_publisher);

    return (
      isPubMatch ||
      pos.includes(kw) ||
      div.includes(kw) ||
      specs.some((s) => s.includes(kw))
    );
  });

  if (matched) {
    return resolveToProfileId(matched.profile_id || matched.id, teamMembers, profiles);
  }

  return null;
}

/**
 * Instantiates ordered workflow stage instances as canonical subtasks
 * under parentTask in public.project_tasks.
 *
 * Each stage is:
 * - A valid row in public.project_tasks with parent_task_id = parentTask.id
 * - Given calculated dates based on duration_days and parent deadline
 * - Assigned to worker via rule or explicit selection
 * - Given sort_order = stage.order
 * - Enriched with self-contained metadata so historical records remain immutable
 */
export async function instantiateWorkflowStages(params: {
  parentTask: TaskRow;
  template: WorkflowTemplate;
  customStageAssignees?: Record<string, string>; // stageId -> profileId
  teamMembers: TeamMemberRow[];
  profiles: ProfileRow[];
  currentUserId?: string;
  existingSubtasks?: TaskRow[];
  commitToDatabase?: boolean;
  clientOverride?: any;
}): Promise<{ success: boolean; createdTasks: TaskRow[]; error?: string }> {
  try {
    const { parentTask, template, customStageAssignees = {}, teamMembers, profiles, currentUserId } = params;
    const activeClient = params.clientOverride || supabase;
    const stages = [...template.stages].sort((a, b) => a.order - b.order);

    if (stages.length === 0) {
      return { success: true, createdTasks: [] };
    }

    const isMock = params.commitToDatabase === false;

    // 1. Fetch existing subtasks to guarantee stage idempotency
    let existingStages: TaskRow[] = [];
    if (Array.isArray(params.existingSubtasks)) {
      existingStages = params.existingSubtasks.filter((t) => t.parent_task_id === parentTask.id);
    } else if (!isMock) {
      try {
        const { data: dbSubtasks } = await (activeClient as any)
          .from("project_tasks")
          .select("id, parent_task_id, sort_order, category, idempotency_key, sequence_index, title")
          .eq("parent_task_id", parentTask.id);
        if (Array.isArray(dbSubtasks)) {
          existingStages = dbSubtasks;
        }
      } catch (_) {}
    }

    const parentDeadline = parentTask.deadline ? new Date(parentTask.deadline) : null;
    const parentStart = parentTask.start_date ? new Date(parentTask.start_date) : new Date();

    // Calculate stage deadlines forward from parentStart or backwards from parentDeadline
    let currentStageDate = new Date(parentStart);

    const taskInserts = stages.map((stage) => {
      // 1. Resolve assignee with authoritative precedence:
      // explicit modal override -> configured stage specialist -> configured specialist role -> fallback parent assignee
      let targetAssigneeId: string | null = null;
      if (customStageAssignees[stage.id]) {
        targetAssigneeId = resolveToProfileId(customStageAssignees[stage.id], teamMembers, profiles);
      } else if (stage.default_assignee_id) {
        targetAssigneeId = resolveToProfileId(stage.default_assignee_id, teamMembers, profiles);
      } else if (stage.assignment_rule === "specialist_role" && stage.default_assignee_role) {
        targetAssigneeId = matchWorkerForStageRole(stage.default_assignee_role, teamMembers, profiles);
      } else if (parentTask.assignee_id) {
        targetAssigneeId = resolveToProfileId(parentTask.assignee_id, teamMembers, profiles);
      }

      // 2. Calculate stage due date
      const stageStart = new Date(currentStageDate);
      const stageDeadline = addDays(stageStart, Math.max(1, stage.duration_days));
      currentStageDate = new Date(stageDeadline);

      // Clamp to parent deadline if known
      const finalDeadlineStr = parentDeadline && stageDeadline > parentDeadline
        ? format(parentDeadline, "yyyy-MM-dd")
        : format(stageDeadline, "yyyy-MM-dd");

      // 3. Deterministic structured identity
      const stageIdempotencyKey = `stage_${parentTask.id}_${stage.id || `seq${stage.order}`}`;
      const stageMetaHeader = `[WORKFLOW_STAGE:${stage.id}|ORDER:${stage.order}|TYPE:${stage.stage_type}|REQUIRES_PREV:${stage.requires_previous_stage ? "1" : "0"}]`;
      const fullNotes = stage.description
        ? `${stageMetaHeader}\n${stage.description}`
        : stageMetaHeader;

      return {
        id: isMock ? `stage_task_${parentTask.id}_${stage.id || stage.order}` : crypto.randomUUID(),
        project_id: parentTask.project_id,
        client_id: parentTask.client_id || null,
        parent_task_id: parentTask.id,
        workflow_template_id: template.id,
        stage_key: stage.stage_type,
        stage_order: stage.order,
        is_stage_locked: stage.order > 1 && Boolean(stage.requires_previous_stage),
        depends_on_stage_order: (stage.order > 1 && Boolean(stage.requires_previous_stage)) ? stage.order - 1 : null,
        commitment_id: (parentTask as any).commitment_id || null,
        deliverable_id: parentTask.deliverable_id || null,
        occurrence_date: (parentTask as any).occurrence_date || (parentTask as any).scheduled_date || (parentTask.deadline ? parentTask.deadline.substring(0, 10) : null),
        sequence_index: stage.order,
        idempotency_key: stageIdempotencyKey,
        title: `${stage.order}. ${stage.title}`,
        description: stage.description || null,
        category: stage.stage_type,
        service: parentTask.service || template.name,
        priority: parentTask.priority || "medium",
        status: "todo" as const,
        assignee_id: targetAssigneeId,
        assigned_by_id: resolveToProfileId(parentTask.assigned_by_id || currentUserId, teamMembers, profiles),
        start_date: format(stageStart, "yyyy-MM-dd"),
        deadline: finalDeadlineStr,
        scheduled_date: finalDeadlineStr,
        delivery_period: parentTask.delivery_period || null,
        sort_order: stage.order,
        notes: fullNotes,
        estimated_hours: stage.duration_days * 4,
      };
    });

    // 4. Strict Idempotency Filter: Only insert stages that do not already exist
    const neededInserts = taskInserts.filter((task) => {
      const alreadyExists = existingStages.some((ex) =>
        (ex.idempotency_key && ex.idempotency_key === task.idempotency_key) ||
        (ex.parent_task_id === parentTask.id && (ex.sort_order === task.sort_order || (ex as any).sequence_index === task.sequence_index))
      );
      return !alreadyExists;
    });

    if (neededInserts.length === 0) {
      // Idempotent guarantee: all stages already exist
      return { success: true, createdTasks: existingStages };
    }

    if (isMock) {
      if (Array.isArray(params.existingSubtasks)) {
        params.existingSubtasks.push(...(neededInserts as any[]));
      }
      return { success: true, createdTasks: neededInserts as any[] };
    }

    // Insert filtered stages into Postgres
    const { data, error } = await (activeClient as any)
      .from("project_tasks")
      .insert(neededInserts)
      .select("*");

    if (error) throw error;

    // Log activity only once upon creation
    await (activeClient as any).from("project_activity").insert({
      project_id: parentTask.project_id,
      task_id: parentTask.id,
      actor_id: currentUserId || null,
      action: "workflow_instantiated",
      details: {
        template_name: template.name,
        task_type: template.task_type,
        stages_created: neededInserts.length,
      },
    });

    return { success: true, createdTasks: data || neededInserts as any[] };
  } catch (err: any) {
    console.error("[instantiateWorkflowStages] Error:", err?.message || err);
    return { success: false, createdTasks: [], error: err.message || "Failed to instantiate workflow stages" };
  }
}

/**
 * Checks if a specific stage task is actionable right now.
 * Prerequisite rule: Later stages cannot become actionable before
 * previous required stages are completed / handed off.
 */
export function checkStageActionability(
  stageTask: TaskRow,
  siblingTasks: TaskRow[]
): {
  isActionable: boolean;
  isLocked: boolean;
  lockedReason?: string;
  lockedByStageTitle?: string;
  lockedByStageOrder?: number;
} {
  // If not a subtask / stage, it is always actionable
  if (!stageTask.parent_task_id) {
    return { isActionable: true, isLocked: false };
  }

  // If already completed or in review, it was already actionable
  if (stageTask.status === "done" || stageTask.status === "approved" || stageTask.status === "delivered") {
    return { isActionable: true, isLocked: false };
  }

  const stageOrder = stageTask.sort_order || 1;

  // First stage is always actionable
  if (stageOrder <= 1) {
    return { isActionable: true, isLocked: false };
  }

  // Find previous stages with sort_order < this task's sort_order
  const previousStages = siblingTasks
    .filter((t) => t.id !== stageTask.id && (t.sort_order || 0) < stageOrder)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Check if any previous stage is not done
  const incompletePrev = previousStages.find(
    (t) => t.status !== "done" && t.status !== "approved" && t.status !== "delivered"
  );

  if (incompletePrev) {
    return {
      isActionable: false,
      isLocked: true,
      lockedReason: `Prerequisite stage "${incompletePrev.title}" must be completed before starting this stage.`,
      lockedByStageTitle: incompletePrev.title,
      lockedByStageOrder: incompletePrev.sort_order || 1,
    };
  }

  return { isActionable: true, isLocked: false };
}

/**
 * Computes progress summary for a parent task based on its subtasks.
 */
export function computeWorkflowProgress(
  parentTaskId: string,
  allTasks: TaskRow[]
): WorkflowProgressSummary | null {
  const stages = allTasks
    .filter((t) => t.parent_task_id === parentTaskId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  if (stages.length === 0) return null;

  const totalStages = stages.length;
  const completedStages = stages.filter(
    (s) => s.status === "done" || s.status === "approved" || s.status === "delivered"
  ).length;

  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Active stage is the first incomplete stage
  const activeStage = stages.find(
    (s) => s.status !== "done" && s.status !== "approved" && s.status !== "delivered"
  );

  return {
    total_stages: totalStages,
    completed_stages: completedStages,
    progress_percent: progressPercent,
    current_stage_order: activeStage?.sort_order || totalStages,
    current_stage_title: activeStage?.title || "All Stages Completed",
    all_completed: completedStages === totalStages,
    stages: stages.map((s) => {
      const { isLocked } = checkStageActionability(s, stages);
      return {
        id: s.id,
        order: s.sort_order || 1,
        title: s.title,
        status: s.status,
        assignee_id: s.assignee_id,
        deadline: s.deadline,
        is_locked: isLocked,
        completed_at: s.completed_at,
      };
    }),
  };
}
