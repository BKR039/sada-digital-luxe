import React, { useState, useEffect, useMemo } from "react";
import {
  BellRing,
  Send,
  AlertTriangle,
  Clock,
  User,
  Flame,
  CheckCircle2,
  Calendar,
  Tag,
  Loader2,
} from "lucide-react";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAButton } from "@/components/ui/sada-button";
import { SADABadge } from "@/components/ui/sada-badge";
import { SADASelect } from "@/components/ui/sada-select";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { sendTaskAlert } from "@/lib/notification-service";
import type { NotificationPriority } from "@/types/notifications-and-audit";
import type { TaskRow, TeamMemberRow, ProfileRow } from "@/components/admin/project-utils";
import { getAssignmentMemberInfo } from "@/components/admin/project-utils";

interface SendTaskAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow;
  teamMembers?: TeamMemberRow[];
  profiles?: ProfileRow[];
  clientName?: string;
  onSuccess?: () => void;
}

export function SendTaskAlertModal({
  open,
  onOpenChange,
  task,
  teamMembers = [],
  profiles = [],
  clientName,
  onSuccess,
}: SendTaskAlertModalProps) {
  const { t, isRTL } = useTranslation();
  const { user, role } = useAuth();

  // 1. Recipient defaults to the current task assignee
  const [recipientId, setRecipientId] = useState<string>("");
  const [priority, setPriority] = useState<NotificationPriority>("high");
  const [message, setMessage] = useState<string>("");
  const [sending, setSending] = useState(false);

  // Sync recipient with current task assignee when modal opens or task changes
  useEffect(() => {
    if (open) {
      if (task.assignee_id) {
        setRecipientId(task.assignee_id);
      } else if (teamMembers.length > 0) {
        setRecipientId(teamMembers[0].id);
      } else {
        setRecipientId("");
      }
      setMessage("");
      setPriority("high");
    }
  }, [open, task.assignee_id, teamMembers]);

  // Recipient options formatted for SADASelect
  const recipientOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [];
    const seenValues = new Set<string>();

    // Current assignee first
    if (task.assignee_id) {
      const assigneeInfo = getAssignmentMemberInfo(task.assignee_id, teamMembers, profiles);
      list.push({
        value: task.assignee_id,
        label: `${assigneeInfo?.displayName || "Assignee"} (Current Assignee)`,
      });
      seenValues.add(task.assignee_id);
    }

    // Add remaining team members
    for (const tm of teamMembers) {
      const val = tm.profile_id || tm.id;
      if (!seenValues.has(val)) {
        list.push({
          value: val,
          label: tm.display_name || tm.name || "Specialist",
        });
        seenValues.add(val);
      }
    }

    // Add remaining profiles
    for (const p of profiles) {
      if (!seenValues.has(p.id)) {
        list.push({
          value: p.id,
          label: p.display_name || "Team Member",
        });
        seenValues.add(p.id);
      }
    }

    return list;
  }, [task.assignee_id, teamMembers, profiles]);

  const handleSend = async () => {
    if (!user) {
      toast.error(isRTL ? "يجب تسجيل الدخول لإرسال التنبيه" : "You must be authenticated to dispatch alerts");
      return;
    }
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      toast.error(isRTL ? "يرجى كتابة نص التنبيه" : "Please enter an alert message");
      return;
    }
    if (!recipientId) {
      toast.error(isRTL ? "يرجى اختيار المستلم" : "Please select an alert recipient");
      return;
    }

    setSending(true);
    try {
      const res = await sendTaskAlert({
        taskId: task.id,
        senderId: user.id,
        recipientId,
        priority,
        message: cleanMsg,
        actorRole: role,
        taskTitle: task.title,
        clientName,
      });

      if (res.success) {
        toast.success(
          isRTL
            ? "تم إرسال التنبيه الفوري بنجاح!"
            : "Task alert dispatched to specialist successfully!"
        );
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(res.error || (isRTL ? "فشل إرسال التنبيه" : "Failed to dispatch alert"));
      }
    } catch (err: any) {
      console.error("[SendTaskAlertModal] Error:", err);
      toast.error(err.message || (isRTL ? "حدث خطأ غير متوقع" : "An unexpected error occurred"));
    } finally {
      setSending(false);
    }
  };

  const recipientInfo = getAssignmentMemberInfo(recipientId, teamMembers, profiles);

  return (
    <SADADialog
      open={open}
      onOpenChange={onOpenChange}
      size="compact"
      title={isRTL ? "إرسال تنبيه مهمة فوري" : "Send Task Alert"}
      description={
        isRTL
          ? "توجيه تنبيه تشغيلي مباشر إلى المسؤول عن تنفيذ هذه المهمة."
          : "Dispatch an operational alert to the specialist responsible for this deliverable."
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <SADAButton
            variant="ghost"
            size="sm"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            {isRTL ? "إلغاء" : "Cancel"}
          </SADAButton>
          <SADAButton
            variant="primary"
            size="sm"
            isLoading={sending}
            leftIcon={<Send className="size-3.5" />}
            onClick={handleSend}
          >
            {isRTL ? "إرسال التنبيه" : "Send Alert"}
          </SADAButton>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Task Context Card */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                {isRTL ? "سياق المهمة" : "Target Deliverable"}
              </span>
              <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                {task.title}
              </h4>
            </div>
            <SADABadge variant="neutral" size="xs" className="shrink-0">
              {clientName || "Client"}
            </SADABadge>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
            {task.deadline && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3 text-primary" />
                <span>{task.deadline}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Tag className="size-3" />
              <span>{task.status.replace("_", " ").toUpperCase()}</span>
            </span>
          </div>
        </div>

        {/* Recipient Selection (TO) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>{isRTL ? "إلى (المستلم):" : "To (Recipient):"}</span>
            {task.assignee_id && recipientId === task.assignee_id && (
              <span className="text-[10px] text-primary font-mono font-normal">
                {isRTL ? "المنفّذ الحالي المكلف" : "Current task assignee"}
              </span>
            )}
          </label>
          <SADASelect
            value={recipientId}
            onChange={(val) => setRecipientId(val)}
            options={recipientOptions}
            size="default"
            placeholder={isRTL ? "اختر المستلم..." : "Select recipient..."}
          />
        </div>

        {/* Priority Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground block">
            {isRTL ? "درجة الأولوية:" : "Priority Level:"}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPriority("normal")}
              className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                priority === "normal"
                  ? "bg-sky-500/10 border-sky-500/50 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20 font-bold"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              <span>{isRTL ? "عادي" : "Normal"}</span>
            </button>

            <button
              type="button"
              onClick={() => setPriority("high")}
              className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                priority === "high"
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20 font-bold"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <AlertTriangle className="size-3.5" />
              <span>{isRTL ? "عالي" : "High"}</span>
            </button>

            <button
              type="button"
              onClick={() => setPriority("urgent")}
              className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                priority === "urgent"
                  ? "bg-rose-500/10 border-rose-500/50 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20 font-bold"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Flame className="size-3.5 animate-pulse" />
              <span>{isRTL ? "عاجل" : "Urgent"}</span>
            </button>
          </div>
        </div>

        {/* Message Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>{isRTL ? "نص الرسالة / التوجيه:" : "Message / Directive:"}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {message.length}/500
            </span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={
              isRTL
                ? "مثال: يرجى إعطاء الأولوية القصوى لهذه المهمة اليوم وإنهائها قبل الساعة 18:00."
                : "e.g. Please prioritize this task today. I need the final version before 18:00."
            }
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-all"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isRTL
              ? `سيتم إرسال هذا التنبيه فوراً عبر مركز الإشعارات والوقت الحقيقي إلى ${recipientInfo?.displayName || "المستلم"}.`
              : `This alert will be delivered in real-time to ${recipientInfo?.displayName || "recipient"}'s Notification Center.`}
          </p>
        </div>
      </div>
    </SADADialog>
  );
}
