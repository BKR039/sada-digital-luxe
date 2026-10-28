import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { format, parseISO, isValid } from "date-fns";
import { formatDate, getActiveLanguage } from "@/lib/date-locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  SADA_CONTROL_BASE,
  SADA_CONTROL_SIZES,
  SADA_POPOVER_BASE,
  type SADAControlSize,
} from "./sada-controls";

export interface SADADatePickerProps {
  value?: string | Date | null;
  onChange?: (dateString: string) => void;
  placeholder?: string;
  size?: SADAControlSize;
  disabled?: boolean;
  error?: boolean;
  clearable?: boolean;
  minDate?: Date;
  maxDate?: Date;
  name?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
}

export function SADADatePicker({
  value,
  onChange,
  placeholder = "Select date...",
  size = "default",
  disabled = false,
  error = false,
  clearable = true,
  minDate,
  maxDate,
  name,
  id,
  className,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel,
}: SADADatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert incoming value (string or Date) into a valid Date object for Calendar
  const parsedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    try {
      // Handles 'YYYY-MM-DD' or ISO strings
      const d = parseISO(value);
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  const handleSelectDate = (date: Date | undefined) => {
    if (!onChange) return;
    if (!date) {
      onChange("");
    } else {
      // Standard ISO 'YYYY-MM-DD'
      const isoDate = format(date, "yyyy-MM-dd");
      onChange(isoDate);
    }
    setOpen(false);
  };

  const handleSelectToday = () => {
    handleSelectDate(new Date());
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) onChange("");
  };

  const isArabic = getActiveLanguage() === "ar";
  const formattedDisplay = parsedDate ? formatDate(parsedDate, "d MMM yyyy") : null;
  const activePlaceholder = placeholder || (isArabic ? "اختر التاريخ..." : "Select date...");

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel || activePlaceholder}
          aria-expanded={open}
          className={cn(
            SADA_CONTROL_BASE,
            SADA_CONTROL_SIZES[size],
            error && "border-destructive text-destructive focus:ring-destructive/30",
            triggerClassName,
            className
          )}
        >
          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            {formattedDisplay ? (
              <span className="truncate font-semibold text-foreground">{formattedDisplay}</span>
            ) : (
              <span className="truncate text-muted-foreground font-normal">{activePlaceholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ms-2">
            {clearable && parsedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="size-4 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={isArabic ? "مسح التاريخ" : "Clear date"}
              >
                <X className="size-3" />
              </span>
            )}
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      {/* Hidden input for native form compatibility if name is provided */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={parsedDate ? format(parsedDate, "yyyy-MM-dd") : ""}
        />
      )}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            SADA_POPOVER_BASE,
            "w-auto p-3 z-[100]",
            contentClassName
          )}
        >
          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={handleSelectDate}
            disabled={(d) => {
              if (minDate && d < minDate) return true;
              if (maxDate && d > maxDate) return true;
              return false;
            }}
            initialFocus
            className="rounded-xl"
          />

          {/* SADA Action Footer */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border px-1">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10"
            >
              {isArabic ? "اليوم" : "Today"}
            </button>

            {clearable && parsedDate && (
              <button
                type="button"
                onClick={() => {
                  if (onChange) onChange("");
                  setOpen(false);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-muted"
              >
                {isArabic ? "مسح" : "Clear"}
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
