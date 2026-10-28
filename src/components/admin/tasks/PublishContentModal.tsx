// ============================================================
// SADA OS — PUBLISH CONTENT MODAL
// Phase 7: SADA Design System Dialog for Publisher Action & Live Social Posting
// ============================================================

import React, { useState, useEffect } from "react";
import {
  SADADialog,
  SADAButton,
  SADAInput,
  SADATextarea,
  SADABadge,
} from "@/components/ui/sada-ui";
import {
  markContentPublished,
  isValidUrl,
  getClientPublishingInfo,
  type TeamMemberLike,
} from "@/lib/publishing-workflow-service";
import type { TaskRow } from "@/components/admin/project-utils";
import type { PublishingPlatform, ClientSocialAccounts } from "@/types/workflow";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  Share2,
  ExternalLink,
  Copy,
  Check,
  Instagram,
  Facebook,
  Video,
  Linkedin,
  Youtube,
  Globe,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";

interface PublishContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishingTask: TaskRow;
  parentTask?: TaskRow | null;
  clientId?: string | null;
  onPublished?: () => void;
}

const PLATFORM_CONFIG: {
  key: PublishingPlatform;
  label: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { key: "instagram", label: "Instagram", labelAr: "إنستغرام", icon: Instagram, color: "text-rose-400" },
  { key: "facebook", label: "Facebook", labelAr: "فيسبوك", icon: Facebook, color: "text-blue-500" },
  { key: "tiktok", label: "TikTok", labelAr: "تيك توك", icon: Video, color: "text-cyan-400" },
  { key: "youtube_shorts", label: "YouTube Shorts", labelAr: "يوتيوب شورتس", icon: Youtube, color: "text-red-500" },
  { key: "linkedin", label: "LinkedIn", labelAr: "لينكد إن", icon: Linkedin, color: "text-sky-500" },
];

