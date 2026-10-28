import { useState, useEffect } from "react";
import { SponsoringPlatform, formatCurrency } from "@/types/finance";
import { createSponsoringCampaign } from "@/lib/finance-service";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAInput, SADAButton } from "@/components/ui/sada-ui";
import { SADASelect } from "@/components/ui/sada-select";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface CreateSponsoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clients: Array<{ id: string; name: string }>;
  defaultClientId?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export function CreateSponsoringModal({
  isOpen,
  onClose,
  onSuccess,
  clients,
  defaultClientId,
  currentUserId,
  currentUserName,
}: CreateSponsoringModalProps) {
  const { isRTL } = useTranslation();
  const isAr = isRTL;

  const defaultPurchaseRate = getBusinessRuleNumber("sponsoring_purchase_rate", 3.37);
  const defaultClientRate = getBusinessRuleNumber("sponsoring_client_rate", 4.00);

  const [clientId, setClientId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [platform, setPlatform] = useState<SponsoringPlatform>("Meta Ads");
  const [budgetTnd, setBudgetTnd] = useState("800");
  const [usdAmount, setUsdAmount] = useState("200");
  const [purchaseRate, setPurchaseRate] = useState(() => defaultPurchaseRate.toString());
  const [clientRate, setClientRate] = useState(() => defaultClientRate.toString());
  const [campaignDate, setCampaignDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientId(defaultClientId || (clients[0]?.id || ""));
      setCampaignName("");
      setPlatform("Meta Ads");
      setBudgetTnd("800");
      setUsdAmount("200");
      setPurchaseRate(defaultPurchaseRate.toString());
      setClientRate(defaultClientRate.toString());
      setCampaignDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
    }
  }, [isOpen, defaultClientId, clients, defaultPurchaseRate, defaultClientRate]);

  // Derived financial computations
  const pRate = parseFloat(purchaseRate) || defaultPurchaseRate;
  const cRate = parseFloat(clientRate) || defaultClientRate;
  const usd = parseFloat(usdAmount) || 0;
  const purchaseCost = usd * pRate;
  const clientCharge = usd * cRate;
  const margin = clientCharge - purchaseCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error(isAr ? "يرجى تحديد العميل" : "Please select a client.");
      return;
    }
    if (!campaignName.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم الحملة" : "Please enter a campaign name.");
      return;
    }
    if (usd <= 0) {
      toast.error(isAr ? "يرجى إدخال ميزانية صالحة بالدولار" : "Please enter a valid USD budget.");
      return;
    }

    setIsSubmitting(true);
    const res = await createSponsoringCampaign({
      clientId,
      campaignName: campaignName.trim(),
      platform,
      budgetTnd: parseFloat(budgetTnd) || clientCharge,
      usdAmount: usd,
      purchaseRate: pRate,
      clientRate: cRate,
      date: campaignDate,
      notes: notes.trim() || undefined,
      actorId: currentUserId,
      actorName: currentUserName,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(isAr ? `فشل تسجيل الحملة: ${res.error.message}` : `Failed to record campaign: ${res.error.message}`);
    } else {
      toast.success(isAr ? "تم تسجيل الحملة الممولة بنجاح في محرك الإعلانات والنظام المالي!" : "Sponsoring campaign recorded successfully in Financial OS!");
      onSuccess();
      onClose();
    }
  };

  return (
    <SADADialog
      open={isOpen}
      onOpenChange={(v) => !v && onClose()}
      title={isAr ? "تسجيل حملة إعلانية ممولة للعميل" : "Log Sponsoring Campaign"}
      description={isAr ? "حساب تكلفة الشراء، سعر محاسبة العميل، وفارق الهامش الربحي" : "Calculates purchase FX cost, client charge rate, and arbitrage margin"}
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

        <div>
          <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
            {isAr ? "اسم الحملة" : "Campaign Name"}
          </label>
          <SADAInput
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder={isAr ? "حملة خريف 2026 - إنستغرام وتيك توك..." : "Autumn 2026 Launch Campaign..."}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "المنصة الإعلانية" : "Platform"}
            </label>
            <SADASelect
              value={platform}
              onChange={(val) => setPlatform(val as SponsoringPlatform)}
              options={[
                { value: "Meta Ads", label: "Meta Ads (Instagram / FB)" },
                { value: "TikTok Ads", label: "TikTok Ads" },
                { value: "Google Ads", label: "Google Ads / YouTube" },
                { value: "Snapchat Ads", label: "Snapchat Ads" },
                { value: "LinkedIn Ads", label: "LinkedIn Ads" },
              ]}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "الميزانية بالدولار ($ USD)" : "USD Ad Spend ($)"}
            </label>
            <SADAInput
              type="number"
              step="1"
              value={usdAmount}
              onChange={(e) => setUsdAmount(e.target.value)}
              placeholder="200"
              prefix="$"
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Live Arbitrage Preview */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "تكلفة الشراء الفعلية (TND):" : "Purchase Cost (TND):"}</span>
            <span className="font-semibold text-foreground">{formatCurrency(purchaseCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isAr ? "محاسبة العميل (TND):" : "Client Charge (TND):"}</span>
            <span className="font-semibold text-primary">{formatCurrency(clientCharge)}</span>
          </div>
          <div className="pt-1.5 border-t border-border/50 flex justify-between font-bold">
            <span className="text-emerald-600 dark:text-emerald-400">{isAr ? "هامش أرباح الوكالة:" : "Agency Net Margin:"}</span>
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatCurrency(margin)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "تاريخ الحملة" : "Campaign Date"}
            </label>
            <SADADatePicker
              value={campaignDate}
              onChange={(d) => d && setCampaignDate(d)}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-1 block">
              {isAr ? "ملاحظات إضافية" : "Notes"}
            </label>
            <SADAInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? "أهداف الحملة والتفاعل..." : "Objective, target ROAS..."}
            />
          </div>
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
              ? (isAr ? "جارٍ الحفظ..." : "Saving...")
              : (isAr ? "تسجيل الحملة" : "Log Campaign")}
          </SADAButton>
        </div>
      </form>
    </SADADialog>
  );
}
