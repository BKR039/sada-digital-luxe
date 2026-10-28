import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SADA OS Universal Button Component
 * Enforces canonical SADA branding, single-line horizontal alignment, interactive states,
 * loading feedback, and RTL symmetry.
 */
export const sadaButtonVariants = cva(
  "sada-button inline-flex items-center justify-center flex-row flex-nowrap font-medium transition-all duration-150 select-none whitespace-nowrap outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shrink-0 [&_svg]:shrink-0 [&_svg]:pointer-events-none [&_*]:whitespace-nowrap leading-none",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-primary text-white font-semibold shadow-xs hover:shadow-md hover:brightness-105 neon-glow",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40 shadow-2xs",
        outline:
          "border border-border bg-card/60 text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary shadow-2xs",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white shadow-2xs",
        luxury:
          "bg-card border border-border/80 text-foreground hover:border-primary/40 hover:bg-card/90 shadow-2xs elevated-shadow hover:scale-[1.01]",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto font-normal",
      },
      size: {
        xs: "h-7 px-3 text-[11px] rounded-lg gap-1.5",
        sm: "h-8 px-3.5 text-xs rounded-xl gap-1.5",
        default: "h-9 px-4 py-2 text-xs sm:text-sm rounded-xl gap-2",
        lg: "h-11 px-5 py-2.5 text-sm sm:text-base rounded-2xl gap-2.5",
        icon: "size-9 rounded-xl p-0 grid place-items-center shrink-0",
        "icon-sm": "size-7.5 rounded-lg p-0 grid place-items-center shrink-0",
        "icon-xs": "size-6 rounded-md p-0 grid place-items-center shrink-0 text-xs",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface SADAButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sadaButtonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const SADAButton = React.forwardRef<HTMLButtonElement, SADAButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          className={cn(sadaButtonVariants({ variant, size, fullWidth, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(sadaButtonVariants({ variant, size, fullWidth, className }))}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-3.5 animate-spin shrink-0" />
            <span className="inline-flex items-center whitespace-nowrap shrink-0">{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0 inline-flex items-center">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0 inline-flex items-center">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

SADAButton.displayName = "SADAButton";
