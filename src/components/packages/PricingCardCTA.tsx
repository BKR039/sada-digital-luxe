// ============================================================
// SADA OS — PRICING CARD CTA COMPONENT
// Tier-Aware Primary Button & Full Scope Inspection Trigger
// ============================================================

import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { SADAButton } from "@/components/ui/sada-button";
import type { PackageCatalogItem } from "@/types/package-catalog";
import type { PackageVisualConfig } from "./pricing-card-types";

export interface PricingCardCTAProps {
  package: PackageCatalogItem;
  visualConfig: PackageVisualConfig;
  onSelect?: (pkg: PackageCatalogItem) => void;
  onViewDetails?: (pkg: PackageCatalogItem) => void;
  isPreview?: boolean;
  className?: string;
}

export function PricingCardCTA({
  package: pkg,
  visualConfig,
  onSelect,
  onViewDetails,
  isPreview = false,
  className = "",
}: PricingCardCTAProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const isCustomPricing = pkg.custom_pricing || pkg.billing_type === "custom";

  const ctaLabel = isCustomPricing
    ? isAr
      ? "طلب استشارة مخصصة"
      : "Request Custom Scope"
    : isAr
    ? "اختيار هذه الباقة"
    : "Select Package";

  // Tier-aware button styling
  const buttonVariant =
    visualConfig.isRecommended || visualConfig.isFeatured
      ? "primary"
      : visualConfig.isPremium
      ? "primary"
      : "secondary";

  return (
    <div className={`pt-4 border-t border-border/60 space-y-2 ${className}`}>
      {/* Primary Action CTA */}
      {isPreview ? (
        <SADAButton
          type="button"
          variant={buttonVariant}
          onClick={() => onSelect && onSelect(pkg)}
          className="w-full gap-2 font-bold min-h-[44px] px-4 sm:px-6 text-xs sm:text-sm shrink-0 shadow-md transition-all hover:scale-[1.01]"
        >
          <span className="truncate">{ctaLabel}</span>
          <ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
        </SADAButton>
      ) : (
        <Link
          to="/contact"
          search={{ package: pkg.code }}
          className="block w-full focus-visible:outline-none"
        >
          <SADAButton
            type="button"
            variant={buttonVariant}
            className="w-full gap-2 font-bold min-h-[44px] px-4 sm:px-6 text-xs sm:text-sm shrink-0 shadow-md transition-all hover:scale-[1.01]"
          >
            <span className="truncate">{ctaLabel}</span>
            <ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
          </SADAButton>
        </Link>
      )}

      {/* Secondary Action: Full Package Details Modal Trigger */}
      {onViewDetails && (
        <button
          type="button"
          onClick={() => onViewDetails(pkg)}
          className="w-full text-center text-xs text-muted-foreground/80 hover:text-primary font-medium transition-colors py-1 flex items-center justify-center gap-1 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-md"
        >
          <span>
            {isAr ? "استعراض تفاصيل الباقة الكاملة" : "View full package details"}
          </span>
          <ChevronRight
            className="size-3.5 rtl:rotate-180 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
