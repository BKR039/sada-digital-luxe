import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "@/i18n";
import type { UserSessionRecord } from "@/types/security-center";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Search,
  Filter,
  Radio,
  Laptop,
  Smartphone,
  Tablet,
  ShieldAlert,
  ShieldCheck,
  Eye,
  LogOut,
  UserX,
  MoreVertical,
  Clock,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import { SADABadge } from "@/components/ui/sada-badge";
import { SADASearch } from "@/components/ui/sada-search";
import { SADASelect } from "@/components/ui/sada-select";
import { SessionDetailDrawer } from "./SessionDetailDrawer";
import { toast } from "sonner";

interface LiveSessionsTabProps {
  sessions: UserSessionRecord[];
  onRevokeSession: (session: UserSessionRecord) => void;
  onSignOutEverywhere: (session: UserSessionRecord) => void;
  onSuspendAccount: (session: UserSessionRecord) => void;
  onRefresh: () => void;
  refreshing: boolean;
  currentUserId?: string;
  initialSearch?: string;
}

export function LiveSessionsTab({
  sessions,
  onRevokeSession,
  onSignOutEverywhere,
  onSuspendAccount,
  onRefresh,
  refreshing,
  currentUserId,
  initialSearch,
}: LiveSessionsTabProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [search, setSearch] = useState(initialSearch || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [selectedSession, setSelectedSession] = useState<UserSessionRecord | null>(null);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchUser = s.display_name.toLowerCase().includes(q);
        const matchEmail = s.user_email.toLowerCase().includes(q);
        const matchSessionId = s.session_id.toLowerCase().includes(q);
        if (!matchUser && !matchEmail && !matchSessionId) return false;
      }

      // Status
      if (statusFilter !== "all" && s.session_status !== statusFilter) return false;

      // Device
      if (deviceFilter !== "all" && s.device_type !== deviceFilter) return false;

      return true;
    });
  }, [sessions, search, statusFilter, deviceFilter]);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile":
        return Smartphone;
      case "tablet":
        return Tablet;
      default:
        return Laptop;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {isAr ? "نشطة" : "ACTIVE"}
          </span>
        );
      case "idle":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {isAr ? "خاملة" : "IDLE"}
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            {isAr ? "ملغاة" : "REVOKED"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border/70">
            {isAr ? "منتهية" : "EXPIRED"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SADASearch
            value={search}
            onChange={setSearch}
            placeholder={isAr ? "البحث بالاسم، البريد أو معرف الجلسة..." : "Search by user, email, or session ID..."}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <SADASelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: isAr ? "جميع الحالات" : "All Statuses" },
              { value: "active", label: isAr ? "النشطة فقط" : "Active Only" },
              { value: "idle", label: isAr ? "الخاملة" : "Idle" },
              { value: "revoked", label: isAr ? "الملغاة" : "Revoked" },
              { value: "expired", label: isAr ? "المنتهية" : "Expired" },
            ]}
            className="w-36 h-9 text-xs"
          />

          {/* Device Filter */}
          <SADASelect
            value={deviceFilter}
            onChange={setDeviceFilter}
            options={[
              { value: "all", label: isAr ? "جميع الأجهزة" : "All Devices" },
              { value: "desktop", label: isAr ? "أجهزة مكتبية" : "Desktop" },
              { value: "mobile", label: isAr ? "هواتف ذكية" : "Mobile" },
              { value: "tablet", label: isAr ? "أجهزة لوحية" : "Tablet" },
            ]}
            className="w-36 h-9 text-xs"
          />

          <SADAButton
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-9 px-3 rounded-xl text-xs"
          >
            {isAr ? "تحديث" : "Refresh"}
          </SADAButton>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-start">
                <th className="py-3 px-4">{isAr ? "المستخدم" : "User & Role"}</th>
                <th className="py-3 px-4">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4">{isAr ? "الجهاز والبيئة" : "Device & Browser"}</th>
                <th className="py-3 px-4">{isAr ? "تسجيل الدخول" : "Sign In"}</th>
                <th className="py-3 px-4">{isAr ? "آخر نشاط" : "Last Activity"}</th>
                <th className="py-3 px-4 text-end">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground font-mono">
                    <Radio className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    {isAr ? "لا توجد جلسات تطابق معايير البحث." : "No sessions match the filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((sess) => {
                  const DeviceIcon = getDeviceIcon(sess.device_type);
                  const isCurrent = sess.user_id === currentUserId;

                  return (
                    <tr
                      key={sess.id}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => setSelectedSession(sess)}
                    >
                      {/* User Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs grid place-items-center border border-primary/20 shrink-0">
                            {sess.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{sess.display_name}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-primary/15 text-primary border border-primary/25">
                                  {isAr ? "جلستك الحالية" : "YOU"}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                              {sess.user_email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(sess.session_status)}
                      </td>

                      {/* Device & Browser Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0 border border-border/60">
                            <DeviceIcon className="size-3" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-xs">
                              {sess.browser_name || "Browser"}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {sess.os_name || "OS"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sign In Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]" dir="ltr">
                        <div>{format(parseISO(sess.sign_in_at), "yyyy-MM-dd HH:mm")}</div>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground text-xs">
                        <div className="font-mono text-[11px] text-foreground" dir="ltr">
                          {formatDistanceToNow(parseISO(sess.last_activity_at), { addSuffix: true })}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td
                        className="py-3.5 px-4 whitespace-nowrap text-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <SADAButton
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs rounded-lg"
                            onClick={() => setSelectedSession(sess)}
                            title={isAr ? "عرض التفاصيل" : "View Details"}
                          >
                            <Eye className="size-3.5 me-1" />
                            <span>{isAr ? "التفاصيل" : "Details"}</span>
                          </SADAButton>

                          {sess.session_status !== "revoked" && (
                            <SADAButton
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2 text-xs rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20"
                              onClick={() => onRevokeSession(sess)}
                              title={isAr ? "إلغاء الجلسة فوراً" : "Revoke session immediately"}
                            >
                              <ShieldAlert className="size-3.5 me-1" />
                              <span>{isAr ? "إلغاء" : "Revoke"}</span>
                            </SADAButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Detail Drawer */}
      {selectedSession && (
        <SessionDetailDrawer
          session={selectedSession}
          isOpen={Boolean(selectedSession)}
          onClose={() => setSelectedSession(null)}
          onRevokeSession={onRevokeSession}
          onSignOutEverywhere={onSignOutEverywhere}
          onSuspendAccount={onSuspendAccount}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
