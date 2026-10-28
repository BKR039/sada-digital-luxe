import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADANumberStepperProps {
  label?: string;
  helperText?: string;
  error?: string | boolean;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  size?: "sm" | "compact" | "default" | "lg";
  /** Primary unit display (e.g. "reels", "posts", "TND", "hrs", "shoots", "ريلز", "د.ت") */
  unit?: string;
  /** Backward-compatible alias for unit */
  suffix?: string;
  prefix?: string;
  allowDirectInput?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  name?: string;
  dir?: "ltr" | "rtl" | "auto";
  "aria-label"?: string;
}

export type SADACounterProps = SADANumberStepperProps;
export type SadaNumberStepperProps = SADANumberStepperProps;
export type SadaCounterProps = SADANumberStepperProps;

const sizeConfig = {
  sm: {
    container: "h-8 min-h-[32px] px-1 text-xs",
    button: "size-6 min-w-[24px] min-h-[24px]",
    input: "text-xs font-bold",
    icon: "size-3",
    unit: "text-[11px]",
  },
  compact: {
    container: "h-8 min-h-[32px] px-1 text-xs",
    button: "size-6 min-w-[24px] min-h-[24px]",
    input: "text-xs font-bold",
    icon: "size-3",
    unit: "text-[11px]",
  },
  default: {
    container: "h-9.5 min-h-[38px] px-1 text-sm",
    button: "size-7 min-w-[28px] min-h-[28px]",
    input: "text-sm font-bold",
    icon: "size-3.5",
    unit: "text-xs",
  },
  lg: {
    container: "h-11 min-h-[44px] px-1.5 text-base",
    button: "size-8.5 min-w-[34px] min-h-[34px]",
    input: "text-base font-bold",
    icon: "size-4",
    unit: "text-sm",
  },
};

/**
 * SADA Universal Number Stepper / Counter Component
 * 
 * Standardized 3-zone flex layout:
 * ┌─────┬──────────────────────────┬─────┐
 * │ [−] │     200 TND              │ [+] │
 * └─────┴──────────────────────────┴─────┘
 * 
 * - Fixed-dimension minus & plus buttons (flex: 0 0 auto, no horizontal squeeze)
 * - Value area (flex: 1 1 auto, centered alignment, zero overflow clipping)
 * - Number (shrink-0, whitespace-nowrap, font-display tabular-nums, leading-none)
 * - Unit (shrink-0, whitespace-nowrap, optically balanced, zero overlap)
 * - 44px accessible touch target on mobile/tablet via pseudo-element expanders
 * - Direct keyboard & click input support with full selection on focus
 */
