import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronDown, Search, X, Users, User, Loader2, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatCurrency } from "@/lib/utils";
import {
  SADA_CONTROL_BASE,
  SADA_CONTROL_SIZES,
  SADA_POPOVER_BASE,
  SADA_ITEM_BASE,
  type SADAControlSize,
} from "./sada-controls";

export interface SADAComboboxOption {
  value: string;
  label: string;
  subtitle?: string | null;
  category?: string | null;
  price?: string | number | null;
  margin?: string | number | null;
  code?: string | null;
  avatar?: string | null;
  initials?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: string | null;
  badgeVariant?: "primary" | "success" | "warning" | "default" | "luxury";
  isPopular?: boolean;
  isRecommended?: boolean;
}

export interface SADAComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  options: SADAComboboxOption[];
  allOption?: {
    value: string;
    label: string;
    icon?: React.ReactNode;
  };
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  size?: SADAControlSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  error?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  id?: string;
  "aria-label"?: string;
}

function getFallbackInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function SADACombobox({
  value = "",
  onChange,
  options,
  allOption,
  placeholder = "Select an option...",
  searchPlaceholder = "Search options...",
  emptyText = "No results found.",
  size = "default",
  icon,
  disabled = false,
  isLoading = false,
  error = false,
  clearable = false,
  className,
  triggerClassName,
  contentClassName,
  id,
  "aria-label": ariaLabel,
}: SADAComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedOption: SADAComboboxOption | null = React.useMemo(() => {
    if (allOption && allOption.value === value) {
      return {
        value: allOption.value,
        label: allOption.label,
        icon: allOption.icon || <Users className="size-3.5 text-primary" />,
      };
    }
    return options.find((opt) => opt.value === value) || null;
  }, [value, options, allOption]);

  const categories = React.useMemo(() => {
    const hasAnyCategory = options.some((o) => Boolean(o.category));
    if (!hasAnyCategory) return null;
    const map = new Map<string, SADAComboboxOption[]>();
    for (const opt of options) {
      const cat = opt.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(opt);
    }
    return map;
  }, [options]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const renderOptionItem = (opt: SADAComboboxOption) => {
    const isSelected = value === opt.value;
    const searchTerms = `${opt.label} ${opt.code || ""} ${opt.subtitle || ""} ${opt.category || ""}`;

    return (
      <CommandPrimitive.Item
        key={opt.value}
        value={searchTerms}
        disabled={opt.disabled}
        onSelect={() => handleSelect(opt.value)}
        className={cn(
          SADA_ITEM_BASE,
          "justify-between p-2 rounded-xl",
          isSelected && "bg-primary/10 text-primary font-semibold"
        )}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
          {opt.avatar !== undefined ? (
            <Avatar className="size-6 shrink-0 border border-border">
              {opt.avatar && <AvatarImage src={opt.avatar} alt={opt.label} />}
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                {opt.initials || getFallbackInitials(opt.label)}
              </AvatarFallback>
            </Avatar>
          ) : opt.icon ? (
            <span className="shrink-0">{opt.icon}</span>
          ) : null}

          {opt.code && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted/80 text-foreground shrink-0 border border-border">
              {opt.code}
            </span>
          )}

          <div className="truncate min-w-0 flex-1">
            <div className="truncate text-foreground font-medium text-xs sm:text-sm">
              {opt.label}
            </div>
            {opt.subtitle && (
              <div className="truncate text-[10px] text-muted-foreground font-normal">
                {opt.subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ps-2">
          {opt.price !== undefined && opt.price !== null && (
            <span className="text-xs font-display font-semibold text-foreground tabular-nums">
              {typeof opt.price === "number" ? formatCurrency(opt.price) : opt.price}
            </span>
          )}

          {opt.margin !== undefined && opt.margin !== null && (
            <span className="text-[10px] font-display text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 tabular-nums hidden sm:inline">
              {typeof opt.margin === "number" ? `${opt.margin}%` : opt.margin}
            </span>
          )}

          {opt.badge && (
            <span
              className={cn(
                "text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 border",
                opt.badgeVariant === "primary"
                  ? "bg-primary/10 text-primary border-primary/25"
                  : opt.badgeVariant === "success"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {opt.badge}
            </span>
          )}

          {isSelected && (
            <Check className="size-4 text-primary shrink-0" />
          )}
        </div>
      </CommandPrimitive.Item>
    );
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled || isLoading}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel || placeholder}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            SADA_CONTROL_BASE,
            SADA_CONTROL_SIZES[size],
            error && "border-destructive text-destructive focus:ring-destructive/30",
            triggerClassName,
            className
          )}
        >
          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span>Loading options...</span>
              </div>
            ) : selectedOption ? (
              <div className="flex items-center gap-2 truncate min-w-0">
                {selectedOption.avatar !== undefined ? (
                  <Avatar className="size-5 shrink-0 border border-border">
                    {selectedOption.avatar && (
                      <AvatarImage src={selectedOption.avatar} alt={selectedOption.label} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                      {selectedOption.initials || getFallbackInitials(selectedOption.label)}
                    </AvatarFallback>
                  </Avatar>
                ) : selectedOption.icon ? (
                  <span className="shrink-0">{selectedOption.icon}</span>
                ) : icon ? (
                  <span className="shrink-0 text-muted-foreground">{icon}</span>
                ) : null}

                {selectedOption.code && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted/80 text-foreground shrink-0 border border-border">
                    {selectedOption.code}
                  </span>
                )}

                <span className="truncate text-foreground font-semibold">{selectedOption.label}</span>

                {selectedOption.price !== undefined && selectedOption.price !== null && (
                  <span className="text-xs font-display font-semibold text-primary shrink-0 tabular-nums">
                    · {typeof selectedOption.price === "number" ? formatCurrency(selectedOption.price) : selectedOption.price}
                  </span>
                )}

                {selectedOption.subtitle && !selectedOption.price && (
                  <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                    · {selectedOption.subtitle}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate text-muted-foreground">
                {icon && <span className="shrink-0">{icon}</span>}
                <span className="truncate font-normal">{placeholder}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ms-2">
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="size-4 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear selection"
              >
                <X className="size-3" />
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180 text-foreground"
              )}
            />
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            SADA_POPOVER_BASE,
            "w-[var(--radix-popover-trigger-width)] min-w-[18rem] max-w-[28rem] p-0 z-[100]",
            contentClassName
          )}
        >
          <CommandPrimitive className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground">
            {/* Search Input */}
            <div className="flex items-center border-b border-border px-3 py-2">
              <Search className="me-2 size-3.5 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder={searchPlaceholder}
                className="flex h-7 w-full rounded-md bg-transparent text-xs sm:text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* List */}
            <CommandPrimitive.List className="max-h-72 overflow-y-auto overflow-x-hidden p-1.5 space-y-0.5">
              <CommandPrimitive.Empty className="py-6 text-center text-xs text-muted-foreground">
                {emptyText}
              </CommandPrimitive.Empty>

              {/* Optional All Option */}
              {allOption && (
                <CommandPrimitive.Item
                  value={allOption.label}
                  onSelect={() => handleSelect(allOption.value)}
                  className={cn(
                    SADA_ITEM_BASE,
                    "justify-between font-semibold",
                    value === allOption.value && "bg-primary/10 text-primary font-bold"
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {allOption.icon || <Users className="size-4 text-primary shrink-0" />}
                    <span className="truncate">{allOption.label}</span>
                  </div>
                  {value === allOption.value && (
                    <Check className="size-4 text-primary shrink-0 ms-2" />
                  )}
                </CommandPrimitive.Item>
              )}

              {/* Categorized Options vs Flat Options */}
              {categories ? (
                Array.from(categories.entries()).map(([catName, groupOpts]) => (
                  <CommandPrimitive.Group
                    key={catName}
                    heading={catName}
                    className="px-1 py-1 text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-primary/80 [&_[cmdk-group-heading]]:tracking-wider"
                  >
                    {groupOpts.map(renderOptionItem)}
                  </CommandPrimitive.Group>
                ))
              ) : (
                options.map(renderOptionItem)
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
