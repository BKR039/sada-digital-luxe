import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer size-4.5 shrink-0 rounded-md border-2 transition-all duration-150 outline-none select-none",
      "border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary hover:bg-muted/30",
      "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-45 disabled:border-slate-300 dark:disabled:border-slate-700",
      "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-white data-[state=checked]:shadow-xs",
      "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-white data-[state=indeterminate]:shadow-xs",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-white")}>
      {props.checked === "indeterminate" ? (
        <Minus className="size-3 stroke-[3]" />
      ) : (
        <Check className="size-3 stroke-[3]" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
