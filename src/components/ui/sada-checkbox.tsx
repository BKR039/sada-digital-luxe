import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADACheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: boolean;
  size?: "sm" | "default" | "lg";
  shape?: "square" | "circle";
  containerClassName?: string;
  labelClassName?: string;
}

const sizeConfig = {
  sm: {
    squareBox: "size-4.5 rounded-md",
    circleBox: "size-5 rounded-full",
    check: "size-3",
    label: "text-xs",
    desc: "text-[11px]",
  },
  default: {
    squareBox: "size-5 rounded-lg",
    circleBox: "size-5.5 rounded-full",
    check: "size-3.5",
    label: "text-sm",
    desc: "text-xs",
  },
  lg: {
    squareBox: "size-6 rounded-xl",
    circleBox: "size-6.5 rounded-full",
    check: "size-4",
    label: "text-base font-semibold",
    desc: "text-sm",
  },
};

/**
 * SADA OS Universal Checkbox Component
 * 100% replaces native <input type="checkbox"> across all forms, filters, and tables.
 * Accessible Radix primitive, clickable labels, keyboard navigation, and unmistakable SADA primary blue styling.
 * Supports square (form/table) and circular (task/subtask completion) shapes, and indeterminate states.
 */
export const SADACheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  SADACheckboxProps
>(
  (
    {
      className,
      containerClassName,
      labelClassName,
      label,
      description,
      error = false,
      size = "default",
      shape = "square",
      disabled = false,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;
    const currentSize = sizeConfig[size];
    const boxShapeClass = shape === "circle" ? currentSize.circleBox : currentSize.squareBox;

    const boxMarkup = (
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        disabled={disabled}
        className={cn(
          "peer shrink-0 grid place-content-center border-2 transition-all duration-150 outline-none select-none",
          // High-contrast Unchecked state
          "border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary hover:bg-muted/30",
          // Accessible Focus Ring
          "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:border-slate-300 dark:disabled:border-slate-700",
          // Unmistakable Checked state: Solid SADA primary blue surface, crisp contrast in light & dark mode
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-white data-[state=checked]:shadow-xs",
          // Indeterminate state: Solid primary surface with horizontal dash
          "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-white data-[state=indeterminate]:shadow-xs",
          error && "border-destructive focus-visible:ring-destructive/40",
          boxShapeClass,
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn(
            "grid place-content-center text-white transition-transform duration-150 data-[state=checked]:scale-100 data-[state=indeterminate]:scale-100 data-[state=unchecked]:scale-0"
          )}
        >
          {props.checked === "indeterminate" ? (
            <Minus className={cn("stroke-[3] text-white", currentSize.check)} />
          ) : (
            <Check className={cn("stroke-[3] text-white", currentSize.check)} />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );

    if (!label && !description) {
      return boxMarkup;
    }

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-start gap-2.5 cursor-pointer select-none group",
          disabled && "cursor-not-allowed opacity-50",
          containerClassName
        )}
      >
        <div className="pt-0.5">{boxMarkup}</div>
        <div className="flex flex-col leading-tight">
          {label && (
            <span
              className={cn(
                "font-medium text-foreground group-hover:text-primary transition-colors",
                currentSize.label,
                labelClassName
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span className={cn("text-muted-foreground mt-0.5", currentSize.desc)}>
              {description}
            </span>
          )}
        </div>
      </label>
    );
  }
);

SADACheckbox.displayName = "SADACheckbox";

// Alias for TitleCase naming requirement
export const SadaCheckbox = SADACheckbox;
