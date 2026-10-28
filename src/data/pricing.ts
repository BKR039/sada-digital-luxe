/**
 * @deprecated
 * HARDCODED RUNTIME PRICING IS DEPRECATED.
 * The Single Source of Truth for all SADA packages is Supabase `package_catalog`.
 * Consume packages dynamically via `package-service.ts` (`fetchPublicPackages`, `fetchPackageCatalog`).
 * These static arrays are preserved ONLY as an offline/initial fallback for legacy components.
 */

export type PackageId = "starter" | "growth" | "premium" | string;

export interface PricingFeature {
  label: string;
  included: boolean;
}

export interface PricingPlan {
  id: PackageId;
  name: string;
  tagline: string;
  price: number;
  currency: string;
  unit: string;
  features: PricingFeature[];
  popular?: boolean;
  cta: string;
}

export const PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter Pack",
    tagline: "Stay active and consistent on social media.",
    price: 699,
    currency: "TND",
    unit: "month",
    features: [
      { label: "4 Reels / month", included: true },
      { label: "4 Posts or Carousels / month", included: true },
      { label: "8 Stories / month", included: true },
      { label: "Community Management (Messages & Comments)", included: true },
      { label: "Monthly Content Planning", included: true },
    ],
    cta: "Start with SADA",
  },
  {
    id: "growth",
    name: "Growth Pack",
    tagline: "Full social growth engine with paid ads and reporting.",
    price: 1090,
    currency: "TND",
    unit: "month",
    features: [
      { label: "8 Reels / month", included: true },
      { label: "8 Posts or Carousels / month", included: true },
      { label: "Weekly Stories", included: true },
      { label: "Social Media Management", included: true },
      { label: "Meta Ads Management", included: true },
      { label: "Monthly Content Planning", included: true },
      { label: "Copywriting", included: true },
      { label: "Monthly Performance Report", included: true },
      { label: "Continuous Marketing Ideas", included: true },
      { label: "Professional Website", included: false },
      { label: "SEO Optimization", included: false },
      { label: "Online Booking / Ordering System", included: false },
      { label: "Priority Support", included: false },
    ],
    popular: true,
    cta: "Grow with SADA",
  },
  {
    id: "premium",
    name: "Premium Pack",
    tagline: "The complete SADA partnership — content, ads, website and growth.",
    price: 2490,
    currency: "TND",
    unit: "month",
    features: [
      { label: "8 Reels / month", included: true },
      { label: "8 Posts or Carousels / month", included: true },
      { label: "Professional Website", included: true },
      { label: "Social Media Management", included: true },
      { label: "Meta Ads Management", included: true },
      { label: "Monthly Content Planning", included: true },
      { label: "Copywriting", included: true },
      { label: "Monthly Performance Report", included: true },
      { label: "Continuous Marketing Ideas", included: true },
      { label: "Weekly Stories", included: true },
      { label: "SEO Optimization", included: true },
      { label: "Online Booking / Ordering System", included: true },
      { label: "Priority Support", included: true },
      { label: "Continuous Website Improvements", included: true },
    ],
    cta: "Scale with SADA",
  },
];

