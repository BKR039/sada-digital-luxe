import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Archive,
  Loader2,
  CheckCircle2,
  Layers,
  Calendar,
  FileText,
  DollarSign
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import { SADAInput } from "@/components/ui/sada-ui";
import {
  analyzeClientLifecycle,
  deleteClientPermanently,
  type ClientLifecycleAnalysis
} from "@/lib/client-lifecycle-service";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

export interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName: string;
  onDeleted?: () => void;
  onRequestArchive?: () => void;
}

export function DeleteClientDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onDeleted,
  onRequestArchive,
}: DeleteClientDialogProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const [loadingAnalysis, setLoadingAnalysis] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<ClientLifecycleAnalysis | null>(null);
  const [confirmationInput, setConfirmationInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open && clientId) {
      setConfirmationInput("");
      setLoadingAnalysis(true);
      analyzeClientLifecycle(clientId)
        .then((res) => {
          setAnalysis(res);
        })
        .catch((err) => {
          console.error("Failed to analyze client lifecycle:", err);
          toast.error(err.message || (isAr ? "فشل تحليل سجلات العميل" : "Failed to analyze client dependencies"));
        })
        .finally(() => {
          setLoadingAnalysis(false);
        });
    } else {
      setAnalysis(null);
      setConfirmationInput("");
      setDeleting(false);
    }
  }, [open, clientId, isAr]);

  const canDelete = analysis?.can_delete_permanently ?? false;
  const isConfirmed = confirmationInput.trim().toLowerCase() === clientName.trim().toLowerCase();

  const handleDelete = async () => {
    if (!clientId || !canDelete || !isConfirmed) return;
    setDeleting(true);
    try {
      const res = await deleteClientPermanently(clientId);
      if (res.success) {
        toast.success(
          isAr
            ? `تم حذف العميل "${clientName}" وكافة عملياته بنجاح.`
            : `Client "${clientName}" and operational dependencies permanently deleted.`
        );
        onOpenChange(false);
        onDeleted?.();
      } else {
        toast.error(res.error || (isAr ? "فشل حذف العميل" : "Failed to delete client"));
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? "حدث خطأ أثناء الحذف" : "Error executing deletion"));
    } finally {
      setDeleting(false);
    }
  };

  const counts = analysis?.counts;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 max-w-[540px] shadow-2xl">
        <AlertDialogHeader className="space-y-3 text-left rtl:text-right">
          <div className="flex items-start gap-3">
            <div
              className={`size-10 rounded-2xl grid place-items-center shrink-0 border ${
                canDelete
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              }`}
            >
              {canDelete ? <Trash2 className="size-5" /> : <ShieldAlert className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-base sm:text-lg font-bold font-display text-foreground">
                {canDelete
                  ? (isAr ? `حذف العميل نهائياً: ${clientName}` : `Permanently Delete: ${clientName}`)
                  : (isAr ? `الحذف محظور: ${clientName}` : `Deletion Blocked: ${clientName}`)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                {canDelete
                  ? (isAr
                      ? "هذا الإجراء نهائي ولا رجعة فيه. سيتم محو كافة السجلات التشغيلية فوراً."
                      : "This action is permanent and irreversible. All operational records will be purged immediately.")
                  : (isAr
                      ? "تم حظر الحذف لحماية النزاهة المالية والمحاسبية للنظام."
                      : "Deletion is blocked by fiscal safeguards to preserve financial auditability.")}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {loadingAnalysis ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs">{isAr ? "جاري فحص القيود المالية والتشغيلية..." : "Auditing operational & financial dependencies..."}</p>
          </div>
        ) : !canDelete && analysis ? (
          /* BLOCKING FINANCIAL SAFEGUARD VIEW */
          <div className="space-y-4 my-2">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{isAr ? "ضوابط مالية وقانونية تمنع الحذف" : "Legal & Financial Safeguard Active"}</span>
              </div>
              <ul className="text-[11px] text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside ps-1 leading-relaxed">
                {analysis.blocking_reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Archive className="size-4 text-primary" />
                <span>{isAr ? "الحل الموصى به: أرشفة العميل" : "Recommended Solution: Archive Client"}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isAr
                  ? "تتيح لك الأرشفة تجميد عمليات العميل وإيقاف المهام المتكررة وحجبها عن التقويم وعبء العمل، مع الاحتفاظ الكامل بالسجلات والفواتير التاريخية القانونية وإمكانية الاسترجاع لاحقاً."
                  : "Archiving freezes the client's operations, pauses recurring tasks, and removes them from active calendar views while preserving full legal invoice history with reversible restore."}
              </p>
            </div>
          </div>
        ) : (
          /* DELETION CONFIRMATION VIEW */
          <div className="space-y-4 my-2">
            {counts && (
              <div className="rounded-2xl border border-border/80 bg-muted/30 p-3 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isAr ? "السجلات التشغيلية التي سيتم محوها نهائياً:" : "Operational records that will be permanently removed:"}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-card border border-border/60">
                    <Layers className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{isAr ? "المهام والأنشطة:" : "Tasks & Subtasks:"}</span>
                    <span className="font-bold text-foreground ms-auto">{counts.tasks}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-card border border-border/60">
                    <Calendar className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{isAr ? "مساحات العمل:" : "Workspaces:"}</span>
                    <span className="font-bold text-foreground ms-auto">{counts.projects}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-card border border-border/60">
                    <FileText className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{isAr ? "الالتزامات المجدولة:" : "Commitments:"}</span>
                    <span className="font-bold text-foreground ms-auto">{counts.commitments}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-card border border-border/60">
                    <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{isAr ? "المخرجات والحجوزات:" : "Deliverables:"}</span>
                    <span className="font-bold text-foreground ms-auto">{counts.deliverables + counts.bookings}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 space-y-1.5 text-xs text-destructive">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{isAr ? "تحذير أمني صارم" : "Strict Safety Warning"}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-destructive/90">
                {isAr
                  ? `لحماية البيانات من الحذف العرضي بنقرة واحدة، يرجى كتابة اسم العميل بالضبط ("${clientName}") للتأكيد:`
                  : `To prevent accidental single-click deletion, please type the exact client name ("${clientName}") to confirm:`}
              </p>
            </div>

            <div className="space-y-1">
              <SADAInput
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={clientName}
                className="font-mono text-xs"
                autoFocus
              />
            </div>
          </div>
        )}

        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/60">
          <SADAButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="w-full sm:w-auto"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          {!canDelete ? (
            onRequestArchive && (
              <SADAButton
                type="button"
                variant="primary"
                onClick={() => {
                  onOpenChange(false);
                  onRequestArchive();
                }}
                className="w-full sm:w-auto flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Archive className="size-4" />
                <span>{isAr ? "الانتقال للأرشفة الآمنة" : "Archive Client Instead"}</span>
              </SADAButton>
            )
          ) : (
            <SADAButton
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || deleting || loadingAnalysis}
              className="w-full sm:w-auto flex items-center gap-1.5"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{isAr ? "جاري الحذف..." : "Deleting..."}</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  <span>{isAr ? "تأكيد الحذف النهائي" : "Permanently Delete"}</span>
                </>
              )}
            </SADAButton>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
