// ============================================================
// SADA OS — CANONICAL PUBLIC PACKAGE CARD (PREMIUM REDESIGN)
// Modular Architecture, Liquid Glass, Atmospheric Diffusion & High-Trust Hierarchy
// Consumed by: Public /pricing page & Admin Package CMS Live Preview
// ============================================================

import React from "react";
import type { PackageCatalogItem } from "@/types/package-catalog";
import { resolvePackageVisualConfig } from "./pricing-card-types";
import { PricingCardHeader } from "./PricingCardHeader";
import { PricingCardPrice } from "./PricingCardPrice";
import { PricingCardDeliverables } from "./PricingCardDeliverables";
import { PricingCardFeatures } from "./PricingCardFeatures";
import { PricingCardCTA } from "./PricingCardCTA";

export interface PublicPackageCardProps {
  package: PackageCatalogItem;
  onSelect?: (pkg: PackageCatalogItem) => void;
  onViewDetails?: (pkg: PackageCatalogItem) => void;
  isPopular?: boolean;
  className?: string;
  isPreview?: boolean;
}

export function PublicPackageCard({
  package: pkg,
  onSelect,
  onViewDetails,
  isPopular: isPopularProp,
  className = "",
  isPreview = false,
}: PublicPackageCardProps) {
  // 1. Resolve tier and visual states based on package metadata
  const visualConfig = resolvePackageVisualConfig(pkg, isPopularProp);

  // 2. Resolve tier-specific classnames
  const tierClasses = (() => {
    switch (visualConfig.tier) {
      case "recommended":
        return "sada-pricing-recommended ring-1 ring-primary/40 shadow-xl shadow-primary/10";
      case "featured":
        return "sada-pricing-featured ring-1 ring-primary/25 shadow-lg shadow-black/20";
      case "premium":
        return "sada-pricing-premium ring-1 ring-primary/20";
      case "unavailable":
        return "opacity-60 grayscale-[30%] pointer-events-none";
      default:
        return "";
    }
  })();

  return (
    <article
      className={`sada-pricing-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 flex flex-col justify-between h-full select-text ${tierClasses} ${className}`}
    >
      {/* Atmospheric Soft Blue Diffusion (for Recommended / Featured / Premium) */}
      {visualConfig.accentGlow && (
        <div className="sada-pricing-card-ambient" aria-hidden="true" />
      )}

      {/* TOP & MIDDLE CONTENT ZONE */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Identity & Badging */}
        <PricingCardHeader
          package={pkg}
          visualConfig={visualConfig}
        />

        {/* Pricing Zone */}
        <PricingCardPrice package={pkg} />

        {/* Measurable Core Production Deliverables */}
        <PricingCardDeliverables package={pkg} />

        {/* Grouped Feature Breakdown */}
        <PricingCardFeatures
          package={pkg}
          onViewDetails={onViewDetails}
        />
      </div>

      {/* BOTTOM ACTION & NAVIGATION ZONE (Pinned cleanly to bottom) */}
      <div className="relative z-10 mt-6 pt-1">
        <PricingCardCTA
          package={pkg}
          visualConfig={visualConfig}
          onSelect={onSelect}
          onViewDetails={onViewDetails}
          isPreview={isPreview}
        />
      </div>
    </article>
  );
}
