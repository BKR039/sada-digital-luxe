// ============================================================
// SADA OS — PRICING CARD DELIVERABLES COMPONENT
// Measurable Production Units: Reels, Posts, Stories, Shoots, Ads & Web
// ============================================================

import React from "react";
import {
  Film,
  FileText,
  Flame,
  Camera,
  Target,
  Globe,
  Compass,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import type { PackageCatalogItem } from "@/types/package-catalog";

export interface PricingCardDeliverablesProps {
  package: PackageCatalogItem;
  className?: string;
}

export function PricingCardDeliverables({
  package: pkg,
  className = "",
}: PricingCardDeliverablesProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const coreDeliverables: Array<{
    icon: React.ElementType;
    label: string;
    highlight?: boolean;
  }> = [];

  if (pkg.monthly_reels > 0) {
    coreDeliverables.push({
      icon: Film,
      label: `${pkg.monthly_reels} ${isAr ? "ريلز" : "Reels"}`,
    });
  }
  if (pkg.monthly_posts > 0) {
    coreDeliverables.push({
      icon: FileText,
      label: `${pkg.monthly_posts} ${isAr ? "منشورات" : "Posts"}`,
    });
  }
  if (pkg.monthly_stories && pkg.monthly_stories.trim()) {
    coreDeliverables.push({
      icon: Flame,
      label: isAr
        ? pkg.monthly_stories.includes("Weekly")
          ? "ستوريز أسبوعية"
          : pkg.monthly_stories
        : pkg.monthly_stories,
    });
  }
  if (pkg.production_hours > 0 || pkg.production_sessions > 0) {
    const shootLabel =
      pkg.production_hours > 0
        ? `${pkg.production_hours}h ${isAr ? "تصوير" : "Shoot"}`
        : `${pkg.production_sessions} ${isAr ? "جلسات تصوير" : "Sessions"}`;
    coreDeliverables.push({
      icon: Camera,
      label: shootLabel,
    });
  }
  if (pkg.has_ads_management) {
    coreDeliverables.push({
      icon: Target,
      label: isAr ? "إعلانات ميتا" : "Meta Ads",
      highlight: true,
    });
  }
  if (pkg.has_website) {
    coreDeliverables.push({
      icon: Globe,
      label: isAr ? "موقع رقمي" : "Website",
      highlight: true,
    });
  }
  if (pkg.has_strategy && coreDeliverables.length < 6) {
    coreDeliverables.push({
      icon: Compass,
      label: isAr ? "استراتيجية نمو" : "Strategy",
    });
  }

  if (coreDeliverables.length === 0) {
    return null;
  }

  return (
    <div className={`mb-5 p-2.5 rounded-2xl bg-card/40 dark:bg-white/[0.02] border border-border/60 ${className}`}>
      <div className="flex flex-wrap gap-1.5">
        {coreDeliverables.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors shadow-2xs ${
                item.highlight
                  ? "bg-primary/10 border-primary/25 text-primary dark:text-cyan-300"
                  : "bg-card/70 dark:bg-white/[0.04] border-border/60 text-foreground/90"
              }`}
            >
              <Icon className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
