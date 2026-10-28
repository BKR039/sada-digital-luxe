import { useState, useEffect } from "react";
import { formatCurrency } from "@/types/finance";
import { createInvoice } from "@/lib/finance-service";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAInput, SADAButton } from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clients: Array<{ id: string; name: string }>;
  defaultClientId?: string;
  defaultServiceFee?: number;
  defaultSponsoringBudget?: number;
  currentUserId?: string;
  currentUserName?: string;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  clients,
  defaultClientId,
  defaultServiceFee,
  defaultSponsoringBudget,
  currentUserId,
  currentUserName,
}: CreateInvoiceModalProps) {
  const { t, isRTL } = useTranslation();
  const isAr = isRTL;

  const [clientId, setClientId] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [sponsoringBudget, setSponsoringBudget] = useState("");
  const [issueDate, setIssueDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientId(defaultClientId || (clients[0]?.id || ""));
      setServiceFee(defaultServiceFee ? defaultServiceFee.toString() : "");
      setSponsoringBudget(defaultSponsoringBudget ? defaultSponsoringBudget.toString() : "");
      setIssueDate(format(new Date(), "yyyy-MM-dd"));
      setDueDate("");
      setNotes("");
    }
  }, [isOpen, defaultClientId, defaultServiceFee, defaultSponsoringBudget, clients]);

  const liveService = parseFloat(serviceFee) || 0;
  const liveSponsoring = parseFloat(sponsoringBudget) || 0;
  const liveTotal = liveService + liveSponsoring;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error(isAr ? "يرجى تحديد العميل" : "Please select a client.");
      return;
    }
    if (liveTotal <= 0) {
      toast.error(isAr ? "يرجى إدخال أتعاب الخدمة أو ميزانية الإعلانات" : "Please enter a service fee or sponsoring budget.");
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
      toast.error(isAr ? `فشل إنشاء الفاتورة: ${res.error.message}` : `Failed to create invoice: ${res.error.message}`);
    } else {
      toast.success(isAr ? "تم إنشاء الفاتورة بنجاح في النظام المالي" : "Invoice created successfully in Financial OS!");
      onSuccess();
      onClose();
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(v) => !v && onClose()}
      title={isAr ? "إصدار فاتورة جديدة للعميل" : "Create Client Invoice"}
      description={isAr ? "فوترة رسمية مع فصل أتعاب الخدمة عن ميزانية الإعلانات" : "Direct billing with separated service fee and sponsoring budget"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
            {isAr ? "العميل" : "Client"}
          </label>
          <SADASelect
            value={clientId}
            onChange={setClientId}
            placeholder={isAr ? "اختر العميل..." : "Choose Client..."}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "أتعاب الخدمة (TND)" : "Service Fee (TND)"}
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
              {isAr ? "ميزانية الإعلانات (TND)" : "Sponsoring (TND)"}
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
          <span className="text-muted-foreground">{isAr ? "إجمالي المبلغ المستحق:" : "Total Invoice Charge:"}</span>
          <strong className="text-foreground text-sm font-bold tabular-nums">
            {formatCurrency(liveTotal)}
          </strong>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "تاريخ الإصدار" : "Issue Date"}
            </label>
            <SADADatePicker
              value={issueDate}
              onChange={(d) => d && setIssueDate(d)}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "تاريخ الاستحقاق" : "Due Date"}
            </label>
            <SADADatePicker
              value={dueDate}
              onChange={(d) => setDueDate(d || "")}
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
            {isAr ? "ملاحظات وشروط" : "Notes / Terms"}
          </label>
          <SADAInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? "تفاصيل الباقة الشهرية..." : "Monthly retainer & ad budget..."}
          />
        </div>

        <div className="pt-3 border-t border-border/50 flex justify-end gap-2">
          <SADAButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>
          <SADAButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? (isAr ? "جارٍ الإنشاء..." : "Creating...")
              : (isAr ? "إصدار الفاتورة" : "Generate Invoice")}
          </SADAButton>
        </div>
      </form>
    </SADADialog>
  );
}
