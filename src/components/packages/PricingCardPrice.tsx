// ============================================================
// SADA OS — PRICING CARD PRICE COMPONENT
// Financial Command Center Numeric Typography & Tabular Numerals
// ============================================================

import React from "react";
import { useTranslation } from "@/i18n";
import type { PackageCatalogItem } from "@/types/package-catalog";
import { formatPackageNumber } from "./package-utils";

export interface PricingCardPriceProps {
  package: PackageCatalogItem;
  className?: string;
}

export function PricingCardPrice({
  package: pkg,
  className = "",
}: PricingCardPriceProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const isCustomPricing = pkg.custom_pricing || pkg.billing_type === "custom";
  const formattedPriceNum = formatPackageNumber(pkg.price);

  const getBillingLabel = () => {
    if (isCustomPricing) {
      return isAr ? "حسب نطاق العمل المخصص" : "Scope tailored to goals";
    }
    if (pkg.billing_unit) {
      if (pkg.billing_unit === "month") {
        return isAr ? "شهرياً (اشتراك مستمر)" : "/ month (rolling retainer)";
      }
      if (pkg.billing_unit === "session") {
        return isAr ? "لكل جلسة تصوير" : "/ session";
      }
      if (pkg.billing_unit === "day") {
        return isAr ? "لكل يوم إنتاج" : "/ day";
      }
      if (pkg.billing_unit === "reel") {
        return isAr ? "لكل فيديو ريلز" : "/ reel";
      }
      if (pkg.billing_unit === "service") {
        return isAr ? "لكل خدمة" : "/ service";
      }
      return isAr ? `لكل ${pkg.billing_unit}` : `/ ${pkg.billing_unit}`;
    }
    if (pkg.billing_type === "one_time") {
      return isAr ? "دفعة واحدة للمشروع" : "one-time investment";
    }
    if (pkg.billing_type === "starting_from") {
      return isAr ? "ابتداءً من السعر الأساسي" : "starting from baseline";
    }
    return isAr ? "شهرياً (اشتراك مستمر)" : "/ month (rolling retainer)";
  };

  return (
    <div className={`mt-4 mb-4 pt-4 pb-0.5 border-t border-border/60 ${className}`}>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        {isCustomPricing ? (
          <span className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-foreground">
            {isAr ? "تسعير مخصص" : "Custom Scope"}
          </span>
        ) : (
          <>
            <span
              className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-foreground tabular-nums"
              dir="ltr"
            >
              {formattedPriceNum}
            </span>
            <span className="text-sm font-bold text-foreground/80 font-mono ms-1">
              {pkg.currency || "TND"}
            </span>
          </>
        )}
      </div>

      <span className="text-xs text-muted-foreground/90 font-medium block mt-1.5">
        {getBillingLabel()}
      </span>
    </div>
  );
}
