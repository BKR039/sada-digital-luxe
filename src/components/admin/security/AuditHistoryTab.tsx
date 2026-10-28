import { useState, useMemo } from "react";
import { useTranslation } from "@/i18n";
import type { SystemAuditLog } from "@/types/notifications-and-audit";
import { format, parseISO } from "date-fns";
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Database,
  Lock,
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import { SADASearch } from "@/components/ui/sada-search";
import { SADASelect } from "@/components/ui/sada-select";
import { logSystemAudit } from "@/lib/audit-service";
import { serializeCsv } from "@/lib/csv-utils";
import { toast } from "sonner";

interface AuditHistoryTabProps {
  logs: SystemAuditLog[];
  onRefresh: () => void;
  loading: boolean;
  currentUserId?: string;
}

export function AuditHistoryTab({
  logs,
  onRefresh,
  loading,
  currentUserId,
}: AuditHistoryTabProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchAct = log.action.toLowerCase().includes(q);
        const matchActor = (log.actor_name || "").toLowerCase().includes(q);
        const matchEntity = log.entity_type.toLowerCase().includes(q);
        const matchEntityId = (log.entity_id || "").toLowerCase().includes(q);
        if (!matchAct && !matchActor && !matchEntity && !matchEntityId) return false;
      }

      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;

      return true;
    });
  }, [logs, search, actionFilter, entityFilter]);

  // Unique actions and entities for filter dropdowns
  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => { if (l.action) set.add(l.action); });
    return [
      { value: "all", label: isAr ? "جميع الإجراءات" : "All Actions" },
      ...Array.from(set).map((a) => ({ value: a, label: a.replace(/_/g, " ") })),
    ];
  }, [logs, isAr]);

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => { if (l.entity_type) set.add(l.entity_type); });
    return [
      { value: "all", label: isAr ? "جميع الكيانات" : "All Entities" },
      ...Array.from(set).map((e) => ({ value: e, label: e })),
    ];
  }, [logs, isAr]);

  const handleExportAudit = async (exportFormat: "json" | "csv") => {
    try {
      // 1. Audit the sensitive export operation
      await logSystemAudit({
        action: "AUDIT_LOGS_EXPORTED",
        entityType: "system_audit_logs",
        actorId: currentUserId || null,
        actorName: "Super Admin",
        actorRole: "super_admin",
        newValues: {
          format: exportFormat,
          records_count: filteredLogs.length,
          timestamp: new Date().toISOString(),
        },
      });

      // 2. Prepare sanitised data (exclude any accidental secret keys)
      const sanitized = filteredLogs.map((l) => ({
        id: l.id,
        timestamp: l.created_at,
        action: l.action,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        actor_id: l.actor_id,
        actor_name: l.actor_name,
        actor_role: l.actor_role,
        old_values: l.old_values,
        new_values: l.new_values,
        ip_address: l.ip_address,
        user_agent: l.user_agent,
      }));

      let dataBlob: Blob;
      let filename: string;

      if (exportFormat === "json") {
        dataBlob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
        filename = `sada_audit_trail_${format(new Date(), "yyyyMMdd_HHmm")}.json`;
      } else {
        const headers = ["ID", "Timestamp", "Action", "EntityType", "EntityID", "ActorName", "ActorRole", "IP"];
        const rows = sanitized.map((r) => [
          r.id,
          r.timestamp,
          r.action,
          r.entity_type,
          r.entity_id || "",
          r.actor_name || "",
          r.actor_role || "",
          r.ip_address || "",
        ]);
        const csvContent = serializeCsv([headers, ...rows], { withBom: true });
        dataBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename = `sada_audit_trail_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
      }

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(isAr ? "تم تصدير سجل التدقيق وتوثيق العملية أمنياً" : "Audit trail exported and audited successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export audit trail");
    }
  };

  return (
    <div className="space-y-4 text-start">
      {/* Header and Controls */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 max-w-sm">
          <SADASearch
            value={search}
            onChange={setSearch}
            placeholder={isAr ? "البحث بالإجراء أو المنفذ أو الكيان..." : "Search action, actor or entity..."}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SADASelect
            value={actionFilter}
            onChange={setActionFilter}
            options={actionOptions}
            className="w-44 h-9 text-xs"
          />

          <SADASelect
            value={entityFilter}
            onChange={setEntityFilter}
            options={entityOptions}
            className="w-40 h-9 text-xs"
          />

          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => handleExportAudit("json")}
            className="h-9 px-3 rounded-xl text-xs"
          >
            <Download className="size-3.5 me-1.5" />
            <span>JSON</span>
          </SADAButton>

          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => handleExportAudit("csv")}
            className="h-9 px-3 rounded-xl text-xs"
          >
            <Download className="size-3.5 me-1.5" />
            <span>CSV</span>
          </SADAButton>

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

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-start">
                <th className="py-3 px-4">{isAr ? "الوقت" : "Timestamp"}</th>
                <th className="py-3 px-4">{isAr ? "المنفّذ" : "Actor"}</th>
                <th className="py-3 px-4">{isAr ? "الإجراء" : "Action"}</th>
                <th className="py-3 px-4">{isAr ? "نوع الكيان" : "Entity Type"}</th>
                <th className="py-3 px-4">{isAr ? "البيانات المسجلة" : "Details & Payload"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground font-mono">
                    <Database className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    {isAr ? "لا توجد سجلات تدقيق تطابق شروط البحث." : "No audit logs match criteria."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasDetails =
                    (log.new_values && Object.keys(log.new_values).length > 0) ||
                    (log.old_values && Object.keys(log.old_values).length > 0);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {format(parseISO(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{log.actor_name || "System"}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">{log.actor_role}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-muted border border-border/70 text-foreground">
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        <div>{log.entity_type}</div>
                        {log.entity_id && (
                          <div className="text-[9px] text-muted-foreground/80 truncate max-w-[140px]" dir="ltr">
                            {log.entity_id}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs max-w-md">
                        {hasDetails ? (
                          <div>
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-[10px] font-mono text-primary flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              <span>{isExpanded ? (isAr ? "إخفاء" : "Hide") : (isAr ? "عرض التفاصيل" : "Inspect Payload")}</span>
                            </button>

                            {isExpanded && (
                              <div
                                className="mt-1.5 p-2 rounded-lg bg-muted/40 font-mono text-[10px] text-muted-foreground space-y-1 overflow-x-auto border border-border/50 text-start"
                                dir="ltr"
                              >
                                {log.old_values && Object.keys(log.old_values).length > 0 && (
                                  <div>
                                    <span className="text-rose-500 font-semibold block">Old:</span>
                                    <span>{JSON.stringify(log.old_values)}</span>
                                  </div>
                                )}
                                {log.new_values && (
                                  <div>
                                    <span className="text-emerald-500 font-semibold block">New:</span>
                                    <span>{JSON.stringify(log.new_values)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
