// ============================================================
// SADA OS — ADVANCED BUSINESS RULE EDITOR & SIMULATOR MODAL
// Current vs Proposed comparison, live deterministic impact
// preview, contradiction warning engine, and governance safeguards.
// ============================================================

import { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Sliders,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Layers,
} from "lucide-react";
import type {
  BusinessRule,
  ImpactSimulationResult,
  LiveBusinessContext,
} from "@/types/business-rules";
import {
  SADAButton,
  SADAInput,
  SADATextarea,
  SADADialog,
  SADACheckbox,
  SADABadge,
} from "@/components/ui/sada-ui";
import { simulateRuleChangeImpact } from "@/lib/business-rules-intelligence-service";

interface AdvancedRuleEditorModalProps {
  rule: BusinessRule | null;
  allRules: BusinessRule[];
  liveContext: LiveBusinessContext;
  open: boolean;
  onClose: () => void;
  onSave: (rule: BusinessRule, newValue: string, changeReason: string) => Promise<boolean>;
  saving: boolean;
  initialRollbackReason?: string;
}

export function AdvancedRuleEditorModal({
  rule,
  allRules,
  liveContext,
  open,
  onClose,
  onSave,
  saving,
  initialRollbackReason,
}: AdvancedRuleEditorModalProps) {
  if (!rule) return null;

  const [editValue, setEditValue] = useState<string>(
    rule.numeric_value !== null && rule.numeric_value !== undefined
      ? String(rule.numeric_value)
      : (rule.text_value || "")
  );
  const [changeReason, setChangeReason] = useState<string>(initialRollbackReason || "");
  const [confirmedImpact, setConfirmedImpact] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setEditValue(
        rule.numeric_value !== null && rule.numeric_value !== undefined
          ? String(rule.numeric_value)
          : (rule.text_value || "")
      );
      setChangeReason(initialRollbackReason || "");
      setConfirmedImpact(false);
      setValidationError(null);
    }
  }, [rule, initialRollbackReason]);

  const sanitizedNumericValue = useMemo(() => {
    if (rule.value_type !== "numeric") return null;
    const clean = editValue.trim().replace(",", ".");
    const num = Number(clean);
    return isNaN(num) || !isFinite(num) ? null : num;
  }, [editValue, rule.value_type]);

  // Live Deterministic Impact Simulation
  const simulation: ImpactSimulationResult = useMemo(() => {
    const val = rule.value_type === "numeric"
      ? (sanitizedNumericValue !== null ? sanitizedNumericValue : Number(rule.numeric_value))
      : editValue.trim();
    return simulateRuleChangeImpact(rule, val, allRules, liveContext);
  }, [rule, sanitizedNumericValue, editValue, allRules, liveContext]);

  // Check validation bounds
  const hasBoundsError = useMemo(() => {
    if (rule.value_type !== "numeric") return false;
    if (sanitizedNumericValue === null) return true;
    if (rule.min_value !== null && sanitizedNumericValue < Number(rule.min_value)) return true;
    if (rule.max_value !== null && sanitizedNumericValue > Number(rule.max_value)) return true;
    return false;
  }, [rule, sanitizedNumericValue]);

  const isNumeric = rule.value_type === "numeric";
  const isUnchanged = isNumeric
    ? sanitizedNumericValue === Number(rule.numeric_value)
    : editValue.trim() === (rule.text_value || "").trim();

  const targetVersion = isUnchanged ? rule.version : rule.version + 1;

  const handleSave = async () => {
    setValidationError(null);

    if (isNumeric) {
      if (sanitizedNumericValue === null) {
        setValidationError("Please enter a valid numeric value.");
        return;
      }
      if (rule.min_value !== null && sanitizedNumericValue < Number(rule.min_value)) {
        setValidationError(`Value cannot be less than minimum allowed (${rule.min_value} ${rule.unit || ""}).`);
        return;
      }
      if (rule.max_value !== null && sanitizedNumericValue > Number(rule.max_value)) {
        setValidationError(`Value cannot exceed maximum allowed (${rule.max_value} ${rule.unit || ""}).`);
        return;
      }
    }

    if (!changeReason.trim()) {
      setValidationError("A documented change reason is mandatory for regulatory audit compliance.");
      return;
    }
    if (!confirmedImpact) {
      setValidationError("Please verify and confirm adherence to SADA governance policies.");
      return;
    }

    const success = await onSave(rule, editValue.trim(), changeReason.trim());
    if (success) {
      onClose();
    }
  };

  return (
    <SADADialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={`Configure & Simulate: ${rule.rule_name}`}
      description={`Update authoritative parameter for ${rule.rule_key}. Evaluate simulated business impact prior to committing.`}
      size="large"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <div className="text-[11px] font-mono text-muted-foreground">
            Target: <strong className="text-foreground">v{targetVersion}</strong>
            {rule.min_value !== null && rule.max_value !== null && (
              <span className="hidden sm:inline text-muted-foreground/80 ms-2">
                · Allowed: [{rule.min_value} – {rule.max_value} {rule.unit || ""}]
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <SADAButton variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </SADAButton>
            <SADAButton
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={
                saving ||
                hasBoundsError ||
                !confirmedImpact ||
                !changeReason.trim() ||
                !editValue.trim()
              }
            >
              {saving ? (
                <RefreshCw className="size-3.5 animate-spin me-1.5" />
              ) : (
                <CheckCircle2 className="size-3.5 me-1.5" />
              )}
              Commit Rule Configuration
            </SADAButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Governance & Immutability Notice */}
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
          <Info className="size-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/90 space-y-1">
            <p className="font-semibold text-primary">Governance & Immutability Guarantee</p>
            <p>
              Modifying this parameter commits a new version to the immutable audit registry (target:{" "}
              <strong>v{targetVersion}</strong>). Historical closed invoices, past commissions, and finalized ledger records remain permanently intact.
            </p>
          </div>
        </div>

        {/* Current vs Proposed Side-by-Side Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Current State */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Current Configuration
              </span>
              <SADABadge variant="outline" size="sm" className="font-mono text-[9px]">
                v{rule.version} (Active)
              </SADABadge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-display tabular-nums text-foreground">
                {rule.numeric_value ?? rule.text_value ?? "—"}
              </span>
              {rule.unit && (
                <span className="text-xs font-semibold text-muted-foreground">
                  {rule.unit}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Status: <span className="uppercase font-semibold">{simulation.currentStatus}</span>
            </div>
          </div>

          {/* Proposed State */}
          <div className="p-3.5 rounded-xl bg-card border border-primary/30 space-y-2 ring-1 ring-primary/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Proposed Configuration
              </span>
              <SADABadge variant="primary" size="sm" className="font-mono text-[9px]">
                Target v{targetVersion}
              </SADABadge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-display tabular-nums text-primary">
                {sanitizedNumericValue !== null ? sanitizedNumericValue : editValue || "—"}
              </span>
              {rule.unit && (
                <span className="text-xs font-semibold text-muted-foreground">
                  {rule.unit}
                </span>
              )}
              {simulation.delta !== null && simulation.delta !== 0 && (
                <span
                  className={`text-xs font-mono font-bold ms-1 ${
                    simulation.delta > 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  ({simulation.delta > 0 ? `+${simulation.delta}` : simulation.delta})
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Simulated: <span className="uppercase font-semibold text-primary">{simulation.simulatedStatus}</span>
            </div>
          </div>
        </div>

        {/* Value Input Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground block">
              Parameter Threshold Value {rule.unit ? `(${rule.unit})` : ""}
            </label>
            <span className="text-[11px] font-mono text-muted-foreground">
              Factory Default: {rule.default_numeric_value ?? rule.default_text_value ?? "—"} {rule.unit || ""}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <SADAInput
              type={isNumeric ? "number" : "text"}
              step={isNumeric ? "any" : undefined}
              min={rule.min_value ?? undefined}
              max={rule.max_value ?? undefined}
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder={`Enter threshold value in ${rule.unit || "units"}...`}
              className="font-mono text-base font-bold"
              error={hasBoundsError || !!validationError}
            />
            {rule.unit && (
              <span className="text-xs font-bold text-muted-foreground px-3 py-2 rounded-xl bg-muted/40 border border-border shrink-0">
                {rule.unit}
              </span>
            )}
          </div>
          {rule.min_value !== null && rule.max_value !== null && (
            <p className="text-[11px] text-muted-foreground font-mono">
              Allowed limits: [{rule.min_value} – {rule.max_value} {rule.unit || ""}]
            </p>
          )}
        </div>

        {/* Deterministic Impact Preview Box */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <TrendingUp className="size-3.5 text-primary" />
              <span>Deterministic Impact Simulation</span>
            </div>
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
              Exact Re-Evaluation Preview
            </span>
          </div>

          <p className="text-xs text-foreground font-medium">
            {simulation.finding}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {simulation.simulatedImpact}
          </p>

          {/* Affected Consumers */}
          {simulation.affectedConsumers.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-mono">Direct Consumers:</span>
              {simulation.affectedConsumers.map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-card text-muted-foreground border border-border"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contradiction Warnings (if any) */}
        {simulation.contradictionWarnings.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Contradiction / Policy Conflict Warning</span>
            </div>
            {simulation.contradictionWarnings.map((warn, idx) => (
              <p key={idx} className="text-[11px] font-mono ps-5">
                • {warn}
              </p>
            ))}
          </div>
        )}

        {/* Mandatory Change Reason */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground block">
              Change Reason <span className="text-destructive">*</span>
            </label>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              Mandatory Immutable Audit Evidence
            </span>
          </div>
          <SADATextarea
            value={changeReason}
            onChange={(e) => {
              setChangeReason(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Document why this business threshold is being adjusted (e.g. Board resolution, revised Q4 commission strategy, inflation-adjusted ad spread)..."
            rows={2}
          />
        </div>

        {/* Governance Confirmation Checkbox */}
        <div className="pt-2 border-t border-border/50">
          <SADACheckbox
            id="confirm-impact-simulator"
            checked={confirmedImpact}
            onCheckedChange={(checked) => {
              setConfirmedImpact(!!checked);
              if (validationError) setValidationError(null);
            }}
            label="I verify that this rule change adheres to SADA OS financial governance."
            description="Future calculations, alerts, and Smart Insights will adopt this threshold immediately upon save."
          />
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>
    </SADADialog>
  );
}
