import { useState, useEffect } from "react";
import {
  ExpenseTransaction,
  ExpenseCategory,
  ExpenseStatus,
  FinancialAllocation,
  PAYMENT_METHOD_OPTIONS,
} from "@/types/finance";
import { createExpense, updateExpense } from "@/lib/finance-service";
import { SADAInput, SADATextarea, SADAButton, SADASwitch } from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADADialog } from "@/components/ui/sada-dialog";
import {
  TrendingDown,
  DollarSign,
  Building,
  Repeat,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  editingExpense?: ExpenseTransaction | null;
  categories: ExpenseCategory[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; client_name: string }>;
  teamMembers: Array<{ id: string; name: string }>;
  currentUserId?: string;
  currentUserName?: string;
  defaultClientId?: string;
  defaultProjectId?: string;
}

export function RecordExpenseModal({
  isOpen,
  onClose,
  onRefresh,
  editingExpense,
  categories,
  clients,
  projects,
  teamMembers,
  currentUserId,
  currentUserName,
  defaultClientId,
  defaultProjectId,
}: RecordExpenseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [categoryName, setCategoryName] = useState(categories[0]?.name || "Software & SaaS");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");

  const [subcategory, setSubcategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [clientId, setClientId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [teamMemberId, setTeamMemberId] = useState<string>("none");

  const [status, setStatus] = useState<ExpenseStatus>("paid");
  const [reference, setReference] = useState("");

  const [isRecurring, setIsRecurring] = useState(false);

  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Sync state on open/edit
  useEffect(() => {
    if (!isOpen) return;

    if (editingExpense) {
      setAmount(String(editingExpense.amount));
      try {
        setDate(editingExpense.date ? parseISO(editingExpense.date) : new Date());
      } catch {
        setDate(new Date());
      }
      setCategoryName(editingExpense.category_name || categories[0]?.name || "Software & SaaS");
      setVendor(editingExpense.vendor || "");
      setDescription(editingExpense.description || "");

      setSubcategory(editingExpense.subcategory || "");
      setPaymentMethod(editingExpense.payment_method || "Bank Transfer");
      setClientId(editingExpense.client_id || "none");
      setProjectId(editingExpense.project_id || "none");
      setTeamMemberId(editingExpense.team_member_id || "none");

      setStatus(editingExpense.status);
      setReference(editingExpense.reference || "");

      setIsRecurring(Boolean(editingExpense.is_recurring));

      setReceiptUrl(editingExpense.receipt_url || "");
      setNotes(editingExpense.notes || "");
    } else {
      setAmount("");
      setDate(new Date());
      setCategoryName(categories[0]?.name || "Software & SaaS");
      setVendor("");
      setDescription("");

      setSubcategory("");
      setPaymentMethod("Bank Transfer");
      setClientId(defaultClientId || "none");
      setProjectId(defaultProjectId || "none");
      setTeamMemberId("none");

      setStatus("paid");
      setReference("");

      setIsRecurring(false);

      setReceiptUrl("");
      setNotes("");
    }
  }, [isOpen, editingExpense, categories, defaultClientId, defaultProjectId]);

  // Options
  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }));

  const clientOptions = [
    { value: "none", label: "No Specific Client (General SADA OpEx)" },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  const projectOptions = [
    { value: "none", label: "No Project Link" },
    ...projects
      .filter((p) => clientId === "none" || !p.client_name || clients.find(c => c.id === clientId)?.name === p.client_name)
      .map((p) => ({ value: p.id, label: `${p.title} (${p.client_name})` })),
  ];

  const teamMemberOptions = [
    { value: "none", label: "Not Associated with Team Member" },
    ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }
    if (!description.trim()) {
      toast.error("Please provide a description for this outflow.");
      return;
    }

    setIsSubmitting(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const matchedCategory = categories.find((c) => c.name === categoryName);

    if (editingExpense) {
      const res = await updateExpense(
        editingExpense.id,
        {
          amount: numAmount,
          date: dateStr,
          category_name: categoryName,
          category_id: matchedCategory?.id || null,
          allocation: (clientId !== "none" ? "client_service" : "operating_expense") as FinancialAllocation,
          subcategory: subcategory.trim() || null,
          vendor: vendor.trim() || null,
          description: description.trim(),
          payment_method: paymentMethod,
          status,
          is_recurring: isRecurring,
          client_id: clientId === "none" ? null : clientId,
          project_id: projectId === "none" ? null : projectId,
          team_member_id: teamMemberId === "none" ? null : teamMemberId,
          reference: reference.trim() || null,
          receipt_url: receiptUrl.trim() || null,
          notes: notes.trim() || null,
        },
        { id: currentUserId, name: currentUserName }
      );

      setIsSubmitting(false);

      if (res.error) {
        toast.error(`Failed to update outflow: ${res.error.message}`);
      } else {
        toast.success(`Outflow updated: ${numAmount.toLocaleString()} TND`);
        onClose();
        onRefresh();
      }
    } else {
      const res = await createExpense({
        amount: numAmount,
        date: dateStr,
        categoryName,
        categoryId: matchedCategory?.id || null,
        allocation: clientId !== "none" ? "client_service" : "operating_expense",
        subcategory: subcategory.trim() || undefined,
        vendor: vendor.trim() || undefined,
        description: description.trim(),
        paymentMethod,
        status,
        isRecurring,
        clientId: clientId === "none" ? null : clientId,
        projectId: projectId === "none" ? null : projectId,
        teamMemberId: teamMemberId === "none" ? null : teamMemberId,
        reference: reference.trim() || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        actorId: currentUserId,
        actorName: currentUserName,
      });

      setIsSubmitting(false);

      if (res.error) {
        toast.error(`Failed to record outflow: ${res.error.message}`);
      } else {
        toast.success(`Outflow of ${numAmount.toLocaleString()} TND recorded successfully`);
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
        <div className="size-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 grid place-items-center">
          <TrendingDown className="size-4" />
        </div>
      }
      title={editingExpense ? "Edit Outflow Transaction" : "Record Operational Outflow"}
      description="Authoritative operating expenditure, contractor disbursement, or direct project cost."
      footer={
        <>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
            <span className="size-2 rounded-full bg-rose-500 inline-block animate-pulse" />
            <span>Ledger: <strong className="text-foreground">Outflow Disbursement</strong></span>
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
              form="record-expense-form"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-9 px-4"
            >
              {editingExpense ? "Save Changes" : "Record Outflow"}
            </SADAButton>
          </div>
        </>
      }
    >
      <form id="record-expense-form" onSubmit={handleSave} className="space-y-5">
        {/* SECTION A: TRANSACTION CORE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <DollarSign className="size-3.5 text-rose-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                A. Transaction Core
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Primary outflow details</span>
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
                placeholder="e.g. 450"
                prefix="TND"
                className="font-mono text-sm font-semibold h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Payment Date <span className="text-rose-500">*</span>
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
                Expense Category <span className="text-rose-500">*</span>
              </label>
              <SADASelect
                value={categoryName}
                onChange={setCategoryName}
                options={categoryOptions}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Vendor / Payee
              </label>
              <SADAInput
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Adobe, AWS, Freelancer"
                className="h-10"
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
              placeholder="e.g. Monthly cloud hosting & video rendering server"
              className="h-10"
            />
          </div>
        </div>

        {/* SECTION B: CLASSIFICATION & ATTRIBUTION */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Building className="size-3.5 text-cyan-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                B. Classification & Attribution
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Client or operational allocation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Subcategory / Tag
              </label>
              <SADAInput
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Infrastructure, Legal"
                className="text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Client Attribution
              </label>
              <SADASelect
                value={clientId}
                onChange={setClientId}
                options={clientOptions}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Team Member (Optional)
              </label>
              <SADASelect
                value={teamMemberId}
                onChange={setTeamMemberId}
                options={teamMemberOptions}
              />
            </div>

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
                Payment Status
              </label>
              <SADASelect
                value={status}
                onChange={(v) => setStatus(v as ExpenseStatus)}
                options={[
                  { value: "paid", label: "Paid (Disbursed from Treasury)" },
                  { value: "pending", label: "Pending (Scheduled / Unsettled)" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* SECTION C: RECURRENCE & REFERENCE */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Repeat className="size-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                C. Recurrence & Reference
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Subscription flag & receipts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground block">
                  Recurring Subscription
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Monthly / annual automated charge
                </span>
              </div>
              <SADASwitch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90 block">
                Reference # (Invoice / Receipt ID)
              </label>
              <SADAInput
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. INV-AWS-2026"
                className="font-mono text-xs h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90 block">
              Receipt / Invoice URL
            </label>
            <SADAInput
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://... or attachment link"
              className="font-mono text-xs h-10"
            />
          </div>
        </div>

        {/* SECTION D: DOCUMENTATION & NOTES */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-purple-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                D. Internal Documentation
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Internal accounting records</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90 block">
              Accounting Notes (Internal)
            </label>
            <SADATextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details regarding tax breakdown, VAT deductible or project billing"
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>
      </form>
    </SADADialog>
  );
}
