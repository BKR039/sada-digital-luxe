// ============================================================
// SADA OS — RULE VERSION HISTORY & AUDIT ROLLBACK MODAL
// Immutable historical versions from business_rule_versions,
// complete audit trail, and safe 1-click rollback workflow.
// ============================================================

import { format, parseISO } from "date-fns";
import {
  Calendar,
  History,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  User,
  ArrowRight,
} from "lucide-react";
import type {
  BusinessRule,
  BusinessRuleVersion,
} from "@/types/business-rules";
import {
  SADAButton,
  SADADialog,
  SADABadge,
} from "@/components/ui/sada-ui";

interface RuleVersionHistoryModalProps {
  rule: BusinessRule | null;
  versions: BusinessRuleVersion[];
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onRollback: (rule: BusinessRule, version: BusinessRuleVersion) => void;
}

export function RuleVersionHistoryModal({
  rule,
  versions,
  loading,
  open,
  onClose,
  onRollback,
}: RuleVersionHistoryModalProps) {
  if (!rule) return null;

  return (
    <SADADialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={`Audit History & Version Ledger: ${rule.rule_name}`}
      description={`Immutable historical version trail for ${rule.rule_key}. Every change records author, timestamp, delta, and justification.`}
      size="large"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] font-mono text-muted-foreground">
            {versions.length} historical version{versions.length === 1 ? "" : "s"} archived
          </span>
          <SADAButton variant="outline" size="sm" onClick={onClose}>
            Close
          </SADAButton>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Active Baseline Status */}
        <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Current Active Baseline
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold font-display text-foreground">
                {rule.numeric_value ?? rule.text_value ?? "—"} {rule.unit || ""}
              </span>
              <SADABadge variant="primary" size="sm" className="font-mono text-[9px]">
                v{rule.version} (Active)
              </SADABadge>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono text-end">
            <span>Last Updated: </span>
            <span className="text-foreground">
              {rule.updated_at ? format(parseISO(rule.updated_at), "MMM dd, yyyy HH:mm") : "Initial"}
            </span>
          </div>
        </div>

        {/* History List */}
        {loading ? (
          <div className="p-8 grid place-items-center font-mono text-xs text-muted-foreground">
            <RefreshCw className="size-5 animate-spin mb-2 text-primary" />
            Loading Immutable Version History...
          </div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground font-mono bg-muted/20 rounded-xl border border-border">
            No previous versions archived for this rule. Currently at initial baseline (v1).
          </div>
        ) : (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pe-1 sada-scrollbar">
            {versions.map((v) => {
              const versionVal = v.numeric_value !== null ? v.numeric_value : (v.text_value || "—");
              const isSameAsCurrent =
                rule.value_type === "numeric"
                  ? Number(v.numeric_value) === Number(rule.numeric_value)
                  : v.text_value === rule.text_value;

              return (
                <div
                  key={v.id}
                  className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2.5 text-xs hover:border-border transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SADABadge variant="outline" size="sm" className="font-mono text-[10px]">
                        v{v.version}
                      </SADABadge>
                      <span className="font-bold font-display text-foreground text-sm">
                        {versionVal} {rule.unit || ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Calendar className="size-3 text-muted-foreground" />
                        {v.created_at ? format(parseISO(v.created_at), "MMM dd, yyyy HH:mm") : "Archived"}
                      </span>

                      {!isSameAsCurrent && (
                        <SADAButton
                          variant="outline"
                          size="sm"
                          onClick={() => onRollback(rule, v)}
                          className="h-6 text-[10px] px-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                          title="Restore this past configuration as a new version"
                        >
                          <RotateCcw className="size-2.5 me-1" /> Rollback to v{v.version}
                        </SADAButton>
                      )}
                    </div>
                  </div>

                  {v.change_reason && (
                    <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg italic">
                      "{v.change_reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono pt-0.5">
                    <span className="flex items-center gap-1">
                      <User className="size-3 text-muted-foreground/60" />
                      Changed by: {v.changed_by ? v.changed_by.slice(0, 8) + "..." : "Super Admin"}
                    </span>
                    <span>Archive Entry: {v.id.slice(0, 8)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SADADialog>
  );
}
