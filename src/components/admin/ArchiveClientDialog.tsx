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
  Archive,
  RotateCcw,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { SADAButton } from "@/components/ui/sada-button";
import { archiveClient, restoreClient } from "@/lib/client-lifecycle-service";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

export interface ArchiveClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName: string;
  clientType?: string;
  mode: "archive" | "restore";
  onSuccess?: () => void;
}

export function ArchiveClientDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientType,
  mode,
  onSuccess,
}: ArchiveClientDialogProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const [loading, setLoading] = React.useState(false);

  const isArchive = mode === "archive";

  const handleAction = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      if (isArchive) {
        const res = await archiveClient(clientId);
        if (res.success) {
          toast.success(
            isAr
              ? `تمت أرشفة وتجميد العميل "${clientName}" بنجاح.`
              : `Client "${clientName}" has been safely archived and frozen.`
          );
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error || (isAr ? "فشل أرشفة العميل" : "Failed to archive client"));
        }
      } else {
        const res = await restoreClient(clientId, clientType);
        if (res.success) {
          toast.success(
            isAr
              ? `تمت استعادة وتنشيط العميل "${clientName}" بنجاح.`
              : `Client "${clientName}" has been successfully restored to active operations.`
          );
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error || (isAr ? "فشل استعادة العميل" : "Failed to restore client"));
        }
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? "حدث خطأ غير متوقع" : "Unexpected error during operation"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 max-w-[500px] shadow-2xl">
        <AlertDialogHeader className="space-y-3 text-left rtl:text-right">
          <div className="flex items-start gap-3">
            <div
              className={`size-10 rounded-2xl grid place-items-center shrink-0 border ${
                isArchive
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isArchive ? <Archive className="size-5" /> : <RotateCcw className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-base sm:text-lg font-bold font-display text-foreground">
                {isArchive
                  ? (isAr ? `تجميد وأرشفة العميل: ${clientName}` : `Archive & Freeze Client: ${clientName}`)
                  : (isAr ? `استعادة وتنشيط العميل: ${clientName}` : `Restore & Reactivate Client: ${clientName}`)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                {isArchive
                  ? (isAr
                      ? "إجراء قابل للاسترجاع يحافظ على كافة البيانات والتاريخ مع إيقاف العمليات النشطة مؤقتاً."
                      : "A reversible operation that preserves all history while pausing active workflows.")
                  : (isAr
                      ? "إعادة العميل إلى قائمة العمليات النشطة وتفعيل جداوله التشغيلية."
                      : "Return the client to active operations and resume operational scheduling.")}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="my-2 space-y-3">
          {isArchive ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2.5 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{isAr ? "ما الذي سيحدث عند الأرشفة؟" : "What happens when you archive?"}</span>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "لن يشارك العميل بعد الآن في العمليات والمهام النشطة اليومية."
                      : "The client will no longer participate in active daily operations."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "سيتم إيقاف المهام المعلقة والمتكررة مؤقتاً (Paused) دون حذفها."
                      : "Pending and recurring tasks will be safely paused without deletion."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "ستختفي مواعيد وفعاليات العميل المستقبلية من التقويم النشط وعبء العمل."
                      : "Future operational events will disappear from the active calendar and workload."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span className="font-medium text-foreground">
                    {isAr
                      ? "يتم الحفاظ بالكامل على المهام المكتملة، والفواتير، والملفات، وسجلات التدقيق."
                      : "All completed tasks, financial invoices, files, and audit records remain fully intact."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span className="font-medium text-foreground">
                    {isAr
                      ? "يمكنك استعادة وتنشيط العميل بضغطة زر واحدة في أي وقت لاحقاً."
                      : "You can restore this client at any time from the Archived Clients section."}
                  </span>
                </li>
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2.5 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="size-4 shrink-0" />
                <span>{isAr ? "ما الذي سيحدث عند الاستعادة؟" : "What happens when you restore?"}</span>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "تتم إعادة الحالة التشغيلية للعميل إلى \"نشط\" (Active)."
                      : "The client lifecycle status returns immediately to Active."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "تتم إعادة تفعيل الالتزامات والجداول المتكررة الموقوفة سابقاً."
                      : "Eligible paused recurring commitments are safely reactivated."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "تتم استعادة حالات المهام بدقة إلى وضعها الأصلي السابق للتجميد."
                      : "Paused tasks are restored to their exact original pre-archive states."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>
                    {isAr
                      ? "تتم إعادة المواءمة الذكية مع باقة العميل دون تكرار أي مهام سابقة."
                      : "Package reconciliation aligns future commitments without duplicating tasks."}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/60">
          <SADAButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </SADAButton>

          <SADAButton
            type="button"
            variant={isArchive ? "primary" : "primary"}
            onClick={handleAction}
            disabled={loading}
            className={`w-full sm:w-auto flex items-center gap-1.5 ${
              isArchive
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{isAr ? "جاري المعالجة..." : "Processing..."}</span>
              </>
            ) : isArchive ? (
              <>
                <Archive className="size-4" />
                <span>{isAr ? "تأكيد الأرشفة والتجميد" : "Confirm Archive"}</span>
              </>
            ) : (
              <>
                <RotateCcw className="size-4" />
                <span>{isAr ? "تأكيد استعادة العميل" : "Confirm Restore"}</span>
              </>
            )}
          </SADAButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
