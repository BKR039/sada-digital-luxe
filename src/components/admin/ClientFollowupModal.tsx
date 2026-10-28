import { useState } from "react";
import { X, MessageSquare, Calendar, User, Send, Check, ChevronDown, Phone, Mail, Users, Sparkles, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import type { ProfileRow } from "./project-utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { SADADateDateTimePicker } from "@/components/ui/sada-date-time-picker";

interface Props {
  projectId: string;
  clientName: string;
  profiles: ProfileRow[];
  currentFollowupOwnerId?: string | null;
  onSaved: () => void;
  onClose: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ClientFollowupModal({
  projectId,
  clientName,
  profiles,
  currentFollowupOwnerId,
  onSaved,
  onClose,
}: Props) {
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const { user } = useAuth();

  const CONTACT_METHODS = [
    { key: "WhatsApp", label: "WhatsApp", icon: MessageSquare },
    { key: "Phone", label: isAr ? "اتصال هاتفي" : "Phone Call", icon: Phone },
    { key: "Email", label: isAr ? "بريد إلكتروني" : "Email", icon: Mail },
    { key: "Meeting", label: isAr ? "اجتماع / عرض" : "Meeting / Demo", icon: Users },
    { key: "Other", label: isAr ? "وسيلة أخرى" : "Other", icon: Sparkles },
  ] as const;

  const FOLLOWUP_STATUSES = [
    { key: "waiting_for_client", label: isAr ? "بانتظار العميل" : "Waiting for Client", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
    { key: "waiting_for_sada", label: isAr ? "بانتظار فريق صدى" : "Waiting for SADA", color: "text-primary bg-primary/10 border-primary/30" },
    { key: "followup_due", label: isAr ? "مستحق المتابعة" : "Follow-up Due", color: "text-rose-600 bg-rose-500/10 border-rose-500/30" },
    { key: "followup_completed", label: isAr ? "اكتملت المتابعة" : "Follow-up Completed", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  ] as const;
  const [contactMethod, setContactMethod] = useState<"WhatsApp" | "Phone" | "Email" | "Meeting" | "Other">("WhatsApp");
  const [teamMemberId, setTeamMemberId] = useState<string>(currentFollowupOwnerId || user?.id || "");
  const [summary, setSummary] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState("");
  const [followupStatus, setFollowupStatus] = useState<"waiting_for_client" | "waiting_for_sada" | "followup_due" | "followup_completed">("waiting_for_client");
  const [saving, setSaving] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const selectedOwner = profiles.find((p) => p.id === teamMemberId);
  const currentStatusConfig = FOLLOWUP_STATUSES.find((s) => s.key === followupStatus) || FOLLOWUP_STATUSES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      toast.error(isAr ? "يرجى إضافة ملخص موجز لما تم خلال التواصل مع العميل." : "Please add a brief summary of what happened during the client contact.");
      return;
    }
    setSaving(true);

    const now = new Date().toISOString();
    const nextDateIso = nextFollowupDate ? new Date(nextFollowupDate).toISOString() : null;

    // 1. Insert into client_communication_logs
    const { error: logErr } = await (supabase as any)
      .from("client_communication_logs")
      .insert({
        project_id: projectId,
        contact_method: contactMethod,
        team_member_id: teamMemberId || user?.id || null,
        summary: summary.trim(),
        next_action: nextAction.trim() || null,
        next_followup_date: nextDateIso,
      });

    if (logErr) {
      toast.error(logErr.message);
      setSaving(false);
      return;
    }

    // 2. Update client_projects follow-up state
    const { error: projErr } = await (supabase as any)
      .from("client_projects")
      .update({
        last_contact_date: now,
        last_contact_by: teamMemberId || user?.id || null,
        next_followup_date: nextDateIso,
        followup_owner_id: teamMemberId || user?.id || null,
        followup_status: followupStatus,
        followup_summary: summary.trim(),
        followup_next_action: nextAction.trim() || null,
      })
      .eq("id", projectId);

    if (projErr) {
      toast.error(projErr.message);
      setSaving(false);
      return;
    }

    // 3. Log activity event
    await (supabase as any).from("project_activity").insert({
      project_id: projectId,
      actor_id: user?.id ?? null,
      action: "client_followup_logged",
      details: {
        method: contactMethod,
        summary: summary.trim(),
        next_action: nextAction.trim() || null,
        next_followup_date: nextDateIso,
      },
    });

    toast.success(isAr ? "تم تسجيل متابعة العميل بنجاح" : "Client follow-up logged successfully");
    setSaving(false);
    onSaved();
    onClose();
  };

  const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-start";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 font-mono text-start";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] animate-[sada-overlay-in_120ms_ease-out]"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-[sada-dialog-in_120ms_ease-out] overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur z-20 px-5 md:px-6 py-4 border-b border-border shrink-0">
          <div>
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase">
              SADA Work OS · {isAr ? "متابعة العميل" : "Client Follow-up"}
            </span>
            <h2 className="font-display text-lg md:text-xl font-bold text-foreground mt-0.5">
              {isAr ? "تسجيل تواصل مع العميل" : "Log Communication"}
            </h2>
            <p className="text-xs text-muted-foreground">{isAr ? "العميل:" : "Client:"} <strong className="text-foreground">{clientName}</strong></p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
            className="size-8 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="space-y-5 px-5 md:px-6 py-5 overflow-y-auto flex-1 text-xs">
          {/* 1. HOW DID YOU SPEAK WITH THEM? */}
          <div className="space-y-1.5">
            <span className={labelCls}>{isAr ? "1. كيف تم التواصل مع العميل؟ *" : "1. How did you speak with them? *"}</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-muted/30 border border-border rounded-2xl">
              {CONTACT_METHODS.map((m) => {
                const Icon = m.icon;
                const isSelected = contactMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setContactMethod(m.key as any)}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-[11px] font-semibold transition-all ${
                      isSelected
                        ? "bg-card text-primary shadow-xs border border-primary/20 scale-[1.02]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OWNER SELECTOR */}
          <div className="space-y-1.5">
            <span className={labelCls}>{isAr ? "مسؤول التواصل من فريق صدى" : "SADA Team Contact Person"}</span>
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between gap-3 w-full p-2.5 bg-card hover:bg-muted/40 border border-border rounded-2xl text-start transition-all shadow-xs"
                >
                  {selectedOwner ? (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-6 border border-primary/20 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                          {getInitials(selectedOwner.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {selectedOwner.display_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{isAr ? "اختر عضواً من الفريق…" : "Select team member…"}</span>
                  )}
                  <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 rounded-2xl border-border shadow-xl z-50" align="start">
                <Command className="rounded-2xl">
                  <CommandInput placeholder={isAr ? "البحث عن عضو في الفريق…" : "Search team member…"} className="text-xs h-9 text-start" />
                  <CommandList className="max-h-48 p-1">
                    <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">{isAr ? "لم يتم العثور على أعضاء" : "No member found"}</CommandEmpty>
                    <CommandGroup>
                      {profiles.map((p) => (
                        <CommandItem
                          key={p.id}
                          onSelect={() => {
                            setTeamMemberId(p.id);
                            setMemberOpen(false);
                          }}
                          className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6 border border-primary/20">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                {getInitials(p.display_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{p.display_name}</span>
                          </div>
                          {teamMemberId === p.id && <Check className="size-4 text-primary" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* 2. WHAT HAPPENED? */}
          <div className="space-y-1.5">
            <span className={labelCls}>{isAr ? "2. ما الذي حدث خلال التواصل؟ *" : "2. What happened during the interaction? *"}</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={isAr ? "مثال: وافق العميل على التوجه البصري، وتمت مناقشة مواعيد جلسة التصوير وتأكيد إرسال الشعار يوم الأربعاء." : "e.g. Client approved visual direction, discussed photoshoot dates, and confirmed logo assets will arrive by Wednesday."}
              rows={3}
              className="w-full bg-muted/20 hover:bg-muted/40 focus:bg-background border border-border/80 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none text-start"
              required
            />
          </div>

          {/* 3. WHAT HAPPENS NEXT & WHEN SHOULD WE FOLLOW UP? */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className={labelCls}>{isAr ? "الحالة الحالية" : "Current Status"}</span>
              <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center justify-between gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold border ${currentStatusConfig.color} shadow-xs text-start truncate`}
                  >
                    <span className="truncate">{currentStatusConfig.label}</span>
                    <ChevronDown className="size-3.5 opacity-70 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-1.5 rounded-2xl border-border shadow-xl z-50" align="start">
                  <div className="space-y-1">
                    {FOLLOWUP_STATUSES.map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => {
                          setFollowupStatus(st.key as any);
                          setStatusOpen(false);
                        }}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          followupStatus === st.key
                            ? `${st.color} font-bold shadow-xs`
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{st.label}</span>
                        {followupStatus === st.key && <Check className="size-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <span className={labelCls}>{isAr ? "متى يجب متابعة العميل؟" : "When should we follow up?"}</span>
              <SADADateDateTimePicker
                value={nextFollowupDate}
                onChange={(val) => setNextFollowupDate(val)}
                placeholder={isAr ? "اختر تاريخ ووقت المتابعة..." : "Choose follow-up date & time..."}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className={labelCls}>{isAr ? "3. ما هي الخطوة القادمة؟" : "3. What happens next?"}</span>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder={isAr ? "مثال: المتابعة للحصول على صور المنتجات أو إرسال العرض للمراجعة" : "e.g. Follow up for product photo folder or send review deck"}
              className={inputCls}
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex gap-2.5 justify-end sticky bottom-0 bg-card/95 backdrop-blur z-20 px-5 md:px-6 py-3.5 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-gradient-primary text-white px-6 py-2 rounded-xl text-xs font-semibold neon-glow hover:scale-[1.02] transition-transform disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send className="size-3.5 rtl:rotate-180" />
            {saving ? (isAr ? "جارٍ الحفظ…" : "Saving…") : (isAr ? "حفظ المتابعة" : "Save Follow-up")}
          </button>
        </div>
      </form>
    </div>
  );
}

