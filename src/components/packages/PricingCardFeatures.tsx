// ============================================================
// SADA OS — PRICING CARD FEATURES COMPONENT
// Logical Feature Grouping: Included Services & Transparent Exclusions
// ============================================================

import React from "react";
import { Check, X, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { PackageCatalogItem } from "@/types/package-catalog";

export interface PricingCardFeaturesProps {
  package: PackageCatalogItem;
  onViewDetails?: (pkg: PackageCatalogItem) => void;
  className?: string;
}

export function PricingCardFeatures({
  package: pkg,
  onViewDetails,
  className = "",
}: PricingCardFeaturesProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  // Included items (display up to 6 in main card preview)
  const allIncluded = pkg.included_items || [];
  const visibleIncluded = allIncluded.slice(0, 6);
  const remainingIncludedCount = Math.max(0, allIncluded.length - 6);

  // Excluded items (display up to 3 in main card preview)
  const allExcluded = pkg.excluded_items || [];
  const visibleExcluded = allExcluded.slice(0, 3);
  const remainingExcludedCount = Math.max(0, allExcluded.length - 3);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. INCLUDED SERVICES */}
      {visibleIncluded.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground/80">
            <span>{isAr ? "الخدمات والمخرجات المشمولة" : "Included Services"}</span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
              {allIncluded.length} {isAr ? "مخرجات" : "items"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {visibleIncluded.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-foreground/90 leading-tight min-w-0"
              >
                <span className="mt-0.5 size-3.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                  <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
                </span>
                <span className="truncate text-xs font-medium min-w-0 flex-1">
                  {isAr ? item.text_ar || item.text : item.text}
                </span>
              </div>
            ))}
          </div>

          {/* "+N more deliverables" button to full scope modal */}
          {remainingIncludedCount > 0 && (
            <button
              type="button"
              onClick={() => onViewDetails && onViewDetails(pkg)}
              className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/15 border border-primary/25 text-[11px] font-semibold text-primary transition-all group/expand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary max-w-full"
            >
              <span className="truncate">
                +{remainingIncludedCount}{" "}
                {isAr ? "مخرجات إضافية مشمولة" : "more deliverables included"}
              </span>
              <ChevronRight className="size-3 rtl:rotate-180 shrink-0 transition-transform group-hover/expand:translate-x-0.5 rtl:group-hover/expand:-translate-x-0.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* 2. NOT INCLUDED / EXCLUSIONS (TRANSPARENT BUT SUBORDINATE) */}
      {visibleExcluded.length > 0 && (
        <div className="space-y-1.5 pt-3.5 border-t border-border/40 text-[11px] text-muted-foreground/75">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/50 block">
            {isAr ? "غير مشمول في هذه الباقة" : "Not Included"}
          </span>

          <div className="space-y-1.5">
            {visibleExcluded.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 min-w-0">
                <span className="size-3 rounded-full bg-muted/60 text-muted-foreground/50 grid place-items-center shrink-0">
                  <X className="size-2 stroke-[2.5]" aria-hidden="true" />
                </span>
                <span className="truncate text-[11px] min-w-0 flex-1">
                  {isAr ? item.text_ar || item.text : item.text}
                </span>
              </div>
            ))}
          </div>

          {remainingExcludedCount > 0 && (
            <button
              type="button"
              onClick={() => onViewDetails && onViewDetails(pkg)}
              className="text-[10px] text-muted-foreground/70 hover:text-foreground underline pt-0.5 transition-colors"
            >
              {isAr
                ? `عرض بقية الاستثناءات (+${remainingExcludedCount})`
                : `View all exclusions (+${remainingExcludedCount})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