export const SADANumberStepper = React.forwardRef<HTMLInputElement, SADANumberStepperProps>(
  (
    {
      label,
      helperText,
      error,
      value: controlledValue,
      defaultValue = 0,
      onChange,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      step = 1,
      disabled = false,
      size = "default",
      unit,
      suffix,
      prefix,
      allowDirectInput = true,
      className,
      inputClassName,
      id,
      name,
      dir,
      "aria-label": ariaLabel = "Numeric stepper",
    },
    ref
  ) => {
    const displayUnit = unit ?? suffix;
    const isControlled = controlledValue !== undefined;
    const [internalVal, setInternalVal] = React.useState<number>(
      isControlled ? (controlledValue ?? defaultValue) : defaultValue
    );
    const [textInput, setTextInput] = React.useState<string>(
      String(isControlled ? (controlledValue ?? defaultValue) : defaultValue)
    );

    const currentVal = isControlled ? (controlledValue ?? 0) : internalVal;

    React.useEffect(() => {
      if (isControlled) {
        setTextInput(String(controlledValue ?? 0));
      }
    }, [isControlled, controlledValue]);

    const clamp = (val: number): number => {
      const clamped = Math.max(min, Math.min(max, val));
      if (step < 1) {
        const decimals = (String(step).split(".")[1] || "").length;
        return Number(clamped.toFixed(decimals));
      }
      return clamped;
    };

    const updateValue = (nextVal: number) => {
      if (disabled) return;
      const clamped = clamp(nextVal);
      if (!isControlled) {
        setInternalVal(clamped);
      }
      setTextInput(String(clamped));
      if (onChange) {
        onChange(clamped);
      }
    };

    const handleDecrement = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateValue(currentVal - step);
    };

    const handleIncrement = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateValue(currentVal + step);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setTextInput(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        if (!isControlled) {
          setInternalVal(parsed);
        }
        if (onChange) {
          onChange(parsed);
        }
      }
    };

    const handleBlur = () => {
      const parsed = parseFloat(textInput);
      if (isNaN(parsed)) {
        updateValue(min);
      } else {
        updateValue(parsed);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        updateValue(currentVal + step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        updateValue(currentVal - step);
      }
    };

    const isAtMin = currentVal <= min;
    const isAtMax = currentVal >= max;
    const currentConfig = sizeConfig[size] || sizeConfig.default;

    // Calculate dynamic character width for input with safe padding
    const inputCharLength = Math.max(1, String(textInput).length);

    const stepperNode = (
      <div
        className={cn(
          "inline-flex items-center justify-between w-full min-w-[110px] rounded-xl border border-border/80 dark:border-border/70",
          "bg-card/95 dark:bg-card/85 shadow-2xs backdrop-blur-xs transition-all duration-150",
          "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
          disabled && "opacity-50 pointer-events-none bg-muted/40",
          error && "border-destructive/80 focus-within:ring-destructive/20 focus-within:border-destructive",
          currentConfig.container,
          className
        )}
        dir={dir}
      >
        {/* Decrement Button (flex: 0 0 auto, fixed dimensions) */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isAtMin}
          onClick={handleDecrement}
          aria-label="Decrease quantity"
          className={cn(
            "relative flex-none shrink-0 inline-flex items-center justify-center rounded-lg text-muted-foreground",
            "border border-transparent transition-all duration-150 select-none",
            "hover:bg-muted/80 hover:text-foreground hover:border-border/50",
            "active:scale-90 active:bg-muted",
            "disabled:opacity-25 disabled:pointer-events-none disabled:active:scale-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            // 44px minimum touch target expander for accessibility
            "after:absolute after:-inset-2 after:content-['']",
            currentConfig.button
          )}
        >
          <Minus className={currentConfig.icon} strokeWidth={2.2} />
        </button>

        {/* Value + Unit Zone (Centered flex-auto container, zero overlap, no overflow clipping) */}
        <div className="flex-auto min-w-0 flex items-center justify-center gap-1.5 px-1 whitespace-nowrap">
          {prefix && (
            <span className="text-xs font-semibold text-muted-foreground/80 select-none shrink-0 whitespace-nowrap leading-normal">
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            id={id}
            name={name}
            value={textInput}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            disabled={disabled || !allowDirectInput}
            aria-label={ariaLabel}
            aria-valuenow={currentVal}
            aria-valuemin={min}
            aria-valuemax={max}
            style={{ width: `${Math.max(2, inputCharLength + 0.8)}ch` }}
            className={cn(
              "bg-transparent text-center text-foreground outline-none font-display font-bold tabular-nums select-all",
              "p-0 m-0 border-0 leading-normal shrink-0 whitespace-nowrap h-full flex items-center",
              "[field-sizing:content] min-w-[2ch]",
              "transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              currentConfig.input,
              inputClassName
            )}
          />

          {displayUnit && (
            <span
              className={cn(
                "font-semibold text-muted-foreground/80 select-none shrink-0 whitespace-nowrap leading-normal",
                currentConfig.unit
              )}
            >
              {displayUnit}
            </span>
          )}
        </div>

        {/* Increment Button (flex: 0 0 auto, fixed dimensions) */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isAtMax}
          onClick={handleIncrement}
          aria-label="Increase quantity"
          className={cn(
            "relative flex-none shrink-0 inline-flex items-center justify-center rounded-lg text-muted-foreground",
            "border border-transparent transition-all duration-150 select-none",
            "hover:bg-muted/80 hover:text-foreground hover:border-border/50",
            "active:scale-90 active:bg-muted",
            "disabled:opacity-25 disabled:pointer-events-none disabled:active:scale-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            // 44px minimum touch target expander for accessibility
            "after:absolute after:-inset-2 after:content-['']",
            currentConfig.button
          )}
        >
          <Plus className={currentConfig.icon} strokeWidth={2.2} />
        </button>
      </div>
    );

    if (label) {
      return (
        <div className="w-full space-y-1.5 text-left rtl:text-right">
          <label className="block text-xs font-bold text-foreground">
            {label}
          </label>
          {stepperNode}
          {helperText && (
            <p className="text-[11px] text-muted-foreground">{helperText}</p>
          )}
          {typeof error === "string" && (
            <p className="text-[11px] text-destructive font-medium">{error}</p>
          )}
        </div>
      );
    }

    return stepperNode;
  }
);

SADANumberStepper.displayName = "SADANumberStepper";

// Primary Aliases
export const SadaNumberStepper = SADANumberStepper;
export const SADACounter = SADANumberStepper;
export const SadaCounter = SADANumberStepper;
