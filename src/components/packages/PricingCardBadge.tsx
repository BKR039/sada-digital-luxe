// ============================================================
// SADA OS — PRICING CARD BADGE COMPONENT
// Refined, compact badges strictly adhering to SADA Design System
// ============================================================

import React from "react";
import { Sparkles, ShieldCheck, Zap, Star, Compass } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { PackageBadge } from "@/types/package-catalog";

export interface PricingCardBadgeProps {
  badge: PackageBadge | "custom_scope" | string | null | undefined;
  badgeAr?: string | null;
  className?: string;
}

export function PricingCardBadge({
  badge,
  badgeAr,
  className = "",
}: PricingCardBadgeProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  if (!badge) return null;

  let label = "";
  let icon = Sparkles;
  let colorClasses = "";

  switch (badge) {
    case "recommended":
      label = isAr ? badgeAr || "موصى به" : "Recommended";
      icon = ShieldCheck;
      // High-trust SADA cyan/blue primary treatment
      colorClasses =
        "bg-primary text-white border-primary/40 shadow-xs shadow-primary/20 ring-1 ring-white/10";
      break;

    case "most_popular":
      label = isAr ? badgeAr || "الأكثر طلباً" : "Most Popular";
      icon = Sparkles;
      // SADA primary gradient
      colorClasses =
        "bg-gradient-primary text-white border-cyan-400/40 shadow-xs shadow-primary/25 ring-1 ring-white/15";
      break;

    case "featured":
      label = isAr ? badgeAr || "مميز" : "Featured";
      icon = Star;
      // Subtle liquid glass luxury slate
      colorClasses =
        "bg-card/90 backdrop-blur-md text-primary dark:text-cyan-300 border-primary/35 shadow-xs";
      break;

    case "best_value":
      label = isAr ? badgeAr || "أفضل قيمة" : "Best Value";
      icon = Zap;
      // Restrained amber highlight (non-clashing)
      colorClasses =
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-xs";
      break;

    case "custom_scope":
      label = isAr ? "نطاق مخصص" : "Tailored Scope";
      icon = Compass;
      // SADA subtle cyan
      colorClasses =
        "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/30 shadow-xs";
      break;

    default:
      label = isAr ? badgeAr || String(badge) : String(badge);
      icon = Star;
      colorClasses =
        "bg-muted/80 text-foreground border-border/80 shadow-xs";
      break;
  }

  const IconComponent = icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-display tracking-wide border uppercase select-none shrink-0 transition-transform ${colorClasses} ${className}`}
    >
      <IconComponent className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap leading-none">{label}</span>
    </div>
  );
}
