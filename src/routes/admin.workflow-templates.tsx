import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Workflow, Plus, Trash2, Edit3, ArrowUp, ArrowDown, CheckCircle2,
  Lock, Clock, Users, Shield, Sparkles, AlertCircle, Film, Palette,
  Globe, Zap, Layers, HelpCircle, Check, Info
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  fetchWorkflowTemplates,
  saveWorkflowTemplate,
  deleteWorkflowTemplate,
  CANONICAL_WORKFLOW_TEMPLATES,
} from "@/lib/workflow-service";
import type { WorkflowTemplate, WorkflowStageDefinition, WorkflowStageType } from "@/types/workflow";
import {
  SADACard,
  SADABadge,
  SADAButton,
  SADAInput,
  SADATextarea,
  SADASwitch,
  SADADialog,
  SADAConfirmDialog,
} from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";

export const Route = createFileRoute("/admin/workflow-templates")({
  component: WorkflowTemplatesAdminPage,
});

const ICON_MAP: Record<string, any> = {
  Film,
  Palette,
  Globe,
  Zap,
  Workflow,
  Layers,
};

const STAGE_TYPES: { value: WorkflowStageType; label: string; labelAr: string }[] = [
  { value: "brief", label: "Creative Brief / Specs", labelAr: "الموجز الإبداعي والمواصفات" },
  { value: "script", label: "Scenario / Script", labelAr: "السيناريو والنص الإبداعي" },
  { value: "shooting", label: "Shooting / Production", labelAr: "التصوير والإنتاج الميداني" },
  { value: "editing", label: "Editing / Post-Production", labelAr: "المونتاج والمعالجة الفنية" },
  { value: "design", label: "Graphic Design / Visuals", labelAr: "التصميم الجرافيكي والبصري" },
  { value: "development", label: "Development / Engineering", labelAr: "البرمجة والتطوير التقني" },
  { value: "qa", label: "QA & Testing", labelAr: "الفحص وضمان الجودة" },
  { value: "media_buying", label: "Targeting & Media Buying", labelAr: "الإعلانات والاستهداف الممول" },
  { value: "optimization", label: "Optimization & Reporting", labelAr: "التحسين الميداني والتقارير" },
  { value: "publishing", label: "Publishing & Delivery", labelAr: "النشر والاعتماد النهائي" },
  { value: "custom", label: "Custom Operation", labelAr: "مرحلة مخصصة" },
];

const SPECIALIST_ROLES = [
  { value: "copywriter", label: "Copywriter (كاتب محتوى)", labelAr: "كاتب نصوص ومحتوى" },
  { value: "videographer", label: "Videographer (مصور)", labelAr: "مصور فيديو وفوتوغراف" },
  { value: "editor", label: "Video Editor (مونتير)", labelAr: "مونتير ومعالج وسائط" },
  { value: "designer", label: "Graphic Designer (مصمم)", labelAr: "مصمم جرافيك وهويات" },
  { value: "developer", label: "Software Developer (مبرمج)", labelAr: "مطور برمجيات وأنظمة" },
  { value: "media_buyer", label: "Media Buyer (خبير إعلانات)", labelAr: "مدير حملات إعلانية ممولة" },
  { value: "account_manager", label: "Account Manager (مدير حساب)", labelAr: "مدير علاقات وحسابات" },
];

export function WorkflowTemplatesAdminPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Template Modal
  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  // Stage Modal
  const [editingStage, setEditingStage] = useState<WorkflowStageDefinition | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);

  // Delete Confirmation
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const list = await fetchWorkflowTemplates(true);
    setTemplates(list);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Access Control: Super Admin & Admin only
  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="size-16 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 grid place-items-center">
          <Shield className="size-8" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">
          {isAr ? "صلاحيات غير كافية" : "Restricted Access"}
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {isAr
            ? "تكوين مسارات العمل ونماذج المهام متاح فقط للمشرف العام والمدراء."
            : "Workflow templates and task type configurations are reserved for Super Admins and Admins."}
        </p>
      </div>
    );
  }

  const handleOpenNewTemplate = () => {
    const newTpl: WorkflowTemplate = {
      id: crypto.randomUUID(),
      task_type: `custom_${Date.now().toString().slice(-4)}`,
      name: "",
      name_ar: "",
      description: "",
      description_ar: "",
      icon: "Workflow",
      color: "purple",
      is_active: true,
      sort_order: templates.length + 1,
      stages: [
        {
          id: `stage-${Date.now()}-1`,
          title: "Creative Brief & Planning",
          title_ar: "الموجز والتخطيط",
          stage_type: "brief",
          order: 1,
          duration_days: 1,
          requires_previous_stage: false,
          assignment_rule: "project_lead",
          default_assignee_role: "account_manager",
          description: "Define objectives and requirements.",
        },
        {
          id: `stage-${Date.now()}-2`,
          title: "Execution & Production",
          title_ar: "التنفيذ والإنتاج",
          stage_type: "custom",
          order: 2,
          duration_days: 2,
          requires_previous_stage: true,
          assignment_rule: "specialist_role",
          default_assignee_role: "designer",
          description: "Execute the core deliverable.",
        },
        {
          id: `stage-${Date.now()}-3`,
          title: "Quality Review & Delivery",
          title_ar: "المراجعة والتسليم",
          stage_type: "publishing",
          order: 3,
          duration_days: 1,
          requires_previous_stage: true,
          assignment_rule: "specialist_role",
          default_assignee_role: "publisher",
          description: "Deliver final verified output to client.",
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActiveTemplate(newTpl);
    setIsEditingTemplate(false);
    setShowTemplateModal(true);
  };

  const handleOpenEditTemplate = (tpl: WorkflowTemplate) => {
    setActiveTemplate(JSON.parse(JSON.stringify(tpl)));
    setIsEditingTemplate(true);
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate || !activeTemplate.name.trim() || !activeTemplate.task_type.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم النموذج ومعرف نوع المهمة." : "Please fill out the template name and task type key.");
      return;
    }

    if (activeTemplate.stages.length === 0) {
      toast.error(isAr ? "يجب أن يحتوي مسار العمل على مرحلة واحدة على الأقل." : "A workflow template must contain at least 1 stage.");
      return;
    }

    setSaving(true);
    const res = await saveWorkflowTemplate({
      template: activeTemplate,
      changedById: user?.id,
      changeReason: isEditingTemplate ? `Updated template ${activeTemplate.name}` : `Created template ${activeTemplate.name}`,
    });

    if (res.success) {
      toast.success(isAr ? "تم حفظ مسار العمل بنجاح!" : "Workflow template saved successfully!");
      setShowTemplateModal(false);
      await loadData();
    } else {
      toast.error(res.error || (isAr ? "فشل حفظ مسار العمل" : "Failed to save workflow template"));
    }
    setSaving(false);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setSaving(true);
    const res = await deleteWorkflowTemplate({
      templateId: templateToDelete,
      changedById: user?.id,
    });
    if (res.success) {
      toast.success(isAr ? "تم حذف النموذج." : "Template deleted successfully.");
      setTemplateToDelete(null);
      await loadData();
    } else {
      toast.error(res.error || "Failed to delete");
    }
    setSaving(false);
  };

  // Stage Manipulation in Active Template
  const handleMoveStage = (index: number, direction: "up" | "down") => {
    if (!activeTemplate) return;
    const stages = [...activeTemplate.stages];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= stages.length) return;

    const temp = stages[index];
    stages[index] = stages[targetIdx];
    stages[targetIdx] = temp;

    // Recalculate order numbers 1..N
    const reordered = stages.map((s, idx) => ({
      ...s,
      order: idx + 1,
      requires_previous_stage: idx === 0 ? false : s.requires_previous_stage,
    }));

    setActiveTemplate({ ...activeTemplate, stages: reordered });
  };

  const handleRemoveStage = (index: number) => {
    if (!activeTemplate) return;
    if (activeTemplate.stages.length <= 1) {
      toast.error(isAr ? "لا يمكن حذف المرحلة الأخيرة." : "Cannot remove the only stage.");
      return;
    }
    const filtered = activeTemplate.stages.filter((_, idx) => idx !== index);
    const reordered = filtered.map((s, idx) => ({
      ...s,
      order: idx + 1,
      requires_previous_stage: idx === 0 ? false : s.requires_previous_stage,
    }));
    setActiveTemplate({ ...activeTemplate, stages: reordered });
  };

  const handleOpenAddStage = () => {
    if (!activeTemplate) return;
    const newOrder = activeTemplate.stages.length + 1;
    const newStage: WorkflowStageDefinition = {
      id: `stage-${Date.now()}-${newOrder}`,
      title: "",
      title_ar: "",
      stage_type: "custom",
      order: newOrder,
      duration_days: 1,
      requires_previous_stage: true,
      assignment_rule: "specialist_role",
      default_assignee_role: "designer",
      description: "",
    };
    setEditingStage(newStage);
    setShowStageModal(true);
  };

  const handleSaveStageModal = () => {
    if (!activeTemplate || !editingStage || !editingStage.title.trim()) {
      toast.error(isAr ? "يرجى كتابة عنوان المرحلة." : "Stage title is required.");
      return;
    }

    const stages = [...activeTemplate.stages];
    const existingIdx = stages.findIndex((s) => s.id === editingStage.id);

    if (existingIdx >= 0) {
      stages[existingIdx] = editingStage;
    } else {
      stages.push(editingStage);
    }

    // Re-sort and normalize order numbers
    stages.sort((a, b) => a.order - b.order);
    const normalized = stages.map((s, idx) => ({
      ...s,
      order: idx + 1,
      requires_previous_stage: idx === 0 ? false : s.requires_previous_stage,
    }));

    setActiveTemplate({ ...activeTemplate, stages: normalized });
    setShowStageModal(false);
    setEditingStage(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center">
              <Workflow className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">
                {isAr ? "نماذج ومسارات العمل القابلة للتهيئة" : "Configurable Workflow Engine"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "تحديد أنواع المهام، تسلسل المراحل، قواعد التكليف، والاعتماديات المشروطة."
                  : "Super Admin control for task types, ordered stages, assignment rules, and prerequisite dependencies."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SADAButton
            onClick={handleOpenNewTemplate}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="size-4" />
            <span>{isAr ? "إنشاء مسار عمل جديد" : "New Workflow Template"}</span>
          </SADAButton>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3.5 text-xs text-muted-foreground">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">
            {isAr ? "هندسة مسارات العمل المرنة (Workflow Engine)" : "Configuration-Driven Architecture:"}
          </span>
          <p>
            {isAr
              ? "نوع المهمة → نموذج مسار العمل → المراحل المرتبة → إنشاء المهمة الأم → توليد مهام المراحل التلقائية. لا يمكن للمنفذ البدء في المراحل التالية قبل اعتماد أو إنجاز المراحل السابقة."
              : "Task Type → Workflow Template → Ordered Stages → Parent Task → Stage Instances. Downstream stages remain strictly locked until prerequisite stages are completed and handed off."}
          </p>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-muted/40 animate-pulse border border-border" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card space-y-3">
          <Workflow className="size-10 mx-auto text-muted-foreground opacity-50" />
          <h3 className="text-base font-bold text-foreground">
            {isAr ? "لا توجد نماذج مسارات عمل حالياً" : "No Workflow Templates Found"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isAr ? "اضغط على الزر أعلاه لإنشاء أول نموذج." : "Click above to create your first workflow template."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {templates.map((tpl) => {
            const IconComp = ICON_MAP[tpl.icon] || Workflow;
            return (
              <SADACard
                key={tpl.id}
                className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 sm:space-y-6 shadow-xs hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
                        <IconComp className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-foreground font-display truncate max-w-full">
                            {isAr && tpl.name_ar ? tpl.name_ar : tpl.name}
                          </h3>
                          <SADABadge variant="outline" className="text-[10px] font-mono uppercase font-bold shrink-0">
                            {tpl.task_type}
                          </SADABadge>
                          {!tpl.is_active && (
                            <SADABadge variant="danger" className="text-[10px] shrink-0">
                              {isAr ? "معطل" : "Disabled"}
                            </SADABadge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {isAr && tpl.description_ar ? tpl.description_ar : tpl.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <SADAButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditTemplate(tpl)}
                        className="size-8 p-0 rounded-xl"
                        title={isAr ? "تعديل النموذج" : "Configure Stages"}
                      >
                        <Edit3 className="size-4 text-muted-foreground hover:text-foreground" />
                      </SADAButton>
                      <SADAButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setTemplateToDelete(tpl.id)}
                        className="size-8 p-0 rounded-xl text-rose-500 hover:bg-rose-500/10"
                        title={isAr ? "حذف النموذج" : "Delete"}
                      >
                        <Trash2 className="size-4" />
                      </SADAButton>
                    </div>
                  </div>

                  {/* Stage Pipeline Stepper Preview */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider text-[10px] font-mono">
                        {isAr ? `مراحل التنفيذ (${tpl.stages.length})` : `Workflow Stages (${tpl.stages.length})`}
                      </span>
                      <span>
                        {isAr
                          ? `إجمالي المدة: ${tpl.stages.reduce((sum, s) => sum + s.duration_days, 0)} أيام`
                          : `Total Est: ${tpl.stages.reduce((sum, s) => sum + s.duration_days, 0)} days`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {tpl.stages.map((stg) => (
                        <div
                          key={stg.id}
                          className="p-2.5 rounded-2xl bg-muted/30 border border-border/70 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-5 rounded-full bg-primary/10 text-primary font-bold font-mono text-[10px] grid place-items-center shrink-0">
                              {stg.order}
                            </span>
                            <span className="font-semibold truncate text-foreground text-xs">
                              {isAr && stg.title_ar ? stg.title_ar : stg.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {stg.requires_previous_stage ? (
                              <span
                                className="text-[10px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-0.5"
                                title={isAr ? "تعتمد على المرحلة السابقة" : "Prerequisite Dependency"}
                              >
                                <Lock className="size-2.5" />
                              </span>
                            ) : (
                              <span
                                className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"
                                title={isAr ? "مرحلة انطلاق مستقلة" : "Initial Stage"}
                              >
                                <CheckCircle2 className="size-2.5" />
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {stg.duration_days}d
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {isAr ? "محدث:" : "Updated:"} {new Date(tpl.updated_at).toLocaleDateString()}
                  </span>
                  <SADAButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditTemplate(tpl)}
                    className="text-xs font-semibold rounded-xl"
                  >
                    {isAr ? "إدارة المراحل" : "Configure Stages"}
                  </SADAButton>
                </div>
              </SADACard>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CREATE / EDIT WORKFLOW TEMPLATE                       */}
      {/* ============================================================== */}
      {showTemplateModal && activeTemplate && (
        <SADADialog
          open={showTemplateModal}
          onOpenChange={setShowTemplateModal}
          title={
            isEditingTemplate
              ? (isAr ? `تهيئة مسار: ${activeTemplate.name}` : `Configure Template: ${activeTemplate.name}`)
              : (isAr ? "إنشاء مسار عمل جديد" : "New Workflow Template")
          }
          description={
            isAr
              ? "أضف المراحل، رتّب تسلسلها، وعيّن قواعد التكليف والاعتماديات المشروطة."
              : "Define ordered execution stages, duration offsets, role assignments, and prerequisite guards."
          }
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <div className="space-y-6 pt-2 text-start">
            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "اسم مسار العمل (English) *" : "Template Name (English) *"}
                </label>
                <SADAInput
                  value={activeTemplate.name}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, name: e.target.value })}
                  placeholder="e.g. Commercial Reel Production"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "اسم مسار العمل (العربية)" : "Template Name (Arabic)"}
                </label>
                <SADAInput
                  value={activeTemplate.name_ar || ""}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, name_ar: e.target.value })}
                  placeholder="مثال: إنتاج فيديو ريل تجاري"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "معرّف نوع المهمة (Task Type Slug) *" : "Task Type Key (Unique Slug) *"}
                </label>
                <SADAInput
                  value={activeTemplate.task_type}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, task_type: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="e.g. reel, branding, landing_page"
                  disabled={isEditingTemplate}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "الأيقونة" : "Icon Identifier"}
                </label>
                <SADASelect
                  value={activeTemplate.icon}
                  onChange={(val) => setActiveTemplate({ ...activeTemplate, icon: val })}
                  options={[
                    { value: "Film", label: "Film (فيديو وريلز)" },
                    { value: "Palette", label: "Palette (تصميم وجرافيك)" },
                    { value: "Globe", label: "Globe (مواقع وتطبيقات)" },
                    { value: "Zap", label: "Zap (إعلانات ممولة)" },
                    { value: "Workflow", label: "Workflow (عام / مخصص)" },
                  ]}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "الوصف التشغيلي" : "Operational Description"}
                </label>
                <SADATextarea
                  rows={2}
                  value={activeTemplate.description}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, description: e.target.value })}
                  placeholder="Describe the workflow purpose, deliverables, and targets..."
                />
              </div>

              <div className="flex items-center gap-3 sm:col-span-2 pt-1">
                <SADASwitch
                  checked={activeTemplate.is_active}
                  onCheckedChange={(checked) => setActiveTemplate({ ...activeTemplate, is_active: checked })}
                />
                <span className="text-xs font-semibold text-foreground">
                  {isAr ? "تفعيل النموذج لاختياره عند إنشاء المهام" : "Enable template for deliverable task creation"}
                </span>
              </div>
            </div>

            {/* Ordered Stages Section */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground font-display">
                    {isAr ? "مراحل مسار العمل المرتبة" : "Ordered Workflow Stages"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr
                      ? "المراحل مرتبة تسلسلياً. لا يمكن للمنفذ بدء المرحلة اللاحقة قبل اكتمال السابقة."
                      : "Strict sequential order. Workers cannot start later stages before previous ones complete."}
                  </p>
                </div>

                <SADAButton
                  size="sm"
                  onClick={handleOpenAddStage}
                  className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                >
                  <Plus className="size-3.5" />
                  <span>{isAr ? "إضافة مرحلة" : "Add Stage"}</span>
                </SADAButton>
              </div>

              {/* Stages List */}
              <div className="space-y-2">
                {activeTemplate.stages.map((stg, idx) => (
                  <div
                    key={stg.id}
                    className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-3 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-7 rounded-xl bg-primary/10 text-primary font-bold font-mono text-xs grid place-items-center shrink-0">
                        {stg.order}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-foreground truncate">
                            {stg.title}
                          </span>
                          {stg.title_ar && (
                            <span className="text-[11px] text-muted-foreground truncate" dir="rtl">
                              ({stg.title_ar})
                            </span>
                          )}
                          <SADABadge variant="outline" className="text-[10px] font-mono">
                            {stg.stage_type}
                          </SADABadge>
                          {stg.requires_previous_stage ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold flex items-center gap-1">
                              <Lock className="size-2.5" /> {isAr ? `تتطلب مرحلة ${stg.order - 1}` : `Requires Stage ${stg.order - 1}`}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                              {isAr ? "مرحلة بداية" : "Initial Stage"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 font-mono">
                          <span>⏱ {stg.duration_days} {isAr ? "يوم" : "days"}</span>
                          <span>👤 {stg.default_assignee_role || "Specialist"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stage Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <SADAButton
                        variant="ghost"
                        size="sm"
                        disabled={idx === 0}
                        onClick={() => handleMoveStage(idx, "up")}
                        className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title={isAr ? "تقديم للأعلى" : "Move Up"}
                      >
                        <ArrowUp className="size-3.5" />
                      </SADAButton>

                      <SADAButton
                        variant="ghost"
                        size="sm"
                        disabled={idx === activeTemplate.stages.length - 1}
                        onClick={() => handleMoveStage(idx, "down")}
                        className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title={isAr ? "تأخير للأسفل" : "Move Down"}
                      >
                        <ArrowDown className="size-3.5" />
                      </SADAButton>

                      <SADAButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingStage({ ...stg });
                          setShowStageModal(true);
                        }}
                        className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                        title={isAr ? "تعديل المرحلة" : "Edit"}
                      >
                        <Edit3 className="size-3.5" />
                      </SADAButton>

                      <SADAButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStage(idx)}
                        className="size-7 p-0 rounded-lg text-rose-500 hover:bg-rose-500/10"
                        title={isAr ? "حذف المرحلة" : "Remove"}
                      >
                        <Trash2 className="size-3.5" />
                      </SADAButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <SADAButton
                variant="outline"
                onClick={() => setShowTemplateModal(false)}
                disabled={saving}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton
                onClick={handleSaveTemplate}
                disabled={saving}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {saving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Template")}
              </SADAButton>
            </div>
          </div>
        </SADADialog>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: STAGE EDITOR MODAL                                    */}
      {/* ============================================================== */}
      {showStageModal && editingStage && (
        <SADADialog
          open={showStageModal}
          onOpenChange={setShowStageModal}
          title={isAr ? `تعديل المرحلة ${editingStage.order}` : `Configure Stage #${editingStage.order}`}
          description={
            isAr
              ? "حدد عنوان المرحلة، نوعها، المدة المقترحة، ودور المنفذ."
              : "Specify stage title, classification, estimated duration, and assignment rule."
          }
          className="max-w-md"
        >
          <div className="space-y-4 pt-2 text-start">
            <div>
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                {isAr ? "عنوان المرحلة (English) *" : "Stage Title (English) *"}
              </label>
              <SADAInput
                value={editingStage.title}
                onChange={(e) => setEditingStage({ ...editingStage, title: e.target.value })}
                placeholder="e.g. Scenario / Script"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                {isAr ? "عنوان المرحلة (العربية)" : "Stage Title (Arabic)"}
              </label>
              <SADAInput
                value={editingStage.title_ar || ""}
                onChange={(e) => setEditingStage({ ...editingStage, title_ar: e.target.value })}
                placeholder="مثال: السيناريو والنص الإبداعي"
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "تصنيف المرحلة" : "Stage Type"}
                </label>
                <SADASelect
                  value={editingStage.stage_type}
                  onChange={(val) => setEditingStage({ ...editingStage, stage_type: val })}
                  options={STAGE_TYPES.map((t) => ({
                    value: t.value,
                    label: isAr ? t.labelAr : t.label,
                  }))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                  {isAr ? "المدة المقترحة (أيام)" : "Duration (Days)"}
                </label>
                <SADAInput
                  type="number"
                  min="1"
                  max="30"
                  value={editingStage.duration_days}
                  onChange={(e) => setEditingStage({ ...editingStage, duration_days: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                {isAr ? "دور المنفذ الافتراضي" : "Default Specialist Role"}
              </label>
              <SADASelect
                value={editingStage.default_assignee_role || "designer"}
                onChange={(val) => setEditingStage({ ...editingStage, default_assignee_role: val })}
                options={SPECIALIST_ROLES.map((r) => ({
                  value: r.value,
                  label: isAr ? r.labelAr : r.label,
                }))}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <SADASwitch
                checked={editingStage.requires_previous_stage}
                disabled={editingStage.order === 1}
                onCheckedChange={(checked) => setEditingStage({ ...editingStage, requires_previous_stage: checked })}
              />
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  {isAr ? "اعتماد مشروط على المرحلة السابقة" : "Prerequisite Dependency Lock"}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {editingStage.order === 1
                    ? (isAr ? "المرحلة الأولى تبدأ مباشرة." : "First stage is always immediately actionable.")
                    : (isAr ? "لا يمكن بدء هذه المرحلة إلا بعد إنجاز المرحلة السابقة." : "Cannot start this stage until the previous stage is completed.")}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-muted-foreground font-bold mb-1">
                {isAr ? "التعليمات والتوجيهات التشغيلية" : "Instructions / Guidelines"}
              </label>
              <SADATextarea
                rows={2}
                value={editingStage.description || ""}
                onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                placeholder="Specific guidance for the assigned worker..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <SADAButton variant="outline" onClick={() => setShowStageModal(false)}>
                {isAr ? "إلغاء" : "Cancel"}
              </SADAButton>
              <SADAButton onClick={handleSaveStageModal} className="bg-primary text-primary-foreground font-semibold">
                {isAr ? "حفظ المرحلة" : "Done"}
              </SADAButton>
            </div>
          </div>
        </SADADialog>
      )}

      {/* Delete Confirmation Dialog */}
      <SADAConfirmDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        title={isAr ? "تأكيد حذف نموذج مسار العمل" : "Delete Workflow Template?"}
        description={
          isAr
            ? "هل أنت متأكد من رغبتك في حذف هذا النموذج؟ السجلات والمهام التاريخية التي تم إنشاؤها مسبقاً ستبقى محفوظة بصورة دائمة."
            : "Are you sure you want to delete this template? Historical task stages already created will remain permanently preserved."
        }
        confirmLabel={isAr ? "تأكيد الحذف" : "Delete Template"}
        cancelLabel={isAr ? "إلغاء" : "Cancel"}
        variant="destructive"
        onConfirm={handleDeleteTemplate}
      />
    </div>
  );
}
