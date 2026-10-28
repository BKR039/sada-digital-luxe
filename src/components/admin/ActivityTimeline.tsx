import { format, differenceInMinutes, isToday } from "date-fns";
import { formatDate } from "@/lib/date-locale";
import { useTranslation } from "@/i18n";
import { Activity, CheckCircle2, Circle, Clock, Pause, RotateCcw, UserPlus, CalendarClock, MessageSquare, PenSquare } from "lucide-react";

interface ActivityRow {
  id: string;
  project_id: string;
  task_id: string | null;
  actor_id: string | null;
  action: string;
  details: any;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}

interface Props {
  activities: ActivityRow[];
  profiles: ProfileRow[];
}

const ACTION_CONFIG: Record<string, { labelEn: string; labelAr: string; Icon: typeof Activity; color: string }> = {
  created:        { labelEn: "Created",        labelAr: "تم الإنشاء",      Icon: Circle,        color: "text-primary" },
  assigned:       { labelEn: "Assigned",       labelAr: "تم التعيين",      Icon: UserPlus,      color: "text-primary" },
  status_changed: { labelEn: "Status changed", labelAr: "تغيرت الحالة",    Icon: Clock,         color: "text-amber-600" },
  rescheduled:    { labelEn: "Rescheduled",    labelAr: "إعادة الجدولة",   Icon: CalendarClock, color: "text-amber-600" },
  completed:      { labelEn: "Completed",      labelAr: "تم الإنجاز",      Icon: CheckCircle2,  color: "text-emerald-600" },
  postponed:      { labelEn: "Postponed",      labelAr: "تم التأجيل",      Icon: Pause,         color: "text-amber-600" },
  reopened:       { labelEn: "Reopened",       labelAr: "إعادة الفتح",     Icon: RotateCcw,     color: "text-primary" },
  note_added:     { labelEn: "Note added",     labelAr: "أضيفت ملاحظة",   Icon: MessageSquare, color: "text-muted-foreground" },
  updated:        { labelEn: "Updated",        labelAr: "تم التحديث",      Icon: PenSquare,     color: "text-muted-foreground" },
};

function groupByDate(items: ActivityRow[]): Map<string, ActivityRow[]> {
  const groups = new Map<string, ActivityRow[]>();
  for (const item of items) {
    const key = format(new Date(item.created_at), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

export function ActivityTimeline({ activities, profiles }: Props) {
  const { t, isRTL } = useTranslation();

  if (!activities.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
        {t("tasks.activity.empty") || (isRTL ? "لا يوجد نشاط مسجل حتى الآن." : "No activity yet.")}
      </div>
    );
  }

  const grouped = groupByDate(activities);
  const profileMap = new Map(profiles.map(p => [p.id, p.display_name || (isRTL ? "عضو الفريق" : "Team member")]));

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([dateKey, items]) => {
        const dateObj = new Date(dateKey);
        const label = isToday(dateObj) ? (isRTL ? "اليوم" : "Today") : formatDate(dateObj, "d MMMM yyyy");

        return (
          <div key={dateKey}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{label}</div>
            <div className="space-y-2 border-s-2 border-border ps-4 ms-2">
              {items.map(a => {
                const conf = ACTION_CONFIG[a.action] || ACTION_CONFIG.updated;
                const Icon = conf.Icon;
                const actor = a.actor_id ? profileMap.get(a.actor_id) || (isRTL ? "غير معروف" : "Unknown") : (isRTL ? "النظام" : "System");
                const actionLabel = isRTL ? conf.labelAr : conf.labelEn;

                let detail = "";
                if (a.details) {
                  if (a.action === "status_changed" && a.details.from && a.details.to) {
                    detail = `${a.details.from.replace("_", " ")} → ${a.details.to.replace("_", " ")}`;
                    if (a.details.reason) detail += ` · "${a.details.reason}"`;
                  } else if (a.action === "created" && a.details.source === "contact_submission") {
                    detail = isRTL ? "من تحويل استفسار" : "From inquiry conversion";
                  } else if (typeof a.details === "object") {
                    const entries = Object.entries(a.details).filter(([k]) => k !== "source");
                    if (entries.length) detail = entries.map(([k, v]) => `${k}: ${v}`).join(", ");
                  }
                }

                return (
                  <div key={a.id} className="flex items-start gap-3 py-1.5">
                    <div className={`mt-0.5 shrink-0 ${conf.color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{actionLabel}</span>
                        <span className="text-xs text-muted-foreground">{isRTL ? `بواسطة ${actor}` : `by ${actor}`}</span>
                        <span className="text-xs text-muted-foreground ms-auto">{format(new Date(a.created_at), "HH:mm")}</span>
                      </div>
                      {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
