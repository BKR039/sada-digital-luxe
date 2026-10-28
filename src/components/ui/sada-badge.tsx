import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const sadaBadgeVariants = cva(
  "inline-flex items-center font-mono uppercase tracking-wider font-bold border transition-colors select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary/10 text-primary border-primary/25",
        success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
        danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
        sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
        purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
        neutral: "bg-muted text-muted-foreground border-border",
        outline: "border-border text-foreground bg-transparent",
        luxury: "bg-card border-primary/30 text-primary shadow-2xs",
      },
      size: {
        xs: "text-[9px] px-1.5 py-0.5 rounded gap-1",
        sm: "text-[10px] px-2 py-0.5 rounded-md gap-1.5",
        default: "text-[11px] px-2.5 py-1 rounded-lg gap-1.5",
        lg: "text-xs px-3 py-1.5 rounded-xl gap-2",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  }
);

export interface SADABadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof sadaBadgeVariants> {
  dot?: boolean;
  pulse?: boolean;
  icon?: React.ReactNode;
}

export function SADABadge({
  className,
  variant,
  size,
  dot = false,
  pulse = false,
  icon,
  children,
  ...props
}: SADABadgeProps) {
  const dotColorClass = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    sky: "bg-sky-500",
    purple: "bg-purple-500",
    neutral: "bg-muted-foreground",
    outline: "bg-foreground",
    luxury: "bg-primary",
  }[variant || "neutral"];

  return (
    <span
      className={cn(sadaBadgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span className="relative flex size-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                dotColorClass
              )}
            />
          )}
          <span className={cn("relative inline-flex rounded-full size-1.5", dotColorClass)} />
        </span>
      )}
      {icon && <span className="shrink-0 inline-flex">{icon}</span>}
      {children}
    </span>
  );
}
