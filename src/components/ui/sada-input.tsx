import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADAInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  helperText?: string;
  error?: string | boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  size?: "sm" | "compact" | "default" | "lg";
  containerClassName?: string;
  labelClassName?: string;
}

export const SADAInput = React.forwardRef<HTMLInputElement, SADAInputProps>(
  (
    {
      className,
      containerClassName,
      labelClassName,
      label,
      helperText,
      error,
      startIcon,
      endIcon,
      prefix,
      suffix,
      clearable = false,
      onClear,
      size = "default",
      disabled,
      required,
      id,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `sada-input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
    const hasError = Boolean(error);
    const errorMessage = typeof error === "string" ? error : undefined;

    const leading = prefix || startIcon;
    const trailing = suffix || endIcon;

    const sizeClasses = {
      sm: "h-8 text-xs px-2.5 rounded-lg",
      compact: "h-8 text-xs px-2.5 rounded-xl",
      default: "h-9 text-xs sm:text-sm px-3 rounded-xl",
      lg: "h-11 text-sm sm:text-base px-3.5 rounded-2xl",
    }[size];

    return (
      <div className={cn("w-full space-y-1.5 text-left rtl:text-right", containerClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={inputId}
              className={cn(
                "block text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground",
                disabled && "opacity-50",
                labelClassName
              )}
            >
              {label}
              {required && <span className="text-destructive ml-1 rtl:mr-1">*</span>}
            </label>
          </div>
        )}

        <div className="relative flex items-center w-full">
          {leading && (
            <span className="absolute start-3 pointer-events-none text-muted-foreground font-mono text-xs font-semibold shrink-0 z-10">
              {leading}
            </span>
          )}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            value={value}
            onChange={onChange}
            className={cn(
              "w-full bg-background border text-foreground placeholder:text-muted-foreground",
              "transition-all duration-150 outline-none",
              "border-border shadow-2xs",
              "hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/35",
              hasError && "border-destructive focus:border-destructive focus:ring-destructive/30",
              disabled && "cursor-not-allowed opacity-50 bg-muted/40",
              leading && "ps-11",
              (trailing || (clearable && value)) && "pe-9",
              sizeClasses,
              className
            )}
            aria-invalid={hasError}
            {...props}
          />

          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute end-3 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
              aria-label="Clear input"
            >
              <X className="size-3.5" />
            </button>
          )}

          {trailing && !clearable && (
            <span className="absolute end-3 pointer-events-none text-muted-foreground font-mono text-xs font-semibold shrink-0">
              {trailing}
            </span>
          )}
        </div>

        {errorMessage && (
          <p className="text-[11px] text-destructive font-medium animate-in fade-in-50">
            {errorMessage}
          </p>
        )}

        {!errorMessage && helperText && (
          <p className="text-[11px] text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

SADAInput.displayName = "SADAInput";

export interface SADATextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string | boolean;
  containerClassName?: string;
  labelClassName?: string;
}

export const SADATextarea = React.forwardRef<HTMLTextAreaElement, SADATextareaProps>(
  (
    {
      className,
      containerClassName,
      labelClassName,
      label,
      helperText,
      error,
      disabled,
      required,
      id,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `sada-textarea-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
    const hasError = Boolean(error);
    const errorMessage = typeof error === "string" ? error : undefined;

    return (
      <div className={cn("w-full space-y-1.5 text-left rtl:text-right", containerClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={inputId}
              className={cn(
                "block text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground",
                disabled && "opacity-50",
                labelClassName
              )}
            >
              {label}
              {required && <span className="text-destructive ml-1 rtl:mr-1">*</span>}
            </label>
          </div>
        )}

        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          disabled={disabled}
          className={cn(
            "w-full bg-background border text-foreground placeholder:text-muted-foreground",
            "p-3 rounded-xl text-xs sm:text-sm transition-all duration-150 outline-none",
            "border-border shadow-2xs resize-y",
            "hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/35",
            hasError && "border-destructive focus:border-destructive focus:ring-destructive/30",
            disabled && "cursor-not-allowed opacity-50 bg-muted/40",
            className
          )}
          aria-invalid={hasError}
          {...props}
        />

        {errorMessage && (
          <p className="text-[11px] text-destructive font-medium animate-in fade-in-50">
            {errorMessage}
          </p>
        )}

        {!errorMessage && helperText && (
          <p className="text-[11px] text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

SADATextarea.displayName = "SADATextarea";
