import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "@/i18n";
import type { UserActivityEvent } from "@/types/security-center";
import type { AccountRecord } from "@/lib/account-service";
import { format, parseISO } from "date-fns";
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import { SADASelect } from "@/components/ui/sada-select";
import { SADASearch } from "@/components/ui/sada-search";

interface UserActivityTabProps {
  events: UserActivityEvent[];
  accounts: AccountRecord[];
  selectedUserId?: string;
  onSelectUserId?: (userId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function UserActivityTab({
  events,
  accounts,
  selectedUserId,
  onSelectUserId,
  onRefresh,
  loading,
}: UserActivityTabProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [filterUser, setFilterUser] = useState<string>(selectedUserId || "all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUserId) {
      setFilterUser(selectedUserId);
    }
  }, [selectedUserId]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // User Filter
      if (filterUser !== "all") {
        const matchActor = e.actor_id === filterUser;
        const matchTarget = e.target_user_id === filterUser;
        if (!matchActor && !matchTarget) return false;
      }

      // Category Filter
      if (filterCategory !== "all" && e.category !== filterCategory) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchAct = e.action.toLowerCase().includes(q);
        const matchActor = e.actor_name.toLowerCase().includes(q);
        const matchEntity = e.entity_type.toLowerCase().includes(q);
        if (!matchAct && !matchActor && !matchEntity) return false;
      }

      return true;
    });
  }, [events, filterUser, filterCategory, search]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "auth":
        return {
          label: isAr ? "تحقق وهوية" : "Auth & Session",
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
          icon: KeyRound,
        };
      case "admin":
        return {
          label: isAr ? "إجراء إداري" : "Admin Action",
          color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
          icon: ShieldAlert,
        };
      case "navigation":
        return {
          label: isAr ? "وصول وتصفح" : "Navigation",
          color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
          icon: FolderKanban,
        };
      case "security":
        return {
          label: isAr ? "أمان واشتباه" : "Security Alert",
          color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
          icon: AlertTriangle,
        };
      default:
        return {
          label: isAr ? "عمليات نظام" : "Operations",
          color: "text-muted-foreground bg-muted border-border/70",
          icon: Database,
        };
    }
  };

  const accountOptions = useMemo(() => {
    return [
      { value: "all", label: isAr ? "جميع المستخدمين" : "All Users" },
      ...accounts.map((a) => ({
        value: a.user_id,
        label: `${a.display_name} (${a.email})`,
      })),
    ];
  }, [accounts, isAr]);

  return (
    <div className="space-y-4 text-start">
      {/* Investigator Controls */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 max-w-sm">
          <SADASearch
            value={search}
            onChange={setSearch}
            placeholder={isAr ? "البحث في أحداث التدقيق والنشاط..." : "Search action, entity or actor..."}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* User selector */}
          <SADASelect
            value={filterUser}
            onChange={(val) => {
              setFilterUser(val);
              if (onSelectUserId) onSelectUserId(val);
            }}
            options={accountOptions}
            className="w-56 h-9 text-xs"
          />

          {/* Category selector */}
          <SADASelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={[
              { value: "all", label: isAr ? "جميع الفئات" : "All Categories" },
              { value: "auth", label: isAr ? "تسجيل الدخول والجلسات" : "Auth & Sessions" },
              { value: "admin", label: isAr ? "تعديل الصلاحيات والأدوار" : "Admin Privileged" },
              { value: "business", label: isAr ? "عمليات الأعمال والمالية" : "Business Operations" },
              { value: "navigation", label: isAr ? "الوصول والتنقل" : "Navigation" },
            ]}
            className="w-44 h-9 text-xs"
          />

          <SADAButton
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 px-3 rounded-xl text-xs"
          >
            {isAr ? "تحديث" : "Refresh"}
          </SADAButton>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            <h4 className="font-display font-bold text-sm text-foreground">
              {isAr ? "سجل النشاط الزمني الموحد" : "Authoritative Activity Timeline"}
            </h4>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {filteredEvents.length} {isAr ? "أحداث مسجلة" : "events recorded"}
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground font-mono">
            <History className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
            {isAr ? "لم يتم العثور على أي أحداث تدقيق مطابقة." : "No audit activity matches the selected criteria."}
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:start-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
            {filteredEvents.map((evt) => {
              const badge = getCategoryBadge(evt.category);
              const Icon = badge.icon;
              const isExpanded = expandedEventId === evt.id;

              return (
                <div key={evt.id} className="relative ps-8 text-xs text-start">
                  <div
                    className={`absolute start-1.5 top-1 size-5 rounded-full border grid place-items-center ${badge.color}`}
                  >
                    <Icon className="size-2.5" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs hover:border-primary/30 transition-all space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-md text-[10px] border font-mono uppercase ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-bold text-xs text-foreground font-mono">
                          {evt.action.replace(/_/g, " ")}
                        </span>
                        {evt.is_security_sensitive && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold">
                            SENSITIVE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground" dir="ltr">
                        <Clock className="size-3" />
                        <span>{format(parseISO(evt.timestamp), "yyyy-MM-dd HH:mm:ss")}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <div>
                        <span>{isAr ? "المنفّذ: " : "Actor: "}</span>
                        <span className="font-semibold text-foreground font-mono" dir="ltr">
                          {evt.actor_name}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground ms-1">
                          ({evt.actor_role})
                        </span>
                      </div>

                      {evt.target_email && (
                        <div>
                          <span>{isAr ? "الهدف: " : "Target: "}</span>
                          <span className="font-semibold text-foreground font-mono" dir="ltr">
                            {evt.target_email}
                          </span>
                        </div>
                      )}

                      {evt.session_reference && (
                        <div>
                          <span>{isAr ? "الجلسة: " : "Session: "}</span>
                          <span className="font-mono text-[10px] text-foreground" dir="ltr">
                            {evt.session_reference.slice(0, 16)}...
                          </span>
                        </div>
                      )}

                      <div className="ms-auto text-[10px] font-mono text-muted-foreground/70">
                        {evt.evidence_source}
                      </div>
                    </div>

                    {/* Expandable Structured Payload */}
                    {evt.details && Object.keys(evt.details).length > 0 && (
                      <div className="pt-1">
                        <button
                          onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                          className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          <span>{isExpanded ? (isAr ? "إخفاء التفاصيل" : "Hide Details") : (isAr ? "عرض التفاصيل الكاملة" : "Inspect Payload")}</span>
                        </button>

                        {isExpanded && (
                          <div
                            className="mt-2 p-2.5 rounded-lg bg-muted/40 font-mono text-[10px] text-muted-foreground space-y-1 overflow-x-auto text-start border border-border/50"
                            dir="ltr"
                          >
                            {Object.entries(evt.details).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="text-foreground/70 font-semibold">{k}:</span>
                                <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
