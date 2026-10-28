import { FinancialAuditLog } from "@/types/finance";
import { format, parseISO } from "date-fns";
import { ShieldCheck, History, ArrowRight } from "lucide-react";

function safeFormatDateTime(d: string | null | undefined, fmt: string = "yyyy-MM-dd HH:mm:ss"): string {
  if (!d) return "—";
  try {
    const parsed = parseISO(d);
    if (isNaN(parsed.getTime())) return d;
    return format(parsed, fmt);
  } catch {
    return d || "—";
  }
}

interface AuditTrailViewProps {
  logs: FinancialAuditLog[];
}

export function AuditTrailView({ logs }: AuditTrailViewProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h2 className="text-base font-bold font-display text-foreground">
            Financial Mutation Audit Trail
          </h2>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/70">
            Immutable
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auditable timeline of all financial transactions, approvals, disbursements, and account changes.
        </p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details & Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground font-mono text-xs">
                    No financial audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap text-[11px]">
                      {safeFormatDateTime(log.created_at)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground">
                        {log.actor_name || "System"}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">
                        {log.actor_role || "super_admin"}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted border border-border/60 font-semibold uppercase text-foreground">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {log.entity_type}
                    </td>

                    <td className="py-3 px-4 text-muted-foreground max-w-md font-mono text-[11px]">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <div className="bg-muted/40 p-1.5 rounded-lg border border-border/40 truncate text-foreground">
                          {JSON.stringify(log.details)}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
