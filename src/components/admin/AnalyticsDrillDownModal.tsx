import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/types/finance";
import type { AnalyticsDrillDownState } from "@/types/notifications-and-audit";
import {
  Download,
  ExternalLink,
  Layers,
  X,
  Info,
  Coins,
  Clock,
  BookOpen,
  FileText,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/i18n";

interface AnalyticsDrillDownModalProps {
  drillDown: AnalyticsDrillDownState | null;
  onClose: () => void;
}

export function AnalyticsDrillDownModal({ drillDown, onClose }: AnalyticsDrillDownModalProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  if (!drillDown) return null;

  const handleExportCSV = () => {
    const rows = [
      ["Date", "Record Title", "Type", "Amount", "Status", "ID"],
      ...drillDown.records.map((r) => [
        r.date ? r.date.split("T")[0] : "",
        `"${r.title.replace(/"/g, '""')}"`,
        r.type,
        String(r.amount ?? ""),
        r.status || "",
        r.id,
      ]),
    ];
    const csvContent = rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SADA_${drillDown.metricLabel.replace(/\s+/g, "_")}_DrillDown.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const mainTitle = isAr ? "تفصيل المصدر" : "Source Drill-Down";
  let subtitle = drillDown.entityName;
  if (!subtitle) {
    if (drillDown.title.startsWith("Source Drill-Down:")) {
      subtitle = drillDown.title.replace(/^Source Drill-Down:\s*/, "");
    } else if (drillDown.title.startsWith("Drill-Down:")) {
      subtitle = drillDown.title.replace(/^Drill-Down:\s*/, "");
    } else {
      subtitle = drillDown.metricLabel || drillDown.title;
    }
  }

  const formattedValue =
    typeof drillDown.metricValue === "number"
      ? formatCurrency(drillDown.metricValue)
      : drillDown.metricValue;

  return (
    <DialogPrimitive.Root open={!!drillDown} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 dark:bg-black/65 backdrop-blur-[2px] data-[state=open]:animate-[sada-overlay-in_150ms_ease-out] data-[state=closed]:animate-[sada-overlay-out_100ms_ease-in]" />
        <DialogPrimitive.Content
          className="fixed z-50 bg-card text-foreground border-border shadow-2xl flex flex-col outline-none overflow-hidden max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[90dvh] max-sm:w-full max-sm:rounded-t-[28px] max-sm:border-t sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:max-h-[85vh] data-[state=open]:animate-[sada-drawer-in-bottom_180ms_ease-out] sm:data-[state=open]:animate-[sada-dialog-in_120ms_ease-out]"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Mobile Drag Handle */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />

          {/* Sheet / Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-1 pb-3 sm:py-4 border-b border-border/60 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-3 rtl:pr-0 rtl:pl-3">
              <div className="size-10 sm:size-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Layers className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-base sm:text-lg font-bold font-display text-foreground leading-tight truncate">
                  {mainTitle}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground leading-snug truncate">
                  {subtitle}
                </DialogPrimitive.Description>
              </div>
            </div>

            <DialogPrimitive.Close
              onClick={onClose}
              className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 outline-none"
            >
              <X className="size-4" />
              <span className="sr-only">{isAr ? "إغلاق" : "Close"}</span>
            </DialogPrimitive.Close>
          </div>

          {/* Independently Scrollable Body (Single vertical scroll owner) */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0 sada-scrollbar">
            {/* Aggregated Value & Formula Block */}
            <div className="p-3.5 sm:p-4 rounded-2xl border border-border/70 bg-card shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {isAr ? "القيمة التراكمية" : "Aggregated Value"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="rounded-xl h-8 px-3 text-xs font-semibold border-border bg-card hover:bg-muted text-foreground gap-1.5 shrink-0"
                >
                  <Download className="size-3.5" />
                  <span>{isAr ? "تصدير CSV" : "Export CSV"}</span>
                </Button>
              </div>

              <div className="text-2xl min-[360px]:text-3xl font-extrabold font-display text-primary tracking-tight tabular-nums">
                {formattedValue}
              </div>

              {/* Formula Banner */}
              {drillDown.formula && (
                <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/50 rounded-xl sm:rounded-2xl p-3 text-xs flex items-start gap-2.5">
                  <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed font-sans flex-1 break-words">
                    {drillDown.formula}
                  </div>
                </div>
              )}
            </div>

            {/* Authoritative Source Records & Real-time DB Facts */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 py-3 border-y border-border/50 items-center">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <Coins className="size-4 sm:size-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                    {isAr ? "سجلات المصدر الرسمية" : "Authoritative Source Records"}
                  </div>
                  <div className="text-xs font-bold text-foreground truncate">
                    {drillDown.recordsCount} {isAr ? "سجلات" : "records"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 ps-2 sm:ps-4 border-s border-border/60">
                <Clock className="size-4 sm:size-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                    {isAr ? "حقائق قاعدة البيانات اللحظية" : "Real-time DB Facts"}
                  </div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                    {isAr ? "بيانات حية من سجل سدى" : "Live data from SADA OS ledger"}
                  </div>
                </div>
              </div>
            </div>

            {/* Source records list or Empty state */}
            {drillDown.records.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl border border-dashed border-border/70 flex items-center justify-center gap-3 text-center sm:text-start">
                <div className="size-12 rounded-2xl border border-dashed border-border flex items-center justify-center text-muted-foreground/60 shrink-0">
                  <FileText className="size-6" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                  {isAr
                    ? "لم يتم العثور على سجلات مصدر فردية لفترة الاحتساب هذه."
                    : "No individual source records found for this calculation period."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Records Cards (< sm) */}
                <div className="sm:hidden space-y-2.5">
                  {drillDown.records.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-xl bg-card border border-border/60 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground" dir="ltr">
                          {rec.date ? rec.date.split("T")[0] : "—"}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-normal">
                          {rec.type}
                        </Badge>
                      </div>
                      <div className="text-xs font-semibold text-foreground leading-snug">
                        {rec.title}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                        <span className="font-bold font-mono text-foreground">
                          {rec.amount !== undefined
                            ? rec.currency === "Hours"
                              ? (isAr ? `${rec.amount} س` : `${rec.amount} hrs`)
                              : formatCurrency(rec.amount)
                            : "—"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase bg-muted text-foreground/80 font-normal"
                          >
                            {rec.status || (isAr ? "مؤكد" : "CONFIRMED")}
                          </Badge>
                          {rec.linkUrl && (
                            <Link
                              to={rec.linkUrl}
                              onClick={onClose}
                              className="inline-flex items-center text-primary hover:underline gap-1 text-[11px]"
                            >
                              <ExternalLink className="size-3 rtl:rotate-180" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Records Table (hidden sm:block) */}
                <div className="hidden sm:block border border-border/60 rounded-xl overflow-hidden bg-card/50">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-muted/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                      <tr>
                        <th className="py-2 px-3 text-start">{isAr ? "التاريخ" : "Date"}</th>
                        <th className="py-2 px-3 text-start">{isAr ? "السجل / الكيان" : "Record / Entity"}</th>
                        <th className="py-2 px-3 text-start">{isAr ? "النوع" : "Type"}</th>
                        <th className="py-2 px-3 text-end">{isAr ? "المبلغ / الساعات" : "Amount / Hours"}</th>
                        <th className="py-2 px-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                        <th className="py-2 px-3 text-center">{isAr ? "الرابط" : "Link"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {drillDown.records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap text-start" dir="ltr">
                            {rec.date ? rec.date.split("T")[0] : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground text-start">
                            {rec.title}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-start">
                            <Badge variant="outline" className="text-[10px] uppercase font-normal">
                              {rec.type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-end font-bold text-foreground">
                            {rec.amount !== undefined
                              ? rec.currency === "Hours"
                                ? (isAr ? `${rec.amount} س` : `${rec.amount} hrs`)
                                : formatCurrency(rec.amount)
                              : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase bg-muted text-foreground/80 font-normal"
                            >
                              {rec.status || (isAr ? "مؤكد" : "CONFIRMED")}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {rec.linkUrl ? (
                              <Link
                                to={rec.linkUrl}
                                onClick={onClose}
                                className="inline-flex items-center text-primary hover:underline gap-1 text-[11px]"
                              >
                                <ExternalLink className="size-3 rtl:rotate-180" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-border/60 bg-card flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0 flex-1">
              <BookOpen className="size-4.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                {isAr
                  ? "التفصيل مدعوم بنظام سدى المالي وسجل العمليات التشغيلية"
                  : "Drill-down powered by SADA OS Financial OS & Operational Ledger"}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full px-6 py-2 h-9 text-xs font-semibold border-border bg-card hover:bg-muted text-foreground shrink-0"
            >
              {isAr ? "إغلاق" : "Close"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
