// ============================================================
// SADA OS — COMPLETE EDITING & HANDOFF TO PUBLISHING MODAL
// Phase 7: SADA Design System Dialog for Editing -> Publishing Handoff
// ============================================================

import React, { useState, useEffect } from "react";
import {
  SADADialog,
  SADAButton,
  SADAInput,
  SADATextarea,
  SADABadge,
  SADASelect,
} from "@/components/ui/sada-ui";
import {
  completeEditingAndHandoffToPublishing,
  isValidUrl,
  getAvailablePublishers,
  type TeamMemberLike,
} from "@/lib/publishing-workflow-service";
import type { TaskRow } from "@/components/admin/project-utils";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  Film,
  Share2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  UserCheck,
} from "lucide-react";

interface CompleteEditingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: TaskRow;
  parentTask?: TaskRow | null;
  teamMembers?: TeamMemberLike[];
  onCompleted?: () => void;
}

export function CompleteEditingModal({
  open,
  onOpenChange,
  editingTask,
  parentTask,
  teamMembers = [],
  onCompleted,
}: CompleteEditingModalProps) {
  const { user } = useAuth();
  const { isRTL } = useTranslation();
  const [driveUrl, setDriveUrl] = useState(
    editingTask.result_links?.[0] || (editingTask as any).drive_url || ""
  );
  const [notes, setNotes] = useState("");
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);

  const availablePublishers = getAvailablePublishers(teamMembers);

  useEffect(() => {
    if (editingTask.result_links?.[0]) {
      setDriveUrl(editingTask.result_links[0]);
    }
    if (availablePublishers.length > 0 && !selectedPublisherId) {
      setSelectedPublisherId(availablePublishers[0].id);
    }
  }, [editingTask, availablePublishers, selectedPublisherId]);

  const urlValid = isValidUrl(driveUrl);
  const showUrlError = urlTouched && !urlValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlTouched(true);

    if (!urlValid) {
      toast.error(
        isRTL
          ? "يرجى إدخال رابط تخزين سحابي صالح (Google Drive أو Dropbox أو غيرها)."
          : "Please provide a valid cloud Drive link (Google Drive, Dropbox, Frame.io, etc.)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeEditingAndHandoffToPublishing({
        editingTaskId: editingTask.id,
        actorId: user?.id || "system",
        driveUrl: driveUrl.trim(),
        notes: notes.trim() || undefined,
        customPublisherId: selectedPublisherId || undefined,
        parentTaskId: parentTask?.id,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to complete editing handoff");
        return;
      }

      toast.success(
        isRTL
          ? "تم إتمام المونتاج بنجاح! تم إرفاق رابط الدرايف وإحالة المهمة للنشر."
          : "Editing completed! Drive link attached and task handed off to publishing."
      );

      onOpenChange(false);
      if (onCompleted) {
        onCompleted();
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during handoff");
    } finally {
      setSubmitting(false);
    }
  };

  const footerContent = (
    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between w-full gap-2">
      <SADAButton
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={submitting}
        className="w-full sm:w-auto"
      >
        {isRTL ? "إلغاء" : "Cancel"}
      </SADAButton>
      <SADAButton
        type="button"
        variant="primary"
        disabled={submitting || !urlValid}
        onClick={handleSubmit}
        className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer w-full sm:w-auto justify-center"
      >
        <CheckCircle2 className="size-4 shrink-0" />
        <span className="truncate">
          {submitting
            ? isRTL
              ? "جاري التسليم..."
              : "Handing off..."
            : isRTL
            ? "إتمام المونتاج والإحالة للنشر"
            : "Complete & Hand Off"}
        </span>
      </SADAButton>
    </div>
  );

  return (
    <SADADialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      icon={<Film className="size-4 text-cyan-400" />}
      title={isRTL ? "إتمام المونتاج والإحالة للنشر" : "Complete Editing & Hand Off to Publishing"}
      description={
        parentTask
          ? `${isRTL ? "محتوى" : "Content"}: "${parentTask.title}"`
          : editingTask.title
      }
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Badges */}
        <div className="flex items-center gap-2">
          <SADABadge variant="outline" className="text-cyan-500 border-cyan-500/30 gap-1.5 px-2.5 py-0.5">
            <Film className="size-3.5" />
            <span>{isRTL ? "تسليم مرحلة المونتاج" : "Editing Handoff"}</span>
          </SADABadge>
          <SADABadge variant="outline" className="text-purple-400 border-purple-500/30 gap-1.5 px-2.5 py-0.5">
            <Share2 className="size-3.5" />
            <span>{isRTL ? "جاهز للنشر" : "Ready for Publishing"}</span>
          </SADABadge>
        </div>

        {/* Drive Link Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <LinkIcon className="size-3.5 text-cyan-400" />
              {isRTL ? "رابط ملفات المونتاج النهائية (Drive / Cloud Link)" : "Final Drive / Cloud Asset Link"}
              <span className="text-rose-500">*</span>
            </span>
            {urlValid && (
              <span className="text-emerald-500 text-[11px] flex items-center gap-1 font-mono">
                <CheckCircle2 className="size-3" />
                {isRTL ? "رابط صالح" : "Valid URL"}
              </span>
            )}
          </label>

          <SADAInput
            type="url"
            dir="ltr"
            required
            value={driveUrl}
            onChange={(e) => {
              setDriveUrl(e.target.value);
              if (!urlTouched) setUrlTouched(true);
            }}
            placeholder="https://drive.google.com/drive/folders/..."
            className={`font-mono text-xs ${showUrlError ? "border-rose-500 focus:ring-rose-500" : ""}`}
          />

          {showUrlError && (
            <p className="text-rose-500 text-[11px] flex items-center gap-1">
              <AlertCircle className="size-3" />
              {isRTL ? "يرجى تقديم رابط صالح يبدأ بـ https://" : "Must start with http:// or https://"}
            </p>
          )}

          <p className="text-muted-foreground text-[11px]">
            {isRTL
              ? "سيتم تخزين هذا الرابط على مهمة المونتاج وتحويله فوراً للمسؤول عن النشر لتحميل الفيديو ونشره."
              : "This link will be attached to the task so the Publisher has 1-click access to download and post."}
          </p>
        </div>

        {/* Publisher Configuration Selection */}
        {availablePublishers.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-purple-400" />
              {isRTL ? "المسؤول عن النشر المكلف" : "Assigned Publisher"}
            </label>
            <SADASelect
              value={selectedPublisherId}
              onChange={(val) => setSelectedPublisherId(val)}
              options={availablePublishers.map((p) => ({
                value: p.id,
                label: `${p.name || "Specialist"} (${p.position || "Publisher"})`,
              }))}
              placeholder={isRTL ? "اختر مسؤول النشر" : "Select publisher..."}
            />
          </div>
        )}

        {/* Editor Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {isRTL ? "ملاحظات إضافية للنشر (اختياري)" : "Publishing Notes / Captions / Instructions (Optional)"}
          </label>
          <SADATextarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isRTL
                ? "مثال: يرجى نشر الفيديو مع الهاشتاجات المرفقة في الموجز ومراجعة أول ثانية..."
                : "e.g. Please use the promotional caption from the brief and post at peak engagement..."
            }
            className="text-xs"
          />
        </div>

        {/* Workflow Invariant Notice */}
        <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-start gap-2.5">
          <Sparkles className="size-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">
              {isRTL ? "قاعدة مسار العمل:" : "Workflow Invariant:"}
            </p>
            <p>
              {isRTL
                ? "إنهاء المونتاج سيفتح مرحلة النشر فوراً ويُخطر المسؤول، لكن المحتوى الأساسي لن يُعتبر مكتملاً بنسبة 100% إلا بعد تأكيد النشر الفعلي."
                : "Completing editing makes the Publishing stage actionable. The parent deliverable remains in progress until the Publisher confirms live posting."}
            </p>
          </div>
        </div>
      </form>
    </SADADialog>
  );
}
