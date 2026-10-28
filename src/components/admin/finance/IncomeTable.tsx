import { useState, useMemo, useEffect, useCallback } from "react";
import {
  IncomeTransaction,
  IncomeCategory,
  IncomeStatus,
  formatCurrency,
  FinancialAccount,
  INCOME_CATEGORY_OPTIONS,
} from "@/types/finance";
import { deleteIncome } from "@/lib/finance-service";
import { SADASelect } from "@/components/ui/sada-select";
import { SADASearch } from "@/components/ui/sada-search";
import { SADAButton, SADAConfirmDialog, SADAEmptyState } from "@/components/ui/sada-ui";
import { RecordIncomeModal } from "./RecordIncomeModal";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowDownLeft,
} from "lucide-react";
import { toast } from "sonner";

interface IncomeTableProps {
  incomes: IncomeTransaction[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; client_name: string }>;
  accounts?: FinancialAccount[];
  onRefresh: () => void;
  openCreateModal?: boolean;
  onCloseCreateModal?: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export function IncomeTable({
  incomes,
  clients,
  projects,
  accounts = [],
  onRefresh,
  openCreateModal,
  onCloseCreateModal,
  currentUserId,
  currentUserName,
}: IncomeTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeTransaction | null>(null);

  // Confirm delete state
  const [incomeToDelete, setIncomeToDelete] = useState<IncomeTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenCreate = useCallback(() => {
    setEditingIncome(null);
    setIsModalOpen(true);
  }, []);

  // Sync external openCreateModal
  useEffect(() => {
    if (openCreateModal) {
      handleOpenCreate();
    }
  }, [openCreateModal, handleOpenCreate]);

  const handleOpenEdit = (inc: IncomeTransaction) => {
    setEditingIncome(inc);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingIncome(null);
    if (onCloseCreateModal) onCloseCreateModal();
  };

  const handleConfirmDelete = async () => {
    if (!incomeToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteIncome(incomeToDelete.id, { id: currentUserId, name: currentUserName });
      if (res.error) {
        toast.error(`Failed to delete income: ${res.error.message}`);
      } else {
        toast.success("Income record deleted successfully");
        setIncomeToDelete(null);
        onRefresh();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete income record");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered List
  const filteredIncomes = useMemo(() => {
    return incomes.filter((inc) => {
      if (categoryFilter !== "all" && inc.category !== categoryFilter) return false;
      if (statusFilter !== "all" && inc.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const desc = (inc.description || "").toLowerCase();
        const client = (inc.client?.name || "").toLowerCase();
        const ref = (inc.reference || "").toLowerCase();
        if (!desc.includes(q) && !client.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }, [incomes, search, categoryFilter, statusFilter]);

  const categoryFilterOptions = [
    { value: "all", label: "All Categories" },
    ...INCOME_CATEGORY_OPTIONS,
  ];

  const statusFilterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "received", label: "Received (Settled)" },
    { value: "pending", label: "Pending (Receivable)" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 w-full">
          <SADASearch
            value={search}
            onChange={setSearch}
            placeholder="Search inflows by description, client, ref..."
            size="compact"
            className="w-full sm:flex-1 sm:max-w-sm"
          />

          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center">
            <div className="w-full sm:w-44">
              <SADASelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categoryFilterOptions}
                size="compact"
                className="w-full"
              />
            </div>

            <div className="w-full sm:w-36">
              <SADASelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                size="compact"
                className="w-full"
              />
            </div>
          </div>
        </div>

        <SADAButton
          onClick={handleOpenCreate}
          size="sm"
          variant="primary"
          leftIcon={<Plus className="size-3.5" />}
          className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 w-full sm:w-auto justify-center"
        >
          Record Inflow
        </SADAButton>
      </div>

      {/* Table / List View */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {/* Mobile Card List View (< md) */}
        <div className="block md:hidden divide-y divide-border/40">
          {filteredIncomes.length === 0 ? (
            <div className="py-12 px-4">
              <SADAEmptyState
                icon={ArrowDownLeft}
                title="No Inflow Records Found"
                description={
                  search || categoryFilter !== "all" || statusFilter !== "all"
                    ? "No inflows matched your search and filter criteria."
                    : "No operational inflow transactions recorded for this period yet."
                }
                action={{
                  label: "Record Inflow",
                  onClick: handleOpenCreate,
                }}
              />
            </div>
          ) : (
            filteredIncomes.map((inc) => (
              <div key={inc.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-foreground break-words">
                      {inc.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span className="font-mono">{inc.date}</span>
                      {inc.client && (
                        <span className="flex items-center gap-1 text-primary">
                          <Building2 className="size-3" />
                          {inc.client.name}
                        </span>
                      )}
                      {inc.project && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Briefcase className="size-3" />
                          {inc.project.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(inc.amount)}
                    </div>
                    <div className="mt-1">
                      {inc.status === "received" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Received
                        </span>
                      ) : inc.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="size-3" /> Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="size-3" /> Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono px-2 py-0.5 rounded-md bg-muted border border-border/60 text-foreground font-medium">
                      {inc.category}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {inc.payment_method}
                    </span>
                    {inc.reference && (
                      <span className="font-mono text-[10px] bg-muted/70 px-1.5 py-0.5 rounded border border-border/50">
                        Ref: {inc.reference}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inc.receipt_url && (
                      <a
                        href={inc.receipt_url}
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
                      onClick={() => handleOpenEdit(inc)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomeToDelete(inc)}
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

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description / Entity</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {filteredIncomes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <SADAEmptyState
                      icon={ArrowDownLeft}
                      title="No Inflow Records Found"
                      description={
                        search || categoryFilter !== "all" || statusFilter !== "all"
                          ? "No inflows matched your search and filter criteria."
                          : "No operational inflow transactions recorded for this period yet."
                      }
                      action={{
                        label: "Record Inflow",
                        onClick: handleOpenCreate,
                      }}
                    />
                  </td>
                </tr>
              ) : (
                filteredIncomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/20 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {inc.date}
                    </td>

                    {/* Description & Links */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-foreground truncate">
                        {inc.description}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                        {inc.client && (
                          <span className="flex items-center gap-1 text-primary">
                            <Building2 className="size-3" />
                            {inc.client.name}
                          </span>
                        )}
                        {inc.project && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Briefcase className="size-3" />
                            {inc.project.title}
                          </span>
                        )}
                        {inc.reference && (
                          <span className="font-mono text-[10px] bg-muted/70 px-1.5 py-0.5 rounded border border-border/50">
                            Ref: {inc.reference}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted border border-border/60 text-foreground font-medium">
                        {inc.category}
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {inc.payment_method}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 font-bold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +{formatCurrency(inc.amount)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inc.status === "received" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Received
                        </span>
                      ) : inc.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="size-3" /> Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="size-3" /> Cancelled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {inc.receipt_url && (
                          <a
                            href={inc.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View Receipt / Proof"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(inc)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIncomeToDelete(inc)}
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

      {/* SADA RECORD INCOME MODAL */}
      <RecordIncomeModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRefresh={onRefresh}
        editingIncome={editingIncome}
        clients={clients}
        projects={projects}
        accounts={accounts}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />

      {/* SADA CONFIRM DELETE DIALOG */}
      <SADAConfirmDialog
        open={!!incomeToDelete}
        onOpenChange={(open) => !open && setIncomeToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Income Transaction"
        description={`Are you sure you want to permanently delete "${incomeToDelete?.description || "this inflow record"}" (+${formatCurrency(incomeToDelete?.amount || 0)})? This will update the company ledger and cash flow.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete Record"}
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
