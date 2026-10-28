// ============================================================
// SADA OS — PRICING CARD HEADER COMPONENT
// Package Identity: Code, Category, Title & Concise Description
// ============================================================

import React from "react";
import { useTranslation } from "@/i18n";
import type { PackageCatalogItem } from "@/types/package-catalog";
import { PricingCardBadge } from "./PricingCardBadge";
import type { PackageVisualConfig } from "./pricing-card-types";

export interface PricingCardHeaderProps {
  package: PackageCatalogItem;
  visualConfig: PackageVisualConfig;
  className?: string;
}

export function PricingCardHeader({
  package: pkg,
  visualConfig,
  className = "",
}: PricingCardHeaderProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const title = isAr ? pkg.name_ar || pkg.name : pkg.name;
  const shortDesc = isAr
    ? pkg.short_description_ar || pkg.short_description
    : pkg.short_description;

  const categoryName = pkg.category_name || pkg.package_type || "Standard";

  return (
    <header className={`space-y-3.5 ${className}`}>
      {/* Top Identity Row: Code & Category Tag on Left, Status Badge on Right */}
      <div className="flex items-center justify-between gap-x-2.5 gap-y-2 flex-wrap min-h-[28px]">
        {/* Left: Code + Category */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0 shadow-2xs">
            {pkg.code || "SADA"}
          </span>
          <span
            className="text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground/80 truncate"
            title={categoryName}
          >
            {categoryName}
          </span>
        </div>

        {/* Right: Status / Recommended / Featured Badge */}
        {visualConfig.badgeType && (
          <div className="shrink-0 ms-auto">
            <PricingCardBadge
              badge={visualConfig.badgeType}
              badgeAr={pkg.badge_ar}
            />
          </div>
        )}
      </div>

      {/* Package Main Name */}
      <h3 className="text-2xl sm:text-[26px] font-bold font-display tracking-tight text-foreground leading-tight pt-0.5">
        {title}
      </h3>

      {/* Concise Strategic Description (Fixed min-height preserves vertical rhythm across cards) */}
      {shortDesc ? (
        <p className="text-xs text-muted-foreground/85 leading-relaxed line-clamp-2 min-h-[36px]">
          {shortDesc}
        </p>
      ) : (
        <div className="min-h-[36px]" />
      )}
    </header>
  );
}
