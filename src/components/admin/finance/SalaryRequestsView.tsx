import { useState } from "react";
import {
  SalaryRequest,
  SalaryRecord,
  formatCurrency,
  PAYMENT_METHOD_OPTIONS,
} from "@/types/finance";
import { approveSalaryRequest, rejectSalaryRequest } from "@/lib/finance-service";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADAInput, SADATextarea, SADAButton, SADAEmptyState } from "@/components/ui/sada-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

function safeFormatDateTime(d: string | null | undefined, fmt: string = "MMM d, yyyy HH:mm"): string {
  if (!d) return "—";
  try {
    const parsed = parseISO(d);
    if (isNaN(parsed.getTime())) return d;
    return format(parsed, fmt);
  } catch {
    return d || "—";
  }
}

interface SalaryRequestsViewProps {
  salaryRequests: SalaryRequest[];
  salaryRecords: SalaryRecord[];
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function SalaryRequestsView({
  salaryRequests,
  salaryRecords,
  onRefresh,
  currentUserId,
  currentUserName,
}: SalaryRequestsViewProps) {
  // Modal states
  const [approvingRequest, setApprovingRequest] = useState<SalaryRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<SalaryRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval Form
  const [approvedAmount, setApprovedAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [approvalNotes, setApprovalNotes] = useState("");

  // Rejection Form
  const [rejectionNotes, setRejectionNotes] = useState("");

  const pendingRequests = salaryRequests.filter((r) => r.status === "pending");
  const reviewedRequests = salaryRequests.filter((r) => r.status !== "pending");

  const handleOpenApprove = (req: SalaryRequest) => {
    setApprovingRequest(req);
    setApprovedAmount(String(req.requested_amount));
    setPaymentDate(new Date());
    setPaymentMethod("Bank Transfer");
    setApprovalNotes("");
  };

  const handleOpenReject = (req: SalaryRequest) => {
    setRejectingRequest(req);
    setRejectionNotes("");
  };

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingRequest) return;

    const num = parseFloat(approvedAmount);
    if (isNaN(num) || num <= 0) {
      toast.error("Please provide a valid approved amount.");
      return;
    }

    setIsSubmitting(true);
    const res = await approveSalaryRequest({
      requestId: approvingRequest.id,
      teamMemberId: approvingRequest.team_member_id,
      approvedAmount: num,
      paymentDate: format(paymentDate, "yyyy-MM-dd"),
      paymentMethod,
      reviewNotes: approvalNotes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Approval failed: ${res.error.message}`);
    } else {
      toast.success("Salary request approved and payout recorded");
      setApprovingRequest(null);
      onRefresh();
    }
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;
    if (!rejectionNotes.trim()) {
      toast.error("Please state a reason for rejecting the request.");
      return;
    }

    setIsSubmitting(true);
    const res = await rejectSalaryRequest({
      requestId: rejectingRequest.id,
      reviewNotes: rejectionNotes.trim(),
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Rejection failed: ${res.error.message}`);
    } else {
      toast.success("Salary request rejected");
      setRejectingRequest(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold font-display text-foreground">
                Pending Early Salary Requests
              </h2>
              {pendingRequests.length > 0 && (
                <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                  {pendingRequests.length} Awaiting Review
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Workers request advances or early disbursements. Approval instantly creates a salary payment and financial outflow.
            </p>
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <SADAEmptyState
            icon={CheckCircle2}
            title="All Clear — No Pending Requests"
            description="There are no pending salary advance or payout requests from workers at this time."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((req) => {
              const record = salaryRecords.find((r) => r.team_member_id === req.team_member_id);

              return (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl bg-card border border-amber-500/30 shadow-sm flex flex-col justify-between hover:border-amber-500/50 transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-foreground">
                            {req.team_member?.name || "Team Member"}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            • {req.team_member?.division || "Staff"}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="size-3" />
                          Requested For: {req.requested_date}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                          {formatCurrency(req.requested_amount)}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {record ? `Base: ${formatCurrency(record.base_amount)}` : "Advance"}
                        </span>
                      </div>
                    </div>

                    {/* Reason Box */}
                    <div className="mt-3.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                        Reason Provided:
                      </div>
                      <p className="text-xs text-foreground mt-1 leading-relaxed font-medium">
                        "{req.reason}"
                      </p>
                      {req.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">
                          Note: {req.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-2.5 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                      <span>Submitted: {safeFormatDateTime(req.created_at)}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">PENDING APPROVAL</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                    <SADAButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenReject(req)}
                      leftIcon={<XCircle className="size-3.5" />}
                      className="flex-1 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 h-8"
                    >
                      Reject
                    </SADAButton>

                    <SADAButton
                      size="sm"
                      variant="primary"
                      onClick={() => handleOpenApprove(req)}
                      leftIcon={<CheckCircle2 className="size-3.5" />}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-8"
                    >
                      Approve & Pay
                    </SADAButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reviewed Requests History */}
      <div className="pt-6 border-t border-border/60">
        <div className="mb-3">
          <h3 className="text-sm font-bold font-display text-foreground">
            Processed Requests History
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit history of approved disbursements and rejected petitions.
          </p>
        </div>

        {/* Mobile History Cards */}
        <div className="block md:hidden space-y-3">
          {reviewedRequests.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-card/40 text-center">
              <p className="text-muted-foreground font-mono text-xs">
                No past reviewed requests.
              </p>
            </div>
          ) : (
            reviewedRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-2.5 text-start"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground text-xs">
                    {req.team_member?.name || "Team Member"}
                  </span>
                  {req.status === "approved" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <XCircle className="size-3" /> Rejected
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Approved / Requested</span>
                  <div className="text-right">
                    <span className="font-bold font-mono text-xs text-foreground block" dir="ltr">
                      {req.approved_amount ? formatCurrency(req.approved_amount) : "—"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                      Req: {formatCurrency(req.requested_amount)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 text-[11px] space-y-1">
                  <div className="text-muted-foreground">
                    Reason: <span className="text-foreground">"{req.reason}"</span>
                  </div>
                  {req.review_notes && (
                    <div className="text-muted-foreground">
                      Decision Note: <span className="font-medium text-foreground">{req.review_notes}</span>
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-muted-foreground/70" dir="ltr">
                    Target Date: {req.requested_date}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop History Table */}
        <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Worker</th>
                  <th className="py-3 px-4">Requested</th>
                  <th className="py-3 px-4">Approved</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Review Decision & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {reviewedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-mono text-xs">
                      No past reviewed requests.
                    </td>
                  </tr>
                ) : (
                  reviewedRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {req.requested_date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                        {req.team_member?.name || "Team Member"}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {formatCurrency(req.requested_amount)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        {req.approved_amount ? formatCurrency(req.approved_amount) : "—"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {req.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="size-3" /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <XCircle className="size-3" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-sm">
                        <div className="truncate text-foreground font-medium">
                          {req.review_notes || "No notes recorded"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                          Reason: "{req.reason}"
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* APPROVE DIALOG */}
      <Dialog open={!!approvingRequest} onOpenChange={(open) => !open && setApprovingRequest(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display">
              Approve Advance: {approvingRequest?.team_member?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmApproval} className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <div className="font-semibold text-foreground">Requested Reason:</div>
              <p className="mt-1 text-muted-foreground font-mono">
                "{approvingRequest?.reason}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Approved Amount (TND) *
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  prefix="TND"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Payment Date *
                </label>
                <SADADatePicker
                  value={format(paymentDate, "yyyy-MM-dd")}
                  onChange={(dStr) => dStr && setPaymentDate(parseISO(dStr))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Disbursement Method
              </label>
              <SADASelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Approval Note / Instructions
              </label>
              <SADATextarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Optional notes to the worker or accounting record"
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <SADAButton type="button" variant="secondary" onClick={() => setApprovingRequest(null)}>
                Cancel
              </SADAButton>
              <SADAButton type="submit" variant="primary" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                Confirm & Execute Payment
              </SADAButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display text-rose-600">
              Reject Request: {rejectingRequest?.team_member?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmRejection} className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
              Please provide a clear reason for the rejection. This explanation will be visible to the worker.
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                Rejection Reason *
              </label>
              <SADATextarea
                required
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="e.g. Current payroll policy advance threshold exceeded for this quarter."
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <SADAButton type="button" variant="secondary" onClick={() => setRejectingRequest(null)}>
                Cancel
              </SADAButton>
              <SADAButton type="submit" variant="primary" isLoading={isSubmitting} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">
                Confirm Rejection
              </SADAButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
