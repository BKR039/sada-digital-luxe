import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  Workflow,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Film,
  Camera,
  FileText,
  Share2,
} from "lucide-react";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAButton } from "@/components/ui/sada-ui";
import { SADAInput } from "@/components/ui/sada-ui";
import { SADACounter } from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import type {
  ServiceCommitment,
  CommitmentFrequency,
  CommitmentLifecycleStatus,
  AssignmentRule,
} from "@/types/service-commitment";
import {
  CANONICAL_SERVICE_COMMITMENT_PRESETS,
  saveServiceCommitment,
} from "@/lib/recurring-scheduling-service";
import { reconcileSingleCommitmentWork } from "@/lib/package-reconciliation-service";
import {
  fetchWorkflowTemplates,
  type WorkflowTemplate,
} from "@/lib/workflow-service";
import type { ProfileRow, TeamMemberRow } from "./project-utils";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  packageId?: string | null;
  profiles: ProfileRow[];
  teamMembers: TeamMemberRow[];
  existingCommitment?: ServiceCommitment | null;
  onSaved: () => void;
}

export function ServiceCommitmentModal({
  open,
  onClose,
  clientId,
  clientName,
  packageId,
  profiles,
  teamMembers,
  existingCommitment,
  onSaved,
}: Props) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");

  // Form Fields
  const [serviceName, setServiceName] = useState("");
  const [deliverableType, setDeliverableType] = useState("custom");
  const [quantity, setQuantity] = useState(1);
  const [frequency, setFrequency] = useState<CommitmentFrequency>("monthly");
  const [durationHours, setDurationHours] = useState(2.0);
  const [preferredTime, setPreferredTime] = useState("10:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([2, 4]); // Tue, Thu
  const [daysOfMonthStr, setDaysOfMonthStr] = useState("5, 20");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentRule, setAssignmentRule] = useState<AssignmentRule>("specialist_role");
  const [defaultRole, setDefaultRole] = useState("videographer");
  const [workflowTemplateId, setWorkflowTemplateId] = useState("");
  const [status, setStatus] = useState<CommitmentLifecycleStatus>("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkflowTemplates().then((tpls) => {
      setWorkflowTemplates(tpls);
    });
  }, []);

  useEffect(() => {
    if (existingCommitment) {
      setSelectedPreset("custom");
      setServiceName(existingCommitment.service_name || "");
      setDeliverableType(existingCommitment.deliverable_type || "reels_shooting");
      setQuantity(existingCommitment.quantity || 1);
      setFrequency(existingCommitment.frequency || "monthly");
      setDurationHours(existingCommitment.duration_hours || 2.0);
      setPreferredTime(existingCommitment.preferred_time || "10:00");
      setStartDate(existingCommitment.start_date || format(new Date(), "yyyy-MM-dd"));
      setEndDate(existingCommitment.end_date || "");
      setAssigneeId(existingCommitment.assignee_id || "");
      setAssignmentRule(existingCommitment.assignment_rule || "specialist_role");
      setDefaultRole(existingCommitment.default_role || "videographer");
      setWorkflowTemplateId(existingCommitment.workflow_template_id || "");
      setStatus(existingCommitment.status || existingCommitment.lifecycle_status || "active");
      setNotes(existingCommitment.notes || "");

      if (existingCommitment.schedule_rule?.days_of_week) {
        setDaysOfWeek(existingCommitment.schedule_rule.days_of_week);
      }
      if (existingCommitment.schedule_rule?.days_of_month) {
        setDaysOfMonthStr(existingCommitment.schedule_rule.days_of_month.join(", "));
      }
    } else {
      // Default new
      setSelectedPreset("stories");
      applyPreset("Stories Shooting");
    }
  }, [existingCommitment, open]);

  const applyPreset = (presetName: string) => {
    const preset = CANONICAL_SERVICE_COMMITMENT_PRESETS.find((p) => p.service_name === presetName);
    if (!preset) return;

    setServiceName(preset.service_name);
    setDeliverableType(preset.deliverable_type);
    setQuantity(preset.quantity);
    setFrequency(preset.frequency);
    setDurationHours(preset.duration_hours);
    setDefaultRole(preset.default_role);

    if (preset.default_days_of_week) {
      setDaysOfWeek(preset.default_days_of_week);
    }
    if (preset.default_days_of_month) {
      setDaysOfMonthStr(preset.default_days_of_month.join(", "));
    }

    // Match workflow template by type if available
    if (preset.workflow_type && workflowTemplates.length > 0) {
      const matchedTpl = workflowTemplates.find((t) => t.task_type === preset.workflow_type);
      if (matchedTpl) {
        setWorkflowTemplateId(matchedTpl.id);
      }
    }
  };

  const handlePresetSelect = (val: string) => {
    setSelectedPreset(val);
    if (val !== "custom") {
      applyPreset(val);
    }
  };

  const toggleDayOfWeek = (dayNum: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      toast.error(isAr ? "يرجى تحديد اسم الخدمة" : "Please provide a service name");
      return;
    }
    if (quantity < 1) {
      toast.error(isAr ? "الكمية يجب أن تكون 1 على الأقل" : "Quantity must be at least 1");
      return;
    }

    // Parse days of month numbers
    const parsedDaysOfMonth = daysOfMonthStr
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 31);

    setSaving(true);
    const res = await saveServiceCommitment({
      id: existingCommitment?.id,
      client_id: clientId,
      package_id: packageId || existingCommitment?.package_id,
      service_name: serviceName.trim(),
      deliverable_type: deliverableType,
      quantity,
      frequency,
      schedule_rule: {
        frequency,
        quantity,
        days_of_week: frequency === "weekly" ? daysOfWeek : undefined,
        days_of_month: frequency === "monthly" ? parsedDaysOfMonth : undefined,
        preferred_time: preferredTime,
        duration_hours: durationHours,
      },
      start_date: startDate,
      end_date: endDate || null,
      preferred_time: preferredTime,
      duration_hours: durationHours,
      assignee_id: assigneeId || null,
      assignment_rule: assignmentRule,
      default_role: defaultRole,
      workflow_template_id: workflowTemplateId || null,
      task_type: deliverableType,
      status,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (res.success) {
      if (existingCommitment && res.data) {
        // Automatically reconcile future tasks for this commitment
        try {
          const recResult = await reconcileSingleCommitmentWork({
            clientId,
            commitment: res.data,
          });

          if (recResult.tasks_created > 0 || recResult.tasks_pruned > 0 || recResult.tasks_rescheduled > 0) {
            toast.info(
              isAr
                ? `تمت تسوية مهام التقويم: ${recResult.tasks_created > 0 ? `+${recResult.tasks_created} جديدة ` : ""}${recResult.tasks_pruned > 0 ? `-${recResult.tasks_pruned} مقلصة ` : ""}(تم الحفاظ على ${recResult.history_preserved} تسليم سابق)`
                : `Calendar work reconciled: ${recResult.tasks_created > 0 ? `+${recResult.tasks_created} created ` : ""}${recResult.tasks_pruned > 0 ? `-${recResult.tasks_pruned} pruned ` : ""}(${recResult.history_preserved} completed preserved)`
            );
          }
        } catch (recErr) {
          console.warn("Non-blocking commitment reconciliation notice:", recErr);
        }
      }

      toast.success(
        isAr ? "تم حفظ الالتزام التعاقدي للخدمة بنجاح" : "Service commitment saved successfully"
      );
      onSaved();
      onClose();
    } else {
      toast.error(res.error || (isAr ? "فشل حفظ الالتزام" : "Failed to save commitment"));
    }
  };

  const DAYS_OF_WEEK_OPTIONS = [
    { num: 1, label: isAr ? "الإثنين" : "Mon" },
    { num: 2, label: isAr ? "الثلاثاء" : "Tue" },
    { num: 3, label: isAr ? "الأربعاء" : "Wed" },
    { num: 4, label: isAr ? "الخميس" : "Thu" },
    { num: 5, label: isAr ? "الجمعة" : "Fri" },
    { num: 6, label: isAr ? "السبت" : "Sat" },
    { num: 7, label: isAr ? "الأحد" : "Sun" },
  ];

  return (
    <SADADialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      size="large"
      title={
        existingCommitment
          ? isAr
            ? "تعديل الالتزام التعاقدي للخدمة"
            : "Edit Service Commitment"
          : isAr
          ? "إضافة التزام تعاقدي لخدمة متكررة"
          : "Add Recurring Service Commitment"
      }
      description={
        isAr
          ? `جدولة التسليمات التعاقدية للعميل ${clientName}`
          : `Define contract deliverable scheduling rules for ${clientName}`
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Presets Strip */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-display">
            <Sparkles className="size-3.5 text-primary" />
            {isAr ? "قوالب التزامات الباقات القياسية:" : "Canonical Package Presets:"}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CANONICAL_SERVICE_COMMITMENT_PRESETS.map((preset) => (
              <button
                key={preset.service_name}
                type="button"
                onClick={() => handlePresetSelect(preset.service_name)}
                className={`p-2.5 rounded-xl border text-start text-xs transition-all cursor-pointer ${
                  selectedPreset === preset.service_name
                    ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                    : "bg-card border-border hover:bg-muted text-foreground"
                }`}
              >
                <div className="truncate font-semibold">{isAr ? preset.description_ar : preset.service_name}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {preset.quantity}x {preset.frequency}
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedPreset("custom")}
              className={`p-2.5 rounded-xl border text-start text-xs transition-all cursor-pointer ${
                selectedPreset === "custom"
                  ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                  : "bg-card border-border hover:bg-muted text-foreground"
              }`}
            >
              <div className="font-semibold">{isAr ? "خدمة مخصصة" : "Custom Service"}</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {isAr ? "تحديد حر" : "Freeform"}
              </div>
            </button>
          </div>
        </div>

        {/* Row 1: Service Name & Deliverable Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "اسم الخدمة / التسليم" : "Service / Deliverable Name"} <span className="text-destructive">*</span>
            </label>
            <SADAInput
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder={isAr ? "مثال: تصوير الستوري الأسبوعي" : "e.g. Stories Shooting"}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "نوع التسليم" : "Deliverable Type"}
            </label>
            <SADASelect
              value={deliverableType}
              onChange={(v) => setDeliverableType(v)}
              options={[
                { value: "stories_shooting", label: isAr ? "تصوير ستوري" : "Stories Shooting" },
                { value: "reels_shooting", label: isAr ? "تصوير ريلز" : "Reels Shooting" },
                { value: "post", label: isAr ? "منشور سوشيال ميديا" : "Social Media Post" },
                { value: "photography", label: isAr ? "جلسة تصوير فوتوغرافي" : "Photography Session" },
                { value: "reel", label: isAr ? "فيديو ريل متكامل" : "Full Reel Deliverable" },
                { value: "ads", label: isAr ? "إعلانات ممولة" : "Paid Ads Campaign" },
                { value: "custom", label: isAr ? "أخرى / مخصصة" : "Other / Custom" },
              ]}
            />
          </div>
        </div>

        {/* Row 2: Frequency & Quantity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "التكرار الزمني" : "Frequency"}
            </label>
            <SADASelect
              value={frequency}
              onChange={(v) => setFrequency(v as CommitmentFrequency)}
              options={[
                { value: "weekly", label: isAr ? "أسبوعي (أيام محددة)" : "Weekly (e.g. 2x/week)" },
                { value: "monthly", label: isAr ? "شهري (أيام أو حصة)" : "Monthly (e.g. 2 days or 8/mo)" },
                { value: "bi_weekly", label: isAr ? "كل أسبوعين" : "Bi-weekly" },
                { value: "daily", label: isAr ? "يومي (أيام العمل)" : "Daily" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "الكمية الملتزم بها" : "Committed Quantity"}
            </label>
            <SADACounter
              value={quantity}
              onChange={(val) => setQuantity(val)}
              min={1}
              max={100}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "المدة التقديرية (ساعات)" : "Duration (Hours)"}
            </label>
            <SADAInput
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={durationHours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Contextual Frequency Details */}
        {frequency === "weekly" && (
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              {isAr ? "أيام الأسبوع المجدولة للتنفيذ:" : "Scheduled Days of Week:"}
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DAYS_OF_WEEK_OPTIONS.map((d) => (
                <button
                  key={d.num}
                  type="button"
                  onClick={() => toggleDayOfWeek(d.num)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    daysOfWeek.includes(d.num)
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {isAr
                ? `سيتم توليد المهمات تلقائياً في أيام: ${daysOfWeek.join("، ")} من كل أسبوع`
                : `Deliverables will be generated on selected days each week`}
            </p>
          </div>
        )}

        {frequency === "monthly" && (
          <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              {isAr ? "أيام الشهر المحددة (اختياري، مفصولة بفواصل):" : "Specific Days of Month (optional, comma-separated):"}
            </label>
            <SADAInput
              value={daysOfMonthStr}
              onChange={(e) => setDaysOfMonthStr(e.target.value)}
              placeholder="e.g. 5, 20"
            />
            <p className="text-[10px] text-muted-foreground">
              {isAr
                ? "إذا تركت فارغة، سيتم توزيع الكمية بانتظام على مدار أسابيع الشهر."
                : "Leave empty to distribute evenly across month weeks."}
            </p>
          </div>
        )}

        {/* Row 3: Lifecycle Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "تاريخ بدء الالتزام" : "Start Date"} <span className="text-destructive">*</span>
            </label>
            <SADADatePicker
              value={startDate}
              onChange={(v) => setStartDate(v)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "تاريخ الانتهاء (اختياري)" : "End Date (Optional)"}
            </label>
            <SADADatePicker
              value={endDate}
              onChange={(v) => setEndDate(v)}
            />
          </div>
        </div>

        {/* Row 4: Assignment & Workflow Engine Linkage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              {isAr ? "المنفّذ المكلّف الافتراضي" : "Default Assigned Specialist"}
            </label>
            <SADASelect
              value={assigneeId}
              onChange={(v) => setAssigneeId(v)}
              options={[
                { value: "", label: isAr ? "مطابقة تلقائية حسب التخصص" : "Auto-match by Specialist Role" },
                ...teamMembers.map((m) => ({
                  value: m.profile_id || m.id,
                  label: `${m.name} (${m.position || m.role || ""})`,
                })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Workflow className="size-3.5 text-primary" />
              {isAr ? "مسار العمل المرتبط (توليد المراحل)" : "Attached Workflow Template"}
            </label>
            <SADASelect
              value={workflowTemplateId}
              onChange={(v) => setWorkflowTemplateId(v)}
              options={[
                { value: "", label: isAr ? "بدون مسار مراحل (مهمة مفردة)" : "None (Single Task Deliverable)" },
                ...workflowTemplates.map((t) => ({
                  value: t.id,
                  label: `${isAr && t.name_ar ? t.name_ar : t.name} (${t.stages.length} ${isAr ? "مراحل" : "stages"})`,
                })),
              ]}
            />
          </div>
        </div>

        {/* Row 5: Lifecycle Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "حالة الالتزام الحالية" : "Commitment Status"}
            </label>
            <SADASelect
              value={status}
              onChange={(v) => setStatus(v as CommitmentLifecycleStatus)}
              options={[
                { value: "active", label: isAr ? "نشط (توليد مستمر)" : "Active (Continuous Generation)" },
                { value: "paused", label: isAr ? "معلق مؤقتاً (إيقاف دون حذف التاريخ)" : "Paused (Suspended, History Preserved)" },
                { value: "inactive", label: isAr ? "غير نشط (إيقاف نهائي)" : "Inactive (Stopped, History Preserved)" },
                { value: "completed", label: isAr ? "منجز / مكتمل" : "Completed" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {isAr ? "الوقت المفضل للتنفيذ" : "Preferred Time"}
            </label>
            <SADAInput
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
            />
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <SADAButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          <SADAButton
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving
              ? isAr
                ? "جاري الحفظ..."
                : "Saving..."
              : existingCommitment
              ? isAr
                ? "تحديث الالتزام"
                : "Update Commitment"
              : isAr
              ? "إنشاء الالتزام"
              : "Create Commitment"}
          </SADAButton>
        </div>
      </form>
    </SADADialog>
  );
}
