import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SADAWindowSize =
  | "compact"
  | "standard"
  | "wide"
  | "large"
  | "xl"
  | "full"
  | "micro"
  | "sm"
  | "md"
  | "lg"
  | "2xl"
  | "default";

export const sadaWindowSizes: Record<string, string> = {
  // Canonical sizes
  compact: "max-w-[520px]",
  standard: "max-w-[640px]",
  wide: "max-w-[820px]",
  large: "max-w-[820px]",
  xl: "max-w-[960px]",
  full: "max-w-[calc(100vw-24px)]",
  // Backwards-compatible aliases
  micro: "max-w-[420px]",
  sm: "max-w-[520px]",
  md: "max-w-[640px]",
  default: "max-w-[640px]",
  lg: "max-w-[820px]",
  "2xl": "max-w-[960px]",
};


/* -------------------------------------------------------------------------- */
/* SADAWindowOverlay                                                          */
/* -------------------------------------------------------------------------- */
export const SADAWindowOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/35 dark:bg-black/55 backdrop-blur-[2px]",
      "data-[state=open]:animate-[sada-overlay-in_120ms_ease-out] data-[state=closed]:animate-[sada-overlay-out_100ms_ease-in]",
      className
    )}
    {...props}
  />
));
SADAWindowOverlay.displayName = "SADAWindowOverlay";

/* -------------------------------------------------------------------------- */
/* SADAWindowHeader                                                           */
/* -------------------------------------------------------------------------- */
export interface SADAWindowHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export function SADAWindowHeader({
  icon,
  title,
  description,
  showCloseButton = true,
  onClose,
  className,
  children,
  ...props
}: SADAWindowHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border/60 bg-card shrink-0 select-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-3 sm:pr-4 rtl:pr-0 rtl:pl-3 rtl:sm:pl-4">
        {icon && (
          <div className="shrink-0 flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="space-y-0.5 min-w-0 text-left rtl:text-right">
          {title && (
            <DialogPrimitive.Title className="font-display font-bold text-base sm:text-lg text-foreground tracking-tight truncate leading-tight">
              {title}
            </DialogPrimitive.Title>
          )}
          {description && (
            <DialogPrimitive.Description className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
        </div>
      </div>

      {showCloseButton && (
        <DialogPrimitive.Close
          onClick={onClose}
          className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SADAWindowBody                                                             */
/* -------------------------------------------------------------------------- */
export interface SADAWindowBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SADAWindowBody({ className, children, ...props }: SADAWindowBodyProps) {
  return (
    <div
      className={cn(
        "overflow-y-auto overflow-x-hidden flex-1 px-4 py-3.5 sm:px-6 sm:py-5 min-h-0 sada-scrollbar",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SADAWindowFooter                                                           */
/* -------------------------------------------------------------------------- */
export interface SADAWindowFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SADAWindowFooter({ className, children, ...props }: SADAWindowFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-border/60 bg-muted/20 dark:bg-muted/10 shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SADAWindow (Root Container)                                                */
/* -------------------------------------------------------------------------- */
export interface SADAWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: SADAWindowSize;
  className?: string;
  children: React.ReactNode;
}

export function SADAWindow({
  open,
  onOpenChange,
  size = "standard",
  className,
  children,
}: SADAWindowProps) {
  const sizeClass = sadaWindowSizes[size] || sadaWindowSizes.standard;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <SADAWindowOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2.5rem)]",
            "bg-card text-card-foreground border border-border/80 dark:border-border/60 rounded-2xl shadow-elevated dark:shadow-2xl flex flex-col outline-none overflow-hidden",
            "max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(720px,calc(100dvh-3rem))]",
            "data-[state=open]:animate-[sada-dialog-in_120ms_ease-out] data-[state=closed]:animate-[sada-dialog-out_100ms_ease-in]",
            sizeClass,
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* SADADialog (Canonical Compound / High-Level Component)                     */
/* -------------------------------------------------------------------------- */
export interface SADADialogProps extends SADAWindowProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  showCloseButton?: boolean;
}

export function SADADialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
  footer,
  size = "standard",
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  showCloseButton = true,
}: SADADialogProps) {
  return (
    <SADAWindow open={open} onOpenChange={onOpenChange} size={size} className={className}>
      {(title || icon || showCloseButton) && (
        <SADAWindowHeader
          icon={icon}
          title={title}
          description={description}
          showCloseButton={showCloseButton}
          className={headerClassName}
        />
      )}
      <SADAWindowBody className={contentClassName}>{children}</SADAWindowBody>
      {footer && <SADAWindowFooter className={footerClassName}>{footer}</SADAWindowFooter>}
    </SADAWindow>
  );
}

// Re-export unified canonical SADAConfirmDialog
export {
  SADAConfirmDialog,
  SadaConfirmDialog,
  type SADAConfirmDialogProps,
} from "./sada-confirm-dialog";