export const PLANS_AR: PricingPlan[] = [
  {
    id: "starter",
    name: "باقة البداية",
    tagline: "حضور نشط ومستمر ومتفاعل على منصات التواصل الاجتماعي.",
    price: 699,
    currency: "د.ت",
    unit: "شهرياً",
    features: [
      { label: "4 ريلز شهرياً", included: true },
      { label: "4 منشورات أو كاروسيل شهرياً", included: true },
      { label: "8 ستوريز شهرياً", included: true },
      { label: "إدارة المجتمع والتفاعل (الرد على الرسائل والتعليقات)", included: true },
      { label: "تخطيط وجدولة المحتوى الشهري", included: true },
    ],
    cta: "ابدأ مع صدى",
  },
  {
    id: "growth",
    name: "باقة النمو",
    tagline: "منظومة نمو متكاملة تشمل الإعلانات الممولة وتقارير الأداء الدورية.",
    price: 1090,
    currency: "د.ت",
    unit: "شهرياً",
    features: [
      { label: "8 ريلز شهرياً", included: true },
      { label: "8 منشورات أو كاروسيل شهرياً", included: true },
      { label: "ستوريز أسبوعية منتظمة", included: true },
      { label: "إدارة متكاملة لمنصات التواصل", included: true },
      { label: "إدارة إعلانات ميتا الممولة (Meta Ads)", included: true },
      { label: "تخطيط وجدولة المحتوى الشهري", included: true },
      { label: "كتابة الإعلانات والنصوص التسويقية", included: true },
      { label: "تقرير أداء شهري تفصيلي", included: true },
      { label: "أفكار واستشارات تسويقية مستمرة", included: true },
      { label: "موقع إلكتروني احترافي", included: false },
      { label: "تهيئة محركات البحث (SEO)", included: false },
      { label: "نظام حجز أو طلب إلكتروني", included: false },
      { label: "دعم فني ذو أولوية خاصة", included: false },
    ],
    popular: true,
    cta: "انمُ مع صدى",
  },
  {
    id: "premium",
    name: "باقة التميز",
    tagline: "شراكة استراتيجية كاملة مع صدى — محتوى، إعلانات، موقع إلكتروني ونمو مستدام.",
    price: 2490,
    currency: "د.ت",
    unit: "شهرياً",
    features: [
      { label: "8 ريلز شهرياً", included: true },
      { label: "8 منشورات أو كاروسيل شهرياً", included: true },
      { label: "موقع إلكتروني احترافي متكامل", included: true },
      { label: "إدارة متكاملة لمنصات التواصل", included: true },
      { label: "إدارة إعلانات ميتا الممولة (Meta Ads)", included: true },
      { label: "تخطيط وجدولة المحتوى الشهري", included: true },
      { label: "كتابة الإعلانات والنصوص التسويقية", included: true },
      { label: "تقرير أداء شهري تفصيلي", included: true },
      { label: "أفكار واستشارات تسويقية مستمرة", included: true },
      { label: "ستوريز أسبوعية منتظمة", included: true },
      { label: "تهيئة محركات البحث (SEO)", included: true },
      { label: "نظام حجز أو طلب إلكتروني", included: true },
      { label: "دعم فني ذو أولوية خاصة", included: true },
      { label: "تطوير وتحسين مستمر للموقع", included: true },
    ],
    cta: "توسع مع صدى",
  },
];

export function getLocalizedPlans(lang: "en" | "ar"): PricingPlan[] {
  return lang === "ar" ? PLANS_AR : PLANS;
}

export function getPackageById(id: string | null | undefined): PricingPlan | undefined {
  if (!id) return undefined;
  const normalized = id.toLowerCase().trim();
  const direct = PLANS.find((p) => p.id === normalized);
  if (direct) return direct;
  if (normalized.startsWith("mg-01") || normalized === "starter") return PLANS.find((p) => p.id === "starter");
  if (normalized.startsWith("mg-02") || normalized.startsWith("mg-03") || normalized === "growth") return PLANS.find((p) => p.id === "growth");
  if (normalized.startsWith("mg-04") || normalized.startsWith("hy-") || normalized === "premium") return PLANS.find((p) => p.id === "premium");
  return PLANS.find((p) => p.id === "growth") || PLANS[0];
}

export function getLocalizedPackageById(
  id: string | null | undefined,
  lang: "en" | "ar" = "en"
): PricingPlan | undefined {
  if (!id) return undefined;
  const normalized = id.toLowerCase().trim();
  const pool = lang === "ar" ? PLANS_AR : PLANS;
  const direct = pool.find((p) => p.id === normalized);
  if (direct) return direct;
  if (normalized.startsWith("mg-01") || normalized === "starter") return pool.find((p) => p.id === "starter");
  if (normalized.startsWith("mg-02") || normalized.startsWith("mg-03") || normalized === "growth") return pool.find((p) => p.id === "growth");
  if (normalized.startsWith("mg-04") || normalized.startsWith("hy-") || normalized === "premium") return pool.find((p) => p.id === "premium");
  return pool.find((p) => p.id === "growth") || pool[0];
}

export function isValidPackageId(id: string | null | undefined): id is PackageId {
  return Boolean(id && id.trim().length > 0);
}

