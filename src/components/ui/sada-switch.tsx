import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export interface SADASwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "default" | "lg";
  containerClassName?: string;
  labelClassName?: string;
}

const sizeConfig = {
  sm: {
    touchWrapper: "min-h-[44px] min-w-[44px]",
    root: "h-5.5 w-10 p-0.5",
    thumb: "size-4.5 data-[state=checked]:translate-x-4.5 rtl:data-[state=checked]:-translate-x-4.5",
    label: "text-xs",
    desc: "text-[11px]",
  },
  default: {
    touchWrapper: "min-h-[44px] min-w-[44px]",
    root: "h-6.5 w-12 p-0.5",
    thumb: "size-5.5 data-[state=checked]:translate-x-5.5 rtl:data-[state=checked]:-translate-x-5.5",
    label: "text-sm",
    desc: "text-xs",
  },
  lg: {
    touchWrapper: "min-h-[44px] min-w-[44px]",
    root: "h-7.5 w-14 p-0.5",
    thumb: "size-6.5 data-[state=checked]:translate-x-6.5 rtl:data-[state=checked]:-translate-x-6.5",
    label: "text-base font-semibold",
    desc: "text-sm",
  },
};

/**
 * SADA OS Universal Toggle / Switch Component
 * Used for binary state toggling (e.g. Published, Active, Featured, Enable Ads).
 * Clear high-contrast OFF vs ON states, >=44px touch targets, accessible Radix primitive, full label clickability.
 */
export const SADASwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SADASwitchProps
>(
  (
    {
      className,
      containerClassName,
      labelClassName,
      label,
      description,
      size = "default",
      disabled = false,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;
    const currentSize = sizeConfig[size];

    const switchMarkup = (
      <div className={cn("relative inline-flex items-center justify-center shrink-0", currentSize.touchWrapper)}>
        <SwitchPrimitives.Root
          ref={ref}
          id={id}
          disabled={disabled}
          className={cn(
            "peer inline-flex shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 outline-none select-none",
            // OFF STATE: neutral SADA surface, distinct from background, visible border
            "bg-slate-200 dark:bg-slate-700/90 border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500",
            // ON STATE: vivid SADA blue / cyan gradient, immediately communicates ON
            "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:to-cyan-500 data-[state=checked]:border-blue-500 data-[state=checked]:shadow-xs data-[state=checked]:shadow-blue-500/30",
            // FOCUS & ACTIVE
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "active:scale-95",
            // DISABLED
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
            currentSize.root,
            className
          )}
          {...props}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              "pointer-events-none block rounded-full ring-0 transition-transform duration-200 translate-x-0 will-change-transform",
              // OFF STATE: Solid visible neutral/gray thumb (clearly NOT white, distinct from active)
              "bg-slate-400 dark:bg-slate-400 shadow-2xs",
              // ON STATE: Pure solid white thumb with strong contrast against saturated blue track
              "data-[state=checked]:bg-white data-[state=checked]:shadow-md",
              currentSize.thumb
            )}
          />
        </SwitchPrimitives.Root>
      </div>
    );

    if (!label && !description) {
      return switchMarkup;
    }

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-center gap-3 cursor-pointer select-none group min-h-[44px]",
          disabled && "cursor-not-allowed opacity-50",
          containerClassName
        )}
      >
        {switchMarkup}
        <div className="flex flex-col leading-snug">
          {label && (
            <span
              className={cn(
                "font-semibold text-foreground group-hover:text-primary transition-colors",
                currentSize.label,
                labelClassName
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span className={cn("text-muted-foreground mt-0.5 leading-normal", currentSize.desc)}>
              {description}
            </span>
          )}
        </div>
      </label>
    );
  }
);

SADASwitch.displayName = "SADASwitch";
export const SadaSwitch = SADASwitch;
