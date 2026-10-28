import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SADA_CONTROL_BASE,
  SADA_CONTROL_SIZES,
  SADA_POPOVER_BASE,
  SADA_ITEM_BASE,
  type SADAControlSize,
} from "./sada-controls";

const EMPTY_VALUE_SENTINEL = "__sada_empty_val__";

export interface SADASelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface SADASelectGroup {
  label?: string;
  options: SADASelectOption[];
}

export interface SADASelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options?: SADASelectOption[];
  groups?: SADASelectGroup[];
  placeholder?: string;
  size?: SADAControlSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
}

export function SADASelect({
  value,
  defaultValue,
  onChange,
  options = [],
  groups,
  placeholder = "Select...",
  size = "default",
  icon,
  disabled = false,
  error = false,
  required = false,
  name,
  id,
  className,
  triggerClassName,
  contentClassName,
  children,
  "aria-label": ariaLabel,
}: SADASelectProps) {
  // Map internal empty string to sentinel
  const internalValue = value !== undefined
    ? (value === "" ? EMPTY_VALUE_SENTINEL : value)
    : undefined;

  const internalDefaultValue = defaultValue !== undefined
    ? (defaultValue === "" ? EMPTY_VALUE_SENTINEL : defaultValue)
    : undefined;

  const handleValueChange = (val: string) => {
    if (!onChange) return;
    onChange(val === EMPTY_VALUE_SENTINEL ? "" : val);
  };

  // Find label for active item
  const allOptions = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap(g => g.options);
    }
    return options;
  }, [options, groups]);

  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <SelectPrimitive.Root
      value={internalValue}
      defaultValue={internalDefaultValue}
      onValueChange={handleValueChange}
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          SADA_CONTROL_BASE,
          SADA_CONTROL_SIZES[size],
          error && "border-destructive text-destructive focus:ring-destructive/30",
          triggerClassName,
          className
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <SelectPrimitive.Value placeholder={<span className="text-muted-foreground font-normal">{placeholder}</span>}>
            {(() => {
              const currentVal = value !== undefined ? value : defaultValue;
              const found = allOptions.find(o => o.value === currentVal);
              if (found) {
                return (
                  <span className="flex items-center gap-2 truncate">
                    {found.icon && <span className="shrink-0">{found.icon}</span>}
                    <span className="truncate">{found.label}</span>
                  </span>
                );
              }
              return null;
            })()}
          </SelectPrimitive.Value>
        </div>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            SADA_POPOVER_BASE,
            "min-w-[var(--radix-select-trigger-width)] max-h-72 p-1.5",
            contentClassName
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-muted-foreground">
            <ChevronUp className="size-3.5" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-0.5">
            {children ? (
              children
            ) : groups && groups.length > 0 ? (
              groups.map((group, gIdx) => (
                <SelectPrimitive.Group key={gIdx} className="space-y-0.5">
                  {group.label && (
                    <SelectPrimitive.Label className="px-2.5 py-1 text-[10px] font-mono uppercase font-bold tracking-wider text-muted-foreground">
                      {group.label}
                    </SelectPrimitive.Label>
                  )}
                  {group.options.map((opt) => renderOptionItem(opt, value))}
                  {gIdx < groups.length - 1 && (
                    <SelectPrimitive.Separator className="my-1 h-px bg-border/60" />
                  )}
                </SelectPrimitive.Group>
              ))
            ) : (
              options.map((opt) => renderOptionItem(opt, value))
            )}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-muted-foreground">
            <ChevronDown className="size-3.5" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function renderOptionItem(opt: SADASelectOption, currentValue?: string) {
  const itemVal = opt.value === "" ? EMPTY_VALUE_SENTINEL : opt.value;
  const isSelected = currentValue !== undefined && (currentValue === opt.value);

  return (
    <SelectPrimitive.Item
      key={itemVal}
      value={itemVal}
      disabled={opt.disabled}
      className={cn(
        SADA_ITEM_BASE,
        "justify-between",
        isSelected && "bg-primary/10 text-primary font-semibold"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
        <SelectPrimitive.ItemText>
          <span className="truncate">{opt.label}</span>
        </SelectPrimitive.ItemText>
        {opt.description && (
          <span className="text-[10px] text-muted-foreground truncate ml-1 font-normal">
            ({opt.description})
          </span>
        )}
      </div>

      <SelectPrimitive.ItemIndicator className="shrink-0 ml-2">
        <Check className="size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
