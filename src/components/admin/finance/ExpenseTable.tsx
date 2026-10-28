import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ExpenseTransaction,
  ExpenseCategory,
  formatCurrency,
} from "@/types/finance";
import { deleteExpense } from "@/lib/finance-service";
import { SADASelect } from "@/components/ui/sada-select";
import { SADAButton, SADAConfirmDialog, SADAEmptyState } from "@/components/ui/sada-ui";
import { SADASearch } from "@/components/ui/sada-search";
import { RecordExpenseModal } from "@/components/admin/finance/RecordExpenseModal";
import {
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Repeat,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Briefcase,
  User,
  TrendingDown,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface ExpenseTableProps {
  expenses: ExpenseTransaction[];
  categories: ExpenseCategory[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; client_name: string }>;
  teamMembers: Array<{ id: string; name: string }>;
  onRefresh: () => void;
  openCreateModal?: boolean;
  onCloseCreateModal?: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function ExpenseTable({
  expenses,
  categories,
  clients,
  projects,
  teamMembers,
  onRefresh,
  openCreateModal,
  onCloseCreateModal,
  currentUserId,
  currentUserName,
}: ExpenseTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recurringFilter, setRecurringFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseTransaction | null>(null);

  // Deletion Dialog State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenCreate = useCallback(() => {
    setEditingExpense(null);
    setIsModalOpen(true);
  }, []);

  // Sync external openCreateModal
  useEffect(() => {
    if (openCreateModal) {
      handleOpenCreate();
    }
  }, [openCreateModal, handleOpenCreate]);

  const handleOpenEdit = (exp: ExpenseTransaction) => {
    setEditingExpense(exp);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    if (onCloseCreateModal) onCloseCreateModal();
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    const res = await deleteExpense(deletingId, { id: currentUserId, name: currentUserName });
    setIsDeleting(false);
    setDeletingId(null);

    if (res.error) {
      toast.error(`Failed to delete expense: ${res.error.message}`);
    } else {
      toast.success("Expense transaction deleted from ledger");
      onRefresh();
    }
  };

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (categoryFilter !== "all" && exp.category_name !== categoryFilter) return false;
      if (statusFilter !== "all" && exp.status !== statusFilter) return false;
      if (recurringFilter === "recurring" && !exp.is_recurring) return false;
      if (recurringFilter === "one_off" && exp.is_recurring) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const desc = (exp.description || "").toLowerCase();
        const v = (exp.vendor || "").toLowerCase();
        const sub = (exp.subcategory || "").toLowerCase();
        const ref = (exp.reference || "").toLowerCase();
        if (!desc.includes(q) && !v.includes(q) && !sub.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, categoryFilter, statusFilter, recurringFilter]);

  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }));
  const categoryFilterOptions = [{ value: "all", label: "All Categories" }, ...categoryOptions];

  const statusFilterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "paid", label: "Paid" },
    { value: "pending", label: "Pending" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const recurringFilterOptions = [
    { value: "all", label: "All Types" },
    { value: "recurring", label: "Recurring Only" },
    { value: "one_off", label: "One-Off Only" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 w-full">
          <SADASearch
            value={search}
            onChange={setSearch}
            placeholder="Search outlays by description, vendor, ref..."
            size="compact"
            className="w-full sm:flex-1 sm:max-w-sm"
          />

          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-2 w-full sm:flex sm:w-auto sm:items-center">
            <div className="col-span-2 min-[480px]:col-span-1 w-full sm:w-44">
              <SADASelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categoryFilterOptions}
                size="compact"
                className="w-full"
              />
            </div>

            <div className="w-full sm:w-32">
              <SADASelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                size="compact"
                className="w-full"
              />
            </div>

            <div className="w-full sm:w-36">
              <SADASelect
                value={recurringFilter}
                onChange={setRecurringFilter}
                options={recurringFilterOptions}
                size="compact"
                className="w-full"
              />
            </div>
          </div>
        </div>

        <SADAButton
          size="sm"
          onClick={handleOpenCreate}
          className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs gap-1.5 shrink-0 w-full sm:w-auto justify-center"
        >
          <Plus className="size-3.5" />
          <span>Record Outflow</span>
        </SADAButton>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {/* Mobile Card List View (< md) */}
        <div className="block md:hidden divide-y divide-border/40">
          {filteredExpenses.length === 0 ? (
            <div className="py-12 px-4">
              <SADAEmptyState
                icon={TrendingDown}
                title="No outflow records found"
                description="No operating expenses match your current filters. Record a new outflow to update the ledger."
                action={{
                  label: "+ Record Outflow",
                  onClick: handleOpenCreate,
                }}
              />
            </div>
          ) : (
            filteredExpenses.map((exp) => (
              <div key={exp.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{exp.description}</span>
                      {exp.is_recurring && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px]"
                          title="Recurring commitment"
                        >
                          <Repeat className="size-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 mt-1 flex-wrap">
                      <span>{exp.date ? format(parseISO(exp.date), "dd MMM yyyy") : "—"}</span>
                      {exp.vendor && <span>Vendor: {exp.vendor}</span>}
                      {exp.reference && <span>Ref: {exp.reference}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-sm text-rose-600 dark:text-rose-400">
                      -{formatCurrency(exp.amount)}
                    </div>
                    <div className="mt-1">
                      {exp.status === "paid" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Paid
                        </span>
                      )}
                      {exp.status === "pending" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="size-3" /> Pending
                        </span>
                      )}
                      {exp.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="size-3" /> Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-md border border-border/60">
                      {exp.category_name || "General"}
                    </span>
                    {exp.client && (
                      <span className="flex items-center gap-1 text-primary">
                        <Building2 className="size-3" />
                        {exp.client.name}
                      </span>
                    )}
                    {exp.project && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Briefcase className="size-3" />
                        {exp.project.title}
                      </span>
                    )}
                    {exp.team_member && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <User className="size-3" />
                        {exp.team_member.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {exp.receipt_url && (
                      <a
                        href={exp.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View Receipt"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(exp)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(exp.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table Container (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-mono uppercase text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Description & Vendor</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Attribution</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <SADAEmptyState
                      icon={TrendingDown}
                      title="No outflow records found"
                      description="No operating expenses match your current filters. Record a new outflow to update the ledger."
                      action={{
                        label: "+ Record Outflow",
                        onClick: handleOpenCreate,
                      }}
                    />
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-muted-foreground">
                      {exp.date ? format(parseISO(exp.date), "dd MMM yyyy") : "—"}
                    </td>

                    {/* Description & Vendor */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>{exp.description}</span>
                        {exp.is_recurring && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px]"
                            title="Recurring commitment"
                          >
                            <Repeat className="size-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                        {exp.vendor && <span>Vendor: {exp.vendor}</span>}
                        {exp.reference && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Ref: {exp.reference}</span>
                          </>
                        )}
                        {exp.payment_method && (
                          <>
                            <span>•</span>
                            <span>{exp.payment_method}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-muted text-foreground font-medium text-[11px] border border-border/60">
                        {exp.category_name}
                      </span>
                      {exp.subcategory && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {exp.subcategory}
                        </div>
                      )}
                    </td>

                    {/* Attribution */}
                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-[11px]">
                      {exp.client ? (
                        <div className="flex items-center gap-1 text-foreground font-medium">
                          <Building2 className="size-3 text-primary" />
                          <span>{exp.client.name}</span>
                        </div>
                      ) : null}
                      {exp.project ? (
                        <div className="flex items-center gap-1 text-[10px]">
                          <Briefcase className="size-3 text-muted-foreground" />
                          <span>{exp.project.title}</span>
                        </div>
                      ) : null}
                      {exp.team_member ? (
                        <div className="flex items-center gap-1 text-[10px]">
                          <User className="size-3 text-muted-foreground" />
                          <span>{exp.team_member.name}</span>
                        </div>
                      ) : null}
                      {!exp.client && !exp.project && !exp.team_member && (
                        <span className="font-mono text-[10px]">Corporate OpEx</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{formatCurrency(exp.amount)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {exp.status === "paid" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Paid
                        </span>
                      )}
                      {exp.status === "pending" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="size-3" /> Pending
                        </span>
                      )}
                      {exp.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="size-3" /> Cancelled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {exp.receipt_url && (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View Receipt"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(exp)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(exp.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT SADA MODAL */}
      <RecordExpenseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRefresh={onRefresh}
        editingExpense={editingExpense}
        categories={categories}
        clients={clients}
        projects={projects}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />

      {/* SADA CONFIRMATION DIALOG (NO BROWSER CONFIRM) */}
      <SADAConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Outflow Record"
        description="Are you sure you want to delete this operational expense? This transaction will be permanently removed from the ledger and cash accounts updated."
        confirmLabel={isDeleting ? "Deleting..." : "Delete Record"}
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
