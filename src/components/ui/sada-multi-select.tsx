import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SADA_CONTROL_BASE, SADA_CONTROL_SIZES, SADA_POPOVER_BASE } from "./sada-controls";
import { SADABadge } from "./sada-badge";

export interface SADAMultiSelectOption {
  value: string;
  label: string;
  badge?: string;
}

export interface SADAMultiSelectProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  options: SADAMultiSelectOption[];
  placeholder?: string;
  size?: "compact" | "default" | "lg";
  disabled?: boolean;
  error?: boolean;
  maxDisplay?: number;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

/**
 * SADA OS Universal Multi-Select Component
 * Allows selecting multiple options with searchable filter list, interactive chips, and bulk clear.
 */
export function SADAMultiSelect({
  value: controlledValue,
  defaultValue = [],
  onChange,
  options,
  placeholder = "Select options...",
  size = "default",
  disabled = false,
  error = false,
  maxDisplay = 2,
  className,
  id,
  name,
  "aria-label": ariaLabel = "Multi-select",
}: SADAMultiSelectProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState<string[]>(
    isControlled ? controlledValue : defaultValue
  );
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const currentValues = isControlled ? controlledValue : internalValue;

  const handleToggle = (val: string) => {
    let next: string[];
    if (currentValues.includes(val)) {
      next = currentValues.filter((v) => v !== val);
    } else {
      next = [...currentValues, val];
    }
    if (!isControlled) {
      setInternalValue(next);
    }
    if (onChange) {
      onChange(next);
    }
  };

  const handleRemove = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    const next = currentValues.filter((v) => v !== val);
    if (!isControlled) {
      setInternalValue(next);
    }
    if (onChange) {
      onChange(next);
    }
  };

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, query]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        name={name}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          SADA_CONTROL_BASE,
          SADA_CONTROL_SIZES[size],
          "h-auto min-h-[38px] py-1.5 flex-wrap gap-1.5",
          error && "border-destructive text-destructive focus:ring-destructive/30",
          className
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {currentValues.length === 0 ? (
            <span className="text-muted-foreground font-normal">{placeholder}</span>
          ) : (
            <>
              {currentValues.slice(0, maxDisplay).map((val) => {
                const opt = options.find((o) => o.value === val);
                return (
                  <SADABadge
                    key={val}
                    variant="neutral"
                    size="sm"
                    className="gap-1 font-medium bg-muted/80 hover:bg-muted"
                  >
                    <span>{opt ? opt.label : val}</span>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => handleRemove(e, val)}
                      className="hover:text-destructive transition-colors ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </SADABadge>
                );
              })}
              {currentValues.length > maxDisplay && (
                <SADABadge variant="outline" size="sm">
                  +{currentValues.length - maxDisplay} more
                </SADABadge>
              )}
            </>
          )}
        </div>

        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          className={cn(
            SADA_POPOVER_BASE,
            "w-[var(--radix-popover-trigger-width)] min-w-[240px] max-h-72 p-1.5"
          )}
        >
          {/* Search filter */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/60 mb-1">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          <div className="overflow-y-auto max-h-52 p-0.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No options found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = currentValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggle(opt.value)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted/70"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// Alias for TitleCase naming requirements
export const SadaMultiSelect = SADAMultiSelect;
