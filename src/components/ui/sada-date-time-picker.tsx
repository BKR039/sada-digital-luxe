import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { format, parseISO, isValid, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock, X, ChevronUp, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  SADA_CONTROL_BASE,
  SADA_CONTROL_SIZES,
  SADA_POPOVER_BASE,
  type SADAControlSize,
} from "./sada-controls";

export interface SADADateDateTimePickerProps {
  value?: string | Date | null;
  onChange?: (dateTimeString: string) => void;
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

export function SADADateDateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time...",
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
}: SADADateDateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert incoming value (string or Date) into a valid Date object
  const parsedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    try {
      const d = parseISO(value);
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Selected date + time state inside popover
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(parsedDate);
  const [hour, setHour] = React.useState<number>(parsedDate ? (parsedDate.getHours() % 12 || 12) : 12);
  const [minute, setMinute] = React.useState<number>(parsedDate ? parsedDate.getMinutes() : 0);
  const [ampm, setAmpm] = React.useState<"AM" | "PM">(
    parsedDate && parsedDate.getHours() >= 12 ? "PM" : "AM"
  );

  // Synchronize internal state when value prop changes
  React.useEffect(() => {
    if (parsedDate) {
      setSelectedDate(parsedDate);
      const h = parsedDate.getHours();
      setHour(h % 12 === 0 ? 12 : h % 12);
      setMinute(parsedDate.getMinutes());
      setAmpm(h >= 12 ? "PM" : "AM");
    } else {
      setSelectedDate(undefined);
    }
  }, [parsedDate]);

  const emitDateTime = (d: Date | undefined, h12: number, m: number, period: "AM" | "PM") => {
    if (!onChange) return;
    if (!d) {
      onChange("");
      return;
    }

    let h24 = h12 % 12;
    if (period === "PM") h24 += 12;

    const fullDate = setMinutes(setHours(d, h24), m);
    // Returns ISO format YYYY-MM-DDTHH:mm compatible with datetime-local
    const str = format(fullDate, "yyyy-MM-dd'T'HH:mm");
    onChange(str);
  };

  const handleDaySelect = (day: Date | undefined) => {
    setSelectedDate(day);
    if (day) {
      emitDateTime(day, hour, minute, ampm);
    } else {
      if (onChange) onChange("");
    }
  };

  const stepHour = (delta: number) => {
    let nextH = hour + delta;
    if (nextH > 12) nextH = 1;
    if (nextH < 1) nextH = 12;
    setHour(nextH);
    const baseDay = selectedDate || new Date();
    if (!selectedDate) setSelectedDate(baseDay);
    emitDateTime(baseDay, nextH, minute, ampm);
  };

  const stepMinute = (delta: number) => {
    let nextM = minute + delta;
    if (nextM >= 60) nextM = 0;
    if (nextM < 0) nextM = 55;
    setMinute(nextM);
    const baseDay = selectedDate || new Date();
    if (!selectedDate) setSelectedDate(baseDay);
    emitDateTime(baseDay, hour, nextM, ampm);
  };

  const toggleAmpm = () => {
    const nextPeriod = ampm === "AM" ? "PM" : "AM";
    setAmpm(nextPeriod);
    const baseDay = selectedDate || new Date();
    if (!selectedDate) setSelectedDate(baseDay);
    emitDateTime(baseDay, hour, minute, nextPeriod);
  };

  const handleSelectNow = () => {
    const now = new Date();
    setSelectedDate(now);
    const rawH = now.getHours();
    const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
    const period = rawH >= 12 ? "PM" : "AM";
    setHour(h12);
    setMinute(now.getMinutes());
    setAmpm(period);
    emitDateTime(now, h12, now.getMinutes(), period);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(undefined);
    if (onChange) onChange("");
  };

  const formattedDisplay = parsedDate
    ? format(parsedDate, "d MMM yyyy, h:mm a")
    : null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel || placeholder}
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
              <span className="truncate text-muted-foreground font-normal">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {clearable && parsedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="size-4 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear date and time"
              >
                <X className="size-3" />
              </span>
            )}
            <Clock className="size-3.5 text-muted-foreground" />
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      {/* Hidden input for native forms */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={parsedDate ? format(parsedDate, "yyyy-MM-dd'T'HH:mm") : ""}
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
          {/* Calendar Grid */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            disabled={(d) => {
              if (minDate && d < minDate) return true;
              if (maxDate && d > maxDate) return true;
              return false;
            }}
            initialFocus
            className="rounded-xl"
          />

          {/* Fully Custom SADA Time Stepper Controls (zero native dropdowns) */}
          <div className="pt-2.5 mt-2 border-t border-border">
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" /> Time
              </span>

              <div className="flex items-center gap-2">
                {/* Custom SADA Hour Stepper */}
                <div className="flex items-center rounded-xl border border-border bg-background px-1.5 py-0.5 shadow-2xs">
                  <span className="w-6 text-center text-xs font-mono font-bold text-foreground">
                    {String(hour).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col ml-1 border-l border-border pl-1">
                    <button
                      type="button"
                      aria-label="Increase hour"
                      onClick={() => stepHour(1)}
                      className="p-0.5 hover:text-primary transition-colors text-muted-foreground"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease hour"
                      onClick={() => stepHour(-1)}
                      className="p-0.5 hover:text-primary transition-colors text-muted-foreground"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                </div>

                <span className="font-bold text-muted-foreground">:</span>

                {/* Custom SADA Minute Stepper */}
                <div className="flex items-center rounded-xl border border-border bg-background px-1.5 py-0.5 shadow-2xs">
                  <span className="w-6 text-center text-xs font-mono font-bold text-foreground">
                    {String(minute).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col ml-1 border-l border-border pl-1">
                    <button
                      type="button"
                      aria-label="Increase minute"
                      onClick={() => stepMinute(5)}
                      className="p-0.5 hover:text-primary transition-colors text-muted-foreground"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease minute"
                      onClick={() => stepMinute(-5)}
                      className="p-0.5 hover:text-primary transition-colors text-muted-foreground"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                </div>

                {/* AM / PM Toggle Pill */}
                <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={toggleAmpm}
                    className={cn(
                      "px-2 py-0.5 rounded-lg transition-all",
                      ampm === "AM"
                        ? "bg-primary text-white shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={toggleAmpm}
                    className={cn(
                      "px-2 py-0.5 rounded-lg transition-all",
                      ampm === "PM"
                        ? "bg-primary text-white shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SADA Action Footer */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectNow}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  handleDaySelect(today);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-muted"
              >
                Today
              </button>
            </div>

            {clearable && parsedDate && (
              <button
                type="button"
                onClick={() => {
                  if (onChange) onChange("");
                  setOpen(false);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export const SADADateTimePicker = SADADateDateTimePicker;
export type SADADateTimePickerProps = SADADateDateTimePickerProps;

