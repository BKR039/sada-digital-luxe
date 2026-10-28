import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADARadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SADARadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  options?: SADARadioOption[];
  variant?: "default" | "cards";
  orientation?: "horizontal" | "vertical";
  error?: boolean;
}

/**
 * SADA OS Universal Radio Group Component
 * Standardized single-option selector supporting both inline/list and card presentation.
 */
export const SADARadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  SADARadioGroupProps
>(
  (
    {
      className,
      options,
      children,
      variant = "default",
      orientation = "vertical",
      error = false,
      ...props
    },
    ref
  ) => {
    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        orientation={orientation}
        className={cn(
          "grid gap-2.5",
          orientation === "horizontal" && "grid-flow-col auto-cols-fr",
          className
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <SADARadioItem
                key={opt.value}
                value={opt.value}
                label={opt.label}
                description={opt.description}
                badge={opt.badge}
                disabled={opt.disabled}
                variant={variant}
                error={error}
              />
            ))
          : children}
      </RadioGroupPrimitive.Root>
    );
  }
);

SADARadioGroup.displayName = "SADARadioGroup";

export interface SADARadioItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: "default" | "cards";
  error?: boolean;
}

export const SADARadioItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  SADARadioItemProps
>(
  (
    {
      className,
      value,
      label,
      description,
      badge,
      variant = "default",
      error = false,
      disabled = false,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;

    const circleMarkup = (
      <RadioGroupPrimitive.Item
        ref={ref}
        id={id}
        value={value}
        disabled={disabled}
        className={cn(
          "aspect-square size-5 rounded-full border-2 transition-all duration-150 outline-none select-none shrink-0 grid place-content-center",
          // High-contrast Unchecked state
          "border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary hover:bg-muted/30",
          // Accessible Focus Ring
          "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:border-slate-300 dark:disabled:border-slate-700",
          // Unmistakable Checked state: solid primary outer ring
          "data-[state=checked]:border-primary data-[state=checked]:bg-background dark:data-[state=checked]:bg-card data-[state=checked]:shadow-2xs",
          error && "border-destructive focus-visible:ring-destructive/40",
          className
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="grid place-content-center">
          <div className="size-2.5 rounded-full bg-primary" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
    );

    if (variant === "cards") {
      return (
        <label
          htmlFor={id}
          className={cn(
            "relative flex items-start gap-3 p-3.5 rounded-2xl border border-border/80 bg-card/60 shadow-2xs cursor-pointer select-none transition-all duration-150",
            "hover:border-primary/40 hover:bg-card",
            "has-[:checked]:border-primary has-[:checked]:bg-primary/[0.03] has-[:checked]:shadow-xs",
            disabled && "cursor-not-allowed opacity-50 pointer-events-none"
          )}
        >
          <div className="pt-0.5">{circleMarkup}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-foreground">{label}</span>
              {badge && <span className="shrink-0">{badge}</span>}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </label>
      );
    }

    if (!label && !description) {
      return circleMarkup;
    }

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-start gap-2.5 cursor-pointer select-none group",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="pt-0.5">{circleMarkup}</div>
        <div className="flex flex-col leading-tight">
          {label && (
            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-muted-foreground mt-0.5">{description}</span>
          )}
        </div>
      </label>
    );
  }
);

SADARadioItem.displayName = "SADARadioItem";

// Aliases for TitleCase naming requirements
export const SadaRadioGroup = SADARadioGroup;
export const SadaRadio = SADARadioItem;
