import { useState, useEffect } from "react";
import { formatCurrency, FinancialAccount } from "@/types/finance";
import { recordInvoicePayment } from "@/lib/finance-service";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAButton } from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface RecordInvoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: any | null;
  accounts: FinancialAccount[];
  currentUserId?: string;
  currentUserName?: string;
}

export function RecordInvoicePaymentModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
  accounts,
  currentUserId,
  currentUserName,
}: RecordInvoicePaymentModalProps) {
  const { isRTL } = useTranslation();
  const isAr = isRTL;

  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setPaymentMethod("Bank Transfer");
      setSelectedAccountId(accounts[0]?.id || "");
    }
  }, [isOpen, accounts]);

  if (!invoice) return null;

  const totalAmount = Number(invoice.total_amount || invoice.totalAmount || 0);
  const serviceFee = Number(invoice.service_revenue || invoice.serviceFee || invoice.serviceRevenue || 0);
  const sponsoringBudget = Number(invoice.sponsoring_budget || invoice.sponsoringBudget || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const invoicePayload = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number || invoice.invoiceNumber,
      clientId: invoice.client_id || invoice.clientId,
      clientName: invoice.client?.name || invoice.clientName,
      serviceFee,
      serviceRevenue: serviceFee,
      sponsoringBudget,
      totalAmount,
      currency: invoice.currency || "TND",
    };

    const res = await recordInvoicePayment({
      invoice: invoicePayload as any,
      paymentDate,
      paymentMethod,
      accountId: selectedAccountId || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(isAr ? `فشل تسجيل السداد: ${res.error.message}` : `Failed to record payment: ${res.error.message}`);
    } else {
      toast.success(isAr ? "تم تسجيل سداد الفاتورة وإيداع الدفعة في سجل المقبوضات!" : "Invoice payment recorded & deposited to receipts ledger!");
      onSuccess();
      onClose();
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(v) => !v && onClose()}
      title={isAr ? "تسجيل سداد فاتورة العميل" : "Record Client Payment"}
      description={`${isAr ? "فاتورة رقم" : "Invoice #"} ${invoice.invoice_number || invoice.invoiceNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "أتعاب الخدمة (دخل تشغيلي):" : "Service Revenue Inflow:"}</span>
            <span className="font-semibold text-foreground">
              +{formatCurrency(serviceFee)}
            </span>
          </div>
          {sponsoringBudget > 0 && (
            <div className="flex justify-between">
              <span className="text-indigo-600 dark:text-indigo-400">
                {isAr ? "ميزانية الإعلانات الممولة:" : "Sponsoring Budget Inflow:"}
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                +{formatCurrency(sponsoringBudget)}
              </span>
            </div>
          )}
          <div className="pt-2 border-t border-border/50 flex justify-between font-bold text-sm">
            <span>{isAr ? "إجمالي المبلغ المسدد:" : "Total Settled:"}</span>
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
            {isAr ? "تاريخ السداد" : "Payment Date"}
          </label>
          <SADADatePicker
            value={paymentDate}
            onChange={(d) => d && setPaymentDate(d)}
          />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
            {isAr ? "طريقة الدفع" : "Payment Method"}
          </label>
          <SADASelect
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              { value: "Bank Transfer", label: isAr ? "تحويل بنكي (BIAT / الزيتونة)" : "Bank Transfer" },
              { value: "Cash", label: isAr ? "نقد / صندوق الخزينة" : "Cash / Petty Cash" },
              { value: "Credit Card", label: isAr ? "بطاقة بنكية" : "Credit Card" },
              { value: "Check", label: isAr ? "شيك بنكي" : "Bank Check" },
            ]}
          />
        </div>

        {accounts.length > 0 && (
          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "حساب الإيداع / الخزينة" : "Deposit Treasury Account"}
            </label>
            <SADASelect
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.accountName || a.name} (${formatCurrency(a.currentBalance || (a as any).current_balance || 0)})`,
              }))}
            />
          </div>
        )}

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
              ? (isAr ? "جارٍ تسجيل السداد..." : "Recording...")
              : (isAr ? "تأكيد السداد وإصدار الإيداع" : "Confirm Settlement")}
          </SADAButton>
        </div>
      </form>
    </SADADialog>
  );
}