export function PublishContentModal({
  open,
  onOpenChange,
  publishingTask,
  parentTask,
  clientId,
  onPublished,
}: PublishContentModalProps) {
  const { user } = useAuth();
  const { isRTL } = useTranslation();

  // Extract Drive Link
  const driveUrl =
    (publishingTask as any).drive_url ||
    (parentTask as any)?.drive_url ||
    publishingTask.result_links?.[0] ||
    parentTask?.result_links?.[0] ||
    "";

  // State
  const [publishedUrlInput, setPublishedUrlInput] = useState("");
  const [publishedUrls, setPublishedUrls] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PublishingPlatform[]>(["instagram"]);
  const [notes, setNotes] = useState("");
  const [clientInfo, setClientInfo] = useState<{
    clientName: string;
    industry?: string | null;
    socialAccounts: ClientSocialAccounts;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetClientId = clientId || publishingTask.client_id || parentTask?.client_id;

  // Load client metadata
  useEffect(() => {
    let cancelled = false;
    async function loadClientData() {
      if (!targetClientId) return;
      const res = await getClientPublishingInfo(targetClientId);
      if (!cancelled) {
        setClientInfo(res);
      }
    }
    loadClientData();
    return () => {
      cancelled = true;
    };
  }, [targetClientId]);

  const togglePlatform = (p: PublishingPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const handleCopyHandle = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    toast.success(isRTL ? "تم نسخ الحساب!" : "Handle copied!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishedUrlInput.trim()) return;

    if (!isValidUrl(publishedUrlInput.trim())) {
      toast.error(isRTL ? "يرجى تقديم رابط صالح" : "Please provide a valid URL");
      return;
    }

    if (!publishedUrls.includes(publishedUrlInput.trim())) {
      setPublishedUrls((prev) => [...prev, publishedUrlInput.trim()]);
    }
    setPublishedUrlInput("");
  };

  const handleRemoveUrl = (index: number) => {
    setPublishedUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Include the input URL if entered but not yet added
    const allUrls = [...publishedUrls];
    if (publishedUrlInput.trim() && isValidUrl(publishedUrlInput.trim())) {
      if (!allUrls.includes(publishedUrlInput.trim())) {
        allUrls.push(publishedUrlInput.trim());
      }
    }

    if (allUrls.length === 0) {
      toast.error(
        isRTL
          ? "يرجى إضافة رابط واحد على الأقل للمنشور المباشر لتأكيد النشر."
          : "Please add at least one live URL to confirm publishing."
      );
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error(
        isRTL
          ? "يرجى اختيار المنصة التي تم النشر عليها."
          : "Please select at least one platform."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await markContentPublished({
        publishingTaskId: publishingTask.id,
        actorId: user?.id || "system",
        publishedUrls: allUrls,
        targetPlatforms: selectedPlatforms,
        notes: notes.trim() || undefined,
        clientId: targetClientId,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to mark as published");
        return;
      }

      toast.success(
        res.parentCompleted
          ? isRTL
            ? "تم تأكيد النشر بنجاح! اكتملت جميع مراحل مسار العمل للمحتوى (100%)."
            : "Published successfully! All workflow stages are complete (100%)."
          : isRTL
          ? "تم تسجيل النشر بنجاح!"
          : "Published successfully!"
      );

      onOpenChange(false);
      if (onPublished) {
        onPublished();
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
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
        type="submit"
        variant="primary"
        disabled={submitting || (publishedUrls.length === 0 && !publishedUrlInput.trim())}
        onClick={handleSubmit}
        className="gap-2 bg-purple-600 hover:bg-purple-500 text-white cursor-pointer w-full sm:w-auto justify-center"
      >
        <CheckCircle2 className="size-4 shrink-0" />
        <span className="truncate">
          {submitting
            ? isRTL
              ? "جاري التأكيد..."
              : "Publishing..."
            : isRTL
            ? "تأكيد النشر الفعلي"
            : "Mark as Published"}
        </span>
      </SADAButton>
    </div>
  );

  return (
    <SADADialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      icon={<Share2 className="size-4 text-purple-400" />}
      title={isRTL ? "تأكيد نشر المحتوى على الحسابات" : "Publish Content to Social Accounts"}
      description={parentTask ? parentTask.title : publishingTask.title}
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Badges */}
        <div className="flex items-center gap-2">
          <SADABadge variant="outline" className="text-purple-400 border-purple-500/30 gap-1.5 px-2.5 py-0.5">
            <Share2 className="size-3.5" />
            <span>{isRTL ? "مرحلة النشر النهائي" : "Publishing Stage"}</span>
          </SADABadge>
          {clientInfo && (
            <SADABadge variant="outline" className="text-cyan-400 border-cyan-500/30 px-2.5 py-0.5">
              {clientInfo.clientName}
            </SADABadge>
          )}
        </div>

        {/* Drive Asset Banner */}
        {driveUrl ? (
          <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                <LinkIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {isRTL ? "ملفات المونتاج الجاهزة للنشر" : "Final Video Assets (Drive)"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate font-mono" dir="ltr">
                  {driveUrl}
                </p>
              </div>
            </div>
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shrink-0 transition-colors"
            >
              <span>{isRTL ? "فتح الملف" : "Open Asset"}</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              {isRTL
                ? "تنبيه: لم يتم العثور على رابط درايف مباشر على المهمة."
                : "Note: No direct Drive link was found on the task."}
            </span>
          </div>
        )}

        {/* Client Social Accounts Helper */}
        {clientInfo && (
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Globe className="size-3.5 text-purple-400" />
              <span>{isRTL ? "حسابات العميل المعتمدة للنشر:" : "Client Accounts for Publishing:"}</span>
            </p>

            <div className="flex flex-wrap gap-2 pt-0.5">
              {clientInfo.socialAccounts.instagram && (
                <button
                  type="button"
                  onClick={() => handleCopyHandle("instagram", clientInfo.socialAccounts.instagram!)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-900/30 transition-colors font-mono cursor-pointer"
                  title="Click to copy handle"
                >
                  <Instagram className="size-3 text-rose-400" />
                  <span>{clientInfo.socialAccounts.instagram}</span>
                  {copiedKey === "instagram" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 opacity-60" />}
                </button>
              )}

              {clientInfo.socialAccounts.tiktok && (
                <button
                  type="button"
                  onClick={() => handleCopyHandle("tiktok", clientInfo.socialAccounts.tiktok!)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-cyan-500/30 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-900/30 transition-colors font-mono cursor-pointer"
                  title="Click to copy handle"
                >
                  <Video className="size-3 text-cyan-400" />
                  <span>{clientInfo.socialAccounts.tiktok}</span>
                  {copiedKey === "tiktok" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 opacity-60" />}
                </button>
              )}

              {clientInfo.socialAccounts.facebook && (
                <button
                  type="button"
                  onClick={() => handleCopyHandle("facebook", clientInfo.socialAccounts.facebook!)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-blue-500/30 bg-blue-950/20 text-blue-300 hover:bg-blue-900/30 transition-colors font-mono cursor-pointer"
                  title="Click to copy handle"
                >
                  <Facebook className="size-3 text-blue-400" />
                  <span>{clientInfo.socialAccounts.facebook}</span>
                  {copiedKey === "facebook" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 opacity-60" />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Target Platforms */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {isRTL ? "منصات النشر المستخدمة *" : "Target Platforms *"}
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_CONFIG.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.key);
              const Icon = platform.icon;
              return (
                <button
                  key={platform.key}
                  type="button"
                  onClick={() => togglePlatform(platform.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "border-purple-500 bg-purple-600/20 text-purple-200"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon className={`size-3.5 ${platform.color}`} />
                  <span>{isRTL ? platform.labelAr : platform.label}</span>
                  {isSelected && <Check className="size-3 ms-1 text-purple-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Published URL Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>
              {isRTL ? "رابط المنشور المباشر (Live URL)" : "Live Published URL"}
              <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isRTL ? "مثال: رابط الريل المنشور على إنستغرام" : "e.g. https://www.instagram.com/reel/..."}
            </span>
          </label>

          <div className="flex items-center gap-2">
            <SADAInput
              type="url"
              dir="ltr"
              value={publishedUrlInput}
              onChange={(e) => setPublishedUrlInput(e.target.value)}
              placeholder="https://www.instagram.com/reel/C..."
              className="font-mono text-xs"
            />
            <SADAButton
              type="button"
              variant="outline"
              onClick={handleAddUrl}
              disabled={!publishedUrlInput.trim()}
              className="shrink-0 text-xs"
            >
              {isRTL ? "إضافة" : "Add"}
            </SADAButton>
          </div>

          {/* URL list */}
          {publishedUrls.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {publishedUrls.map((url, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/20 text-xs font-mono"
                >
                  <span className="truncate" dir="ltr">{url}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveUrl(i)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] ms-2 px-1 cursor-pointer"
                  >
                    {isRTL ? "حذف" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Publishing Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {isRTL ? "ملاحظات النشر (اختياري)" : "Publishing Notes / Reach Performance"}
          </label>
          <SADATextarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isRTL ? "مثال: تم النشر في وقت الذروة (الساعة 8 مساءً)..." : "e.g. Published at 8:00 PM peak engagement..."}
            className="text-xs"
          />
        </div>

        {/* Invariant Info */}
        <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-start gap-2.5">
          <Sparkles className="size-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">
              {isRTL ? "اكتمال المحتوى الأساسي:" : "Parent Content Completion:"}
            </p>
            <p>
              {isRTL
                ? "عند تأكيد النشر، سيتم تسجيل اكتمال دورة الإنتاج كاملة (100%) وتحديث حالة المحتوى الأساسي كـ 'مكتمل ومسلّم'."
                : "Confirming published status completes the full production lifecycle (100%) and transitions parent content to completed."}
            </p>
          </div>
        </div>
      </form>
    </SADADialog>
  );
}
