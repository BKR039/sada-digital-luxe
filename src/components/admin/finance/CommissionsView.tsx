import { useState } from "react";
import { SalesCommission, formatCurrency } from "@/types/finance";
import {
  createSalesCommission,
  payCommission,
} from "@/lib/finance-service";
import {
  Percent,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Building,
  DollarSign,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SADAInput } from "@/components/ui/sada-ui";
import { SADASearch } from "@/components/ui/sada-search";
import { SADASelect } from "@/components/ui/sada-select";
import { format } from "date-fns";
import { toast } from "sonner";

interface CommissionsViewProps {
  commissions: SalesCommission[];
  clients: Array<{ id: string; name: string }>;
  teamMembers: Array<{ id: string; name: string }>;
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function CommissionsView({
  commissions,
  clients,
  teamMembers,
  onRefresh,
  currentUserId,
  currentUserName,
}: CommissionsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Commission Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceRevenue, setServiceRevenue] = useState("1500");
  const [commissionRate, setCommissionRate] = useState("15");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Paying commission state
  const [payingCommission, setPayingCommission] = useState<SalesCommission | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const numService = parseFloat(serviceRevenue) || 0;
  const numRate = parseFloat(commissionRate) || 0;
  const liveCommissionAmount = Number(((numService * numRate) / 100).toFixed(3));

