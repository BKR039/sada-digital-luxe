import { useState, useEffect } from "react";
import {
  IncomeTransaction,
  IncomeCategory,
  IncomeStatus,
  FinancialAccount,
  FinancialAllocation,
  INCOME_CATEGORY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/types/finance";
import { createIncome, updateIncome } from "@/lib/finance-service";
import { SADAInput, SADATextarea, SADAButton } from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADADialog } from "@/components/ui/sada-dialog";
import {
  ArrowDownLeft,
  DollarSign,
  Building,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface RecordIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  editingIncome?: IncomeTransaction | null;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; client_name: string }>;
  accounts: FinancialAccount[];
  currentUserId?: string;
  currentUserName?: string;
  defaultClientId?: string;
  defaultProjectId?: string;
}

export function RecordIncomeModal({
  isOpen,
  onClose,
  onRefresh,
  editingIncome,
  clients,
  projects,
  accounts,
  currentUserId,
  currentUserName,
  defaultClientId,
  defaultProjectId,
}: RecordIncomeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState<IncomeCategory>("Client Payment");
  const [allocation, setAllocation] = useState<FinancialAllocation>("client_service");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [status, setStatus] = useState<IncomeStatus>("received");
  const [clientId, setClientId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [accountId, setAccountId] = useState<string>("none");
  const [reference, setReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Sync state on open/edit
  useEffect(() => {
    if (!isOpen) return;

    if (editingIncome) {
      setAmount(String(editingIncome.amount));
      try {
        setDate(editingIncome.date ? parseISO(editingIncome.date) : new Date());
      } catch {
        setDate(new Date());
      }
      setCategory(editingIncome.category);
      setAllocation((editingIncome.allocation as FinancialAllocation) || "client_service");
      setDescription(editingIncome.description || "");
      setPaymentMethod(editingIncome.payment_method || "Bank Transfer");
      setStatus(editingIncome.status);
      setClientId(editingIncome.client_id || "none");
      setProjectId(editingIncome.project_id || "none");
      setAccountId(editingIncome.account_id || "none");
      setReference(editingIncome.reference || "");
      setReceiptUrl(editingIncome.receipt_url || "");
      setNotes(editingIncome.notes || "");
    } else {
      setAmount("");
      setDate(new Date());
      setCategory("Client Payment");
      setAllocation("client_service");
      setDescription("");
      setPaymentMethod("Bank Transfer");
      setStatus("received");
      setClientId(defaultClientId || "none");
      setProjectId(defaultProjectId || "none");
      setAccountId(accounts[0]?.id || "none");
      setReference("");
      setReceiptUrl("");
      setNotes("");
    }
  }, [isOpen, editingIncome, accounts, defaultClientId, defaultProjectId]);

  // Client options
  const clientOptions = [
    { value: "none", label: "No Specific Client (General / Internal)" },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  // Project options filtered by client
  const projectOptions = [
    { value: "none", label: "No Project Link" },
    ...projects
      .filter((p) => clientId === "none" || !p.client_name || clients.find(c => c.id === clientId)?.name === p.client_name)
      .map((p) => ({ value: p.id, label: p.title })),
  ];

  // Financial Accounts options
  const accountOptions = [
    { value: "none", label: "Default Operating Account" },
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.name || a.accountName || "Account"} (${a.currency})`,
    })),
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }
    if (!description.trim()) {
      toast.error("Please provide a description for this inflow.");
      return;
    }

    setIsSubmitting(true);
    const dateStr = format(date, "yyyy-MM-dd");

    if (editingIncome) {
      const res = await updateIncome(
        editingIncome.id,
        {
          amount: numAmount,
          date: dateStr,
          category,
          allocation,
          description: description.trim(),
          payment_method: paymentMethod,
          status,
          client_id: clientId === "none" ? null : clientId,
          project_id: projectId === "none" ? null : projectId,
          account_id: accountId === "none" ? null : accountId,
          reference: reference.trim() || null,
          receipt_url: receiptUrl.trim() || null,
          notes: notes.trim() || null,
        },
        { id: currentUserId, name: currentUserName }
      );

      setIsSubmitting(false);

      if (res.error) {
        toast.error(`Failed to update inflow: ${res.error.message}`);
      } else {
        toast.success(`Inflow updated: ${numAmount.toLocaleString()} TND`);
        onClose();
        onRefresh();
      }
    } else {
      const res = await createIncome({
        amount: numAmount,
        date: dateStr,
        category,
        allocation,
        description: description.trim(),
        paymentMethod,
        status,
        clientId: clientId === "none" ? null : clientId,
        projectId: projectId === "none" ? null : projectId,
        accountId: accountId === "none" ? null : accountId,
        reference: reference.trim() || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        actorId: currentUserId,
        actorName: currentUserName,
      });

      setIsSubmitting(false);

      if (res.error) {
        toast.error(`Failed to record inflow: ${res.error.message}`);
      } else {
        toast.success(`Inflow of ${numAmount.toLocaleString()} TND recorded successfully`);
        onClose();
        onRefresh();
      }
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="large"
      icon={
        <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 grid place-items-center">
          <ArrowDownLeft className="size-4" />
        </div>
      }
      title={editingIncome ? "Edit Inflow Transaction" : "Record Company Inflow"}
      description="Authoritative accounting deposit entry into SADA financial treasury."
      footer={
        <>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
            <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Ledger: <strong className="text-foreground">Inflow Clearing</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <SADAButton
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9 px-4"
            >
              Cancel
            </SADAButton>
            <SADAButton
              type="submit"
              form="record-income-form"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-4"
            >
              {editingIncome ? "Save Changes" : "Record Inflow"}
            </SADAButton>
          </div>
        </>
      }
    >
      <form id="record-income-form" onSubmit={handleSave} className="space-y-5">
        {/* SECTION A: TRANSACTION CORE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <DollarSign className="size-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                A. Transaction Core
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Primary deposit details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Amount (TND) <span className="text-rose-500">*</span>
              </label>
              <SADAInput
                type="number"
                step="0.001"
                min="0.001"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1500"
                prefix="TND"
                className="font-mono text-sm font-semibold h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Deposit Date <span className="text-rose-500">*</span>
              </label>
              <SADADatePicker
                value={format(date, "yyyy-MM-dd")}
                onChange={(dStr) => dStr && setDate(parseISO(dStr))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Inflow Category <span className="text-rose-500">*</span>
              </label>
              <SADASelect
                value={category}
                onChange={(val) => setCategory(val as IncomeCategory)}
                options={INCOME_CATEGORY_OPTIONS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Client / Payer
              </label>
              <SADASelect
                value={clientId}
                onChange={setClientId}
                options={clientOptions}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90 block">
              Description / Memo <span className="text-rose-500">*</span>
            </label>
            <SADAInput
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly Retainer invoice #INV-2026-08 payment"
              className="h-10"
            />
          </div>
        </div>

        {/* SECTION B: CLASSIFICATION & TREASURY ACCOUNT */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Building className="size-3.5 text-cyan-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                B. Classification & Treasury Account
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Allocation & destination</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Financial Allocation
              </label>
              <SADASelect
                value={allocation}
                onChange={(v) => setAllocation(v as FinancialAllocation)}
                options={[
                  { value: "client_service", label: "Client Retainer / Production" },
                  { value: "sponsoring", label: "Sponsoring / Ad Budget" },
                  { value: "other", label: "Other Corporate Inflow" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Destination Account
              </label>
              <SADASelect
                value={accountId}
                onChange={setAccountId}
                options={accountOptions}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Associated Project
              </label>
              <SADASelect
                value={projectId}
                onChange={setProjectId}
                options={projectOptions}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Payment Method
              </label>
              <SADASelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Settlement Status
              </label>
              <SADASelect
                value={status}
                onChange={(v) => setStatus(v as IncomeStatus)}
                options={[
                  { value: "received", label: "Received (Cleared in Treasury)" },
                  { value: "pending", label: "Pending (Promised / Awaiting)" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* SECTION C: REFERENCE & DOCUMENTATION */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-purple-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                C. Reference & Documentation
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Audit proof & internal notes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Reference # (Check / Wire / Receipt)
              </label>
              <SADAInput
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. TR-2026-904"
                className="font-mono text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Receipt / Document URL
              </label>
              <SADAInput
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://... or attachment link"
                className="font-mono text-xs h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90 block">
              Accounting Notes (Internal)
            </label>
            <SADATextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes regarding banking transfer fees, exchange rates, or client agreements"
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>
      </form>
    </SADADialog>
  );
}
