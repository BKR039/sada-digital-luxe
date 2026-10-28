import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatAmountNumber, type FinancialCurrency } from "@/types/finance";

export interface SADANumberProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "prefix"> {
  value: number | string | null | undefined;
  variant?: "kpi" | "metric" | "table" | "percent" | "mono" | "plain";
  currency?: FinancialCurrency | string | false;
  showSign?: boolean;
  decimals?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  as?: React.ElementType;
}

/**
 * SADANumber — Canonical SADA OS Numerical Typography Component
 * Single Source of Truth: Financial Command Center
 *
 * Variants:
 * - 'kpi': Headline financial numbers (e.g. 11,500 TND, 88,200 TND in Sora, bold, tracking-tight, tabular-nums)
 * - 'metric': Card secondary metrics & summary values (Sora, bold, tabular-nums)
 * - 'table': Financial rows & data cells (Tabular numerals, aligned digits)
 * - 'percent': Deltas, ratios & percentage badges (e.g. +12%, 37.75%)
 * - 'mono': Monospace tabular data figures
 * - 'plain': Tabular numbers without overriding font family
 */
export const SADANumber = React.forwardRef<HTMLSpanElement, SADANumberProps>(
  (
    {
      value,
      variant = "plain",
      currency,
      showSign = false,
      decimals,
      prefix,
      suffix,
      className,
      as: Component = "span",
      ...props
    },
    ref
  ) => {
    const formatted = React.useMemo(() => {
      if (value === null || value === undefined || value === "") {
        return "—";
      }

      const num = typeof value === "string" ? parseFloat(value) : value;

      // Currency formatting
      if (currency) {
        const currCode = typeof currency === "string" ? (currency as FinancialCurrency) : "TND";
        return formatCurrency(num, {
          currency: currCode,
          showSign,
        });
      }

      // Percentage formatting
      if (variant === "percent") {
        if (isNaN(num)) return `${value}%`;
        const sign = showSign && num > 0 ? "+" : "";
        const formattedVal = decimals !== undefined ? num.toFixed(decimals) : num.toString();
        return `${sign}${formattedVal}%`;
      }

      // Numeric formatting with decimals
      if (!isNaN(num)) {
        if (decimals !== undefined) {
          const sign = showSign && num > 0 ? "+" : "";
          return `${sign}${num.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}`;
        }
        return formatAmountNumber(num);
      }

      return String(value);
    }, [value, currency, showSign, decimals, variant]);

    const variantClass = {
      kpi: "sada-num-kpi",
      metric: "sada-num-metric",
      table: "sada-num-table",
      percent: "sada-num-percent",
      mono: "sada-num-mono",
      plain: "tabular-nums",
    }[variant];

    return (
      <Component
        ref={ref}
        className={cn(variantClass, className)}
        {...props}
      >
        {prefix}
        {formatted}
        {suffix}
      </Component>
    );
  }
);

SADANumber.displayName = "SADANumber";

export const SadaNumber = SADANumber;
