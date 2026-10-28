import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADADrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left" | "bottom";
  width?: "sm" | "default" | "lg" | "xl" | "2xl" | "full";
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  showCloseButton?: boolean;
}

const widthClasses: Record<string, string> = {
  sm: "sm:max-w-md",
  default: "sm:max-w-lg",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-3xl",
  full: "sm:max-w-4xl",
};

export function SADADrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  width = "default",
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  showCloseButton = true,
}: SADADrawerProps) {
  const isBottom = side === "bottom";
  const widthClass = widthClasses[width] || widthClasses.default;

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 dark:bg-black/65 data-[state=open]:animate-[sada-overlay-in_150ms_ease-out] data-[state=closed]:animate-[sada-overlay-out_100ms_ease-in]" />
        <SheetPrimitive.Content
          className={cn(
            "fixed z-50 bg-card border-border shadow-2xl flex flex-col outline-none overflow-hidden",
            isBottom
              ? "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl border-t data-[state=open]:animate-[sada-drawer-in-bottom_180ms_ease-out] data-[state=closed]:animate-[sada-drawer-out-bottom_120ms_ease-in]"
              : side === "left"
              ? "inset-y-0 start-0 h-full w-full border-e data-[state=open]:animate-[sada-drawer-in-right_180ms_ease-out] data-[state=closed]:animate-[sada-drawer-out-right_120ms_ease-in]"
              : "inset-y-0 end-0 h-full w-full border-s data-[state=open]:animate-[sada-drawer-in-right_180ms_ease-out] data-[state=closed]:animate-[sada-drawer-out-right_120ms_ease-in]",
            !isBottom && widthClass,
            className
          )}
        >
          {/* Fixed Header */}
          {(title || showCloseButton) && (
            <div className={cn("flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border/60 shrink-0", headerClassName)}>
              <div className="space-y-0.5 text-start pe-3 sm:pe-4 min-w-0">
                {title && (
                  <SheetPrimitive.Title className="font-display font-bold text-base sm:text-lg text-foreground tracking-tight truncate">
                    {title}
                  </SheetPrimitive.Title>
                )}
                {description && (
                  <SheetPrimitive.Description className="text-xs text-muted-foreground line-clamp-2">
                    {description}
                  </SheetPrimitive.Description>
                )}
              </div>

              {showCloseButton && (
                <SheetPrimitive.Close className="size-8 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0">
                  <X className="size-4" />
                  <span className="sr-only">Close</span>
                </SheetPrimitive.Close>
              )}
            </div>
          )}

          {/* Independently Scrollable Body */}
          <div className={cn("overflow-y-auto overflow-x-hidden flex-1 px-4 py-3.5 sm:px-6 sm:py-5 min-h-0", contentClassName)}>
            {children}
          </div>

          {/* Sticky Footer */}
          {footer && (
            <div className={cn("flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-border/60 bg-muted/15 shrink-0", footerClassName)}>
              {footer}
            </div>
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

export const SadaDrawer = SADADrawer;
