import { useState } from "react";
import {
  SalaryRecord,
  SalaryPayment,
  formatCurrency,
  SALARY_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/types/finance";
import { upsertSalaryRecord, createDirectSalaryPayment } from "@/lib/finance-service";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADAInput, SADATextarea, SADAButton } from "@/components/ui/sada-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  CreditCard,
  Calendar,
  Edit2,
  DollarSign,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface SalariesViewProps {
  salaryRecords: SalaryRecord[];
  salaryPayments: SalaryPayment[];
  teamMembers: Array<{
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    role: string;
    division: string;
    photo_url: string | null;
  }>;
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function SalariesView({
  salaryRecords,
  salaryPayments,
  teamMembers,
  onRefresh,
  currentUserId,
  currentUserName,
}: SalariesViewProps) {
  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryRecord | null>(null);

  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [targetMemberForPayout, setTargetMemberForPayout] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for Salary Structure
  const [selectedMemberId, setSelectedMemberId] = useState(teamMembers[0]?.id || "");
  const [baseAmount, setBaseAmount] = useState("");
  const [salaryType, setSalaryType] = useState("monthly");
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [nextPaymentDate, setNextPaymentDate] = useState<Date | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [bankDetails, setBankDetails] = useState("");
  const [recordStatus, setRecordStatus] = useState("active");
  const [recordNotes, setRecordNotes] = useState("");

  // Form state for Payout
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState<Date>(new Date());
  const [payoutPeriodStart, setPayoutPeriodStart] = useState<Date | undefined>(undefined);
  const [payoutPeriodEnd, setPayoutPeriodEnd] = useState<Date | undefined>(undefined);
  const [payoutType, setPayoutType] = useState<"regular" | "advance" | "bonus" | "adjustment">("regular");
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer");
  const [payoutRef, setPayoutRef] = useState("");
  const [payoutReceiptUrl, setPayoutReceiptUrl] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  // Open Edit Structure
  const handleOpenEditRecord = (record: SalaryRecord) => {
    setEditingRecord(record);
    setSelectedMemberId(record.team_member_id);
    setBaseAmount(String(record.base_amount));
    setSalaryType(record.salary_type);
    setPaymentFrequency(record.payment_frequency);
    setEffectiveDate(parseISO(record.effective_date));
    setNextPaymentDate(record.next_payment_date ? parseISO(record.next_payment_date) : undefined);
    setPaymentMethod(record.payment_method || "Bank Transfer");
    setBankDetails(record.bank_details || "");
    setRecordStatus(record.status);
    setRecordNotes(record.notes || "");
    setIsRecordModalOpen(true);
  };

  // Open New Structure
  const handleOpenNewRecord = (memberId?: string) => {
    setEditingRecord(null);
    setSelectedMemberId(memberId || teamMembers[0]?.id || "");
    setBaseAmount("");
    setSalaryType("monthly");
    setPaymentFrequency("monthly");
    setEffectiveDate(new Date());
    setNextPaymentDate(undefined);
    setPaymentMethod("Bank Transfer");
    setBankDetails("");
    setRecordStatus("active");
    setRecordNotes("");
    setIsRecordModalOpen(true);
  };

  // Open Disburse Payout
  const handleOpenPayout = (member: any, base?: number) => {
    setTargetMemberForPayout(member);
    setPayoutAmount(base ? String(base) : "");
    setPayoutDate(new Date());
    setPayoutPeriodStart(undefined);
    setPayoutPeriodEnd(undefined);
    setPayoutType("regular");
    setPayoutMethod("Bank Transfer");
    setPayoutRef("");
    setPayoutReceiptUrl("");
    setPayoutNotes("");
    setIsPayoutModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(baseAmount);
    if (isNaN(num) || num < 0) {
      toast.error("Please provide a valid base amount.");
      return;
    }
    if (!selectedMemberId) {
      toast.error("Please choose a team member.");
      return;
    }

    setIsSubmitting(true);
    const res = await upsertSalaryRecord({
      id: editingRecord?.id,
      teamMemberId: selectedMemberId,
      baseAmount: num,
      salaryType,
      paymentFrequency,
      effectiveDate: format(effectiveDate, "yyyy-MM-dd"),
      nextPaymentDate: nextPaymentDate ? format(nextPaymentDate, "yyyy-MM-dd") : null,
      paymentMethod,
      bankDetails: bankDetails.trim() || undefined,
      status: recordStatus,
      notes: recordNotes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Failed to save salary structure: ${res.error.message}`);
    } else {
      toast.success(editingRecord ? "Salary structure updated" : "Salary structure created");
      setIsRecordModalOpen(false);
      onRefresh();
    }
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(payoutAmount);
    if (isNaN(num) || num <= 0) {
      toast.error("Please enter a valid payout amount.");
      return;
    }
    if (!targetMemberForPayout) return;

    setIsSubmitting(true);
    const matchedRecord = salaryRecords.find((r) => r.team_member_id === targetMemberForPayout.id);

    const res = await createDirectSalaryPayment({
      teamMemberId: targetMemberForPayout.id,
      salaryRecordId: matchedRecord?.id,
      amount: num,
      paymentDate: format(payoutDate, "yyyy-MM-dd"),
      periodStart: payoutPeriodStart ? format(payoutPeriodStart, "yyyy-MM-dd") : null,
      periodEnd: payoutPeriodEnd ? format(payoutPeriodEnd, "yyyy-MM-dd") : null,
      paymentType: payoutType,
      paymentMethod: payoutMethod,
      reference: payoutRef.trim() || undefined,
      receiptUrl: payoutReceiptUrl.trim() || undefined,
      notes: payoutNotes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Failed to record salary payout: ${res.error.message}`);
    } else {
      toast.success("Salary payout recorded successfully");
      setIsPayoutModalOpen(false);
      onRefresh();
    }
  };

  const memberOptions = teamMembers.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.division || m.role})`,
  }));

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold font-display text-foreground">
            Team Compensation Structure
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Governing salary contracts, payment schedules, and payout disbursements.
          </p>
        </div>

        <SADAButton
          onClick={() => handleOpenNewRecord()}
          size="sm"
          variant="primary"
          leftIcon={<Plus className="size-3.5" />}
          className="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
        >
          Set Member Salary
        </SADAButton>
      </div>

      {/* Member Compensation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((member) => {
          const record = salaryRecords.find((r) => r.team_member_id === member.id);

          return (
            <div
              key={member.id}
              className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between hover:border-purple-500/40 transition-all"
            >
              <div>
                {/* Member Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold font-display text-foreground truncate">
                      {member.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {member.position || member.division || "Team Member"}
                    </p>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border font-semibold uppercase tracking-wider text-muted-foreground">
                    {member.role}
                  </span>
                </div>

                {/* Salary Metrics */}
                <div className="mt-4 p-3.5 rounded-xl bg-muted/30 border border-border/60">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    Current Base Compensation
                  </div>
                  <div className="text-xl font-bold font-display text-foreground mt-1 tabular-nums sada-num-kpi">
                    {record ? formatCurrency(record.base_amount) : "Not Configured"}
                    {record && (
                      <span className="text-xs font-mono font-normal text-muted-foreground">
                        {" "}
                        / {record.payment_frequency}
                      </span>
                    )}
                  </div>

                  {record && (
                    <div className="mt-2.5 pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Method:</span>
                        <span className="font-medium text-foreground truncate block">
                          {record.payment_method}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Next Due:</span>
                        <span className="font-medium text-foreground truncate block">
                          {record.next_payment_date || "End of Month"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {record?.bank_details && (
                  <div className="mt-2.5 text-[11px] font-mono text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-lg border border-border/40 truncate">
                    <span className="text-foreground font-semibold">RIB:</span> {record.bank_details}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                <SADAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => (record ? handleOpenEditRecord(record) : handleOpenNewRecord(member.id))}
                  leftIcon={<Edit2 className="size-3" />}
                  className="flex-1 text-xs"
                >
                  {record ? "Edit Structure" : "Set Salary"}
                </SADAButton>

                <SADAButton
                  size="sm"
                  variant="primary"
                  onClick={() => handleOpenPayout(member, record?.base_amount)}
                  leftIcon={<ArrowUpRight className="size-3" />}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  Disburse
                </SADAButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* Salary Payout History Table */}
      <div className="pt-4 border-t border-border/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold font-display text-foreground">
              Salary Payout History (Period Outflows)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Authoritative salary transactions mirrored to financial expenses.
            </p>
          </div>
        </div>

        {/* Mobile Payouts List */}
        <div className="block md:hidden space-y-3">
          {salaryPayments.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-card/40 text-center">
              <p className="text-muted-foreground font-mono text-xs">
                No salary disbursements recorded for this period.
              </p>
            </div>
          ) : (
            salaryPayments.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3 text-start"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border/60 font-semibold uppercase">
                      {p.payment_type}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                      {p.payment_date}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" /> Paid
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 font-semibold text-sm text-foreground truncate">
                    {p.team_member?.name || "Team Member"}
                  </div>
                  <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 shrink-0" dir="ltr">
                    -{formatCurrency(p.amount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground font-mono text-[11px] truncate">
                    {p.payment_method}
                    {p.reference && ` • Ref: ${p.reference}`}
                  </span>
                  {p.receipt_url && (
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                    >
                      <ExternalLink className="size-3" />
                      <span>Receipt</span>
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Method & Ref</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {salaryPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground font-mono text-xs">
                      No salary disbursements recorded for this period.
                    </td>
                  </tr>
                ) : (
                  salaryPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {p.payment_date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                        {p.team_member?.name || "Team Member"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border/60 font-semibold uppercase">
                          {p.payment_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                        {p.payment_method}
                        {p.reference && ` • Ref: ${p.reference}`}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        -{formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Paid
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {p.receipt_url ? (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-block"
                            title="Open Receipt"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px] font-mono">—</span>
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

      {/* MODAL 1: SALARY STRUCTURE (UPSERT) */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display">
              {editingRecord ? "Edit Salary Contract" : "Set Member Salary Structure"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveRecord} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Team Member *
              </label>
              <SADASelect
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                options={memberOptions}
                disabled={!!editingRecord}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Base Amount (TND) *
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  placeholder="e.g. 1800"
                  prefix="TND"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Salary Type
                </label>
                <SADASelect
                  value={salaryType}
                  onChange={setSalaryType}
                  options={SALARY_TYPE_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Payment Frequency
                </label>
                <SADASelect
                  value={paymentFrequency}
                  onChange={setPaymentFrequency}
                  options={PAYMENT_FREQUENCY_OPTIONS}
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Effective Date
                </label>
                <SADADatePicker
                  value={format(effectiveDate, "yyyy-MM-dd")}
                  onChange={(dStr) => dStr && setEffectiveDate(parseISO(dStr))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Payment Method
                </label>
                <SADASelect
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Status
                </label>
                <SADASelect
                  value={recordStatus}
                  onChange={setRecordStatus}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "terminated", label: "Terminated" },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Bank Details (RIB / Account / Agency)
              </label>
              <SADAInput
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="e.g. BIAT 08 000 00000000000 00"
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Notes
              </label>
              <SADATextarea
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                placeholder="Optional contractual notes or stipulations"
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <SADAButton type="button" variant="secondary" onClick={() => setIsRecordModalOpen(false)}>
                Cancel
              </SADAButton>
              <SADAButton type="submit" variant="primary" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                Save Salary
              </SADAButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: DISBURSE SALARY PAYOUT */}
      <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display">
              Disburse Salary: {targetMemberForPayout?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePayout} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Payout Amount (TND) *
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  prefix="TND"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Disbursement Date *
                </label>
                <SADADatePicker
                  value={format(payoutDate, "yyyy-MM-dd")}
                  onChange={(dStr) => dStr && setPayoutDate(parseISO(dStr))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Payout Type
                </label>
                <SADASelect
                  value={payoutType}
                  onChange={(v) => setPayoutType(v as any)}
                  options={[
                    { value: "regular", label: "Regular Salary" },
                    { value: "advance", label: "Salary Advance" },
                    { value: "bonus", label: "Performance Bonus" },
                    { value: "adjustment", label: "Adjustment" },
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Payment Method
                </label>
                <SADASelect
                  value={payoutMethod}
                  onChange={setPayoutMethod}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Reference # (Wire transfer or Cheque #)
              </label>
              <SADAInput
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder="e.g. VIR-2026-SEP-01"
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Receipt / Transfer Confirmation URL
              </label>
              <SADAInput
                value={payoutReceiptUrl}
                onChange={(e) => setPayoutReceiptUrl(e.target.value)}
                placeholder="https://... receipt image or pdf link"
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Payout Notes
              </label>
              <SADATextarea
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Optional remark"
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <SADAButton type="button" variant="secondary" onClick={() => setIsPayoutModalOpen(false)}>
                Cancel
              </SADAButton>
              <SADAButton type="submit" variant="primary" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                Confirm Payout
              </SADAButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