  const filtered = commissions.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (c.teamMemberName && c.teamMemberName.toLowerCase().includes(term)) ||
        (c.clientName && c.clientName.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const totalCommissions = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const paidCommissions = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commissionAmount, 0);
  const pendingCommissions = totalCommissions - paidCommissions;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamMemberId || !clientId) {
      toast.error("Please choose both an employee and a client.");
      return;
    }
    if (liveCommissionAmount <= 0) {
      toast.error("Please provide valid revenue and rate values.");
      return;
    }

    setIsSubmitting(true);
    const res = await createSalesCommission({
      teamMemberId,
      clientId,
      serviceRevenue: numService,
      commissionRate: numRate,
      notes: notes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Failed to create commission: ${res.error.message}`);
    } else {
      toast.success("Sales commission registered successfully");
      setIsCreateOpen(false);
      setNotes("");
      onRefresh();
    }
  };

  const handlePay = async (comm: SalesCommission) => {
    setIsPaying(true);
    const res = await payCommission({
      commission: comm,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsPaying(false);

    if (res.error) {
      toast.error(`Failed to disburse commission: ${res.error.message}`);
    } else {
      toast.success("Commission payment disbursed successfully");
      setPayingCommission(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Commissions KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Total Sales Commissions
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1">
            {formatCurrency(totalCommissions)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Accrued on Client Service Revenue
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 shadow-xs bg-emerald-500/5">
          <div className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-300 font-semibold">
            Disbursed to Payroll
          </div>
          <div className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(paidCommissions)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Settled in Expense Ledger
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-amber-500/30 shadow-xs bg-amber-500/5">
          <div className="text-[11px] font-mono uppercase text-amber-700 dark:text-amber-300 font-semibold">
            Pending Payout
          </div>
          <div className="text-xl font-bold font-display text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(pendingCommissions)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Awaiting executive disbursement
          </div>
        </div>
      </div>

      {/* 2. Control Bar */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Percent className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-foreground tracking-tight">
              Sales & Account Commissions
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              Commissions linked directly to verified client service revenue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <SADASearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search member, client..."
            size="compact"
            className="w-full sm:w-48"
          />

          <div className="w-full sm:w-36">
            <SADASelect
              value={statusFilter}
              onChange={setStatusFilter}
              size="compact"
              options={[
                { value: "all", label: "All Statuses" },
                { value: "pending", label: "Pending" },
                { value: "paid", label: "Disbursed" },
              ]}
            />
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Commission</span>
          </button>
        </div>
      </div>

      {/* 3. Commissions Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs font-mono">
            No sales commissions recorded.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border/40">
              {filtered.map((comm) => (
                <div key={comm.id} className="p-4 space-y-3 text-start">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                        <User className="size-3 text-muted-foreground shrink-0" />
                        <span>{comm.teamMemberName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground text-[11px] mt-0.5">
                        <Building className="size-3 text-muted-foreground shrink-0" />
                        <span>{comm.clientName}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        comm.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {comm.status === "paid" ? (
                        <CheckCircle2 className="size-2.5" />
                      ) : (
                        <Clock className="size-2.5" />
                      )}
                      {comm.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 font-mono">
                    <span className="text-xs text-muted-foreground">Commission</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        ({comm.commissionRate}%)
                      </span>
                      <span className="text-base font-bold text-foreground">
                        {formatCurrency(comm.commissionAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Service Rev: <span className="text-foreground font-semibold">{formatCurrency(comm.serviceRevenue)}</span>
                    </span>

                    <div>
                      {comm.status !== "paid" ? (
                        <button
                          onClick={() => handlePay(comm)}
                          disabled={isPaying}
                          className="px-3 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-semibold text-xs transition-colors border border-purple-500/30 disabled:opacity-50"
                        >
                          Disburse
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Logged to Payroll
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/70 text-[11px] font-mono uppercase text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3.5">Recipient</th>
                    <th className="p-3.5">Client & Deal</th>
                    <th className="p-3.5">Service Revenue</th>
                    <th className="p-3.5">Rate</th>
                    <th className="p-3.5">Commission [AUTO]</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filtered.map((comm) => (
                    <tr key={comm.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-sans font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 text-muted-foreground shrink-0" />
                          <span>{comm.teamMemberName}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-sans">
                        <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                          <Building className="size-3 text-muted-foreground shrink-0" />
                          <span>{comm.clientName}</span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-foreground font-semibold">
                        {formatCurrency(comm.serviceRevenue)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-purple-600 dark:text-purple-400 font-bold">
                        {comm.commissionRate}%
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-bold text-foreground">
                        {formatCurrency(comm.commissionAmount)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            comm.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {comm.status === "paid" ? (
                            <CheckCircle2 className="size-2.5" />
                          ) : (
                            <Clock className="size-2.5" />
                          )}
                          {comm.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        {comm.status !== "paid" ? (
                          <button
                            onClick={() => handlePay(comm)}
                            disabled={isPaying}
                            className="px-3 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-semibold text-[11px] transition-colors border border-purple-500/30 disabled:opacity-50"
                          >
                            Disburse
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Logged to Payroll
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* CREATE COMMISSION MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md w-[94vw] p-6 rounded-3xl bg-card border border-border/80 shadow-2xl">
          <DialogHeader className="text-left pb-3 border-b border-border/50">
            <DialogTitle className="text-lg font-bold font-display text-foreground">
              Link Sales Commission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tied to actual client service revenue with automated calculation
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Team Member (Recipient)
              </label>
              <SADASelect
                value={teamMemberId}
                onChange={setTeamMemberId}
                placeholder="Choose Specialist..."
                options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Client Deal
              </label>
              <SADASelect
                value={clientId}
                onChange={setClientId}
                placeholder="Choose Client..."
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Service Revenue (TND)
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  value={serviceRevenue}
                  onChange={(e) => setServiceRevenue(e.target.value)}
                  placeholder="1500.000"
                  prefix="TND"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Commission Rate (%)
                </label>
                <SADAInput
                  type="number"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="15"
                  suffix="%"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Live Calculation */}
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between font-mono text-xs">
              <span className="text-purple-700 dark:text-purple-300">
                Calculated Commission ({numRate}%):
              </span>
              <strong className="text-foreground text-sm font-bold">
                {formatCurrency(liveCommissionAmount)}
              </strong>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Notes / Agreement
              </label>
              <SADAInput
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contractual deal commission..."
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? "Linking..." : "Confirm & Accrue"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
