import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SADAButton } from "@/components/ui/sada-button";
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADAConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: "danger" | "destructive" | "warning" | "info" | "success" | "primary";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  isLoading?: boolean;
}

export function SADAConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = "danger",
  onConfirm,
  onCancel,
  loading,
  isLoading,
}: SADAConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const activeLoading = loading ?? isLoading ?? internalLoading;
  const activeDescription = description || message || "";
  const isArabic = typeof document !== "undefined" && (document.documentElement.lang === "ar" || document.documentElement.dir === "rtl");
  const activeConfirmLabel = confirmLabel || confirmText || (isArabic ? "تأكيد" : "Confirm");
  const activeCancelLabel = cancelLabel || cancelText || (isArabic ? "إلغاء" : "Cancel");

  const isDestructive = variant === "danger" || variant === "destructive";

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setInternalLoading(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const icons = {
    danger: <ShieldAlert className="size-4.5 text-rose-500" />,
    destructive: <ShieldAlert className="size-4.5 text-rose-500" />,
    warning: <AlertTriangle className="size-4.5 text-amber-500" />,
    info: <Info className="size-4.5 text-cyan-500" />,
    success: <CheckCircle2 className="size-4.5 text-emerald-500" />,
    primary: <Info className="size-4.5 text-primary" />,
  };

  const actionVariant = isDestructive ? "destructive" : "primary";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 max-w-[420px] shadow-xl">
        <AlertDialogHeader className="space-y-3 text-left rtl:text-right">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "size-9 rounded-2xl grid place-items-center shrink-0 border mt-0.5",
                isDestructive && "bg-rose-500/10 border-rose-500/20",
                variant === "warning" && "bg-amber-500/10 border-amber-500/20",
                (variant === "info" || variant === "primary") && "bg-cyan-500/10 border-cyan-500/20",
                variant === "success" && "bg-emerald-500/10 border-emerald-500/20",
              )}
            >
              {icons[variant] || icons.danger}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <AlertDialogTitle className="text-base font-bold font-display tracking-tight text-foreground">
                {title}
              </AlertDialogTitle>
              {activeDescription && (
                <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  {activeDescription}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-5 flex flex-row items-center justify-end gap-2.5 border-t border-border/50 pt-3.5">
          <AlertDialogCancel asChild>
            <SADAButton
              type="button"
              variant="outline"
              size="sm"
              disabled={activeLoading}
              onClick={handleCancel}
            >
              {activeCancelLabel}
            </SADAButton>
          </AlertDialogCancel>

          <SADAButton
            type="button"
            variant={actionVariant}
            size="sm"
            isLoading={activeLoading}
            onClick={handleConfirm}
          >
            {activeConfirmLabel}
          </SADAButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const SadaConfirmDialog = SADAConfirmDialog;
