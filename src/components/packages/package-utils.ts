// ============================================================
// SADA OS — PACKAGE DESIGN SYSTEM UTILITIES & FORMATTERS
// Canonical Number Styling, Feature Libraries & Badge Configurations
// ============================================================

import { Sparkles, ShieldCheck, Zap, Star } from "lucide-react";
import type { PackageBadge } from "@/types/package-catalog";

/**
 * Formats integers with canonical SADA space-separated thousands.
 * Example: 1490 -> "1 490", 24900 -> "24 900"
 */
export function formatPackageNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "0";
  const rounded = Math.round(num);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Canonical SADA Currency display: "1 490 TND"
 */
export function formatPackagePrice(price: number | string | null | undefined, currency = "TND"): string {
  return `${formatPackageNumber(price)} ${currency}`;
}

/**
 * Canonical SADA Margin format: "56.0%"
 */
export function formatGrossMargin(margin: number | string | null | undefined): string {
  if (margin === null || margin === undefined || margin === "") return "0.0%";
  const num = typeof margin === "string" ? parseFloat(margin) : margin;
  if (isNaN(num)) return "0.0%";
  return `${num.toFixed(1)}%`;
}

/**
 * Returns badge configuration, styling, and icon
 */
export function getBadgeConfig(
  badge: PackageBadge | string | null | undefined,
  badgeAr?: string | null,
  isAr = false
) {
  if (!badge) return null;
  switch (badge) {
    case "most_popular":
      return {
        label: isAr ? badgeAr || "الأكثر طلباً" : "Most Popular",
        className: "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/40",
        icon: Sparkles,
      };
    case "recommended":
      return {
        label: isAr ? badgeAr || "موصى به" : "Recommended",
        className: "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-500/40",
        icon: ShieldCheck,
      };
    case "best_value":
      return {
        label: isAr ? badgeAr || "أفضل قيمة" : "Best Value",
        className: "bg-amber-600 text-white shadow-md ring-1 ring-amber-500/40",
        icon: Zap,
      };
    case "featured":
      return {
        label: isAr ? badgeAr || "مميز" : "Featured",
        className: "bg-card/90 text-primary dark:text-cyan-300 border border-primary/40 shadow-xs",
        icon: Star,
      };
    default:
      return null;
  }
}

/**
 * Official Feature Library for 1-click insertion in Admin CMS
 */
export const OFFICIAL_FEATURE_LIBRARY = [
  { en: "Content Planning & Calendar", ar: "تخطيط وجدولة المحتوى الشهرية" },
  { en: "Professional Copywriting", ar: "كتابة نصوص تسويقية وإبداعية" },
  { en: "Publishing & Community Management", ar: "النشر وإدارة التفاعل والمجتمع" },
  { en: "Monthly Performance Analytics", ar: "تقرير أداء شهري تفصيلي" },
  { en: "High-Frequency Reels", ar: "ريلز وفيديوهات قصيرة عالية التفاعل" },
  { en: "Creative Posts & Carousels", ar: "تصميم منشورات وكاروسيل احترافي" },
  { en: "Weekly Story Sequences", ar: "ستوريز أسبوعية تفاعلية منتظمة" },
  { en: "Dedicated Account Strategist", ar: "مستشار استراتيجي مخصص لنشاطك" },
  { en: "Meta Ads Campaign Setup & Management", ar: "إطلاق وإدارة حملات ميتا الممولة" },
  { en: "On-site Professional Video Shoot", ar: "جلسة تصوير فيديو ميدانية احترافية" },
  { en: "Business Website Architecture", ar: "موقع رقمي متكامل للشركة" },
  { en: "Custom CMS & Booking System", ar: "نظام إدارة محتوى وحجوزات مخصص" },
] as const;

/**
 * Official Exclusions Library for 1-click insertion in Admin CMS
 */
export const OFFICIAL_EXCLUSIONS_LIBRARY = [
  { en: "Photography / Videography", ar: "التصوير الفوتوغرافي والفيديو" },
  { en: "On-site Production Sessions", ar: "جلسات الإنتاج والتصوير الميداني" },
  { en: "Sponsoring / Ad Budget (Paid to Meta/TikTok)", ar: "ميزانية الإعلانات الممولة (تُدفع للمنصات مباشرة)" },
  { en: "Daily Story Live Operations", ar: "تشغيل الستوريز اليومية اللحظية" },
  { en: "Advanced Custom Web Development", ar: "برمجة أنظمة ومواقع إلكترونية مخصصة" },
  { en: "Domain Name & Server Hosting Fees", ar: "رسوم النطاق وحجز السيرفرات السنوية" },
  { en: "Influencer / Creator Contract Fees", ar: "أتعاب المؤثرين وصناع المحتوى الخارجيين" },
] as const;

/**
 * Target Business Types for Smart Matching Metadata
 */
export const TARGET_BUSINESS_TYPES = [
  { id: "restaurant_cafe", label: "Restaurant / Café", labelAr: "مطعم / مقهى" },
  { id: "ecommerce", label: "E-Commerce / Store", labelAr: "متجر إلكتروني / تجارة رقمية" },
  { id: "retail", label: "Retail & Boutique", labelAr: "متجر بيع بالتجزئة ومحلات" },
  { id: "b2b_services", label: "B2B & Professional Services", labelAr: "شركات وخدمات أعمال B2B" },
  { id: "real_estate", label: "Real Estate & Architecture", labelAr: "عقارات وتطوير عقاري" },
  { id: "healthcare_clinic", label: "Healthcare & Clinics", labelAr: "عيادات ومراكز طبية" },
  { id: "beauty_wellness", label: "Beauty & Wellness", labelAr: "تجميل وعناية ومراكز سبا" },
  { id: "tech_software", label: "Tech & SaaS", labelAr: "تكنولوجيا وبرمجيات" },
] as const;

/**
 * Target Strategic Goals for Smart Matching Metadata
 */
export const TARGET_STRATEGIC_GOALS = [
  { id: "social_growth", label: "Social Media Growth", labelAr: "النمو والانتشار في وسائل التواصل" },
  { id: "leads", label: "Lead Generation", labelAr: "جلب عملاء محتملين واستفسارات" },
  { id: "sales", label: "Sales & Conversions", labelAr: "زيادة المبيعات والطلبات المباشرة" },
  { id: "brand_authority", label: "Brand Authority & Positioning", labelAr: "بناء مكانة وهوية فاخرة للعلامة" },
  { id: "paid_ads", label: "Paid Advertising (Meta/TikTok)", labelAr: "إدارة حملات إعلانية ممولة" },
  { id: "video_production", label: "Video & Content Production", labelAr: "إنتاج محتوى وتصوير احترافي" },
  { id: "website_systems", label: "Website & Digital Systems", labelAr: "بناء وتطوير موقع أو نظام رقمي" },
] as const;

/**
 * Growth Stages
 */
export const GROWTH_STAGES = [
  { id: "early_startup", label: "Early / Startup", labelAr: "مشروع ناشئ / جديد" },
  { id: "scaling", label: "Growth / Scaling", labelAr: "مرحلة نمو وتوسع" },
  { id: "enterprise", label: "Established / Market Leader", labelAr: "شركة قائمة / رائدة في السوق" },
] as const;
