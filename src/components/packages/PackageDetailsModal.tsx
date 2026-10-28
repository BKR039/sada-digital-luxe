// ============================================================
// SADA OS — PACKAGE DETAILS MODAL
// Full scope inspection: Deliverable quotas, complete inclusions & exclusions
// ============================================================

import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  X,
  ArrowRight,
  Film,
  FileText,
  Flame,
  Camera,
  Target,
  Globe,
  Compass,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAButton } from "@/components/ui/sada-button";
import type { PackageCatalogItem } from "@/types/package-catalog";
import { formatPackageNumber, getBadgeConfig } from "./package-utils";

export interface PackageDetailsModalProps {
  package: PackageCatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (pkg: PackageCatalogItem) => void;
}

export function PackageDetailsModal({
  package: pkg,
  open,
  onOpenChange,
  onSelect,
}: PackageDetailsModalProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  if (!pkg) return null;

  const badgeCfg = getBadgeConfig(pkg.badge, pkg.badge_ar, isAr);
  const isCustomPricing = pkg.custom_pricing || pkg.billing_type === "custom";
  const formattedPriceNum = formatPackageNumber(pkg.price);

  return (
    <SADADialog
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-xs font-mono text-primary px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
            {pkg.code}
          </span>
          <span className="text-xl sm:text-2xl font-bold font-display text-foreground">
            {isAr ? pkg.name_ar || pkg.name : pkg.name}
          </span>
          {badgeCfg && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeCfg.className}`}
            >
              <badgeCfg.icon className="size-3" />
              <span>{badgeCfg.label}</span>
            </span>
          )}
        </div>
      }
      description={
        isAr
          ? pkg.description_ar || pkg.short_description_ar || pkg.description || pkg.short_description
          : pkg.description || pkg.short_description
      }
      footer={
        <div className="flex items-center justify-between w-full gap-3 flex-wrap">
          {/* Price display in footer */}
          <div className="text-start">
            <div className="text-[11px] font-mono text-muted-foreground uppercase">
              {isAr ? "الاستثمار المقدر" : "Estimated Investment"}
            </div>
            <div className="font-bold text-foreground text-base sm:text-lg font-mono">
              {isCustomPricing ? (
                <span>{isAr ? "تسعير مخصص" : "Custom Quote"}</span>
              ) : (
                <span>
                  {formattedPriceNum} {pkg.currency || "TND"}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {pkg.billing_type === "one_time"
                      ? isAr
                        ? "دفعة واحدة"
                        : "one-time"
                      : isAr
                      ? "/ شهرياً"
                      : "/ mo"}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <SADAButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="px-4 min-h-[40px] text-xs whitespace-nowrap shrink-0"
            >
              {isAr ? "إغلاق" : "Close"}
            </SADAButton>

            <Link
              to="/contact"
              search={{ package: pkg.code }}
              onClick={() => {
                onOpenChange(false);
                if (onSelect) onSelect(pkg);
              }}
              className="inline-block"
            >
              <SADAButton
                type="button"
                variant="primary"
                className="gap-2 font-bold min-h-[40px] px-6 text-xs whitespace-nowrap shrink-0 shadow-md"
              >
                <span>
                  {isCustomPricing
                    ? isAr
                      ? "طلب استشارة مخصصة"
                      : "Request Custom Scope"
                    : isAr
                    ? "اختيار هذه الباقة"
                    : "Select This Package"}
                </span>
                <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
              </SADAButton>
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs sm:text-sm">
        {/* 1. Measurable Production Quotas */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" />
            <span>{isAr ? "الحصص الإنتاجية الشهرية المعتمدة" : "Standard Production Quotas"}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                {isAr ? "فيديوهات ريلز" : "Reels / Video"}
              </span>
              <div className="font-bold text-base text-foreground font-mono">
                {pkg.monthly_reels > 0 ? `${pkg.monthly_reels}` : "—"}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                {isAr ? "منشورات وكاروسيل" : "Posts / Carousels"}
              </span>
              <div className="font-bold text-base text-foreground font-mono">
                {pkg.monthly_posts > 0 ? `${pkg.monthly_posts}` : "—"}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                {isAr ? "الستوريز الأسبوعية" : "Stories Quota"}
              </span>
              <div className="font-bold text-base text-foreground truncate">
                {pkg.monthly_stories || (isAr ? "غير مشمول" : "None")}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                {isAr ? "ساعات التصوير" : "Shoot Time"}
              </span>
              <div className="font-bold text-base text-foreground font-mono">
                {pkg.production_hours > 0 ? `${pkg.production_hours}h` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Platform & Operational Flags */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-2.5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            {isAr ? "الميزات التشغيلية المشمولة" : "Included Operational Scope"}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  pkg.has_ads_management ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              <span
                className={
                  pkg.has_ads_management
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }
              >
                {isAr ? "إدارة إعلانات ميتا وتيك توك" : "Meta & TikTok Ads Management"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  pkg.has_website ? "bg-purple-600 dark:bg-purple-400" : "bg-muted-foreground/30"
                }`}
              />
              <span
                className={
                  pkg.has_website
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }
              >
                {isAr ? "موقع رقمي متكامل ونظام CMS" : "Full Website Architecture & CMS"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  pkg.has_strategy ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}
              />
              <span
                className={
                  pkg.has_strategy
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }
              >
                {isAr ? "استراتيجية نمو واستشارات شهرية" : "Monthly Strategic Growth Roadmap"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  pkg.has_community_management ? "bg-blue-500" : "bg-muted-foreground/30"
                }`}
              />
              <span
                className={
                  pkg.has_community_management
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }
              >
                {isAr ? "إدارة المجتمع والرد على الرسائل" : "Community Moderation & Engagement"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Complete List of Included Services */}
        {pkg.included_items && pkg.included_items.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>{isAr ? "جميع الخدمات والمخرجات المشمولة بالتفصيل" : "All Included Deliverables"}</span>
              <span className="text-foreground font-semibold">
                {pkg.included_items.length} {isAr ? "مخرج" : "deliverables"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {pkg.included_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-xl bg-card border border-border"
                >
                  <span className="mt-0.5 size-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                  <span className="text-foreground leading-snug">
                    {isAr ? item.text_ar || item.text : item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Complete List of Exclusions */}
        {pkg.excluded_items && pkg.excluded_items.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-border">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              {isAr ? "الاستثناءات والبنود غير المشمولة (للشفافية)" : "Clear Exclusions & Out of Scope"}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {pkg.excluded_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60 text-muted-foreground"
                >
                  <span className="mt-0.5 size-4 rounded-full bg-muted text-muted-foreground/60 grid place-items-center shrink-0">
                    <X className="size-2.5 stroke-[2.5]" />
                  </span>
                  <span className="leading-snug">
                    {isAr ? item.text_ar || item.text : item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SADADialog>
  );
}
