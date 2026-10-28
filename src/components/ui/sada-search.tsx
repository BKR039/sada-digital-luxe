import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SADASearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  size?: "compact" | "default" | "lg";
  shortcut?: string;
}

export const SADASearch = React.forwardRef<HTMLInputElement, SADASearchProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = "Search...",
      loading = false,
      size = "default",
      shortcut,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      onClear?.();
    };

    const sizeClasses = {
      compact: "h-9 text-xs px-8.5 rounded-xl",
      default: "h-11 text-sm px-10 rounded-2xl",
      lg: "h-13 text-base px-11 rounded-2xl",
    }[size];

    const iconSizes = {
      compact: "size-3.5",
      default: "size-4",
      lg: "size-5",
    }[size];

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <span
          className={cn(
            "absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground transition-colors",
            loading ? "animate-spin" : ""
          )}
        >
          {loading ? (
            <Loader2 className={iconSizes} />
          ) : (
            <Search className={iconSizes} />
          )}
        </span>

        <input
          ref={ref}
          type="search"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-card/60 backdrop-blur-xs border border-border/80 text-foreground placeholder:text-muted-foreground/70",
            "focus:outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/15 transition-all shadow-xs",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "rtl:text-right font-sans",
            sizeClasses
          )}
          {...props}
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="size-3" />
          </button>
        ) : shortcut ? (
          <kbd className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 bg-muted/50 border border-border/60 rounded pointer-events-none">
            {shortcut}
          </kbd>
        ) : null}
      </div>
    );
  }
);

SADASearch.displayName = "SADASearch";
export const SadaSearch = SADASearch;
