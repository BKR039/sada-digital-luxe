import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Clock, ChevronUp, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SADA_CONTROL_BASE,
  SADA_CONTROL_SIZES,
  SADA_POPOVER_BASE,
  type SADAControlSize,
} from "./sada-controls";

export interface SADATimePickerProps {
  value?: string | null; // e.g. "14:30" or "02:30 PM"
  onChange?: (timeString: string) => void;
  placeholder?: string;
  size?: SADAControlSize;
  disabled?: boolean;
  error?: boolean;
  clearable?: boolean;
  name?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
}

export function SADATimePicker({
  value,
  onChange,
  placeholder = "Select time...",
  size = "default",
  disabled = false,
  error = false,
  clearable = true,
  name,
  id,
  className,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel,
}: SADATimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse incoming value "HH:mm" or "hh:mm a"
  const parsed = React.useMemo(() => {
    if (!value) return null;
    const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    let period: "AM" | "PM" = (match[3]?.toUpperCase() as "AM" | "PM") || (h >= 12 ? "PM" : "AM");
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { h12, minute: m, period };
  }, [value]);

  const [hour, setHour] = React.useState<number>(parsed ? parsed.h12 : 12);
  const [minute, setMinute] = React.useState<number>(parsed ? parsed.minute : 0);
  const [ampm, setAmpm] = React.useState<"AM" | "PM">(parsed ? parsed.period : "AM");

  React.useEffect(() => {
    if (parsed) {
      setHour(parsed.h12);
      setMinute(parsed.minute);
      setAmpm(parsed.period);
    }
  }, [parsed]);

  const emitTime = (h12: number, m: number, period: "AM" | "PM") => {
    if (!onChange) return;
    let h24 = h12 % 12;
    if (period === "PM") h24 += 12;
    const hStr = String(h24).padStart(2, "0");
    const mStr = String(m).padStart(2, "0");
    onChange(`${hStr}:${mStr}`);
  };

  const stepHour = (delta: number) => {
    let nextH = hour + delta;
    if (nextH > 12) nextH = 1;
    if (nextH < 1) nextH = 12;
    setHour(nextH);
    emitTime(nextH, minute, ampm);
  };

  const stepMinute = (delta: number) => {
    let nextM = minute + delta;
    if (nextM >= 60) nextM = 0;
    if (nextM < 0) nextM = 55;
    setMinute(nextM);
    emitTime(hour, nextM, ampm);
  };

  const toggleAmpm = () => {
    const nextPeriod = ampm === "AM" ? "PM" : "AM";
    setAmpm(nextPeriod);
    emitTime(hour, minute, nextPeriod);
  };

  const handleSelectNow = () => {
    const now = new Date();
    const rawH = now.getHours();
    const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
    const period = rawH >= 12 ? "PM" : "AM";
    const m = now.getMinutes();
    setHour(h12);
    setMinute(m);
    setAmpm(period);
    emitTime(h12, m, period);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) onChange("");
  };

  const displayString = parsed
    ? `${String(parsed.h12).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")} ${parsed.period}`
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
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            {displayString ? (
              <span className="truncate font-semibold text-foreground">{displayString}</span>
            ) : (
              <span className="truncate text-muted-foreground font-normal">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="size-4 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear time"
              >
                <X className="size-3" />
              </span>
            )}
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      {name && <input type="hidden" name={name} value={value || ""} />}

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
          <div className="flex items-center justify-between gap-3 px-1 py-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" /> Select Time
            </span>

            <div className="flex items-center gap-2">
              {/* Hour Stepper */}
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

              {/* Minute Stepper */}
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

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border px-1">
            <button
              type="button"
              onClick={handleSelectNow}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10"
            >
              Now
            </button>

            {clearable && value && (
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
