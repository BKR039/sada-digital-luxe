import { useState } from "react";
import {
  Subscription,
  ExpenseCategory,
  formatCurrency,
  SUBSCRIPTION_CYCLE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/types/finance";
import {
  upsertSubscription,
  deleteSubscription,
  recordSubscriptionPayment,
} from "@/lib/finance-service";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADANumberStepper } from "@/components/ui/sada-counter";
import {
  SADAInput,
  SADATextarea,
  SADAButton,
  SADAConfirmDialog,
  SADAEmptyState,
} from "@/components/ui/sada-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit2,
  Trash2,
  Repeat,
  ArrowUpRight,
  Layers,
  Calendar,
  CreditCard,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface SubscriptionsViewProps {
  subscriptions: Subscription[];
  categories: ExpenseCategory[];
  onRefresh: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function SubscriptionsView({
  subscriptions,
  categories,
  onRefresh,
  currentUserId,
  currentUserName,
}: SubscriptionsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm Dialog States
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);
  const [subToCharge, setSubToCharge] = useState<Subscription | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [categoryName, setCategoryName] = useState("Software & SaaS");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [billingDay, setBillingDay] = useState(1);
  const [nextBillingDate, setNextBillingDate] = useState<Date | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  const [status, setStatus] = useState<"active" | "paused" | "cancelled">("active");
  const [notes, setNotes] = useState("");

  const handleOpenCreate = () => {
    setEditingSub(null);
    setName("");
    setVendor("");
    setCategoryName("Software & SaaS");
    setAmount("");
    setBillingCycle("monthly");
    setBillingDay(1);
    setNextBillingDate(undefined);
    setPaymentMethod("Credit Card");
    setStatus("active");
    setNotes("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setName(sub.name);
    setVendor(sub.vendor || "");
    setCategoryName(sub.category_name);
    setAmount(String(sub.amount));
    setBillingCycle(sub.billing_cycle);
    setBillingDay(sub.billing_day || 1);
    setNextBillingDate(sub.next_billing_date ? parseISO(sub.next_billing_date) : undefined);
    setPaymentMethod(sub.payment_method || "Credit Card");
    setStatus(sub.status);
    setNotes(sub.notes || "");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast.error("Please provide a valid subscription amount.");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter a service name.");
      return;
    }

    setIsSubmitting(true);
    const matchedCategory = categories.find((c) => c.name === categoryName);

    try {
      const res = await upsertSubscription({
        id: editingSub?.id,
        name: name.trim(),
        vendor: vendor.trim() || undefined,
        categoryId: matchedCategory?.id || null,
        categoryName,
        amount: num,
        billingCycle,
        billingDay: Number(billingDay) || 1,
        nextBillingDate: nextBillingDate ? format(nextBillingDate, "yyyy-MM-dd") : null,
        paymentMethod,
        status,
        notes: notes.trim() || undefined,
        actorId: currentUserId,
        actorName: currentUserName,
      });

      if (res.error) {
        toast.error(`Failed to save subscription: ${res.error.message}`);
      } else {
        toast.success(editingSub ? "Subscription updated successfully" : "Subscription added to recurring burn");
        setIsModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subToDelete) return;
    setIsActionLoading(true);
    try {
      const res = await deleteSubscription(subToDelete.id, { id: currentUserId, name: currentUserName });
      if (res.error) {
        toast.error(`Failed to delete subscription: ${res.error.message}`);
      } else {
        toast.success("Subscription removed successfully");
        setSubToDelete(null);
        onRefresh();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete subscription");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmCharge = async () => {
    if (!subToCharge) return;
    setIsActionLoading(true);
    try {
      const res = await recordSubscriptionPayment({
        subscription: subToCharge,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      if (res.error) {
        toast.error(`Failed to record payment: ${res.error.message}`);
      } else {
        toast.success(`Recorded ${formatCurrency(subToCharge.amount)} expense transaction for ${subToCharge.name}!`);
        setSubToCharge(null);
        onRefresh();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to record subscription payment");
    } finally {
      setIsActionLoading(false);
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }));

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const totalMonthlyBurn = subscriptions
    .filter((s) => s.status === "active")
    .reduce((acc, s) => {
      const a = Number(s.amount || 0);
      if (s.billing_cycle === "yearly") return acc + a / 12;
      if (s.billing_cycle === "quarterly") return acc + a / 3;
      return acc + a;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold font-display text-foreground">
              Recurring Subscriptions & SaaS Burn
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
              {activeCount} Active Tools
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Planned monthly recurring burn rate of {formatCurrency(totalMonthlyBurn)} across all infrastructure.
          </p>
        </div>

        <SADAButton
          onClick={handleOpenCreate}
          size="sm"
          variant="primary"
          leftIcon={<Plus className="size-3.5" />}
          className="bg-blue-600 hover:bg-blue-500 text-white shrink-0"
        >
          Add Subscription
        </SADAButton>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subscriptions.length === 0 ? (
          <div className="col-span-full">
            <SADAEmptyState
              icon={Repeat}
              title="No Subscriptions Tracked"
              description="Add your SaaS tools (Lovable, Adobe, Claude, Hosting) to monitor recurring burn and trigger periodic expense charges."
              action={{
                label: "Add Subscription",
                onClick: handleOpenCreate,
              }}
            />
          </div>
        ) : (
          subscriptions.map((sub) => {
            const monthlyEquivalent =
              sub.billing_cycle === "yearly"
                ? sub.amount / 12
                : sub.billing_cycle === "quarterly"
                ? sub.amount / 3
                : sub.amount;

            return (
              <div
                key={sub.id}
                className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between hover:border-blue-500/40 transition-all"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold font-display text-foreground truncate">
                        {sub.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {sub.vendor || sub.category_name}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${
                        sub.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : sub.status === "paused"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>

                  {/* Financials Box */}
                  <div className="mt-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/60">
                    <div className="flex items-baseline justify-between">
                      <div className="text-xl font-bold font-display text-foreground tabular-nums sada-num-kpi">
                        {formatCurrency(sub.amount)}
                      </div>
                      <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-muted border border-border/60 text-muted-foreground">
                        {sub.billing_cycle}
                      </span>
                    </div>

                    {sub.billing_cycle !== "monthly" && (
                      <div className="text-[11px] font-mono text-muted-foreground mt-1">
                        ≈ {formatCurrency(monthlyEquivalent)} / month
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Next Due:</span>
                        <span className="font-medium text-foreground truncate block">
                          {sub.next_billing_date || `Day ${sub.billing_day || 1}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Method:</span>
                        <span className="font-medium text-foreground truncate block">
                          {sub.payment_method || "Card"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {sub.notes && (
                    <p className="mt-2 text-[11px] text-muted-foreground italic truncate">
                      "{sub.notes}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                  <SADAButton
                    size="sm"
                    variant="primary"
                    onClick={() => setSubToCharge(sub)}
                    leftIcon={<ArrowUpRight className="size-3" />}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold h-8"
                    title="Record this period charge as an expense transaction"
                  >
                    Record Charge
                  </SADAButton>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(sub)}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubToDelete(sub)}
                    className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SADA RECURRING SUBSCRIPTION MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border-border/80 shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center border border-blue-500/20">
                <Repeat className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-display text-foreground">
                  {editingSub ? "Edit SaaS Subscription" : "Add Recurring SaaS Subscription"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Track recurring tools and automate operational expense logging.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 px-6 py-5 max-h-[75vh] overflow-y-auto">
            {/* SECTION A: SERVICE & VENDOR DETAILS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-[11px] font-mono uppercase tracking-wider font-bold text-foreground">
                <Layers className="size-3.5 text-blue-500" />
                <span>A. Service & Provider Details</span>
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Service / Tool Name <span className="text-destructive">*</span>
                </label>
                <SADAInput
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Adobe Creative Cloud, Claude API, Lovable, Supabase"
                  className="text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                    Vendor / Provider
                  </label>
                  <SADAInput
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Adobe Systems Inc."
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                    Expense Category
                  </label>
                  <SADASelect
                    value={categoryName}
                    onChange={setCategoryName}
                    options={categoryOptions}
                  />
                </div>
              </div>
            </div>

            {/* SECTION B: BILLING SCHEDULE & FINANCIALS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-[11px] font-mono uppercase tracking-wider font-bold text-foreground">
                <Calendar className="size-3.5 text-emerald-500" />
                <span>B. Billing Schedule & Commitment</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                    Amount (TND) <span className="text-destructive">*</span>
                  </label>
                  <SADAInput
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 180"
                    prefix="TND"
                    className="font-mono text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                    Billing Cycle <span className="text-destructive">*</span>
                  </label>
                  <SADASelect
                    value={billingCycle}
                    onChange={(v) => setBillingCycle(v as any)}
                    options={SUBSCRIPTION_CYCLE_OPTIONS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                    Next Due Date
                  </label>
                  <SADADatePicker
                    value={nextBillingDate ? format(nextBillingDate, "yyyy-MM-dd") : ""}
                    onChange={(dStr) => setNextBillingDate(dStr ? parseISO(dStr) : undefined)}
                    placeholder="Pick upcoming renewal date"
                  />
                </div>

                <div>
                  <SADANumberStepper
                    label="Billing Day of Month"
                    min={1}
                    max={31}
                    value={billingDay}
                    onChange={setBillingDay}
                    unit="day"
                    size="default"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    Subscription Status
                  </label>
                  <SADASelect
                    value={status}
                    onChange={(v) => setStatus(v as any)}
                    options={[
                      { value: "active", label: "Active (Recurring)" },
                      { value: "paused", label: "Paused" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* SECTION C: OPERATIONAL NOTES */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-[11px] font-mono uppercase tracking-wider font-bold text-foreground">
                <FileText className="size-3.5 text-amber-500" />
                <span>C. Documentation & License Info</span>
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                  Internal Notes & Account Reference
                </label>
                <SADATextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Seat count, renewal terms, associated division or manager..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/60 sticky bottom-0 bg-card py-2">
              <SADAButton
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </SADAButton>
              <SADAButton
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                {editingSub ? "Save Changes" : "Save Subscription"}
              </SADAButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SADA CONFIRM DELETE DIALOG */}
      <SADAConfirmDialog
        open={!!subToDelete}
        onOpenChange={(open) => !open && setSubToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Subscription"
        description={`Are you sure you want to remove "${subToDelete?.name}" (${formatCurrency(subToDelete?.amount || 0)}/${subToDelete?.billing_cycle})? This will remove it from recurring burn monitoring.`}
        confirmLabel={isActionLoading ? "Deleting..." : "Delete Subscription"}
        variant="danger"
        loading={isActionLoading}
      />

      {/* SADA CONFIRM CHARGE DIALOG */}
      <SADAConfirmDialog
        open={!!subToCharge}
        onOpenChange={(open) => !open && setSubToCharge(null)}
        onConfirm={handleConfirmCharge}
        title="Record Expense Charge"
        description={`Record an actual outflow expense of ${formatCurrency(subToCharge?.amount || 0)} for "${subToCharge?.name}" today? This will immediately create an expense record in the canonical ledger.`}
        confirmLabel={isActionLoading ? "Recording..." : "Record Expense"}
        variant="warning"
        loading={isActionLoading}
      />
    </div>
  );
}
