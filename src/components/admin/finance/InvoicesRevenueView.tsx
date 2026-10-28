import { useState } from "react";
import { Invoice, formatCurrency, FinancialAccount } from "@/types/finance";
import {
  createInvoice,
  recordInvoicePayment,
} from "@/lib/finance-service";
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building,
  DollarSign,
  ArrowDownLeft,
  Calendar,
  Layers,
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
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { format } from "date-fns";
import { toast } from "sonner";

interface InvoicesRevenueViewProps {
  invoices: Invoice[];
  clients: Array<{ id: string; name: string }>;
  accounts: FinancialAccount[];
  clientServicesRevenue: number;
  sponsoringCollected: number;
  otherRevenue: number;
  totalRevenue: number;
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function InvoicesRevenueView({
  invoices,
  clients,
  accounts,
  clientServicesRevenue,
  sponsoringCollected,
  otherRevenue,
  totalRevenue,
  onRefresh,
  currentUserId,
  currentUserName,
}: InvoicesRevenueViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Invoice Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [sponsoringBudget, setSponsoringBudget] = useState("");
  const [issueDate, setIssueDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Record Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [isPaying, setIsPaying] = useState(false);

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(term) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(term))
      );
    }
    return true;
  });

  // Calculate live total for invoice creation
  const liveService = parseFloat(serviceFee) || 0;
  const liveSponsoring = parseFloat(sponsoringBudget) || 0;
  const liveTotal = liveService + liveSponsoring;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client.");
      return;
    }
    if (liveTotal <= 0) {
      toast.error("Please enter a service fee or sponsoring budget.");
      return;
    }

    setIsSubmitting(true);
    const res = await createInvoice({
      clientId,
      issueDate,
      dueDate: dueDate || undefined,
      serviceFee: liveService,
      sponsoringBudget: liveSponsoring,
      notes: notes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(`Failed to create invoice: ${res.error.message}`);
    } else {
      toast.success("Invoice created successfully");
      setIsCreateOpen(false);
      setClientId("");
      setServiceFee("");
      setSponsoringBudget("");
      setNotes("");
      onRefresh();
    }
  };

  const handleRecordPayment = async () => {
    if (!payingInvoice) return;
    setIsPaying(true);
    const res = await recordInvoicePayment({
      invoice: payingInvoice,
      paymentDate,
      paymentMethod,
      accountId: selectedAccountId || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsPaying(false);

    if (res.error) {
      toast.error(`Failed to record payment: ${res.error.message}`);
    } else {
      toast.success("Invoice payment recorded successfully");
      setPayingInvoice(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Revenue Categorization Summary Strip (Section 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Client Services
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1">
            {formatCurrency(clientServicesRevenue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Retainers & Production Fees
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Sponsoring Collected
          </div>
          <div className="text-xl font-bold font-display text-indigo-600 dark:text-indigo-400 mt-1">
            {formatCurrency(sponsoringCollected)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Ad budget (not automatic profit)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Other Inflows
          </div>
          <div className="text-xl font-bold font-display text-foreground mt-1">
            {formatCurrency(otherRevenue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Advisory & Miscellaneous
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 shadow-xs bg-emerald-500/5">
          <div className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-300 font-semibold">
            Total Revenue Collected
          </div>
          <div className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Authoritative Gross Revenue
          </div>
        </div>
      </div>

      {/* 2. Invoices Management Header */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <FileText className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-foreground tracking-tight">
              Invoices & Revenue Engine
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              Reconciled billing with automated ledger integration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <SADASearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search invoice #..."
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
                { value: "paid", label: "Paid" },
                { value: "sent", label: "Sent / Unpaid" },
                { value: "overdue", label: "Overdue" },
              ]}
            />
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* 3. Invoices Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs font-mono">
            No invoices found for this selection.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border/40">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-foreground block">
                        {inv.invoiceNumber}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-foreground mt-0.5">
                        <Building className="size-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{inv.clientName}</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        inv.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : inv.status === "overdue"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {inv.status === "paid" ? (
                        <CheckCircle2 className="size-2.5" />
                      ) : inv.status === "overdue" ? (
                        <AlertTriangle className="size-2.5" />
                      ) : (
                        <Clock className="size-2.5" />
                      )}
                      {inv.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-mono">Total Due</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(inv.totalAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        Service Fee
                      </span>
                      <span className="font-mono font-semibold text-foreground text-[11px]">
                        {formatCurrency(inv.serviceFee ?? inv.serviceRevenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        Sponsoring
                      </span>
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 text-[11px]">
                        {formatCurrency(inv.sponsoringBudget)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] font-mono text-muted-foreground">
                    <div>
                      <span>Due: </span>
                      <span className="text-foreground">{inv.dueDate || "—"}</span>
                    </div>
                    <div>
                      {inv.status !== "paid" ? (
                        <button
                          onClick={() => setPayingInvoice(inv)}
                          className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors border border-emerald-500/30"
                        >
                          Record Payment
                        </button>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500" /> Settled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/70 text-[11px] font-mono uppercase text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Client</th>
                    <th className="p-3.5">Issue Date</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Service Fee</th>
                    <th className="p-3.5">Sponsoring Budget</th>
                    <th className="p-3.5">Total Amount</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-bold text-foreground whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>

                      <td className="p-3.5 font-sans font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building className="size-3 text-muted-foreground shrink-0" />
                          <span>{inv.clientName}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-muted-foreground whitespace-nowrap text-[11px]">
                        {inv.issueDate}
                      </td>

                      <td className="p-3.5 text-muted-foreground whitespace-nowrap text-[11px]">
                        {inv.dueDate || "—"}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-foreground font-semibold">
                        {formatCurrency(inv.serviceFee ?? inv.serviceRevenue)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-indigo-600 dark:text-indigo-400 font-semibold">
                        {formatCurrency(inv.sponsoringBudget)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-bold text-foreground">
                        {formatCurrency(inv.totalAmount)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : inv.status === "overdue"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {inv.status === "paid" ? (
                            <CheckCircle2 className="size-2.5" />
                          ) : inv.status === "overdue" ? (
                            <AlertTriangle className="size-2.5" />
                          ) : (
                            <Clock className="size-2.5" />
                          )}
                          {inv.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        {inv.status !== "paid" ? (
                          <button
                            onClick={() => setPayingInvoice(inv)}
                            className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors border border-emerald-500/30"
                          >
                            Record Payment
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                            <CheckCircle2 className="size-3 text-emerald-500" /> Settled
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

      {/* CREATE INVOICE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md w-[94vw] p-6 rounded-3xl bg-card border border-border/80 shadow-2xl">
          <DialogHeader className="text-left pb-3 border-b border-border/50">
            <DialogTitle className="text-lg font-bold font-display text-foreground">
              Create Client Invoice
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Direct billing with separated service fee and sponsoring budget
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-4 mt-2">
            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Client
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
                  Service Fee (TND)
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                  placeholder="1500.000"
                  prefix="TND"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Sponsoring (TND)
                </label>
                <SADAInput
                  type="number"
                  step="0.001"
                  value={sponsoringBudget}
                  onChange={(e) => setSponsoringBudget(e.target.value)}
                  placeholder="800.000"
                  prefix="TND"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Live Total preview */}
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">Total Invoice Charge:</span>
              <strong className="text-foreground text-sm font-bold">
                {formatCurrency(liveTotal)}
              </strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Issue Date
                </label>
                <SADADatePicker
                  value={issueDate}
                  onChange={(d) => d && setIssueDate(d)}
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Due Date
                </label>
                <SADADatePicker
                  value={dueDate}
                  onChange={(d) => setDueDate(d || "")}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                Notes / Terms
              </label>
              <SADAInput
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Monthly retainer & ad budget..."
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
                {isSubmitting ? "Creating..." : "Generate Invoice"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECORD PAYMENT MODAL */}
      <Dialog open={!!payingInvoice} onOpenChange={(open) => !open && setPayingInvoice(null)}>
        <DialogContent className="max-w-md w-[94vw] p-6 rounded-3xl bg-card border border-border/80 shadow-2xl">
          <DialogHeader className="text-left pb-3 border-b border-border/50">
            <DialogTitle className="text-lg font-bold font-display text-foreground">
              Record Client Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Invoice #{payingInvoice?.invoiceNumber} • {payingInvoice?.clientName}
            </DialogDescription>
          </DialogHeader>

          {payingInvoice && (
            <div className="space-y-4 mt-2">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Revenue Inflow:</span>
                  <span className="font-semibold text-foreground">
                    +{formatCurrency(payingInvoice.serviceFee ?? payingInvoice.serviceRevenue)}
                  </span>
                </div>
                {payingInvoice.sponsoringBudget > 0 && (
                  <div className="flex justify-between">
                    <span className="text-indigo-600 dark:text-indigo-400">
                      Sponsoring Budget Inflow:
                    </span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      +{formatCurrency(payingInvoice.sponsoringBudget)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/50 flex justify-between font-bold text-sm">
                  <span>Total Settled:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(payingInvoice.totalAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Payment Date
                </label>
                <SADADatePicker
                  value={paymentDate}
                  onChange={(d) => d && setPaymentDate(d)}
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                  Payment Method
                </label>
                <SADASelect
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={[
                    { value: "Bank Transfer", label: "Bank Transfer (BIAT)" },
                    { value: "Cash", label: "Petty Cash Box" },
                    { value: "Credit Card", label: "Corporate Card" },
                    { value: "Check", label: "Bank Check" },
                  ]}
                />
              </div>

              {accounts.length > 0 && (
                <div>
                  <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
                    Deposit Treasury Account
                  </label>
                  <SADASelect
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.accountName || a.name} (${formatCurrency(a.currentBalance)})`,
                    }))}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordPayment}
                  disabled={isPaying}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                >
                  {isPaying ? "Recording..." : "Confirm & Deposit Inflows"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
