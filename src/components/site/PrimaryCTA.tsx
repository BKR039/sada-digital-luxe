import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PrimaryCTAProps {
  to?: string;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  showArrow?: boolean;
  className?: string;
}

/**
 * SADA Canonical Primary CTA Component
 * Implements SADA Design System v2 Button specifications:
 * - Canonical 135deg gradient (#18C7F7 -> #0167EA)
 * - Canonical 12px border radius (var(--radius-md) / rounded-xl)
 * - Sora font-display font-semibold typography
 * - Neon blue elevated glow
 * - Fluid hover lift with micro-interaction arrow slide
 */
export function PrimaryCTA({
  to = "/contact",
  href,
  onClick,
  children,
  size = "md",
  showArrow = true,
  className = "",
}: PrimaryCTAProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm min-h-[38px]",
    md: "px-6 py-3 text-sm sm:text-base min-h-[46px]",
    lg: "px-7 sm:px-8 py-3.5 sm:py-4 text-[15px] sm:text-base min-h-[52px]",
  }[size];

  const content = (
    <>
      <span className="leading-none">{children}</span>
      {showArrow && (
        <ArrowRight className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1 rtl-flip group-hover:rtl:-translate-x-1" />
      )}
    </>
  );

  const baseClasses = cn(
    "group inline-flex items-center justify-center gap-2.5 rounded-xl font-display font-semibold tracking-wide text-white bg-gradient-primary neon-glow transition-all duration-300 hover:scale-[1.03] active:scale-[0.985] cursor-pointer whitespace-nowrap select-none",
    sizeClasses,
    className
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={baseClasses}>
        {content}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClasses}>
      {content}
    </button>
  );
}
