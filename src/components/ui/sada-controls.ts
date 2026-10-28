import { cn } from "@/lib/utils";

/**
 * SADA OS Universal Control System — Centralized Design Tokens
 * Source of truth for all form and input controls:
 * SadaButton, SadaSwitch, SadaCheckbox, SadaRadio, SadaNumberStepper,
 * SadaSelect, SadaCombobox, SadaDatePicker, SadaInput, SadaTextarea.
 */

export const CONTROL_HEIGHT = {
  sm: "h-8",
  compact: "h-8",
  default: "h-9.5",
  lg: "h-11",
} as const;

export const CONTROL_RADIUS = {
  sm: "rounded-lg",
  compact: "rounded-xl",
  default: "rounded-xl",
  lg: "rounded-2xl",
} as const;

export const CONTROL_BORDER = "border border-border/80 dark:border-border/70";
export const CONTROL_BACKGROUND = "bg-card/95 dark:bg-card/85 backdrop-blur-xs";
export const CONTROL_TEXT = "text-foreground font-sans";
export const CONTROL_MUTED = "text-muted-foreground";
export const CONTROL_FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary focus-visible:ring-offset-1";
export const CONTROL_HOVER = "hover:border-primary/40 hover:bg-muted/20";
export const CONTROL_DISABLED = "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";
export const CONTROL_ACTIVE = "active:scale-[0.99] transition-transform";

export const SADA_CONTROL_BASE = cn(
  "inline-flex w-full items-center justify-between text-start font-medium transition-all duration-150",
  CONTROL_BORDER,
  CONTROL_BACKGROUND,
  CONTROL_TEXT,
  "shadow-2xs",
  CONTROL_HOVER,
  CONTROL_FOCUS,
  CONTROL_DISABLED,
  "aria-invalid:border-destructive aria-invalid:focus:ring-destructive/30"
);

export const SADA_CONTROL_SIZES = {
  compact: "h-8 px-2.5 py-1 text-xs rounded-lg gap-1.5",
  default: "h-9 px-3 py-1.5 text-xs sm:text-sm rounded-xl gap-2",
  lg: "h-10 px-3.5 py-2 text-sm rounded-xl gap-2.5",
} as const;

export type SADAControlSize = keyof typeof SADA_CONTROL_SIZES;

export const SADA_POPOVER_BASE = cn(
  "z-[100] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl",
  "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
);

export const SADA_ITEM_BASE = cn(
  "relative flex w-full cursor-pointer select-none items-center rounded-xl px-2.5 py-2 text-xs sm:text-sm outline-none transition-colors",
  "text-foreground hover:bg-primary/10 hover:text-primary",
  "focus:bg-primary/10 focus:text-primary",
  "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
  "data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary data-[selected=true]:font-semibold"
);

export const SADA_PORTAL_CONTAINER = "z-[100]";
